"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RankingRow } from "@/domain/meta/schemas";
import { getArchetypeById } from "@/domain/meta/archetypes";
import { TierBadge, ConditionBadge } from "./tier-badge";
import { SourceVoteMatrix } from "./source-vote-matrix";
import { TftBoardGrid } from "./tft-board-grid";
import { ItemMiniChip } from "./item-badge";
import { ChampionAvatar } from "./champion-image";
import { getCurrentLivePatchEpochId, getPatchEpoch } from "@/domain/meta/patch-epochs";
import {
  Swords,
  Shield,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  ExternalLink
} from "lucide-react";

interface CompRowProps {
  row: RankingRow;
  boardType: "websites" | "elite";
  rankNumber: number;
  isExpanded?: boolean;
  datasetKind?: "real" | "demo";
  patchEpochId?: string;
  snapshotId?: string;
  isArchive?: boolean;
}

const costBorderColors: Record<number, string> = {
  1: "border-slate-500/80 bg-slate-900/90 text-slate-200",
  2: "border-emerald-500/80 bg-emerald-950/60 text-emerald-200",
  3: "border-sky-500/80 bg-sky-950/60 text-sky-200",
  4: "border-purple-500/90 bg-purple-950/60 text-purple-200",
  5: "border-amber-400 bg-amber-950/70 text-amber-200"
};

export function CompRow({
  row,
  boardType,
  rankNumber,
  isExpanded: controlledExpanded,
  datasetKind = "real",
  patchEpochId = getCurrentLivePatchEpochId(),
  snapshotId,
  isArchive
}: CompRowProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const detailQuery = new URLSearchParams();
  detailQuery.set("mode", datasetKind);
  if (patchEpochId) detailQuery.set("patch", patchEpochId);
  if (snapshotId) detailQuery.set("snapshotId", snapshotId);
  const isArchiveEffective = Boolean(isArchive || snapshotId);
  if (isArchiveEffective) detailQuery.set("archive", "true");
  if (row.selectedSourceBuildId) detailQuery.set("buildId", row.selectedSourceBuildId);
  const detailHref = `/meta/comps/${row.archetypeId}?${detailQuery.toString()}`;

  const isWebsites = boardType === "websites";

  // Rút gọn tên tướng canonical để hiển thị ngắn gọn đẹp mắt
  const formatChampName = (id: string) => {
    return id
      .replace(/^tft18_da_18_/, "")
      .replace(/^tft18_da_/, "")
      .replace(/^tft18_/, "")
      .replace(/_ad$/, "")
      .replace(/\d+$/, "");
  };

  const staticArch = datasetKind === "real" ? null : getArchetypeById(row.archetypeId);
  const boardUnits =
    row.recommendedBoard &&
    row.recommendedBoard.length > 0
      ? row.recommendedBoard
      : datasetKind === "real"
      ? []
      : staticArch?.variants?.[0]?.recommendedBoard || [];
  const boardProvenance = boardUnits.find((unit) => unit.boardProvenance)?.boardProvenance;
  const boardCompleteness = boardProvenance?.boardCompleteness || null;

  return (
    <div className="group rounded-2xl bg-gradient-to-r from-[#111522] via-[#0e121c] to-[#090b12] hover:from-[#141929] hover:via-[#111624] hover:to-[#0c0f18] border border-white/[0.08] hover:border-amber-400/40 p-4 sm:p-5 transition-all duration-300 shadow-lg hover:shadow-xl space-y-4">
      {/* Header Row: Thông tin tóm tắt chuẩn MetaTFT & TFTAcademy */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Khối bên trái: Thứ tự, Tier, Tên và Tướng core */}
        <div className="flex items-start gap-3.5 sm:gap-4 flex-1 min-w-0">
          <div className="flex flex-col items-center justify-center pt-0.5 shrink-0">
            <span className="text-[11px] text-slate-500 font-mono font-bold mb-1">
              #{rankNumber}
            </span>
            <TierBadge
              tier={row.tier}
              candidateTier={row.candidateTier}
              status={row.status}
              size="md"
            />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInternalExpanded(!isExpanded)}
                className="font-black text-base sm:text-lg text-white hover:text-amber-300 transition-colors flex items-center gap-2 text-left tracking-tight"
                title="Click để chọn đội hình, xem vị trí xếp bài và trang bị tối ưu"
              >
                <span className="truncate">
                  {row.archetypeNameVi || row.archetypeId}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform text-amber-400 shrink-0 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              <Link
                href={detailHref}
                prefetch={true}
                className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.06] hover:bg-amber-400/20 text-slate-200 hover:text-amber-300 transition-colors border border-white/[0.1] hover:border-amber-400/50 inline-flex items-center gap-1 shadow-sm font-bold"
                title="Mở trang chi tiết đội hình"
              >
                <span>Chi tiết</span>
                <ExternalLink className="w-3 h-3 text-amber-400" />
              </Link>

              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                {getPatchEpoch(patchEpochId)?.label || patchEpochId}
              </span>

              {row.playstyle && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-300 border border-white/[0.08] font-semibold capitalize">
                  {row.playstyle === "reroll"
                    ? "Đổi lại 3★"
                    : row.playstyle === "fast8"
                    ? "Lên cấp nhanh 8"
                    : "Tiêu chuẩn"}
                </span>
              )}

              {row.requiredConditions?.map((cond, idx) => (
                <ConditionBadge key={idx} text={cond} />
              ))}
              {datasetKind === "real" && boardCompleteness && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                    boardCompleteness === "exact"
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/80"
                      : boardCompleteness === "conditional"
                      ? "bg-amber-950/80 text-amber-300 border-amber-700/80"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  Bàn cờ {boardCompleteness === "exact" ? "đầy đủ" : boardCompleteness === "conditional" ? "có điều kiện" : "một phần"}
                </span>
              )}
            </div>

            {datasetKind === "real" && boardProvenance && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>Nguồn: <strong className="text-slate-300">{boardProvenance.sourceId}</strong></span>
                <span>•</span>
                <span>Bản dựng: <strong className="text-slate-300">{boardProvenance.buildId}</strong></span>
                {boardProvenance.sourceUrl && (
                  <a
                    href={boardProvenance.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium ml-1"
                  >
                    Mở nguồn gốc <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* DANH SÁCH TƯỚNG & TRANG BỊ TÓM TẮT (FULL ROSTER PREVIEW - MetaTFT & TFTAcademy Style) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {boardUnits.length > 0 ? (
                boardUnits.map((u, idx) => {
                  const cost = u.cost;
                  const costText = cost !== undefined && cost !== null ? `${cost} vàng` : "? vàng";
                  const style = cost
                    ? costBorderColors[cost] || "border-slate-600 bg-[#161a26] text-slate-300"
                    : "border-slate-700 bg-[#161a26] text-slate-400";
                  const isCarry = u.isCarry;
                  const isTank = u.isTank;
                  const displayName = u.nameVi || formatChampName(u.championId);

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-xl border text-xs shadow-sm transition-all duration-200 hover:scale-105 ${style} ${
                        isCarry
                          ? "ring-2 ring-amber-400/80 bg-amber-950/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                          : isTank
                          ? "ring-2 ring-sky-400/80 bg-sky-950/50 shadow-[0_0_12px_rgba(14,165,233,0.3)]"
                          : ""
                      }`}
                      title={`${displayName} (${u.tier ? `${u.tier}★` : "số sao chưa rõ"}, ${costText}) - Đồ: ${
                        u.items?.join(", ") || "Không có đồ"
                      }`}
                    >
                      {/* Chân dung tướng */}
                      <ChampionAvatar
                        championId={u.championId}
                        nameVi={displayName}
                        cost={cost ?? undefined}
                        tier={u.tier ?? undefined}
                        isCarry={isCarry}
                        isTank={isTank}
                        size="xs"
                      />

                      <div className="flex flex-col">
                        <span className="font-bold text-[11px] text-white capitalize leading-tight">
                          {displayName}
                        </span>
                      </div>

                      {/* 1-3 chips trang bị nhỏ gọn ngay trên tướng */}
                      {u.items && u.items.length > 0 && (
                        <div className="flex items-center gap-0.5 ml-0.5">
                          {u.items.slice(0, 3).map((item, iIdx) => (
                            <ItemMiniChip key={iIdx} itemName={item} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : row.coreChampionIds && row.coreChampionIds.length > 0 && datasetKind !== "real" ? (
                row.coreChampionIds.map((cid, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-300 capitalize font-medium"
                  >
                    {formatChampName(cid)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 italic">
                  Chưa có dữ liệu đội hình kiểm chứng từ nguồn
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Khối bên phải: Điểm số và Điều khiển mở rộng */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-5 border-t lg:border-t-0 border-white/[0.08] pt-3 lg:pt-0 shrink-0">
          {isWebsites ? (
            /* Mục A: Điểm đồng thuận & Ma trận 5 Website */
            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-end gap-3">
                <span className="text-xs text-slate-400 font-medium">
                  {row.consensusLabel || "Đồng thuận"}
                </span>
                <div className="text-right">
                  <span className="text-2xl font-black text-amber-400">
                    {row.score !== null ? `${Math.round(row.score)}` : "—"}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">/100</span>
                </div>
              </div>

              <SourceVoteMatrix sourceVotes={row.sourceVotes} />
            </div>
          ) : (
            /* Mục B: Số liệu cao thủ (Top 4 thô, Win thô, Hạng TB, Lượt/Trận/Acc) */
            <div className="grid grid-cols-4 sm:flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
              <div className="text-left sm:text-right">
                <div className="text-[11px] text-slate-400 font-medium">Điểm cao thủ</div>
                <div className="text-lg font-black text-purple-400">
                  {row.score !== null ? Math.round(row.score) : "—"}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-[11px] text-slate-400 font-medium">Vào Top 4</div>
                <div className="text-lg font-black text-emerald-400">
                  {row.rawMetrics?.rawTop4Rate !== null &&
                  row.rawMetrics?.rawTop4Rate !== undefined
                    ? `${(Number(row.rawMetrics.rawTop4Rate) * 100).toFixed(1)}%`
                    : "—"}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-[11px] text-slate-400 font-medium">Hạng TB</div>
                <div className="text-lg font-black text-amber-400">
                  {row.rawMetrics?.rawAveragePlacement !== null &&
                  row.rawMetrics?.rawAveragePlacement !== undefined
                    ? `#${Number(row.rawMetrics.rawAveragePlacement).toFixed(2)}`
                    : "—"}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-[11px] text-slate-400 font-medium">Lượt / Trận</div>
                <div className="text-xs font-bold text-slate-200">
                  {row.rawMetrics?.appearances || 0} /{" "}
                  {row.rawMetrics?.uniqueMatches || 0}
                </div>
              </div>
            </div>
          )}

          {/* Nút bấm Xem Bàn Cờ & Trang Bị (Accordion Toggle) */}
          <button
            onClick={() => setInternalExpanded(!isExpanded)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-md ${
              isExpanded
                ? "bg-amber-400 text-slate-950 border-amber-300 shadow-amber-400/20"
                : "bg-white/[0.04] text-slate-200 border-white/[0.1] hover:bg-white/[0.08] hover:border-amber-400/40 hover:text-white"
            }`}
            title="Mở đội hình và trang bị được nguồn ghi nhận"
          >
            <Layers className="w-4 h-4" />
            <span>{isExpanded ? "Đóng bàn cờ" : "Xem xếp bài & Đồ tối ưu"}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* ACCORDION NỘI DUNG MỞ RỘNG: SƠ ĐỒ BÀN CỜ 4x7 & TRANG BỊ CHI TIẾT */}
      {isExpanded && (
        <div className="pt-4 border-t border-white/[0.08] space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Vị trí xếp bài và trang bị tối ưu cho tướng</span>
            </h3>

            <Link
              href={`/meta/comps/${row.archetypeId}`}
              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold"
            >
              <span>Xem trang phân tích chi tiết</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Sơ đồ bàn cờ TFT 4x7 Hex Grid hoặc Empty State trung thực */}
          {boardUnits.length > 0 ? (
            <TftBoardGrid boardUnits={boardUnits} />
          ) : (
            <div className="py-8 px-4 text-center rounded-2xl bg-[#0a0d14]/70 border border-dashed border-white/[0.08] text-slate-400 space-y-2">
              <span className="inline-block p-2 rounded-full bg-white/[0.04] text-amber-400">
                <Layers className="w-5 h-5" />
              </span>
              <p className="text-sm font-medium text-slate-300">Chưa có bố trí bàn cờ từ nguồn kiểm chứng thực tế</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hệ thống tuân thủ nguyên tắc không suy đoán và không dùng dữ liệu giả lập lấp chỗ trống.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
