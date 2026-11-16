import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { SourceCompObservation } from "../../src/domain/meta/schemas";
import { canonicalSet18ChampionId } from "../../src/domain/meta/set18-registry";

describe("TFTFlex Source Truth Matrix & Build Integrity", () => {
  const importPath = path.resolve("./storage/imports/tftflex_import.json");
  const rawData = fs.readFileSync(importPath, "utf8");
  const observations: SourceCompObservation[] = JSON.parse(rawData);

  it("contains exactly 20 genuine source comps from TFTFlex", () => {
    expect(observations).toHaveLength(20);
    const slugs = observations.map((o) => o.sourceCompId);
    expect(new Set(slugs).size).toBe(20);
  });

  it("verifies unit counts for the 6 mandatory cases from & 6", () => {
    const compMap = new Map(observations.map((o) => [o.sourceCompId, o]));

    // 1. Sivir Nidalee: 8 units
    const sivir = compMap.get("tftflex_sivir-nidalee");
    expect(sivir).toBeDefined();
    const sivirPrimary = sivir!.builds?.find((b) => b.boardKind === "primary");
    expect(sivirPrimary?.units).toHaveLength(8);
    expect(sivir!.sourceLeadChampionId).toBe(canonicalSet18ChampionId("DA_18_Sivir"));

    // 2. Aphelios Vanguard: 8 units
    const aphVanguard = compMap.get("tftflex_aphelios-vanguard");
    expect(aphVanguard).toBeDefined();
    const aphVanguardPrimary = aphVanguard!.builds?.find((b) => b.boardKind === "primary");
    expect(aphVanguardPrimary?.units).toHaveLength(8);
    expect(aphVanguard!.sourceLeadChampionId).toBe(canonicalSet18ChampionId("DA_18_Aphelios"));

    // 3. Riftbeast Tempo: 7 units
    const riftbeast = compMap.get("tftflex_riftbeast-tempo");
    expect(riftbeast).toBeDefined();
    const riftbeastPrimary = riftbeast!.builds?.find((b) => b.boardKind === "primary");
    expect(riftbeastPrimary?.units).toHaveLength(7);
    expect(riftbeast!.sourceLeadChampionId).toBe(canonicalSet18ChampionId("DA_Scuttlecrab18"));

    // 4. Master Yi Reroll: 7 units
    const masterYi = compMap.get("tftflex_master-yi-reroll");
    expect(masterYi).toBeDefined();
    const masterYiPrimary = masterYi!.builds?.find((b) => b.boardKind === "primary");
    expect(masterYiPrimary?.units).toHaveLength(7);
    expect(masterYi!.sourceLeadChampionId).toBe(canonicalSet18ChampionId("DA_18_MasterYi_AD"));

    // 5. Caitlyn Reroll: 6 units
    const caitlyn = compMap.get("tftflex_caitlyn-reroll");
    expect(caitlyn).toBeDefined();
    const caitlynPrimary = caitlyn!.builds?.find((b) => b.boardKind === "primary");
    expect(caitlynPrimary?.units).toHaveLength(6);
    expect(caitlyn!.sourceLeadChampionId).toBe(canonicalSet18ChampionId("DA_18_Caitlyn"));

    // 6. Morgana Flex: 8 units
    const morgana = compMap.get("tftflex_morgana-flex");
    expect(morgana).toBeDefined();
    const morganaPrimary = morgana!.builds?.find((b) => b.boardKind === "primary");
    expect(morganaPrimary?.units).toHaveLength(8);
    expect(morgana!.sourceLeadChampionId).toBe(canonicalSet18ChampionId("DA_18_Morgana"));
  });

  it("ensures no cross-variant position merging into summary boards", () => {
    for (const obs of observations) {
      // Every comp must have at least 1 build
      expect(obs.builds).toBeDefined();
      expect(obs.builds!.length).toBeGreaterThan(0);

      // In every build, every unit with a position must be within board grid (0..3 rows, 0..6 cols)
      for (const build of obs.builds!) {
        for (const unit of build.units) {
          if (unit.position) {
            expect(unit.position.row).toBeGreaterThanOrEqual(0);
            expect(unit.position.row).toBeLessThanOrEqual(3);
            expect(unit.position.col).toBeGreaterThanOrEqual(0);
            expect(unit.position.col).toBeLessThanOrEqual(6);
          }
        }
      }
    }
  });

  it("verifies multi-build variants exist for comps with multiple game-team blocks", () => {
    const compMap = new Map(observations.map((o) => [o.sourceCompId, o]));

    const fast9Ashe = compMap.get("tftflex_fast-9-ashe-ad");
    expect(fast9Ashe).toBeDefined();
    expect(fast9Ashe!.builds!.length).toBeGreaterThanOrEqual(2);

    const riftbeast = compMap.get("tftflex_riftbeast-tempo");
    expect(riftbeast).toBeDefined();
    expect(riftbeast!.builds!.length).toBeGreaterThanOrEqual(2);

    const khazik = compMap.get("tftflex_khazik-reroll");
    expect(khazik).toBeDefined();
    expect(khazik!.builds!.length).toBeGreaterThanOrEqual(2);
  });

  it("verifies APhelios Thần Rừng is rejected from mapping to Ashe Sniper", () => {
    const aph = observations.find((o) => o.sourceCompId === "tftflex_a-phelios-than-rung");
    expect(aph).toBeDefined();
    // Must NOT be mapped to comp_ashe_sniper
    expect(aph!.archetypeId).not.toBe("comp_ashe_sniper");
    // In , Aphelios has canonical archetype comp_aphelios_elderwood
    expect(aph!.archetypeId).toBe("comp_aphelios_elderwood");
  });

  it("verifies source tank remains null and inferred roles are isolated", () => {
    for (const obs of observations) {
      // TFTFlex does not specify tanks
      expect(obs.tankChampionId).toBeNull();

      // Inferred object must be isolated
      if (obs.inferred) {
        expect(obs.inferred.algorithmVersion).toBe("item-role-v1");
      }
    }
  });

  it("verifies all 20 source comps have source lead provenance with locator and confidence", () => {
    for (const obs of observations) {
      expect(obs.sourceLeadChampionId).toBeTruthy();
      const leadCond = obs.conditions.find((c) => c.startsWith("Source Lead:"));
      expect(leadCond).toBeDefined();
      expect(leadCond).toContain("nguồn:");
      expect(leadCond).toContain("độ tin cậy: high");
    }
  });
});
