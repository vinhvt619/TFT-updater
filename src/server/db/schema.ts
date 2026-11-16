import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  unique,
  primaryKey,
  bigint
} from "drizzle-orm/pg-core";

// 1. sources
export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  channel: text("channel").notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  config: jsonb("config").default({}).notNull()
});

// 2. raw_artifacts
export const rawArtifacts = pgTable("raw_artifacts", {
  id: text("id").primaryKey(),
  sha256: text("sha256").unique().notNull(),
  storageKey: text("storage_key").notNull(),
  byteSize: integer("byte_size").notNull(),
  contentType: text("content_type").default("application/json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 3. ingestion_runs
export const ingestionRuns = pgTable("ingestion_runs", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").references(() => sources.id),
  status: text("status").notNull(), // running, success, failed, skipped_locked
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorCode: text("error_code"),
  diagnostics: jsonb("diagnostics").default({}).notNull()
});

// 4. observations
export const observations = pgTable("observations", {
  id: text("id").primaryKey(),
  runId: text("run_id").references(() => ingestionRuns.id),
  sourceId: text("source_id").references(() => sources.id).notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
  status: integer("status").notNull(),
  artifactId: text("artifact_id").references(() => rawArtifacts.id),
  buildId: text("build_id"),
  snapshotId: text("snapshot_id")
});

// 5. releases
export const releases = pgTable("releases", {
  id: text("id").primaryKey(),
  datasetKind: text("dataset_kind").notNull(), // real, demo
  setNumber: integer("set_number").notNull(),
  gameMode: text("game_mode").default("standard").notNull(),
  channel: text("channel").notNull(), // pbe, live
  patchLabel: text("patch_label"),
  buildId: text("build_id"),
  occurrenceKey: text("occurrence_key").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }),
  observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
  currentSnapshotId: text("current_snapshot_id"),
  versionKey: text("version_key"),
  displayVersion: text("display_version"),
  versionSortKey: text("version_sort_key"),
  releaseKind: text("release_kind"),
  hotfixSuffix: text("hotfix_suffix"),
  pbeRevision: text("pbe_revision"),
  evidenceStatus: text("evidence_status").default("unknown").notNull(),
  parentReleaseId: text("parent_release_id"),
  patchFamily: text("patch_family"),
  eventKey: text("event_key"),
  officialLabel: text("official_label"),
  displayLabel: text("display_label"),
  displayAlias: text("display_alias"),
  aliasKind: text("alias_kind"),
  seasonPhase: text("season_phase"),
  historyVisibility: text("history_visibility").default("primary"),
  visibilityReason: text("visibility_reason"),
  effectivePrecision: text("effective_precision"),
  timeBasis: text("time_basis"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  orderingKey: text("ordering_key"),
  provenance: jsonb("provenance").default({}).notNull(),
  capabilities: jsonb("capabilities").default({}).notNull()
  ,canonicalReleaseId: text("canonical_release_id")
  ,releaseAliases: jsonb("release_aliases").default([]).notNull()
});

// 6. release_markers
export const releaseMarkers = pgTable("release_markers", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").references(() => releases.id).notNull(),
  marker: text("marker").notNull(), // launch, initial_pbe, hotfix
  evidenceRefs: jsonb("evidence_refs").default([]).notNull(),
  actor: text("actor").default("system").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 7. snapshots
export const snapshots = pgTable(
  "snapshots",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id").references(() => releases.id).notNull(),
    revision: integer("revision").default(1).notNull(),
    status: text("status").default("staging").notNull(), // staging, quarantined, published, withdrawn
    supersedesSnapshotId: text("supersedes_snapshot_id"),
    reason: text("reason"),
    parserVersion: text("parser_version").default("1.0.0").notNull(),
    mappingVersion: text("mapping_version").default("1.0.0").notNull(),
    schemaVersion: text("schema_version").default("1.0.0").notNull(),
    rawHash: text("raw_hash").notNull(),
    gameplayHash: text("gameplay_hash").notNull(),
    presentationHash: text("presentation_hash").notNull(),
    coverage: jsonb("coverage").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    unique("snapshot_release_revision_unique").on(table.releaseId, table.revision)
  ]
);

// 8. snapshot_artifacts
export const snapshotArtifacts = pgTable("snapshot_artifacts", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id").references(() => snapshots.id).notNull(),
  artifactId: text("artifact_id").references(() => rawArtifacts.id).notNull(),
  role: text("role").default("source_payload").notNull()
});

// 9. champions
export const champions = pgTable("champions", {
  id: text("id").primaryKey(), // canonicalKey: tft18_caitlyn
  setNumber: integer("set_number").notNull(),
  canonicalKey: text("canonical_key").notNull()
});

// 10. champion_snapshots
export const championSnapshots = pgTable(
  "champion_snapshots",
  {
    snapshotId: text("snapshot_id").references(() => snapshots.id).notNull(),
    championId: text("champion_id").references(() => champions.id).notNull(),
    payload: jsonb("payload").notNull() // ChampionRecord
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.championId] })
  ]
);

// 11. trait_snapshots
export const traitSnapshots = pgTable(
  "trait_snapshots",
  {
    snapshotId: text("snapshot_id").references(() => snapshots.id).notNull(),
    traitId: text("trait_id").notNull(),
    nameVi: text("name_vi").notNull(),
    nameEn: text("name_en").notNull(),
    evidenceRefs: jsonb("evidence_refs").default([]).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.traitId] })
  ]
);

// 12. evidence_refs
export const evidenceRefs = pgTable("evidence_refs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // raw_artifact, patch_notes, manual_entry, demo_fixture
  sourceId: text("source_id").notNull(),
  artifactId: text("artifact_id").references(() => rawArtifacts.id),
  title: text("title").notNull(),
  url: text("url"),
  locator: text("locator"),
  snippet: text("snippet"),
  sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
  datasetKind: text("dataset_kind").notNull()
});

// 13. snapshot_evidence
export const snapshotEvidence = pgTable(
  "snapshot_evidence",
  {
    snapshotId: text("snapshot_id").references(() => snapshots.id).notNull(),
    evidenceId: text("evidence_id").references(() => evidenceRefs.id).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.evidenceId] })
  ]
);

// 14. change_notes
export const changeNotes = pgTable("change_notes", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").references(() => releases.id).notNull(),
  championId: text("champion_id").references(() => champions.id),
  variantKey: text("variant_key"),
  category: text("category").notNull(), // bugfix, mechanic, rework, adjustment
  text: text("text").notNull(),
  evidenceRefs: jsonb("evidence_refs").default([]).notNull()
});

// Normalized claims parsed from immutable Riot patch-note artifacts.  Keeping
// these separate from snapshot rows lets a notes-only release remain useful
// without inventing a gameplay snapshot.
export const releaseChanges = pgTable("release_changes", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").references(() => releases.id).notNull(),
  sourceEventId: text("source_event_id").notNull(),
  entityKind: text("entity_kind").notNull(),
  entityId: text("entity_id"),
  rawEntityName: text("raw_entity_name"),
  fieldKey: text("field_key"),
  formId: text("form_id"),
  starLevel: integer("star_level"),
  unit: text("unit"),
  changeType: text("change_type").notNull(),
  beforeState: text("before_state").notNull(),
  beforeValue: jsonb("before_value"),
  afterState: text("after_state").notNull(),
  afterValue: jsonb("after_value"),
  rawText: text("raw_text").notNull(),
  basis: text("basis").notNull(),
  sourceUrl: text("source_url"),
  rawArtifactId: text("raw_artifact_id"),
  rawHash: text("raw_hash"),
  sourceLocator: text("source_locator"),
  parserVersion: text("parser_version"),
  applicability: jsonb("applicability").default({}).notNull(),
  effectivePrecision: text("effective_precision"),
  verificationStatus: text("verification_status").notNull().default("validated"),
  evidenceIds: jsonb("evidence_ids").default([]).notNull(),
  canonicalKey: text("canonical_key"),
  visibility: text("visibility").notNull().default("gameplay"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 15. diff_cache
export const diffCache = pgTable(
  "diff_cache",
  {
    fromSnapshotId: text("from_snapshot_id").notNull(),
    toSnapshotId: text("to_snapshot_id").notNull(),
    diffEngineVersion: text("diff_engine_version").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.fromSnapshotId, table.toSnapshotId, table.diffEngineVersion] })
  ]
);

// 16. audit_log
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  evidenceRefs: jsonb("evidence_refs").default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").default({}).notNull()
});

// 17. quarantine_records
export const quarantineRecords = pgTable("quarantine_records", {
  id: text("id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  severity: text("severity").notNull(),
  reason: text("reason").notNull(),
  manifestPath: text("manifest_path"),
  quarantinedAt: timestamp("quarantined_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").default({}).notNull()
});

// 18. publication_decisions
export const publicationDecisions = pgTable("publication_decisions", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(), // snapshot, release, ranking, claim
  entityId: text("entity_id").notNull(),
  decision: text("decision").notNull(), // published, rejected, quarantined, retracted
  reason: text("reason").notNull(),
  decidedBy: text("decided_by").default("system").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
  validationReport: jsonb("validation_report").default({}).notNull()
});

// 19. source_capability_audits
export const sourceCapabilityAudits = pgTable("source_capability_audits", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
  capability: text("capability").notNull(), // patch_notes, static_stats, comps, leaderboard, matches
  status: text("status").notNull(), // verified, partial, needs_credentials, not_implemented, temporarily_unavailable, unsupported
  method: text("method").notNull(), // http, rendered_page, api, manual_import
  gameProduct: text("game_product"),
  supportedSets: jsonb("supported_sets").default([]).notNull(),
  channels: jsonb("channels").default([]).notNull(),
  availableFields: jsonb("available_fields").default([]).notNull(),
  missingFields: jsonb("missing_fields").default([]).notNull(),
  scopePrecision: text("scope_precision").default("unknown").notNull(),
  artifactIds: jsonb("artifact_ids").default([]).notNull(),
  parserVersion: text("parser_version"),
  limitations: jsonb("limitations").default([]).notNull()
});

// 20. collection run ledger (source/patch/Elite provenance)
export const collectionRunLedger = pgTable("collection_run_ledger", {
  id: text("id").primaryKey(),
  datasetKind: text("dataset_kind").notNull(),
  runKind: text("run_kind").notNull(),
  status: text("status").notNull(),
  subjectCommit: text("subject_commit"),
  fetchMode: text("fetch_mode").default("offline").notNull(),
  requestedSources: jsonb("requested_sources").default([]).notNull(),
  diagnostics: jsonb("diagnostics").default({}).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// Re-export all meta tables
export * from "./schema-meta";

