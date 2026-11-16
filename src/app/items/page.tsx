"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Sword, X, Sparkles, Shield, Hammer, Layers, Bookmark } from "lucide-react";
import { ITEM_REGISTRY, ItemType } from "@/domain/meta/item-registry";
import { normalizeSearchString } from "@/domain/identity";
import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "@/domain/meta/asset-manifest";
import { ItemIcon } from "@/components/ui/item-icon";

const typeTabs: { id: "all" | ItemType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "Tất cả", icon: Sparkles },
  { id: "completed", label: "Trang bị thường", icon: Shield },
  { id: "ornn", label: "Tạo tác Ornn", icon: Hammer },
  { id: "component", label: "Thành phần", icon: Layers },
  { id: "emblem", label: "Ấn tộc hệ", icon: Bookmark }
];

const categoryFilters = [
  { id: "all", label: "Mọi chỉ số" },
  { id: "ad", label: "Sát thương AD" },
  { id: "ap", label: "Sức mạnh AP" },
  { id: "tank", label: "Chống chịu Tank" },
  { id: "mana", label: "Năng lượng Mana" },
  { id: "utility", label: "Đa dụng / Hỗ trợ" }
];

export default function ItemsPage() {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<"all" | ItemType>("all");
  const [activeCategory, setActiveCategory] = useState("all");

  const allItems = useMemo(() => Object.values(ITEM_REGISTRY), []);

  const countsByType = useMemo(() => {
    const counts = { all: allItems.length, completed: 0, ornn: 0, component: 0, emblem: 0, special: 0 };
    for (const it of allItems) {
      if (it.itemType && it.itemType in counts) {
        counts[it.itemType]++;
      }
    }
    return counts;
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const q = normalizeSearchString(query);
    return allItems.filter((item) => {
      // Type filter
      if (activeType !== "all" && item.itemType !== activeType) return false;

      // Category filter
      if (activeCategory !== "all" && item.category !== activeCategory) return false;

      // Search query
      if (!q) return true;
      const matchName =
        normalizeSearchString(item.nameVi).includes(q) ||
        normalizeSearchString(item.nameEn).includes(q) ||
        normalizeSearchString(item.abbr || "").includes(q);
      return matchName;
    });
  }, [allItems, query, activeType, activeCategory]);

  return (
    <div className="space-y-6 w-full">
      {/* Breadcrumb & Header */}
      <div>
        <nav aria-label="Breadcrumb" className="text-xs text-[#94a3b8] flex items-center gap-2 mb-2">
          <span>Khám phá</span>
          <span>/</span>
          <span className="text-[#06b6d4]">Trang bị</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242f49] pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f8fafc] tracking-tight flex items-center gap-2.5">
              <Sword className="w-6 h-6 text-[#06b6d4]" />
              <span>Danh Mục Trang Bị ĐTCL Mùa 18</span>
            </h1>
            <p className="text-xs sm:text-[13px] text-[#94a3b8] mt-1 max-w-2xl">
              Kho dữ liệu trang bị Mùa 18: phân chia rành mạch Trang bị thường, Tạo tác Ornn, Trang bị thành phần và Ấn tộc hệ.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#131927] border border-[#242f49] text-[#f59e0b]">
              {filteredItems.length} / {allItems.length} Trang bị
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search + Primary Classification Tabs + Category Filter */}
      <div className="p-4 rounded-xl border border-[#242f49] bg-[#131927] space-y-4 shadow-sm">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên trang bị, viết tắt (VD: Vô Cực, IE, Cuồng Đao, Zhonya, Navori)..."
            className="w-full rounded-lg border border-[#242f49] bg-[#0b0e17] py-2 pl-10 pr-10 text-xs sm:text-[13px] text-[#f8fafc] placeholder:text-[#94a3b8]/60 outline-none focus:border-[#06b6d4] transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#f8fafc] p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Primary Classification Tabs: Ornn vs Completed vs Components vs Emblems */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]/80 mb-2">
            Phân loại trang bị
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {typeTabs.map((tab) => {
              const active = activeType === tab.id;
              const Icon = tab.icon;
              const count = tab.id === "all" ? countsByType.all : countsByType[tab.id];

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveType(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active
                      ? tab.id === "ornn"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-sm shadow-amber-500/20"
                        : tab.id === "emblem"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/60 shadow-sm shadow-purple-500/20"
                        : "bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/50"
                      : "bg-[#1a2236] text-[#94a3b8] hover:text-[#f8fafc] border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    active ? "bg-black/30 font-bold" : "bg-[#0b0e17] text-[#94a3b8]/80"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filters: Stat Categories */}
        <div className="pt-2 border-t border-[#242f49]/60">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]/80 mb-2">
            Chỉ số / Vai trò
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categoryFilters.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/40"
                      : "bg-[#0b0e17] text-[#94a3b8] hover:text-[#f8fafc] border border-[#242f49]/50"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Items Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const imgUrl = item.imageUrl?.replace(
              /raw\.communitydragon\.org\/[^/]+\//i,
              `raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/`
            );

            const isOrnn = item.itemType === "ornn";
            const isEmblem = item.itemType === "emblem";
            const isComponent = item.itemType === "component";

            const cardBorder = isOrnn
              ? "border-amber-500/30 hover:border-amber-400 bg-gradient-to-b from-amber-950/10 to-[#131927]"
              : isEmblem
              ? "border-purple-500/30 hover:border-purple-400 bg-gradient-to-b from-purple-950/10 to-[#131927]"
              : "border-[#242f49] hover:border-[#06b6d4] bg-[#131927]";

            return (
              <Link
                key={item.key}
                href={`/items/${encodeURIComponent(item.key)}`}
                className={`group p-4 rounded-xl border ${cardBorder} hover:bg-[#1a2236] transition-all flex flex-col justify-between gap-3 shadow-sm relative overflow-hidden`}
              >
                {/* Top Section: Icon & Header */}
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-lg bg-[#0b0e17] border ${
                    isOrnn ? "border-amber-400/60 ring-1 ring-amber-400/20" : isEmblem ? "border-purple-400/60" : "border-[#242f49]"
                  } group-hover:scale-105 overflow-hidden shrink-0 flex items-center justify-center transition-all`}>
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.nameVi}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="font-mono text-xs font-bold text-[#f59e0b]">
                        {item.abbr || "??"}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className={`font-bold text-sm ${isOrnn ? "text-amber-200 group-hover:text-amber-100" : "text-[#f8fafc] group-hover:text-[#06b6d4]"} transition-colors truncate`}>
                        {item.nameVi}
                      </h3>
                      {item.abbr && (
                        <span className="text-[10px] font-mono text-[#94a3b8] bg-[#1a2236] px-1.5 py-0.5 rounded border border-[#242f49] shrink-0">
                          {item.abbr}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#94a3b8] truncate mt-0.5">{item.nameEn}</p>
                    
                    {/* Item Badges */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {isOrnn ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                          <Hammer className="w-2.5 h-2.5" /> Tạo Tác Ornn
                        </span>
                      ) : isEmblem ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 inline-flex items-center gap-1">
                          <Bookmark className="w-2.5 h-2.5" /> Ấn Tộc Hệ
                        </span>
                      ) : isComponent ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-slate-600">
                          Thành Phần
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/40">
                          Hoàn Chỉnh
                        </span>
                      )}

                      <span className="text-[10px] font-medium text-[#94a3b8]/80">
                        {item.category === "ad"
                          ? "SMCK"
                          : item.category === "ap"
                          ? "SMPT"
                          : item.category === "tank"
                          ? "Chống chịu"
                          : item.category === "mana"
                          ? "Năng lượng"
                          : "Đa dụng"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Recipe Components (if completed item) or Stats preview */}
                {item.recipe && item.recipe.length === 2 && (
                  <div className="pt-2 border-t border-[#242f49]/50 flex items-center justify-between text-[11px] text-[#94a3b8]">
                    <span className="text-[10px] text-[#94a3b8]/70 font-mono">Ghép từ:</span>
                    <div className="flex items-center gap-1.5">
                      <ItemIcon name={item.recipe[0]} size="sm" showTooltip={false} />
                      <span className="text-[10px] text-slate-500 font-bold">+</span>
                      <ItemIcon name={item.recipe[1]} size="sm" showTooltip={false} />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center rounded-xl border border-[#242f49] bg-[#131927] space-y-3">
          <p className="text-sm text-[#94a3b8]">Không tìm thấy trang bị nào phù hợp với bộ lọc.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveType("all");
              setActiveCategory("all");
            }}
            className="text-xs text-[#06b6d4] font-semibold hover:underline"
          >
            Đặt lại toàn bộ bộ lọc
          </button>
        </div>
      )}
    </div>
  );
}
