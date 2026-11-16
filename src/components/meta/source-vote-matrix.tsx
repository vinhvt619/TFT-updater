import React from "react";

interface SourceVoteMatrixProps {
  sourceVotes: Record<string, {
    originalTier: string | null;
    normalizedVote: number | null;
    isStatistical?: boolean;
    sourceUpdatedAt?: string | null;
  }>;
}

const SOURCES = [
  { id: "metatft", name: "MetaTFT" },
  { id: "tftacademy", name: "TFT Academy" },
  { id: "tftflex", name: "TFT Flex" },
  { id: "datatft", name: "DataTFT" },
  { id: "tactics_tools", name: "tactics.tools" }
];

export function SourceVoteMatrix({ sourceVotes }: SourceVoteMatrixProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {SOURCES.map((s) => {
        const vote = sourceVotes[s.id];
        if (!vote) {
          return (
            <div
              key={s.id}
              className="px-2 py-1 bg-slate-900/60 border border-slate-800 rounded text-center text-xs text-slate-500"
              title={`${s.name}: Chưa có dữ liệu`}
            >
              <div className="text-[10px] text-slate-500 truncate">{s.name}</div>
              <div className="font-semibold text-slate-600">—</div>
            </div>
          );
        }

        const tierColor = vote.originalTier
          ? vote.originalTier.startsWith("S")
            ? "text-amber-400 bg-amber-950/40 border-amber-800/60"
            : vote.originalTier.startsWith("A")
            ? "text-purple-400 bg-purple-950/40 border-purple-800/60"
            : vote.originalTier.startsWith("B")
            ? "text-blue-400 bg-blue-950/40 border-blue-800/60"
            : "text-slate-400 bg-slate-900 border-slate-700"
          : vote.isStatistical
          ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/60"
          : "text-slate-400 bg-slate-900 border-slate-700";

        const label = vote.originalTier || (vote.normalizedVote !== null ? `${Math.round(vote.normalizedVote)}đ` : "—");

        return (
          <div
            key={s.id}
            className={`px-2 py-1 rounded border text-center text-xs transition-colors ${tierColor}`}
            title={`${s.name}: ${vote.originalTier ? `Bậc ${vote.originalTier}` : `Điểm thống kê ${vote.normalizedVote}`}`}
          >
            <div className="text-[10px] opacity-75 truncate">{s.name}</div>
            <div className="font-bold flex items-center justify-center gap-1">
              <span>{label}</span>
              {vote.isStatistical && (
                <span className="text-[8px] bg-emerald-800 text-emerald-100 px-1 rounded-full">
                  Số liệu
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
