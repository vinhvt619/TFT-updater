export type PatchChannel = "live" | "pbe";

export interface PatchEpochDefinition {
  id: string;
  label: string;
  patchFamily: string;
  channel: PatchChannel;
  gameVersion: string | null;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  buildId?: string | null;
  precision: "hotfix_verified" | "base_patch_only" | "patch_window" | "approximate";
  evidence: string[];
}

/**
 * Patch epochs are data identifiers, not UI text.  The dates below come from
 * the checked-in Riot patch-note artifacts and the PBE commit recorded in
 * `storage/patch-history-coverage.json`.  A missing date/build remains null;
 * callers must then keep the epoch collecting instead of guessing.
 */
export const SET18_PATCH_EPOCHS: readonly PatchEpochDefinition[] = [
  {
    id: "epoch_18_1",
    label: "18.1",
    patchFamily: "18.1",
    channel: "live",
    gameVersion: "18.1",
    // Riot's article identifies the patch/date but does not provide an exact
    // UTC rollout instant. Keep the boundary unknown instead of inventing an
    // hour that could misclassify a match around the transition.
    effectiveStart: null,
    effectiveEnd: null,
    precision: "base_patch_only",
    evidence: ["art_18_1_html"]
  },
  {
    id: "epoch_18_1_hotfix_2026_08_27",
    label: "18.1 · 27/08",
    patchFamily: "18.1",
    channel: "live",
    gameVersion: "18.1",
    effectiveStart: null,
    effectiveEnd: null,
    precision: "hotfix_verified",
    evidence: ["art_18_1_html"]
  },
  {
    id: "epoch_18_1_hotfix_2026_08_28",
    label: "18.1 · 28/08",
    patchFamily: "18.1",
    channel: "live",
    gameVersion: "18.1",
    effectiveStart: null,
    effectiveEnd: null,
    precision: "hotfix_verified",
    evidence: ["art_18_1_html"]
  },
  {
    id: "epoch_18_1_hotfix_2026_08_31",
    label: "18.1 · 31/08–01/09",
    patchFamily: "18.1",
    channel: "live",
    gameVersion: "18.1",
    effectiveStart: null,
    effectiveEnd: null,
    precision: "hotfix_verified",
    evidence: ["art_18_1_html"]
  },
  {
    id: "epoch_18_2",
    label: "18.2",
    patchFamily: "18.2",
    channel: "live",
    gameVersion: "18.2",
    effectiveStart: null,
    effectiveEnd: null,
    precision: "base_patch_only",
    evidence: ["art_18_2_html"]
  },
  {
    id: "epoch_18_3",
    label: "18.3",
    patchFamily: "18.3",
    channel: "live",
    gameVersion: "18.3",
    effectiveStart: null,
    effectiveEnd: null,
    precision: "base_patch_only",
    evidence: ["art_18_3_html"]
  },
  {
    id: "epoch_18_4",
    label: "18.4",
    patchFamily: "18.4",
    channel: "live",
    gameVersion: "18.4",
    effectiveStart: null,
    effectiveEnd: null,
    precision: "base_patch_only",
    evidence: ["art_18_4_html"]
  },
  {
    id: "epoch_18_5",
    label: "18.5",
    patchFamily: "18.5",
    channel: "live",
    gameVersion: "18.5",
    effectiveStart: null,
    effectiveEnd: null,
    precision: "base_patch_only",
    evidence: ["art_18_5_html"]
  },
  {
    id: "epoch_18_5c",
    label: "18.5c",
    patchFamily: "18.5",
    channel: "live",
    gameVersion: "18.5c",
    effectiveStart: "2026-10-27T12:00:00Z",
    effectiveEnd: "2026-11-06T00:00:00Z",
    precision: "hotfix_verified",
    evidence: ["art_18_5c_html"]
  },
  {
    id: "epoch_18_6",
    label: "18.6",
    patchFamily: "18.6",
    channel: "live",
    gameVersion: "18.6",
    effectiveStart: "2026-11-06T00:00:00Z",
    effectiveEnd: null,
    precision: "base_patch_only",
    evidence: ["art_18_6_html"]
  },
  {
    id: "pbe_18_3_633df11c",
    label: "PBE · 633df11c",
    patchFamily: "18.3",
    channel: "pbe",
    gameVersion: null,
    effectiveStart: null,
    effectiveEnd: null,
    buildId: "633df11c",
    precision: "approximate",
    evidence: ["art_cdragon_pbe_18_3"]
  }
];

export function getPatchEpoch(id: string | null | undefined): PatchEpochDefinition | null {
  if (!id) return null;
  return SET18_PATCH_EPOCHS.find((epoch) => epoch.id === id) || null;
}

export function resolvePatchEpoch(input: {
  patchEpochId?: string | null;
  patchLabel?: string | null;
  gameVersion?: string | null;
  channel?: PatchChannel;
  at?: Date | string | null;
  buildId?: string | null;
}): PatchEpochDefinition | null {
  if (input.patchEpochId) {
    const exact = getPatchEpoch(input.patchEpochId);
    if (exact) return exact;
  }
  if (input.buildId) {
    const byBuild = SET18_PATCH_EPOCHS.find((epoch) => epoch.buildId === input.buildId);
    if (byBuild) return byBuild;
  }
  const label = (input.patchLabel || input.gameVersion || "").toLowerCase().replace(/^version\s*/i, "").trim();
  const channel = input.channel || "live";
  const candidates = SET18_PATCH_EPOCHS.filter((epoch) => epoch.channel === channel);
  const byLabel = candidates.find((epoch) => epoch.label.toLowerCase() === label || epoch.patchFamily === label);
  if (byLabel) return byLabel;
  const at = input.at ? new Date(input.at).getTime() : Number.NaN;
  if (!Number.isNaN(at)) {
    const byWindow = candidates.find((epoch) => {
      // A patch-note date without a rollout instant is not a usable window.
      // Never let a null boundary make the first epoch match every timestamp.
      if (!epoch.effectiveStart && !epoch.effectiveEnd) return false;
      const start = epoch.effectiveStart ? new Date(epoch.effectiveStart).getTime() : Number.NEGATIVE_INFINITY;
      const end = epoch.effectiveEnd ? new Date(epoch.effectiveEnd).getTime() : Number.POSITIVE_INFINITY;
      return at >= start && at < end;
    });
    if (byWindow) return byWindow;
  }
  return null;
}

export function isPatchEpochKnown(id: string | null | undefined): boolean {
  return Boolean(getPatchEpoch(id));
}

export function getCurrentLivePatchEpochId(at = new Date()): string {
  const configured = process.env.TFT_PATCH_EPOCH_ID;
  if (configured && getPatchEpoch(configured)) return configured;
  const resolved = resolvePatchEpoch({ at, channel: "live" });
  if (resolved) return resolved.id;
  const liveEpochs = SET18_PATCH_EPOCHS.filter((e) => e.channel === "live");
  return liveEpochs[liveEpochs.length - 1]?.id || "epoch_18_6";
}
