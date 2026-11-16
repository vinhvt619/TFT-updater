/**
 * Tactics.tools Dynamic Group Classifier by Champion-Set Signature
 * Completely eliminates dependence on groupIndex array ordering.
 */
import { canonicalChamp } from "./canonical-helper";

export interface ArchetypeSignature {
  archetypeId: string;
  variantId: string;
  name: string;
  keyChampions: string[];
  requiredCore: string[];
}

export const ARCHETYPE_SIGNATURES: ArchetypeSignature[] = [
  {
    archetypeId: "comp_masteryi_duelist",
    variantId: "default",
    name: "Blossom Master Yi & Vi (Dueling Blades)",
    keyChampions: ["tft18_da_18_masteryi_ad", "tft18_da_vi18", "tft18_da_18_yorick", "tft18_da_krug18", "tft18_da_18_rengar"],
    requiredCore: ["tft18_da_18_masteryi_ad", "tft18_da_vi18"]
  },
  {
    archetypeId: "comp_dragon_princess",
    variantId: "var_elder_dragon_fast9",
    name: "Riftbeast Elder Dragon & Sentinel (Dragon Princess)",
    keyChampions: ["tft18_da_18_elderdragon", "tft18_da_sentinel18", "tft18_da_taric18", "tft18_da_amumu18", "tft18_da_18_sivir"],
    requiredCore: ["tft18_da_18_elderdragon"]
  },
  {
    archetypeId: "comp_draven_reroll",
    variantId: "var_draven_apex_dragon",
    name: "Elderwood Ezreal & Draven (Executioners)",
    keyChampions: ["tft18_da_draven18", "tft18_da_18_ezreal", "tft18_da_18_alistar", "tft18_da_18_gnarsmall", "tft18_da_amumu18"],
    requiredCore: ["tft18_da_draven18", "tft18_da_18_ezreal"]
  },
  {
    archetypeId: "comp_akali_ninja",
    variantId: "var_solar_adaptor_standard",
    name: "Solar Akali & Camille (Solar Melee)",
    keyChampions: ["tft18_da_18_akali_ad", "tft18_da_18_camille", "tft18_da_18_leona", "tft18_da_18_ornn", "tft18_da_18_varus", "tft18_da_18_sejuani"],
    requiredCore: ["tft18_da_18_akali_ad", "tft18_da_18_camille"]
  },
  {
    archetypeId: "comp_caitlyn_enforcer",
    variantId: "var_caitlyn_scuttlecrab",
    name: "Juggernaut Caitlyn & Scuttlecrab (Hunters)",
    keyChampions: ["tft18_da_18_caitlyn", "tft18_da_scuttlecrab18", "tft18_da_vi18", "tft18_da_18_rakan", "tft18_da_18_sejuani"],
    requiredCore: ["tft18_da_18_caitlyn"]
  }
];

export interface ClassificationResult {
  matched: boolean;
  archetypeId?: string;
  variantId?: string;
  name?: string;
  confidence: number;
  reason?: string;
  topUnits: string[];
}

export function classifyTacticsGroup(
  group: any,
  options: { minConfidence?: number } = {}
): ClassificationResult {
  const minConfidence = options.minConfidence ?? 0.90;
  if (!group || !group.full || !group.full.units) {
    return {
      matched: false,
      confidence: 0,
      reason: "Dữ liệu group hoặc units rỗng",
      topUnits: []
    };
  }

  const rawUnits: any[] = group.full.units;
  // Sort by play count descending
  const sorted = [...rawUnits].sort((a, b) => (b[2] || 0) - (a[2] || 0));
  const topUnits = sorted.slice(0, 8).map((u) => canonicalChamp(u[0]));

  let bestSig: ArchetypeSignature | null = null;
  let bestConfidence = 0;
  let secondBestConfidence = 0;

  for (const sig of ARCHETYPE_SIGNATURES) {
    const matchCount = sig.keyChampions.filter((c) => topUnits.includes(c)).length;
    const hasCore = sig.requiredCore.every((c) => topUnits.includes(c));
    const confidence = matchCount / sig.keyChampions.length;

    if (hasCore && confidence > bestConfidence) {
      secondBestConfidence = bestConfidence;
      bestConfidence = confidence;
      bestSig = sig;
    } else if (hasCore && confidence > secondBestConfidence) {
      secondBestConfidence = confidence;
    }
  }

  const margin = bestConfidence - secondBestConfidence;
  if (!bestSig || bestConfidence < minConfidence || margin < 0.15) {
    return {
      matched: false,
      confidence: bestConfidence,
      reason: `Độ tin cậy quá thấp hoặc chưa đủ tách biệt (score ${(bestConfidence * 100).toFixed(0)}%, margin ${(margin * 100).toFixed(0)}%)`,
      topUnits
    };
  }

  return {
    matched: true,
    archetypeId: bestSig.archetypeId,
    variantId: bestSig.variantId,
    name: bestSig.name,
    confidence: Math.round(bestConfidence * 100) / 100,
    topUnits
  };
}
