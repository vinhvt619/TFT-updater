import crypto from "node:crypto";
import { SourceAdapter, SourceProbeResult, SourceFetchResult, SourceNormalizeResult } from "./types";
import { safeFetch } from "../fetch-source";
import { fetchWithReceipt } from "../fetch-receipt";
import { SnapshotPayload, ChampionRecord, EvidenceRecord, NumericParameter, StarLevel, StatUnit, Datum } from "../../domain/types";
import { toCanonicalChampionId, toCanonicalTraitId, SET18_CANONICAL_TRAITS } from "../../domain/identity";
import bilingualChampsData from "../../domain/meta/set18-champions-bilingual.json";

const bilingualChamps = bilingualChampsData as Record<string, { en: string; vi: string }>;

export class CommunityDragonAdapter implements SourceAdapter {
  id = "community_dragon";
  parserVersion = "1.0.0";
  mappingVersion = "1.0.0";

  async probe(sourceConfig: any): Promise<SourceProbeResult> {
    try {
      const res = await fetch(sourceConfig.endpoint, { method: "HEAD", signal: AbortSignal.timeout(15000) });
      const etag = res.headers.get("etag") || undefined;
      const lastModified = res.headers.get("last-modified") || undefined;

      return {
        reachable: res.ok,
        httpStatus: res.status,
        etag,
        lastModified,
        hasTargetSet: false, // HEAD probe không chứng minh có target set, chỉ chứng minh reachable
        diagnostics: {
          status: res.status,
          note: "HEAD probe verified reachability only; payload verification requires GET"
        }
      };
    } catch (err: any) {
      return {
        reachable: false,
        hasTargetSet: false,
        diagnostics: { error: err.message }
      };
    }
  }

  async fetch(sourceConfig: any, headers: Record<string, string> = {}): Promise<SourceFetchResult> {
    const res = await fetchWithReceipt(sourceConfig.endpoint, {
      headers,
      etag: sourceConfig.etag,
      lastModified: sourceConfig.lastModified,
      allowOfflineCache: sourceConfig.allowOfflineCache ?? false,
      cachedArtifactPath: sourceConfig.cachedArtifactPath,
      cachedSha256: sourceConfig.cachedSha256,
      expectedSha256: sourceConfig.expectedSha256,
      cachedMetadata: sourceConfig.cachedMetadata,
      cachedFetchedAt: sourceConfig.cachedFetchedAt,
      expectedSize: sourceConfig.expectedSize,
      datasetKind: sourceConfig.datasetKind,
      version: sourceConfig.version,
      fetchFn: sourceConfig.fetchFn
    });
    return {
      rawBuffer: res.body,
      contentType: (res.receipt.headers["content-type"] as string) || "application/json",
      etag: res.receipt.etag,
      lastModified: res.receipt.lastModified
    };
  }

  async normalize(rawContent: Buffer, sourceConfig: any): Promise<SourceNormalizeResult> {
    let json: any;
    try {
      json = JSON.parse(rawContent.toString("utf8"));
    } catch (err: any) {
      return {
        success: false,
        errorCode: "schema_invalid",
        evidence: [],
        diagnostics: { parseError: err.message }
      };
    }

    const targetSet = sourceConfig.targetSet || 18;
    const setKey = targetSet.toString();

    // Verify Set 18 presence in sets or setData
    if (!json.sets || !json.sets[setKey]) {
      return {
        success: false,
        errorCode: "set_not_found",
        evidence: [],
        diagnostics: {
          availableSets: json.sets ? Object.keys(json.sets) : []
        }
      };
    }

    const rawSet = json.sets[setKey];
    const rawChamps = rawSet.champions || [];

    // Filter out dummy / monster entities
    const shopChamps = rawChamps.filter((c: any) => c.traits && c.traits.length > 0);

    // If shop champions count is 0, it means it is a placeholder or test set
    if (shopChamps.length === 0) {
      return {
        success: false,
        errorCode: "unsupported_source",
        evidence: [],
        diagnostics: {
          message: "Set 18 key found in CDragon, but contains only placeholder/dummy units (0 shop champions with traits).",
          totalUnits: rawChamps.length,
          sampleUnits: rawChamps.slice(0, 5).map((c: any) => c.name || c.apiName)
        }
      };
    }

    const rawHash = crypto.createHash("sha256").update(rawContent).digest("hex");
    const evId = sourceConfig.evidenceId || `ev_cdragon_${sourceConfig.channel}_set${targetSet}_${rawHash.slice(0, 12)}`;
    const evidence: EvidenceRecord[] = [
      {
        id: evId,
        kind: "raw_artifact",
        sourceId: sourceConfig.id,
        title: `CommunityDragon TFT ${sourceConfig.channel.toUpperCase()} Payload`,
        url: sourceConfig.endpoint,
        datasetKind: "real"
      }
    ];

    // Build canonical trait map across all available traits
    const traitMap = new Map<string, string>(Object.entries(SET18_CANONICAL_TRAITS));
    const allTraits = rawSet.traits || (json.setData?.find((s: any) => s.number === targetSet)?.traits) || [];
    for (const t of allTraits) {
      if (t.apiName) {
        const canonicalTrait = t.apiName.toLowerCase().trim();
        if (t.name) {
          traitMap.set(t.name.toLowerCase().trim(), canonicalTrait);
        }
        traitMap.set(t.apiName.toLowerCase().trim(), canonicalTrait);
      }
    }

    const normalizedChampions: ChampionRecord[] = shopChamps.map((raw: any) => {
      const canonicalId = toCanonicalChampionId(raw.apiName || raw.name, targetSet);

      let iconUrl = "";
      const isGoodPath = (p?: string) =>
        Boolean(p && typeof p === "string" && p.toLowerCase() !== "none" && !p.startsWith("{") && !p.toLowerCase().includes("none"));

      const assetVersion = String(sourceConfig.assetVersion || process.env.COMMUNITYDRAGON_VERSION || "18.2").replace(/^v/i, "");
      if (isGoodPath(raw.tileIcon)) {
        iconUrl = `https://raw.communitydragon.org/${assetVersion}/game/${raw.tileIcon.toLowerCase().replace(".tex", ".png")}`;
      } else if (isGoodPath(raw.squareIcon)) {
        iconUrl = `https://raw.communitydragon.org/${assetVersion}/game/${raw.squareIcon.toLowerCase().replace(".tex", ".png")}`;
      } else if (isGoodPath(raw.icon)) {
        iconUrl = `https://raw.communitydragon.org/${assetVersion}/game/${raw.icon.toLowerCase().replace(".tex", ".png")}`;
      }

      const bInfo = bilingualChamps[raw.apiName];
      const nameVi = sourceConfig.locale === "vi_vn" ? raw.name || raw.apiName : bInfo?.vi || raw.name || raw.apiName;
      const nameEn = sourceConfig.locale === "en_us" ? raw.name || raw.apiName : bInfo?.en || raw.name || raw.apiName;
      const rawTraits = raw.traits || [];
      const canonicalTraits = rawTraits
        .map((tr: string) => traitMap.get(tr.toLowerCase().trim()) || toCanonicalTraitId(tr))
        .filter(Boolean)
        .sort();

      const abilityNameVi = sourceConfig.locale === "vi_vn" ? raw.ability?.name || "Kỹ năng" : raw.ability?.name || "Kỹ năng";
      const abilityNameEn = raw.ability?.name || "Ability";
      const abilityDescVi = (raw.ability?.desc || "").replace(/%i:[^%]+%/g, "").trim();
      const abilityDescEn = (raw.ability?.desc || "").replace(/%i:[^%]+%/g, "").trim();

      const stats = raw.stats || {};
      const buildDatum = (val: number | undefined | null) => {
        if (val === undefined || val === null || isNaN(val)) {
          return {
            state: "missing" as const,
            reason: "Trường dữ liệu không có trong payload nguồn",
            sourceRefIds: [evId],
            quality: "extracted" as const,
            origin: "source" as const
          };
        }
        return {
          state: "known" as const,
          value: val,
          sourceRefIds: [evId],
          quality: "extracted" as const,
          origin: "source" as const
        };
      };

      const numStats = [
        {
          key: "health",
          labelVi: "Máu",
          labelEn: "Health",
          unit: "flat" as const,
          byStar: {
            "1": buildDatum(stats.hp)
          },
          contextKey: "base"
        },
        {
          key: "attack_damage",
          labelVi: "Sát thương vật lý (AD)",
          labelEn: "Attack Damage",
          unit: "flat" as const,
          byStar: {
            "1": buildDatum(stats.damage)
          },
          contextKey: "base"
        },
        {
          key: "armor",
          labelVi: "Giáp",
          labelEn: "Armor",
          unit: "flat" as const,
          byStar: {
            "1": buildDatum(stats.armor)
          },
          contextKey: "base"
        },
        {
          key: "magic_resistance",
          labelVi: "Kháng phép",
          labelEn: "Magic Resist",
          unit: "flat" as const,
          byStar: {
            "1": buildDatum(stats.magicResist)
          },
          contextKey: "base"
        },
        {
          key: "attack_speed",
          labelVi: "Tốc độ đánh",
          labelEn: "Attack Speed",
          unit: "attacks_per_second" as const,
          byStar: {
            "1": buildDatum(stats.attackSpeed ? Math.round(stats.attackSpeed * 100) / 100 : undefined)
          },
          contextKey: "base"
        },
        {
          key: "attack_range",
          labelVi: "Tầm đánh",
          labelEn: "Attack Range",
          unit: "hexes" as const,
          byStar: {
            "1": buildDatum(stats.range)
          },
          contextKey: "base"
        },
        {
          key: "mana_start",
          labelVi: "Năng lượng khởi đầu",
          labelEn: "Starting Mana",
          unit: "mana" as const,
          byStar: {
            "1": buildDatum(stats.initialMana)
          },
          contextKey: "base"
        },
        {
          key: "mana_max",
          labelVi: "Năng lượng tối đa",
          labelEn: "Max Mana",
          unit: "mana" as const,
          byStar: {
            "1": buildDatum(stats.mana)
          },
          contextKey: "base"
        },
        {
          key: "crit_chance",
          labelVi: "Tỉ lệ chí mạng",
          labelEn: "Critical Chance",
          unit: "percent" as const,
          byStar: {
            "1": buildDatum(stats.critChance ? Math.round(stats.critChance * 100) : undefined)
          },
          contextKey: "base"
        },
        {
          key: "crit_multiplier",
          labelVi: "Sát thương chí mạng",
          labelEn: "Crit Multiplier",
          unit: "ratio" as const,
          byStar: {
            "1": buildDatum(stats.critMultiplier ? Math.round(stats.critMultiplier * 100) / 100 : undefined)
          },
          contextKey: "base"
        }
      ];

      const parameters: NumericParameter[] = (raw.ability?.variables || []).map((v: any) => {
        const starLevels: StarLevel[] = [1, 2, 3, 4];
        const byStar: Partial<Record<StarLevel, Datum<number>>> = {};
        for (const star of starLevels) {
          const val = v.value && v.value.length > star ? v.value[star] : v.value?.[0];
          if (val !== undefined && val !== null && !isNaN(val)) {
            byStar[star] = {
              state: "known" as const,
              value: Number(val),
              sourceRefIds: [evId],
              quality: "extracted" as const,
              origin: "source" as const
            };
          }
        }
        return {
          key: (v.name || "param").toLowerCase(),
          labelVi: v.name || "Tham số",
          labelEn: v.name || "Parameter",
          unit: "flat" as StatUnit,
          byStar,
          contextKey: "ability"
        };
      });

      const abilities = raw.ability ? [
        {
          abilityKey: `${canonicalId}_spell`,
          name: {
            en: { state: "known" as const, value: abilityNameEn, sourceRefIds: [evId], quality: "extracted" as const, origin: "source" as const },
            vi: { state: "known" as const, value: abilityNameVi, sourceRefIds: [evId], quality: "extracted" as const, origin: "source" as const }
          },
          description: {
            en: { state: "known" as const, value: abilityDescEn, sourceRefIds: [evId], quality: "extracted" as const, origin: "source" as const },
            vi: { state: "known" as const, value: abilityDescVi, sourceRefIds: [evId], quality: "extracted" as const, origin: "source" as const }
          },
          parameters
        }
      ] : [];

      return {
        championId: canonicalId,
        sourceApiNames: [raw.apiName || ""],
        name: {
          en: { state: "known", value: nameEn, sourceRefIds: [evId], quality: "extracted", origin: "source" },
          vi: { state: "known", value: nameVi, sourceRefIds: [evId], quality: "extracted", origin: "source" }
        },
        aliases: [raw.apiName, nameEn, nameVi].filter(Boolean),
        cost: { state: "known", value: raw.cost || 1, sourceRefIds: [evId], quality: "extracted", origin: "source" },
        traitIds: { state: "known", value: canonicalTraits, sourceRefIds: [evId], quality: "extracted", origin: "source" },
        icon: { state: "known", value: iconUrl, sourceRefIds: [evId], quality: "extracted", origin: "source" },
        entityKind: "shop_champion",
        variants: [
          {
            variantKey: "base",
            label: "Cơ bản",
            stats: numStats,
            abilities: abilities
          }
        ]
      };
    });

    const payload: SnapshotPayload = {
      schemaVersion: "1.0.0",
      datasetKind: "real",
      setNumber: targetSet,
      gameMode: sourceConfig.gameMode || "standard",
      channel: sourceConfig.channel,
      rosterCompleteness: normalizedChampions.length >= 50 ? "complete" : "partial",
      fieldCoverage: {},
      champions: normalizedChampions
    };

    return {
      success: true,
      payload,
      evidence,
      diagnostics: {
        shopChampionsCount: normalizedChampions.length
      }
    };
  }
}

export const communityDragonAdapter = new CommunityDragonAdapter();
