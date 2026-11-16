import { rankingService } from "../../src/server/meta/services/ranking-service";
import { getCurrentLivePatchEpochId } from "../../src/domain/meta/patch-epochs";
import fs from "node:fs";
import path from "node:path";

interface WorkerOptions {
  once: boolean;
  intervalSeconds: number;
  scope: "all" | "websites" | "elite";
  datasetKind: "real" | "demo";
  patchEpochId: string;
}

function parseArgs(): WorkerOptions {
  const args = process.argv.slice(2);
  let once = false;
  let intervalSeconds = 3600; // Mặc định 1 giờ
  let scope: "all" | "websites" | "elite" = "all";
  let datasetKind: "real" | "demo" = "demo";
  let patchEpochId = getCurrentLivePatchEpochId();

  for (const arg of args) {
    if (arg === "--once") once = true;
    else if (arg.startsWith("--interval=")) {
      const val = parseInt(arg.split("=")[1], 10);
      if (!isNaN(val) && val > 0) intervalSeconds = val;
    } else if (arg.startsWith("--scope=")) {
      const val = arg.split("=")[1];
      if (val === "websites" || val === "elite" || val === "all") scope = val;
    } else if (arg.startsWith("--dataset=")) {
      const val = arg.split("=")[1];
      if (val === "real" || val === "demo") datasetKind = val;
    } else if (arg.startsWith("--epoch=")) {
      patchEpochId = arg.split("=")[1];
    }
  }

  return { once, intervalSeconds, scope, datasetKind, patchEpochId };
}

/**
 * Thực hiện một chu kỳ tính toán xếp hạng hoàn chỉnh (Pipeline Cycle)
 */
async function executeRankingCycle(opts: WorkerOptions): Promise<{
  websitesSnapshotId?: string;
  eliteSnapshotId?: string;
  durationMs: number;
}> {
  const startTime = Date.now();
  console.log(`\n[Worker ${new Date().toISOString()}] Bắt đầu chu kỳ xếp hạng (Scope: ${opts.scope}, Epoch: ${opts.patchEpochId}, Dataset: ${opts.datasetKind})`);

  let websitesSnapshotId: string | undefined;
  let eliteSnapshotId: string | undefined;

  // 1. Tính toán Mục A (Tổng hợp Website)
  if (opts.scope === "all" || opts.scope === "websites") {
    console.log("[Worker] Đang tính toán bảng xếp hạng Mục A (Website Consensus)...");
    const webSnap = await rankingService.computeWebsitesRanking(opts.patchEpochId, opts.datasetKind);
    websitesSnapshotId = webSnap.id;
    console.log(`[Worker] ✓ Mục A hoàn thành: ${webSnap.id} (Tier S: ${webSnap.totals.rankedTierS}, A: ${webSnap.totals.rankedTierA}, B: ${webSnap.totals.rankedTierB}, C: ${webSnap.totals.rankedTierC})`);
  }

  // 2. Tính toán Mục B (Cao thủ khu vực)
  if (opts.scope === "all" || opts.scope === "elite") {
    console.log("[Worker] Đang tính toán bảng xếp hạng Mục B (Elite Regional & Global)...");
    for (const reg of ["KR", "VN", "NA", "EUW"]) {
      const regSnap = await rankingService.computeEliteRanking(reg, opts.patchEpochId, 72, opts.datasetKind);
      console.log(`[Worker]   - Khu vực ${reg}: ${regSnap.id}`);
    }

    const globalSnap = await rankingService.computeEliteRanking("all", opts.patchEpochId, 72, opts.datasetKind);
    eliteSnapshotId = globalSnap.id;
    console.log(`[Worker] ✓ Mục B hoàn thành: ${globalSnap.id} (Macro-Average Global S: ${globalSnap.totals.rankedTierS}, A: ${globalSnap.totals.rankedTierA})`);
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Worker] Chu kỳ hoàn tất trong ${durationMs}ms`);
  return { websitesSnapshotId, eliteSnapshotId, durationMs };
}

async function main() {
  const opts = parseArgs();
  console.log("==========================================================");
  console.log("  TFT MÙA 18 - META COMPS BACKGROUND WORKER               ");
  console.log(`  Chế độ: ${opts.once ? "CHẠY MỘT LẦN (--once)" : `ĐỊNH KỲ (Mỗi ${opts.intervalSeconds}s)`}`);
  console.log(`  Phạm vi: ${opts.scope} | Dataset: ${opts.datasetKind} | Epoch: ${opts.patchEpochId}`);
  console.log("==========================================================");

  if (opts.once) {
    try {
      await executeRankingCycle(opts);
      console.log("[Worker] Tác vụ chạy một lần kết thúc thành công.");
      process.exit(0);
    } catch (err) {
      console.error("[Worker] [LỖI NGHIÊM TRỌNG] Chu kỳ xếp hạng thất bại:", err);
      // Ném lỗi và thoát với mã khác 0 theo yêu cầu R5
      process.exit(1);
    }
  } else {
    // Chế độ daemon / recurring loop
    let isRunning = false;
    const lockPath = path.resolve("./storage/locks/meta-ranking-worker.lock");

    const acquireLock = (): boolean => {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
      try {
        const fd = fs.openSync(lockPath, "wx");
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), "utf8");
        fs.closeSync(fd);
        return true;
      } catch (error: any) {
        if (error?.code !== "EEXIST") throw error;
        // A crashed worker must not block future runs forever. Remove only a
        // lock whose recorded process is no longer alive.
        try {
          const record = JSON.parse(fs.readFileSync(lockPath, "utf8"));
          if (record?.pid && record.pid !== process.pid) {
            try {
              process.kill(Number(record.pid), 0);
              return false;
            } catch {
              fs.unlinkSync(lockPath);
              const fd = fs.openSync(lockPath, "wx");
              fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), "utf8");
              fs.closeSync(fd);
              return true;
            }
          }
        } catch {}
        return false;
      }
    };

    const releaseLock = () => {
      try {
        const record = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        if (record?.pid === process.pid) fs.unlinkSync(lockPath);
      } catch {}
    };

    const runLoop = async () => {
      if (isRunning) {
        console.log("[Worker] Chu kỳ trước chưa kết thúc, bỏ qua lần kích hoạt này.");
        return;
      }
      if (!acquireLock()) {
        console.log("[Worker] Một tiến trình khác đang giữ lock; bỏ qua lần kích hoạt này.");
        return;
      }
      isRunning = true;
      try {
        await executeRankingCycle(opts);
      } catch (err) {
        console.error(`[Worker] [CẢNH BÁO] Lỗi trong chu kỳ lúc ${new Date().toISOString()}:`, err);
      } finally {
        isRunning = false;
        releaseLock();
      }
    };

    // Chạy chu kỳ đầu tiên ngay lập tức
    await runLoop();

    // Thiết lập vòng lặp định kỳ
    const timer = setInterval(runLoop, opts.intervalSeconds * 1000);

    const shutdown = () => {
      console.log("\n[Worker] Đang dừng worker an toàn...");
      clearInterval(timer);
      releaseLock();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
