import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb } from "../../src/server/db/client";
import {
  metaArchetypes,
  metaVariants,
  metaSourceSnapshots,
  metaSourceCompObservations,
  metaSourceCompBuilds
} from "../../src/server/db/schema-meta";
import { rawArtifacts, evidenceRefs } from "../../src/server/db/schema";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { SourceCompObservation, SourceCompBuild } from "../../src/domain/meta/schemas";
import { toCanonicalChampionId } from "../../src/domain/identity";
import { fetchWithReceipt } from "../../src/ingestion/fetch-receipt";
import { getCurrentLivePatchEpochId, getPatchEpoch } from "../../src/domain/meta/patch-epochs";

export function discoverAcademyGuides(options?: {
  tierlistFilePath?: string;
  htmlContent?: string;
}): Array<{
  slug: string;
  title: string;
  tier: string | null;
}> {
  if (options?.htmlContent !== undefined) {
    const slugs = Array.from(options.htmlContent.matchAll(/\/tierlist\/comps\/(set-18-[a-z0-9-]+)/gi), (match) => match[1]);
    return Array.from(new Set(slugs)).map((slug) => ({ slug, title: slug, tier: null }));
  }

  const tierlistFile = options?.tierlistFilePath
    ? path.resolve(options.tierlistFilePath)
    : path.resolve("./storage/raw/tftacademy_tierlist_live.html");
  if (fs.existsSync(tierlistFile)) {
    const html = fs.readFileSync(tierlistFile, "utf8");
    const slugs = Array.from(html.matchAll(/\/tierlist\/comps\/(set-18-[a-z0-9-]+)/gi), (match) => match[1]);
    return Array.from(new Set(slugs)).map((slug) => ({ slug, title: slug, tier: null }));
  }

  // Fallback to scanning storage/raw/tftacademy directory
  const academyDir = path.resolve("./storage/raw/tftacademy");
  if (fs.existsSync(academyDir)) {
    const files = fs.readdirSync(academyDir).filter((f) => f.endsWith(".html"));
    return files.map((f) => {
      const slug = f.replace(/\.html$/, "");
      return {
        slug,
        title: slug,
        tier: null
      };
    });
  }

  return [];
}

import { isItemKnown, resolveItemInfo } from "../../src/domain/meta/item-registry";
import { classifyTacticsGroup } from "../../src/ingestion/meta/tactics-tools-classifier";
import { matchArchetype } from "../../src/domain/meta/archetype-matching";
import { validateBoardUnits } from "../../src/domain/meta/board-validator";

function canonicalItem(rawKey: string): string {
  return isItemKnown(rawKey) ? resolveItemInfo(rawKey)?.key || "" : "";
}

function canonicalChamp(rawKey: string): string {
  if (!rawKey) return "";
  return toCanonicalChampionId(rawKey);
}

function safeParseJsObject(str: string): any {
  const json = str
    .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(json);
}

import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";

export async function ingestAllRealMetaSources(options: { allowOfflineCache?: boolean; patchEpochId?: string } = {}) {
  console.log("=== BẮT ĐẦU THU THẬP & INGEST NGUỒN THỰC TẾ: TFT ACADEMY & TACTICS.TOOLS ===");
  const now = new Date().toISOString();
  const patchEpochId = options.patchEpochId || getCurrentLivePatchEpochId();
  const patchEpoch = getPatchEpoch(patchEpochId);
  const sourcePatchLabel = patchEpoch?.label || patchEpochId;
  const epochToken = patchEpochId.replace(/^epoch_/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const db = await getDb();

  // Đảm bảo các canonical archetypes tồn tại trong DB
  for (const arch of SET18_ARCHETYPES) {
    await metaRepository.saveArchetype(arch);
  }

  // -------------------------------------------------------------
  // PHẦN 1: TFT ACADEMY (8 Unique Guides với Positioning Example)
  // -------------------------------------------------------------
  const academyDir = path.resolve("./storage/raw/tftacademy");
  if (!fs.existsSync(academyDir)) {
    fs.mkdirSync(academyDir, { recursive: true });
  }

  const academyObservations: SourceCompObservation[] = [];
  const academySnapshotId = `snap_src_tftacademy_${epochToken}`;

  const academyIndexUrl = "https://tftacademy.com/tierlist/comps";
  const academyIndexPath = path.resolve("./storage/raw/tftacademy_tierlist_live.html");
  if (!(options.allowOfflineCache === true && fs.existsSync(academyIndexPath))) {
    const indexResponse = await fetchWithReceipt(academyIndexUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      allowOfflineCache: options.allowOfflineCache ?? false,
      cachedArtifactPath: academyIndexPath
    });
    if (indexResponse.receipt.source === "network") fs.writeFileSync(academyIndexPath, indexResponse.body);
  }

  const academyGuides = discoverAcademyGuides();
  console.log(`[TFT Academy] Dynamically discovered ${academyGuides.length} guides from tier list index.`);

  for (const item of academyGuides) {
    const url = `https://tftacademy.com/tierlist/comps/${item.slug}`;
    const localFile = path.join(academyDir, `${item.slug}.html`);
    let html: string;
    let receipt: any;

    if (options.allowOfflineCache === true && fs.existsSync(localFile)) {
      html = fs.readFileSync(localFile, "utf8");
      const hash = crypto.createHash("sha256").update(html).digest("hex");
      receipt = {
        fetchUrl: url,
        fetchedAt: now,
        httpStatus: 200,
        contentSha256: hash,
        byteSize: Buffer.byteLength(html),
        headers: { "x-offline-fallback": "true" },
        refreshed: false,
        source: "cache"
      };
      console.log(`[TFT Academy] Using immutable ${sourcePatchLabel} cached file: ${localFile}`);
    } else {
      try {
        const res = await fetchWithReceipt(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          allowOfflineCache: options.allowOfflineCache ?? false,
          cachedArtifactPath: localFile
        });
        receipt = res.receipt;
        html = res.body.toString("utf8");
        if (receipt.source === "network") {
          fs.writeFileSync(localFile, res.body);
        }
        console.log(`[TFT Academy] Fetched ${item.slug} via ${receipt.source} (HTTP ${receipt.httpStatus}), size: ${receipt.byteSize} bytes`);
      } catch (err: any) {
        if (options.allowOfflineCache === true && fs.existsSync(localFile)) {
          html = fs.readFileSync(localFile, "utf8");
          const hash = crypto.createHash("sha256").update(html).digest("hex");
          receipt = {
            fetchUrl: url,
            fetchedAt: now,
            httpStatus: 200,
            contentSha256: hash,
            byteSize: Buffer.byteLength(html),
            headers: { "x-offline-fallback": "true" },
            refreshed: false,
            source: "cache"
          };
          console.log(`[TFT Academy] Fallback to cached file: ${localFile}`);
        } else {
          throw err;
        }
      }
    }

    const sha256 = receipt.contentSha256;
    const rawArtifactId = `art_tftacademy_${item.slug}_${sha256.slice(0, 12)}`;

    // Lưu content-addressed raw artifact vào storage/raw/sha256/
    const dirPrefix = sha256.slice(0, 2);
    const targetDir = path.resolve("./storage/raw/sha256", dirPrefix);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const storageKey = `sha256/${dirPrefix}/${sha256}.html`;
    const storagePath = path.resolve("./storage/raw", storageKey);
    fs.writeFileSync(storagePath, html, "utf8");

    // Đăng ký raw artifact
    await db
      .insert(rawArtifacts)
      .values({
        id: rawArtifactId,
        sha256,
        storageKey,
        byteSize: receipt.byteSize,
        contentType: "text/html"
      })
      .onConflictDoUpdate({
        target: rawArtifacts.id,
        set: { sha256, storageKey, byteSize: receipt.byteSize }
      });

    // Parse SvelteKit queriedGuide mà không dùng eval()
    const start = html.indexOf("queriedGuide:");
    if (start === -1) {
      console.error(`Không tìm thấy queriedGuide trong ${item.slug}`);
      continue;
    }
    const objStart = html.indexOf("{", start);
    let depth = 0;
    let end = objStart;
    for (let i = objStart; i < html.length; i++) {
      if (html[i] === "{") depth++;
      else if (html[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    const guide = safeParseJsObject(html.slice(objStart, end));

    // Evidence ref
    const evRefId = `ev_tftacademy_${item.slug}_${sha256.slice(0, 8)}`;
    await db
      .insert(evidenceRefs)
      .values({
        id: evRefId,
        kind: "raw_artifact",
        sourceId: "tftacademy",
        artifactId: rawArtifactId,
        title: `TFT Academy Guide: ${guide.title}`,
        url,
        locator: "queriedGuide.finalComp",
        snippet: `Bản chụp HTML nguồn TFT Academy cho ${guide.title} (${guide.finalComp?.length} tướng)`,
        sourcePublishedAt: guide.updated ? new Date(guide.updated) : null,
        datasetKind: "real"
      })
      .onConflictDoUpdate({
        target: evidenceRefs.id,
        set: { artifactId: rawArtifactId, url }
      });

    const obsId = `obs_tftacademy_${item.slug}_${epochToken}`;

    // 1. Primary Build: Positioning Example (finalComp)
    const unknownAcademyItems: string[] = [];
    const primaryUnits = (guide.finalComp || []).map((u: any) => {
      const row = Math.floor(u.boardIndex / 7);
      const col = u.boardIndex % 7;
      const validItems = (u.items || [])
        .filter((it: string) => {
          const known = isItemKnown(it);
          if (!known) {
            console.warn(`[TFT Academy] Unknown item quarantined: ${it}`);
            unknownAcademyItems.push(String(it));
          }
          return known;
        })
        .map((it: string, order: number) => ({
          sourceItemKey: it,
          itemId: canonicalItem(it),
          order
        }));

      return {
        sourceChampionKey: u.apiName,
        championId: canonicalChamp(u.apiName),
        starLevel: Number.isInteger(u.stars) && u.stars > 0 ? u.stars : null,
        position: { row, col },
        items: validItems
      };
    });

    const primaryBuild: SourceCompBuild = {
      id: `build_tftacademy_${item.slug}_primary`,
      observationId: obsId,
      boardKind: "primary",
      boardCompleteness: "exact",
      boardLevelMin: primaryUnits.length,
      boardLevelMax: primaryUnits.length,
      label: "Primary",
      boardLevel: primaryUnits.length,
      units: primaryUnits,
      rawArtifactId,
      rawLocator: "queriedGuide.finalComp",
      sourceLocator: "queriedGuide.finalComp (Positioning Example)",
      createdAt: now
    };

    // 2. Early Build (earlyComp)
    const earlyUnits = (guide.earlyComp || []).map((u: any) => ({
      sourceChampionKey: u.apiName,
      championId: canonicalChamp(u.apiName),
      starLevel: Number.isInteger(u.stars) && u.stars > 0 ? u.stars : null,
      position: null,
      items: (u.items || [])
        .filter((it: string) => isItemKnown(it))
        .map((it: string, order: number) => ({
          sourceItemKey: it,
          itemId: canonicalItem(it),
          order
        }))
    }));

    const earlyBuild: SourceCompBuild = {
      id: `build_tftacademy_${item.slug}_early`,
      observationId: obsId,
      boardKind: "early",
      boardCompleteness: "exact",
      boardLevelMin: earlyUnits.length,
      boardLevelMax: earlyUnits.length,
      label: "Early",
      boardLevel: earlyUnits.length,
      units: earlyUnits,
      rawArtifactId,
      rawLocator: "queriedGuide.earlyComp",
      sourceLocator: "queriedGuide.earlyComp (Early Units)",
      createdAt: now
    };

    // 3. Flex Build (maxCap)
    const flexUnits = (guide.maxCap || []).map((u: any) => ({
      sourceChampionKey: u.apiName,
      championId: canonicalChamp(u.apiName),
      starLevel: Number.isInteger(u.stars) && u.stars > 0 ? u.stars : null,
      position: null,
      items: []
    }));

    const flexBuild: SourceCompBuild = {
      id: `build_tftacademy_${item.slug}_flex`,
      observationId: obsId,
      boardKind: "flex",
      boardCompleteness: "conditional",
      boardLevelMin: flexUnits.length,
      boardLevelMax: flexUnits.length,
      label: "Max Cap",
      boardLevel: flexUnits.length,
      units: flexUnits,
      rawArtifactId,
      rawLocator: "queriedGuide.maxCap",
      sourceLocator: "queriedGuide.maxCap (Flex / Max Cap Units)",
      createdAt: now
    };

    const canonicalUnitIds = primaryUnits.map((unit: any) => unit.championId);
    const normalizedTitle = String(guide.title || item.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const declaredMainChampionId = guide.mainChampion?.apiName
      ? canonicalChamp(guide.mainChampion.apiName)
      : null;
    const titleDerivedLead = primaryUnits.find((unit: any) => {
      const compactKey = String(unit.sourceChampionKey || "")
        .toLowerCase()
        .replace(/^tft18_/, "")
        .replace(/^da_18_/, "")
        .replace(/^da_/, "")
        .replace(/_ad$|_ap$|18$/g, "")
        .replace(/[^a-z0-9]/g, "");
      return compactKey.length >= 3 && normalizedTitle.includes(compactKey);
    })?.championId || null;
    const sourceLead = declaredMainChampionId && canonicalUnitIds.includes(declaredMainChampionId)
      ? declaredMainChampionId
      : titleDerivedLead;
    const academyMatch = matchArchetype(SET18_ARCHETYPES, sourceLead, canonicalUnitIds, []);
    const academyArchetypeId = academyMatch.status === "matched" ? academyMatch.bestMatch?.archetype.id || null : null;
    const academyReviewStatus = academyMatch.status === "matched"
      ? "auto_matched"
      : academyMatch.status === "ambiguous"
        ? "ambiguous"
        : "unmatched";
    const academyBoardValidation = validateBoardUnits(primaryUnits.map((unit: any) => ({
      championId: unit.championId,
      items: unit.items.map((entry: any) => entry.sourceItemKey),
      position: unit.position,
      starLevel: unit.starLevel ?? undefined
    })), { boardLevel: primaryUnits.length, boardKind: "primary" });
    const academyValid = academyBoardValidation.valid && unknownAcademyItems.length === 0;

    const obs: SourceCompObservation = {
      id: obsId,
      datasetKind: "real",
      sourceId: "tftacademy",
      sourceCompId: item.slug,
      sourceUrl: url,
      rawArtifactId,
      observedAt: now,
      fetchedAt: receipt.fetchedAt || now,
      sourcePublishedAt: guide.updated ? new Date(guide.updated).toISOString() : null,
      sourceDataAsOf: guide.updated ? new Date(guide.updated).toISOString() : null,
      sourceUpdatedAt: guide.updated ? new Date(guide.updated).toISOString() : null,
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
      archetypeId: academyValid ? academyArchetypeId : null,
      variantId: academyValid && academyArchetypeId ? "default" : null,
      originalName: guide.title || item.title,
      originalTier: guide.tier || item.tier,
      classificationKind: "editorial",
      sourceLeadChampionId: sourceLead,
      carryChampionId: sourceLead,
      tankChampionId: null,
      inferred: {
        algorithmVersion: "archetype-matcher-v2",
        similarityScore: academyMatch.bestMatch?.similarity || 0,
        reviewStatus: academyReviewStatus,
        matchMargin: academyMatch.margin,
        matchReason: academyMatch.reason
      },
      metrics: {
        averagePlacement: null,
        top4Rate: null,
        winRate: null,
        sampleCount: null,
        sampleCountQuality: "unknown",
        pickRateRaw: null,
        pickRateUnit: "unknown"
      },
      conditions: [`Độ khó: ${guide.difficulty || "Tiêu chuẩn"}`, `Positioning Example từ TFT Academy ${sourcePatchLabel}`],
      evidenceRefIds: [evRefId],
      parserVersion: "2.0.0",
      mappingVersion: "1.0.0",
      supersedesObservationId: null,
      status: academyValid ? "valid" : "quarantined",
      quarantineReason: academyValid
        ? null
        : [academyBoardValidation.quarantineReason, unknownAcademyItems.length > 0 ? `Unknown items: ${unknownAcademyItems.join(", ")}` : ""].filter(Boolean).join("; "),
      builds: [primaryBuild, earlyBuild, flexBuild]
    };

    academyObservations.push(obs);
  }

  // Lưu TFT Academy observations
  await metaRepository.saveSourceObservations(
    academySnapshotId,
    "tftacademy",
    {
      gameProduct: "tft",
      setNumber: 18,
      channel: "live",
      mode: "ranked_standard",
      patchEpochId,
      sourcePatchLabel,
      rankScope: "All",
      regions: ["Global"]
    },
    academyObservations,
    "real"
  );
  console.log(`✓ Đã lưu ${academyObservations.length} quan sát từ TFT Academy kèm builds & tọa độ!`);

  // -------------------------------------------------------------
  // PHẦN 2: TACTICS.TOOLS (5 Statistical Team Compositions)
  // -------------------------------------------------------------
  const tacticsUrl = "https://tactics.tools/team-compositions";
  const tacticsHtmlPath = patchEpochId === "epoch_18_2"
    ? path.resolve("./storage/raw/tactics_tools_comps.html")
    : path.resolve(`./storage/raw/tactics_tools_comps_${epochToken}.html`);
  let tacticsHtml: string;
  let tacticsReceipt: any;

  try {
    const res = await fetchWithReceipt(tacticsUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      allowOfflineCache: options.allowOfflineCache ?? false,
      cachedArtifactPath: tacticsHtmlPath
    });
    tacticsReceipt = res.receipt;
    tacticsHtml = res.body.toString("utf8");
    if (tacticsReceipt.source === "network") {
      fs.writeFileSync(tacticsHtmlPath, res.body);
    }
    console.log(`[tactics.tools] Fetched via ${tacticsReceipt.source} (HTTP ${tacticsReceipt.httpStatus}), size: ${tacticsReceipt.byteSize} bytes`);
  } catch (err: any) {
    if (options.allowOfflineCache === true && fs.existsSync(tacticsHtmlPath)) {
      tacticsHtml = fs.readFileSync(tacticsHtmlPath, "utf8");
      const hash = crypto.createHash("sha256").update(tacticsHtml).digest("hex");
      tacticsReceipt = {
        fetchUrl: tacticsUrl,
        fetchedAt: now,
        httpStatus: 200,
        contentSha256: hash,
        byteSize: Buffer.byteLength(tacticsHtml),
        headers: { "x-offline-fallback": "true" },
        refreshed: false,
        source: "cache"
      };
      console.log(`[tactics.tools] Fallback to cached file: ${tacticsHtmlPath}`);
    } else {
      throw err;
    }
  }

  const tacticsSha256 = tacticsReceipt.contentSha256;
  const tacticsArtifactId = `art_tactics_tools_comps_${tacticsSha256.slice(0, 12)}`;

  // Lưu content-addressed raw artifact vào storage/raw/sha256/
  const tDirPrefix = tacticsSha256.slice(0, 2);
  const tTargetDir = path.resolve("./storage/raw/sha256", tDirPrefix);
  if (!fs.existsSync(tTargetDir)) {
    fs.mkdirSync(tTargetDir, { recursive: true });
  }
  const tStorageKey = `sha256/${tDirPrefix}/${tacticsSha256}.html`;
  const tStoragePath = path.resolve("./storage/raw", tStorageKey);
  fs.writeFileSync(tStoragePath, tacticsHtml, "utf8");

  await db
    .insert(rawArtifacts)
    .values({
      id: tacticsArtifactId,
      sha256: tacticsSha256,
      storageKey: tStorageKey,
      byteSize: tacticsReceipt.byteSize,
      contentType: "text/html"
    })
    .onConflictDoUpdate({
      target: rawArtifacts.id,
      set: { sha256: tacticsSha256, storageKey: tStorageKey, byteSize: tacticsReceipt.byteSize }
    });

  const nextDataMatch = tacticsHtml.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!nextDataMatch) {
    throw new Error("Không tìm thấy __NEXT_DATA__ trong tactics.tools HTML!");
  }
  const nextData = JSON.parse(nextDataMatch[1]);
  const groups = nextData.props?.pageProps?.initialData?.groups || [];

  console.log(`[tactics.tools] Tìm thấy ${groups.length} nhóm đội hình thống kê.`);

  const tacticsObservations: SourceCompObservation[] = [];
  const tacticsSnapshotId = `snap_src_tactics_tools_${epochToken}`;
  const tacticsStat = fs.existsSync(tacticsHtmlPath) ? fs.statSync(tacticsHtmlPath) : null;
  const tacticsObservedAt = tacticsStat ? tacticsStat.mtime.toISOString() : now;

  for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
    const grp = groups[groupIdx];
    if (!grp || !grp.full) continue;

    const classification = classifyTacticsGroup(grp, { minConfidence: 0.90 });
    if (!classification.matched) {
      console.warn(`[tactics.tools] Group index ${groupIdx} không đạt ngưỡng signature match: ${classification.reason}`);
      continue;
    }

    const { archetypeId, variantId, name, confidence } = classification;
    const f = grp.full;

    const count = f.count || 0;
    const avgPlace = f.place ? Math.round(f.place * 100) / 100 : null;
    const top4 = f.top4 || 0;
    const win = f.win || 0;
    const top4Rate = count > 0 ? Math.round((top4 / count) * 1000) / 1000 : null;
    const winRate = count > 0 ? Math.round((win / count) * 1000) / 1000 : null;

    const compId = `tactics_comp_${archetypeId}`;
    const obsId = `obs_tactics_tools_${archetypeId}_${epochToken}`;
    const evRefId = `ev_tactics_tools_${archetypeId}_${tacticsSha256.slice(0, 8)}`;

    const authenticName = `tactics.tools cluster ${groupIdx}: ${classification.topUnits.slice(0, 3).join(", ")}`;

    await db
      .insert(evidenceRefs)
      .values({
        id: evRefId,
        kind: "raw_artifact",
        sourceId: "tactics_tools",
        artifactId: tacticsArtifactId,
        title: `tactics.tools Comp: ${authenticName}`,
        url: "https://tactics.tools/team-compositions",
        locator: `initialData.groups[${groupIdx}].full (Matched signature ${archetypeId} at ${(confidence * 100).toFixed(0)}%)`,
        snippet: `Thống kê Diamond+ ${sourcePatchLabel}: ${count} trận, Hạng TB ${avgPlace}, Top 4: ${(top4Rate ? top4Rate * 100 : 0).toFixed(1)}%`,
        sourcePublishedAt: null,
        datasetKind: "real"
      })
      .onConflictDoUpdate({
        target: evidenceRefs.id,
        set: { artifactId: tacticsArtifactId }
      });

    // tactics.tools là nguồn thống kê thuần túy, không có Positioning Example board/items. Để trống builds theo Rule Mục 5.
    const obs: SourceCompObservation = {
      id: obsId,
      datasetKind: "real",
      sourceId: "tactics_tools",
      sourceCompId: compId,
      sourceUrl: "https://tactics.tools/team-compositions",
      rawArtifactId: tacticsArtifactId,
      observedAt: tacticsObservedAt,
      fetchedAt: tacticsReceipt.fetchedAt || now,
      sourceDataAsOf: null,
      sourcePublishedAt: null,
      sourceUpdatedAt: null, // tactics.tools does not provide sourcePublishedAt timestamp
      scope: {
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        mode: "ranked_standard",
        patchEpochId,
        sourcePatchLabel,
        rankScope: "Diamond+",
        regions: ["Global"],
        windowStart: null,
        windowEnd: null
      },
      archetypeId: archetypeId!,
      variantId: variantId!,
      originalName: authenticName,
      originalTier: null, // Nguồn thống kê không gán chữ tier trực tiếp
      classificationKind: "statistical",
      sourceLeadChampionId: null,
      carryChampionId: null,
      tankChampionId: null,
      inferred: {
        algorithmVersion: "tactics-signature-v3",
        similarityScore: confidence,
        reviewStatus: "auto_matched",
        matchReason: name || null
      },
      metrics: {
        averagePlacement: avgPlace,
        top4Rate,
        winRate,
        sampleCount: count,
        sampleCountQuality: "exact",
        pickRateRaw: `${count}`,
        pickRateUnit: "per_lobby"
      },
      conditions: [
        `Thống kê Ranked Diamond+ ${sourcePatchLabel}`,
        `Cỡ mẫu: ${count} trận`,
        `Signature Match: ${(confidence * 100).toFixed(0)}%`
      ],
      evidenceRefIds: [evRefId],
      parserVersion: "2.0.0",
      mappingVersion: "2.0.0",
      supersedesObservationId: null,
      builds: []
    };

    tacticsObservations.push(obs);
  }

  await metaRepository.saveSourceObservations(
    tacticsSnapshotId,
    "tactics_tools",
    {
      gameProduct: "tft",
      setNumber: 18,
      channel: "live",
      mode: "ranked_standard",
      patchEpochId,
      sourcePatchLabel,
      rankScope: "Diamond+",
      regions: ["Global"]
    },
    tacticsObservations,
    "real"
  );
  console.log(`✓ Đã lưu ${tacticsObservations.length} quan sát thống kê từ tactics.tools!`);

  // -------------------------------------------------------------
  // PHẦN 3: TFTFLEX (20 comps Set 18, 44 builds, resolved items)
  // -------------------------------------------------------------
  console.log("\n=== THU THẬP & INGEST NGUỒN THỰC TẾ: TFTFLEX ===");
  const { ingestTFTFlex } = await import("./ingest-tftflex");
  await ingestTFTFlex({ allowOfflineCache: options.allowOfflineCache, patchEpochId });

  // -------------------------------------------------------------
  // PHẦN 4: METATFT (54 clusters, stats từ API real)
  // -------------------------------------------------------------
  console.log("\n=== THU THẬP & INGEST NGUỒN THỰC TẾ: METATFT ===");
  const { ingestMetaTFT } = await import("./ingest-metatft");
  await ingestMetaTFT({ allowOfflineCache: options.allowOfflineCache, patchEpochId });

  // -------------------------------------------------------------
  // PHẦN 5: DATATFT (28 comps, 28 strategies từ API real)
  // -------------------------------------------------------------
  console.log("\n=== THU THẬP & INGEST NGUỒN THỰC TẾ: DATATFT ===");
  const { ingestDataTFT } = await import("./ingest-datatft");
  await ingestDataTFT({ allowOfflineCache: options.allowOfflineCache, patchEpochId });

  // -------------------------------------------------------------
  // PHẦN 6: TÍNH TOÁN & CÔNG BỐ WEBSITE RANKING CHO epoch hiện hành REAL
  // -------------------------------------------------------------
  console.log("\n=== TÍNH TOÁN & CÔNG BỐ RANKING MỤC A (WEBSITES) REAL ===");
  const { rankingService } = await import("../../src/server/meta/services/ranking-service");
  const rankingSnap = await rankingService.computeWebsitesRanking(patchEpochId, "real");

  console.log(`✓ Ranking snapshot đã tạo và công bố: ${rankingSnap.id}`);
  console.log(`  - Publication status: ${rankingSnap.publicationStatus}`);
  console.log(`  - Total archetypes: ${rankingSnap.totals.totalArchetypes}`);
  console.log(`  - Tier S: ${rankingSnap.totals.rankedTierS}`);
  console.log(`  - Tier A: ${rankingSnap.totals.rankedTierA}`);
  console.log(`  - Tier B: ${rankingSnap.totals.rankedTierB}`);
  console.log(`  - Tier C: ${rankingSnap.totals.rankedTierC}`);
  console.log(`  - Provisional: ${rankingSnap.totals.provisionalCount}`);
  console.log(`  - Collecting: ${rankingSnap.totals.collectingCount}`);
  console.log(`  - Valid observations: ${rankingSnap.coverage.validObservations}`);

  console.log("\n=== TOÀN BỘ DỮ LIỆU THỰC ĐÃ ĐƯỢC THU THẬP VÀ ĐỒNG BỘ THÀNH CÔNG ===");
}

if (process.argv[1] && process.argv[1].includes("ingest-real-meta-sources")) {
  const allowOfflineCache = process.argv.includes("--offline-cache");
  ingestAllRealMetaSources({ allowOfflineCache })
    .then(async () => {
      const { closeDb } = await import("../../src/server/db/client");
      await closeDb();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Lỗi ingest:", err);
      process.exit(1);
    });
}
