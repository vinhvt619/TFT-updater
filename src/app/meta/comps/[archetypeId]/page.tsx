import React from "react";
import Link from "next/link";
import { TierBadge, ConditionBadge } from "@/components/meta/tier-badge";
import { SourceVoteMatrix } from "@/components/meta/source-vote-matrix";
import { TftBoardGrid } from "@/components/meta/tft-board-grid";
import { ChampionAvatar } from "@/components/meta/champion-image";
import { toCanonicalChampionId } from "@/domain/identity";
import { metaRepository } from "@/server/meta/repositories/meta-repository";
import { verifiedWebsiteSnapshot } from "@/server/meta/services/verified-catalogue";
import { getCurrentLivePatchEpochId, getPatchEpoch } from "@/domain/meta/patch-epochs";
import { getDb } from "@/server/db/client";
import { metaMatchParticipants, metaMatches, metaClassifications } from "@/server/db/schema-meta";
import { eq, and, inArray } from "drizzle-orm";
import {
  Swords,
  Shield,
  Trophy,
  Flame,
  ArrowLeft,
  ExternalLink,
  Users,
  Gamepad2,
  HelpCircle,
  Clock,
  Sparkles,
  Layers,
  ChevronRight
} from "lucide-react";

export const dynamic = "force-dynamic";

interface CompDetailPageProps {
  params: Promise<{ archetypeId: string }>;
  searchParams?: Promise<{ mode?: string; patch?: string; snapshotId?: string; snapshot?: string; archive?: string; buildId?: string }>;
}

export default async function CompDetailPage({ params, searchParams }: CompDetailPageProps) {
  const { archetypeId } = await params;
  const resolvedParams = searchParams ? await searchParams : {};
  const requestedMode = "real" as const;
  const patchEpochId = resolvedParams.patch || getCurrentLivePatchEpochId();
  const snapshotId = resolvedParams.snapshotId || resolvedParams.snapshot;
  const isArchive = resolvedParams.archive === "true" || Boolean(snapshotId) || (Boolean(resolvedParams.patch) && resolvedParams.patch !== getCurrentLivePatchEpochId());

  const backParams = new URLSearchParams();
  backParams.set("mode", requestedMode);
  if (resolvedParams.patch) backParams.set("patch", resolvedParams.patch);
  if (snapshotId) backParams.set("snapshotId", snapshotId);
  if (isArchive) backParams.set("archive", "true");
  const backUrl = `/meta/websites?${backParams.toString()}`;

  const archetype = await metaRepository.getArchetypeById(archetypeId, requestedMode);

  if (!archetype) {
    return (
      <div className="py-24 text-center space-y-4">
        <p className="text-slate-300">Không tìm thấy đội hình: {archetypeId}</p>
        <Link
          href={backUrl}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  // Lấy ranking từ cả hai Mục A và Mục B theo mode
  let rawWebSnap: any = null;
  if (snapshotId) {
    rawWebSnap = await metaRepository.getRankingSnapshot(snapshotId);
    const snapPatch = rawWebSnap?.rankingScope?.patchEpochId || rawWebSnap?.patchEpochId;
    const snapBoardType = rawWebSnap?.rankingScope?.boardType || rawWebSnap?.boardType;
    if (
      !rawWebSnap ||
      snapPatch !== patchEpochId ||
      rawWebSnap.datasetKind !== requestedMode ||
      snapBoardType !== "websites"
    ) {
      rawWebSnap = null;
    }
  } else {
    rawWebSnap = await metaRepository.getLatestRankingSnapshot("websites", requestedMode, { patchEpochId });
  }
  const webSnap = rawWebSnap
    ? await verifiedWebsiteSnapshot(rawWebSnap, {
        mode: isArchive ? "archive" : "current",
        referenceTime: isArchive ? (rawWebSnap.sourceDataAsOf || rawWebSnap.generatedAt || undefined) : undefined,
        maxAgeHours: 72
      })
    : null;
  const eliteSnap = await metaRepository.getLatestRankingSnapshot("elite", requestedMode, { patchEpochId });

  let webRow = webSnap?.rows?.find((r) => r.archetypeId === archetypeId) || null;
  // REV-02 / R4-02 / R5-01: Kiểm tra buildId chặt chẽ theo build nguồn đã kiểm chứng
  if (resolvedParams.buildId) {
    if (!webRow || webRow.selectedSourceBuildId !== resolvedParams.buildId) {
      webRow = null;
    }
  }
  const eliteRow = eliteSnap?.rows?.find((r) => r.archetypeId === archetypeId) || null;

  // Lấy các trận minh họa từ database theo đúng datasetKind và trạng thái hợp lệ (status = 'valid')
  const db = await getDb();
  const validMatches = await db
    .select()
    .from(metaMatches)
    .where(
      and(
        eq(metaMatches.datasetKind, requestedMode),
        eq(metaMatches.status, "valid"),
        eq(metaMatches.patchEpochId, patchEpochId)
      )
    );

  const validMatchMap = new Map<string, any>(validMatches.map((m: any) => [m.matchKey, m]));
  const validMatchKeys = validMatches.map((m: any) => m.matchKey);

  const exampleMatches: any[] = [];
  if (validMatchKeys.length > 0) {
    const classRows = await db
      .select()
      .from(metaClassifications)
      .where(
        and(
          eq(metaClassifications.archetypeId, archetypeId),
          eq(metaClassifications.status, "matched")
        )
      )
      .limit(30);

    const relevantClassRows = classRows.filter((c: any) => validMatchMap.has(c.matchKey));
    if (relevantClassRows.length > 0) {
      const relevantKeys: string[] = Array.from(new Set(relevantClassRows.map((c: any) => String(c.matchKey))));
      const participants = relevantKeys.length > 0
        ? await db.select().from(metaMatchParticipants).where(inArray(metaMatchParticipants.matchKey, relevantKeys))
        : [];
      for (const c of relevantClassRows) {
        const p = participants.find((part: any) => part.matchKey === c.matchKey && part.accountKey === c.accountKey);
        const m = validMatchMap.get(c.matchKey);
        if (p && m) {
          exampleMatches.push({
            matchKey: m.matchKey,
            region: m.region,
            endedAt: m.endedAt,
            placement: p.placement,
            level: p.level,
            units: p.units,
            traits: p.traits,
            gameDurationSeconds: m.gameDurationSeconds,
            riotIdName: p.riotIdName,
            riotIdTag: p.riotIdTag
          });
        }
      }
    }
  }

  const requestedVariantId = (resolvedParams as any).variant;
  const activeVariant =
    (requestedVariantId && archetype.variants?.find((v) => v.id === requestedVariantId)) ||
    (archetype.defaultVariantId && archetype.variants?.find((v) => v.id === archetype.defaultVariantId)) ||
    archetype.variants?.[0];

  const formatChampName = (id: string) => {
    if (!id) return "";
    return id
      .replace(/^tft18_da_18_/, "")
      .replace(/^tft18_da_/, "")
      .replace(/^tft18_/, "")
      .replace(/_ad$/, "")
      .replace(/\d+$/, "");
  };

  const top4Matches = exampleMatches.filter((m: any) => m.placement <= 4);
  const bottom4Matches = exampleMatches.filter((m: any) => m.placement > 4);

  return (
    <div className="space-y-8 w-full pb-12 overflow-x-hidden">
      {/* Nút quay lại */}
      <div className="pt-2">
        <Link
          href={backUrl}
          prefetch={true}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors scroll-mt-32"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại Bảng xếp hạng Đội hình
        </Link>
      </div>

      {/* Header chi tiết & Hai Tier đối chiếu */}
      <div className="glass-panel-elevated border border-white/[0.08] rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                TFT Mùa 18
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80">
                {getPatchEpoch(patchEpochId)?.label || `Bản cập nhật ${patchEpochId}`}
              </span>
              {archetype.playstyle && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                  {archetype.playstyle === "reroll"
                     ? "Lối chơi: Đổi lại 3 sao"
                    : archetype.playstyle === "fast8"
                     ? "Lối chơi: Lên cấp nhanh 8"
                    : "Lối chơi: Tiêu chuẩn"}
                </span>
              )}
              {archetype.requiredConditions?.map((cond: string, idx: number) => (
                <ConditionBadge key={idx} text={cond} />
              ))}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-100">
              {archetype.nameVi}
            </h1>

            {/* Các tên gọi khác */}
            {archetype.aliases?.length > 0 && (
              <div className="text-xs text-slate-500 mt-2">
                Tên gọi khác: <span className="text-slate-400">{archetype.aliases.join(", ")}</span>
              </div>
            )}
          </div>

          {/* HAI TIER ĐỐI CHIẾU SONG SONG */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-950/80 border border-slate-800 p-4 rounded-xl shadow-inner">
            {/* Mục A Tier */}
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                 Mục A (Các trang thống kê)
              </div>
              <div className="flex justify-center mb-1">
                <TierBadge
                  tier={webRow?.tier || null}
                  candidateTier={webRow?.candidateTier || null}
                  status={webRow?.status || "collecting"}
                  size="lg"
                />
              </div>
              <div className="text-xs font-bold text-emerald-400">
                {webRow?.score !== null && webRow?.score !== undefined ? `${Math.round(webRow.score)}đ` : "—"}
              </div>
            </div>

            {/* Mục B Tier */}
            <div className="text-center px-3">
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5 text-purple-400" />
                Mục B (Cao thủ)
              </div>
              <div className="flex justify-center mb-1">
                <TierBadge
                  tier={eliteRow?.tier || null}
                  candidateTier={eliteRow?.candidateTier || null}
                  status={eliteRow?.status || "collecting"}
                  size="lg"
                />
              </div>
              <div className="text-xs font-bold text-purple-400">
                {eliteRow?.score !== null && eliteRow?.score !== undefined ? `${Math.round(eliteRow.score)}đ` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Tướng cốt lõi & Tộc hệ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Tướng cốt lõi
            </h3>
            <div className="flex flex-wrap gap-2 items-center">
              {archetype.coreCarryChampionId ? (
                <Link
                  href={`/champions/${toCanonicalChampionId(archetype.coreCarryChampionId)}`}
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-xs font-bold text-amber-300 hover:bg-amber-900/50 transition-colors shadow-sm"
                  title="Xem thay đổi thông số tướng này"
                >
                  <ChampionAvatar
                    championId={archetype.coreCarryChampionId}
                    nameVi={formatChampName(archetype.coreCarryChampionId)}
                    isCarry={true}
                    size="xs"
                  />
                  <span className="capitalize">{formatChampName(archetype.coreCarryChampionId)}</span>
                  <span className="text-[10px] bg-amber-900/80 text-amber-200 px-1.5 py-0.5 rounded font-semibold">Chủ lực</span>
                </Link>
              ) : null}

              {archetype.coreTankChampionId ? (
                <Link
                  href={`/champions/${toCanonicalChampionId(archetype.coreTankChampionId)}`}
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-blue-950/40 border border-blue-500/50 text-xs font-bold text-blue-300 hover:bg-blue-900/50 transition-colors shadow-sm"
                  title="Xem thay đổi thông số tướng này"
                >
                  <ChampionAvatar
                    championId={archetype.coreTankChampionId}
                    nameVi={formatChampName(archetype.coreTankChampionId)}
                    isTank={true}
                    size="xs"
                  />
                  <span className="capitalize">{formatChampName(archetype.coreTankChampionId)}</span>
                  <span className="text-[10px] bg-blue-900/80 text-blue-200 px-1.5 py-0.5 rounded font-semibold">Chống chịu</span>
                </Link>
              ) : null}

              {archetype.coreChampionIds
                ?.filter(
                  (cid: string) =>
                    cid &&
                    cid !== archetype.coreCarryChampionId &&
                    cid !== archetype.coreTankChampionId
                )
                .map((cid: string, idx: number) => (
                  <Link
                    key={idx}
                    href={`/champions/${toCanonicalChampionId(cid)}`}
                    className="flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-xl bg-slate-800/90 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors capitalize shadow-sm"
                    title="Xem chi tiết thông số tướng này"
                  >
                    <ChampionAvatar
                      championId={cid}
                      nameVi={formatChampName(cid)}
                      size="xs"
                    />
                    <span>{formatChampName(cid)}</span>
                  </Link>
                ))}

              {!archetype.coreCarryChampionId && !archetype.coreTankChampionId && (!archetype.coreChampionIds || archetype.coreChampionIds.length === 0) && (
                <span className="text-xs text-slate-500 italic">
                  Chưa có dữ liệu tướng cốt lõi từ nguồn thực tế.
                </span>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Tộc / Hệ quan trọng
            </h3>
            <div className="flex flex-wrap gap-2">
              {archetype.keyTraitIds?.map((tid: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300 capitalize"
                >
                  {tid.replace(/^tft18_trait_/, "").replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chi tiết Mục A: Ma trận phiếu từ 5 Website */}
      {webRow && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Chi tiết Phiếu Điểm từ 5 Website Meta (Mục A)
            </h2>
            <span className="text-xs text-slate-400">
              Đồng thuận: <strong className="text-emerald-400">{webRow.consensusLabel}</strong>
            </span>
          </div>

          <SourceVoteMatrix sourceVotes={webRow.sourceVotes} />

          <div className="text-xs text-slate-400 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 leading-relaxed">
            Điểm đồng thuận <strong>{webRow.score ? `${Math.round(webRow.score)}/100` : "—"}</strong> được tổng hợp từ các nguồn đạt chuẩn. Mỗi nhóm xuất xứ đóng góp tối đa một phiếu có trọng số ngang nhau.
          </div>
        </div>
      )}

      {/* Chi tiết Mục B: Breakdown theo 4 Khu vực Cao thủ */}
      {eliteRow && eliteRow.regionalBreakdown && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Flame className="w-5 h-5 text-purple-400" />
              Hiệu suất Chi tiết theo Từng Khu vực Cao thủ (Mục B)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {["KR", "VN", "NA", "EUW"].map((r) => {
              const rm = eliteRow.regionalBreakdown[r];
              if (!rm) return null;

              return (
                <div
                  key={r}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200">Khu vực {r}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        rm.regionalScore && rm.regionalScore >= 80
                          ? "bg-amber-950 text-amber-300"
                          : rm.regionalScore && rm.regionalScore >= 65
                          ? "bg-purple-950 text-purple-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {rm.regionalScore !== null ? `${Math.round(rm.regionalScore)}đ` : "Chưa có điểm"}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1 pt-1">
                    <div className="flex justify-between">
                      <span>Vào Top (Top 4):</span>
                      <strong className="text-emerald-400">
                        {rm.rawTop4Rate !== null ? `${(rm.rawTop4Rate * 100).toFixed(1)}%` : "—"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Hạng trung bình:</span>
                      <strong className="text-amber-400">
                        {rm.rawAveragePlacement !== null ? `#${rm.rawAveragePlacement.toFixed(2)}` : "—"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Mẫu lượt / trận:</span>
                      <span className="text-slate-300">
                        {rm.appearances} / {rm.uniqueMatches}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bàn cờ hướng dẫn & Sơ đồ vị trí đứng 4x7 */}
      {requestedMode === "real" ? (
        webRow?.recommendedBoard && webRow.recommendedBoard.length > 0 ? (
          <div className="glass-panel border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  Bàn cờ vị trí đứng & Trang bị tối ưu ({(webRow as any)?.selectedSourceBuildName || (webRow.selectedSourceBuildId ? `Bản dựng ${webRow.selectedSourceBuildId}` : "Bàn cờ chuẩn")})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sơ đồ vị trí xếp cờ chuẩn và hướng dẫn trang bị tối ưu cho các chủ lực trong giao tranh.
                </p>
                {(() => {
                  const verifiedSourceUrl = (webRow as any)?.selectedSourceUrl || null;
                  if (!verifiedSourceUrl) return null;
                  return (
                    <div className="mt-2.5">
                      <a
                        href={verifiedSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1a2236] border border-[#242f49] hover:border-[#06b6d4] text-xs font-semibold text-[#06b6d4] hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>Xem cẩm nang gốc ({verifiedSourceUrl.includes("tftacademy") ? "TFT Academy" : verifiedSourceUrl.includes("tftflex") ? "TFT Flex" : "Nguồn đối chiếu"})</span>
                      </a>
                    </div>
                  );
                })()}
              </div>
              {(webRow as any)?.conditionDescription && (
                <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 self-start sm:self-auto">
                  {(webRow as any).conditionDescription}
                </span>
              )}
            </div>

            <TftBoardGrid boardUnits={webRow.recommendedBoard} />
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-2 text-center">
            <Layers className="w-8 h-8 text-slate-500 mx-auto" />
            <h2 className="text-sm font-bold text-slate-200">Chưa có dữ liệu đội hình và trang bị từ nguồn</h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              Nguồn chưa cung cấp hoặc chưa thu thập dữ liệu đội hình/trang bị cho biến thể này.
            </p>
          </div>
        )
      ) : activeVariant?.recommendedBoard && activeVariant.recommendedBoard.length > 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Bàn cờ vị trí đứng & Trang bị tối ưu ({activeVariant.nameVi || "Bàn cờ chuẩn"})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Dữ liệu đội hình mẫu đã được kiểm chứng.
              </p>
            </div>
          </div>
          <TftBoardGrid boardUnits={activeVariant.recommendedBoard} />
        </div>
      ) : null}

      {/* Danh sách các trận đấu minh họa từ cao thủ */}
      {exampleMatches && exampleMatches.length > 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-emerald-400" />
              Các Trận Đấu Thực Tế từ Cao Thủ
              </h2>
              <p className="text-xs text-slate-400">
                Thống kê dùng toàn bộ hạng 1–8. Danh sách dưới đây minh họa kết quả bàn cờ kết trận.
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              Tổng {exampleMatches.length} trận đã ghi nhận
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Hạng</th>
                  <th className="py-2.5 px-3">Người chơi (Riot ID)</th>
                  <th className="py-2.5 px-3">Khu vực</th>
                  <th className="py-2.5 px-3">Cấp</th>
                  <th className="py-2.5 px-3">Bàn cờ kết trận (Tướng & Sao)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {exampleMatches.map((m: any, idx: number) => {
                  const isTop4 = m.placement <= 4;
                  return (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-xs ${
                            m.placement === 1
                              ? "bg-amber-400 text-slate-950 font-black"
                              : isTop4
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          #{m.placement}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-200">
                        {m.riotIdName ? `${m.riotIdName}#${m.riotIdTag || "KR"}` : `Người chơi cao thủ (${m.region})`}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">
                        {m.region}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        Cấp {m.level}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          {m.units?.map((u: any, uIdx: number) => (
                            <span
                              key={uIdx}
                              className={`px-1.5 py-0.5 rounded text-[11px] capitalize border ${
                                u.tier === 3
                                  ? "bg-amber-950/60 border-amber-600 text-amber-300 font-bold"
                                  : "bg-slate-800/80 border-slate-700 text-slate-300"
                              }`}
                            >
                              {formatChampName(u.championId || u.characterId || "")} {u.tier === 3 ? "3★" : "2★"}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : requestedMode === "real" ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-2 text-center">
          <Gamepad2 className="w-8 h-8 text-slate-500 mx-auto" />
          <h2 className="text-sm font-bold text-slate-200">Chưa có trận đấu thực tế nào được kiểm chứng cho đội hình này</h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Hệ thống chỉ hiển thị trận đấu từ người chơi có Riot ID thật và thuộc nhóm cao thủ đã xác minh. Dữ liệu chưa kiểm chứng được giữ ngoài giao diện công khai.
          </p>
        </div>
      ) : null}
    </div>
  );
}
