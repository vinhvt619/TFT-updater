import { z } from "zod";

// 1. Basic Enums & Types
export const SourceIdSchema = z.enum([
  "metatft",
  "tftacademy",
  "tftflex",
  "datatft",
  "tactics_tools"
]);
export type SourceId = z.infer<typeof SourceIdSchema>;

export const TierSchema = z.enum(["S", "A", "B", "C"]);
export type Tier = z.infer<typeof TierSchema>;

export const RankingStatusSchema = z.enum([
  "ranked",
  "provisional",
  "collecting",
  "unavailable"
]);
export type RankingStatus = z.infer<typeof RankingStatusSchema>;

export const ClassificationKindSchema = z.enum([
  "editorial",
  "statistical",
  "hybrid",
  "unknown"
]);
export type ClassificationKind = z.infer<typeof ClassificationKindSchema>;

export const PlaystyleSchema = z.enum([
  "reroll",
  "fast8",
  "fast9",
  "flex",
  "standard"
]);
export type Playstyle = z.infer<typeof PlaystyleSchema>;

export const DatasetKindSchema = z.enum(["real", "demo"]);
export type DatasetKind = z.infer<typeof DatasetKindSchema>;

// 2. Source Scope & Observation
export const SourceScopeSchema = z.object({
  gameProduct: z.enum(["tft", "jcc", "unknown"]).default("tft"),
  setNumber: z.number().default(18),
  channel: z.enum(["live", "pbe"]).default("live"),
  mode: z.string().default("ranked_standard"),
  patchEpochId: z.string().nullable().default("epoch_18_2"),
  sourcePatchLabel: z.string().nullable().default("18.2"),
  rankScope: z.string().nullable().default("All"),
  regions: z.array(z.string()).nullable().default(["Global"]),
  windowStart: z.string().nullable().default(null),
  windowEnd: z.string().nullable().default(null)
});
export type SourceScope = z.infer<typeof SourceScopeSchema>;

export const SourceMetricsSchema = z.object({
  averagePlacement: z.number().min(1).max(8).nullable().default(null),
  top4Rate: z.number().min(0).max(1).nullable().default(null),
  winRate: z.number().min(0).max(1).nullable().default(null),
  sampleCount: z.number().int().min(0).nullable().default(null),
  sampleCountQuality: z.enum(["exact", "rounded", "unknown"]).default("exact"),
  pickRateRaw: z.string().nullable().default(null),
  pickRateUnit: z.enum(["per_lobby", "participant_fraction", "unknown"]).default("per_lobby")
});
export type SourceMetrics = z.infer<typeof SourceMetricsSchema>;

export const SourceCompObservationSchema = z.object({
  id: z.string(),
  datasetKind: DatasetKindSchema,
  sourceId: SourceIdSchema,
  sourceCompId: z.string(),
  sourceUrl: z.string(),
  rawArtifactId: z.string().default(""),
  observedAt: z.string(),
  fetchedAt: z.string().optional(),
  sourcePublishedAt: z.string().nullable().optional(),
  sourceDataAsOf: z.string().nullable().optional(),
  sourceUpdatedAt: z.string().nullable().default(null),
  scope: SourceScopeSchema,
  archetypeId: z.string().nullable().default(null),
  variantId: z.string().nullable().default(null),
  originalName: z.string(),
  originalTier: z.string().nullable().default(null),
  classificationKind: ClassificationKindSchema.default("editorial"),
  carryChampionId: z.string().nullable().optional(),
  tankChampionId: z.string().nullable().optional(),
  sourceLeadChampionId: z.string().nullable().optional(),
  inferred: z
    .object({
      carryChampionId: z.string().nullable().optional(),
      tankChampionId: z.string().nullable().optional(),
      algorithmVersion: z.string().default("item-role-v1").optional(),
      similarityScore: z.number().optional(),
      reviewStatus: z.enum(["auto_matched", "ambiguous", "unmatched", "approved"]).optional(),
      derivedTier: z.string().nullable().optional(),
      candidateArchetypes: z.array(z.object({
        archetypeId: z.string(),
        score: z.number(),
        margin: z.number().nullable().optional(),
        reasonCodes: z.array(z.string()).default([])
      })).optional(),
      evidence: z.array(z.string()).optional()
    })
    .passthrough()
    .nullable()
    .optional(),
  boardSourceEvidenceRefId: z.string().nullable().optional(),
  metrics: SourceMetricsSchema,
  conditions: z.array(z.string()).default([]),
  evidenceRefIds: z.array(z.string()).default([]),
  parserVersion: z.string().default("1.0.0"),
  mappingVersion: z.string().default("1.0.0"),
  supersedesObservationId: z.string().nullable().optional(),
  status: z.enum(["valid", "stale", "quarantined", "superseded"]).optional().default("valid"),
  quarantineReason: z.string().nullable().optional(),
  builds: z.array(z.lazy(() => SourceCompBuildSchema)).optional()
});
export type SourceCompObservation = Omit<z.infer<typeof SourceCompObservationSchema>, "status"> & {
  status?: "valid" | "stale" | "quarantined" | "superseded";
};

// 2b. Source Comp Build (Lineage & Exact Board from Source)
export const BoardPositionSchema = z.object({
  row: z.number().int().min(0).max(3), // 0: Hàng 1 (Frontline) -> 3: Hàng 4 (Backline)
  col: z.number().int().min(0).max(6)  // 0..6 (7 ô cờ mỗi hàng)
});
export type BoardPosition = z.infer<typeof BoardPositionSchema>;

export const SourceCompBuildUnitItemSchema = z.object({
  sourceItemKey: z.string(),
  itemId: z.string().nullable().default(null),
  order: z.number().int().default(0)
});
export type SourceCompBuildUnitItem = z.infer<typeof SourceCompBuildUnitItemSchema>;

export const SourceCompBuildUnitSchema = z.object({
  sourceChampionKey: z.string(),
  championId: z.string().nullable().default(null),
  starLevel: z.number().int().nullable().default(null),
  position: BoardPositionSchema.nullable().default(null),
  items: z.array(SourceCompBuildUnitItemSchema).default([])
});
export type SourceCompBuildUnit = z.infer<typeof SourceCompBuildUnitSchema>;

export const SourceCompBuildSchema = z.object({
  id: z.string(),
  observationId: z.string(),
  boardKind: z.enum(["primary", "alternate", "early", "flex", "max_cap"]).default("primary"),
  boardCompleteness: z.enum(["exact", "partial", "conditional"]).default("exact"),
  boardLevelMin: z.number().int().nullable().default(null),
  boardLevelMax: z.number().int().nullable().default(null),
  label: z.string().nullable().default(null),
  boardLevel: z.number().int().nullable().default(null),
  units: z.array(SourceCompBuildUnitSchema).default([]),
  sourceVariantKey: z.string().nullable().optional(),
  sourceUpdatedAt: z.string().nullable().optional(),
  rawArtifactId: z.string().optional(),
  rawLocator: z.string().optional(),
  sourceLocator: z.string().default(""),
  createdAt: z.string().optional()
});
export type SourceCompBuild = z.infer<typeof SourceCompBuildSchema>;

// 3. Archetype & Variant

export const BoardUnitSchema = z.object({
  championId: z.string(),
  nameVi: z.string().optional(),
  nameEn: z.string().optional(),
  cost: z.number().int().min(1).max(5).optional(),
  tier: z.number().int().min(1).max(3).nullable().optional(),
  items: z.array(z.string()).default([]),
  position: BoardPositionSchema.nullable().optional(),
  isCarry: z.boolean().optional(),
  isTank: z.boolean().optional(),
  boardProvenance: z.object({
    sourceId: z.string(),
    observationId: z.string(),
    buildId: z.string(),
    sourceUrl: z.string().nullable().default(null),
    sourceLocator: z.string().nullable().default(null),
    rawArtifactId: z.string().nullable().default(null),
    rawLocator: z.string().nullable().default(null),
    boardCompleteness: z.enum(["exact", "partial", "conditional"]).optional(),
    sourceVariantKey: z.string().nullable().optional()
  }).optional()
});
export type BoardUnit = z.infer<typeof BoardUnitSchema>;

export const BoardTraitSchema = z.object({
  traitId: z.string(),
  nameVi: z.string().optional(),
  numUnits: z.number().int().min(1),
  tierCurrent: z.number().int().min(0).default(1)
});
export type BoardTrait = z.infer<typeof BoardTraitSchema>;

export const VariantSchema = z.object({
  id: z.string(),
  archetypeId: z.string(),
  nameVi: z.string(),
  nameEn: z.string(),
  conditionDescription: z.string().default(""),
  requiredItems: z.array(z.string()).default([]),
  requiredAugments: z.array(z.string()).default([]),
  requiredEmblems: z.array(z.string()).default([]),
  substituteChampionIds: z.array(z.string()).default([]),
  recommendedBoard: z.array(BoardUnitSchema).default([]),
  sourceUrl: z.string().nullable().optional(),
  evidenceId: z.string().nullable().optional()
});
export type Variant = z.infer<typeof VariantSchema>;

export const ArchetypeSchema = z.object({
  id: z.string(),
  setNumber: z.number().default(18),
  gameProduct: z.string().default("tft"),
  mode: z.string().default("ranked_standard"),
  nameVi: z.string(),
  nameEn: z.string(),
  aliases: z.array(z.string()).default([]),
  coreCarryChampionId: z.string().nullable().default(null),
  coreTankChampionId: z.string().nullable().default(null),
  coreChampionIds: z.array(z.string()).default([]),
  flexChampionIds: z.array(z.string()).default([]),
  keyTraitIds: z.array(z.string()).default([]),
  playstyle: PlaystyleSchema.default("standard"),
  requiredConditions: z.array(z.string()).default([]),
  recommendedItems: z.record(z.array(z.string())).default({}),
  defaultVariantId: z.string().default("default"),
  variants: z.array(VariantSchema).default([]),
  mappingVersion: z.string().default("1.0.0"),
  classifierVersion: z.string().default("1.0.0")
});
export type Archetype = z.infer<typeof ArchetypeSchema>;

// 4. Match, Participant & Cohort
export const MatchParticipantSchema = z.object({
  matchKey: z.string(),
  accountKey: z.string(),
  riotIdName: z.string().default(""),
  riotIdTag: z.string().default(""),
  placement: z.number().int().min(1).max(8),
  level: z.number().int().min(1).max(11).default(8),
  timeEliminated: z.number().default(0),
  totalDamageToPlayers: z.number().default(0),
  units: z.array(BoardUnitSchema).default([]),
  traits: z.array(BoardTraitSchema).default([]),
  augments: z.array(z.string()).default([])
});
export type MatchParticipant = z.infer<typeof MatchParticipantSchema>;

export const NormalizedMatchSchema = z.object({
  matchKey: z.string(),
  provider: z.string().default("riot"),
  region: z.string(), // KR, VN, NA, EUW
  gameMode: z.string().default("ranked_standard"),
  queue: z.string().default("1100"),
  setNumber: z.number().default(18),
  patchEpochId: z.string().default("epoch_18_2"),
  gameVersion: z.string().default("Version 18.2"),
  startedAt: z.string(),
  endedAt: z.string(),
  durationSeconds: z.number().default(1800),
  participants: z.array(MatchParticipantSchema),
  rawArtifactId: z.string().default(""),
  fetchedAt: z.string().nullable().optional(),
  sourceDataAsOf: z.string().nullable().optional(),
  status: z.enum(["valid", "quarantined", "stale"]).default("valid"),
  quarantineReason: z.string().nullable().optional(),
  cohortAccountKeys: z.array(z.string()).default([])
});
export type NormalizedMatch = z.infer<typeof NormalizedMatchSchema>;

export const CohortMemberSchema = z.object({
  snapshotId: z.string(),
  accountKey: z.string(),
  puuid: z.string().default(""),
  summonerName: z.string(),
  riotIdName: z.string().default(""),
  riotIdTag: z.string().default(""),
  rank: z.string().default("CHALLENGER"),
  leaguePoints: z.number().int().default(1000),
  leaderboardRank: z.number().int()
});
export type CohortMember = z.infer<typeof CohortMemberSchema>;

export const CohortSnapshotSchema = z.object({
  id: z.string(),
  region: z.string(),
  capturedAt: z.string(),
  topN: z.number().int().default(50),
  queue: z.string().default("1100"),
  members: z.array(CohortMemberSchema),
  sourceUrl: z.string().default(""),
  rawArtifactId: z.string().default(""),
  fetchedAt: z.string().nullable().optional()
});
export type CohortSnapshot = z.infer<typeof CohortSnapshotSchema>;

// 5. Classification Result
export const BoardClassificationSchema = z.object({
  matchKey: z.string(),
  accountKey: z.string(),
  status: z.enum(["matched", "ambiguous", "unclassified"]),
  archetypeId: z.string().nullable(),
  variantId: z.string().nullable().default(null),
  similarityScore: z.number().min(0).max(1),
  matchedCoreUnits: z.array(z.string()).default([]),
  missingCoreUnits: z.array(z.string()).default([]),
  matchedTraits: z.array(z.string()).default([]),
  reason: z.string().default(""),
  classifierVersion: z.string().default("1.0.0")
});
export type BoardClassification = z.infer<typeof BoardClassificationSchema>;

// 6. Ranking Scope & Output Rows
export const RankingScopeSchema = z.object({
  datasetKind: DatasetKindSchema.default("demo"),
  boardType: z.enum(["websites", "elite"]),
  gameProduct: z.string().default("tft"),
  setNumber: z.number().default(18),
  channel: z.enum(["live", "pbe"]).default("live"),
  mode: z.string().default("ranked_standard"),
  patchEpochId: z.string().default("epoch_18_2"),
  epochPrecision: z.enum(["hotfix_verified", "base_patch_only", "patch_window", "approximate"]).default("base_patch_only"),
  requestedRegions: z.array(z.string()).default(["KR", "VN", "NA", "EUW"]),
  effectiveRegions: z.array(z.string()).default(["KR", "VN", "NA", "EUW"]),
  cohortSnapshotIds: z.array(z.string()).default([]),
  windowStart: z.string().nullable().default(null),
  windowEnd: z.string().nullable().default(null),
  windowHours: z.number().default(72),
  sourceIds: z.array(SourceIdSchema).default([
    "metatft",
    "tftacademy",
    "tftflex",
    "datatft",
    "tactics_tools"
  ]),
  requestedSources: z.array(SourceIdSchema).optional(),
  effectiveSources: z.array(SourceIdSchema).optional(),
  rankScopesBySource: z.record(SourceIdSchema, z.string()).optional(),
  sourceDataAsOfBySource: z.record(SourceIdSchema, z.string()).optional(),
  sourceUpdatedAt: z.string().nullable().optional(),
  rankFilter: z.string().nullable().default("All"),
  asOf: z.string(),
  rankingVersion: z.string().default("meta-rank-v1"),
  classifierVersion: z.string().default("1.0.0"),
  mappingVersion: z.string().default("1.0.0"),
  configHash: z.string().default("default_v1")
});
export type RankingScope = z.infer<typeof RankingScopeSchema>;

export const RegionalRankMetricsSchema = z.object({
  region: z.string(),
  appearances: z.number().int().default(0),
  uniqueMatches: z.number().int().default(0),
  uniqueAccounts: z.number().int().default(0),
  top4Count: z.number().int().default(0),
  winCount: z.number().int().default(0),
  weightMass: z.number().default(0),
  nEffective: z.number().default(0),
  rawTop4Rate: z.number().nullable().default(null),
  rawWinRate: z.number().nullable().default(null),
  rawAveragePlacement: z.number().nullable().default(null),
  adjustedTop4Rate: z.number().nullable().default(null),
  adjustedWinRate: z.number().nullable().default(null),
  adjustedAveragePlacement: z.number().nullable().default(null),
  regionalScore: z.number().nullable().default(null),
  isPriorOnly: z.boolean().default(false),
  status: RankingStatusSchema.default("collecting")
});
export type RegionalRankMetrics = z.infer<typeof RegionalRankMetricsSchema>;

export const RankingRowSchema = z.object({
  archetypeId: z.string(),
  archetypeNameVi: z.string(),
  archetypeNameEn: z.string(),
  coreCarryChampionId: z.string().nullable().default(null),
  coreTankChampionId: z.string().nullable().default(null),
  coreChampionIds: z.array(z.string()).default([]),
  keyTraits: z.array(z.string()),
  playstyle: PlaystyleSchema,
  variantId: z.string().nullable().default(null),
  score: z.number().nullable(), // 0..100
  tier: TierSchema.nullable(),
  candidateTier: TierSchema.nullable().default(null),
  status: RankingStatusSchema,
  consensusLabel: z.string().optional(), // "Đồng thuận cao", "Các nguồn khác nhau", etc.
  // Section A specific metrics
  sourceVotes: z.record(
    z.object({
      originalTier: z.string().nullable(),
      normalizedVote: z.number().nullable(),
      isStatistical: z.boolean().default(false),
      metrics: SourceMetricsSchema.optional(),
      sourceUpdatedAt: z.string().nullable().optional()
    })
  ).default({}),
  validSourceCount: z.number().int().default(0),
  totalSourceCount: z.number().int().default(5),
  // Section B specific metrics
  rawMetrics: z.object({
    appearances: z.number().int().default(0),
    uniqueMatches: z.number().int().default(0),
    uniqueAccounts: z.number().int().default(0),
    rawTop4Rate: z.number().nullable().default(null),
    rawWinRate: z.number().nullable().default(null),
    rawAveragePlacement: z.number().nullable().default(null),
    cohortPickShare: z.number().nullable().default(null)
  }).default({}),
  adjustedMetrics: z.object({
    adjustedTop4Rate: z.number().nullable().default(null),
    adjustedWinRate: z.number().nullable().default(null),
    adjustedAveragePlacement: z.number().nullable().default(null),
    weightMass: z.number().default(0),
    nEffective: z.number().default(0)
  }).default({}),
  regionalBreakdown: z.record(RegionalRankMetricsSchema).default({}),
  reasonCodes: z.array(z.string()).default([]),
  evidenceRefIds: z.array(z.string()).default([]),
  requiredConditions: z.array(z.string()).default([]),
  recommendedBoard: z.array(BoardUnitSchema).default([]),
  recommendedItems: z.record(z.array(z.string())).default({}),
  selectedSourceBuildId: z.string().nullable().optional(),
  selectionReason: z.string().nullable().optional(),
  availableSourceBuilds: z.array(z.string()).optional()
});
export type RankingRow = z.infer<typeof RankingRowSchema>;

export const RankingSnapshotSchema = z.object({
  id: z.string(),
  datasetKind: z.enum(["real", "demo"]).default("real"),
  publicationStatus: z.enum(["published", "quarantined", "retracted", "provisional", "collecting", "staging"]).default("published"),
  status: z.enum(["ranked", "collecting", "provisional", "empty"]).default("ranked").optional(),
  quarantineReason: z.string().nullable().optional(),
  rankingScope: RankingScopeSchema,
  generatedAt: z.string(),
  rankingGeneratedAt: z.string().optional(),
  sourceDataAsOf: z.string().nullable(),
  fetchedAt: z.string().nullable().optional(),
  sourcePublishedAt: z.string().nullable().optional(),
  inputObservationIds: z.array(z.string()).optional(),
  inputMatchKeys: z.array(z.string()).optional(),
  rows: z.array(RankingRowSchema),
  totals: z.object({
    totalArchetypes: z.number().int().default(0),
    rankedTierS: z.number().int().default(0),
    rankedTierA: z.number().int().default(0),
    rankedTierB: z.number().int().default(0),
    rankedTierC: z.number().int().default(0),
    provisionalCount: z.number().int().default(0),
    collectingCount: z.number().int().default(0)
  }),
  coverage: z.record(z.any()).default({}),
  warnings: z.array(z.string()).default([])
});
export type RankingSnapshot = z.infer<typeof RankingSnapshotSchema>;
