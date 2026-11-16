import { accountKeyForPuuid } from "./providers/riot-tft";
import { NormalizedMatch } from "../../domain/meta/schemas";
import { resolveSet18Champion } from "../../domain/meta/set18-registry";
import { normalizeItemKey, resolveItemInfo } from "../../domain/meta/item-registry";
import { toCanonicalChampionId, toCanonicalTraitId } from "../../domain/identity";
import { resolvePatchEpoch } from "../../domain/meta/patch-epochs";

export interface RiotNormalizationOptions {
  region: string;
  patchEpochId?: string;
  accountKeySecret?: string;
  rawArtifactId?: string;
  fetchedAt?: string;
  cohortAccountKeys?: string[];
}

export interface RiotNormalizationResult {
  match: NormalizedMatch;
  quarantineReasons: string[];
  diagnostics: {
    rawParticipantCount: number;
    normalizedParticipantCount: number;
    unknownChampionKeys: string[];
    unknownItemKeys: string[];
    resolvedPatchEpochId: string | null;
  };
}

function asDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function normalizeRiotMatch(detail: any, options: RiotNormalizationOptions): RiotNormalizationResult {
  const info = detail?.info || {};
  const metadata = detail?.metadata || {};
  const rawParticipants = Array.isArray(info.participants) ? info.participants : [];
  const quarantineReasons: string[] = [];
  const unknownChampionKeys: string[] = [];
  const unknownItemKeys: string[] = [];
  const gameDatetime = asDate(info.game_datetime ?? info.gameDatetime);
  const durationSeconds = Number(info.game_length ?? info.gameLength ?? 0);
  const endedAt = gameDatetime || new Date(0);
  const startedAt = new Date(endedAt.getTime() - Math.max(0, durationSeconds) * 1000);
  const rawMatchKey = typeof metadata.match_id === "string" && metadata.match_id.trim()
    ? metadata.match_id.trim()
    : typeof detail?.match_id === "string" ? detail.match_id.trim() : "";
  const matchKey = rawMatchKey || `invalid_${Buffer.from(JSON.stringify(detail || {})).toString("base64url").slice(0, 24)}`;
  const queue = String(info.queue_id ?? info.queueId ?? "");
  const setNumber = Number(info.tft_set_number ?? info.tftSetNumber ?? info.set_number ?? 0);
  const gameVersion = typeof info.game_version === "string" ? info.game_version : typeof info.gameVersion === "string" ? info.gameVersion : "";
  const resolvedEpoch = resolvePatchEpoch({
    patchEpochId: options.patchEpochId,
    gameVersion,
    at: gameDatetime,
    channel: "live"
  });

  if (!matchKey || matchKey.startsWith("invalid_")) quarantineReasons.push("missing_match_id");
  if (!gameDatetime) quarantineReasons.push("missing_game_datetime");
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 7200) quarantineReasons.push("invalid_game_length");
  if (queue !== "1100") quarantineReasons.push(`unsupported_queue:${queue || "missing"}`);
  if (setNumber !== 18) quarantineReasons.push(`unsupported_set:${setNumber || "missing"}`);
  if (!gameVersion) quarantineReasons.push("missing_game_version");
  if (!resolvedEpoch) quarantineReasons.push("unresolved_patch_epoch");
  if (resolvedEpoch?.gameVersion && gameVersion) {
    const normalizedGameVersion = gameVersion.toLowerCase().replace(/^version\s*/i, "").trim();
    if (normalizedGameVersion !== resolvedEpoch.gameVersion.toLowerCase()) {
      quarantineReasons.push(`patch_epoch_version_mismatch:${normalizedGameVersion}:${resolvedEpoch.gameVersion}`);
    }
  }
  if (rawParticipants.length !== 8) quarantineReasons.push(`participant_count:${rawParticipants.length}`);
  if (!options.accountKeySecret || options.accountKeySecret.length < 16) quarantineReasons.push("missing_account_key_secret");

  const seenPlacements = new Set<number>();
  const participants = [] as NormalizedMatch["participants"];
  for (const raw of rawParticipants) {
    const placement = Number(raw?.placement);
    if (!Number.isInteger(placement) || placement < 1 || placement > 8 || seenPlacements.has(placement)) {
      quarantineReasons.push("invalid_or_duplicate_placement");
      continue;
    }
    seenPlacements.add(placement);
    const puuid = typeof raw?.puuid === "string" ? raw.puuid : "";
    if (!puuid || !options.accountKeySecret || options.accountKeySecret.length < 16) {
      quarantineReasons.push("participant_missing_puuid");
      continue;
    }
    let accountKey: string;
    try {
      accountKey = accountKeyForPuuid(puuid, options.accountKeySecret);
    } catch {
      quarantineReasons.push("participant_account_hash_failed");
      continue;
    }

    const units = [] as any[];
    for (const rawUnit of Array.isArray(raw.units) ? raw.units : []) {
      const sourceChampionKey = typeof rawUnit?.character_id === "string"
        ? rawUnit.character_id
        : typeof rawUnit?.characterId === "string" ? rawUnit.characterId : "";
      const championEntry = resolveSet18Champion(sourceChampionKey);
      if (!championEntry) {
        unknownChampionKeys.push(sourceChampionKey || "missing");
        continue;
      }
      const items: string[] = [];
      const rawItemList = Array.isArray(rawUnit?.itemNames)
        ? rawUnit.itemNames
        : Array.isArray(rawUnit?.items)
        ? rawUnit.items
        : [];
      for (const rawItem of rawItemList) {
        const itemKey = typeof rawItem === "string" ? rawItem : String(rawItem?.name || rawItem?.id || "");
        const itemInfo = resolveItemInfo(itemKey);
        if (!itemInfo) {
          unknownItemKeys.push(itemKey || normalizeItemKey(itemKey));
          continue;
        }
        items.push(itemInfo.key);
      }
      const rawTier = Number(rawUnit?.tier);
      units.push({
        championId: championEntry.canonicalId || toCanonicalChampionId(sourceChampionKey, 18),
        tier: Number.isInteger(rawTier) && rawTier >= 1 && rawTier <= 3 ? rawTier : null,
        items
      });
    }

    const traits = (Array.isArray(raw.traits) ? raw.traits : []).map((trait: any) => ({
      traitId: toCanonicalTraitId(String(trait?.name || trait?.trait_id || "")),
      numUnits: Number(trait?.num_units || 0),
      tierCurrent: Number(trait?.tier_current || 0)
    })).filter((trait: any) => trait.traitId);
    const augments = (Array.isArray(raw.augments) ? raw.augments : []).filter((value: unknown): value is string => typeof value === "string");
    participants.push({
      matchKey,
      accountKey,
      riotIdName: typeof raw?.riotIdGameName === "string" ? raw.riotIdGameName : "",
      riotIdTag: typeof raw?.riotIdTagline === "string" ? raw.riotIdTagline : "",
      placement,
      level: Math.max(1, Math.min(11, Number(raw?.level || 1))),
      timeEliminated: Number(raw?.time_eliminated || raw?.timeEliminated || 0),
      totalDamageToPlayers: Number(raw?.total_damage_to_players || raw?.totalDamageToPlayers || 0),
      units,
      traits,
      augments
    });
  }

  if (seenPlacements.size !== rawParticipants.length || seenPlacements.size !== 8) quarantineReasons.push("placements_do_not_cover_1_to_8");
  if (unknownChampionKeys.length > 0) quarantineReasons.push(`unknown_champions:${unknownChampionKeys.length}`);
  if (unknownItemKeys.length > 0) quarantineReasons.push(`unknown_items:${unknownItemKeys.length}`);

  const status = quarantineReasons.length > 0 ? "quarantined" as const : "valid" as const;
  const match: NormalizedMatch = {
    matchKey,
    provider: "riot",
    region: options.region,
    gameMode: "ranked_standard",
    queue: queue || "1100",
    setNumber: setNumber || 18,
    patchEpochId: resolvedEpoch?.id || options.patchEpochId || "unknown",
    gameVersion,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds: Math.max(0, Math.floor(durationSeconds)),
    participants,
    rawArtifactId: options.rawArtifactId || "",
    fetchedAt: options.fetchedAt || null,
    sourceDataAsOf: gameDatetime?.toISOString() || null,
    status,
    quarantineReason: quarantineReasons.length ? quarantineReasons.join(";") : null,
    cohortAccountKeys: options.cohortAccountKeys || []
  };

  return {
    match,
    quarantineReasons: Array.from(new Set(quarantineReasons)),
    diagnostics: {
      rawParticipantCount: rawParticipants.length,
      normalizedParticipantCount: participants.length,
      unknownChampionKeys: Array.from(new Set(unknownChampionKeys)),
      unknownItemKeys: Array.from(new Set(unknownItemKeys)),
      resolvedPatchEpochId: resolvedEpoch?.id || null
    }
  };
}
