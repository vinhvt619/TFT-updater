"use client";

import React, { useState } from "react";
import { Swords, Shield } from "lucide-react";
import { resolveSet18Champion } from "@/domain/meta/set18-registry";
import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "@/domain/meta/asset-manifest";

/**
 * Bảng ánh xạ ảnh chân dung chính thức của toàn bộ tướng TFT Mùa 18 từ CommunityDragon & Data Dragon
 */
export const TFT_CHAMPION_IMAGE_URLS: Record<string, string> = {
  "DA_Gromp18_AP": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_gromp/tft18_gromp_square.png",
  "da_gromp18_ap": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_gromp/tft18_gromp_square.png",
  "DA_Murkwolf18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_murkwolf/tft18_murkwolf_square.png",
  "da_murkwolf18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_murkwolf/tft18_murkwolf_square.png",
  "DA_18_Sentry": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sentry/tft18_sentry_square.png",
  "da_18_sentry": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sentry/tft18_sentry_square.png",
  "DA_Cinderling18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_cinderling/tft18_cinderling_square.png",
  "da_cinderling18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_cinderling/tft18_cinderling_square.png",
  "DA_Scuttlecrab18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_scuttlecrab/tft18_scuttlecrab_square.png",
  "da_scuttlecrab18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_scuttlecrab/tft18_scuttlecrab_square.png",
  "DA_Krug18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_krug/tft18_krug_square.png",
  "da_krug18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_krug/tft18_krug_square.png",
  "DA_Sentinel18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sentinel/tft18_sentinel_square.png",
  "da_sentinel18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sentinel/tft18_sentinel_square.png",
  "DA_Brambleback18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_brambleback/tft18_brambleback_square.png",
  "da_brambleback18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_brambleback/tft18_brambleback_square.png",
  "DA_18_Xayah": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_xayah/tft18_xayah_square.png",
  "da_18_xayah": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_xayah/tft18_xayah_square.png",
  "DA_18_Ornn": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ornn/tft18_ornn_square.png",
  "da_18_ornn": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ornn/tft18_ornn_square.png",
  "DA_Nidalee18_AP": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_nidalee/tft18_nidalee_square.png",
  "da_nidalee18_ap": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_nidalee/tft18_nidalee_square.png",
  "DA_18_Hecarim": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_hecarim/tft18_hecarim_square.png",
  "da_18_hecarim": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_hecarim/tft18_hecarim_square.png",
  "DA_18_Ezreal": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ezreal/tft18_ezreal_square.png",
  "da_18_ezreal": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ezreal/tft18_ezreal_square.png",
  "DA_18_Azir": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_azir/tft18_azir_square.png",
  "da_18_azir": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_azir/tft18_azir_square.png",
  "DA_18_RekSai": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_reksai/tft18_reksai_square.png",
  "da_18_reksai": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_reksai/tft18_reksai_square.png",
  "DA_18_Veigar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_veigar/tft18_veigar_square.png",
  "da_18_veigar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_veigar/tft18_veigar_square.png",
  "DA_18_Maokai": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_maokai/tft18_maokai_square.png",
  "da_18_maokai": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_maokai/tft18_maokai_square.png",
  "DA_18_Malphite": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_malphite/tft18_malphite_square.png",
  "da_18_malphite": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_malphite/tft18_malphite_square.png",
  "DA_18_Yorick": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_yorick/tft18_yorick_square.png",
  "da_18_yorick": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_yorick/tft18_yorick_square.png",
  "DA_18_Yunara": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_yunara/tft18_yunara_square.png",
  "da_18_yunara": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_yunara/tft18_yunara_square.png",
  "DA_18_Sett": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sett/tft18_sett_square.png",
  "da_18_sett": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sett/tft18_sett_square.png",
  "DA_18_Ahri": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ahri/tft18_ahri_square.png",
  "da_18_ahri": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ahri/tft18_ahri_square.png",
  "DA_18_Ashe": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ashe/tft18_ashe_square.png",
  "da_18_ashe": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ashe/tft18_ashe_square.png",
  "DA_18_Elise": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_elise/tft18_elise_square.png",
  "da_18_elise": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_elise/tft18_elise_square.png",
  "DA_18_Caitlyn": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_caitlyn/tft18_caitlyn_square.png",
  "da_18_caitlyn": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_caitlyn/tft18_caitlyn_square.png",
  "DA_18_Cassiopeia": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_cassiopeia/tft18_cassiopeia_square.png",
  "da_18_cassiopeia": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_cassiopeia/tft18_cassiopeia_square.png",
  "DA_18_Morgana": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_morgana/tft18_morgana_square.png",
  "da_18_morgana": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_morgana/tft18_morgana_square.png",
  "DA_18_Rakan": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_rakan/tft18_rakan_square.png",
  "da_18_rakan": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_rakan/tft18_rakan_square.png",
  "DA_18_Lillia": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lillia/tft18_lillia_square.png",
  "da_18_lillia": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lillia/tft18_lillia_square.png",
  "DA_18_Kobuko": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kobuko/tft18_kobuko_square.png",
  "da_18_kobuko": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kobuko/tft18_kobuko_square.png",
  "DA_18_Teemo": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_teemo/tft18_teemo_square.png",
  "da_18_teemo": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_teemo/tft18_teemo_square.png",
  "DA_18_Rammus": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_rammus/tft18_rammus_square.png",
  "da_18_rammus": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_rammus/tft18_rammus_square.png",
  "DA_18_GnarSmall": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_gnar/tft18_gnar_square.png",
  "da_18_gnarsmall": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_gnar/tft18_gnar_square.png",
  "DA_18_Tristana": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_tristana/tft18_tristana_square.png",
  "da_18_tristana": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_tristana/tft18_tristana_square.png",
  "DA_18_Sivir": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sivir/tft18_sivir_square.png",
  "da_18_sivir": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sivir/tft18_sivir_square.png",
  "DA_Vi18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_vi/tft18_vi_square.png",
  "da_vi18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_vi/tft18_vi_square.png",
  "DA_18_Akali_AD": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_akali/tft18_akali_square.png",
  "da_18_akali_ad": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_akali/tft18_akali_square.png",
  "DA_18_Varus": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_varus/tft18_varus_square.png",
  "da_18_varus": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_varus/tft18_varus_square.png",
  "DA_Amumu18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_amumu/tft18_amumu_square.png",
  "da_amumu18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_amumu/tft18_amumu_square.png",
  "DA_18_Kennen": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kennen/tft18_kennen_square.png",
  "da_18_kennen": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kennen/tft18_kennen_square.png",
  "DA_18_Aphelios": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_aphelios/tft18_aphelios_square.png",
  "da_18_aphelios": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_aphelios/tft18_aphelios_square.png",
  "DA_18_Diana": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_diana/tft18_diana_square.png",
  "da_18_diana": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_diana/tft18_diana_square.png",
  "DA_18_Alune": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_alune/hud/tft18_alune_square.png",
  "da_18_alune": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_alune/hud/tft18_alune_square.png",
  "DA_18_Leona": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_leona/tft18_leona_square.png",
  "da_18_leona": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_leona/tft18_leona_square.png",
  "DA_18_Kayle": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kayle/tft18_kayle_square.png",
  "da_18_kayle": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kayle/tft18_kayle_square.png",
  "DA_18_Sejuani": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sejuani/tft18_sejuani_square.png",
  "da_18_sejuani": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sejuani/tft18_sejuani_square.png",
  "DA_18_KhaZix": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_khazix/tft18_khazix_square.png",
  "da_18_khazix": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_khazix/tft18_khazix_square.png",
  "DA_18_Rengar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_rengar/tft18_rengar_square.png",
  "da_18_rengar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_rengar/tft18_rengar_square.png",
  "DA_KogMaw18_AD": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kogmaw/tft18_kogmaw_square.png",
  "da_kogmaw18_ad": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kogmaw/tft18_kogmaw_square.png",
  "DA_18_Zyra": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_zyra/tft18_zyra_square.png",
  "da_18_zyra": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_zyra/tft18_zyra_square.png",
  "DA_Fiddlesticks18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_fiddlesticks/tft18_fiddlesticks_square.png",
  "da_fiddlesticks18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_fiddlesticks/tft18_fiddlesticks_square.png",
  "DA_18_Soraka": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_soraka/tft18_soraka_square.png",
  "da_18_soraka": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_soraka/tft18_soraka_square.png",
  "DA_Taric18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_taric/tft18_taric_square.png",
  "da_taric18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_taric/tft18_taric_square.png",
  "DA_18_Ivern": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ivern/hud/tft18_ivern_square.png",
  "da_18_ivern": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ivern/hud/tft18_ivern_square.png",
  "DA_Lux18_Base": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_square.png",
  "da_lux18_base": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_square.png",
  "DA_18_Alistar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_alistar/tft18_alistar_square.png",
  "da_18_alistar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_alistar/tft18_alistar_square.png",
  "DA_Draven18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_draven/tft18_draven_square.png",
  "da_draven18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_draven/tft18_draven_square.png",
  "DA_18_ElderDragon": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_elderdragon/hud/tft18_elderdragon_square.png",
  "da_18_elderdragon": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_elderdragon/hud/tft18_elderdragon_square.png",
  "DA_Karma18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_karma/tft18_karma_square.png",
  "da_karma18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_karma/tft18_karma_square.png",
  "DA_18_LeBlanc": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_leblanc/tft18_leblanc_square.png",
  "da_18_leblanc": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_leblanc/tft18_leblanc_square.png",
  "DA_18_MasterYi_AD": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_masteryi/tft18_masteryi_square.png",
  "da_18_masteryi_ad": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_masteryi/tft18_masteryi_square.png",
  "DA_18_Shen": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_shen/tft18_shen_square.png",
  "da_18_shen": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_shen/tft18_shen_square.png",
  "DA_18_Warwick": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_warwick/tft18_warwick_square.png",
  "da_18_warwick": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_warwick/tft18_warwick_square.png",
  "DA_18_Camille": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_camille/tft18_camille_square.png",
  "da_18_camille": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_camille/tft18_camille_square.png",
  "DA_Lux18_Blackthorn": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_blackthorn_square.png",
  "da_lux18_blackthorn": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_blackthorn_square.png",
  "DA_Lux18_Blossom": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_blossom_square.png",
  "da_lux18_blossom": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_blossom_square.png",
  "DA_18_Lux_Coven": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_coven_square.png",
  "da_18_lux_coven": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_coven_square.png",
  "DA_18_Lux_Elderwood": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_elderwood_square.png",
  "da_18_lux_elderwood": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_elderwood_square.png",
  "DA_18_Lux_Fae": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_fae_square.png",
  "da_18_lux_fae": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_fae_square.png",
  "DA_18_Lux_Inferno": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_inferno_square.png",
  "da_18_lux_inferno": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_inferno_square.png",
  "DA_18_Lux_Moonbeam": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_moonbeam_square.png",
  "da_18_lux_moonbeam": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_moonbeam_square.png",
  "DA_18_Lux_Primal": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_primal_square.png",
  "da_18_lux_primal": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_primal_square.png",
  "DA_18_Lux_Sunbeam": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_sunbeam_square.png",
  "da_18_lux_sunbeam": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_sunbeam_square.png",
  "DA_CrimsonRaptor18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_raptor/tft18_crimsonraptor_teamplanner_splash.png",
  "da_crimsonraptor18": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_raptor/tft18_crimsonraptor_teamplanner_splash.png",
  "gromp": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_gromp/tft18_gromp_square.png",
  "murkwolf": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_murkwolf/tft18_murkwolf_square.png",
  "pebbles": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sentry/tft18_sentry_square.png",
  "cinderling": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_cinderling/tft18_cinderling_square.png",
  "scuttlecrab": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_scuttlecrab/tft18_scuttlecrab_square.png",
  "krug": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_krug/tft18_krug_square.png",
  "sentinel": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sentinel/tft18_sentinel_square.png",
  "brambleback": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_brambleback/tft18_brambleback_square.png",
  "xayah": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_xayah/tft18_xayah_square.png",
  "ornn": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ornn/tft18_ornn_square.png",
  "nidalee": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_nidalee/tft18_nidalee_square.png",
  "hecarim": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_hecarim/tft18_hecarim_square.png",
  "ezreal": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ezreal/tft18_ezreal_square.png",
  "azir": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_azir/tft18_azir_square.png",
  "reksai": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_reksai/tft18_reksai_square.png",
  "veigar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_veigar/tft18_veigar_square.png",
  "maokai": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_maokai/tft18_maokai_square.png",
  "malphite": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_malphite/tft18_malphite_square.png",
  "yorick": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_yorick/tft18_yorick_square.png",
  "yunara": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_yunara/tft18_yunara_square.png",
  "sett": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sett/tft18_sett_square.png",
  "ahri": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ahri/tft18_ahri_square.png",
  "ashe": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ashe/tft18_ashe_square.png",
  "elise": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_elise/tft18_elise_square.png",
  "caitlyn": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_caitlyn/tft18_caitlyn_square.png",
  "cassiopeia": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_cassiopeia/tft18_cassiopeia_square.png",
  "morgana": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_morgana/tft18_morgana_square.png",
  "rakan": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_rakan/tft18_rakan_square.png",
  "lillia": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lillia/tft18_lillia_square.png",
  "kobuko": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kobuko/tft18_kobuko_square.png",
  "teemo": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_teemo/tft18_teemo_square.png",
  "rammus": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_rammus/tft18_rammus_square.png",
  "gnar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_gnar/tft18_gnar_square.png",
  "tristana": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_tristana/tft18_tristana_square.png",
  "sivir": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sivir/tft18_sivir_square.png",
  "vi": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_vi/tft18_vi_square.png",
  "akali": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_akali/tft18_akali_square.png",
  "varus": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_varus/tft18_varus_square.png",
  "amumu": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_amumu/tft18_amumu_square.png",
  "kennen": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kennen/tft18_kennen_square.png",
  "aphelios": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_aphelios/tft18_aphelios_square.png",
  "diana": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_diana/tft18_diana_square.png",
  "alune": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_alune/hud/tft18_alune_square.png",
  "leona": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_leona/tft18_leona_square.png",
  "kayle": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kayle/tft18_kayle_square.png",
  "sejuani": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_sejuani/tft18_sejuani_square.png",
  "khazix": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_khazix/tft18_khazix_square.png",
  "rengar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_rengar/tft18_rengar_square.png",
  "kogmaw": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_kogmaw/tft18_kogmaw_square.png",
  "zyra": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_zyra/tft18_zyra_square.png",
  "fiddlesticks": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_fiddlesticks/tft18_fiddlesticks_square.png",
  "soraka": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_soraka/tft18_soraka_square.png",
  "taric": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_taric/tft18_taric_square.png",
  "ivern": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_ivern/hud/tft18_ivern_square.png",
  "lux": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_square.png",
  "alistar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_alistar/tft18_alistar_square.png",
  "draven": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_draven/tft18_draven_square.png",
  "elderdragon": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_elderdragon/hud/tft18_elderdragon_square.png",
  "karma": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_karma/tft18_karma_square.png",
  "leblanc": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_leblanc/tft18_leblanc_square.png",
  "masteryi": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_masteryi/tft18_masteryi_square.png",
  "shen": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_shen/tft18_shen_square.png",
  "warwick": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_warwick/tft18_warwick_square.png",
  "camille": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_camille/tft18_camille_square.png",
  "luxblackthorn": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_blackthorn_square.png",
  "luxblossom": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_blossom_square.png",
  "luxcoven": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_coven_square.png",
  "luxelderwood": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_elderwood_square.png",
  "luxfae": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_fae_square.png",
  "luxinferno": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_inferno_square.png",
  "luxlunar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_moonbeam_square.png",
  "luxprimal": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_primal_square.png",
  "luxsolar": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_lux/tft18_lux_sunbeam_square.png",
  "mamabeak": "https://raw.communitydragon.org/18.2/game/assets/characters/tft18_raptor/tft18_crimsonraptor_teamplanner_splash.png",
};

const COMMUNITY_DRAGON_ASSET_VERSION = VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION;

// The legacy lookup table is retained for compatibility with old callers, but
// every URL is normalized through the verified archive namespace at runtime.
for (const key of Object.keys(TFT_CHAMPION_IMAGE_URLS)) {
  TFT_CHAMPION_IMAGE_URLS[key] = TFT_CHAMPION_IMAGE_URLS[key].replace(/raw\.communitydragon\.org\/18\.2\//g, `raw.communitydragon.org/${COMMUNITY_DRAGON_ASSET_VERSION}/`);
}

function registryChampionImageUrl(championId: string, nameVi?: string): string | null {
  const entry = resolveSet18Champion(championId) || resolveSet18Champion(nameVi);
  if (entry?.iconSourcePath) {
    const assetPath = entry.iconSourcePath
      .replace(/^\/+/, "")
      .replace(/\.(?:tex|dds)$/i, ".png");
    return `https://raw.communitydragon.org/${COMMUNITY_DRAGON_ASSET_VERSION}/game/${assetPath}`;
  }
  const candidates = [championId, nameVi || ""]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  for (const candidate of candidates) {
    const direct = TFT_CHAMPION_IMAGE_URLS[candidate] || TFT_CHAMPION_IMAGE_URLS[candidate.replace(/^tft18_/, "")];
    if (direct) return direct;
  }
  return null;
}
/**
 * Lấy URL ảnh chân dung tướng chính xác từ championId hoặc nameVi
 */
export function getChampionImageUrl(championId: string, nameVi?: string): string | null {
  // Registry-backed assets only.
  return registryChampionImageUrl(championId, nameVi);
}

export const costColors: Record<number, { border: string; bg: string; text: string }> = {
  1: {
    border: "border-slate-500",
    bg: "bg-slate-900/90",
    text: "text-slate-300"
  },
  2: {
    border: "border-emerald-500",
    bg: "bg-emerald-950/70",
    text: "text-emerald-300"
  },
  3: {
    border: "border-sky-500",
    bg: "bg-sky-950/70",
    text: "text-sky-300"
  },
  4: {
    border: "border-purple-500",
    bg: "bg-purple-950/70",
    text: "text-purple-300"
  },
  5: {
    border: "border-amber-400",
    bg: "bg-amber-950/70",
    text: "text-amber-300"
  }
};

interface ChampionAvatarProps {
  championId: string;
  nameVi?: string;
  cost?: number;
  tier?: number;
  isCarry?: boolean;
  isTank?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "board";
  className?: string;
}

export function ChampionAvatar({
  championId,
  nameVi,
  cost,
  tier = 2,
  isCarry = false,
  isTank = false,
  size = "md",
  className = ""
}: ChampionAvatarProps) {
  const [imgError, setImgError] = useState(false);
  React.useEffect(() => setImgError(false), [championId]);
  const imageUrl = getChampionImageUrl(championId, nameVi);
  const costStyle = cost ? costColors[cost] || costColors[1] : { border: "border-slate-700", bg: "bg-slate-900", text: "text-slate-400" };

  const sizeClasses = {
    xs: "w-6 h-6 rounded-md",
    sm: "w-8 h-8 rounded-lg",
    md: "w-10 h-10 rounded-xl",
    lg: "w-12 h-12 rounded-xl",
    board: "w-14 sm:w-16 h-16 sm:h-18 rounded-xl"
  };

  const displayName = nameVi || championId.replace(/^da_18_/, "").replace(/^da_/, "");
  const costText = cost !== undefined && cost !== null ? `${cost} vàng` : "? vàng";

  return (
    <div
      className={`relative flex-shrink-0 border-2 overflow-hidden shadow-md transition-transform group ${
        sizeClasses[size]
      } ${costStyle.border} ${costStyle.bg} ${
        isCarry
          ? "ring-2 ring-amber-500/80 shadow-amber-500/20"
          : isTank
          ? "ring-2 ring-blue-500/80 shadow-blue-500/20"
          : ""
      } ${className}`}
      title={`${displayName} (${tier}★, ${costText})`}
    >
      {!imgError && imageUrl ? (
        <img
          src={imageUrl}
          alt={displayName}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-bold text-[10px] text-slate-300 capitalize bg-slate-800">
          {displayName.slice(0, 2)}
        </div>
      )}

      {/* Lớp phủ sao cấp độ */}
      <div className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded bg-black/75 backdrop-blur-[2px] leading-none pointer-events-none">
        <span className="text-[9px] font-black text-amber-400">
          {"★".repeat(tier)}
        </span>
      </div>

      {/* Huy hiệu vai trò */}
      {isCarry && (
        <span
          className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm"
          title="Chủ lực sát thương"
        >
          <Swords className="w-2 h-2" />
        </span>
      )}
      {isTank && (
        <span
          className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm"
          title="Chống chịu tiền tuyến"
        >
          <Shield className="w-2 h-2" />
        </span>
      )}
    </div>
  );
}
