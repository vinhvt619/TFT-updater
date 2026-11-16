"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Sparkles, Search, Layers, SlidersHorizontal, Users, Shield } from "lucide-react";
import { CommandPalette } from "./command-palette";

const navLinks = [
  { href: "/meta/websites?archive=true", label: "Đội hình mạnh", icon: Layers },
  { href: "/items", label: "Trang bị", icon: Shield },
  { href: "/champions", label: "Danh mục tướng", icon: Users },
  { href: "/compare", label: "So sánh", icon: SlidersHorizontal }
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-700/60 bg-[#0f172a]/90 backdrop-blur-xl shadow-lg">
        <div className="mx-auto max-w-7xl min-w-0 px-3 sm:px-6">
          <div className="flex min-w-0 items-center justify-between gap-3 py-3">
            {/* Logo */}
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded-xl"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-[1px] shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-[#0f172a] rounded-[11px] flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-black text-white text-base sm:text-lg tracking-wide leading-tight group-hover:text-amber-300 transition-colors">
                  TFT Mùa 18
                </span>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                  Bản Live 18.2 · Tracker
                </span>
              </div>
            </Link>

            {/* Quick Search Button (Ctrl+K) */}
            <button
              type="button"
              aria-label="Mở tìm kiếm nhanh"
              onClick={() => setOpen(true)}
              className="capsule-sheen flex min-w-0 items-center gap-2.5 rounded-full border border-slate-700/80 bg-[#1e293b]/80 hover:bg-[#27354f] hover:border-amber-400/50 px-3.5 py-1.5 text-xs text-slate-200 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="truncate hidden sm:inline text-slate-200 font-medium">Tìm kiếm nhanh</span>
              <span className="truncate sm:hidden text-slate-200 font-medium">Tìm</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 text-slate-300 border border-slate-700">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Main Navigation Pill Bar */}
          <nav
            aria-label="Điều hướng chính"
            className="flex min-w-0 gap-1.5 overflow-x-auto pb-2.5 scrollbar-none"
          >
            {navLinks.map(({ href, label, icon: Icon }) => {
              const isActive =
                href.startsWith("/meta")
                  ? pathname === "/" || pathname?.startsWith("/meta")
                  : pathname === href || (href !== "/" && pathname?.startsWith(href));

              return (
                <Link
                  key={href}
                  href={href}
                  className={`capsule-sheen shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-[13px] font-bold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300/60"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <CommandPalette isOpen={open} onClose={close} />
    </>
  );
}
