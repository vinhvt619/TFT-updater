export interface MatchAppearance {
  matchKey: string;
  accountKey: string;
  endedAt: string; // ISO string
  placement: number; // 1..8
  isTop4: boolean;
  isWin: boolean;
}

export interface WeightedAppearance extends MatchAppearance {
  ageHours: number;
  ageWeight: number;
  accountCapFactor: number;
  weight: number;
}

export interface WeightCalculationResult {
  appearances: WeightedAppearance[];
  totalAppearances: number;
  uniqueMatches: number;
  uniqueAccounts: number;
  top4Count: number;
  winCount: number;
  rawTop4Rate: number;
  rawWinRate: number;
  rawAveragePlacement: number;
  weightMass: number;
  nEffective: number;
}

/**
 * Tính trọng số thời gian và giới hạn đóng góp tài khoản theo Mục 6.3 của Plan
 * ageHours_i = (asOf - matchEndedAt_i) / 1 giờ
 * ageWeight_i = 2 ^ (-ageHours_i / 48)
 * accountMass_p = sum(ageWeight_i của tài khoản p)
 * accountCapFactor_p = min(1, 5 / accountMass_p)
 * weight_i = ageWeight_i * accountCapFactor_p
 * weightMass = sum(weight_i)
 * nEffective = weightMass^2 / sum(weight_i^2)
 */
export function calculateEliteWeights(
  appearances: MatchAppearance[],
  asOf: Date = new Date(),
  halfLifeHours: number = 48,
  accountWeightCap: number = 5
): WeightCalculationResult {
  const asOfTime = asOf.getTime();

  if (appearances.length === 0) {
    return {
      appearances: [],
      totalAppearances: 0,
      uniqueMatches: 0,
      uniqueAccounts: 0,
      top4Count: 0,
      winCount: 0,
      rawTop4Rate: 0,
      rawWinRate: 0,
      rawAveragePlacement: 0,
      weightMass: 0,
      nEffective: 0
    };
  }

  // 1. Bước 1: Tính ageWeight và tính tổng mass theo từng tài khoản
  const accountAgeMass: Map<string, number> = new Map();
  const rawWeightedList: Array<MatchAppearance & { ageHours: number; ageWeight: number }> = [];

  const uniqueMatchesSet = new Set<string>();
  const uniqueAccountsSet = new Set<string>();
  let totalPlacement = 0;
  let top4Count = 0;
  let winCount = 0;

  for (const app of appearances) {
    uniqueMatchesSet.add(app.matchKey);
    uniqueAccountsSet.add(app.accountKey);
    totalPlacement += app.placement;
    if (app.isTop4) top4Count++;
    if (app.isWin) winCount++;

    const matchEndTime = new Date(app.endedAt).getTime();
    const ageHours = Math.max(0, (asOfTime - matchEndTime) / (1000 * 60 * 60));
    // Chu kỳ bán rã 48 giờ
    const ageWeight = Math.pow(2, -ageHours / halfLifeHours);

    rawWeightedList.push({
      ...app,
      ageHours,
      ageWeight
    });

    const currentMass = accountAgeMass.get(app.accountKey) || 0;
    accountAgeMass.set(app.accountKey, currentMass + ageWeight);
  }

  // 2. Bước 2: Áp dụng trần đóng góp tối đa 5 đơn vị trọng số cho mỗi tài khoản
  const weightedAppearances: WeightedAppearance[] = [];
  let totalWeightMass = 0;
  let sumSquaredWeights = 0;

  for (const item of rawWeightedList) {
    const mass = accountAgeMass.get(item.accountKey) || item.ageWeight;
    const accountCapFactor = Math.min(1.0, accountWeightCap / mass);
    const finalWeight = item.ageWeight * accountCapFactor;

    totalWeightMass += finalWeight;
    sumSquaredWeights += finalWeight * finalWeight;

    weightedAppearances.push({
      ...item,
      accountCapFactor,
      weight: finalWeight
    });
  }

  const nEffective =
    sumSquaredWeights > 0 ? Math.pow(totalWeightMass, 2) / sumSquaredWeights : 0;

  const totalAppearances = appearances.length;
  const rawTop4Rate = totalAppearances > 0 ? top4Count / totalAppearances : 0;
  const rawWinRate = totalAppearances > 0 ? winCount / totalAppearances : 0;
  const rawAveragePlacement = totalAppearances > 0 ? totalPlacement / totalAppearances : 0;

  return {
    appearances: weightedAppearances,
    totalAppearances,
    uniqueMatches: uniqueMatchesSet.size,
    uniqueAccounts: uniqueAccountsSet.size,
    top4Count,
    winCount,
    rawTop4Rate: Math.round(rawTop4Rate * 10000) / 10000,
    rawWinRate: Math.round(rawWinRate * 10000) / 10000,
    rawAveragePlacement: Math.round(rawAveragePlacement * 100) / 100,
    weightMass: Math.round(totalWeightMass * 100) / 100,
    nEffective: Math.round(nEffective * 100) / 100
  };
}
