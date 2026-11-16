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
import { getCurrentLivePatchEpochId, getPatchEpoch } from "../../src/domain/meta/patch-epochs";

interface MetaTFTCluster {
  Cluster: number;
  units_string: string;
  traits_string: string;
  name?: Array<{ name: string; score: number; type: string }>;
  name_string: string;
}

interface MetaTFTStat {
  cluster: string;
  count: number;
  places: number[]; // [p1, p2, p3, p4, p5, p6, p7, p8, total]
}

export function calculateMetaTftMetrics(stat?: MetaTFTStat): {
  averagePlacement: number | null;
  top4Rate: number | null;
  winRate: number | null;
  sampleCount: number | null;
  validDistribution: boolean;
} {
  const count = stat?.count || 0;
  const places = stat?.places || [];
  const firstEight = places.slice(0, 8);
  const validDistribution = count > 0 && firstEight.length === 8 && firstEight.every(Number.isFinite)
    && firstEight.reduce((sum, value) => sum + value, 0) === count;
  if (!validDistribution) {
    return { averagePlacement: null, top4Rate: null, winRate: null, sampleCount: count > 0 ? count : null, validDistribution };
  }
  const weighted = firstEight.reduce((sum, value, index) => sum + (index + 1) * value, 0);
  return {
    averagePlacement: Math.round((weighted / count) * 100) / 100,
    winRate: Math.round((firstEight[0] / count) * 1000) / 1000,
    top4Rate: Math.round((firstEight.slice(0, 4).reduce((sum, value) => sum + value, 0) / count) * 1000) / 1000,
    sampleCount: count,
    validDistribution
  };
}

export async function ingestMetaTFT(options: { allowOfflineCache?: boolean; patchEpochId?: string } = {}) {
  console.log("=== THU THẬP & INGEST NGUỒN THỰC TẾ: METATFT ===");
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
  const shaDir = path.resolve("./storage/raw/sha256");
  if (!fs.existsSync(shaDir)) fs.mkdirSync(shaDir, { recursive: true });

  const clusterCachePath = path.join(cacheDir, "metatft_cluster_info.json");
  const statsCachePath = path.join(cacheDir, "metatft_comps_stats.json");

  let clusterRaw = "";
  let statsRaw = "";
  let clusterFetchedAt = now;
  let statsFetchedAt = now;

  const CLUSTER_URL = "https://api-hc.metatft.com/tft-comps-api/latest_cluster_info";
  const STATS_URL = "https://api-hc.metatft.com/tft-comps-api/comps_stats";

  if (options.allowOfflineCache && fs.existsSync(clusterCachePath) && fs.existsSync(statsCachePath)) {
    console.log("[MetaTFT] Đang đọc từ local offline cache...");
    clusterRaw = fs.readFileSync(clusterCachePath, "utf8");
    statsRaw = fs.readFileSync(statsCachePath, "utf8");
    clusterFetchedAt = fs.statSync(clusterCachePath).mtime.toISOString();
    statsFetchedAt = fs.statSync(statsCachePath).mtime.toISOString();
  } else {
    try {
      console.log(`[MetaTFT] Fetching live: ${CLUSTER_URL}...`);
      const r1 = await fetch(CLUSTER_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json"
        }
      });
      if (!r1.ok) throw new Error(`Cluster fetch failed: ${r1.status}`);
      clusterRaw = await r1.text();
      clusterFetchedAt = new Date().toISOString();
      fs.writeFileSync(clusterCachePath, clusterRaw, "utf8");

      console.log(`[MetaTFT] Fetching live: ${STATS_URL}...`);
      const r2 = await fetch(STATS_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json"
        }
      });
      if (!r2.ok) throw new Error(`Stats fetch failed: ${r2.status}`);
      statsRaw = await r2.text();
      statsFetchedAt = new Date().toISOString();
      fs.writeFileSync(statsCachePath, statsRaw, "utf8");
    } catch (e: any) {
      if (options.allowOfflineCache && fs.existsSync(clusterCachePath) && fs.existsSync(statsCachePath)) {
        console.warn(`[MetaTFT] Network error (${e.message}), falling back to offline cache.`);
        clusterRaw = fs.readFileSync(clusterCachePath, "utf8");
        statsRaw = fs.readFileSync(statsCachePath, "utf8");
        clusterFetchedAt = fs.statSync(clusterCachePath).mtime.toISOString();
        statsFetchedAt = fs.statSync(statsCachePath).mtime.toISOString();
      } else {
        throw e;
      }
    }
  }

  // Lưu content-addressed raw artifacts
  const clusterHash = crypto.createHash("sha256").update(clusterRaw).digest("hex");
  const statsHash = crypto.createHash("sha256").update(statsRaw).digest("hex");
  const clusterStorageKey = `sha256/metatft/${clusterHash}.json`;
  const statsStorageKey = `sha256/metatft/${statsHash}.json`;
  const clusterDir = path.resolve("./storage/raw/sha256/metatft");
  if (!fs.existsSync(clusterDir)) fs.mkdirSync(clusterDir, { recursive: true });

  fs.writeFileSync(path.resolve("./storage/raw", clusterStorageKey), clusterRaw, "utf8");
  fs.writeFileSync(path.resolve("./storage/raw", statsStorageKey), statsRaw, "utf8");

  const clusterArtifactId = `art_metatft_cluster_${clusterHash.slice(0, 16)}`;
  const statsArtifactId = `art_metatft_stats_${statsHash.slice(0, 16)}`;

  await db.insert(rawArtifacts).values([
    {
      id: clusterArtifactId,
      sha256: clusterHash,
      storageKey: clusterStorageKey,
      byteSize: Buffer.byteLength(clusterRaw, "utf8"),
      contentType: "application/json"
    },
    {
      id: statsArtifactId,
      sha256: statsHash,
      storageKey: statsStorageKey,
      byteSize: Buffer.byteLength(statsRaw, "utf8"),
      contentType: "application/json"
    }
  ]).onConflictDoNothing();

  const clusterJson = JSON.parse(clusterRaw);
  const statsJson = JSON.parse(statsRaw);

  const clusters: MetaTFTCluster[] = clusterJson.cluster_info?.cluster_details?.clusters || [];
  const statsList: MetaTFTStat[] = statsJson.results || [];
  const statsMap = new Map<string, MetaTFTStat>();
  for (const s of statsList) {
    if (s.cluster) statsMap.set(String(s.cluster), s);
  }

  console.log(`[MetaTFT] Đã parse ${clusters.length} clusters và ${statsMap.size} comp stats.`);

  const snapshotId = `snap_src_metatft_${epochToken}`;
  const observedAt = new Date(Math.max(Date.parse(clusterFetchedAt), Date.parse(statsFetchedAt))).toISOString();
  await db.insert(metaSourceSnapshots).values({
    id: snapshotId,
    sourceId: "metatft",
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
      regions: ["Global"],
      windowStart: null,
      windowEnd: null
    },
    parserVersion: "2.0.0",
    status: "staging",
    rawArtifactId: clusterArtifactId
  }).onConflictDoUpdate({
    target: metaSourceSnapshots.id,
    set: {
      rawArtifactId: clusterArtifactId,
      status: "staging",
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
      }
    }
  });

  const observations: SourceCompObservation[] = [];
  const builds: SourceCompBuild[] = [];

  for (const c of clusters) {
    const clusterIdStr = String(c.Cluster);
    const stat = statsMap.get(clusterIdStr);
    const count = stat?.count || 0;
    const calculatedMetrics = calculateMetaTftMetrics(stat);

    // Tính metrics từ places (không dùng default stats nếu thiếu dữ liệu)
    const avgPlace = calculatedMetrics.averagePlacement;
    const winRate = calculatedMetrics.winRate;
    const top4Rate = calculatedMetrics.top4Rate;
    let derivedTier: string | null = null;

    if (avgPlace !== null) {
      if (avgPlace <= 4.25) derivedTier = "S";
      else if (avgPlace <= 4.45) derivedTier = "A";
      else if (avgPlace <= 4.65) derivedTier = "B";
      else derivedTier = "C";
    }

    // Phân tích units_string
    const rawUnits = c.units_string.split(",").map((u) => u.trim()).filter(Boolean);
    const canonicalUnits = rawUnits.map((u) => toCanonicalChampionId(u));

    // Phân tích lead carry từ nguồn (không tự coi champion đầu tiên là carry)
    let leadCarry: string | null = null;
    if (c.name && Array.isArray(c.name)) {
      const unitEntry = c.name.find((n) => n.type === "unit");
      if (unitEntry) leadCarry = toCanonicalChampionId(unitEntry.name);
    }

    // Matching với ngưỡng phân loại thực
    const match = matchArchetype(SET18_ARCHETYPES, leadCarry, canonicalUnits, []);
    const isMatched = match.status === "matched";
    const archetypeId = isMatched && match.bestMatch ? match.bestMatch.archetype.id : null;
    const similarityScore = match.bestMatch ? match.bestMatch.similarity : 0;
    const reviewStatus = isMatched ? "auto_matched" : (match.status === "ambiguous" ? "ambiguous" : "unmatched");

    const obsId = `obs_metatft_cluster_${clusterIdStr}_${epochToken}`;
    const obs: SourceCompObservation = {
      id: obsId,
      datasetKind: "real",
      sourceId: "metatft",
      sourceCompId: `cluster_${clusterIdStr}`,
      sourceUrl: `https://www.metatft.com/comps#${clusterIdStr}`,
      rawArtifactId: clusterArtifactId,
      observedAt,
      fetchedAt: clusterFetchedAt,
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
      originalName: c.name_string || `MetaTFT Cluster ${clusterIdStr}`,
      originalTier: null, // MetaTFT raw payload không có cột tier biên tập gốc
      classificationKind: "statistical",
      archetypeId,
      variantId: archetypeId ? "default" : null,
      sourceLeadChampionId: leadCarry,
      carryChampionId: leadCarry,
      tankChampionId: null,
      inferred: {
        algorithmVersion: "archetype-matcher-v2",
        similarityScore,
        reviewStatus,
        matchReason: match.reason,
        derivedTier
      },
      boardSourceEvidenceRefId: null,
      supersedesObservationId: null,
      metrics: {
        pickRateRaw: null, // Không dùng denominator 1,000,000 tùy tiện khi payload không có total games
        averagePlacement: avgPlace,
        top4Rate,
        winRate,
        sampleCount: calculatedMetrics.sampleCount,
        sampleCountQuality: calculatedMetrics.validDistribution ? "exact" : "unknown",
        pickRateUnit: "unknown"
      },
      conditions: derivedTier
        ? [`Cụm thống kê ${derivedTier} từ MetaTFT (${count} trận)`]
        : [`Cụm thống kê từ MetaTFT (${count} trận)`],
      status: "valid",
      quarantineReason: null,
      parserVersion: "2.0.0",
      mappingVersion: "2.0.0",
      evidenceRefIds: [`ev_metatft_${clusterIdStr}_${epochToken}`]
    };
    observations.push(obs);

    // Build (partial completeness: cluster không có vị trí ô cờ và trang bị cụ thể)
    const buildUnits = canonicalUnits.map((u, idx) => ({
      sourceChampionKey: rawUnits[idx],
      championId: u,
      position: null,
      starLevel: null,
      items: []
    }));

    const build: SourceCompBuild = {
      id: `build_metatft_${clusterIdStr}_main`,
      observationId: obsId,
      boardKind: "primary",
      boardCompleteness: "partial",
      boardLevel: buildUnits.length,
      boardLevelMin: buildUnits.length,
      boardLevelMax: buildUnits.length,
      label: "Standard",
      units: buildUnits,
      rawArtifactId: clusterArtifactId,
      rawLocator: `cluster_details.clusters[${clusterIdStr}]`,
      sourceLocator: `cluster_details.clusters[${clusterIdStr}]`,
      createdAt: observedAt
    };
    builds.push(build);
  }

  // Insert DB
  for (const obs of observations) {
    await db.insert(evidenceRefs).values({
      id: obs.evidenceRefIds[0],
      kind: "raw_artifact",
      sourceId: "metatft",
      artifactId: clusterArtifactId,
      title: obs.originalName,
      url: obs.sourceUrl,
      locator: `cluster_details.clusters[${obs.sourceCompId}]`,
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
      classificationKind: "statistical",
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
      rawArtifactId: clusterArtifactId,
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
        rawArtifactId: clusterArtifactId,
        rawLocator: b.sourceLocator || "",
        units: b.units
      }
    });
  }

  // Ghi export JSON
  const importDir = path.resolve("./storage/imports");
  if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
  fs.writeFileSync(
    path.join(importDir, "metatft_import.json"),
    JSON.stringify({ observations, builds }, null, 2),
    "utf8"
  );

  const mappedCount = observations.filter((o) => o.archetypeId !== null).length;
  console.log(`[MetaTFT] Hoàn tất! Ingest ${observations.length} observations (${mappedCount} mapped), ${builds.length} builds.`);
}

if (process.argv[1] && process.argv[1].includes("ingest-metatft")) {
  const allowCache = process.argv.includes("--offline-cache");
  ingestMetaTFT({ allowOfflineCache: allowCache })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[MetaTFT Ingest Error]:", err);
      process.exit(1);
    });
}
