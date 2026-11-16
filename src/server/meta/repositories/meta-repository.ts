import fs from "node:fs";
import path from "node:path";
import { getDb } from "../../db/client";
import { getCurrentLivePatchEpochId } from "../../../domain/meta/patch-epochs";
import {
  metaArchetypes,
  metaVariants,
  metaSourceSnapshots,
  metaSourceCompObservations,
  metaSourceMappings,
  metaCohortSnapshots,
  metaCohortMembers,
  metaMatches,
  metaMatchParticipants,
  metaCohortMatchLinks,
  metaClassifications,
  metaRankingSnapshots,
  metaRankingRows,
  metaRankingInputs,
  metaSourceCompBuilds,
  metaCurrentRankingPointers
} from "../../db/schema-meta";
import { eq, ne, and, inArray, desc, sql } from "drizzle-orm";
import {
  Archetype,
  Variant,
  SourceCompObservation,
  RankingSnapshot,
  RankingRow,
  CohortSnapshot,
  CohortMember,
  NormalizedMatch,
  MatchParticipant,
  BoardClassification
} from "../../../domain/meta/schemas";
import { getArchetypeById, SET18_ARCHETYPES } from "../../../domain/meta/archetypes";

import { championSnapshots } from "../../db/schema";
import { classifyUnitRole } from "../../../domain/meta/item-registry";
import { publicationService } from "../../services/publication-service";
import { isNonShopEntity } from "../../../domain/meta/board-validator";
import { auditObservationMapping } from "../../../domain/meta/mapping-audit";

interface ChampionCatalogItem {
  cost: number;
  nameVi: string;
  nameEn: string;
  icon?: string;
}

let championCatalogCache: Map<string, ChampionCatalogItem> | null = null;

async function getChampionCatalog(db: any): Promise<Map<string, ChampionCatalogItem>> {
  if (championCatalogCache) return championCatalogCache;
  const map = new Map<string, ChampionCatalogItem>();
  try {
    const rows = await db.select().from(championSnapshots);
    for (const r of rows) {
      const p = r.payload as any;
      if (p && p.championId) {
        map.set(p.championId, {
          cost: typeof p.cost === "object" ? p.cost?.value : (p.cost ?? 1),
          nameVi: typeof p.name?.vi === "object" ? p.name.vi?.value : (p.name?.vi || p.championId),
          nameEn: typeof p.name?.en === "object" ? p.name.en?.value : (p.name?.en || p.championId),
          icon: typeof p.icon === "object" ? p.icon?.value : p.icon
        });
      }
    }
  } catch (err) {
    console.warn("Could not load championSnapshots for catalog:", err);
  }
  championCatalogCache = map;
  return map;
}

const GLOBAL_CACHE_GEN_SYMBOL = Symbol.for("__tft_meta_cache_generation__");
export function getGlobalCacheGen(): number {
  return ((globalThis as any)[GLOBAL_CACHE_GEN_SYMBOL] ??= 0);
}
export function incGlobalCacheGen(): number {
  const next = getGlobalCacheGen() + 1;
  (globalThis as any)[GLOBAL_CACHE_GEN_SYMBOL] = next;
  return next;
}

export class MetaRepository {
  private get cacheGeneration() { return getGlobalCacheGen(); }
  private archetypeCache = new Map<string, { data: Archetype[]; generation: number; expiresAt: number }>();
  private rankingSnapshotCache = new Map<string, { data: RankingSnapshot; generation: number; expiresAt: number }>();
  private latestSnapshotCache = new Map<string, { data: RankingSnapshot | null; generation: number; expiresAt: number }>();
  private sourceObservationsCache = new Map<string, { data: SourceCompObservation[]; generation: number; expiresAt: number }>();

  public clearCache(): void {
    incGlobalCacheGen();
    championCatalogCache = null;
    this.archetypeCache.clear();
    this.rankingSnapshotCache.clear();
    this.latestSnapshotCache.clear();
    this.sourceObservationsCache.clear();
  }
  // 1. Archetypes & Variants
  async listArchetypes(mode: "real" | "demo" = "demo"): Promise<Archetype[]> {
    const readGen = this.cacheGeneration;
    const cached = this.archetypeCache.get(mode);
    if (cached && cached.generation === readGen && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const db = await getDb();
    const archetypes = await db.select().from(metaArchetypes);
    const variants = await db.select().from(metaVariants);
    const champCatalog = await getChampionCatalog(db);

    const buildsByArch: Record<
      string,
      {
        board: any[];
        items: Record<string, string[]>;
        carryId: string | null;
        tankId: string | null;
        coreIds: string[];
        conditions: string[];
        sourceUrl: string | null;
        evidenceId: string | null;
      }
    > = {};

    if (mode === "real") {
      const obsRows = await db
        .select({
          obs: metaSourceCompObservations,
          build: metaSourceCompBuilds
        })
        .from(metaSourceCompObservations)
        .leftJoin(metaSourceCompBuilds, eq(metaSourceCompObservations.id, metaSourceCompBuilds.observationId))
        .where(
          and(
            eq(metaSourceCompObservations.datasetKind, "real"),
            eq(metaSourceCompObservations.status, "valid")
          )
        )
        .orderBy(desc(metaSourceCompObservations.createdAt));

      for (const a of archetypes) {
        const archObsRows = obsRows.filter((r: any) => r.obs.archetypeId === a.id);
        const academyBuildRow = archObsRows.find((r: any) => r.obs.sourceId === "tftacademy" && r.build && r.build.boardKind === "primary");
        const primaryBuildRow =
          academyBuildRow ||
          archObsRows.find((r: any) => r.build && r.build.boardKind === "primary" && (r.build.units as any[])?.some((u: any) => u.position !== null)) ||
          archObsRows.find((r: any) => r.build && r.build.boardKind === "primary") ||
          archObsRows.find((r: any) => r.build);

        if (primaryBuildRow && primaryBuildRow.build) {
          const build = primaryBuildRow.build;
          const units = (build.units as any[]) || [];
          const sourceBoard = units.map((u: any) => {
            const cid = u.championId || u.sourceChampionKey;
            const cInfo = champCatalog.get(cid);
            const itemKeys = (u.items || []).map((it: any) => it.itemId || it.sourceItemKey);
            const role = classifyUnitRole(itemKeys);
            return {
              championId: cid,
              nameVi: cInfo?.nameVi,
              nameEn: cInfo?.nameEn,
              cost: cInfo?.cost ?? u.cost,
              tier: u.starLevel !== undefined && u.starLevel !== null ? u.starLevel : null,
              position: u.position,
              items: itemKeys,
              isCarry: role.isCarry,
              isTank: role.isTank,
              carryScore: role.carryScore,
              tankScore: role.tankScore
            };
          });

          const sourceItems: Record<string, string[]> = {};
          for (const u of units) {
            if (u.items && u.items.length > 0) {
              const cid = u.championId || u.sourceChampionKey;
              sourceItems[cid] = u.items.map((it: any) => it.itemId || it.sourceItemKey);
            }
          }

          let bestCarryId: string | null = null;
          let maxCarryScore = 0;
          let bestTankId: string | null = null;
          let maxTankScore = 0;
          for (const bu of sourceBoard) {
            if (isNonShopEntity(bu.championId)) continue;
            if (bu.isCarry && bu.carryScore > maxCarryScore) {
              maxCarryScore = bu.carryScore;
              bestCarryId = bu.championId;
            }
            if (bu.isTank && bu.tankScore > maxTankScore) {
              maxTankScore = bu.tankScore;
              bestTankId = bu.championId;
            }
          }
          const coreIds = sourceBoard
            .filter((bu: any) => (bu.items && bu.items.length > 0) || bu.isCarry || bu.isTank)
            .map((bu: any) => bu.championId);

          buildsByArch[a.id] = {
            board: sourceBoard,
            items: sourceItems,
            carryId: bestCarryId,
            tankId: bestTankId,
            coreIds: coreIds.length > 0 ? coreIds : sourceBoard.slice(0, 4).map((bu: any) => bu.championId),
            conditions: primaryBuildRow.obs.conditions || [],
            sourceUrl: primaryBuildRow.obs.sourceUrl || null,
            evidenceId: primaryBuildRow.obs.evidenceRefIds?.[0] || null
          };
        }
      }
    }

    const result: Archetype[] = archetypes.map((a: any) => {
      if (mode === "real") {
        const realBuild = buildsByArch[a.id];
        const hasRealBuild = Boolean(realBuild && realBuild.board.length > 0);
        return {
          ...a,
          aliases: a.aliases || [],
          coreCarryChampionId: hasRealBuild ? realBuild!.carryId : null,
          coreTankChampionId: hasRealBuild ? realBuild!.tankId : null,
          coreChampionIds: hasRealBuild ? realBuild!.coreIds : [],
          flexChampionIds: a.flexChampionIds || [],
          keyTraitIds: a.keyTraitIds || [],
          requiredConditions: hasRealBuild ? realBuild!.conditions : [],
          recommendedItems: hasRealBuild ? realBuild!.items : {},
          variants: variants
            .filter((v: any) => v.archetypeId === a.id)
            .map((v: any) => ({
              ...v,
              requiredItems: [],
              requiredAugments: [],
              requiredEmblems: [],
              substituteChampionIds: [],
              recommendedBoard: hasRealBuild ? realBuild!.board : [],
              sourceUrl: hasRealBuild ? realBuild!.sourceUrl : null,
              evidenceId: hasRealBuild ? realBuild!.evidenceId : null
            }))
        };
      }

      // Mode === "demo"
      return {
        ...a,
        aliases: a.aliases || [],
        coreChampionIds: a.coreChampionIds || [],
        flexChampionIds: a.flexChampionIds || [],
        keyTraitIds: a.keyTraitIds || [],
        requiredConditions: a.requiredConditions || [],
        recommendedItems: a.recommendedItems || {},
        variants: variants
          .filter((v: any) => v.archetypeId === a.id)
          .map((v: any) => {
            const staticBoard =
              getArchetypeById(a.id)?.variants?.find((sv) => sv.id === v.id)?.recommendedBoard ||
              getArchetypeById(a.id)?.variants?.[0]?.recommendedBoard ||
              [];
            return {
              ...v,
              requiredItems: v.requiredItems || [],
              requiredAugments: v.requiredAugments || [],
              requiredEmblems: v.requiredEmblems || [],
              substituteChampionIds: v.substituteChampionIds || [],
              recommendedBoard: v.recommendedBoard && v.recommendedBoard.length > 0 ? v.recommendedBoard : staticBoard
            };
          })
      };
    });
    if (this.cacheGeneration === readGen) {
      if (this.archetypeCache.size > 50) this.archetypeCache.clear();
      this.archetypeCache.set(mode, { data: result, generation: readGen, expiresAt: Date.now() + 30000 });
    }
    return result;
  }

  async getArchetypeById(id: string, mode: "real" | "demo" = "demo"): Promise<Archetype | null> {
    const db = await getDb();
    const rows = await db.select().from(metaArchetypes).where(eq(metaArchetypes.id, id));
    if (rows.length === 0) {
      if (mode === "real") return null;
      return getArchetypeById(id) || null;
    }
    const a = rows[0] as any;
    const variants = await db.select().from(metaVariants).where(eq(metaVariants.archetypeId, id));
    const champCatalog = await getChampionCatalog(db);

    if (mode === "real") {
      const obsRows = await db
        .select({
          obs: metaSourceCompObservations,
          build: metaSourceCompBuilds
        })
        .from(metaSourceCompObservations)
        .leftJoin(metaSourceCompBuilds, eq(metaSourceCompObservations.id, metaSourceCompBuilds.observationId))
        .where(
          and(
            eq(metaSourceCompObservations.archetypeId, id),
            eq(metaSourceCompObservations.datasetKind, "real"),
            eq(metaSourceCompObservations.status, "valid")
          )
        )
        .orderBy(desc(metaSourceCompObservations.createdAt));

      const academyBuildRow = obsRows.find((r: any) => r.obs.sourceId === "tftacademy" && r.build && r.build.boardKind === "primary");
      const primaryBuildRow =
        academyBuildRow ||
        obsRows.find((r: any) => r.build && r.build.boardKind === "primary" && (r.build.units as any[])?.some((u: any) => u.position !== null)) ||
        obsRows.find((r: any) => r.build && r.build.boardKind === "primary") ||
        obsRows.find((r: any) => r.build);

      let sourceBoard: any[] = [];
      const sourceItems: Record<string, string[]> = {};
      let bestCarryId: string | null = null;
      let bestTankId: string | null = null;
      let coreIds: string[] = [];

      if (primaryBuildRow && primaryBuildRow.build) {
        const build = primaryBuildRow.build;
        const units = (build.units as any[]) || [];
        sourceBoard = units.map((u: any) => {
          const cid = u.championId || u.sourceChampionKey;
          const cInfo = champCatalog.get(cid);
          const itemKeys = (u.items || []).map((it: any) => it.itemId || it.sourceItemKey);
          const role = classifyUnitRole(itemKeys);
          return {
            championId: cid,
            nameVi: cInfo?.nameVi,
            nameEn: cInfo?.nameEn,
            cost: cInfo?.cost ?? u.cost,
            tier: u.starLevel !== undefined && u.starLevel !== null ? u.starLevel : null,
            position: u.position,
            items: itemKeys,
            isCarry: role.isCarry,
            isTank: role.isTank,
            carryScore: role.carryScore,
            tankScore: role.tankScore
          };
        });

        for (const u of units) {
          if (u.items && u.items.length > 0) {
            const cid = u.championId || u.sourceChampionKey;
            sourceItems[cid] = u.items.map((it: any) => it.itemId || it.sourceItemKey);
          }
        }

        let maxCarryScore = 0;
        let maxTankScore = 0;
        for (const bu of sourceBoard) {
          if (isNonShopEntity(bu.championId)) continue;
          if (bu.isCarry && bu.carryScore > maxCarryScore) {
            maxCarryScore = bu.carryScore;
            bestCarryId = bu.championId;
          }
          if (bu.isTank && bu.tankScore > maxTankScore) {
            maxTankScore = bu.tankScore;
            bestTankId = bu.championId;
          }
        }
        coreIds = sourceBoard
          .filter((bu: any) => (bu.items && bu.items.length > 0) || bu.isCarry || bu.isTank)
          .map((bu: any) => bu.championId);
      }

      const hasRealBuild = sourceBoard.length > 0;
      return {
        ...a,
        aliases: a.aliases || [],
        coreCarryChampionId: hasRealBuild ? bestCarryId : null,
        coreTankChampionId: hasRealBuild ? bestTankId : null,
        coreChampionIds: hasRealBuild ? (coreIds.length > 0 ? coreIds : sourceBoard.slice(0, 4).map((bu: any) => bu.championId)) : [],
        flexChampionIds: a.flexChampionIds || [],
        keyTraitIds: a.keyTraitIds || [],
        requiredConditions: hasRealBuild ? (primaryBuildRow?.obs.conditions || []) : [],
        recommendedItems: hasRealBuild ? sourceItems : {},
        variants: variants.map((v: any) => ({
          ...v,
          requiredItems: [],
          requiredAugments: [],
          requiredEmblems: [],
          substituteChampionIds: [],
          recommendedBoard: hasRealBuild ? sourceBoard : [],
          sourceUrl: hasRealBuild ? (primaryBuildRow?.obs.sourceUrl || null) : null,
          evidenceId: hasRealBuild ? (primaryBuildRow?.obs.evidenceRefIds?.[0] || null) : null
        }))
      };
    }

    // Demo Mode
    const staticArch = getArchetypeById(id);
    return {
      ...a,
      aliases: a.aliases || [],
      coreChampionIds: a.coreChampionIds || [],
      flexChampionIds: a.flexChampionIds || [],
      keyTraitIds: a.keyTraitIds || [],
      requiredConditions: a.requiredConditions || [],
      recommendedItems: a.recommendedItems && Object.keys(a.recommendedItems).length > 0 ? a.recommendedItems : staticArch?.recommendedItems || {},
      variants: variants.map((v: any) => {
        const staticBoard = staticArch?.variants?.find((sv) => sv.id === v.id)?.recommendedBoard || [];
        return {
          ...v,
          requiredItems: v.requiredItems || [],
          requiredAugments: v.requiredAugments || [],
          requiredEmblems: v.requiredEmblems || [],
          substituteChampionIds: v.substituteChampionIds || [],
          recommendedBoard: v.recommendedBoard && v.recommendedBoard.length > 0 ? v.recommendedBoard : staticBoard
        };
      })
    };
  }

  async saveArchetype(archetype: Archetype): Promise<void> {
    try {
      const db = await getDb();
    await db
      .insert(metaArchetypes)
      .values({
        id: archetype.id,
        setNumber: archetype.setNumber,
        gameProduct: archetype.gameProduct,
        mode: archetype.mode,
        nameVi: archetype.nameVi,
        nameEn: archetype.nameEn,
        aliases: archetype.aliases,
        coreCarryChampionId: archetype.coreCarryChampionId,
        coreTankChampionId: archetype.coreTankChampionId,
        coreChampionIds: archetype.coreChampionIds,
        flexChampionIds: archetype.flexChampionIds,
        keyTraitIds: archetype.keyTraitIds,
        playstyle: archetype.playstyle,
        requiredConditions: archetype.requiredConditions,
        recommendedItems: archetype.recommendedItems,
        defaultVariantId: archetype.defaultVariantId,
        mappingVersion: archetype.mappingVersion,
        classifierVersion: archetype.classifierVersion
      })
      .onConflictDoUpdate({
        target: metaArchetypes.id,
        set: {
          nameVi: archetype.nameVi,
          nameEn: archetype.nameEn,
          aliases: archetype.aliases,
          coreCarryChampionId: archetype.coreCarryChampionId,
          coreTankChampionId: archetype.coreTankChampionId,
          coreChampionIds: archetype.coreChampionIds,
          flexChampionIds: archetype.flexChampionIds,
          keyTraitIds: archetype.keyTraitIds,
          playstyle: archetype.playstyle,
          requiredConditions: archetype.requiredConditions,
          recommendedItems: archetype.recommendedItems,
          defaultVariantId: archetype.defaultVariantId
        }
      });
if (archetype.variants && archetype.variants.length > 0) {
      for (const v of archetype.variants) {
        await db
          .insert(metaVariants)
          .values({
            id: v.id,
            archetypeId: archetype.id,
            nameVi: v.nameVi,
            nameEn: v.nameEn,
            conditionDescription: v.conditionDescription,
            requiredItems: v.requiredItems,
            requiredAugments: v.requiredAugments,
            requiredEmblems: v.requiredEmblems,
            substituteChampionIds: v.substituteChampionIds,
            recommendedBoard: v.recommendedBoard
          })
          .onConflictDoUpdate({
            target: metaVariants.id,
            set: {
              nameVi: v.nameVi,
              nameEn: v.nameEn,
              conditionDescription: v.conditionDescription,
              requiredItems: v.requiredItems,
              requiredAugments: v.requiredAugments,
              requiredEmblems: v.requiredEmblems,
              substituteChampionIds: v.substituteChampionIds,
              recommendedBoard: v.recommendedBoard
            }
          });
      }
    }
    } finally {
      this.clearCache();
    }
  }

  // 2. Source Observations
  async saveSourceObservations(
  
    snapshotId: string,
    sourceId: string,
    scope: any,
    observations: SourceCompObservation[],
    datasetKind: "real" | "demo" = "demo"
  ): Promise<void> {
    if (observations.length === 0) return;
    const db = await getDb();
    const firstObservation = observations[0];
    const mappingAuditRecords: any[] = [];
    await db
      .insert(metaSourceSnapshots)
      .values({
        id: snapshotId,
        sourceId,
        datasetKind,
        scope,
        status: datasetKind === "real" ? "staging" : "published",
        rawArtifactId: firstObservation?.rawArtifactId || "",
        fetchedAt: firstObservation?.fetchedAt ? new Date(firstObservation.fetchedAt) : new Date(),
        sourcePublishedAt: firstObservation?.sourcePublishedAt ? new Date(firstObservation.sourcePublishedAt) : null,
        sourceDataAsOf: firstObservation?.sourceDataAsOf ? new Date(firstObservation.sourceDataAsOf) : null,
        sourceUpdatedAt: firstObservation?.sourceUpdatedAt ? new Date(firstObservation.sourceUpdatedAt) : null
      })
      .onConflictDoUpdate({
        target: metaSourceSnapshots.id,
        set: {
          sourceId,
          datasetKind,
          scope,
          // A collector reusing a logical epoch snapshot ID must replace its
          // receipt metadata with the current content-addressed artifact. A
          // no-op conflict would leave the API pointing at the first run's
          // timestamp/artifact while observations have already been refreshed.
          status: datasetKind === "real" ? "staging" : "published",
          rawArtifactId: firstObservation?.rawArtifactId || "",
          fetchedAt: firstObservation?.fetchedAt ? new Date(firstObservation.fetchedAt) : new Date(),
          sourcePublishedAt: firstObservation?.sourcePublishedAt ? new Date(firstObservation.sourcePublishedAt) : null,
          sourceDataAsOf: firstObservation?.sourceDataAsOf ? new Date(firstObservation.sourceDataAsOf) : null,
          sourceUpdatedAt: firstObservation?.sourceUpdatedAt ? new Date(firstObservation.sourceUpdatedAt) : null
        }
      });

    for (const obs of observations) {
      // Source fields are strictly preserved as-is. Never auto-infer onto source fields!
      const mappingAudit = datasetKind === "real"
        ? auditObservationMapping(obs, SET18_ARCHETYPES)
        : null;
      mappingAuditRecords.push({
        schemaVersion: "round10.mapping-audit.v1",
        observationId: obs.id,
        datasetKind,
        sourceId: obs.sourceId,
        sourceCompId: obs.sourceCompId,
        sourceUrl: obs.sourceUrl,
        rawArtifactId: obs.rawArtifactId || null,
        sourceLeadChampionId: obs.sourceLeadChampionId || null,
        canonicalUnitSet: (obs.builds || []).flatMap((build) => build.units || []).map((unit) => unit.championId || null).filter(Boolean),
        candidates: mappingAudit?.candidates || [],
        selectedArchetypeId: mappingAudit?.selectedArchetypeId || null,
        selectedVariantId: mappingAudit?.selectedVariantId || null,
        reviewStatus: mappingAudit?.reviewStatus || (obs.inferred as any)?.reviewStatus || "unmatched",
        reason: mappingAudit?.reason || (obs.inferred as any)?.matchReason || "No board evidence available",
        evidenceRefIds: obs.evidenceRefIds || [],
        capturedAt: obs.fetchedAt || obs.observedAt
      });
      const strictDataTftWithoutBoard = datasetKind === "real" && obs.sourceId === "datatft" && !mappingAudit;
      const carryChampionId = obs.carryChampionId ?? null;
      const tankChampionId = obs.tankChampionId ?? null;
      const sourceLeadChampionId = obs.sourceLeadChampionId ?? null;
      const inferred = mappingAudit
        ? {
            ...(obs.inferred || {}),
            similarityScore: mappingAudit.candidates[0]?.score || 0,
            reviewStatus: mappingAudit.reviewStatus,
            candidateArchetypes: mappingAudit.candidates,
            evidence: [obs.rawArtifactId, ...(obs.evidenceRefIds || [])].filter(Boolean)
          }
        : strictDataTftWithoutBoard
          ? {
              ...(obs.inferred || {}),
              reviewStatus: "unmatched",
              candidateArchetypes: [],
              evidence: [obs.rawArtifactId, ...(obs.evidenceRefIds || [])].filter(Boolean),
              reason: "DataTFT không cung cấp board evidence; giữ mapping strict ở trạng thái unmatched"
            }
          : obs.inferred ?? null;
      const auditedArchetypeId = mappingAudit?.selectedArchetypeId || (strictDataTftWithoutBoard ? null : obs.archetypeId);
      const auditedVariantId = mappingAudit?.selectedVariantId || (strictDataTftWithoutBoard ? null : obs.variantId);
      const auditedStatus = strictDataTftWithoutBoard
        ? "quarantined"
        : (obs as any).status || (mappingAudit && mappingAudit.reviewStatus === "unmatched" ? "quarantined" : "valid");
      const auditedReason = strictDataTftWithoutBoard
        ? "missing_board_evidence_for_strict_mapping"
        : (obs as any).quarantineReason || (mappingAudit && mappingAudit.reviewStatus === "unmatched" ? mappingAudit.reason : null);
      const boardSourceEvidenceRefId = obs.boardSourceEvidenceRefId || (obs.evidenceRefIds && obs.evidenceRefIds[0]) || null;

      await db
        .insert(metaSourceCompObservations)
        .values({
          id: obs.id,
          snapshotId,
          sourceId: obs.sourceId,
          datasetKind: obs.datasetKind,
          sourceCompId: obs.sourceCompId,
          sourceUrl: obs.sourceUrl,
          archetypeId: auditedArchetypeId,
          variantId: auditedVariantId,
          originalName: obs.originalName,
          originalTier: obs.originalTier,
          classificationKind: obs.classificationKind,
          carryChampionId,
          tankChampionId,
          sourceLeadChampionId,
          inferred,
          boardSourceEvidenceRefId,
          fetchedAt: obs.fetchedAt ? new Date(obs.fetchedAt) : new Date(),
          sourcePublishedAt: obs.sourcePublishedAt ? new Date(obs.sourcePublishedAt) : null,
          sourceDataAsOf: obs.sourceDataAsOf ? new Date(obs.sourceDataAsOf) : null,
          metrics: obs.metrics,
          conditions: obs.conditions,
          evidenceRefIds: obs.evidenceRefIds || [],
          supersedesObservationId: obs.supersedesObservationId || null,
          status: auditedStatus,
          quarantineReason: auditedReason
        })
        .onConflictDoUpdate({
          target: metaSourceCompObservations.id,
          set: {
            sourceId: obs.sourceId,
            sourceUrl: obs.sourceUrl,
            archetypeId: auditedArchetypeId,
            variantId: auditedVariantId,
            originalName: obs.originalName,
            originalTier: obs.originalTier,
            classificationKind: obs.classificationKind,
            carryChampionId,
            tankChampionId,
            sourceLeadChampionId,
            inferred,
            boardSourceEvidenceRefId,
            fetchedAt: obs.fetchedAt ? new Date(obs.fetchedAt) : new Date(),
            sourcePublishedAt: obs.sourcePublishedAt ? new Date(obs.sourcePublishedAt) : null,
            sourceDataAsOf: obs.sourceDataAsOf ? new Date(obs.sourceDataAsOf) : null,
            metrics: obs.metrics,
            conditions: obs.conditions,
            evidenceRefIds: obs.evidenceRefIds,
            supersedesObservationId: obs.supersedesObservationId || null,
            status: auditedStatus,
            quarantineReason: auditedReason
          }
        });

      // Lưu các builds (board, items, positions) nếu có
      if (obs.builds && obs.builds.length > 0) {
        for (const b of obs.builds) {
          const completeness = b.boardCompleteness || "exact";
          const rawArtId = (b as any).rawArtifactId || obs.rawArtifactId || "";
          const rawLoc = (b as any).rawLocator || b.sourceLocator || "";
          const variantKey = (b as any).sourceVariantKey || b.label || null;
          const updated = (b as any).sourceUpdatedAt ? new Date((b as any).sourceUpdatedAt) : null;

          await db
            .insert(metaSourceCompBuilds)
            .values({
              id: b.id,
              observationId: obs.id,
              boardKind: b.boardKind,
              boardCompleteness: completeness,
              boardLevel: b.boardLevel ?? b.boardLevelMin ?? null,
              boardLevelMin: b.boardLevelMin ?? null,
              boardLevelMax: b.boardLevelMax ?? null,
              sourceVariantKey: variantKey,
              sourceUpdatedAt: updated,
              rawArtifactId: rawArtId,
              rawLocator: rawLoc,
              units: b.units,
              sourceLocator: b.sourceLocator || rawLoc,
              createdAt: b.createdAt ? new Date(b.createdAt) : new Date()
            })
            .onConflictDoUpdate({
              target: metaSourceCompBuilds.id,
              set: {
                boardKind: b.boardKind,
                boardCompleteness: completeness,
                boardLevel: b.boardLevel ?? b.boardLevelMin ?? null,
                boardLevelMin: b.boardLevelMin ?? null,
                boardLevelMax: b.boardLevelMax ?? null,
                sourceVariantKey: variantKey,
                sourceUpdatedAt: updated,
                rawArtifactId: rawArtId,
                rawLocator: rawLoc,
                units: b.units,
                sourceLocator: b.sourceLocator || rawLoc
              }
            });
        }
      }
    }

    if (datasetKind === "real") {
      const auditDir = path.resolve("./storage/mapping-audit", sourceId);
      fs.mkdirSync(auditDir, { recursive: true });
      const auditPath = path.join(auditDir, `${snapshotId}.json`);
      const tempPath = `${auditPath}.${process.pid}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify({
        schemaVersion: "round10.mapping-audit-batch.v1",
        snapshotId,
        sourceId,
        generatedAt: new Date().toISOString(),
        observations: mappingAuditRecords
      }, null, 2), "utf8");
      fs.renameSync(tempPath, auditPath);
    }
    this.clearCache();
  }

  async getSourceObservationsByIds(
    ids: string[]
  ): Promise<SourceCompObservation[]> {
    if (!ids || ids.length === 0) return [];
    const readGen = this.cacheGeneration;
    const sortedKey = `ids:${ids.slice().sort().join(",")}`;
    const cached = this.sourceObservationsCache.get(sortedKey);
    if (cached && cached.generation === readGen && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        obs: metaSourceCompObservations,
        snap: metaSourceSnapshots
      })
      .from(metaSourceCompObservations)
      .innerJoin(metaSourceSnapshots, eq(metaSourceCompObservations.snapshotId, metaSourceSnapshots.id))
      .where(inArray(metaSourceCompObservations.id, ids));

    if (rows.length === 0) return [];

    const obsIds = rows.map((r: any) => r.obs.id);
    const builds =
      obsIds.length > 0
        ? await db
            .select()
            .from(metaSourceCompBuilds)
            .where(inArray(metaSourceCompBuilds.observationId, obsIds))
        : [];

    const buildsByObsId = new Map<string, any[]>();
    for (const b of builds) {
      const list = buildsByObsId.get(b.observationId) || [];
      list.push({
        id: b.id,
        observationId: b.observationId,
        boardKind: b.boardKind,
        boardCompleteness: b.boardCompleteness || "exact",
        boardLevel: b.boardLevel,
        boardLevelMin: b.boardLevelMin,
        boardLevelMax: b.boardLevelMax,
        label: b.sourceVariantKey,
        units: b.units,
        sourceLocator: b.sourceLocator || b.rawLocator || "",
        rawArtifactId: b.rawArtifactId || "",
        rawLocator: b.rawLocator || "",
        sourceVariantKey: b.sourceVariantKey || null,
        sourceUpdatedAt: b.sourceUpdatedAt ? new Date(b.sourceUpdatedAt).toISOString() : null,
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : undefined
      });
      buildsByObsId.set(b.observationId, list);
    }

    const result = rows.map(({ obs: r, snap }: any) => {
      const scope = snap?.scope || {};
      return {
        id: r.id,
        datasetKind: r.datasetKind,
        sourceId: r.sourceId,
        sourceCompId: r.sourceCompId,
        sourceUrl: r.sourceUrl,
        rawArtifactId: snap?.rawArtifactId || "",
        observedAt: snap?.observedAt ? new Date(snap.observedAt).toISOString() : r.createdAt.toISOString(),
        sourceUpdatedAt: snap?.sourceUpdatedAt ? new Date(snap.sourceUpdatedAt).toISOString() : null,
        scope: {
          gameProduct: scope.gameProduct || "tft",
          setNumber: scope.setNumber || 18,
          channel: scope.channel || "live",
          mode: scope.mode || "ranked_standard",
          patchEpochId: scope.patchEpochId || "epoch_18_2",
          sourcePatchLabel: scope.sourcePatchLabel || "18.2",
          rankScope: r.sourceId === "tactics_tools" ? (scope.rankScope === "Master+" || !scope.rankScope || scope.rankScope === "All" ? "Diamond+" : scope.rankScope) : (scope.rankScope || "All"),
          regions: scope.regions || ["Global"],
          windowStart: scope.windowStart || null,
          windowEnd: scope.windowEnd || null
        },
        archetypeId: r.archetypeId,
        variantId: r.variantId,
        originalName: r.originalName,
        originalTier: r.originalTier,
        classificationKind: r.classificationKind,
        carryChampionId: r.carryChampionId || null,
        tankChampionId: r.tankChampionId || null,
        sourceLeadChampionId: r.sourceLeadChampionId || null,
        inferred: r.inferred || null,
        boardSourceEvidenceRefId: r.boardSourceEvidenceRefId || null,
        fetchedAt: r.fetchedAt ? new Date(r.fetchedAt).toISOString() : (snap?.fetchedAt ? new Date(snap.fetchedAt).toISOString() : r.createdAt.toISOString()),
        sourcePublishedAt: r.sourcePublishedAt ? new Date(r.sourcePublishedAt).toISOString() : (snap?.sourcePublishedAt ? new Date(snap.sourcePublishedAt).toISOString() : null),
        sourceDataAsOf: r.sourceDataAsOf ? new Date(r.sourceDataAsOf).toISOString() : (snap?.sourceDataAsOf ? new Date(snap.sourceDataAsOf).toISOString() : null),
        metrics: r.metrics || {},
        conditions: r.conditions || [],
        evidenceRefIds: r.evidenceRefIds || [],
        supersedesObservationId: r.supersedesObservationId || null,
        status: r.status || "valid",
        quarantineReason: r.quarantineReason || null,
        builds: buildsByObsId.get(r.id) || [],
        parserVersion: snap?.parserVersion || "1.0.0",
        mappingVersion: "1.0.0"
      };
    });
    if (this.cacheGeneration === readGen) {
      if (this.sourceObservationsCache.size > 200) this.sourceObservationsCache.clear();
      this.sourceObservationsCache.set(sortedKey, { data: result, generation: readGen, expiresAt: Date.now() + 60000 });
    }
    return result;
  }

  async getLatestSourceObservations(
    patchEpochId: string = getCurrentLivePatchEpochId(),
    datasetKind: "real" | "demo" = "demo"
  ): Promise<SourceCompObservation[]> {
    const cacheKey = `${datasetKind}:${patchEpochId}`;
    const cached = this.sourceObservationsCache.get(cacheKey);
    if (cached && cached.generation === this.cacheGeneration && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const readGen = this.cacheGeneration;
    const db = await getDb();
    const rows = await db
      .select({
        obs: metaSourceCompObservations,
        snap: metaSourceSnapshots
      })
      .from(metaSourceCompObservations)
      .innerJoin(metaSourceSnapshots, eq(metaSourceCompObservations.snapshotId, metaSourceSnapshots.id))
      .where(
        and(
          eq(metaSourceCompObservations.datasetKind, datasetKind),
          eq(metaSourceSnapshots.datasetKind, datasetKind),
          ne(metaSourceCompObservations.status, "quarantined"),
          ne(metaSourceCompObservations.status, "retracted"),
          ne(metaSourceCompObservations.status, "superseded"),
          ne(metaSourceSnapshots.status, "quarantined"),
          ne(metaSourceSnapshots.status, "retracted"),
          sql`${metaSourceSnapshots.scope}->>'patchEpochId' = ${patchEpochId}`
        )
      )
      .orderBy(desc(metaSourceCompObservations.createdAt));

    // Tập hợp các ID bị superseded
    const supersededIdSet = new Set<string>();
    for (const r of rows) {
      if ((r.obs as any).supersedesObservationId) {
        supersededIdSet.add((r.obs as any).supersedesObservationId);
      }
    }

    // Loại trùng theo logical key (sourceId, sourceCompId) và bảo đảm TFT Academy duy nhất theo URL guide
    const seenLogicalKeys = new Set<string>();
    const seenAcademyUrls = new Set<string>();
    const uniqueRows: typeof rows = [];
    for (const r of rows) {
      if (supersededIdSet.has(r.obs.id)) continue;
      if (r.obs.sourceId === "tftacademy") {
        if (seenAcademyUrls.has(r.obs.sourceUrl)) continue;
        seenAcademyUrls.add(r.obs.sourceUrl);
      }
      const logicalKey = `${r.obs.sourceId}:${r.obs.sourceCompId || r.obs.sourceUrl}`;
      if (seenLogicalKeys.has(logicalKey)) continue;
      seenLogicalKeys.add(logicalKey);
      uniqueRows.push(r);
    }

    // Nạp các builds tương ứng cho các observation duy nhất
    const obsIds = uniqueRows.map((r: any) => r.obs.id);
    const builds =
      obsIds.length > 0
        ? await db
            .select()
            .from(metaSourceCompBuilds)
            .where(inArray(metaSourceCompBuilds.observationId, obsIds))
        : [];

    const buildsByObsId = new Map<string, any[]>();
    for (const b of builds) {
      const list = buildsByObsId.get(b.observationId) || [];
      list.push({
        id: b.id,
        observationId: b.observationId,
        boardKind: b.boardKind,
        boardCompleteness: b.boardCompleteness || "exact",
        boardLevel: b.boardLevel,
        boardLevelMin: b.boardLevelMin,
        boardLevelMax: b.boardLevelMax,
        label: b.sourceVariantKey,
        units: b.units,
        sourceLocator: b.sourceLocator || b.rawLocator || "",
        rawArtifactId: b.rawArtifactId || "",
        rawLocator: b.rawLocator || "",
        sourceVariantKey: b.sourceVariantKey || null,
        sourceUpdatedAt: b.sourceUpdatedAt ? new Date(b.sourceUpdatedAt).toISOString() : null,
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : undefined
      });
      buildsByObsId.set(b.observationId, list);
    }

    const result: SourceCompObservation[] = uniqueRows.map(({ obs: r, snap }: any) => {
      const scope = snap?.scope || {};
      return {
        id: r.id,
        datasetKind: r.datasetKind,
        sourceId: r.sourceId,
        sourceCompId: r.sourceCompId,
        sourceUrl: r.sourceUrl,
        rawArtifactId: snap?.rawArtifactId || "",
        observedAt: snap?.observedAt ? new Date(snap.observedAt).toISOString() : r.createdAt.toISOString(),
        sourceUpdatedAt: snap?.sourceUpdatedAt ? new Date(snap.sourceUpdatedAt).toISOString() : null,
        scope: {
          gameProduct: scope.gameProduct || "tft",
          setNumber: scope.setNumber || 18,
          channel: scope.channel || "live",
          mode: scope.mode || "ranked_standard",
          patchEpochId: scope.patchEpochId || patchEpochId,
          sourcePatchLabel: scope.sourcePatchLabel || (patchEpochId === "epoch_18_1" ? "18.1" : "18.2"),
          rankScope: r.sourceId === "tactics_tools" ? (scope.rankScope === "Master+" || !scope.rankScope || scope.rankScope === "All" ? "Diamond+" : scope.rankScope) : (scope.rankScope || "All"),
          regions: scope.regions || ["Global"],
          windowStart: scope.windowStart || null,
          windowEnd: scope.windowEnd || null
        },
        archetypeId: r.archetypeId,
        variantId: r.variantId,
        originalName: r.originalName,
        originalTier: r.originalTier,
        classificationKind: r.classificationKind,
        carryChampionId: r.carryChampionId || null,
        tankChampionId: r.tankChampionId || null,
        sourceLeadChampionId: r.sourceLeadChampionId || null,
        inferred: r.inferred || null,
        boardSourceEvidenceRefId: r.boardSourceEvidenceRefId || null,
        fetchedAt: r.fetchedAt ? new Date(r.fetchedAt).toISOString() : (snap?.fetchedAt ? new Date(snap.fetchedAt).toISOString() : r.createdAt.toISOString()),
        sourcePublishedAt: r.sourcePublishedAt ? new Date(r.sourcePublishedAt).toISOString() : (snap?.sourcePublishedAt ? new Date(snap.sourcePublishedAt).toISOString() : null),
        sourceDataAsOf: r.sourceDataAsOf ? new Date(r.sourceDataAsOf).toISOString() : (snap?.sourceDataAsOf ? new Date(snap.sourceDataAsOf).toISOString() : null),
        metrics: r.metrics || {},
        conditions: r.conditions || [],
        evidenceRefIds: r.evidenceRefIds || [],
        supersedesObservationId: r.supersedesObservationId || null,
        status: r.status || "valid",
        quarantineReason: r.quarantineReason || null,
        builds: buildsByObsId.get(r.id) || [],
        parserVersion: snap?.parserVersion || "1.0.0",
        mappingVersion: "1.0.0"
      };
    });
    if (this.cacheGeneration === readGen) {
      if (this.sourceObservationsCache.size > 50) this.sourceObservationsCache.clear();
      this.sourceObservationsCache.set(cacheKey, { data: result, generation: readGen, expiresAt: Date.now() + 30000 });
    }
    return result;
  }

  // 3. Cohorts & Matches
  async saveCohortSnapshot(snapshot: CohortSnapshot): Promise<void> {
    const db = await getDb();
    await db
      .insert(metaCohortSnapshots)
      .values({
        id: snapshot.id,
        region: snapshot.region,
        capturedAt: new Date(snapshot.capturedAt),
        topN: snapshot.topN,
        queue: snapshot.queue,
        sourceUrl: snapshot.sourceUrl || "",
        rawArtifactId: snapshot.rawArtifactId || ""
      })
      .onConflictDoNothing();

    for (const member of snapshot.members) {
      await db
        .insert(metaCohortMembers)
        .values({
          snapshotId: snapshot.id,
          accountKey: member.accountKey,
          summonerName: member.summonerName,
          riotIdName: (member as any).riotIdName || "",
          riotIdTag: (member as any).riotIdTag || "",
          rank: member.rank,
          leaguePoints: member.leaguePoints,
          leaderboardRank: member.leaderboardRank
        })
        .onConflictDoNothing();
    }
    this.clearCache();
  }

  async saveNormalizedMatch(
    match: NormalizedMatch,
    cohortSnapshotId?: string,
    datasetKind: "real" | "demo" = "demo"
  ): Promise<void> {
    const db = await getDb();
    await db
      .insert(metaMatches)
      .values({
        matchKey: match.matchKey,
        provider: match.provider,
        region: match.region,
        gameMode: match.gameMode,
        queue: match.queue || "1100",
        setNumber: match.setNumber,
        patchEpochId: match.patchEpochId,
        gameVersion: match.gameVersion,
        startedAt: new Date(match.startedAt),
        endedAt: new Date(match.endedAt),
        durationSeconds: match.durationSeconds,
        rawArtifactId: match.rawArtifactId || "",
        fetchedAt: match.fetchedAt ? new Date(match.fetchedAt) : null,
        datasetKind,
        status: match.status || "valid",
        quarantineReason: match.quarantineReason || null
      })
      .onConflictDoUpdate({
        target: metaMatches.matchKey,
        set: {
          provider: match.provider,
          region: match.region,
          gameMode: match.gameMode,
          queue: match.queue || "1100",
          setNumber: match.setNumber,
          patchEpochId: match.patchEpochId,
          gameVersion: match.gameVersion,
          startedAt: new Date(match.startedAt),
          endedAt: new Date(match.endedAt),
          durationSeconds: match.durationSeconds,
          rawArtifactId: match.rawArtifactId || "",
          fetchedAt: match.fetchedAt ? new Date(match.fetchedAt) : null,
          datasetKind,
          status: match.status || "valid",
          quarantineReason: match.quarantineReason || null
        }
      });

    for (const p of match.participants) {
      await db
        .insert(metaMatchParticipants)
        .values({
          matchKey: match.matchKey,
          accountKey: p.accountKey,
          riotIdName: p.riotIdName,
          riotIdTag: p.riotIdTag,
          placement: p.placement,
          level: p.level,
          units: p.units,
          traits: p.traits,
          augments: p.augments,
          timeEliminated: p.timeEliminated,
          totalDamageToPlayers: p.totalDamageToPlayers
        })
        .onConflictDoNothing();

      const cohortAccountKeys = new Set(match.cohortAccountKeys || []);
      const shouldLink = Boolean(cohortSnapshotId) && (
        datasetKind === "demo" || cohortAccountKeys.has(p.accountKey)
      );
      if (shouldLink) {
        await db
          .insert(metaCohortMatchLinks)
          .values({
            cohortSnapshotId,
            accountKey: p.accountKey,
            matchKey: match.matchKey
          })
          .onConflictDoNothing();
      }
    }
    this.clearCache();
  }

  // 4. Classifications
  async saveClassification(cls: BoardClassification): Promise<void> {
    const db = await getDb();
    await db
      .insert(metaClassifications)
      .values({
        id: `${cls.matchKey}_${cls.accountKey}_${cls.classifierVersion}`,
        matchKey: cls.matchKey,
        accountKey: cls.accountKey,
        classifierVersion: cls.classifierVersion,
        status: cls.status,
        archetypeId: cls.archetypeId,
        variantId: cls.variantId,
        similarityScore: cls.similarityScore,
        matchedCoreUnits: cls.matchedCoreUnits,
        missingCoreUnits: cls.missingCoreUnits,
        matchedTraits: cls.matchedTraits,
        reason: cls.reason
      })
      .onConflictDoNothing();
    this.clearCache();
  }

  // 5. Ranking Snapshots & Rows
  async saveRankingSnapshot(snapshot: RankingSnapshot): Promise<void> {
    try {
    const db = await getDb();
    await db
      .insert(metaRankingSnapshots)
      .values({
        id: snapshot.id,
        datasetKind: snapshot.rankingScope.datasetKind,
        boardType: snapshot.rankingScope.boardType,
        patchEpochId: snapshot.rankingScope.patchEpochId,
        requestedRegions: snapshot.rankingScope.requestedRegions,
        effectiveRegions: snapshot.rankingScope.effectiveRegions,
        cohortSnapshotIds: snapshot.rankingScope.cohortSnapshotIds || [],
        epochPrecision: snapshot.rankingScope.epochPrecision || "base_patch_only",
        windowHours: snapshot.rankingScope.windowHours,
        asOf: new Date(snapshot.rankingScope.asOf),
        rankingVersion: snapshot.rankingScope.rankingVersion,
        classifierVersion: snapshot.rankingScope.classifierVersion,
        mappingVersion: snapshot.rankingScope.mappingVersion,
        configHash: snapshot.rankingScope.configHash,
        totals: snapshot.totals,
        coverage: snapshot.coverage,
        warnings: snapshot.warnings,
        status: snapshot.rankingScope.datasetKind === "real"
          ? (snapshot.publicationStatus === "collecting" ? "collecting" : "staging")
          : (snapshot.publicationStatus || "published"),
        inputObservationIds: snapshot.inputObservationIds || [],
        inputMatchKeys: snapshot.inputMatchKeys || [],
        sourceDataAsOf: snapshot.sourceDataAsOf ? new Date(snapshot.sourceDataAsOf) : null,
        fetchedAt: snapshot.fetchedAt ? new Date(snapshot.fetchedAt) : null,
        sourcePublishedAt: snapshot.sourcePublishedAt ? new Date(snapshot.sourcePublishedAt) : null,
        generatedAt: new Date(snapshot.generatedAt)
      })
      .onConflictDoUpdate({
        target: metaRankingSnapshots.id,
        set: {
          requestedRegions: snapshot.rankingScope.requestedRegions,
          effectiveRegions: snapshot.rankingScope.effectiveRegions,
          cohortSnapshotIds: snapshot.rankingScope.cohortSnapshotIds || [],
          epochPrecision: snapshot.rankingScope.epochPrecision || "base_patch_only",
          windowHours: snapshot.rankingScope.windowHours,
          asOf: new Date(snapshot.rankingScope.asOf),
          rankingVersion: snapshot.rankingScope.rankingVersion,
          classifierVersion: snapshot.rankingScope.classifierVersion,
          mappingVersion: snapshot.rankingScope.mappingVersion,
          configHash: snapshot.rankingScope.configHash,
          totals: snapshot.totals,
          coverage: snapshot.coverage,
          warnings: snapshot.warnings,
          status: snapshot.rankingScope.datasetKind === "real"
            ? (snapshot.publicationStatus === "collecting" ? "collecting" : "staging")
            : (snapshot.publicationStatus || "published"),
          inputObservationIds: snapshot.inputObservationIds || [],
          inputMatchKeys: snapshot.inputMatchKeys || [],
          sourceDataAsOf: snapshot.sourceDataAsOf ? new Date(snapshot.sourceDataAsOf) : null,
          fetchedAt: snapshot.fetchedAt ? new Date(snapshot.fetchedAt) : null,
          sourcePublishedAt: snapshot.sourcePublishedAt ? new Date(snapshot.sourcePublishedAt) : null,
          generatedAt: new Date(snapshot.generatedAt)
        }
      });

    for (const row of snapshot.rows) {
      await db
        .insert(metaRankingRows)
        .values({
          id: `${snapshot.id}_${row.archetypeId}`,
          rankingSnapshotId: snapshot.id,
          archetypeId: row.archetypeId,
          variantId: row.variantId,
          score: row.score,
          tier: row.tier,
          candidateTier: row.candidateTier,
          status: row.status,
          consensusLabel: row.consensusLabel,
          sourceVotes: row.sourceVotes,
          validSourceCount: row.validSourceCount,
          totalSourceCount: row.totalSourceCount,
          rawMetrics: row.rawMetrics,
          adjustedMetrics: row.adjustedMetrics,
          regionalBreakdown: row.regionalBreakdown,
          reasonCodes: row.reasonCodes,
          evidenceRefIds: row.evidenceRefIds,
          requiredConditions: row.requiredConditions,
          recommendedBoard: row.recommendedBoard,
          recommendedItems: row.recommendedItems,
          selectedSourceBuildId: row.selectedSourceBuildId || null,
          selectionReason: row.selectionReason || null,
          availableSourceBuilds: row.availableSourceBuilds || []
        })
        .onConflictDoUpdate({
          target: metaRankingRows.id,
          set: {
            archetypeId: row.archetypeId,
            variantId: row.variantId,
            score: row.score,
            tier: row.tier,
            candidateTier: row.candidateTier,
            status: row.status,
            consensusLabel: row.consensusLabel,
            sourceVotes: row.sourceVotes,
            validSourceCount: row.validSourceCount,
            totalSourceCount: row.totalSourceCount,
            rawMetrics: row.rawMetrics,
            adjustedMetrics: row.adjustedMetrics,
            regionalBreakdown: row.regionalBreakdown,
            reasonCodes: row.reasonCodes,
            evidenceRefIds: row.evidenceRefIds,
            requiredConditions: row.requiredConditions,
            recommendedBoard: row.recommendedBoard,
            recommendedItems: row.recommendedItems,
            selectedSourceBuildId: row.selectedSourceBuildId || null,
            selectionReason: row.selectionReason || null,
            availableSourceBuilds: row.availableSourceBuilds || []
          }
        });
    }

    const inputRows = [
      ...(snapshot.inputObservationIds || []).map((inputId) => ({ rankingSnapshotId: snapshot.id, inputType: "observation", inputId })),
      ...(snapshot.inputMatchKeys || []).map((inputId) => ({ rankingSnapshotId: snapshot.id, inputType: "match", inputId })),
      ...(snapshot.rankingScope.cohortSnapshotIds || []).map((inputId) => ({ rankingSnapshotId: snapshot.id, inputType: "cohort", inputId }))
    ];
    if (inputRows.length > 0) {
      await db.insert(metaRankingInputs).values(inputRows).onConflictDoNothing();
    }

    // In real mode, if requested publicationStatus is published, strictly pass through PublicationService gate
    if (snapshot.rankingScope.datasetKind === "real" && snapshot.publicationStatus === "published") {
      await publicationService.publishRanking({
        snapshotId: snapshot.id,
        datasetKind: "real",
        boardType: snapshot.rankingScope.boardType,
        patchEpochId: snapshot.rankingScope.patchEpochId,
        sourceDataAsOf: snapshot.sourceDataAsOf || undefined,
        fetchedAt: snapshot.fetchedAt || undefined,
        inputObservationIds: snapshot.inputObservationIds || [],
        inputMatchKeys: snapshot.inputMatchKeys || []
      });
    } else if (snapshot.rankingScope.datasetKind === "demo" && snapshot.publicationStatus === "published") {
      const rankedCount = (snapshot.totals.rankedTierS || 0) + (snapshot.totals.rankedTierA || 0) + (snapshot.totals.rankedTierB || 0) + (snapshot.totals.rankedTierC || 0);
      await this.updateCurrentRankingPointer({
        boardType: snapshot.rankingScope.boardType,
        patchEpochId: snapshot.rankingScope.patchEpochId,
        datasetKind: "demo",
        rankingSnapshotId: snapshot.id,
        inputCount: (snapshot.totals as any).inputCount || (snapshot.inputObservationIds ? snapshot.inputObservationIds.length : 0),
        rankedCount,
        fingerprint: `snap_${snapshot.id}`
      });
    }
      } finally {
      this.clearCache();
    }
  }

  async updateCurrentRankingPointer(params: {
    boardType: string;
    patchEpochId: string;
    datasetKind: string;
    rankingSnapshotId: string;
    inputCount: number;
    rankedCount: number;
    fingerprint?: string;
  }): Promise<void> {
    const db = await getDb();
    const pointerId = `pointer_${params.boardType}_${params.patchEpochId}_${params.datasetKind}`;
    const fingerprint = params.fingerprint || `snap_${params.rankingSnapshotId}`;
    await db
      .insert(metaCurrentRankingPointers)
      .values({
        id: pointerId,
        boardType: params.boardType,
        patchEpochId: params.patchEpochId,
        datasetKind: params.datasetKind,
        rankingSnapshotId: params.rankingSnapshotId,
        publishedAt: new Date(),
        inputCount: params.inputCount,
        rankedCount: params.rankedCount,
        fingerprint,
        createdAt: new Date()
      })
      .onConflictDoUpdate({
        target: metaCurrentRankingPointers.id,
        set: {
          rankingSnapshotId: params.rankingSnapshotId,
          publishedAt: new Date(),
          inputCount: params.inputCount,
          rankedCount: params.rankedCount,
          fingerprint
        }
      });
    // Post-commit generation fence and invalidation (AP-03)
    this.clearCache();
  }

  async getRankingSnapshot(id: string): Promise<RankingSnapshot | null> {
    const readGen = this.cacheGeneration;
    const cached = this.rankingSnapshotCache.get(id);
    if (cached && cached.generation === readGen && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const db = await getDb();
    const snaps = await db
      .select()
      .from(metaRankingSnapshots)
      .where(eq(metaRankingSnapshots.id, id));

    if (snaps.length === 0) return null;
    const snap = snaps[0] as any;
    const rows = await db
      .select()
      .from(metaRankingRows)
      .where(eq(metaRankingRows.rankingSnapshotId, id));

    const archetypes = await this.listArchetypes(snap.datasetKind as any);
    const archMap = new Map(archetypes.map((a) => [a.id, a]));

    const rankedCount = (snap.totals?.rankedTierS || 0) + (snap.totals?.rankedTierA || 0) + (snap.totals?.rankedTierB || 0) + (snap.totals?.rankedTierC || 0);
    const calculatedStatus = snap.status === "published"
      ? (rankedCount > 0 ? "ranked" : "collecting")
      : (snap.status === "staging" ? "provisional" : "collecting");

    const snapResult: RankingSnapshot = {
      id: snap.id,
      datasetKind: snap.datasetKind,
      publicationStatus: snap.status as any,
      status: calculatedStatus,
      quarantineReason: snap.quarantineReason || null,
      rankingScope: {
        datasetKind: snap.datasetKind,
        boardType: snap.boardType,
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        mode: "ranked_standard",
        patchEpochId: snap.patchEpochId,
        epochPrecision: snap.epochPrecision || "base_patch_only",
        requestedRegions: snap.requestedRegions || [],
        effectiveRegions: snap.effectiveRegions || [],
        cohortSnapshotIds: snap.cohortSnapshotIds || [],
        windowStart: snap.coverage?.windowStart || null,
        windowEnd: snap.coverage?.windowEnd || null,
        windowHours: snap.windowHours || 72,
        requestedSources: snap.coverage?.requestedSources || ["metatft", "tftacademy", "tftflex", "datatft", "tactics_tools"],
        effectiveSources: snap.coverage?.effectiveSources || [],
        rankScopesBySource: snap.coverage?.rankScopesBySource || {},
        sourceDataAsOfBySource: snap.coverage?.sourceDataAsOfBySource,
        sourceIds: snap.coverage?.effectiveSources || [],
        sourceUpdatedAt: snap.sourceUpdatedAt ? snap.sourceUpdatedAt.toISOString() : null,
        rankFilter: "All",
        asOf: snap.asOf.toISOString(),
        rankingVersion: snap.rankingVersion,
        classifierVersion: snap.classifierVersion,
        mappingVersion: snap.mappingVersion,
        configHash: snap.configHash
      },
      generatedAt: snap.generatedAt.toISOString(),
      rankingGeneratedAt: snap.generatedAt.toISOString(),
      sourceDataAsOf: snap.sourceDataAsOf ? snap.sourceDataAsOf.toISOString() : null,
      fetchedAt: snap.fetchedAt ? snap.fetchedAt.toISOString() : null,
      sourcePublishedAt: snap.sourcePublishedAt ? snap.sourcePublishedAt.toISOString() : null,
      inputObservationIds: snap.inputObservationIds || [],
      inputMatchKeys: snap.inputMatchKeys || [],
      totals: snap.totals || {},
      coverage: snap.coverage || {},
      warnings: snap.warnings || [],
      rows: rows.map((r: any) => {
        const arch = archMap.get(r.archetypeId);
        const isReal = snap.datasetKind === "real";
        const staticArch = isReal ? null : getArchetypeById(r.archetypeId);
        // Preserve the board selected by the ranking snapshot for both datasets.
        // Demo snapshots carry the same per-unit source/build provenance as real
        // snapshots; replacing that board with the static archetype fixture here
        // makes every demo row unverifiable and hides the selected build.
        const snapshotBoard = Array.isArray(r.recommendedBoard) ? r.recommendedBoard : [];
        const recommendedBoard = snapshotBoard.length > 0
          ? snapshotBoard
          : (arch?.variants?.[0]?.recommendedBoard && arch.variants[0].recommendedBoard.length > 0
              ? arch.variants[0].recommendedBoard
              : staticArch?.variants?.[0]?.recommendedBoard || []);
        const snapshotItems = r.recommendedItems && typeof r.recommendedItems === "object"
          ? r.recommendedItems
          : {};
        const recommendedItems = Object.keys(snapshotItems).length > 0
          ? snapshotItems
          : (arch?.recommendedItems && Object.keys(arch.recommendedItems).length > 0
              ? arch.recommendedItems
              : staticArch?.recommendedItems || {});

        return {
          archetypeId: r.archetypeId,
          archetypeNameVi: arch ? arch.nameVi : r.archetypeId,
          archetypeNameEn: arch ? arch.nameEn : r.archetypeId,
          coreCarryChampionId: arch ? arch.coreCarryChampionId : "",
          coreTankChampionId: arch ? arch.coreTankChampionId : "",
          coreChampionIds: arch ? arch.coreChampionIds : [],
          keyTraits: arch ? arch.keyTraitIds : [],
          playstyle: arch ? arch.playstyle : "standard",
          variantId: r.variantId,
          score: r.score,
          tier: r.tier,
          candidateTier: r.candidateTier,
          status: r.status,
          consensusLabel: r.consensusLabel,
          sourceVotes: r.sourceVotes || {},
          validSourceCount: r.validSourceCount || 0,
          totalSourceCount: r.totalSourceCount || 5,
          rawMetrics: r.rawMetrics || {},
          adjustedMetrics: r.adjustedMetrics || {},
          regionalBreakdown: r.regionalBreakdown || {},
          reasonCodes: r.reasonCodes || [],
          evidenceRefIds: r.evidenceRefIds || [],
          requiredConditions: arch ? arch.requiredConditions : [],
          recommendedBoard,
          recommendedItems,
          selectedSourceBuildId: r.selectedSourceBuildId || null,
          selectionReason: r.selectionReason || null,
          availableSourceBuilds: Array.isArray(r.availableSourceBuilds) ? r.availableSourceBuilds : []
        };
      })
    };
    if (this.cacheGeneration === readGen) {
      if (this.rankingSnapshotCache.size > 200) this.rankingSnapshotCache.clear();
      this.rankingSnapshotCache.set(id, { data: snapResult, generation: readGen, expiresAt: Date.now() + 60000 });
    }
    return snapResult;
  }

  async getLatestRankingSnapshot(
    boardType: "websites" | "elite",
    datasetKind: "real" | "demo" = "demo",
    filter?: {
      region?: string;
      patchEpochId?: string;
      windowHours?: number;
    }
  ): Promise<RankingSnapshot | null> {
    const readGen = this.cacheGeneration;
    const cacheKey = `${boardType}:${datasetKind}:${filter?.patchEpochId || ""}:${filter?.region || ""}:${filter?.windowHours || ""}`;
    const cached = this.latestSnapshotCache.get(cacheKey);
    if (cached && cached.generation === readGen && cached.expiresAt > Date.now()) {
      const db = await getDb();
      const pointerConditions: any[] = [
        eq(metaCurrentRankingPointers.boardType, boardType),
        eq(metaCurrentRankingPointers.datasetKind, datasetKind)
      ];
      if (filter?.patchEpochId) {
        pointerConditions.push(eq(metaCurrentRankingPointers.patchEpochId, filter.patchEpochId));
      }
      const pointerRows = await db
        .select({ rankingSnapshotId: metaCurrentRankingPointers.rankingSnapshotId })
        .from(metaCurrentRankingPointers)
        .where(and(...pointerConditions))
        .orderBy(desc(metaCurrentRankingPointers.publishedAt))
        .limit(1);

      if (pointerRows && pointerRows.length > 0) {
        if (cached.data && pointerRows[0].rankingSnapshotId === cached.data.id) {
          return cached.data;
        }
      } else if (!cached.data) {
        return cached.data;
      }
    }
    const result = await this.getLatestRankingSnapshotInternal(boardType, datasetKind, filter);
    if (this.cacheGeneration === readGen) {
      if (this.latestSnapshotCache.size > 100) this.latestSnapshotCache.clear();
      this.latestSnapshotCache.set(cacheKey, { data: result, generation: readGen, expiresAt: Date.now() + 15000 });
    }
    return result;
  }

  private async getLatestRankingSnapshotInternal(
    boardType: "websites" | "elite",
    datasetKind: "real" | "demo" = "demo",
    filter?: {
      region?: string;
      patchEpochId?: string;
      windowHours?: number;
    }
  ): Promise<RankingSnapshot | null> {
    const db = await getDb();

    // 1. Check current ranking pointer table first to guarantee atomic consistency across processes
    if (boardType === "websites" || (!filter?.region || filter.region === "all")) {
      try {
        const pointerConditions: any[] = [
          eq(metaCurrentRankingPointers.boardType, boardType),
          eq(metaCurrentRankingPointers.datasetKind, datasetKind)
        ];
        if (filter?.patchEpochId) {
          pointerConditions.push(eq(metaCurrentRankingPointers.patchEpochId, filter.patchEpochId));
        }

        const pointerRows = await db
          .select()
          .from(metaCurrentRankingPointers)
          .where(and(...pointerConditions))
          .orderBy(desc(metaCurrentRankingPointers.publishedAt))
          .limit(1);

        if (pointerRows.length > 0) {
          const snap = await this.getRankingSnapshot(pointerRows[0].rankingSnapshotId);
          if (snap && (datasetKind !== "real" || snap.publicationStatus === "published")) {
            return snap;
          }
        }
      } catch (err: any) {
        if (datasetKind === "real") {
          throw new Error(`Current ranking pointer lookup failed: ${err.message}`);
        }
        console.warn("[MetaRepository] Demo pointer lookup fallback:", err.message);
      }
    }

    const conditions: any[] = [
      eq(metaRankingSnapshots.boardType, boardType),
      eq(metaRankingSnapshots.datasetKind, datasetKind),
      datasetKind === "real"
        ? eq(metaRankingSnapshots.status, "published")
        : ne(metaRankingSnapshots.status, "quarantined"),
      ne(metaRankingSnapshots.status, "retracted")
    ];

    if (filter?.patchEpochId) {
      conditions.push(eq(metaRankingSnapshots.patchEpochId, filter.patchEpochId));
    }

    if (boardType === "elite" && filter?.windowHours) {
      conditions.push(eq(metaRankingSnapshots.windowHours, filter.windowHours));
    }

    const snaps = await db
      .select()
      .from(metaRankingSnapshots)
      .where(and(...conditions))
      .orderBy(desc(metaRankingSnapshots.createdAt));

    if (snaps.length === 0) return null;

    if (boardType === "elite" && filter?.region && filter.region !== "all") {
      const match = snaps.find((s: any) => {
        const reqRegs = Array.isArray(s.requestedRegions) ? s.requestedRegions : [];
        const effRegs = Array.isArray(s.effectiveRegions) ? s.effectiveRegions : [];
        return reqRegs.includes(filter.region) || effRegs.includes(filter.region);
      });
      if (match) return this.getRankingSnapshot(match.id);
      return null;
    }

    if (boardType === "elite" && filter?.region === "all") {
      const match = snaps.find((s: any) => {
        const reqRegs = Array.isArray(s.requestedRegions) ? s.requestedRegions : [];
        return reqRegs.includes("all") || (reqRegs.length === 4 && reqRegs.includes("KR"));
      });
      if (match) return this.getRankingSnapshot(match.id);
    }

    return this.getRankingSnapshot(snaps[0].id);
  }
}

export const metaRepository = new MetaRepository();
