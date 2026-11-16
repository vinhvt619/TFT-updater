import fs from "node:fs";
import path from "node:path";
import { SourceCompObservation, SourceScope } from "../../../domain/meta/schemas";
import { WebsiteProvider, WebsiteProviderOptions } from "./types";
import { withInternalDemoEvidence } from "./demo-evidence";
import { getCurrentLivePatchEpochId } from "../../../domain/meta/patch-epochs";

export class DataTFTProvider implements WebsiteProvider {
  sourceId = "datatft" as const;
  name = "DataTFT";
  canonicalUrl = "https://datatft.com/meta";

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
        id: "obs_datatft_" + "comp_akali_ninja_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_akali_ninja",
        sourceUrl: "https://datatft.com/meta#" + "comp_akali_ninja",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 3.76,
          top4Rate: 0.651,
          winRate: 0.2,
          sampleCount: 38000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.94",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_datatft_" + "comp_hecarim_cavalry_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_hecarim_cavalry",
        sourceUrl: "https://datatft.com/meta#" + "comp_hecarim_cavalry",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 3.81,
          top4Rate: 0.636,
          winRate: 0.184,
          sampleCount: 32800,
          sampleCountQuality: "exact",
          pickRateRaw: "0.87",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_datatft_" + "comp_ahri_fast8_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_ahri_fast8",
        sourceUrl: "https://datatft.com/meta#" + "comp_ahri_fast8",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 3.83,
          top4Rate: 0.64,
          winRate: 0.19,
          sampleCount: 41200,
          sampleCountQuality: "exact",
          pickRateRaw: "0.97",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_datatft_" + "comp_caitlyn_enforcer_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_caitlyn_enforcer",
        sourceUrl: "https://datatft.com/meta#" + "comp_caitlyn_enforcer",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 3.84,
          top4Rate: 0.612,
          winRate: 0.165,
          sampleCount: 27100,
          sampleCountQuality: "exact",
          pickRateRaw: "0.77",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_datatft_" + "comp_draven_reroll_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_draven_reroll",
        sourceUrl: "https://datatft.com/meta#" + "comp_draven_reroll",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 4.06,
          top4Rate: 0.588,
          winRate: 0.212,
          sampleCount: 22500,
          sampleCountQuality: "exact",
          pickRateRaw: "0.67",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_datatft_" + "comp_rengar_assassin_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_rengar_assassin",
        sourceUrl: "https://datatft.com/meta#" + "comp_rengar_assassin",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 4.13,
          top4Rate: 0.58,
          winRate: 0.154,
          sampleCount: 28400,
          sampleCountQuality: "exact",
          pickRateRaw: "0.74",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_datatft_" + "comp_ashe_sniper_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_ashe_sniper",
        sourceUrl: "https://datatft.com/meta#" + "comp_ashe_sniper",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 4.16,
          top4Rate: 0.568,
          winRate: 0.146,
          sampleCount: 24000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.71",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_datatft_" + "comp_tristana_gunner_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_tristana_gunner",
        sourceUrl: "https://datatft.com/meta#" + "comp_tristana_gunner",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 4.19,
          top4Rate: 0.564,
          winRate: 0.141,
          sampleCount: 23100,
          sampleCountQuality: "exact",
          pickRateRaw: "0.69",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_datatft_" + "comp_teemo_yordle_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_teemo_yordle",
        sourceUrl: "https://datatft.com/meta#" + "comp_teemo_yordle",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 4.23,
          top4Rate: 0.556,
          winRate: 0.138,
          sampleCount: 21000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.64",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_datatft_" + "comp_weave_got_this_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "datatft",
        sourceCompId: "datatft_" + "comp_weave_got_this",
        sourceUrl: "https://datatft.com/meta#" + "comp_weave_got_this",
        rawArtifactId: "art_datatft_18_2",
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
          averagePlacement: 4.46,
          top4Rate: 0.506,
          winRate: 0.114,
          sampleCount: 17200,
          sampleCountQuality: "exact",
          pickRateRaw: "0.54",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_datatft_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      }
    ];
  }
}

export const dataTftProvider = new DataTFTProvider();
