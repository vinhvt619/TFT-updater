import React from "react";
import { AlertTriangle } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs md:text-sm flex items-center justify-center gap-2 font-medium">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>
        <strong>Dữ liệu minh họa</strong> — không phải thông số thật của TFT mùa 18. Website đang chạy ở chế độ Demo để kiểm thử kiến trúc.
      </span>
    </div>
  );
}
