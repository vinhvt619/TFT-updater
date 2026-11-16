import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getDb, closeDb, databaseRuntime } from "../../src/server/db/client";
import { sql } from "drizzle-orm";

const MIGRATION_SQL = [
  `ALTER TABLE meta_ranking_snapshots ADD COLUMN IF NOT EXISTS input_match_keys JSONB DEFAULT '[]'::jsonb;`,
  `ALTER TABLE meta_matches ADD COLUMN IF NOT EXISTS raw_artifact_id TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE meta_matches ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;`,
  `ALTER TABLE meta_matches ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'valid';`,
  `ALTER TABLE meta_matches ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;`,
  `ALTER TABLE meta_cohort_snapshots ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE meta_cohort_snapshots ADD COLUMN IF NOT EXISTS raw_artifact_id TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE meta_cohort_members ADD COLUMN IF NOT EXISTS riot_id_name TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE meta_cohort_members ADD COLUMN IF NOT EXISTS riot_id_tag TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE meta_collection_coverage ADD COLUMN IF NOT EXISTS requested_match_ids JSONB NOT NULL DEFAULT '[]'::jsonb;`,
  `ALTER TABLE meta_collection_coverage ADD COLUMN IF NOT EXISTS failure_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;`,
  `CREATE INDEX IF NOT EXISTS meta_matches_epoch_window_idx ON meta_matches (patch_epoch_id, ended_at, dataset_kind);`,
  `CREATE INDEX IF NOT EXISTS meta_matches_raw_artifact_idx ON meta_matches (raw_artifact_id);`
];

const REQUIRED = [
  ["meta_ranking_snapshots", "input_match_keys"],
  ["meta_matches", "raw_artifact_id"],
  ["meta_matches", "fetched_at"],
  ["meta_matches", "status"],
  ["meta_matches", "quarantine_reason"],
  ["meta_cohort_snapshots", "source_url"],
  ["meta_cohort_snapshots", "raw_artifact_id"],
  ["meta_collection_coverage", "requested_match_ids"],
  ["meta_collection_coverage", "failure_reasons"]
];

async function verify(client: { query(sql: string): Promise<any> }) {
  const missing: string[] = [];
  for (const [table, column] of REQUIRED) {
    const result = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${column}'`);
    const rows = result.rows || result;
    if (!rows || rows.length === 0) missing.push(`${table}.${column}`);
  }
  return missing;
}

async function verifyClone(dataDir: string) {
  const cloneDir = path.resolve(`./storage/pgdata_migration_check_${Date.now()}`);
  if (!fs.existsSync(dataDir)) throw new Error(`Không tìm thấy data directory: ${dataDir}`);
  try {
    fs.cpSync(dataDir, cloneDir, { recursive: true });
    databaseRuntime.cleanStaleLocks(cloneDir);
    const pg = new PGlite(cloneDir);
    await pg.waitReady;
    for (const statement of MIGRATION_SQL) await pg.query(statement);
    const missing = await verify(pg);
    await pg.close();
    if (missing.length) throw new Error(`Clone verification thiếu: ${missing.join(", ")}`);
    console.log("[migrate-match-lineage] Clone verification PASS");
  } finally {
    if (fs.existsSync(cloneDir)) fs.rmSync(cloneDir, { recursive: true, force: true });
  }
}

async function main() {
  const dataDir = databaseRuntime.getDataDir();
  await verifyClone(dataDir);
  if (process.argv.includes("--verify-clone")) return;
  const db = await getDb();
  for (const statement of MIGRATION_SQL) await db.execute(sql.raw(statement));
  const missing = await verify({ query: async (queryText) => {
    const result = await db.execute(sql.raw(queryText));
    return { rows: Array.isArray(result) ? result : result.rows || [] };
  }});
  if (missing.length) throw new Error(`Live verification thiếu: ${missing.join(", ")}`);
  await closeDb();
  console.log("[migrate-match-lineage] Live migration PASS");
}

main().catch((error: any) => {
  console.error("[migrate-match-lineage] Fatal:", error.message || error);
  process.exit(1);
});
