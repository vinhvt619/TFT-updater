"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, RefreshCw, SlidersHorizontal, Minus } from "lucide-react";

export type ImpactType = "buff" | "nerf" | "mixed" | "rework" | "neutral" | "adjust";

export interface ImpactChipProps {
  type: ImpactType;
  label?: string;
  count?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const impactConfig: Record<
  ImpactType,
  {
    bg: string;
    border: string;
    text: string;
    icon: React.ReactNode;
    defaultLabel: string;
  }
> = {
  buff: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    icon: <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />,
    defaultLabel: "Tăng sức mạnh"
  },
  nerf: {
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
    text: "text-rose-400",
    icon: <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />,
    defaultLabel: "Giảm sức mạnh"
  },
  mixed: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-400",
    icon: <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />,
    defaultLabel: "Điều chỉnh"
  },
  adjust: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-400",
    icon: <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />,
    defaultLabel: "Điều chỉnh"
  },
  rework: {
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
    text: "text-purple-300",
    icon: <RefreshCw className="w-3.5 h-3.5 shrink-0" />,
    defaultLabel: "Đổi cơ chế"
  },
  neutral: {
    bg: "bg-slate-500/15",
    border: "border-slate-500/30",
    text: "text-slate-400",
    icon: <Minus className="w-3.5 h-3.5 shrink-0" />,
    defaultLabel: "Không đổi"
  }
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
  lg: "px-3.5 py-1.5 text-sm gap-2"
};

export function ImpactChip({
  type,
  label,
  count,
  size = "md",
  className = ""
}: ImpactChipProps) {
  const config = impactConfig[type] || impactConfig.neutral;
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center font-bold rounded-lg border ${config.bg} ${config.border} ${config.text} ${sizeClasses[size]} ${className}`}
    >
      {config.icon}
      <span>{displayLabel}</span>
      {count !== undefined && (
        <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
          {count}
        </span>
      )}
    </span>
  );
}
