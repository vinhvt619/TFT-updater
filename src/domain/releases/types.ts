export type ReleaseKind =
  | "launch"
  | "main_patch"
  | "balance_update"
  | "hotfix"
  | "pbe_update"
  | "rollback";

export type ReleaseLifecycle =
  | "announced"
  | "rolling_out"
  | "applied"
  | "postponed"
  | "reverted"
  | "unknown";

export type EffectivePrecision = "exact" | "interval" | "day" | "unknown";
export type TimeBasis = "publisher" | "observed_transition" | "unknown";

export interface ReleaseEvent {
  id: string;
  datasetKind: "real" | "demo";
  gameProduct: "tft";
  setNumber: number;
  channel: "live" | "pbe";
  patchFamilyId: string | null;
  parentEventId: string | null;
  kind: ReleaseKind;
  officialLabel: string | null;
  displayLabel: string;
  aliasEvidenceIds: string[];
  publisherBuildId: string | null;
  lifecycle: ReleaseLifecycle;
  publishedAt: string | null;
  firstObservedAt: string;
  effectiveAt: string | null;
  effectiveAtEarliest: string | null;
  effectiveAtLatest: string | null;
  effectivePrecision: EffectivePrecision;
  timeBasis: TimeBasis;
  effectiveTimeZone: string | null;
  regionScope: string[];
  platformScope: string[];
  evidenceIds: string[];
}

export interface ReleaseRollout {
  id: string;
  releaseEventId: string;
  region: string;
  platform: "pc" | "mobile" | "all";
  rollingOutAt: string | null;
  appliedAt: string | null;
  evidenceId: string;
}

export type EvidenceBoundValue<T> =
  | {
      state: "known";
      value: T;
      evidenceIds: string[];
      basis: "documented" | "observed" | "derived";
      derivationId?: string;
      applicabilityKey: string;
    }
  | {
      state: "missing" | "not_applicable" | "conflict";
      reason: string;
      evidenceIds: string[];
    };

export type ChangeKind =
  | "numeric"
  | "formula"
  | "mechanic"
  | "bugfix"
  | "tooltip_only"
  | "added"
  | "removed"
  | "availability";

export interface GameplayChange {
  id: string;
  releaseEventId: string | null;
  fromSnapshotId: string | null;
  toSnapshotId: string | null;
  entityId: string;
  variantId: string;
  fieldPath: string;
  context: Record<string, string | number>;
  kind: ChangeKind;
  before: EvidenceBoundValue<number | string | number[]>;
  after: EvidenceBoundValue<number | string | number[]>;
  evidenceIds: string[];
  validationStatus: "pending" | "validated" | "conflict";
}

export interface PatchNoteClaim {
  id: string;
  releaseEventId: string;
  sourceDocumentRevisionId: string;
  entityId: string;
  variantId?: string;
  heading: string;
  rawText: string;
  kind: ChangeKind;
  fieldPath?: string;
  beforeRaw?: string;
  afterRaw?: string;
  context?: Record<string, any>;
  isPostponed?: boolean;
  isTooltipOnly?: boolean;
}

export interface SourceDocumentRevision {
  id: string;
  sourceId: string;
  canonicalUrl: string;
  fetchedAt: string;
  rawArtifactId: string;
  rawHash: string;
  semanticContentHash: string;
  locale: "en_us" | "vi_vn";
  title: string;
  publishedAt: string | null;
  authors: string[];
}

export interface EpochResolution {
  epochId: string | null;
  patchFamilyId: string | null;
  precision:
    | "build_verified"
    | "rollout_interval_verified"
    | "patch_only"
    | "ambiguous"
    | "unknown";
  evidenceIds: string[];
  resolverVersion: string;
  reason: string;
}
