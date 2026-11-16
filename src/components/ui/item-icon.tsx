"use client";

import React, { useState } from "react";
import { resolveItemInfo } from "@/domain/meta/item-registry";
import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "@/domain/meta/asset-manifest";
import { Shield, Swords, Sparkles, Zap, Crosshair } from "lucide-react";

export interface ItemIconProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "w-6 h-6 text-[9px] rounded-md",
  md: "w-8 h-8 text-[11px] rounded-lg",
  lg: "w-11 h-11 text-xs rounded-xl",
  xl: "w-14 h-14 text-sm rounded-2xl"
};

const categoryTheme = {
  ad: { border: "border-amber-500/40", glow: "shadow-amber-500/10", icon: Swords, text: "text-amber-400" },
  ap: { border: "border-purple-500/40", glow: "shadow-purple-500/10", icon: Sparkles, text: "text-purple-400" },
  tank: { border: "border-emerald-500/40", glow: "shadow-emerald-500/10", icon: Shield, text: "text-emerald-400" },
  mana: { border: "border-cyan-500/40", glow: "shadow-cyan-500/10", icon: Zap, text: "text-cyan-400" },
  utility: { border: "border-slate-500/40", glow: "shadow-slate-500/10", icon: Crosshair, text: "text-slate-400" }
};

export function ItemIcon({
  name,
  size = "md",
  showLabel = false,
  showTooltip = true,
  className = ""
}: ItemIconProps) {
  const [imgError, setImgError] = useState(false);
  React.useEffect(() => setImgError(false), [name]);
  const itemInfo = resolveItemInfo(name);

  const displayName = itemInfo?.nameVi || name;
  const category = itemInfo?.category || "utility";
  const theme = categoryTheme[category] || categoryTheme.utility;
  const itemType = itemInfo?.itemType || "completed";

  const typeBorder =
    itemType === "ornn"
      ? "border-amber-400/80 shadow-amber-500/20 ring-1 ring-amber-400/40"
      : itemType === "emblem"
      ? "border-purple-400/80 shadow-purple-500/20 ring-1 ring-purple-400/40"
      : itemType === "component"
      ? "border-slate-600/70"
      : `${theme.border} ${theme.glow}`;

  const rawUrl = itemInfo?.imageUrl;
  const resolvedUrl = rawUrl?.replace(
    /raw\.communitydragon\.org\/[^/]+\//i,
    `raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/`
  );

  const initials = itemInfo?.abbr || (displayName ? displayName.slice(0, 2).toUpperCase() : "??");

  const tooltipText = showTooltip
    ? `${displayName} (${itemInfo?.nameEn || name})${
        itemType === "ornn"
          ? " [Tạo Tác Ornn]"
          : itemType === "emblem"
          ? " [Ấn Tộc Hệ]"
          : itemType === "component"
          ? " [Thành Phần]"
          : ""
      }`
    : undefined;

  const iconElement = (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#121420] border ${typeBorder} shadow-sm ${sizeMap[size]} ${className}`}
      title={tooltipText}
    >
      {resolvedUrl && !imgError ? (
        <img
          src={resolvedUrl}
          alt={displayName}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-bold text-slate-300 bg-gradient-to-br from-slate-800 to-slate-950">
          {initials}
        </div>
      )}
    </div>
  );

  if (!showLabel) return iconElement;

  return (
    <div className="inline-flex items-center gap-2">
      {iconElement}
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-200 truncate">{displayName}</p>
        {itemInfo?.nameEn && itemInfo.nameEn !== displayName && (
          <p className="text-[10px] text-slate-400 truncate">{itemInfo.nameEn}</p>
        )}
      </div>
    </div>
  );
}
