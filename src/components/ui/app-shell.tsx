"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Layers,
  Search,
  SlidersHorizontal,
  Users,
  ShieldCheck,
  Activity,
  History,
  Clock,
  Sword,
  BookOpen,
  Trophy,
  Globe,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Menu,
  X
} from "lucide-react";
import { CommandPalette } from "./command-palette";

interface AppShellProps {
  children: React.ReactNode;
}

interface NavMenuItem {
  href: string;
  label: string;
  desc: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavMenuItem[];
  isActive: (pathname: string) => boolean;
}

const navGroups: NavGroup[] = [
  {
    id: "team",
    label: "Đội hình",
    icon: Layers,
    isActive: (pathname: string) =>
      (pathname.startsWith("/meta/websites") ||
        pathname.startsWith("/meta/elite") ||
        pathname.startsWith("/meta/comps")) &&
      !pathname.startsWith("/meta/sources"),
    items: [
      {
        href: "/meta/websites?archive=true",
        label: "Hướng dẫn từ website",
        desc: "Bảng xếp hạng đội hình top meta S/A tier từ các nguồn uy tín",
        icon: Globe
      },
      {
        href: "/meta/elite",
        label: "Cao thủ Top 200",
        desc: "Thống kê thực chiến tuyển thủ Thách Đấu có độ phủ & tỷ lệ thắng",
        icon: Trophy
      }
    ]
  },
  {
    id: "compare",
    label: "So sánh",
    icon: SlidersHorizontal,
    isActive: (pathname: string) =>
      pathname.startsWith("/compare") ||
      pathname.startsWith("/history") ||
      pathname.startsWith("/timeline"),
    items: [
      {
        href: "/compare",
        label: "So sánh phiên bản",
        desc: "Đối chiếu thay đổi chỉ số, buff/nerf và cơ chế trước/sau",
        icon: SlidersHorizontal
      },
      {
        href: "/history",
        label: "Lịch sử cập nhật",
        desc: "Toàn bộ ghi chú cập nhật chính thức và báo cáo bằng chứng",
        icon: History
      },
      {
        href: "/timeline",
        label: "Dòng thời gian",
        desc: "Diễn tiến các mốc phát hành và chu kỳ bản vá",
        icon: Clock
      }
    ]
  },
  {
    id: "library",
    label: "Tra cứu",
    icon: BookOpen,
    isActive: (pathname: string) =>
      pathname.startsWith("/champions") || pathname.startsWith("/items"),
    items: [
      {
        href: "/champions",
        label: "Thư viện tướng",
        desc: "Tra cứu chi tiết chỉ số, kỹ năng, giá vàng và Tộc/Hệ Mùa 18",
        icon: Users
      },
      {
        href: "/items",
        label: "Thư viện trang bị",
        desc: "Công dụng, công thức ghép đồ chuẩn và đồ Ánh Sáng/Tạo Tác",
        icon: Sword
      }
    ]
  }
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [isArchive, setIsArchive] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isArch =
        window.location.search.includes("archive=true") ||
        pathname.includes("/history") ||
        pathname.includes("/timeline");
      setIsArchive(isArch);
    }
  }, [pathname]);

  // Close menus on route change
  useEffect(() => {
    setActiveMenu(null);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setActiveMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setMobileMenuOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0e17] text-[#f8fafc] flex flex-col antialiased selection:bg-[#06b6d4] selection:text-[#083344]">
      {/* Top Header - Horizontal Navigation */}
      <header className="sticky top-0 z-40 bg-[#131927]/95 backdrop-blur-md border-b border-[#242f49] w-full overflow-x-clip">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 h-[70px] flex items-center justify-between gap-3 sm:gap-4">
          {/* Brand Logo -> Links to Home `/` */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] rounded-xl shrink-0"
            aria-label="TFT Atlas - Trang chủ"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#06b6d4] to-[#8b5cf6] text-white flex items-center justify-center font-bold shadow-lg shadow-cyan-500/20 transition-transform group-hover:scale-105">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-[17px] tracking-wide text-[#f8fafc] leading-tight">
                TFT ATLAS<span className="text-[#06b6d4]">.</span>
              </span>
              <span className="text-[10px] text-[#94a3b8] tracking-wider hidden sm:block">
                Hiểu bản cập nhật. Chọn đội hình.
              </span>
            </div>
          </Link>

          {/* Center: 3 Primary Navigation Groups with Dropdown (Desktop >= 1024px) */}
          <nav
            ref={menuContainerRef}
            aria-label="Điều hướng chính"
            className="hidden lg:flex items-center gap-1.5"
          >
            {navGroups.map((group) => {
              const active = group.isActive(pathname);
              const isOpen = activeMenu === group.id;
              const Icon = group.icon;

              return (
                <div key={group.id} className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMenu((curr) => (curr === group.id ? null : group.id))
                    }
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    aria-label={`Mục ${group.label}`}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] ${
                      active
                        ? "bg-[#06b6d4]/15 text-[#06b6d4] border border-[#06b6d4]/30 shadow-sm shadow-[#06b6d4]/10"
                        : isOpen
                        ? "bg-[#1a2236] text-[#f8fafc] border border-[#242f49]"
                        : "text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1a2236] border border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-[#06b6d4]" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu Panel */}
                  {isOpen && (
                    <div
                      role="menu"
                      aria-orientation="vertical"
                      className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-[#131927] border border-[#242f49] p-2 shadow-2xl shadow-black/80 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    >
                      <div className="text-[10px] font-bold text-[#94a3b8] px-3 py-1.5 uppercase tracking-wider">
                        {group.label}
                      </div>
                      <div className="flex flex-col gap-1">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          const isItemActive = pathname === item.href;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              role="menuitem"
                              className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                                isItemActive
                                  ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                                  : "text-[#f8fafc] hover:bg-[#1a2236] border border-transparent"
                              }`}
                            >
                              <div
                                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                  isItemActive
                                    ? "bg-[#06b6d4]/20 text-[#06b6d4]"
                                    : "bg-[#1a2236] text-[#94a3b8]"
                                }`}
                              >
                                <ItemIcon className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-[13px] font-semibold leading-snug">
                                  {item.label}
                                </span>
                                <span className="text-[11px] text-[#94a3b8] leading-tight">
                                  {item.desc}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right: Scope Badge, Search & Mobile Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
            {/* Live Season Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a2236] border border-[#242f49] text-[11px] font-mono text-[#06b6d4]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" />
              <span className="font-bold tracking-wider">MÙA 18</span>
              <span className="text-[#94a3b8]">/</span>
              <span className="text-[#f8fafc]">18.5c</span>
            </div>

            {isArchive && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Bản lưu trữ
              </span>
            )}

            {/* Quick Search Button (⌘K) */}
            <button
              type="button"
              aria-label="Tìm kiếm nhanh"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-[#242f49] bg-[#1a2236] hover:bg-[#242f49] hover:border-[#06b6d4] px-3.5 py-1.5 text-xs text-[#94a3b8] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4]"
            >
              <Search className="w-3.5 h-3.5 text-[#06b6d4] shrink-0" />
              <span className="hidden xl:inline text-[#f8fafc] font-medium">
                Tướng, đồ, đội hình...
              </span>
              <span className="xl:hidden text-[#f8fafc] font-medium">Tìm</span>
              <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-[#131927] text-[#94a3b8] border border-[#242f49] rounded">
                ⌘ K
              </kbd>
            </button>

            {/* Mobile / Tablet Menu Toggle Button (< 1024px) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu điều hướng"}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center bg-[#1a2236] border border-[#242f49] text-[#f8fafc] hover:bg-[#242f49]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Dropdown Drawer (< 1024px) */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#242f49] bg-[#131927] px-4 py-4 space-y-4 max-h-[calc(100vh-70px)] overflow-y-auto">
            {navGroups.map((group) => {
              const active = group.isActive(pathname);
              const Icon = group.icon;

              return (
                <div key={group.id} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#06b6d4] uppercase tracking-wider px-2">
                    <Icon className="w-3.5 h-3.5" />
                    <span>{group.label}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isItemActive = pathname === item.href;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 p-3 rounded-xl min-h-[48px] ${
                            isItemActive
                              ? "bg-[#06b6d4]/15 text-[#06b6d4] font-bold"
                              : "text-[#f8fafc] hover:bg-[#1a2236]"
                          }`}
                        >
                          <ItemIcon className="w-4 h-4 shrink-0 text-[#94a3b8]" />
                          <div className="flex flex-col">
                            <span className="text-[13px]">{item.label}</span>
                            <span className="text-[10px] text-[#94a3b8]">{item.desc}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Mobile Footer Links */}
            <div className="pt-3 border-t border-[#242f49] flex items-center justify-between text-xs text-[#94a3b8] px-2">
              <Link href="/meta/sources" className="hover:text-[#06b6d4] py-2">
                Nguồn dữ liệu
              </Link>
              <Link href="/data-status" className="hover:text-[#06b6d4] py-2">
                Trạng thái
              </Link>
              <Link href="/history" className="hover:text-[#06b6d4] py-2">
                Lịch sử
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Full-Width Body - NO SIDEBAR, No awkward side whitespace */}
      <div className="flex-1 w-full flex flex-col min-w-0">
        <main className="flex-1 w-full min-w-0 px-4 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-8 min-h-[850px] overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Global Footer */}
      <footer className="border-t border-[#242f49] bg-[#131927] py-6 px-4 sm:px-6 lg:px-8 xl:px-12 text-xs text-[#94a3b8] w-full">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-bold text-[#f8fafc]">TFT ATLAS</span>
            <span className="mx-2">·</span>
            <span>Bản đồ tra cứu Đấu Trường Chân Lý Mùa 18</span>
            <span className="mx-2 hidden sm:inline">·</span>
            <span className="block sm:inline mt-1 sm:mt-0 text-[11px] text-[#94a3b8]/80">
              Dữ liệu trích xuất từ Riot Games & các cổng meta uy tín.
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs shrink-0">
            <Link
              href="/meta/sources"
              className="text-[#94a3b8] hover:text-[#06b6d4] transition-colors"
            >
              Nguồn dữ liệu
            </Link>
            <Link
              href="/data-status"
              className="text-[#94a3b8] hover:text-[#06b6d4] transition-colors"
            >
              Trạng thái dữ liệu
            </Link>
            <Link
              href="/history"
              className="text-[#94a3b8] hover:text-[#06b6d4] transition-colors"
            >
              Lịch sử phiên bản
            </Link>
          </div>
        </div>
      </footer>

      {/* Quick Search Dialog (⌘K) */}
      <CommandPalette isOpen={searchOpen} onClose={closeSearch} />
    </div>
  );
}
