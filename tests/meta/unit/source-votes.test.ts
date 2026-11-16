import { describe, it, expect } from "vitest";
import {
  normalizeSourceObservation,
  calculateWebsiteConsensus,
  SOURCE_TIER_POINTS
} from "../../../src/domain/meta/source-votes";
import { SourceCompObservation } from "../../../src/domain/meta/schemas";
import { calculatePerformanceScore, NEUTRAL_BASELINE } from "../../../src/domain/meta/performance-score";

function makeObservation(
  sourceId: any,
  originalTier: string | null,
  metrics: any = {},
  conditions: string[] = []
): SourceCompObservation {
  return {
    id: `obs_${sourceId}_test`,
    datasetKind: "demo",
    sourceId,
    sourceCompId: `comp_${sourceId}`,
    sourceUrl: `https://${sourceId}.com/comp`,
    rawArtifactId: "art_test",
    observedAt: new Date().toISOString(),
    sourceUpdatedAt: new Date().toISOString(),
    scope: {
      gameProduct: "tft",
      setNumber: 18,
      channel: "live",
      mode: "ranked_standard",
      patchEpochId: "epoch_18_2",
      sourcePatchLabel: "18.2",
      rankScope: "Master+",
      regions: ["Global"],
      windowStart: null,
      windowEnd: null
    },
    archetypeId: "comp_draven_reroll",
    variantId: "default",
    originalName: "Draven Reroll",
    originalTier,
    classificationKind: "editorial",
    metrics: {
      averagePlacement: metrics.avgPlacement ?? null,
      top4Rate: metrics.top4Rate ?? null,
      winRate: metrics.winRate ?? null,
      sampleCount: metrics.sampleCount ?? null,
      sampleCountQuality: "exact",
      pickRateRaw: null,
      pickRateUnit: "per_lobby"
    },
    conditions,
    evidenceRefIds: [],
    parserVersion: "1.0.0",
    mappingVersion: "1.0.0"
  };
}

describe("Milestone M3 - Section A: Website Consensus & Votes", () => {
  it("U01: Ba nguồn S / S / A cho điểm 85 và tier S khi đủ 3 nhóm nguồn hợp lệ", () => {
    const obs = [
      makeObservation("metatft", "S"), // 90
      makeObservation("tftacademy", "S"), // 90
      makeObservation("tftflex", "A") // 75
    ];

    const result = calculateWebsiteConsensus(obs);
    // (90 + 90 + 75) / 3 = 255 / 3 = 85.0
    expect(result.score).toBe(85);
    expect(result.tier).toBe("S");
    expect(result.candidateTier).toBe("S");
    expect(result.status).toBe("ranked");
    expect(result.consensusLabel).toBe("Đồng thuận cao"); // spread = 90 - 75 = 15 <= 25
  });

  it("U02: Ba nguồn S / A / B cho điểm 75 và tier A", () => {
    const obs = [
      makeObservation("metatft", "S"), // 90
      makeObservation("tftacademy", "A"), // 75
      makeObservation("tftflex", "B") // 60
    ];

    const result = calculateWebsiteConsensus(obs);
    // (90 + 75 + 60) / 3 = 225 / 3 = 75.0
    expect(result.score).toBe(75);
    expect(result.tier).toBe("A");
    expect(result.candidateTier).toBe("A");
    expect(result.status).toBe("ranked");
  });

  it("U03: Một nguồn S và 4 nguồn vắng không thêm phiếu 0; tier chưa công bố", () => {
    const obs = [makeObservation("metatft", "S")];

    const result = calculateWebsiteConsensus(obs);
    expect(result.score).toBe(90);
    // Chỉ có 1 nhóm nguồn -> không được cấp tier chính thức, không thêm phiếu 0
    expect(result.tier).toBeNull();
    expect(result.candidateTier).toBe("S");
    expect(result.status).toBe("collecting");
  });

  it("U04: Hai nguồn cùng provenance group chỉ tính một phiếu đại diện", () => {
    const obs = [
      makeObservation("metatft", "S"), // 90, metatft_group
      makeObservation("tftflex", "A") // 75, mapping thử vào metatft_group
    ];

    const provMap: any = {
      metatft: "shared_mirror_group",
      tftflex: "shared_mirror_group"
    };

    const result = calculateWebsiteConsensus(obs, provMap);
    // Chỉ lấy 1 vote đại diện từ group trùng lặp
    expect(result.validGroupCount).toBe(1);
    expect(result.tier).toBeNull(); // Chỉ 1 group -> collecting
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("U06: Situational không bị ép thành tier C hoặc D", () => {
    const obs = makeObservation("tftacademy", "Situational");
    const vote = normalizeSourceObservation(obs);

    expect(vote.voteScore).toBeNull();
    expect(vote.originalTier).toBe("Situational");
    expect(vote.reason).toContain("không đổi thành điểm số");
  });

  it("Tạo phiếu thống kê tự động cho trang chỉ có số liệu khi mẫu >= 200", () => {
    const obsStat = makeObservation("tactics_tools", null, {
      top4Rate: 0.65,
      avgPlacement: 3.8,
      winRate: 0.2,
      sampleCount: 500
    });

    const vote = normalizeSourceObservation(obsStat);
    expect(vote.isStatistical).toBe(true);
    // Tính từ baseline trung tính: score = 74.0375
    expect(vote.voteScore).toBe(74.0375);
  });

  it("Cỡ mẫu thống kê dưới 200 không tạo phiếu số", () => {
    const obsUnder200 = makeObservation("tactics_tools", null, {
      top4Rate: 0.65,
      avgPlacement: 3.8,
      winRate: 0.2,
      sampleCount: 150 // Dưới 200
    });

    const vote = normalizeSourceObservation(obsUnder200);
    expect(vote.voteScore).toBeNull();
    expect(vote.reason).toContain("chưa đạt ngưỡng tối thiểu 200 trận");
  });

  it("Độ chênh lệch lớn giữa các nguồn (spread >= 30) gán nhãn 'Các nguồn khác nhau'", () => {
    const obs = [
      makeObservation("metatft", "S+"), // 95
      makeObservation("tftacademy", "A"), // 75
      makeObservation("tftflex", "C") // 40
    ];

    const result = calculateWebsiteConsensus(obs);
    // spread = 95 - 40 = 55 >= 30
    expect(result.consensusLabel).toBe("Các nguồn khác nhau");
  });
});
