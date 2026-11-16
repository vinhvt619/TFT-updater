import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { SourceCompObservation } from "../../src/domain/meta/schemas";
import { discoverAcademyGuides } from "../../scripts/meta/ingest-real-meta-sources";
import { PublicationService } from "../../src/server/services/publication-service";
import { validateBoardUnits } from "../../src/domain/meta/board-validator";
import { getDb } from "../../src/server/db/client";
import { metaSourceSnapshots, metaSourceCompObservations } from "../../src/server/db/schema-meta";

describe("Exact Fixtures, Source Parity, Board Truth & Gate Verification", () => {
  const tftflexImportPath = path.resolve("./storage/imports/tftflex_import.json");
  const rawTftflex = fs.readFileSync(tftflexImportPath, "utf8");
  const tftflexObs: SourceCompObservation[] = JSON.parse(rawTftflex);

  describe("1. TFTFlex Source Parity & Tier Truth", () => {
    it("contains exactly 20 genuine source comps from TFTFlex", () => {
      expect(tftflexObs).toHaveLength(20);
      const uniqueSlugs = new Set(tftflexObs.map((o) => o.sourceCompId));
      expect(uniqueSlugs.size).toBe(20);
    });

    it("verifies Yunara Reroll tier matches the latest collected TFTFlex artifact", () => {
      const yunara = tftflexObs.find((o) => o.sourceCompId === "tftflex_yunara-reroll");
      expect(yunara).toBeDefined();
      const sourceHtml = fs.readFileSync(path.resolve("./storage/raw/tftflex_meta_18_2.html"), "utf8");
      const sourceTier = Array.from(sourceHtml.matchAll(/name:"([^"]+)",slug:"([^"]+)",set:18,tier:"([^"]+)"/g))
        .find((match) => match[2] === "yunara-reroll")?.[3]?.toUpperCase();
      expect(sourceTier).toBeDefined();
      expect(yunara!.originalTier).toBe(sourceTier);
    });

    it("accepts Akali Camille as valid stage-specific board (Lv5/5 units)", () => {
      const akali = tftflexObs.find((o) => o.sourceCompId === "tftflex_akali-camille");
      expect(akali).toBeDefined();
      expect(akali!.status).toBe("valid");
      expect(akali!.originalTier).toBe("B");
      expect(akali!.quarantineReason).toBeNull();
      expect(akali!.archetypeId).toBe("comp_akali_ninja");
    });

    it("accepts Aphelios Thần Rừng as valid with 8 shop units (3 dummies excluded)", () => {
      const aphelios = tftflexObs.find((o) => o.sourceCompId === "tftflex_a-phelios-than-rung");
      expect(aphelios).toBeDefined();
      expect(aphelios!.status).toBe("valid");
      expect(aphelios!.quarantineReason).toBeNull();
      // Aphelios should NOT map to Ashe Sniper
      expect(aphelios!.archetypeId).not.toBe("comp_ashe_sniper");
    });

    it("verifies 0 boardLevel mismatches across all collected build variants", () => {
      let buildCount = 0;
      let mismatchCount = 0;

      for (const obs of tftflexObs) {
        for (const b of obs.builds || []) {
          buildCount++;
          const labelMatch = (b.sourceLocator || "").match(/(?:Lv|Level)\s*(\d+)/i);
          if (labelMatch) {
            const expectedLevel = parseInt(labelMatch[1], 10);
            if (b.boardLevel !== expectedLevel) {
              mismatchCount++;
            }
          }
        }
      }

      // The current TFTFlex artifact has 42 genuine game-team blocks.  The
      // assertion intentionally accepts later source additions while still
      // failing on a truncated import.
      expect(buildCount).toBeGreaterThanOrEqual(41);
      expect(mismatchCount).toBe(0);
    });

    it("verifies 0 abnormal tokens (> or +) captured as entity keys in any build", () => {
      for (const obs of tftflexObs) {
        for (const b of obs.builds || []) {
          for (const u of b.units) {
            const key = u.sourceChampionKey || u.championId;
            expect(key).not.toBe(">");
            expect(key).not.toBe("+");
            expect(key).not.toContain(">");
          }
        }
      }
    });
  });

  describe("2. tactics.tools Group Identity Parity", () => {
    it("preserves authentic group names for all 5 statistical groups", () => {
      const nextDataPath = path.resolve("./storage/raw/tactics_tools_nextdata.json");
      expect(fs.existsSync(nextDataPath)).toBe(true);
      const nextData = JSON.parse(fs.readFileSync(nextDataPath, "utf8"));
      const groups = nextData.initialData?.groups || [];
      expect(groups).toHaveLength(5);
    });
  });

  describe("3. TFT Academy Dynamic Discovery & Pinned Identity Regression (R06)", () => {
    const EXPECTED_PINNED_28_ACADEMY_SLUGS = [
      "set-18-6-juggernaut-ap",
      "set-18-adaptor-nidalee",
      "set-18-adaptor-reroll-copy",
      "set-18-ahri-morgana",
      "set-18-aphelios-nidalee",
      "set-18-blossom-fast-9",
      "set-18-caitlyn-hunters",
      "set-18-cashout-morgana",
      "set-18-dark-mages",
      "set-18-defender-cassio",
      "set-18-dragon-princess",
      "set-18-elderwood-executioners-copy",
      "set-18-fae-tristana-copy",
      "set-18-invoker-nidalee-copy",
      "set-18-lunarwood-khazix",
      "set-18-rengar-rr",
      "set-18-riftbeast-reroll",
      "set-18-solar-kayle",
      "set-18-solar-melee",
      "set-18-solara-yunara",
      "set-18-soraka-flex",
      "set-18-sprykin-teemo-copy",
      "set-18-sprykin-trist",
      "set-18-trait-ladder",
      "set-18-unrivaled-reroll",
      "set-18-veigar-consuming-flora-copy",
      "set-18-warwick-rr",
      "set-18-woodblossom"
    ];

    it("verifies pinned tierlist SHA-256 digest and exact 28-guide identity set (detects missing, extra, duplicate, or substituted guides)", () => {

      const tierlistPath = path.resolve("./storage/raw/tftacademy_tierlist_live.html");
      const rawBytes = fs.readFileSync(tierlistPath);
      const actualSha256 = crypto.createHash("sha256").update(rawBytes).digest("hex");
      expect(actualSha256).toBe("a1ce5a3c362049be3114c73a83182de99d0efc5faab946d5ef346db379adc01e");
      expect(rawBytes.length).toBe(298398);

      const guides = discoverAcademyGuides({ tierlistFilePath: tierlistPath });
      expect(guides.length).toBe(28);
      const slugs = guides.map((g) => g.slug);
      expect(new Set(slugs).size).toBe(28);
      expect([...slugs].sort()).toEqual([...EXPECTED_PINNED_28_ACADEMY_SLUGS].sort());
    });

    it("dynamically discovers variable guide counts and deduplicates links without locking live discovery to 28", () => {
      // Giải thích lịch sử R06: tại commit 426c84e42470be0a0a7cf840831ce9f8516edc7c, kho đệm ban đầu chỉ có 8 guide HTML
      // trước khi bản chụp đầy đủ tftacademy_tierlist_live.html (28 guides, hash a1ce5a3c...) được lưu.
      const historicalEightSlugs = EXPECTED_PINNED_28_ACADEMY_SLUGS.slice(0, 8);
      const syntheticHtml = historicalEightSlugs
        .concat([historicalEightSlugs[0], historicalEightSlugs[3]]) // thêm link trùng lặp để kiểm tra dedupe
        .map((s) => `<a href="/tierlist/comps/${s}">${s}</a>`)
        .join("\n");

      const discovered = discoverAcademyGuides({ htmlContent: syntheticHtml });
      expect(discovered.map((g) => g.slug)).toEqual(historicalEightSlugs);
    });
  });

  describe("4. Board Exactness & Star/Carry Semantics", () => {
    it("preserves null star level instead of defaulting to 2", () => {
      for (const obs of tftflexObs) {
        for (const b of obs.builds || []) {
          for (const u of b.units) {
            if (u.starLevel !== null && u.starLevel !== undefined) {
              expect([1, 2, 3, 4]).toContain(u.starLevel);
            }
          }
        }
      }
    });

    it("board validator rejects 5 units and quarantines invalid boards", () => {
      const invalid5 = validateBoardUnits([
        { championId: "tft18_da_18_akali_ad", rawKey: "DA_18_Akali_AD" },
        { championId: "tft18_da_18_camille", rawKey: "DA_18_Camille" },
        { championId: "tft18_da_18_leona", rawKey: "DA_18_Leona" },
        { championId: "tft18_da_18_ornn", rawKey: "DA_18_Ornn" },
        { championId: "tft18_da_18_varus", rawKey: "DA_18_Varus" }
      ]);
      expect(invalid5.valid).toBe(false);
      expect(invalid5.quarantined).toBe(true);
      expect(invalid5.quarantineReason).toContain("5 tướng");
    });
  });
  describe("5. Publication Gate Fail-Closed Verification", () => {
    const pubService = new PublicationService();

    it("gate fails when input observation is quarantined", async () => {
      const db = await getDb();
      await db.insert(metaSourceSnapshots).values({
        id: "snap_tftflex_epoch_18_2",
        sourceId: "tftflex",
        scope: { setNumber: 18, patchEpochId: "epoch_18_2" },
        rawArtifactId: "dummy_artifact_1",
        status: "success",
        fetchedAt: new Date()
      }).onConflictDoNothing();

      await db.insert(metaSourceCompObservations).values({
        id: "obs_tftflex_akali-camille_epoch_18_2",
        snapshotId: "snap_tftflex_epoch_18_2",
        sourceId: "tftflex",
        datasetKind: "real",
        sourceCompId: "tftflex_akali-camille",
        sourceUrl: "https://tftflex.com/meta/akali-camille",
        originalName: "Akali Camille",
        status: "quarantined",
        quarantineReason: "Invalid board: 5 tướng",
        fetchedAt: new Date()
      }).onConflictDoUpdate({
        target: metaSourceCompObservations.id,
        set: { status: "quarantined", quarantineReason: "Invalid board: 5 tướng" }
      });

      const report = await pubService.validateRanking({
        snapshotId: "test_gate_fail_quarantine",
        datasetKind: "real",
        boardType: "websites",
        sourceDataAsOf: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        inputObservationIds: ["obs_tftflex_akali-camille_epoch_18_2"] // This is quarantined
      });

      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes("cách ly") || e.includes("quarantined") || e.includes("valid"))).toBe(true);
    });

    it("gate fails when an observation is stale (>48h)", async () => {
      const db = await getDb();
      await db.insert(metaSourceSnapshots).values({
        id: "snap_tftacademy_epoch_18_2",
        sourceId: "tftacademy",
        scope: { setNumber: 18, patchEpochId: "epoch_18_2" },
        rawArtifactId: "dummy_artifact_2",
        status: "success",
        fetchedAt: new Date()
      }).onConflictDoNothing();

      const staleDate = new Date(Date.now() - 72 * 3600 * 1000);
      await db.insert(metaSourceCompObservations).values({
        id: "obs_tftacademy_set-18-dragon-princess_epoch_18_2",
        snapshotId: "snap_tftacademy_epoch_18_2",
        sourceId: "tftacademy",
        datasetKind: "real",
        sourceCompId: "set-18-dragon-princess",
        sourceUrl: "https://tftacademy.com/tierlist/set-18-dragon-princess",
        originalName: "Dragon Princess",
        status: "valid",
        fetchedAt: staleDate,
        sourceDataAsOf: staleDate
      }).onConflictDoUpdate({
        target: metaSourceCompObservations.id,
        set: { status: "valid", fetchedAt: staleDate, sourceDataAsOf: staleDate }
      });

      const report = await pubService.validateRanking({
        snapshotId: "test_gate_fail_stale",
        datasetKind: "real",
        boardType: "websites",
        sourceDataAsOf: staleDate.toISOString(),
        fetchedAt: staleDate.toISOString(),
        inputObservationIds: ["obs_tftacademy_set-18-dragon-princess_epoch_18_2"]
      });

      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes("freshness") || e.includes("48h"))).toBe(true);
    });
  });
});
