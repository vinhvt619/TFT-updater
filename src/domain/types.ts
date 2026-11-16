export type Channel = "pbe" | "live";
export type DatasetKind = "real" | "demo";
export type StarLevel = 1 | 2 | 3 | 4;

export type EvidenceQuality = "extracted" | "corroborated" | "conflict";
export type ValueOrigin = "source" | "derived" | "manual";

export type DatumState = "known" | "missing" | "not_applicable";

export type KnownDatum<T> = {
  state: "known";
  value: T;
  sourceRefIds: string[];
  quality: EvidenceQuality;
  origin: ValueOrigin;
  derivationId?: string;
};

export type MissingDatum = {
  state: "missing" | "not_applicable";
  reason: string;
  sourceRefIds: string[];
};

export type Datum<T> = KnownDatum<T> | MissingDatum;

export type StatUnit =
  | "flat"
  | "percent"
  | "seconds"
  | "attacks_per_second"
  | "hexes"
  | "mana"
  | "count"
  | "gold"
  | "ratio";

export interface NumericParameter {
  key: string; // ID ngữ nghĩa ổn định, ví dụ: "damage", "shield_amount", "stun_duration"
  labelVi: string;
  labelEn: string;
  unit: StatUnit;
  byStar: Partial<Record<StarLevel, Datum<number>>>;
  contextKey: string; // ví dụ: "base", "passive", "active", "stage_1"
  formulaText?: Datum<string>;
}

export interface AbilityRecord {
  abilityKey: string;
  name: { en: Datum<string>; vi: Datum<string> };
  description: { en: Datum<string>; vi: Datum<string> };
  icon?: Datum<string>;
  parameters: NumericParameter[];
}

export interface ChampionVariant {
  variantKey: string;
  label: string;
  stats: NumericParameter[];
  abilities: AbilityRecord[];
}

export type EntityKind = "shop_champion" | "summon" | "npc" | "unknown";

export interface ChampionRecord {
  championId: string; // canonical ID: ví dụ "tft18_caitlyn"
  sourceApiNames: string[];
  name: { en: Datum<string>; vi: Datum<string> };
  aliases: string[];
  cost: Datum<number>;
  traitIds: Datum<string[]>;
  icon: Datum<string>;
  entityKind: EntityKind;
  variants: ChampionVariant[];
}

export interface SnapshotPayload {
  schemaVersion: string;
  datasetKind: DatasetKind;
  setNumber: number;
  gameMode: string;
  channel: Channel;
  rosterCompleteness: "complete" | "partial" | "unknown";
  fieldCoverage: Record<string, { known: number; applicable: number }>;
  champions: ChampionRecord[];
}

export type ChangeKind =
  | "numeric"
  | "text"
  | "mechanic"
  | "identity"
  | "added"
  | "removed"
  | "availability";

export type Impact = "buff" | "nerf" | "mixed" | "neutral" | "unknown";

export interface FieldDiff {
  championId: string;
  variantKey: string;
  fieldKey: string;
  fieldLabelVi: string;
  fieldLabelEn: string;
  unit: StatUnit;
  starLevel: StarLevel | null;
  kind: ChangeKind;
  before: Datum<number | string | string[]>;
  after: Datum<number | string | string[]>;
  absoluteDelta: number | null;
  relativeDeltaPercent: number | null;
  percentagePointDelta: number | null;
  impact: Impact;
  impactReason: string;
  requiresReview: boolean;
}

export interface ChampionBaseStat {
  key: string;
  labelVi: string;
  value: string;
}

export interface ChampionAbilityInfo {
  nameVi: string;
  nameEn: string;
  descVi: string;
}

export interface ChampionDiff {
  championId: string;
  nameVi: string;
  nameEn: string;
  cost: number | null;
  traits: string[];
  icon: string | null;
  entityKind: EntityKind;
  status: "modified" | "unchanged" | "added" | "removed" | "availability_changed";
  summaryImpact: Impact;
  fieldDiffs: FieldDiff[];
  baseStats?: ChampionBaseStat[];
  ability?: ChampionAbilityInfo;
}

export interface ComparisonSummary {
  totalChampions: number | null;
  changedChampions: number;
  buffedCount: number;
  nerfedCount: number;
  mixedCount: number;
  neutralCount: number;
  unknownCount: number;
  /** Counts are kept separate so release notes cannot inflate the champion count. */
  rosterTotal?: number | null;
  changedChampionCount?: number;
  changedTraitCount?: number;
  changedItemCount?: number;
  changedAugmentCount?: number;
  gameplayChangeCount?: number;
  hiddenMaintenanceCount?: number;
  hiddenOutOfScopeCount?: number;
  unresolvedClaimCount?: number;
  observedUnchangedChampionCount?: number | null;
  coverage?: "complete" | "partial" | "unavailable";
}

export interface ComparisonResult {
  fromSnapshotId: string;
  toSnapshotId: string;
  diffEngineVersion: string;
  generatedAt: string;
  summary: ComparisonSummary;
  champions: ChampionDiff[];
  fromVersion?: string;
  toVersion?: string;
  fromDisplayLabel?: string;
  toDisplayLabel?: string;
  comparisonMode?: "adjacent" | "range" | "unknown";
  intermediateVersions?: Array<{
    releaseId: string;
    snapshotId: string | null;
    versionKey: string;
    displayVersion: string;
    comparisonStatus: "available" | "notes_only" | "quarantined" | "collecting" | "gap";
  }>;
  evidenceStatus?: "available" | "notes_only" | "partial" | "conflict";
  comparisonBasis?: "snapshot_diff" | "documented_changes" | "mixed" | "gap" | "conflict";
  historyScope?: "primary" | "archive";
  fromRelease?: ReleaseMeta;
  toRelease?: ReleaseMeta;
  changes?: ReleaseChangeRow[];
  /** Documented maintenance rows remain auditable but are hidden from the visual change list. */
  hiddenChanges?: ReleaseChangeRow[];
  summaryByEntityKind?: Record<string, { total: number; known: number; unresolved: number }>;
  coverage?: {
    knownChangesCount: number;
    unresolvedClaimsCount: number;
    snapshotCompleteness: "complete" | "partial" | "unknown";
    status: "sufficient" | "insufficient_evidence" | "empty_with_evidence" | "no_filter_matches";
  };
  adjacentEdges?: Array<{ fromReleaseId: string; toReleaseId: string; comparisonBasis: ComparisonResult["comparisonBasis"]; changesCount: number }>;
  missingEvidence?: string[];
  conflicts?: string[];
}

export interface ReleaseChangeRow {
  id: string;
  releaseId: string;
  sourceEventId: string;
  entityKind: "champion" | "trait" | "item" | "augment" | "system" | "bugfix" | "unknown";
  entityId: string | null;
  rawEntityName: string | null;
  fieldKey: string | null;
  formId: string | null;
  starLevel: number | null;
  unit: string | null;
  changeType: string;
  before: { state: "known" | "missing" | "ambiguous" | "conflict"; value?: unknown; raw?: string };
  after: { state: "known" | "missing" | "ambiguous" | "conflict"; value?: unknown; raw?: string };
  rawText: string;
  basis: "documented" | "observed_snapshot";
  sourceUrl: string | null;
  rawArtifactId: string | null;
  rawHash: string | null;
  sourceLocator: string | null;
  parserVersion: string | null;
  applicability: Record<string, unknown>;
  effectivePrecision: string | null;
  verificationStatus: string;
  evidenceIds: string[];
}

export interface ReleaseMeta {
  id: string;
  datasetKind: DatasetKind;
  setNumber: number;
  gameMode: string;
  channel: Channel;
  patchLabel: string | null;
  buildId: string | null;
  occurrenceKey: string;
  effectiveAt: string | null;
  observedAt: string;
  currentSnapshotId: string | null;
  currentSnapshotStatus?: "staging" | "quarantined" | "published" | "withdrawn" | null;
  evidenceStatus?: "available" | "notes_only" | "partial" | "conflict" | "gap" | "unknown";
  versionKey?: string;
  displayVersion?: string;
  versionSortKey?: string;
  releaseKind?: "main_patch" | "hotfix" | "pbe_revision" | "unknown";
  hotfixSuffix?: string | null;
  pbeRevision?: string | null;
  isInferredAlias?: boolean;
  comparisonStatus?: "available" | "notes_only" | "quarantined" | "collecting" | "gap";
  isLaunchRelease?: boolean;
  isInitialPbe?: boolean;
  isHotfix?: boolean;
  patchFamily?: string | null;
  eventKey?: string | null;
  officialLabel?: string | null;
  displayLabel?: string | null;
  displayAlias?: string | null;
  aliasKind?: "official" | "unofficial_display_alias" | null;
  seasonPhase?: "prelaunch_pbe" | "live" | "postlaunch_pbe" | "unknown" | string;
  historyVisibility?: "primary" | "archive";
  visibilityReason?: string | null;
  effectivePrecision?: string | null;
  timeBasis?: string | null;
  fetchedAt?: string | null;
  orderingKey?: string | null;
  provenance?: Record<string, unknown>;
  capabilities?: { canCompareSnapshot?: boolean; canCompareNotes?: boolean; missingEvidence?: string[] };
  notesEventIds?: string[];
  claimIds?: string[];
}

export interface SnapshotMeta {
  id: string;
  releaseId: string;
  revision: number;
  status: "staging" | "quarantined" | "published" | "withdrawn";
  datasetKind: DatasetKind;
  channel: Channel;
  setNumber: number;
  patchLabel: string | null;
  rosterCompleteness: "complete" | "partial" | "unknown";
  createdAt: string;
}

export interface EvidenceRecord {
  id: string;
  kind: "raw_artifact" | "patch_notes" | "manual_entry" | "demo_fixture";
  sourceId: string;
  title: string;
  url?: string | null;
  locator?: string | null;
  snippet?: string | null;
  sourcePublishedAt?: string | null;
  datasetKind: DatasetKind;
}

export interface ImportEnvelope {
  importSchemaVersion: "1";
  idempotencyKey: string;
  release: {
    channel: Channel;
    patchLabel: string | null;
    buildId: string | null;
    effectiveAt: string | null;
    timePrecision: "second" | "day" | "unknown";
    timeBasis: "verified_release" | "source_publication" | "observation";
    occurrenceKey: string;
  };
  payload: SnapshotPayload;
  evidence: EvidenceRecord[];
  notes: string[];
}
