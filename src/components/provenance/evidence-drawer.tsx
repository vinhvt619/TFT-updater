"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink, X, BookOpen, Clock, FileText } from "lucide-react";
import { EvidenceRecord } from "@/domain/types";

interface EvidenceDrawerProps {
  evidenceIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function EvidenceDrawer({ evidenceIds, isOpen, onClose }: EvidenceDrawerProps) {
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || evidenceIds.length === 0) return;
    setLoading(true);
    Promise.all(
      evidenceIds.map((id) =>
        fetch(`/api/v1/evidence/${id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => (json ? json.data : null))
          .catch(() => null)
      )
    )
      .then((records) => {
        setEvidenceList(records.filter((r): r is EvidenceRecord => r !== null));
      })
      .finally(() => setLoading(false));
  }, [isOpen, evidenceIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 p-6 flex flex-col h-full shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">Bằng chứng & Nguồn dẫn</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 flex-1 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
              Đang tải thông tin nguồn...
            </div>
          ) : evidenceList.length === 0 ? (
            <div className="text-slate-400 text-sm py-8 text-center">
              Không tìm thấy thông tin dẫn nguồn cụ thể cho mục này.
            </div>
          ) : (
            evidenceList.map((ev) => (
              <div
                key={ev.id}
                className="p-4 rounded-lg bg-slate-850 border border-slate-800 space-y-2 text-sm"
              >
                <div className="flex items-center justify-between font-semibold text-emerald-400">
                  <span>{ev.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {ev.kind}
                  </span>
                </div>

                {ev.url && (
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:underline break-all"
                  >
                    <span>{ev.url}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                )}

                {ev.locator && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Vị trí: <code>{ev.locator}</code></span>
                  </div>
                )}

                {ev.snippet && (
                  <blockquote className="p-2.5 rounded bg-slate-900 border-l-2 border-emerald-500 text-xs text-slate-300 italic">
                    &quot;{ev.snippet}&quot;
                  </blockquote>
                )}

                {ev.sourcePublishedAt && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>Công bố: {new Date(ev.sourcePublishedAt).toLocaleString("vi-VN")}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
          Mọi số liệu trong hệ thống đều được liên kết trực tiếp với evidence gốc để kiểm chứng độc lập.
        </div>
      </div>
    </div>
  );
}
