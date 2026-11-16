"use client";

import React, { useState, useMemo } from "react";
import { RankingSnapshot, RankingRow, Tier } from "@/domain/meta/schemas";
import { CompRow } from "./comp-row";
import { Search, Filter, Globe, Sparkles, AlertCircle, Info, RefreshCw, Layers } from "lucide-react";
import { normalizeSearchString, toCanonicalChampionId } from "@/domain/identity";
import bilingualData from "@/domain/meta/set18-champions-bilingual.json";

interface TierBoardProps {
  initialSnapshot: RankingSnapshot;
  boardType: "websites" | "elite";
  currentRegion?: string;
  currentWindow?: string;
  onRegionChange?: (region: string) => void;
  onWindowChange?: (window: string) => void;
  isArchive?: boolean;
}

export function TierBoard({
  initialSnapshot,
  boardType,
  currentRegion = "all",
  currentWindow = "72h",
  isArchive,
  onRegionChange,
  onWindowChange
}: TierBoardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaystyle, setSelectedPlaystyle] = useState<string>("all");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [expandAll, setExpandAll] = useState<boolean>(false);

  const safePatchEpochId = initialSnapshot?.rankingScope?.patchEpochId || (initialSnapshot as any)?.requestedScope?.patchEpochId || "epoch_18_2";
  const safeRankingVersion = initialSnapshot?.rankingScope?.rankingVersion || "1.0.0";

  const rows = initialSnapshot.rows || [];

  // Lọc hiển thị (chỉ lọc giao diện, không làm đổi điểm số hay ranking snapshot)
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // 1. Tìm kiếm theo tên hoặc tướng
      if (searchQuery.trim()) {
        const query = normalizeSearchString(searchQuery);
        const matchName =
          normalizeSearchString(row.archetypeNameVi || "").includes(query) ||
          normalizeSearchString(row.archetypeNameEn || "").includes(query) ||
          normalizeSearchString(row.archetypeId).includes(query);

        const championIds = Array.from(new Set([
          row.coreCarryChampionId,
          row.coreTankChampionId,
          ...row.coreChampionIds,
          ...row.recommendedBoard.map((unit) => unit.championId)
        ].filter(Boolean) as string[]));
        const matchChamp = championIds.some((championId) => {
          const canonical = toCanonicalChampionId(championId, 18);
          const sourceEntry = Object.entries(bilingualData as Record<string, { vi: string; en: string }>).find(
            ([sourceKey]) => toCanonicalChampionId(sourceKey, 18) === canonical
          );
          const terms = [championId, canonical, sourceEntry?.[0], sourceEntry?.[1]?.vi, sourceEntry?.[1]?.en]
            .filter(Boolean)
            .map((value) => normalizeSearchString(String(value)));
          return terms.some((term) => term.includes(query));
        });

        if (!matchName && !matchChamp) return false;
      }

      // 2. Lọc theo lối chơi
      if (selectedPlaystyle !== "all") {
        if (row.playstyle !== selectedPlaystyle) return false;
      }

      // 3. Lọc theo tier
      if (selectedTier !== "all") {
        if (selectedTier === "collecting") {
          if (row.tier !== null) return false;
        } else {
          if (row.tier !== selectedTier) return false;
        }
      }

      return true;
    });
  }, [rows, searchQuery, selectedPlaystyle, selectedTier]);

  // Phân nhóm theo Tier S, A, B, C và Đang thu thập
  const tierS = filteredRows.filter((r) => r.tier === "S");
  const tierA = filteredRows.filter((r) => r.tier === "A");
  const tierB = filteredRows.filter((r) => r.tier === "B");
  const tierC = filteredRows.filter((r) => r.tier === "C");
  const unranked = filteredRows.filter((r) => r.tier === null);

  const isWebsites = boardType === "websites";

  return (
    <div className="space-y-6">
      {/* Bộ lọc và điều khiển phạm vi */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur shadow-sm space-y-4">
        {/* Hàng 1: Khu vực và Thời gian (dành cho Mục B Cao thủ) */}
        {!isWebsites && (
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-purple-400" />
                Khu vực:
              </span>
              {[
                { id: "all", label: "Tổng hợp 4 vùng" },
                { id: "KR", label: "Hàn Quốc (KR)" },
                { id: "VN", label: "Việt Nam (VN)" },
                { id: "NA", label: "Bắc Mỹ (NA)" },
                { id: "EUW", label: "Tây Âu (EUW)" }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => onRegionChange?.(r.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    currentRegion === r.id
                      ? "bg-purple-600 text-white shadow-sm font-semibold"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Cửa sổ:</span>
              {[
                { id: "24h", label: "24 giờ" },
                { id: "72h", label: "72 giờ" },
                { id: "168h", label: "7 ngày" }
              ].map((w) => (
                <button
                  key={w.id}
                  onClick={() => onWindowChange?.(w.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    currentWindow === w.id
                      ? "bg-slate-700 text-white border border-slate-500 font-semibold"
                      : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        )}

          {/* Hàng 2: Tìm kiếm, lối chơi và lọc bậc */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên đội hình, tướng chủ lực (Draven, Ahri, Caitlyn...)"
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-slate-600 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          {/* Lọc lối chơi */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedPlaystyle}
              onChange={(e) => setSelectedPlaystyle(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-slate-600 w-full sm:w-auto"
            >
              <option value="all">Tất cả lối chơi</option>
              <option value="reroll">Đổi lại 3 sao</option>
              <option value="fast8">Lên cấp nhanh 8</option>
              <option value="standard">Tiêu chuẩn</option>
            </select>

            {/* Lọc theo bậc */}
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-slate-600 w-full sm:w-auto"
            >
              <option value="all">Tất cả bậc</option>
              <option value="S">Chỉ bậc S</option>
              <option value="A">Chỉ bậc A</option>
              <option value="B">Chỉ bậc B</option>
              <option value="C">Chỉ bậc C</option>
              <option value="collecting">Đang thu thập dữ liệu</option>
            </select>

            {/* Nút Mở rộng / Thu gọn toàn bộ bàn cờ */}
            <button
              onClick={() => setExpandAll(!expandAll)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 whitespace-nowrap w-full sm:w-auto ${
                expandAll
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
              title="Mở hoặc đóng toàn bộ sơ đồ bàn cờ của các đội hình"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{expandAll ? "Thu gọn bàn cờ" : "Mở rộng bàn cờ"}</span>
            </button>
          </div>
        </div>

        {/* Thông tin metadata snapshot */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
          <div className="flex items-center gap-2">
            <span>Phiên bản: <strong className="text-slate-300">{safePatchEpochId}</strong></span>
            <span>•</span>
            <span>Phương pháp: <strong className="text-slate-300">{safeRankingVersion}</strong></span>
            <span>•</span>
            <span>Cập nhật: {new Date(initialSnapshot.generatedAt || Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
            {initialSnapshot?.id && (
              <>
                <span>•</span>
                <span className="font-mono text-[11px] text-slate-400">{initialSnapshot.id}</span>
              </>
            )}
          </div>

          <div>
            Hiển thị <strong>{filteredRows.length}</strong> / {rows.length} đội hình
          </div>
        </div>
      </div>

      {/* Danh sách các nhóm Tier S, A, B, C */}
      <div className="space-y-8">
        {/* Tier S */}
        {(selectedTier === "all" || selectedTier === "S") && (
          <section className="space-y-3">
            <div className="flex items-center gap-3 border-b border-amber-500/30 pb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 font-black text-base flex items-center justify-center shadow-amber-500/20 shadow-md">
                S
              </div>
              <div>
                <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                  Bậc S — Mức S trong dữ liệu
                </h2>
                <p className="text-xs text-slate-400">
                  {isWebsites
                    ? "Được xếp theo ngưỡng đồng thuận và bằng chứng của ảnh chụp dữ liệu"
                    : "Được xếp theo số liệu Riot đã thu thập trong ảnh chụp dữ liệu"}
                </p>
              </div>
            </div>

            {tierS.length > 0 ? (
              <div className="space-y-2.5">
                {tierS.map((row, idx) => (
                  <CompRow key={row.archetypeId} row={row} boardType={boardType} isExpanded={expandAll ? true : undefined} datasetKind={initialSnapshot.datasetKind} patchEpochId={safePatchEpochId} snapshotId={initialSnapshot.id} isArchive={isArchive || Boolean(initialSnapshot?.id)} rankNumber={idx + 1} />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
                Chưa có đội hình nào đủ điều kiện bậc S trong mẫu được chọn.
              </div>
            )}
          </section>
        )}

        {/* Tier A */}
        {(selectedTier === "all" || selectedTier === "A") && (
          <section className="space-y-3">
            <div className="flex items-center gap-3 border-b border-purple-500/30 pb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-700 text-white font-black text-base flex items-center justify-center shadow-purple-500/20 shadow-md">
                A
              </div>
              <div>
                <h2 className="text-lg font-bold text-purple-300 flex items-center gap-2">
                  Bậc A — Mức A trong dữ liệu
                </h2>
                <p className="text-xs text-slate-400">
                  {isWebsites
                    ? "Được xếp theo ngưỡng đồng thuận và bằng chứng của ảnh chụp dữ liệu"
                    : "Được xếp theo số liệu Riot đã thu thập trong ảnh chụp dữ liệu"}
                </p>
              </div>
            </div>

            {tierA.length > 0 ? (
              <div className="space-y-2.5">
                {tierA.map((row, idx) => (
                  <CompRow key={row.archetypeId} row={row} boardType={boardType} isExpanded={expandAll ? true : undefined} datasetKind={initialSnapshot.datasetKind} patchEpochId={safePatchEpochId} snapshotId={initialSnapshot.id} isArchive={isArchive || Boolean(initialSnapshot?.id)} rankNumber={tierS.length + idx + 1} />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
                Chưa có đội hình nào thuộc bậc A.
              </div>
            )}
          </section>
        )}

        {/* Tier B */}
        {(selectedTier === "all" || selectedTier === "B") && (
          <section className="space-y-3">
            <div className="flex items-center gap-3 border-b border-blue-500/30 pb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-700 text-white font-black text-base flex items-center justify-center shadow-blue-500/20 shadow-md">
                B
              </div>
              <div>
                <h2 className="text-lg font-bold text-blue-300 flex items-center gap-2">
                  Bậc B — Mức B trong dữ liệu
                </h2>
                <p className="text-xs text-slate-400">
                  Được xếp theo ngưỡng của ảnh chụp dữ liệu; điều kiện và cỡ mẫu hiển thị trên từng dòng.
                </p>
              </div>
            </div>

            {tierB.length > 0 ? (
              <div className="space-y-2.5">
                {tierB.map((row, idx) => (
                  <CompRow key={row.archetypeId} row={row} boardType={boardType} isExpanded={expandAll ? true : undefined} datasetKind={initialSnapshot.datasetKind} patchEpochId={safePatchEpochId} snapshotId={initialSnapshot.id} isArchive={isArchive || Boolean(initialSnapshot?.id)} rankNumber={tierS.length + tierA.length + idx + 1} />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
                Chưa có đội hình nào thuộc bậc B.
              </div>
            )}
          </section>
        )}

        {/* Tier C */}
        {(selectedTier === "all" || selectedTier === "C") && (
          <section className="space-y-3">
            <div className="flex items-center gap-3 border-b border-slate-700/50 pb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 text-slate-200 font-black text-base flex items-center justify-center shadow-md">
                C
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                  Bậc C — Mức C trong dữ liệu
                </h2>
                <p className="text-xs text-slate-400">
                  Đã có đủ dữ liệu kiểm chứng trong phạm vi ảnh chụp này.
                </p>
              </div>
            </div>

            {tierC.length > 0 ? (
              <div className="space-y-2.5">
                {tierC.map((row, idx) => (
                  <CompRow key={row.archetypeId} row={row} boardType={boardType} isExpanded={expandAll ? true : undefined} datasetKind={initialSnapshot.datasetKind} patchEpochId={safePatchEpochId} snapshotId={initialSnapshot.id} isArchive={isArchive || Boolean(initialSnapshot?.id)} rankNumber={tierS.length + tierA.length + tierB.length + idx + 1} />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
                Không có đội hình nào bị xếp vào bậc C.
              </div>
            )}
          </section>
        )}

        {/* Nhóm Đang thu thập dữ liệu / Tạm thời (Chưa đủ mẫu) */}
        {(selectedTier === "all" || selectedTier === "collecting") && unranked.length > 0 && (
          <section className="space-y-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-3 pb-2">
              <div className="w-8 h-8 rounded-lg bg-slate-800/90 border border-dashed border-slate-600 text-slate-400 font-bold text-base flex items-center justify-center">
                ?
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-300 flex items-center gap-2">
                  Đang Thu Thập Dữ Liệu ({unranked.length} Đội Hình)
                </h2>
                <p className="text-xs text-slate-400">
                  Các đội hình chưa đủ số lượng nguồn hoặc chưa đạt ngưỡng mẫu kiểm chứng. Hệ thống bảo lưu trạng thái thay vì ép xuống bậc C.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 opacity-90">
              {unranked.map((row, idx) => (
                <CompRow key={row.archetypeId} row={row} boardType={boardType} isExpanded={expandAll ? true : undefined} datasetKind={initialSnapshot.datasetKind} patchEpochId={safePatchEpochId} snapshotId={initialSnapshot.id} isArchive={isArchive || Boolean(initialSnapshot?.id)} rankNumber={idx + 1} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
