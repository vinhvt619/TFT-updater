import fs from "node:fs";
import path from "node:path";
import { SourceCompObservation, SourceScope } from "../../../domain/meta/schemas";
import { WebsiteProvider, WebsiteProviderOptions } from "./types";
import { withInternalDemoEvidence } from "./demo-evidence";
import { getCurrentLivePatchEpochId } from "../../../domain/meta/patch-epochs";

export class MetaTFTProvider implements WebsiteProvider {
  sourceId = "metatft" as const;
  name = "MetaTFT";
  canonicalUrl = "https://www.metatft.com/comps";

  async fetchObservations(scope?: Partial<SourceScope> & WebsiteProviderOptions): Promise<SourceCompObservation[]> {
    const datasetKind = scope?.datasetKind ?? "real";
    const patchEpochId = scope?.patchEpochId || getCurrentLivePatchEpochId();

    if (datasetKind === "demo") {
      return withInternalDemoEvidence(this.getDemoObservations(patchEpochId), this.sourceId);
    }

    // Real mode: Tuyệt đối không sinh số hardcode/synthetic
    const importFile = path.resolve("./storage/imports", `${this.sourceId}_import.json`);
    if (fs.existsSync(importFile)) {
      try {
        const raw = fs.readFileSync(importFile, "utf8");
        const parsed = JSON.parse(raw);
        const observations = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.observations)
            ? parsed.observations
            : [];
        return observations.filter((obs: any) => obs.datasetKind === "real");
      } catch (err) {
        console.error(`[${this.name}] Lỗi đọc import file thật:`, err);
      }
    }

    return [];
  }

  private getDemoObservations(patchEpochId: string): SourceCompObservation[] {
    const now = new Date().toISOString();

    return [
      {
        id: "obs_metatft_" + "comp_akali_ninja_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_akali_ninja",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_akali_ninja",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_akali_ninja",
        variantId: "var_solar_adaptor_standard",
        originalName: "Solar Adaptor (Akali & Camille)",
        originalTier: "S",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 3.75,
          top4Rate: 0.654,
          winRate: 0.201,
          sampleCount: 42500,
          sampleCountQuality: "exact",
          pickRateRaw: "0.95",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_metatft_" + "comp_hecarim_cavalry_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_hecarim_cavalry",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_hecarim_cavalry",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_hecarim_cavalry",
        variantId: "var_rapidfire_elderwood_standard",
        originalName: "Rapidfire Elderwood (Xayah & Sejuani)",
        originalTier: "S",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 3.8,
          top4Rate: 0.638,
          winRate: 0.185,
          sampleCount: 36400,
          sampleCountQuality: "exact",
          pickRateRaw: "0.88",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_metatft_" + "comp_ahri_fast8_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_ahri_fast8",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_ahri_fast8",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_ahri_fast8",
        variantId: "var_blossom_adaptor_standard",
        originalName: "Blossom Adaptor / Wispful Thinking (Ahri & Sett)",
        originalTier: "S",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 3.82,
          top4Rate: 0.642,
          winRate: 0.192,
          sampleCount: 48000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.98",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_metatft_" + "comp_caitlyn_enforcer_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_caitlyn_enforcer",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_caitlyn_enforcer",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_caitlyn_enforcer",
        variantId: "var_juggernaut_caitlyn_standard",
        originalName: "Juggernaut Riftbeast (Caitlyn & Scuttlecrab)",
        originalTier: "A",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 3.82,
          top4Rate: 0.615,
          winRate: 0.168,
          sampleCount: 29300,
          sampleCountQuality: "exact",
          pickRateRaw: "0.78",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_metatft_" + "comp_draven_reroll_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_draven_reroll",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_draven_reroll",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_draven_reroll",
        variantId: "var_draven_bounty_standard",
        originalName: "Bounty Seeker Draven & Apex Dragon Fast 9",
        originalTier: "A",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 4.05,
          top4Rate: 0.59,
          winRate: 0.215,
          sampleCount: 24800,
          sampleCountQuality: "exact",
          pickRateRaw: "0.68",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_metatft_" + "comp_rengar_assassin_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_rengar_assassin",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_rengar_assassin",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_rengar_assassin",
        variantId: "var_unrivaled_standard",
        originalName: "Unrivaled (Rengar & Kha'Zix Reroll)",
        originalTier: "A",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 4.12,
          top4Rate: 0.582,
          winRate: 0.156,
          sampleCount: 31200,
          sampleCountQuality: "exact",
          pickRateRaw: "0.75",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_metatft_" + "comp_ashe_sniper_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_ashe_sniper",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_ashe_sniper",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_ashe_sniper",
        variantId: "var_wrath_of_woods_standard",
        originalName: "Wrath of the Woods (Gnar & Aphelios)",
        originalTier: "A",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 4.15,
          top4Rate: 0.57,
          winRate: 0.148,
          sampleCount: 26500,
          sampleCountQuality: "exact",
          pickRateRaw: "0.72",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_metatft_" + "comp_tristana_gunner_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_tristana_gunner",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_tristana_gunner",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_tristana_gunner",
        variantId: "var_trigger_happy_standard",
        originalName: "Trigger Happy (Aphelios & Maokai)",
        originalTier: "C",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 4.18,
          top4Rate: 0.565,
          winRate: 0.142,
          sampleCount: 25100,
          sampleCountQuality: "exact",
          pickRateRaw: "0.70",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_metatft_" + "comp_teemo_yordle_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_teemo_yordle",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_teemo_yordle",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_teemo_yordle",
        variantId: "var_yunara_invoker_standard",
        originalName: "Yunara & Alistar Invoker Reroll",
        originalTier: "A",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 4.22,
          top4Rate: 0.558,
          winRate: 0.139,
          sampleCount: 22700,
          sampleCountQuality: "exact",
          pickRateRaw: "0.65",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_metatft_" + "comp_weave_got_this_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "metatft",
        sourceCompId: "metatft_" + "comp_weave_got_this",
        sourceUrl: "https://www.metatft.com/comps#" + "comp_weave_got_this",
        rawArtifactId: "art_metatft_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Master+",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_weave_got_this",
        variantId: "var_weave_got_this_standard",
        originalName: "Weave Got This (Alune & Ahri Spellweaver)",
        originalTier: "B",
        classificationKind: "hybrid",
        metrics: {
          averagePlacement: 4.45,
          top4Rate: 0.508,
          winRate: 0.115,
          sampleCount: 18900,
          sampleCountQuality: "exact",
          pickRateRaw: "0.55",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_metatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      }
    ];
  }
}

export const metaTftProvider = new MetaTFTProvider();
