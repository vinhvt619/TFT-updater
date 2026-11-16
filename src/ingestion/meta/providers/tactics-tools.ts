import fs from "node:fs";
import path from "node:path";
import { SourceCompObservation, SourceScope } from "../../../domain/meta/schemas";
import { WebsiteProvider, WebsiteProviderOptions } from "./types";
import { withInternalDemoEvidence } from "./demo-evidence";
import { getCurrentLivePatchEpochId } from "../../../domain/meta/patch-epochs";

export class tacticstoolsProvider implements WebsiteProvider {
  sourceId = "tactics_tools" as const;
  name = "tactics.tools";
  canonicalUrl = "https://tactics.tools/team-comps";

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
        id: "obs_tactics_tools_" + "comp_akali_ninja_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_akali_ninja",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_akali_ninja",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          averagePlacement: 3.78,
          top4Rate: 0.648,
          winRate: 0.198,
          sampleCount: 51200,
          sampleCountQuality: "exact",
          pickRateRaw: "0.92",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tactics_tools_" + "comp_hecarim_cavalry_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_hecarim_cavalry",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_hecarim_cavalry",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          averagePlacement: 3.82,
          top4Rate: 0.635,
          winRate: 0.182,
          sampleCount: 44100,
          sampleCountQuality: "exact",
          pickRateRaw: "0.86",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tactics_tools_" + "comp_ahri_fast8_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_ahri_fast8",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_ahri_fast8",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          averagePlacement: 3.85,
          top4Rate: 0.639,
          winRate: 0.189,
          sampleCount: 55000,
          sampleCountQuality: "exact",
          pickRateRaw: "0.96",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tactics_tools_" + "comp_caitlyn_enforcer_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_caitlyn_enforcer",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_caitlyn_enforcer",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          top4Rate: 0.618,
          winRate: 0.17,
          sampleCount: 34500,
          sampleCountQuality: "exact",
          pickRateRaw: "0.80",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tactics_tools_" + "comp_draven_reroll_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_draven_reroll",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_draven_reroll",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          averagePlacement: 4.08,
          top4Rate: 0.585,
          winRate: 0.21,
          sampleCount: 28900,
          sampleCountQuality: "exact",
          pickRateRaw: "0.66",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tactics_tools_" + "comp_rengar_assassin_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_rengar_assassin",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_rengar_assassin",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          averagePlacement: 4.15,
          top4Rate: 0.578,
          winRate: 0.152,
          sampleCount: 36800,
          sampleCountQuality: "exact",
          pickRateRaw: "0.73",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tactics_tools_" + "comp_ashe_sniper_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_ashe_sniper",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_ashe_sniper",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          averagePlacement: 4.18,
          top4Rate: 0.566,
          winRate: 0.145,
          sampleCount: 30200,
          sampleCountQuality: "exact",
          pickRateRaw: "0.70",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tactics_tools_" + "comp_tristana_gunner_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_tristana_gunner",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_tristana_gunner",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          averagePlacement: 4.2,
          top4Rate: 0.562,
          winRate: 0.14,
          sampleCount: 29400,
          sampleCountQuality: "exact",
          pickRateRaw: "0.68",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tactics_tools_" + "comp_teemo_yordle_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_teemo_yordle",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_teemo_yordle",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          averagePlacement: 4.25,
          top4Rate: 0.554,
          winRate: 0.136,
          sampleCount: 26300,
          sampleCountQuality: "exact",
          pickRateRaw: "0.63",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tactics_tools_" + "comp_weave_got_this_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tactics_tools",
        sourceCompId: "tactics_tools_" + "comp_weave_got_this",
        sourceUrl: "https://tactics.tools/team-comps#" + "comp_weave_got_this",
        rawArtifactId: "art_tactics_tools_18_2",
        observedAt: now,
        sourceUpdatedAt: now,
        scope: {
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          mode: "ranked_standard",
          patchEpochId,
          sourcePatchLabel: "18.2",
          rankScope: "Diamond+",
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
          averagePlacement: 4.48,
          top4Rate: 0.504,
          winRate: 0.112,
          sampleCount: 21500,
          sampleCountQuality: "exact",
          pickRateRaw: "0.52",
          pickRateUnit: "per_lobby"
        },
        conditions: [],
        evidenceRefIds: ["ev_tactics_tools_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      }
    ];
  }
}

export const tacticsToolsProvider = new tacticstoolsProvider();
