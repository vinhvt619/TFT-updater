import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getDb, closeDb, databaseRuntime } from "../../src/server/db/client";
import { sql } from "drizzle-orm";

const MIGRATION_SQL = [
  `ALTER TABLE meta_source_comp_builds ADD COLUMN IF NOT EXISTS board_completeness TEXT NOT NULL DEFAULT 'exact';`,
  `ALTER TABLE meta_source_comp_builds ADD COLUMN IF NOT EXISTS board_level_min INTEGER;`,
  `ALTER TABLE meta_source_comp_builds ADD COLUMN IF NOT EXISTS board_level_max INTEGER;`,
  `ALTER TABLE meta_source_comp_builds ADD COLUMN IF NOT EXISTS source_variant_key TEXT;`,
  `ALTER TABLE meta_source_comp_builds ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;`,
  `ALTER TABLE meta_source_comp_builds ADD COLUMN IF NOT EXISTS raw_artifact_id TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE meta_source_comp_builds ADD COLUMN IF NOT EXISTS raw_locator TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE meta_ranking_rows ADD COLUMN IF NOT EXISTS recommended_board JSONB NOT NULL DEFAULT '[]'::jsonb;`,
  `ALTER TABLE meta_ranking_rows ADD COLUMN IF NOT EXISTS recommended_items JSONB NOT NULL DEFAULT '{}'::jsonb;`,
  `ALTER TABLE meta_ranking_rows ADD COLUMN IF NOT EXISTS selected_source_build_id TEXT;`,
  `ALTER TABLE meta_ranking_rows ADD COLUMN IF NOT EXISTS selection_reason TEXT;`,
  `ALTER TABLE meta_ranking_rows ADD COLUMN IF NOT EXISTS available_source_builds JSONB NOT NULL DEFAULT '[]'::jsonb;`,
  `CREATE TABLE IF NOT EXISTS meta_current_ranking_pointers (
    id TEXT PRIMARY KEY,
    board_type TEXT NOT NULL,
    patch_epoch_id TEXT NOT NULL,
    dataset_kind TEXT NOT NULL,
    ranking_snapshot_id TEXT REFERENCES meta_ranking_snapshots(id) NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    input_count INTEGER NOT NULL,
    ranked_count INTEGER NOT NULL,
    fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`
];

const REQUIRED_BUILD_COLUMNS = [
  "board_completeness",
  "board_level_min",
  "board_level_max",
  "source_variant_key",
  "source_updated_at",
  "raw_artifact_id",
  "raw_locator"
];

const REQUIRED_RANKING_COLUMNS = [
  "recommended_board",
  "recommended_items",
  "selected_source_build_id",
  "selection_reason",
  "available_source_builds"
];

async function verifyMigration(pgClient: any): Promise<{ success: boolean; missing: string[] }> {
  const missing: string[] = [];

  // Check columns in meta_source_comp_builds
  const colRes = await pgClient.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'meta_source_comp_builds'`
  );
  const foundCols = new Set((colRes.rows || colRes).map((r: any) => r.column_name));
  for (const col of REQUIRED_BUILD_COLUMNS) {
    if (!foundCols.has(col)) {
      missing.push(`column meta_source_comp_builds.${col}`);
    }
  }

  const rankingColRes = await pgClient.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'meta_ranking_rows'`
  );
  const foundRankingCols = new Set((rankingColRes.rows || rankingColRes).map((r: any) => r.column_name));
  for (const col of REQUIRED_RANKING_COLUMNS) {
    if (!foundRankingCols.has(col)) missing.push(`column meta_ranking_rows.${col}`);
  }

  // Check table meta_current_ranking_pointers
  const tableRes = await pgClient.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'meta_current_ranking_pointers'`
  );
  const foundTables = (tableRes.rows || tableRes).map((r: any) => r.table_name);
  if (!foundTables.includes("meta_current_ranking_pointers")) {
    missing.push("table meta_current_ranking_pointers");
  }

  return {
    success: missing.length === 0,
    missing
  };
}

async function runCloneVerification(originalDataDir: string) {
  console.log("[migrate-board-provenance] Running verification on temporary database clone...");
  const tempCloneDir = path.resolve(`./storage/pgdata_clone_test_${Date.now()}`);

  if (!fs.existsSync(originalDataDir)) {
    throw new Error(`Original data directory not found: ${originalDataDir}`);
  }

  try {
    // Copy original data directory
    fs.cpSync(originalDataDir, tempCloneDir, { recursive: true });
    databaseRuntime.cleanStaleLocks(tempCloneDir);

    const pglite = new PGlite(tempCloneDir);
    await pglite.waitReady;

    console.log("[migrate-board-provenance] Applying migration statements to clone...");
    for (const stmt of MIGRATION_SQL) {
      await pglite.query(stmt);
    }

    const verification = await verifyMigration(pglite);
    await pglite.close();

    if (!verification.success) {
      throw new Error(`Clone migration verification failed! Missing: ${verification.missing.join(", ")}`);
    }

    console.log("[migrate-board-provenance] Clone verification PASSED. All columns and tables created successfully.");
  } finally {
    if (fs.existsSync(tempCloneDir)) {
      try {
        fs.rmSync(tempCloneDir, { recursive: true, force: true });
      } catch (err: any) {
        console.warn("[migrate-board-provenance] Warning: Could not clean clone temp dir:", err.message);
      }
    }
  }
}

async function runLiveMigration() {
  const dataDir = databaseRuntime.getDataDir();
  console.log(`[migrate-board-provenance] Applying migration to active database at ${dataDir}...`);

  const db = await getDb();
  for (const stmt of MIGRATION_SQL) {
    await db.execute(sql.raw(stmt));
  }

  // Verify
  const verification = await verifyMigration({
    query: async (queryText: string) => {
      const res = await db.execute(sql.raw(queryText));
      return { rows: Array.isArray(res) ? res : res.rows || [] };
    }
  });

  if (!verification.success) {
    throw new Error(`Live migration verification failed! Missing: ${verification.missing.join(", ")}`);
  }

  // Backfill the latest published snapshot for every board/patch/dataset scope.
  const snapRes = await db.execute(
    sql.raw(`SELECT DISTINCT ON (board_type, patch_epoch_id, dataset_kind)
      id, board_type, patch_epoch_id, dataset_kind, totals, input_observation_ids, created_at
      FROM meta_ranking_snapshots
      WHERE status = 'published'
      ORDER BY board_type, patch_epoch_id, dataset_kind, created_at DESC`)
  );
  const snapRows = Array.isArray(snapRes) ? snapRes : snapRes.rows || [];
  for (const snap of snapRows as any[]) {
      const pointerId = `pointer_${snap.board_type}_${snap.patch_epoch_id}_${snap.dataset_kind}`;
      const inputCount = Array.isArray(snap.input_observation_ids)
        ? snap.input_observation_ids.length
        : ((snap.totals && (snap.totals as any).inputCount) || 0);
      const rankedCount = ["rankedTierS", "rankedTierA", "rankedTierB", "rankedTierC"]
        .reduce((sum, key) => sum + Number((snap.totals && (snap.totals as any)[key]) || 0), 0);
      const fingerprint = `snap_${snap.id}`;
      const escaped = (value: unknown) => String(value ?? "").replace(/'/g, "''");

      await db.execute(
        sql.raw(`INSERT INTO meta_current_ranking_pointers (id, board_type, patch_epoch_id, dataset_kind, ranking_snapshot_id, published_at, input_count, ranked_count, fingerprint, created_at)
        VALUES ('${escaped(pointerId)}', '${escaped(snap.board_type)}', '${escaped(snap.patch_epoch_id)}', '${escaped(snap.dataset_kind)}', '${escaped(snap.id)}', '${snap.created_at ? new Date(snap.created_at).toISOString() : new Date().toISOString()}', ${inputCount}, ${rankedCount}, '${escaped(fingerprint)}', NOW())
        ON CONFLICT (id) DO UPDATE SET
          ranking_snapshot_id = EXCLUDED.ranking_snapshot_id,
          published_at = EXCLUDED.published_at,
          input_count = EXCLUDED.input_count,
          ranked_count = EXCLUDED.ranked_count,
          fingerprint = EXCLUDED.fingerprint;`)
      );
      console.log(`[migrate-board-provenance] Initialized ranking pointer ${pointerId} -> snapshot ${snap.id}`);
  }

  await closeDb();
  console.log("[migrate-board-provenance] Live migration completed successfully!");
}

async function main() {
  const isVerifyClone = process.argv.includes("--verify-clone");
  const dataDir = databaseRuntime.getDataDir();

  if (isVerifyClone) {
    await runCloneVerification(dataDir);
  } else {
    // First run clone verification to be 100% safe
    await runCloneVerification(dataDir);
    // Then run live migration
    await runLiveMigration();
  }
}

main().catch((err) => {
  console.error("[migrate-board-provenance] Fatal error:", err);
  process.exit(1);
});
