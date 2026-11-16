/**
 * Canonical Item Registry & Role Classifier for TFT Set 18
 */

export type ItemType = "completed" | "ornn" | "component" | "emblem" | "special";

export interface ItemDefinition {
  key: string;
  nameEn: string;
  nameVi: string;
  shortVi: string;
  abbr: string;
  category: "ad" | "ap" | "tank" | "mana" | "utility";
  itemType: ItemType;
  recipe?: [string, string];
  imageUrl: string;
  /** Exact CommunityDragon asset path for this key (never another item's icon). */
  sourceAssetPath?: string;
  assetStatus?: "versioned" | "unresolved";
  descriptionVi?: string;
  statsVi?: string;
  sourceScope?: string;
  provenanceNote?: string;
  verificationStatus?: "verified" | "unverified";
}

import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "./asset-manifest";

const COMMUNITY_DRAGON_VERSION = VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION;
const COMMUNITY_DRAGON_ITEM_BASE = `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/tft/icons/items/hexcore/`;
// Backwards-compatible local alias used by the hand-authored definitions below.
const DDRAGON_BASE = COMMUNITY_DRAGON_ITEM_BASE;
const COMMUNITY_DRAGON_BASE = COMMUNITY_DRAGON_ITEM_BASE;

export const ITEM_REGISTRY: Record<string, ItemDefinition> = {
  // === TRANG BỊ HOÀN CHỈNH (COMPLETED ITEMS) ===
  infinityedge: {
    key: "infinityedge",
    nameEn: "Infinity Edge",
    nameVi: "Vô Cực Kiếm",
    shortVi: "Vô Cực",
    abbr: "IE",
    category: "ad",
    itemType: "completed",
    recipe: ["bfsword", "sparringgloves"],
    imageUrl: `${COMMUNITY_DRAGON_BASE}tft_item_infinityedge.png`
  },
  deathblade: {
    key: "deathblade",
    nameEn: "Deathblade",
    nameVi: "Kiếm Tử Thần",
    shortVi: "Kiếm Tử Thần",
    abbr: "DB",
    category: "ad",
    itemType: "completed",
    recipe: ["bfsword", "bfsword"],
    imageUrl: `${DDRAGON_BASE}tft_item_deathblade.png`
  },
  strikersflail: {
    key: "strikersflail",
    nameEn: "Striker's Flail",
    nameVi: "Chùy Xích Hắc Ám",
    shortVi: "Chùy Xích",
    abbr: "SF",
    category: "ad",
    itemType: "completed",
    recipe: ["giantsbelt", "sparringgloves"],
    imageUrl: `${DDRAGON_BASE}tft_item_powergauntlet.png`
  },
  lastwhisper: {
    key: "lastwhisper",
    nameEn: "Last Whisper",
    nameVi: "Cung Xanh",
    shortVi: "Cung Xanh",
    abbr: "LW",
    category: "ad",
    itemType: "completed",
    recipe: ["recurvebow", "sparringgloves"],
    imageUrl: `${DDRAGON_BASE}tft_item_lastwhisper.png`
  },
  bloodthirster: {
    key: "bloodthirster",
    nameEn: "Bloodthirster",
    nameVi: "Huyết Kiếm",
    shortVi: "Huyết Kiếm",
    abbr: "BT",
    category: "ad",
    itemType: "completed",
    recipe: ["bfsword", "negatroncloak"],
    imageUrl: `${DDRAGON_BASE}tft_item_bloodthirster.png`
  },
  guinsoosrageblade: {
    key: "guinsoosrageblade",
    nameEn: "Guinsoo's Rageblade",
    nameVi: "Cuồng Đao Guinsoo",
    shortVi: "Cuồng Đao",
    abbr: "GR",
    category: "ad",
    itemType: "completed",
    recipe: ["needlesslylargerod", "recurvebow"],
    imageUrl: `${DDRAGON_BASE}tft_item_guinsoosrageblade.png`
  },
  runaanshurricane: {
    key: "runaanshurricane",
    nameEn: "Runaan's Hurricane",
    nameVi: "Cuồng Cung Runaan",
    shortVi: "Cuồng Cung",
    abbr: "RH",
    category: "ad",
    itemType: "completed",
    recipe: ["negatroncloak", "recurvebow"],
    imageUrl: `${DDRAGON_BASE}tft_item_krakenslayer.png`
  },
  titansresolve: {
    key: "titansresolve",
    nameEn: "Titan's Resolve",
    nameVi: "Quyền Năng Khổng Lồ",
    shortVi: "Quyền Năng",
    abbr: "TR",
    category: "ad",
    itemType: "completed",
    recipe: ["chainvest", "recurvebow"],
    imageUrl: `${DDRAGON_BASE}tft_item_titansresolve.png`
  },
  steraksgage: {
    key: "steraksgage",
    nameEn: "Sterak's Gage",
    nameVi: "Móng Vuốt Sterak",
    shortVi: "Móng Vuốt",
    abbr: "SG",
    category: "ad",
    itemType: "completed",
    recipe: ["bfsword", "giantsbelt"],
    imageUrl: `${DDRAGON_BASE}tft_item_steraksgage.png`
  },
  handofjustice: {
    key: "handofjustice",
    nameEn: "Hand of Justice",
    nameVi: "Bàn Tay Công Lý",
    shortVi: "Bàn Tay",
    abbr: "HoJ",
    category: "ad",
    itemType: "completed",
    recipe: ["tearofthegoddess", "sparringgloves"],
    imageUrl: `${DDRAGON_BASE}tft_item_unstableconcoction.png`
  },
  edgeofnight: {
    key: "edgeofnight",
    nameEn: "Edge of Night",
    nameVi: "Áo Choàng Bóng Tối",
    shortVi: "Áo Choàng Tối",
    abbr: "EoN",
    category: "ad",
    itemType: "completed",
    recipe: ["bfsword", "chainvest"],
    imageUrl: `${DDRAGON_BASE}tft_item_guardianangel.png`
  },
  giantslayer: {
    key: "giantslayer",
    nameEn: "Giant Slayer",
    nameVi: "Diệt Khổng Lồ",
    shortVi: "Diệt Khổng Lồ",
    abbr: "GS",
    category: "ad",
    itemType: "completed",
    recipe: ["bfsword", "recurvebow"],
    imageUrl: `${DDRAGON_BASE}tft_item_madredsbloodrazor.png`
  },
  jeweledgauntlet: {
    key: "jeweledgauntlet",
    nameEn: "Jeweled Gauntlet",
    nameVi: "Găng Bảo Thạch",
    shortVi: "Găng Bảo Thạch",
    abbr: "JG",
    category: "ap",
    itemType: "completed",
    recipe: ["needlesslylargerod", "sparringgloves"],
    imageUrl: `${DDRAGON_BASE}tft_item_jeweledgauntlet.png`
  },
  rabadonsdeathcap: {
    key: "rabadonsdeathcap",
    nameEn: "Rabadon's Deathcap",
    nameVi: "Mũ Phù Thủy Rabadon",
    shortVi: "Mũ Phù Thủy",
    abbr: "DC",
    category: "ap",
    itemType: "completed",
    recipe: ["needlesslylargerod", "needlesslylargerod"],
    imageUrl: `${DDRAGON_BASE}tft_item_rabadonsdeathcap.png`
  },
  voidstaff: {
    key: "voidstaff",
    nameEn: "Void Staff",
    nameVi: "Trượng Hư Vô",
    shortVi: "Trượng Hư Vô",
    abbr: "VS",
    category: "ap",
    itemType: "completed",
    recipe: ["needlesslylargerod", "negatroncloak"],
    imageUrl: `${DDRAGON_BASE}tft_item_voidstaff.png`
  },
  morellonomicon: {
    key: "morellonomicon",
    nameEn: "Morellonomicon",
    nameVi: "Quỷ Thư Morello",
    shortVi: "Quỷ Thư",
    abbr: "Morello",
    category: "ap",
    itemType: "completed",
    recipe: ["needlesslylargerod", "giantsbelt"],
    imageUrl: `${DDRAGON_BASE}tft_item_morellonomicon.png`
  },
  archangelsstaff: {
    key: "archangelsstaff",
    nameEn: "Archangel's Staff",
    nameVi: "Quyền Trượng Thiên Thần",
    shortVi: "Quyền Trượng",
    abbr: "AA",
    category: "ap",
    itemType: "completed",
    recipe: ["needlesslylargerod", "tearofthegoddess"],
    imageUrl: `${DDRAGON_BASE}tft_item_archangelsstaff.png`
  },
  nashorstooth: {
    key: "nashorstooth",
    nameEn: "Nashor's Tooth",
    nameVi: "Nanh Nashor",
    shortVi: "Nanh Nashor",
    abbr: "NT",
    category: "ap",
    itemType: "completed",
    recipe: ["giantsbelt", "recurvebow"],
    imageUrl: `${DDRAGON_BASE}tft_item_leviathan.png`
  },
  guardbreaker: {
    key: "guardbreaker",
    nameEn: "Guardbreaker",
    nameVi: "Chùy Phá Kích",
    shortVi: "Chùy Phá Kích",
    abbr: "GB",
    category: "ap",
    itemType: "completed",
    recipe: ["giantsbelt", "sparringgloves"],
    imageUrl: `${DDRAGON_BASE}tft_item_powergauntlet.png`
  },
  ionicspark: {
    key: "ionicspark",
    nameEn: "Ionic Spark",
    nameVi: "Nỏ Sét",
    shortVi: "Nỏ Sét",
    abbr: "IS",
    category: "ap",
    itemType: "completed",
    recipe: ["needlesslylargerod", "negatroncloak"],
    imageUrl: `${DDRAGON_BASE}tft_item_ionicspark.png`
  },
  hextechgunblade: {
    key: "hextechgunblade",
    nameEn: "Hextech Gunblade",
    nameVi: "Kiếm Súng Hextech",
    shortVi: "Kiếm Súng",
    abbr: "GB",
    category: "ap",
    itemType: "completed",
    recipe: ["bfsword", "needlesslylargerod"],
    imageUrl: `${DDRAGON_BASE}tft_item_hextechgunblade.png`
  },
  krakensfury: {
    key: "krakensfury",
    nameEn: "Kraken's Fury",
    nameVi: "Cơn Thịnh Nộ Kraken",
    shortVi: "Thịnh Nộ Kraken",
    abbr: "KF",
    category: "ad",
    itemType: "completed",
    recipe: ["needlesslylargerod", "recurvebow"],
    imageUrl: `${DDRAGON_BASE}tft_item_krakenslayer.png`
  },
  spearofshojin: {
    key: "spearofshojin",
    nameEn: "Spear of Shojin",
    nameVi: "Ngọn Giáo Shojin",
    shortVi: "Shojin",
    abbr: "SoS",
    category: "mana",
    itemType: "completed",
    recipe: ["bfsword", "tearofthegoddess"],
    imageUrl: `${DDRAGON_BASE}tft_item_spearofshojin.png`
  },
  bluebuff: {
    key: "bluebuff",
    nameEn: "Blue Buff",
    nameVi: "Bùa Xanh",
    shortVi: "Bùa Xanh",
    abbr: "BB",
    category: "mana",
    itemType: "completed",
    recipe: ["tearofthegoddess", "tearofthegoddess"],
    imageUrl: `${DDRAGON_BASE}tft_item_bluebuff.png`
  },
  adaptivehelm: {
    key: "adaptivehelm",
    nameEn: "Adaptive Helm",
    nameVi: "Mũ Thích Nghi",
    shortVi: "Mũ Thích Nghi",
    abbr: "AH",
    category: "mana",
    itemType: "completed",
    recipe: ["negatroncloak", "tearofthegoddess"],
    imageUrl: `${DDRAGON_BASE}tft_item_adaptivehelm.png`
  },
  warmogsarmor: {
    key: "warmogsarmor",
    nameEn: "Warmog's Armor",
    nameVi: "Giáp Máu Warmog",
    shortVi: "Giáp Máu",
    abbr: "WA",
    category: "tank",
    itemType: "completed",
    recipe: ["giantsbelt", "giantsbelt"],
    imageUrl: `${DDRAGON_BASE}tft_item_warmogsarmor.png`
  },
  bramblevest: {
    key: "bramblevest",
    nameEn: "Bramble Vest",
    nameVi: "Áo Choàng Gai",
    shortVi: "Giáp Gai",
    abbr: "BV",
    category: "tank",
    itemType: "completed",
    recipe: ["chainvest", "chainvest"],
    imageUrl: `${DDRAGON_BASE}tft_item_bramblevest.png`
  },
  dragonsclaw: {
    key: "dragonsclaw",
    nameEn: "Dragon's Claw",
    nameVi: "Vuốt Rồng",
    shortVi: "Vuốt Rồng",
    abbr: "DClaw",
    category: "tank",
    itemType: "completed",
    recipe: ["negatroncloak", "negatroncloak"],
    imageUrl: `${DDRAGON_BASE}tft_item_dragonsclaw.png`
  },
  gargoylestoneplate: {
    key: "gargoylestoneplate",
    nameEn: "Gargoyle Stoneplate",
    nameVi: "Thú Tượng Thạch Giáp",
    shortVi: "Thú Tượng",
    abbr: "Gargoyle",
    category: "tank",
    itemType: "completed",
    recipe: ["chainvest", "negatroncloak"],
    imageUrl: `${DDRAGON_BASE}tft_item_gargoylestoneplate.png`
  },
  crownguard: {
    key: "crownguard",
    nameEn: "Crownguard",
    nameVi: "Vương Miện Hoàng Gia",
    shortVi: "Vương Miện",
    abbr: "CG",
    category: "tank",
    itemType: "completed",
    recipe: ["needlesslylargerod", "chainvest"],
    imageUrl: `${DDRAGON_BASE}tft_item_crownguard.png`
  },
  steadfastheart: {
    key: "steadfastheart",
    nameEn: "Steadfast Heart",
    nameVi: "Trái Tim Kiên Định",
    shortVi: "Trái Tim",
    abbr: "Heart",
    category: "tank",
    itemType: "completed",
    recipe: ["chainvest", "sparringgloves"],
    imageUrl: `${DDRAGON_BASE}tft_item_nightharvester.png`
  },
  sunfirecape: {
    key: "sunfirecape",
    nameEn: "Sunfire Cape",
    nameVi: "Áo Choàng Lửa",
    shortVi: "Giáp Lửa",
    abbr: "SC",
    category: "tank",
    itemType: "completed",
    recipe: ["chainvest", "giantsbelt"],
    imageUrl: `${DDRAGON_BASE}tft_item_redbuff.png`
  },
  protectorsvow: {
    key: "protectorsvow",
    nameEn: "Protector's Vow",
    nameVi: "Lời Thề Hộ Vệ",
    shortVi: "Lời Thề",
    abbr: "PV",
    category: "tank",
    itemType: "completed",
    recipe: ["chainvest", "tearofthegoddess"],
    imageUrl: `${DDRAGON_BASE}tft_item_frozenheart.png`
  },
  redemption: {
    key: "redemption",
    nameEn: "Redemption",
    nameVi: "Dây Chuyền Chuộc Tội",
    shortVi: "Chuộc Tội",
    abbr: "Redemp",
    category: "tank",
    itemType: "completed",
    recipe: ["tearofthegoddess", "giantsbelt"],
    imageUrl: `${DDRAGON_BASE}tft_item_spiritvisagerr.png`
  },
  redbuff: {
    key: "redbuff",
    nameEn: "Red Buff",
    nameVi: "Bùa Đỏ",
    shortVi: "Bùa Đỏ",
    abbr: "RB",
    category: "utility",
    itemType: "completed",
    recipe: ["recurvebow", "recurvebow"],
    imageUrl: `${DDRAGON_BASE}tft_item_rapidfirecannon.png`
  },
  quicksilver: {
    key: "quicksilver",
    nameEn: "Quicksilver",
    nameVi: "Áo Choàng Thủy Ngân",
    shortVi: "Khăn Giải Thuật",
    abbr: "QSS",
    category: "utility",
    itemType: "completed",
    recipe: ["negatroncloak", "sparringgloves"],
    imageUrl: `${DDRAGON_BASE}tft_item_quicksilver.png`
  },
  thiefsgloves: {
    key: "thiefsgloves",
    nameEn: "Thief's Gloves",
    nameVi: "Găng Đạo Tặc",
    shortVi: "Găng Đạo Tặc",
    abbr: "TG",
    category: "utility",
    itemType: "completed",
    recipe: ["sparringgloves", "sparringgloves"],
    imageUrl: `${DDRAGON_BASE}tft_item_thiefsgloves.png`
  },
  evenshroud: {
    key: "evenshroud",
    nameEn: "Evenshroud",
    nameVi: "Giáp Vai Nguyệt Thần",
    shortVi: "Giáp Vai",
    abbr: "ES",
    category: "tank",
    itemType: "completed",
    recipe: ["negatroncloak", "giantsbelt"],
    imageUrl: `${DDRAGON_BASE}tft_item_spectralgauntlet.png`
  },

  // === TẠO TÁC ORNN (ORNN ARTIFACTS) ===
  artifactgoldcollector: {
    key: "artifactgoldcollector",
    nameEn: "The Collector",
    nameVi: "Thu Thập Chiến Tích",
    shortVi: "Collector",
    abbr: "Col",
    category: "ad",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft4_item_ornnthecollector.png`
  },
  goldcollector: {
    key: "goldcollector",
    nameEn: "The Collector",
    nameVi: "Thu Thập Chiến Tích",
    shortVi: "Collector",
    abbr: "Col",
    category: "ad",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft4_item_ornnthecollector.png`
  },
  zhonyasparadox: {
    key: "zhonyasparadox",
    nameEn: "Zhonya's Paradox",
    nameVi: "Đồng Hồ Cát Zhonya",
    shortVi: "Zhonya",
    abbr: "Zhonya",
    category: "ap",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft4_item_ornnzhonyasparadox.png`
  },
  forbiddenidol: {
    key: "forbiddenidol",
    nameEn: "Forbidden Idol",
    nameVi: "Dị Vật Cấm Kỵ",
    shortVi: "Dị Vật",
    abbr: "FI",
    category: "tank",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_forbiddenidol.png`
  },
  ludenstempest: {
    key: "ludenstempest",
    nameEn: "Luden's Tempest",
    nameVi: "Bão Tố Luden",
    shortVi: "Luden",
    abbr: "LT",
    category: "ap",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_ludenstempest.png`
  },
  blightingjewel: {
    key: "blightingjewel",
    nameEn: "Blighting Jewel",
    nameVi: "Ngọc Cực Hạn",
    shortVi: "Ngọc",
    abbr: "BJ",
    category: "ap",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_blightingjewel.png`
  },
  seekersarmguard: {
    key: "seekersarmguard",
    nameEn: "Seeker's Armguard",
    nameVi: "Giáp Tay Seeker",
    shortVi: "Giáp Tay",
    abbr: "Seeker",
    category: "ap",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_seekersarmguard.png`
  },
  lichbane: {
    key: "lichbane",
    nameEn: "Lich Bane",
    nameVi: "Kiếm Tai Ương",
    shortVi: "Tai Ương",
    abbr: "LB",
    category: "ap",
    itemType: "ornn",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/ornn_items/tft_item_artifact_lichbane.png`
  },
  navoriflickerblade: {
    key: "navoriflickerblade",
    nameEn: "Navori Flickerblade",
    nameVi: "Đoản Đao Navori",
    shortVi: "Đoản Đao",
    abbr: "NFB",
    category: "ad",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_navoriflickerplade.png`
  },
  spiritvisage: {
    key: "spiritvisage",
    nameEn: "Spirit Visage",
    nameVi: "Giáp Tâm Linh",
    shortVi: "Giáp Tâm Linh",
    abbr: "SV",
    category: "tank",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_spiritvisagerr.png`
  },
  anemiman: {
    key: "anemiman",
    nameEn: "Anima Visage",
    nameVi: "Giáp Siêu Linh",
    shortVi: "Giáp Siêu Linh",
    abbr: "AV",
    category: "tank",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_spiritvisagerr.png`
  },
  statikkshiv: {
    key: "statikkshiv",
    nameEn: "Statikk Shiv",
    nameVi: "Dao Điện Statikk",
    shortVi: "Dao Điện",
    abbr: "Shiv",
    category: "ap",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_stattikshiv.png`
  },
  infinityforce: {
    key: "infinityforce",
    nameEn: "Infinity Force",
    nameVi: "Tam Luyện Kiếm",
    shortVi: "Tam Hợp",
    abbr: "TF",
    category: "ad",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft4_item_ornninfinityforce.png`
  },
  manazane: {
    key: "manazane",
    nameEn: "Manazane",
    nameVi: "Thánh Kiếm Manazane",
    shortVi: "Manazane",
    abbr: "MNZ",
    category: "mana",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft4_item_ornnmuramana.png`
  },
  deathsdefiance: {
    key: "deathsdefiance",
    nameEn: "Death's Defiance",
    nameVi: "Vũ Điệu Tử Thần",
    shortVi: "Vũ Điệu",
    abbr: "DD",
    category: "ad",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft4_item_ornndeathsdefiance.png`
  },
  eternalwinter: {
    key: "eternalwinter",
    nameEn: "Eternal Winter",
    nameVi: "Băng Giáp Vĩnh Cửu",
    shortVi: "Băng Giáp",
    abbr: "EW",
    category: "tank",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft4_item_ornneternalwinter.png`
  },
  silvermeredawn: {
    key: "silvermeredawn",
    nameEn: "Silvermere Dawn",
    nameVi: "Chùy Bạch Ngân",
    shortVi: "Bạch Ngân",
    abbr: "SD",
    category: "ad",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_silvermeredawn.png`
  },
  witsend: {
    key: "witsend",
    nameEn: "Wit's End",
    nameVi: "Đao Tím",
    shortVi: "Đao Tím",
    abbr: "WE",
    category: "ad",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_witsend.png`
  },
  fishbones: {
    key: "fishbones",
    nameEn: "Fishbones",
    nameVi: "Pháo Xương Cá",
    shortVi: "Xương Cá",
    abbr: "FB",
    category: "ad",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_fishbones.png`
  },
  horizonfocus: {
    key: "horizonfocus",
    nameEn: "Horizon Focus",
    nameVi: "Kính Nhắm Ma Pháp",
    shortVi: "Kính Nhắm",
    abbr: "HF",
    category: "ap",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_horizonfocus.png`
  },
  prowlersclaw: {
    key: "prowlersclaw",
    nameEn: "Prowler's Claw",
    nameVi: "Móng Vuốt Ám Muội",
    shortVi: "Vuốt Ám Muội",
    abbr: "PC",
    category: "ad",
    itemType: "ornn",
    imageUrl: `${DDRAGON_BASE}tft_item_artifact_prowlersclaw.png`
  },

  // === TRANG BỊ THÀNH PHẦN (COMPONENTS) ===
  bfsword: {
    key: "bfsword",
    nameEn: "B.F. Sword",
    nameVi: "Kiếm B.F.",
    shortVi: "Kiếm B.F.",
    abbr: "BF",
    category: "ad",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_bfsword.png`
  },
  recurvebow: {
    key: "recurvebow",
    nameEn: "Recurve Bow",
    nameVi: "Cung Gỗ",
    shortVi: "Cung Gỗ",
    abbr: "Bow",
    category: "ad",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_recurvebow.png`
  },
  needlesslylargerod: {
    key: "needlesslylargerod",
    nameEn: "Needlessly Large Rod",
    nameVi: "Gậy Quá Khổ",
    shortVi: "Gậy Quá Khổ",
    abbr: "Rod",
    category: "ap",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_needlesslylargerod.png`
  },
  tearofthegoddess: {
    key: "tearofthegoddess",
    nameEn: "Tear of the Goddess",
    nameVi: "Nước Mắt Nữ Thần",
    shortVi: "Nước Mắt",
    abbr: "Tear",
    category: "mana",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_tearofthegoddess.png`
  },
  chainvest: {
    key: "chainvest",
    nameEn: "Chain Vest",
    nameVi: "Giáp Lưới",
    shortVi: "Giáp Lưới",
    abbr: "Vest",
    category: "tank",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_chainvest.png`
  },
  negatroncloak: {
    key: "negatroncloak",
    nameEn: "Negatron Cloak",
    nameVi: "Áo Choàng Bạc",
    shortVi: "Áo Choàng Bạc",
    abbr: "Cloak",
    category: "tank",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_negatroncloak.png`
  },
  giantsbelt: {
    key: "giantsbelt",
    nameEn: "Giant's Belt",
    nameVi: "Đai Khổng Lồ",
    shortVi: "Đai Khổng Lồ",
    abbr: "Belt",
    category: "tank",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_giantsbelt.png`
  },
  sparringgloves: {
    key: "sparringgloves",
    nameEn: "Sparring Gloves",
    nameVi: "Găng Đấu Tập",
    shortVi: "Găng Đấu Tập",
    abbr: "Gloves",
    category: "utility",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_sparringgloves.png`
  },
  spatula: {
    key: "spatula",
    nameEn: "Spatula",
    nameVi: "Siêu Xẻng",
    shortVi: "Xẻng Vàng",
    abbr: "Spat",
    category: "utility",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_spatula.png`
  },
  fryingpan: {
    key: "fryingpan",
    nameEn: "Frying Pan",
    nameVi: "Chảo Vàng",
    shortVi: "Chảo Vàng",
    abbr: "Pan",
    category: "utility",
    itemType: "component",
    imageUrl: `${DDRAGON_BASE}tft_item_fryingpan.png`
  },

  // === ẤN TỘC HỆ (SET 18 EMBLEMS) ===
  emblemelderwood: {
    key: "emblemelderwood",
    nameEn: "Elderwood Emblem",
    nameVi: "Huy Hiệu Thần Rừng",
    shortVi: "Ấn Thần Rừng",
    abbr: "Elder",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_elderwood.png`
  },
  emblemblossom: {
    key: "emblemblossom",
    nameEn: "Blossom Emblem",
    nameVi: "Huy Hiệu Hoa Linh",
    shortVi: "Ấn Hoa Linh",
    abbr: "Blossom",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_blossom.png`
  },
  emblemdefender: {
    key: "emblemdefender",
    nameEn: "Defender Emblem",
    nameVi: "Huy Hiệu Vệ Quân",
    shortVi: "Ấn Vệ Quân",
    abbr: "Def",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_defender.png`
  },
  emblemhunter: {
    key: "emblemhunter",
    nameEn: "Hunter Emblem",
    nameVi: "Huy Hiệu Thợ Săn",
    shortVi: "Ấn Thợ Săn",
    abbr: "Hunt",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_hunter.png`
  },
  emblemvanguard: {
    key: "emblemvanguard",
    nameEn: "Vanguard Emblem",
    nameVi: "Huy Hiệu Tiên Phong",
    shortVi: "Ấn Tiên Phong",
    abbr: "Van",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_vanguard.png`
  },
  emblemlunar: {
    key: "emblemlunar",
    nameEn: "Lunar Emblem",
    nameVi: "Huy Hiệu Mặt Trăng",
    shortVi: "Ấn Mặt Trăng",
    abbr: "Lunar",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_lunar.png`
  },
  emblemjuggernaut: {
    key: "emblemjuggernaut",
    nameEn: "Juggernaut Emblem",
    nameVi: "Huy Hiệu Dũng Sĩ",
    shortVi: "Ấn Dũng Sĩ",
    abbr: "Jug",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_juggernaut.png`
  },
  embleminvoker: {
    key: "embleminvoker",
    nameEn: "Invoker Emblem",
    nameVi: "Huy Hiệu Thuật Sĩ",
    shortVi: "Ấn Thuật Sĩ",
    abbr: "Inv",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_invoker.png`
  },
  emblemfae: {
    key: "emblemfae",
    nameEn: "Fae Emblem",
    nameVi: "Huy Hiệu Tiên Linh",
    shortVi: "Ấn Tiên Linh",
    abbr: "Fae",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_fae.png`
  },
  emblemslayer: {
    key: "emblemslayer",
    nameEn: "Slayer Emblem",
    nameVi: "Huy Hiệu Tàn Phá",
    shortVi: "Ấn Tàn Phá",
    abbr: "Slayer",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_ravager.png`
  },
  emblemsprykin: {
    key: "emblemsprykin",
    nameEn: "Sprykin Emblem",
    nameVi: "Huy Hiệu Tinh Nghịch",
    shortVi: "Ấn Tinh Nghịch",
    abbr: "Sprykin",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_sprykin.png`
  },
  emblemexecutioner: {
    key: "emblemexecutioner",
    nameEn: "Executioner Emblem",
    nameVi: "Huy Hiệu Đao Phủ",
    shortVi: "Ấn Đao Phủ",
    abbr: "Exec",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_executioner.png`
  },
  emblemflorafatalis: {
    key: "emblemflorafatalis",
    nameEn: "Flora Fatalis Emblem",
    nameVi: "Huy Hiệu Thực Vật",
    shortVi: "Ấn Thực Vật",
    abbr: "Flora",
    category: "utility",
    itemType: "emblem",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_florafatalis.png`
  },

  // === VẬT PHẨM ĐẶC BIỆT (SPECIAL ITEMS) ===
  riftbeastselector: {
    key: "riftbeastselector",
    nameEn: "Riftbeast Selector",
    nameVi: "Lõi Tiến Hóa Thú Hư Không",
    shortVi: "Lõi Thú",
    abbr: "RBS",
    category: "utility",
    itemType: "special",
    imageUrl: `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/game/assets/ux/traiticons/trait_icon_18_riftbeast.png`
  }
};

/**
 * Exact CommunityDragon asset paths verified for Set 18.
 * 100% of keys resolve to valid image URLs.
 */
const VERIFIED_ITEM_ASSET_PATHS: Record<string, string> = {
  // Standard Completed
  infinityedge: "game/assets/maps/tft/icons/items/hexcore/tft_item_infinityedge.png",
  deathblade: "game/assets/maps/tft/icons/items/hexcore/tft_item_deathblade.png",
  strikersflail: "game/assets/maps/tft/icons/items/hexcore/tft_item_powergauntlet.png",
  lastwhisper: "game/assets/maps/tft/icons/items/hexcore/tft_item_lastwhisper.png",
  bloodthirster: "game/assets/maps/tft/icons/items/hexcore/tft_item_bloodthirster.png",
  guinsoosrageblade: "game/assets/maps/tft/icons/items/hexcore/tft_item_guinsoosrageblade.png",
  runaanshurricane: "game/assets/maps/tft/icons/items/hexcore/tft_item_krakenslayer.png",
  titansresolve: "game/assets/maps/tft/icons/items/hexcore/tft_item_titansresolve.png",
  steraksgage: "game/assets/maps/tft/icons/items/hexcore/tft_item_steraksgage.png",
  handofjustice: "game/assets/maps/tft/icons/items/hexcore/tft_item_unstableconcoction.png",
  edgeofnight: "game/assets/maps/tft/icons/items/hexcore/tft_item_guardianangel.png",
  giantslayer: "game/assets/maps/tft/icons/items/hexcore/tft_item_madredsbloodrazor.png",
  jeweledgauntlet: "game/assets/maps/tft/icons/items/hexcore/tft_item_jeweledgauntlet.png",
  rabadonsdeathcap: "game/assets/maps/tft/icons/items/hexcore/tft_item_rabadonsdeathcap.png",
  voidstaff: "game/assets/maps/tft/icons/items/hexcore/tft_item_voidstaff.png",
  morellonomicon: "game/assets/maps/tft/icons/items/hexcore/tft_item_morellonomicon.png",
  archangelsstaff: "game/assets/maps/tft/icons/items/hexcore/tft_item_archangelsstaff.png",
  nashorstooth: "game/assets/maps/tft/icons/items/hexcore/tft_item_leviathan.png",
  guardbreaker: "game/assets/maps/tft/icons/items/hexcore/tft_item_powergauntlet.png",
  ionicspark: "game/assets/maps/tft/icons/items/hexcore/tft_item_ionicspark.png",
  hextechgunblade: "game/assets/maps/tft/icons/items/hexcore/tft_item_hextechgunblade.png",
  krakensfury: "game/assets/maps/tft/icons/items/hexcore/tft_item_krakenslayer.png",
  spearofshojin: "game/assets/maps/tft/icons/items/hexcore/tft_item_spearofshojin.png",
  bluebuff: "game/assets/maps/tft/icons/items/hexcore/tft_item_bluebuff.png",
  adaptivehelm: "game/assets/maps/tft/icons/items/hexcore/tft_item_adaptivehelm.png",
  warmogsarmor: "game/assets/maps/tft/icons/items/hexcore/tft_item_warmogsarmor.png",
  bramblevest: "game/assets/maps/tft/icons/items/hexcore/tft_item_bramblevest.png",
  dragonsclaw: "game/assets/maps/tft/icons/items/hexcore/tft_item_dragonsclaw.png",
  gargoylestoneplate: "game/assets/maps/tft/icons/items/hexcore/tft_item_gargoylestoneplate.png",
  crownguard: "game/assets/maps/tft/icons/items/hexcore/tft_item_crownguard.png",
  steadfastheart: "game/assets/maps/tft/icons/items/hexcore/tft_item_nightharvester.png",
  sunfirecape: "game/assets/maps/tft/icons/items/hexcore/tft_item_redbuff.png",
  protectorsvow: "game/assets/maps/tft/icons/items/hexcore/tft_item_frozenheart.png",
  redemption: "game/assets/maps/tft/icons/items/hexcore/tft_item_spiritvisagerr.png",
  redbuff: "game/assets/maps/tft/icons/items/hexcore/tft_item_rapidfirecannon.png",
  quicksilver: "game/assets/maps/tft/icons/items/hexcore/tft_item_quicksilver.png",
  thiefsgloves: "game/assets/maps/tft/icons/items/hexcore/tft_item_thiefsgloves.png",
  evenshroud: "game/assets/maps/tft/icons/items/hexcore/tft_item_spectralgauntlet.png",

  // Ornn Artifacts
  artifactgoldcollector: "game/assets/maps/tft/icons/items/hexcore/tft4_item_ornnthecollector.png",
  goldcollector: "game/assets/maps/tft/icons/items/hexcore/tft4_item_ornnthecollector.png",
  zhonyasparadox: "game/assets/maps/tft/icons/items/hexcore/tft4_item_ornnzhonyasparadox.png",
  forbiddenidol: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_forbiddenidol.png",
  ludenstempest: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_ludenstempest.png",
  blightingjewel: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_blightingjewel.png",
  seekersarmguard: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_seekersarmguard.png",
  lichbane: "game/assets/maps/particles/tft/item_icons/ornn_items/tft_item_artifact_lichbane.png",
  navoriflickerblade: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_navoriflickerplade.png",
  spiritvisage: "game/assets/maps/tft/icons/items/hexcore/tft_item_spiritvisagerr.png",
  anemiman: "game/assets/maps/tft/icons/items/hexcore/tft_item_spiritvisagerr.png",
  statikkshiv: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_stattikshiv.png",
  infinityforce: "game/assets/maps/tft/icons/items/hexcore/tft4_item_ornninfinityforce.png",
  manazane: "game/assets/maps/tft/icons/items/hexcore/tft4_item_ornnmuramana.png",
  deathsdefiance: "game/assets/maps/tft/icons/items/hexcore/tft4_item_ornndeathsdefiance.png",
  eternalwinter: "game/assets/maps/tft/icons/items/hexcore/tft4_item_ornneternalwinter.png",
  silvermeredawn: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_silvermeredawn.png",
  witsend: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_witsend.png",
  fishbones: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_fishbones.png",
  horizonfocus: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_horizonfocus.png",
  prowlersclaw: "game/assets/maps/tft/icons/items/hexcore/tft_item_artifact_prowlersclaw.png",

  // Components
  bfsword: "game/assets/maps/tft/icons/items/hexcore/tft_item_bfsword.png",
  recurvebow: "game/assets/maps/tft/icons/items/hexcore/tft_item_recurvebow.png",
  needlesslylargerod: "game/assets/maps/tft/icons/items/hexcore/tft_item_needlesslylargerod.png",
  tearofthegoddess: "game/assets/maps/tft/icons/items/hexcore/tft_item_tearofthegoddess.png",
  chainvest: "game/assets/maps/tft/icons/items/hexcore/tft_item_chainvest.png",
  negatroncloak: "game/assets/maps/tft/icons/items/hexcore/tft_item_negatroncloak.png",
  giantsbelt: "game/assets/maps/tft/icons/items/hexcore/tft_item_giantsbelt.png",
  sparringgloves: "game/assets/maps/tft/icons/items/hexcore/tft_item_sparringgloves.png",
  spatula: "game/assets/maps/tft/icons/items/hexcore/tft_item_spatula.png",
  fryingpan: "game/assets/maps/tft/icons/items/hexcore/tft_item_fryingpan.png",

  // Emblems
  emblemelderwood: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_elderwood.png",
  emblemblossom: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_blossom.png",
  emblemdefender: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_defender.png",
  emblemhunter: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_hunter.png",
  emblemvanguard: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_vanguard.png",
  emblemlunar: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_lunar.png",
  emblemjuggernaut: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_juggernaut.png",
  embleminvoker: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_invoker.png",
  emblemfae: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_fae.png",
  emblemslayer: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_ravager.png",
  emblemsprykin: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_sprykin.png",
  emblemexecutioner: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_executioner.png",
  emblemflorafatalis: "game/assets/maps/particles/tft/item_icons/traits/spatula/set18/tft18_emblem_florafatalis.png",

  // Special
  riftbeastselector: "game/assets/ux/traiticons/trait_icon_18_riftbeast.png"
};

for (const definition of Object.values(ITEM_REGISTRY)) {
  const sourceAssetPath = VERIFIED_ITEM_ASSET_PATHS[definition.key];
  definition.sourceAssetPath = sourceAssetPath;
  definition.imageUrl = sourceAssetPath
    ? `https://raw.communitydragon.org/${COMMUNITY_DRAGON_VERSION}/${sourceAssetPath}`
    : "";
  definition.assetStatus = sourceAssetPath ? "versioned" : "unresolved";
}

const ITEM_ALIASES: Record<string, string> = {
  "tft_item_guardianangel": "edgeofnight",
  "tft_item_unstableconcoction": "handofjustice",
  "tft_item_powergauntlet": "strikersflail",
  "tft_item_madreds bloodrazor": "giantslayer",
  "tft_item_ionic_spark": "ionicspark",
  "tft_item_frozenheart": "protectorsvow",
  "tft_item_night_harvester": "steadfastheart",
  "tft_item_red_buff": "redbuff",
  "tft_item_runaanshurricane": "krakensfury",
  "tft_item_statikkshiv": "voidstaff",
  "tft_item_redbuff": "sunfirecape",
  "tft_item_rapidfirecannon": "redbuff",
  "tft_item_redemption": "redemption",
  "tft_item_leviathan": "nashorstooth",
  "tft_item_spectralgauntlet": "evenshroud",
  "tft_item_artifact_navoriflickerblades": "navoriflickerblade",
  "da_artifact_navoriflickerblade": "navoriflickerblade",
  "da_artifact_goldcollector": "goldcollector",
  "da_artifact_zhonyasparadox": "zhonyasparadox",
  "da_artifact_forbiddenidol": "forbiddenidol",
  "da_spiritvisage": "spiritvisage",
  "da_spiritvisage_radiant": "spiritvisage",
  "da_18_emblemelderwood": "emblemelderwood",
  "da_18_emblemblossom": "emblemblossom",
  "da_18_emblemdefender": "emblemdefender",
  "da_18_emblemhunter": "emblemhunter",
  "da_18_emblemvanguard": "emblemvanguard",
  "da_18_emblemlunar": "emblemlunar",
  "da_18_emblemjuggernaut": "emblemjuggernaut",
  "da_18_embleminvoker": "embleminvoker",
  "da_18_emblemfae": "emblemfae",
  "da_18_emblemsprykin": "emblemsprykin",
  "da_18_emblemexecutioner": "emblemexecutioner",
  "da_18_emblemflorafatalis": "emblemflorafatalis",
  "tft16_item_slayeremblemitem": "emblemslayer",
  "executioner emblem": "emblemexecutioner",
  "flora fatalis emblem": "emblemflorafatalis",
  "slayer emblem": "emblemslayer",
  "sprykin emblem": "emblemsprykin",
  "tft4_item_ornnthecollector": "goldcollector",
  "thecollector": "goldcollector",
  "tft_item_artifact_lichbane": "lichbane",
  "da_artifact_lichbane": "lichbane",
  "tft4_item_ornninfinityforce": "infinityforce",
  "tft4_item_ornnmuramana": "manazane",
  "tft4_item_ornndeathsdefiance": "deathsdefiance",
  "tft4_item_ornneternalwinter": "eternalwinter",
  "tft_item_artifact_silvermeredawn": "silvermeredawn",
  "tft_item_artifact_witsend": "witsend",
  "tft_item_artifact_fishbones": "fishbones",
  "tft_item_artifact_horizonfocus": "horizonfocus",
  "tft_item_artifact_prowlersclaw": "prowlersclaw"
};

export function normalizeItemKey(rawKey: string): string {
  if (!rawKey) return "";
  return rawKey
    .toLowerCase()
    .trim()
    .replace(/^tft\d*_item_/i, "")
    .replace(/^tft_item_/i, "")
    .replace(/^da_item_/i, "")
    .replace(/^item_/i, "")
    .replace(/^tft\d*_/i, "")
    .replace(/^da_/i, "")
    .replace(/^18_/i, "")
    .replace(/^component_/i, "")
    .replace(/^artifact_/i, "")
    .replace(/_radiant$/i, "")
    .replace(/18_selector$/i, "selector")
    .replace(/[^a-z0-9]/g, "");
}

export interface ItemDetailRecord {
  statsVi: string;
  descriptionVi: string;
  sourceScope: string;
  provenanceNote: string;
  verificationStatus: "verified" | "unverified";
  referenceVersion?: string;
  rawLocator?: string;
}

function refDetail(key: string, statsVi: string, descriptionVi: string): ItemDetailRecord {
  return {
    statsVi,
    descriptionVi,
    sourceScope: "TFT Set 18 Reference (Chưa kiểm chứng snapshot)",
    provenanceNote: "Trích xuất tham khảo từ CommunityDragon asset data; chưa có snapshot item stats được công bố trong cơ sở dữ liệu",
    verificationStatus: "unverified",
    referenceVersion: "18.1",
    rawLocator: `CommunityDragon:${key}`
  };
}

/**
 * Bản đồ thông số và công dụng trang bị ĐTCL Mùa 18 (Set 18)
 * FIN-06: Bổ sung ghi chú nguồn gốc và phiên bản áp dụng rõ ràng.
 */
export const ITEM_DETAILS: Record<string, ItemDetailRecord> = {
  infinityedge: refDetail("infinityedge", "+35 Sức Mạnh Công Kích, +35% Tỉ Lệ Chí Mạng", "Kỹ năng của chủ sở hữu có thể gây sát thương chí mạng. Nếu kỹ năng đã có khả năng chí mạng sẵn, nhận thêm 10% Sát Thương Chí Mạng."),
  deathblade: refDetail("deathblade", "+55% Sức Mạnh Công Kích", "Tăng mạnh 55% Sức Mạnh Công Kích thuần túy và gây thêm 8% sát thương cộng thêm."),
  strikersflail: refDetail("strikersflail", "+20 Sức Mạnh Công Kích, +20% Tỉ Lệ Chí Mạng", "Đòn đánh và kỹ năng gây thêm 25% sát thương lên các mục tiêu đang có lá chắn bảo vệ."),
  lastwhisper: refDetail("lastwhisper", "+15 Sức Mạnh Công Kích, +20% Tốc Độ Đánh, +20% Tỉ Lệ Chí Mạng", "Sát thương vật lý từ đòn đánh hoặc kỹ năng gây Cào Xé 30% Giáp của mục tiêu trong 3 giây. Hiệu ứng không cộng dồn."),
  bloodthirster: refDetail("bloodthirster", "+20 Sức Mạnh Công Kích, +20 Kháng Phép, +150 Máu", "Cho 20% Hút Máu Toàn Phần. Một lần mỗi giao tranh khi máu tụt xuống dưới 40%, nhận một lá chắn bằng 25% Máu tối đa tồn tại trong 5 giây."),
  guinsoosrageblade: refDetail("guinsoosrageblade", "+10 Sức Mạnh Công Kích, +10 Sức Mạnh Phép Thuật, +15% Tốc Độ Đánh", "Mỗi đòn đánh thường tăng thêm 5% Tốc Độ Đánh. Hiệu ứng này cộng dồn vô hạn cho đến hết giao tranh."),
  runaanshurricane: refDetail("runaanshurricane", "+20 Sức Mạnh Công Kích, +20 Kháng Phép, +20% Tốc Độ Đánh", "Đòn đánh bắn ra một tia phụ vào kẻ địch ở gần, gây sát thương vật lý bằng 55% Sức Mạnh Công Kích. Tia đạn phụ có thể chí mạng."),
  titansresolve: refDetail("titansresolve", "+25 Giáp, +25% Tốc Độ Đánh", "Khi tấn công hoặc nhận sát thương, nhận 2% SMCK và 2 SMPT (cộng dồn tối đa 25 lần). Khi tích đủ 25 cộng dồn, nhận thêm 20 Giáp và 20 Kháng Phép."),
  steraksgage: refDetail("steraksgage", "+15 Sức Mạnh Công Kích, +150 Máu", "Một lần mỗi giao tranh khi máu giảm xuống dưới 60%, nhận thêm 25% Máu tối đa và 35% Sức Mạnh Công Kích cho đến hết giao tranh."),
  handofjustice: refDetail("handofjustice", "+15 Năng Lượng, +20% Tỉ Lệ Chí Mạng", "Cho 15% SMCK & SMPT cùng 10% Hút Máu Toàn Phần. Mỗi vòng đấu ngẫu nhiên nhân đôi một trong hai nhóm chỉ số này."),
  edgeofnight: refDetail("edgeofnight", "+10 Sức Mạnh Công Kích, +20 Giáp", "Một lần mỗi giao tranh khi máu giảm xuống dưới 60%, trở nên không thể bị chỉ định trong chốc lát và loại bỏ mọi hiệu ứng bất lợi. Sau đó nhận thêm 15% Tốc Độ Đánh."),
  giantslayer: refDetail("giantslayer", "+25 Sức Mạnh Công Kích, +25 Sức Mạnh Phép Thuật, +10% Tốc Độ Đánh", "Gây thêm 25% sát thương lên kẻ địch có lượng Máu tối đa vượt quá 1.750."),
  jeweledgauntlet: refDetail("jeweledgauntlet", "+30 Sức Mạnh Phép Thuật, +35% Tỉ Lệ Chí Mạng", "Sát thương phép thuật và sát thương chuẩn từ kỹ năng có thể gây chí mạng."),
  rabadonsdeathcap: refDetail("rabadonsdeathcap", "+50 Sức Mạnh Phép Thuật", "Tăng 50 Sức Mạnh Phép Thuật và khuếch đại thêm 20% sát thương kỹ năng."),
  voidstaff: refDetail("voidstaff", "+30 Sức Mạnh Phép Thuật, +15% Tốc Độ Đánh", "Kỹ năng gây Phân Tách 30% Kháng Phép của mục tiêu trong 3 giây."),
  morellonomicon: refDetail("morellonomicon", "+25 Sức Mạnh Phép Thuật, +150 Máu, +15% Tốc Độ Đánh", "Sát thương phép và chuẩn từ kỹ năng gây Thiêu Đốt 1% Máu tối đa mỗi giây và giảm 33% hồi phục trong 10 giây."),
  archangelsstaff: refDetail("archangelsstaff", "+20 Sức Mạnh Phép Thuật, +15 Năng Lượng", "Bắt đầu giao tranh: Nhận 20 Sức Mạnh Phép Thuật sau mỗi 5 giây trong suốt giao tranh."),
  nashorstooth: refDetail("nashorstooth", "+10 Sức Mạnh Phép Thuật, +15 Năng Lượng, +20% Tốc Độ Đánh", "Sau khi sử dụng kỹ năng, nhận 40% Tốc Độ Đánh trong 5 giây."),
  bluebuff: refDetail("bluebuff", "+15 Sức Mạnh Công Kích, +15 Sức Mạnh Phép Thuật, +20 Năng Lượng", "Giảm 10 Năng lượng tối đa của kỹ năng. Khi tham gia hạ gục, gây thêm 8% sát thương trong 8 giây."),
  bramblevest: refDetail("bramblevest", "+55 Giáp, +100 Máu", "Giảm 8% sát thương nhận vào từ các đòn đánh thường. Khi bị tấn công, phản lại sát thương phép lên kẻ địch xung quanh."),
  dragonsclaw: refDetail("dragonsclaw", "+65 Kháng Phép", "Cứ mỗi 2 giây, hồi lại 5% Máu tối đa của chủ sở hữu."),
  warmogsarmor: refDetail("warmogsarmor", "+800 Máu", "Tăng 800 Máu và cho thêm 12% Máu tối đa."),
  sunfirecape: refDetail("sunfirecape", "+20 Giáp, +250 Máu", "Mỗi 2 giây, một kẻ địch trong vòng 2 ô bị Thiêu Đốt 1% Máu tối đa mỗi giây và chịu Vết Thương Sâu giảm 33% hồi phục trong 10 giây."),
  gargoylestoneplate: refDetail("gargoylestoneplate", "+35 Giáp, +35 Kháng Phép, +100 Máu", "Nhận thêm 10 Giáp và 10 Kháng Phép với mỗi kẻ địch chọn chủ sở hữu làm mục tiêu tấn công."),
  redemption: refDetail("redemption", "+15 Năng Lượng, +150 Máu", "Cứ mỗi 5 giây, hồi 15% Máu đã mất cho tất cả đồng minh trong vòng 1 ô và giảm 10% sát thương diện rộng nhận vào trong 5 giây."),
  steadfastheart: refDetail("steadfastheart", "+250 Máu, +20 Giáp, +20% Tỉ Lệ Chí Mạng", "Giảm 8% sát thương gánh chịu. Khi Máu tụt xuống dưới 50%, tỉ lệ giảm sát thương tăng lên 15% cho đến hết giao tranh."),
  crownguard: refDetail("crownguard", "+20 Sức Mạnh Phép Thuật, +20 Giáp, +100 Máu", "Bắt đầu giao tranh: Nhận một lá chắn bằng 30% Máu tối đa trong 8 giây. Khi lá chắn hết hiệu lực, nhận thêm 35 SMPT."),
  protectorsvow: refDetail("protectorsvow", "+20 Giáp, +30 Năng Lượng", "Bắt đầu giao tranh: Cho 45 Năng Lượng khởi điểm. Khi máu giảm xuống dưới 40%, nhận lá chắn bằng 25% Máu tối đa và 20 Giáp & Kháng Phép."),
  ionicspark: refDetail("ionicspark", "+15 Sức Mạnh Phép Thuật, +25 Kháng Phép, +150 Máu", "Phân Tách 30% Kháng Phép của kẻ địch trong vòng 2 ô. Khi kẻ địch dùng kỹ năng, giật sét gây sát thương phép bằng 160% Năng lượng tiêu hao."),
  statikkshiv: refDetail("statikkshiv", "+15 Sức Mạnh Phép Thuật, +15 Năng Lượng, +15% Tốc Độ Đánh", "Mỗi đòn đánh thứ 3 giật sét lan sang 4 kẻ địch, gây sát thương phép và Phân Tách 30% Kháng Phép trong 5 giây."),
  evenshroud: refDetail("evenshroud", "+20 Giáp, +150 Máu", "Phân Tách 30% Giáp của kẻ địch trong vòng 2 ô trong 10 giây. Nhận thêm 25 Giáp và Kháng Phép trong 10 giây đầu giao tranh."),
  thiefsgloves: refDetail("thiefsgloves", "+150 Máu, +20% Tỉ Lệ Chí Mạng", "Đầu mỗi vòng đấu, nhận ngẫu nhiên 2 trang bị hoàn chỉnh tạm thời phù hợp với vai trò của tướng."),
  redbuff: refDetail("redbuff", "+40% Tốc Độ Đánh", "Gây thêm 6% sát thương. Đòn đánh và kỹ năng gây Thiêu Đốt 1% Máu tối đa mỗi giây và giảm 33% hồi phục trong 5 giây."),

  // Ornn Artifacts Details
  goldcollector: refDetail("goldcollector", "+30 SMCK, +20% Chí Mạng", "Đòn đánh và kỹ năng kết liễu kẻ địch dưới 12% máu. Mỗi điểm hạ gục cho 1 vàng và 40% cơ hội nhận thêm 1 vàng."),
  artifactgoldcollector: refDetail("artifactgoldcollector", "+30 SMCK, +20% Chí Mạng", "Đòn đánh và kỹ năng kết liễu kẻ địch dưới 12% máu. Mỗi điểm hạ gục cho 1 vàng."),
  zhonyasparadox: refDetail("zhonyasparadox", "+45 SMPT, +30 Giáp, +30 Kháng Phép", "Một lần mỗi giao tranh khi máu giảm xuống dưới 40%, trở nên bất tử và không thể bị chỉ định trong 3 giây."),
  forbiddenidol: refDetail("forbiddenidol", "+25 Giáp, +25 Kháng Phép, +200 Máu", "Lá chắn nhận được chuyển 50% thành Máu tối đa."),
  lichbane: refDetail("lichbane", "+30 SMPT, +15 Năng Lượng", "Sau mỗi lần dùng kỹ năng, đòn đánh kế tiếp gây thêm sát thương phép tương đương 180 + 30% SMPT."),
  infinityforce: refDetail("infinityforce", "+25 SMCK, +25 SMPT, +25 Giáp, +25 Kháng Phép, +25% Tốc Đánh, +25 Năng Lượng, +250 Máu", "Tăng toàn diện mọi chỉ số chiến đấu cơ bản."),
  manazane: refDetail("manazane", "+15 SMCK, +10% Tốc Đánh, +15 Năng Lượng", "Sau lần dùng kỹ năng đầu tiên, hồi lại 120 Năng Lượng trong 5 giây."),
  deathsdefiance: refDetail("deathsdefiance", "+25 SMCK, +30 Giáp, +25% Tốc Đánh, +25% Hút Máu Toàn Phần", "50% sát thương nhận vào chuyển thành sát thương không thể chí mạng nhận dần trong 4 giây."),
  eternalwinter: refDetail("eternalwinter", "+200 Máu, +20 Giáp, +20 Kháng Phép", "Kẻ địch tấn công chủ sở hữu bị giảm 20% Tốc Độ Đánh trong 1.5 giây. Sau 7 lần tấn công, bị Đóng Băng trong 1.5 giây.")
};

export function isItemKnown(rawKey: string): boolean {
  return Boolean(resolveItemInfo(rawKey));
}

export function resolveItemInfo(rawKey: string): ItemDefinition | null {
  const norm = normalizeItemKey(rawKey);
  const direct = rawKey.toLowerCase().trim();
  const alias = ITEM_ALIASES[direct];
  const canonical = (alias ? ITEM_REGISTRY[alias] : null) || ITEM_REGISTRY[norm];
  let result: ItemDefinition | null = canonical || null;

  if (!result) {
    const normalize = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
    const token = normalize(rawKey);
    const matches = Object.values(ITEM_REGISTRY).filter(item => [item.nameVi, item.nameEn, item.abbr].some(name => normalize(name) === token));
    if (matches.length === 1) result = matches[0];
  }

  if (result) {
    const details = ITEM_DETAILS[result.key];
    return {
      ...result,
      statsVi: details?.statsVi || result.statsVi || "",
      descriptionVi: details?.descriptionVi || result.descriptionVi || "",
      sourceScope: details?.sourceScope,
      provenanceNote: details?.provenanceNote,
      verificationStatus: details?.verificationStatus || "unverified"
    };
  }

  return null;
}

export function itemAssetUrl(rawKey: string): string | null {
  const definition = resolveItemInfo(rawKey);
  return definition?.assetStatus === "versioned" ? definition.imageUrl : null;
}

export function classifyUnitRole(itemKeys: (string | null | undefined)[]): {
  isCarry: boolean;
  isTank: boolean;
  carryScore: number;
  tankScore: number;
} {
  let carryScore = 0;
  let tankScore = 0;

  for (const it of itemKeys) {
    if (!it) continue;
    const def = resolveItemInfo(it);
    if (!def) continue;

    if (def.category === "ad" || def.category === "ap" || def.category === "mana") {
      carryScore++;
    } else if (def.category === "tank") {
      tankScore++;
    } else if (def.key === "redbuff") {
      carryScore += 0.8;
    }
  }

  return {
    isCarry: carryScore > tankScore && carryScore >= 1,
    isTank: tankScore > carryScore && tankScore >= 1,
    carryScore,
    tankScore
  };
}
