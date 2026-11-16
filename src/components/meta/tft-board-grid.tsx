"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { BoardUnit } from "@/domain/meta/schemas";
import { ItemMiniChip, ItemBadge } from "./item-badge";
import { ChampionAvatar, getChampionImageUrl } from "./champion-image";
import { Swords, Shield, Sparkles, X, ChevronRight, RotateCcw, Move, Check } from "lucide-react";
import { resolveSet18Champion } from "@/domain/meta/set18-registry";
import { formatTraitNameVi } from "@/domain/identity";

interface TftBoardGridProps {
  boardUnits: BoardUnit[];
  className?: string;
  showItemList?: boolean;
  initialCustomPositions?: Record<number, { row: number; col: number }>;
}

const HEX_CLIP_PATH = "polygon(50% 0%, 95% 22%, 95% 78%, 50% 100%, 5% 78%, 5% 22%)";

const costBorderColors: Record<number, string> = {
  1: "border-slate-500 bg-slate-900/90",
  2: "border-emerald-500/80 bg-emerald-950/40",
  3: "border-sky-500/80 bg-sky-950/40",
  4: "border-purple-500/80 bg-purple-950/40",
  5: "border-amber-400 bg-amber-950/50"
};

const costTextColors: Record<number, string> = {
  1: "text-slate-300",
  2: "text-emerald-300",
  3: "text-sky-300",
  4: "text-purple-300",
  5: "text-amber-300"
};

export function TftBoardGrid({
  boardUnits,
  className = "",
  showItemList = true,
  initialCustomPositions = {}
}: TftBoardGridProps) {
  const [selectedUnit, setSelectedUnit] = useState<BoardUnit | null>(null);
  const [hoveredUnit, setHoveredUnit] = useState<BoardUnit | null>(null);
  const [activeTrait, setActiveTrait] = useState<string | null>(null);
  const [customPositions, setCustomPositions] = useState<Record<number, { row: number; col: number }>>(
    initialCustomPositions
  );
  const [draggedUnitIdx, setDraggedUnitIdx] = useState<number | null>(null);
  const [selectedUnitIdxForMove, setSelectedUnitIdxForMove] = useState<number | null>(null);

  const sourceSignature = JSON.stringify(boardUnits || []);
  const previousSource = useRef(sourceSignature);
  useEffect(() => {
    if (previousSource.current !== sourceSignature) {
      setCustomPositions({});
      setDraggedUnitIdx(null);
      setSelectedUnitIdxForMove(null);
      setSelectedUnit(null);
      setHoveredUnit(null);
      previousSource.current = sourceSignature;
    }
  }, [sourceSignature]);

  const isCustomArrangement = Object.keys(customPositions).length > 0;

  // Bản đồ tọa độ 4 hàng x 7 cột (28 ô cờ) kèm chỉ số gốc để kéo-thả không làm biến đổi nguồn
  const grid: ({ unit: BoardUnit; unitIdx: number } | null)[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 7 }, () => null)
  );

  const safeUnits = boardUnits || [];
  const unplacedUnits: BoardUnit[] = [];

  // Bước 1: Điền các tướng có tọa độ hợp lệ [0..3] x [0..6]
  safeUnits.forEach((unit, idx) => {
    const customPos = customPositions[idx];
    const effectivePos = customPos || unit.position;
    if (
      effectivePos &&
      typeof effectivePos.row === "number" &&
      typeof effectivePos.col === "number" &&
      Number.isInteger(effectivePos.row) &&
      Number.isInteger(effectivePos.col) &&
      effectivePos.row >= 0 &&
      effectivePos.row <= 3 &&
      effectivePos.col >= 0 &&
      effectivePos.col <= 6
    ) {
      const r = effectivePos.row;
      const c = effectivePos.col;
      if (!grid[r][c]) {
        grid[r][c] = { unit: { ...unit, position: effectivePos }, unitIdx: idx };
        return;
      }
    }
    unplacedUnits.push(unit);
  });

  const handleDropCell = (targetRow: number, targetCol: number, forcedUnitIdx?: number) => {
    const unitIdxToMove = forcedUnitIdx !== undefined && forcedUnitIdx !== null ? forcedUnitIdx : draggedUnitIdx;
    if (unitIdxToMove === null || unitIdxToMove === undefined) return;
    const draggedUnit = safeUnits[unitIdxToMove];
    if (!draggedUnit) return;

    setCustomPositions((prev) => {
      const next = { ...prev };
      const existingAtTarget = grid[targetRow]?.[targetCol];
      const sourcePos = prev[unitIdxToMove] || draggedUnit.position;
      if (existingAtTarget && existingAtTarget.unitIdx !== unitIdxToMove && sourcePos) {
        next[existingAtTarget.unitIdx] = { row: sourcePos.row, col: sourcePos.col };
      }
      next[unitIdxToMove] = { row: targetRow, col: targetCol };
      return next;
    });
    setDraggedUnitIdx(null);
    setSelectedUnitIdxForMove(null);
  };

  const handleCellClick = (
    rowIdx: number,
    colIdx: number,
    entry: { unit: BoardUnit; unitIdx: number } | null
  ) => {
    if (selectedUnitIdxForMove !== null) {
      // Đang có tướng được chọn để di chuyển:
      if (!entry) {
        // Nhấp vào ô trống -> Di chuyển tướng đến ô trống đó
        handleDropCell(rowIdx, colIdx, selectedUnitIdxForMove);
        return;
      }
      if (entry.unitIdx === selectedUnitIdxForMove) {
        // Nhấp lại vào chính tướng đó -> Hủy chọn
        setSelectedUnitIdxForMove(null);
        return;
      }
      // Nhấp vào tướng khác -> Đổi chỗ (swap) 2 tướng
      handleDropCell(rowIdx, colIdx, selectedUnitIdxForMove);
      return;
    }

    // Chưa có tướng nào được chọn để di chuyển:
    if (entry) {
      setSelectedUnit(entry.unit);
      setSelectedUnitIdxForMove(entry.unitIdx);
    }
  };

  const handleResetArrangement = () => {
    setCustomPositions({});
    setDraggedUnitIdx(null);
    setSelectedUnitIdxForMove(null);
  };

  const rowLabels = [
    { name: "Hàng 1", desc: "Tiền tuyến (Tanker / Đỡ đòn)" },
    { name: "Hàng 2", desc: "Cận chiến / Đấu sĩ phụ" },
    { name: "Hàng 3", desc: "Tầm trung / Hỗ trợ" },
    { name: "Hàng 4", desc: "Tuyến sau (Chủ lực tầm xa)" }
  ];

  const formatChampName = (id: string) => {
    return id
      .replace(/^tft18_da_18_/, "")
      .replace(/^tft18_da_/, "")
      .replace(/^tft18_/, "")
      .replace(/_ad$/, "")
      .replace(/\d+$/, "");
  };

  // Tra cứu thông tin mở rộng của tướng
  const getUnitMeta = (champId: string) => {
    return resolveSet18Champion(champId);
  };

  // Tính toán danh sách Tộc/Hệ kích hoạt của riêng các tướng ĐÃ ĐẶT trên bàn cờ
  const activeTraitsList = useMemo(() => {
    const counts: Record<string, { count: number; name: string }> = {};
    const placedUnits = grid
      .flat()
      .filter((entry): entry is { unit: BoardUnit; unitIdx: number } => Boolean(entry))
      .map((entry) => entry.unit);
    const canonicalUnitsMap = new Map<string, ReturnType<typeof resolveSet18Champion>>();

    placedUnits.forEach((u) => {
      const meta = resolveSet18Champion(u.championId);
      const canonicalKey = meta?.canonicalId || u.championId;
      if (!canonicalUnitsMap.has(canonicalKey)) {
        canonicalUnitsMap.set(canonicalKey, meta);
      }
    });

    canonicalUnitsMap.forEach((meta) => {
      if (meta && meta.traits) {
        meta.traits.forEach((trait) => {
          const cleanName = trait.replace(/^tft18_/i, "").replace(/^da_18_/i, "").replace(/^da_/i, "");
          if (!counts[cleanName]) {
            counts[cleanName] = { count: 0, name: cleanName };
          }
          counts[cleanName].count += 1;
        });
      }
    });

    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [grid]);

  const activeMovingUnit =
    selectedUnitIdxForMove !== null ? safeUnits[selectedUnitIdxForMove] : null;
  const activeMovingName = activeMovingUnit
    ? activeMovingUnit.nameVi || formatChampName(activeMovingUnit.championId)
    : "";

  const isUnitMatchingTrait = (champId: string, traitId: string | null) => {
    if (!traitId) return false;
    const meta = resolveSet18Champion(champId);
    if (!meta || !meta.traits) return false;
    return meta.traits.some(
      (t) =>
        t.toLowerCase().includes(traitId.toLowerCase()) ||
        traitId.toLowerCase().includes(t.toLowerCase())
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Thanh Tộc / Hệ Kích Hoạt */}
      {activeTraitsList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Tộc/Hệ trên sân:
          </span>
          {activeTraitsList.map((t) => {
            const isActive = activeTrait === t.name;

            return (
              <button
                key={t.name}
                type="button"
                onClick={() => setActiveTrait(isActive ? null : t.name)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-medium transition text-[11px] capitalize ${
                  isActive
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20"
                    : "bg-slate-950/60 text-slate-300 border-slate-700/70 hover:border-slate-500 hover:text-white"
                }`}
                title={`Click để làm sáng tướng thuộc hệ ${t.name}`}
              >
                <span>{formatTraitNameVi(t.name) || t.name}</span>
                <span className="text-[10px] px-1 rounded bg-black/40 text-slate-400 font-mono">
                  {t.count}
                </span>
              </button>
            );
          })}
          {activeTrait && (
            <button
              type="button"
              onClick={() => setActiveTrait(null)}
              className="text-[10px] text-slate-400 hover:text-slate-200 underline ml-auto px-1"
            >
              Bỏ chọn
            </button>
          )}
        </div>
      )}

      {/* Sơ đồ bàn cờ 4x7 - Tương tác di chuyển thông minh */}
      <div className="bg-[#131b2e] border border-slate-700/80 rounded-2xl p-3 sm:p-5 overflow-x-auto shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 mb-3 pb-2.5 border-b border-slate-700/70">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-black text-sm text-white">
              Sơ đồ vị trí đứng (Bàn cờ TFT 4 hàng x 7 ô)
            </span>
            {isCustomArrangement && (
              <span
                data-board-arrangement="custom"
                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40"
              >
                Bản sắp xếp cá nhân
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isCustomArrangement && (
              <button
                type="button"
                onClick={handleResetArrangement}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition shadow-sm"
                title="Khôi phục tọa độ bàn cờ chuẩn từ nguồn dữ liệu"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục bàn cờ gốc</span>
              </button>
            )}
          </div>
        </div>

        {/* Thanh hướng dẫn di chuyển trực quan */}
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs flex flex-wrap items-center justify-between gap-2">
          {selectedUnitIdxForMove !== null ? (
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Move className="w-4 h-4 animate-bounce text-amber-400" />
              <span>
                Đang chọn <strong>{activeMovingName}</strong>: Hãy nhấp vào bất kỳ ô trống hoặc tướng khác để di chuyển / đổi chỗ!
              </span>
              <button
                type="button"
                onClick={() => setSelectedUnitIdxForMove(null)}
                className="ml-2 text-slate-400 hover:text-white underline text-[11px]"
              >
                Hủy chọn
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>
                <strong>Mẹo di chuyển:</strong> Nhấp vào tướng rồi nhấp vào ô đích để di chuyển / đổi chỗ • Hoặc kéo thả chuột.
              </span>
            </div>
          )}
        </div>

        <div className="min-w-[480px] space-y-2 py-1" data-board-shape="hex-grid-4x7">
          {grid.map((row, rowIdx) => {
            const isIndented = rowIdx % 2 === 1;

            return (
              <div
                key={rowIdx}
                className="flex items-center gap-2"
                data-row-stagger={isIndented ? "indented" : "aligned"}
              >
                {/* Nhãn hàng */}
                <div className="w-14 flex-shrink-0 text-right pr-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block leading-tight">
                    {rowLabels[rowIdx].name}
                  </span>
                </div>

                {/* 7 ô cờ của hàng */}
                <div
                  className={`flex items-center gap-1.5 sm:gap-2 flex-1 ${
                    isIndented ? "pl-3 sm:pl-5" : ""
                  }`}
                >
                  {row.map((entry, colIdx) => {
                    const isMoveTarget = selectedUnitIdxForMove !== null && !entry;

                    if (!entry) {
                      // Ô trống lục giác
                      return (
                        <div
                          key={colIdx}
                          data-cell-shape="hex"
                          data-row={rowIdx}
                          data-col={colIdx}
                          style={{ clipPath: HEX_CLIP_PATH }}
                          onClick={() => handleCellClick(rowIdx, colIdx, null)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            let idxToMove: number | undefined = undefined;
                            try {
                              const raw = e.dataTransfer?.getData('text/plain');
                              if (raw) {
                                const num = Number(raw);
                                if (!isNaN(num)) idxToMove = num;
                              }
                            } catch {}
                            handleDropCell(rowIdx, colIdx, idxToMove);
                          }}
                          className={`w-14 sm:w-16 h-16 sm:h-18 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isMoveTarget
                              ? "border-emerald-400 bg-emerald-950/60 ring-2 ring-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-105"
                              : "border-dashed border-slate-700/60 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-800/40"
                          }`}
                          title={
                            isMoveTarget
                              ? `Nhấp để đặt ${activeMovingName} vào Hàng ${rowIdx + 1}, Ô ${colIdx + 1}`
                              : `${rowLabels[rowIdx].name}, Ô ${colIdx + 1} (Trống)`
                          }
                        >
                          {isMoveTarget ? (
                            <span className="text-[10px] font-black text-emerald-300 uppercase tracking-tighter">
                              Đặt vào
                            </span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                          )}
                        </div>
                      );
                    }

                    const { unit: cell, unitIdx } = entry;
                    const cost = cell.cost;
                    const borderStyle =
                      cost && costBorderColors[cost]
                        ? costBorderColors[cost]
                        : "border-slate-700 bg-slate-900/60";
                    const displayName = cell.nameVi || formatChampName(cell.championId);

                    const isCarry = cell.isCarry;
                    const isTank = cell.isTank;
                    const isSelected = selectedUnit?.championId === cell.championId;
                    const isBeingMoved = selectedUnitIdxForMove === unitIdx;
                    const isHighlightedTrait = isUnitMatchingTrait(cell.championId, activeTrait);
                    const imgUrl = getChampionImageUrl(cell.championId, displayName);

                    return (
                      <div
                        key={colIdx}
                        data-cell-shape="hex"
                        data-row={rowIdx}
                        data-col={colIdx}
                        style={{ clipPath: HEX_CLIP_PATH }}
                        draggable
                        onDragStart={(e) => {
                          setDraggedUnitIdx(unitIdx);
                          e.dataTransfer.setData("text/plain", String(unitIdx));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDraggedUnitIdx(null)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            let idxToMove: number | undefined = undefined;
                            try {
                              const raw = e.dataTransfer?.getData('text/plain');
                              if (raw) {
                                const num = Number(raw);
                                if (!isNaN(num)) idxToMove = num;
                              }
                            } catch {}
                            handleDropCell(rowIdx, colIdx, idxToMove);
                          }}
                        onClick={() => handleCellClick(rowIdx, colIdx, entry)}
                        onMouseEnter={() => setHoveredUnit(cell)}
                        onMouseLeave={() => setHoveredUnit(null)}
                        className={`relative w-14 sm:w-16 h-16 sm:h-18 rounded-xl border-2 flex flex-col justify-between overflow-hidden p-1 transition-all duration-200 cursor-pointer shadow-md group ${borderStyle} ${
                          isBeingMoved
                            ? "ring-4 ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.9)] scale-110 z-30 animate-pulse"
                            : isSelected
                            ? "ring-2 ring-emerald-400 scale-105 z-20 shadow-emerald-500/40"
                            : isHighlightedTrait
                            ? "ring-2 ring-amber-400 scale-105 z-10 shadow-amber-400/40 animate-pulse"
                            : isCarry
                            ? "ring-2 ring-amber-500 shadow-amber-500/40"
                            : isTank
                            ? "ring-2 ring-sky-500 shadow-sky-500/40"
                            : "hover:scale-105 hover:z-10"
                        }`}
                        title={`${displayName} (${cell.tier ? `${cell.tier}★` : "số sao chưa rõ"}, ${
                          cost != null ? `${cost} vàng` : "? vàng"
                        }) - Hàng ${rowIdx + 1}, Ô ${colIdx + 1}\nNhấp để chọn di chuyển hoặc đổi chỗ`}
                      >
                        {/* Ảnh chân dung tướng */}
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={displayName}
                            draggable={false}
                            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 pointer-events-none select-none"
                            loading="lazy"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase text-slate-400 bg-slate-900/80 pointer-events-none select-none">
                            {displayName.slice(0, 2)}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />

                        {/* Sao vàng & Vai trò Carry / Tank */}
                        <div className="relative z-10 flex items-center justify-between w-full leading-none pointer-events-none">
                          <span className="px-1 py-0.5 rounded bg-black/80 backdrop-blur-[2px] text-[9px] font-black text-amber-400 shadow-sm">
                            {cell.tier ? "★".repeat(cell.tier) : "★?"}
                          </span>
                          {isCarry && (
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
                              <Swords className="w-2.5 h-2.5" />
                            </span>
                          )}
                          {isTank && (
                            <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md">
                              <Shield className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>

                        {/* Tên tướng & Trang bị dưới chân */}
                        <div className="relative z-10 w-full flex flex-col items-center pointer-events-none">
                          <span className="text-[10px] font-black text-white truncate max-w-full leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                            {displayName}
                          </span>

                          {cell.items && cell.items.length > 0 && (
                            <div className="flex items-center gap-0.5 mt-0.5 justify-center flex-wrap">
                              {cell.items.slice(0, 3).map((it, iIdx) => (
                                <ItemMiniChip key={iIdx} itemName={it} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Khay dự bị: Tướng nguồn không có tọa độ đứng */}
        {unplacedUnits.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-700/60" data-testid="unplaced-bench">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Khay dự bị / Tướng chưa xác định tọa độ ({unplacedUnits.length})</span>
              <span className="text-[10px] text-slate-400 font-normal italic">
                (Nguồn không có tọa độ ô đứng, hiển thị ở khay dự bị để bảo toàn dữ liệu gốc)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {unplacedUnits.map((unit, uIdx) => {
                const displayName = unit.nameVi || formatChampName(unit.championId);
                const cost = unit.cost;
                return (
                  <div
                    key={uIdx}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-sm"
                  >
                    <ChampionAvatar championId={unit.championId} nameVi={displayName} cost={cost ?? undefined} size="sm" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white leading-tight">{displayName}</span>
                      <span className="text-[10px] text-amber-400 font-medium">{unit.tier ? `${unit.tier}★` : "★?"}</span>
                    </div>
                    {unit.items && unit.items.length > 0 && (
                      <div className="flex items-center gap-0.5 ml-1">
                        {unit.items.slice(0, 3).map((it, iIdx) => (
                          <ItemMiniChip key={iIdx} itemName={it} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Danh sách trang bị đề xuất (Item List) */}
      {showItemList && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            Trang bị tối ưu cho tướng theo dữ liệu nguồn (Chủ lực & Chống chịu)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {safeUnits
              .filter((u) => u.items && u.items.length > 0)
              .map((u, idx) => {
                const displayName = u.nameVi || formatChampName(u.championId);
                const cost = u.cost;
                const costStyle =
                  cost && costBorderColors[cost]
                    ? costBorderColors[cost]
                    : "border-slate-700 bg-[#161a26]";

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/90 border border-slate-700/80 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <ChampionAvatar
                        championId={u.championId}
                        nameVi={displayName}
                        cost={cost ?? undefined}
                        tier={u.tier ?? undefined}
                        isCarry={u.isCarry}
                        isTank={u.isTank}
                        size="sm"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white capitalize leading-tight">
                          {displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {u.isCarry ? "Chủ lực" : u.isTank ? "Chống chịu" : "Hỗ trợ"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {u.items?.map((it, iIdx) => (
                        <ItemBadge key={iIdx} itemName={it} size="sm" />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
