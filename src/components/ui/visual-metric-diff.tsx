"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus, Shield, Swords, Zap, Heart, Wind, Crosshair } from "lucide-react";

export type MetricChangeType = "buff" | "nerf" | "neutral" | "adjust";

export interface MetricDiffProps {
  label: string;
  fromValue: number | string;
  toValue: number | string;
  unit?: string;
  changeType?: MetricChangeType;
  maxScale?: number;
  showBar?: boolean;
}

export function VisualMetricDiffRow({
  label,
  fromValue,
  toValue,
  unit = "",
  changeType,
  maxScale = 1000,
  showBar = true
}: MetricDiffProps) {
  const fromNum = typeof fromValue === "number" ? fromValue : parseFloat(fromValue);
  const toNum = typeof toValue === "number" ? toValue : parseFloat(toValue);
  const isNumeric = !isNaN(fromNum) && !isNaN(toNum);

  let deltaNum = 0;
  let percentChange = 0;
  let computedType: MetricChangeType = changeType || "neutral";

  if (isNumeric) {
    deltaNum = toNum - fromNum;
    percentChange = fromNum !== 0 ? (deltaNum / Math.abs(fromNum)) * 100 : 0;
    if (!changeType) {
      if (deltaNum > 0) computedType = "buff";
      else if (deltaNum < 0) computedType = "nerf";
      else computedType = "neutral";
    }
  }

  const typeConfig: Record<
    MetricChangeType,
    {
      badgeBg: string;
      badgeText: string;
      badgeBorder: string;
      barColor: string;
      icon: React.ReactNode;
      prefix: string;
    }
  > = {
    buff: {
      badgeBg: "bg-emerald-500/15",
      badgeText: "text-emerald-400",
      badgeBorder: "border-emerald-500/30",
      barColor: "bg-emerald-400",
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      prefix: "+"
    },
    nerf: {
      badgeBg: "bg-rose-500/15",
      badgeText: "text-rose-400",
      badgeBorder: "border-rose-500/30",
      barColor: "bg-rose-400",
      icon: <ArrowDownRight className="w-3.5 h-3.5" />,
      prefix: ""
    },
    adjust: {
      badgeBg: "bg-amber-500/15",
      badgeText: "text-amber-400",
      badgeBorder: "border-amber-500/30",
      barColor: "bg-amber-400",
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      prefix: deltaNum > 0 ? "+" : ""
    },
    neutral: {
      badgeBg: "bg-slate-500/15",
      badgeText: "text-slate-400",
      badgeBorder: "border-slate-500/30",
      barColor: "bg-slate-400",
      icon: <Minus className="w-3.5 h-3.5" />,
      prefix: ""
    }
  };

  const style = typeConfig[computedType];
  const fromPercent = isNumeric ? Math.min(100, Math.max(0, (fromNum / maxScale) * 100)) : 0;
  const toPercent = isNumeric ? Math.min(100, Math.max(0, (toNum / maxScale) * 100)) : 0;

  return (
    <div className="p-3 rounded-xl bg-[#121420]/80 border border-white/[0.06] hover:border-white/[0.12] transition-colors space-y-2">
      {/* Metric Header: Label & Transition Numbers */}
      <div className="flex items-center justify-between text-xs gap-2">
        <span className="text-slate-300 font-medium">{label}</span>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-slate-400 line-through">
            {fromValue}
            {unit}
          </span>
          <span className="text-slate-500">➔</span>
          <span className="text-white font-bold text-sm">
            {toValue}
            {unit}
          </span>
          {/* Delta Pill */}
          {isNumeric && deltaNum !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold border ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
            >
              {style.icon}
              <span>
                {style.prefix}
                {Number(deltaNum.toFixed(1))}
              </span>
              <span className="text-[9px] opacity-80">({percentChange > 0 ? `+${percentChange.toFixed(1)}%` : `${percentChange.toFixed(1)}%`})</span>
            </span>
          )}
        </div>
      </div>

      {/* Progress Comparison Gauge */}
      {showBar && isNumeric && (
        <div className="space-y-1">
          <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden relative">
            {/* Ghost Baseline */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-slate-600/50 rounded-full"
              style={{ width: `${fromPercent}%` }}
            />
            {/* New Value Gauge */}
            <div
              className={`absolute top-0 bottom-0 left-0 ${style.barColor} rounded-full transition-all duration-500`}
              style={{ width: `${toPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export interface MetricGroupProps {
  title: string;
  category: "defense" | "offense" | "energy" | "utility";
  children: React.ReactNode;
  className?: string;
}

const categoryIcons = {
  defense: <Shield className="w-4 h-4 text-emerald-400" />,
  offense: <Swords className="w-4 h-4 text-amber-400" />,
  energy: <Zap className="w-4 h-4 text-cyan-400" />,
  utility: <Crosshair className="w-4 h-4 text-purple-400" />
};

export function MetricGroup({ title, category, children, className = "" }: MetricGroupProps) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
        <span className="p-1 rounded-md bg-white/[0.05] border border-white/[0.08]">
          {categoryIcons[category]}
        </span>
        <span>{title}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">{children}</div>
    </div>
  );
}
