import { RegionalRankMetrics, Tier, RankingStatus } from "./schemas";
import { scoreToCandidateTier } from "./performance-score";

export interface GlobalCompRankingResult {
  score: number | null;
  tier: Tier | null;
  candidateTier: Tier | null;
  status: RankingStatus;
  effectiveRegions: string[];
  regionalContributions: Record<string, { score: number; isPriorOnly: boolean }>;
  totalAppearances: number;
  totalUniqueMatches: number;
  totalUniqueAccounts: number;
  globalRawTop4Rate: number | null;
  globalRawWinRate: number | null;
  globalRawAveragePlacement: number | null;
  reasons: string[];
}

/**
 * Tổng hợp điểm số nhiều khu vực bằng phương pháp Macro-Average theo Mục 6.6 của Plan
 * globalScore = sum(regionalScore_r) / |R|
 * Mỗi khu vực hợp lệ có trọng số như nhau, tránh việc khu vực có nhiều trận nhất áp đảo toàn bộ điểm số.
 */
export function calculateGlobalMacroRanking(
  regionalMetrics: Record<string, RegionalRankMetrics>,
  requestedRegions: string[] = ["KR", "VN", "NA", "EUW"],
  validCohortRegions: string[] = ["KR", "VN", "NA", "EUW"]
): GlobalCompRankingResult {
  const effectiveRegions = validCohortRegions.filter((r) => requestedRegions.includes(r));
  const reasons: string[] = [];

  // Phải có ít nhất 2 khu vực hợp lệ để công bố bảng tổng hợp
  if (effectiveRegions.length < 2) {
    return {
      score: null,
      tier: null,
      candidateTier: null,
      status: "unavailable",
      effectiveRegions,
      regionalContributions: {},
      totalAppearances: 0,
      totalUniqueMatches: 0,
      totalUniqueAccounts: 0,
      globalRawTop4Rate: null,
      globalRawWinRate: null,
      globalRawAveragePlacement: null,
      reasons: ["Cần ít nhất 2 khu vực có dữ liệu hợp lệ để tạo bảng tổng hợp"]
    };
  }

  let sumScores = 0;
  let observedRegionsCount = 0;
  const regionalContributions: Record<string, { score: number; isPriorOnly: boolean }> = {};

  let totalAppearances = 0;
  let totalMatches = 0;
  let totalAccounts = 0;
  let totalTop4 = 0;
  let totalWins = 0;
  let totalWeightedPlacement = 0;

  const sOrATierRegions: string[] = [];

  for (const region of effectiveRegions) {
    const rm = regionalMetrics[region];
    if (rm && rm.appearances > 0 && rm.regionalScore !== null) {
      sumScores += rm.regionalScore;
      observedRegionsCount++;
      regionalContributions[region] = {
        score: rm.regionalScore,
        isPriorOnly: false
      };

      totalAppearances += rm.appearances;
      totalMatches += rm.uniqueMatches;
      totalAccounts += rm.uniqueAccounts;
      totalTop4 += rm.top4Count;
      totalWins += rm.winCount;
      if (rm.rawAveragePlacement !== null) {
        totalWeightedPlacement += rm.rawAveragePlacement * rm.appearances;
      }

      // Kiểm tra vùng có tier S hoặc A
      const regionalCandidate = scoreToCandidateTier(rm.regionalScore);
      if (regionalCandidate === "S" || regionalCandidate === "A") {
        sOrATierRegions.push(region);
      }
    } else {
      // Vùng chưa quan sát nhưng ingestion đầy đủ: đóng góp mức prior trung tính 50 có nhãn
      const priorScore = 50.0;
      sumScores += priorScore;
      regionalContributions[region] = {
        score: priorScore,
        isPriorOnly: true
      };
    }
  }

  const globalScore = Math.round((sumScores / effectiveRegions.length) * 10000) / 10000;
  const candidateTier = scoreToCandidateTier(globalScore);

  const globalRawTop4Rate =
    totalAppearances > 0 ? Math.round((totalTop4 / totalAppearances) * 10000) / 10000 : null;
  const globalRawWinRate =
    totalAppearances > 0 ? Math.round((totalWins / totalAppearances) * 10000) / 10000 : null;
  const globalRawAveragePlacement =
    totalAppearances > 0
      ? Math.round((totalWeightedPlacement / totalAppearances) * 100) / 100
      : null;

  // Điều kiện chất lượng tổng hợp (Mục 6.6):
  // - Ít nhất 2 khu vực có bằng chứng với nEffective >= 10, >= 5 tài khoản mỗi khu vực
  // - Tổng đạt ngưỡng: >= 60 lượt, >= 40 trận, >= 10 tài khoản
  const hasMinTwoRegionsWithEvidence = observedRegionsCount >= 2;
  const meetsTotalVolume =
    totalAppearances >= 60 && totalMatches >= 40 && totalAccounts >= 10;

  let tier: Tier | null = null;
  let status: RankingStatus = "collecting";

  if (hasMinTwoRegionsWithEvidence && meetsTotalVolume) {
    if (candidateTier === "S") {
      // Candidate S tổng hợp cần ít nhất min(3, |R|) khu vực có tier S hoặc A và đạt ngưỡng mẫu S
      const requiredSRegions = Math.min(3, effectiveRegions.length);
      const meetsMultiRegionS =
        sOrATierRegions.length >= requiredSRegions &&
        totalAppearances >= 120 &&
        totalMatches >= 60 &&
        totalAccounts >= 15;

      if (meetsMultiRegionS) {
        tier = "S";
        status = "ranked";
      } else {
        tier = "A";
        status = "provisional";
        reasons.push(
          `Đạt điểm S (${globalScore}) nhưng cần ít nhất ${requiredSRegions} khu vực đạt tier S/A (hiện có ${sOrATierRegions.length}: ${sOrATierRegions.join(", ")})`
        );
      }
    } else {
      tier = candidateTier;
      status = "ranked";
    }
  } else {
    tier = null;
    status = totalAppearances >= 20 ? "provisional" : "collecting";
    reasons.push(
      `Chưa đủ điều kiện tổng hợp đa khu vực (yêu cầu ít nhất 2 khu vực có dữ liệu và >= 60 lượt chơi; hiện có ${observedRegionsCount} vùng, ${totalAppearances} lượt)`
    );
  }

  return {
    score: globalScore,
    tier,
    candidateTier,
    status,
    effectiveRegions,
    regionalContributions,
    totalAppearances,
    totalUniqueMatches: totalMatches,
    totalUniqueAccounts: totalAccounts,
    globalRawTop4Rate,
    globalRawWinRate,
    globalRawAveragePlacement,
    reasons
  };
}
