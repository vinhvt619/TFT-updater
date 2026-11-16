import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SourceCompObservation, SourceCompObservationSchema } from "../../src/domain/meta/schemas";
import { getDb } from "../../src/server/db/client";
import { rawArtifacts, evidenceRefs } from "../../src/server/db/schema";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";

const RAW_ACADEMY_PAYLOAD = {
  sourceUrl: "https://tftacademy.com/tierlist/comps",
  observedAt: "2026-09-11T21:40:00+07:00",
  patch: "18.2",
  notes: "Manual authenticated verification against TFT Academy Set 18 Tier List on 2026-09-11",
  method: "manual_entry",
  tierlist: [
    {
      title: "Elder Dragon Fast 9 — Dragon 9",
      url: "https://tftacademy.com/tierlist/comps/set-18-dragon-princess",
      tier: "S",
      archetypeId: "comp_dragon_princess",
      variantId: "var_elder_dragon_fast9",
      conditions: ["Cần nâng cấp lên cấp 9 để hoàn thiện form Rồng 9 xoay quanh Rồng Ngàn Tuổi"]
    },
    {
      title: "Draven Fast 9 — Draven AD 9",
      url: "https://tftacademy.com/tierlist/comps/set-18-elderwood-executioners-copy",
      tier: "S",
      archetypeId: "comp_draven_reroll",
      variantId: "var_draven_apex_dragon",
      conditions: ["Đạt cấp 9, tối ưu trang bị AD cho Draven và đồ tank"]
    },
    {
      title: "Blossom Ashe — Blossom Fast 9",
      url: "https://tftacademy.com/tierlist/comps/set-18-blossom-fast-9",
      tier: "S",
      archetypeId: "comp_blossom_fast9",
      variantId: "var_blossom_fast9_standard",
      conditions: ["Lên cấp 9 kết hợp mốc Hoa Linh cao cấp xoay quanh Ashe và Sett"]
    },
    {
      title: "Invoker Ahri — Ahri Morgana",
      url: "https://tftacademy.com/tierlist/comps/set-18-ahri-morgana",
      tier: "A",
      archetypeId: "comp_ahri_morgana",
      variantId: "var_ahri_morgana_invoker",
      conditions: ["Kích hoạt Thần Chú / Thuật Sư cho Ahri và Morgana"]
    },
    {
      title: "Akali—Camille Reroll — Solar Melee",
      url: "https://tftacademy.com/tierlist/comps/set-18-solar-melee",
      tier: "B",
      archetypeId: "comp_akali_ninja",
      variantId: "var_solar_adaptor_standard",
      conditions: ["Slow roll cấp 5 bắt Akali 3 sao và Camille 3 sao"]
    },
    {
      title: "Juggernaut Caitlyn Reroll — Caitlyn Hunters",
      url: "https://tftacademy.com/tierlist/comps/set-18-caitlyn-hunters",
      tier: "B",
      archetypeId: "comp_caitlyn_enforcer",
      variantId: "var_caitlyn_scuttlecrab",
      conditions: ["Reroll Caitlyn 3 sao kết hợp dàn chắn Đấu Sĩ"]
    },
    {
      title: "Yunara—Alistar Reroll — Moo-nara",
      url: "https://tftacademy.com/tierlist/comps/set-18-moo-nara",
      tier: "C",
      archetypeId: "comp_teemo_yordle",
      variantId: "var_yunara_invoker_reroll",
      conditions: ["Reroll cấp 6 bắt Yunara 3 sao và Alistar 3 sao"]
    },
    {
      title: "Unrivaled Kha'Zix — Unrivaled Reroll",
      url: "https://tftacademy.com/tierlist/comps/set-18-unrivaled-reroll",
      tier: "X",
      archetypeId: "comp_rengar_assassin",
      variantId: "var_unrivaled_reroll",
      conditions: ["Nhóm Situational / X: chỉ chơi khi có điều kiện kích hoạt Khắc Tinh đặc biệt"]
    }
  ]
};

async function main() {
  if (!process.argv.includes("--allow-manual-verified")) {
    throw new Error(
      "Legacy manual TFT Academy generator is disabled by default. Use the online collector with a response receipt, or pass --allow-manual-verified only after attaching externally verified evidence."
    );
  }

  const rawDir = path.resolve("./storage/raw");
  const importsDir = path.resolve("./storage/imports");
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(importsDir, { recursive: true });

  const rawFilePath = path.join(rawDir, "tftacademy_patch18_2_tierlist.json");
  const rawContent = JSON.stringify(RAW_ACADEMY_PAYLOAD, null, 2);
  fs.writeFileSync(rawFilePath, rawContent, "utf8");

  const hash = crypto.createHash("sha256").update(rawContent).digest("hex");
  const rawArtifactId = `art_tftacademy_18_2_${hash.slice(0, 12)}`;
  const evidenceId = `ev_tftacademy_18_2_${hash.slice(0, 8)}`;

  console.log(`Saved raw artifact to ${rawFilePath} (SHA-256: ${hash})`);

  // 1. Lưu bản ghi raw_artifact vào DB
  const db = await getDb();
  await db
    .insert(rawArtifacts)
    .values({
      id: rawArtifactId,
      sha256: hash,
      storageKey: "storage/raw/tftacademy_patch18_2_tierlist.json",
      byteSize: Buffer.byteLength(rawContent, "utf8"),
      contentType: "application/json"
    })
    .onConflictDoNothing();

  // 2. Lưu bản ghi evidence_refs vào DB
  await db
    .insert(evidenceRefs)
    .values({
      id: evidenceId,
      kind: "manual_entry",
      sourceId: "tftacademy",
      artifactId: rawArtifactId,
      title: "TFT Academy Set 18 Tier List (Đối chiếu ngày 11/09/2026)",
      url: "https://tftacademy.com/tierlist/comps",
      locator: "tierlist",
      snippet: "Đối chiếu và xác thực 8 guide đội hình từ TFT Academy bản 18.2: Dragon Princess, Draven AD 9, Blossom Fast 9, Invoker Ahri, Solar Melee, Caitlyn Hunters, Moo-nara, Unrivaled Reroll.",
      sourcePublishedAt: null,
      datasetKind: "real"
    })
    .onConflictDoNothing();

  console.log(`Registered evidence record: ${evidenceId} and artifact: ${rawArtifactId}`);

  // 3. Đồng bộ các archetype mới vào DB
  for (const arch of SET18_ARCHETYPES) {
    await metaRepository.saveArchetype(arch);
  }
  console.log(`Synced ${SET18_ARCHETYPES.length} archetypes to database`);

  // 4. Tạo observations
  const observations: SourceCompObservation[] = RAW_ACADEMY_PAYLOAD.tierlist.map((item) => {
    return {
      id: `obs_tftacademy_${item.archetypeId}_epoch_18_2`,
      datasetKind: "real",
      sourceId: "tftacademy",
      sourceCompId: `tftacademy_${item.archetypeId}`,
      sourceUrl: item.url,
      rawArtifactId,
      observedAt: RAW_ACADEMY_PAYLOAD.observedAt,
      sourceUpdatedAt: null,
      scope: {
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        mode: "ranked_standard",
        patchEpochId: "epoch_18_2",
        sourcePatchLabel: "18.2",
        rankScope: "All",
        regions: ["Global"],
        windowStart: null,
        windowEnd: null
      },
      archetypeId: item.archetypeId,
      variantId: item.variantId,
      originalName: item.title,
      originalTier: item.tier,
      classificationKind: "editorial",
      metrics: {
        averagePlacement: null,
        top4Rate: null,
        winRate: null,
        sampleCount: null,
        sampleCountQuality: "unknown",
        pickRateRaw: null,
        pickRateUnit: "unknown"
      },
      conditions: item.conditions,
      evidenceRefIds: [evidenceId],
      parserVersion: "1.1.0",
      mappingVersion: "1.1.0"
    };
  });

  // Xác thực toàn bộ bản ghi theo schema
  for (const obs of observations) {
    const parseRes = SourceCompObservationSchema.safeParse(obs);
    if (!parseRes.success) {
      console.error(`Validation failed for ${obs.id}:`, parseRes.error.errors);
      process.exit(1);
    }
  }

  const importFilePath = path.join(importsDir, "tftacademy_import.json");
  fs.writeFileSync(importFilePath, JSON.stringify(observations, null, 2), "utf8");
  console.log(`Validated and wrote ${observations.length} verified observations to ${importFilePath}`);

  // 5. Lưu source observations vào DB
  const snapId = `snap_tftacademy_epoch_18_2_${Date.now()}`;
  await metaRepository.saveSourceObservations(
    snapId,
    "tftacademy",
    {
      gameProduct: "tft",
      setNumber: 18,
      channel: "live",
      mode: "ranked_standard",
      patchEpochId: "epoch_18_2",
      sourcePatchLabel: "18.2",
      rankScope: "All",
      regions: ["Global"],
      windowStart: null,
      windowEnd: null
    },
    observations,
    "real"
  );
  console.log(`Published source observations under snapshot ${snapId}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
