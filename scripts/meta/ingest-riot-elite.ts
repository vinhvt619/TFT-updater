import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb, closeDb } from "../../src/server/db/client";
import { rawArtifacts, evidenceRefs } from "../../src/server/db/schema";
import { metaCollectionCoverage } from "../../src/server/db/schema-meta";
import { rawStorage } from "../../src/server/storage/raw-storage";
import { RiotTftProvider, REGION_ROUTING, RiotCredentialsError } from "../../src/ingestion/meta/providers/riot-tft";
import { normalizeRiotMatch } from "../../src/ingestion/meta/riot-normalizer";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { rankingService } from "../../src/server/meta/services/ranking-service";
import { classifyBoard } from "../../src/domain/meta/board-classifier";
import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";
import { getCurrentLivePatchEpochId } from "../../src/domain/meta/patch-epochs";

interface CliOptions {
  regions: string[];
  top: number;
  windowHours: number;
  epoch: string;
  onlineRequired: boolean;
  resumeRun: string | null;
  matchCount: number;
}

interface RunManifest {
  schemaVersion: string;
  runId: string;
  startedAt: string;
  updatedAt: string;
  regions: string[];
  top: number;
  windowHours: number;
  patchEpochId: string;
  processedMatchIds: string[];
  processedAccountKeys: string[];
  cohortSnapshotIds: string[];
  status: "running" | "completed" | "needs_credentials" | "failed";
  diagnostics: Record<string, unknown>;
}

function parseOptions(): CliOptions {
  const args = process.argv.slice(2);
  const value = (name: string): string | null => {
    const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
    if (index < 0) return null;
    const arg = args[index];
    return arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[index + 1] || null;
  };
  const parseRegions = value("--regions") || "KR,VN,NA,EUW";
  const windowValue = value("--window") || "72h";
  const windowHours = Math.max(1, Math.min(168, Number(windowValue.replace(/h$/i, "")) || 72));
  // FIN-05: Mặc định cohort Top 200 cao thủ theo yêu cầu phạm vi (tối đa 200)
  const top = Math.max(1, Math.min(200, Number(value("--top") || 200)));
  const epoch = value("--epoch") || getCurrentLivePatchEpochId();
  return {
    regions: parseRegions.split(",").map((r) => r.trim().toUpperCase()).filter((r) => REGION_ROUTING[r]),
    top,
    windowHours,
    epoch,
    onlineRequired: args.includes("--online-required"),
    resumeRun: value("--resume-run"),
    matchCount: Math.max(10, Math.min(100, Math.ceil(windowHours / 24) * 20))
  };
}

function runFile(runId: string): string {
  return path.resolve("./storage/riot-elite-runs", `${runId}.json`);
}

function loadOrCreateManifest(options: CliOptions): RunManifest {
  const runId = options.resumeRun || `riot_elite_${options.epoch}_${crypto.randomBytes(8).toString("hex")}`;
  const file = runFile(runId);
  if (options.resumeRun && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as RunManifest;
  return {
    schemaVersion: "round10.riot-elite-run.v1",
    runId,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    regions: options.regions,
    top: options.top,
    windowHours: options.windowHours,
    patchEpochId: options.epoch,
    processedMatchIds: [],
    processedAccountKeys: [],
    cohortSnapshotIds: [],
    status: "running",
    diagnostics: {}
  };
}

function saveManifest(manifest: RunManifest): void {
  manifest.updatedAt = new Date().toISOString();
  const file = runFile(manifest.runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(manifest, null, 2), "utf8");
  fs.renameSync(temp, file);
}

async function saveArtifact(content: unknown, contentType: string, extension = "json", sourceUrl?: string): Promise<{ id: string; sha256: string }> {
  const bytes = Buffer.isBuffer(content)
    ? content
    : typeof content === "string"
    ? Buffer.from(content, "utf8")
    : Buffer.from(JSON.stringify(content), "utf8");
  const stored = rawStorage.putIfAbsent(bytes, extension);
  const id = `art_riot_${stored.sha256}`;
  const db = await getDb();
  await db.insert(rawArtifacts).values({
    id,
    sha256: stored.sha256,
    storageKey: stored.storageKey,
    byteSize: stored.byteSize,
    contentType
  }).onConflictDoNothing();
  await db.insert(evidenceRefs).values({
    id: `ev_riot_${stored.sha256}`,
    kind: "raw_artifact",
    sourceId: "riot_tft_api",
    artifactId: id,
    title: "Riot TFT API raw response",
    url: sourceUrl || null,
    locator: `sha256:${stored.sha256}`,
    snippet: "Captured immutable response bytes; PUUIDs are not copied to public fields.",
    datasetKind: "real"
  }).onConflictDoNothing();
  return { id, sha256: stored.sha256 };
}

async function saveCoverage(snapshotId: string, accountKey: string, options: { windowHours: number; windowEnd: Date; requestedMatchIds: string[]; completedMatches: number; failedMatches: number; failureReasons: string[]; status: string }) {
  const db = await getDb();
  const end = options.windowEnd;
  const start = new Date(end.getTime() - options.windowHours * 3600 * 1000);
  await db.insert(metaCollectionCoverage).values({
    id: `coverage_${snapshotId}_${accountKey}`,
    cohortSnapshotId: snapshotId,
    accountKey,
    windowStart: start,
    windowEnd: end,
    requestedMatchIds: options.requestedMatchIds,
    totalMatches: options.requestedMatchIds.length,
    completedMatches: options.completedMatches,
    failedMatches: options.failedMatches,
    failureReasons: options.failureReasons,
    status: options.status
  }).onConflictDoNothing();
}

async function ingestRegion(provider: RiotTftProvider, region: string, options: CliOptions, manifest: RunManifest): Promise<{ snapshotId: string; validMatches: number; quarantinedMatches: number }> {
  const cohortResult = await provider.fetchCohortSnapshotWithReceipt(region, options.top);
  const cohortArtifact = await saveArtifact(cohortResult.receipt.rawBody || cohortResult.receipt.body, "application/json", "json", cohortResult.receipt.url);
  const snapshot = { ...cohortResult.snapshot, rawArtifactId: cohortArtifact.id, sourceUrl: cohortResult.receipt.url };
  await metaRepository.saveCohortSnapshot(snapshot);
  manifest.cohortSnapshotIds.push(snapshot.id);
  manifest.cohortSnapshotIds = Array.from(new Set(manifest.cohortSnapshotIds));
  saveManifest(manifest);

  const cohortSet = new Set(cohortResult.membersWithPuuid.map((member) => member.accountKey));
  let validMatches = 0;
  let quarantinedMatches = 0;
  const captureEnd = new Date(cohortResult.receipt.fetchedAt);
  const fallbackEnd = Number.isFinite(captureEnd.getTime()) ? captureEnd : new Date();
  const windowStart = fallbackEnd.getTime() - options.windowHours * 3600 * 1000;
  const regionRoute = REGION_ROUTING[region].regionalRoute;
  for (const member of cohortResult.membersWithPuuid) {
    if (manifest.processedAccountKeys.includes(member.accountKey)) continue;
    let matchIds: string[] = [];
    let failed = 0;
    const failureReasons: string[] = [];
    try {
      matchIds = await provider.fetchMatchIds(regionRoute, member.puuid, options.matchCount);
    } catch (error: any) {
      failed++;
      failureReasons.push(`match_ids_fetch_failed:${error?.message || "unknown"}`);
    }
    let completed = 0;
    let latestObservedEnd: Date | null = null;
    for (const matchId of Array.from(new Set(matchIds))) {
      if (manifest.processedMatchIds.includes(matchId)) continue;
      let fetchResult;
      try {
        fetchResult = await provider.fetchMatchDetailWithReceipt(regionRoute, matchId);
      } catch (error: any) {
        failed++;
        failureReasons.push(`match_detail_fetch_failed:${matchId}:${error?.message || "unknown"}`);
        continue;
      }
      const artifact = await saveArtifact(fetchResult.receipt.rawBody || fetchResult.detail, "application/json", "json", fetchResult.receipt.url);
      const normalized = normalizeRiotMatch(fetchResult.detail, {
        region,
        patchEpochId: options.epoch,
        accountKeySecret: process.env.ACCOUNT_KEY_HMAC_SECRET,
        rawArtifactId: artifact.id,
        fetchedAt: fetchResult.receipt.fetchedAt,
        cohortAccountKeys: Array.from(cohortSet)
      });
      await metaRepository.saveNormalizedMatch(normalized.match, snapshot.id, "real");
      const endedAtMs = new Date(normalized.match.endedAt).getTime();
      if (Number.isFinite(endedAtMs) && endedAtMs <= fallbackEnd.getTime() && (!latestObservedEnd || endedAtMs > latestObservedEnd.getTime())) latestObservedEnd = new Date(endedAtMs);
      const withinWindow = Number.isFinite(endedAtMs) && endedAtMs >= windowStart && endedAtMs <= fallbackEnd.getTime();
      if (withinWindow && normalized.match.status === "valid") {
        validMatches++;
        for (const participant of normalized.match.participants.filter((p) => cohortSet.has(p.accountKey))) {
          const classification = classifyBoard(participant, SET18_ARCHETYPES, "round10-riot-board-v1");
          await metaRepository.saveClassification(classification);
        }
      } else if (withinWindow) {
        quarantinedMatches++;
      }
      completed++;
      manifest.processedMatchIds.push(matchId);
      saveManifest(manifest);
    }
    manifest.processedAccountKeys.push(member.accountKey);
    manifest.processedAccountKeys = Array.from(new Set(manifest.processedAccountKeys));
    await saveCoverage(snapshot.id, member.accountKey, {
      windowHours: options.windowHours,
      windowEnd: latestObservedEnd || fallbackEnd,
      requestedMatchIds: Array.from(new Set(matchIds)),
      completedMatches: completed,
      failedMatches: failed,
      failureReasons,
      status: failed > 0 && completed === 0 ? "partial" : "completed"
    });
    saveManifest(manifest);
  }
  return { snapshotId: snapshot.id, validMatches, quarantinedMatches };
}

async function main() {
  const options = parseOptions();
  if (options.regions.length === 0) throw new Error("Không có region hợp lệ; dùng --regions KR,VN,NA,EUW.");
  const manifest = loadOrCreateManifest(options);
  saveManifest(manifest);
  const provider = new RiotTftProvider();
  if (!provider.isConfigured() || !provider.hasAccountKeySecret()) {
    manifest.status = "needs_credentials";
    manifest.diagnostics = {
      missing: [!provider.isConfigured() ? "RIOT_API_KEY" : null, !provider.hasAccountKeySecret() ? "ACCOUNT_KEY_HMAC_SECRET" : null].filter(Boolean),
      message: "Không sinh cohort, match, PUUID, hoặc dữ liệu demo khi thiếu credential."
    };
    saveManifest(manifest);
    console.error(`[riot-elite] needs_credentials: ${JSON.stringify(manifest.diagnostics)}`);
    if (options.onlineRequired) process.exitCode = 2;
    return;
  }

  const results: Record<string, unknown> = {};
  try {
    for (const region of options.regions) {
      results[region] = await ingestRegion(provider, region, options, manifest);
    }
    for (const region of options.regions) await rankingService.computeEliteRanking(region, options.epoch, options.windowHours, "real");
    await rankingService.computeEliteRanking("all", options.epoch, options.windowHours, "real");
    manifest.status = "completed";
    manifest.diagnostics = { results };
    saveManifest(manifest);
    console.log(`[riot-elite] completed run=${manifest.runId} epoch=${options.epoch}`);
  } catch (error: any) {
    manifest.status = error instanceof RiotCredentialsError ? "needs_credentials" : "failed";
    manifest.diagnostics = { ...manifest.diagnostics, error: error?.message || String(error), results };
    saveManifest(manifest);
    throw error;
  } finally {
    await closeDb();
  }
}

main().catch((error: any) => {
  console.error("[riot-elite] failed:", error?.message || error);
  process.exitCode = process.exitCode || 1;
});
