import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { getDb, closeDb, databaseRuntime } from "../../src/server/db/client";
import { parseTftVersion } from "../../src/domain/versioning";

const MIGRATION_SQL = [
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS version_key TEXT;`,
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS display_version TEXT;`,
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS version_sort_key TEXT;`,
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS release_kind TEXT;`,
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS hotfix_suffix TEXT;`,
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS pbe_revision TEXT;`,
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS evidence_status TEXT NOT NULL DEFAULT 'unknown';`,
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS parent_release_id TEXT;`,
  `CREATE TABLE IF NOT EXISTS collection_run_ledger (
    id TEXT PRIMARY KEY,
    dataset_kind TEXT NOT NULL,
    run_kind TEXT NOT NULL,
    status TEXT NOT NULL,
    subject_commit TEXT,
    fetch_mode TEXT NOT NULL DEFAULT 'offline',
    requested_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS releases_version_sort_idx ON releases (dataset_kind, version_sort_key, observed_at);`,
  `CREATE INDEX IF NOT EXISTS collection_run_ledger_dataset_idx ON collection_run_ledger (dataset_kind, run_kind, created_at);`,
  // The legacy demo providers used live-shaped primary keys. If that older
  // seed already ran, its upsert could leave synthetic rows in the real
  // dataset (or legacy demo rows outside the demo namespace). Remove those
  // recoverable legacy rows before reseeding the isolated demo data.
  // Builds have an FK to observations, so clear them first. Current real
  // snapshots keep their input ids in JSON and are rebuilt by the collector;
  // no snapshot/pointer FK is broken by this cleanup.
  `DELETE FROM meta_source_comp_builds
    WHERE observation_id IN (
      SELECT id FROM meta_source_comp_observations
      WHERE (dataset_kind = 'real' AND source_url LIKE '/demo/%')
         OR (dataset_kind = 'demo' AND id NOT LIKE 'demo_%')
    );`,
  `DELETE FROM meta_source_comp_observations
    WHERE (dataset_kind = 'real' AND source_url LIKE '/demo/%')
       OR (dataset_kind = 'demo' AND id NOT LIKE 'demo_%');`
];

const REQUIRED = [
  ["releases", "version_key"],
  ["releases", "display_version"],
  ["releases", "version_sort_key"],
  ["releases", "release_kind"],
  ["releases", "hotfix_suffix"],
  ["releases", "pbe_revision"],
  ["releases", "evidence_status"],
  ["releases", "parent_release_id"],
  ["collection_run_ledger", "id"],
  ["collection_run_ledger", "dataset_kind"],
  ["collection_run_ledger", "run_kind"],
  ["collection_run_ledger", "status"]
];

type QueryClient = { query(queryText: string): Promise<any> };

async function verify(client: QueryClient) {
  const missing: string[] = [];
  for (const [table, column] of REQUIRED) {
    const result = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${column}'`
    );
    const rows = result.rows || result;
    if (!rows || rows.length === 0) missing.push(`${table}.${column}`);
  }
  return missing;
}

async function runStatements(client: { query(queryText: string): Promise<any> }) {
  for (const statement of MIGRATION_SQL) await client.query(statement);
}

async function verifyClone(dataDir: string) {
  if (!fs.existsSync(dataDir)) {
    console.log(`[migrate-release-versions] PGlite data directory not present (${dataDir}); clone check is not applicable.`);
    return { applicable: false, passed: true };
  }
  const cloneDir = path.resolve(`./storage/pgdata_migration_check_${Date.now()}`);
  try {
    fs.cpSync(dataDir, cloneDir, { recursive: true });
    databaseRuntime.cleanStaleLocks(cloneDir);
    const pg = new PGlite(cloneDir);
    await pg.waitReady;
    await runStatements(pg);
    const missing = await verify(pg);
    await pg.close();
    if (missing.length) throw new Error(`Clone verification thiếu: ${missing.join(", ")}`);
    console.log("[migrate-release-versions] Clone verification PASS");
    return { applicable: true, passed: true };
  } finally {
    if (fs.existsSync(cloneDir)) fs.rmSync(cloneDir, { recursive: true, force: true });
  }
}

function quote(value: string | null) {
  return value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`;
}

async function backfillReleaseVersionMetadata(db: any) {
  const result = await db.execute(sql.raw("SELECT id, patch_label, channel, occurrence_key, build_id, current_snapshot_id, evidence_status FROM releases"));
  const rows = (Array.isArray(result) ? result : result?.rows || []) as any[];
  for (const row of rows) {
    const parsed = parseTftVersion(row.patch_label, row.channel, row.occurrence_key, row.build_id);
    // Preserve an explicit gap/notes-only marker when a release has no
    // snapshot. A migration must enrich version metadata without converting
    // a known data gap into a generic notes-only node.
    const evidenceStatus = row.current_snapshot_id
      ? "available"
      : row.evidence_status === "gap" || row.evidence_status === "notes_only"
        ? row.evidence_status
        : "notes_only";
    await db.execute(sql.raw(`UPDATE releases SET
      version_key=${quote(parsed.versionKey)},
      display_version=${quote(parsed.displayVersion)},
      version_sort_key=${quote(parsed.sortKey)},
      release_kind=${quote(parsed.kind)},
      hotfix_suffix=${quote(parsed.hotfixSuffix)},
      pbe_revision=${quote(parsed.pbeRevision)},
      evidence_status=${quote(evidenceStatus)}
      WHERE id=${quote(String(row.id))}`));
  }
  return rows.length;
}

async function main() {
  const cloneResult = await verifyClone(databaseRuntime.getDataDir());
  if (process.argv.includes("--verify-clone")) {
    console.log(JSON.stringify({ clone: cloneResult }));
    return;
  }

  const db = await getDb();
  for (const statement of MIGRATION_SQL) await db.execute(sql.raw(statement));
  const updatedReleases = await backfillReleaseVersionMetadata(db);
  const missing = await verify({
    query: async (queryText) => {
      const result = await db.execute(sql.raw(queryText));
      return { rows: Array.isArray(result) ? result : result.rows || [] };
    }
  });
  if (missing.length) throw new Error(`Live verification thiếu: ${missing.join(", ")}`);
  await closeDb();
  console.log(`[migrate-release-versions] Live migration PASS; backfilled ${updatedReleases} releases.`);
}

main().catch(async (error: any) => {
  console.error("[migrate-release-versions] Fatal:", error?.message || error);
  try { await closeDb(); } catch {}
  process.exit(1);
});
