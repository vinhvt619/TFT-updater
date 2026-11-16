import { WeightCalculationResult } from "./elite-weights";
import { BaselineMetrics, calculatePerformanceScore, scoreToCandidateTier } from "./performance-score";
import { Tier, RankingStatus } from "./schemas";

export interface EliteCompCalculationResult {
  rawTop4Rate: number;
  rawWinRate: number;
  rawAveragePlacement: number;
  adjustedTop4Rate: number;
  adjustedWinRate: number;
  adjustedAveragePlacement: number;
  score: number;
  tier: Tier | null;
  candidateTier: Tier | null;
  status: RankingStatus;
  gateChecks: {
    hasMinAppearances: boolean; // >= 60
    hasMinMatches: boolean; // >= 40
    hasMinAccounts: boolean; // >= 10
    hasMinNEffective: boolean; // >= 40
    hasMinWeightMass: boolean; // >= 20
    meetsAllStandardGates: boolean;
    meetsSGates: boolean; // >= 120 apps, 60 matches, 15 accs, 60 nEff
  };
  reasonCodes: string[];
}

/**
 * Áp dụng Thu hẹp Bayes (Empirical Bayes Shrinkage) với prior m=20
 * và kiểm tra điều kiện chất lượng (Quality Gates) theo Mục 6.4 và 6.5
 */
export function evaluateEliteCompEligibility(
  weights: WeightCalculationResult,
  baseline: BaselineMetrics,
  shrinkagePriorMass: number = 20
): EliteCompCalculationResult {
  const { appearances, totalAppearances, uniqueMatches, uniqueAccounts, weightMass, nEffective } =
    weights;

  // 1. Tính tổng có trọng số cho các biến
  let sumWeightedTop4 = 0;
  let sumWeightedWin = 0;
  let sumWeightedPlacement = 0;

  for (const app of appearances) {
    if (app.isTop4) sumWeightedTop4 += app.weight;
    if (app.isWin) sumWeightedWin += app.weight;
    sumWeightedPlacement += app.weight * app.placement;
  }

  // 2. Co số liệu về baseline khu vực với trọng lượng prior m=20
  const m = shrinkagePriorMass;
  const denominator = weightMass + m;

  const adjustedTop4Rate = (sumWeightedTop4 + m * baseline.top4Rate) / denominator;
  const adjustedWinRate = (sumWeightedWin + m * baseline.winRate) / denominator;
  const adjustedAveragePlacement =
    (sumWeightedPlacement + m * baseline.avgPlacement) / denominator;

  // 3. Tính điểm hiệu suất từ các chỉ số đã điều chỉnh (Mục 6.2)
  const { score } = calculatePerformanceScore(
    {
      top4Rate: adjustedTop4Rate,
      avgPlacement: adjustedAveragePlacement,
      winRate: adjustedWinRate
    },
    baseline
  );

  const candidateTier = scoreToCandidateTier(score);

  // 4. Kiểm tra Quality Gates Mục 6.5
  const hasMinAppearances = totalAppearances >= 60;
  const hasMinMatches = uniqueMatches >= 40;
  const hasMinAccounts = uniqueAccounts >= 10;
  const hasMinNEffective = nEffective >= 40;
  const hasMinWeightMass = weightMass >= 20;

  const meetsAllStandardGates =
    hasMinAppearances &&
    hasMinMatches &&
    hasMinAccounts &&
    hasMinNEffective &&
    hasMinWeightMass;

  const meetsSGates =
    totalAppearances >= 120 &&
    uniqueMatches >= 60 &&
    uniqueAccounts >= 15 &&
    nEffective >= 60;

  const reasonCodes: string[] = [];

  if (!hasMinAppearances) reasonCodes.push(`Thiếu số lượt chơi (${totalAppearances}/60)`);
  if (!hasMinMatches) reasonCodes.push(`Thiếu số trận riêng biệt (${uniqueMatches}/40)`);
  if (!hasMinAccounts) reasonCodes.push(`Thiếu số tài khoản khác nhau (${uniqueAccounts}/10)`);
  if (!hasMinNEffective) reasonCodes.push(`Cỡ mẫu hiệu dụng chưa đủ (${nEffective}/40)`);
  if (!hasMinWeightMass) reasonCodes.push(`Khối lượng trọng số chưa đủ (${weightMass}/20)`);

  // 5. Xác định Tier chính thức và Status
  let tier: Tier | null = null;
  let status: RankingStatus = "collecting";

  if (meetsAllStandardGates) {
    if (candidateTier === "S") {
      if (meetsSGates) {
        tier = "S";
        status = "ranked";
      } else {
        // Đạt điểm S nhưng chưa đủ gate cỡ mẫu cho S -> giữ candidate S ở giải thích, tạm chưa cấp tier S
        tier = "A"; // Hạ xuống tier A công bố hoặc để provisional
        status = "provisional";
        reasonCodes.push(
          `Đạt điểm Tier S (${score}) nhưng chưa đủ cỡ mẫu cho S (cần 120 lượt / 60 trận / 15 tài khoản / 60 nEff)`
        );
      }
    } else {
      tier = candidateTier;
      status = "ranked";
    }
  } else {
    // QUY TẮC CỐT LÕI: Chưa đạt mẫu -> tier = null, TUYỆT ĐỐI KHÔNG ÉP XUỐNG C!
    tier = null;
    status = totalAppearances >= 20 ? "provisional" : "collecting";
    reasonCodes.push(
      "Chưa đủ điều kiện chất lượng mẫu (Quality Gates), giữ trạng thái thu thập/tạm thời thay vì xếp hạng C"
    );
  }

  return {
    rawTop4Rate: weights.rawTop4Rate,
    rawWinRate: weights.rawWinRate,
    rawAveragePlacement: weights.rawAveragePlacement,
    adjustedTop4Rate: Math.round(adjustedTop4Rate * 10000) / 10000,
    adjustedWinRate: Math.round(adjustedWinRate * 10000) / 10000,
    adjustedAveragePlacement: Math.round(adjustedAveragePlacement * 100) / 100,
    score,
    tier,
    candidateTier,
    status,
    gateChecks: {
      hasMinAppearances,
      hasMinMatches,
      hasMinAccounts,
      hasMinNEffective,
      hasMinWeightMass,
      meetsAllStandardGates,
      meetsSGates
    },
    reasonCodes
  };
}
