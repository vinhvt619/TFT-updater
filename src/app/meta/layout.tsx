"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, ShieldCheck, Flame, ChevronRight } from "lucide-react";
import { getCurrentLivePatchEpochId, getPatchEpoch } from "@/domain/meta/patch-epochs";

export default function MetaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const patchLabel = getPatchEpoch(getCurrentLivePatchEpochId())?.label || getCurrentLivePatchEpochId();

  // Khi đang xem chi tiết 1 đội hình cụ thể (/meta/comps/*), không hiển thị header danh sách lớn của layout cha
  const isCompDetail = pathname.startsWith("/meta/comps/");

  if (isCompDetail) {
    return <div className="w-full">{children}</div>;
  }

  const navItems = [
    {
      href: "/meta/websites?archive=true",
      label: "Mục 1: Đội hình từ các trang web",
      icon: Trophy,
      desc: "Tổng hợp từ MetaTFT, TFT Academy, TFT Flex, DataTFT, tactics.tools"
    },
    {
      href: "/meta/elite",
      label: "Mục 2: Đội hình cao thủ Thách Đấu (Top 200)",
      icon: Flame,
      desc: "Tối ưu từ cao thủ Thách Đấu Top 200 mỗi khu vực (VN, KR, NA, EUW)"
    }
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Tiêu đề chính của module xếp hạng - Cosmic Slate & Cyan Design Tokens */}
      <div className="relative rounded-2xl border border-[#242f49] bg-[#131927] p-5 sm:p-7 shadow-xl overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#06b6d4]/15 text-[#06b6d4] tracking-wide uppercase border border-[#06b6d4]/30">
                  TFT MÙA 18 • LIVE
                </span>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#1a2236] text-[#f59e0b] border border-[#242f49] font-mono">
                  {patchLabel}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#f8fafc] tracking-tight">
                XẾP HẠNG ĐỘI HÌNH (META COMPS)
              </h1>
              <p className="text-xs sm:text-[13px] text-[#94a3b8] mt-1 max-w-2xl leading-relaxed">
                Hệ thống xếp hạng chia thành 2 mục rõ ràng: Mục 1 — Đội hình tổng hợp từ 5 website meta hàng đầu và Mục 2 — Đội hình mạnh tối ưu từ cao thủ Thách Đấu Top 200 mỗi khu vực.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/compare"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1a2236] hover:bg-[#242f49] text-[#f8fafc] border border-[#242f49] hover:border-[#06b6d4] transition-all"
              >
                So sánh thông số tướng
              </Link>
            </div>
          </div>

          {/* Hai Mục Chính: Dạng Tab lớn trực quan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-5 border-t border-[#242f49]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href.split("?")[0]);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative p-4 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? "bg-[#06b6d4]/15 border-[#06b6d4] text-[#f8fafc] shadow-lg shadow-[#06b6d4]/10"
                      : "bg-[#1a2236] hover:bg-[#242f49]/80 border-[#242f49] text-[#94a3b8] hover:text-[#f8fafc]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isActive
                            ? "bg-[#06b6d4] text-[#083344]"
                            : "bg-[#131927] text-[#94a3b8] group-hover:text-[#f8fafc]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-sm sm:text-base tracking-tight text-[#f8fafc]">
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
                        isActive ? "text-[#06b6d4]" : "text-[#94a3b8]"
                      }`}
                    />
                  </div>
                  <div className="text-xs text-[#94a3b8] mt-2 pl-11 line-clamp-1">
                    {item.desc}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
