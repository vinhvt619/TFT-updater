"use client";

import React from "react";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive";
  glow?: "none" | "gold" | "cyan" | "purple";
  children: React.ReactNode;
  className?: string;
}

const glowClasses = {
  none: "",
  gold: "hover:border-amber-400/40 hover:shadow-[0_0_25px_rgba(212,175,55,0.2)]",
  cyan: "hover:border-cyan-400/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.2)]",
  purple: "hover:border-purple-400/40 hover:shadow-[0_0_25px_rgba(168,85,247,0.2)]"
};

export function GlassCard({
  variant = "default",
  glow = "none",
  children,
  className = "",
  ...props
}: GlassCardProps) {
  const panelClass = variant === "elevated" ? "glass-panel-elevated" : "glass-panel";
  const interactiveClass =
    variant === "interactive" ? "glass-panel-hover cursor-pointer active:scale-[0.99]" : "";

  return (
    <div
      className={`rounded-2xl transition-all duration-300 ${panelClass} ${interactiveClass} ${glowClasses[glow]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCardHeader({
  title,
  subtitle,
  action,
  icon,
  className = ""
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-amber-400 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function GlassCardContent({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}
