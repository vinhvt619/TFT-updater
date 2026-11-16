"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { History, Calendar, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { ReleaseMeta } from "@/domain/types";
import { sortReleaseMeta } from "@/domain/versioning";

export default function TimelinePage() {
  const [releases, setReleases] = useState<ReleaseMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const mode = "real" as const;

  useEffect(() => {
    fetch("/api/v1/releases?dataset=real")
      .then((res) => res.json())
      .then((json) => {
        if (json?.data) setReleases(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const orderedReleases = sortReleaseMeta(releases);
  const pbeReleases = orderedReleases.filter((r) => r.channel === "pbe" && r.historyVisibility !== "archive");
  const liveReleases = orderedReleases.filter((r) => r.channel === "live" && r.historyVisibility !== "archive");
  const releaseLabel = (rel: ReleaseMeta) => (rel.displayVersion || rel.patchLabel || rel.occurrenceKey)
    .replace(/\bLive\b/gi, "Chính thức")
    .replace(/\bPBE\b/gi, "PBE thử nghiệm");

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <History className="w-6 h-6 text-emerald-400" />
          Dòng Thời Gian Các Bản Cập Nhật
          <span className="text-[10px] px-2 py-1 rounded-full border text-emerald-300 border-emerald-500/40">
            Dữ liệu đã xác minh
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Theo dõi tiến trình từ các bản dựng thử nghiệm PBE đến các bản phát hành chính thức của Mùa 18.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">Đang tải dòng thời gian...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PBE Branch */}
          <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-bold text-base text-blue-400">Nhánh Thử Nghiệm (PBE)</h2>
              <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                {pbeReleases.length} mốc
              </span>
            </div>

            <div className="space-y-3">
              {pbeReleases.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-4">Chưa có mốc PBE nào được lưu.</div>
              ) : (
                pbeReleases.map((rel) => (
                  <div
                    key={rel.id}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-700 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-200">{releaseLabel(rel)}</span>
                      <span className="text-[10px] text-slate-500">{rel.comparisonStatus === "available" ? "đầy đủ" : rel.comparisonStatus === "notes_only" ? "chỉ có ghi chú" : rel.comparisonStatus === "quarantined" ? "cách ly" : rel.comparisonStatus === "gap" ? "thiếu dữ liệu" : "đang thu thập"}</span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(rel.observedAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
                      <span>Mã: <code>{rel.occurrenceKey}</code></span>
                      {rel.currentSnapshotId && (
                        <Link
                          href={`/compare?toRelease=${rel.id}`}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
                        >
                          <span>Mở xem</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Branch */}
          <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-bold text-base text-emerald-400">Nhánh Chính Thức</h2>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                {liveReleases.length} mốc
              </span>
            </div>

            <div className="space-y-3">
              {liveReleases.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-4">Chưa có mốc chính thức nào được lưu.</div>
              ) : (
                liveReleases.map((rel) => (
                  <div
                    key={rel.id}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-700 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-200">{releaseLabel(rel)}</span>
                      <span className="text-[10px] text-slate-500">{rel.comparisonStatus === "available" ? "đầy đủ" : rel.comparisonStatus === "notes_only" ? "chỉ có ghi chú" : rel.comparisonStatus === "quarantined" ? "cách ly" : rel.comparisonStatus === "gap" ? "thiếu dữ liệu" : "đang thu thập"}</span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(rel.observedAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
                      <span>Mã: <code>{rel.occurrenceKey}</code></span>
                      {rel.currentSnapshotId && (
                        <Link
                          href={`/compare?toRelease=${rel.id}`}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
                        >
                          <span>Mở xem</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
