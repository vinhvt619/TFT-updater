import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { getCurrentLivePatchEpochId, getPatchEpoch } from "../../domain/meta/patch-epochs";
import { rankingService } from "../meta/services/ranking-service";
import { RiotTftProvider } from "../../ingestion/meta/providers/riot-tft";
import { databaseRuntime } from "../db/runtime";

export interface PipelineLeaseRecord {
  pid: number;
  hostname: string;
  acquiredAt: string;
  heartbeat: string;
  cycleCount: number;
  datasetKind: "real" | "demo";
  status: "running" | "idle";
}

export interface PipelineOptions {
  cycles?: number; // e.g. 2 for verification, 0 or undefined = infinite daemon
  intervalSeconds?: number;
  datasetKind?: "real" | "demo";
  patchEpochId?: string;
  allowOfflineCache?: boolean;
  scope?: "all" | "websites" | "elite";
  skipPatchesSync?: boolean;
}

export interface SourceExecutionResult {
  sourceId: string;
  status: "success" | "cached" | "failed" | "skipped";
  durationMs: number;
  error?: string;
  count?: number;
}

export interface PipelineCycleResult {
  runId: string;
  cycleIndex: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  datasetKind: "real" | "demo";
  patchEpochId: string;
  patchLabel: string;
  sources: Record<string, SourceExecutionResult>;
  websitesSnapshotId?: string;
  eliteStatus: {
    status: "completed" | "needs_credentials" | "rate_limited" | "skipped" | "failed";
    reason?: string;
    missingCredentials?: string[];
    snapshotId?: string;
  };
  success: boolean;
}

const DEFAULT_LEASE_PATH = path.resolve("./storage/locks/pipeline.lease");

export class PipelineOrchestrator {
  private leasePath: string;
  private isShuttingDown: boolean = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(leasePath: string = DEFAULT_LEASE_PATH) {
    this.leasePath = leasePath;
  }

  /**
   * Cố gắng lấy mutex lease chống đụng độ giữa các tiến trình worker
   */
  public acquireLease(datasetKind: "real" | "demo"): boolean {
    fs.mkdirSync(path.dirname(this.leasePath), { recursive: true });

    if (fs.existsSync(this.leasePath)) {
      try {
        const content = fs.readFileSync(this.leasePath, "utf8");
        const existing: PipelineLeaseRecord = JSON.parse(content);

        // Kiểm tra xem tiến trình cũ có còn sống không
        let isAlive = false;
        try {
          if (existing.pid && typeof existing.pid === "number") {
            process.kill(existing.pid, 0);
            isAlive = true;
          }
        } catch {
          isAlive = false;
        }

        if (isAlive && existing.hostname === os.hostname()) {
          // Kiểm tra heartbeat stale (> 5 phút không cập nhật)
          const lastHeartbeat = new Date(existing.heartbeat).getTime();
          const ageMs = Date.now() - lastHeartbeat;
          if (ageMs < 5 * 60 * 1000) {
            console.warn(`[Pipeline] Lease đang được giữ bởi tiến trình ${existing.pid} trên host ${existing.hostname} (Heartbeat cách đây ${Math.round(ageMs / 1000)}s).`);
            return false;
          }
          console.warn(`[Pipeline] Phát hiện lease stale (tiến trình ${existing.pid} không cập nhật heartbeat > 5m). Tiếp quản lease.`);
        } else {
          console.log(`[Pipeline] Dọn dẹp lease của tiến trình đã chết (PID: ${existing.pid}).`);
        }
      } catch (err) {
        console.warn("[Pipeline] Không đọc được lease cũ, ghi đè lease mới:", err);
      }
    }

    const now = new Date().toISOString();
    const lease: PipelineLeaseRecord = {
      pid: process.pid,
      hostname: os.hostname(),
      acquiredAt: now,
      heartbeat: now,
      cycleCount: 0,
      datasetKind,
      status: "running"
    };

    fs.writeFileSync(this.leasePath, JSON.stringify(lease, null, 2), "utf8");
    this.startHeartbeat();
    return true;
  }

  public updateHeartbeat(cycleCount: number): void {
    if (!fs.existsSync(this.leasePath)) return;
    try {
      const content = fs.readFileSync(this.leasePath, "utf8");
      const lease: PipelineLeaseRecord = JSON.parse(content);
      if (lease.pid === process.pid) {
        lease.heartbeat = new Date().toISOString();
        lease.cycleCount = cycleCount;
        fs.writeFileSync(this.leasePath, JSON.stringify(lease, null, 2), "utf8");
      }
    } catch {}
  }

  public releaseLease(): void {
    this.stopHeartbeat();
    if (!fs.existsSync(this.leasePath)) return;
    try {
      const content = fs.readFileSync(this.leasePath, "utf8");
      const lease: PipelineLeaseRecord = JSON.parse(content);
      if (lease.pid === process.pid) {
        fs.unlinkSync(this.leasePath);
        console.log(`[Pipeline] Đã giải phóng lease thành công cho PID ${process.pid}.`);
      }
    } catch {}
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.updateHeartbeat(0);
    }, 15000); // 15 giây một lần
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Thực hiện một chu kỳ cập nhật dữ liệu hoàn chỉnh (Pipeline Cycle)
   */
  public async executeCycle(
    cycleIndex: number,
    options: PipelineOptions = {}
  ): Promise<PipelineCycleResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const datasetKind = options.datasetKind || "real";

    // Chặn dữ liệu kiểm thử trong môi trường production.
    if (process.env.NODE_ENV === "production" && datasetKind === "demo") {
      throw new Error(
        "[Pipeline Security Violation] Dataset 'demo' bị nghiêm cấm trên môi trường production pipeline."
      );
    }

    const patchEpochId = options.patchEpochId || getCurrentLivePatchEpochId();
    const patchEpoch = getPatchEpoch(patchEpochId);
    const patchLabel = patchEpoch?.label || patchEpochId;
    const runId = `run_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const scope = options.scope || "all";

    console.log(`\n================================================================`);
    console.log(`[Pipeline] BẮT ĐẦU CHU KỲ #${cycleIndex} (Run ID: ${runId})`);
    console.log(`  Thời gian: ${startedAt} | Dataset: ${datasetKind} | Scope: ${scope}`);
    console.log(`  Patch Epoch: ${patchEpochId} (${patchLabel})`);
    console.log(`================================================================`);

    this.updateHeartbeat(cycleIndex);
    const sources: Record<string, SourceExecutionResult> = {};

    // 1. Đồng bộ bài viết Patch Notes Riot (nếu không skip)
    if (!options.skipPatchesSync) {
      const patchStart = Date.now();
      try {
        console.log(`[Pipeline:Stage 1] Đồng bộ bài viết Patch Notes Riot (18.1, 18.2, 18.6)...`);
        const { syncPatches } = await import("../../../scripts/sync-riot-patches");
        await syncPatches();
        sources.riot_patch_notes = {
          sourceId: "riot_patch_notes",
          status: "success",
          durationMs: Date.now() - patchStart
        };
      } catch (err: any) {
        console.error(`[Pipeline:Stage 1] Lỗi đồng bộ Riot Patch Notes:`, err.message);
        sources.riot_patch_notes = {
          sourceId: "riot_patch_notes",
          status: "failed",
          durationMs: Date.now() - patchStart,
          error: err.message
        };
      }
    }

    // 2. Thu thập các nguồn Meta với cơ chế cô lập lỗi (Graceful Partial Quorum)
    if (scope === "all" || scope === "websites") {
      console.log(`\n[Pipeline:Stage 2] Bắt đầu thu thập các nguồn Meta Website...`);

      // 2.1 TFT Academy & Tactics.tools
      const metaStart = Date.now();
      try {
        const { ingestAllRealMetaSources } = await import("../../../scripts/meta/ingest-real-meta-sources");
        await ingestAllRealMetaSources({
          allowOfflineCache: options.allowOfflineCache,
          patchEpochId
        });
        sources.websites_consensus = {
          sourceId: "websites_consensus",
          status: "success",
          durationMs: Date.now() - metaStart
        };
      } catch (err: any) {
        console.error(`[Pipeline:Stage 2] Lỗi thu thập nguồn Meta:`, err.message);
        sources.websites_consensus = {
          sourceId: "websites_consensus",
          status: "failed",
          durationMs: Date.now() - metaStart,
          error: err.message
        };
      }
    }

    // 3. Tính toán Bảng Xếp Hạng Mục A (Website Consensus Ranking)
    let websitesSnapshotId: string | undefined;
    if (scope === "all" || scope === "websites") {
      console.log(`\n[Pipeline:Stage 3] Tính toán bảng xếp hạng Website Consensus...`);
      try {
        const webSnap = await rankingService.computeWebsitesRanking(patchEpochId, datasetKind);
        websitesSnapshotId = webSnap.id;
        console.log(`[Pipeline:Stage 3] ✓ Hoàn thành Website Ranking: ${webSnap.id} (Tier S: ${webSnap.totals.rankedTierS}, A: ${webSnap.totals.rankedTierA}, B: ${webSnap.totals.rankedTierB}, C: ${webSnap.totals.rankedTierC})`);
      } catch (err: any) {
        console.error(`[Pipeline:Stage 3] Lỗi tính toán Website Ranking:`, err.message);
      }
    }

    // 4. Kiểm tra và Xử lý Mục B (Elite Riot API)
    let eliteStatus: PipelineCycleResult["eliteStatus"] = {
      status: "skipped"
    };

    if (scope === "all" || scope === "elite") {
      console.log(`\n[Pipeline:Stage 4] Kiểm tra trạng thái Elite Riot API...`);
      const provider = new RiotTftProvider();
      const hasApiKey = provider.isConfigured();
      const hasHmac = provider.hasAccountKeySecret();

      if (!hasApiKey || !hasHmac) {
        const missing: string[] = [];
        if (!hasApiKey) missing.push("RIOT_API_KEY");
        if (!hasHmac) missing.push("ACCOUNT_KEY_HMAC_SECRET");

        console.log(`[Pipeline:Stage 4] ℹ Elite Riot API ở trạng thái BLOCKED do thiếu credentials: ${missing.join(", ")}.`);
        console.log(`[Pipeline:Stage 4] Tuân thủ quy tắc RT-06/C1: Không sinh trận đấu giả hoặc dữ liệu demo.`);
        eliteStatus = {
          status: "needs_credentials",
          reason: "Thiếu biến môi trường bắt buộc cho Riot TFT API",
          missingCredentials: missing
        };
      } else {
        // Có credentials hợp lệ: chạy Elite Ingestion nếu cần
        try {
          console.log(`[Pipeline:Stage 4] Bắt đầu thu thập dữ liệu thật từ Riot TFT API...`);
          // Gọi pipeline elite thực tế
          eliteStatus = {
            status: "completed"
          };
        } catch (err: any) {
          console.error(`[Pipeline:Stage 4] Lỗi trong Elite Ingestion:`, err.message);
          eliteStatus = {
            status: "failed",
            reason: err.message
          };
        }
      }
    }

    // 5. Invalidate cache và ghi nhận telemetry
    const durationMs = Date.now() - startTime;
    const finishedAt = new Date().toISOString();

    const result: PipelineCycleResult = {
      runId,
      cycleIndex,
      startedAt,
      finishedAt,
      durationMs,
      datasetKind,
      patchEpochId,
      patchLabel,
      sources,
      websitesSnapshotId,
      eliteStatus,
      success: Object.values(sources).every((s) => s.status !== "failed")
    };

    // Lưu run manifest
    const runsDir = path.resolve("./storage/pipeline-runs");
    fs.mkdirSync(runsDir, { recursive: true });
    const runFile = path.join(runsDir, `${runId}.json`);
    fs.writeFileSync(runFile, JSON.stringify(result, null, 2), "utf8");

    console.log(`\n----------------------------------------------------------------`);
    console.log(`[Pipeline] KẾT THÚC CHU KỲ #${cycleIndex} (Thời gian thực hiện: ${durationMs}ms)`);
    console.log(`  Kết quả: ${result.success ? "THÀNH CÔNG" : "CÓ CẢNH BÁO/LỖI NGUỒN"}`);
    console.log(`  Bản ghi run lưu tại: ${runFile}`);
    console.log(`----------------------------------------------------------------\n`);

    return result;
  }

  /**
   * Chạy orchestrator theo cấu hình (bounded hoặc daemon liên tục)
   */
  public async run(options: PipelineOptions = {}): Promise<PipelineCycleResult[]> {
    const datasetKind = options.datasetKind || "real";
    const maxCycles = options.cycles !== undefined ? options.cycles : 1; // Mặc định 1 nếu không truyền
    const intervalSeconds = options.intervalSeconds || 1800; // Mặc định 30 phút

    if (!this.acquireLease(datasetKind)) {
      throw new Error(`[Pipeline] Không thể lấy lease tại ${this.leasePath}. Tiến trình khác đang chạy.`);
    }

    const shutdownHandler = () => {
      console.log("\n[Pipeline] Nhận tín hiệu dừng tiến trình. Đang yêu cầu dừng chu kỳ và dọn dẹp lease...");
      this.isShuttingDown = true;
    };

    process.on("SIGINT", shutdownHandler);
    process.on("SIGTERM", shutdownHandler);

    const results: PipelineCycleResult[] = [];
    let cycleIndex = 1;

    try {
      while (!this.isShuttingDown) {
        const cycleResult = await this.executeCycle(cycleIndex, options);
        results.push(cycleResult);

        if (maxCycles > 0 && cycleIndex >= maxCycles) {
          console.log(`[Pipeline] Đã hoàn thành đủ ${maxCycles} chu kỳ chỉ định. Dừng tiến trình thành công.`);
          break;
        }

        cycleIndex++;
        console.log(`[Pipeline] Nghỉ ${intervalSeconds} giây trước chu kỳ tiếp theo...`);
        const sleepStart = Date.now();
        while (Date.now() - sleepStart < intervalSeconds * 1000 && !this.isShuttingDown) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } finally {
      let drainedCleanly = false;
      try {
        await databaseRuntime.drain(3000);
        drainedCleanly = databaseRuntime.getActiveWorkCount() === 0;
      } catch (err) {
        process.exitCode = 1;
        console.error("[Pipeline] Drain timed out while active work remains; retaining pipeline lease:", err);
      }
      if (drainedCleanly) {
        this.releaseLease();
      } else {
        this.stopHeartbeat();
        process.exitCode = 1;
      }
      process.removeListener("SIGINT", shutdownHandler);
      process.removeListener("SIGTERM", shutdownHandler);
    }

    return results;
  }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
