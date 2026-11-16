import { getDb } from "../db/client";
import {
  releases,
  snapshots,
  champions,
  championSnapshots,
  evidenceRefs,
  snapshotEvidence,
  rawArtifacts,
  diffCache,
  auditLog,
  releaseChanges
} from "../db/schema";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import {
  SnapshotPayload,
  ChampionRecord,
  EvidenceRecord,
  ComparisonResult,
  DatasetKind,
  Channel,
  ReleaseMeta
} from "../../domain/types";
import { toCanonicalChampionId } from "../../domain/identity";
import { parseTftVersion, sortReleaseMeta } from "../../domain/versioning";

export class SnapshotRepository {
  async getReleases(datasetKind: DatasetKind = "demo", options: { includeArchive?: boolean } = {}): Promise<ReleaseMeta[]> {
    const db = await getDb();
    const rows = await db
      .select({
        id: releases.id,
        datasetKind: releases.datasetKind,
        setNumber: releases.setNumber,
        gameMode: releases.gameMode,
        channel: releases.channel,
        patchLabel: releases.patchLabel,
        buildId: releases.buildId,
        occurrenceKey: releases.occurrenceKey,
        effectiveAt: releases.effectiveAt,
        observedAt: releases.observedAt,
        currentSnapshotId: releases.currentSnapshotId,
        currentSnapshotStatus: snapshots.status,
        evidenceStatus: releases.evidenceStatus,
        versionKey: releases.versionKey,
        displayVersion: releases.displayVersion,
        versionSortKey: releases.versionSortKey,
        patchFamily: releases.patchFamily,
        eventKey: releases.eventKey,
        officialLabel: releases.officialLabel,
        displayLabel: releases.displayLabel,
        displayAlias: releases.displayAlias,
        aliasKind: releases.aliasKind,
        seasonPhase: releases.seasonPhase,
        historyVisibility: releases.historyVisibility,
        visibilityReason: releases.visibilityReason,
        effectivePrecision: releases.effectivePrecision,
        timeBasis: releases.timeBasis,
        fetchedAt: releases.fetchedAt,
        orderingKey: releases.orderingKey,
        provenance: releases.provenance,
        capabilities: releases.capabilities
      })
      .from(releases)
      .leftJoin(snapshots, eq(releases.currentSnapshotId, snapshots.id))
      .where(options.includeArchive === false
        ? and(eq(releases.datasetKind, datasetKind), or(eq(releases.historyVisibility, "primary"), isNull(releases.historyVisibility)))
        : eq(releases.datasetKind, datasetKind))
      .orderBy(desc(releases.observedAt));
    const enriched = rows.map((row: (typeof rows)[number]) => {
      const parsed = parseTftVersion(
        [row.patchFamily, row.displayLabel, row.patchLabel].filter(Boolean).join(" "),
        row.channel as Channel,
        row.eventKey || row.occurrenceKey,
        row.buildId
      );
      const currentSnapshotStatus = (row.currentSnapshotStatus || null) as ReleaseMeta["currentSnapshotStatus"];
      const evidenceStatus = (row.evidenceStatus || "unknown") as ReleaseMeta["evidenceStatus"];
      return {
        ...row,
        currentSnapshotStatus,
        evidenceStatus,
        versionKey: row.versionKey || parsed.versionKey,
        displayVersion: row.displayLabel || row.displayAlias || row.displayVersion || parsed.displayVersion,
        versionSortKey: row.orderingKey || row.versionSortKey || parsed.sortKey,
        releaseKind: (row.channel === "pbe" ? "pbe_revision" : row.patchFamily && /[a-z]$/i.test(row.displayAlias || row.patchLabel || "") ? "hotfix" : parsed.kind) as ReleaseMeta["releaseKind"],
        hotfixSuffix: parsed.hotfixSuffix || (row.displayAlias && /[a-z]$/i.test(row.displayAlias) ? row.displayAlias.slice(-1).toLowerCase() : null),
        pbeRevision: parsed.pbeRevision,
        isInferredAlias: parsed.isInferredAlias,
        patchFamily: row.patchFamily || parsed.baseVersion,
        eventKey: row.eventKey || row.occurrenceKey,
        officialLabel: row.officialLabel || row.patchLabel,
        displayLabel: row.displayLabel || row.displayVersion || parsed.displayVersion,
        displayAlias: row.displayAlias,
        aliasKind: row.aliasKind,
        seasonPhase: row.seasonPhase,
        historyVisibility: row.historyVisibility === "archive" ? "archive" : "primary",
        visibilityReason: row.visibilityReason,
        effectivePrecision: row.effectivePrecision,
        timeBasis: row.timeBasis,
        fetchedAt: row.fetchedAt?.toISOString?.() || (row.fetchedAt as any) || null,
        orderingKey: row.orderingKey,
        provenance: (row.provenance || {}) as Record<string, unknown>,
        capabilities: (row.capabilities || {}) as ReleaseMeta["capabilities"],
        comparisonStatus: row.currentSnapshotId && currentSnapshotStatus === "published"
          ? "available"
          : currentSnapshotStatus === "quarantined" || currentSnapshotStatus === "withdrawn"
            ? "quarantined"
            : evidenceStatus === "gap"
              ? "gap"
            : row.currentSnapshotId
              ? "collecting"
              : "notes_only"
      } satisfies ReleaseMeta;
    });
    return sortReleaseMeta(enriched);
  }

  async getLatestSnapshotId(datasetKind?: DatasetKind): Promise<string | null> {
    const db = await getDb();
    
    // 1. Nếu có datasetKind, tìm snapshot đã công bố (published) của release thuộc dataset đó
    if (datasetKind) {
      const rel = await db
        .select({ id: snapshots.id })
        .from(snapshots)
        .innerJoin(releases, eq(snapshots.releaseId, releases.id))
        .where(
          and(
            eq(releases.datasetKind, datasetKind),
            ...(datasetKind === "real" ? [or(eq(releases.historyVisibility, "primary"), isNull(releases.historyVisibility)), eq(releases.currentSnapshotId,snapshots.id)] : []),
            eq(snapshots.status, "published")
          )
        )
        .orderBy(desc(releases.effectiveAt), desc(snapshots.revision), desc(snapshots.createdAt))
        .limit(1);
      if (rel[0]?.id) return rel[0].id;
      // A scoped request must fail closed when that dataset has no published
      // snapshot; never cross the Demo/Real boundary to satisfy the request.
      return null;
    }

    // 2. Tìm snapshot đã công bố bất kỳ
    const pub = await db
      .select({ id: snapshots.id })
      .from(snapshots)
      .where(eq(snapshots.status, "published"))
      .orderBy(desc(snapshots.revision), desc(snapshots.createdAt))
      .limit(1);
    if (pub[0]?.id) return pub[0].id;

    // Tuyệt đối không fallback sang snapshot bị cách ly hay staging chưa công bố
    return null;
  }

  async getReleaseById(id: string) {
    const db = await getDb();
    const rows = await db.select().from(releases).where(eq(releases.id, id)).limit(1);
    return rows[0] || null;
  }

  async getReleaseChanges(releaseId: string): Promise<any[]> {
    const db = await getDb();
    const rows = await db.select().from(releaseChanges).where(eq(releaseChanges.releaseId, releaseId)).orderBy(releaseChanges.id);
    return rows.map((row: any) => ({
      id: row.id,
      releaseId: row.releaseId,
      sourceEventId: row.sourceEventId,
      entityKind: row.entityKind,
      entityId: row.entityId || null,
      rawEntityName: row.rawEntityName || null,
      fieldKey: row.fieldKey || null,
      formId: row.formId || null,
      starLevel: row.starLevel ?? null,
      unit: row.unit || null,
      changeType: row.changeType,
      before: { state: row.beforeState, ...(row.beforeValue !== null && row.beforeValue !== undefined ? { value: row.beforeValue } : {}) },
      after: { state: row.afterState, ...(row.afterValue !== null && row.afterValue !== undefined ? { value: row.afterValue } : {}) },
      rawText: row.rawText,
      basis: row.basis,
      sourceUrl: row.sourceUrl || null,
      rawArtifactId: row.rawArtifactId || null,
      rawHash: row.rawHash || null,
      sourceLocator: row.sourceLocator || null,
      parserVersion: row.parserVersion || null,
      applicability: row.applicability || {},
      effectivePrecision: row.effectivePrecision || null,
      verificationStatus: row.verificationStatus,
      evidenceIds: Array.isArray(row.evidenceIds) ? row.evidenceIds : []
    }));
  }

  async getSnapshotReleaseMeta(snapshotId: string): Promise<ReleaseMeta | null> {
    const snapshot = await this.getSnapshotById(snapshotId);
    if (!snapshot) return null;
    const release = await this.getReleaseById(snapshot.releaseId);
    if (!release) return null;
    const parsed = parseTftVersion(
      [(release as any).patchFamily, (release as any).displayLabel, release.patchLabel].filter(Boolean).join(" "),
      release.channel as Channel,
      (release as any).eventKey || release.occurrenceKey,
      release.buildId
    );
    const currentSnapshotStatus = snapshot.status as ReleaseMeta["currentSnapshotStatus"];
    return {
      id: release.id,
      datasetKind: release.datasetKind as DatasetKind,
      setNumber: release.setNumber,
      gameMode: release.gameMode,
      channel: release.channel as Channel,
      patchLabel: release.patchLabel,
      buildId: release.buildId,
      occurrenceKey: release.occurrenceKey,
      effectiveAt: release.effectiveAt?.toISOString?.() || (release.effectiveAt as any) || null,
      observedAt: release.observedAt?.toISOString?.() || (release.observedAt as any),
      currentSnapshotId: release.currentSnapshotId,
      currentSnapshotStatus,
      evidenceStatus: (release as any).evidenceStatus || "available",
      versionKey: (release as any).versionKey || parsed.versionKey,
      displayVersion: (release as any).displayLabel || (release as any).displayAlias || (release as any).displayVersion || parsed.displayVersion,
      versionSortKey: (release as any).orderingKey || (release as any).versionSortKey || parsed.sortKey,
      releaseKind: parsed.kind,
      hotfixSuffix: parsed.hotfixSuffix,
      pbeRevision: parsed.pbeRevision,
      isInferredAlias: parsed.isInferredAlias,
      patchFamily: (release as any).patchFamily || parsed.baseVersion,
      eventKey: (release as any).eventKey || release.occurrenceKey,
      officialLabel: (release as any).officialLabel || release.patchLabel,
      displayLabel: (release as any).displayLabel || (release as any).displayVersion || parsed.displayVersion,
      displayAlias: (release as any).displayAlias || null,
      aliasKind: (release as any).aliasKind || null,
      seasonPhase: (release as any).seasonPhase || null,
      historyVisibility: (release as any).historyVisibility === "archive" ? "archive" : "primary",
      visibilityReason: (release as any).visibilityReason || null,
      effectivePrecision: (release as any).effectivePrecision || null,
      timeBasis: (release as any).timeBasis || null,
      fetchedAt: (release as any).fetchedAt?.toISOString?.() || (release as any).fetchedAt || null,
      orderingKey: (release as any).orderingKey || null,
      provenance: ((release as any).provenance || {}) as Record<string, unknown>,
      capabilities: ((release as any).capabilities || {}) as ReleaseMeta["capabilities"],
      comparisonStatus: snapshot.status === "published" ? "available" : snapshot.status === "quarantined" || snapshot.status === "withdrawn" ? "quarantined" : "collecting"
    };
  }

  async getSnapshotById(id: string) {
    const db = await getDb();
    const rows = await db.select().from(snapshots).where(eq(snapshots.id, id)).limit(1);
    return rows[0] || null;
  }

  async getSnapshotPayload(snapshotId: string): Promise<SnapshotPayload | null> {
    const db = await getDb();
    const snap = await this.getSnapshotById(snapshotId);
    if (!snap) return null;
    if ((snap as any).status === "quarantined") {
      throw new Error(`Snapshot ${snapshotId} has been quarantined: ${(snap as any).quarantineReason || "violation"}`);
    }

    const champRows = await db
      .select()
      .from(championSnapshots)
      .where(eq(championSnapshots.snapshotId, snapshotId));

    const championsList: ChampionRecord[] = champRows.map((r: any) => r.payload as ChampionRecord);

    const rel = await this.getReleaseById(snap.releaseId);
    // A snapshot without a release lineage cannot be classified safely.  Do
    // not silently label a Real snapshot as Demo (or invent Set/mode metadata).
    if (!rel) throw new Error(`Release lineage missing for snapshot ${snapshotId}`);

    return {
      schemaVersion: snap.schemaVersion,
      datasetKind: rel.datasetKind as DatasetKind,
      setNumber: rel.setNumber,
      gameMode: rel.gameMode,
      channel: rel.channel as Channel,
      rosterCompleteness: (snap.coverage as any)?.rosterCompleteness || "complete",
      fieldCoverage: (snap.coverage as any)?.fieldCoverage || {},
      champions: championsList
    };
  }

  async getChampionsAtSnapshot(snapshotId: string): Promise<ChampionRecord[]> {
    const db = await getDb();
    const champRows = await db
      .select()
      .from(championSnapshots)
      .where(eq(championSnapshots.snapshotId, snapshotId));
    return champRows.map((r: any) => r.payload as ChampionRecord);
  }

  async getChampionAtSnapshot(snapshotId: string, championId: string): Promise<ChampionRecord | null> {
    const db = await getDb();

    // Kiểm tra snapshot status trước: không trả về dữ liệu nếu snapshot bị cách ly
    const snap = await this.getSnapshotById(snapshotId);
    if (!snap || snap.status === "quarantined" || snap.status === "withdrawn") {
      return null;
    }

    const rows = await db
      .select()
      .from(championSnapshots)
      .where(and(eq(championSnapshots.snapshotId, snapshotId), eq(championSnapshots.championId, championId)))
      .limit(1);
    if (rows[0]) return rows[0].payload as ChampionRecord;

    // Fallback thử với canonical ID
    const canonical = toCanonicalChampionId(championId, 18);
    if (canonical !== championId) {
      const fallbackRows = await db
        .select()
        .from(championSnapshots)
        .where(and(eq(championSnapshots.snapshotId, snapshotId), eq(championSnapshots.championId, canonical)))
        .limit(1);
      if (fallbackRows[0]) return fallbackRows[0].payload as ChampionRecord;
    }

    return null;
  }

  async getAnyChampionRecord(championId: string): Promise<ChampionRecord | null> {
    const db = await getDb();
    const canonical = toCanonicalChampionId(championId, 18);
    const rows = await db
      .select({ payload: championSnapshots.payload })
      .from(championSnapshots)
      .innerJoin(snapshots, eq(championSnapshots.snapshotId, snapshots.id))
      .where(
        and(
          sql`(${championSnapshots.championId} = ${championId} OR ${championSnapshots.championId} = ${canonical})`,
          eq(snapshots.status, "published")
        )
      )
      .orderBy(desc(snapshots.createdAt))
      .limit(1);
    return rows[0] ? (rows[0].payload as ChampionRecord) : null;
  }

  async getEvidenceById(id: string) {
    const db = await getDb();
    const rows = await db.select().from(evidenceRefs).where(eq(evidenceRefs.id, id)).limit(1);
    return rows[0] || null;
  }

  async getDiffCache(fromSnapshotId: string, toSnapshotId: string, engineVersion: string): Promise<ComparisonResult | null> {
    const db = await getDb();
    const rows = await db
      .select()
      .from(diffCache)
      .where(
        and(
          eq(diffCache.fromSnapshotId, fromSnapshotId),
          eq(diffCache.toSnapshotId, toSnapshotId),
          eq(diffCache.diffEngineVersion, engineVersion)
        )
      )
      .limit(1);
    return rows[0] ? (rows[0].result as ComparisonResult) : null;
  }

  async saveDiffCache(fromSnapshotId: string, toSnapshotId: string, engineVersion: string, result: ComparisonResult): Promise<void> {
    const db = await getDb();
    await db
      .insert(diffCache)
      .values({
        fromSnapshotId,
        toSnapshotId,
        diffEngineVersion: engineVersion,
        result: result as any
      })
      .onConflictDoNothing();
  }
}

export const snapshotRepository = new SnapshotRepository();
