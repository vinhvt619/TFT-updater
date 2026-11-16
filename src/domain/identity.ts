import { canonicalSet18ChampionId } from "./meta/set18-registry";

/**
 * Resolve Set 18 ids through the source-key registry first.  The fallback is
 * intentionally kept for non-Set-18 fixtures and future sets; it never turns
 * an unknown source into a known champion.
 */
export function toCanonicalChampionId(rawIdOrName: string, setNumber: number = 18): string {
  if (setNumber === 18) {
    const registered = canonicalSet18ChampionId(rawIdOrName);
    if (registered) return registered;
  }
  const clean = rawIdOrName.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
  const prefix = `tft${setNumber}_`;
  if (clean.startsWith(prefix)) {
    return clean;
  }
  return `${prefix}${clean}`;
}

/**
 * Chuẩn hóa chuỗi tìm kiếm: bỏ dấu tiếng Việt, map đ -> d, chữ thường.
 */
export function normalizeSearchString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu thanh
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .trim();
}

export const SET18_CANONICAL_TRAITS: Record<string, string> = {
  "da_18_elderwood": "da_18_elderwood", "elderwood": "da_18_elderwood", "thần rừng": "da_18_elderwood",
  "da_18_luxuniquetrait": "da_18_luxuniquetrait", "avatar": "da_18_luxuniquetrait", "thế thần": "da_18_luxuniquetrait",
  "da_18_slayer": "da_18_slayer", "ravager": "da_18_slayer", "tàn phá": "da_18_slayer",
  "da_dravenuniquetrait18": "da_dravenuniquetrait18", "bounty seeker": "da_dravenuniquetrait18", "săn thưởng": "da_dravenuniquetrait18",
  "da_18_solar": "da_18_solar", "solar": "da_18_solar", "mặt trời": "da_18_solar",
  "da_18_sprykin": "da_18_sprykin", "sprykin": "da_18_sprykin", "tinh nghịch": "da_18_sprykin",
  "da_18_adaptor": "da_18_adaptor", "adaptor": "da_18_adaptor", "thích ứng": "da_18_adaptor",
  "da_18_coven": "da_18_coven", "coven": "da_18_coven", "tiên hắc ám": "da_18_coven",
  "da_18_eclipse": "da_18_eclipse", "eclipse": "da_18_eclipse", "thiên thực": "da_18_eclipse",
  "da_18_hunter": "da_18_hunter", "hunter": "da_18_hunter", "thợ săn": "da_18_hunter",
  "da_18_maokai_uniquetrait": "da_18_maokai_uniquetrait", "old growth": "da_18_maokai_uniquetrait", "cổ thụ": "da_18_maokai_uniquetrait",
  "da_18_battlemage": "da_18_battlemage", "monolith": "da_18_battlemage", "cự thạch": "da_18_battlemage",
  "da_primal18": "da_primal18", "primal": "da_primal18", "nguyên sinh": "da_primal18",
  "da_18_greenfather": "da_18_greenfather", "greenfather": "da_18_greenfather", "thụ thần": "da_18_greenfather",
  "da_18_invoker": "da_18_invoker", "invoker": "da_18_invoker", "thuật sĩ": "da_18_invoker",
  "da_18_rapidfire": "da_18_rapidfire", "rapidfire": "da_18_rapidfire", "liên kích": "da_18_rapidfire",
  "da_juggernaut18": "da_juggernaut18", "juggernaut": "da_juggernaut18", "dũng sĩ": "da_juggernaut18",
  "da_18_inferno": "da_18_inferno", "inferno": "da_18_inferno", "hỏa ngục": "da_18_inferno",
  "da_aluneuniquetrait18": "da_aluneuniquetrait18", "attuned": "da_aluneuniquetrait18", "hòa hợp": "da_aluneuniquetrait18",
  "da_18_rival": "da_18_rival", "rival": "da_18_rival", "khắc tinh": "da_18_rival",
  "da_18_vanguard": "da_18_vanguard", "vanguard": "da_18_vanguard", "tiên phong": "da_18_vanguard",
  "da_18_brawler": "da_18_brawler", "brawler": "da_18_brawler", "đấu sĩ": "da_18_brawler",
  "da_18_blackthorn": "da_18_blackthorn", "blackthorn": "da_18_blackthorn", "gai đen": "da_18_blackthorn",
  "da_18_executioner": "da_18_executioner", "executioner": "da_18_executioner", "đao phủ": "da_18_executioner",
  "da_18_apexpredator": "da_18_apexpredator", "apex predator": "da_18_apexpredator", "bá chủ": "da_18_apexpredator",
  "da_riftbeast18": "da_riftbeast18", "riftbeast": "da_riftbeast18", "quái rừng": "da_riftbeast18",
  "da_18_caustic": "da_18_caustic", "caustic": "da_18_caustic", "ăn mòn": "da_18_caustic",
  "da_18_fae": "da_18_fae", "fae": "da_18_fae", "tiên linh": "da_18_fae",
  "da_18_lunar": "da_18_lunar", "lunar": "da_18_lunar", "mặt trăng": "da_18_lunar",
  "da_18_defender": "da_18_defender", "defender": "da_18_defender", "vệ quân": "da_18_defender",
  "da_18_spellweaver": "da_18_spellweaver", "spellweaver": "da_18_spellweaver", "thuật sư": "da_18_spellweaver",
  "da_18_zyrauniquetrait": "da_18_zyrauniquetrait", "thornmaiden": "da_18_zyrauniquetrait", "vườn gai": "da_18_zyrauniquetrait",
  "da_florafatalis18": "da_florafatalis18", "flora fatalis": "da_florafatalis18", "thực vật": "da_florafatalis18",
  "da_18_summoner": "da_18_summoner", "summoner": "da_18_summoner", "triệu hồi": "da_18_summoner",
  "da_18_blossom": "da_18_blossom", "blossom": "da_18_blossom", "hoa linh": "da_18_blossom",
  "da_emerald18": "da_emerald18", "emerald aspect": "da_emerald18", "lục bảo": "da_emerald18"
};

export function toCanonicalTraitId(rawTrait: string): string {
  if (!rawTrait) return "";
  const key = rawTrait.toLowerCase().trim();
  if (SET18_CANONICAL_TRAITS[key]) return SET18_CANONICAL_TRAITS[key];

  // Hỗ trợ bóc tách tiền tố Riot TFT18_ / TFT_ (ví dụ TFT18_BlackThorn -> da_18_blackthorn)
  const stripped = key.replace(/^tft18_/, "").replace(/^tft_/, "");
  if (SET18_CANONICAL_TRAITS[stripped]) return SET18_CANONICAL_TRAITS[stripped];

  const withDa = `da_18_${stripped}`;
  if (SET18_CANONICAL_TRAITS[withDa]) return SET18_CANONICAL_TRAITS[withDa];

  return SET18_CANONICAL_TRAITS[key] || key.replace(/[^a-z0-9_]/g, "_");
}

export const SET18_TRAIT_NAMES_VI: Record<string, string> = {
  da_18_elderwood: "Thần Rừng",
  da_18_luxuniquetrait: "Thế Thần",
  da_18_slayer: "Tàn Phá",
  da_dravenuniquetrait18: "Săn Thưởng",
  da_18_solar: "Mặt Trời",
  da_18_sprykin: "Tinh Nghịch",
  da_18_adaptor: "Thích Ứng",
  da_18_coven: "Tiên Hắc Ám",
  da_18_eclipse: "Thiên Thực",
  da_18_hunter: "Thợ Săn",
  da_18_maokai_uniquetrait: "Cổ Thụ",
  da_18_battlemage: "Cự Thạch",
  da_primal18: "Nguyên Sinh",
  da_18_greenfather: "Thụ Thần",
  da_18_invoker: "Thuật Sĩ",
  da_18_rapidfire: "Liên Kích",
  da_juggernaut18: "Dũng Sĩ",
  da_18_inferno: "Hỏa Ngục",
  da_aluneuniquetrait18: "Hòa Hợp",
  da_18_rival: "Khắc Tinh",
  da_18_vanguard: "Tiên Phong",
  da_18_brawler: "Đấu Sĩ",
  da_18_blackthorn: "Gai Đen",
  da_18_executioner: "Đao Phủ",
  da_18_apexpredator: "Bá Chủ",
  da_riftbeast18: "Quái Rừng",
  da_18_caustic: "Ăn Mòn",
  da_18_fae: "Tiên Linh",
  da_18_lunar: "Mặt Trăng",
  da_18_defender: "Vệ Quân",
  da_18_spellweaver: "Thuật Sư",
  da_18_zyrauniquetrait: "Vườn Gai",
  da_florafatalis18: "Thực Vật",
  da_18_summoner: "Triệu Hồi",
  da_18_blossom: "Hoa Linh",
  da_emerald18: "Lục Bảo"
};

/**
 * Định dạng tên hiển thị tiếng Việt của Tộc/Hệ Set 18
 * FIN-07: Chuyển đổi mã kỹ thuật (TFT18_BlackThorn, da_18_elderwood) sang tên tiếng Việt chuẩn hóa.
 */
export function formatTraitNameVi(rawTrait: string): string {
  if (!rawTrait) return "";
  const canonical = toCanonicalTraitId(rawTrait);
  return SET18_TRAIT_NAMES_VI[canonical] || rawTrait;
}

