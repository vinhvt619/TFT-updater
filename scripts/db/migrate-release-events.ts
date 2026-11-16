import { sql } from "drizzle-orm";
import { getDb, closeDb } from "../../src/server/db/client";
import { parseTftVersion } from "../../src/domain/versioning";

/**
 * Release event schema migration.  It is deliberately additive and idempotent so
 * an existing PGlite data directory can be upgraded without dropping raw
 * evidence, snapshots, quarantine records, or pointers.
 */
const statements = [
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
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb;`,
  `ALTER TABLE releases ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}'::jsonb;`,
  `CREATE TABLE IF NOT EXISTS release_changes (
    id TEXT PRIMARY KEY,
    release_id TEXT REFERENCES releases(id) NOT NULL,
    source_event_id TEXT NOT NULL,
    entity_kind TEXT NOT NULL,
    entity_id TEXT,
    raw_entity_name TEXT,
    field_key TEXT,
    form_id TEXT,
    star_level INTEGER,
    unit TEXT,
    change_type TEXT NOT NULL,
    before_state TEXT NOT NULL,
    before_value JSONB,
    after_state TEXT NOT NULL,
    after_value JSONB,
    raw_text TEXT NOT NULL,
    basis TEXT NOT NULL,
    source_url TEXT,
    raw_artifact_id TEXT,
    raw_hash TEXT,
    source_locator TEXT,
    parser_version TEXT,
    applicability JSONB NOT NULL DEFAULT '{}'::jsonb,
    effective_precision TEXT,
    verification_status TEXT NOT NULL DEFAULT 'validated',
    evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS release_changes_release_idx ON release_changes (release_id, entity_kind, id);`,
  `CREATE INDEX IF NOT EXISTS releases_catalogue_idx ON releases (dataset_kind, history_visibility, ordering_key, observed_at);`
];

const quote = (value: string | null) => value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`;

type ReleaseRow = {
  id: string;
  dataset_kind: string;
  channel: string;
  patch_label: string | null;
  build_id: string | null;
  occurrence_key: string;
  effective_at: string | null;
  observed_at: string;
  current_snapshot_id: string | null;
  version_key: string | null;
  display_version: string | null;
};

function explicitMetadata(row: ReleaseRow) {
  const id = row.id;
  if (row.dataset_kind !== "real") return null;
  const base = {
    patchFamily: null as string | null,
    eventKey: id,
    officialLabel: null as string | null,
    displayLabel: row.display_version || row.patch_label || id,
    displayAlias: null as string | null,
    aliasKind: null as string | null,
    seasonPhase: row.channel === "pbe" ? "unknown" : "live",
    historyVisibility: "primary",
    visibilityReason: null as string | null,
    effectivePrecision: row.effective_at ? "day" : "unknown",
    timeBasis: row.effective_at ? "publisher" : "unknown",
    orderingKey: `90:${row.observed_at}:${id}`
  };
  if (id === "rel_live_18_1") return { ...base, patchFamily: "18.1", officialLabel: "18.1", displayLabel: "Live 18.1 · Snapshot (quarantined)", visibilityReason: "Snapshot exists but remains quarantined; notes launch is a separate node." , orderingKey: "20:18.1:live:snapshot" };
  if (id === "event_live_18_1_launch") return { ...base, patchFamily: "18.1", officialLabel: "18.1", displayLabel: "Live 18.1 · Patch notes · Ra mắt mùa 18", displayAlias: "18.1", aliasKind: "official", effectivePrecision: "day", timeBasis: "publisher", orderingKey: "10:18.1:live:launch" };
  if (id === "event_live_18_1_mid_aug27") return { ...base, patchFamily: "18.1", officialLabel: "AUGUST 27TH", displayLabel: "Live 18.1a · cập nhật 27/08 · Patch notes", displayAlias: "18.1a", aliasKind: "unofficial_display_alias", effectivePrecision: "date", timeBasis: "publisher", orderingKey: "30:18.1:live:2026-08-27", visibilityReason: "Riot chỉ ghi ngày; 18.1a là alias hiển thị." };
  if (id === "event_live_18_1_mid_aug28") return { ...base, patchFamily: "18.1", officialLabel: "AUGUST 28TH", displayLabel: "Live 18.1 · cập nhật 28/08 · Patch notes", displayAlias: "18.1 update 28/08", aliasKind: "unofficial_display_alias", effectivePrecision: "date", timeBasis: "publisher", orderingKey: "40:18.1:live:2026-08-28", visibilityReason: "Riot không đặt suffix a/b cho mục tính năng và sửa lỗi này." };
  if (id === "event_live_18_1_mid_aug31") return { ...base, patchFamily: "18.1", officialLabel: "AUGUST 31ST AND SEPTEMBER 1ST", displayLabel: "Live 18.1b · cập nhật 31/08–01/09 · Patch notes", displayAlias: "18.1b", aliasKind: "unofficial_display_alias", effectivePrecision: "date", timeBasis: "publisher", orderingKey: "50:18.1:live:2026-08-31", visibilityReason: "18.1b là alias hiển thị cho đợt cân bằng; nhãn Riot giữ nguyên ngày." };
  if (id === "event_live_18_2_main") return { ...base, patchFamily: "18.2", officialLabel: "18.2", displayLabel: "Live 18.2 · Patch notes", displayAlias: "18.2", aliasKind: "official", effectivePrecision: "day", timeBasis: "publisher", orderingKey: "60:18.2:live:notes" };
  if (id === "rel_live_18_2") return { ...base, patchFamily: "18.2", officialLabel: "18.2", displayLabel: "Live 18.2 · Snapshot + Patch notes", displayAlias: "18.2", aliasKind: "official", effectivePrecision: "day", timeBasis: "observed_transition", orderingKey: "70:18.2:live:snapshot", visibilityReason: "Build/snapshot được giữ riêng; patch notes là evidence bổ trợ." };
  if (id === "rel_pbe_18_3") return { ...base, patchFamily: "18.3", seasonPhase: "postlaunch_pbe", historyVisibility: "archive", displayLabel: "PBE · r633df11c · archive (chưa chứng minh trước launch)", visibilityReason: "Capture PBE được quan sát sau các mốc Live lưu trong kho; không có bằng chứng prelaunch.", orderingKey: "archive:postlaunch:pbe:633df11c" };
  return base;
}

async function main() {
  const db = await getDb();
  for (const statement of statements) await db.execute(sql.raw(statement));
  const result = await db.execute(sql.raw("SELECT id,dataset_kind,channel,patch_label,build_id,occurrence_key,effective_at,observed_at,current_snapshot_id,version_key,display_version FROM releases"));
  const rows = (Array.isArray(result) ? result : result.rows || []) as ReleaseRow[];
  let updated = 0;
  for (const row of rows) {
    const parsed = parseTftVersion(row.patch_label, row.channel as any, row.occurrence_key, row.build_id);
    const explicit = explicitMetadata(row);
    const patchFamily = explicit?.patchFamily || parsed.baseVersion;
    const eventKey = explicit?.eventKey || row.occurrence_key;
    const displayLabel = explicit?.displayLabel || row.display_version || parsed.displayVersion;
    const historyVisibility = explicit?.historyVisibility || "primary";
    const seasonPhase = explicit?.seasonPhase || (row.channel === "pbe" ? "unknown" : "live");
    const orderingKey = explicit?.orderingKey || `${row.channel}:${parsed.sortKey}:${row.observed_at}:${row.id}`;
    const capabilities = {
      canCompareSnapshot: Boolean(row.current_snapshot_id),
      canCompareNotes: row.dataset_kind === "real" && ["event_live_18_1_launch", "event_live_18_1_mid_aug27", "event_live_18_1_mid_aug28", "event_live_18_1_mid_aug31", "event_live_18_2_main", "rel_live_18_2"].includes(row.id),
      missingEvidence: row.current_snapshot_id ? [] : ["snapshot"]
    };
    const provenance = { source: "round12-migration", releaseId: row.id, occurrenceKey: row.occurrence_key };
    await db.execute(sql.raw(`UPDATE releases SET
      patch_family=${quote(patchFamily)}, event_key=${quote(eventKey)},
      official_label=${quote(explicit?.officialLabel || row.patch_label)},
      display_label=${quote(displayLabel)}, display_alias=${quote(explicit?.displayAlias || null)},
      alias_kind=${quote(explicit?.aliasKind || null)}, season_phase=${quote(seasonPhase)},
      history_visibility=${quote(historyVisibility)}, visibility_reason=${quote(explicit?.visibilityReason || null)},
      effective_precision=${quote(explicit?.effectivePrecision || (row.effective_at ? "day" : "unknown"))},
      time_basis=${quote(explicit?.timeBasis || (row.effective_at ? "publisher" : "unknown"))},
      fetched_at=COALESCE(fetched_at, observed_at), ordering_key=${quote(orderingKey)},
      provenance='${JSON.stringify(provenance).replace(/'/g, "''")}'::jsonb,
      capabilities='${JSON.stringify(capabilities).replace(/'/g, "''")}'::jsonb,
      version_key=COALESCE(version_key,${quote(parsed.versionKey)}),
      display_version=${quote(explicit?.displayAlias || parsed.displayVersion)},
      version_sort_key=COALESCE(version_sort_key,${quote(parsed.sortKey)}),
      release_kind=COALESCE(release_kind,${quote(parsed.kind)}),
      hotfix_suffix=COALESCE(hotfix_suffix,${quote(parsed.hotfixSuffix)}),
      pbe_revision=COALESCE(pbe_revision,${quote(parsed.pbeRevision)})
      WHERE id=${quote(row.id)}`));
    updated++;
  }
  const required = ["patch_family", "event_key", "history_visibility", "season_phase", "ordering_key"];
  const missing: string[] = [];
  for (const column of required) {
    const check = await db.execute(sql.raw(`SELECT 1 FROM information_schema.columns WHERE table_name='releases' AND column_name='${column}'`));
    if (!(Array.isArray(check) ? check : check.rows || []).length) missing.push(`releases.${column}`);
  }
  if (missing.length) throw new Error(`Missing Round12 columns: ${missing.join(", ")}`);
  console.log(JSON.stringify({ migration: "round12", updatedReleases: updated, releaseChangesTable: true, missing }, null, 2));
  await closeDb();
}

main().catch(async (error) => {
  console.error("[migrate-release-events] Fatal:", error?.message || error);
  try { await closeDb(); } catch {}
  process.exit(1);
});

