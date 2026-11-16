/**
 * Các hàm số học tính điểm hiệu suất trận đấu theo Mục 6.2 của Plan
 */

export interface PerformanceMetrics {
  top4Rate: number; // 0..1
  avgPlacement: number; // 1..8
  winRate: number; // 0..1
}

export interface BaselineMetrics {
  top4Rate: number; // Mặc định 0.50
  avgPlacement: number; // Mặc định 4.50
  winRate: number; // Mặc định 0.125
}

export const NEUTRAL_BASELINE: BaselineMetrics = {
  top4Rate: 0.50,
  avgPlacement: 4.50,
  winRate: 0.125
};

export function clamp100(val: number): number {
  return Math.min(100, Math.max(0, val));
}

/**
 * Tính điểm hiệu suất từ các metric trận đấu (Mục 6.2)
 * top4Component = clamp100(50 + 200 * (top4Rate - baselineTop4Rate))
 * placeComponent = clamp100(50 + 30 * (baselineAvgPlace - avgPlace))
 * winComponent = clamp100(50 + 150 * (winRate - baselineWinRate))
 * performanceScore = 0.50 * top4Component + 0.35 * placeComponent + 0.15 * winComponent
 */
export function calculatePerformanceScore(
  metrics: PerformanceMetrics,
  baseline: BaselineMetrics = NEUTRAL_BASELINE
): {
  score: number;
  top4Component: number;
  placeComponent: number;
  winComponent: number;
} {
  const top4Component = clamp100(50 + 200 * (metrics.top4Rate - baseline.top4Rate));
  const placeComponent = clamp100(50 + 30 * (baseline.avgPlacement - metrics.avgPlacement));
  const winComponent = clamp100(50 + 150 * (metrics.winRate - baseline.winRate));

  const rawScore = 0.50 * top4Component + 0.35 * placeComponent + 0.15 * winComponent;

  return {
    score: Math.round(rawScore * 10000) / 10000,
    top4Component: Math.round(top4Component * 10000) / 10000,
    placeComponent: Math.round(placeComponent * 10000) / 10000,
    winComponent: Math.round(winComponent * 10000) / 10000
  };
}

/**
 * Áp dụng thang điểm S/A/B/C theo Mục 6.1:
 * - 80 <= score <= 100: S
 * - 65 <= score < 80: A
 * - 50 <= score < 65: B
 * - 0 <= score < 50: C
 */
export function scoreToCandidateTier(score: number | null): "S" | "A" | "B" | "C" | null {
  if (score === null || isNaN(score)) return null;
  if (score >= 80) return "S";
  if (score >= 65) return "A";
  if (score >= 50) return "B";
  return "C";
}
