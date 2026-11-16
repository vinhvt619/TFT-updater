import bilingualData from "./set18-champions-bilingual.json";
import generatedRegistry from "./generated-set18-registry.json";

function normalizeRegistrySearchString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

/**
 * Set 18 identity registry.
 *
 * The source keys in this file are the keys emitted by the CommunityDragon
 * payload (for example `DA_18_Ahri` and `DA_18_Akali_AD`).  We deliberately
 * keep the source key alongside the application id.  This makes aliases
 * reversible and prevents a parser from silently inventing a second champion
 * when a source changes casing or adds the TFT prefix.
 */
export interface Set18ChampionRegistryEntry {
  canonicalId: string;
  sourceApiName: string;
  nameEn: string;
  nameVi: string;
  cost: number | null;
  traits: string[];
  iconSourcePath: string | null;
  sourceEndpoint: string;
  sourceRawSha256: string;
  sourceCapturedAt: string;
  aliases: string[];
  entityKind: "shop_champion" | "trait_entity";
  source: "communitydragon-set18-registry";
}

const sourceEntries = bilingualData as Record<string, { en: string; vi: string }>;
const generated = generatedRegistry as {
  source?: { endpoint?: string; rawSha256?: string; capturedAt?: string };
  entries?: Array<{
    sourceApiName: string;
    nameEn?: string;
    cost?: number | null;
    traits?: string[];
    iconSourcePath?: string | null;
    canonicalId?: string | null;
    entityKind?: "shop_champion" | "trait_entity" | "unknown";
  }>;
};
const generatedBySourceKey = new Map((generated.entries || []).map((entry) => [entry.sourceApiName, entry]));

// Entity kind comes from the captured CDragon payload.  The first Set 18 raw
// snapshot marks all 74 DA entries as shop champions, including Riftbeast
// units whose names can look like neutral monsters.  Keep this set empty so a
// naming guess can never demote a real shop champion from the registry.
const NON_SHOP_SOURCE_KEYS = new Set<string>();

function canonicalToken(sourceApiName: string): string {
  return sourceApiName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^da_/, "")
    .replace(/^18_/, "")
    .replace(/18(?=_)/g, "")
    .replace(/18$/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function compatibilityId(sourceApiName: string): string {
  return `tft18_${canonicalToken(sourceApiName)}`;
}

function legacyCompatibilityId(sourceApiName: string): string {
  return `tft18_${sourceApiName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
}

function buildRegistry(): Set18ChampionRegistryEntry[] {
  return Object.entries(sourceEntries).map(([sourceApiName, names]) => {
    const metadata = generatedBySourceKey.get(sourceApiName);
    const nameAliases = [sourceApiName, names.en, names.vi]
      .filter(Boolean)
      .flatMap((value) => [value, value.replace(/[()]/g, " ")]);
    return {
      canonicalId: metadata?.canonicalId || compatibilityId(sourceApiName),
      sourceApiName,
      nameEn: metadata?.nameEn || names.en,
      nameVi: names.vi,
      cost: typeof metadata?.cost === "number" ? metadata.cost : null,
      traits: Array.isArray(metadata?.traits) ? metadata.traits : [],
      iconSourcePath: metadata?.iconSourcePath || null,
      sourceEndpoint: generated.source?.endpoint || "https://raw.communitydragon.org/pbe/cdragon/tft/en_us.json",
      sourceRawSha256: generated.source?.rawSha256 || "",
      sourceCapturedAt: generated.source?.capturedAt || "",
      aliases: Array.from(new Set([
        ...nameAliases,
        compatibilityId(sourceApiName),
        legacyCompatibilityId(sourceApiName)
      ])),
      entityKind: metadata?.entityKind === "trait_entity" || NON_SHOP_SOURCE_KEYS.has(sourceApiName) ? "trait_entity" : "shop_champion",
      source: "communitydragon-set18-registry"
    };
  });
}

export const SET18_CHAMPION_REGISTRY: readonly Set18ChampionRegistryEntry[] = buildRegistry();

const aliasMap = new Map<string, Set18ChampionRegistryEntry>();
const ambiguousAliases = new Set<string>();
function addAlias(key: string, entry: Set18ChampionRegistryEntry): void {
  if (!key || ambiguousAliases.has(key)) return;
  const previous = aliasMap.get(key);
  if (previous && previous.canonicalId !== entry.canonicalId) {
    aliasMap.delete(key);
    ambiguousAliases.add(key);
    return;
  }
  aliasMap.set(key, entry);
}
for (const entry of SET18_CHAMPION_REGISTRY) {
  const values = [entry.canonicalId, entry.sourceApiName, ...entry.aliases];
  for (const value of values) {
    addAlias(normalizeRegistrySearchString(value).replace(/[^a-z0-9_]/g, ""), entry);
    addAlias(value.toLowerCase().trim(), entry);
  }
}

// Compatibility aliases used by older scraped boards. They are explicit
// one-to-one aliases; unknown strings still remain unresolved.
for (const [legacy, sourceApiName] of Object.entries({
  TFT_Ashe: "DA_18_Ashe",
  TFT_Braum: "DA_18_Braum"
})) {
  const entry = SET18_CHAMPION_REGISTRY.find((candidate) => candidate.sourceApiName === sourceApiName);
  if (entry) addAlias(normalizeRegistrySearchString(legacy).replace(/[^a-z0-9_]/g, ""), entry);
}

export function resolveSet18Champion(raw: string | null | undefined): Set18ChampionRegistryEntry | null {
  if (!raw) return null;
  const direct = raw.trim().toLowerCase();
  const normalized = normalizeRegistrySearchString(raw).replace(/[^a-z0-9_]/g, "");
  return (ambiguousAliases.has(direct) || ambiguousAliases.has(normalized))
    ? null
    : aliasMap.get(direct) || aliasMap.get(normalized) || null;
}

/** Resolve an arbitrary source key/name while preserving legacy ids in URLs. */
export function canonicalSet18ChampionId(raw: string | null | undefined): string | null {
  return resolveSet18Champion(raw)?.canonicalId || null;
}

export function getSet18ChampionRegistryReport(): {
  source: string;
  totalEntries: number;
  shopChampionCount: number;
  traitEntityCount: number;
  aliases: number;
} {
  return {
    source: "CommunityDragon bilingual extract (raw source keys retained)",
    totalEntries: SET18_CHAMPION_REGISTRY.length,
    shopChampionCount: SET18_CHAMPION_REGISTRY.filter((e) => e.entityKind === "shop_champion").length,
    traitEntityCount: SET18_CHAMPION_REGISTRY.filter((e) => e.entityKind === "trait_entity").length,
    aliases: SET18_CHAMPION_REGISTRY.reduce((n, e) => n + e.aliases.length, 0)
  };
}
