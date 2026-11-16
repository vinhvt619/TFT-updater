import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb } from "../../src/server/db/client";
import { rawArtifacts, evidenceRefs } from "../../src/server/db/schema";
import {
  metaSourceSnapshots,
  metaSourceCompObservations,
  metaSourceCompBuilds,
  metaSourceMappings
} from "../../src/server/db/schema-meta";
import { SourceCompObservation, SourceCompBuild } from "../../src/domain/meta/schemas";
import { fetchWithReceipt } from "../../src/ingestion/fetch-receipt";
import { classifyUnitRole, isItemKnown, resolveItemInfo } from "../../src/domain/meta/item-registry";
import { isValidBoardEntity, isShopChampion, isSpawnedEntity, validateBoardUnits } from "../../src/domain/meta/board-validator";
import { toCanonicalChampionId } from "../../src/domain/identity";
import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";
import { matchArchetype } from "../../src/domain/meta/archetype-matching";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { getCurrentLivePatchEpochId, getPatchEpoch } from "../../src/domain/meta/patch-epochs";

interface ExtractedUnit {
  key: string;
  name?: string;
  position?: { row: number; col: number } | null;
  items: string[];
  starLevel: number | null;
}

export interface ExtractedBuild {
  tabSlug: string;
  label: string;
  level: number | null;
  boardLevelMin?: number | null;
  boardLevelMax?: number | null;
  boardCompleteness?: "exact" | "partial" | "conditional";
  boardKind: "primary" | "alternate" | "early" | "flex";
  units: ExtractedUnit[];
  sourceLocator: string;
}

interface ExtractedComp {
  slug: string;
  title: string;
  publishedAt: string | null;
  units: ExtractedUnit[];
  builds: ExtractedBuild[];
  sourceLeadChampionId: string | null;
  leadProvenance?: {
    method: "overview_text_list" | "title_match" | "none";
    confidence: "high" | "medium" | "low";
    locator: string;
    rawText: string;
  };
  inferred: {
    carryChampionId: string | null;
    tankChampionId: string | null;
    algorithmVersion: string;
  };
  quarantinedTokens: string[];
}

function canonicalItem(rawKey: string): string {
  return isItemKnown(rawKey) ? resolveItemInfo(rawKey)?.key || "" : "";
}

function canonicalChamp(rawKey: string): string {
  if (!rawKey) return "";
  return toCanonicalChampionId(rawKey);
}

interface SourceLeadResult {
  sourceLeadChampionId: string | null;
  provenance: {
    method: "overview_text_list" | "title_match" | "none";
    confidence: "high" | "medium" | "low";
    locator: string;
    rawText: string;
  };
}

function determineSourceLead(
  slug: string,
  title: string,
  units: ExtractedUnit[],
  overviewLeadName?: string | null
): SourceLeadResult {
  const normSlug = slug.toLowerCase();

  // 1. Direct match from Overview Page explicit lead text (highest priority and confidence)
  if (overviewLeadName) {
    const decodedLead = overviewLeadName
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"');
    const cleanLead = decodedLead.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (cleanLead.length >= 2) {
      const matched = units.find((u) => {
        const uKey = u.key.toLowerCase().replace(/^da_/, "").replace(/^18_/, "").replace(/_ad|_ap|18/g, "");
        const uName = (u.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return (
          (uKey.length >= 2 && cleanLead.includes(uKey)) ||
          (uKey.length >= 2 && uKey.includes(cleanLead)) ||
          (uName.length >= 2 && cleanLead.includes(uName)) ||
          (uName.length >= 2 && uName.includes(cleanLead))
        );
      });
      if (matched) {
        return {
          sourceLeadChampionId: matched.key,
          provenance: {
            method: "overview_text_list",
            confidence: "high",
            locator: `tftflex.com/en/meta (comps-text-list: "${decodedLead}")`,
            rawText: decodedLead
          }
        };
      }
    }
  }

  // 2. Match from slug / title
  for (const u of units) {
    const raw = u.key.toLowerCase().replace(/^da_/, "").replace(/^18_/, "").replace(/_ad|_ap|18/g, "");
    if (raw.length >= 3 && (normSlug.includes(raw) || title.toLowerCase().includes(raw))) {
      return {
        sourceLeadChampionId: u.key,
        provenance: {
          method: "title_match",
          confidence: "medium",
          locator: `tftflex.com/vi/meta/set-18/${slug} (title: "${title}")`,
          rawText: raw
        }
      };
    }
  }

  // No source-declared lead is safer than assigning the first board unit.
  return {
    sourceLeadChampionId: null,
    provenance: {
      method: "none",
      confidence: "low",
      locator: `tftflex.com/vi/meta/set-18/${slug}`,
      rawText: "source did not identify a lead champion"
    }
  };
}

export function extractDetailComp(
  html: string,
  slug: string,
  overviewLeadName?: string | null,
  fallbackTimestamp?: string
): ExtractedComp {
  const pubMatch = html.match(/publishedAt:"([^"]+)"/);
  const publishedAt = pubMatch ? pubMatch[1] : (fallbackTimestamp || null);
  const titleMatch = html.match(/title:"([^"]+)"/);
  const title = titleMatch ? titleMatch[1] : slug;

  // 1. Parse all post.game-team blocks into distinct raw builds
  const re = /__component:"post\.game-team"/g;
  let m: RegExpExecArray | null;
  const teamIndices: number[] = [];
  while ((m = re.exec(html)) !== null) teamIndices.push(m.index);

  const rawBuilds: {
    tabSlug: string;
    label: string;
    level: number | null;
    boardLevelMin?: number | null;
    boardLevelMax?: number | null;
    boardCompleteness?: "exact" | "partial" | "conditional";
    units: ExtractedUnit[];
  }[] = [];
  const quarantinedTokens: string[] = [];

  for (let i = 0; i < teamIndices.length; i++) {
    const start = teamIndices[i];
    const end = teamIndices[i + 1] || start + 15000;
    const chunk = html.slice(start, end);
    const tabMatch = chunk.match(/tab_slug:"([^"]+)"/);
    const labelMatch = chunk.match(/label:"([^"]+)"/);
    const rawLabel = labelMatch ? labelMatch[1] : (tabMatch ? tabMatch[1] : `Build ${i + 1}`);

    let boardLevelMin: number | null = null;
    let boardLevelMax: number | null = null;
    let boardCompleteness: "exact" | "partial" | "conditional" = "exact";

    const rangeMatch = rawLabel.match(/(?:Lv|Level)\s*(\d+)\s*\/\s*(?:Lv|Level)?\s*(\d+)/i);
    if (rangeMatch) {
      boardLevelMin = parseInt(rangeMatch[1], 10);
      boardLevelMax = parseInt(rangeMatch[2], 10);
      boardCompleteness = "conditional";
    } else {
      const singleMatch = rawLabel.match(/(?:Lv|Level)\s*(\d+)/i);
      if (singleMatch) {
        const lvl = parseInt(singleMatch[1], 10);
        boardLevelMin = lvl;
        boardLevelMax = lvl;
      }
    }
    const parsedBoardLevel = boardLevelMin;

    // Bounded entity array extraction between opening [ of entities:$R[...]=[ and its matching ]
    const entStart = chunk.indexOf("entities:$R");
    let entitiesChunk = chunk;
    if (entStart !== -1) {
      const eqBracket = chunk.indexOf("=[", entStart);
      if (eqBracket !== -1) {
        const openBracket = eqBracket + 1;
        let depth = 0;
        let closeBracket = -1;
        for (let k = openBracket; k < chunk.length; k++) {
          if (chunk[k] === "[") depth++;
          else if (chunk[k] === "]") {
            depth--;
            if (depth === 0) {
              closeBracket = k;
              break;
            }
          }
        }
        if (closeBracket !== -1) {
          entitiesChunk = chunk.slice(openBracket, closeBracket + 1);
        }
      }
    }

    // Find all champions in this bounded entity array
    const champRegex = /type:"champion",entity_key:"([^"]+)",position:(\d+),level:(\d+)(.*?)(?=type:"champion"|\}\]\s*,\s*(?:traits|style|lock|__component)|$)/gs;
    let cm: RegExpExecArray | null;
    const teamUnits: ExtractedUnit[] = [];
    const seenPositions = new Set<number>();

    while ((cm = champRegex.exec(entitiesChunk)) !== null) {
      const key = cm[1];
      const pos = parseInt(cm[2], 10);
      const lvl = parseInt(cm[3], 10);
      const rest = cm[4];

      const items: string[] = [];
      const itemRegex = /type:"item",code:"([^"]+)"/g;
      let im: RegExpExecArray | null;
      while ((im = itemRegex.exec(rest)) !== null) {
        if (!im[1]) continue;
        if (isItemKnown(im[1])) items.push(im[1]);
        else quarantinedTokens.push(`item:${im[1]}`);
      }

      if (pos >= 0 && pos < 28) {
        if (isValidBoardEntity(key)) {
          if (!seenPositions.has(pos)) {
            seenPositions.add(pos);
            teamUnits.push({
              key,
              position: { row: Math.floor(pos / 7), col: pos % 7 },
              starLevel: lvl > 0 ? lvl : null,
              items
            });
          }
        } else {
          quarantinedTokens.push(key);
        }
      }
    }

    if (parsedBoardLevel !== null && !rangeMatch) {
      if (teamUnits.length === parsedBoardLevel) {
        boardCompleteness = "exact";
      } else if (teamUnits.length < parsedBoardLevel) {
        boardCompleteness = "partial";
      } else {
        boardCompleteness = "conditional";
      }
    }

    if (teamUnits.length >= 4) {
      rawBuilds.push({
        tabSlug: tabMatch?.[1] || `team_${i + 1}`,
        label: rawLabel,
        level: parsedBoardLevel,
        boardLevelMin,
        boardLevelMax,
        boardCompleteness,
        units: teamUnits
      });
    }
  }

  // 2. Parse summary.champions
  const summaryMatch = html.match(/summary:\$R\[\d+\]=\{champions:\$R\[\d+\]=\[/);
  const rawSummaryUnits: ExtractedUnit[] = [];

  if (summaryMatch && summaryMatch.index !== undefined) {
    const summaryIdx = summaryMatch.index;
    const chunk = html.slice(summaryIdx, summaryIdx + 12000);
    const endChunk = chunk.indexOf("bench:$R");
    const compChunk = endChunk !== -1 ? chunk.slice(0, endChunk) : chunk;

    const champRegex = /key:"([^"]+)",name:"([^"]+)",stars:([^,]+),items:\$R\[\d+\]=\[(.*?)\],emblems:/gs;
    let match: RegExpExecArray | null;
    while ((match = champRegex.exec(compChunk)) !== null) {
      const key = match[1];
      const name = match[2];
      const starsRaw = match[3];
      const itemsBlock = match[4];
      const itemKeys: string[] = [];
      const itemRegex = /key:"([^"]+)"/g;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRegex.exec(itemsBlock)) !== null) {
        if (isItemKnown(itemMatch[1])) itemKeys.push(itemMatch[1]);
        else quarantinedTokens.push(`item:${itemMatch[1]}`);
      }

      let starLevel: number | null = null;
      if (/^\d+$/.test(starsRaw.trim())) {
        starLevel = parseInt(starsRaw.trim(), 10);
      }

      if (isShopChampion(key)) {
        rawSummaryUnits.push({ key, name, items: itemKeys, position: null, starLevel });
      } else if (isSpawnedEntity(key)) {
        // Recognized spawned entity (e.g. Training Dummy) - excluded from shop count
      } else {
        quarantinedTokens.push(key);
      }
    }
  }

  // 3. Match primary build index without merging positions into summary
  let primaryBuildIdx = -1;
  if (rawSummaryUnits.length > 0) {
    const summaryKeySet = new Set(rawSummaryUnits.map((u) => u.key.toLowerCase()));
    for (let i = 0; i < rawBuilds.length; i++) {
      const bKeys = rawBuilds[i].units.map((u) => u.key.toLowerCase());
      if (bKeys.length === rawSummaryUnits.length && bKeys.every((k) => summaryKeySet.has(k))) {
        primaryBuildIdx = i;
        break;
      }
    }
  }

  if (primaryBuildIdx === -1 && rawBuilds.length > 0) {
    let maxOverlap = -1;
    for (let i = 0; i < rawBuilds.length; i++) {
      const bKeySet = new Set(rawBuilds[i].units.map((u) => u.key.toLowerCase()));
      const overlap = rawSummaryUnits.filter((u) => bKeySet.has(u.key.toLowerCase())).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        primaryBuildIdx = i;
      }
    }
  }

  if (primaryBuildIdx === -1 && rawBuilds.length > 0) {
    primaryBuildIdx = 0;
  }

  // Summary units: authentic editorial units from summary, NO cross-variant position merging
  let finalSummaryUnits = rawSummaryUnits;
  if (finalSummaryUnits.length === 0 && primaryBuildIdx !== -1) {
    finalSummaryUnits = rawBuilds[primaryBuildIdx].units.map((u) => ({ ...u, position: null }));
  }

  // 4. Construct distinct builds for each post.game-team
  const builds: ExtractedBuild[] = rawBuilds.map((rb, idx) => {
    const isPrimary = idx === primaryBuildIdx;
    const boardKind: "primary" | "alternate" = isPrimary ? "primary" : "alternate";
    return {
      tabSlug: rb.tabSlug,
      label: rb.label,
      level: rb.level,
      boardLevelMin: rb.boardLevelMin,
      boardLevelMax: rb.boardLevelMax,
      boardCompleteness: rb.boardCompleteness,
      boardKind,
      units: rb.units,
      sourceLocator: `tftflex.com/vi/meta/set-18/${slug} (${rb.label || "board"})`
    };
  });

  if (!builds.some((b) => b.boardKind === "primary") && builds.length > 0) {
    builds[0].boardKind = "primary";
  }

  // Determine Source Lead
  const leadRes = determineSourceLead(slug, title, finalSummaryUnits, overviewLeadName);

  // Inferred roles via classifyUnitRole
  let inferredCarryKey: string | null = null;
  let maxCarryScore = 0;
  let inferredTankKey: string | null = null;
  let maxTankScore = 0;

  for (const u of finalSummaryUnits) {
    const role = classifyUnitRole(u.items);
    if (role.carryScore > maxCarryScore && role.carryScore >= 1) {
      maxCarryScore = role.carryScore;
      inferredCarryKey = u.key;
    }
    if (role.tankScore > maxTankScore && role.tankScore >= 1) {
      maxTankScore = role.tankScore;
      inferredTankKey = u.key;
    }
  }

  return {
    slug,
    title,
    publishedAt,
    units: finalSummaryUnits,
    builds,
    sourceLeadChampionId: leadRes.sourceLeadChampionId,
    leadProvenance: leadRes.provenance,
    inferred: {
      carryChampionId: inferredCarryKey ? canonicalChamp(inferredCarryKey) : null,
      tankChampionId: inferredTankKey ? canonicalChamp(inferredTankKey) : null,
      algorithmVersion: "item-role-v1"
    },
    quarantinedTokens
  };
}

export async function ingestTFTFlex(options: { allowOfflineCache?: boolean; patchEpochId?: string } = {}) {
  const patchEpochId = options.patchEpochId || getCurrentLivePatchEpochId();
  const sourcePatchLabel = getPatchEpoch(patchEpochId)?.label || patchEpochId;
  const epochToken = patchEpochId.replace(/^epoch_/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  console.log(`[TFTFlex Ingestion] Starting genuine ingestion of ${sourcePatchLabel} meta comps from detail pages...`);
  const db = await getDb();
  const now = new Date().toISOString();

  const targetUrl = "https://tftflex.com/en/meta";
  const rawPath = path.resolve(`./storage/raw/tftflex_meta_${epochToken}.html`);

  let html: string;
  let receipt: any;

  // Thu thập dữ liệu trang tổng quan: nếu có allowOfflineCache và tồn tại file cache, ưu tiên cache
  if (options.allowOfflineCache === true && fs.existsSync(rawPath)) {
    html = fs.readFileSync(rawPath, "utf8");
    const hash = crypto.createHash("sha256").update(html).digest("hex");
    receipt = {
      fetchUrl: targetUrl,
      fetchedAt: fs.statSync(rawPath).mtime.toISOString(),
      httpStatus: 200,
      contentSha256: hash,
      byteSize: Buffer.byteLength(html),
      headers: { "x-offline-fallback": "true" },
      refreshed: false,
      source: "cache"
    };
    console.log(`[TFTFlex Ingestion] Using cached file: ${rawPath}`);
  } else {
    try {
      const res = await fetchWithReceipt(targetUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        allowOfflineCache: options.allowOfflineCache ?? false,
        cachedArtifactPath: rawPath
      });
      html = res.body.toString("utf8");
      receipt = res.receipt;
      console.log(`[TFTFlex Ingestion] Fetched overview via ${receipt.source} (HTTP ${receipt.httpStatus}), size: ${receipt.byteSize} bytes`);
    } catch (err: any) {
      if (options.allowOfflineCache === true && fs.existsSync(rawPath)) {
        html = fs.readFileSync(rawPath, "utf8");
        const hash = crypto.createHash("sha256").update(html).digest("hex");
        receipt = {
          fetchUrl: targetUrl,
          fetchedAt: fs.statSync(rawPath).mtime.toISOString(),
          httpStatus: 200,
          contentSha256: hash,
          byteSize: Buffer.byteLength(html),
          headers: { "x-offline-fallback": "true" },
          refreshed: false,
          source: "cache"
        };
        console.log(`[TFTFlex Ingestion] Fallback to cached file: ${rawPath}`);
      } else {
        throw err;
      }
    }
  }

  const sha256 = receipt.contentSha256;
  const shortSha = sha256.slice(0, 12);
  const artifactId = `art_tftflex_meta_${epochToken}_${shortSha}`;
  const evidenceId = `ev_tftflex_${epochToken}_${shortSha}`;

  // 1. Lưu content-addressed raw artifact vào storage/raw/sha256/
  const dirPrefix = sha256.slice(0, 2);
  const targetDir = path.resolve("./storage/raw/sha256", dirPrefix);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const storageKey = `sha256/${dirPrefix}/${sha256}.html`;
  const storagePath = path.resolve("./storage/raw", storageKey);
  fs.writeFileSync(storagePath, html, "utf8");

  // Ensure canonical archetypes exist in DB
  for (const arch of SET18_ARCHETYPES) {
    await metaRepository.saveArchetype(arch);
  }

  // 2. Persist rawArtifacts record
  await db
    .insert(rawArtifacts)
    .values({
      id: artifactId,
      sha256,
      storageKey,
      byteSize: receipt.byteSize,
      contentType: "text/html"
    })
    .onConflictDoNothing();

  // 3. Persist evidenceRefs record
  await db
    .insert(evidenceRefs)
    .values({
      id: evidenceId,
      sourceId: "tftflex",
      sourceUrl: targetUrl,
      datasetKind: "real",
      kind: "web_article",
      title: `TFT Set 18 Meta Tier List: Best Comps & Gameplans | ${sourcePatchLabel}`,
      contentSha256: sha256,
      byteSize: receipt.byteSize,
      rawArtifactId: artifactId,
      sourcePublishedAt: null, // Mutable web article without declared publish timestamp
      snippet: `Bảng xếp hạng đội hình meta Đấu Trường Chân Lý Mùa 18 ${sourcePatchLabel} từ TFT Flex.`
    })
    .onConflictDoNothing();

  // 4. Parse JSON-LD & HTML Tier Sections
  const ldMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  let ldData: any = null;
  if (ldMatch) {
    try {
      ldData = JSON.parse(ldMatch[1]);
    } catch (e) {
      console.warn("[TFTFlex] Không parse được JSON-LD:", e);
    }
  }

  const itemList = ldData?.["@graph"]?.find((g: any) => g["@type"] === "ItemList")?.itemListElement || [];

  // Extract authentic source tiers from Next.js dehydrated query payload
  const dehydratedTiers: Record<string, string> = {};
  const tierRegex = /name:"([^"]+)",slug:"([^"]+)",set:18,tier:"([^"]+)"/g;
  let tm: RegExpExecArray | null;
  while ((tm = tierRegex.exec(html)) !== null) {
    dehydratedTiers[tm[2]] = tm[3].toUpperCase();
  }

  const tierSections = [
    { tier: "S", pos: html.indexOf(">Tier S<") },
    { tier: "A", pos: html.indexOf(">Tier A<") },
    { tier: "B", pos: html.indexOf(">Tier B<") },
    { tier: "C", pos: html.indexOf(">Tier C<") },
    { tier: "D", pos: html.indexOf(">Tier D<") }
  ];

  // Extract explicit lead champion names directly stated in Overview text list
  const overviewLeads: Record<string, string> = {};
  const overviewLeadRegex = /<a href="\/en\/meta\/set-18\/([^"]+)"[^>]*>([^<]+)<\/a><span class="text-muted-foreground">\s*—\s*(?:<!-- -->)?\s*([^<]+)<\/span>/g;
  let olm: RegExpExecArray | null;
  while ((olm = overviewLeadRegex.exec(html)) !== null) {
    overviewLeads[olm[1]] = olm[3].trim();
  }

  const observations: SourceCompObservation[] = [];
  const compBuilds: SourceCompBuild[] = [];
  const snapshotId = `snap_tftflex_${epochToken}_${shortSha}`;

  // Create directory for detail raw artifacts
  const detailDir = path.resolve("./storage/raw/tftflex");
  if (!fs.existsSync(detailDir)) {
    fs.mkdirSync(detailDir, { recursive: true });
  }

  let latestObservedPublishedAt: string | null = null;

  for (const item of itemList) {
    if (!item.url || item.url.includes("form-dau-game")) continue;
    const slug = item.url.split("/").pop();
    const occurrence = html.indexOf(slug, 20000);
    let assignedTier: string | null = dehydratedTiers[slug] || dehydratedTiers[`set-18/${slug}`] || null;
    if (dehydratedTiers[slug]) {
      assignedTier = dehydratedTiers[slug];
    } else if (occurrence !== -1) {
      const precedingSection = tierSections
        .filter((section) => section.pos >= 0 && section.pos <= occurrence)
        .sort((a, b) => b.pos - a.pos)[0];
      assignedTier = precedingSection?.tier || null;
    }

    // Crawl or read detail page with receipt (Vietnamese locale endpoint)
    const detailUrl = `https://tftflex.com/vi/meta/set-18/${slug}`;
    const detailLocalPath = path.join(detailDir, `${slug}.html`);

    let detailHtml: string;
    let detailReceipt: any;

    if (options.allowOfflineCache === true && fs.existsSync(detailLocalPath)) {
      detailHtml = fs.readFileSync(detailLocalPath, "utf8");
      const dHash = crypto.createHash("sha256").update(detailHtml).digest("hex");
      detailReceipt = {
        fetchUrl: detailUrl,
        fetchedAt: fs.statSync(detailLocalPath).mtime.toISOString(),
        httpStatus: 200,
        contentSha256: dHash,
        byteSize: Buffer.byteLength(detailHtml),
        headers: { "x-offline-fallback": "true" },
        refreshed: false,
        source: "cache"
      };
    } else {
      try {
        const dRes = await fetchWithReceipt(detailUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          allowOfflineCache: options.allowOfflineCache ?? false,
          cachedArtifactPath: detailLocalPath
        });
        detailReceipt = dRes.receipt;
        detailHtml = dRes.body.toString("utf8");
        if (dRes.receipt.source === "network") {
          fs.writeFileSync(detailLocalPath, dRes.body);
        }
      } catch (err: any) {
        if (options.allowOfflineCache === true && fs.existsSync(detailLocalPath)) {
          detailHtml = fs.readFileSync(detailLocalPath, "utf8");
          const dHash = crypto.createHash("sha256").update(detailHtml).digest("hex");
          detailReceipt = {
            fetchUrl: detailUrl,
            fetchedAt: fs.statSync(detailLocalPath).mtime.toISOString(),
            httpStatus: 200,
            contentSha256: dHash,
            byteSize: Buffer.byteLength(detailHtml),
            headers: { "x-offline-fallback": "true" },
            refreshed: false,
            source: "cache"
          };
        } else {
          console.warn(`[TFTFlex Ingestion] Fail closed: could not fetch detail for ${slug}: ${err.message}`);
          continue; // Fail closed! Do not create real observation if detail fetch failed!
        }
      }
    }

    // Extract genuine champions and items from detail page
    const overviewLeadName = overviewLeads[slug] || null;
    const extracted = extractDetailComp(detailHtml, slug, overviewLeadName);
    const detailSha = detailReceipt.contentSha256;
    const detailArtifactId = `art_tftflex_${slug}_${detailSha.slice(0, 10)}`;
    const detailEvId = `ev_tftflex_${slug}_${detailSha.slice(0, 8)}`;

    if (detailReceipt.byteSize > 0) {
      await db
        .insert(rawArtifacts)
        .values({
          id: detailArtifactId,
          sha256: detailSha,
          storageKey: `tftflex/${slug}.html`,
          byteSize: detailReceipt.byteSize,
          contentType: "text/html"
        })
        .onConflictDoNothing();

      await db
        .insert(evidenceRefs)
        .values({
          id: detailEvId,
          sourceId: "tftflex",
          sourceUrl: detailUrl,
          datasetKind: "real",
          kind: "web_article",
          title: `TFTFlex Comp Detail: ${extracted.title || item.name}`,
          contentSha256: detailSha,
          byteSize: detailReceipt.byteSize,
          rawArtifactId: detailArtifactId,
          sourcePublishedAt: extracted.publishedAt ? new Date(extracted.publishedAt) : null,
          snippet: `Chi tiết đội hình ${extracted.title || item.name} (${extracted.units.length} thực thể bàn cờ hợp lệ).`
        })
        .onConflictDoNothing();
    }

    if (extracted.publishedAt && (!latestObservedPublishedAt || new Date(extracted.publishedAt).getTime() > new Date(latestObservedPublishedAt).getTime())) {
      latestObservedPublishedAt = extracted.publishedAt;
    }

    const obsId = `obs_tftflex_${slug}_${epochToken}`;

    // Dynamic Archetype Matching (No manual archetypeSlugMap!)
    const observedUnitCanonicalKeys = extracted.units.map((u) => canonicalChamp(u.key));
    const observedLeadCanonicalKey = extracted.sourceLeadChampionId ? canonicalChamp(extracted.sourceLeadChampionId) : null;
    const matchResult = matchArchetype(SET18_ARCHETYPES, observedLeadCanonicalKey, observedUnitCanonicalKeys, []);

    const matchedArchId = matchResult.status === "matched" ? (matchResult.bestMatch?.archetype.id || null) : null;
    const similarity = matchResult.bestMatch?.similarity || 0;

    // Validate board units using board-validator
    const primaryBuild = extracted.builds.find((b) => b.boardKind === "primary");
    const boardValidation = validateBoardUnits(
      extracted.units.map((u) => ({
        championId: canonicalChamp(u.key),
        rawKey: u.key,
        name: u.name,
        items: u.items,
        starLevel: u.starLevel ?? undefined
      })),
      {
        allowSpawnedEntities: true,
        boardLevel: primaryBuild?.level ?? (extracted.units.length <= 5 ? extracted.units.length : null),
        boardKind: primaryBuild?.boardKind ?? (extracted.units.length <= 5 ? "early" : "primary")
      }
    );

    const unknownTokens = Array.from(new Set(extracted.quarantinedTokens));
    const obsStatus = boardValidation.valid && unknownTokens.length === 0 ? "valid" : "quarantined";
    const quarantineReason = obsStatus === "valid"
      ? null
      : [boardValidation.quarantineReason || boardValidation.errors.join("; "), unknownTokens.length > 0 ? `Unknown tokens: ${unknownTokens.join(", ")}` : ""]
          .filter(Boolean)
          .join("; ");

    if (matchedArchId && obsStatus === "valid") {
      await db
        .insert(metaSourceMappings)
        .values({
          id: `map_tftflex_${slug}`,
          sourceId: "tftflex",
          sourceCompId: `tftflex_${slug}`,
          archetypeId: matchedArchId,
          variantId: "default",
          similarityScore: similarity,
          reviewStatus: "auto_matched",
          mappingVersion: "2.0.0"
        })
        .onConflictDoUpdate({
          target: metaSourceMappings.id,
          set: {
            archetypeId: matchedArchId,
            similarityScore: similarity,
            reviewStatus: "auto_matched",
            mappingVersion: "2.0.0"
          }
        });
    }

    // Map extracted builds into SourceCompBuild records (preserving authentic variants, levels, positions)
    const compAllBuilds: SourceCompBuild[] = [];

    if (extracted.builds.length > 0) {
      extracted.builds.forEach((b, idx) => {
        const bUnits = b.units.map((u) => {
          const validItems = (u.items || []).filter(isItemKnown).map((it, order) => ({
            sourceItemKey: it,
            itemId: canonicalItem(it),
            order
          }));

          return {
            sourceChampionKey: u.key,
            championId: canonicalChamp(u.key),
            starLevel: u.starLevel,
            position: u.position || null,
            items: validItems
          };
        });

        const suffix = b.boardKind === "primary" ? "primary" : (b.tabSlug ? `${b.tabSlug}_${idx}` : `variant_${idx}`);
        const buildId = `build_tftflex_${slug}_${suffix}`;

        compAllBuilds.push({
          id: buildId,
          observationId: obsId,
          boardKind: b.boardKind,
          boardCompleteness: b.boardCompleteness || "exact",
          boardLevelMin: b.boardLevelMin !== undefined ? b.boardLevelMin : null,
          boardLevelMax: b.boardLevelMax !== undefined ? b.boardLevelMax : null,
          label: b.label || null,
          boardLevel: b.level !== undefined ? b.level : null,
          units: bUnits,
          sourceVariantKey: b.tabSlug || null,
          sourceUpdatedAt: extracted.publishedAt,
          rawArtifactId: detailReceipt.byteSize > 0 ? detailArtifactId : artifactId,
          rawLocator: b.sourceLocator,
          sourceLocator: b.sourceLocator,
          createdAt: detailReceipt.fetchedAt || receipt.fetchedAt || now
        });
      });
    } else {
      const buildUnits = extracted.units.map((u) => {
        const validItems = (u.items || []).filter(isItemKnown).map((it, order) => ({
          sourceItemKey: it,
          itemId: canonicalItem(it),
          order
        }));

        return {
          sourceChampionKey: u.key,
          championId: canonicalChamp(u.key),
          starLevel: u.starLevel,
          position: null,
          items: validItems
        };
      });

      const primaryBuild: SourceCompBuild = {
        id: `build_tftflex_${slug}_primary`,
        observationId: obsId,
        boardKind: "primary",
        boardCompleteness: "partial",
        boardLevelMin: null,
        boardLevelMax: null,
        label: "Summary",
        boardLevel: null,
        units: buildUnits,
        sourceVariantKey: "summary",
        sourceUpdatedAt: extracted.publishedAt,
        rawArtifactId: detailReceipt.byteSize > 0 ? detailArtifactId : artifactId,
        rawLocator: `tftflex.com/vi/meta/set-18/${slug} (summary.champions)`,
        sourceLocator: `tftflex.com/vi/meta/set-18/${slug} (summary.champions)`,
        createdAt: detailReceipt.fetchedAt || receipt.fetchedAt || now
      };
      compAllBuilds.push(primaryBuild);
    }

    compBuilds.push(...compAllBuilds);

    const conditions = assignedTier
      ? [`Phân hạng ${assignedTier} từ TFT Flex Meta Tier List (${sourcePatchLabel})`]
      : ["Nguồn không công bố tier có thể xác minh cho đội hình này."];
    if (extracted.leadProvenance) {
      conditions.push(
        `Source Lead: ${extracted.sourceLeadChampionId} (nguồn: ${extracted.leadProvenance.locator}, độ tin cậy: ${extracted.leadProvenance.confidence})`
      );
    }
    if (extracted.inferred?.tankChampionId) {
      conditions.push(`App suy luận Tank: ${extracted.inferred.tankChampionId} dựa trên trang bị phòng thủ.`);
    }
    if (extracted.quarantinedTokens.length > 0) {
      conditions.push(`Đã cách ly các token không hợp lệ: ${extracted.quarantinedTokens.join(", ")}`);
    }
    if (!boardValidation.valid) {
      conditions.push(`Cảnh báo kiểm định bàn cờ: ${boardValidation.errors.join("; ")}`);
    }

    const obs: SourceCompObservation = {
      id: obsId,
      datasetKind: "real",
      sourceId: "tftflex",
      sourceCompId: `tftflex_${slug}`,
      sourceUrl: item.url,
      rawArtifactId: detailReceipt.byteSize > 0 ? detailArtifactId : artifactId,
      observedAt: detailReceipt.fetchedAt || receipt.fetchedAt || now,
      fetchedAt: detailReceipt.fetchedAt || now,
      sourcePublishedAt: null, // Mutable web tier list without official publish date
      sourceDataAsOf: null,
      sourceUpdatedAt: extracted.publishedAt,
      scope: {
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        mode: "ranked_standard",
        patchEpochId,
        sourcePatchLabel,
        rankScope: "All",
        regions: ["Global"],
        windowStart: null,
        windowEnd: null
      },
      archetypeId: boardValidation.valid ? matchedArchId : null,
      variantId: (boardValidation.valid && matchedArchId) ? "default" : null,
      originalName: extracted.title || item.name,
      originalTier: assignedTier,
      classificationKind: "editorial",
      sourceLeadChampionId: observedLeadCanonicalKey,
      carryChampionId: observedLeadCanonicalKey && isShopChampion(observedLeadCanonicalKey) ? observedLeadCanonicalKey : null,
      tankChampionId: null, // Source does not provide tank; kept null
      inferred: {
        ...extracted.inferred,
        similarityScore: similarity,
        reviewStatus: matchResult.status === "matched"
          ? "auto_matched"
          : matchResult.status === "ambiguous"
            ? "ambiguous"
            : "unmatched",
        matchReason: matchResult.reason,
        matchMargin: matchResult.margin
      },
      boardSourceEvidenceRefId: detailReceipt.byteSize > 0 ? detailEvId : evidenceId,
      metrics: {
        averagePlacement: null,
        top4Rate: null,
        winRate: null,
        sampleCount: null,
        sampleCountQuality: "unknown",
        pickRateRaw: null,
        pickRateUnit: "unknown"
      },
      conditions,
      evidenceRefIds: [evidenceId, detailEvId],
      parserVersion: "2.0.0",
      mappingVersion: "2.0.0",
      status: obsStatus,
      quarantineReason,
      builds: compAllBuilds
    };

    observations.push(obs);
  }

  // 5. Lưu vào storage/imports/tftflex_import.json (bảo tồn fixture 18.2)
  const importPath = patchEpochId === "epoch_18_2"
    ? path.resolve("./storage/imports/tftflex_import.json")
    : path.resolve(`./storage/imports/tftflex_import_${epochToken}.json`);
  fs.writeFileSync(importPath, JSON.stringify(observations, null, 2), "utf8");
  console.log(`[TFTFlex Ingestion] Saved ${observations.length} genuine observations to ${importPath}`);

  // 6. Lưu snapshot nguồn vào DB
  await db
    .insert(metaSourceSnapshots)
    .values({
      id: snapshotId,
      sourceId: "tftflex",
      datasetKind: "real",
      observedAt: new Date(receipt.fetchedAt || now),
      fetchedAt: new Date(receipt.fetchedAt || now),
      sourcePublishedAt: latestObservedPublishedAt ? new Date(latestObservedPublishedAt) : null,
      sourceDataAsOf: latestObservedPublishedAt ? new Date(latestObservedPublishedAt) : null,
      sourceUpdatedAt: latestObservedPublishedAt ? new Date(latestObservedPublishedAt) : null,
      scope: {
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        mode: "ranked_standard",
        patchEpochId,
        sourcePatchLabel,
        rankScope: "All",
        regions: ["Global"],
        windowStart: null,
        windowEnd: null
      },
      parserVersion: "2.0.0",
      status: "staging",
      rawArtifactId: artifactId
    })
    .onConflictDoUpdate({
      target: metaSourceSnapshots.id,
      set: {
        rawArtifactId: artifactId,
        observedAt: new Date(receipt.fetchedAt || now),
        fetchedAt: new Date(receipt.fetchedAt || now),
        sourcePublishedAt: latestObservedPublishedAt ? new Date(latestObservedPublishedAt) : null,
        sourceDataAsOf: latestObservedPublishedAt ? new Date(latestObservedPublishedAt) : null,
        sourceUpdatedAt: latestObservedPublishedAt ? new Date(latestObservedPublishedAt) : null,
        status: "staging"
      }
    });

  // 7. Lưu observations vào DB
  for (const obs of observations) {
    await db
      .insert(metaSourceCompObservations)
      .values({
        id: obs.id,
        snapshotId,
        sourceId: obs.sourceId,
        datasetKind: "real",
        sourceCompId: obs.sourceCompId,
        sourceUrl: obs.sourceUrl,
        archetypeId: obs.archetypeId,
        variantId: obs.variantId,
        originalName: obs.originalName,
        originalTier: obs.originalTier,
        classificationKind: obs.classificationKind,
        sourceLeadChampionId: obs.sourceLeadChampionId,
        carryChampionId: obs.carryChampionId,
        tankChampionId: obs.tankChampionId,
        inferred: obs.inferred,
        boardSourceEvidenceRefId: obs.boardSourceEvidenceRefId,
        fetchedAt: new Date(obs.fetchedAt || now),
        sourcePublishedAt: obs.sourcePublishedAt ? new Date(obs.sourcePublishedAt) : null,
        sourceDataAsOf: obs.sourceDataAsOf ? new Date(obs.sourceDataAsOf) : null,
        metrics: obs.metrics,
        conditions: obs.conditions,
        evidenceRefIds: obs.evidenceRefIds,
        status: obs.status || "valid",
        quarantineReason: obs.quarantineReason || null
      })
      .onConflictDoUpdate({
        target: metaSourceCompObservations.id,
        set: {
          originalTier: obs.originalTier,
          archetypeId: obs.archetypeId,
          variantId: obs.variantId,
          sourceLeadChampionId: obs.sourceLeadChampionId,
          carryChampionId: obs.carryChampionId,
          tankChampionId: obs.tankChampionId,
          inferred: obs.inferred,
          boardSourceEvidenceRefId: obs.boardSourceEvidenceRefId,
          fetchedAt: new Date(obs.fetchedAt || now),
          sourcePublishedAt: obs.sourcePublishedAt ? new Date(obs.sourcePublishedAt) : null,
          sourceDataAsOf: obs.sourceDataAsOf ? new Date(obs.sourceDataAsOf) : null,
          evidenceRefIds: obs.evidenceRefIds,
          status: obs.status || "valid",
          quarantineReason: obs.quarantineReason || null
        }
      });
  }

  // 8. Lưu builds vào DB
  for (const build of compBuilds) {
    await db
      .insert(metaSourceCompBuilds)
      .values({
        id: build.id,
        observationId: build.observationId,
        boardKind: build.boardKind,
        boardCompleteness: build.boardCompleteness || "exact",
        boardLevel: build.boardLevel,
        boardLevelMin: build.boardLevelMin,
        boardLevelMax: build.boardLevelMax,
        sourceVariantKey: build.label || null,
        sourceUpdatedAt: null,
        rawArtifactId: artifactId,
        rawLocator: build.sourceLocator || "",
        units: build.units,
        sourceLocator: build.sourceLocator || ""
      })
      .onConflictDoUpdate({
        target: metaSourceCompBuilds.id,
        set: {
          boardKind: build.boardKind,
          boardCompleteness: build.boardCompleteness || "exact",
          boardLevel: build.boardLevel,
          boardLevelMin: build.boardLevelMin,
          boardLevelMax: build.boardLevelMax,
          sourceVariantKey: build.label || null,
          rawArtifactId: artifactId,
          rawLocator: build.sourceLocator || "",
          units: build.units,
          sourceLocator: build.sourceLocator || ""
        }
      });
  }

  console.log(`[TFTFlex Ingestion] Successfully ingested ${observations.length} genuine comps and builds into DB!`);
  return { observations, artifactId, evidenceId, receipt };
}

if (process.argv[1] && process.argv[1].includes("ingest-tftflex")) {
  const allowOfflineCache = process.argv.includes("--offline-cache");
  ingestTFTFlex({ allowOfflineCache })
    .then(async () => {
      const { closeDb } = await import("../../src/server/db/client");
      await closeDb();
      process.exit(0);
    })
    .catch((err) => {
      console.error("[TFTFlex Ingestion] Error:", err);
      process.exit(1);
    });
}
