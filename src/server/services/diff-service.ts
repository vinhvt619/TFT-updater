import { snapshotRepository } from "../repositories/snapshot-repository";
import { getGlobalCacheGen, incGlobalCacheGen } from "../meta/repositories/meta-repository";
import { compareSnapshots, DIFF_ENGINE_VERSION } from "../../domain/compare";
import { ComparisonResult, DatasetKind, StarLevel, ReleaseChangeRow, ReleaseMeta } from "../../domain/types";
import { sortReleaseMeta } from "../../domain/versioning";
import { FIELD_REGISTRY } from "../../domain/field-registry";

type NoteSummary = {
  visible: ReleaseChangeRow[];
  hidden: ReleaseChangeRow[];
  summary: ComparisonResult["summary"];
  byKind: Record<string, { total: number; known: number; unresolved: number }>;
};

function stableValue(value: unknown): string {
  if (value === undefined) return "undefined";
  try { return JSON.stringify(value); } catch { return String(value); }
}

/**
 * A release can be represented by more than one database row (for example a
 * notes event and a snapshot alias).  A row id is not an entity identity, so
 * dedupe only by the source evidence and the actual before/after claim.
 */
export function dedupeReleaseChanges(changes: ReleaseChangeRow[]): ReleaseChangeRow[] {
  const seen = new Set<string>();
  return changes.filter((change) => {
    const key = [
      change.sourceEventId || "",
      change.sourceLocator || "",
      change.entityKind || "unknown",
      change.entityId || "unknown",
      change.formId || "",
      change.fieldKey || "",
      change.changeType || "",
      change.before.state,
      stableValue(change.before.value),
      change.after.state,
      stableValue(change.after.value),
      change.rawText.trim()
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isMaintenanceChange(change: ReleaseChangeRow): boolean {
  const text = `${change.changeType || ""} ${change.rawText || ""} ${change.fieldKey || ""}`.toLowerCase();
  return (
    change.entityKind === "bugfix" ||
    /bug\s*fix|bugfix|tooltip|typo|incorrect text|sửa lỗi|lỗi hiển thị|loading screens?|spinner graphic|no longer\b|white boxes|visual bug|display bug|icon bug|cosmetic/i.test(
      text
    ) ||
    /^(?:fixed|sửa lỗi)\b/i.test((change.rawText || "").trim())
  );
}

import {
  numericValues,
  getFieldPolarity,
  isNoopChange,
  rowImpact
} from "../../domain/meta/change-impact";

export {
  numericValues,
  getFieldPolarity,
  isNoopChange,
  rowImpact
};

function isOtherGameMode(change: ReleaseChangeRow): boolean {
  return /\bdouble up\b|đấu đôi|\bhyper roll\b|tocker/i.test(change.rawText);
}

/** Public pure helper used by the API and by data-integrity tests. */
export function summarizeDocumentedChanges(changes: ReleaseChangeRow[], rosterTotal: number | null = null): NoteSummary {
  const unique = dedupeReleaseChanges(changes);
  const hidden = unique.filter(c=>isMaintenanceChange(c)||isOtherGameMode(c));
  const visible = unique.filter((change) => !isMaintenanceChange(change) && !isOtherGameMode(change));
  const byKind: Record<string, { total: number; known: number; unresolved: number }> = {};
  const championImpacts = new Map<string, Set<"buff" | "nerf" | "mixed" | "neutral" | "unknown">>();
  const changedByKind = new Map<string, Set<string>>();
  let known = 0;
  let unresolved = 0;
  for (const change of visible) {
    const kind = change.entityKind || "unknown";
    const bucket = byKind[kind] || (byKind[kind] = { total: 0, known: 0, unresolved: 0 });
    bucket.total++;
    const hasCanonicalIdentity = Boolean(change.entityId && change.entityId.trim());
    const isKnownValue = change.before.state === "known" && change.after.state === "known";
    const isFullyKnown = hasCanonicalIdentity && isKnownValue;
    if (isFullyKnown) { bucket.known++; known++; } else { bucket.unresolved++; unresolved++; }

    const isNoop = isNoopChange(change);

    // Track canonical entity IDs per kind:
    // Only valid canonical entityId and non-noop changes count towards canonical changed entity counts
    if (change.entityId && !isNoop) {
      const ids = changedByKind.get(kind) || new Set<string>();
      ids.add(change.entityId);
      changedByKind.set(kind, ids);

      // Track champion impacts separately so non-champion items/traits do not pollute champion buff/nerf counters
      if (kind === "champion") {
        const impacts = championImpacts.get(change.entityId) || new Set<"buff" | "nerf" | "mixed" | "neutral" | "unknown">();
        impacts.add(rowImpact(change));
        championImpacts.set(change.entityId, impacts);
      }
    }
  }

  let buffedCount = 0;
  let nerfedCount = 0;
  let mixedCount = 0;
  let neutralCount = 0;
  let unknownCount = 0;
  for (const impacts of championImpacts.values()) {
    const hasMixed = impacts.has("mixed");
    const hasBuff = impacts.has("buff");
    const hasNerf = impacts.has("nerf");
    if (hasMixed || (hasBuff && hasNerf)) mixedCount++;
    else if (hasBuff) buffedCount++;
    else if (hasNerf) nerfedCount++;
    else if (impacts.has("neutral")) neutralCount++;
    else unknownCount++;
  }

  const count = (kind: string) => changedByKind.get(kind)?.size || 0;
  const changedChampionCount = count("champion");
  const changedTraitCount = count("trait");
  const changedItemCount = count("item");
  const changedAugmentCount = count("augment");
  const totalChampions = rosterTotal === null ? null : rosterTotal;
  const nonNoopVisible = visible.filter((change) => !isNoopChange(change));

  return {
    visible,
    hidden,
    byKind,
    summary: {
      totalChampions,
      changedChampions: changedChampionCount,
      buffedCount,
      nerfedCount,
      mixedCount,
      neutralCount,
      unknownCount,
      rosterTotal,
      changedChampionCount,
      changedTraitCount,
      changedItemCount,
      changedAugmentCount,
      gameplayChangeCount: nonNoopVisible.length,
      hiddenMaintenanceCount: hidden.filter(isMaintenanceChange).length,
      hiddenOutOfScopeCount: hidden.filter(isOtherGameMode).length,
      unresolvedClaimCount: unresolved,
      observedUnchangedChampionCount: null, // Sparse documented notes cannot observe unchanged champions across roster
      coverage: rosterTotal === null ? "unavailable" : "partial"
    }
  };
}

export class DiffService {
  private get cacheGeneration() { return getGlobalCacheGen(); }
  private catalogueCache = new Map<string, { data: ReleaseMeta[]; generation: number; expiresAt: number }>();
  private releaseDiffCache = new Map<string, { data: ComparisonResult; generation: number; expiresAt: number }>();

  public clearCache(): void {
    incGlobalCacheGen();
    this.catalogueCache.clear();
    this.releaseDiffCache.clear();
  }

  public async getReleaseCatalogue(datasetKind: DatasetKind): Promise<ReleaseMeta[]> {
    const readGen = this.cacheGeneration;
    const cached = this.catalogueCache.get(datasetKind);
    if (cached && cached.generation === readGen && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const data = await snapshotRepository.getReleases(datasetKind, { includeArchive: true });
    if (this.cacheGeneration === readGen) {
      this.catalogueCache.set(datasetKind, { data, generation: readGen, expiresAt: Date.now() + 30000 });
    }
    return data;
  }

  /** Compatibility adapter for the old 18.2 notes-event/snapshot pair. */
  private canonicalReleaseId(id: string, releases: ReleaseMeta[]): string {
    if (id !== "event_live_18_2_main" && id !== "rel_live_18_2") return id;
    const notes = releases.find((release) => release.id === "event_live_18_2_main");
    const snapshot = releases.find((release) => release.id === "rel_live_18_18_2" || release.id === "rel_live_18_2");
    if (notes && snapshot) {
      return snapshot.currentSnapshotStatus === "published" || snapshot.currentSnapshotId ? snapshot.id : notes.id;
    }
    return snapshot?.id || notes?.id || id;
  }

  private uniquePrimaryReleases(releases: ReleaseMeta[]): ReleaseMeta[] {
    const canonical = this.canonicalReleaseId("rel_live_18_2", releases);
    const seen = new Set<string>();
    return releases.filter((release) => {
      if (release.historyVisibility === "archive") return true;
      const id = release.id === "event_live_18_2_main" || release.id === "rel_live_18_2" ? canonical : release.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  private notesResult(fromRelease: ReleaseMeta, toRelease: ReleaseMeta, changes: ReleaseChangeRow[], mode: "adjacent" | "range", intermediateVersions: ComparisonResult["intermediateVersions"], adjacentEdges: ComparisonResult["adjacentEdges"], missingEvidence: string[] = []): ComparisonResult {
    const noteSummary = summarizeDocumentedChanges(changes, null);
    const { summary, visible, hidden, byKind } = noteSummary;
    return {
      fromSnapshotId: fromRelease.currentSnapshotId || `release:${fromRelease.id}`,
      toSnapshotId: toRelease.currentSnapshotId || `release:${toRelease.id}`,
      diffEngineVersion: `${DIFF_ENGINE_VERSION}+release-notes`,
      generatedAt: new Date().toISOString(),
      summary,
      champions: [],
      fromVersion: fromRelease.versionKey,
      toVersion: toRelease.versionKey,
      fromDisplayLabel: fromRelease.displayLabel || fromRelease.displayVersion || fromRelease.patchLabel || fromRelease.id,
      toDisplayLabel: toRelease.displayLabel || toRelease.displayVersion || toRelease.patchLabel || toRelease.id,
      comparisonMode: mode,
      intermediateVersions,
      evidenceStatus: visible.length ? (summary.unresolvedClaimCount ? "partial" : "notes_only") : (hidden.length ? "notes_only" : "partial"),
      comparisonBasis: changes.length ? "documented_changes" : "gap",
      historyScope: toRelease.historyVisibility === "archive" || fromRelease.historyVisibility === "archive" ? "archive" : "primary",
      fromRelease,
      toRelease,
      changes: visible,
      hiddenChanges: hidden,
      summaryByEntityKind: byKind,
      coverage: { knownChangesCount: summary.gameplayChangeCount ? visible.filter((change) => change.before.state === "known" && change.after.state === "known").length : 0, unresolvedClaimsCount: summary.unresolvedClaimCount || 0, snapshotCompleteness: fromRelease.currentSnapshotStatus === "published" && toRelease.currentSnapshotStatus === "published" ? "complete" : "partial", status: visible.length || hidden.length ? "sufficient" : "insufficient_evidence" },
      adjacentEdges,
      missingEvidence
    };
  }

  async getOrComputeReleaseDiff(
    fromReleaseId: string,
    toReleaseId: string,
    options: { starLevel?: StarLevel; changedOnly?: boolean; datasetKind?: DatasetKind } = {}
  ): Promise<ComparisonResult> {
    if (fromReleaseId === toReleaseId) throw new Error("Cannot compare a release with itself");
    const datasetKind = options.datasetKind || "real";
    const cacheKey = `${fromReleaseId}:${toReleaseId}:${options.starLevel || ""}:${options.changedOnly ? "1" : "0"}:${datasetKind}`;
    const readGen = this.cacheGeneration;
    const cachedDiff = this.releaseDiffCache.get(cacheKey);
    if (cachedDiff && cachedDiff.generation === readGen && cachedDiff.expiresAt > Date.now()) {
      return cachedDiff.data;
    }
    const releases = await this.getReleaseCatalogue(datasetKind);
    const canonicalFromId = this.canonicalReleaseId(fromReleaseId, releases);
    const canonicalToId = this.canonicalReleaseId(toReleaseId, releases);
    if (canonicalFromId === canonicalToId) throw new Error("Cannot compare a release with itself");
    const fromRelease = releases.find((release) => release.id === canonicalFromId);
    const toRelease = releases.find((release) => release.id === canonicalToId);
    if (!fromRelease || !toRelease) throw new Error(`Release not found: ${!fromRelease ? fromReleaseId : toReleaseId}`);
    if (fromRelease.datasetKind !== toRelease.datasetKind || fromRelease.setNumber !== toRelease.setNumber || fromRelease.gameMode !== toRelease.gameMode) throw new Error("Cannot compare releases from different dataset, set, or game mode");
    if (fromRelease.historyVisibility === "archive" || toRelease.historyVisibility === "archive") throw new Error("Release is outside the primary history scope");

    const sorted = sortReleaseMeta(this.uniquePrimaryReleases(releases).filter((release) => release.historyVisibility !== "archive"));
    const fromIndex = sorted.findIndex((release) => release.id === canonicalFromId);
    const toIndex = sorted.findIndex((release) => release.id === canonicalToId);
    const direction = toIndex >= fromIndex ? 1 : -1;
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const intermediate = sorted.slice(start + 1, end);
    const intermediateVersions = intermediate.map((release) => ({ releaseId: release.id, snapshotId: release.currentSnapshotId, versionKey: release.versionKey || release.id, displayVersion: release.displayLabel || release.displayVersion || release.patchLabel || release.id, comparisonStatus: release.comparisonStatus || "collecting" }));
    const pathReleases = direction === 1 ? sorted.slice(start, end + 1) : sorted.slice(start, end + 1).reverse();
    const edges: Array<{ fromReleaseId: string; toReleaseId: string; comparisonBasis: ComparisonResult["comparisonBasis"]; changesCount: number }> = [];
    const allChanges: ReleaseChangeRow[] = [];
    for (let index = 1; index < pathReleases.length; index++) {
      const edgeFrom = pathReleases[index - 1];
      const edgeTo = pathReleases[index];
      const edgeChanges = (await snapshotRepository.getReleaseChanges(edgeTo.id)) as ReleaseChangeRow[];
      const bothPublished = edgeFrom.currentSnapshotStatus === "published" && edgeTo.currentSnapshotStatus === "published";
      const basis: ComparisonResult["comparisonBasis"] = bothPublished ? "snapshot_diff" : edgeChanges.length ? "documented_changes" : "gap";
      edges.push({ fromReleaseId: edgeFrom.id, toReleaseId: edgeTo.id, comparisonBasis: basis, changesCount: edgeChanges.length });
      allChanges.push(...edgeChanges);
    }
    if (fromIndex < 0 || toIndex < 0) throw new Error("Release ordering is unavailable");
    const directChanges = allChanges.length ? allChanges : await snapshotRepository.getReleaseChanges(toRelease.id) as ReleaseChangeRow[];
    let result: ComparisonResult;
    const bothPublished = fromRelease.currentSnapshotStatus === "published" && toRelease.currentSnapshotStatus === "published";
    // A range must retain every intermediate release-note edge.  Even when both
    // endpoints have snapshots, using the snapshot shortcut would silently drop
    // hotfix/mid-patch notes between them.  Only an adjacent published pair may
    // use the cached snapshot diff.
    if (bothPublished && intermediate.length === 0 && fromRelease.currentSnapshotId && toRelease.currentSnapshotId) {
      result = await this.getOrComputeDiff(fromRelease.currentSnapshotId, toRelease.currentSnapshotId, options);
      result = { ...result, comparisonBasis: "snapshot_diff", historyScope: "primary", fromRelease, toRelease, changes: [], summaryByEntityKind: {}, coverage: { knownChangesCount: result.summary.changedChampions, unresolvedClaimsCount: 0, snapshotCompleteness: "complete", status: result.summary.changedChampions ? "sufficient" : "empty_with_evidence" }, adjacentEdges: edges };
    } else {
      result = this.notesResult(fromRelease, toRelease, directChanges, intermediate.length ? "range" : "adjacent", intermediateVersions, edges, [
        ...(fromRelease.currentSnapshotStatus !== "published" ? [`from:${fromRelease.id}:snapshot`] : []),
        ...(toRelease.currentSnapshotStatus !== "published" ? [`to:${toRelease.id}:snapshot`] : [])
      ]);
      const hasSnapshotEdge = edges.some((edge) => edge.comparisonBasis === "snapshot_diff");
      const hasDocumentedEdge = edges.some((edge) => edge.comparisonBasis === "documented_changes");
      const hasGapEdge = edges.some((edge) => edge.comparisonBasis === "gap");
      const comparisonBasis: ComparisonResult["comparisonBasis"] = hasSnapshotEdge && hasDocumentedEdge
        ? "mixed"
        : hasSnapshotEdge
          ? "snapshot_diff"
          : hasDocumentedEdge
            ? "documented_changes"
            : hasGapEdge
              ? "gap"
              : result.comparisonBasis;
      result = {
        ...result,
        comparisonBasis,
        coverage: {
          knownChangesCount: result.coverage?.knownChangesCount ?? 0,
          unresolvedClaimsCount: result.coverage?.unresolvedClaimsCount ?? 0,
          status: result.coverage?.status ?? "insufficient_evidence",
          snapshotCompleteness: hasSnapshotEdge && hasDocumentedEdge ? "partial" : result.coverage?.snapshotCompleteness || "partial"
        }
      };
    }
    if (options.changedOnly && result.changes) result.changes = result.changes.filter((change) => change.before.state !== "known" || change.after.state !== "known" || change.before.value !== change.after.value);
    if (this.cacheGeneration === readGen) {
      if (this.releaseDiffCache.size > 200) this.releaseDiffCache.clear();
      this.releaseDiffCache.set(cacheKey, { data: result, generation: readGen, expiresAt: Date.now() + 60000 });
    }
    return result;
  }

  async getOrComputeDiff(
    fromSnapshotId: string,
    toSnapshotId: string,
    options: { starLevel?: StarLevel; changedOnly?: boolean; datasetKind?: DatasetKind } = {}
  ): Promise<ComparisonResult> {
    const fromRelease = await snapshotRepository.getSnapshotReleaseMeta(fromSnapshotId);
    const toRelease = await snapshotRepository.getSnapshotReleaseMeta(toSnapshotId);
    if (!fromRelease || !toRelease) {
      throw new Error(`Snapshot not found: ${!fromRelease ? fromSnapshotId : toSnapshotId}`);
    }
    if (fromRelease.datasetKind !== toRelease.datasetKind) {
      throw new Error("Cannot compare snapshots from different dataset kinds");
    }
    if (options.datasetKind && fromRelease.datasetKind !== options.datasetKind) {
      throw new Error(`Snapshot dataset mismatch: expected ${options.datasetKind}`);
    }
    if (fromRelease.currentSnapshotStatus !== "published" || toRelease.currentSnapshotStatus !== "published") {
      throw new Error("Only published snapshots can be compared");
    }

    // 1. Check cache first
    const cached = await snapshotRepository.getDiffCache(fromSnapshotId, toSnapshotId, DIFF_ENGINE_VERSION);
    let result: ComparisonResult;

    if (cached) {
      result = cached;
    } else {
      // 2. Load both snapshot payloads
      const fromPayload = await snapshotRepository.getSnapshotPayload(fromSnapshotId);
      if (!fromPayload) {
        throw new Error(`Snapshot not found: ${fromSnapshotId}`);
      }
      const toPayload = await snapshotRepository.getSnapshotPayload(toSnapshotId);
      if (!toPayload) {
        throw new Error(`Snapshot not found: ${toSnapshotId}`);
      }

      // 3. Compute pure comparison
      result = compareSnapshots(fromPayload, toPayload, fromSnapshotId, toSnapshotId);

      // 4. Save to cache
      await snapshotRepository.saveDiffCache(fromSnapshotId, toSnapshotId, DIFF_ENGINE_VERSION, result);
    }

    // Add version/timeline metadata from the same dataset before applying view filters.
    const allReleases = sortReleaseMeta(await snapshotRepository.getReleases(fromRelease.datasetKind));
    const fromIndex = allReleases.findIndex((r) => r.currentSnapshotId === fromSnapshotId);
    const toIndex = allReleases.findIndex((r) => r.currentSnapshotId === toSnapshotId);
    const direction = fromIndex >= 0 && toIndex >= 0 && toIndex >= fromIndex ? 1 : -1;
    const start = direction === 1 ? fromIndex : toIndex;
    const end = direction === 1 ? toIndex : fromIndex;
    const intermediateVersions = start >= 0 && end >= 0
      ? allReleases.slice(start + 1, end).map((release) => ({
          releaseId: release.id,
          snapshotId: release.currentSnapshotId,
          versionKey: release.versionKey || release.id,
          displayVersion: release.displayVersion || release.patchLabel || release.occurrenceKey,
          comparisonStatus: release.comparisonStatus || "collecting"
        }))
      : [];

    result = {
      ...result,
      fromVersion: fromRelease.versionKey,
      toVersion: toRelease.versionKey,
      fromDisplayLabel: fromRelease.displayVersion || fromRelease.patchLabel || fromRelease.occurrenceKey,
      toDisplayLabel: toRelease.displayVersion || toRelease.patchLabel || toRelease.occurrenceKey,
      comparisonMode: intermediateVersions.length === 0 ? "adjacent" : "range",
      intermediateVersions,
      evidenceStatus: "available"
    };

    // 5. Apply view filtering if requested
    if (options.starLevel || options.changedOnly) {
      const filteredChamps = result.champions
        .map((champ) => {
          let fieldDiffs = champ.fieldDiffs;
          if (options.starLevel) {
            fieldDiffs = fieldDiffs.filter((f) => f.starLevel === null || f.starLevel === options.starLevel);
          }
          return {
            ...champ,
            fieldDiffs
          };
        })
        .filter((champ) => {
          if (options.changedOnly) {
            return champ.status !== "unchanged" || champ.fieldDiffs.length > 0;
          }
          return true;
        });

      return {
        ...result,
        champions: filteredChamps
      };
    }

    return result;
  }
}

export const diffService = new DiffService();
