import { getDb } from "../server/db/client";
import { ingestionRuns, observations, sources } from "../server/db/schema";
import { eq } from "drizzle-orm";
import { communityDragonAdapter } from "./adapters/community-dragon";
import { rawStorage } from "../server/storage/raw-storage";
import { snapshotService } from "../server/services/snapshot-service";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { env } from "../server/config";

export async function ingestOnce(sourceId: string): Promise<{ runId: string; status: string; diagnostics: any }> {
  const db = await getDb();
  const runId = `run_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

  // 1. Read sources config
  const configPath = path.resolve(env.SOURCES_CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Sources configuration file not found at ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const sourceConfig = config.sources?.find((s: any) => s.id === sourceId);

  if (!sourceConfig) {
    throw new Error(`Source '${sourceId}' not found in configuration`);
  }

  // 2. Ensure source exists in sources table
  await db.insert(sources).values({
    id: sourceConfig.id,
    provider: sourceConfig.provider,
    channel: sourceConfig.channel,
    url: sourceConfig.endpoint,
    enabled: sourceConfig.enabled ?? true,
    config: sourceConfig
  }).onConflictDoNothing();

  // 3. Start ingestion run
  await db.insert(ingestionRuns).values({
    id: runId,
    sourceId,
    status: "running",
    startedAt: new Date(),
    diagnostics: {}
  });

  try {
    // 3. Adapter dispatch
    const adapter = communityDragonAdapter;

    console.log(`[Ingest] Probing source: ${sourceId}...`);
    const probeRes = await adapter.probe(sourceConfig);

    if (!probeRes.reachable) {
      const errCode = "source_http_error";
      await db.update(ingestionRuns).set({
        status: "failed",
        finishedAt: new Date(),
        errorCode: errCode,
        diagnostics: probeRes.diagnostics
      }).where(eq(ingestionRuns.id, runId));

      return { runId, status: "failed", diagnostics: { errorCode: errCode, ...probeRes.diagnostics } };
    }

    console.log(`[Ingest] Fetching payload from ${sourceConfig.endpoint}...`);
    const fetchRes = await adapter.fetch(sourceConfig);

    // Save raw artifact
    const artifact = rawStorage.putIfAbsent(fetchRes.rawBuffer);

    console.log(`[Ingest] Normalizing payload...`);
    const normRes = await adapter.normalize(fetchRes.rawBuffer, sourceConfig);

    if (!normRes.success) {
      await db.update(ingestionRuns).set({
        status: "failed",
        finishedAt: new Date(),
        errorCode: normRes.errorCode || "normalization_failed",
        diagnostics: normRes.diagnostics
      }).where(eq(ingestionRuns.id, runId));

      return { runId, status: "failed", diagnostics: normRes.diagnostics };
    }

    // Success: import envelope with accurate provenance
    const envelope = {
      importSchemaVersion: "1" as const,
      idempotencyKey: `auto_${sourceId}_${artifact.sha256.slice(0, 12)}`,
      release: {
        channel: sourceConfig.channel,
        patchLabel: `${sourceConfig.name} (Quan sát: ${new Date().toLocaleDateString("vi-VN")})`,
        buildId: null, // Không lấy SHA hash thay thế cho publisher buildId (Quy tắc F6)
        effectiveAt: null, // Thời điểm triển khai chưa xác định từ static payload; lưu là null
        timePrecision: "unknown" as const,
        timeBasis: "observation" as const,
        occurrenceKey: `auto_${sourceId}_${Date.now()}`
      },
      payload: normRes.payload!,
      evidence: normRes.evidence,
      notes: [`Thu thập tự động từ ${sourceConfig.endpoint}. Lần đầu quan sát lúc ${new Date().toISOString()}`]
    };

    const importRes = await snapshotService.importEnvelope(envelope, sourceConfig.autoPublish);

    await db.update(ingestionRuns).set({
      status: "success",
      finishedAt: new Date(),
      diagnostics: {
        snapshotId: importRes.snapshotId,
        releaseId: importRes.releaseId,
        isNew: importRes.isNew,
        championsCount: normRes.payload!.champions.length
      }
    }).where(eq(ingestionRuns.id, runId));

    return {
      runId,
      status: "success",
      diagnostics: {
        snapshotId: importRes.snapshotId,
        releaseId: importRes.releaseId
      }
    };
  } catch (err: any) {
    await db.update(ingestionRuns).set({
      status: "failed",
      finishedAt: new Date(),
      errorCode: "internal_ingest_error",
      diagnostics: { error: err.message }
    }).where(eq(ingestionRuns.id, runId));

    return { runId, status: "failed", diagnostics: { error: err.message } };
  }
}
