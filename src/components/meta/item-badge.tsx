"use client";

import React from "react";
import { Swords, Shield, Sparkles, Zap, Star } from "lucide-react";
import { ITEM_REGISTRY, resolveItemInfo } from "@/domain/meta/item-registry";
import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "@/domain/meta/asset-manifest";

export interface ItemInfo {
  nameEn: string;
  nameVi: string;
  shortVi: string;
  abbr: string;
  category: "ad" | "ap" | "tank" | "mana" | "utility";
  imageUrl?: string;
  descriptionVi?: string;
  statsVi?: string;
  verificationStatus?: "verified" | "unverified";
}

export const TFT_ITEMS: Record<string, ItemInfo> = {
  "Guinsoo's Rageblade": {
    nameEn: "Guinsoo's Rageblade",
    nameVi: "Cuồng Đao Guinsoo",
    shortVi: "Cuồng Đao",
    abbr: "GR",
    category: "ad"
  },
  "Infinity Edge": {
    nameEn: "Infinity Edge",
    nameVi: "Vô Cực Kiếm",
    shortVi: "Vô Cực",
    abbr: "IE",
    category: "ad"
  },
  "Bloodthirster": {
    nameEn: "Bloodthirster",
    nameVi: "Huyết Kiếm",
    shortVi: "Huyết Kiếm",
    abbr: "BT",
    category: "ad"
  },
  "Last Whisper": {
    nameEn: "Last Whisper",
    nameVi: "Cung Xanh",
    shortVi: "Cung Xanh",
    abbr: "LW",
    category: "ad"
  },
  "Deathblade": {
    nameEn: "Deathblade",
    nameVi: "Kiếm Tử Thần",
    shortVi: "Kiếm Tử Thần",
    abbr: "DB",
    category: "ad"
  },
  "Runaan's Hurricane": {
    nameEn: "Runaan's Hurricane",
    nameVi: "Cuồng Cung Runaan",
    shortVi: "Cuồng Cung",
    abbr: "RH",
    category: "ad"
  },
  "Giant Slayer": {
    nameEn: "Giant Slayer",
    nameVi: "Diệt Khổng Lồ",
    shortVi: "Diệt Khổng Lồ",
    abbr: "GS",
    category: "ad"
  },
  "Edge of Night": {
    nameEn: "Edge of Night",
    nameVi: "Áo Choàng Bóng Tối",
    shortVi: "Áo Choàng Tối",
    abbr: "EoN",
    category: "ad"
  },
  "Titan's Resolve": {
    nameEn: "Titan's Resolve",
    nameVi: "Quyền Năng Khổng Lồ",
    shortVi: "Quyền Năng",
    abbr: "TR",
    category: "ad"
  },
  "Sterak's Gage": {
    nameEn: "Sterak's Gage",
    nameVi: "Móng Vuốt Sterak",
    shortVi: "Móng Vuốt",
    abbr: "SG",
    category: "ad"
  },
  "Hand of Justice": {
    nameEn: "Hand of Justice",
    nameVi: "Bàn Tay Công Lý",
    shortVi: "Bàn Tay",
    abbr: "HoJ",
    category: "ad"
  },
  "Blue Buff": {
    nameEn: "Blue Buff",
    nameVi: "Bùa Xanh",
    shortVi: "Bùa Xanh",
    abbr: "BB",
    category: "mana"
  },
  "Spear of Shojin": {
    nameEn: "Spear of Shojin",
    nameVi: "Ngọn Giáo Shojin",
    shortVi: "Shojin",
    abbr: "SoS",
    category: "mana"
  },
  "Jeweled Gauntlet": {
    nameEn: "Jeweled Gauntlet",
    nameVi: "Găng Bảo Thạch",
    shortVi: "Găng Bảo Thạch",
    abbr: "JG",
    category: "ap"
  },
  "Rabadon's Deathcap": {
    nameEn: "Rabadon's Deathcap",
    nameVi: "Mũ Phù Thủy Rabadon",
    shortVi: "Mũ Phù Thủy",
    abbr: "DC",
    category: "ap"
  },
  "Morellonomicon": {
    nameEn: "Morellonomicon",
    nameVi: "Quỷ Thư Morello",
    shortVi: "Quỷ Thư",
    abbr: "Morello",
    category: "ap"
  },
  "Ionic Spark": {
    nameEn: "Ionic Spark",
    nameVi: "Nỏ Sét",
    shortVi: "Nỏ Sét",
    abbr: "IS",
    category: "ap"
  },
  "Sunfire Cape": {
    nameEn: "Sunfire Cape",
    nameVi: "Giáp Lửa / Áo Choàng Lửa",
    shortVi: "Giáp Lửa",
    abbr: "SC",
    category: "tank"
  },
  "Warmog's Armor": {
    nameEn: "Warmog's Armor",
    nameVi: "Giáp Máu Warmog",
    shortVi: "Giáp Máu",
    abbr: "WA",
    category: "tank"
  },
  "Dragon's Claw": {
    nameEn: "Dragon's Claw",
    nameVi: "Vuốt Rồng",
    shortVi: "Vuốt Rồng",
    abbr: "DClaw",
    category: "tank"
  },
  "Bramble Vest": {
    nameEn: "Bramble Vest",
    nameVi: "Giáp Gai / Áo Choàng Gai",
    shortVi: "Giáp Gai",
    abbr: "BV",
    category: "tank"
  },
  "Gargoyle Stoneplate": {
    nameEn: "Gargoyle Stoneplate",
    nameVi: "Thú Tượng Thạch Giáp",
    shortVi: "Thú Tượng",
    abbr: "Gargoyle",
    category: "tank"
  },
  "Redemption": {
    nameEn: "Redemption",
    nameVi: "Dây Chuyền Chuộc Tội",
    shortVi: "Chuộc Tội",
    abbr: "Redemp",
    category: "tank"
  },
  "Steadfast Heart": {
    nameEn: "Steadfast Heart",
    nameVi: "Trái Tim Kiên Định",
    shortVi: "Trái Tim",
    abbr: "Heart",
    category: "tank"
  }
};

/** Versioned CommunityDragon assets indexed by the source-proven item name. */
export const TFT_ITEM_IMAGE_URLS: Record<string, string> = Object.fromEntries(
  Object.values(ITEM_REGISTRY).map((item) => [item.nameEn, item.imageUrl])
);

/** Đường dẫn đã kiểm chứng cho các biến thể Rạng Ngời xuất hiện trong ghi chú
 * Riot. Không dùng ảnh item thường khi nguồn đang nói tới biến thể Rạng Ngời. */
const RADIANT_ITEM_IMAGE_URLS: Record<string, string> = {
  bloodthirster: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft5_item_bloodthirsterradiant.png`,
  edgeofnight: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft5_item_guardianangelradiant.png`,
  handofjustice: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft5_item_handofjusticeradiant.png`,
  guinsoosrageblade: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft5_item_guinsoosragebladeradiant.png`,
  titansresolve: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft5_item_titansresolveradiant.png`,
  steraksgage: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft5_item_steraksgageradiant.png`,
  nashorstooth: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft5_item_leviathanradiant.png`,
  spearofshojin: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft5_item_spearofshojinradiant.png`,
  bluebuff: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft5_item_bluebuffradiant.png`
};

export function getItemInfo(itemName: string): ItemInfo & { imageUrl?: string } {
  if (!itemName) {
    return {
      nameEn: "Unknown",
      nameVi: "Chưa rõ",
      shortVi: "Chưa rõ",
      abbr: "??",
      category: "utility"
    };
  }

  const radiantMatch = itemName.trim().match(/^radiant\s+(.+)$/i);
  if (radiantMatch) {
    const base = resolveItemInfo(radiantMatch[1]);
    if (base) {
      return {
        nameEn: `Radiant ${base.nameEn}`,
        nameVi: `${base.nameVi} bản Rạng Ngời`,
        shortVi: `${base.shortVi} Rạng Ngời`,
        abbr: base.abbr,
        category: base.category,
        imageUrl: RADIANT_ITEM_IMAGE_URLS[base.key],
        statsVi: base.statsVi,
        descriptionVi: base.descriptionVi ? `${base.descriptionVi} (Phiên bản Rạng Ngời với chỉ số vượt trội)` : ""
      };
    }
  }

  // 1. Resolve via canonical item registry
  const resolved = resolveItemInfo(itemName);
  if (resolved) {
    return {
      nameEn: resolved.nameEn,
      nameVi: resolved.nameVi,
      shortVi: resolved.shortVi,
      abbr: resolved.abbr,
      category: resolved.category,
      imageUrl: resolved.imageUrl,
      statsVi: resolved.statsVi,
      descriptionVi: resolved.descriptionVi,
      verificationStatus: resolved.verificationStatus
    };
  }

  // 2. Direct name lookup in TFT_ITEMS
  const direct = TFT_ITEMS[itemName];
  if (direct) {
    const canonical = resolveItemInfo(direct.nameEn);
    return {
      ...direct,
      imageUrl: canonical?.imageUrl,
      statsVi: canonical?.statsVi,
      descriptionVi: canonical?.descriptionVi,
      verificationStatus: canonical?.verificationStatus || "unverified"
    };
  }

  // 3. Clean fallback eliminating raw ID prefixes like TFT_Item_ so it never renders 'TF'
  const cleanName = itemName
    .replace(/^tft\d*_item_/i, "")
    .replace(/^tft_item_/i, "")
    .replace(/^da_item_/i, "")
    .replace(/^item_/i, "")
    .replace(/^tft\d*_/i, "")
    .replace(/^da_/i, "")
    .replace(/_/g, " ");

  const words = cleanName.trim().split(/\s+/);
  const abbr = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : cleanName.slice(0, 2).toUpperCase() || "??";

  return {
    nameEn: cleanName,
    nameVi: cleanName,
    shortVi: cleanName,
    abbr,
    category: "utility"
  };
}

const categoryStyles = {
  ad: {
    bg: "bg-amber-950/80",
    border: "border-amber-500/50",
    text: "text-amber-300",
    glow: "shadow-amber-500/20",
    icon: Swords
  },
  ap: {
    bg: "bg-purple-950/80",
    border: "border-purple-500/50",
    text: "text-purple-300",
    glow: "shadow-purple-500/20",
    icon: Sparkles
  },
  tank: {
    bg: "bg-emerald-950/80",
    border: "border-emerald-500/50",
    text: "text-emerald-300",
    glow: "shadow-emerald-500/20",
    icon: Shield
  },
  mana: {
    bg: "bg-sky-950/80",
    border: "border-sky-500/50",
    text: "text-sky-300",
    glow: "shadow-sky-500/20",
    icon: Zap
  },
  utility: {
    bg: "bg-slate-900/90",
    border: "border-slate-700",
    text: "text-slate-300",
    glow: "shadow-slate-500/10",
    icon: Star
  }
};

/**
 * Chip trang bị thu nhỏ đặt bên dưới avatar tướng
 */
export function ItemMiniChip({
  itemName,
  className = ""
}: {
  itemName: string;
  className?: string;
}) {
  const item = getItemInfo(itemName);
  const style = categoryStyles[item.category] || categoryStyles.utility;
  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => setImgError(false), [item.imageUrl]);

  const disclaimer = item.verificationStatus === "unverified" ? " [Chỉ số tham khảo · Chưa kiểm chứng]" : "";
  const tooltipText = item.statsVi
    ? `${item.nameVi}${disclaimer} (${item.statsVi})\n${item.descriptionVi || ""}`
    : item.nameVi;

  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded overflow-hidden border border-slate-700 shadow-sm transition-transform hover:scale-125 cursor-help bg-slate-950 flex-shrink-0 ${className}`}
      title={tooltipText}
    >
      {item.imageUrl && !imgError ? (
        <img
          src={item.imageUrl}
          alt={item.shortVi}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className={`w-full h-full flex items-center justify-center text-[8px] font-black font-mono uppercase tracking-tighter ${style.bg} ${style.text}`}
        >
          {item.abbr.slice(0, 2)}
        </span>
      )}
    </span>
  );
}

/**
 * Huy hiệu trang bị chi tiết có icon và tên tiếng Việt
 */
export function ItemBadge({
  itemName,
  size = "md"
}: {
  itemName: string;
  size?: "sm" | "md" | "lg";
}) {
  const item = getItemInfo(itemName);
  const style = categoryStyles[item.category] || categoryStyles.utility;
  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => setImgError(false), [item.imageUrl]);
  const disclaimer = item.verificationStatus === "unverified" ? " [Chỉ số tham khảo · Chưa kiểm chứng]" : "";
  const tooltipText = item.statsVi
    ? `${item.nameVi}${disclaimer}\nChỉ số: ${item.statsVi}\n${item.descriptionVi || ""}`
    : item.nameVi;

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${style.bg} ${style.border} ${style.text} shadow-sm cursor-help`}
        title={tooltipText}
      >
        {item.imageUrl && !imgError ? (
          <img
            src={item.imageUrl}
            alt={item.nameVi}
            className="w-4 h-4 rounded object-cover flex-shrink-0 border border-slate-700"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <style.icon className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className="truncate">{item.shortVi}</span>
      </span>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-semibold ${style.bg} ${style.border} ${style.text} shadow-sm cursor-help`}
      title={tooltipText}
    >
      {item.imageUrl && !imgError ? (
        <img
          src={item.imageUrl}
          alt={item.nameVi}
          className="w-7 h-7 rounded-lg object-cover border border-slate-700/80 flex-shrink-0 shadow-sm"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <style.icon className="w-5 h-5 flex-shrink-0" />
      )}
      <div className="flex flex-col min-w-0">
        <span className="font-bold truncate leading-tight text-slate-100">{item.nameVi}</span>
        {item.statsVi && (
          <span className="text-[10px] text-slate-400 truncate leading-tight font-normal">
            {item.statsVi} {item.verificationStatus === "unverified" && <span className="text-amber-400/90 font-medium">(Tham khảo)</span>}
          </span>
        )}
      </div>
    </div>
  );
}
