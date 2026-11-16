"use client";

import React, { useState } from "react";
import Link from "next/link";
import { getChampionImageUrl } from "@/components/meta/champion-image";
import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "@/domain/meta/asset-manifest";

export interface ChampionPortraitTrait {
  name: string;
  color?: string;
  icon?: string;
}

export interface ChampionPortraitStats {
  hp?: number;
  maxHp?: number;
  ad?: number;
  maxAd?: number;
  armor?: number;
  mr?: number;
  as?: number;
  range?: number;
}

export interface ChampionPortraitVariant {
  id: string;
  element: string;
  icon: string;
  color: string;
  traits: ChampionPortraitTrait[];
}

export interface ChampionPortraitCardProps {
  id: string;
  nameVi: string;
  nameEn?: string;
  cost: number;
  icon?: string | null;
  traits?: ChampionPortraitTrait[];
  stats?: ChampionPortraitStats;
  variants?: ChampionPortraitVariant[];
  selectedVariantId?: string;
  onSelectVariant?: (variantId: string) => void;
  items?: (string | null)[];
  starLevel?: number;
  href?: string;
  className?: string;
}

const costStyles: Record<
  number,
  {
    border: string;
    glow: string;
    badgeBg: string;
    costText: string;
    gradientOverlay: string;
  }
> = {
  1: {
    border: "border-slate-600/80 group-hover:border-slate-400",
    glow: "group-hover:shadow-[0_0_15px_rgba(148,163,184,0.35)]",
    badgeBg: "bg-slate-700/90 text-slate-200 border-slate-500/60",
    costText: "text-slate-300",
    gradientOverlay: "from-slate-950/90 via-slate-950/40 to-transparent"
  },
  2: {
    border: "border-emerald-600/80 group-hover:border-emerald-400",
    glow: "group-hover:shadow-[0_0_18px_rgba(16,185,129,0.45)]",
    badgeBg: "bg-emerald-600 text-white border-emerald-400/80",
    costText: "text-emerald-400",
    gradientOverlay: "from-slate-950/90 via-emerald-950/30 to-transparent"
  },
  3: {
    border: "border-sky-600/80 group-hover:border-sky-400",
    glow: "group-hover:shadow-[0_0_18px_rgba(14,165,233,0.45)]",
    badgeBg: "bg-sky-600 text-white border-sky-400/80",
    costText: "text-sky-400",
    gradientOverlay: "from-slate-950/90 via-sky-950/30 to-transparent"
  },
  4: {
    border: "border-purple-600/90 group-hover:border-purple-400",
    glow: "group-hover:shadow-[0_0_20px_rgba(192,132,252,0.5)]",
    badgeBg: "bg-purple-600 text-white border-purple-400/80",
    costText: "text-purple-400",
    gradientOverlay: "from-slate-950/90 via-purple-950/30 to-transparent"
  },
  5: {
    border: "border-amber-500 group-hover:border-amber-300",
    glow: "group-hover:shadow-[0_0_24px_rgba(245,158,11,0.6)]",
    badgeBg: "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black border-amber-300",
    costText: "text-amber-400",
    gradientOverlay: "from-slate-950/90 via-amber-950/30 to-transparent"
  }
};

export function ChampionPortraitCard({
  id,
  nameVi,
  nameEn,
  cost,
  icon,
  traits = [],
  stats,
  variants,
  selectedVariantId,
  onSelectVariant,
  items = [],
  starLevel = 1,
  href,
  className = ""
}: ChampionPortraitCardProps) {
  const [imgError, setImgError] = useState(false);
  const [activeVariantId, setActiveVariantId] = useState<string>(
    selectedVariantId || (variants && variants.length > 0 ? variants[0].id : id)
  );

  const activeVariant = variants?.find((v) => v.id === activeVariantId);
  const currentIcon = activeVariant ? activeVariant.icon : icon;
  const currentTraits = activeVariant ? activeVariant.traits : traits;

  const costStyle = costStyles[cost] || costStyles[1];
  const initials = nameVi ? nameVi.trim().slice(0, 2).toUpperCase() : "??";

  const hasValidUrl =
    currentIcon &&
    typeof currentIcon === "string" &&
    currentIcon.trim() !== "" &&
    !currentIcon.toLowerCase().includes("none") &&
    !currentIcon.startsWith("{");

  const resolvedImageUrl = (hasValidUrl ? currentIcon : getChampionImageUrl(nameVi, nameEn || nameVi))
    ?.replace(/raw\.communitydragon\.org\/[^/]+\//i, `raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/`);

  const destination = href || `/champions/${activeVariant ? activeVariant.id : id}`;

  return (
    <Link
      href={destination}
      className={`group relative block rounded-2xl overflow-hidden border-2 transition-all duration-300 transform hover:-translate-y-1 bg-[#0b0e17] ${costStyle.border} ${costStyle.glow} shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 ${className}`}
    >
      {/* Container ảnh tướng lớn tràn viền chuẩn MetaTFT / Mobalytics */}
      <div className="relative w-full aspect-[4/3] sm:aspect-square overflow-hidden bg-[#07090f]">
        {resolvedImageUrl && !imgError ? (
          <img
            src={resolvedImageUrl}
            alt={nameVi}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 font-black text-2xl text-slate-300">
            {initials}
          </div>
        )}

        {/* Gradient Scrim từ đáy ảnh để chữ đọc sắc nét */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e17] via-transparent to-transparent opacity-90" />

        {/* Cost Badge góc trên trái tinh xảo */}
        <div
          className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-black shadow-md backdrop-blur-sm ${costStyle.badgeBg}`}
        >
          <span>{cost}</span>
          <span className="text-[9px] opacity-80 uppercase">Vàng</span>
        </div>

        {/* Star Level (★★ hoặc ★★★) nếu có */}
        {starLevel > 1 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-black/75 border border-amber-400/50 backdrop-blur-sm">
            <span className="text-[11px] text-amber-300 font-black tracking-tight drop-shadow">
              {starLevel === 3 ? "★★★" : "★★"}
            </span>
          </div>
        )}
      </div>

      {/* Thông tin tướng: Tên và Tộc/Hệ */}
      <div className="p-2.5 sm:p-3 space-y-1.5 bg-[#0b0e17]">
        <div className="text-left">
          <h3 className="text-xs sm:text-sm font-black text-slate-100 group-hover:text-amber-300 transition-colors truncate tracking-tight">
            {nameVi}
          </h3>
          {nameEn && nameEn !== nameVi && (
            <p className="text-[10px] text-slate-500 truncate font-medium">
              {nameEn}
            </p>
          )}
        </div>

        {/* Danh sách Tộc / Hệ dạng Pill nhỏ gọn */}
        {currentTraits.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {currentTraits.slice(0, 2).map((t, idx) => (
              <span
                key={idx}
                className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] text-slate-300 border border-white/[0.08] truncate max-w-[110px] font-medium"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Variant Selector for Multi-element champions like Lux */}
        {variants && variants.length > 0 && (
          <div
            className="mt-1 flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 px-1 bg-black/40 rounded-lg border border-white/10 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setActiveVariantId(v.id);
                  if (onSelectVariant) onSelectVariant(v.id);
                }}
                className={`text-[8px] px-1.5 py-0.5 rounded font-bold transition-all ${
                  activeVariantId === v.id
                    ? `${v.color} ring-1 ring-white/40 scale-105 shadow-sm text-white`
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                {v.element}
              </button>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
