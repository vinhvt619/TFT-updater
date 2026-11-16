"use client";

import React, { useEffect, useState } from "react";
import { getChampionImageUrl } from "@/components/meta/champion-image";
import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "@/domain/meta/asset-manifest";

export interface ChampionAvatarProps {
  icon: string | null;
  name: string;
  cost?: number | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  starLevel?: number | null;
  className?: string;
}

const sizeClasses = {
  xs: "w-7 h-7 text-[8px] rounded-md",
  sm: "w-9 h-9 text-[10px] rounded-md",
  md: "w-11 h-11 text-xs rounded-lg",
  lg: "w-14 h-14 text-sm rounded-lg",
  xl: "w-20 h-20 text-base rounded-xl"
};

const costColors: Record<
  number,
  { border: string; badge: string; gradient: string; glow: string }
> = {
  1: {
    border: "border-[#808080]",
    badge: "bg-[#808080] text-white",
    gradient: "from-slate-700 to-slate-900",
    glow: "shadow-slate-500/10"
  },
  2: {
    border: "border-[#11b288]",
    badge: "bg-[#11b288] text-white",
    gradient: "from-emerald-900 to-slate-900",
    glow: "shadow-emerald-500/20"
  },
  3: {
    border: "border-[#207ac7]",
    badge: "bg-[#207ac7] text-white",
    gradient: "from-sky-900 to-slate-900",
    glow: "shadow-cyan-500/20"
  },
  4: {
    border: "border-[#c440df]",
    badge: "bg-[#c440df] text-white",
    gradient: "from-purple-900 to-slate-900",
    glow: "shadow-purple-500/20"
  },
  5: {
    border: "border-[#ffb93b]",
    badge: "bg-[#ffb93b] text-slate-950 font-bold",
    gradient: "from-amber-900 to-slate-900",
    glow: "shadow-amber-500/30"
  }
};

export function ChampionAvatar({
  icon,
  name,
  cost = null,
  size = "md",
  starLevel = null,
  className = ""
}: ChampionAvatarProps) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [icon, name]);

  const initials = name ? name.trim().slice(0, 2).toUpperCase() : "??";
  const costStyle = cost ? costColors[cost] || costColors[1] : costColors[1];

  const hasValidUrl =
    icon &&
    typeof icon === "string" &&
    icon.trim() !== "" &&
    !icon.toLowerCase().includes("none") &&
    !icon.startsWith("{");
  const resolvedIcon = (hasValidUrl ? icon : getChampionImageUrl(name, name))
    ?.replace(/raw\.communitydragon\.org\/[^/]+\//i, `raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/`);

  return (
    <div
      className={`relative overflow-hidden flex-shrink-0 border-2 ${costStyle.border} bg-[#10141f] select-none shadow-md ${costStyle.glow} ${sizeClasses[size]} ${className}`}
    >
      {resolvedIcon && !imgError ? (
        <img
          src={resolvedIcon}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-black text-slate-300 bg-gradient-to-br ${costStyle.gradient}`}
        >
          {initials}
        </div>
      )}

      {/* Star level indicator (MetaTFT / TFTAcademy style) */}
      {starLevel && starLevel > 1 && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-center bg-black/60 py-[1px] leading-none">
          <span className="text-[9px] text-amber-300 font-black tracking-tighter drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
            {starLevel === 3 ? "★★★" : "★★"}
          </span>
        </div>
      )}

      {cost !== null && cost !== undefined && (
        <span
          className={`absolute bottom-0 right-0 font-black text-[9px] px-1 py-0.2 rounded-tl leading-tight ${costStyle.badge}`}
        >
          {cost}
        </span>
      )}
    </div>
  );
}
