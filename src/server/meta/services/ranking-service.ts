import { metaRepository } from "../repositories/meta-repository";
import { SET18_ARCHETYPES } from "../../../domain/meta/archetypes";
import { calculateWebsiteConsensus } from "../../../domain/meta/source-votes";
import { calculateEliteWeights, MatchAppearance } from "../../../domain/meta/elite-weights";
import { evaluateEliteCompEligibility } from "../../../domain/meta/eligibility";
import { calculateGlobalMacroRanking } from "../../../domain/meta/global-ranking";
import {
  RankingSnapshot,
  RankingRow,
  RegionalRankMetrics,
  Tier,
  RankingStatus,
  SourceCompObservation
} from "../../../domain/meta/schemas";
import {
  NEUTRAL_BASELINE,
  BaselineMetrics,
  scoreToCandidateTier
} from "../../../domain/meta/performance-score";
import { getDb } from "../../db/client";
import {
  metaMatches,
  metaMatchParticipants,
  metaClassifications,
  metaCohortMembers,
  metaCohortSnapshots
} from "../../db/schema-meta";
import { and, gte, lte, eq, desc, ne } from "drizzle-orm";
import { getCurrentLivePatchEpochId, getPatchEpoch } from "../../../domain/meta/patch-epochs";

export class RankingService {
  /**
   * Tính toán bảng xếp hạng Mục A: Tổng hợp các trang meta
   */
  async computeWebsitesRanking(
    patchEpochId: string = getCurrentLivePatchEpochId(),
    datasetKind: "real" | "demo" = "demo"
  ): Promise<RankingSnapshot> {
    const archetypes = await metaRepository.listArchetypes(datasetKind);
    const observations = await metaRepository.getLatestSourceObservations(
      patchEpochId,
      datasetKind
    );

    const asOf = new Date().toISOString();
    const snapshotId = datasetKind === "demo"
      ? `rank_websites_${patchEpochId}_demo_round11`
      : `rank_websites_${patchEpochId}_${Date.now()}`;

    const rows: RankingRow[] = [];
    let rankedS = 0;
    let rankedA = 0;
    let rankedB = 0;
    let rankedC = 0;
    let provisionalCount = 0;
    let collectingCount = 0;
    const warnings: string[] = [];

    const validObservations = observations.filter((o) => o.status === "valid");
    const quarantinedObservations = observations.filter((o) => o.status === "quarantined");

    // P0-06: Disqualify ambiguous and unmatched observations from consensus ranking
    const qualifiedObservations = validObservations.filter((o) => {
      const reviewStatus = (o.inferred as any)?.reviewStatus;
      if (datasetKind === "real" && reviewStatus !== "auto_matched" && reviewStatus !== "approved") {
        warnings.push(`Loại bỏ quan sát ${o.id} (${o.sourceId} - ${o.originalName}) khỏi ranking do mapping ${reviewStatus || "missing_review_status"}`);
        return false;
      }
      return o.archetypeId !== null;
    });

    for (const archetype of archetypes) {
      const archObs = qualifiedObservations.filter((o) => o.archetypeId === archetype.id);
      const consensus = calculateWebsiteConsensus(archObs);

      if (consensus.tier === "S") rankedS++;
      else if (consensus.tier === "A") rankedA++;
      else if (consensus.tier === "B") rankedB++;
      else if (consensus.tier === "C") rankedC++;

      if (consensus.status === "provisional") provisionalCount++;
      if (consensus.status === "collecting") collectingCount++;

      // Định dạng sourceVotes cho giao diện
      const sourceVotesFormatted: Record<string, any> = {};
      for (const [sourceId, vote] of Object.entries(consensus.votes)) {
        sourceVotesFormatted[sourceId] = {
          originalTier: vote.originalTier,
          normalizedVote: vote.voteScore,
          isStatistical: vote.isStatistical,
          sourceUpdatedAt: vote.sourceUpdatedAt
        };
      }

      // Xác định board và items theo mode - P0-06 & Section 3.6: Chọn một sourceBuildId cụ thể chất lượng cao nhất, không ghép board hỗn tạp
      let resolvedBoard: any[] = [];
      const resolvedItems: Record<string, string[]> = {};
      let selectedSourceBuildId: string | null = null;
      let selectionReason: string | null = null;
      const availableSourceBuilds: string[] = [];

      if (datasetKind === "real" || datasetKind === "demo") {
        for (const o of archObs) {
          if (o.builds) {
            for (const b of o.builds) {
              availableSourceBuilds.push(b.id);
            }
          }
        }

        let bestBuildObs: any = null;
        let bestBuild: any = null;

        const buildQuality = (build: any): number[] => {
          const completeness = build.boardCompleteness === "exact"
            ? 3
            : build.boardCompleteness === "conditional"
              ? 2
              : 1;
          const units = Array.isArray(build.units) ? build.units : [];
          const positioned = units.filter((unit: any) => unit.position !== null && unit.position !== undefined).length;
          const mappedItems = units.flatMap((unit: any) => unit.items || []).filter((item: any) => Boolean(item.itemId)).length;
          return [completeness, positioned, mappedItems, units.length];
        };

        const isHigherQuality = (candidate: any, current: any): boolean => {
          const left = buildQuality(candidate);
          const right = buildQuality(current);
          for (let i = 0; i < left.length; i++) {
            if (left[i] !== right[i]) return left[i] > right[i];
          }
          return false;
        };

        for (const o of archObs) {
          if (!o.builds || o.builds.length === 0) continue;
          for (const b of o.builds) {
            if (!Array.isArray(b.units) || b.units.length === 0) continue;
            if (!bestBuild) {
              bestBuildObs = o;
              bestBuild = b;
              continue;
            }
            if (isHigherQuality(b, bestBuild)) {
              bestBuildObs = o;
              bestBuild = b;
            }
          }
        }

        if (bestBuild && bestBuildObs) {
          selectedSourceBuildId = bestBuild.id;
          const hasPos = bestBuild.units && bestBuild.units.some((u: any) => u.position !== null);
          selectionReason = bestBuild.boardCompleteness === "exact" && hasPos
            ? "highest_quality_exact_board_with_positioning"
            : (bestBuild.boardCompleteness === "exact" ? "exact_board_without_positioning" : "partial_board");

          resolvedBoard = (bestBuild.units || []).map((u: any) => ({
            championId: u.championId || u.sourceChampionKey,
            cost: u.cost,
            tier: u.starLevel !== undefined && u.starLevel !== null ? u.starLevel : null,
            position: u.position,
            items: (u.items || []).map((it: any) => it.itemId).filter(Boolean),
            isCarry: Boolean(u.isCarry),
            boardProvenance: {
              sourceId: bestBuildObs.sourceId,
              observationId: bestBuildObs.id,
              buildId: bestBuild.id,
              sourceUrl: bestBuildObs.sourceUrl || null,
              sourceLocator: bestBuild.sourceLocator || null,
              rawArtifactId: bestBuild.rawArtifactId || bestBuildObs.rawArtifactId || null,
              rawLocator: bestBuild.rawLocator || null,
              boardCompleteness: bestBuild.boardCompleteness,
              sourceVariantKey: bestBuild.sourceVariantKey || null
            }
          }));

          for (const u of bestBuild.units || []) {
            if (u.items && u.items.length > 0) {
              const cid = u.championId || u.sourceChampionKey;
              const mappedItems = u.items.map((it: any) => it.itemId).filter(Boolean);
              if (mappedItems.length > 0) resolvedItems[cid] = mappedItems;
            }
          }
        }
      }

      rows.push({
        archetypeId: archetype.id,
        archetypeNameVi: archetype.nameVi,
        archetypeNameEn: archetype.nameEn,
        coreCarryChampionId: archetype.coreCarryChampionId,
        coreTankChampionId: archetype.coreTankChampionId,
        coreChampionIds: archetype.coreChampionIds,
        keyTraits: archetype.keyTraitIds,
        playstyle: archetype.playstyle,
        variantId: archetype.defaultVariantId,
        score: consensus.score,
        tier: consensus.tier,
        candidateTier: consensus.candidateTier,
        status: consensus.status,
        consensusLabel: consensus.consensusLabel,
        sourceVotes: sourceVotesFormatted,
        validSourceCount: consensus.validGroupCount,
        totalSourceCount: consensus.totalGroupCount,
        rawMetrics: {
          appearances: 0,
          uniqueMatches: 0,
          uniqueAccounts: 0,
          rawTop4Rate: null,
          rawWinRate: null,
          rawAveragePlacement: null,
          cohortPickShare: null
        },
        adjustedMetrics: {
          adjustedTop4Rate: null,
          adjustedWinRate: null,
          adjustedAveragePlacement: null,
          weightMass: 0,
          nEffective: 0
        },
        regionalBreakdown: {},
        reasonCodes: consensus.warnings,
        evidenceRefIds: archObs.flatMap((o) => o.evidenceRefIds),
        requiredConditions: archetype.requiredConditions,
        recommendedBoard: resolvedBoard,
        recommendedItems: resolvedItems,
        selectedSourceBuildId,
        selectionReason,
        availableSourceBuilds
      });
    }

    // Sắp xếp thứ tự: Tier S -> A -> B -> C -> null, sau đó theo điểm giảm dần
    const tierOrder: Record<string, number> = { S: 1, A: 2, B: 3, C: 4 };
    rows.sort((a, b) => {
      const rankA = a.tier ? tierOrder[a.tier] : 99;
      const rankB = b.tier ? tierOrder[b.tier] : 99;
      if (rankA !== rankB) return rankA - rankB;
      return (b.score || 0) - (a.score || 0);
    });

    const isAllCollecting = collectingCount === archetypes.length;
    const hasAnyRanked = rankedS + rankedA + rankedB + rankedC > 0;
    const publicationStatus = isAllCollecting ? "collecting" : (hasAnyRanked ? "published" : "provisional");

    const effectiveSourceSet = new Set<any>();
    for (const obs of qualifiedObservations) {
      if (obs.sourceId) effectiveSourceSet.add(obs.sourceId);
    }
    const effectiveSources = datasetKind === "real"
      ? Array.from(effectiveSourceSet)
      : ["metatft", "tftacademy", "tftflex", "datatft", "tactics_tools"];
    const requestedSources = ["metatft", "tftacademy", "tftflex", "datatft", "tactics_tools"] as any[];
    const sourceUpdatedTimes = qualifiedObservations
      .map((observation) => observation.sourceUpdatedAt)
      .filter(Boolean)
      .map((value) => new Date(value!).getTime())
      .filter((value) => Number.isFinite(value));
    const latestSourceUpdatedAt = sourceUpdatedTimes.length > 0
      ? new Date(Math.max(...sourceUpdatedTimes)).toISOString()
      : null;

    const rankScopesBySource: Record<string, string> = {};
    if (datasetKind === "real") {
      for (const obs of qualifiedObservations) {
        if (obs.sourceId && obs.scope?.rankScope) {
          rankScopesBySource[obs.sourceId] = obs.scope.rankScope;
        }
      }
    } else {
      rankScopesBySource["metatft"] = "Diamond+";
      rankScopesBySource["tftacademy"] = "All";
      rankScopesBySource["tftflex"] = "All";
      rankScopesBySource["datatft"] = "Master+";
      rankScopesBySource["tactics_tools"] = "Diamond+";
    }

    // Requirement: Tách bốn timestamp: fetchedAt, sourcePublishedAt, sourceDataAsOf, rankingGeneratedAt.
    // sourceDataAsOf PHẢI suy ra từ metadata/receipt của source, KHÔNG lấy thời gian rankingGeneratedAt!
    // Tránh dùng Math.max làm che giấu observation cũ; tính theo từng source và lấy mốc an toàn.
    const sourceDataAsOfBySource: Record<string, string> = {};
    const perSourceDates = new Map<string, number[]>();

    for (const o of qualifiedObservations) {
      if (!o.sourceId) continue;
      const dStr = o.sourceDataAsOf || o.sourcePublishedAt || o.sourceUpdatedAt;
      if (dStr) {
        const t = new Date(dStr).getTime();
        if (!isNaN(t)) {
          if (!perSourceDates.has(o.sourceId)) perSourceDates.set(o.sourceId, []);
          perSourceDates.get(o.sourceId)!.push(t);
        }
      }
    }

    for (const [sid, dList] of perSourceDates.entries()) {
      sourceDataAsOfBySource[sid] = new Date(Math.min(...dList)).toISOString();
    }

    const allMinDates = Object.values(sourceDataAsOfBySource).map((d) => new Date(d).getTime());
    const sourceDataAsOf: string | null = allMinDates.length > 0
      ? new Date(Math.min(...allMinDates)).toISOString()
      : null;

    let fetchedAt: string | null = null;
    let sourcePublishedAt: string | null = null;

    if (qualifiedObservations.length > 0) {
      const fetchDates = qualifiedObservations
        .map((o) => o.fetchedAt || o.observedAt)
        .filter(Boolean)
        .map((d) => new Date(d!).getTime());
      if (fetchDates.length > 0) {
        fetchedAt = new Date(Math.max(...fetchDates)).toISOString();
      }
      const pubDates = qualifiedObservations
        .map((o) => o.sourcePublishedAt)
        .filter(Boolean)
        .map((d) => new Date(d!).getTime());
      if (pubDates.length > 0) {
        sourcePublishedAt = new Date(Math.min(...pubDates)).toISOString();
      }
    }

    const excludedFromConsensusCount = observations.length - qualifiedObservations.length;
    if (excludedFromConsensusCount > 0) {
      warnings.push(`${excludedFromConsensusCount} observations excluded from consensus because they were quarantined, unmapped, ambiguous, or unreviewed.`);
    }

    const rankingStatus = hasAnyRanked ? "ranked" : (isAllCollecting ? "collecting" : "provisional");

    const snapshot: RankingSnapshot = {
      id: snapshotId,
      datasetKind,
      publicationStatus: publicationStatus as any,
      status: rankingStatus as any,
      rankingScope: {
        datasetKind,
        boardType: "websites",
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        mode: "ranked_standard",
        patchEpochId,
        epochPrecision: "base_patch_only",
        requestedRegions: ["KR", "VN", "NA", "EUW"],
        effectiveRegions: ["Global"],
        cohortSnapshotIds: [],
        windowStart: null,
        windowEnd: null,
        windowHours: 72,
        requestedSources,
        effectiveSources,
        rankScopesBySource,
        sourceDataAsOfBySource,
        sourceIds: effectiveSources.length > 0 ? effectiveSources : requestedSources,
        sourceUpdatedAt: latestSourceUpdatedAt,
        rankFilter: datasetKind === "real" ? "All" : "Master+",
        asOf,
        rankingVersion: "meta-rank-v1",
        classifierVersion: "1.0.0",
        mappingVersion: "1.0.0",
        configHash: "websites_v1"
      },
      generatedAt: asOf,
      rankingGeneratedAt: asOf,
      sourceDataAsOf,
      fetchedAt,
      sourcePublishedAt,
      inputObservationIds: qualifiedObservations.map((o) => o.id),
      rows,
      totals: {
        totalArchetypes: archetypes.length,
        rankedTierS: rankedS,
        rankedTierA: rankedA,
        rankedTierB: rankedB,
        rankedTierC: rankedC,
        provisionalCount,
        collectingCount
      },
      coverage: {
        validObservations: validObservations.length,
        qualifiedObservationsCount: qualifiedObservations.length,
        quarantinedObservationsCount: quarantinedObservations.length,
        excludedFromConsensusCount,
        archetypesEvaluated: archetypes.length,
        mappedObservationsCount: qualifiedObservations.length,
        unmappedObservationsCount: observations.filter((o) => o.archetypeId === null).length,
        effectiveSources,
        rankScopesBySource,
        sourceDataAsOfBySource,
        requestedSources
      },
      warnings
    };

    await metaRepository.saveRankingSnapshot(snapshot);
    return snapshot;
  }

  /**
   * Tính toán bảng xếp hạng Mục B: Cao thủ các khu vực (từng vùng hoặc tổng hợp macro-average)
   */
  async computeEliteRanking(
    region: string = "all", // "KR", "VN", "NA", "EUW" hoặc "all"
    patchEpochId: string = getCurrentLivePatchEpochId(),
    windowHours: number = 72,
    datasetKind: "real" | "demo" = "demo"
  ): Promise<RankingSnapshot> {
    const db = await getDb();
    const archetypes = await metaRepository.listArchetypes();
    const asOfDate = new Date();
    const asOf = asOfDate.toISOString();
    const windowStartDate = new Date(asOfDate.getTime() - windowHours * 3600 * 1000);

    const requestedRegions = region === "all" ? ["KR", "VN", "NA", "EUW"] : [region];

    // 1. Tìm các snapshot cohort mới nhất của các khu vực được yêu cầu (R2, R4)
    const allCohortSnapshots = await db.select().from(metaCohortSnapshots);
    const latestCohortSnapshotByRegion: Map<string, any> = new Map();
    for (const reg of ["KR", "VN", "NA", "EUW"]) {
      const regCohorts = allCohortSnapshots.filter((s: any) => s.region === reg);
      if (regCohorts.length > 0) {
        regCohorts.sort((a: any, b: any) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
        latestCohortSnapshotByRegion.set(reg, regCohorts[0]);
      }
    }
    const cohortSnapshotIds = requestedRegions
      .map((r) => latestCohortSnapshotByRegion.get(r)?.id)
      .filter(Boolean);

    // Lấy toàn bộ thành viên thuộc cohort snapshots này
    const allCohortMembers = cohortSnapshotIds.length > 0
      ? await db.select().from(metaCohortMembers)
      : [];
    const activeCohortMembers = allCohortMembers.filter((m: any) =>
      cohortSnapshotIds.includes(m.snapshotId)
    );
    const cohortAccountKeySet = new Set(activeCohortMembers.map((m: any) => m.accountKey));

    // 2. Thu thập các trận đấu trong cửa sổ hợp lệ: queue 1100, đúng epoch, bounded asOf (R3, R4)
    const matches = await db
      .select()
      .from(metaMatches)
      .where(
        and(
          eq(metaMatches.datasetKind, datasetKind),
          eq(metaMatches.patchEpochId, patchEpochId),
          eq(metaMatches.queue, "1100"),
          eq(metaMatches.status, "valid"),
          ...(datasetKind === "real" ? [ne(metaMatches.rawArtifactId, "")] : []),
          gte(metaMatches.endedAt, windowStartDate),
          lte(metaMatches.endedAt, asOfDate)
        )
      );

    const matchKeys = matches.map((m: any) => m.matchKey);
    const matchKeySet = new Set(matchKeys);

    // Lấy participants và classifications của các trận đấu này
    const rawParticipants = matchKeys.length > 0
      ? await db
          .select()
          .from(metaMatchParticipants)
          .orderBy(desc(metaMatchParticipants.createdAt))
      : [];

    const classifications = matchKeys.length > 0
      ? await db.select().from(metaClassifications)
      : [];

    const classMap: Map<string, any> = new Map();
    for (const c of classifications) {
      classMap.set(`${c.matchKey}_${c.accountKey}`, c);
    }

    const matchMap: Map<string, any> = new Map();
    for (const m of matches) {
      matchMap.set(m.matchKey, m);
    }

    // Lọc participants: CHỈ GIỮ THÀNH VIÊN COHORT (R2)
    // Người ngoài cohort chỉ là bối cảnh lobby, không đưa vào mẫu số tính tỷ lệ
    const validMatchParticipants = rawParticipants.filter((p: any) => matchKeySet.has(p.matchKey));
    const cohortParticipants = validMatchParticipants.filter((p: any) => cohortAccountKeySet.has(p.accountKey));

    // 3. Tính toán theo từng khu vực
    const regionalArchetypeWeights: Record<string, Record<string, any>> = {};
    const regionalMetricsByArchetype: Record<string, Record<string, RegionalRankMetrics>> = {};
    const regionalCohortCounts: Record<string, number> = {};

    for (const reg of ["KR", "VN", "NA", "EUW"]) {
      regionalArchetypeWeights[reg] = {};
      regionalMetricsByArchetype[reg] = {};

      const regMatches = matches.filter((m: any) => m.region === reg);
      const regMatchKeys = new Set(regMatches.map((m: any) => m.matchKey));

      // Lọc participants của region NẰM TRONG COHORT (R2)
      const regCohortParticipants = cohortParticipants.filter((p: any) => regMatchKeys.has(p.matchKey));

      // Dedup theo cặp (matchKey, accountKey)
      const seenAppKeys = new Set<string>();
      const dedupedCohortParticipants: any[] = [];
      for (const p of regCohortParticipants) {
        const key = `${p.matchKey}_${p.accountKey}`;
        if (!seenAppKeys.has(key)) {
          seenAppKeys.add(key);
          dedupedCohortParticipants.push(p);
        }
      }
      regionalCohortCounts[reg] = dedupedCohortParticipants.length;

      // Tính Dynamic Cohort Baseline cho khu vực (R4):
      // Tính trên TOÀN BỘ các lượt chơi của cohort (bao gồm cả unclassified / ambiguous)
      let cohortBaseline: BaselineMetrics = NEUTRAL_BASELINE;
      if (dedupedCohortParticipants.length >= 10) {
        const totalApps = dedupedCohortParticipants.length;
        const top4Apps = dedupedCohortParticipants.filter((p: any) => p.placement <= 4).length;
        const winApps = dedupedCohortParticipants.filter((p: any) => p.placement === 1).length;
        const sumPlacement = dedupedCohortParticipants.reduce(
          (sum: number, p: any) => sum + p.placement,
          0
        );

        cohortBaseline = {
          top4Rate: Math.round((top4Apps / totalApps) * 10000) / 10000,
          avgPlacement: Math.round((sumPlacement / totalApps) * 10000) / 10000,
          winRate: Math.round((winApps / totalApps) * 10000) / 10000
        };
      }

      for (const archetype of archetypes) {
        const apps: MatchAppearance[] = [];

        for (const p of dedupedCohortParticipants) {
          const cls = classMap.get(`${p.matchKey}_${p.accountKey}`);
          if (cls && cls.status === "matched" && cls.archetypeId === archetype.id) {
            const m = matchMap.get(p.matchKey);
            apps.push({
              matchKey: p.matchKey,
              accountKey: p.accountKey,
              endedAt: m ? m.endedAt.toISOString() : asOf,
              placement: p.placement,
              isTop4: p.placement <= 4,
              isWin: p.placement === 1
            });
          }
        }

        const weights = calculateEliteWeights(apps, asOfDate, 48, 5);
        // Áp dụng dynamic cohort baseline thay cho hardcoded neutral baseline (R4)
        const eligibility = evaluateEliteCompEligibility(weights, cohortBaseline, 20);

        regionalMetricsByArchetype[reg][archetype.id] = {
          region: reg,
          appearances: weights.totalAppearances,
          uniqueMatches: weights.uniqueMatches,
          uniqueAccounts: weights.uniqueAccounts,
          top4Count: weights.top4Count,
          winCount: weights.winCount,
          weightMass: weights.weightMass,
          nEffective: weights.nEffective,
          rawTop4Rate: weights.rawTop4Rate,
          rawWinRate: weights.rawWinRate,
          rawAveragePlacement: weights.rawAveragePlacement,
          adjustedTop4Rate: eligibility.adjustedTop4Rate,
          adjustedWinRate: eligibility.adjustedWinRate,
          adjustedAveragePlacement: eligibility.adjustedAveragePlacement,
          regionalScore: eligibility.score,
          isPriorOnly: weights.totalAppearances === 0,
          status: eligibility.status
        };
      }
    }

    // 4. Tổng hợp thành RankingRows
    const snapshotId = datasetKind === "demo"
      ? `rank_elite_${region.toLowerCase()}_${windowHours}h_demo_round11`
      : `rank_elite_${region.toLowerCase()}_${windowHours}h_${Date.now()}`;
    const rows: RankingRow[] = [];

    let rankedS = 0;
    let rankedA = 0;
    let rankedB = 0;
    let rankedC = 0;
    let provisionalCount = 0;
    let collectingCount = 0;
    const isRealAndNoMatches = datasetKind === "real" && (matches.length === 0 || cohortParticipants.length === 0);

    for (const archetype of archetypes) {
      if (region === "all") {
        // Tổng hợp đa khu vực dùng Macro-Average
        const archRegionalMetrics: Record<string, RegionalRankMetrics> = {};
        for (const r of requestedRegions) {
          archRegionalMetrics[r] = regionalMetricsByArchetype[r][archetype.id];
        }

        const globalMacro = calculateGlobalMacroRanking(
          archRegionalMetrics,
          requestedRegions,
          ["KR", "VN", "NA", "EUW"]
        );

        if (!isRealAndNoMatches) {
          if (globalMacro.tier === "S") rankedS++;
          else if (globalMacro.tier === "A") rankedA++;
          else if (globalMacro.tier === "B") rankedB++;
          else if (globalMacro.tier === "C") rankedC++;

          if (globalMacro.status === "provisional") provisionalCount++;
          if (globalMacro.status === "collecting") collectingCount++;
        } else {
          collectingCount++;
        }

        rows.push({
          archetypeId: archetype.id,
          archetypeNameVi: archetype.nameVi,
          archetypeNameEn: archetype.nameEn,
          coreCarryChampionId: archetype.coreCarryChampionId,
          coreTankChampionId: archetype.coreTankChampionId,
          coreChampionIds: archetype.coreChampionIds,
          keyTraits: archetype.keyTraitIds,
          playstyle: archetype.playstyle,
          variantId: archetype.defaultVariantId,
          score: isRealAndNoMatches ? null : globalMacro.score,
          tier: isRealAndNoMatches ? null : globalMacro.tier,
          candidateTier: isRealAndNoMatches ? null : globalMacro.candidateTier,
          status: isRealAndNoMatches ? "collecting" : globalMacro.status,
          consensusLabel: undefined,
          sourceVotes: {},
          validSourceCount: 0,
          totalSourceCount: 5,
          rawMetrics: {
            appearances: globalMacro.totalAppearances,
            uniqueMatches: globalMacro.totalUniqueMatches,
            uniqueAccounts: globalMacro.totalUniqueAccounts,
            rawTop4Rate: globalMacro.globalRawTop4Rate,
            rawWinRate: globalMacro.globalRawWinRate,
            rawAveragePlacement: globalMacro.globalRawAveragePlacement,
            cohortPickShare: null
          },
          adjustedMetrics: {
            adjustedTop4Rate: null,
            adjustedWinRate: null,
            adjustedAveragePlacement: null,
            weightMass: 0,
            nEffective: 0
          },
          regionalBreakdown: archRegionalMetrics,
          reasonCodes: globalMacro.reasons,
          evidenceRefIds: [],
          requiredConditions: archetype.requiredConditions,
          recommendedBoard: datasetKind === "real" ? [] : (archetype.variants?.[0]?.recommendedBoard || []),
          recommendedItems: datasetKind === "real" ? {} : (archetype.recommendedItems || {})
        });
      } else {
        // Từng khu vực đơn lẻ
        const rm = regionalMetricsByArchetype[region][archetype.id];
        const candidateTier = scoreToCandidateTier(rm.regionalScore || 0);
        const tier = rm.status === "ranked" ? candidateTier : null;

        if (!isRealAndNoMatches) {
          if (tier === "S") rankedS++;
          else if (tier === "A") rankedA++;
          else if (tier === "B") rankedB++;
          else if (tier === "C") rankedC++;

          if (rm.status === "provisional") provisionalCount++;
          if (rm.status === "collecting") collectingCount++;
        } else {
          collectingCount++;
        }

        rows.push({
          archetypeId: archetype.id,
          archetypeNameVi: archetype.nameVi,
          archetypeNameEn: archetype.nameEn,
          coreCarryChampionId: archetype.coreCarryChampionId,
          coreTankChampionId: archetype.coreTankChampionId,
          coreChampionIds: archetype.coreChampionIds,
          keyTraits: archetype.keyTraitIds,
          playstyle: archetype.playstyle,
          variantId: archetype.defaultVariantId,
          score: isRealAndNoMatches ? null : rm.regionalScore,
          tier: isRealAndNoMatches ? null : tier,
          candidateTier: isRealAndNoMatches ? null : candidateTier,
          status: isRealAndNoMatches ? "collecting" : rm.status,
          consensusLabel: undefined,
          sourceVotes: {},
          validSourceCount: 0,
          totalSourceCount: 5,
          rawMetrics: {
            appearances: rm.appearances,
            uniqueMatches: rm.uniqueMatches,
            uniqueAccounts: rm.uniqueAccounts,
            rawTop4Rate: rm.rawTop4Rate,
            rawWinRate: rm.rawWinRate,
            rawAveragePlacement: rm.rawAveragePlacement,
            cohortPickShare: null
          },
          adjustedMetrics: {
            adjustedTop4Rate: rm.adjustedTop4Rate,
            adjustedWinRate: rm.adjustedWinRate,
            adjustedAveragePlacement: rm.adjustedAveragePlacement,
            weightMass: rm.weightMass,
            nEffective: rm.nEffective
          },
          regionalBreakdown: { [region]: rm },
          reasonCodes: [],
          evidenceRefIds: [],
          requiredConditions: archetype.requiredConditions,
          recommendedBoard: datasetKind === "real" ? [] : (archetype.variants?.[0]?.recommendedBoard || []),
          recommendedItems: datasetKind === "real" ? {} : (archetype.recommendedItems || {})
        });
      }
    }

    const tierOrder: Record<string, number> = { S: 1, A: 2, B: 3, C: 4 };
    rows.sort((a, b) => {
      const rankA = a.tier ? tierOrder[a.tier] : 99;
      const rankB = b.tier ? tierOrder[b.tier] : 99;
      if (rankA !== rankB) return rankA - rankB;
      return (b.score || 0) - (a.score || 0);
    });

    // Real Elite boards must come from a concrete Riot match participant. Never
    // fall back to the static archetype board or synthesize a roster/items.
    if (datasetKind === "real") {
      const representativeByArchetype = new Map<string, any>();
      const orderedParticipants = [...cohortParticipants].sort((a: any, b: any) => {
        const placementDelta = Number(a.placement || 99) - Number(b.placement || 99);
        if (placementDelta !== 0) return placementDelta;
        return String(a.matchKey).localeCompare(String(b.matchKey));
      });
      for (const participant of orderedParticipants) {
        const classification = classMap.get(`${participant.matchKey}_${participant.accountKey}`);
        if (!classification || classification.status !== "matched" || !classification.archetypeId) continue;
        if (!Array.isArray(participant.units) || participant.units.length === 0) continue;
        if (!representativeByArchetype.has(classification.archetypeId)) {
          representativeByArchetype.set(classification.archetypeId, participant);
        }
      }

      for (const row of rows) {
        const participant = representativeByArchetype.get(row.archetypeId);
        if (!participant) continue;
        const match = matchMap.get(participant.matchKey);
        const rawArtifactId = match?.rawArtifactId || null;
        const buildId = `riot_build_${participant.matchKey}_${participant.accountKey}`;
        row.recommendedBoard = (participant.units || []).map((unit: any) => ({
          championId: unit.championId,
          nameVi: unit.nameVi,
          nameEn: unit.nameEn,
          cost: unit.cost,
          tier: unit.tier ?? null,
          items: Array.isArray(unit.items) ? unit.items : [],
          position: unit.position ?? null,
          isCarry: Boolean(unit.isCarry),
          isTank: Boolean(unit.isTank),
          boardProvenance: {
            sourceId: "riot_tft_api",
            observationId: `riot_observation_${participant.matchKey}_${participant.accountKey}`,
            buildId,
            sourceUrl: null,
            sourceLocator: `match:${participant.matchKey}/account:${participant.accountKey}`,
            rawArtifactId,
            rawLocator: rawArtifactId ? `sha256-artifact:${rawArtifactId}` : null,
            boardCompleteness: "exact" as const
          }
        }));
        row.recommendedItems = {};
        for (const unit of row.recommendedBoard) {
          if (unit.items.length > 0) row.recommendedItems[unit.championId] = unit.items;
        }
        row.evidenceRefIds = rawArtifactId ? [rawArtifactId] : [];
        row.selectedSourceBuildId = buildId;
        row.selectionReason = "best_placement_riot_match_participant";
        row.availableSourceBuilds = [buildId];
      }
    }

    // 5. Xác định effectiveRegions & Coverage thực tế (R4)
    const effectiveRegions = requestedRegions.filter(
      (r) => (regionalCohortCounts[r] || 0) > 0
    );

    const uniqueCohortMatches = new Set(cohortParticipants.map((p: any) => p.matchKey)).size;
    const uniqueCohortAccounts = new Set(cohortParticipants.map((p: any) => p.accountKey)).size;
    const classifiedCohortCount = cohortParticipants.filter((p: any) => {
      const cls = classMap.get(`${p.matchKey}_${p.accountKey}`);
      return cls && cls.status === "matched";
    }).length;
    const unclassifiedCohortCount = cohortParticipants.length - classifiedCohortCount;

    const epochPrecision = getPatchEpoch(patchEpochId)?.precision || (patchEpochId.includes("hotfix") ? "hotfix_verified" : "patch_window");

    // Requirement 11: Giữ Elite real ở collecting cho đến khi có Riot API cohort + match evidence thật
    const isEliteCollecting = datasetKind === "real" && (cohortParticipants.length === 0 || rankedS + rankedA + rankedB + rankedC === 0);
    const publicationStatus = isEliteCollecting ? "collecting" : "published";

    const snapshot: RankingSnapshot = {
      id: snapshotId,
      datasetKind,
      publicationStatus: publicationStatus as any,
      rankingScope: {
        datasetKind,
        boardType: "elite",
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        mode: "ranked_standard",
        patchEpochId,
        epochPrecision,
        requestedRegions,
        effectiveRegions,
        cohortSnapshotIds,
        windowStart: windowStartDate.toISOString(),
        windowEnd: asOf,
        windowHours,
        sourceIds: [],
        rankFilter: "CHALLENGER Top 50",
        asOf,
        rankingVersion: "meta-rank-v1",
        classifierVersion: "1.0.0",
        mappingVersion: "1.0.0",
        configHash: `elite_${region}_v1`
      },
      generatedAt: asOf,
      rankingGeneratedAt: asOf,
      sourceDataAsOf: matches.length > 0
        ? (() => {
            const endedTimes = matches.map((m: any) => new Date(m.endedAt).getTime()).filter((value: number) => Number.isFinite(value));
            return endedTimes.length > 0 ? new Date(Math.max(...endedTimes)).toISOString() : null;
          })()
        : null,
      fetchedAt: matches.length > 0
        ? (() => {
            const receiptTimes = matches.map((m: any) => new Date(m.fetchedAt || "").getTime()).filter((value: number) => Number.isFinite(value));
            return receiptTimes.length > 0 ? new Date(Math.max(...receiptTimes)).toISOString() : null;
          })()
        : null,
      inputMatchKeys: matchKeys,
      rows: isEliteCollecting
        ? rows.map((r) => ({ ...r, status: "collecting" as const, tier: null, score: null }))
        : rows,
      totals: {
        totalArchetypes: archetypes.length,
        rankedTierS: rankedS,
        rankedTierA: rankedA,
        rankedTierB: rankedB,
        rankedTierC: rankedC,
        provisionalCount,
        collectingCount
      },
      coverage: {
        totalMatches: uniqueCohortMatches,
        totalParticipants: cohortParticipants.length,
        uniqueAccounts: uniqueCohortAccounts,
        classifiedCount: classifiedCohortCount,
        unclassifiedCount: unclassifiedCohortCount,
        windowStart: windowStartDate.toISOString(),
        windowEnd: asOf,
        patchEpochId,
        requestedRegions,
        effectiveRegions,
        cohortSnapshotIds,
        inputMatchKeys: matchKeys
      },
      warnings: []
    };

    await metaRepository.saveRankingSnapshot(snapshot);
    return snapshot;
  }
}

export const rankingService = new RankingService();
