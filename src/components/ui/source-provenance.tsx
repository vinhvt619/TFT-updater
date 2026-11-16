"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, AlertCircle, Copy, Check, ExternalLink } from "lucide-react";

export interface ProvenanceItem {
  label: string;
  value: string | number | null | undefined;
  isCode?: boolean;
}

export interface SourceProvenanceProps {
  title?: string;
  sourceName?: string;
  verified?: boolean;
  timestamp?: string;
  snapshotId?: string;
  epoch?: string;
  hash?: string;
  rawUrl?: string;
  archiveHref?: string;
  extraDetails?: ProvenanceItem[];
  defaultOpen?: boolean;
  className?: string;
}

export function SourceProvenance({
  title = "Nguồn & kiểm chứng kỹ thuật",
  sourceName,
  verified = true,
  timestamp,
  snapshotId,
  epoch,
  hash,
  rawUrl,
  archiveHref,
  extraDetails = [],
  defaultOpen = false,
  className = ""
}: SourceProvenanceProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const items: ProvenanceItem[] = [
    ...(sourceName ? [{ label: "Nguồn dữ liệu", value: sourceName }] : []),
    ...(timestamp ? [{ label: "Thời điểm ghi nhận", value: timestamp }] : []),
    ...(snapshotId ? [{ label: "Mã Snapshot (ID)", value: snapshotId, isCode: true }] : []),
    ...(epoch ? [{ label: "Chu kỳ Epoch", value: epoch, isCode: true }] : []),
    ...(hash ? [{ label: "Mã Hash toàn vẹn", value: hash, isCode: true }] : []),
    ...extraDetails
  ];

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-[#0c0e17]/80 overflow-hidden text-xs ${className}`}>
      {/* Header Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          {verified ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="font-semibold text-slate-300 truncate">{title}</span>
          {sourceName && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.06] text-slate-400">
              {sourceName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-slate-400">
          <span className="text-[11px] hidden sm:inline">{isOpen ? "Thu gọn" : "Xem chi tiết"}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="px-4 py-3 border-t border-white/[0.06] bg-[#07080d] space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {items.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-0.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-slate-400 text-[10px] font-medium">{item.label}</span>
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-slate-200 truncate ${
                      item.isCode ? "font-mono text-[10px] text-amber-300/90" : "font-medium"
                    }`}
                  >
                    {String(item.value ?? "Chưa có dữ liệu")}
                  </span>
                  {item.isCode && item.value && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(item.value), `${idx}`)}
                      className="text-slate-500 hover:text-slate-300 p-1 shrink-0"
                      title="Sao chép"
                    >
                      {copiedKey === `${idx}` ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Links Row */}
          {(rawUrl || archiveHref) && (
            <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04] text-[11px]">
              {rawUrl && (
                <a
                  href={rawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Dữ liệu nguồn gốc</span>
                </a>
              )}
              {archiveHref && (
                <a
                  href={archiveHref}
                  className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <span>Xem bản lưu trữ tương ứng</span>
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
