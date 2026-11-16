"use client";

import React from "react";
import { Tier, RankingStatus } from "@/domain/meta/schemas";

export interface TierBadgeProps {
  tier: Tier | null;
  candidateTier?: Tier | null;
  status?: RankingStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-7 h-7 text-xs font-black rounded-lg",
  md: "w-9 h-9 text-sm font-black rounded-xl",
  lg: "w-12 h-12 text-lg font-black rounded-2xl"
};

const tierStyles: Record<string, string> = {
  S: "bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-slate-950 border-amber-200/80 shadow-md shadow-amber-500/30",
  A: "bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600 text-white border-purple-300/80 shadow-md shadow-purple-500/25",
  B: "bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600 text-slate-950 border-cyan-300/80 shadow-md shadow-cyan-500/25",
  C: "bg-gradient-to-br from-slate-500 to-slate-700 text-slate-100 border-slate-400/60 shadow-md shadow-black/40",
  D: "bg-gradient-to-br from-zinc-700 to-zinc-900 text-slate-300 border-zinc-600 shadow-md shadow-black/40"
};

export function TierBadge({
  tier,
  candidateTier,
  status = "ranked",
  size = "md",
  className = ""
}: TierBadgeProps) {
  if (!tier && status === "collecting") {
    return (
      <div
        className={`${sizeClasses[size]} bg-[#121420] border border-dashed border-slate-600 text-slate-400 flex items-center justify-center font-bold shadow-inner ${className}`}
        title="Đang thu thập dữ liệu — Chưa đủ mẫu để cấp bậc"
      >
        ?
      </div>
    );
  }

  if (!tier && status === "provisional") {
    return (
      <div
        className={`${sizeClasses[size]} bg-amber-950/40 border border-amber-500/50 text-amber-300 flex items-center justify-center relative shadow-sm ${className}`}
        title={`Tạm thời: Ứng viên bậc ${candidateTier || "?"} (Chưa đủ điều kiện chất lượng)`}
      >
        <span>{candidateTier || "P"}</span>
        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-950" />
      </div>
    );
  }

  const currentStyle = tier
    ? tierStyles[tier] || tierStyles.C
    : "bg-[#161825] text-slate-400 border-slate-700";

  return (
    <div
      className={`${sizeClasses[size]} border flex items-center justify-center select-none transition-transform hover:scale-105 ${currentStyle} ${className}`}
      title={`Bậc ${tier || "Chưa xếp hạng"}`}
    >
      {tier || "?"}
    </div>
  );
}
