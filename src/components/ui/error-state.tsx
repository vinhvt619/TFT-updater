"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { CapsuleButton } from "./capsule-button";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  homeHref?: string;
  className?: string;
}

export function ErrorState({
  title = "Đã xảy ra sự cố hiển thị",
  message = "Hệ thống không thể tải thông tin vào lúc này. Dữ liệu nguồn đang được đồng bộ hoặc gặp gián đoạn tạm thời.",
  onRetry,
  homeHref = "/",
  className = ""
}: ErrorStateProps) {
  return (
    <div
      className={`p-8 sm:p-12 text-center rounded-2xl glass-panel border border-rose-500/20 flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-inner">
        <AlertTriangle className="w-7 h-7" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">{title}</h3>
      <p className="text-xs sm:text-[13px] text-slate-400 max-w-md mb-6 leading-relaxed">{message}</p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <CapsuleButton
            variant="primary"
            size="md"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Thử lại
          </CapsuleButton>
        )}
        {homeHref && (
          <CapsuleButton
            variant="secondary"
            size="md"
            href={homeHref}
            leftIcon={<Home className="w-3.5 h-3.5" />}
          >
            Về Trang chủ
          </CapsuleButton>
        )}
      </div>
    </div>
  );
}
