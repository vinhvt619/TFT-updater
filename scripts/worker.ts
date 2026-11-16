import { pipelineOrchestrator, PipelineOptions } from "../src/server/pipeline/orchestrator";
import { getCurrentLivePatchEpochId } from "../src/domain/meta/patch-epochs";

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  let cycles = 1; // Mặc định chạy 1 chu kỳ nếu không chỉ định
  let intervalSeconds = 1800; // 30 phút
  let datasetKind: "real" | "demo" = "real";
  let patchEpochId = getCurrentLivePatchEpochId();
  let scope: "all" | "websites" | "elite" = "all";
  let allowOfflineCache = false;
  let skipPatchesSync = false;

  for (const arg of args) {
    if (arg === "--once") {
      cycles = 1;
    } else if (arg.startsWith("--cycles=")) {
      const val = parseInt(arg.split("=")[1], 10);
      if (!isNaN(val) && val >= 0) cycles = val;
    } else if (arg.startsWith("--interval=")) {
      const val = parseInt(arg.split("=")[1], 10);
      if (!isNaN(val) && val > 0) intervalSeconds = val;
    } else if (arg.startsWith("--dataset=")) {
      const val = arg.split("=")[1];
      if (val === "real" || val === "demo") datasetKind = val;
    } else if (arg.startsWith("--epoch=")) {
      patchEpochId = arg.split("=")[1];
    } else if (arg.startsWith("--scope=")) {
      const val = arg.split("=")[1];
      if (val === "websites" || val === "elite" || val === "all") scope = val;
    } else if (arg === "--allow-offline-cache") {
      allowOfflineCache = true;
    } else if (arg === "--skip-patches-sync") {
      skipPatchesSync = true;
    }
  }

  return {
    cycles,
    intervalSeconds,
    datasetKind,
    patchEpochId,
    scope,
    allowOfflineCache,
    skipPatchesSync
  };
}

async function main() {
  const options = parseArgs();

  console.log("==========================================================");
  console.log("  TFT MÙA 18 - UNIFIED AUTOMATED PIPELINE WORKER          ");
  console.log(`  Chế độ: ${options.cycles === 0 ? "DAEMON LIÊN TỤC" : `GIỚI HẠN ${options.cycles} CHU KỲ`}`);
  console.log(`  Chu kỳ lặp: Mỗi ${options.intervalSeconds}s | Scope: ${options.scope}`);
  console.log(`  Dataset: ${options.datasetKind} | Epoch: ${options.patchEpochId}`);
  console.log(`  Offline Cache Fallback: ${options.allowOfflineCache ? "BẬT" : "TẮT"}`);
  console.log("==========================================================");

  try {
    const results = await pipelineOrchestrator.run(options);
    console.log(`[Worker] Toàn bộ ${results.length} chu kỳ hoàn tất thành công.`);
    const { closeDb } = await import("../src/server/db/client");
    await closeDb();
    process.exit(0);
  } catch (err: any) {
    console.error("[Worker] [LỖI NGHIÊM TRỌNG]:", err.message);
    const { closeDb } = await import("../src/server/db/client");
    await closeDb();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[Worker] Lỗi không xử lý được:", err);
  process.exit(1);
});
