"use client";

import { useMemo, useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, Users, ShieldAlert, X } from "lucide-react";
import type { ChampionRecord } from "@/domain/types";
import { normalizeSearchString, formatTraitNameVi, toCanonicalTraitId } from "@/domain/identity";
import { ChampionPortraitCard } from "@/components/ui/champion-portrait-card";
import { CapsuleButton } from "@/components/ui/capsule-button";
import { EmptyState } from "@/components/ui/empty-state";

function ChampionCatalogueContent({
  champions,
  snapshotId
}: {
  champions: ChampionRecord[];
  snapshotId: string | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [cost, setCost] = useState(searchParams.get("cost") || "");
  const [trait, setTrait] = useState(searchParams.get("trait") || "");

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSelfQueryRef = useRef(searchParams.toString());

  useEffect(() => {
    const current = searchParams.toString();
    if (current !== lastSelfQueryRef.current && debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    lastSelfQueryRef.current = current;
    setQuery(searchParams.get("q") || "");
    setCost(searchParams.get("cost") || "");
    setTrait(searchParams.get("trait") || "");
  }, [searchParams]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [pathname, snapshotId]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const updateUrl = useCallback(
    (newQuery: string, newCost: string, newTrait: string, immediate = false) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newQuery) {
        params.set("q", newQuery);
      } else {
        params.delete("q");
      }
      if (newCost) {
        params.set("cost", newCost);
      } else {
        params.delete("cost");
      }
      if (newTrait) {
        params.set("trait", newTrait);
      } else {
        params.delete("trait");
      }
      const queryString = params.toString();
      lastSelfQueryRef.current = queryString;
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", newUrl);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (immediate) {
        router.replace(newUrl, { scroll: false });
      } else {
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          router.replace(newUrl, { scroll: false });
        }, 300);
      }
    },
    [searchParams, pathname, router]
  );

  const handleQueryChange = (val: string) => {
    setQuery(val);
    updateUrl(val, cost, trait, false);
  };

  const handleCostChange = (val: string) => {
    setCost(val);
    updateUrl(query, val, trait, true);
  };

  const handleTraitChange = (val: string) => {
    setTrait(val);
    updateUrl(query, cost, val, true);
  };

  const handleResetFilters = () => {
    setQuery("");
    setCost("");
    setTrait("");
    updateUrl("", "", "", true);
  };

  // Trait list extracted from current champions
  const availableTraits = useMemo(() => {
    const traitMap = new Map<string, string>();
    for (const champion of champions) {
      if (champion.traitIds.state === "known") {
        for (const t of champion.traitIds.value) {
          const canonical = toCanonicalTraitId(t);
          if (!traitMap.has(canonical)) {
            traitMap.set(canonical, formatTraitNameVi(canonical));
          }
        }
      }
    }
    return Array.from(traitMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [champions]);

  const filtered = useMemo(() => {
    const normalized = normalizeSearchString(query);
    const selectedTraitCanonical = trait ? toCanonicalTraitId(trait) : "";

    return champions
      .filter((champion) => {
        const nameVi =
          champion.name.vi.state === "known" ? champion.name.vi.value : champion.championId;
        const nameEn = champion.name.en.state === "known" ? champion.name.en.value : "";
        const costValue = champion.cost.state === "known" ? champion.cost.value : null;
        const champTraits = champion.traitIds.state === "known" ? champion.traitIds.value : [];
        const canonicalTraits = champTraits.map((t) => toCanonicalTraitId(t));

        const matchesQuery =
          !normalized ||
          [nameVi, nameEn, champion.championId, ...champion.aliases].some((value) =>
            normalizeSearchString(value).includes(normalized)
          );

        const matchesCost = !cost || String(costValue) === cost;
        const matchesTrait =
          !selectedTraitCanonical || canonicalTraits.includes(selectedTraitCanonical);

        return matchesQuery && matchesCost && matchesTrait;
      })
      .sort(
        (a, b) =>
          (a.cost.state === "known" ? a.cost.value : 99) -
          (b.cost.state === "known" ? b.cost.value : 99)
      );
  }, [champions, query, cost, trait]);

  const hasActiveFilters = Boolean(query || cost || trait);

  return (
    <div className="space-y-6">
      {/* Header Area Gaming Banner */}
      <header className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#121624] via-[#0d101a] to-[#080a11] p-5 sm:p-7 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/20">
                <Users className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                Danh mục tướng Mùa 18
              </h1>
            </div>
            <p className="text-xs sm:text-[13px] text-slate-400 max-w-2xl leading-relaxed">
              Tra cứu toàn bộ tướng Mùa 18, chỉ số sức mạnh, kỹ năng và lịch sử cân bằng qua các bản vá.
              Dữ liệu lấy từ ảnh chụp dữ liệu thật đã xác minh.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-[#0a0d14] border border-white/[0.1] text-amber-300 shadow-inner">
              {filtered.length} / {champions.length} Tướng
            </span>
          </div>
        </div>
      </header>

      {/* Floating Filter & Search Bar - Tinh tế và trực quan */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0c0f18]/80 backdrop-blur-md border border-white/[0.08] space-y-3.5 shadow-lg">
        {/* Row 1: Search & Trait dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Tìm theo tên tướng..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#07090f] py-2 pl-10 pr-4 text-xs sm:text-[13px] text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 transition-all shadow-inner"
            />
            {query && (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Trait selector */}
          <div className="relative shrink-0 sm:w-60">
            <select
              value={trait}
              onChange={(e) => handleTraitChange(e.target.value)}
              aria-label="Lọc theo Tộc/Hệ"
              className="w-full rounded-xl border border-white/[0.08] bg-[#07090f] px-4 py-2 text-xs sm:text-[13px] text-slate-300 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 transition-all cursor-pointer shadow-inner"
            >
              <option value="">Tất cả Tộc / Hệ ({availableTraits.length})</option>
              {availableTraits.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset button */}
          {hasActiveFilters && (
            <CapsuleButton
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              leftIcon={<X className="w-3.5 h-3.5" />}
              className="shrink-0"
            >
              Xóa lọc
            </CapsuleButton>
          )}
        </div>

        {/* Row 2: 1-Touch Cost Filter Capsule Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-white/[0.04]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1.5 hidden sm:inline">
            Giá tướng:
          </span>
          <button
            type="button"
            onClick={() => handleCostChange("")}
            className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              cost === ""
                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300"
                : "bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-white/[0.06] hover:bg-white/[0.08]"
            }`}
          >
            Tất cả
          </button>
          {[1, 2, 3, 4, 5].map((val) => {
            const isSelected = cost === String(val);
            return (
              <button
                key={val}
                type="button"
                onClick={() => handleCostChange(isSelected ? "" : String(val))}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300"
                    : "bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-white/[0.06] hover:bg-white/[0.08]"
                }`}
              >
                <span>{val} Vàng</span>
              </button>
            );
          })}
        </div>
      </div>

      {!snapshotId && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-200">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>Chưa có ảnh chụp dữ liệu thật đã công bố; hệ thống giữ trạng thái thiếu dữ liệu.</span>
        </div>
      )}

      {/* Champion Grid (Thẻ Chân Dung Tướng Esports Mùa 18) */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {filtered.map((champion) => {
            const nameVi =
              champion.name.vi.state === "known" ? champion.name.vi.value : champion.championId;
            const nameEn = champion.name.en.state === "known" ? champion.name.en.value : "";
            const costValue = champion.cost.state === "known" ? champion.cost.value : 1;
            const traits = champion.traitIds.state === "known" ? champion.traitIds.value : [];
            const iconUrl = champion.icon.state === "known" ? champion.icon.value : null;

            const detailUrl = `/champions/${champion.championId}?from=catalogue${
              snapshotId ? `&snapshotId=${encodeURIComponent(snapshotId)}` : ""
            }${query ? `&q=${encodeURIComponent(query)}` : ""}${cost ? `&cost=${cost}` : ""}${
              trait ? `&trait=${encodeURIComponent(trait)}` : ""
            }`;

            // Map traits to ChampionPortraitTrait objects
            const portraitTraits = traits.map((t) => ({
              name: formatTraitNameVi(t)
            }));

            // Extract baseline stats if available from champion record variants
            const defaultVariant = champion.variants?.[0];
            const hpParam = defaultVariant?.stats?.find((s) => s.key === "hp");
            const adParam = defaultVariant?.stats?.find((s) => s.key === "attackDamage");
            const hpStat =
              hpParam?.byStar?.[1]?.state === "known" ? hpParam.byStar[1].value : undefined;
            const adStat =
              adParam?.byStar?.[1]?.state === "known" ? adParam.byStar[1].value : undefined;

            return (
              <ChampionPortraitCard
                key={champion.championId}
                id={champion.championId}
                nameVi={nameVi}
                nameEn={nameEn}
                cost={costValue}
                icon={iconUrl}
                traits={portraitTraits}
                href={detailUrl}
                stats={
                  hpStat !== undefined || adStat !== undefined
                    ? { hp: hpStat, maxHp: 1200, ad: adStat, maxAd: 120 }
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Không tìm thấy tướng phù hợp"
          description={`Không có tướng nào thỏa mãn điều kiện lọc${query ? ` với từ khóa "${query}"` : ""}.`}
          scope={cost ? `Giá ${cost} vàng` : undefined}
          actionLabel="Xóa toàn bộ bộ lọc"
          onAction={handleResetFilters}
        />
      )}
    </div>
  );
}

export function ChampionCatalogue(props: {
  champions: ChampionRecord[];
  snapshotId: string | null;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm text-slate-400 glass-panel rounded-2xl">
          Đang tải danh mục tướng Mùa 18...
        </div>
      }
    >
      <ChampionCatalogueContent {...props} />
    </Suspense>
  );
}
