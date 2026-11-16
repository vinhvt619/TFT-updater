import { describe, it, expect } from "vitest";
import {
  calculatePerformanceScore,
  NEUTRAL_BASELINE
} from "../../../src/domain/meta/performance-score";
import {
  calculateEliteWeights,
  MatchAppearance
} from "../../../src/domain/meta/elite-weights";
import { evaluateEliteCompEligibility } from "../../../src/domain/meta/eligibility";
import { calculateGlobalMacroRanking } from "../../../src/domain/meta/global-ranking";
import { RegionalRankMetrics } from "../../../src/domain/meta/schemas";

describe("Milestone M3 - Section B: Elite Performance, Weights & Shrinkage", () => {
  it("U08: Kiểm tra độ chính xác số học của performanceScore", () => {
    // 1. Mức nền trung tính phải cho đúng 50.0
    const neutral = calculatePerformanceScore(
      { top4Rate: 0.5, avgPlacement: 4.5, winRate: 0.125 },
      NEUTRAL_BASELINE
    );
    expect(neutral.score).toBe(50.0);

    // 2. Ví dụ A theo Plan: Top4 65%, Avg 3.80, Win 20% -> 74.0375
    const exA = calculatePerformanceScore(
      { top4Rate: 0.65, avgPlacement: 3.8, winRate: 0.2 },
      NEUTRAL_BASELINE
    );
    expect(exA.score).toBe(74.0375);

    // 3. Ví dụ C theo Plan: Top4 40%, Avg 4.80, Win 10% -> 36.2875
    const exC = calculatePerformanceScore(
      { top4Rate: 0.4, avgPlacement: 4.8, winRate: 0.1 },
      NEUTRAL_BASELINE
    );
    expect(exC.score).toBe(36.2875);
  });

  it("U09: 20 Top 4 trong 50 lượt cho tỷ lệ Top 4 thô là 40% (0.40)", () => {
    const appearances: MatchAppearance[] = [];
    const now = new Date();

    for (let i = 0; i < 50; i++) {
      const isTop4 = i < 20; // 20 lượt top 4, 30 lượt ngoài top 4
      appearances.push({
        matchKey: `match_${i}`,
        accountKey: `acc_${i % 15}`, // 15 tài khoản
        endedAt: now.toISOString(),
        placement: isTop4 ? 3 : 6,
        isTop4,
        isWin: i < 5
      });
    }

    const weights = calculateEliteWeights(appearances, now);
    expect(weights.totalAppearances).toBe(50);
    expect(weights.top4Count).toBe(20);
    expect(weights.rawTop4Rate).toBe(0.4); // 40%
  });

  it("U10: 3 tài khoản cùng trong 1 trận tính là 1 uniqueMatch và 3 appearances", () => {
    const now = new Date();
    const appearances: MatchAppearance[] = [
      { matchKey: "match_shared", accountKey: "acc_1", endedAt: now.toISOString(), placement: 1, isTop4: true, isWin: true },
      { matchKey: "match_shared", accountKey: "acc_2", endedAt: now.toISOString(), placement: 3, isTop4: true, isWin: false },
      { matchKey: "match_shared", accountKey: "acc_3", endedAt: now.toISOString(), placement: 7, isTop4: false, isWin: false }
    ];

    const weights = calculateEliteWeights(appearances, now);
    expect(weights.totalAppearances).toBe(3);
    expect(weights.uniqueMatches).toBe(1);
    expect(weights.uniqueAccounts).toBe(3);
  });

  it("U11: Một tài khoản chơi quá nhiều trận bị chặn trần đóng góp tối đa 5 đơn vị", () => {
    const now = new Date();
    const appearances: MatchAppearance[] = [];

    // Tài khoản spammer chơi 20 trận cùng đội hình trong 1 giờ qua
    for (let i = 0; i < 20; i++) {
      appearances.push({
        matchKey: `match_spammer_${i}`,
        accountKey: "acc_spammer",
        endedAt: now.toISOString(),
        placement: 1,
        isTop4: true,
        isWin: true
      });
    }

    const weights = calculateEliteWeights(appearances, now, 48, 5);
    // Tổng khối lượng trọng số của tài khoản này không được vượt quá 5.0
    expect(weights.weightMass).toBeLessThanOrEqual(5.001);
  });

  it("U12: Ba trận Top 1 liên tiếp không đủ Quality Gates để lên Tier S (chưa đủ 60 lượt)", () => {
    const now = new Date();
    const appearances: MatchAppearance[] = [
      { matchKey: "m1", accountKey: "a1", endedAt: now.toISOString(), placement: 1, isTop4: true, isWin: true },
      { matchKey: "m2", accountKey: "a2", endedAt: now.toISOString(), placement: 1, isTop4: true, isWin: true },
      { matchKey: "m3", accountKey: "a3", endedAt: now.toISOString(), placement: 1, isTop4: true, isWin: true }
    ];

    const weights = calculateEliteWeights(appearances, now);
    const eligibility = evaluateEliteCompEligibility(weights, NEUTRAL_BASELINE, 20);

    // Mẫu quá ít (3 lượt) -> tier phải là null, status = collecting, KHÔNG ép xuống C
    expect(eligibility.tier).toBeNull();
    expect(eligibility.status).toBe("collecting");
    expect(eligibility.gateChecks.hasMinAppearances).toBe(false);
  });

  it("Thu hẹp Bayes (Shrinkage) co điểm về baseline khi số lượng trận ít", () => {
    const now = new Date();
    const appearances: MatchAppearance[] = [
      { matchKey: "m1", accountKey: "a1", endedAt: now.toISOString(), placement: 1, isTop4: true, isWin: true }
    ];

    const weights = calculateEliteWeights(appearances, now);
    const eligibility = evaluateEliteCompEligibility(weights, NEUTRAL_BASELINE, 20);

    // Dù trận duy nhất là Top 1 (100% win, 100% top 4), qua prior m=20 thì adjustedTop4 bị co về gần 0.50
    // (1 * 1.0 + 20 * 0.50) / (1 + 20) = 11 / 21 ≈ 0.5238
    expect(eligibility.adjustedTop4Rate).toBeLessThan(0.60);
    expect(eligibility.adjustedTop4Rate).toBeGreaterThan(0.50);
  });

  it("U13: Tổng hợp nhiều khu vực dùng Macro-Average đều giữa các vùng", () => {
    const regionalMetrics: Record<string, RegionalRankMetrics> = {
      KR: {
        region: "KR",
        appearances: 500, // Rất nhiều trận
        uniqueMatches: 300,
        uniqueAccounts: 45,
        top4Count: 350,
        winCount: 120,
        weightMass: 250,
        nEffective: 180,
        rawTop4Rate: 0.70,
        rawWinRate: 0.24,
        rawAveragePlacement: 3.5,
        adjustedTop4Rate: 0.68,
        adjustedWinRate: 0.22,
        adjustedAveragePlacement: 3.6,
        regionalScore: 84.0, // Tier S
        isPriorOnly: false,
        status: "ranked"
      },
      VN: {
        region: "VN",
        appearances: 80, // Số trận vừa phải
        uniqueMatches: 50,
        uniqueAccounts: 18,
        top4Count: 48,
        winCount: 12,
        weightMass: 50,
        nEffective: 42,
        rawTop4Rate: 0.60,
        rawWinRate: 0.15,
        rawAveragePlacement: 4.1,
        adjustedTop4Rate: 0.58,
        adjustedWinRate: 0.14,
        adjustedAveragePlacement: 4.2,
        regionalScore: 66.0, // Tier A
        isPriorOnly: false,
        status: "ranked"
      }
    };

    const globalResult = calculateGlobalMacroRanking(
      regionalMetrics,
      ["KR", "VN"],
      ["KR", "VN"]
    );

    // Macro-average: (84.0 + 66.0) / 2 = 75.0 (Tier A), KR không áp đảo điểm số của VN
    expect(globalResult.score).toBe(75.0);
    expect(globalResult.tier).toBe("A");
    expect(globalResult.candidateTier).toBe("A");
  });

  it("U14: Vùng chưa có lượt nào quan sát đóng góp prior 50 có nhãn isPriorOnly", () => {
    const regionalMetrics: Record<string, RegionalRankMetrics> = {
      KR: {
        region: "KR",
        appearances: 150,
        uniqueMatches: 90,
        uniqueAccounts: 30,
        top4Count: 105,
        winCount: 35,
        weightMass: 80,
        nEffective: 65,
        rawTop4Rate: 0.70,
        rawWinRate: 0.23,
        rawAveragePlacement: 3.6,
        adjustedTop4Rate: 0.67,
        adjustedWinRate: 0.21,
        adjustedAveragePlacement: 3.7,
        regionalScore: 82.0,
        isPriorOnly: false,
        status: "ranked"
      },
      VN: {
        region: "VN",
        appearances: 0, // Chưa quan sát được lượt nào
        uniqueMatches: 0,
        uniqueAccounts: 0,
        top4Count: 0,
        winCount: 0,
        weightMass: 0,
        nEffective: 0,
        rawTop4Rate: null,
        rawWinRate: null,
        rawAveragePlacement: null,
        adjustedTop4Rate: null,
        adjustedWinRate: null,
        adjustedAveragePlacement: null,
        regionalScore: null,
        isPriorOnly: true,
        status: "collecting"
      }
    };

    const globalResult = calculateGlobalMacroRanking(
      regionalMetrics,
      ["KR", "VN"],
      ["KR", "VN"]
    );

    // VN đóng góp prior 50.0
    // Macro-average: (82.0 + 50.0) / 2 = 66.0
    expect(globalResult.score).toBe(66.0);
    expect(globalResult.regionalContributions["VN"].isPriorOnly).toBe(true);
    expect(globalResult.regionalContributions["VN"].score).toBe(50.0);
  });
});
