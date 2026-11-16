import { getDb, closeDb } from "../src/server/db/client";
import { applySchemaDdl } from "../src/server/db/schema-ddl";
import { sql } from "drizzle-orm";

async function runMigrations() {
  console.log("[Migrate] Initializing and verifying database schema...");
  const db = await getDb();

  const additiveAlters = [
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS patch_family TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS event_key TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS official_label TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS display_label TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS display_alias TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS alias_kind TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS season_phase TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS history_visibility TEXT NOT NULL DEFAULT 'primary';`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS visibility_reason TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS effective_precision TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS time_basis TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS ordering_key TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS canonical_release_id TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS release_aliases JSONB NOT NULL DEFAULT '[]'::jsonb;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}'::jsonb;`,
    `ALTER TABLE release_changes ADD COLUMN IF NOT EXISTS canonical_key TEXT;`,
    `ALTER TABLE release_changes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'gameplay';`,
    `ALTER TABLE meta_source_comp_observations ADD COLUMN IF NOT EXISTS source_data_as_of TIMESTAMPTZ;`,
    `ALTER TABLE meta_source_comp_observations ADD COLUMN IF NOT EXISTS source_lead_champion_id TEXT;`,
    `ALTER TABLE meta_source_comp_observations ADD COLUMN IF NOT EXISTS inferred JSONB;`,
    `ALTER TABLE meta_ranking_snapshots ADD COLUMN IF NOT EXISTS input_observation_ids JSONB DEFAULT '[]'::jsonb;`
  ];

  const runSteps = async (target: any) => {
    // 1. Base full schema DDL
    await applySchemaDdl(target);

    // 2. Additive idempotent ALTERs
    for (const query of additiveAlters) {
      await target.execute(sql.raw(query));
    }
  };

  if (typeof db.transaction === "function") {
    await db.transaction(async (tx: any) => {
      await runSteps(tx);
    });
  } else {
    await runSteps(db);
  }

  console.log("[Migrate] All base and meta tables verified/created successfully!");
}

runMigrations()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[Migrate] Failed:", err);
    try {
      await closeDb();
    } catch {}
    process.exit(1);
  });
