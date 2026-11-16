import type { Channel, DatasetKind, ReleaseMeta } from "./types";

export type ReleaseVersionKind = "main_patch" | "hotfix" | "pbe_revision" | "unknown";

export interface ParsedTftVersion {
  channel: Channel;
  major: number | null;
  minor: number | null;
  patch: number | null;
  hotfixSuffix: string | null;
  pbeRevision: string | null;
  baseVersion: string | null;
  versionKey: string;
  displayVersion: string;
  sortKey: string;
  kind: ReleaseVersionKind;
  isInferredAlias: boolean;
}

export interface VersionTimelineNode extends ParsedTftVersion {
  releaseId: string;
  datasetKind: DatasetKind;
  patchLabel: string | null;
  occurrenceKey: string;
  currentSnapshotId: string | null;
  currentSnapshotStatus?: string | null;
  comparisonStatus: "available" | "notes_only" | "quarantined" | "collecting" | "gap";
}

const HOTFIX_SUFFIX_ORDER = "abcdefghijklmnopqrstuvwxyz";

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function suffixRank(suffix: string | null): number {
  if (!suffix) return 0;
  const rank = HOTFIX_SUFFIX_ORDER.indexOf(suffix.toLowerCase());
  return rank >= 0 ? rank + 1 : 99;
}

function pad(value: number, width = 4): string {
  return String(value).padStart(width, "0");
}

function inferHotfixSuffix(label: string, occurrenceKey: string): string | null {
  const text = `${label} ${occurrenceKey}`.toLowerCase();
  // Riot's article contains occurrence keys such as `mid_aug27`.  The
  // previous loose `mid_?a` expression matched the `a` in `aug27`, causing
  // every mid-patch event to collapse to 18.1a.  Require a token boundary and
  // preserve the documented date ordering instead.
  if (
    /18[._-]?1\s*[·:|\-]?\s*(?:cập nhật|update)?\s*(?:27\/08|august\s+27)/i.test(text) ||
    /18[_-]?1[_-]?(?:hotfix|mid)[_-]?a(?:$|[^a-z0-9])/i.test(text)
  ) return "a";
  // The 28/08 entry is a feature/bug-fix notice and Riot did not publish an
  // `18.1b` label.  Keep it as a date-only event so it remains selectable.
  if (/18[._-]?1\s*[·:|\-]?\s*(?:cập nhật|update)?\s*28\/08/i.test(text)) return null;
  if (
    /18[._-]?1\s*[·:|\-]?\s*(?:cập nhật|update)?\s*(?:31\/08|01\/09|august\s+31|september\s+1)/i.test(text) ||
    /18[_-]?1[_-]?(?:hotfix|mid)[_-]?b(?:$|[^a-z0-9])/i.test(text)
  ) return "b";
  if (/18[_-]?1[_-]?(?:hotfix|mid)[_-]?c(?:$|[^a-z0-9])/i.test(text)) return "c";
  return null;
}

function pbeRevisionFrom(label: string, buildId: string | null | undefined, occurrenceKey: string): string | null {
  const text = `${label} ${buildId || ""} ${occurrenceKey}`;
  const shorthand = text.match(/(?:^|[\s_\-])r(?:ev(?:ision)?)?\s*[-_:#]?\s*(\d+[a-z]?)\b/i)?.[1];
  if (shorthand) return shorthand.toLowerCase();
  const explicit = text.match(/(?:revision|rev|build)\s*[-_:#]?\s*([a-z0-9]{2,})/i)?.[1];
  if (explicit) return explicit.toLowerCase();
  const hash = text.match(/(?:pbe|pbe[_-])([a-f0-9]{6,})/i)?.[1];
  if (hash) return hash.toLowerCase();
  const build = (buildId || "").match(/[a-z0-9]{6,}/i)?.[0];
  return build ? build.toLowerCase() : null;
}

/**
 * Parse a TFT release label without inventing a numeric date or patch value.
 * Date-based mid-patch aliases are marked as inferred and retain the original
 * patchLabel in the API so users can audit the mapping.
 */
export function parseTftVersion(
  label: string | null | undefined,
  channel: Channel = "live",
  occurrenceKey = "",
  buildId: string | null | undefined = null
): ParsedTftVersion {
  const raw = `${label || ""} ${occurrenceKey} ${buildId || ""}`.trim();
  // A hotfix suffix is part of the numeric token (`18.1a`). Do not consume
  // the first letter of a following word such as `18.1 Bản Ra Mắt`.
  const patchMatch = raw.match(/(?:^|[^0-9])(\d+)\.(\d+)(?:\.(\d+))?([a-z])?(?=$|[^a-z0-9])/i);
  const major = patchMatch ? Number(patchMatch[1]) : null;
  const minor = patchMatch ? Number(patchMatch[2]) : null;
  const patch = patchMatch?.[3] ? Number(patchMatch[3]) : null;
  let hotfixSuffix = patchMatch?.[4]?.toLowerCase() || null;
  let isInferredAlias = false;
  const normalizedLabel = normalize(label);

  if (channel === "live" && major === 18 && minor === 1 && !hotfixSuffix) {
    const inferred = inferHotfixSuffix(normalizedLabel, occurrenceKey);
    if (inferred) {
      hotfixSuffix = inferred;
      isInferredAlias = true;
    }
  }

  const isPbe = channel === "pbe" || /\bpbe\b/i.test(raw);
  const pbeRevision = isPbe ? pbeRevisionFrom(normalizedLabel, buildId, occurrenceKey) : null;
  const baseVersion = major !== null && minor !== null ? `${major}.${minor}${patch !== null ? `.${patch}` : ""}` : null;
  const displayBase = baseVersion || (isPbe ? "PBE" : "Unknown");
  const displayVersion = `${displayBase}${hotfixSuffix || ""}${isPbe && pbeRevision ? ` · r${pbeRevision}` : ""}`;
  const versionKey = `${isPbe ? "pbe" : "live"}:${baseVersion || "unknown"}:${hotfixSuffix || "base"}:${pbeRevision || ""}`;
  const kind: ReleaseVersionKind = isPbe
    ? "pbe_revision"
    : hotfixSuffix
      ? "hotfix"
      : baseVersion
        ? "main_patch"
        : "unknown";
  // PBE revision numbers are chronology only when numeric.  Hashes remain an
  // identity suffix and are sorted after numbered revisions, never by hash
  // lexicographically as if it were a timestamp.
  const pbeSort = (() => {
    if (!isPbe || !pbeRevision) return "";
    const numeric = pbeRevision.match(/^\d+$/);
    return numeric ? `n:${pad(Number(pbeRevision), 6)}` : `h:${pbeRevision}`;
  })();
  const sortKey = [
    pad(major ?? 9999),
    pad(minor ?? 9999),
    pad(patch ?? 0),
    pad(suffixRank(hotfixSuffix), 2),
    isPbe ? "0" : "1",
    pbeSort
  ].join(":");

  return {
    channel: isPbe ? "pbe" : channel,
    major,
    minor,
    patch,
    hotfixSuffix,
    pbeRevision,
    baseVersion,
    versionKey,
    displayVersion,
    sortKey,
    kind,
    isInferredAlias
  };
}

export function compareTftVersions(a: ParsedTftVersion, b: ParsedTftVersion): number {
  return a.sortKey.localeCompare(b.sortKey);
}

export function sortReleaseMeta<T extends ReleaseMeta>(releases: T[]): T[] {
  return [...releases].sort((a, b) => {
    const av = a.versionSortKey || parseTftVersion(a.patchLabel, a.channel, a.occurrenceKey, a.buildId).sortKey;
    const bv = b.versionSortKey || parseTftVersion(b.patchLabel, b.channel, b.occurrenceKey, b.buildId).sortKey;
    const versionOrder = av.localeCompare(bv);
    if (versionOrder !== 0) return versionOrder;
    const dateOrder = String(a.effectiveAt || a.observedAt).localeCompare(String(b.effectiveAt || b.observedAt));
    if (dateOrder !== 0) return dateOrder;
    return a.id.localeCompare(b.id);
  });
}

export function toVersionTimelineNode(release: ReleaseMeta): VersionTimelineNode {
  const parsed = parseTftVersion(release.patchLabel, release.channel, release.occurrenceKey, release.buildId);
  const status = release.currentSnapshotStatus;
  return {
    ...parsed,
    releaseId: release.id,
    datasetKind: release.datasetKind,
    patchLabel: release.patchLabel,
    occurrenceKey: release.occurrenceKey,
    currentSnapshotId: release.currentSnapshotId,
    currentSnapshotStatus: status,
    comparisonStatus: release.currentSnapshotId && status === "published"
      ? "available"
      : status === "quarantined" || status === "withdrawn"
        ? "quarantined"
        : release.evidenceStatus === "gap"
          ? "gap"
        : release.currentSnapshotId
          ? "collecting"
          : "notes_only"
  };
}

export function getAdjacentReleasePairs<T extends ReleaseMeta>(releases: T[]): Array<{ from: T; to: T; intermediate: T[] }> {
  const sorted = sortReleaseMeta(releases);
  return sorted.slice(1).map((to, index) => ({
    from: sorted[index],
    to,
    intermediate: []
  }));
}
