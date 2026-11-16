import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifiedWebsiteSnapshot } from "@/server/meta/services/verified-catalogue";
import { metaRepository } from "@/server/meta/repositories/meta-repository";
import type { RankingSnapshot, SourceCompObservation } from "@/domain/meta/schemas";

vi.mock("@/server/meta/repositories/meta-repository", () => ({
  metaRepository: {
    getLatestSourceObservations: vi.fn()
  }
}));

vi.mock("@/server/meta/services/source-verification", () => ({
  verifySourceObservation: vi.fn(async (obs: SourceCompObservation, options: { maxAgeHours?: number; referenceTime?: string }) => {
    const ref = options.referenceTime ? new Date(options.referenceTime).getTime() : Date.now();
    const obsTime = new Date(obs.sourceDataAsOf || obs.observedAt).getTime();
    const ageHours = (ref - obsTime) / (1000 * 60 * 60);
    const maxAge = options.maxAgeHours ?? 48;
    const isFresh = ageHours >= 0 && ageHours <= maxAge;

    return {
      verified: isFresh,
      gates: {
        freshnessPass: isFresh,
        evidencePresencePass: true,
        scopePass: true
      },
      reason: isFresh ? undefined : "Dữ liệu quá hạn"
    };
  })
}));

describe("FIN-02 & FIN-03: Verified Catalogue Gate Audit", () => {
  const baseScope = {
    boardType: "websites" as const,
    region: "all",
    windowHours: 48,
    patchEpochId: "live_18_2",
    datasetKind: "real" as const
  };

  const sampleSnapshot: RankingSnapshot = {
    id: "snap_real_18_2_test",
    datasetKind: "real",
    publicationStatus: "published",
    rankingScope: baseScope,
    generatedAt: "2026-09-01T12:00:00.000Z",
    sourceDataAsOf: "2026-09-01T10:00:00.000Z",
    status: "ranked",
    inputObservationIds: ["obs_academy_ahri"],
    warnings: [],
    rows: [
      {
        archetypeId: "arch_ahri_carry",
        archetypeKey: "ahri_carry",
        displayNameVi: "Ahri Ma Pháp",
        tier: "S",
        rank: 1,
        sourceVotes: {},
        consensusScore: 90,
        consensusConfidence: 0.9,
        status: "ranked"
      },
      {
        archetypeId: "arch_draven_carry",
        archetypeKey: "draven_carry",
        displayNameVi: "Draven Đao Phủ",
        tier: "A",
        rank: 2,
        sourceVotes: {},
        consensusScore: 80,
        consensusConfidence: 0.8,
        status: "ranked"
      }
    ],
    totals: {
      totalArchetypes: 2,
      rankedTierS: 1,
      rankedTierA: 1,
      rankedTierB: 0,
      rankedTierC: 0,
      provisionalCount: 0,
      collectingCount: 0
    }
  } as unknown as RankingSnapshot;

  const mockObsAhri: SourceCompObservation = {
    id: "obs_academy_ahri",
    sourceId: "tftacademy",
    sourceApiName: "TFT Academy",
    patchEpochId: "live_18_2",
    datasetKind: "real",
    sourceDataAsOf: "2026-09-01T09:00:00.000Z",
    observedAt: "2026-09-01T09:30:00.000Z",
    archetypeId: "arch_ahri_carry",
    archetypeKey: "ahri_carry",
    sourceTier: "S",
    evidenceRefIds: ["ev_1"],
    status: "valid",
    provenance: {
      rawArtifactId: "art_1",
      parserVersion: "1.0",
      contentSha256: "hash",
      observedAt: "2026-09-01T09:30:00.000Z"
    }
  } as unknown as SourceCompObservation;

  const mockObsDraven: SourceCompObservation = {
    id: "obs_metatft_draven",
    sourceId: "metatft",
    sourceApiName: "MetaTFT",
    patchEpochId: "live_18_2",
    datasetKind: "real",
    sourceDataAsOf: "2026-09-01T09:00:00.000Z",
    observedAt: "2026-09-01T09:30:00.000Z",
    archetypeId: "arch_draven_carry",
    archetypeKey: "draven_carry",
    sourceTier: "A",
    evidenceRefIds: ["ev_2"],
    status: "valid",
    provenance: {
      rawArtifactId: "art_2",
      parserVersion: "1.0",
      contentSha256: "hash",
      observedAt: "2026-09-01T09:30:00.000Z"
    }
  } as unknown as SourceCompObservation;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(metaRepository.getLatestSourceObservations).mockResolvedValue([
      mockObsAhri,
      mockObsDraven
    ]);
  });

  it("FIN-03: rejects rows when inputObservationIds is empty (no pass-through loophole)", async () => {
    const emptyInputSnap: RankingSnapshot = {
      ...sampleSnapshot,
      inputObservationIds: []
    };

    const verified = await verifiedWebsiteSnapshot(emptyInputSnap, {
      mode: "archive",
      referenceTime: "2026-09-01T12:00:00.000Z"
    });

    expect(verified.rows).toHaveLength(0);
    expect(verified.status).toBe("collecting");
  });

  it("FIN-03: only attests rows that match actual inputObservationIds lineage", async () => {
    // Only Ahri observation is in inputObservationIds; Draven is NOT in inputObservationIds
    const verified = await verifiedWebsiteSnapshot(sampleSnapshot, {
      mode: "archive",
      referenceTime: "2026-09-01T12:00:00.000Z"
    });

    // Even though mockObsDraven is valid, it was not an input to this snapshot!
    expect(verified.rows).toHaveLength(1);
    expect(verified.rows[0].archetypeId).toBe("arch_ahri_carry");
    expect(verified.totals.totalArchetypes).toBe(1);
    expect(verified.totals.rankedTierS).toBe(1);
    expect(verified.totals.rankedTierA).toBe(0);
  });

  it("FIN-02: separates current mode (real-time clock) from archive mode (snapshot clock)", async () => {
    // In current mode, comparing 2026-09 observations against current real-time clock (which is >> 48h later)
    // should mark them stale and return 0 rows.
    const currentVerified = await verifiedWebsiteSnapshot(sampleSnapshot, {
      mode: "current",
      maxAgeHours: 48
    });
    expect(currentVerified.rows).toHaveLength(0);
    expect(currentVerified.status).toBe("collecting");

    // In archive mode with explicit snapshot reference time, observations are fresh within 48h of snapshot!
    const archiveVerified = await verifiedWebsiteSnapshot(sampleSnapshot, {
      mode: "archive",
      referenceTime: "2026-09-01T12:00:00.000Z",
      maxAgeHours: 48
    });
    expect(archiveVerified.rows).toHaveLength(1);
    expect(archiveVerified.rows[0].archetypeId).toBe("arch_ahri_carry");
  });

  it("REV-02: verifies alignment of 72h maxAgeHours policy across SSR and API and historical snapshot of current patch", async () => {
    // An observation that is 55 hours old at reference time:
    // With 48h it would fail, but with unified 72h policy (48h warning, 72h drop limit) it passes.
    const obsTime55h = new Date(new Date("2026-09-01T12:00:00.000Z").getTime() - 55 * 3600 * 1000).toISOString();
    const mockObs55h: SourceCompObservation = {
      ...mockObsAhri,
      sourceDataAsOf: obsTime55h,
      observedAt: obsTime55h
    };
    vi.mocked(metaRepository.getLatestSourceObservations).mockResolvedValue([mockObs55h]);

    // Both SSR and API use maxAgeHours: 72
    const ssrResult = await verifiedWebsiteSnapshot(sampleSnapshot, {
      mode: "archive",
      referenceTime: "2026-09-01T12:00:00.000Z",
      maxAgeHours: 72
    });
    const apiResult = await verifiedWebsiteSnapshot(sampleSnapshot, {
      mode: "archive",
      referenceTime: "2026-09-01T12:00:00.000Z",
      maxAgeHours: 72
    });

    expect(ssrResult.rows).toHaveLength(1);
    expect(apiResult.rows).toHaveLength(1);
    expect(ssrResult.rows[0].archetypeId).toBe(apiResult.rows[0].archetypeId);

    // If historical snapshot of current patch is requested (mode: archive with snapshot clock)
    const historicalCurrentPatchResult = await verifiedWebsiteSnapshot(sampleSnapshot, {
      mode: "archive",
      referenceTime: sampleSnapshot.sourceDataAsOf || undefined,
      maxAgeHours: 72
    });
    expect(historicalCurrentPatchResult.rows).toHaveLength(1);
    expect(historicalCurrentPatchResult.status).toBe("ranked");
  });

  it("REV-05: rejects rows when selectedSourceBuildId or recommendedBoard is tampered", async () => {
    // Setup an observation with an explicit build and allowed units
    const mockObsWithBuild: SourceCompObservation = {
      ...mockObsAhri,
      builds: [
        {
          id: "build_ahri_source_1",
          observationId: "obs_academy_ahri",
          boardKind: "primary",
          boardCompleteness: "exact",
          units: [
            { sourceChampionKey: "tft18_ahri", championId: "tft18_ahri", starLevel: 2, position: { row: 3, col: 0 }, items: [] },
            { sourceChampionKey: "tft18_taric", championId: "tft18_taric", starLevel: 2, position: { row: 0, col: 1 }, items: [] }
          ]
        } as any
      ]
    };
    vi.mocked(metaRepository.getLatestSourceObservations).mockResolvedValue([mockObsWithBuild]);

    // Positive case: exact build and legitimate units
    const legitSnapshot: RankingSnapshot = {
      ...sampleSnapshot,
      rows: [
        {
          ...sampleSnapshot.rows[0],
          selectedSourceBuildId: "build_ahri_source_1",
          recommendedBoard: [
            { championId: "tft18_ahri", nameVi: "Ahri", cost: 4, star: 2, row: 3, col: 0, items: [] },
            { championId: "tft18_taric", nameVi: "Taric", cost: 4, star: 2, row: 0, col: 1, items: [] }
          ]
        } as any
      ]
    };

    const legitResult = await verifiedWebsiteSnapshot(legitSnapshot, {
      mode: "archive",
      referenceTime: "2026-09-01T12:00:00.000Z"
    });
    expect(legitResult.rows).toHaveLength(1);

    // Negative case 1: Tampered selectedSourceBuildId (fake build not in source obs)
    const tamperedBuildSnap: RankingSnapshot = {
      ...sampleSnapshot,
      rows: [
        {
          ...sampleSnapshot.rows[0],
          selectedSourceBuildId: "fake_tampered_build_999",
          recommendedBoard: []
        } as any
      ]
    };
    const tamperedBuildResult = await verifiedWebsiteSnapshot(tamperedBuildSnap, {
      mode: "archive",
      referenceTime: "2026-09-01T12:00:00.000Z"
    });
    expect(tamperedBuildResult.rows).toHaveLength(0);

    // Negative case 2: Tampered recommendedBoard (contains unauthorized champion not in source build)
    const tamperedBoardSnap: RankingSnapshot = {
      ...sampleSnapshot,
      rows: [
        {
          ...sampleSnapshot.rows[0],
          selectedSourceBuildId: "build_ahri_source_1",
          recommendedBoard: [
            { championId: "tft18_ahri", nameVi: "Ahri", cost: 4, star: 2, row: 3, col: 0, items: [] },
            { championId: "fake_intruder_champion", nameVi: "Tướng giả mạo", cost: 5, star: 3, row: 0, col: 0, items: [] }
          ]
        } as any
      ]
    };
    const tamperedBoardResult = await verifiedWebsiteSnapshot(tamperedBoardSnap, {
      mode: "archive",
      referenceTime: "2026-09-01T12:00:00.000Z"
    });
    expect(tamperedBoardResult.rows).toHaveLength(0);
  });

  describe("Board data binding regressions", () => {
    const probeBoard = [
      { championId: "ahri", star: 2, row: 3, col: 0, items: ["item_a"] },
      { championId: "taric", star: 2, row: 0, col: 0, items: ["item_b"] }
    ];
    const probeBuild = {
      id: "build_a",
      units: probeBoard.map((u) => ({
        championId: u.championId,
        sourceChampionKey: u.championId,
        starLevel: u.star,
        position: { row: u.row, col: u.col },
        items: u.items
      }))
    };

    async function runProbe(units: any[], builds: any[] = [probeBuild], selected = "build_a") {
      vi.mocked(metaRepository.getLatestSourceObservations).mockResolvedValue([
        { id: "obs_a", archetypeId: "arch_a", builds, observedAt: "2026-09-01T10:00:00.000Z" }
      ] as any);
      return verifiedWebsiteSnapshot({
        datasetKind: "real",
        publicationStatus: "published",
        rankingScope: { patchEpochId: "epoch_18_2" },
        inputObservationIds: ["obs_a"],
        warnings: [],
        totals: {},
        rows: [
          {
            archetypeId: "arch_a",
            tier: "S",
            selectedSourceBuildId: selected,
            recommendedBoard: units
          }
        ]
      } as any, {
        mode: "archive",
        referenceTime: "2026-09-01T12:00:00.000Z"
      });
    }

    it("control: unchanged source board passes", async () => {
      const res = await runProbe(probeBoard);
      expect(res.rows).toHaveLength(1);
    });

    it("rejects swapped item owners", async () => {
      const res = await runProbe([
        { ...probeBoard[0], items: ["item_b"] },
        { ...probeBoard[1], items: ["item_a"] }
      ]);
      expect(res.rows).toHaveLength(0);
    });

    it("rejects invented coordinates", async () => {
      const res = await runProbe([
        { ...probeBoard[0], row: 0, col: 6 },
        probeBoard[1]
      ]);
      expect(res.rows).toHaveLength(0);
    });

    it("rejects missing source unit", async () => {
      const res = await runProbe([probeBoard[0]]);
      expect(res.rows).toHaveLength(0);
    });

    it("rejects claimed board/build when source has no builds", async () => {
      const res = await runProbe(probeBoard, [], "invented_build");
      expect(res.rows).toHaveLength(0);
    });

    it("rejects mixing units from a different source build", async () => {
      const res = await runProbe(
        [probeBoard[0], { championId: "lux", star: 2, row: 0, col: 1, items: [] }],
        [probeBuild, { id: "build_b", units: [{ championId: "lux", items: [] }] }]
      );
      expect(res.rows).toHaveLength(0);
    });
  });

  describe("R6-01: Source build completeness preservation in verified snapshot", () => {
    async function testCompleteness(completeness: "exact" | "partial" | "conditional") {
      const prov = {
        sourceId: "tftacademy",
        observationId: "obs_c1",
        buildId: "build_c1",
        sourceUrl: "https://example.com/guide",
        rawArtifactId: "raw_c1",
        rawLocator: null,
        sourceLocator: null,
        boardCompleteness: completeness
      };
      const unit = { championId: "ahri", tier: 2, position: { row: 3, col: 0 }, items: ["item_a"], boardProvenance: prov };
      const build = {
        id: "build_c1",
        observationId: "obs_c1",
        boardKind: "primary",
        boardCompleteness: completeness,
        label: "Source guide",
        units: [{ championId: "ahri", sourceChampionKey: "ahri", starLevel: 2, position: { row: 3, col: 0 }, items: ["item_a"] }]
      };
      vi.mocked(metaRepository.getLatestSourceObservations).mockResolvedValue([
        {
          id: "obs_c1",
          archetypeId: "arch_c1",
          sourceId: "tftacademy",
          sourceUrl: prov.sourceUrl,
          rawArtifactId: "raw_c1",
          sourceDataAsOf: "2026-09-01T09:00:00.000Z",
          observedAt: "2026-09-01T09:00:00.000Z",
          builds: [build]
        }
      ] as any);
      return verifiedWebsiteSnapshot(
        {
          datasetKind: "real",
          publicationStatus: "published",
          rankingScope: { patchEpochId: "epoch_18_2" },
          generatedAt: "2026-09-01T12:00:00.000Z",
          sourceDataAsOf: "2026-09-01T10:00:00.000Z",
          inputObservationIds: ["obs_c1"],
          warnings: [],
          totals: {},
          rows: [{ archetypeId: "arch_c1", tier: "S", selectedSourceBuildId: "build_c1", recommendedBoard: [unit] }]
        } as any,
        {
          mode: "archive",
          referenceTime: "2026-09-01T10:00:00.000Z",
          maxAgeHours: 72
        }
      );
    }

    for (const c of ["exact", "partial", "conditional"] as const) {
      it(`preserves source completeness '${c}' without upgrading to exact`, async () => {
        const result = await testCompleteness(c);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].recommendedBoard[0].boardProvenance?.boardCompleteness).toBe(c);
      });
    }
  });
});
