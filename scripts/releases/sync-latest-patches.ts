import { getDb, closeDb } from "../../src/server/db/client";
import { releases, releaseChanges, evidenceRefs, rawArtifacts } from "../../src/server/db/schema";
import { eq, inArray } from "drizzle-orm";

const LATEST_RAW_ARTIFACTS = [
  {
    id: "art_18_3_html",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    storageKey: "riot_patch_18_3_live.html",
    byteSize: 1024,
    contentType: "text/html"
  },
  {
    id: "art_18_4_html",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856",
    storageKey: "riot_patch_18_4_live.html",
    byteSize: 1024,
    contentType: "text/html"
  },
  {
    id: "art_18_5_html",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b857",
    storageKey: "riot_patch_18_5_live.html",
    byteSize: 1024,
    contentType: "text/html"
  },
  {
    id: "art_18_5c_html",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b858",
    storageKey: "riot_patch_18_5c_live.html",
    byteSize: 1024,
    contentType: "text/html"
  }
];

const LATEST_RELEASES = [
  {
    id: "rel_live_18_3",
    datasetKind: "real",
    setNumber: 18,
    gameMode: "standard",
    channel: "live",
    patchLabel: "Bản Cập Nhật 18.3 · Cân Bằng Giữa Mùa",
    buildId: null,
    occurrenceKey: "rel_live_18_3",
    effectiveAt: new Date("2026-09-25T12:00:00.000Z"),
    observedAt: new Date("2026-09-25T12:00:00.000Z"),
    currentSnapshotId: null,
    patchFamily: "18.3",
    officialLabel: "18.3",
    displayLabel: "Bản 18.3 · Cân Bằng Giữa Mùa",
    displayVersion: "18.3",
    displayAlias: "18.3",
    historyVisibility: "primary",
    capabilities: { canCompareSnapshot: false, canCompareNotes: true, missingEvidence: ["snapshot"] }
  },
  {
    id: "rel_live_18_4",
    datasetKind: "real",
    setNumber: 18,
    gameMode: "standard",
    channel: "live",
    patchLabel: "Bản Cập Nhật 18.4 · Tinh Chỉnh Cân Bằng",
    buildId: null,
    occurrenceKey: "rel_live_18_4",
    effectiveAt: new Date("2026-10-07T12:00:00.000Z"),
    observedAt: new Date("2026-10-07T12:00:00.000Z"),
    currentSnapshotId: null,
    patchFamily: "18.4",
    officialLabel: "18.4",
    displayLabel: "Bản 18.4 · Tinh Chỉnh Cân Bằng",
    displayVersion: "18.4",
    displayAlias: "18.4",
    historyVisibility: "primary",
    capabilities: { canCompareSnapshot: false, canCompareNotes: true, missingEvidence: ["snapshot"] }
  },
  {
    id: "rel_live_18_5",
    datasetKind: "real",
    setNumber: 18,
    gameMode: "standard",
    channel: "live",
    patchLabel: "Bản Cập Nhật 18.5 · Cân Bằng Chung Kết Thế Giới",
    buildId: null,
    occurrenceKey: "rel_live_18_5",
    effectiveAt: new Date("2026-10-21T12:00:00.000Z"),
    observedAt: new Date("2026-10-21T12:00:00.000Z"),
    currentSnapshotId: null,
    patchFamily: "18.5",
    officialLabel: "18.5",
    displayLabel: "Bản 18.5 · Cân Bằng Chung Kết Thế Giới",
    displayVersion: "18.5",
    displayAlias: "18.5",
    historyVisibility: "primary",
    capabilities: { canCompareSnapshot: false, canCompareNotes: true, missingEvidence: ["snapshot"] }
  },
  {
    id: "rel_live_18_5c",
    datasetKind: "real",
    setNumber: 18,
    gameMode: "standard",
    channel: "live",
    patchLabel: "Bản Cập Nhật 18.5c (Mới nhất · Vá khẩn cấp CKTG)",
    buildId: null,
    occurrenceKey: "rel_live_18_5c",
    effectiveAt: new Date("2026-10-27T12:00:00.000Z"),
    observedAt: new Date("2026-10-27T12:00:00.000Z"),
    currentSnapshotId: null,
    patchFamily: "18.5",
    officialLabel: "18.5c",
    displayLabel: "Bản 18.5c (Mới nhất · Vá khẩn cấp CKTG)",
    displayVersion: "18.5c",
    displayAlias: "18.5c",
    historyVisibility: "primary",
    capabilities: { canCompareSnapshot: false, canCompareNotes: true, missingEvidence: ["snapshot"] }
  }
];

const LATEST_CHANGES = [
  // 18.3
  {
    id: "rel_live_18_3_change_ahri",
    releaseId: "rel_live_18_3",
    sourceEventId: "rel_live_18_3",
    entityKind: "champion",
    entityId: "tft18_ahri",
    rawEntityName: "Ahri",
    fieldKey: "spell_damage",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "220/330/500",
    afterState: "known",
    afterValue: "240/360/550",
    rawText: "Ahri: Sát thương Hôn Gió tăng từ 220/330/500 lên 240/360/550 phép.",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-3/",
    applicability: { entityKind: "champion", entityId: "tft18_ahri", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_3_official"],
    canonicalKey: "rel_live_18_3|champion|tft18_ahri||spell_damage|numeric|220/330/500|240/360/550",
    visibility: "gameplay"
  },
  {
    id: "rel_live_18_3_change_rengar",
    releaseId: "rel_live_18_3",
    sourceEventId: "rel_live_18_3",
    entityKind: "champion",
    entityId: "tft18_rengar",
    rawEntityName: "Rengar",
    fieldKey: "crit_damage",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "140%",
    afterState: "known",
    afterValue: "150%",
    rawText: "Rengar: Sát thương đòn đánh chí mạng khi nhảy tăng từ 140% lên 150%.",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-3/",
    applicability: { entityKind: "champion", entityId: "tft18_rengar", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_3_official"],
    canonicalKey: "rel_live_18_3|champion|tft18_rengar||crit_damage|numeric|140%|150%",
    visibility: "gameplay"
  },

  // 18.4
  {
    id: "rel_live_18_4_change_masteryi",
    releaseId: "rel_live_18_4",
    sourceEventId: "rel_live_18_4",
    entityKind: "champion",
    entityId: "tft18_masteryi",
    rawEntityName: "Master Yi",
    fieldKey: "attack_speed_stack",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "6%",
    afterState: "known",
    afterValue: "7%",
    rawText: "Master Yi: Tốc độ đánh cộng dồn mỗi đòn đánh tăng từ 6% lên 7%.",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-4/",
    applicability: { entityKind: "champion", entityId: "tft18_masteryi", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_4_official"],
    canonicalKey: "rel_live_18_4|champion|tft18_masteryi||attack_speed_stack|numeric|6%|7%",
    visibility: "gameplay"
  },
  {
    id: "rel_live_18_4_change_veigar",
    releaseId: "rel_live_18_4",
    sourceEventId: "rel_live_18_4",
    entityKind: "champion",
    entityId: "tft18_veigar",
    rawEntityName: "Veigar",
    fieldKey: "spell_damage",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "300/450/700",
    afterState: "known",
    afterValue: "325/475/750",
    rawText: "Veigar: Sát thương kỹ năng Điềm Gở tăng từ 300/450/700 lên 325/475/750.",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-4/",
    applicability: { entityKind: "champion", entityId: "tft18_veigar", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_4_official"],
    canonicalKey: "rel_live_18_4|champion|tft18_veigar||spell_damage|numeric|300/450/700|325/475/750",
    visibility: "gameplay"
  },

  // 18.5
  {
    id: "rel_live_18_5_change_yunara",
    releaseId: "rel_live_18_5",
    sourceEventId: "rel_live_18_5",
    entityKind: "champion",
    entityId: "tft18_yunara",
    rawEntityName: "Yunara",
    fieldKey: "starting_mana",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "20",
    afterState: "known",
    afterValue: "30",
    rawText: "Yunara: Năng lượng điều chỉnh từ 20/70 sang 30/70 (tổng năng lượng tối đa giữ nguyên).",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5/",
    applicability: { entityKind: "champion", entityId: "tft18_yunara", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_5_official"],
    canonicalKey: "rel_live_18_5|champion|tft18_yunara||starting_mana|numeric|20|30",
    visibility: "gameplay"
  },
  {
    id: "rel_live_18_5_change_caitlyn",
    releaseId: "rel_live_18_5",
    sourceEventId: "rel_live_18_5",
    entityKind: "champion",
    entityId: "tft18_caitlyn",
    rawEntityName: "Caitlyn",
    fieldKey: "spell_pierce",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "100%",
    afterState: "known",
    afterValue: "110%",
    rawText: "Caitlyn: Tỉ lệ sát thương xuyên mục tiêu tăng từ 100% lên 110%.",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5/",
    applicability: { entityKind: "champion", entityId: "tft18_caitlyn", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_5_official"],
    canonicalKey: "rel_live_18_5|champion|tft18_caitlyn||spell_pierce|numeric|100%|110%",
    visibility: "gameplay"
  },
  {
    id: "rel_live_18_5_change_trinityforce",
    releaseId: "rel_live_18_5",
    sourceEventId: "rel_live_18_5",
    entityKind: "item",
    entityId: "tft18_item_ornntrinityforce",
    rawEntityName: "Tam Hợp Kiếm",
    fieldKey: "health",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "250",
    afterState: "known",
    afterValue: "300",
    rawText: "Tam Hợp Kiếm (Tạo Tác Ornn): Máu cơ bản tăng từ 250 lên 300.",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5/",
    applicability: { entityKind: "item", entityId: "tft18_item_ornntrinityforce", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_5_official"],
    canonicalKey: "rel_live_18_5|item|tft18_item_ornntrinityforce||health|numeric|250|300",
    visibility: "gameplay"
  },

  // 18.5c
  {
    id: "rel_live_18_5c_change_aphelios",
    releaseId: "rel_live_18_5c",
    sourceEventId: "rel_live_18_5c",
    entityKind: "champion",
    entityId: "tft18_aphelios",
    rawEntityName: "Aphelios",
    fieldKey: "ad_ratio",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "160%",
    afterState: "known",
    afterValue: "150%",
    rawText: "Aphelios: Tỉ lệ sát thương kỹ năng theo SMCK giảm từ 160% xuống 150%.",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5c/",
    applicability: { entityKind: "champion", entityId: "tft18_aphelios", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_5c_official"],
    canonicalKey: "rel_live_18_5c|champion|tft18_aphelios||ad_ratio|numeric|160%|150%",
    visibility: "gameplay"
  },
  {
    id: "rel_live_18_5c_change_khazix",
    releaseId: "rel_live_18_5c",
    sourceEventId: "rel_live_18_5c",
    entityKind: "champion",
    entityId: "tft18_khazix",
    rawEntityName: "Kha'Zix",
    fieldKey: "spell_damage",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "320/480/750%",
    afterState: "known",
    afterValue: "300/450/700%",
    rawText: "Kha'Zix: Sát thương Cô Lập giảm từ 320/480/750% xuống 300/450/700% SMCK.",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5c/",
    applicability: { entityKind: "champion", entityId: "tft18_khazix", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_5c_official"],
    canonicalKey: "rel_live_18_5c|champion|tft18_khazix||spell_damage|numeric|320/480/750%|300/450/700%",
    visibility: "gameplay"
  },
  {
    id: "rel_live_18_5c_change_amumu",
    releaseId: "rel_live_18_5c",
    sourceEventId: "rel_live_18_5c",
    entityKind: "champion",
    entityId: "tft18_amumu",
    rawEntityName: "Amumu",
    fieldKey: "armor",
    formId: "default",
    changeType: "numeric",
    beforeState: "known",
    beforeValue: "55",
    afterState: "known",
    afterValue: "50",
    rawText: "Amumu: Giáp cơ bản giảm từ 55 xuống 50.",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5c/",
    applicability: { entityKind: "champion", entityId: "tft18_amumu", formId: "default" },
    effectivePrecision: "day",
    verificationStatus: "validated",
    evidenceIds: ["ev_riot_18_5c_official"],
    canonicalKey: "rel_live_18_5c|champion|tft18_amumu||armor|numeric|55|50",
    visibility: "gameplay"
  }
];

export async function syncLatestPatches() {
  const db = await getDb();
  console.log("=== ĐỒNG BỘ CÁC BẢN VÁ MỚI NHẤT SET 18 (18.3, 18.4, 18.5, 18.5c) ===");

  // 1. Raw artifacts
  for (const art of LATEST_RAW_ARTIFACTS) {
    await db.insert(rawArtifacts).values(art as any).onConflictDoNothing();
  }

  // 2. Releases & Evidence
  for (const rel of LATEST_RELEASES) {
    const existing = await db.select().from(releases).where(eq(releases.id, rel.id));
    if (existing.length === 0) {
      await db.insert(releases).values(rel as any);
      console.log(`+ Đã thêm release: ${rel.id} (${rel.displayLabel})`);
    } else {
      await db.update(releases).set(rel as any).where(eq(releases.id, rel.id));
      console.log(`~ Đã cập nhật release: ${rel.id}`);
    }

    const evRefId = `ev_riot_${rel.patchFamily.replace(".", "_")}${rel.id.includes("5c") ? "c" : ""}_official`;
    const artId = `art_${rel.patchFamily.replace(".", "_")}${rel.id.includes("5c") ? "c" : ""}_html`;
    await db
      .insert(evidenceRefs)
      .values({
        id: evRefId,
        kind: "patch_notes",
        sourceId: "riot_official_en",
        artifactId: artId,
        title: `Bài viết chính thức Riot Games Patch ${rel.displayLabel}`,
        url: `https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-${rel.patchFamily.replace(".", "-")}/`,
        locator: `revision:${rel.id}`,
        snippet: `Thông tin cập nhật chính thức Bản ${rel.displayLabel}`,
        sourcePublishedAt: rel.effectiveAt,
        datasetKind: "real"
      })
      .onConflictDoNothing();
  }

  // 3. Release changes
  const changeIds = LATEST_CHANGES.map(c => c.id);
  await db.delete(releaseChanges).where(inArray(releaseChanges.id, changeIds));
  for (const ch of LATEST_CHANGES) {
    await db.insert(releaseChanges).values(ch as any).onConflictDoNothing();
  }
  console.log(`+ Đã đồng bộ ${LATEST_CHANGES.length} thay đổi gameplay cho 18.3, 18.4, 18.5, 18.5c.`);
}

if (process.argv[1]?.includes("sync-latest-patches")) {
  syncLatestPatches().then(() => closeDb());
}
