import { Impact, StatUnit } from "./types";

export function formatStatValue(value: number, unit: StatUnit, precision: number = 0): string {
  const rounded = precision > 0 ? value.toFixed(precision) : Math.round(value).toString();
  switch (unit) {
    case "percent":
      return `${rounded}%`;
    case "attacks_per_second":
      return `${value.toFixed(2)}`;
    case "seconds":
      return `${rounded}s`;
    case "gold":
      return `${rounded}g`;
    case "mana":
      return `${rounded}`;
    case "ratio":
      return `x${value.toFixed(2)}`;
    default:
      return rounded;
  }
}

export function formatDelta(
  absoluteDelta: number | null,
  relativeDeltaPercent: number | null,
  percentagePointDelta: number | null,
  unit: StatUnit
): string {
  if (absoluteDelta === null) return "";

  const sign = absoluteDelta > 0 ? "+" : "";

  // Với field là phần trăm: ưu tiên hiển thị điểm phần trăm
  if (unit === "percent" && percentagePointDelta !== null) {
    const ptSign = percentagePointDelta > 0 ? "+" : "";
    return `${ptSign}${percentagePointDelta.toFixed(1)} điểm %`;
  }

  const absStr = `${sign}${formatStatValue(absoluteDelta, unit, unit === "attacks_per_second" ? 2 : 0)}`;

  if (relativeDeltaPercent !== null && Math.abs(relativeDeltaPercent) > 0.01) {
    const relSign = relativeDeltaPercent > 0 ? "+" : "";
    return `${absStr} (${relSign}${relativeDeltaPercent.toFixed(1)}%)`;
  }

  return absStr;
}

export function getImpactColorClasses(impact: Impact): {
  badge: string;
  text: string;
  border: string;
} {
  switch (impact) {
    case "buff":
      return {
        badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        text: "text-emerald-400",
        border: "border-emerald-500/40"
      };
    case "nerf":
      return {
        badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        text: "text-rose-400",
        border: "border-rose-500/40"
      };
    case "mixed":
      return {
        badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        text: "text-amber-400",
        border: "border-amber-500/40"
      };
    case "neutral":
      return {
        badge: "bg-slate-500/15 text-slate-400 border-slate-500/30",
        text: "text-slate-400",
        border: "border-slate-500/40"
      };
    case "unknown":
    default:
      return {
        badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        text: "text-blue-400",
        border: "border-blue-500/40"
      };
  }
}

export function getImpactLabelVi(impact: Impact): string {
  switch (impact) {
    case "buff":
      return "Tăng sức mạnh (Buff)";
    case "nerf":
      return "Giảm sức mạnh (Nerf)";
    case "mixed":
      return "Hỗn hợp (Mixed)";
    case "neutral":
      return "Trung lập / Điều chỉnh";
    case "unknown":
    default:
      return "Chưa phân loại";
  }
}
