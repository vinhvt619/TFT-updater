import React from "react";
import { Tier, RankingStatus } from "@/domain/meta/schemas";

interface TierBadgeProps {
  tier: Tier | null;
  candidateTier?: Tier | null;
  status: RankingStatus;
  size?: "sm" | "md" | "lg";
}

export function TierBadge({
  tier,
  candidateTier,
  status,
  size = "md"
}: TierBadgeProps) {
  const displayTier = tier || candidateTier;

  const sizeClasses = {
    sm: "w-7 h-7 text-xs font-bold",
    md: "w-9 h-9 text-sm font-extrabold",
    lg: "w-12 h-12 text-lg font-black"
  };

  if (!tier && status === "collecting") {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg bg-slate-800/80 border border-dashed border-slate-600 text-slate-400 flex items-center justify-center font-medium shadow-inner`}
        title="Đang thu thập dữ liệu - Chưa đủ mẫu để cấp tier"
      >
        ?
      </div>
    );
  }

  if (!tier && status === "provisional") {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg bg-amber-950/40 border border-amber-500/50 text-amber-300 flex items-center justify-center relative shadow-sm`}
        title={`Tạm thời: Ứng viên bậc ${candidateTier || "?"} (Chưa đủ điều kiện chất lượng)`}
      >
        <span>{candidateTier || "P"}</span>
        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-slate-900" />
      </div>
    );
  }

  const tierStyles: Record<string, string> = {
    S: "bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 border-amber-300 shadow-amber-500/20",
    A: "bg-gradient-to-br from-purple-500 to-indigo-700 text-white border-purple-400 shadow-purple-500/20",
    B: "bg-gradient-to-br from-blue-500 to-cyan-700 text-white border-blue-400 shadow-blue-500/20",
    C: "bg-gradient-to-br from-slate-600 to-slate-800 text-slate-200 border-slate-500 shadow-slate-700/20"
  };

  const currentStyle = tier
    ? tierStyles[tier] || tierStyles.C
    : "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <div
      className={`${sizeClasses[size]} rounded-lg border flex items-center justify-center shadow-md transition-transform transform group-hover:scale-105 ${currentStyle}`}
      title={`Bậc ${tier || "Chưa xếp hạng"}`}
    >
      {tier || "?"}
    </div>
  );
}

export function ConditionBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60 shadow-sm">
      {text}
    </span>
  );
}
