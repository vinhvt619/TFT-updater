import {
  ChampionRecord,
  SnapshotPayload,
  StarLevel,
  FieldDiff,
  ChampionDiff,
  ChampionBaseStat,
  ChampionAbilityInfo,
  ComparisonResult,
  ComparisonSummary,
  Impact,
  ChangeKind,
  Datum,
  MissingDatum
} from "./types";
import { FIELD_REGISTRY, getFieldDefinition } from "./field-registry";
import { toCanonicalChampionId } from "./identity";

export const DIFF_ENGINE_VERSION = "2.0.0";

export interface CompareOptions {
  starLevel?: StarLevel;
  changedOnly?: boolean;
}

function formatObservedStarValues(stat: ChampionRecord["variants"][number]["stats"][number]): string | null {
  const knownStars = ([1, 2, 3] as StarLevel[]).filter((star) => stat.byStar[star]?.state === "known");
  if (knownStars.length === 0) return null;
  const lastStar = Math.max(...knownStars);
  return ([1, 2, 3] as StarLevel[])
    .slice(0, lastStar)
    .map((star) => stat.byStar[star]?.state === "known" ? String(stat.byStar[star].value) : "—")
    .join(" / ");
}

function extractFormattedBaseStats(champ: ChampionRecord): ChampionBaseStat[] {
  const variant = champ.variants[0];
  if (!variant) return [];

  const statsMap = new Map(variant.stats.map((s) => [s.key, s]));
  const result: ChampionBaseStat[] = [];

  const hpStat = statsMap.get("health");
  if (hpStat) {
    const value = formatObservedStarValues(hpStat);
    if (value) result.push({
      key: "health",
      labelVi: "Máu",
      value
    });
  }

  const adStat = statsMap.get("attack_damage");
  if (adStat) {
    const value = formatObservedStarValues(adStat);
    if (value) result.push({
      key: "attack_damage",
      labelVi: "Sát thương (AD)",
      value
    });
  }

  const armorStat = statsMap.get("armor");
  if (armorStat && armorStat.byStar[1]?.state === "known") {
    result.push({
      key: "armor",
      labelVi: "Giáp",
      value: `${armorStat.byStar[1].value}`
    });
  }

  const mrStat = statsMap.get("magic_resistance");
  if (mrStat && mrStat.byStar[1]?.state === "known") {
    result.push({
      key: "magic_resistance",
      labelVi: "Kháng phép",
      value: `${mrStat.byStar[1].value}`
    });
  }

  const asStat = statsMap.get("attack_speed");
  if (asStat && asStat.byStar[1]?.state === "known") {
    result.push({
      key: "attack_speed",
      labelVi: "Tốc độ đánh",
      value: `${asStat.byStar[1].value}`
    });
  }

  const rangeStat = statsMap.get("attack_range");
  if (rangeStat && rangeStat.byStar[1]?.state === "known") {
    result.push({
      key: "attack_range",
      labelVi: "Tầm đánh",
      value: `${rangeStat.byStar[1].value} ô`
    });
  }

  const manaStart = statsMap.get("mana_start");
  const manaMax = statsMap.get("mana_max");
  if (manaStart && manaMax && manaStart.byStar[1]?.state === "known" && manaMax.byStar[1]?.state === "known") {
    result.push({
      key: "mana",
      labelVi: "Năng lượng",
      value: `${manaStart.byStar[1].value} / ${manaMax.byStar[1].value}`
    });
  }

  const critChance = statsMap.get("crit_chance");
  if (critChance && critChance.byStar[1]?.state === "known") {
    result.push({
      key: "crit_chance",
      labelVi: "Tỉ lệ chí mạng",
      value: `${critChance.byStar[1].value}%`
    });
  }

  return result;
}

function extractAbilityInfo(champ: ChampionRecord): ChampionAbilityInfo | undefined {
  const ability = champ.variants[0]?.abilities[0];
  if (!ability) return undefined;

  const nameVi = ability.name.vi.state === "known" ? ability.name.vi.value : "";
  const nameEn = ability.name.en.state === "known" ? ability.name.en.value : "";
  const descVi = ability.description.vi.state === "known" ? ability.description.vi.value : "";

  return { nameVi, nameEn, descVi };
}

function buildCanonicalChampionMap(champions: ChampionRecord[], setNumber: number): Map<string, ChampionRecord> {
  const map = new Map<string, ChampionRecord>();
  for (const champ of champions) {
    const canonicalId = toCanonicalChampionId(champ.championId, setNumber);
    const existing = map.get(canonicalId);
    if (existing) {
      const diffs = compareChampionRecords(existing, champ);
      if (diffs.length > 0) {
        throw new Error(`Canonical champion collision detected with conflicting gameplay for ID: ${canonicalId}`);
      }
      continue;
    }
    map.set(canonicalId, champ);
  }
  return map;
}

export function compareSnapshots(
  fromSnapshot: SnapshotPayload,
  toSnapshot: SnapshotPayload,
  fromSnapshotId: string,
  toSnapshotId: string,
  options: CompareOptions = {}
): ComparisonResult {
  const championsDiffMap: Map<string, ChampionDiff> = new Map();
  const fromSet = fromSnapshot.setNumber || 18;
  const toSet = toSnapshot.setNumber || 18;

  const fromChamps = buildCanonicalChampionMap(fromSnapshot.champions, fromSet);
  const toChamps = buildCanonicalChampionMap(toSnapshot.champions, toSet);

  // 1. Gather all unique canonical champion IDs across both snapshots
  const allChampionIds = new Set([...fromChamps.keys(), ...toChamps.keys()]);

  for (const champId of allChampionIds) {
    const fromChamp = fromChamps.get(champId);
    const toChamp = toChamps.get(champId);

    // Case A: Champion added in toSnapshot
    if (!fromChamp && toChamp) {
      const isComplete = fromSnapshot.rosterCompleteness === "complete";
      const fieldDiffs: FieldDiff[] = [];
      championsDiffMap.set(champId, {
        championId: champId,
        nameVi: toChamp.name.vi.state === "known" ? toChamp.name.vi.value : champId,
        nameEn: toChamp.name.en.state === "known" ? toChamp.name.en.value : champId,
        cost: toChamp.cost.state === "known" ? toChamp.cost.value : null,
        traits: toChamp.traitIds.state === "known" ? toChamp.traitIds.value : [],
        icon: toChamp.icon.state === "known" ? toChamp.icon.value : null,
        entityKind: toChamp.entityKind,
        status: isComplete ? "added" : "availability_changed",
        summaryImpact: "buff",
        fieldDiffs,
        baseStats: extractFormattedBaseStats(toChamp),
        ability: extractAbilityInfo(toChamp)
      });
      continue;
    }

    // Case B: Champion missing in toSnapshot
    if (fromChamp && !toChamp) {
      const isComplete = toSnapshot.rosterCompleteness === "complete";
      const fieldDiffs: FieldDiff[] = [];
      championsDiffMap.set(champId, {
        championId: champId,
        nameVi: fromChamp.name.vi.state === "known" ? fromChamp.name.vi.value : champId,
        nameEn: fromChamp.name.en.state === "known" ? fromChamp.name.en.value : champId,
        cost: fromChamp.cost.state === "known" ? fromChamp.cost.value : null,
        traits: fromChamp.traitIds.state === "known" ? fromChamp.traitIds.value : [],
        icon: fromChamp.icon.state === "known" ? fromChamp.icon.value : null,
        entityKind: fromChamp.entityKind,
        status: isComplete ? "removed" : "availability_changed",
        summaryImpact: "nerf",
        fieldDiffs,
        baseStats: extractFormattedBaseStats(fromChamp),
        ability: extractAbilityInfo(fromChamp)
      });
      continue;
    }

    // Case C: Champion present in both snapshots
    if (fromChamp && toChamp) {
      const fieldDiffs = compareChampionRecords(fromChamp, toChamp);
      const hasChanges = fieldDiffs.length > 0;

      let summaryImpact: Impact = "neutral";
      if (hasChanges) {
        const hasBuff = fieldDiffs.some((d) => d.impact === "buff");
        const hasNerf = fieldDiffs.some((d) => d.impact === "nerf");
        const hasUnknown = fieldDiffs.some((d) => d.impact === "unknown" && d.kind === "numeric");

        if (hasBuff && hasNerf) {
          summaryImpact = "mixed";
        } else if (hasBuff && !hasUnknown) {
          summaryImpact = "buff";
        } else if (hasNerf && !hasUnknown) {
          summaryImpact = "nerf";
        } else if (hasBuff || hasNerf) {
          summaryImpact = "unknown";
        } else {
          summaryImpact = "neutral";
        }
      }

      championsDiffMap.set(champId, {
        championId: champId,
        nameVi: toChamp.name.vi.state === "known" ? toChamp.name.vi.value : fromChamp.name.vi.state === "known" ? fromChamp.name.vi.value : champId,
        nameEn: toChamp.name.en.state === "known" ? toChamp.name.en.value : fromChamp.name.en.state === "known" ? fromChamp.name.en.value : champId,
        cost: toChamp.cost.state === "known" ? toChamp.cost.value : null,
        traits: toChamp.traitIds.state === "known" ? toChamp.traitIds.value : [],
        icon: toChamp.icon.state === "known" ? toChamp.icon.value : null,
        entityKind: toChamp.entityKind,
        status: hasChanges ? "modified" : "unchanged",
        summaryImpact,
        fieldDiffs,
        baseStats: extractFormattedBaseStats(toChamp),
        ability: extractAbilityInfo(toChamp)
      });
    }
  }

  // Summary counts
  let buffedCount = 0;
  let nerfedCount = 0;
  let mixedCount = 0;
  let neutralCount = 0;
  let unknownCount = 0;
  let changedChampions = 0;

  const championsList = Array.from(championsDiffMap.values());
  for (const c of championsList) {
    if (c.status !== "unchanged") {
      changedChampions++;
      switch (c.summaryImpact) {
        case "buff":
          buffedCount++;
          break;
        case "nerf":
          nerfedCount++;
          break;
        case "mixed":
          mixedCount++;
          break;
        case "neutral":
          neutralCount++;
          break;
        case "unknown":
          unknownCount++;
          break;
      }
    }
  }

  const summary: ComparisonSummary = {
    totalChampions: championsList.length,
    changedChampions,
    buffedCount,
    nerfedCount,
    mixedCount,
    neutralCount,
    unknownCount
  };

  return {
    fromSnapshotId,
    toSnapshotId,
    diffEngineVersion: DIFF_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    summary,
    champions: championsList
  };
}

export function compareChampionRecords(fromChamp: ChampionRecord, toChamp: ChampionRecord): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const targetChampionId = toCanonicalChampionId(toChamp.championId, 18);

  // Compare cost
  if (fromChamp.cost.state === "known" && toChamp.cost.state === "known") {
    if (fromChamp.cost.value !== toChamp.cost.value) {
      diffs.push({
        championId: targetChampionId,
        variantKey: "base",
        fieldKey: "cost",
        fieldLabelVi: "Giá vàng",
        fieldLabelEn: "Cost",
        unit: "gold",
        starLevel: null,
        kind: "numeric",
        before: fromChamp.cost,
        after: toChamp.cost,
        absoluteDelta: toChamp.cost.value - fromChamp.cost.value,
        relativeDeltaPercent: null,
        percentagePointDelta: null,
        impact: "neutral",
        impactReason: "Thay đổi giá tướng",
        requiresReview: false
      });
    }
  }

  // Compare traits (as sets of canonical IDs)
  if (fromChamp.traitIds.state === "known" && toChamp.traitIds.state === "known") {
    const fromTraits = [...fromChamp.traitIds.value].map((t) => t.toLowerCase().trim()).sort().join(",");
    const toTraits = [...toChamp.traitIds.value].map((t) => t.toLowerCase().trim()).sort().join(",");
    if (fromTraits !== toTraits) {
      diffs.push({
        championId: targetChampionId,
        variantKey: "base",
        fieldKey: "trait_ids",
        fieldLabelVi: "Tộc / Hệ",
        fieldLabelEn: "Traits",
        unit: "flat",
        starLevel: null,
        kind: "identity",
        before: fromChamp.traitIds,
        after: toChamp.traitIds,
        absoluteDelta: null,
        relativeDeltaPercent: null,
        percentagePointDelta: null,
        impact: "unknown",
        impactReason: "Thay đổi tộc hệ",
        requiresReview: true
      });
    }
  }

  // Compare variants across all observed star levels and variant keys
  const fromVariants = new Map(fromChamp.variants.map((v) => [v.variantKey, v]));
  const toVariants = new Map(toChamp.variants.map((v) => [v.variantKey, v]));
  const allVariantKeys = new Set([...fromVariants.keys(), ...toVariants.keys()]);
  const missingD = (reason = "Data unavailable"): MissingDatum => ({ state: "missing", reason, sourceRefIds: [] });

  for (const variantKey of allVariantKeys) {
    const fromVariant = fromVariants.get(variantKey);
    const toVariant = toVariants.get(variantKey);

    if (!fromVariant && toVariant) {
      diffs.push({
        championId: targetChampionId,
        variantKey,
        fieldKey: `variant_${variantKey}`,
        fieldLabelVi: `Dạng tướng mới: ${toVariant.label || variantKey}`,
        fieldLabelEn: `New variant: ${toVariant.label || variantKey}`,
        unit: 'flat',
        starLevel: null,
        kind: 'availability',
        before: missingD("Dạng tướng mới"),
        after: { state: 'known', value: variantKey, sourceRefIds: [], quality: 'extracted', origin: 'source' },
        absoluteDelta: null,
        relativeDeltaPercent: null,
        percentagePointDelta: null,
        impact: 'unknown',
        impactReason: `Thêm dạng tướng ${toVariant.label || variantKey}`,
        requiresReview: true
      });
      continue;
    }

    if (fromVariant && !toVariant) {
      diffs.push({
        championId: targetChampionId,
        variantKey,
        fieldKey: `variant_${variantKey}`,
        fieldLabelVi: `Dạng tướng bị xóa: ${fromVariant.label || variantKey}`,
        fieldLabelEn: `Removed variant: ${fromVariant.label || variantKey}`,
        unit: 'flat',
        starLevel: null,
        kind: 'availability',
        before: { state: 'known', value: variantKey, sourceRefIds: [], quality: 'extracted', origin: 'source' },
        after: missingD("Dạng tướng bị xóa"),
        absoluteDelta: null,
        relativeDeltaPercent: null,
        percentagePointDelta: null,
        impact: 'unknown',
        impactReason: `Xóa dạng tướng ${fromVariant.label || variantKey}`,
        requiresReview: true
      });
      continue;
    }

    if (!fromVariant || !toVariant) continue;

    // 1. Compare stats across all observed star levels
    const fromStatsMap = new Map(fromVariant.stats.map((s) => [s.key, s]));
    const toStatsMap = new Map(toVariant.stats.map((s) => [s.key, s]));
    const allStatKeys = new Set([...fromStatsMap.keys(), ...toStatsMap.keys()]);

    for (const statKey of allStatKeys) {
      const fromStat = fromStatsMap.get(statKey);
      const toStat = toStatsMap.get(statKey);
      const def = getFieldDefinition(statKey);
      const isStarScaled = statKey === 'health' || statKey === 'attack_damage';

      if (!fromStat && toStat) {
        diffs.push({
          championId: targetChampionId,
          variantKey,
          fieldKey: statKey,
          fieldLabelVi: def.labelVi,
          fieldLabelEn: def.labelEn,
          unit: def.unit,
          starLevel: null,
          kind: 'availability',
          before: missingD("Chỉ số mới"),
          after: toStat.byStar[1] || { state: 'known', value: 0, sourceRefIds: [], quality: 'extracted', origin: 'source' },
          absoluteDelta: null,
          relativeDeltaPercent: null,
          percentagePointDelta: null,
          impact: 'unknown',
          impactReason: `Thêm chỉ số ${def.labelVi}`,
          requiresReview: true
        });
        continue;
      }

      if (fromStat && !toStat) {
        diffs.push({
          championId: targetChampionId,
          variantKey,
          fieldKey: statKey,
          fieldLabelVi: def.labelVi,
          fieldLabelEn: def.labelEn,
          unit: def.unit,
          starLevel: null,
          kind: 'availability',
          before: fromStat.byStar[1] || { state: 'known', value: 0, sourceRefIds: [], quality: 'extracted', origin: 'source' },
          after: missingD("Chỉ số bị xóa"),
          absoluteDelta: null,
          relativeDeltaPercent: null,
          percentagePointDelta: null,
          impact: 'unknown',
          impactReason: `Xóa chỉ số ${def.labelVi}`,
          requiresReview: true
        });
        continue;
      }

      if (fromStat && toStat) {
        const starLevels: StarLevel[] = [1, 2, 3, 4];
        for (const star of starLevels) {
          const beforeDatum = fromStat.byStar[star];
          const afterDatum = toStat.byStar[star];

          if (!beforeDatum && !afterDatum) continue;
          if (!beforeDatum || !afterDatum) {
            diffs.push({
              championId: targetChampionId,
              variantKey,
              fieldKey: statKey,
              fieldLabelVi: `${def.labelVi} (${star}★)`,
              fieldLabelEn: `${def.labelEn} (${star}★)`,
              unit: def.unit,
              starLevel: star,
              kind: 'availability',
              before: beforeDatum || missingD(),
              after: afterDatum || missingD(),
              absoluteDelta: null,
              relativeDeltaPercent: null,
              percentagePointDelta: null,
              impact: 'unknown',
              impactReason: `Trạng thái ${def.labelVi} (${star}★) thay đổi`,
              requiresReview: true
            });
            continue;
          }

          if (beforeDatum.state === 'known' && afterDatum.state === 'known') {
            const delta = afterDatum.value - beforeDatum.value;
            if (Math.abs(delta) > def.epsilon) {
              let relPercent: number | null = null;
              if (def.allowRelativePercent && beforeDatum.value !== 0) {
                relPercent = (delta / Math.abs(beforeDatum.value)) * 100;
              }

              let ptDelta: number | null = null;
              if (def.unit === 'percent') {
                ptDelta = delta;
              }

              let impact: Impact = 'unknown';
              if (def.direction === 'higher_is_buff') {
                impact = delta > 0 ? 'buff' : 'nerf';
              } else if (def.direction === 'lower_is_buff') {
                impact = delta < 0 ? 'buff' : 'nerf';
              }

              diffs.push({
                championId: targetChampionId,
                variantKey,
                fieldKey: statKey,
                fieldLabelVi: def.labelVi,
                fieldLabelEn: def.labelEn,
                unit: def.unit,
                starLevel: star,
                kind: isStarScaled ? 'text' : 'numeric',
                before: beforeDatum,
                after: afterDatum,
                absoluteDelta: delta,
                relativeDeltaPercent: relPercent,
                percentagePointDelta: ptDelta,
                impact,
                impactReason: `${def.labelVi} ${delta > 0 ? 'tăng' : 'giảm'}`,
                requiresReview: false
              });
            }
          } else if (beforeDatum.state !== afterDatum.state) {
            diffs.push({
              championId: targetChampionId,
              variantKey,
              fieldKey: statKey,
              fieldLabelVi: def.labelVi,
              fieldLabelEn: def.labelEn,
              unit: def.unit,
              starLevel: star,
              kind: 'availability',
              before: beforeDatum,
              after: afterDatum,
              absoluteDelta: null,
              relativeDeltaPercent: null,
              percentagePointDelta: null,
              impact: 'unknown',
              impactReason: 'Trạng thái có sẵn dữ liệu thay đổi',
              requiresReview: true
            });
          }
        }
      }
    }

    // 2. Compare abilities (gameplay parameters only; description translations do not generate gameplay diffs)
    const fromAbilitiesMap = new Map(fromVariant.abilities.map((a) => [a.abilityKey, a]));
    const toAbilitiesMap = new Map(toVariant.abilities.map((a) => [a.abilityKey, a]));
    const allAbilityKeys = new Set([...fromAbilitiesMap.keys(), ...toAbilitiesMap.keys()]);

    for (const abilityKey of allAbilityKeys) {
      const fromAbility = fromAbilitiesMap.get(abilityKey);
      const toAbility = toAbilitiesMap.get(abilityKey);

      if (!fromAbility && toAbility) {
        const nameVi = toAbility.name.vi.state === "known" ? toAbility.name.vi.value : abilityKey;
        const nameEn = toAbility.name.en.state === "known" ? toAbility.name.en.value : abilityKey;
        diffs.push({
          championId: targetChampionId,
          variantKey,
          fieldKey: `ability_${abilityKey}`,
          fieldLabelVi: `Kỹ năng mới: ${nameVi}`,
          fieldLabelEn: `New ability: ${nameEn}`,
          unit: 'flat',
          starLevel: null,
          kind: 'availability',
          before: missingD("Kỹ năng mới"),
          after: { state: 'known', value: abilityKey, sourceRefIds: [], quality: 'extracted', origin: 'source' },
          absoluteDelta: null,
          relativeDeltaPercent: null,
          percentagePointDelta: null,
          impact: 'unknown',
          impactReason: `Thêm kỹ năng ${nameVi}`,
          requiresReview: true
        });
        continue;
      }

      if (fromAbility && !toAbility) {
        const nameVi = fromAbility.name.vi.state === "known" ? fromAbility.name.vi.value : abilityKey;
        const nameEn = fromAbility.name.en.state === "known" ? fromAbility.name.en.value : abilityKey;
        diffs.push({
          championId: targetChampionId,
          variantKey,
          fieldKey: `ability_${abilityKey}`,
          fieldLabelVi: `Kỹ năng bị xóa: ${nameVi}`,
          fieldLabelEn: `Removed ability: ${nameEn}`,
          unit: 'flat',
          starLevel: null,
          kind: 'availability',
          before: { state: 'known', value: abilityKey, sourceRefIds: [], quality: 'extracted', origin: 'source' },
          after: missingD("Kỹ năng bị xóa"),
          absoluteDelta: null,
          relativeDeltaPercent: null,
          percentagePointDelta: null,
          impact: 'unknown',
          impactReason: `Xóa kỹ năng ${nameVi}`,
          requiresReview: true
        });
        continue;
      }

      if (fromAbility && toAbility) {
        const fromParamsMap = new Map(fromAbility.parameters.map((p) => [p.key, p]));
        const toParamsMap = new Map(toAbility.parameters.map((p) => [p.key, p]));
        const allParamKeys = new Set([...fromParamsMap.keys(), ...toParamsMap.keys()]);

        for (const paramKey of allParamKeys) {
          const fromParam = fromParamsMap.get(paramKey);
          const toParam = toParamsMap.get(paramKey);

          if (!fromParam && toParam) {
            diffs.push({
              championId: targetChampionId,
              variantKey,
              fieldKey: `ability_${abilityKey}_${paramKey}`,
              fieldLabelVi: toParam.labelVi,
              fieldLabelEn: toParam.labelEn,
              unit: toParam.unit,
              starLevel: null,
              kind: 'availability',
              before: missingD("Tham số mới"),
              after: { state: 'known', value: 0, sourceRefIds: [], quality: 'extracted', origin: 'source' },
              absoluteDelta: null,
              relativeDeltaPercent: null,
              percentagePointDelta: null,
              impact: 'unknown',
              impactReason: `Thêm tham số ${toParam.labelVi}`,
              requiresReview: true
            });
            continue;
          }

          if (fromParam && !toParam) {
            diffs.push({
              championId: targetChampionId,
              variantKey,
              fieldKey: `ability_${abilityKey}_${paramKey}`,
              fieldLabelVi: fromParam.labelVi,
              fieldLabelEn: fromParam.labelEn,
              unit: fromParam.unit,
              starLevel: null,
              kind: 'availability',
              before: { state: 'known', value: 0, sourceRefIds: [], quality: 'extracted', origin: 'source' },
              after: missingD("Tham số bị xóa"),
              absoluteDelta: null,
              relativeDeltaPercent: null,
              percentagePointDelta: null,
              impact: 'unknown',
              impactReason: `Xóa tham số ${fromParam.labelVi}`,
              requiresReview: true
            });
            continue;
          }

          if (fromParam && toParam) {
            const starLevels: StarLevel[] = [1, 2, 3, 4];
            for (const star of starLevels) {
              const beforeDatum = fromParam.byStar[star];
              const afterDatum = toParam.byStar[star];

              if (!beforeDatum || !afterDatum) continue;

              if (beforeDatum.state === 'known' && afterDatum.state === 'known') {
                const delta = afterDatum.value - beforeDatum.value;
                if (Math.abs(delta) > 1e-6) {
                  const relPercent = beforeDatum.value !== 0 ? (delta / Math.abs(beforeDatum.value)) * 100 : null;
                  diffs.push({
                    championId: targetChampionId,
                    variantKey,
                    fieldKey: `ability_${abilityKey}_${paramKey}`,
                    fieldLabelVi: toParam.labelVi,
                    fieldLabelEn: toParam.labelEn,
                    unit: toParam.unit,
                    starLevel: star,
                    kind: 'numeric',
                    before: beforeDatum,
                    after: afterDatum,
                    absoluteDelta: delta,
                    relativeDeltaPercent: relPercent,
                    percentagePointDelta: toParam.unit === 'percent' ? delta : null,
                    impact: delta > 0 ? 'buff' : 'nerf',
                    impactReason: `${toParam.labelVi} ${delta > 0 ? 'tăng' : 'giảm'}`,
                    requiresReview: false
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return diffs;
}
