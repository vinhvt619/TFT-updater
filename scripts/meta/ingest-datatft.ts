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
import { toCanonicalChampionId } from "../../src/domain/identity";
import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";
import { matchArchetype } from "../../src/domain/meta/archetype-matching";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { normalizeItemKey, resolveItemInfo } from "../../src/domain/meta/item-registry";
import { getCurrentLivePatchEpochId, getPatchEpoch } from "../../src/domain/meta/patch-epochs";

interface DataTFTCompSummary {
  id: number;
  tier: string;
  heroId: string;
  title: string;
  titleApi?: string[];
  equipId?: string;
  ext?: string;
}

interface DataTFTEquipHero {
  heroId: string;
  heroKey?: string;
  heroName?: string;
  equips?: string[][];
}

interface DataTFTStrategy {
  id: number;
  title: string;
  core?: string;
  earlyDesc?: string;
  midDesc?: string;
  finalDesc?: string;
  equips?: DataTFTEquipHero[];
  teamUrl?: string;
  earlyTeamUrl?: string;
  conditions?: string;
  updateTime?: string;
}

export function createDataTftMetrics() {
  return {
    pickRateRaw: null,
    averagePlacement: null,
    top4Rate: null,
    winRate: null,
    sampleCount: null,
    sampleCountQuality: "unknown" as const,
    pickRateUnit: "unknown" as const
  };
}

export async function ingestDataTFT(options: { allowOfflineCache?: boolean; patchEpochId?: string } = {}) {
  console.log("=== THU THẬP & INGEST NGUỒN THỰC TẾ: DATATFT ===");
  const now = new Date().toISOString();
  const patchEpochId = options.patchEpochId || getCurrentLivePatchEpochId();
  const sourcePatchLabel = getPatchEpoch(patchEpochId)?.label || patchEpochId;
  const epochToken = patchEpochId.replace(/^epoch_/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const db = await getDb();

  // Đảm bảo archetypes được lưu
  for (const arch of SET18_ARCHETYPES) {
    await metaRepository.saveArchetype(arch);
  }

  const cacheDir = path.resolve("./storage/raw");
  const shaDir = path.resolve("./storage/raw/sha256/datatft");
  if (!fs.existsSync(shaDir)) fs.mkdirSync(shaDir, { recursive: true });

  const compsCachePath = path.join(cacheDir, "datatft_comps.json");
  const strategiesCachePath = path.join(cacheDir, "datatft_strategies.json");

  let compsRaw = "";
  let strategies: Record<number, DataTFTStrategy> = {};
  let compsFetchedAt = now;
  let strategiesFetchedAt = now;

  const COMPS_URL = "https://api.datatft.com/team/comps";
  const STRATEGY_URL = "https://api.datatft.com/team/strategy";

  if (options.allowOfflineCache && fs.existsSync(compsCachePath) && fs.existsSync(strategiesCachePath)) {
    console.log("[DataTFT] Đang đọc từ local offline cache...");
    compsRaw = fs.readFileSync(compsCachePath, "utf8");
    strategies = JSON.parse(fs.readFileSync(strategiesCachePath, "utf8"));
    compsFetchedAt = fs.statSync(compsCachePath).mtime.toISOString();
    strategiesFetchedAt = fs.statSync(strategiesCachePath).mtime.toISOString();
  } else {
    try {
      console.log(`[DataTFT] Fetching live comps: ${COMPS_URL}...`);
      const r1 = await fetch(COMPS_URL, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ season: "18" })
      });
      if (!r1.ok) throw new Error(`Comps fetch failed: ${r1.status}`);
      compsRaw = await r1.text();
      compsFetchedAt = new Date().toISOString();
      fs.writeFileSync(compsCachePath, compsRaw, "utf8");

      const compsJson = JSON.parse(compsRaw);
      const list: DataTFTCompSummary[] = compsJson.data?.list || [];
      console.log(`[DataTFT] Tìm thấy ${list.length} comps, fetching chi tiết từng strategy...`);

      // A live collection is a coherent fetch. Never mix a fresh index with
      // details left over from an older cache.
      strategies = {};

      for (const comp of list) {
        try {
          const r2 = await fetch(STRATEGY_URL, {
            method: "POST",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ id: comp.id })
          });
          if (!r2.ok) throw new Error(`Strategy fetch failed: ${r2.status}`);
          const j2 = await r2.json();
          if (!j2.data) throw new Error("Strategy response is missing data");
          strategies[comp.id] = j2.data;
          strategiesFetchedAt = new Date().toISOString();
        } catch (e: any) {
          throw new Error(`Không thể fetch strategy cho comp ${comp.id}: ${e.message}`);
        }
      }
      fs.writeFileSync(strategiesCachePath, JSON.stringify(strategies, null, 2), "utf8");
    } catch (e: any) {
      if (options.allowOfflineCache && fs.existsSync(compsCachePath) && fs.existsSync(strategiesCachePath)) {
        console.warn(`[DataTFT] Network error (${e.message}), falling back to offline cache.`);
        compsRaw = fs.readFileSync(compsCachePath, "utf8");
        strategies = JSON.parse(fs.readFileSync(strategiesCachePath, "utf8"));
        compsFetchedAt = fs.statSync(compsCachePath).mtime.toISOString();
        strategiesFetchedAt = fs.statSync(strategiesCachePath).mtime.toISOString();
      } else {
        throw e;
      }
    }
  }

  // Lưu content-addressed raw artifacts
  const compsHash = crypto.createHash("sha256").update(compsRaw).digest("hex");
  const strategiesRaw = JSON.stringify(strategies);
  const strategiesHash = crypto.createHash("sha256").update(strategiesRaw).digest("hex");

  const compsStorageKey = `sha256/datatft/${compsHash}.json`;
  const strategiesStorageKey = `sha256/datatft/${strategiesHash}.json`;

  fs.writeFileSync(path.resolve("./storage/raw", compsStorageKey), compsRaw, "utf8");
  fs.writeFileSync(path.resolve("./storage/raw", strategiesStorageKey), strategiesRaw, "utf8");

  const compsArtifactId = `art_datatft_comps_${compsHash.slice(0, 16)}`;
  const strategiesArtifactId = `art_datatft_strat_${strategiesHash.slice(0, 16)}`;

  await db.insert(rawArtifacts).values([
    {
      id: compsArtifactId,
      sha256: compsHash,
      storageKey: compsStorageKey,
      byteSize: Buffer.byteLength(compsRaw, "utf8"),
      contentType: "application/json"
    },
    {
      id: strategiesArtifactId,
      sha256: strategiesHash,
      storageKey: strategiesStorageKey,
      byteSize: Buffer.byteLength(strategiesRaw, "utf8"),
      contentType: "application/json"
    }
  ]).onConflictDoNothing();

  const compsJson = JSON.parse(compsRaw);
  const list: DataTFTCompSummary[] = compsJson.data?.list || [];

  const snapshotId = `snap_src_datatft_${epochToken}`;
  const observedAt = new Date(Math.max(Date.parse(compsFetchedAt), Date.parse(strategiesFetchedAt))).toISOString();
  await db.insert(metaSourceSnapshots).values({
    id: snapshotId,
    sourceId: "datatft",
    datasetKind: "real",
    observedAt: new Date(observedAt),
    fetchedAt: new Date(observedAt),
    sourcePublishedAt: null,
    sourceDataAsOf: null,
    sourceUpdatedAt: null,
    scope: {
      gameProduct: "tft",
      setNumber: 18,
      channel: "live",
      mode: "ranked_standard",
      patchEpochId,
      sourcePatchLabel,
      rankScope: "All",
      regions: ["CN", "Global"],
      windowStart: null,
      windowEnd: null
    },
    parserVersion: "2.0.0",
    status: "staging",
    rawArtifactId: compsArtifactId
  }).onConflictDoUpdate({
    target: metaSourceSnapshots.id,
    set: {
      rawArtifactId: compsArtifactId,
      status: "staging",
      scope: {
        gameProduct: "tft",
        setNumber: 18,
        channel: "live",
        mode: "ranked_standard",
        patchEpochId,
        sourcePatchLabel,
        rankScope: "All",
        regions: ["CN", "Global"],
        windowStart: null,
        windowEnd: null
      }
    }
  });

  const observations: SourceCompObservation[] = [];
  const builds: SourceCompBuild[] = [];
  const unresolvedItemKeysByComp = new Map<string, string[]>();

  for (const comp of list) {
    const strat = strategies[comp.id] || {
      id: comp.id,
      title: comp.title,
      equips: []
    };

    const compIdStr = String(comp.id);
    const title = strat.title || comp.title || `DataTFT Comp ${compIdStr}`;
    const tier = comp.tier || "B";

    // Extract champions and items from strat.equips
    const unitsMap = new Map<string, { key: string; name?: string; items: string[] }>();

    if (Array.isArray(strat.equips)) {
      for (const eq of strat.equips) {
        const rawKey = eq.heroKey || eq.heroId;
        if (!rawKey || typeof rawKey !== "string") continue;
        const cId = toCanonicalChampionId(rawKey);
        const itemKeys: string[] = [];
        if (Array.isArray(eq.equips)) {
          for (const itemGroup of eq.equips) {
            if (Array.isArray(itemGroup)) {
              for (const it of itemGroup) {
                if (it) {
                  const rawItemKey = String(it);
                  const resolved = resolveItemInfo(rawItemKey);
                  itemKeys.push(resolved?.key || normalizeItemKey(rawItemKey));
                  if (!resolved) {
                    const unresolved = unresolvedItemKeysByComp.get(compIdStr) || [];
                    unresolved.push(rawItemKey);
                    unresolvedItemKeysByComp.set(compIdStr, unresolved);
                  }
                }
              }
            }
          }
        }
        unitsMap.set(cId, {
          key: rawKey,
          name: eq.heroName,
          items: itemKeys.slice(0, 3)
        });
      }
    }

    // Also include titleApi champions if missing
    if (Array.isArray(comp.titleApi)) {
      for (const t of comp.titleApi) {
        if (!t || typeof t !== "string") continue;
        const cId = toCanonicalChampionId(t);
        if (!unitsMap.has(cId)) {
          unitsMap.set(cId, { key: t, items: [] });
        }
      }
    }

    const canonicalUnits = Array.from(unitsMap.keys());

    // Extract authentic lead carry from titleApi or units with items (never assume index 0)
    let leadCarry: string | null = null;
    if (Array.isArray(comp.titleApi)) {
      for (const t of comp.titleApi) {
        if (t && typeof t === "string" && !t.includes("Emblem") && !t.includes("Augment") && !t.includes("Elderwood") && !t.includes("Defender") && !t.includes("Executioner") && !t.includes("Riftbeast") && !t.includes("Sentry") && !t.includes("Solar") && !t.includes("Adaptor") && !t.includes("EarlyLearnings") && !t.includes("FloraFatalis") && !t.includes("Blackthorn") && !t.includes("Coven")) {
          const canonical = toCanonicalChampionId(t);
          if (canonical && unitsMap.has(canonical)) {
            leadCarry = canonical;
            break;
          }
        }
      }
    }
    if (!leadCarry) {
      for (const [cId, uInfo] of unitsMap.entries()) {
        if (uInfo.items.length > 0) {
          leadCarry = cId;
          break;
        }
      }
    }

    // Archetype matching with authentic score & thresholds
    const match = matchArchetype(SET18_ARCHETYPES, leadCarry, canonicalUnits, []);
    const isMatched = match.status === "matched";
    const archetypeId = isMatched && match.bestMatch ? match.bestMatch.archetype.id : null;
    const similarityScore = match.bestMatch ? match.bestMatch.similarity : 0;
    const reviewStatus = isMatched ? "auto_matched" : (match.status === "ambiguous" ? "ambiguous" : "unmatched");

    const obsId = `obs_datatft_${compIdStr}_${epochToken}`;
    const obs: SourceCompObservation = {
      id: obsId,
      datasetKind: "real",
      sourceId: "datatft",
      sourceCompId: compIdStr,
      sourceUrl: `https://www.datatft.com/comps#${compIdStr}`,
      rawArtifactId: compsArtifactId,
      observedAt,
      fetchedAt: Math.max(Date.parse(compsFetchedAt), Date.parse(strategiesFetchedAt)) === Date.parse(strategiesFetchedAt) ? strategiesFetchedAt : compsFetchedAt,
      sourcePublishedAt: null,
      sourceDataAsOf: null,
      sourceUpdatedAt: null,
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
      originalName: title,
      originalTier: tier,
      classificationKind: "editorial",
      archetypeId,
      variantId: archetypeId ? "default" : null,
      sourceLeadChampionId: leadCarry,
      carryChampionId: leadCarry,
      tankChampionId: null,
      inferred: {
        algorithmVersion: "archetype-matcher-v2",
        similarityScore,
        reviewStatus,
        matchReason: match.reason
      },
      boardSourceEvidenceRefId: null,
      supersedesObservationId: null,
      metrics: createDataTftMetrics(),
      conditions: [`Phân hạng ${tier} từ DataTFT (${sourcePatchLabel})`],
      status: unresolvedItemKeysByComp.has(compIdStr) ? "quarantined" : "valid",
      quarantineReason: unresolvedItemKeysByComp.has(compIdStr)
        ? `Unknown item keys: ${Array.from(new Set(unresolvedItemKeysByComp.get(compIdStr) || [])).join(", ")}`
        : null,
      parserVersion: "2.0.0",
      mappingVersion: "2.0.0",
      evidenceRefIds: [`ev_datatft_${compIdStr}_${epochToken}`]
    };
    observations.push(obs);

    // Build (partial completeness since DataTFT strategy comps don't have hex positions)
    const buildUnits = Array.from(unitsMap.entries()).map(([cId, uInfo]) => ({
      sourceChampionKey: uInfo.key,
      championId: cId,
      position: null,
      starLevel: null,
      items: uInfo.items.map((itKey, order) => ({
        order,
        sourceItemKey: itKey,
        // DataTFT exposes numeric/source-local item keys here. Keep the raw key
        // until a verified source dictionary resolves it to a canonical item.
        itemId: resolveItemInfo(itKey)?.key || null
      }))
    }));

    const build: SourceCompBuild = {
      id: `build_datatft_${compIdStr}_main`,
      observationId: obsId,
      boardKind: "primary",
      boardCompleteness: "partial",
      boardLevel: buildUnits.length,
      boardLevelMin: buildUnits.length,
      boardLevelMax: buildUnits.length,
      label: "Standard",
      units: buildUnits,
      rawArtifactId: compsArtifactId,
      rawLocator: `team.comps[${compIdStr}]`,
      sourceLocator: `datatft.team.strategy[${compIdStr}]`,
      createdAt: observedAt
    };
    builds.push(build);
  }

  // Insert DB
  for (const obs of observations) {
    await db.insert(evidenceRefs).values({
      id: obs.evidenceRefIds[0],
      kind: "raw_artifact",
      sourceId: "datatft",
      artifactId: compsArtifactId,
      title: obs.originalName,
      url: obs.sourceUrl,
      locator: `team.comps[${obs.sourceCompId}]`,
      datasetKind: "real"
    }).onConflictDoNothing();

    await db.insert(metaSourceCompObservations).values({
      id: obs.id,
      snapshotId,
      sourceId: obs.sourceId,
      datasetKind: "real",
      sourceCompId: obs.sourceCompId,
      sourceUrl: obs.sourceUrl,
      archetypeId: obs.archetypeId,
      variantId: "default",
      originalName: obs.originalName,
      originalTier: obs.originalTier,
      classificationKind: "editorial",
      carryChampionId: obs.carryChampionId,
      sourceLeadChampionId: obs.sourceLeadChampionId,
      inferred: obs.inferred,
      fetchedAt: obs.fetchedAt ? new Date(obs.fetchedAt) : new Date(),
      sourcePublishedAt: obs.sourcePublishedAt ? new Date(obs.sourcePublishedAt) : null,
      sourceDataAsOf: obs.sourceDataAsOf ? new Date(obs.sourceDataAsOf) : null,
      metrics: obs.metrics,
      conditions: obs.conditions,
      evidenceRefIds: obs.evidenceRefIds,
      status: obs.status,
      quarantineReason: obs.quarantineReason
    }).onConflictDoUpdate({
      target: metaSourceCompObservations.id,
      set: {
        originalTier: obs.originalTier,
        metrics: obs.metrics,
        status: obs.status,
        archetypeId: obs.archetypeId,
        carryChampionId: obs.carryChampionId,
        sourceLeadChampionId: obs.sourceLeadChampionId,
        inferred: obs.inferred,
        fetchedAt: obs.fetchedAt ? new Date(obs.fetchedAt) : new Date(),
        sourcePublishedAt: obs.sourcePublishedAt ? new Date(obs.sourcePublishedAt) : null,
        sourceDataAsOf: obs.sourceDataAsOf ? new Date(obs.sourceDataAsOf) : null,
        conditions: obs.conditions
      }
    });

    if (obs.archetypeId && obs.inferred && (obs.inferred as any).reviewStatus === "auto_matched") {
      const sim = (obs.inferred as any).similarityScore;
      const status = (obs.inferred as any).reviewStatus;
      await db.insert(metaSourceMappings).values({
        id: `map_${obs.id}`,
        sourceId: obs.sourceId,
        sourceCompId: obs.sourceCompId,
        archetypeId: obs.archetypeId,
        variantId: "default",
        similarityScore: sim,
        reviewStatus: status,
        mappingVersion: "2.0.0"
      }).onConflictDoUpdate({
        target: metaSourceMappings.id,
        set: {
          archetypeId: obs.archetypeId,
          similarityScore: sim,
          reviewStatus: status,
          mappingVersion: "2.0.0"
        }
      });
    }
  }

  for (const b of builds) {
    await db.insert(metaSourceCompBuilds).values({
      id: b.id,
      observationId: b.observationId,
      boardKind: b.boardKind,
      boardCompleteness: b.boardCompleteness || "partial",
      boardLevel: b.boardLevelMin,
      boardLevelMin: b.boardLevelMin,
      boardLevelMax: b.boardLevelMax,
      sourceVariantKey: b.label || null,
      sourceUpdatedAt: null,
      rawArtifactId: compsArtifactId,
      rawLocator: b.sourceLocator || "",
      units: b.units,
      sourceLocator: b.sourceLocator || ""
    }).onConflictDoUpdate({
      target: metaSourceCompBuilds.id,
      set: {
        boardCompleteness: b.boardCompleteness || "partial",
        boardLevel: b.boardLevelMin,
        boardLevelMin: b.boardLevelMin,
        boardLevelMax: b.boardLevelMax,
        rawArtifactId: compsArtifactId,
        rawLocator: b.sourceLocator || "",
        units: b.units
      }
    });
  }

  // Ghi export JSON
  const importDir = path.resolve("./storage/imports");
  if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
  fs.writeFileSync(
    path.join(importDir, "datatft_import.json"),
    JSON.stringify({ observations, builds }, null, 2),
    "utf8"
  );

  const mappedCount = observations.filter((o) => o.archetypeId !== null).length;
  console.log(`[DataTFT] Hoàn tất! Ingest ${observations.length} observations (${mappedCount} mapped), ${builds.length} builds.`);
}

if (process.argv[1] && process.argv[1].includes("ingest-datatft")) {
  const allowCache = process.argv.includes("--offline-cache");
  ingestDataTFT({ allowOfflineCache: allowCache })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[DataTFT Ingest Error]:", err);
      process.exit(1);
    });
}
