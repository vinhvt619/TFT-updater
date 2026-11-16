"use client";

import React, { useState, useEffect } from "react";
import { RankingSnapshot } from "@/domain/meta/schemas";
import { TierBoard } from "@/components/meta/tier-board";
import { getEliteBadgeInfo } from "@/domain/meta/elite-helper";
import { Loader2, AlertCircle, Clock, Key, ShieldAlert, Globe, Calendar, Flame } from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

const regions = [
  { id: "all", label: "Tất cả vùng" },
  { id: "vn", label: "Việt Nam (VN)" },
  { id: "kr", label: "Hàn Quốc (KR)" },
  { id: "na", label: "Bắc Mỹ (NA)" },
  { id: "euw", label: "Tây Âu (EUW)" }
];

const windows = [
  { id: "24h", label: "24 giờ qua" },
  { id: "72h", label: "3 ngày qua (72h)" },
  { id: "7d", label: "7 ngày qua" }
];

export default function MetaElitePage() {
  const mode = "real" as const;
  const [region, setRegion] = useState("all");
  const [windowStr, setWindowStr] = useState("72h");

  const [snapshot, setSnapshot] = useState<RankingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectingInfo, setCollectingInfo] = useState<{ message?: string; requestedScope?: any } | null>(
    { message: "Chưa có snapshot dữ liệu thật đã kiểm chứng cho phạm vi yêu cầu." }
  );
  const [revokedInfo, setRevokedInfo] = useState<{ message?: string; quarantineReason?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadSnapshot() {
      setLoading(true);
      setSnapshot(null);
      setCollectingInfo(null);
      setRevokedInfo(null);
      setErrorMsg(null);

      try {
        const res = await fetch(
          `/api/v1/meta/rankings?board=elite&region=${region}&window=${windowStr}&mode=${mode}`
        );
        const data = await res.json();

        if (isCancelled) return;

        if (res.ok) {
          if (data.status === "collecting" || !data.id || data.ready === false) {
            setCollectingInfo(data);
            setSnapshot(null);
          } else if (data && Array.isArray(data.rows) && data.rankingScope) {
            setSnapshot(data);
          } else {
            setErrorMsg("Cấu trúc dữ liệu snapshot không hợp lệ.");
          }
        } else if (res.status === 404) {
          if (data.error?.status === "collecting" || data.error?.code === "NO_DATA_AVAILABLE") {
            setCollectingInfo(data.error);
          } else {
            setErrorMsg(data.error?.message || "Không tìm thấy dữ liệu xếp hạng.");
          }
        } else if (res.status === 410) {
          setRevokedInfo(data.error);
        } else {
          setErrorMsg(data.error?.message || `Lỗi máy chủ (${res.status})`);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Failed to load elite ranking:", err);
          setErrorMsg(err.message || "Lỗi kết nối mạng khi tải dữ liệu.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [region, windowStr, mode]);

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="glass-panel-elevated rounded-2xl border border-white/[0.08] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-white flex flex-wrap items-center gap-2.5">
            <Flame className="w-6 h-6 text-purple-400 shrink-0" />
            <span>Mục 2 — Đội hình cao thủ Thách Đấu Top 200</span>
            {(() => {
              const badge = getEliteBadgeInfo(snapshot, loading);
              return (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    badge.isVerified
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "bg-white/[0.04] text-slate-400 border border-white/[0.08]"
                  }`}
                >
                  {badge.text}
                </span>
              );
            })()}
          </h2>
          <p className="text-xs sm:text-[13px] text-slate-400 max-w-3xl leading-relaxed">
            Thống kê tỷ lệ thắng, tỷ lệ lọt Top 4 và thứ hạng trung bình (1–8) từ các trận đấu của người chơi Thách Đấu được thu thập theo khu vực và phiên bản.
          </p>
        </div>

        {/* Region & Time Window Pill Selectors */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#1e293b]/90 border border-slate-700/70">
            {regions.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRegion(r.id)}
                className={`capsule-sheen px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  region === r.id
                    ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {r.label.split(" ")[0]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#1e293b]/90 border border-slate-700/70">
            {windows.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWindowStr(w.id)}
                className={`capsule-sheen px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  windowStr === w.id
                    ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {w.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1. Loading State */}
      {loading && (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400 glass-panel rounded-2xl border border-white/[0.08]">
          <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
          <span className="text-xs">Đang truy vấn số liệu cao thủ ({region.toUpperCase()}, {windowStr})...</span>
        </div>
      )}

      {/* 2. Collecting State (Polite, no env vars or stack traces) */}
      {!loading && collectingInfo && (
        <div className="glass-panel rounded-2xl border border-purple-500/20 p-6 sm:p-8 space-y-5 text-slate-300 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0 mt-0.5">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">
                Đang thu thập dữ liệu đấu trường Cao thủ
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                {collectingInfo.message || "Chưa có snapshot dữ liệu thật đã kiểm chứng cho phạm vi yêu cầu."}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a]/90 border border-slate-700/60 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Xác thực kết nối máy chủ Riot</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Để thu thập các trận đấu thật của Top 200 Cao thủ từ máy chủ Riot (KR, VN, NA, EUW), hệ thống cần kết nối cổng dữ liệu chính thức của nhà phát hành. Dữ liệu chưa đủ ngưỡng mẫu sẽ không hiển thị phỏng đoán.
            </p>
          </div>
        </div>
      )}

      {/* 3. Revoked / Quarantined */}
      {!loading && revokedInfo && (
        <div className="p-6 rounded-2xl glass-panel border border-rose-500/30 text-rose-300 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-200">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>Mốc dữ liệu đã bị cách ly hoặc thu hồi</span>
          </div>
          <p className="text-xs text-rose-300/90 leading-relaxed">{revokedInfo.message}</p>
          {revokedInfo.quarantineReason && (
            <p className="text-xs font-medium text-rose-400">
              <strong>Lý do cách ly:</strong> {revokedInfo.quarantineReason}
            </p>
          )}
        </div>
      )}

      {/* 4. Error State */}
      {!loading && errorMsg && (
        <ErrorState
          title="Lỗi truy vấn dữ liệu"
          message={errorMsg}
        />
      )}

      {/* 5. Render TierBoard when Ready */}
      {!loading && snapshot && (
        <div className="space-y-4">
          <TierBoard
            initialSnapshot={snapshot}
            boardType="elite"
            currentRegion={region}
            currentWindow={windowStr}
            onRegionChange={setRegion}
            onWindowChange={setWindowStr}
          />
        </div>
      )}
    </div>
  );
}
