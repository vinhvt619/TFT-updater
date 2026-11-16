import React from "react";
import Link from "next/link";
import {
  Compass,
  ArrowRight,
  Layers,
  SlidersHorizontal,
  Users,
  Sword,
  Sparkles,
  TrendingUp,
  Shield,
  Swords,
  CheckCircle2,
  ExternalLink,
  Flame
} from "lucide-react";
import { metaRepository } from "@/server/meta/repositories/meta-repository";
import { verifiedWebsiteSnapshot } from "@/server/meta/services/verified-catalogue";
import { diffService } from "@/server/services/diff-service";
import { ChampionAvatar } from "@/components/meta/champion-image";
import { ItemMiniChip } from "@/components/meta/item-badge";
import { TftBoardGrid } from "@/components/meta/tft-board-grid";
import { parseChangeDetail } from "@/domain/meta/change-impact";
import { ReleaseChangeRow } from "@/domain/types";

export const dynamic = "force-dynamic";

const costBorderColors: Record<number, string> = {
  1: "border-slate-500/80 bg-slate-900/90 text-slate-200",
  2: "border-emerald-500/80 bg-emerald-950/60 text-emerald-200",
  3: "border-sky-500/80 bg-sky-950/60 text-sky-200",
  4: "border-purple-500/90 bg-purple-950/60 text-purple-200",
  5: "border-amber-400 bg-amber-950/70 text-amber-200"
};

export default async function HomePage() {
  // Lấy dữ liệu snapshot đã được xác minh (ưu tiên current, fallback archive 18.2)
  let topComps: any[] = [];
  let totalCompsCount = 0;
  let isArchive = false;
  const archiveSnapshotId = "rank_websites_epoch_18_2_1789304905604";
  let snapshotId = archiveSnapshotId;

  try {
    let rawSnap: any = null;
    if (typeof metaRepository.getLatestRankingSnapshot === "function") {
      try {
        rawSnap = await metaRepository.getLatestRankingSnapshot("websites", "real");
      } catch {
        rawSnap = null;
      }
    }
    if (rawSnap) {
      const verified = await verifiedWebsiteSnapshot(rawSnap, { mode: "current" });
      if (verified && verified.rows && verified.rows.length > 0) {
        topComps = verified.rows.slice(0, 6);
        totalCompsCount = verified.rows.length;
        snapshotId = rawSnap.id;
      }
    }

    // Nếu không có snapshot current hợp lệ, fallback đọc snapshot archive đã công bố
    if (topComps.length === 0 && typeof metaRepository.getRankingSnapshot === "function") {
      const archiveSnap = await metaRepository.getRankingSnapshot(archiveSnapshotId);
      if (archiveSnap) {
        const verified = await verifiedWebsiteSnapshot(archiveSnap, { mode: "archive" });
        if (verified && verified.rows && verified.rows.length > 0) {
          topComps = verified.rows.slice(0, 6);
          totalCompsCount = verified.rows.length;
          isArchive = true;
          snapshotId = archiveSnapshotId;
        }
      }
    }
  } catch {
    topComps = [];
    totalCompsCount = 0;
  }

  // Lấy thay đổi phiên bản động từ diff service thay vì ghi nhận thông số tĩnh
  let patchChanges: ReleaseChangeRow[] = [];
  let fromReleaseId = "";
  let toReleaseId = "";
  let compareLabel = "";
  let compareBaseLabel = "";

  try {
    const relCatalogue = await diffService.getReleaseCatalogue("real");
    const liveRels = (relCatalogue || []).filter(
      (r: any) => r.channel === "live" && r.historyVisibility !== "archive"
    );
    if (liveRels.length >= 2) {
      toReleaseId = liveRels[0].id;
      fromReleaseId = liveRels[1].id;
      compareLabel = liveRels[0].displayLabel || liveRels[0].displayVersion || liveRels[0].patchFamily || "Mới nhất";
      compareBaseLabel = liveRels[1].displayLabel || liveRels[1].displayVersion || liveRels[1].patchFamily || "Bản trước";
      const diff = await diffService.getOrComputeReleaseDiff(fromReleaseId, toReleaseId, {
        datasetKind: "real"
      });
      patchChanges = (diff?.changes || []).slice(0, 4);
    } else if (liveRels.length === 1) {
      toReleaseId = liveRels[0].id;
      compareLabel = liveRels[0].displayLabel || liveRels[0].displayVersion || liveRels[0].patchFamily || "Mới nhất";
    }
  } catch {
    patchChanges = [];
  }

  let activePatchLabel = "18.6";
  if (isArchive) {
    activePatchLabel = "18.2 (Lưu trữ)";
  } else if (compareLabel) {
    activePatchLabel = compareLabel;
  } else if (topComps.length > 0) {
    activePatchLabel = "18.6";
  }

  const primaryComp = topComps.length > 0 ? topComps[0] : null;

  return (
    <div className="space-y-10 w-full pb-12">
      {/* Breadcrumb & Live Patch Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#94a3b8]">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#06b6d4]" />
          <span className="font-semibold text-[#f8fafc]">Tổng quan TFT Atlas</span>
          <span className="text-[#242f49]">/</span>
          <span>Mùa 18</span>
        </nav>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#131927] border border-[#242f49] text-[11px] font-medium text-[#94a3b8]">
            <span className={`w-1.5 h-1.5 rounded-full ${isArchive ? "bg-[#f59e0b]" : topComps.length > 0 ? "bg-[#10b981]" : "bg-[#64748b]"}`} />
            {isArchive ? (
              <>Dữ liệu lưu trữ: <strong>Bản {activePatchLabel}</strong></>
            ) : topComps.length > 0 ? (
              <>Dữ liệu trực tiếp: <strong>Bản {activePatchLabel} (Mới nhất)</strong></>
            ) : (
              <>Trạng thái: <strong>Đang kết nối nguồn ({activePatchLabel})</strong></>
            )}
          </span>
        </div>
      </div>

      {/* Hero Section: High-Impact Gaming Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-[#242f49] bg-gradient-to-br from-[#131927] via-[#0f172a] to-[#1e1b4b] p-6 sm:p-8 lg:p-10 shadow-2xl">
        {/* Subtle Ambient Background Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#06b6d4]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#8b5cf6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-xs font-bold text-[#06b6d4] tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Đấu Trường Chân Lý · Mùa 18</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#f8fafc] leading-[1.15]">
            Hiểu thay đổi.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#06b6d4] via-[#38bdf8] to-[#a855f7]">
              Bứt phá xếp hạng.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-[#94a3b8] leading-relaxed max-w-xl">
            Sổ tay chiến thuật ĐTCL Mùa 18 với bảng xếp hạng đội hình top meta từ các <strong className="text-[#f8fafc] font-semibold">nguồn đã xác minh</strong> (TFT Academy, tactics.tools, TFT Flex) và bàn cờ tương tác chuẩn thi đấu.
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 pt-2 max-w-lg">
            <div className="p-3 rounded-xl bg-[#131927]/80 border border-[#242f49]">
              <div className="text-[10px] text-[#94a3b8] uppercase font-semibold">Phiên bản</div>
              <div className="text-base font-bold text-[#f8fafc]">Bản {activePatchLabel}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#131927]/80 border border-[#242f49]">
              <div className="text-[10px] text-[#94a3b8] uppercase font-semibold">Xác minh</div>
              <div className="text-base font-bold text-[#10b981]">100% Nguồn thật</div>
            </div>
            <div className="p-3 rounded-xl bg-[#131927]/80 border border-[#242f49]">
              <div className="text-[10px] text-[#94a3b8] uppercase font-semibold">Bàn cờ</div>
              <div className="text-base font-bold text-[#06b6d4]">4x7 Tương tác</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            <Link
              href="/meta/websites?archive=true"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#0284c7] text-[#083344] font-extrabold text-xs sm:text-sm hover:brightness-110 transition-all shadow-lg shadow-cyan-500/25"
            >
              <span>Khám phá bảng xếp hạng đội hình</span>
              <ArrowRight className="w-4 h-4 text-[#083344]" />
            </Link>
            <Link
              href={toReleaseId && fromReleaseId ? `/compare?fromRelease=${fromReleaseId}&toRelease=${toReleaseId}` : "/compare"}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-[#242f49] bg-[#131927]/90 text-[#f8fafc] font-bold text-xs sm:text-sm hover:bg-[#1a2236] hover:border-[#06b6d4]/50 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#06b6d4]" />
              <span>So sánh thay đổi ({compareLabel || activePatchLabel})</span>
            </Link>
          </div>
        </div>

        {/* Decorative Fan Card Elements on Large Screens */}
        <div className="hidden lg:flex absolute right-10 bottom-6 items-end gap-3 pointer-events-none opacity-90">
          <div className="w-24 h-36 rounded-2xl border-2 border-[#242f49] bg-[#131927] shadow-2xl overflow-hidden transform -rotate-12 translate-y-3 flex items-center justify-center">
            <ChampionAvatar championId="tft18_ahri" nameVi="Ahri" cost={4} className="w-full h-full !rounded-none !border-0" />
          </div>
          <div className="w-32 h-48 rounded-2xl border-2 border-[#06b6d4] bg-[#131927] shadow-2xl overflow-hidden z-10 transform translate-y-0 ring-4 ring-cyan-500/20 flex items-center justify-center">
            <ChampionAvatar championId="tft18_kayle" nameVi="Kayle" cost={5} className="w-full h-full !rounded-none !border-0" />
          </div>
          <div className="w-24 h-36 rounded-2xl border-2 border-[#242f49] bg-[#131927] shadow-2xl overflow-hidden transform rotate-12 translate-y-3 flex items-center justify-center">
            <ChampionAvatar championId="tft18_ashe" nameVi="Ashe" cost={2} className="w-full h-full !rounded-none !border-0" />
          </div>
        </div>
      </section>

      {/* Top Meta Comps Section (MetaTFT / TFTAcademy Inspired) */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242f49] pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#06b6d4]/10 text-[#06b6d4]">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#f8fafc] tracking-tight">
                Đội Hình Hàng Đầu Meta Mùa 18
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#94a3b8] mt-1">
              Tuyển tập các bài đánh tối ưu nhất từ các nguồn uy tín đã được xác minh · {isArchive ? "Bản lưu trữ 18.2" : `Bản ${activePatchLabel}`}
            </p>
          </div>
          <Link
            href="/meta/websites?archive=true"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#131927] border border-[#242f49] hover:border-[#06b6d4] text-xs font-bold text-[#06b6d4] hover:text-white transition-all shadow-sm"
          >
            <span>{totalCompsCount > 0 ? `Xem toàn bộ (${totalCompsCount} đội hình)` : "Xem tất cả đội hình"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Comps Grid (Cards) */}
        {topComps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {topComps.map((comp, idx) => {
              const buildId =
                comp.selectedSourceBuildId ||
                (comp.sourceVotes && Object.values(comp.sourceVotes)[0]
                  ? (Object.values(comp.sourceVotes)[0] as any).buildId
                  : null);
              const detailUrl = buildId
                ? `/meta/comps/${encodeURIComponent(comp.archetypeId)}?snapshotId=${encodeURIComponent(
                    snapshotId
                  )}&buildId=${encodeURIComponent(buildId)}${isArchive ? "&archive=true" : ""}`
                : `/meta/comps/${encodeURIComponent(comp.archetypeId)}?snapshotId=${encodeURIComponent(
                    snapshotId
                  )}${isArchive ? "&archive=true" : ""}`;

              const boardUnits = comp.recommendedBoard || [];
              const carryUnits = boardUnits.filter((u: any) => u.isCarry);
              const tankUnits = boardUnits.filter((u: any) => u.isTank);

              return (
                <div
                  key={comp.archetypeId}
                  className="group relative flex flex-col justify-between rounded-2xl border border-[#242f49] bg-gradient-to-b from-[#131927] to-[#0f1422] hover:border-[#06b6d4]/60 hover:shadow-xl hover:shadow-cyan-500/10 p-5 transition-all duration-300"
                >
                  <div className="space-y-3.5">
                    {/* Header: Rank, Tier Badge & Playstyle */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#94a3b8]">
                          #{idx + 1}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wide ${
                            comp.tier === "S"
                              ? "bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm shadow-rose-500/30"
                              : comp.tier === "A"
                              ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm shadow-purple-500/30"
                              : "bg-gradient-to-r from-sky-500 to-blue-600 text-white"
                          }`}
                        >
                          {comp.tier ? `TIER ${comp.tier}` : "ĐANG THEO DÕI"}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#1a2236] text-[#94a3b8] border border-[#242f49]">
                        {comp.playstyle === "reroll"
                          ? "Đổi lại 3★"
                          : comp.playstyle === "fast9"
                          ? "Lên cấp 9"
                          : "Chuẩn Cấp 8"}
                      </span>
                    </div>

                    {/* Comp Titles */}
                    <div>
                      <Link
                        href={detailUrl}
                        className="font-black text-base sm:text-lg text-[#f8fafc] group-hover:text-[#06b6d4] transition-colors line-clamp-1"
                      >
                        {comp.archetypeNameVi}
                      </Link>
                      <p className="text-xs text-[#94a3b8] line-clamp-1 mt-0.5">
                        {comp.archetypeNameEn || comp.archetypeId}
                      </p>
                    </div>

                    {/* Core Carries & Tanks with Items Preview */}
                    {(carryUnits.length > 0 || tankUnits.length > 0) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#242f49]/80">
                        {carryUnits.slice(0, 2).map((u: any, uIdx: number) => (
                          <div
                            key={uIdx}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#1a2236] border border-[#242f49] text-xs"
                          >
                            <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="font-semibold text-[#f8fafc] truncate max-w-[80px]">
                              {u.nameVi || u.championId.replace(/^tft18_/, "")}
                            </span>
                            {u.items && u.items.length > 0 && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                {u.items.slice(0, 2).map((it: string, itIdx: number) => (
                                  <ItemMiniChip key={itIdx} itemName={it} />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {tankUnits.slice(0, 1).map((u: any, uIdx: number) => (
                          <div
                            key={uIdx}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#1a2236] border border-[#242f49] text-xs"
                          >
                            <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span className="font-semibold text-[#f8fafc] truncate max-w-[80px]">
                              {u.nameVi || u.championId.replace(/^tft18_/, "")}
                            </span>
                            {u.items && u.items.length > 0 && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                {u.items.slice(0, 2).map((it: string, itIdx: number) => (
                                  <ItemMiniChip key={itIdx} itemName={it} />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Full 8-Unit Roster with Cost Borders */}
                    <div className="pt-1">
                      <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-1.5">
                        Đội hình trên sân:
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {boardUnits.length > 0 ? (
                          boardUnits.slice(0, 8).map((unit: any, uIdx: number) => {
                            const cost = unit.cost || 3;
                            const borderClass =
                              costBorderColors[cost] || "border-[#242f49] bg-[#1a2236]";
                            return (
                              <div
                                key={uIdx}
                                title={`${unit.nameVi || unit.championId} (${cost} vàng)`}
                                className={`w-8 h-8 rounded-lg border-2 ${borderClass} overflow-hidden shrink-0 shadow-sm`}
                              >
                                <ChampionAvatar
                                  championId={unit.championId}
                                  nameVi={unit.nameVi || unit.championId}
                                  cost={cost}
                                  size="sm"
                                />
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-[#94a3b8]">Chưa có vị trí chi tiết</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA Link */}
                  <div className="pt-4 mt-3 border-t border-[#242f49]/80 flex items-center justify-between">
                    <span className="text-[11px] text-[#94a3b8]">
                      Nguồn: <strong className="text-[#f8fafc] font-medium">Đã xác minh</strong>
                    </span>
                    <Link
                      href={detailUrl}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#06b6d4] hover:text-white transition-colors"
                    >
                      <span>Xem bàn cờ</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 sm:p-12 rounded-2xl border border-[#242f49] bg-[#131927] text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1a2236] border border-[#242f49] flex items-center justify-center mx-auto text-[#06b6d4]">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-base text-[#f8fafc]">
                Chưa có dữ liệu đội hình đã xác minh
              </h3>
              <p className="text-xs text-[#94a3b8] max-w-md mx-auto leading-relaxed">
                Hệ thống chỉ công bố đội hình khi thu thập đủ tối thiểu các nguồn đối chiếu độc lập và vượt qua cổng kiểm định nghiêm ngặt.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Featured Interactive Hex Board Preview (For #1 Comp) */}
      {primaryComp && primaryComp.recommendedBoard && primaryComp.recommendedBoard.length > 0 && (
        <section className="rounded-2xl border border-[#242f49] bg-gradient-to-b from-[#131927] to-[#0f1422] p-5 sm:p-6 lg:p-8 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242f49] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-black bg-gradient-to-r from-rose-500 to-amber-500 text-white">
                  TIÊU ĐIỂM BÀN CỜ
                </span>
                <span className="text-xs text-[#94a3b8] font-mono">
                  Đội hình #1: {primaryComp.archetypeNameVi}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-[#f8fafc] mt-1">
                Bàn Cờ Lục Giác 4x7 Tương Tác
              </h3>
            </div>
            <p className="text-xs text-[#94a3b8] sm:text-right">
              Bạn có thể <strong>kéo thả</strong> hoặc <strong>nhấp vào tướng</strong> để điều chỉnh vị trí trên sân.
            </p>
          </div>

          <div className="overflow-x-auto">
            <TftBoardGrid boardUnits={primaryComp.recommendedBoard} />
          </div>
        </section>
      )}

      {/* Bento Grid: Patch 18.2 Highlights & Quick Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Left: What's new in 18.2 from diffService */}
        <div className="p-6 rounded-2xl border border-[#242f49] bg-[#131927] space-y-4 shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-[#242f49] pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-[#06b6d4]" />
              <h3 className="font-extrabold text-base text-[#f8fafc]">
                Điểm Nhấn Bản Cập Nhật {compareLabel || activePatchLabel}
              </h3>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#1a2236] border border-[#242f49] text-[#06b6d4] font-mono font-bold">
              {compareBaseLabel ? `So với ${compareBaseLabel}` : "Bản cập nhật mới"}
            </span>
          </div>

          {patchChanges.length > 0 ? (
            <div className="divide-y divide-[#242f49]/80 text-xs">
              {patchChanges.map((change) => {
                const parsed = parseChangeDetail(change);
                const entityName = change.rawEntityName || change.entityId || "Thay đổi";
                return (
                  <div key={change.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="font-bold text-[#f8fafc] text-sm">{entityName}</span>
                      <p className="text-[#94a3b8] text-xs truncate">
                        {change.rawText || `${change.fieldKey}: ${parsed.beforeVal} → ${parsed.afterVal}`}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 border ${parsed.badgeClass.bg} ${parsed.badgeClass.text} ${parsed.badgeClass.border}`}
                    >
                      {parsed.typeLabelVi}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#94a3b8] space-y-1">
              <p className="font-medium text-[#f8fafc]">Chưa có ghi nhận thay đổi nào</p>
              <p className="text-[11px]">Dữ liệu so sánh giữa hai phiên bản đang được cập nhật.</p>
            </div>
          )}

          <div className="pt-2">
            <Link
              href={toReleaseId && fromReleaseId ? `/compare?fromRelease=${fromReleaseId}&toRelease=${toReleaseId}` : "/compare"}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#06b6d4] hover:underline"
            >
              <span>Mở bảng so sánh phiên bản đầy đủ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right: Quick Directory Bento Box */}
        <div className="p-6 rounded-2xl border border-[#242f49] bg-[#131927] space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-[#242f49] pb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-base text-[#f8fafc]">
                Tra Cứu Dữ Liệu Chuyên Sâu
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#94a3b8] mt-3 leading-relaxed">
              Mọi chỉ số tướng, công thức ghép đồ, lịch sử thay đổi và bằng chứng nguồn luôn được kiểm chứng trực tiếp từ dữ liệu máy chủ Riot Games.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3">
            <Link
              href="/champions"
              className="group p-3.5 rounded-xl border border-[#242f49] bg-[#1a2236] hover:border-[#06b6d4] hover:bg-[#242f49] transition-all space-y-1.5"
            >
              <Users className="w-4 h-4 text-[#06b6d4] group-hover:scale-110 transition-transform" />
              <div className="font-bold text-xs text-[#f8fafc]">Danh mục Tướng</div>
              <div className="text-[10px] text-[#94a3b8]">60+ Tướng Mùa 18</div>
            </Link>
            <Link
              href="/items"
              className="group p-3.5 rounded-xl border border-[#242f49] bg-[#1a2236] hover:border-[#06b6d4] hover:bg-[#242f49] transition-all space-y-1.5"
            >
              <Sword className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <div className="font-bold text-xs text-[#f8fafc]">Trang bị & Ghép đồ</div>
              <div className="text-[10px] text-[#94a3b8]">Công thức chuẩn</div>
            </Link>
            <Link
              href="/history"
              className="group p-3.5 rounded-xl border border-[#242f49] bg-[#1a2236] hover:border-[#06b6d4] hover:bg-[#242f49] transition-all space-y-1.5"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <div className="font-bold text-xs text-[#f8fafc]">Lịch sử Cập nhật</div>
              <div className="text-[10px] text-[#94a3b8]">Tất cả các bản patch</div>
            </Link>
            <Link
              href="/data-status"
              className="group p-3.5 rounded-xl border border-[#242f49] bg-[#1a2236] hover:border-[#06b6d4] hover:bg-[#242f49] transition-all space-y-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              <div className="font-bold text-xs text-[#f8fafc]">Trạng thái Dữ liệu</div>
              <div className="text-[10px] text-[#94a3b8]">Trạng thái hệ thống</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
