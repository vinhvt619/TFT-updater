import { Archetype, BoardUnit, BoardTrait } from "./schemas";
import { toCanonicalChampionId } from "../identity";

export interface MatchCandidate {
  archetype: Archetype;
  similarity: number;
  carryMatch: number;
  jaccard: number;
  traitMatch: number;
  matchedUnits: string[];
  missingUnits: string[];
}

export interface MatchResult {
  status: "matched" | "ambiguous" | "unclassified";
  bestMatch: MatchCandidate | null;
  secondBestMatch: MatchCandidate | null;
  margin: number;
  reason: string;
}

/**
 * Tính điểm khớp Carry Core (0.0 .. 1.0)
 */
export function calculateCarryCoreMatch(
  archetype: Archetype,
  observedCarryId: string | null,
  observedUnitIds: string[]
): number {
  if (!observedCarryId || !archetype.coreCarryChampionId) return 0;
  const canonicalCarry = toCanonicalChampionId(observedCarryId);
  const targetCarry = toCanonicalChampionId(archetype.coreCarryChampionId);

  // Carry chính khớp hoàn toàn
  if (canonicalCarry === targetCarry) {
    return 1.0;
  }

  // Carry nằm trong nhóm core champions của đội hình
  const canonicalCore = archetype.coreChampionIds.map((id) => toCanonicalChampionId(id));
  if (canonicalCore.includes(canonicalCarry)) {
    return 0.5;
  }

  // Nếu carry không khớp nhưng archetype carry có mặt trên bàn cờ
  if (observedUnitIds.map((id) => toCanonicalChampionId(id)).includes(targetCarry)) {
    return 0.3;
  }

  return 0.0;
}

/**
 * Tính Weighted Jaccard Similarity cho các tướng (trọng số core = 2.0, flex = 1.0)
 */
export function calculateWeightedUnitJaccard(
  archetype: Archetype,
  observedUnitIds: string[]
): { jaccard: number; matchedUnits: string[]; missingUnits: string[] } {
  const canonicalObserved = new Set(observedUnitIds.map((id) => toCanonicalChampionId(id)));
  const canonicalCore = archetype.coreChampionIds.map((id) => toCanonicalChampionId(id));
  const canonicalFlex = archetype.flexChampionIds.map((id) => toCanonicalChampionId(id));

  const matchedUnits: string[] = [];
  const missingUnits: string[] = [];

  let intersectionWeight = 0;
  let unionWeight = 0;

  // Tính core units
  for (const coreId of canonicalCore) {
    if (canonicalObserved.has(coreId)) {
      intersectionWeight += 2.0;
      unionWeight += 2.0;
      matchedUnits.push(coreId);
    } else {
      unionWeight += 2.0;
      missingUnits.push(coreId);
    }
  }

  // Tính flex units
  for (const flexId of canonicalFlex) {
    if (canonicalObserved.has(flexId)) {
      intersectionWeight += 1.0;
      unionWeight += 1.0;
      matchedUnits.push(flexId);
    }
  }

  // Các tướng ngoài archetype có trên bàn cờ
  for (const obsId of canonicalObserved) {
    if (!canonicalCore.includes(obsId) && !canonicalFlex.includes(obsId)) {
      unionWeight += 1.0;
    }
  }

  const jaccard = unionWeight > 0 ? intersectionWeight / unionWeight : 0;
  return { jaccard, matchedUnits, missingUnits };
}

/**
 * Tính tỷ lệ khớp Tộc/Hệ quan trọng (0.0 .. 1.0)
 * Nếu nguồn không cung cấp traits hoặc archetype không có key traits, trả về 0.0 (không cộng điểm khống)
 */
export function calculateKeyTraitMatch(
  archetype: Archetype,
  observedTraitIds: string[]
): number {
  if (!observedTraitIds || observedTraitIds.length === 0) return 0.0;
  if (!archetype.keyTraitIds || archetype.keyTraitIds.length === 0) return 0.0;
  const canonicalObserved = new Set(observedTraitIds.map((t) => t.toLowerCase()));

  let matched = 0;
  for (const traitId of archetype.keyTraitIds) {
    if (canonicalObserved.has(traitId.toLowerCase())) {
      matched++;
    }
  }

  return matched / archetype.keyTraitIds.length;
}

/**
 * Tính điểm tương đồng tổng thể theo công thức Mục 3.3:
 * similarity = 0.50 * carryCoreMatch + 0.30 * weightedUnitJaccard + 0.20 * keyTraitMatch
 */
export function calculateSimilarity(
  archetype: Archetype,
  observedCarryId: string | null,
  observedUnitIds: string[],
  observedTraitIds: string[]
): MatchCandidate {
  const carryMatch = calculateCarryCoreMatch(archetype, observedCarryId, observedUnitIds);
  const { jaccard, matchedUnits, missingUnits } = calculateWeightedUnitJaccard(
    archetype,
    observedUnitIds
  );
  const traitProvided = observedTraitIds && observedTraitIds.length > 0;
  const traitMatch = traitProvided ? calculateKeyTraitMatch(archetype, observedTraitIds) : 0;

  const similarity = traitProvided
    ? 0.50 * carryMatch + 0.30 * jaccard + 0.20 * traitMatch
    : (0.50 * carryMatch + 0.30 * jaccard) / 0.80;

  return {
    archetype,
    similarity: Math.round(similarity * 10000) / 10000,
    carryMatch,
    jaccard: Math.round(jaccard * 10000) / 10000,
    traitMatch,
    matchedUnits,
    missingUnits
  };
}

/**
 * So khớp một danh sách tướng/tộc với danh mục các Archetypes
 * Ngưỡng bảo thủ cho dữ liệu nguồn công khai:
 * - auto-match khi similarity >= 0.90 và margin >= 0.15;
 * - ambiguous khi similarity >= 0.75 nhưng chưa đủ điều kiện auto-match;
 * - unclassified khi thấp hơn 0.75 hoặc mâu thuẫn carry.
 */
export function matchArchetype(
  archetypes: Archetype[],
  observedCarryId: string | null,
  observedUnitIds: string[],
  observedTraitIds: string[] = []
): MatchResult {
  if (observedUnitIds.length < 4) {
    return {
      status: "unclassified",
      bestMatch: null,
      secondBestMatch: null,
      margin: 0,
      reason: "Bàn cờ có dưới 4 tướng, người chơi có thể bị loại sớm trước khi định hình đội hình"
    };
  }

  const candidates: MatchCandidate[] = archetypes.map((a) =>
    calculateSimilarity(a, observedCarryId, observedUnitIds, observedTraitIds)
  );

  candidates.sort((a, b) => b.similarity - a.similarity);

  const best = candidates[0] || null;
  const second = candidates[1] || null;

  if (!best || best.similarity < 0.75) {
    return {
      status: "unclassified",
      bestMatch: best,
      secondBestMatch: second,
      margin: 0,
      reason: `Độ tương đồng cao nhất (${best ? best.similarity : 0}) thấp hơn ngưỡng 0.75`
    };
  }

  const margin = second ? Math.round((best.similarity - second.similarity) * 10000) / 10000 : 1.0;

  // Kiểm tra mâu thuẫn carry chính (ví dụ: carry quan sát là Aphelios nhưng archetype là Ashe Sniper)
  const isCarryConflict = Boolean(
    observedCarryId &&
    best.archetype.coreCarryChampionId &&
    best.carryMatch === 0 &&
    !best.matchedUnits.includes(toCanonicalChampionId(best.archetype.coreCarryChampionId))
  );

  if (isCarryConflict) {
    return {
      status: "unclassified",
      bestMatch: best,
      secondBestMatch: second,
      margin,
      reason: `Từ chối ghép đội hình: tướng chủ lực quan sát (${observedCarryId}) mâu thuẫn với chủ lực chuẩn của ${best.archetype.nameVi} (${best.archetype.coreCarryChampionId})`
    };
  }

  if (best.similarity >= 0.90 && margin >= 0.15) {
    return {
      status: "matched",
      bestMatch: best,
      secondBestMatch: second,
      margin,
      reason: `Khớp thành công với ${best.archetype.nameVi} (score: ${best.similarity}, margin: ${margin})`
    };
  }

  if (best.similarity >= 0.75) {
    return {
      status: "ambiguous",
      bestMatch: best,
      secondBestMatch: second,
      margin,
      reason: `Mơ hồ giữa ${best.archetype.nameVi} (${best.similarity}) và ${second?.archetype.nameVi} (${second?.similarity}) với cách biệt chỉ ${margin}`
    };
  }

  return {
    status: "unclassified",
    bestMatch: best,
    secondBestMatch: second,
    margin,
    reason: `Chưa đạt ngưỡng nhận diện tự động (score: ${best.similarity})`
  };
}
