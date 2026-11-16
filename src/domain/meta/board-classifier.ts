import {
  Archetype,
  MatchParticipant,
  BoardClassification,
  BoardUnit,
  BoardTrait
} from "./schemas";
import { matchArchetype } from "./archetype-matching";
import { toCanonicalChampionId } from "../identity";

/**
 * Suy luận chủ lực (carry) dựa trên trang bị và số sao của tướng trên bàn cờ.
 * Ưu tiên tướng có nhiều trang bị nhất (đặc biệt là 3 trang bị).
 */
export function inferObservedCarry(units: BoardUnit[]): string | null {
  if (!units || units.length === 0) return null;

  // Sắp xếp giảm dần theo: số lượng đồ -> số sao
  const sorted = [...units].sort((a, b) => {
    const itemsA = a.items?.length || 0;
    const itemsB = b.items?.length || 0;
    if (itemsB !== itemsA) {
      return itemsB - itemsA;
    }
    return (b.tier || 1) - (a.tier || 1);
  });

  const bestCandidate = sorted[0];
  if (!bestCandidate) return null;

  return bestCandidate.championId;
}

/**
 * Phân loại một người chơi / bàn cờ kết trận sang Archetype.
 * QUY TẮC BẮT BUỘC:
 * - Độc lập hoàn toàn với thứ hạng kết trận (placement).
 * - Không bắt buộc tướng chủ lực phải đạt 3 sao mới nhận diện (U15).
 * - Nếu người chơi chết sớm (< 4 tướng), giữ unclassified chứ không đoán mò.
 */
export function classifyBoard(
  participant: MatchParticipant,
  archetypes: Archetype[],
  classifierVersion: string = "1.0.0"
): BoardClassification {
  const unitIds = participant.units.map((u) => u.championId);
  const traitIds = participant.traits.map((t) => t.traitId);
  const carryId = inferObservedCarry(participant.units);

  const matchResult = matchArchetype(archetypes, carryId, unitIds, traitIds);

  if (matchResult.status === "matched" && matchResult.bestMatch) {
    return {
      matchKey: participant.matchKey,
      accountKey: participant.accountKey,
      status: "matched",
      archetypeId: matchResult.bestMatch.archetype.id,
      variantId: matchResult.bestMatch.archetype.defaultVariantId || null,
      similarityScore: matchResult.bestMatch.similarity,
      matchedCoreUnits: matchResult.bestMatch.matchedUnits,
      missingCoreUnits: matchResult.bestMatch.missingUnits,
      matchedTraits: participant.traits.map((t) => t.traitId),
      reason: matchResult.reason,
      classifierVersion
    };
  }

  if (matchResult.status === "ambiguous") {
    return {
      matchKey: participant.matchKey,
      accountKey: participant.accountKey,
      status: "ambiguous",
      archetypeId: matchResult.bestMatch?.archetype.id || null,
      variantId: null,
      similarityScore: matchResult.bestMatch?.similarity || 0,
      matchedCoreUnits: matchResult.bestMatch?.matchedUnits || [],
      missingCoreUnits: matchResult.bestMatch?.missingUnits || [],
      matchedTraits: participant.traits.map((t) => t.traitId),
      reason: matchResult.reason,
      classifierVersion
    };
  }

  return {
    matchKey: participant.matchKey,
    accountKey: participant.accountKey,
    status: "unclassified",
    archetypeId: null,
    variantId: null,
    similarityScore: matchResult.bestMatch?.similarity || 0,
    matchedCoreUnits: matchResult.bestMatch?.matchedUnits || [],
    missingCoreUnits: matchResult.bestMatch?.missingUnits || [],
    matchedTraits: participant.traits.map((t) => t.traitId),
    reason: matchResult.reason,
    classifierVersion
  };
}

/**
 * Đánh giá tỷ lệ bao phủ của bộ phân loại (Top4 vs Bottom4) để kiểm tra thiên lệch
 */
export function calculateClassifierCoverage(
  classifications: Array<{ placement: number; status: string }>
): {
  totalCount: number;
  overallClassifiedRate: number;
  top4ClassifiedRate: number;
  bottom4ClassifiedRate: number;
  gap: number;
  hasCoverageBias: boolean;
} {
  const total = classifications.length;
  if (total === 0) {
    return {
      totalCount: 0,
      overallClassifiedRate: 0,
      top4ClassifiedRate: 0,
      bottom4ClassifiedRate: 0,
      gap: 0,
      hasCoverageBias: false
    };
  }

  const top4List = classifications.filter((c) => c.placement <= 4);
  const bottom4List = classifications.filter((c) => c.placement > 4);

  const totalMatched = classifications.filter((c) => c.status === "matched").length;
  const top4Matched = top4List.filter((c) => c.status === "matched").length;
  const bottom4Matched = bottom4List.filter((c) => c.status === "matched").length;

  const overallClassifiedRate = totalMatched / total;
  const top4ClassifiedRate = top4List.length > 0 ? top4Matched / top4List.length : 0;
  const bottom4ClassifiedRate = bottom4List.length > 0 ? bottom4Matched / bottom4List.length : 0;

  const gap = Math.abs(top4ClassifiedRate - bottom4ClassifiedRate);
  // Cảnh báo nếu chênh lệch nhận diện giữa Top 4 và Bottom 4 vượt quá 15% (0.15)
  const hasCoverageBias = gap > 0.15;

  return {
    totalCount: total,
    overallClassifiedRate: Math.round(overallClassifiedRate * 1000) / 1000,
    top4ClassifiedRate: Math.round(top4ClassifiedRate * 1000) / 1000,
    bottom4ClassifiedRate: Math.round(bottom4ClassifiedRate * 1000) / 1000,
    gap: Math.round(gap * 1000) / 1000,
    hasCoverageBias
  };
}
