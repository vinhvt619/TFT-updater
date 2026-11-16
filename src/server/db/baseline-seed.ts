import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { SET18_ARCHETYPES } from "../../domain/meta/archetypes";
import { metaArchetypes, metaVariants } from "./schema-meta";
import { releases, releaseChanges, evidenceRefs, rawArtifacts } from "./schema";

const JSONB_COLUMNS = new Set([
  "capabilities",
  "before_value",
  "after_value",
  "applicability",
  "evidence_ids",
  "evidence_refs",
  "provenance",
  "config",
  "diagnostics",
  "result",
  "items",
  "traits",
  "stats",
  "position",
  "required_conditions",
  "recommended_items",
  "required_items",
  "required_augments",
  "required_emblems",
  "substitute_champion_ids",
  "recommended_board",
  "aliases",
  "core_champion_ids",
  "flex_champion_ids",
  "key_trait_ids",
]);

export async function seedTestBaseline(db: any): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.VITEST) {
    throw new Error("[Security] seedTestBaseline is strictly restricted to test/CI environments. Refusing to seed test data into production runtime.");
  }
  const testSeedPath = path.resolve("./storage/test-seed.json");
  const fallbackPath = path.resolve("./storage/baseline-seed.json");
  const seedFile = fs.existsSync(testSeedPath) ? testSeedPath : fallbackPath;

  if (fs.existsSync(seedFile)) {
    try {
      const dump = JSON.parse(fs.readFileSync(seedFile, "utf8"));
      
      const tablesInOrder = [
        "sources",
        "raw_artifacts",
        "releases",
        "release_markers",
        "snapshots",
        "snapshot_artifacts",
        "champions",
        "champion_snapshots",
        "trait_snapshots",
        "evidence_refs",
        "snapshot_evidence",
        "change_notes",
        "release_changes",
        "meta_archetypes",
        "meta_variants",
        "meta_source_snapshots",
        "meta_source_comp_observations",
        "meta_source_mappings",
        "meta_patch_epoch_regions",
        "meta_cohort_snapshots",
        "meta_cohort_members",
        "meta_ranking_snapshots",
        "meta_ranking_rows",
        "meta_source_comp_builds"
      ];

      const exec = async (q: string) => {
        if (typeof db.execute === "function") {
          await db.execute(sql.raw(q));
        } else if (typeof db.exec === "function") {
          await db.exec(q);
        }
      };

      await exec("BEGIN;");

      for (const t of tablesInOrder) {
        const rows = dump[t] || [];
        if (rows.length === 0) continue;
        
        // Batch insert in chunks of 100
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const cols = Object.keys(chunk[0]);
          
          const valuesClauses = chunk.map((r: any) => {
            const rowVals = cols.map((c: string) => {
              const v = r[c];
              if (v === null || v === undefined) return "NULL";
              if (JSONB_COLUMNS.has(c) || typeof v === "object") {
                return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
              }
              if (typeof v === "number") return String(v);
              if (typeof v === "boolean") return v ? "true" : "false";
              return `'${String(v).replace(/'/g, "''")}'`;
            });
            return `(${rowVals.join(", ")})`;
          });

          const insertSql = `INSERT INTO ${t} (${cols.join(", ")}) VALUES ${valuesClauses.join(", ")} ON CONFLICT DO NOTHING;`;
          await exec(insertSql);
        }
      }

      await exec("COMMIT;");
      return;
    } catch (err: any) {
      console.warn("[BaselineSeed] Warning reading seed file:", err.message, ". Falling back to in-memory seeding.");
      try {
        if (typeof db.execute === "function") {
          await db.execute(sql.raw("ROLLBACK;"));
        } else if (typeof db.exec === "function") {
          await db.exec("ROLLBACK;");
        }
      } catch {}
    }
  }

  // Fallback programmatic seed if seed files missing
  for (const arch of SET18_ARCHETYPES) {
    await db
      .insert(metaArchetypes)
      .values({
        id: arch.id,
        setNumber: arch.setNumber,
        gameProduct: arch.gameProduct,
        mode: arch.mode,
        nameVi: arch.nameVi,
        nameEn: arch.nameEn,
        aliases: arch.aliases,
        coreCarryChampionId: arch.coreCarryChampionId,
        coreTankChampionId: arch.coreTankChampionId,
        coreChampionIds: arch.coreChampionIds,
        flexChampionIds: arch.flexChampionIds,
        keyTraitIds: arch.keyTraitIds,
        playstyle: arch.playstyle,
        requiredConditions: arch.requiredConditions,
        recommendedItems: arch.recommendedItems,
        defaultVariantId: arch.defaultVariantId,
        mappingVersion: arch.mappingVersion,
        classifierVersion: arch.classifierVersion
      })
      .onConflictDoNothing();

    for (const v of arch.variants) {
      await db
        .insert(metaVariants)
        .values({
          id: v.id,
          archetypeId: arch.id,
          nameVi: v.nameVi,
          nameEn: v.nameEn,
          conditionDescription: v.conditionDescription,
          requiredItems: v.requiredItems,
          requiredAugments: v.requiredAugments,
          requiredEmblems: v.requiredEmblems,
          substituteChampionIds: v.substituteChampionIds,
          recommendedBoard: v.recommendedBoard
        })
        .onConflictDoNothing();
    }
  }

  // Seed Set 18 latest patch releases (18.3, 18.4, 18.5, 18.5c)
  const latestArtifacts = [
    { id: "art_18_3_html", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", storageKey: "riot_patch_18_3_live.html", byteSize: 1024, contentType: "text/html" },
    { id: "art_18_4_html", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856", storageKey: "riot_patch_18_4_live.html", byteSize: 1024, contentType: "text/html" },
    { id: "art_18_5_html", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b857", storageKey: "riot_patch_18_5_live.html", byteSize: 1024, contentType: "text/html" },
    { id: "art_18_5c_html", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b858", storageKey: "riot_patch_18_5c_live.html", byteSize: 1024, contentType: "text/html" }
  ];
  for (const art of latestArtifacts) {
    await db.insert(rawArtifacts).values(art as any).onConflictDoNothing();
  }

  const latestReleases = [
    { id: "rel_live_18_3", datasetKind: "real", setNumber: 18, gameMode: "standard", channel: "live", patchLabel: "Bản Cập Nhật 18.3 · Cân Bằng Giữa Mùa", buildId: null, occurrenceKey: "rel_live_18_3", effectiveAt: new Date("2026-09-25T12:00:00.000Z"), observedAt: new Date("2026-09-25T12:00:00.000Z"), currentSnapshotId: null, patchFamily: "18.3", officialLabel: "18.3", displayLabel: "Bản 18.3 · Cân Bằng Giữa Mùa", displayVersion: "18.3", displayAlias: "18.3", historyVisibility: "primary", versionSortKey: "80:18.3:live:main", orderingKey: "80:18.3:live:main", capabilities: { canCompareSnapshot: false, canCompareNotes: true, missingEvidence: ["snapshot"] } },
    { id: "rel_live_18_4", datasetKind: "real", setNumber: 18, gameMode: "standard", channel: "live", patchLabel: "Bản Cập Nhật 18.4 · Tinh Chỉnh Cân Bằng", buildId: null, occurrenceKey: "rel_live_18_4", effectiveAt: new Date("2026-10-07T12:00:00.000Z"), observedAt: new Date("2026-10-07T12:00:00.000Z"), currentSnapshotId: null, patchFamily: "18.4", officialLabel: "18.4", displayLabel: "Bản 18.4 · Tinh Chỉnh Cân Bằng", displayVersion: "18.4", displayAlias: "18.4", historyVisibility: "primary", versionSortKey: "85:18.4:live:main", orderingKey: "85:18.4:live:main", capabilities: { canCompareSnapshot: false, canCompareNotes: true, missingEvidence: ["snapshot"] } },
    { id: "rel_live_18_5", datasetKind: "real", setNumber: 18, gameMode: "standard", channel: "live", patchLabel: "Bản Cập Nhật 18.5 · Cân Bằng Chung Kết Thế Giới", buildId: null, occurrenceKey: "rel_live_18_5", effectiveAt: new Date("2026-10-21T12:00:00.000Z"), observedAt: new Date("2026-10-21T12:00:00.000Z"), currentSnapshotId: null, patchFamily: "18.5", officialLabel: "18.5", displayLabel: "Bản 18.5 · Cân Bằng Chung Kết Thế Giới", displayVersion: "18.5", displayAlias: "18.5", historyVisibility: "primary", versionSortKey: "90:18.5:live:main", orderingKey: "90:18.5:live:main", capabilities: { canCompareSnapshot: false, canCompareNotes: true, missingEvidence: ["snapshot"] } },
    { id: "rel_live_18_5c", datasetKind: "real", setNumber: 18, gameMode: "standard", channel: "live", patchLabel: "Bản Cập Nhật 18.5c (Mới nhất · Vá khẩn cấp CKTG)", buildId: null, occurrenceKey: "rel_live_18_5c", effectiveAt: new Date("2026-10-27T12:00:00.000Z"), observedAt: new Date("2026-10-27T12:00:00.000Z"), currentSnapshotId: null, patchFamily: "18.5", officialLabel: "18.5c", displayLabel: "Bản 18.5c (Mới nhất · Vá khẩn cấp CKTG)", displayVersion: "18.5c", displayAlias: "18.5c", historyVisibility: "primary", versionSortKey: "95:18.5c:live:hotfix", orderingKey: "95:18.5c:live:hotfix", capabilities: { canCompareSnapshot: false, canCompareNotes: true, missingEvidence: ["snapshot"] } }
  ];
  for (const rel of latestReleases) {
    await db.insert(releases).values(rel as any).onConflictDoNothing();
    const evRefId = `ev_riot_${rel.patchFamily.replace(".", "_")}${rel.id.includes("5c") ? "c" : ""}_official`;
    const artId = `art_${rel.patchFamily.replace(".", "_")}${rel.id.includes("5c") ? "c" : ""}_html`;
    await db.insert(evidenceRefs).values({ id: evRefId, kind: "patch_notes", sourceId: "riot_official_en", artifactId: artId, title: `Bài viết chính thức Riot Games Patch ${rel.displayLabel}`, url: `https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-${rel.patchFamily.replace(".", "-")}/`, locator: `revision:${rel.id}`, snippet: `Thông tin cập nhật chính thức Bản ${rel.displayLabel}`, sourcePublishedAt: rel.effectiveAt, datasetKind: "real" }).onConflictDoNothing();
  }

  const latestChanges = [
    // 18.3 Champions
    { id: "rel_live_18_3_change_ahri", releaseId: "rel_live_18_3", sourceEventId: "rel_live_18_3", entityKind: "champion", entityId: "tft18_ahri", rawEntityName: "Ahri", fieldKey: "spell_damage", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "220/330/500", afterState: "known", afterValue: "240/360/550", rawText: "Ahri: Sát thương Hôn Gió tăng từ 220/330/500 lên 240/360/550 phép.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-3/", applicability: { entityKind: "champion", entityId: "tft18_ahri", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_3_official"], canonicalKey: "rel_live_18_3|champion|tft18_ahri||spell_damage|numeric|220/330/500|240/360/550", visibility: "gameplay" },
    { id: "rel_live_18_3_change_rengar", releaseId: "rel_live_18_3", sourceEventId: "rel_live_18_3", entityKind: "champion", entityId: "tft18_rengar", rawEntityName: "Rengar", fieldKey: "crit_damage", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "140%", afterState: "known", afterValue: "150%", rawText: "Rengar: Sát thương đòn đánh chí mạng khi nhảy tăng từ 140% lên 150%.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-3/", applicability: { entityKind: "champion", entityId: "tft18_rengar", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_3_official"], canonicalKey: "rel_live_18_3|champion|tft18_rengar||crit_damage|numeric|140%|150%", visibility: "gameplay" },
    // 18.3 Traits & Items
    { id: "rel_live_18_3_change_elderwood", releaseId: "rel_live_18_3", sourceEventId: "rel_live_18_3", entityKind: "trait", entityId: "elderwood", rawEntityName: "Thần Rừng (Elderwood)", fieldKey: "resists", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "15/30/50", afterState: "known", afterValue: "18/35/60", rawText: "Thần Rừng: Giáp và Kháng Phép cộng dồn mỗi 2 giây tăng từ 15/30/50 lên 18/35/60.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-3/", applicability: { entityKind: "trait", entityId: "elderwood", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_3_official"], canonicalKey: "rel_live_18_3|trait|elderwood||resists|numeric|15/30/50|18/35/60", visibility: "gameplay" },
    { id: "rel_live_18_3_change_duelist", releaseId: "rel_live_18_3", sourceEventId: "rel_live_18_3", entityKind: "trait", entityId: "duelist", rawEntityName: "Song Đấu (Duelist)", fieldKey: "as_per_attack", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "6/10/14%", afterState: "known", afterValue: "7/11/15%", rawText: "Song Đấu: Tốc độ đánh mỗi đòn đánh tăng từ 6/10/14% lên 7/11/15% (tối đa 8 cộng dồn).", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-3/", applicability: { entityKind: "trait", entityId: "duelist", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_3_official"], canonicalKey: "rel_live_18_3|trait|duelist||as_per_attack|numeric|6/10/14%|7/11/15%", visibility: "gameplay" },
    { id: "rel_live_18_3_change_bloodthirster", releaseId: "rel_live_18_3", sourceEventId: "rel_live_18_3", entityKind: "item", entityId: "bloodthirster", rawEntityName: "Huyết Kiếm", fieldKey: "shield", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "25%", afterState: "known", afterValue: "30%", rawText: "Huyết Kiếm: Lá chắn khi máu dưới 40% tăng từ 25% lên 30% máu tối đa.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-3/", applicability: { entityKind: "item", entityId: "bloodthirster", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_3_official"], canonicalKey: "rel_live_18_3|item|bloodthirster||shield|numeric|25%|30%", visibility: "gameplay" },

    // 18.4 Champions
    { id: "rel_live_18_4_change_masteryi", releaseId: "rel_live_18_4", sourceEventId: "rel_live_18_4", entityKind: "champion", entityId: "tft18_masteryi", rawEntityName: "Master Yi", fieldKey: "attack_speed_stack", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "6%", afterState: "known", afterValue: "7%", rawText: "Master Yi: Tốc độ đánh cộng dồn mỗi đòn đánh tăng từ 6% lên 7%.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-4/", applicability: { entityKind: "champion", entityId: "tft18_masteryi", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_4_official"], canonicalKey: "rel_live_18_4|champion|tft18_masteryi||attack_speed_stack|numeric|6%|7%", visibility: "gameplay" },
    { id: "rel_live_18_4_change_veigar", releaseId: "rel_live_18_4", sourceEventId: "rel_live_18_4", entityKind: "champion", entityId: "tft18_veigar", rawEntityName: "Veigar", fieldKey: "spell_damage", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "300/450/700", afterState: "known", afterValue: "325/475/750", rawText: "Veigar: Sát thương kỹ năng Điềm Gở tăng từ 300/450/700 lên 325/475/750.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-4/", applicability: { entityKind: "champion", entityId: "tft18_veigar", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_4_official"], canonicalKey: "rel_live_18_4|champion|tft18_veigar||spell_damage|numeric|300/450/700|325/475/750", visibility: "gameplay" },
    // 18.4 Traits & Items
    { id: "rel_live_18_4_change_vanguard", releaseId: "rel_live_18_4", sourceEventId: "rel_live_18_4", entityKind: "trait", entityId: "vanguard", rawEntityName: "Tiên Phong (Vanguard)", fieldKey: "resists", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "100/250/500", afterState: "known", afterValue: "120/280/550", rawText: "Tiên Phong: Giáp cộng thêm ở mốc (2/4/6) tăng từ 100/250/500 lên 120/280/550.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-4/", applicability: { entityKind: "trait", entityId: "vanguard", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_4_official"], canonicalKey: "rel_live_18_4|trait|vanguard||resists|numeric|100/250/500|120/280/550", visibility: "gameplay" },
    { id: "rel_live_18_4_change_cannoneer", releaseId: "rel_live_18_4", sourceEventId: "rel_live_18_4", entityKind: "trait", entityId: "cannoneer", rawEntityName: "Pháo Thủ (Cannoneer)", fieldKey: "ability_damage", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "145/200/325%", afterState: "known", afterValue: "150/220/350%", rawText: "Pháo Thủ: Sát thương phát bắn thứ 5 tăng từ 145/200/325% lên 150/220/350% SMCK.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-4/", applicability: { entityKind: "trait", entityId: "cannoneer", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_4_official"], canonicalKey: "rel_live_18_4|trait|cannoneer||ability_damage|numeric|145/200/325%|150/220/350%", visibility: "gameplay" },
    { id: "rel_live_18_4_change_rabadon", releaseId: "rel_live_18_4", sourceEventId: "rel_live_18_4", entityKind: "item", entityId: "rabadonsdeathcap", rawEntityName: "Mũ Phù Thủy Rabadon", fieldKey: "ap", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "50", afterState: "known", afterValue: "55", rawText: "Mũ Phù Thủy Rabadon: SMPT cơ bản tăng từ 50 lên 55.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-4/", applicability: { entityKind: "item", entityId: "rabadonsdeathcap", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_4_official"], canonicalKey: "rel_live_18_4|item|rabadonsdeathcap||ap|numeric|50|55", visibility: "gameplay" },

    // 18.5 Champions
    { id: "rel_live_18_5_change_yunara", releaseId: "rel_live_18_5", sourceEventId: "rel_live_18_5", entityKind: "champion", entityId: "tft18_yunara", rawEntityName: "Yunara", fieldKey: "starting_mana", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "20", afterState: "known", afterValue: "30", rawText: "Yunara: Năng lượng điều chỉnh từ 20/70 sang 30/70 (tổng năng lượng tối đa giữ nguyên).", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5/", applicability: { entityKind: "champion", entityId: "tft18_yunara", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5_official"], canonicalKey: "rel_live_18_5|champion|tft18_yunara||starting_mana|numeric|20|30", visibility: "gameplay" },
    { id: "rel_live_18_5_change_caitlyn", releaseId: "rel_live_18_5", sourceEventId: "rel_live_18_5", entityKind: "champion", entityId: "tft18_caitlyn", rawEntityName: "Caitlyn", fieldKey: "spell_pierce", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "100%", afterState: "known", afterValue: "110%", rawText: "Caitlyn: Tỉ lệ sát thương xuyên mục tiêu tăng từ 100% lên 110%.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5/", applicability: { entityKind: "champion", entityId: "tft18_caitlyn", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5_official"], canonicalKey: "rel_live_18_5|champion|tft18_caitlyn||spell_pierce|numeric|100%|110%", visibility: "gameplay" },
    // 18.5 Traits & Items
    { id: "rel_live_18_5_change_trinityforce", releaseId: "rel_live_18_5", sourceEventId: "rel_live_18_5", entityKind: "item", entityId: "tft18_item_ornntrinityforce", rawEntityName: "Tam Hợp Kiếm", fieldKey: "health", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "250", afterState: "known", afterValue: "300", rawText: "Tam Hợp Kiếm (Tạo Tác Ornn): Máu cơ bản tăng từ 250 lên 300.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5/", applicability: { entityKind: "item", entityId: "tft18_item_ornntrinityforce", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5_official"], canonicalKey: "rel_live_18_5|item|tft18_item_ornntrinityforce||health|numeric|250|300", visibility: "gameplay" },
    { id: "rel_live_18_5_change_infinityedge", releaseId: "rel_live_18_5", sourceEventId: "rel_live_18_5", entityKind: "item", entityId: "infinityedge", rawEntityName: "Vô Cực Kiếm", fieldKey: "crit_damage", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "10%", afterState: "known", afterValue: "15%", rawText: "Vô Cực Kiếm: Sát thương chí mạng cộng thêm tăng từ 10% lên 15%.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5/", applicability: { entityKind: "item", entityId: "infinityedge", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5_official"], canonicalKey: "rel_live_18_5|item|infinityedge||crit_damage|numeric|10%|15%", visibility: "gameplay" },
    { id: "rel_live_18_5_change_brawler", releaseId: "rel_live_18_5", sourceEventId: "rel_live_18_5", entityKind: "trait", entityId: "brawler", rawEntityName: "Đấu Sĩ (Brawler)", fieldKey: "health", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "20/40/65/80%", afterState: "known", afterValue: "22/45/70/85%", rawText: "Đấu Sĩ: Máu tối đa cộng thêm ở các mốc (2/4/6/8) điều chỉnh từ 20/40/65/80% lên 22/45/70/85%.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5/", applicability: { entityKind: "trait", entityId: "brawler", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5_official"], canonicalKey: "rel_live_18_5|trait|brawler||health|numeric|20/40/65/80%|22/45/70/85%", visibility: "gameplay" },
    { id: "rel_live_18_5_change_invoker", releaseId: "rel_live_18_5", sourceEventId: "rel_live_18_5", entityKind: "trait", entityId: "invoker", rawEntityName: "Thuật Sĩ (Invoker)", fieldKey: "mana", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "15/20", afterState: "known", afterValue: "18/25", rawText: "Thuật Sĩ: Hồi năng lượng mỗi 3 giây ở mốc (4/6) tăng từ 15/20 lên 18/25 năng lượng.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5/", applicability: { entityKind: "trait", entityId: "invoker", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5_official"], canonicalKey: "rel_live_18_5|trait|invoker||mana|numeric|15/20|18/25", visibility: "gameplay" },

    // 18.5c Champions
    { id: "rel_live_18_5c_change_aphelios", releaseId: "rel_live_18_5c", sourceEventId: "rel_live_18_5c", entityKind: "champion", entityId: "tft18_aphelios", rawEntityName: "Aphelios", fieldKey: "ad_ratio", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "160%", afterState: "known", afterValue: "150%", rawText: "Aphelios: Tỉ lệ sát thương kỹ năng theo SMCK giảm từ 160% xuống 150%.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5c/", applicability: { entityKind: "champion", entityId: "tft18_aphelios", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5c_official"], canonicalKey: "rel_live_18_5c|champion|tft18_aphelios||ad_ratio|numeric|160%|150%", visibility: "gameplay" },
    { id: "rel_live_18_5c_change_khazix", releaseId: "rel_live_18_5c", sourceEventId: "rel_live_18_5c", entityKind: "champion", entityId: "tft18_khazix", rawEntityName: "Kha'Zix", fieldKey: "spell_damage", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "320/480/750%", afterState: "known", afterValue: "300/450/700%", rawText: "Kha'Zix: Sát thương Cô Lập giảm từ 320/480/750% xuống 300/450/700% SMCK.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5c/", applicability: { entityKind: "champion", entityId: "tft18_khazix", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5c_official"], canonicalKey: "rel_live_18_5c|champion|tft18_khazix||spell_damage|numeric|320/480/750%|300/450/700%", visibility: "gameplay" },
    { id: "rel_live_18_5c_change_amumu", releaseId: "rel_live_18_5c", sourceEventId: "rel_live_18_5c", entityKind: "champion", entityId: "tft18_amumu", rawEntityName: "Amumu", fieldKey: "armor", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "55", afterState: "known", afterValue: "50", rawText: "Amumu: Giáp cơ bản giảm từ 55 xuống 50.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5c/", applicability: { entityKind: "champion", entityId: "tft18_amumu", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5c_official"], canonicalKey: "rel_live_18_5c|champion|tft18_amumu||armor|numeric|55|50", visibility: "gameplay" },
    // 18.5c Traits & Items & Augments
    { id: "rel_live_18_5c_change_slayer", releaseId: "rel_live_18_5c", sourceEventId: "rel_live_18_5c", entityKind: "trait", entityId: "slayer", rawEntityName: "Tàn Phá / Đồ Tể (Slayer)", fieldKey: "base_omnivamp", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "25/40%", afterState: "known", afterValue: "20/35%", rawText: "Tàn Phá: Hút máu toàn phần ở mốc (4/6) giảm từ 25/40% xuống 20/35%.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5c/", applicability: { entityKind: "trait", entityId: "slayer", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5c_official"], canonicalKey: "rel_live_18_5c|trait|slayer||base_omnivamp|numeric|25/40%|20/35%", visibility: "gameplay" },
    { id: "rel_live_18_5c_change_evenshroud", releaseId: "rel_live_18_5c", sourceEventId: "rel_live_18_5c", entityKind: "item", entityId: "evenshroud", rawEntityName: "Giáp Hộ Vệ (Evenshroud)", fieldKey: "resists", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "10s", afterState: "known", afterValue: "8s", rawText: "Giáp Hộ Vệ: Thời gian cào giáp giảm từ 10 giây xuống 8 giây.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5c/", applicability: { entityKind: "item", entityId: "evenshroud", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5c_official"], canonicalKey: "rel_live_18_5c|item|evenshroud||resists|numeric|10s|8s", visibility: "gameplay" },
    { id: "rel_live_18_5c_change_clutteredmind", releaseId: "rel_live_18_5c", sourceEventId: "rel_live_18_5c", entityKind: "augment", entityId: "cluttered_mind", rawEntityName: "Tâm Trí Tiến Bộ", fieldKey: "stats", formId: "default", changeType: "numeric", beforeState: "known", beforeValue: "4", afterState: "known", afterValue: "3", rawText: "Tâm Trí Tiến Bộ: Kinh nghiệm nhận thêm mỗi hiệp khi hàng chờ đầy giảm từ 4 xuống 3.", basis: "documented", sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-5c/", applicability: { entityKind: "augment", entityId: "cluttered_mind", formId: "default" }, effectivePrecision: "day", verificationStatus: "validated", evidenceIds: ["ev_riot_18_5c_official"], canonicalKey: "rel_live_18_5c|augment|cluttered_mind||stats|numeric|4|3", visibility: "gameplay" }
  ];

  for (const ch of latestChanges) {
    await db.insert(releaseChanges).values(ch as any).onConflictDoNothing();
  }
}
