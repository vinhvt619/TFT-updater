import fs from "node:fs";
import path from "node:path";
import { SourceCompObservation, SourceScope } from "../../../domain/meta/schemas";
import { WebsiteProvider, WebsiteProviderOptions } from "./types";
import { withInternalDemoEvidence } from "./demo-evidence";
import { getCurrentLivePatchEpochId } from "../../../domain/meta/patch-epochs";

export class TFTAcademyProvider implements WebsiteProvider {
  sourceId = "tftacademy" as const;
  name = "TFT Academy";
  canonicalUrl = "https://tftacademy.com/tierlist/comps";

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
        id: "obs_tftacademy_" + "comp_akali_ninja_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_akali_ninja",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_akali_ninja",
        rawArtifactId: "art_tftacademy_18_2",
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
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Slow roll cấp 5 bắt Akali 3 sao và Camille 3 sao"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftacademy_" + "comp_hecarim_cavalry_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_hecarim_cavalry",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_hecarim_cavalry",
        rawArtifactId: "art_tftacademy_18_2",
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
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Fast 8 ổn định dàn chắn Sejuani và Ornn kích 6 Thần Rừng"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftacademy_" + "comp_ahri_fast8_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_ahri_fast8",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_ahri_fast8",
        rawArtifactId: "art_tftacademy_18_2",
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
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Fast 8 tối ưu Bùa Xanh cho Ahri, Sett gánh chống chịu"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftacademy_" + "comp_caitlyn_enforcer_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_caitlyn_enforcer",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_caitlyn_enforcer",
        rawArtifactId: "art_tftacademy_18_2",
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
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Tướng 2 vàng được tăng sức mạnh mạnh mẽ ở bản 18.2"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftacademy_" + "comp_draven_reroll_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_draven_reroll",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_draven_reroll",
        rawArtifactId: "art_tftacademy_18_2",
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
        originalTier: "S",
        classificationKind: "editorial",
        metrics: {
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Tỷ lệ vào Top 1 cực cao khi Draven hoàn thành các mốc Tiền Thưởng"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftacademy_" + "comp_rengar_assassin_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_rengar_assassin",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_rengar_assassin",
        rawArtifactId: "art_tftacademy_18_2",
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
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Reroll cấp 7 hoàn thiện Rengar 3 sao và Kha'Zix 3 sao"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftacademy_" + "comp_ashe_sniper_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_ashe_sniper",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_ashe_sniper",
        rawArtifactId: "art_tftacademy_18_2",
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
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Kích mốc Thần Rừng cao cấp kết hợp Đao Phủ"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftacademy_" + "comp_tristana_gunner_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_tristana_gunner",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_tristana_gunner",
        rawArtifactId: "art_tftacademy_18_2",
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
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Kích mốc 4 Liên Kích cho Aphelios gánh sát thương"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftacademy_" + "comp_teemo_yordle_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_teemo_yordle",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_teemo_yordle",
        rawArtifactId: "art_tftacademy_18_2",
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
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Buff tướng 2 vàng ở bản 18.2 giúp Yunara và Alistar bứt phá"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      },
      {
        id: "obs_tftacademy_" + "comp_weave_got_this_" + patchEpochId,
        datasetKind: "demo",
        sourceId: "tftacademy",
        sourceCompId: "tftacademy_" + "comp_weave_got_this",
        sourceUrl: "https://tftacademy.com/tierlist/comps#" + "comp_weave_got_this",
        rawArtifactId: "art_tftacademy_18_2",
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
          averagePlacement: null,
          top4Rate: null,
          winRate: null,
          sampleCount: null,
          sampleCountQuality: "unknown",
          pickRateRaw: null,
          pickRateUnit: "unknown"
        },
        conditions: ["Phù hợp khi khởi đầu có nhiều Nước Mắt và Gậy Quá Khổ"],
        evidenceRefIds: ["ev_tftacademy_18_2"],
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0"
      }
    ];
  }
}

export const tftAcademyProvider = new TFTAcademyProvider();
