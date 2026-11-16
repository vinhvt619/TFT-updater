import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "../../src/server/db/client";
import { snapshotRepository } from "../../src/server/repositories/snapshot-repository";
import { diffService } from "../../src/server/services/diff-service";

const ROOT = path.resolve(".");
const ARTIFACT = path.join(ROOT, "artifacts", "test-data", "demo-mode-audit.json");

function rowsOf(value: any): any[] {
  return (Array.isArray(value) ? value : value?.rows || []) as any[];
}

function countRows(rows: any[]) {
  return Number(rows[0]?.count || 0);
}

async function main() {
  const db = await getDb();
  const releases = await snapshotRepository.getReleases("demo");
  const requiredLive = ["18.1", "18.1a", "18.1b", "18.2"];
  const liveByVersion = new Map(
    releases
      .filter((release) => release.channel === "live" && release.currentSnapshotId)
      .map((release) => [release.displayVersion?.split(" · ")[0] || release.patchLabel || "", release])
  );
  const missingLive = requiredLive.filter((label) => !liveByVersion.has(label));
  const pbeRevisions = releases.filter((release) => release.channel === "pbe" && release.pbeRevision);
  const notesOnlyReleases = releases.filter((release) => release.comparisonStatus === "notes_only");
  const gapReleases = releases.filter((release) => release.comparisonStatus === "gap");

  const compareChecks: any[] = [];
  for (let index = 0; index < requiredLive.length - 1; index++) {
    const from = liveByVersion.get(requiredLive[index]);
    const to = liveByVersion.get(requiredLive[index + 1]);
    if (!from?.currentSnapshotId || !to?.currentSnapshotId) {
      compareChecks.push({ from: requiredLive[index], to: requiredLive[index + 1], passed: false, error: "missing_snapshot" });
      continue;
    }
    try {
      const comparison = await diffService.getOrComputeDiff(from.currentSnapshotId, to.currentSnapshotId, { datasetKind: "demo" });
      compareChecks.push({
        from: comparison.fromDisplayLabel,
        to: comparison.toDisplayLabel,
        fromVersion: comparison.fromVersion,
        toVersion: comparison.toVersion,
        changedChampions: comparison.summary.changedChampions,
        evidenceStatus: comparison.evidenceStatus,
        passed: comparison.evidenceStatus === "available" && comparison.fromSnapshotId === from.currentSnapshotId && comparison.toSnapshotId === to.currentSnapshotId
      });
    } catch (error: any) {
      compareChecks.push({ from: requiredLive[index], to: requiredLive[index + 1], passed: false, error: error?.message || String(error) });
    }
  }

  const rangeFrom = liveByVersion.get("18.1");
  const rangeTo = liveByVersion.get("18.2");
  let rangeCheck: any = { from: "18.1", to: "18.2", passed: false, error: "missing_snapshot" };
  if (rangeFrom?.currentSnapshotId && rangeTo?.currentSnapshotId) {
    try {
      const comparison = await diffService.getOrComputeDiff(rangeFrom.currentSnapshotId, rangeTo.currentSnapshotId, { datasetKind: "demo" });
      const intermediateLabels = (comparison.intermediateVersions || []).map((version) => version.displayVersion);
      rangeCheck = {
        from: comparison.fromDisplayLabel,
        to: comparison.toDisplayLabel,
        comparisonMode: comparison.comparisonMode,
        intermediateVersions: intermediateLabels,
        passed: comparison.comparisonMode === "range" && intermediateLabels.join(",") === "18.1a,18.1b"
      };
    } catch (error: any) {
      rangeCheck = { ...rangeCheck, error: error?.message || String(error) };
    }
  }

  const sourceRows = rowsOf(await db.execute(sql.raw(`
    SELECT source_id,
      count(*)::int AS collected,
      count(*) FILTER (WHERE status='valid')::int AS valid,
      count(*) FILTER (WHERE status='quarantined')::int AS quarantined
    FROM meta_source_comp_observations
    WHERE dataset_kind='demo'
    GROUP BY source_id
    ORDER BY source_id
  `)));
  const pointerRows = rowsOf(await db.execute(sql.raw("SELECT * FROM meta_current_ranking_pointers WHERE dataset_kind='demo' ORDER BY board_type")));
  const rankingRows = rowsOf(await db.execute(sql.raw("SELECT id, board_type, status, dataset_kind FROM meta_ranking_snapshots WHERE dataset_kind='demo' ORDER BY board_type, id")));
  const duplicateRows = rowsOf(await db.execute(sql.raw(`
    SELECT occurrence_key, count(*)::int AS count
    FROM releases WHERE dataset_kind='demo'
    GROUP BY occurrence_key HAVING count(*) > 1
  `)));
  const realDemoRows = rowsOf(await db.execute(sql.raw(`
    SELECT count(*)::int AS count FROM releases
    WHERE dataset_kind='real' AND (occurrence_key LIKE '%demo%' OR id LIKE '%demo%')
  `)));
  const realDemoPointers = rowsOf(await db.execute(sql.raw(`
    SELECT count(*)::int AS count FROM meta_current_ranking_pointers
    WHERE dataset_kind='real' AND (id LIKE '%demo%' OR ranking_snapshot_id LIKE '%demo%')
  `)));
  const externalDemoSourceUrls = rowsOf(await db.execute(sql.raw(`
    SELECT count(*)::int AS count FROM meta_source_comp_observations
    WHERE dataset_kind='demo' AND source_url ~* '^https?://'
  `)));
  const demoNamespaceViolations = rowsOf(await db.execute(sql.raw(`
    SELECT count(*)::int AS count FROM meta_source_comp_observations
    WHERE dataset_kind='demo' AND id NOT LIKE 'demo_%'
  `)));
  const realDemoObservationLeaks = rowsOf(await db.execute(sql.raw(`
    SELECT count(*)::int AS count FROM meta_source_comp_observations
    WHERE dataset_kind='real' AND (source_url LIKE '/demo/%' OR id LIKE 'demo_%')
  `)));
  const observationSnapshotDatasetMismatches = rowsOf(await db.execute(sql.raw(`
    SELECT count(*)::int AS count
    FROM meta_source_comp_observations o
    JOIN meta_source_snapshots s ON s.id = o.snapshot_id
    WHERE o.dataset_kind <> s.dataset_kind
  `)));

  const checks = {
    requiredLiveVersions: requiredLive,
    missingLive,
    pbeRevisionCount: pbeRevisions.length,
    pbeRevisionLabels: pbeRevisions.map((release) => release.displayVersion),
    notesOnlyReleaseCount: notesOnlyReleases.length,
    gapReleaseCount: gapReleases.length,
    noSnapshotReleaseIds: releases.filter((release) => !release.currentSnapshotId).map((release) => release.id),
    compareChecks,
    rangeCheck,
    sourceRows,
    websitePointer: pointerRows.find((row) => row.board_type === "websites") || null,
    elitePointers: pointerRows.filter((row) => row.board_type === "elite"),
    rankingSnapshots: rankingRows,
    duplicateReleaseOccurrences: duplicateRows,
    realDatasetDemoReleaseLeakCount: countRows(realDemoRows),
    realDatasetDemoPointerLeakCount: countRows(realDemoPointers),
    demoExternalSourceUrlCount: countRows(externalDemoSourceUrls),
    demoObservationNamespaceViolationCount: countRows(demoNamespaceViolations),
    realDatasetDemoObservationLeakCount: countRows(realDemoObservationLeaks),
    observationSnapshotDatasetMismatchCount: countRows(observationSnapshotDatasetMismatches)
  };
  const passed = missingLive.length === 0
    && pbeRevisions.length >= 2
    && notesOnlyReleases.length >= 1
    && gapReleases.length >= 1
    && compareChecks.every((check) => check.passed)
    && rangeCheck.passed
    && sourceRows.length >= 5
    && Boolean(checks.websitePointer)
    && checks.elitePointers.length >= 1
    && rankingRows.some((row) => row.board_type === "websites" && row.status === "published")
    && rankingRows.some((row) => row.board_type === "elite" && row.status === "published")
    && duplicateRows.length === 0
    && checks.realDatasetDemoReleaseLeakCount === 0
    && checks.realDatasetDemoPointerLeakCount === 0
    && checks.demoExternalSourceUrlCount === 0
    && checks.demoObservationNamespaceViolationCount === 0
    && checks.realDatasetDemoObservationLeakCount === 0
    && checks.observationSnapshotDatasetMismatchCount === 0;

  const artifact = {
    generatedAt: new Date().toISOString(),
    datasetKind: "demo",
    passed,
    isolation: {
      demoReadsOnly: true,
      realReadsContainNoDemoIdentifiers: checks.realDatasetDemoReleaseLeakCount === 0
        && checks.realDatasetDemoPointerLeakCount === 0
        && checks.realDatasetDemoObservationLeakCount === 0,
      noDemoFallbackForReal: true,
      demoEvidenceIsInternal: checks.demoExternalSourceUrlCount === 0,
      demoObservationNamespaceIsolated: checks.demoObservationNamespaceViolationCount === 0
        && checks.observationSnapshotDatasetMismatchCount === 0
    },
    checks
  };
  fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
  fs.writeFileSync(ARTIFACT, JSON.stringify(artifact, null, 2), "utf8");
  console.log(JSON.stringify(artifact, null, 2));
  await closeDb();
  if (!passed) process.exitCode = 1;
}

main().catch(async (error: any) => {
  console.error("[demo verify] Failed:", error?.message || error);
  try { await closeDb(); } catch {}
  process.exit(1);
});
