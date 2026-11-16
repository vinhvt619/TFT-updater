import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  unique,
  primaryKey,
  doublePrecision
} from "drizzle-orm/pg-core";

// 1. meta_archetypes
export const metaArchetypes = pgTable("meta_archetypes", {
  id: text("id").primaryKey(),
  setNumber: integer("set_number").default(18).notNull(),
  gameProduct: text("game_product").default("tft").notNull(),
  mode: text("mode").default("ranked_standard").notNull(),
  nameVi: text("name_vi").notNull(),
  nameEn: text("name_en").notNull(),
  aliases: jsonb("aliases").default([]).notNull(),
  coreCarryChampionId: text("core_carry_champion_id").notNull(),
  coreTankChampionId: text("core_tank_champion_id").notNull(),
  coreChampionIds: jsonb("core_champion_ids").default([]).notNull(),
  flexChampionIds: jsonb("flex_champion_ids").default([]).notNull(),
  keyTraitIds: jsonb("key_trait_ids").default([]).notNull(),
  playstyle: text("playstyle").default("standard").notNull(),
  requiredConditions: jsonb("required_conditions").default([]).notNull(),
  recommendedItems: jsonb("recommended_items").default({}).notNull(),
  defaultVariantId: text("default_variant_id").default("default").notNull(),
  mappingVersion: text("mapping_version").default("1.0.0").notNull(),
  classifierVersion: text("classifier_version").default("1.0.0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 2. meta_variants
export const metaVariants = pgTable("meta_variants", {
  id: text("id").primaryKey(),
  archetypeId: text("archetype_id").references(() => metaArchetypes.id).notNull(),
  nameVi: text("name_vi").notNull(),
  nameEn: text("name_en").notNull(),
  conditionDescription: text("condition_description").default("").notNull(),
  requiredItems: jsonb("required_items").default([]).notNull(),
  requiredAugments: jsonb("required_augments").default([]).notNull(),
  requiredEmblems: jsonb("required_emblems").default([]).notNull(),
  substituteChampionIds: jsonb("substitute_champion_ids").default([]).notNull(),
  recommendedBoard: jsonb("recommended_board").default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 3. meta_source_snapshots
export const metaSourceSnapshots = pgTable("meta_source_snapshots", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  datasetKind: text("dataset_kind").default("demo").notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
  sourceDataAsOf: timestamp("source_data_as_of", { withTimezone: true }),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  scope: jsonb("scope").notNull(),
  parserVersion: text("parser_version").default("1.0.0").notNull(),
  status: text("status").default("staging").notNull(),
  rawArtifactId: text("raw_artifact_id").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 4. meta_source_comp_observations
export const metaSourceCompObservations = pgTable("meta_source_comp_observations", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id").references(() => metaSourceSnapshots.id).notNull(),
  sourceId: text("source_id").notNull(),
  datasetKind: text("dataset_kind").default("demo").notNull(),
  sourceCompId: text("source_comp_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  archetypeId: text("archetype_id").references(() => metaArchetypes.id),
  variantId: text("variant_id"),
  originalName: text("original_name").notNull(),
  originalTier: text("original_tier"),
  classificationKind: text("classification_kind").default("editorial").notNull(),
  carryChampionId: text("carry_champion_id"),
  tankChampionId: text("tank_champion_id"),
  sourceLeadChampionId: text("source_lead_champion_id"),
  inferred: jsonb("inferred"),
  boardSourceEvidenceRefId: text("board_source_evidence_ref_id"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
  sourceDataAsOf: timestamp("source_data_as_of", { withTimezone: true }),
  metrics: jsonb("metrics").default({}).notNull(),
  conditions: jsonb("conditions").default([]).notNull(),
  evidenceRefIds: jsonb("evidence_ref_ids").default([]).notNull(),
  status: text("status").default("valid").notNull(),
  quarantineReason: text("quarantine_reason"),
  supersedesObservationId: text("supersedes_observation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 4b. meta_source_comp_builds
export const metaSourceCompBuilds = pgTable("meta_source_comp_builds", {
  id: text("id").primaryKey(),
  observationId: text("observation_id").references(() => metaSourceCompObservations.id).notNull(),
  boardKind: text("board_kind").default("primary").notNull(), // primary, alternate, early, flex
  boardCompleteness: text("board_completeness").default("exact").notNull(), // exact, conditional, partial
  boardLevel: integer("board_level"),
  boardLevelMin: integer("board_level_min"),
  boardLevelMax: integer("board_level_max"),
  sourceVariantKey: text("source_variant_key"),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  rawArtifactId: text("raw_artifact_id").default("").notNull(),
  rawLocator: text("raw_locator").default("").notNull(),
  units: jsonb("units").default([]).notNull(), // array of { sourceChampionKey, championId, starLevel, position: { row, col }, items: [{ sourceItemKey, itemId, order }] }
  sourceLocator: text("source_locator").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 5. meta_source_mappings
export const metaSourceMappings = pgTable("meta_source_mappings", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  sourceCompId: text("source_comp_id").notNull(),
  archetypeId: text("archetype_id").references(() => metaArchetypes.id).notNull(),
  variantId: text("variant_id"),
  similarityScore: doublePrecision("similarity_score").default(1.0).notNull(),
  reviewStatus: text("review_status").default("approved").notNull(),
  mappingVersion: text("mapping_version").default("1.0.0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 6. meta_patch_epoch_regions
export const metaPatchEpochRegions = pgTable("meta_patch_epoch_regions", {
  id: text("id").primaryKey(),
  patchEpochId: text("patch_epoch_id").notNull(),
  region: text("region").notNull(),
  gameVersion: text("game_version").notNull(),
  effectiveStart: timestamp("effective_start", { withTimezone: true }).notNull(),
  effectiveEnd: timestamp("effective_end", { withTimezone: true }),
  evidenceRefIds: jsonb("evidence_ref_ids").default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 7. meta_cohort_snapshots
export const metaCohortSnapshots = pgTable("meta_cohort_snapshots", {
  id: text("id").primaryKey(),
  region: text("region").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  topN: integer("top_n").default(50).notNull(),
  queue: text("queue").default("1100").notNull(),
  sourceUrl: text("source_url").default("").notNull(),
  rawArtifactId: text("raw_artifact_id").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 8. meta_cohort_members
export const metaCohortMembers = pgTable(
  "meta_cohort_members",
  {
    snapshotId: text("snapshot_id").references(() => metaCohortSnapshots.id).notNull(),
    accountKey: text("account_key").notNull(),
    summonerName: text("summoner_name").notNull(),
    riotIdName: text("riot_id_name").default("").notNull(),
    riotIdTag: text("riot_id_tag").default("").notNull(),
    rank: text("rank").default("CHALLENGER").notNull(),
    leaguePoints: integer("league_points").default(1000).notNull(),
    leaderboardRank: integer("leaderboard_rank").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.accountKey] })
  ]
);

// 9. meta_matches
export const metaMatches = pgTable("meta_matches", {
  matchKey: text("match_key").primaryKey(),
  provider: text("provider").default("riot").notNull(),
  region: text("region").notNull(),
  gameMode: text("game_mode").default("ranked_standard").notNull(),
  queue: text("queue").default("1100").notNull(),
  setNumber: integer("set_number").default(18).notNull(),
  patchEpochId: text("patch_epoch_id").default("epoch_18_2").notNull(),
  gameVersion: text("game_version").default("Version 18.2").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  durationSeconds: integer("duration_seconds").default(1800).notNull(),
  rawArtifactId: text("raw_artifact_id").default("").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  datasetKind: text("dataset_kind").default("demo").notNull(),
  status: text("status").default("valid").notNull(),
  quarantineReason: text("quarantine_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 10. meta_match_participants
export const metaMatchParticipants = pgTable(
  "meta_match_participants",
  {
    matchKey: text("match_key").references(() => metaMatches.matchKey).notNull(),
    accountKey: text("account_key").notNull(),
    riotIdName: text("riot_id_name").default("").notNull(),
    riotIdTag: text("riot_id_tag").default("").notNull(),
    placement: integer("placement").notNull(), // 1..8
    level: integer("level").default(8).notNull(),
    units: jsonb("units").default([]).notNull(),
    traits: jsonb("traits").default([]).notNull(),
    augments: jsonb("augments").default([]).notNull(),
    timeEliminated: doublePrecision("time_eliminated").default(0).notNull(),
    totalDamageToPlayers: integer("total_damage_to_players").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.matchKey, table.accountKey] })
  ]
);

// 11. meta_cohort_match_links
export const metaCohortMatchLinks = pgTable(
  "meta_cohort_match_links",
  {
    cohortSnapshotId: text("cohort_snapshot_id").references(() => metaCohortSnapshots.id).notNull(),
    accountKey: text("account_key").notNull(),
    matchKey: text("match_key").references(() => metaMatches.matchKey).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.cohortSnapshotId, table.accountKey, table.matchKey] })
  ]
);

// 12. meta_classifications
export const metaClassifications = pgTable(
  "meta_classifications",
  {
    id: text("id").primaryKey(),
    matchKey: text("match_key").references(() => metaMatches.matchKey).notNull(),
    accountKey: text("account_key").notNull(),
    classifierVersion: text("classifier_version").default("1.0.0").notNull(),
    mappingVersion: text("mapping_version").default("1.0.0").notNull(),
    status: text("status").notNull(), // matched, ambiguous, unclassified
    archetypeId: text("archetype_id").references(() => metaArchetypes.id),
    variantId: text("variant_id"),
    similarityScore: doublePrecision("similarity_score").default(0).notNull(),
    matchedCoreUnits: jsonb("matched_core_units").default([]).notNull(),
    missingCoreUnits: jsonb("missing_core_units").default([]).notNull(),
    matchedTraits: jsonb("matched_traits").default([]).notNull(),
    reason: text("reason").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    unique("meta_class_match_account_ver").on(table.matchKey, table.accountKey, table.classifierVersion)
  ]
);

// 13. meta_collection_coverage
export const metaCollectionCoverage = pgTable("meta_collection_coverage", {
  id: text("id").primaryKey(),
  cohortSnapshotId: text("cohort_snapshot_id").references(() => metaCohortSnapshots.id).notNull(),
  accountKey: text("account_key").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }),
  windowEnd: timestamp("window_end", { withTimezone: true }),
  requestedMatchIds: jsonb("requested_match_ids").default([]).notNull(),
  totalMatches: integer("total_matches").default(0).notNull(),
  completedMatches: integer("completed_matches").default(0).notNull(),
  failedMatches: integer("failed_matches").default(0).notNull(),
  failureReasons: jsonb("failure_reasons").default([]).notNull(),
  status: text("status").default("completed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 14. meta_ranking_snapshots
export const metaRankingSnapshots = pgTable("meta_ranking_snapshots", {
  id: text("id").primaryKey(),
  datasetKind: text("dataset_kind").default("demo").notNull(),
  boardType: text("board_type").notNull(), // websites, elite
  patchEpochId: text("patch_epoch_id").notNull(),
  requestedRegions: jsonb("requested_regions").default([]).notNull(),
  effectiveRegions: jsonb("effective_regions").default([]).notNull(),
  cohortSnapshotIds: jsonb("cohort_snapshot_ids").default([]).notNull(),
  epochPrecision: text("epoch_precision").default("base_patch_only").notNull(),
  windowHours: integer("window_hours").default(72).notNull(),
  asOf: timestamp("as_of", { withTimezone: true }).defaultNow().notNull(),
  rankingVersion: text("ranking_version").default("meta-rank-v1").notNull(),
  classifierVersion: text("classifier_version").default("1.0.0").notNull(),
  mappingVersion: text("mapping_version").default("1.0.0").notNull(),
  configHash: text("config_hash").notNull(),
  totals: jsonb("totals").default({}).notNull(),
  coverage: jsonb("coverage").default({}).notNull(),
  warnings: jsonb("warnings").default([]).notNull(),
  status: text("status").default("staging").notNull(),
  quarantineReason: text("quarantine_reason"),
  inputObservationIds: jsonb("input_observation_ids").default([]),
  inputMatchKeys: jsonb("input_match_keys").default([]),
  sourceDataAsOf: timestamp("source_data_as_of", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 15. meta_ranking_rows
export const metaRankingRows = pgTable("meta_ranking_rows", {
  id: text("id").primaryKey(),
  rankingSnapshotId: text("ranking_snapshot_id").references(() => metaRankingSnapshots.id).notNull(),
  archetypeId: text("archetype_id").references(() => metaArchetypes.id).notNull(),
  variantId: text("variant_id"),
  score: doublePrecision("score"), // 0..100 nullable
  tier: text("tier"), // S, A, B, C nullable
  candidateTier: text("candidate_tier"),
  status: text("status").default("ranked").notNull(),
  consensusLabel: text("consensus_label"),
  sourceVotes: jsonb("source_votes").default({}).notNull(),
  validSourceCount: integer("valid_source_count").default(0).notNull(),
  totalSourceCount: integer("total_source_count").default(5).notNull(),
  rawMetrics: jsonb("raw_metrics").default({}).notNull(),
  adjustedMetrics: jsonb("adjusted_metrics").default({}).notNull(),
  regionalBreakdown: jsonb("regional_breakdown").default({}).notNull(),
  reasonCodes: jsonb("reason_codes").default([]).notNull(),
  evidenceRefIds: jsonb("evidence_ref_ids").default([]).notNull(),
  requiredConditions: jsonb("required_conditions").default([]).notNull(),
  recommendedBoard: jsonb("recommended_board").default([]).notNull(),
  recommendedItems: jsonb("recommended_items").default({}).notNull(),
  selectedSourceBuildId: text("selected_source_build_id"),
  selectionReason: text("selection_reason"),
  availableSourceBuilds: jsonb("available_source_builds").default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

// 16. meta_ranking_inputs
export const metaRankingInputs = pgTable(
  "meta_ranking_inputs",
  {
    rankingSnapshotId: text("ranking_snapshot_id").references(() => metaRankingSnapshots.id).notNull(),
    inputType: text("input_type").notNull(), // observation, match, cohort
    inputId: text("input_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.rankingSnapshotId, table.inputType, table.inputId] })
  ]
);

// 17. meta_current_ranking_pointers
export const metaCurrentRankingPointers = pgTable("meta_current_ranking_pointers", {
  id: text("id").primaryKey(), // pointer_${boardType}_${patchEpochId}_${datasetKind}
  boardType: text("board_type").notNull(),
  patchEpochId: text("patch_epoch_id").notNull(),
  datasetKind: text("dataset_kind").notNull(),
  rankingSnapshotId: text("ranking_snapshot_id").references(() => metaRankingSnapshots.id).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  inputCount: integer("input_count").notNull(),
  rankedCount: integer("ranked_count").notNull(),
  fingerprint: text("fingerprint").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
