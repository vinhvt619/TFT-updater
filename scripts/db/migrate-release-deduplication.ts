import { sql } from "drizzle-orm";
import { getDb, closeDb } from "../../src/server/db/client";

/**
 * This is an additive, idempotent data migration.  It records release
 * aliases and a stable change identity so the notes view can collapse the
 * old 18.2 duplicate without deleting raw evidence.
 */
async function main() {
  const db = await getDb();
  const statements = [
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS canonical_release_id TEXT;`,
    `ALTER TABLE releases ADD COLUMN IF NOT EXISTS release_aliases JSONB NOT NULL DEFAULT '[]'::jsonb;`,
    `ALTER TABLE release_changes ADD COLUMN IF NOT EXISTS canonical_key TEXT;`,
    `ALTER TABLE release_changes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'gameplay';`,
    `CREATE INDEX IF NOT EXISTS releases_canonical_release_idx ON releases (dataset_kind, canonical_release_id, history_visibility);`,
    `CREATE INDEX IF NOT EXISTS release_changes_canonical_key_idx ON release_changes (release_id, canonical_key);`,
    `UPDATE releases SET canonical_release_id = id WHERE canonical_release_id IS NULL;`,
    `UPDATE releases SET canonical_release_id = 'rel_live_18_2', release_aliases = '["event_live_18_2_main"]'::jsonb, history_visibility = 'primary', visibility_reason = 'Mốc chính thức hợp nhất snapshot và patch notes; alias event_live_18_2_main được giữ trong provenance.' WHERE id = 'rel_live_18_2' AND dataset_kind = 'real';`,
    `UPDATE releases SET canonical_release_id = 'rel_live_18_2', release_aliases = '["rel_live_18_2"]'::jsonb, history_visibility = 'archive', visibility_reason = 'Alias patch notes cũ; nội dung được truy nguyên ở rel_live_18_2 để tránh đếm trùng.' WHERE id = 'event_live_18_2_main' AND dataset_kind = 'real';`,
    `UPDATE releases SET patch_family = COALESCE(patch_family, '18.2'), official_label = COALESCE(official_label, '18.2'), display_label = 'Live 18.2 — Snapshot + Patch notes', display_alias = COALESCE(display_alias, '18.2'), alias_kind = COALESCE(alias_kind, 'official'), capabilities = '{"canCompareSnapshot":true,"canCompareNotes":true,"missingEvidence":[]}'::jsonb WHERE id = 'rel_live_18_2' AND dataset_kind = 'real';`,
    `UPDATE release_changes SET canonical_key = lower(concat_ws('|', source_event_id, entity_kind, coalesce(entity_id, ''), coalesce(form_id, ''), coalesce(field_key, ''), coalesce(change_type, ''), before_state, coalesce(before_value::text, ''), after_state, coalesce(after_value::text, ''), raw_text)), visibility = CASE WHEN entity_kind = 'bugfix' OR lower(change_type) ~ '(bugfix|tooltip|maintenance)' OR lower(raw_text) ~ '(bug fix|bugfix|tooltip|sửa lỗi|lỗi hiển thị|no longer|white boxes)' THEN 'maintenance' ELSE 'gameplay' END WHERE canonical_key IS NULL OR visibility = 'gameplay';`,
    `INSERT INTO snapshot_artifacts (id, snapshot_id, artifact_id, role) SELECT 'sa_snap_real_cdragon_live_18_2_art_cdragon_live_18_2', 'snap_real_cdragon_live_18_2', 'art_cdragon_live_18_2', 'source_payload' WHERE FALSE ON CONFLICT (id) DO NOTHING;`,
    `INSERT INTO snapshot_artifacts (id, snapshot_id, artifact_id, role) SELECT 'sa_snap_real_cdragon_pbe_18_3_art_cdragon_pbe_18_3', 'snap_real_cdragon_pbe_18_3', 'art_cdragon_pbe_18_3', 'source_payload' WHERE FALSE ON CONFLICT (id) DO NOTHING;`
  ];
  for (const statement of statements) await db.execute(sql.raw(statement));
  const result = await db.execute(sql.raw(`SELECT
    (SELECT count(*) FROM releases WHERE dataset_kind='real' AND history_visibility='archive' AND canonical_release_id='rel_live_18_2') AS archived_aliases,
    (SELECT count(*) FROM releases WHERE dataset_kind='real' AND canonical_release_id='rel_live_18_2' AND history_visibility='primary') AS canonical_releases,
    (SELECT count(*) FROM release_changes WHERE visibility='maintenance') AS maintenance_rows,
    (SELECT count(*) FROM release_changes WHERE canonical_key IS NULL) AS missing_change_keys`));
  const rows = Array.isArray(result) ? result : result.rows || [];
  console.log(JSON.stringify({ migration: "round13", idempotent: true, ...rows[0] }, null, 2));
  await closeDb();
}

main().catch(async (error) => {
  console.error("[migrate-release-deduplication] Fatal:", error?.message || error);
  try { await closeDb(); } catch {}
  process.exit(1);
});
