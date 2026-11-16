import { ReleaseChangeRow } from "../types";
import { FIELD_REGISTRY } from "../field-registry";

export type ImpactType =
  | "buff"
  | "nerf"
  | "mixed"
  | "rework"
  | "bugfix"
  | "adjustment"
  | "neutral"
  | "unknown";

export function numericValues(value: unknown): number[] | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return [value];
  if (Array.isArray(value)) {
    const flattened = value.flatMap((item) => numericValues(item) ?? []);
    return flattened.length > 0 ? flattened : null;
  }
  if (typeof value === "string") {
    // Standardize Vietnamese comma decimal notation (e.g. "1,9" -> "1.9")
    const normalized = value.replace(/(\d+),(\d+)/g, "$1.$2");
    const matches = normalized.match(/-?\d+(?:\.\d+)?/g);
    if (!matches) return null;
    return matches.map((m) => Number(m));
  }
  return null;
}

export function getFieldPolarity(change: ReleaseChangeRow): "higher_is_buff" | "lower_is_buff" | "unknown" {
  if (change.fieldKey && FIELD_REGISTRY[change.fieldKey]) {
    return FIELD_REGISTRY[change.fieldKey].direction;
  }

  // Phân tích ngữ cảnh theo từ khóa Riot
  const text = `${change.rawText} ${change.changeType || ""}`.toLowerCase();

  // Năng lượng tối đa (mana_max) hoặc thời gian hồi chiêu: giảm là buff (lower_is_buff)
  if (
    /năng\s*lượng\s*tối\s*đa|mana\s*tối\s*đa|max\s*mana/.test(text) ||
    /hồi\s*chiêu|thời\s*gian\s*hồi|cooldown/.test(text)
  ) {
    return "lower_is_buff";
  }

  // Năng lượng khởi đầu (starting mana), sát thương, máu, giáp, tốc đánh: tăng là buff (higher_is_buff)
  if (
    /năng\s*lượng\s*khởi\s*đầu|starting\s*mana|sát\s*thương|máu|giáp|kháng\s*phép|tốc\s*độ\s*đánh|tốc\s*đánh|hồi\s*máu|lá\s*chắn|shield|damage/i.test(text)
  ) {
    return "higher_is_buff";
  }

  return "unknown";
}

export function isNoopChange(change: ReleaseChangeRow): boolean {
  if (change.before.state === "known" && change.after.state === "known") {
    if (change.before.value === change.after.value) return true;
    if (JSON.stringify(change.before.value) === JSON.stringify(change.after.value)) return true;

    // If both values are strings, check if they differ in text content
    if (typeof change.before.value === "string" && typeof change.after.value === "string") {
      const bStr = change.before.value.trim();
      const aStr = change.after.value.trim();
      if (bStr === aStr) return true;
      const hasTextLetters = (s: string) => /[a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9]/.test(s);
      if (hasTextLetters(bStr) || hasTextLetters(aStr)) {
        return false;
      }
    }

    const beforeNums = numericValues(change.before.value);
    const afterNums = numericValues(change.after.value);
    if (beforeNums && afterNums && beforeNums.length === afterNums.length) {
      const def = change.fieldKey ? FIELD_REGISTRY[change.fieldKey] : undefined;
      const epsilon = def?.epsilon ?? 1e-9;
      if (beforeNums.every((v, i) => Math.abs(v - afterNums[i]) <= epsilon)) {
        return true;
      }
    }
  }
  return false;
}

export function rowImpact(change: ReleaseChangeRow): "buff" | "nerf" | "mixed" | "neutral" | "unknown" {
  const polarity = getFieldPolarity(change);

  // Check if numeric values are available and polarity direction is known
  if (change.before.state === "known" && change.after.state === "known") {
    const before = numericValues(change.before.value);
    const after = numericValues(change.after.value);
    if (before && after && before.length === after.length) {
      if (polarity === "higher_is_buff" || polarity === "lower_is_buff") {
        let positiveCount = 0;
        let negativeCount = 0;
        for (let index = 0; index < before.length; index++) {
          if (after[index] > before[index]) positiveCount++;
          if (after[index] < before[index]) negativeCount++;
        }
        if (positiveCount > 0 && negativeCount > 0) {
          return "mixed";
        }
        if (positiveCount > 0) {
          return polarity === "lower_is_buff" ? "nerf" : "buff";
        }
        if (negativeCount > 0) {
          return polarity === "lower_is_buff" ? "buff" : "nerf";
        }
        return "neutral";
      }
    }
  }

  // Explicit semantic changeType from source
  const changeType = (change.changeType || "").toLowerCase();
  if (/^buff$|tăng\s*sức\s*mạnh/i.test(changeType)) return "buff";
  if (/^nerf$|giảm\s*sức\s*mạnh/i.test(changeType)) return "nerf";

  if (polarity === "higher_is_buff") {
    if (/increase|increased|tăng/i.test(changeType)) return "buff";
    if (/decrease|decreased|giảm/i.test(changeType)) return "nerf";
  } else if (polarity === "lower_is_buff") {
    if (/increase|increased|tăng/i.test(changeType)) return "nerf";
    if (/decrease|decreased|giảm/i.test(changeType)) return "buff";
  }

  return "unknown";
}

export interface ParsedChangeInfo {
  beforeVal: string;
  afterVal: string;
  hasDistinctValues: boolean;
  impact: "buff" | "nerf" | "mixed" | "neutral" | "unknown";
  type: ImpactType;
  typeLabelVi: string;
  badgeClass: {
    bg: string;
    border: string;
    text: string;
  };
}

/**
 * Hàm phân tích chi tiết thay đổi dùng chung duy nhất cho cả Server & Client.
 * FIN-04: Thống nhất mô hình compare/impact, giữ mixed cho vector sao,
 * phân biệt mana_start (tăng=buff) và mana_max (giảm=buff).
 */
export function parseChangeDetail(change: ReleaseChangeRow): ParsedChangeInfo {
  const rawText = String(change.rawText || "").trim();
  const changeType = String(change.changeType || "").toLowerCase();

  let beforeVal = "";
  let afterVal = "";
  let hasDistinctValues = false;

  // 1. Lấy từ before / after nếu có giá trị known
  if (change.before?.state === "known" && change.after?.state === "known") {
    beforeVal = Array.isArray(change.before.value)
      ? change.before.value.join(" / ")
      : String(change.before.value ?? "");
    afterVal = Array.isArray(change.after.value)
      ? change.after.value.join(" / ")
      : String(change.after.value ?? "");
    hasDistinctValues = Boolean(beforeVal || afterVal);
  }

  // 2. Nếu chưa có, phân tích từ chuỗi rawText của Riot
  if (!hasDistinctValues && rawText) {
    const arrowMatch = rawText.match(/^(?:.*?:)?\s*(.*?)\s*(?:⇒|=>|->|→|\bto\b|\bthành\b)\s*(.*?)$/i);
    if (arrowMatch && arrowMatch[1] && arrowMatch[2]) {
      beforeVal = arrowMatch[1].trim().replace(/^.*?(?:từ|from)\s+/i, "");
      afterVal = arrowMatch[2].trim();
      hasDistinctValues = true;
    }
  }

  // 3. Sử dụng rowImpact của domain engine làm nguồn chân lý duy nhất
  const impact = rowImpact(change);

  let type: ImpactType = impact;

  if (changeType.includes("rework") || changeType.includes("làm lại") || rawText.toLowerCase().includes("làm lại")) {
    type = "rework";
  } else if (
    changeType.includes("bugfix") ||
    changeType.includes("sửa lỗi") ||
    rawText.toLowerCase().includes("sửa lỗi") ||
    rawText.toLowerCase().includes("fixed")
  ) {
    type = "bugfix";
  } else if (impact === "unknown") {
    const lower = rawText.toLowerCase();
    if (lower.includes("làm lại") || lower.includes("rework")) {
      type = "rework";
    } else if (lower.includes("sửa lỗi") || lower.includes("fixed") || lower.includes("bugfix")) {
      type = "bugfix";
    } else {
      type = "adjustment";
    }
  }

  const typeConfig: Record<ImpactType, { label: string; bg: string; border: string; text: string }> = {
    buff: {
      label: "Tăng sức mạnh",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400"
    },
    nerf: {
      label: "Giảm sức mạnh",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      text: "text-rose-400"
    },
    mixed: {
      label: "Điều chỉnh hỗn hợp",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400"
    },
    rework: {
      label: "Làm lại",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/30",
      text: "text-indigo-400"
    },
    bugfix: {
      label: "Sửa lỗi",
      bg: "bg-sky-500/10",
      border: "border-sky-500/30",
      text: "text-sky-400"
    },
    adjustment: {
      label: "Chưa xác định",
      bg: "bg-slate-500/10",
      border: "border-slate-500/30",
      text: "text-slate-400"
    },
    neutral: {
      label: "Không đổi",
      bg: "bg-slate-500/10",
      border: "border-slate-500/30",
      text: "text-slate-400"
    },
    unknown: {
      label: "Chưa xác định",
      bg: "bg-slate-500/10",
      border: "border-slate-500/30",
      text: "text-slate-400"
    }
  };

  const config = typeConfig[type] || typeConfig.unknown;

  return {
    beforeVal,
    afterVal,
    hasDistinctValues,
    impact,
    type,
    typeLabelVi: config.label,
    badgeClass: {
      bg: config.bg,
      border: config.border,
      text: config.text
    }
  };
}
