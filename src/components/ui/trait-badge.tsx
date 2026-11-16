"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export type TraitTier = "none" | "bronze" | "silver" | "gold" | "prismatic";

export interface TraitBadgeProps {
  name: string;
  nameEn?: string;
  count?: number;
  tier?: TraitTier;
  icon?: string;
  size?: "sm" | "md";
  className?: string;
}

const tierConfig: Record<
  TraitTier,
  {
    bg: string;
    border: string;
    text: string;
    diamondBg: string;
  }
> = {
  none: {
    bg: "bg-white/[0.04]",
    border: "border-white/[0.08]",
    text: "text-slate-400",
    diamondBg: "bg-slate-600"
  },
  bronze: {
    bg: "bg-amber-950/40",
    border: "border-amber-800/50",
    text: "text-amber-300",
    diamondBg: "bg-amber-700"
  },
  silver: {
    bg: "bg-slate-700/40",
    border: "border-slate-400/50",
    text: "text-slate-200",
    diamondBg: "bg-slate-300"
  },
  gold: {
    bg: "bg-yellow-500/15",
    border: "border-yellow-400/50",
    text: "text-yellow-300",
    diamondBg: "bg-yellow-400"
  },
  prismatic: {
    bg: "bg-purple-500/20",
    border: "border-purple-400/60",
    text: "text-purple-200",
    diamondBg: "bg-gradient-to-tr from-purple-400 via-pink-400 to-cyan-400"
  }
};

export function TraitBadge({
  name,
  nameEn,
  count,
  tier = "none",
  icon,
  size = "md",
  className = ""
}: TraitBadgeProps) {
  const config = tierConfig[tier] || tierConfig.none;
  const isSm = size === "sm";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border backdrop-blur-md transition-colors ${config.bg} ${config.border} ${
        isSm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${className}`}
      title={nameEn && nameEn !== name ? `${name} (${nameEn})` : name}
    >
      {/* Trait Icon or Diamond */}
      {icon ? (
        <img src={icon} alt="" className={`${isSm ? "w-3 h-3" : "w-3.5 h-3.5"} object-contain`} />
      ) : (
        <span
          className={`w-2 h-2 rotate-45 rounded-[1px] shrink-0 shadow-sm ${config.diamondBg}`}
        />
      )}

      {/* Trait Name */}
      <span className={`font-semibold ${config.text} whitespace-nowrap`}>{name}</span>

      {/* Active Count */}
      {count !== undefined && (
        <span className="font-mono text-[10px] font-bold px-1 rounded bg-black/40 text-slate-300">
          {count}
        </span>
      )}
    </div>
  );
}
