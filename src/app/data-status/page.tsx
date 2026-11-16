"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Database, RefreshCw, Server, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card";
import { SourceProvenance } from "@/components/ui/source-provenance";

export default function DataStatusPage() {
  const [status, setStatus] = useState<any>(null);
  const [ready, setReady] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/data-status").then((r) => r.json()),
      fetch("/api/ready").then((r) => r.json())
    ])
      .then(([statusRes, readyRes]) => {
        setStatus(statusRes?.data);
        setReady(readyRes);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="glass-panel-elevated rounded-2xl border border-white/[0.08] p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-emerald-400 shrink-0" />
              <span>Trạng Thái Dữ Liệu & Nguồn Thu Thập</span>
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Báo cáo giám sát thời gian thực về tình trạng cơ sở dữ liệu, các nguồn thu thập, tính toàn vẹn và độ tươi mới của dữ liệu Mùa 18.
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Hệ thống Hoạt Động Bình Thường</span>
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center glass-panel rounded-2xl max-w-md mx-auto space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
          <p className="text-slate-400 text-xs">Đang kiểm tra trạng thái hệ thống...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel rounded-2xl border border-white/[0.08] p-4 sm:p-5 space-y-2 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Cơ sở dữ liệu</span>
              </div>
              <div className="text-lg font-bold text-white">
                {ready?.status === "ready" ? "Sẵn sàng hoạt động" : "Chưa kết nối"}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Động cơ: <strong className="text-slate-200">{ready?.db?.engine || "pglite"}</strong>
              </p>
            </div>

            <div className="glass-panel rounded-2xl border border-white/[0.08] p-4 sm:p-5 space-y-2 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Chế độ dữ liệu</span>
              </div>
              <div className="text-lg font-bold uppercase text-emerald-400">
                {status?.dataMode === "real" ? "ĐÃ XÁC MINH (REAL)" : "CHƯA CẤU HÌNH"}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Mục tiêu: <strong className="text-slate-200">TFT Mùa {status?.targetSet || 18}</strong>
              </p>
            </div>

            <div className="glass-panel rounded-2xl border border-white/[0.08] p-4 sm:p-5 space-y-2 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Worker thu thập</span>
              </div>
              <div className="text-lg font-bold text-white">
                {status?.ingestEnabled ? "Đang bật" : "Tắt (chỉ đọc)"}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Chu kỳ: <strong className="text-slate-200">{status?.ingestIntervalMinutes || 120} phút</strong>
              </p>
            </div>
          </div>

          {/* Sources Table */}
          <GlassCard variant="default">
            <GlassCardHeader
              title="Danh Sách Nguồn Dữ Liệu Cấu Hình"
              subtitle="Các nguồn thu thập dữ liệu độc lập phục vụ tính điểm đồng thuận và kiểm chứng"
              icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
            />
            <GlassCardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/[0.06]">
                    <tr>
                      <th className="py-2.5 px-3">Tên nguồn</th>
                      <th className="py-2.5 px-3">Kênh</th>
                      <th className="py-2.5 px-3">Trạng thái hỗ trợ</th>
                      <th className="py-2.5 px-3">Tự động xuất bản</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {status?.sources?.map((s: any) => (
                      <tr key={s.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 font-semibold text-white">
                          {s.name}
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{s.endpoint}</div>
                        </td>
                        <td className="py-3 px-3 uppercase text-slate-300 font-bold">{s.channel}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                              s.status === "supported"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {s.status === "supported" ? "Hỗ trợ đầy đủ" : "Chờ dữ liệu chính thức"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-medium">
                          {s.autoPublish ? "Có" : "Không (Cần phê duyệt)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Technical Provenance */}
          <SourceProvenance
            title="Thông tin kiến trúc dữ liệu"
            sourceName="TFT-Updater Core Health Monitor"
            extraDetails={[
              { label: "Môi trường", value: process.env.NODE_ENV || "production" },
              { label: "Hỗ trợ PGlite", value: ready?.db?.engine === "pglite" ? "Bật" : "Tắt" }
            ]}
          />
        </div>
      )}
    </div>
  );
}
