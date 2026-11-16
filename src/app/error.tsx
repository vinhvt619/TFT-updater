"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <div className="py-16 sm:py-24 flex items-center justify-center">
      <ErrorState
        title="Đã xảy ra sự cố hiển thị"
        message={error?.message || "Không thể tải trang dữ liệu vào lúc này. Vui lòng thử lại sau giây lát."}
        onRetry={reset}
        homeHref="/champions"
      />
    </div>
  );
}
