import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, closeDb } from "../../src/server/db/client";
import { MetaRepository } from "../../src/server/meta/repositories/meta-repository";
import { isShopChampion, isValidBoardEntity, validateBoardUnits } from "../../src/domain/meta/board-validator";
import { SourceCompObservation } from "../../src/domain/meta/schemas";

describe("DB Round-Trip & Source Preservation", () => {
  let repository: MetaRepository;

  beforeAll(async () => {
    repository = new MetaRepository();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("preserves sourceLeadChampionId, tankChampionId = null, and inferred tank in DB roundtrip", async () => {
    const now = new Date().toISOString();
    const testObs: SourceCompObservation = {
      id: "obs_test_riftbeast_round6",
      datasetKind: "real",
      sourceId: "tftflex",
      sourceCompId: "tftflex_riftbeast-tempo",
      sourceUrl: "https://tftflex.com/en/meta/set-18/riftbeast-tempo",
      rawArtifactId: "art_test_riftbeast",
      observedAt: now,
      fetchedAt: now,
      sourcePublishedAt: now,
      sourceDataAsOf: now,
      sourceUpdatedAt: now,
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
      archetypeId: null,
      variantId: null,
      originalName: "Riftbeast Tempo",
      originalTier: "B",
      classificationKind: "editorial",
      sourceLeadChampionId: "tft18_da_scuttlecrab18",
      carryChampionId: "tft18_da_scuttlecrab18",
      tankChampionId: null, // Source DOES NOT provide tank; must remain null!
      inferred: {
        carryChampionId: "tft18_da_18_sentry",
        tankChampionId: "tft18_da_scuttlecrab18",
        algorithmVersion: "item-role-v1"
      },
      metrics: {
        averagePlacement: null,
        top4Rate: null,
        winRate: null,
        sampleCount: null,
        sampleCountQuality: "unknown",
        pickRateRaw: null,
        pickRateUnit: "unknown"
      },
      conditions: [
        'Source Lead: DA_Scuttlecrab18 (nguồn: tftflex.com/en/meta (comps-text-list: "Scuttlecrab"), độ tin cậy: high)',
        "App suy luận Tank: tft18_da_scuttlecrab18 dựa trên trang bị phòng thủ."
      ],
      evidenceRefIds: ["ev_test_riftbeast"],
      parserVersion: "2.0.0",
      mappingVersion: "2.0.0"
    };

    // 1. Save observations into repository
    await repository.saveSourceObservations(
      "snap_test_riftbeast_round6",
      "tftflex",
      testObs.scope,
      [testObs],
      "real"
    );

    // 2. Read back observations via repository
    const fetched = await repository.getLatestSourceObservations(
      "epoch_18_2",
      "real"
    );

    const target = fetched.find((o) => o.id === "obs_test_riftbeast_round6");
    expect(target).toBeDefined();

    // Source Lead must be Scuttlecrab
    expect(target!.sourceLeadChampionId).toBe("tft18_da_scuttlecrab18");

    // Source Tank MUST remain null (no auto-deduction overwriting source field)
    expect(target!.tankChampionId).toBeNull();

    // Inferred roles MUST be preserved in dedicated `inferred` object
    expect(target!.inferred).toBeDefined();
    expect(target!.inferred?.tankChampionId).toBe("tft18_da_scuttlecrab18");
    expect(target!.inferred?.carryChampionId).toBe("tft18_da_18_sentry");
    expect(target!.inferred?.algorithmVersion).toBe("item-role-v1");
  });

  it("validates that Gromp, Scuttlecrab, Krug, Sentinel, Elder Dragon are shop champions and board entities", () => {
    // Verified against gameplay artifact: storage/raw/sha256/12/12020335ad47e3b763fd4b8cf9f9358b7c800aa903db15a1db0372c667d383d0.json
    expect(isValidBoardEntity("DA_Scuttlecrab18")).toBe(true);
    expect(isValidBoardEntity("DA_Gromp18_AP")).toBe(true);
    expect(isValidBoardEntity("DA_Krug18")).toBe(true);
    expect(isValidBoardEntity("DA_Sentinel18")).toBe(true);
    expect(isValidBoardEntity("DA_18_ElderDragon")).toBe(true);
    expect(isValidBoardEntity("TFT_TrainingDummy")).toBe(true);

    expect(isShopChampion("DA_Scuttlecrab18")).toBe(true);
    expect(isShopChampion("DA_Gromp18_AP")).toBe(true);
    expect(isShopChampion("DA_Krug18")).toBe(true);
    expect(isShopChampion("DA_Sentinel18")).toBe(true);
    expect(isShopChampion("DA_18_ElderDragon")).toBe(true);

    // Board validation passes for a Riftbeast board
    const boardValidation = validateBoardUnits([
      { championId: "DA_Scuttlecrab18", starLevel: 2, items: ["DA_WarmogsArmor"] },
      { championId: "DA_Krug18", starLevel: 2 },
      { championId: "DA_Brambleback18", starLevel: 2 },
      { championId: "DA_Murkwolf18", starLevel: 2 },
      { championId: "DA_Sentinel18", starLevel: 2 },
      { championId: "DA_18_Sentry", starLevel: 2, items: ["DA_SpearOfShojin"] },
      { championId: "DA_Cinderling18", starLevel: 2 }
    ]);
    expect(boardValidation.valid).toBe(true);
    expect(boardValidation.errors).toHaveLength(0);
  });
});
