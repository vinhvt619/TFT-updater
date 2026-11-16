import React from "react";
import { metaRepository } from "@/server/meta/repositories/meta-repository";
import { TierBoard } from "@/components/meta/tier-board";
import Link from "next/link";
import { AlertCircle, Clock, ExternalLink, ShieldCheck, BarChart2 } from "lucide-react";
import { getCurrentLivePatchEpochId, getPatchEpoch } from "@/domain/meta/patch-epochs";
import { verifySourceObservation } from "@/server/meta/services/source-verification";
import { verifiedWebsiteSnapshot } from "@/server/meta/services/verified-catalogue";

export const dynamic = "force-dynamic";

interface MetaWebsitesPageProps {
  searchParams?: Promise<{ mode?: string; patch?: string; snapshotId?: string; archive?: string }>;
}

export default async function MetaWebsitesPage({ searchParams }: MetaWebsitesPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const requestedMode = "real";
  const requestedSnapshotId = resolvedParams.snapshotId || (resolvedParams as any).snapshot;
  const isHistoricalSnapshot = Boolean(requestedSnapshotId || resolvedParams.archive === "true");
  const isArchive = isHistoricalSnapshot;
  const patchEpochId = resolvedParams.patch || getCurrentLivePatchEpochId();
  const patchLabel = getPatchEpoch(patchEpochId)?.label || patchEpochId;

  // Read-only query: tuyệt đối không gọi compute hay mutate dữ liệu trong luồng GET / render trang
  let rawSnapshot: any = null;
  if (requestedSnapshotId) {
    const snap = await metaRepository.getRankingSnapshot(requestedSnapshotId);
    const snapPatch = snap?.rankingScope?.patchEpochId || (snap as any)?.patchEpochId;
    const snapBoardType = snap?.rankingScope?.boardType || (snap as any)?.boardType;
    if (
      snap &&
      snapPatch === patchEpochId &&
      snap.datasetKind === requestedMode &&
      snapBoardType === "websites"
    ) {
      rawSnapshot = snap;
    } else {
      rawSnapshot = null;
    }
  } else {
    rawSnapshot = await metaRepository.getLatestRankingSnapshot("websites", requestedMode, { patchEpochId });
  }

  // Lấy các quan sát thật đã được kiểm chứng (nếu ở chế độ real)
  const realObservations = requestedMode === "real"
    ? await metaRepository.getLatestSourceObservations(patchEpochId, "real")
    : [];

  // FIN-02: Tách freshness hiện tại (real-time clock) và lưu trữ theo phiên bản (snapshot clock).
  // Ngưỡng cảnh báo: 48h, Ngưỡng loại tối đa: 72h.
  const maxAgeHours = 72;
  const archiveRefTime =
    rawSnapshot?.rankingGeneratedAt ||
    rawSnapshot?.generatedAt ||
    rawSnapshot?.sourceDataAsOf ||
    new Date(Date.now()).toISOString();

  const effectiveMode = isArchive ? "archive" : "current";
  const referenceTime = effectiveMode === "archive" ? archiveRefTime : new Date(Date.now()).toISOString();

  const snapshot = rawSnapshot
    ? await verifiedWebsiteSnapshot(rawSnapshot, {
        referenceTime,
        mode: effectiveMode,
        maxAgeHours
      })
    : null;

  // Kiểm định từng quan sát bằng gate xác thực thực tế (resolve artifact/storage, evidence lineage, freshness, scope)
  const verificationResults = await Promise.all(
    realObservations.map(async (obs) => {
      const res = await verifySourceObservation(obs, {
        patchEpochId,
        maxAgeHours,
        referenceTime
      });
      return { obs, verified: res.verified, report: res };
    })
  );

  const validObservations = verificationResults
    .filter((r) => r.verified)
    .map((r) => r.obs);

  const allAcademyObs = realObservations.filter((o) => o.sourceId === "tftacademy");
  const allMetatftObs = realObservations.filter((o) => o.sourceId === "metatft");
  const allTftflexObs = realObservations.filter((o) => o.sourceId === "tftflex");
  const allDatatftObs = realObservations.filter((o) => o.sourceId === "datatft");
  const allTacticsObs = realObservations.filter((o) => o.sourceId === "tactics_tools");

  const academyObs = validObservations.filter((o) => o.sourceId === "tftacademy");
  const metatftObs = validObservations.filter((o) => o.sourceId === "metatft");
  const tftflexObs = validObservations.filter((o) => o.sourceId === "tftflex");
  const datatftObs = validObservations.filter((o) => o.sourceId === "datatft");
  const tacticsObs = validObservations.filter((o) => o.sourceId === "tactics_tools");

  const verifiedSources = [
    academyObs.length > 0 ? "TFT Academy" : null,
    metatftObs.length > 0 ? "MetaTFT" : null,
    tftflexObs.length > 0 ? "TFT Flex" : null,
    datatftObs.length > 0 ? "DataTFT" : null,
    tacticsObs.length > 0 ? "tactics.tools" : null
  ].filter(Boolean) as string[];
  const verifiedCount = verifiedSources.length;

  const activeSnapshotId = requestedSnapshotId || snapshot?.id;
  const makeCompHref = (archId: string) =>
    `/meta/comps/${archId}?mode=real${patchEpochId ? `&patch=${patchEpochId}` : ""}${activeSnapshotId ? `&snapshotId=${encodeURIComponent(activeSnapshotId)}` : ""}${isArchive ? `&archive=true` : ""}`;

  const renderSourceBadge = (sourceId: string, validCount: number, allSourceObs: any[]) => {
    if (validCount > 0) {
      const unit = sourceId === "tftacademy" ? "guide" : "comp";
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Đã xác minh ({validCount} {unit})
        </span>
      );
    }
    if (allSourceObs.length === 0) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.08]">
          {sourceId === "tftacademy" ? "Chưa có dữ liệu" : "Đang thu thập"}
        </span>
      );
    }

    const sourceResults = verificationResults.filter((r) => r.obs.sourceId === sourceId);
    const hasStale = sourceResults.some(
      (r) => !r.report.gates.freshnessPass || r.obs.status === "stale" || r.report.reason?.includes("quá hạn")
    );
    if (hasStale) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Dữ liệu quá hạn
        </span>
      );
    }

    const hasEmptyEvidence = sourceResults.some(
      (r) =>
        !r.report.gates.evidencePresencePass ||
        r.report.reason?.includes("Thiếu bằng chứng") ||
        (!r.obs.evidenceRefIds || r.obs.evidenceRefIds.length === 0)
    );
    if (hasEmptyEvidence) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Thiếu bằng chứng
        </span>
      );
    }

    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
        Chưa xác minh
      </span>
    );
  };

  const rawDataTimestamp = snapshot?.sourceDataAsOf || (realObservations.length > 0 ? realObservations[0].sourceDataAsOf || realObservations[0].observedAt : null);
  const dataTimestamp = rawDataTimestamp ? new Date(rawDataTimestamp) : null;
  const dataAgeHours = dataTimestamp ? Math.floor((Date.now() - dataTimestamp.getTime()) / (1000 * 60 * 60)) : null;
  const isStale = dataAgeHours !== null && dataAgeHours > 48;

  const formatChamp = (id?: string | null) => {
    if (!id) return "";
    const cleaned = id
      .replace(/^tft18_da_18_/i, "")
      .replace(/^tft18_da_/i, "")
      .replace(/^tft18_/i, "")
      .replace(/^da_18_/i, "")
      .replace(/^da_/i, "")
      .replace(/18$/i, "")
      .replace(/_ad$/i, "")
      .replace(/_ap$/i, "");
    if (cleaned.toLowerCase() === "elderdragon") return "Elder Dragon";
    if (cleaned.toLowerCase() === "khazix") return "Kha'Zix";
    if (cleaned.toLowerCase() === "jarvaniv") return "Jarvan IV";
    if (cleaned.toLowerCase() === "masteryi") return "Master Yi";
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const formatClusterName = (rawName?: string | null) => {
    if (!rawName) return "Đội hình thống kê";
    if (!rawName.startsWith("tactics.tools cluster")) return rawName;
    const parts = rawName.split(":");
    if (parts.length < 2) return rawName;
    const champList = parts[1]
      .split(",")
      .map((c) => formatChamp(c.trim()))
      .filter(Boolean)
      .join(", ");
    return `Đội hình tiêu biểu: ${champList}`;
  };

  const getTierBadge = (tier?: string | null) => {
    if (!tier) {
      return (
        <span className="inline-block font-mono text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-400 border border-white/[0.08]">
          —
        </span>
      );
    }
    const color =
      tier === "S"
        ? "bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
        : tier === "A"
        ? "bg-purple-600 text-white border-purple-400/80 shadow-[0_0_10px_rgba(192,132,252,0.3)]"
        : tier === "B"
        ? "bg-sky-600 text-white border-sky-400/80 shadow-[0_0_10px_rgba(14,165,233,0.3)]"
        : tier === "C"
        ? "bg-slate-700 text-slate-200 border-slate-500/80"
        : "bg-rose-600 text-white border-rose-400/80";

    return (
      <span className={`inline-block font-black px-2.5 py-0.5 rounded-lg border text-xs ${color}`}>
        {tier}
      </span>
    );
  };

  const isCurrentStale = effectiveMode === "current" && isStale;

  return (
    <div className="space-y-6">
      {/* 1. Header Trang Hiện Đại & Tinh Gọn */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#242f49]/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-[#f8fafc] tracking-tight">
              Đội Hình Meta — TFT Mùa 18
            </h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Chế độ Dữ liệu thật (Real)
            </span>
            {isArchive && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Bản lưu trữ
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#94a3b8]">
            Điểm đồng thuận từ MetaTFT, TFT Academy, TFT Flex, DataTFT và tactics.tools ({verifiedCount}/5 nguồn đã xác minh).
          </p>
        </div>

        {/* Trạng thái dữ liệu */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {isStale || !dataTimestamp ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>{isStale ? "Dữ liệu quá 48h (Stale Warning)" : "Chưa có bằng chứng dữ liệu"}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dữ liệu mới (Tươi)</span>
            </span>
          )}
          <span className="px-3 py-1 rounded-full bg-[#131927] border border-[#242f49] text-xs font-mono text-[#06b6d4]">
            Phiên bản: {patchLabel}
          </span>
        </div>
      </div>

      {/* 2. Banner Lưu Trữ Lịch Sử (Gọn gàng, tinh tế) */}
      {isHistoricalSnapshot && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <span>
              <strong>Bản lưu trữ lịch sử của {patchLabel}</strong> · Dữ liệu được bảo toàn theo snapshot gốc để đối chiếu meta.
              {requestedSnapshotId && (
                <span className="ml-1.5 font-mono text-[11px] text-amber-300">{requestedSnapshotId}</span>
              )}
            </span>
          </div>
          <Link
            href="/meta/websites"
            className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            Xem dữ liệu hiện tại →
          </Link>
        </div>
      )}

      {/* 3. Trạng Thái Dữ Liệu Thời Gian Thực Quá Hạn (Chỉ hiện khi ở chế độ live nhưng nguồn cũ) */}
      {isCurrentStale && (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#1a2236] to-[#131927] p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1.5 max-w-xl mx-auto">
            <h3 className="text-lg font-black text-white">
              Dữ liệu thời gian thực đang chờ cập nhật ({verifiedCount}/5 nguồn đã xác minh)
            </h3>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Các quan sát web thời gian thực hiện đã vượt ngưỡng kiểm định 72h. Nhãn kiểm định: <strong className="text-amber-300">Dữ liệu quá hạn</strong>. Hệ thống tuân thủ nguyên tắc fail-closed và không suy đoán dữ liệu khi chưa đủ bằng chứng.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href={`/meta/websites?patch=${patchEpochId}&archive=true`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <span>Xem Toàn Bộ 28 Đội Hình Meta (Bản Lưu Trữ)</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}

      {/* 4. BẢNG XẾP HẠNG ĐỘI HÌNH META (TIER BOARD) */}
      {snapshot && !isCurrentStale && (
        <div className="space-y-4">
          <TierBoard initialSnapshot={snapshot} boardType="websites" isArchive={isArchive} />
        </div>
      )}

      {/* 5. Đối Chiếu Dữ Liệu Nguồn & Kiểm Chứng Kỹ Thuật (Collapsible Accordion ở cuối trang) */}
      <details className="group rounded-2xl border border-[#242f49] bg-[#131927]/40 p-4 sm:p-5 text-xs text-[#94a3b8] transition-all">
        <summary className="cursor-pointer font-bold text-xs text-[#94a3b8] hover:text-[#f8fafc] flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#06b6d4]" />
            <span>Đối chiếu dữ liệu nguồn & kiểm chứng kỹ thuật ({verifiedCount}/5 nguồn đã xác minh)</span>
          </div>
          <span className="text-[11px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
        </summary>

        <div className="mt-4 pt-4 border-t border-[#242f49] space-y-6">
          {/* Tình trạng 5 nguồn độc lập */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div className="p-3 rounded-xl bg-[#0b0e17] border border-[#242f49] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#f8fafc] text-xs">1. TFT Academy</span>
                {renderSourceBadge("tftacademy", academyObs.length, allAcademyObs)}
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                {academyObs.length > 0
                  ? `Đã đối chiếu ${academyObs.length} guides có link gốc.`
                  : allAcademyObs.length > 0
                  ? `Phát hiện ${allAcademyObs.length} quan sát (${allAcademyObs[0].status !== "valid" ? allAcademyObs[0].status : "chưa xác minh"}).`
                  : "Chờ dữ liệu chính thức"}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0b0e17] border border-[#242f49] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#f8fafc] text-xs">2. MetaTFT</span>
                {renderSourceBadge("metatft", metatftObs.length, allMetatftObs)}
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                {metatftObs.length > 0
                  ? `Đã nạp ${metatftObs.length} observations thực tế.`
                  : allMetatftObs.length > 0
                  ? `Phát hiện ${allMetatftObs.length} quan sát (${allMetatftObs[0].status !== "valid" ? allMetatftObs[0].status : "chưa xác minh"}).`
                  : "Chờ xác minh dữ liệu chính thức"}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0b0e17] border border-[#242f49] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#f8fafc] text-xs">3. TFT Flex</span>
                {renderSourceBadge("tftflex", tftflexObs.length, allTftflexObs)}
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                {tftflexObs.length > 0
                  ? `Đã nạp ${tftflexObs.length} comps thực tế.`
                  : allTftflexObs.length > 0
                  ? `Phát hiện ${allTftflexObs.length} quan sát (${allTftflexObs[0].status !== "valid" ? allTftflexObs[0].status : "chưa xác minh"}).`
                  : "Chờ đồng bộ"}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0b0e17] border border-[#242f49] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#f8fafc] text-xs">4. DataTFT</span>
                {renderSourceBadge("datatft", datatftObs.length, allDatatftObs)}
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                {datatftObs.length > 0
                  ? `Đã nạp ${datatftObs.length} observations.`
                  : allDatatftObs.length > 0
                  ? `Phát hiện ${allDatatftObs.length} quan sát (${allDatatftObs[0].status !== "valid" ? allDatatftObs[0].status : "chưa xác minh"}).`
                  : "Cần phân tách dữ liệu"}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0b0e17] border border-[#242f49] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#f8fafc] text-xs">5. tactics.tools</span>
                {renderSourceBadge("tactics_tools", tacticsObs.length, allTacticsObs)}
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                {tacticsObs.length > 0
                  ? `Đã thu thập ${tacticsObs.length} comp thống kê.`
                  : allTacticsObs.length > 0
                  ? `Phát hiện ${allTacticsObs.length} quan sát (${allTacticsObs[0].status !== "valid" ? allTacticsObs[0].status : "chưa xác minh"}).`
                  : "Đang đối chiếu dữ liệu"}
              </p>
            </div>
          </div>

          {/* 1. Bảng dữ liệu nguồn: TFT Academy */}
          {academyObs.length > 0 && (
            <div className="rounded-xl border border-[#242f49] bg-[#0b0e17] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>1. TFT Academy ({patchLabel} — Rank: All)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Bậc dưới đây là bậc biên tập riêng của TFT Academy tại thời điểm đối chiếu.
                  </p>
                </div>
                <span className="text-[11px] text-amber-300 font-bold px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30">
                  {academyObs.length} đội hình đã xác minh
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/[0.08] bg-white/[0.02]">
                    <tr>
                      <th className="py-2.5 px-3">Đội hình</th>
                      <th className="py-2.5 px-3">Tên trên nguồn</th>
                      <th className="py-2.5 px-3 text-center">Bậc nguồn</th>
                      <th className="py-2.5 px-3">Chủ lực / Chống chịu</th>
                      <th className="py-2.5 px-3 text-right">Link trực tiếp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {[...academyObs]
                      .sort((a, b) => {
                        const order: Record<string, number> = { S: 1, A: 2, B: 3, C: 4, D: 5, X: 6 };
                        return (order[a.originalTier || "X"] || 99) - (order[b.originalTier || "X"] || 99);
                      })
                      .map((obs) => {
                        const carry = formatChamp(obs.carryChampionId);
                        const tank = formatChamp(obs.tankChampionId);
                        const carryTankText = carry && tank ? `${carry} / ${tank}` : (carry || tank || "—");

                        return (
                          <tr key={obs.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-2.5 px-3">
                              {obs.archetypeId ? (
                                <Link
                                  href={makeCompHref(obs.archetypeId)}
                                  prefetch={true}
                                  className="font-bold text-white hover:text-amber-300 transition-colors inline-flex items-center gap-1.5"
                                >
                                  <span>{obs.originalName}</span>
                                </Link>
                              ) : (
                                <span className="font-bold text-white">{obs.originalName}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 italic">
                              {obs.originalName || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {getTierBadge(obs.originalTier)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-200 capitalize">
                              {carryTankText}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {obs.sourceUrl ? (
                                <a
                                  href={obs.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold"
                                >
                                  <span>https://tftacademy.com/tierlist/comps/</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. Bảng dữ liệu nguồn: tactics.tools */}
          {tacticsObs.length > 0 && (
            <div className="rounded-xl border border-[#242f49] bg-[#0b0e17] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-sky-400" />
                    <span>2. tactics.tools ({patchLabel} — Rank: Diamond+)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    tactics.tools là nguồn thống kê thuần túy, không có bậc chữ cái riêng. Cột bậc hiển thị <code>—</code>.
                  </p>
                </div>
                <span className="text-[11px] text-sky-300 font-bold px-2.5 py-0.5 rounded-full bg-sky-400/10 border border-sky-400/30">
                  {tacticsObs.length} comp thống kê
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/[0.08] bg-white/[0.02]">
                    <tr>
                      <th className="py-2.5 px-3">Nhóm đội hình</th>
                      <th className="py-2.5 px-3 text-center">Hạng TB (Avg Place)</th>
                      <th className="py-2.5 px-3 text-center">Số trận / Tỉ lệ chọn</th>
                      <th className="py-2.5 px-3 text-center">Bậc nguồn</th>
                      <th className="py-2.5 px-3">Chủ lực / Chống chịu</th>
                      <th className="py-2.5 px-3 text-right">Link trực tiếp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {[...tacticsObs].map((obs) => {
                      const carry = formatChamp(obs.carryChampionId);
                      const tank = formatChamp(obs.tankChampionId);
                      const carryTankText = carry && tank ? `${carry} / ${tank}` : (carry || tank || "—");

                      const metrics = obs.metrics as any;
                      const avgPlace = metrics?.averagePlacement
                        ? Number(metrics.averagePlacement).toFixed(2)
                        : "—";
                      const sampleSize = metrics?.sampleCount
                        ? `${metrics.sampleCount} trận`
                        : metrics?.sampleSize
                        ? `${metrics.sampleSize} trận`
                        : metrics?.pickRateRaw
                        ? `${metrics.pickRateRaw}`
                        : "—";

                      return (
                        <tr key={obs.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-2.5 px-3">
                            {obs.archetypeId ? (
                              <Link
                                href={makeCompHref(obs.archetypeId)}
                                prefetch={true}
                                className="font-bold text-white hover:text-sky-300 transition-colors inline-flex items-center gap-1.5"
                              >
                                <span>{formatClusterName(obs.originalName)}</span>
                              </Link>
                            ) : (
                              <span className="font-bold text-white">{formatClusterName(obs.originalName)}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-400">
                            {avgPlace}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                            {sampleSize}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {getTierBadge(obs.originalTier)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-200 capitalize">
                            {carryTankText}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {obs.sourceUrl ? (
                              <a
                                href={obs.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-bold"
                              >
                                <span>tactics.tools</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Bảng dữ liệu nguồn: TFT Flex */}
          {tftflexObs.length > 0 && (
            <div className="rounded-xl border border-[#242f49] bg-[#0b0e17] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <span>3. TFT Flex ({patchLabel} — Rank: All)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Dữ liệu thực tế đối chiếu từ <code>https://tftflex.com/en/meta</code>. Bậc xếp hạng lấy trực tiếp từ TFT Flex theo phân tầng S/A/B/C/D.
                  </p>
                </div>
                <span className="text-[11px] text-purple-300 font-bold px-2.5 py-0.5 rounded-full bg-purple-400/10 border border-purple-400/30">
                  {tftflexObs.length} comp đã xác minh
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/[0.08] bg-white/[0.02]">
                    <tr>
                      <th className="py-2.5 px-3">Đội hình</th>
                      <th className="py-2.5 px-3">Tên trên nguồn</th>
                      <th className="py-2.5 px-3 text-center">Bậc nguồn</th>
                      <th className="py-2.5 px-3">Chủ lực / Chống chịu</th>
                      <th className="py-2.5 px-3 text-right">Link trực tiếp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {[...tftflexObs]
                      .sort((a, b) => {
                        const order: Record<string, number> = { S: 1, A: 2, B: 3, C: 4, D: 5, X: 6 };
                        return (order[a.originalTier || "X"] || 99) - (order[b.originalTier || "X"] || 99);
                      })
                      .map((obs) => {
                        const sourceLead = formatChamp(obs.sourceLeadChampionId || obs.carryChampionId);
                        const sourceTank = formatChamp(obs.tankChampionId);

                        return (
                          <tr key={obs.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-2.5 px-3">
                              {obs.archetypeId ? (
                                <Link
                                  href={makeCompHref(obs.archetypeId)}
                                  prefetch={true}
                                  className="font-bold text-white hover:text-purple-300 transition-colors inline-flex items-center gap-1.5"
                                >
                                  <span>{obs.originalName}</span>
                                </Link>
                              ) : (
                                <span className="font-bold text-white">{obs.originalName}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 italic">
                              {obs.originalName || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {getTierBadge(obs.originalTier)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap text-slate-200 capitalize">
                                <span className="font-bold text-white">{sourceLead || "—"}</span>
                                <span className="text-slate-500">/</span>
                                <span>{sourceTank || "—"}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {obs.sourceUrl ? (
                                <a
                                  href={obs.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-bold"
                                >
                                  <span>https://tftflex.com/en/meta</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
