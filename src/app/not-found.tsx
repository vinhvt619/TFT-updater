import Link from "next/link";
import { ArrowLeft, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="py-16 sm:py-24 flex items-center justify-center">
      <div className="p-8 sm:p-12 rounded-2xl border border-[#242f49] bg-[#131927] text-center max-w-lg mx-auto space-y-5 shadow-2xl">
        <div className="w-16 h-16 rounded-xl bg-[#1a2236] border border-[#242f49] flex items-center justify-center text-[#06b6d4] mx-auto">
          <Search className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-[#06b6d4]/15 text-[#06b6d4] border border-[#06b6d4]/30">
            LỖI 404
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f8fafc] tracking-tight">
            Không tìm thấy trang
          </h2>
          <p className="text-xs sm:text-[13px] text-[#94a3b8] leading-relaxed max-w-sm mx-auto">
            Trang hoặc mốc dữ liệu bạn đang tìm kiếm không tồn tại hoặc đã được di dời sang đường dẫn khác.
          </p>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#0284c7] text-[#083344] font-bold text-xs hover:brightness-110 transition-all shadow-md"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Về Trang chủ</span>
          </Link>
          <Link
            href="/champions"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#242f49] bg-[#1a2236] text-[#f8fafc] font-semibold text-xs hover:bg-[#242f49] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Danh mục tướng</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
