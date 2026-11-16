"use client";

import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-white/[0.06] rounded-xl relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

export function ChampionPortraitSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden glass-panel border border-white/[0.06] p-3 flex flex-col justify-between"
      style={{ aspectRatio: "3 / 4.1" }}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="w-16 h-5 rounded-full" />
        <Skeleton className="w-12 h-4 rounded-md" />
      </div>
      <div className="space-y-2 pt-4">
        <Skeleton className="w-24 h-4 rounded-md" />
        <Skeleton className="w-16 h-3 rounded-md" />
        <div className="space-y-1 pt-2">
          <Skeleton className="w-full h-2 rounded-full" />
          <Skeleton className="w-4/5 h-2 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function MetricRowSkeleton() {
  return (
    <div className="p-3 rounded-xl bg-[#121420]/80 border border-white/[0.06] space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="w-20 h-4 rounded-md" />
        <Skeleton className="w-32 h-4 rounded-md" />
      </div>
      <Skeleton className="w-full h-2 rounded-full" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-5 rounded-2xl glass-panel border border-white/[0.06] space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-40 h-5 rounded-md" />
        <Skeleton className="w-20 h-5 rounded-full" />
      </div>
      <Skeleton className="w-full h-16 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    </div>
  );
}
