"use client";

import React from "react";
import type { NumericParameter, StarLevel } from "@/domain/types";

export interface FormattedDescriptionProps {
  text: string;
  className?: string;
  championId?: string;
  cost?: number;
  parameters?: NumericParameter[];
  starLevel?: StarLevel;
}

/**
 * Xóa sạch hoàn toàn các thẻ markup <bright>, <rule>, <rules>, <dim>, <Keyword>, v.v. của Riot
 */
export function cleanRiotTags(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    // 1. Chuyển đổi các thẻ ngắt dòng / hàng thành dấu xuống dòng
    .replace(/<row>/gi, "\n")
    .replace(/<\/row>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // 2. Chuyển đổi icon scale của Riot sang nhãn tiếng Việt dễ đọc
    .replace(/%i:scaleAD%/gi, " (SMCK) ")
    .replace(/%i:scaleAP%/gi, " (SMPT) ")
    .replace(/%i:scaleArmor%/gi, " (Giáp) ")
    .replace(/%i:scaleMR%/gi, " (Kháng Phép) ")
    .replace(/%i:[^%]+%/gi, "")
    // 3. Xóa sạch hoàn toàn các thẻ XML/HTML mở và đóng (ví dụ: <bright>, </bright>, <rules>, <dim>, <Keyword>, <ShowIf...>, v.v.)
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    // 4. Khử các thực thể HTML và ngoặc trống
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<>/g, "")
    .trim();
}

export interface ResolveExactValueOptions {
  parameters?: NumericParameter[];
  starLevel?: StarLevel;
  championId?: string;
  cost?: number;
}

/**
 * Tra cứu số liệu thực tế chuẩn xác cho các biến công thức
 * Tuyệt đối không tự suy diễn số khi không có chứng cứ.
 */
export function resolveExactValue(
  token: string,
  options?: ResolveExactValueOptions | string,
  legacyCost?: number
): string {
  const opts: ResolveExactValueOptions =
    typeof options === "string"
      ? { championId: options, cost: legacyCost }
      : options || {};

  const tokenLower = token.toLowerCase();

  // 1. Tra cứu từ parameters thực tế của snapshot / kỹ năng
  if (opts.parameters && opts.parameters.length > 0) {
    const matchedParam = opts.parameters.find(
      (p) =>
        p.key.toLowerCase() === tokenLower ||
        p.contextKey?.toLowerCase() === tokenLower ||
        p.labelEn?.toLowerCase() === tokenLower ||
        p.key.toLowerCase().replace(/[^a-z0-9]/g, "") === tokenLower.replace(/[^a-z0-9]/g, "")
    );

    if (matchedParam) {
      const isPercent = matchedParam.unit === "percent";
      const isSeconds = matchedParam.unit === "seconds";

      // Nếu chỉ định cấp sao cụ thể
      if (opts.starLevel && matchedParam.byStar) {
        const starDatum = matchedParam.byStar[opts.starLevel];
        if (starDatum && starDatum.state === "known") {
          const val = starDatum.value;
          return `${val}${isPercent ? "%" : isSeconds ? "s" : ""}`;
        }
      }

      // Nếu có formulaText dạng "100 / 200 / 300"
      if (matchedParam.formulaText && matchedParam.formulaText.state === "known") {
        return matchedParam.formulaText.value;
      }

      // Ghép giá trị các sao có dữ liệu (1★ / 2★ / 3★)
      if (matchedParam.byStar) {
        const knownValues: number[] = [];
        for (const s of [1, 2, 3] as const) {
          const d = matchedParam.byStar[s];
          if (d && d.state === "known" && typeof d.value === "number") {
            knownValues.push(d.value);
          }
        }

        if (knownValues.length > 0) {
          if (isPercent) {
            return knownValues.map((v) => `${v}%`).join(" / ");
          }
          if (isSeconds) {
            return knownValues.map((v) => `${v}s`).join(" / ");
          }
          return knownValues.join(" / ");
        }
      }
    }
  }

  // 2. Không có parameters chứng thực -> trung thực trả về 'Chưa có dữ liệu'
  return "Chưa có dữ liệu";
}

/**
 * Phân tích và render một đoạn văn bản chiêu thức sạch sẽ và trực quan
 */
function renderInlineFormatted(
  raw: string,
  lineKey: string | number,
  options?: ResolveExactValueOptions
): React.ReactNode {
  // 1. Dọn sạch toàn bộ các thẻ <bright>, <dim>, <rules>, v.v.
  const cleaned = cleanRiotTags(raw);

  // 2. Tách chuỗi theo các biến chỉ số @Token@
  const regex = /(@[a-zA-Z0-9_*]+@)/g;
  const parts = cleaned.split(regex);

  const elements: React.ReactNode[] = [];

  for (let index = 0; index < parts.length; index++) {
    const partKey = `${lineKey}_${index}`;
    const part = parts[index];
    if (!part) continue;

    // Biến chỉ số @Variable@ -> Thay thế bằng con số thực tế
    if (part.startsWith("@") && part.endsWith("@")) {
      const tokenName = part.slice(1, -1);
      const exactValue = resolveExactValue(tokenName, options);

      // Xử lý khử lỗi lặp dấu % ("30%%"):
      // Nếu exactValue kết thúc bằng "%", và part kế tiếp bắt đầu bằng "%",
      // thì cắt bỏ dấu "%" ở đầu của part kế tiếp
      if (exactValue.endsWith("%") && index + 1 < parts.length) {
        if (parts[index + 1]?.startsWith("%")) {
          parts[index + 1] = parts[index + 1].replace(/^%+/, "");
        }
      }

      const isMissing = exactValue === "Chưa có dữ liệu";

      elements.push(
        <strong
          key={partKey}
          title={`Chỉ số gốc: @${tokenName}@`}
          className={`font-bold font-mono mx-0.5 ${
            isMissing ? "text-amber-500/70 italic text-[11px]" : "text-amber-300"
          }`}
        >
          {exactValue}
        </strong>
      );
      continue;
    }

    // Làm nổi bật các từ khóa mở đầu như "Nội Tại:", "Kích Hoạt:", "Thích Ứng:", v.v.
    const headerRegex = /^(Nội Tại:|Kích Hoạt:|Bùa Tím:|Bùa Xám:|Bùa Xanh Mòng Két:|Bùa Đỏ:|Bùa Xanh Lá:|Bùa Đá Phiến:|Bùa Xanh:|Bùa Cam:|Thích Ứng:|Nhiệm Vụ:|Nắm & Quăng:|Thưởng Gai Đen:|Thưởng Hoa Linh:|Thưởng Tiên Hắc Ám:|Thưởng Thần Rừng:|Thưởng Tiên Linh:|Thưởng Hỏa Ngục:|Thưởng Mặt Trăng:|Thưởng Nguyên Sinh:|Thưởng Mặt Trời:)/i;
    const match = part.match(headerRegex);
    if (match) {
      const prefix = match[0];
      const rest = part.slice(prefix.length);
      elements.push(
        <React.Fragment key={partKey}>
          <strong className="font-bold text-emerald-400 mr-1">{prefix}</strong>
          {rest}
        </React.Fragment>
      );
      continue;
    }

    // Văn bản thông thường
    elements.push(<React.Fragment key={partKey}>{part}</React.Fragment>);
  }

  return elements;
}

export function FormattedDescription({
  text,
  className = "",
  championId,
  cost,
  parameters,
  starLevel
}: FormattedDescriptionProps) {
  if (!text) {
    return <span className="text-slate-500 italic">Không có mô tả</span>;
  }

  // Chuẩn hóa ký tự xuống dòng
  const normalized = text.replace(/\\r\\n|\\n/g, "\n").replace(/\r\n/g, "\n");
  const paragraphs = normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return <span className="text-slate-500 italic">Không có mô tả</span>;
  }

  const options: ResolveExactValueOptions = {
    championId,
    cost,
    parameters,
    starLevel
  };

  return (
    <div className={`space-y-2 text-xs leading-relaxed ${className}`}>
      {paragraphs.map((p, idx) => (
        <div key={idx} className="break-words">
          {renderInlineFormatted(p, idx, options)}
        </div>
      ))}
    </div>
  );
}
