"use client";

import React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export type CapsuleButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "cyber"
  | "ghost"
  | "danger"
  | "active";

export type CapsuleButtonSize = "sm" | "md" | "lg";

export interface CapsuleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CapsuleButtonVariant;
  size?: CapsuleButtonSize;
  href?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  active?: boolean;
}

const variantClasses: Record<CapsuleButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold border border-amber-300/40 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.98]",
  secondary:
    "bg-[#161926] text-slate-200 border border-white/10 hover:border-white/20 hover:bg-[#1e2235] shadow-md shadow-black/40 active:scale-[0.98]",
  outline:
    "bg-transparent text-amber-300 border border-amber-400/40 hover:bg-amber-400/10 hover:border-amber-400/70 shadow-sm active:scale-[0.98]",
  cyber:
    "bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-500 text-slate-950 font-bold border border-cyan-300/40 shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-[0.98]",
  ghost:
    "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent active:scale-[0.98]",
  danger:
    "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 hover:border-rose-500/50 active:scale-[0.98]",
  active:
    "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold border border-amber-300 shadow-md shadow-amber-500/30"
};

const sizeClasses: Record<CapsuleButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-full min-h-[36px] gap-1.5",
  md: "px-4 py-2 text-[13px] rounded-full min-h-[44px] gap-2",
  lg: "px-6 py-2.5 text-sm rounded-full min-h-[48px] gap-2.5"
};

export function CapsuleButton({
  variant = "secondary",
  size = "md",
  href,
  leftIcon,
  rightIcon,
  loading = false,
  active = false,
  children,
  className = "",
  disabled,
  ...props
}: CapsuleButtonProps) {
  const chosenVariant = active ? "active" : variant;
  const baseClasses = `capsule-sheen inline-flex items-center justify-center font-medium transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[chosenVariant]} ${sizeClasses[size]} ${className}`;

  const content = (
    <>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span className="truncate">{children}</span>
      {!loading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button className={baseClasses} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
}
