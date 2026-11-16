import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SourceCompObservation } from "@/domain/meta/schemas";
import { getDb } from "@/server/db/client";
import { rawArtifacts, evidenceRefs, metaSourceSnapshots } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

import { classifyTacticsGroup, ARCHETYPE_SIGNATURES } from "@/ingestion/meta/tactics-tools-classifier";

/**
 * Kiểm tra tính tương thích giữa slug của guide và ID/tên comp của observation.
 */
export function matchesCompSlug(guideSlug: string, compId: string, provider: string): boolean {
  if (!guideSlug || !compId) return false;
  const s = guideSlug.trim().toLowerCase();
  const c = compId.trim().toLowerCase();
  if (s === c) return true;
  if (c === `${provider}_${s}`) return true;

  // Chuẩn hóa loại bỏ các tiền tố nhận diện và ký tự phân cách
  const normSlug = s.replace(/^(?:set-18-|tftacademy_|tftflex_|tactics_comp_comp_|tactics_comp_|tactics_tools_|tactics_|metatft_cluster_|metatft_|datatft_|comp_|cluster_)/, "").replace(/[-_]/g, "");
  const normComp = c.replace(/^(?:tftacademy_comp_|tftacademy_|tftflex_|tactics_comp_comp_|tactics_comp_|tactics_tools_|tactics_|metatft_cluster_|metatft_|datatft_|set-18-|comp_|cluster_)/, "").replace(/[-_]/g, "");

  if (!normSlug || !normComp) return false;
  if (normSlug === normComp) return true;
  return false;
}

// Read the same current bytes as the integrity gate. Mutable paths must not retain an old claim index.
function getRawContent(filePath: string): string {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return ""; }
}

/**
 * Bóc tách tập hợp chính xác các định danh đội hình (comp slugs / cluster IDs / signatures)
 * có thật bên trong tập tin raw trên đĩa. Không dùng substring includes mơ hồ.
 */
export function extractSubstantiatedCompsFromRaw(storagePath: string): Set<string> {
  const slugs = new Set<string>();
  const content = getRawContent(storagePath);
  if (!content) {
    return slugs;
  }

  // 1. TFT Academy tierlist comp slugs: /tierlist/comps/(set-18-...)
  for (const m of content.matchAll(/\/tierlist\/comps\/(set-18-[a-z0-9-]+)/gi)) {
    slugs.add(m[1].toLowerCase());
  }

  // 2. TFTFlex Set 18 comp slugs: /meta/set-18/(...) hoặc slug:"(...)",set:18
  for (const m of content.matchAll(/\/meta\/set-18\/([a-z0-9-]+)/gi)) {
    slugs.add(m[1].toLowerCase());
  }
  for (const m of content.matchAll(/slug:"([a-z0-9-]+)",set:18/gi)) {
    slugs.add(m[1].toLowerCase());
  }

  // 3. tactics.tools statistical groups (__NEXT_DATA__ hoặc initialData.groups JSON)
  if (content.includes("initialData") && content.includes("groups")) {
    try {
      let jsonStr = content;
      const nextDataMatch = content.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (nextDataMatch) {
        jsonStr = nextDataMatch[1];
      }
      const parsed = JSON.parse(jsonStr);
      const groups =
        parsed?.initialData?.groups ||
        parsed?.props?.pageProps?.initialData?.groups ||
        [];
      if (Array.isArray(groups) && groups.length > 0) {
        for (const grp of groups) {
          const cls = classifyTacticsGroup(grp, { minConfidence: 0.60 });
          if (cls.matched && cls.archetypeId) {
            const arch = cls.archetypeId.toLowerCase();
            slugs.add(arch);
            slugs.add(`tactics_comp_${arch}`);
            slugs.add(`tactics_tools_${arch}`);
          }
        }

      }
    } catch {
      // Bỏ qua nếu không phải cấu trúc JSON hợp lệ
    }
  }

  // 4. MetaTFT / DataTFT JSON comp / cluster IDs
  if (content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      const clustersList =
        parsed?.cluster_info?.cluster_details?.clusters ||
        parsed?.results?.cluster_details?.clusters ||
        parsed?.cluster_details?.clusters ||
        (Array.isArray(parsed?.clusters) ? parsed.clusters : null);
      if (Array.isArray(clustersList)) {
        for (const item of clustersList) {
          if (item?.Cluster != null) {
            const cleanId = String(item.Cluster).toLowerCase();
            slugs.add(cleanId);
            slugs.add(`cluster_${cleanId}`);
            slugs.add(`metatft_cluster_${cleanId}`);
          }
        }
      }
      const clusterInfo = parsed?.cluster_info || parsed?.results?.cluster_details;
      if (clusterInfo && typeof clusterInfo === "object" && !Array.isArray(clusterInfo)) {
        for (const id of Object.keys(clusterInfo)) {
          const cleanId = id.toLowerCase();
          slugs.add(cleanId);
          slugs.add(`cluster_${cleanId}`);
          slugs.add(`metatft_cluster_${cleanId}`);
        }
      }
      const dataList = parsed?.data?.list;
      if (Array.isArray(dataList)) {
        for (const item of dataList) {
          if (item && item.id != null) {
            const idStr = String(item.id).toLowerCase();
            slugs.add(idStr);
            slugs.add(`datatft_${idStr}`);
          }
        }
      }
    } catch {
      // Bỏ qua nếu không phải JSON hợp lệ
    }
  }


  return slugs;
}

/**
 * Kiểm tra xem raw artifact trên đĩa có thực sự chứng minh (substantiate) claim đội hình hay không.
 * Bảo đảm mọi nhánh (raw-only, generic evidence, guide, DB evidence) đều đối chiếu chính xác canonical comp identity.
 */
export function isClaimSubstantiatedByRaw(
  storagePath: string,
  sourceCompId?: string,
  sourceUrl?: string,
  provider?: string,
  locator?: string
): { substantiated: boolean; reason?: string } {
  if (!storagePath) {
    return { substantiated: false, reason: "Thiếu đường dẫn tập tin raw trên đĩa" };
  }

  // Khi gọi resolveEvidenceRefs độc lập không truyền claim (cả sourceCompId và sourceUrl đều undefined)
  if (sourceCompId === undefined && sourceUrl === undefined) {
    return { substantiated: true };
  }

  const compId = typeof sourceCompId === "string" ? sourceCompId.trim() : "";
  if (!compId) {
    return { substantiated: false, reason: "Observation thiếu sourceCompId hợp lệ để xác minh claim đội hình" };
  }

  if (sourceUrl && provider) {
    const hosts: Record<string, string> = {tftacademy:"tftacademy.com",tftflex:"tftflex.com",tactics_tools:"tactics.tools",metatft:"metatft.com",datatft:"datatft.com"};
    try {
      const url = new URL(sourceUrl);
      if (url.protocol !== "https:" || url.username || url.password || (hosts[provider] && url.hostname.replace(/^www\./, "") !== hosts[provider])) {
        return {substantiated:false, reason:"URL nguồn không thuộc nhà cung cấp của claim"};
      }
    } catch { return {substantiated:false, reason:"URL nguồn không hợp lệ"}; }
  }

  // 1. Nếu sourceUrl chứa đường dẫn comp cụ thể, bắt buộc phải khớp với sourceCompId (chặn OR-bypass & mâu thuẫn nội bộ)
  if (sourceUrl && typeof sourceUrl === "string") {
    const urlMatch = sourceUrl.match(/\/(?:comps|guides|meta\/set-18)\/([a-z0-9_-]+)/i);
    if (urlMatch) {
      const urlSlug = urlMatch[1];
      if (!matchesCompSlug(urlSlug, compId, provider || "")) {
        return {
          substantiated: false,
          reason: `Claim sourceUrl '${sourceUrl}' (slug '${urlSlug}') mâu thuẫn với sourceCompId '${compId}'`
        };
      }
    }
  }

  // 2. Nếu locator chỉ định slug/signature cụ thể, bắt buộc phải khớp với sourceCompId
  if (locator && typeof locator === "string") {
    const sigMatch =
      locator.match(/signature\s+([a-z0-9_-]+)/i) ||
      locator.match(/slug=["']?([a-z0-9_-]+)["']?/i) ||
      locator.match(/comps\[["']?([a-z0-9_-]+)["']?\]/i);
    if (sigMatch) {
      const locComp = sigMatch[1];
      if (!matchesCompSlug(locComp, compId, provider || "")) {
        return {
          substantiated: false,
          reason: `Locator '${locator}' (comp '${locComp}') mâu thuẫn với sourceCompId '${compId}'`
        };
      }
    }
  }

  const normPath = storagePath.replace(/\\/g, "/");

  // 3. Kiểm tra nếu tập tin là một guide artifact độc lập (chỉ dành riêng cho 1 comp cụ thể)
  let guideSlug: string | undefined;
  for (const [slug, def] of Object.entries(KNOWN_GUIDE_ARTIFACTS)) {
    if (normPath.endsWith(def.storageFile) || path.basename(storagePath, ".html") === slug) {
      guideSlug = slug;
      break;
    }
  }


  if (guideSlug) {
    if (!matchesCompSlug(guideSlug, compId, provider || "")) {
      return {
        substantiated: false,
        reason: `Artifact guide '${guideSlug}' không khớp claim sourceCompId '${compId}'`
      };
    }
    return { substantiated: true };
  }

  // 4. Tập tin raw là parent tierlist / aggregated dataset (vd tftacademy_tierlist_live.html, tftflex_meta_18_2.html, tactics_tools_nextdata.json)
  if (!fs.existsSync(storagePath)) {
    return { substantiated: false, reason: `Tập tin raw không tồn tại trên đĩa: ${storagePath}` };
  }

  const substantiatedComps = extractSubstantiatedCompsFromRaw(storagePath);
  const matched = Array.from(substantiatedComps).some((slug) =>
    matchesCompSlug(slug, compId, provider || "")
  );
  if (matched) {
    return { substantiated: true };
  }

  return {
    substantiated: false,
    reason: `Tập tin raw '${path.basename(storagePath)}' không chứa bằng chứng về claim đội hình '${compId}'`
  };
}

export interface KnownArtifactDefinition {
  storageFile: string;
  provider: string;
  patchEpochId: string;
  sha256: string;
  byteSize: number;
}

/**
 * Bảng đăng ký authentic artifacts của các nhà cung cấp dữ liệu cho Set 18.
 * Mỗi artifact pin chính xác storageFile, provider, patchEpochId, SHA-256 và byteSize.
 */
export const KNOWN_PROVIDER_ARTIFACTS: Record<string, KnownArtifactDefinition> = {
  art_tftacademy_18_2: {
    storageFile: "tftacademy_tierlist_live.html",
    provider: "tftacademy",
    patchEpochId: "epoch_18_2",
    sha256: "a1ce5a3c362049be3114c73a83182de99d0efc5faab946d5ef346db379adc01e",
    byteSize: 298398
  },
  art_tactics_tools_18_2: {
    storageFile: "tactics_tools_comps.html",
    provider: "tactics_tools",
    patchEpochId: "epoch_18_2",
    sha256: "49352109cd251d2ade6c4c7a469c2728a86c502a67ef16bd53f28df3bca7a3ab",
    byteSize: 1029995
  },
  art_tftflex_18_2: {
    storageFile: "tftflex_meta_18_2.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "f65361813a2c5ccc67729cd8515d0d59bf042437bc62747450a17d05dc733d0d",
    byteSize: 224596
  },
  art_datatft_18_2: {
    storageFile: "datatft_comps.json",
    provider: "datatft",
    patchEpochId: "epoch_18_2",
    sha256: "36413566ba9db0609b0e697108fa4a078ae347966ec10fd2ab51531945096ddd",
    byteSize: 3896
  },
  art_metatft_18_2: {
    storageFile: "metatft_cluster_info.json",
    provider: "metatft",
    patchEpochId: "epoch_18_2",
    sha256: "5aa6eda6c35b21e8daeac3ce7e1d40b65fe4e4ede7df4641e3971d1b4a47d55b",
    byteSize: 342923
  },
  art_metatft_cluster_5aa6eda6c35b21e8: {
    storageFile: "metatft_cluster_info.json",
    provider: "metatft",
    patchEpochId: "epoch_18_2",
    sha256: "5aa6eda6c35b21e8daeac3ce7e1d40b65fe4e4ede7df4641e3971d1b4a47d55b",
    byteSize: 342923
  },
  art_tactics_tools_comps_49352109cd25: {
    storageFile: "tactics_tools_comps.html",
    provider: "tactics_tools",
    patchEpochId: "epoch_18_2",
    sha256: "49352109cd251d2ade6c4c7a469c2728a86c502a67ef16bd53f28df3bca7a3ab",
    byteSize: 1029995
  },
  art_tactics_tools_comps_c47bb1ae7fd3: {
    storageFile: "sha256/c4/c47bb1ae7fd3fa60f0a051fb01e063628eda4dc6f427da9b1c95e133e17c3390.html",
    provider: "tactics_tools",
    patchEpochId: "epoch_18_2",
    sha256: "c47bb1ae7fd3fa60f0a051fb01e063628eda4dc6f427da9b1c95e133e17c3390",
    byteSize: 481441
  },
  "art_tftacademy_set-18-dragon-princess_580dbccc0215": {
    storageFile: "sha256/58/580dbccc0215e86b4c20329eb927c86af537d92d475a18ff43eab69243cf0655.html",
    provider: "tftacademy",
    patchEpochId: "epoch_18_2",
    sha256: "580dbccc0215e86b4c20329eb927c86af537d92d475a18ff43eab69243cf0655",
    byteSize: 481472
  },
  // Các artifact snapshot từ DB test seeded cho Set 18
  "art_tftacademy_set-18-dragon-princess_b9065ba1499b": {
    storageFile: "sha256/b9/b9065ba1499bafa0adb9a43f79d8b61b634afa225245a4ff286d75b078547ee1.html",
    provider: "tftacademy",
    patchEpochId: "epoch_18_2",
    sha256: "b9065ba1499bafa0adb9a43f79d8b61b634afa225245a4ff286d75b078547ee1",
    byteSize: 457764
  },
  art_tactics_tools_comps_e307c0598289: {
    storageFile: "sha256/e3/e307c05982893c88dad7c75d4c73b96ad04c34216cad0dbe3d90c10f6940fb61.html",
    provider: "tactics_tools",
    patchEpochId: "epoch_18_2",
    sha256: "e307c05982893c88dad7c75d4c73b96ad04c34216cad0dbe3d90c10f6940fb61",
    byteSize: 481755
  },
  art_tftflex_meta_18_2_3c5a0d031a1f: {
    storageFile: "sha256/3c/3c5a0d031a1f4277176b76a495817b6ea6b4aae5bacb0b594400eef431188b97.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "3c5a0d031a1f4277176b76a495817b6ea6b4aae5bacb0b594400eef431188b97",
    byteSize: 224596
  },
  art_tftflex_meta_18_2_412171ca1071: {
    storageFile: "sha256/41/412171ca1071cc6dcbb05925c4b0fcb02f7805f61420f8a7b62d97d9a7b5c9fe.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "412171ca1071cc6dcbb05925c4b0fcb02f7805f61420f8a7b62d97d9a7b5c9fe",
    byteSize: 224596
  },
  art_tftflex_meta_18_2_e9c56f66c407: {
    storageFile: "sha256/e9/e9c56f66c4073caccc390535f901653dc4de1f5c662386bcab7ee86fd0f237a9.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "e9c56f66c4073caccc390535f901653dc4de1f5c662386bcab7ee86fd0f237a9",
    byteSize: 224596
  },
  art_tftflex_meta_18_2_102a203e0b76: {
    storageFile: "sha256/10/102a203e0b76e43b061c638e01d824e2f99700df1d8d9e2ac7290db94dbb835d.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "102a203e0b76e43b061c638e01d824e2f99700df1d8d9e2ac7290db94dbb835d",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_3b4dc10f9989: {
    storageFile: "sha256/3b/3b4dc10f9989a63ba15148413417fc46621c204a26add4dafe6884ee1cfcfefc.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "3b4dc10f9989a63ba15148413417fc46621c204a26add4dafe6884ee1cfcfefc",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_6161b2c4e8b1: {
    storageFile: "sha256/61/6161b2c4e8b11487c37dc7ef5e954139c0ce6ef9c15476fb5aa76e0cbbb048ae.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "6161b2c4e8b11487c37dc7ef5e954139c0ce6ef9c15476fb5aa76e0cbbb048ae",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_93b39fb17a4a: {
    storageFile: "sha256/93/93b39fb17a4a059a3511803be6dfa2d3c95e50d9c5ac81618114cacd53cc64c8.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "93b39fb17a4a059a3511803be6dfa2d3c95e50d9c5ac81618114cacd53cc64c8",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_5a7dd6736e41: {
    storageFile: "sha256/5a/5a7dd6736e41feb3ce263036a0e3eb78b97e4374e960574fe6bb075f875ef545.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "5a7dd6736e41feb3ce263036a0e3eb78b97e4374e960574fe6bb075f875ef545",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_2657f22fb544: {
    storageFile: "sha256/26/2657f22fb544abe5ee87308e77e174a232e71a8c7646c28309f110459e990659.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "2657f22fb544abe5ee87308e77e174a232e71a8c7646c28309f110459e990659",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_69704febc194: {
    storageFile: "sha256/69/69704febc19495e524af8bd2b16cb64dad3059db694b7a527144c81e9e0e5bbb.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "69704febc19495e524af8bd2b16cb64dad3059db694b7a527144c81e9e0e5bbb",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_0678b26215a0: {
    storageFile: "sha256/06/0678b26215a055dec14517557a8cfb03870ee0afcecd113a97ee50d39649b6dd.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "0678b26215a055dec14517557a8cfb03870ee0afcecd113a97ee50d39649b6dd",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_8a49f6cfca97: {
    storageFile: "sha256/8a/8a49f6cfca970cb4c8a839c681844bec2ca57d57f6192c1eed705c5032141569.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "8a49f6cfca970cb4c8a839c681844bec2ca57d57f6192c1eed705c5032141569",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_f998d7a991b7: {
    storageFile: "sha256/f9/f998d7a991b7b813a6318b0b2135c2067e8385a41218a7ebdcb21d0e35882966.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "f998d7a991b7b813a6318b0b2135c2067e8385a41218a7ebdcb21d0e35882966",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_5b21d011541f: {
    storageFile: "sha256/5b/5b21d011541f653560eb97ef136c237fdf9ba8e676c1330dcd7731c7aeaf4cfb.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "5b21d011541f653560eb97ef136c237fdf9ba8e676c1330dcd7731c7aeaf4cfb",
    byteSize: 225739
  },
  art_tftflex_meta_18_2_f65361813a2c: {
    storageFile: "sha256/f6/f65361813a2c5ccc67729cd8515d0d59bf042437bc62747450a17d05dc733d0d.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "f65361813a2c5ccc67729cd8515d0d59bf042437bc62747450a17d05dc733d0d",
    byteSize: 224596
  },
  art_tftflex_meta_18_2_5a72983f9141: {
    storageFile: "sha256/5a/5a72983f91416f1aad087bb8a705c729e5f2890736d0c40727998f3d22a5a4cf.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "5a72983f91416f1aad087bb8a705c729e5f2890736d0c40727998f3d22a5a4cf",
    byteSize: 225737
  },
  art_tftflex_meta_18_2_4052dc7ae8ba: {
    storageFile: "sha256/40/4052dc7ae8ba0cb37b86b6543a39cd73b26e29b69634a52cd82098b31f924305.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "4052dc7ae8ba0cb37b86b6543a39cd73b26e29b69634a52cd82098b31f924305",
    byteSize: 225737
  },
  art_tftflex_meta_18_2_5bdec2ac5115: {
    storageFile: "sha256/5b/5bdec2ac5115dc5e1a054670c3403b9ad1b2dca9e88b61c3d836b9ce56738451.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "5bdec2ac5115dc5e1a054670c3403b9ad1b2dca9e88b61c3d836b9ce56738451",
    byteSize: 225737
  },
  art_tftflex_meta_18_2_cf0dc4628100: {
    storageFile: "sha256/cf/cf0dc4628100c16892f50db36b676367040d0ca6b5c749abf46f9c03d07a7e80.html",
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    sha256: "cf0dc4628100c16892f50db36b676367040d0ca6b5c749abf46f9c03d07a7e80",
    byteSize: 225737
  }
};

export interface KnownGuideDefinition {
  provider: string;
  patchEpochId: string;
  storageFile: string;
  sha256: string;
  byteSize: number;
  parentArtifactId: string;
}

/**
 * Danh mục authentic guide artifacts trên đĩa với SHA-256 digest và byteSize bất biến.
 * Dùng để kiểm định tính toàn vẹn (integrity) và nguồn gốc (provenance) của các guide evidence refs.
 */
export const KNOWN_GUIDE_ARTIFACTS: Record<string, KnownGuideDefinition> = {
  "set-18-6-juggernaut-ap": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-6-juggernaut-ap.html", sha256: "825cb81eaf630e24efea0675b450c016fc8c200994ae9e99e23a18d802673575", byteSize: 475852, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-adaptor-nidalee": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-adaptor-nidalee.html", sha256: "f0c475ec0a5843cd17012de7fb5c9eb0a452f5a4f7d5a2b0135b5b5abd306216", byteSize: 467034, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-adaptor-reroll-copy": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-adaptor-reroll-copy.html", sha256: "900a06cf5a17e826d2586327275b66211331a1336e63c4713e1d248394a60535", byteSize: 481253, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-ahri-morgana": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-ahri-morgana.html", sha256: "840dc8e7772d09566db102f1506c1d3f96bad3cb4ebdb61968d2974e5abbb865", byteSize: 473614, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-aphelios-nidalee": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-aphelios-nidalee.html", sha256: "df23daff5c0f8f75d7df0e31737501286d8f993ccf8a27b2e6bfff054d326660", byteSize: 477880, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-blossom-fast-9": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-blossom-fast-9.html", sha256: "81f5721ce5d5d904dd8f589e1465a0c31adc97c425b14e46d5885030631be9c1", byteSize: 451994, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-caitlyn-hunters": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-caitlyn-hunters.html", sha256: "a4d3f3f9632666583707887920cff0304fbde0c23ab7536eeb6fa1924c043171", byteSize: 470688, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-cashout-morgana": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-cashout-morgana.html", sha256: "c2e7b557ef8b962c04a23d2073466511b1586aacce40fbb11d6b17cef25f5296", byteSize: 465398, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-dark-mages": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-dark-mages.html", sha256: "30dd50618b97f9e46570e6182087e51ad90e1e5ecd983eabe70b2109958520ef", byteSize: 462025, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-defender-cassio": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-defender-cassio.html", sha256: "ec2fa06e591a144332729a2e04dcd7a84b1a58ae8bf950e49fb5e7395a10d747", byteSize: 482633, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-dragon-princess": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-dragon-princess.html", sha256: "580dbccc0215e86b4c20329eb927c86af537d92d475a18ff43eab69243cf0655", byteSize: 481472, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-elderwood-executioners-copy": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-elderwood-executioners-copy.html", sha256: "586c8c112d638d4bb6798bad2d968df6bbb2b5f904853215dc3ea5ec888b5be0", byteSize: 488835, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-fae-tristana-copy": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-fae-tristana-copy.html", sha256: "c6916d217cd01e23eec808d362c19f9e43a9f1e21609c656ef946977e6bf6268", byteSize: 458305, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-invoker-nidalee-copy": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-invoker-nidalee-copy.html", sha256: "034d0d9753a92c6ae88d249549b535ed97a3297f842a698c610e56feea8f522d", byteSize: 481441, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-lunarwood-khazix": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-lunarwood-khazix.html", sha256: "b792ff6178d7c6084326e920a2f186cf90a992aa99cc2b757cd77ccaf41a53cc", byteSize: 492646, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-moo-nara": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-moo-nara.html", sha256: "84436d78fa1fe0b17839b90bf0a68eed24f9d9f32d73ca74e7dbb8615e4e370f", byteSize: 444670, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-rengar-rr": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-rengar-rr.html", sha256: "92c163f60f25c292b8f1682ec6e5b73f539fe3306813f7a512ab1be6c51e9606", byteSize: 477350, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-riftbeast-reroll": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-riftbeast-reroll.html", sha256: "3a92219b8b9a229c0b169e5fbecc681e2eb1b029a1c7550c2d2474fcc25a52ca", byteSize: 474614, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-solar-kayle": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-solar-kayle.html", sha256: "b283bca62d21ffc688d947f106b6b6a61bab9557b11ff090fbe79f6e72071376", byteSize: 482591, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-solar-melee": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-solar-melee.html", sha256: "4e94b6fb030507961bb1511569f4b16c10d047ff68971abe2588f53407854cb8", byteSize: 481060, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-solara-yunara": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-solara-yunara.html", sha256: "ef97c7c4dd187c890c05c75ad130a613dc745a12e9253e0c7dd1e2e56c61476a", byteSize: 470421, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-soraka-flex": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-soraka-flex.html", sha256: "71c230c1964dc05bc35ba9a482db3d2220f309c6d45c3c65bbe7f7dd504f91bd", byteSize: 475095, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-sprykin-teemo-copy": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-sprykin-teemo-copy.html", sha256: "a62eed1917d3adcc0d30c5b6d97258b3b671962658d5b8de79550b604bca176f", byteSize: 470411, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-sprykin-trist": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-sprykin-trist.html", sha256: "5d4c546723818479e83c9379ef36e254dc48fda360702bffee2658910609fbcd", byteSize: 459649, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-trait-ladder": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-trait-ladder.html", sha256: "28135e204f40022377e245e372671a4af5502b4356f21ec8e085426944e7dc58", byteSize: 468614, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-unrivaled-reroll": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-unrivaled-reroll.html", sha256: "9374e12cd2d4f6a3a736b37b40ac30d657e64d7cbb3e1c84b53b0c930039e811", byteSize: 471053, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-veigar-consuming-flora-copy": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-veigar-consuming-flora-copy.html", sha256: "59e95c210093543a7037f73469865fb12756f26625c6be6d4559945e77dca679", byteSize: 491902, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-warwick-rr": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-warwick-rr.html", sha256: "90c381fac1db792d702c9162fdaa364143acf8dee74b556653ddc26d517d625d", byteSize: 471151, parentArtifactId: "art_tftacademy_18_2" },
  "set-18-woodblossom": { provider: "tftacademy", patchEpochId: "epoch_18_2", storageFile: "tftacademy/set-18-woodblossom.html", sha256: "d0c43ef0692a32de4b404c416b15f227ef7be7d1ecea5c81729f8a019363ff51", byteSize: 466516, parentArtifactId: "art_tftacademy_18_2" },
  "a-phelios-than-rung": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/a-phelios-than-rung.html", sha256: "1b7d604c8c8c6685c013dd6a1b944a8614c38cc116a0ef2486da3ae23eaa23ea", byteSize: 295100, parentArtifactId: "art_tftflex_18_2" },
  "ahri-ashe": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/ahri-ashe.html", sha256: "0201437cd7d5ccbe42411fe88b054b679d9c60cd710310767b7f02151ed07c67", byteSize: 467329, parentArtifactId: "art_tftflex_18_2" },
  "akali-camille": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/akali-camille.html", sha256: "91e27a8a9419bc9a17a7ea6e6d92d644974b8f8e91cdf3aa2b67ab99fca261eb", byteSize: 272328, parentArtifactId: "art_tftflex_18_2" },
  "aphelios-vanguard": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/aphelios-vanguard.html", sha256: "23af7863871057f5ce02d5400706fcc306ea5716d666505eb4523cfe434034c1", byteSize: 281223, parentArtifactId: "art_tftflex_18_2" },
  "caitlyn-reroll": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/caitlyn-reroll.html", sha256: "3405e0c9886ae4c7602691498de10c04f85fd0bfe0f2a3070e865cfddcba7542", byteSize: 349277, parentArtifactId: "art_tftflex_18_2" },
  "cassiopeia-reroll": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/cassiopeia-reroll.html", sha256: "b0927fc7c105b62388bbf23e492e87bfb5af531358b1c0a5127a8c218aca90f6", byteSize: 177050, parentArtifactId: "art_tftflex_18_2" },
  "fast-9-alune-ap": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/fast-9-alune-ap.html", sha256: "304bfca6f2cfcfbb7e83c1cd017e1bbd2f01f169bc6aee4ab9a6017c97d16c7f", byteSize: 205688, parentArtifactId: "art_tftflex_18_2" },
  "fast-9-ashe-ad": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/fast-9-ashe-ad.html", sha256: "b7eadedc6d30750adb5f7201225286ceb943bc3d1684e3efffe9d23bbc30f13d", byteSize: 274401, parentArtifactId: "art_tftflex_18_2" },
  "fast-9-draven-ad": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/fast-9-draven-ad.html", sha256: "9fd796d90a102bfac8b7c4a41c7a3dc108b59ec6a8c890dd667070e9ccca4d7f", byteSize: 375576, parentArtifactId: "art_tftflex_18_2" },
  "kayle-reroll": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/kayle-reroll.html", sha256: "407aced204870e3fd43b8dcde219949df0dd69c701fd31ea6e49ad4750fa0c47", byteSize: 277077, parentArtifactId: "art_tftflex_18_2" },
  "khazik-reroll": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/khazik-reroll.html", sha256: "23ffb476acc8b5a9d996942a161bc6af9769bd6fa6a238796cc55d49b4e0cd7a", byteSize: 450063, parentArtifactId: "art_tftflex_18_2" },
  "master-yi-reroll": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/master-yi-reroll.html", sha256: "9db78a492ece406e130a3bc4df2cd683ea54f9dfe07986b8d839365c7e4b1a66", byteSize: 254314, parentArtifactId: "art_tftflex_18_2" },
  "morgana-flex": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/morgana-flex.html", sha256: "9b089e371d0c92523cfa3b2fa2f673550023f156086cbe55ef1c769165d44ee3", byteSize: 292581, parentArtifactId: "art_tftflex_18_2" },
  "morgana-nidalee": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/morgana-nidalee.html", sha256: "e2e23970395183b455adadcdcadb8b99b60e3c40e0ecb087ae6e18d7fd162dad", byteSize: 279663, parentArtifactId: "art_tftflex_18_2" },
  "riftbeast-tempo": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/riftbeast-tempo.html", sha256: "1d2b0561dc23bc3de867d01a12ce07cff5cff78666a9d180d3cdbe3068c0a544", byteSize: 284052, parentArtifactId: "art_tftflex_18_2" },
  "sivir-nidalee": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/sivir-nidalee.html", sha256: "77b325dc3032fb0188ca87422fdce4e456e0a17c1609baf40fc3803212900b2f", byteSize: 191745, parentArtifactId: "art_tftflex_18_2" },
  "soraka-zyra": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/soraka-zyra.html", sha256: "298c5bdfa934aa69de3e43be30edb03802ce50577882495171d6afbc1c1d763d", byteSize: 205492, parentArtifactId: "art_tftflex_18_2" },
  "tristana-reroll": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/tristana-reroll.html", sha256: "e62719ea7fac4e6cfbd104ce8cd3290af475036726c017e62a712d20002b7181", byteSize: 289598, parentArtifactId: "art_tftflex_18_2" },
  "veigar-reroll": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/veigar-reroll.html", sha256: "68e8bb1128440eb35c842ad54b96cfb020b5dbee09a000f58c3503f1e97261db", byteSize: 365015, parentArtifactId: "art_tftflex_18_2" },
  "yunara-reroll": { provider: "tftflex", patchEpochId: "epoch_18_2", storageFile: "tftflex/yunara-reroll.html", sha256: "ae8c6815a7c3ead81480125a20238d6b2a506a8373aa01ee76692adad538fb41", byteSize: 284201, parentArtifactId: "art_tftflex_18_2" }
};

export interface KnownEvidenceDefinition {
  provider: string;
  patchEpochId: string;
  artifactId: string;
  locator?: string;
  url?: string;
}

/**
 * Bảng đăng ký evidence references chuẩn theo provider, gắn kết với artifact và patch epoch.
 */
export const KNOWN_PROVIDER_EVIDENCE_REFS: Record<string, KnownEvidenceDefinition> = {
  ev_tftacademy_18_2: {
    provider: "tftacademy",
    patchEpochId: "epoch_18_2",
    artifactId: "art_tftacademy_18_2",
    locator: "tierlist.comps",
    url: "https://tftacademy.com/tierlist"
  },
  ev_tactics_tools_18_2: {
    provider: "tactics_tools",
    patchEpochId: "epoch_18_2",
    artifactId: "art_tactics_tools_18_2",
    locator: "team-compositions",
    url: "https://tactics.tools/team-compositions"
  },
  ev_tftflex_18_2: {
    provider: "tftflex",
    patchEpochId: "epoch_18_2",
    artifactId: "art_tftflex_18_2",
    locator: "meta",
    url: "https://tftflex.com/en/meta"
  },
  ...Object.fromEntries(
    Object.entries(KNOWN_PROVIDER_ARTIFACTS)
      .filter(([artId]) => artId.startsWith("art_tftflex_meta_18_2_"))
      .map(([artId, def]) => [
        artId.replace("art_tftflex_meta_18_2_", "ev_tftflex_18_2_"),
        {
          provider: def.provider,
          patchEpochId: def.patchEpochId,
          artifactId: artId,
          locator: "meta",
          url: "https://tftflex.com/en/meta"
        }
      ])
  ),
  ev_datatft_18_2: {
    provider: "datatft",
    patchEpochId: "epoch_18_2",
    artifactId: "art_datatft_18_2",
    locator: "comps.tier",
    url: "https://www.datatft.com/comps/tier/"
  },
  ev_metatft_18_2: {
    provider: "metatft",
    patchEpochId: "epoch_18_2",
    artifactId: "art_metatft_18_2",
    locator: "comps",
    url: "https://www.metatft.com/comps"
  },
  ev_metatft_cluster_5aa6eda6c35b21e8: {
    provider: "metatft",
    patchEpochId: "epoch_18_2",
    artifactId: "art_metatft_cluster_5aa6eda6c35b21e8",
    locator: "comps",
    url: "https://www.metatft.com/comps"
  },
  ev_tactics_tools_comps_49352109cd25: {
    provider: "tactics_tools",
    patchEpochId: "epoch_18_2",
    artifactId: "art_tactics_tools_comps_49352109cd25",
    locator: "team-compositions",
    url: "https://tactics.tools/team-compositions"
  },
  ev_tactics_tools_comp_dragon_princess_c47bb1ae: {
    provider: "tactics_tools",
    patchEpochId: "epoch_18_2",
    artifactId: "art_tactics_tools_comps_c47bb1ae7fd3",
    locator: "team-compositions",
    url: "https://tactics.tools/team-compositions"
  },
  ev_tactics_tools_comp_masteryi_duelist_c47bb1ae: {
    provider: "tactics_tools",
    patchEpochId: "epoch_18_2",
    artifactId: "art_tactics_tools_comps_c47bb1ae7fd3",
    locator: "team-compositions",
    url: "https://tactics.tools/team-compositions"
  }
};

export interface ArtifactVerificationOptions {
  expectedSha256?: string;
  expectedByteSize?: number;
  expectedProvider?: string;
  expectedPatchEpochId?: string;
  expectedDatasetKind?: string;
  expectedCompId?: string;
}

export interface ArtifactResolutionResult {
  resolved: boolean;
  storagePath?: string;
  sha256?: string;
  byteSize?: number;
  provider?: string;
  patchEpochId?: string;
  reason?: string;
}

/**
 * Kiểm tra xem một bản ghi evidence trong DB có xung đột hoặc chứng thực dương tính cho compId hay không.
 */
function checkEvidenceRowClaimBinding(
  row: {
    id?: string | null;
    sourceId?: string | null;
    url?: string | null;
    locator?: string | null;
    title?: string | null;
    snippet?: string | null;
    artifactId?: string | null;
  },
  sourceCompId?: string,
  sourceUrl?: string,
  providerHint?: string
): { valid: boolean; positivelyBound: boolean; reason?: string } {
  const compId = typeof sourceCompId === "string" ? sourceCompId.trim() : "";
  const provider = providerHint || row.sourceId || "";

  if (!compId) {
    return {
      valid: false,
      positivelyBound: false,
      reason: "Observation thiếu sourceCompId hợp lệ để xác minh claim đội hình"
    };
  }

  // Kiểm tra tính nhất quán giữa sourceUrl và sourceCompId của chính observation
  if (sourceUrl && typeof sourceUrl === "string") {
    const obsUrlMatch = sourceUrl.match(/\/(?:comps|guides|meta\/set-18)\/([a-z0-9_-]+)/i);
    if (obsUrlMatch && !matchesCompSlug(obsUrlMatch[1], compId, provider)) {
      return {
        valid: false,
        positivelyBound: false,
        reason: `Claim sourceUrl '${sourceUrl}' mâu thuẫn với sourceCompId '${compId}'`
      };
    }
  }

  let positivelyBound = false;

  // 1. Kiểm tra URL của evidence row
  if (row.url) {
    const evUrlMatch = row.url.match(/\/(?:comps|guides|meta\/set-18)\/([a-z0-9_-]+)/i);
    if (evUrlMatch) {
      const evUrlSlug = evUrlMatch[1];
      if (!matchesCompSlug(evUrlSlug, compId, provider)) {
        return {
          valid: false,
          positivelyBound: false,
          reason: `Evidence URL '${row.url}' trỏ tới comp '${evUrlSlug}', không khớp với claim sourceCompId '${compId}'`
        };
      }
      positivelyBound = true;
    }
  }

  // 2. Kiểm tra locator của evidence row
  if (row.locator) {
    const locSlugMatch =
      row.locator.match(/slug=["']?([a-z0-9_-]+)["']?/i) ||
      row.locator.match(/comps\[["']?([a-z0-9_-]+)["']?\]/i) ||
      row.locator.match(/signature\s+([a-z0-9_-]+)/i);
    if (locSlugMatch) {
      const locSlug = locSlugMatch[1];
      if (!matchesCompSlug(locSlug, compId, provider)) {
        return {
          valid: false,
          positivelyBound: false,
          reason: `Evidence locator '${row.locator}' trỏ tới comp '${locSlug}', không khớp với claim sourceCompId '${compId}'`
        };
      }
      positivelyBound = true;
    }
  }

  // 3. Kiểm tra ID của evidence row nếu chứa định danh guide/comp
  if (row.id) {
    const idGuideMatch = row.id.match(/^ev_(?:tftacademy|tftflex|tactics_tools)_([a-z0-9_-]+?)(?:_[a-f0-9]{8,64})?$/i);
    if (idGuideMatch) {
      const idSlug = idGuideMatch[1];
      if (! KNOWN_PROVIDER_EVIDENCE_REFS[row.id] && !/^18_[0-9]+/i.test(idSlug)) {
        if (!matchesCompSlug(idSlug, compId, provider)) {
          return {
            valid: false,
            positivelyBound: false,
            reason: `Evidence ID '${row.id}' gắn với comp '${idSlug}', mâu thuẫn với claim '${compId}'`
          };
        }
        positivelyBound = true;
      }
    }
  }

  // 4. Kiểm tra title & snippet: phát hiện mâu thuẫn với comp khác hoặc khớp dương tính với comp hiện tại
  const textToCheck = `${row.title || ""} ${row.snippet || ""} ${row.id || ""}`.toLowerCase();
  for (const [knownSlug, def] of Object.entries(KNOWN_GUIDE_ARTIFACTS)) {
    if (!provider || def.provider === provider) {
      const readableName = knownSlug.replace(/^set-18-/, "").replace(/[-_]/g, " ");
      const slugMatchedInText =
        textToCheck.includes(knownSlug.toLowerCase()) ||
        (readableName.length >= 4 && textToCheck.includes(readableName.toLowerCase()));
      if (slugMatchedInText) {
        if (!matchesCompSlug(knownSlug, compId, def.provider)) {
          return {
            valid: false,
            positivelyBound: false,
            reason: `Evidence row (${row.id}) đề cập comp '${knownSlug}', mâu thuẫn với claim '${compId}'`
          };
        }
        positivelyBound = true;
      }
    }
  }

  for (const sig of ARCHETYPE_SIGNATURES) {
    const archId = sig.archetypeId.toLowerCase();
    if (textToCheck.includes(archId)) {
      if (!matchesCompSlug(archId, compId, provider)) {
        return {
          valid: false,
          positivelyBound: false,
          reason: `Evidence row (${row.id}) đề cập archetype '${archId}', mâu thuẫn với claim '${compId}'`
        };
      }
      positivelyBound = true;
    }
  }

  return { valid: true, positivelyBound };
}

/**
 * Helper kiểm tra an toàn tập tin trên đĩa:
 * - Chống path traversal và symlink escape ra ngoài storage/raw
 * - Yêu cầu là file thông thường (regular file)
 * - Đọc byte và tính/đối chiếu SHA-256 + byte size
 */
function verifyFileOnDisk(
  filePath: string,
  rawRootDir: string,
  expected?: { sha256?: string; byteSize?: number }
): { valid: boolean; sha256?: string; byteSize?: number; reason?: string } {
  try {
    const resolvedPath = path.resolve(filePath);
    const resolvedRawDir = path.resolve(rawRootDir);
    const rel = path.relative(resolvedRawDir, resolvedPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return { valid: false, reason: "Tập tin nằm ngoài thư mục storage/raw" };
    }
    if (!fs.existsSync(resolvedPath)) {
      return { valid: false, reason: "Tập tin không tồn tại trên đĩa" };
    }
    const realRawRootDir = fs.existsSync(resolvedRawDir) ? fs.realpathSync(resolvedRawDir) : resolvedRawDir;
    const realPath = fs.realpathSync(resolvedPath);
    const realRel = path.relative(realRawRootDir, realPath);
    if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
      return { valid: false, reason: "Symlink trỏ ra ngoài storage/raw" };
    }
    const stat = fs.statSync(realPath);
    if (!stat.isFile()) {
      return { valid: false, reason: "Không phải tập tin thông thường (regular file)" };
    }
    const buf = fs.readFileSync(realPath);
    const actualSha256 = crypto.createHash("sha256").update(buf).digest("hex").toLowerCase();
    const actualSize = buf.length;

    if (expected?.sha256 && actualSha256 !== expected.sha256.toLowerCase()) {
      return { valid: false, reason: `SHA-256 không khớp: nhận ${actualSha256}, kỳ vọng ${expected.sha256}` };
    }
    if (expected?.byteSize !== undefined && actualSize !== expected.byteSize) {
      return { valid: false, reason: `Byte size không khớp: nhận ${actualSize}, kỳ vọng ${expected.byteSize}` };
    }
    return { valid: true, sha256: actualSha256, byteSize: actualSize };
  } catch (err: any) {
    return { valid: false, reason: `Lỗi đọc tập tin: ${err.message}` };
  }
}

/**
 * Tra cứu và kiểm định sự tồn tại thực tế của raw artifact.
 * Tách biệt rõ ràng giữa Raw Integrity (tính toàn vẹn byte) và Provenance Verification (chứng thực nguồn gốc).
 */
export async function resolveRawArtifact(
  artifactId?: string | null,
  options?: ArtifactVerificationOptions
): Promise<ArtifactResolutionResult> {
  if (!artifactId || typeof artifactId !== "string" || !artifactId.trim()) {
    return { resolved: false, reason: "Thiếu artifactId" };
  }

  // Chống path traversal / relative escape
  if (artifactId.includes("..") || path.isAbsolute(artifactId)) {
    return { resolved: false, reason: "Path traversal / absolute path bị từ chối" };
  }

  const rawDir = path.resolve("./storage/raw");

  // 1. Tra cứu trong bảng đăng ký authentic artifacts của các provider
  const known = KNOWN_PROVIDER_ARTIFACTS[artifactId];
  if (known) {
    if (options?.expectedProvider && known.provider !== options.expectedProvider) {
      return {
        resolved: false,
        reason: `Provider không khớp: artifact thuộc '${known.provider}', quan sát ghi '${options.expectedProvider}'`
      };
    }
    if (options?.expectedPatchEpochId && known.patchEpochId !== options.expectedPatchEpochId) {
      return {
        resolved: false,
        reason: `Patch epoch không khớp: artifact thuộc '${known.patchEpochId}', quan sát ghi '${options.expectedPatchEpochId}'`
      };
    }

    if ((options?.expectedSha256 && options.expectedSha256.toLowerCase() !== known.sha256) || (options?.expectedByteSize !== undefined && options.expectedByteSize !== known.byteSize)) {
      return {resolved:false,reason:"Digest/size yêu cầu mâu thuẫn manifest đã pin"};
    }
    const filePath = path.join(rawDir, known.storageFile);
    const check = verifyFileOnDisk(filePath, rawDir, {
      sha256: options?.expectedSha256 || known.sha256,
      byteSize: options?.expectedByteSize ?? known.byteSize
    });
    if (check.valid) {
      return {
        resolved: true,
        storagePath: filePath,
        sha256: check.sha256,
        byteSize: check.byteSize,
        provider: known.provider,
        patchEpochId: known.patchEpochId
      };
    }
    return { resolved: false, reason: check.reason };
  }

  // 2. Tra cứu content-addressed full SHA-256 hash (chuẩn 64 ký tự hex)
  const sha64Match = artifactId.match(/^(?:sha256:)?([a-f0-9]{64})(?:\.[a-z0-9]+)?$/i);
  if (sha64Match) {
    const hash = sha64Match[1].toLowerCase();

    // Ràng buộc provenance: Một hash độc lập trên đĩa không có metadata không thể tự chứng minh provider hay patch
    if (options?.expectedProvider || options?.expectedPatchEpochId) {
      return {
        resolved: false,
        reason: `Bare content-addressed artifact (${hash}) thiếu chứng thực provenance (provider/patch)`
      };
    }

    const prefix = hash.slice(0, 2);
    const prefixDir = path.join(rawDir, "sha256", prefix);
    if (fs.existsSync(prefixDir)) {
      const entries = fs.readdirSync(prefixDir);
      const exactFile = entries.find((f) => path.parse(f).name.toLowerCase() === hash);
      if (exactFile) {
        const filePath = path.join(prefixDir, exactFile);
        const check = verifyFileOnDisk(filePath, rawDir, { sha256: hash });
        if (check.valid) {
          return {
            resolved: true,
            storagePath: filePath,
            sha256: check.sha256,
            byteSize: check.byteSize
          };
        }
      }
    }
    const directShaFile = path.join(rawDir, "sha256", `${hash}.json`);
    if (fs.existsSync(directShaFile)) {
      const check = verifyFileOnDisk(directShaFile, rawDir, { sha256: hash });
      if (check.valid) {
        return {
          resolved: true,
          storagePath: directShaFile,
          sha256: check.sha256,
          byteSize: check.byteSize
        };
      }
    }
  }

  // 3. Tra cứu bảng raw_artifacts trong DB (nếu DB đang kết nối)
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(rawArtifacts)
        .where(eq(rawArtifacts.id, artifactId))
        .limit(1);

      const matchedRow = rows.find((r: any) => r && r.id === artifactId && r.storageKey) || (rows.length === 1 && rows[0]?.storageKey ? rows[0] : undefined);
      if (matchedRow && matchedRow.storageKey) {
        const row = matchedRow;

        if (!/^[a-f0-9]{64}$/i.test(row.sha256 || "") || !Number.isInteger(row.byteSize) || row.byteSize < 0) {
          return {resolved:false,reason:"DB artifact thiếu digest/kích thước đã chứng thực"};
        }

        const filePath = path.resolve(rawDir, row.storageKey);
        const check = verifyFileOnDisk(filePath, rawDir, {
          sha256: row.sha256 || options?.expectedSha256,
          byteSize: row.byteSize ?? options?.expectedByteSize
        });
        if (!check.valid) {
          return { resolved: false, reason: check.reason };
        }

        // Tra cứu provenance độc lập (tuyệt đối không lấy từ options.expectedProvider hay options.expectedPatchEpochId của caller)
        let attestedProvider: string | undefined = KNOWN_PROVIDER_ARTIFACTS[row.id]?.provider;
        let attestedPatchEpochId: string | undefined = KNOWN_PROVIDER_ARTIFACTS[row.id]?.patchEpochId;

        // Tra cứu snapshot provenance receipt trong DB nếu chưa có từ registry
        if (!attestedProvider || !attestedPatchEpochId) {
          try {
            const requiredDataset = options?.expectedDatasetKind || "real";
            const snapRows = await db
              .select()
              .from(metaSourceSnapshots)
              .where(
                and(
                  eq(metaSourceSnapshots.rawArtifactId, row.id),
                  eq(metaSourceSnapshots.datasetKind, requiredDataset),
                  eq(metaSourceSnapshots.status, "published")
                )
              )
              .limit(1);
            const validSnaps = snapRows.filter((snap: any) => {
              const snapPatch =
                snap?.scope && typeof snap.scope === "object" ? (snap.scope as any).patchEpochId : undefined;
              return (
                snap &&
                snap.datasetKind === requiredDataset &&
                snap.status === "published" &&
                snap.rawArtifactId === row.id &&
                Boolean(snap.sourceId) &&
                Boolean(snapPatch)
              );
            });
            if (validSnaps.length > 0) {
              const firstProvider = validSnaps[0].sourceId;
              const firstPatch = (validSnaps[0].scope as any).patchEpochId;
              const hasConflict = validSnaps.some(
                (s: any) => s.sourceId !== firstProvider || (s.scope as any).patchEpochId !== firstPatch
              );
              if (!hasConflict) {
                attestedProvider = firstProvider;
                attestedPatchEpochId = firstPatch;
              }
            }
          } catch {
            // metaSourceSnapshots query fallback
          }
        }

        // Tra cứu qua evidence_refs receipt nếu vẫn chưa có (không ghép receipt: phải chứng thực cả provider, patch và không mâu thuẫn claim)
        if (!attestedProvider || !attestedPatchEpochId) {
          try {
            const requiredDataset = options?.expectedDatasetKind || "real";
            const evRows = await db
              .select()
              .from(evidenceRefs)
              .where(
                and(
                  eq(evidenceRefs.artifactId, row.id),
                  eq(evidenceRefs.datasetKind, requiredDataset)
                )
              )
              .limit(1);
            const validEvs = evRows.filter((ev: any) => {
              if (!ev || ev.datasetKind !== requiredDataset || ev.kind === "demo_fixture" || ev.artifactId !== row.id) {
                return false;
              }
              if (options?.expectedCompId) {
                const binding = checkEvidenceRowClaimBinding(ev, options.expectedCompId, undefined, ev.sourceId);
                if (!binding.valid) return false;
              }
              return true;
            });
            if (validEvs.length > 0) {
              const ev = validEvs[0];
              let evPatch = (ev as any).patchEpochId;
              if (!evPatch && KNOWN_PROVIDER_EVIDENCE_REFS[ev.id]?.patchEpochId) {
                evPatch = KNOWN_PROVIDER_EVIDENCE_REFS[ev.id].patchEpochId;
              } else if (!evPatch && ev.snippet) {
                const patchMatch = ev.snippet.match(/Patch\s*(18\.[0-9]+[a-z]?)/i);
                if (patchMatch) {
                  evPatch = `epoch_${patchMatch[1].replace(".", "_")}`;
                }
              }
              if (ev.sourceId && evPatch) {
                attestedProvider = ev.sourceId;
                attestedPatchEpochId = evPatch;
              }
            }
          } catch {
            // evidenceRefs query fallback
          }
        }

        // Nếu caller yêu cầu xác thực provider: đối chiếu với attestedProvider độc lập
        if (options?.expectedProvider) {
          if (!attestedProvider) {
            return {
              resolved: false,
              reason: `DB Artifact '${row.id}' không có provenance receipt hoặc chứng thực nguồn gốc độc lập (unattested)`
            };
          }
          if (attestedProvider !== options.expectedProvider) {
            return {
              resolved: false,
              reason: `DB Artifact '${row.id}' thuộc provider '${attestedProvider}', không khớp '${options.expectedProvider}'`
            };
          }
        }

        // Nếu caller yêu cầu xác thực patchEpochId: đối chiếu với attestedPatchEpochId độc lập
        if (options?.expectedPatchEpochId) {
          if (!attestedPatchEpochId) {
            return {
              resolved: false,
              reason: `DB Artifact '${row.id}' không có chứng thực patchEpochId độc lập (unattested)`
            };
          }
          if (attestedPatchEpochId !== options.expectedPatchEpochId) {
            return {
              resolved: false,
              reason: `DB Artifact '${row.id}' thuộc patch '${attestedPatchEpochId}', không khớp '${options.expectedPatchEpochId}'`
            };
          }
        }

        return {
          resolved: true,
          storagePath: filePath,
          sha256: check.sha256,
          byteSize: check.byteSize,
          provider: attestedProvider,
          patchEpochId: attestedPatchEpochId
        };
      }
    }
  } catch {
    // Fail-closed nếu không có DB
  }

  return { resolved: false, reason: `Không thể resolve artifact: ${artifactId}` };
}

export interface EvidenceResolutionOptions {
  sourceId?: string;
  patchEpochId?: string;
  observationArtifactId?: string;
  sourceCompId?: string;
  sourceUrl?: string;
  datasetKind?: string;
}

export interface EvidenceResolutionResult {
  resolved: boolean;
  resolvedIds: string[];
  hasBackingRawArtifact: boolean;
  reason?: string;
}

/**
 * Tra cứu và kiểm định sự tồn tại thực tế của evidenceRefIds.
 * Ràng buộc nghiêm ngặt với provider, patch epoch, claim đội hình và backing raw artifact.
 */
export async function resolveEvidenceRefs(
  evidenceRefIds: string[] = [],
  optionsOrSourceId?: string | EvidenceResolutionOptions
): Promise<EvidenceResolutionResult> {
  const options: EvidenceResolutionOptions =
    typeof optionsOrSourceId === "string" ? { sourceId: optionsOrSourceId } : optionsOrSourceId || {};

  if (!Array.isArray(evidenceRefIds) || evidenceRefIds.length === 0) {
    return { resolved: false, resolvedIds: [], hasBackingRawArtifact: false, reason: "Mảng evidenceRefIds rỗng" };
  }

  const rawDir = path.resolve("./storage/raw");
  const resolvedIds: string[] = [];
  let hasBackingRawArtifact = false;

  for (const refId of evidenceRefIds) {
    if (!refId || typeof refId !== "string" || !refId.trim()) continue;

    // 1. Kiểm tra trong registry authentic evidence refs
    const known = KNOWN_PROVIDER_EVIDENCE_REFS[refId];
    if (known) {
      if (options.sourceId && known.provider !== options.sourceId) {
        return {
          resolved: false,
          resolvedIds,
          hasBackingRawArtifact: false,
          reason: `Evidence ref '${refId}' thuộc provider '${known.provider}', không khớp source '${options.sourceId}'`
        };
      }
      if (options.patchEpochId && known.patchEpochId !== options.patchEpochId) {
        return {
          resolved: false,
          resolvedIds,
          hasBackingRawArtifact: false,
          reason: `Evidence ref '${refId}' thuộc patch '${known.patchEpochId}', không khớp scope '${options.patchEpochId}'`
        };
      }
      // Ràng buộc join evidence -> artifact của chính observation
      if (options.observationArtifactId && options.observationArtifactId.trim() !== "") {
        const obsArt = KNOWN_PROVIDER_ARTIFACTS[options.observationArtifactId];
        if (obsArt) {
          if (obsArt.provider !== known.provider || obsArt.patchEpochId !== known.patchEpochId) {
            return {
              resolved: false,
              resolvedIds,
              hasBackingRawArtifact: false,
              reason: `Evidence ref '${refId}' (${known.provider}/${known.patchEpochId}) mâu thuẫn với rawArtifactId '${options.observationArtifactId}' (${obsArt.provider}/${obsArt.patchEpochId})`
            };
          }
        } else if (options.observationArtifactId !== known.artifactId) {
          return {
            resolved: false,
            resolvedIds,
            hasBackingRawArtifact: false,
            reason: `Evidence ref '${refId}' gắn với artifact '${known.artifactId}', mâu thuẫn với rawArtifactId '${options.observationArtifactId}' của observation`
          };
        }
      }

      const artCheck = await resolveRawArtifact(known.artifactId, {
        expectedProvider: known.provider,
        expectedPatchEpochId: known.patchEpochId
      });
      if (artCheck.resolved) {
        // Ràng buộc claim substantiation: evidence ref tổng hoặc backing artifact phải chứng minh đúng claim của observation
        if (artCheck.storagePath) {
          const claimCheck = isClaimSubstantiatedByRaw(
            artCheck.storagePath,
            options.sourceCompId,
            options.sourceUrl,
            known.provider,
            known.locator
          );
          if (!claimCheck.substantiated) {
            return {
              resolved: false,
              resolvedIds,
              hasBackingRawArtifact: false,
              reason: `Evidence ref '${refId}' với backing artifact '${known.artifactId}' không chứng thực claim: ${claimCheck.reason}`
            };
          }
        }
        resolvedIds.push(refId);
        hasBackingRawArtifact = true;
        continue;
      }
    }

    // 2. Kiểm tra nếu evidence ref trỏ tới guide/comp trong KNOWN_GUIDE_ARTIFACTS
    const guideSlugMatch = refId.match(/^ev_(?:tftacademy|tftflex)_([a-z0-9-]+?)(?:_[a-f0-9]{8,64})?$/i);
    if (guideSlugMatch) {
      const slug = guideSlugMatch[1];
      const guideDef = KNOWN_GUIDE_ARTIFACTS[slug];
      if (guideDef) {
        // Provider check
        if (options.sourceId && guideDef.provider !== options.sourceId) {
          return {
            resolved: false,
            resolvedIds,
            hasBackingRawArtifact: false,
            reason: `Evidence ref '${refId}' thuộc provider '${guideDef.provider}', không khớp source '${options.sourceId}'`
          };
        }
        // Scope / patch check
        if (options.patchEpochId && guideDef.patchEpochId !== options.patchEpochId) {
          return {
            resolved: false,
            resolvedIds,
            hasBackingRawArtifact: false,
            reason: `Evidence ref '${refId}' thuộc patch '${guideDef.patchEpochId}', không khớp scope '${options.patchEpochId}'`
          };
        }
        // Claim lineage check: Bắt buộc có sourceCompId hợp lệ và khớp với guide slug
        if (!options.sourceCompId || !matchesCompSlug(slug, options.sourceCompId, guideDef.provider)) {
          return {
            resolved: false,
            resolvedIds,
            hasBackingRawArtifact: false,
            reason: `Evidence guide '${slug}' không khớp claim sourceCompId '${options.sourceCompId || ""}'`
          };
        }
        // URL claim check: Nếu observation có sourceUrl cụ thể cho comps/guides/meta/set-18, đối chiếu với slug
        if (options.sourceUrl) {
          const urlMatch = options.sourceUrl.match(/\/(?:comps|guides|meta\/set-18)\/([a-z0-9_-]+)/i);
          if (urlMatch) {
            const urlComp = urlMatch[1];
            if (!matchesCompSlug(slug, urlComp, guideDef.provider)) {
              return {
                resolved: false,
                resolvedIds,
                hasBackingRawArtifact: false,
                reason: `Evidence guide '${slug}' không khớp claim URL '${options.sourceUrl}'`
              };
            }
          }
        }
        // Observation artifact join check: nếu observation có khai báo artifact, phải tương thích provenance & claim
        if (options.observationArtifactId) {
          const obsArt = KNOWN_PROVIDER_ARTIFACTS[options.observationArtifactId];
          if (obsArt) {
            if (obsArt.provider !== guideDef.provider || obsArt.patchEpochId !== guideDef.patchEpochId) {
              return {
                resolved: false,
                resolvedIds,
                hasBackingRawArtifact: false,
                reason: `Evidence ref '${refId}' (${guideDef.provider}/${guideDef.patchEpochId}) mâu thuẫn với rawArtifactId '${options.observationArtifactId}' (${obsArt.provider}/${obsArt.patchEpochId}) của observation`
              };
            }
            const isConflictingGuideArtifact = Object.keys(KNOWN_GUIDE_ARTIFACTS).some(
              (otherSlug) =>
                otherSlug !== slug &&
                KNOWN_GUIDE_ARTIFACTS[otherSlug].provider === guideDef.provider &&
                (options.observationArtifactId!.includes(otherSlug) ||
                  (obsArt.storageFile && obsArt.storageFile.includes(otherSlug)))
            );
            if (isConflictingGuideArtifact) {
              return {
                resolved: false,
                resolvedIds,
                hasBackingRawArtifact: false,
                reason: `Evidence guide '${slug}' mâu thuẫn với rawArtifactId '${options.observationArtifactId}' của observation (gắn với guide khác)`
              };
            }
          } else if (
            options.observationArtifactId !== guideDef.parentArtifactId &&
            options.observationArtifactId !== refId &&
            !options.observationArtifactId.includes(slug) &&
            !matchesCompSlug(slug, options.observationArtifactId, guideDef.provider)
          ) {
            return {
              resolved: false,
              resolvedIds,
              hasBackingRawArtifact: false,
              reason: `Evidence ref '${refId}' gắn với artifact '${guideDef.parentArtifactId}', mâu thuẫn với rawArtifactId '${options.observationArtifactId}' của observation`
            };
          }
        }
        // Kiểm tra toàn vẹn tập tin trên đĩa với PINNED digest và byteSize
        const filePath = path.join(rawDir, guideDef.storageFile);
        const check = verifyFileOnDisk(filePath, rawDir, {
          sha256: guideDef.sha256,
          byteSize: guideDef.byteSize
        });
        if (check.valid) {
          const claimCheck = isClaimSubstantiatedByRaw(
            filePath,
            options.sourceCompId,
            options.sourceUrl,
            guideDef.provider
          );
          if (!claimCheck.substantiated) {
            return {
              resolved: false,
              resolvedIds,
              hasBackingRawArtifact: false,
              reason: `Tập tin guide '${guideDef.storageFile}' không chứng thực claim: ${claimCheck.reason}`
            };
          }
          resolvedIds.push(refId);
          hasBackingRawArtifact = true;
          continue;
        } else {
          return {
            resolved: false,
            resolvedIds,
            hasBackingRawArtifact: false,
            reason: `Tập tin guide '${guideDef.storageFile}' không hợp lệ hoặc bị thay đổi (tampered): ${check.reason}`
          };
        }
      }
    }

    // 3. Tra cứu bảng evidence_refs trong DB (nếu DB đang kết nối)
    try {
      const db = await getDb();
      if (db) {
        const rows = await db
          .select()
          .from(evidenceRefs)
          .where(eq(evidenceRefs.id, refId))
          .limit(1);

        const matchedRow = rows.find((r: any) => r && r.id === refId) || (rows.length === 1 ? rows[0] : undefined);
        if (matchedRow) {
          const row = matchedRow;
          const requiredDataset = options.datasetKind || "real";
          // Kiểm tra datasetKind
          if (row.datasetKind !== requiredDataset) {
            return {
              resolved: false,
              resolvedIds,
              hasBackingRawArtifact: false,
              reason: `Evidence ref '${refId}' datasetKind không phải '${requiredDataset}': ${row.datasetKind}`
            };
          }
          // Chặn demo_fixture
          if (row.kind === "demo_fixture") {
            return {
              resolved: false,
              resolvedIds,
              hasBackingRawArtifact: false,
              reason: `Evidence ref '${refId}' kind là 'demo_fixture'`
            };
          }
          // Kiểm tra sourceId
          if (options.sourceId && row.sourceId !== options.sourceId) {
            return {
              resolved: false,
              resolvedIds,
              hasBackingRawArtifact: false,
              reason: `Evidence ref '${refId}' thuộc source '${row.sourceId}', không khớp source '${options.sourceId}'`
            };
          }

          // Kiểm tra claim alignment và positive claim binding trên bản ghi DB evidence
          const claimBinding = checkEvidenceRowClaimBinding(
            row,
            options.sourceCompId,
            options.sourceUrl,
            options.sourceId || row.sourceId
          );
          if (!claimBinding.valid) {
            return {
              resolved: false,
              resolvedIds,
              hasBackingRawArtifact: false,
              reason: claimBinding.reason
            };
          }

          if (row.artifactId) {
            // Artifact join check: Nếu observation khai báo rawArtifactId, phải khớp với artifactId của evidence
            if (options.observationArtifactId && row.artifactId !== options.observationArtifactId) {
              return {
                resolved: false,
                resolvedIds,
                hasBackingRawArtifact: false,
                reason: `Artifact join mismatch: evidence trỏ tới '${row.artifactId}', quan sát khai báo '${options.observationArtifactId}'`
              };
            }

            // Resolve artifact với cả expectedProvider, expectedPatchEpochId, expectedDatasetKind và expectedCompId
            const artCheck = await resolveRawArtifact(row.artifactId, {
              expectedProvider: options.sourceId,
              expectedPatchEpochId: options.patchEpochId,
              expectedDatasetKind: requiredDataset,
              expectedCompId: options.sourceCompId
            });
            if (artCheck.resolved) {
              // Ràng buộc claim substantiation trên backing artifact
              if (artCheck.storagePath) {
                const claimCheck = isClaimSubstantiatedByRaw(
                  artCheck.storagePath,
                  options.sourceCompId,
                  options.sourceUrl,
                  options.sourceId || row.sourceId,
                  row.locator || undefined
                );
                if (!claimCheck.substantiated) {
                  return {
                    resolved: false,
                    resolvedIds,
                    hasBackingRawArtifact: false,
                    reason: `Artifact gắn với evidence (${row.artifactId}) không chứng thực claim: ${claimCheck.reason}`
                  };
                }
              }
              resolvedIds.push(refId);
              hasBackingRawArtifact = true;
              continue;
            } else {
              return {
                resolved: false,
                resolvedIds,
                hasBackingRawArtifact: false,
                reason: `Artifact gắn với evidence (${row.artifactId}) không hợp lệ: ${artCheck.reason}`
              };
            }
          } else if (row.kind === "web_article") {
            if (!claimBinding.positivelyBound) {
              return {
                resolved: false,
                resolvedIds,
                hasBackingRawArtifact: false,
                reason: `Evidence web_article '${refId}' không chứng thực dương tính cho claim '${options.sourceCompId}'`
              };
            }
            resolvedIds.push(refId);
            continue;
          }
        }
      }
    } catch {
      // Fail-closed nếu không có DB
    }
  }

  // Toàn bộ các evidenceRefIds đã khai báo phải được resolve thành công
  if (resolvedIds.length === evidenceRefIds.length) {
    return { resolved: true, resolvedIds, hasBackingRawArtifact };
  }

  return {
    resolved: false,
    resolvedIds,
    hasBackingRawArtifact,
    reason: `Chứa bằng chứng treo hoặc không tương thích trong: ${evidenceRefIds.join(", ")}`
  };
}

export interface ObservationVerificationReport {
  verified: boolean;
  reason?: string;
  gates: {
    statusPass: boolean;
    freshnessPass: boolean;
    datasetPass: boolean;
    scopePass: boolean;
    evidencePresencePass: boolean;
    artifactResolved: boolean;
    evidenceResolved: boolean;
  };
}

/**
 * Gate xác minh nguồn toàn diện (Fail-Closed) cho SourceCompObservation.
 * Kiểm tra trạng thái valid, độ tươi (<maxAgeHours), dataset real, scope mốc phiên bản,
 * và kiểm chứng sự tồn tại thực tế của raw artifact / evidence lineage cùng claim đội hình.
 */
/**
 * Observation verification cache is deliberately omitted to prevent unsafe verdict caching (AP-01, AP-02, AP-03).
 * Every call to verifySourceObservation evaluates fail-closed per request.
 * clearObservationVerificationCache is preserved for public API compatibility.
 */
export function clearObservationVerificationCache(): void {
  // Pure fail-closed verification: no mutable verdict cache to clear.
}

export async function verifySourceObservation(
  obs: SourceCompObservation,
  options?: {
    patchEpochId?: string;
    maxAgeHours?: number;
    referenceTime?: string | Date;
  }
): Promise<ObservationVerificationReport> {
  return verifySourceObservationInternal(obs, options);
}

async function verifySourceObservationInternal(
  obs: SourceCompObservation,
  options?: {
    patchEpochId?: string;
    maxAgeHours?: number;
    referenceTime?: string | Date;
  }
): Promise<ObservationVerificationReport> {
  const gates = {
    statusPass: obs.status === "valid",
    freshnessPass: true,
    datasetPass: obs.datasetKind === "real",
    scopePass: true,
    evidencePresencePass: false,
    artifactResolved: false,
    evidenceResolved: false
  };

  // 1. Kiểm tra status: chỉ chấp nhận status === "valid"
  if (!gates.statusPass) {
    return { verified: false, reason: `Status không hợp lệ: ${obs.status}`, gates };
  }

  // 2. Kiểm tra độ tươi nếu có policy maxAgeHours
  if (options?.maxAgeHours !== undefined) {
    if (!Number.isFinite(options.maxAgeHours) || options.maxAgeHours < 0) {
      gates.freshnessPass = false;
      return {verified:false,reason:"Chính sách độ mới không hợp lệ",gates};
    }
    const timestampStr = obs.sourceDataAsOf || obs.observedAt || obs.fetchedAt;
    if (!timestampStr) {
      gates.freshnessPass = false;
      return { verified: false, reason: "Thiếu thời gian quan sát để kiểm tra freshness", gates };
    }
    const obsTime = new Date(timestampStr).getTime();
    if (isNaN(obsTime)) {
      gates.freshnessPass = false;
      return { verified: false, reason: "Thời gian quan sát không hợp lệ (NaN)", gates };
    }
    const refTime = options.referenceTime ? new Date(options.referenceTime).getTime() : Date.now();
    if (isNaN(refTime)) {
      gates.freshnessPass = false;
      return { verified: false, reason: "Reference time không hợp lệ (NaN)", gates };
    }
    // Chặn thời gian tương lai (cho phép lệch tối đa 60 giây)
    if (obsTime > refTime + 60000) {
      gates.freshnessPass = false;
      return { verified: false, reason: "Thời gian quan sát trong tương lai", gates };
    }
    const ageHours = (refTime - obsTime) / (1000 * 60 * 60);
    if (ageHours > options.maxAgeHours) {
      gates.freshnessPass = false;
      return { verified: false, reason: `Dữ liệu quá hạn (${Math.floor(ageHours)}h > ${options.maxAgeHours}h)`, gates };
    }
  }

  // 3. Kiểm tra datasetKind: phải là "real"
  if (!gates.datasetPass) {
    return { verified: false, reason: `DatasetKind không phải 'real': ${obs.datasetKind}`, gates };
  }

  if (!obs.scope?.patchEpochId) {
    gates.scopePass = false;
    return {verified:false,reason:"Thiếu mốc phiên bản của observation",gates};
  }

  // 4. Kiểm tra scope: bắt buộc có patchEpochId và khớp nếu caller truyền options.patchEpochId
  if (!obs.scope?.patchEpochId || typeof obs.scope.patchEpochId !== "string" || !obs.scope.patchEpochId.trim()) {
    gates.scopePass = false;
    return { verified: false, reason: "Thiếu scope.patchEpochId hợp lệ trên observation", gates };
  }
  if (options?.patchEpochId && obs.scope.patchEpochId !== options.patchEpochId) {
    gates.scopePass = false;
    return {
      verified: false,
      reason: `Mâu thuẫn scope: yêu cầu ${options.patchEpochId}, quan sát ghi ${obs.scope.patchEpochId}`,
      gates
    };
  }

  // 5. Kiểm tra sự hiện diện của evidence & artifact
  const hasEvidenceArray = Array.isArray(obs.evidenceRefIds) && obs.evidenceRefIds.length > 0;
  const hasRawArtifact = Boolean(obs.rawArtifactId && typeof obs.rawArtifactId === "string" && obs.rawArtifactId.trim());
  gates.evidencePresencePass = hasEvidenceArray || hasRawArtifact;

  if (!gates.evidencePresencePass) {
    return { verified: false, reason: "Thiếu bằng chứng: không có evidenceRefIds và không có rawArtifactId", gates };
  }

  // 6. Kiểm định raw artifact nếu có khai báo
  if (hasRawArtifact) {
    const artCheck = await resolveRawArtifact(obs.rawArtifactId, {
      expectedProvider: obs.sourceId,
      expectedPatchEpochId: obs.scope?.patchEpochId || undefined,
      expectedDatasetKind: obs.datasetKind || "real",
      expectedCompId: obs.sourceCompId ?? ""
    });
    gates.artifactResolved = artCheck.resolved;
    if (!artCheck.resolved) {
      return {
        verified: false,
        reason: `Artifact không hợp lệ (${obs.rawArtifactId}): ${artCheck.reason}`,
        gates
      };
    }
    // Ràng buộc provenance cho raw artifact: Phải có provider và patch chứng thực
    if (!artCheck.provider || artCheck.provider !== obs.sourceId) {
      gates.artifactResolved = false;
      return {
        verified: false,
        reason: `Artifact thiếu chứng thực provider (provenance): artifact không gắn với provider '${obs.sourceId}'`,
        gates
      };
    }
    if (obs.scope?.patchEpochId && (!artCheck.patchEpochId || artCheck.patchEpochId !== obs.scope.patchEpochId)) {
      gates.artifactResolved = false;
      return {
        verified: false,
        reason: `Artifact thiếu chứng thực patch (provenance): artifact không gắn với patch '${obs.scope?.patchEpochId}'`,
        gates
      };
    }
    // Ràng buộc claim substantiation: Raw artifact phải thực sự chứa bằng chứng về claim đội hình
    if (artCheck.storagePath) {
      const claimCheck = isClaimSubstantiatedByRaw(
        artCheck.storagePath,
        obs.sourceCompId ?? "",
        obs.sourceUrl ?? "",
        obs.sourceId
      );
      if (!claimCheck.substantiated) {
        gates.artifactResolved = false;
        return {
          verified: false,
          reason: `Artifact (${obs.rawArtifactId}) không chứng thực được claim đội hình: ${claimCheck.reason}`,
          gates
        };
      }
    }
  }

  // 7. Kiểm định evidence refs nếu có khai báo
  let evCheck: EvidenceResolutionResult | undefined;
  if (hasEvidenceArray) {
    evCheck = await resolveEvidenceRefs(obs.evidenceRefIds, {
      sourceId: obs.sourceId,
      patchEpochId: obs.scope?.patchEpochId || undefined,
      observationArtifactId: obs.rawArtifactId || undefined,
      sourceCompId: obs.sourceCompId ?? "",
      sourceUrl: obs.sourceUrl ?? "",
      datasetKind: obs.datasetKind || "real"
    });
    gates.evidenceResolved = evCheck.resolved;
    if (!evCheck.resolved) {
      return {
        verified: false,
        reason: `Bằng chứng không hợp lệ (${(obs.evidenceRefIds || []).join(", ")}): ${evCheck.reason}`,
        gates
      };
    }
  }

  // 8. Ràng buộc Lineage proof: observation phải có raw artifact đã kiểm chứng (trực tiếp hoặc qua DB evidence record)
  const hasLineageProof = gates.artifactResolved || Boolean(evCheck?.hasBackingRawArtifact);
  if (!hasLineageProof) {
    return {
      verified: false,
      reason: `Thiếu bảo chứng raw artifact: quan sát không có rawArtifactId hợp lệ và evidence không liên kết tới raw artifact thực tế`,
      gates
    };
  }

  return { verified: true, gates };
}
