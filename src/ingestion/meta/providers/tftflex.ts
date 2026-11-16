import fs from "node:fs";
import path from "node:path";
import { SourceCompObservation, SourceScope } from "../../../domain/meta/schemas";
import { WebsiteProvider, WebsiteProviderOptions } from "./types";
import { withInternalDemoEvidence } from "./demo-evidence";
import { getCurrentLivePatchEpochId } from "../../../domain/meta/patch-epochs";

export class TFTFlexProvider implements WebsiteProvider {
  sourceId = "tftflex" as const;
  name = "TFT Flex";
  canonicalUrl = "https://tftflex.gg/meta";

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
        if (Array.isArray(parsed)) {
          return parsed.filter((obs: any) => obs.datasetKind === "real");
        }
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
        id: "obs_tftflex_" + "comp_akali_ninja_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_akali_ninja",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_akali_ninja",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_akali_ninja",
        variantId: "var_solar_adaptor_standard",
        originalName: "Solar Adaptor (Akali & Camille)",
        originalTier: "S",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 3.79,
          top4Rate: 0.645,
          winRate: 0.195,
          sampleCount: 29000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.91",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftflex_" + "comp_hecarim_cavalry_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_hecarim_cavalry",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_hecarim_cavalry",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_hecarim_cavalry",
        variantId: "var_rapidfire_elderwood_standard",
        originalName: "Rapidfire Elderwood (Xayah & Sejuani)",
        originalTier: "S",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 3.84,
          top4Rate: 0.63,
          winRate: 0.18,
          sampleCount: 26000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.85",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftflex_" + "comp_ahri_fast8_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_ahri_fast8",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_ahri_fast8",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_ahri_fast8",
        variantId: "var_blossom_adaptor_standard",
        originalName: "Blossom Adaptor / Wispful Thinking (Ahri & Sett)",
        originalTier: "S",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 3.86,
          top4Rate: 0.635,
          winRate: 0.186,
          sampleCount: 33000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.95",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftflex_" + "comp_caitlyn_enforcer_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_caitlyn_enforcer",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_caitlyn_enforcer",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_caitlyn_enforcer",
        variantId: "var_juggernaut_caitlyn_standard",
        originalName: "Juggernaut Riftbeast (Caitlyn & Scuttlecrab)",
        originalTier: "A",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 3.85,
          top4Rate: 0.61,
          winRate: 0.162,
          sampleCount: 22000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.75",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftflex_" + "comp_draven_reroll_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_draven_reroll",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_draven_reroll",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_draven_reroll",
        variantId: "var_draven_bounty_standard",
        originalName: "Bounty Seeker Draven & Apex Dragon Fast 9",
        originalTier: "A",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 4.1,
          top4Rate: 0.582,
          winRate: 0.208,
          sampleCount: 18000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.65",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftflex_" + "comp_rengar_assassin_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_rengar_assassin",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_rengar_assassin",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_rengar_assassin",
        variantId: "var_unrivaled_standard",
        originalName: "Unrivaled (Rengar & Kha'Zix Reroll)",
        originalTier: "A",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 4.16,
          top4Rate: 0.575,
          winRate: 0.15,
          sampleCount: 23000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.71",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftflex_" + "comp_ashe_sniper_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_ashe_sniper",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_ashe_sniper",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_ashe_sniper",
        variantId: "var_wrath_of_woods_standard",
        originalName: "Wrath of the Woods (Gnar & Aphelios)",
        originalTier: "A",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 4.2,
          top4Rate: 0.562,
          winRate: 0.142,
          sampleCount: 19500,
          sampleCountQuality: "exact",
          pickRateRaw: "0.68",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftflex_" + "comp_tristana_gunner_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_tristana_gunner",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_tristana_gunner",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_tristana_gunner",
        variantId: "var_trigger_happy_standard",
        originalName: "Trigger Happy (Aphelios & Maokai)",
        originalTier: "C",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 4.22,
          top4Rate: 0.559,
          winRate: 0.138,
          sampleCount: 18500,
          sampleCountQuality: "exact",
          pickRateRaw: "0.66",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftflex_" + "comp_teemo_yordle_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_teemo_yordle",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_teemo_yordle",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_teemo_yordle",
        variantId: "var_yunara_invoker_standard",
        originalName: "Yunara & Alistar Invoker Reroll",
        originalTier: "A",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 4.26,
          top4Rate: 0.552,
          winRate: 0.135,
          sampleCount: 17000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.61",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftflex_" + "comp_weave_got_this_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftflex",
        sourceCompId: "tftflex_" + "comp_weave_got_this",
        sourceUrl: "https://tftflex.gg/meta#" + "comp_weave_got_this",
        rawArtifactId: "art_tftflex_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "All",
          regions: ["Global"],
          windowStart: null,
          windowEnd: null
        },
        archetypeId: "comp_weave_got_this",
        variantId: "var_weave_got_this_standard",
        originalName: "Weave Got This (Alune & Ahri Spellweaver)",
        originalTier: "B",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: 4.5,
          top4Rate: 0.501,
          winRate: 0.11,
          sampleCount: 14000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.50",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tftflex_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      }
    ];
  }
}

export const tftFlexProvider = new TFTFlexProvider();
