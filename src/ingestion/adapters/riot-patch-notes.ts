import crypto from "node:crypto";
import {
  ReleaseEvent,
  PatchNoteClaim,
  GameplayChange,
  SourceDocumentRevision,
  ChangeKind
} from "../../domain/releases/types";
import { resolveSet18Champion } from "../../domain/meta/set18-registry";
import { resolveItemInfo } from "../../domain/meta/item-registry";
import { SET18_CANONICAL_TRAITS, toCanonicalTraitId } from "../../domain/identity";

type ParsedEntityKind = "champion" | "item" | "trait" | "augment" | "system";

export class RiotPatchNotesAdapter {
  id = "riot_patch_notes";
  parserVersion = "1.1.0";

  /** Resolve the longest registered champion prefix (Master Yi, Kha'Zix, ...).
   * Taking the first whitespace-delimited token creates fake ids such as
   * `tft18_master`; this helper keeps the canonical registry identity. */
  private canonicalFieldPath(raw: string): string {
    const norm = raw.toLowerCase().trim();
    if (norm.includes("sát thương kỹ năng") || norm.includes("ability damage")) {
      if (norm.includes("giảm dần") || norm.includes("fall off") || norm.includes("mỗi ô")) {
        return "ability_damage_fall_off";
      }
      return "ability_damage";
    }
    if (norm.includes("sát thương trên đòn đánh") || norm.includes("sát thương phép trên đòn đánh") || norm.includes("on-hit")) {
      return "on_hit_damage";
    }
    if (norm.includes("sóng năng lượng") || norm.includes("wave")) {
      return "wave_damage";
    }
    if (norm.includes("smck cơ bản") || norm.includes("base ad") || norm.includes("sát thương cơ bản")) {
      return "base_ad";
    }
    if (norm.includes("tốc độ đánh") || norm.includes("attack speed") || norm.includes("as")) {
      return "base_as";
    }
    if (norm.includes("năng lượng") || norm.includes("mana")) {
      return "mana";
    }
    if (norm.includes("máu") || norm.includes("health")) {
      return "health";
    }
    if (norm.includes("giáp") || norm.includes("kháng phép") || norm.includes("chống chịu") || norm.includes("armor") || norm.includes("resists")) {
      return "resists";
    }
    return norm.replace(/\([^)]*\)/g, "").replace(/\s+/g, "_") || "stats";
  }

  /** Resolve the longest registered champion prefix (Master Yi, Kha'Zix, ...).
   * Taking the first whitespace-delimited token creates fake ids such as
   * `tft18_master`; this helper keeps the canonical registry identity. */
  private resolveEntity(leftPart: string): { name: string; id: string | null; fieldPath: string; kind: ParsedEntityKind; rawName: string | null } {
    const clean = leftPart.trim();

    // 1. Kiểm tra tiền tố Ấn trong tiếng Việt (Ấn Tiên Hắc Ám, Ấn Thần Rừng...)
    if (/^ấn\s+/i.test(clean)) {
      const traitCandidate = clean.replace(/^ấn\s+/i, "").replace(/[,:]+$/, "").trim();
      const traitKey = traitCandidate.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(SET18_CANONICAL_TRAITS, traitKey)) {
        const traitId = toCanonicalTraitId(traitCandidate).replace(/^tft18_da_18_/, "").replace(/^tft18_da_/, "");
        return {
          name: `Ấn ${traitCandidate}`,
          id: `tft18_emblem${traitId}`,
          fieldPath: "stats",
          kind: "item",
          rawName: `Ấn ${traitCandidate}`
        };
      }
    }

    // 2. Tách theo dấu gạch ngang (Tên Tướng/Tộc - Chỉ Số) chuẩn tiếng Việt
    const dashParts = clean.split(/\s*[-–—]\s*/);
    if (dashParts.length > 1) {
      const entityPart = dashParts[0].trim();
      const statPart = dashParts.slice(1).join(" - ").trim();
      const champ = resolveSet18Champion(entityPart);
      if (champ) {
        const cleanStat = statPart.replace(/^(?:Dạng\s+SMCK|Dạng\s+SMPT|AD\s+Form|AP\s+Form)\s*[:\-–—]?\s*/i, "").trim();
        return {
          name: champ.nameEn,
          id: champ.canonicalId,
          fieldPath: this.canonicalFieldPath(cleanStat || statPart),
          kind: "champion",
          rawName: champ.nameVi
        };
      }
      const traitKey = entityPart.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(SET18_CANONICAL_TRAITS, traitKey)) {
        return {
          name: entityPart,
          id: toCanonicalTraitId(entityPart),
          fieldPath: this.canonicalFieldPath(statPart),
          kind: "trait",
          rawName: entityPart
        };
      }
    }

    const words = clean.split(/\s+/).filter(Boolean);
    const emblemIndex = words.findIndex((word) => /^emblem$/i.test(word));
    if (emblemIndex >= 1) {
      const emblemName = words.slice(0, emblemIndex + 1).join(" ");
      const rest = words.slice(emblemIndex + 1).join(" ").trim();
      return {
        name: emblemName,
        id: `tft18_${emblemName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/g, "")}`,
        fieldPath: this.canonicalFieldPath(rest) || "stats",
        kind: "item",
        rawName: emblemName
      };
    }
    for (let count = Math.min(words.length, 6); count >= 1; count--) {
      const candidate = words.slice(0, count).join(" ").replace(/[,:]+$/, "");
      const entry = resolveSet18Champion(candidate);
      if (entry) {
        const rest = words.slice(count).join(" ").replace(/^(?:AD|AP)\s+Form\s*/i, "").replace(/^(?:Dạng\s+SMCK|Dạng\s+SMPT)\s*/i, "").trim();
        return { name: entry.nameEn, id: entry.canonicalId, fieldPath: this.canonicalFieldPath(rest) || "stats", kind: "champion", rawName: entry.nameVi };
      }

      // Riot names Radiant variants with a qualifier that is not part of the
      // canonical item registry key. Keep the qualifier in rawName so the UI
      // can choose a verified variant asset, while retaining a stable item id.
      const itemCandidate = candidate.replace(/^(?:Radiant|Artifact)\s+/i, "");
      const item = resolveItemInfo(candidate) || resolveItemInfo(itemCandidate);
      if (item) {
        const qualifier = /^(Radiant|Artifact)\s+/i.exec(candidate)?.[1] || "";
        const rest = words.slice(count).join(" ").trim();
        return {
          name: qualifier ? `${qualifier} ${item.nameEn}` : item.nameEn,
          id: `tft18_${item.key}${qualifier ? `_${qualifier.toLowerCase()}` : ""}`,
          fieldPath: this.canonicalFieldPath(rest) || "stats",
          kind: "item",
          rawName: qualifier ? `${qualifier} ${item.nameEn}` : item.nameEn
        };
      }

      const traitKey = candidate.toLowerCase().trim();
      if (Object.prototype.hasOwnProperty.call(SET18_CANONICAL_TRAITS, traitKey)) {
        const rest = words.slice(count).join(" ").trim();
        return {
          name: candidate,
          id: toCanonicalTraitId(candidate),
          fieldPath: this.canonicalFieldPath(rest) || "stats",
          kind: "trait",
          rawName: candidate
        };
      }
    }
    const first = words[0]?.replace(/[^a-z0-9'’-]/gi, "") || "unknown";
    const rawText = clean.toLowerCase();
    const kind: ParsedEntityKind = /\baugment\b|\blõi nâng cấp\b|\bnâng cấp\b/i.test(rawText) ? "augment" : "system";
    return { name: first, id: null, fieldPath: this.canonicalFieldPath(words.slice(1).join(" ")) || "stats", kind, rawName: clean || null };
  }

  /**
   * Trích xuất văn bản thuần không chứa thẻ HTML
   */
  stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  }

  /** Parse every list item independently so an arrow in one `<li>` can never
   * consume the following items.  This is also used for Riot's mid-patch
   * sections, which contain both numeric arrows and text-only bug fixes. */
  private parseSectionChanges(
    html: string,
    sections: Array<{ eventId: string; heading: RegExp }>,
    revisionId: string,
    rawArtifactId: string,
    rawHash: string,
    canonicalUrl: string
  ): { claims: PatchNoteClaim[]; changes: GameplayChange[] } {
    const claims: PatchNoteClaim[] = [];
    const changes: GameplayChange[] = [];
    const h3Regex = /<h3\b[^>]*>[\s\S]*?<\/h3>/gi;
    const headings = Array.from(html.matchAll(h3Regex)).map((m) => ({ index: m.index ?? 0, text: this.stripHtml(m[0]) }));
    for (const section of sections) {
      const match = section.heading.exec(html);
      if (!match || match.index === undefined) continue;
      const nextH3 = headings.find((h) => h.index > match.index!);
      const boundaryMatches = [
        nextH3?.index,
        html.indexOf('<header class="header-primary"', match.index + match[0].length),
        html.indexOf("</article>", match.index + match[0].length)
      ].filter((index): index is number => typeof index === "number" && index >= 0);
      const boundary = boundaryMatches.length ? Math.min(...boundaryMatches) : html.length;
      const body = html.slice(match.index, boundary);
      const itemRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let itemIndex = 0;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRegex.exec(body)) !== null) {
        itemIndex++;
        const rawItem = itemMatch[1];
        const text = this.stripHtml(rawItem);
        if (!text) continue;
        const arrowMatch = rawItem.match(/<span[^>]*class=["'][^"']*change-indicator[^"']*["'][^>]*>\s*(?:⇒|→)\s*<\/span>|⇒|→/i);
        const arrowIndex = arrowMatch?.index ?? -1;
        const beforeText = arrowIndex >= 0 ? this.stripHtml(rawItem.slice(0, arrowIndex)) : "";
        const afterText = arrowIndex >= 0 ? this.stripHtml(rawItem.slice(arrowIndex + arrowMatch![0].length)) : "";
        const fullText = arrowIndex >= 0 ? `${beforeText} ⇒ ${afterText}` : text;
        const beforeColon = beforeText.indexOf(":");
        const left = beforeColon > 0 ? beforeText.slice(0, beforeColon).trim() : text.split(/\s+/).slice(0, 2).join(" ");
        const resolved = this.resolveEntity(left);
        const rawEntityName = resolved.rawName || (left.split(/\s+/)[0]?.replace(/[^a-z0-9'’-]/gi, "") || null);
        const sectionBeforeItem = body.slice(0, itemMatch.index);
        const latestHeading = Array.from(sectionBeforeItem.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi)).pop()?.[1] || "";
        const sectionName = this.stripHtml(latestHeading).toLowerCase();
        const isBugText = text.toLowerCase().includes("bug") || sectionName.includes("bug") || /no longer\b|white boxes|fixed\b|sửa lỗi|lỗi hiển thị/i.test(text);
        const entityKind: PatchNoteClaim["kind"] = isBugText
          ? "bugfix"
          : resolved.kind === "champion" || resolved.kind === "item"
            ? "numeric"
            : "mechanic";
        const claimId = `claim_${section.eventId}_${itemIndex}`;
        const entityId = entityKind === "numeric" ? resolved.id || undefined : undefined;
        const fieldPath = beforeColon > 0 ? resolved.fieldPath : undefined;
        const value = (valueText: string): number | number[] | string => {
          const cleaned = valueText.replace(/\b(?:AD|AP|AS|MR|HP|Mana)\b/gi, "").replace(/%/g, "").trim();
          const parts = cleaned.split("/").map((part) => Number(part.trim())).filter((n) => Number.isFinite(n));
          if (parts.length > 1 && parts.length === cleaned.split("/").length) return parts;
          const number = Number(cleaned);
          return Number.isFinite(number) && cleaned !== "" ? number : valueText;
        };
        const beforeValue = beforeText ? value(beforeText.slice(beforeColon + 1).trim()) : null;
        const afterValue = afterText ? value(afterText.trim()) : null;
        const isNumeric = arrowIndex >= 0 && beforeText.length > 0 && afterText.length > 0 && beforeColon > 0;
        claims.push({
          id: claimId,
          releaseEventId: section.eventId,
          sourceDocumentRevisionId: revisionId,
          entityId: entityId || "unknown",
          variantId: /ad form/i.test(beforeText) ? "ad_form" : /ap form/i.test(beforeText) ? "ap_form" : "default",
          heading: left || "Patch update",
          rawText: fullText,
          kind: isNumeric ? "numeric" : entityKind === "bugfix" ? "bugfix" : "mechanic",
          fieldPath,
          beforeRaw: beforeText ? beforeText.slice(beforeColon + 1).trim() : undefined,
          afterRaw: afterText || undefined,
          context: { section: this.stripHtml(section.heading.source), entityKind: resolved.kind, rawEntityName: rawEntityName || "" }
        });
        changes.push({
          id: `change_${section.eventId}_${itemIndex}`,
          releaseEventId: section.eventId,
          fromSnapshotId: null,
          toSnapshotId: null,
          entityId: entityId || "unknown",
          variantId: /ad form/i.test(beforeText) ? "ad_form" : /ap form/i.test(beforeText) ? "ap_form" : "default",
          fieldPath: fieldPath || "description",
          context: { sourceText: fullText, entityKind: resolved.kind, rawEntityName: rawEntityName || "" },
          kind: isNumeric ? "numeric" : entityKind === "bugfix" ? "bugfix" : "mechanic",
          before: beforeValue === null
            ? { state: "missing", reason: "Riot notes do not state a previous value", evidenceIds: [claimId] }
            : { state: "known", value: beforeValue, evidenceIds: [claimId], basis: "documented", applicabilityKey: fieldPath || "description" },
          after: afterValue === null
            ? { state: "missing", reason: "Riot notes do not state a new value", evidenceIds: [claimId] }
            : { state: "known", value: afterValue, evidenceIds: [claimId], basis: "documented", applicabilityKey: fieldPath || "description" },
          evidenceIds: [claimId],
          validationStatus: "validated"
        });
      }
    }
    return { claims, changes };
  }

  /**
   * Tính semantic hash của phần nội dung bài viết (bỏ navigation, script, footer)
   */
  computeSemanticHash(html: string): string {
    // Tìm phần nội dung chính giữa <main> hoặc bài viết
    const contentMatch = html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<main[\s\S]*?<\/main>/i);
    const textToHash = contentMatch ? this.stripHtml(contentMatch[0]) : this.stripHtml(html);
    return crypto.createHash("sha256").update(textToHash).digest("hex");
  }

  /**
   * Phân tích cú pháp bài viết patch notes của Riot Games
   */
  parseArticle(
    html: string,
    canonicalUrl: string,
    meta: { rawArtifactId: string; rawHash: string; fetchedAt?: string }
  ): {
    revision: SourceDocumentRevision;
    events: ReleaseEvent[];
    claims: PatchNoteClaim[];
    changes: GameplayChange[];
  } {
    const fetchedAt = meta.fetchedAt || new Date().toISOString();
    const semanticContentHash = this.computeSemanticHash(html);

    // 1. Trích xuất metadata từ JSON-LD hoặc meta tags
    let title = "TFT Patch Notes";
    let publishedAt: string | null = null;
    let authors: string[] = [];
    let patchVersion = "";

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) title = this.stripHtml(titleMatch[1]);

    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        const techArticle = (jsonLd["@graph"] || []).find((x: any) => x["@type"] === "TechArticle");
        if (techArticle) {
          if (techArticle.headline) title = techArticle.headline;
          if (techArticle.datePublished) publishedAt = techArticle.datePublished;
          if (techArticle.version) patchVersion = techArticle.version;
          if (Array.isArray(techArticle.author)) {
            authors = techArticle.author.map((a: any) => a.name);
          }
        }
      } catch (_) {}
    }

    const inferredPatch = `${canonicalUrl} ${title}`.match(/(?:patch[-_\s]*)?(\d+\.\d+[a-z]?)/i)?.[1];
    if (!patchVersion) patchVersion = inferredPatch || "unknown";

    const revisionId = `sdr_riot_${patchVersion.replace(".", "_")}_${semanticContentHash.slice(0, 8)}`;
    const revision: SourceDocumentRevision = {
      id: revisionId,
      sourceId: "riot-official",
      canonicalUrl,
      fetchedAt,
      rawArtifactId: meta.rawArtifactId,
      rawHash: meta.rawHash,
      semanticContentHash,
      locale: canonicalUrl.includes("/vi-vn/") ? "vi_vn" : "en_us",
      title,
      publishedAt,
      authors
    };

    const events: ReleaseEvent[] = [];
    const claims: PatchNoteClaim[] = [];
    const changes: GameplayChange[] = [];

    const isPatch18_1 = patchVersion.toLowerCase() === "18.1" || canonicalUrl.includes("18-1") || title.includes("18.1");
    const isPatch18_2 = patchVersion.toLowerCase() === "18.2" || canonicalUrl.includes("18-2") || title.includes("18.2");

    if (isPatch18_1) {
      // 18.1 Main Launch
      const mainEventId = "event_live_18_1_launch";
      events.push({
        id: mainEventId,
        datasetKind: "real",
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        patchFamilyId: "18.1",
        parentEventId: null,
        kind: "launch",
        officialLabel: "18.1",
        displayLabel: "Bản Cập Nhật 18.1 · Khởi Đầu Mùa 18",
        aliasEvidenceIds: [],
        publisherBuildId: null,
        lifecycle: "applied",
        publishedAt,
        firstObservedAt: fetchedAt,
        effectiveAt: publishedAt,
        effectiveAtEarliest: publishedAt,
        effectiveAtLatest: publishedAt,
        effectivePrecision: publishedAt ? "day" : "unknown",
        timeBasis: publishedAt ? "publisher" : "unknown",
        effectiveTimeZone: "UTC",
        regionScope: ["Global"],
        platformScope: ["pc", "mobile"],
        evidenceIds: [meta.rawArtifactId]
      });

      // Mid-patch August 27th
      if (html.includes("AUGUST 27TH") || html.includes("27/08")) {
        events.push({
          id: "event_live_18_1_mid_aug27",
          datasetKind: "real",
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          patchFamilyId: "18.1",
          parentEventId: mainEventId,
          kind: "hotfix",
          officialLabel: null,
          displayLabel: "18.1 · cập nhật 27/08",
          aliasEvidenceIds: [],
          publisherBuildId: null,
          lifecycle: "applied",
          publishedAt: null,
          firstObservedAt: fetchedAt,
          effectiveAt: null,
          effectiveAtEarliest: null,
          effectiveAtLatest: null,
          effectivePrecision: "unknown",
          timeBasis: "unknown",
          effectiveTimeZone: "UTC",
          regionScope: ["Global"],
          platformScope: ["pc"],
          evidenceIds: [meta.rawArtifactId]
        });
      }

      // Mid-patch August 28th
      if (html.includes("AUGUST 28TH") || html.includes("28/08")) {
        events.push({
          id: "event_live_18_1_mid_aug28",
          datasetKind: "real",
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          patchFamilyId: "18.1",
          parentEventId: mainEventId,
          kind: "balance_update",
          officialLabel: null,
          displayLabel: "18.1 · cập nhật 28/08",
          aliasEvidenceIds: [],
          publisherBuildId: null,
          lifecycle: "applied",
          publishedAt: null,
          firstObservedAt: fetchedAt,
          effectiveAt: null,
          effectiveAtEarliest: null,
          effectiveAtLatest: null,
          effectivePrecision: "unknown",
          timeBasis: "unknown",
          effectiveTimeZone: "UTC",
          regionScope: ["Global"],
          platformScope: ["pc", "mobile"],
          evidenceIds: [meta.rawArtifactId]
        });
      }

      // Mid-patch August 31st / Sept 1st
      if (html.includes("AUGUST 31ST AND SEPTEMBER 1ST") || html.includes("31/08 VÀ 01/09") || html.includes("31/08")) {
        events.push({
          id: "event_live_18_1_mid_aug31",
          datasetKind: "real",
          gameProduct: "tft",
          setNumber: 18,
          channel: "live",
          patchFamilyId: "18.1",
          parentEventId: mainEventId,
          kind: "balance_update",
          officialLabel: null,
          displayLabel: "18.1 · cập nhật 31/08 - 01/09",
          aliasEvidenceIds: [],
          publisherBuildId: null,
          lifecycle: "applied",
          publishedAt: null,
          firstObservedAt: fetchedAt,
          effectiveAt: null,
          effectiveAtEarliest: null,
          effectiveAtLatest: null,
          effectivePrecision: "unknown",
          timeBasis: "unknown",
          effectiveTimeZone: "UTC",
          regionScope: ["Global"],
          platformScope: ["pc", "mobile"],
          evidenceIds: [meta.rawArtifactId]
        });
      }

      const mid = this.parseSectionChanges(
        html,
        [
          { eventId: "event_live_18_1_mid_aug31", heading: /(?:<h3[^>]*id=["']patch-august-31st-and-september-1st["'][^>]*>AUGUST 31ST AND SEPTEMBER 1ST<\/h3>|<h3\b[^>]*>(?:NGÀY\s+)?31\/08(?:\s+VÀ\s+01\/09)?<\/h3>)/i },
          { eventId: "event_live_18_1_mid_aug28", heading: /(?:<h3[^>]*>AUGUST 28TH<\/h3>|<h3\b[^>]*>(?:NGÀY\s+)?28\/08<\/h3>)/i },
          { eventId: "event_live_18_1_mid_aug27", heading: /(?:<h3[^>]*>AUGUST 27TH<\/h3>|<h3\b[^>]*>(?:NGÀY\s+)?27\/08<\/h3>)/i }
        ],
        revisionId,
        meta.rawArtifactId,
        meta.rawHash,
        canonicalUrl
      );
      claims.push(...mid.claims);
      changes.push(...mid.changes);
    } else if (isPatch18_2) {
      const mainEventId = "event_live_18_2_main";
      events.push({
        id: mainEventId,
        datasetKind: "real",
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        patchFamilyId: "18.2",
        parentEventId: null,
        kind: "main_patch",
        officialLabel: "18.2",
        displayLabel: "Bản Cập Nhật 18.2 · Khu Rừng Kỳ Bí",
        aliasEvidenceIds: [],
        publisherBuildId: null,
        lifecycle: "applied",
        publishedAt,
        firstObservedAt: fetchedAt,
        effectiveAt: publishedAt,
        effectiveAtEarliest: publishedAt,
        effectiveAtLatest: publishedAt,
        effectivePrecision: publishedAt ? "day" : "unknown",
        timeBasis: publishedAt ? "publisher" : "unknown",
        effectiveTimeZone: "UTC",
        regionScope: ["Global"],
        platformScope: ["pc", "mobile"],
        evidenceIds: [meta.rawArtifactId]
      });

      // Parse claims in 18.2
      // Special claim: Veigar Tooltip Bugfix
      if (
        html.includes("Veigar’s tooltip was bugged") ||
        html.includes("Veigar's tooltip was bugged") ||
        html.includes("Veigar - Sửa Lỗi") ||
        html.includes("SMPT mỗi mạng hạ gục của Veigar trong mô tả")
      ) {
        const claimId = `claim_18_2_veigar_tooltip`;
        const isVi = html.includes("Veigar - Sửa Lỗi");
        claims.push({
          id: claimId,
          releaseEventId: mainEventId,
          sourceDocumentRevisionId: revisionId,
          entityId: "tft18_veigar",
          heading: isVi ? "Veigar - Sửa Lỗi Mô Tả" : "Veigar Tooltip Fix",
          rawText: isVi
            ? "Veigar - Sửa Lỗi: SMPT mỗi mạng hạ gục của Veigar trong mô tả giờ đã khớp với lượng SMPT thực tế nhận được. SMPT Mỗi Mạng Hạ Gục (Hiển Thị): 1,5% > 3% (về cơ bản không thay đổi)"
            : "Veigar’s tooltip was bugged to not accurately reflect the actual AP gain he was getting—you could say it left him a little short. But much like real life, being short didn’t hinder our short-king, as he was still getting the proper amount of AP from his stacks behind the scenes.",
          kind: "tooltip_only",
          isTooltipOnly: true
        });

        changes.push({
          id: `change_18_2_veigar_tooltip`,
          releaseEventId: mainEventId,
          fromSnapshotId: null,
          toSnapshotId: null,
          entityId: "tft18_veigar",
          variantId: "default",
          fieldPath: "tooltip.ap_gain",
          context: { note: isVi ? "Chỉ sửa mô tả, hiệu quả thực tế không đổi" : "Tooltip only, actual gameplay efficiency unchanged" },
          kind: "tooltip_only",
          before: { state: "known", value: isVi ? "Chữ hiển thị chưa đúng" : "Incorrect text", evidenceIds: [claimId], basis: "documented", applicabilityKey: "tooltip" },
          after: { state: "known", value: isVi ? "Chữ hiển thị đã đúng" : "Correct text", evidenceIds: [claimId], basis: "documented", applicabilityKey: "tooltip" },
          evidenceIds: [claimId],
          validationStatus: "validated"
        });
      }

      // Parse all <li>...⇒...</li> list items
      const changeRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let match;
      let claimIdx = 0;

      while ((match = changeRegex.exec(html)) !== null) {
        claimIdx++;
        const rawItem = match[1];
        const arrowMatch = rawItem.match(/<span[^>]*class=["'][^"']*change-indicator[^"']*["'][^>]*>\s*(?:⇒|→)\s*<\/span>|⇒|→/i);
        if (!arrowMatch || arrowMatch.index === undefined) continue;
        const beforeText = this.stripHtml(rawItem.slice(0, arrowMatch.index));
        const afterText = this.stripHtml(rawItem.slice(arrowMatch.index + arrowMatch[0].length));
        const fullText = `${beforeText} ⇒ ${afterText}`;

        // Parse Entity & Field
        // E.g.: "Ahri Ability Damage: 425/640 AP ⇒ 455/685 AP"
        // E.g.: "Ahri Ability damage fall off Per Hex: 20% ⇒ 21%"
        // E.g.: "Akali AD Form Mana: 0/30 ⇒ 0/25"
        // E.g.: "Leona Mana: 40/100 ⇒ 30/90"
        let entityName = "unknown";
        let rawEntityName: string | null = null;
        let fieldPath = "stats";
        let variantId = "default";
        const kind: ChangeKind = "numeric";
        let parsedEntityKind: ParsedEntityKind = "system";

        const colonIdx = beforeText.indexOf(":");
        if (colonIdx > 0) {
          const leftPart = beforeText.substring(0, colonIdx).trim();
          const resolved = this.resolveEntity(leftPart);
          entityName = resolved.name;
          rawEntityName = resolved.rawName;
          parsedEntityKind = resolved.kind;

          if (leftPart.toLowerCase().includes("ad form") || leftPart.toLowerCase().includes("dạng smck")) {
            variantId = "ad_form";
          } else if (leftPart.toLowerCase().includes("ap form") || leftPart.toLowerCase().includes("dạng smpt")) {
            variantId = "ap_form";
          }

          fieldPath = resolved.fieldPath;
          let beforeValueText = beforeText.substring(colonIdx + 1).trim();
          const nestedField = beforeValueText.match(/^([^:]+):\s*(.*)$/);
          if (nestedField) {
            const nestedLabel = nestedField[1].trim();
            fieldPath = `${fieldPath !== "stats" ? `${fieldPath}_` : ""}${nestedLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "value"}`;
            beforeValueText = nestedField[2].trim();
          }

          const resolvedId = (entityName.toLowerCase() === "akali" && variantId === "ad_form")
            ? "tft18_akali_ad"
            : resolved.id;
          const canonicalEntityId = resolvedId || `tft18_${entityName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
          const claimId = `claim_18_2_${claimIdx}_${canonicalEntityId.replace(/^tft18_/, "")}`;

          claims.push({
            id: claimId,
            releaseEventId: mainEventId,
            sourceDocumentRevisionId: revisionId,
            entityId: canonicalEntityId,
            variantId,
            heading: beforeText.split(":")[0] || "Gameplay Balance",
            rawText: fullText,
            kind,
            fieldPath,
            beforeRaw: beforeValueText,
            afterRaw: afterText
          });

          changes.push({
            id: `change_18_2_${claimIdx}_${canonicalEntityId.replace(/^tft18_/, "")}`,
            releaseEventId: mainEventId,
            fromSnapshotId: null,
            toSnapshotId: null,
            entityId: canonicalEntityId,
            variantId,
            fieldPath,
            context: { sourceText: fullText, entityKind: parsedEntityKind, rawEntityName: rawEntityName || "" },
            kind,
            before: {
              state: "known",
              value: beforeValueText,
              evidenceIds: [claimId],
              basis: "documented",
              applicabilityKey: fieldPath
            },
            after: {
              state: "known",
              value: afterText,
              evidenceIds: [claimId],
              basis: "documented",
              applicabilityKey: fieldPath
            },
            evidenceIds: [claimId],
            validationStatus: "validated"
          });
          continue;
        }

        const canonicalEntityId = `tft18_${entityName}`;
        const claimId = `claim_18_2_${claimIdx}_${entityName}`;

        claims.push({
          id: claimId,
          releaseEventId: mainEventId,
          sourceDocumentRevisionId: revisionId,
          entityId: canonicalEntityId,
          variantId,
          heading: beforeText.split(":")[0] || "Gameplay Balance",
          rawText: fullText,
          kind,
          fieldPath,
          beforeRaw: beforeText.substring(colonIdx + 1).trim(),
          afterRaw: afterText
        });

        changes.push({
          id: `change_18_2_${claimIdx}_${entityName}`,
          releaseEventId: mainEventId,
          fromSnapshotId: null,
          toSnapshotId: null,
          entityId: canonicalEntityId,
          variantId,
          fieldPath,
          context: { sourceText: fullText },
          kind,
          before: {
            state: "known",
            value: beforeText.substring(colonIdx + 1).trim(),
            evidenceIds: [claimId],
            basis: "documented",
            applicabilityKey: fieldPath
          },
          after: {
            state: "known",
            value: afterText,
            evidenceIds: [claimId],
            basis: "documented",
            applicabilityKey: fieldPath
          },
          evidenceIds: [claimId],
          validationStatus: "validated"
        });
      }
    } else if (patchVersion !== "unknown") {
      // Generic minor/hotfix article (18.1a, 18.1b, 18.3, ...).  Keep the
      // exact label from the article and only emit claims that contain an
      // explicit before/after arrow.
      const safePatch = patchVersion.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const mainEventId = `event_live_${safePatch}`;
      const isHotfix = /[a-z]$/i.test(patchVersion);
      events.push({
        id: mainEventId,
        datasetKind: "real",
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        patchFamilyId: patchVersion,
        parentEventId: null,
        kind: isHotfix ? "hotfix" : "main_patch",
        officialLabel: patchVersion,
        displayLabel: `Bản Cập Nhật ${patchVersion}`,
        aliasEvidenceIds: [],
        publisherBuildId: null,
        lifecycle: "applied",
        publishedAt,
        firstObservedAt: fetchedAt,
        effectiveAt: publishedAt,
        effectiveAtEarliest: publishedAt,
        effectiveAtLatest: publishedAt,
        effectivePrecision: publishedAt ? "day" : "unknown",
        timeBasis: publishedAt ? "publisher" : "unknown",
        effectiveTimeZone: "UTC",
        regionScope: ["Global"],
        platformScope: ["pc", "mobile"],
        evidenceIds: [meta.rawArtifactId]
      });
      const genericRegex = /<li[^>]*>(.*?)(?:<span[^>]*>⇒<\/span>|⇒)(.*?)<\/li>/gi;
      let genericIndex = 0;
      let genericMatch: RegExpExecArray | null;
      while ((genericMatch = genericRegex.exec(html)) !== null) {
        genericIndex++;
        const beforeText = this.stripHtml(genericMatch[1]);
        const afterText = this.stripHtml(genericMatch[2]);
        const colonIndex = beforeText.indexOf(":");
        if (colonIndex <= 0) continue;
        const leftPart = beforeText.slice(0, colonIndex).trim();
        const resolved = this.resolveEntity(leftPart);
        const entityName = resolved.name;
        const rawEntityName = resolved.rawName;
        const entityId = resolved.id || `tft18_${entityName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
        let fieldPath = resolved.fieldPath;
        let beforeValueText = beforeText.slice(colonIndex + 1).trim();
        const nestedField = beforeValueText.match(/^([^:]+):\s*(.*)$/);
        if (nestedField) {
          const nestedLabel = nestedField[1].trim();
          fieldPath = `${fieldPath !== "stats" ? `${fieldPath}_` : ""}${nestedLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "value"}`;
          beforeValueText = nestedField[2].trim();
        }
        const claimId = `claim_${safePatch}_${genericIndex}_${entityId.replace(/^tft18_/, "")}`;
        claims.push({
          id: claimId,
          releaseEventId: mainEventId,
          sourceDocumentRevisionId: revisionId,
          entityId,
          variantId: /ad form/i.test(beforeText) ? "ad_form" : /ap form/i.test(beforeText) ? "ap_form" : "default",
          heading: beforeText.split(":")[0] || "Gameplay Balance",
          rawText: `${beforeText} ⇒ ${afterText}`,
          kind: "numeric",
          fieldPath,
          beforeRaw: beforeValueText,
          afterRaw: afterText
        });
        changes.push({
          id: `change_${safePatch}_${genericIndex}_${entityId.replace(/^tft18_/, "")}`,
          releaseEventId: mainEventId,
          fromSnapshotId: null,
          toSnapshotId: null,
          entityId,
          variantId: /ad form/i.test(beforeText) ? "ad_form" : /ap form/i.test(beforeText) ? "ap_form" : "default",
          fieldPath,
          context: { sourceText: `${beforeText} ⇒ ${afterText}`, entityKind: resolved.kind, rawEntityName: rawEntityName || "" },
          kind: "numeric",
          before: { state: "known", value: beforeValueText, evidenceIds: [claimId], basis: "documented", applicabilityKey: fieldPath },
          after: { state: "known", value: afterText, evidenceIds: [claimId], basis: "documented", applicabilityKey: fieldPath },
          evidenceIds: [claimId],
          validationStatus: "validated"
        });
      }
    }

    return {
      revision,
      events,
      claims,
      changes
    };
  }
}

export const riotPatchNotesAdapter = new RiotPatchNotesAdapter();
