"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  History,
  Shield,
  Zap,
  Sparkles,
  BookOpen,
  AlertCircle,
  Info,
  ExternalLink
} from "lucide-react";
import { ChampionRecord, StarLevel } from "@/domain/types";
import { formatStatValue } from "@/domain/formatting";
import { EvidenceDrawer } from "@/components/provenance/evidence-drawer";
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import { FormattedDescription } from "@/components/ui/formatted-description";
import { ItemIcon } from "@/components/ui/item-icon";
import { formatTraitNameVi } from "@/domain/identity";
import { CapsuleButton } from "@/components/ui/capsule-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

export function ChampionDetailContent({
  championId,
  initialChampion,
  snapshotId: initialSnapshotId,
  initialQuarantine,
  initialError
}: {
  championId: string;
  initialChampion: ChampionRecord | null;
  snapshotId?: string;
  initialQuarantine?: { isQuarantined: boolean; snapshotId: string; reason?: string };
  initialError?: string;
}) {
  const searchParams = useSearchParams();
  const fromSource = searchParams.get("from") === "catalogue" ? "catalogue" : "compare";
  const snapshotId =
    searchParams.get("to") ||
    searchParams.get("snapshotId") ||
    (searchParams.get("from") !== "catalogue" ? searchParams.get("from") : "") ||
    initialSnapshotId ||
    "";

  const [champion, setChampion] = useState<ChampionRecord | null>(initialChampion);
  const [history, setHistory] = useState<any[]>([]);
  const [itemRecommendations, setItemRecommendations] = useState<
    Array<{ itemId: string; sourceUrl: string | null; archetypeId: string; sourceBuildId: string | null }>
  >([]);
  const [loading, setLoading] = useState(!initialChampion && !initialQuarantine && !initialError);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError || null);
  const [quarantine, setQuarantine] = useState(initialQuarantine || null);
  const [activeTab, setActiveTab] = useState<"stats" | "abilities" | "items" | "history">("stats");
  const [activeStar, setActiveStar] = useState<StarLevel>(1);
  const [activeVariantKey, setActiveVariantKey] = useState<string>(
    initialChampion?.variants?.[0]?.variantKey || "base"
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeEvidenceIds, setActiveEvidenceIds] = useState<string[]>([]);

  useEffect(() => {
    if (initialQuarantine || initialError) return;

    if (!initialChampion) {
      setLoading(true);
    }
    setErrorMsg(null);

    // Fetch champion detail if not provided
    if (!initialChampion) {
      const champUrl = snapshotId
        ? `/api/v1/champions/${championId}?snapshotId=${snapshotId}`
        : `/api/v1/champions/${championId}`;

      fetch(champUrl)
        .then(async (res) => {
          const json = await res.json();
          if (res.status === 410) {
            setQuarantine({
              isQuarantined: true,
              snapshotId: snapshotId,
              reason: json.error?.message || "Ảnh chụp đã bị cách ly"
            });
            return null;
          }
          if (!res.ok) {
            throw new Error(json.error?.message || `Lỗi tải thông tin tướng (${res.status})`);
          }
          return json;
        })
        .then((json) => {
          if (json?.data) {
            setChampion(json.data);
            if (json.data.variants?.[0]?.variantKey) {
              setActiveVariantKey(json.data.variants[0].variantKey);
            }
          }
        })
        .catch((err) => setErrorMsg(err.message));
    }

    // Fetch history
    fetch(`/api/v1/champions/${championId}/history`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.history) {
          setHistory(json.data.history);
        }
      })
      .finally(() => setLoading(false));

    // Fetch item recommendations
    fetch(`/api/v1/meta/champion-items?championId=${encodeURIComponent(championId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (Array.isArray(json?.data?.recommendations)) {
          setItemRecommendations(json.data.recommendations);
        }
      });
  }, [championId, snapshotId, initialChampion, initialError, initialQuarantine]);

  const activeVariant =
    champion?.variants.find((v) => v.variantKey === activeVariantKey) || champion?.variants[0];

  const openEvidence = (sourceRefIds: string[]) => {
    setActiveEvidenceIds(sourceRefIds);
    setDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="py-24 text-center glass-panel rounded-2xl max-w-md mx-auto space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
        <p className="text-slate-400 text-xs sm:text-sm">Đang tải hồ sơ tướng...</p>
      </div>
    );
  }

  if (quarantine?.isQuarantined) {
    return (
      <div className="p-8 rounded-2xl glass-panel border border-rose-500/30 text-center space-y-4 max-w-xl mx-auto my-8 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">Ảnh chụp dữ liệu đã bị thu hồi hoặc cách ly</h2>
          <p className="text-xs text-rose-400 font-mono">Mã snapshot: {quarantine.snapshotId}</p>
        </div>
        <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed max-w-md mx-auto">
          {quarantine.reason ||
            "Ảnh chụp dữ liệu này đã bị cách ly do vi phạm tính xác thực nguồn. Toàn bộ thông số trò chơi đã được thu hồi và không hiển thị."}
        </p>
        <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
          <CapsuleButton variant="secondary" size="md" href="/compare">
            ← Quay lại so sánh
          </CapsuleButton>
          <CapsuleButton variant="primary" size="md" href="/history">
            Xem lịch sử chính thức →
          </CapsuleButton>
        </div>
      </div>
    );
  }

  if (errorMsg || !champion) {
    return (
      <ErrorState
        title="Không tìm thấy tướng"
        message={errorMsg || `Không tìm thấy thông tin tướng: ${championId}`}
        homeHref="/champions"
      />
    );
  }

  const costVal = champion.cost.state === "known" ? champion.cost.value : null;
  const traitsList = champion.traitIds.state === "known" ? champion.traitIds.value : [];
  const nameVi = champion.name.vi.state === "known" ? champion.name.vi.value : champion.championId;
  const nameEn = champion.name.en.state === "known" ? champion.name.en.value : "";

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {fromSource === "catalogue" ? (
          <Link
            href={`/champions?${searchParams.toString()}`}
            className="inline-flex items-center gap-1.5 font-bold text-slate-400 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trở về danh mục tướng</span>
          </Link>
        ) : (
          <Link
            href={`/compare?${searchParams.toString()}`}
            className="inline-flex items-center gap-1.5 font-bold text-slate-400 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trở về so sánh</span>
          </Link>
        )}
        <span className="text-slate-600">•</span>
        <Link
          href="/meta/websites"
          className="font-bold text-slate-400 hover:text-cyan-300 transition-colors"
        >
          Về danh sách Đội hình mạnh
        </Link>
      </div>

      {/* Banner if stats are missing */}
      {(!champion.variants ||
        champion.variants.length === 0 ||
        champion.cost.state === "missing") && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Thông số chiến đấu chi tiết (máu, giáp, sát thương, kỹ năng) chưa có tại mốc ảnh chụp này hoặc đang cập nhật từ nguồn game.
          </span>
        </div>
      )}

      {/* Cinematic Hero Profile Header */}
      <div className="rounded-2xl glass-panel-elevated border border-white/[0.08] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <ChampionAvatar
          icon={champion.icon.state === "known" ? champion.icon.value : null}
          name={nameVi}
          cost={costVal}
          size="xl"
          className="border-2 shadow-xl ring-2 ring-white/10"
        />

        <div className="space-y-2.5 flex-1 relative z-10 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">{nameVi}</h1>
            {costVal && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 shadow-md">
                {costVal} Vàng
              </span>
            )}
            {nameEn && nameEn !== nameVi && (
              <span className="text-xs text-slate-400 font-medium">({nameEn})</span>
            )}
          </div>

          {/* Traits list */}
          <div className="flex flex-wrap items-center gap-1.5">
            {traitsList.map((t) => (
              <span
                key={t}
                className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#161926] text-amber-300 border border-amber-400/30 shadow-sm"
              >
                {formatTraitNameVi(t)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Segmented Capsule Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => setActiveTab("stats")}
          className={`capsule-sheen px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "stats"
              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300/60"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Chỉ số nền</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("abilities")}
          className={`capsule-sheen px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "abilities"
              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300/60"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Kỹ năng</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("items")}
          className={`capsule-sheen px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "items"
              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300/60"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Trang bị đề xuất</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`capsule-sheen px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "history"
              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300/60"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Lịch sử phiên bản</span>
        </button>
      </div>

      {/* Tab 1: Stats */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          {/* Controls: Variant and Star Level */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121420] p-3 rounded-2xl border border-white/[0.06]">
            {champion.variants.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <span className="text-xs text-slate-400 font-semibold mr-1">Dạng:</span>
                {champion.variants.map((v) => (
                  <button
                    key={v.variantKey}
                    type="button"
                    onClick={() => setActiveVariantKey(v.variantKey)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      activeVariantKey === v.variantKey
                        ? "bg-amber-400 text-slate-950 shadow-sm"
                        : "bg-white/[0.04] text-slate-400 hover:text-white"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-semibold mr-1">Cấp sao:</span>
              {([1, 2, 3] as StarLevel[]).map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setActiveStar(star)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeStar === star
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "bg-white/[0.04] text-slate-400 hover:text-white"
                  }`}
                >
                  {star} ★
                </button>
              ))}
            </div>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeVariant?.stats.map((st) => {
              const datum = st.byStar[activeStar] || st.byStar[1];
              const val =
                datum?.state === "known"
                  ? formatStatValue(datum.value, st.unit, 1)
                  : "Chưa có dữ liệu";

              return (
                <div
                  key={st.key}
                  className="bg-[#121420] border border-white/[0.06] hover:border-white/[0.12] transition-colors rounded-2xl p-4 space-y-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-medium">{st.labelVi}</span>
                    {datum?.sourceRefIds && datum.sourceRefIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openEvidence(datum.sourceRefIds)}
                        className="text-amber-400 hover:text-amber-300 p-1"
                        title="Xem nguồn kiểm chứng"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-xl font-bold font-mono text-white tracking-tight">{val}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Abilities */}
      {activeTab === "abilities" && (
        <div className="space-y-4">
          {activeVariant?.abilities.map((ab) => (
            <div
              key={ab.abilityKey}
              className="bg-[#121420] border border-white/[0.06] rounded-2xl p-5 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    {ab.name.vi.state === "known" ? ab.name.vi.value : ab.abilityKey}
                  </h3>
                  {ab.name.en.state === "known" && (
                    <p className="text-xs text-slate-400">{ab.name.en.value}</p>
                  )}
                </div>
              </div>

              <div className="bg-[#0f172a]/90 p-4 rounded-xl border border-slate-700/60">
                <FormattedDescription
                  text={ab.description.vi.state === "known" ? ab.description.vi.value : ""}
                  championId={champion.championId}
                  cost={champion.cost.state === "known" ? champion.cost.value : undefined}
                  parameters={ab.parameters}
                  className="text-xs sm:text-[13px] text-slate-200 leading-relaxed"
                />
              </div>

              {ab.parameters.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Thông số kỹ năng theo cấp sao:
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="border-b border-white/[0.06] text-slate-400">
                        <tr>
                          <th className="py-2 px-3">Tham số</th>
                          <th className="py-2 px-3">1 ★</th>
                          <th className="py-2 px-3">2 ★</th>
                          <th className="py-2 px-3">3 ★</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {ab.parameters.map((p) => {
                          const v1 = p.byStar[1]?.state === "known" ? p.byStar[1].value : "—";
                          const v2 = p.byStar[2]?.state === "known" ? p.byStar[2].value : "—";
                          const v3 = p.byStar[3]?.state === "known" ? p.byStar[3].value : "—";
                          return (
                            <tr key={p.key}>
                              <td className="py-2.5 px-3 font-semibold text-slate-200">{p.labelVi}</td>
                              <td className="py-2.5 px-3 text-slate-300 font-mono">{v1}</td>
                              <td className="py-2.5 px-3 text-slate-300 font-mono">{v2}</td>
                              <td className="py-2.5 px-3 text-amber-400 font-bold font-mono">{v3}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Recommended Items */}
      {activeTab === "items" && (
        <div className="bg-[#1e293b]/80 border border-slate-700/70 rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="font-bold text-base text-white">Trang bị được nguồn đã xác minh đề xuất</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Danh sách trang bị trích xuất từ các bàn cờ đã xác minh; không tự gán bậc khi nguồn không cung cấp.
            </p>
          </div>

          {itemRecommendations.length === 0 ? (
            <EmptyState
              title="Chưa có trang bị đề xuất"
              description="Hiện tại chưa có đội hình đã xác minh nào ghi nhận trang bị phổ biến cho tướng này."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {itemRecommendations.map((item) => (
                <div
                  key={`${item.itemId}-${item.archetypeId}`}
                  className="p-3.5 rounded-xl bg-[#0f172a]/90 border border-slate-700/60 flex items-center justify-between gap-3"
                >
                  <ItemIcon name={item.itemId} size="md" showLabel />
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      <span>Nguồn</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Patch History */}
      {activeTab === "history" && (
        <div className="bg-[#1e293b]/80 border border-slate-700/70 rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="font-bold text-base text-white">Lịch sử xuất hiện qua các phiên bản</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ghi nhận sự có mặt và các đợt cân bằng chỉ số qua từng mốc cập nhật PBE / Live.
            </p>
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-slate-400">Chưa ghi nhận lịch sử thay đổi.</p>
          ) : (
            <div className="space-y-2.5">
              {history.map((h, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#0f172a]/90 border border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <h4 className="font-bold text-sm text-slate-200">
                      {h.patchLabel || h.releaseId}
                    </h4>
                    <p className="text-slate-400 mt-0.5">
                      Kênh: {h.channel === "live" ? "Chính thức (Live)" : "Thử nghiệm (PBE)"}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      h.present
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {h.present ? "Có mặt trong bản này" : "Không có dữ liệu"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <EvidenceDrawer
        isOpen={drawerOpen}
        evidenceIds={activeEvidenceIds}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
