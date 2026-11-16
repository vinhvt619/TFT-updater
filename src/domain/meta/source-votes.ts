import { SourceCompObservation, SourceId, Tier, RankingStatus } from "./schemas";
import { calculatePerformanceScore, NEUTRAL_BASELINE, scoreToCandidateTier } from "./performance-score";

export const SOURCE_TIER_POINTS: Record<string, number> = {
  "S+": 95,
  "S": 90,
  "S-": 85,
  "A+": 80,
  "A": 75,
  "A-": 70,
  "B+": 65,
  "B": 60,
  "B-": 55,
  "C+": 45,
  "C": 40,
  "C-": 35,
  "D": 25
};

export interface NormalizedSourceVote {
  sourceId: SourceId;
  provenanceGroupId: string;
  originalTier: string | null;
  voteScore: number | null;
  isStatistical: boolean;
  weight: number;
  reason: string;
  sourceUpdatedAt: string | null;
}

export interface WebsiteConsensusResult {
  score: number | null;
  tier: Tier | null;
  candidateTier: Tier | null;
  status: RankingStatus;
  consensusLabel: string;
  votes: Record<string, NormalizedSourceVote>;
  validGroupCount: number;
  totalGroupCount: number;
  warnings: string[];
}

/**
 * Chuẩn hóa một quan sát từ website thành một phiếu điểm số (0 .. 100)
 */
export function normalizeSourceObservation(
  obs: SourceCompObservation,
  provenanceGroupId?: string
): NormalizedSourceVote {
  const group = provenanceGroupId || `${obs.sourceId}_group`;
  const rawTier = obs.originalTier?.trim().toUpperCase() || null;

  // 1. Nếu có Tier chữ trực tiếp (S+, S, A, B, C, D...)
  if (rawTier && SOURCE_TIER_POINTS[rawTier] !== undefined) {
    return {
      sourceId: obs.sourceId,
      provenanceGroupId: group,
      originalTier: obs.originalTier,
      voteScore: SOURCE_TIER_POINTS[rawTier],
      isStatistical: false,
      weight: 1.0,
      reason: `Trích xuất trực tiếp tier ${obs.originalTier} từ nguồn`,
      sourceUpdatedAt: obs.sourceUpdatedAt
    };
  }

  // 2. Nếu không có Tier nhưng là nguồn thống kê có đủ metrics và sampleCount >= 200 (Mục 6.2)
  const { top4Rate, averagePlacement, winRate, sampleCount } = obs.metrics;
  if (
    top4Rate !== null &&
    averagePlacement !== null &&
    winRate !== null &&
    sampleCount !== null &&
    sampleCount >= 200
  ) {
    const { score } = calculatePerformanceScore(
      {
        top4Rate,
        avgPlacement: averagePlacement,
        winRate
      },
      NEUTRAL_BASELINE
    );

    return {
      sourceId: obs.sourceId,
      provenanceGroupId: group,
      originalTier: null,
      voteScore: score,
      isStatistical: true,
      weight: 1.0,
      reason: `Tạo phiếu thống kê tự động từ cỡ mẫu ${sampleCount} trận (Top4: ${top4Rate}, Avg: ${averagePlacement}, Win: ${winRate})`,
      sourceUpdatedAt: obs.sourceUpdatedAt
    };
  }

  // 3. Situational, thiếu tier, hoặc mẫu dưới 200: không tạo phiếu số
  return {
    sourceId: obs.sourceId,
    provenanceGroupId: group,
    originalTier: obs.originalTier,
    voteScore: null,
    isStatistical: false,
    weight: 1.0,
    reason: obs.originalTier
      ? `Tier dạng điều kiện/situational '${obs.originalTier}' không đổi thành điểm số`
      : `Thiếu dữ liệu hoặc cỡ mẫu (${sampleCount || 0}) chưa đạt ngưỡng tối thiểu 200 trận`,
    sourceUpdatedAt: obs.sourceUpdatedAt
  };
}

/**
 * Tính điểm đồng thuận giữa 5 trang meta theo Mục 4.4 của Plan
 * websiteScore = sum(groupVote * groupWeight) / sum(groupWeight)
 */
export function calculateWebsiteConsensus(
  observations: SourceCompObservation[],
  provenanceMap: Record<SourceId, string> = {
    metatft: "metatft_group",
    tftacademy: "tftacademy_group",
    tftflex: "tftflex_group",
    datatft: "datatft_group",
    tactics_tools: "tactics_tools_group"
  }
): WebsiteConsensusResult {
  const votes: Record<string, NormalizedSourceVote> = {};
  const groupVotes: Map<string, NormalizedSourceVote> = new Map();
  const warnings: string[] = [];

  for (const obs of observations) {
    const groupId = provenanceMap[obs.sourceId] || `${obs.sourceId}_group`;
    const vote = normalizeSourceObservation(obs, groupId);
    votes[obs.sourceId] = vote;

    // Quy tắc một nhóm xuất xứ chỉ lấy một phiếu hợp lệ đại diện
    if (vote.voteScore !== null) {
      if (!groupVotes.has(groupId)) {
        groupVotes.set(groupId, vote);
      } else {
        warnings.push(
          `Bỏ qua phiếu trùng lặp của nhóm xuất xứ '${groupId}' từ nguồn ${obs.sourceId}`
        );
      }
    }
  }

  const validVotes = Array.from(groupVotes.values());
  const validGroupCount = validVotes.length;
  const totalGroupCount = Object.keys(provenanceMap).length;

  if (validGroupCount === 0) {
    return {
      score: null,
      tier: null,
      candidateTier: null,
      status: "collecting",
      consensusLabel: "Chưa có nguồn hợp lệ",
      votes,
      validGroupCount: 0,
      totalGroupCount,
      warnings
    };
  }

  let totalWeightedScore = 0;
  let totalWeight = 0;
  const scores: number[] = [];

  for (const v of validVotes) {
    if (v.voteScore !== null) {
      totalWeightedScore += v.voteScore * v.weight;
      totalWeight += v.weight;
      scores.push(v.voteScore);
    }
  }

  const consensusScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const roundedScore = Math.round(consensusScore * 10000) / 10000;
  const candidate = scoreToCandidateTier(roundedScore);

  // Xác định nhãn đồng thuận theo chênh lệch cao nhất - thấp nhất
  let consensusLabel = "Đang thu thập";
  if (scores.length >= 3) {
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const spread = maxScore - minScore;

    if (spread <= 25) {
      consensusLabel = "Đồng thuận cao";
    } else if (spread >= 30) {
      consensusLabel = "Các nguồn khác nhau";
    } else {
      consensusLabel = "Đồng thuận vừa phải";
    }
  } else if (scores.length === 2) {
    consensusLabel = "2 nguồn đồng thuận";
  } else {
    consensusLabel = "Mới có 1 nguồn";
  }

  // QUY TẮC NGHIỆP VỤ MỤC 4.4:
  // 1. Cần ít nhất 2 nhóm nguồn hợp lệ để cấp tier. Nếu chỉ có 1 nguồn -> tier = null, status = collecting
  if (validGroupCount < 2) {
    return {
      score: roundedScore,
      tier: null,
      candidateTier: candidate,
      status: "collecting",
      consensusLabel,
      votes,
      validGroupCount,
      totalGroupCount,
      warnings: [...warnings, "Chưa đủ tối thiểu 2 nhóm nguồn để xếp hạng chính thức"]
    };
  }

  // 2. Candidate S cần ít nhất 3 nhóm nguồn hợp lệ. Nếu candidate là S mà chỉ có 2 nguồn -> provisional
  if (candidate === "S" && validGroupCount < 3) {
    return {
      score: roundedScore,
      tier: null,
      candidateTier: "S",
      status: "provisional",
      consensusLabel,
      votes,
      validGroupCount,
      totalGroupCount,
      warnings: [...warnings, "Đạt điểm S nhưng chưa đủ 3 nhóm nguồn xác nhận (tạm giữ provisional)"]
    };
  }

  return {
    score: roundedScore,
    tier: candidate,
    candidateTier: candidate,
    status: "ranked",
    consensusLabel,
    votes,
    validGroupCount,
    totalGroupCount,
    warnings
  };
}
