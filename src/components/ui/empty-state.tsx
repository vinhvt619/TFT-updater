"use client";

import React from "react";
import { FolderSearch, AlertCircle, RefreshCw } from "lucide-react";
import { CapsuleButton } from "./capsule-button";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  reason?: string;
  scope?: string;
  lastUpdated?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  title = "Không tìm thấy dữ liệu phù hợp",
  description = "Hiện tại không có thông tin tương ứng với bộ lọc đã chọn.",
  reason,
  scope,
  lastUpdated,
  actionLabel,
  onAction,
  actionHref,
  className = ""
}: EmptyStateProps) {
  return (
    <div
      className={`p-8 sm:p-12 text-center rounded-2xl glass-panel border border-white/[0.08] flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 mb-4 shadow-inner">
        <FolderSearch className="w-7 h-7 text-amber-400/80" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">{title}</h3>
      <p className="text-xs sm:text-[13px] text-slate-400 max-w-md mb-5 leading-relaxed">{description}</p>

      {/* Honest metadata box */}
      {(reason || scope || lastUpdated) && (
        <div className="w-full text-left p-3.5 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-slate-400 space-y-1 mb-5">
          {reason && (
            <p>
              <span className="text-slate-300 font-semibold">Nguyên nhân:</span> {reason}
            </p>
          )}
          {scope && (
            <p>
              <span className="text-slate-300 font-semibold">Phạm vi:</span> {scope}
            </p>
          )}
          {lastUpdated && (
            <p>
              <span className="text-slate-300 font-semibold">Cập nhật lần cuối:</span> {lastUpdated}
            </p>
          )}
        </div>
      )}

      {(actionLabel || onAction || actionHref) && (
        <CapsuleButton
          variant="primary"
          size="md"
          href={actionHref}
          onClick={onAction}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          {actionLabel || "Làm mới hoặc xóa bộ lọc"}
        </CapsuleButton>
      )}
    </div>
  );
}
