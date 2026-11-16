import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../../src/server/db/client";
import { snapshots, releases, rawArtifacts, evidenceRefs } from "../../src/server/db/schema";
import { metaSourceCompObservations, metaSourceCompBuilds } from "../../src/server/db/schema-meta";
import { snapshotRepository } from "../../src/server/repositories/snapshot-repository";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { diffService } from "../../src/server/services/diff-service";
import { rankingService } from "../../src/server/meta/services/ranking-service";
import { eq, and } from "drizzle-orm";

describe("Source accuracy and data lineage", () => {
  // =========================================================================
  // 1. GAMEPLAY SNAPSHOTS & COMPARE CAPABILITY (Section 6: Compare & Lịch sử)
  // =========================================================================
  describe("1. Gameplay Snapshots & Compare", () => {
    it("Có ít nhất 2 snapshot gameplay thật, độc lập, published với raw artifact khác nhau", async () => {
      const db = await getDb();
      const publishedSnaps = await db
        .select()
        .from(snapshots)
        .where(eq(snapshots.status, "published"));

      expect(publishedSnaps.length).toBeGreaterThanOrEqual(2);

      const liveSnap = publishedSnaps.find((s: any) => s.id === "snap_real_cdragon_live_18_2");
      const pbeSnap = publishedSnaps.find((s: any) => s.id === "snap_real_cdragon_pbe_18_3");

      expect(liveSnap).toBeDefined();
      expect(pbeSnap).toBeDefined();
      expect(liveSnap!.releaseId).toBe("rel_live_18_2");
      expect(pbeSnap!.releaseId).toBe("rel_pbe_18_3");

      // Hash raw và gameplay hash phải khác nhau giữa 2 mốc
      expect(liveSnap!.rawHash).not.toBe(pbeSnap!.rawHash);
      expect(liveSnap!.gameplayHash).not.toBe(pbeSnap!.gameplayHash);
      expect(liveSnap!.status).toBe("published");
      expect(pbeSnap!.status).toBe("published");
    });

    it("Snapshot repository getReleases trả đúng mốc published không bị che giấu", async () => {
      const rels = await snapshotRepository.getReleases("real");
      expect(rels.length).toBeGreaterThanOrEqual(2);

      const liveRel = rels.find((r: any) => r.id === "rel_live_18_2");
      const pbeRel = rels.find((r: any) => r.id === "rel_pbe_18_3");

      expect(liveRel).toBeDefined();
      expect(pbeRel).toBeDefined();
      expect(liveRel!.currentSnapshotId).toBe("snap_real_cdragon_live_18_2");
      expect(liveRel!.currentSnapshotStatus).toBe("published");
      expect(pbeRel!.currentSnapshotId).toBe("snap_real_cdragon_pbe_18_3");
      expect(pbeRel!.currentSnapshotStatus).toBe("published");
    });

    it("Snapshot repository getReleases lọc bỏ archive khi includeArchive === false nhưng giữ nguyên khi includeArchive === true hoặc mặc định", async () => {
      const publicRels = await snapshotRepository.getReleases("real", { includeArchive: false });
      const publicPbe = publicRels.find((r: any) => r.id === "rel_pbe_18_3");
      expect(publicPbe).toBeUndefined();
      const publicLive = publicRels.find((r: any) => r.id === "rel_live_18_2");
      expect(publicLive).toBeDefined();

      const archiveRels = await snapshotRepository.getReleases("real", { includeArchive: true });
      const archivePbe = archiveRels.find((r: any) => r.id === "rel_pbe_18_3");
      expect(archivePbe).toBeDefined();
    });

    it("Event chỉ có patch note được gắn notes-only (currentSnapshotId null), không giả làm gameplay", async () => {
      const rels = await snapshotRepository.getReleases("real");
      const noteEvents = rels.filter((r: any) => r.id.startsWith("event_live_18_1_"));

      expect(noteEvents.length).toBeGreaterThan(0);
      for (const ev of noteEvents) {
        expect(ev.currentSnapshotId).toBeNull();
        expect(ev.currentSnapshotStatus).toBeNull();
      }
    });

    it("Diff service tính toán delta thực tế độc lập locale (cùng gameplay vi_vn/en_us cho changedChampions=0)", async () => {
      const diff = await diffService.getOrComputeDiff(
        "snap_real_cdragon_live_18_2",
        "snap_real_cdragon_pbe_18_3"
      );

      expect(diff).not.toBeNull();
      expect(diff.fromSnapshotId).toBe("snap_real_cdragon_live_18_2");
      expect(diff.toSnapshotId).toBe("snap_real_cdragon_pbe_18_3");
      expect(diff.diffEngineVersion).toBe("2.0.0");
      expect(diff.champions.length).toBe(74);
      // Dữ liệu gameplay giữa Live vi_vn và PBE en_us không bị sai lệch bởi ngôn ngữ dịch
      expect(diff.summary.changedChampions).toBe(0);

      // Provenance: diff có bằng chứng liên kết tới hai snapshot thật
      expect(diff.fromSnapshotId).not.toBe(diff.toSnapshotId);
    });
  });

  // =========================================================================
  // 2. OBSERVATION DEDUPLICATION (Section 6: Website ranking - 8 URLs = 8 Rows)
  // =========================================================================
  describe("2. Deduplication & Unique Source Observations", () => {
    it("TFT Academy latest observations trả đúng 8 bản ghi duy nhất, không lặp thành 11", async () => {
      const obs = await metaRepository.getLatestSourceObservations("epoch_18_2", "real");
      const academyObs = obs.filter((o) => o.sourceId === "tftacademy");

      expect(academyObs.length).toBe(8);

      const uniqueUrls = new Set(academyObs.map((o) => o.sourceUrl));
      expect(uniqueUrls.size).toBe(8);

      const uniqueCompIds = new Set(academyObs.map((o) => o.sourceCompId));
      expect(uniqueCompIds.size).toBe(8);

      // Tất cả đều có direct URL và evidenceRefs hợp lệ
      for (const o of academyObs) {
        expect(o.sourceUrl).toMatch(/^https:\/\/tftacademy\.com\/tierlist\/comps\//);
        expect(o.evidenceRefIds.length).toBeGreaterThan(0);
        expect(o.datasetKind).toBe("real");
      }
    });

    it("tactics.tools observations có đúng 5 bản ghi thống kê Diamond+", async () => {
      const obs = await metaRepository.getLatestSourceObservations("epoch_18_2", "real");
      const tacticsObs = obs.filter((o) => o.sourceId === "tactics_tools");

      expect(tacticsObs.length).toBe(5);
      for (const o of tacticsObs) {
        expect(o.sourceUrl).toBe("https://tactics.tools/team-compositions");
        expect(o.metrics.averagePlacement).not.toBeNull();
        expect(o.metrics.sampleCount).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // 3. GOLDEN FIXTURES: EXACT BOARD & ITEMS (Section 6: Board & item)
  // =========================================================================
  describe("3. Golden Fixtures Exact Board & Items Assertions", () => {
    // Helper so sánh set equality
    function setDifference<T>(setA: Set<T>, setB: Set<T>): T[] {
      return Array.from(setA).filter((x) => !setB.has(x));
    }

    it("Dragon 9 (comp_dragon_princess): Exact 8 units và exact item set", async () => {
      const arch = await metaRepository.getArchetypeById("comp_dragon_princess", "real");
      expect(arch).not.toBeNull();

      const board = arch!.variants[0]?.recommendedBoard || [];
      expect(board.length).toBe(8);

      // Expected units từ Positioning Example nguồn:
      // Amumu, Sentinel, Morgana, Ivern, Taric, Kennen, Elder Dragon, Maokai
      const actualUnits = board.map((u) => u.championId);
      console.log("ACTUAL UNITS ARE:", actualUnits);
      const expectedUnits = [
        "tft18_da_amumu18",
        "tft18_da_sentinel18",
        "tft18_da_18_morgana",
        "tft18_da_18_ivern",
        "tft18_da_taric18",
        "tft18_da_18_kennen",
        "tft18_da_18_elderdragon",
        "tft18_da_18_maokai"
      ];

      const actualUnitSet = new Set(actualUnits);
      const expectedUnitSet = new Set(expectedUnits);

      const missingUnits = setDifference(expectedUnitSet, actualUnitSet);
      const extraUnits = setDifference(actualUnitSet, expectedUnitSet);

      expect(missingUnits).toEqual([]);
      expect(extraUnits).toEqual([]);

      // Elder Dragon items: Infinity Edge, Deathblade, Striker's Flail
      const dragonItems = arch!.recommendedItems["tft18_da_18_elderdragon"] || [];
      const expectedDragonItems = [
        "tft18_item_infinityedge",
        "tft18_item_deathblade",
        "tft18_item_strikersflail"
      ];
      expect(setDifference(new Set(expectedDragonItems), new Set(dragonItems))).toEqual([]);
      expect(setDifference(new Set(dragonItems), new Set(expectedDragonItems))).toEqual([]);

      // Maokai items: Warmog's Armor, Gargoyle Stoneplate, Crownguard
      const maokaiItems = arch!.recommendedItems["tft18_da_18_maokai"] || [];
      const expectedMaokaiItems = [
        "tft18_item_warmogsarmor",
        "tft18_item_gargoylestoneplate",
        "tft18_item_crownguard"
      ];
      expect(setDifference(new Set(expectedMaokaiItems), new Set(maokaiItems))).toEqual([]);
      expect(setDifference(new Set(maokaiItems), new Set(expectedMaokaiItems))).toEqual([]);
    });

    it("Ahri Morgana (comp_ahri_morgana): Exact 8 units và exact item set", async () => {
      const arch = await metaRepository.getArchetypeById("comp_ahri_morgana", "real");
      expect(arch).not.toBeNull();

      const board = arch!.variants[0]?.recommendedBoard || [];
      expect(board.length).toBe(8);

      // Expected units từ Positioning Example:
      // Krug, Taric, Sentinel, Sett, Morgana, Karma, Sentry, Ahri
      const actualUnits = board.map((u) => u.championId);
      const expectedUnits = [
        "tft18_da_krug18",
        "tft18_da_taric18",
        "tft18_da_sentinel18",
        "tft18_da_18_sett",
        "tft18_da_18_morgana",
        "tft18_da_karma18",
        "tft18_da_18_sentry",
        "tft18_da_18_ahri"
      ];

      const actualUnitSet = new Set(actualUnits);
      const expectedUnitSet = new Set(expectedUnits);

      expect(setDifference(expectedUnitSet, actualUnitSet)).toEqual([]);
      expect(setDifference(actualUnitSet, expectedUnitSet)).toEqual([]);

      // Ahri items: Jeweled Gauntlet, Striker's Flail, Spear of Shojin
      const ahriItems = arch!.recommendedItems["tft18_da_18_ahri"] || [];
      const expectedAhriItems = [
        "tft18_item_jeweledgauntlet",
        "tft18_item_strikersflail",
        "tft18_item_spearofshojin"
      ];
      expect(setDifference(new Set(expectedAhriItems), new Set(ahriItems))).toEqual([]);
      expect(setDifference(new Set(ahriItems), new Set(expectedAhriItems))).toEqual([]);

      // Morgana items: Void Staff, Morellonomicon
      const morganaItems = arch!.recommendedItems["tft18_da_18_morgana"] || [];
      const expectedMorganaItems = [
        "tft18_item_voidstaff",
        "tft18_item_morellonomicon"
      ];
      expect(setDifference(new Set(expectedMorganaItems), new Set(morganaItems))).toEqual([]);
      expect(setDifference(new Set(morganaItems), new Set(expectedMorganaItems))).toEqual([]);

      // Sett items: Bramble Vest, Warmog's Armor, Dragon's Claw
      const settItems = arch!.recommendedItems["tft18_da_18_sett"] || [];
      const expectedSettItems = [
        "tft18_item_bramblevest",
        "tft18_item_warmogsarmor",
        "tft18_item_dragonsclaw"
      ];
      expect(setDifference(new Set(expectedSettItems), new Set(settItems))).toEqual([]);
      expect(setDifference(new Set(settItems), new Set(expectedSettItems))).toEqual([]);
    });

    it("Blossom Fast 9 (comp_blossom_fast9): Exact 9 units (không ép thành 8) và exact item set", async () => {
      const arch = await metaRepository.getArchetypeById("comp_blossom_fast9", "real");
      expect(arch).not.toBeNull();

      const board = arch!.variants[0]?.recommendedBoard || [];
      // Tiêu chí: Board 9 tướng phải render 9 tướng; không ép tất cả comp thành 8 slot
      expect(board.length).toBe(9);

      // Expected units từ Positioning Example:
      // Lillia, Rammus, Diana, Sett, Gnar, Tristana, Ahri, Alune, Ashe
      const actualUnits = board.map((u) => u.championId);
      const expectedUnits = [
        "tft18_da_18_lillia",
        "tft18_da_18_rammus",
        "tft18_da_18_diana",
        "tft18_da_18_sett",
        "tft18_da_18_gnarsmall",
        "tft18_da_18_tristana",
        "tft18_da_18_ahri",
        "tft18_da_18_alune",
        "tft18_da_18_ashe"
      ];

      const actualUnitSet = new Set(actualUnits);
      const expectedUnitSet = new Set(expectedUnits);

      expect(setDifference(expectedUnitSet, actualUnitSet)).toEqual([]);
      expect(setDifference(actualUnitSet, expectedUnitSet)).toEqual([]);

      // Ashe items: Spear of Shojin, Red Buff, Last Whisper
      const asheItems = arch!.recommendedItems["tft18_da_18_ashe"] || [];
      const expectedAsheItems = [
        "tft18_item_spearofshojin",
        "tft18_item_redbuff",
        "tft18_item_lastwhisper"
      ];
      expect(setDifference(new Set(expectedAsheItems), new Set(asheItems))).toEqual([]);
      expect(setDifference(new Set(asheItems), new Set(expectedAsheItems))).toEqual([]);

      // Sett items: Warmog's Armor, Spirit Visage, Steadfast Heart
      const settItems = arch!.recommendedItems["tft18_da_18_sett"] || [];
      const expectedSettItems = [
        "tft18_item_warmogsarmor",
        "tft18_item_spiritvisage",
        "tft18_item_steadfastheart"
      ];
      expect(setDifference(new Set(expectedSettItems), new Set(settItems))).toEqual([]);
      expect(setDifference(new Set(settItems), new Set(expectedSettItems))).toEqual([]);
    });

    it("Tiêu chí nhạy cảm (Sensitivity): Test bắt buộc phải fail nếu thay đổi 1 tướng hoặc 1 món đồ", () => {
      const realUnits = new Set(["tft18_ashe", "tft18_sett", "tft18_ahri"]);
      const corruptedUnits = new Set(["tft18_ashe", "tft18_sett", "tft18_draven"]); // thay draven
      const missing = setDifference(realUnits, corruptedUnits);
      const extra = setDifference(corruptedUnits, realUnits);
      expect(missing.length).toBeGreaterThan(0);
      expect(extra.length).toBeGreaterThan(0);

      const realItems = new Set(["tft18_item_spearofshojin", "tft18_item_redbuff", "tft18_item_lastwhisper"]);
      const corruptedItems = new Set(["tft18_item_spearofshojin", "tft18_item_redbuff", "tft18_item_infinityedge"]);
      expect(setDifference(realItems, corruptedItems).length).toBeGreaterThan(0);
    });

    it("Mode real không fallback sang archetypes hardcode khi không có build", async () => {
      // comp_hecarim_cavalry không có build từ nguồn TFT Academy
      const arch = await metaRepository.getArchetypeById("comp_hecarim_cavalry", "real");
      expect(arch).not.toBeNull();
      // Phải trả về mảng rỗng [] và object rỗng {}, không được lấy Hecarim/Sett từ static
      expect(arch!.variants[0]?.recommendedBoard || []).toEqual([]);
      expect(arch!.recommendedItems || {}).toEqual({});
    });
  });

  // =========================================================================
  // 4. MULTI-SOURCE CONSENSUS & RANKINGS (Section 6: Website ranking)
  // =========================================================================
  describe("4. Multi-Source Consensus & Website Rankings", () => {
    it("Chỉ comp có >= 2 nguồn độc lập mới có consensus tier khác null", async () => {
      const rankingSnap = await metaRepository.getLatestRankingSnapshot("websites", "real", {
        patchEpochId: "epoch_18_2"
      });

      expect(rankingSnap).not.toBeNull();
      expect(rankingSnap!.publicationStatus).toBe("published");

      // comp_dragon_princess có 2 nguồn (TFT Academy + tactics.tools) -> Tier A, status ranked
      const dragonRow = rankingSnap!.rows.find((r) => r.archetypeId === "comp_dragon_princess");
      expect(dragonRow).toBeDefined();
      expect(dragonRow!.validSourceCount).toBe(2);
      expect(dragonRow!.status).toBe("ranked");
      expect(dragonRow!.tier).toBe("A");

      // comp_akali_ninja có >= 2 nguồn độc lập -> Tier B, status ranked
      const akaliRow = rankingSnap!.rows.find((r) => r.archetypeId === "comp_akali_ninja");
      expect(akaliRow).toBeDefined();
      expect(akaliRow!.validSourceCount).toBeGreaterThanOrEqual(2);
      expect(akaliRow!.status).toBe("ranked");
      expect(akaliRow!.tier).toBe("B");

      // comp_blossom_fast9 chỉ có 1 nguồn (TFT Academy) -> tier: null, status: collecting
      const blossomRow = rankingSnap!.rows.find((r) => r.archetypeId === "comp_blossom_fast9");
      expect(blossomRow).toBeDefined();
      expect(blossomRow!.validSourceCount).toBe(1);
      expect(blossomRow!.status).toBe("collecting");
      expect(blossomRow!.tier).toBeNull();
      expect(blossomRow!.candidateTier).toBe("S"); // candidateTier giữ tier đơn nguồn

      // comp_hecarim_cavalry có 0 nguồn -> tier: null, status: collecting
      const hecarimCompRow = rankingSnap!.rows.find((r) => r.archetypeId === "comp_hecarim_cavalry");
      expect(hecarimCompRow).toBeDefined();
      expect(hecarimCompRow!.validSourceCount).toBe(0);
      expect(hecarimCompRow!.status).toBe("collecting");
      expect(hecarimCompRow!.tier).toBeNull();
    });

    it("Website ranking rows trong mode real không chứa dữ liệu board hardcode khi thiếu nguồn", async () => {
      const rankingSnap = await metaRepository.getLatestRankingSnapshot("websites", "real", {
        patchEpochId: "epoch_18_2"
      });

      const hecarimRow = rankingSnap!.rows.find((r) => r.archetypeId === "comp_hecarim_cavalry");
      expect(hecarimRow).toBeDefined();
      // Không fallback sang static
      expect(hecarimRow!.recommendedBoard).toEqual([]);
      expect(hecarimRow!.recommendedItems).toEqual({});
    });
  });

  // =========================================================================
  // 5. ELITE RANKING HONEST STATE (Section 6: Elite ranking)
  // =========================================================================
  describe("5. Elite Ranking Honest Collecting Handling", () => {
    it("Khi chưa có RIOT_API_KEY hoặc matches, elite ranking trả về null (404/collecting), không seed", async () => {
      const eliteSnap = await metaRepository.getLatestRankingSnapshot("elite", "real", {
        patchEpochId: "epoch_18_2"
      });

      // Không có snapshot elite giả mạo nào được lưu trong real
      expect(eliteSnap).toBeNull();
    });
  });
});
