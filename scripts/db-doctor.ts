import fs from "node:fs";
import path from "node:path";
import { databaseRuntime, checkDbHealth, closeDb } from "../src/server/db/client";
import { sql } from "drizzle-orm";

interface DoctorReport {
  timestamp: string;
  nodeVersion: string;
  platform: string;
  dataDir: string;
  dirExists: boolean;
  dirWritable: boolean;
  lockStatus: {
    pidFileExists: boolean;
    recordedPid: number | null;
    pidAlive: boolean;
    socketLocksCount: number;
  };
  walStatus: {
    walDirExists: boolean;
    walFileCount: number;
    walTotalBytes: number;
  };
  healthCheck: {
    healthy: boolean;
    engine: string;
    pingSuccess: boolean;
    error?: string;
  };
  tableStats: Record<string, number>;
  overallStatus: "HEALTHY" | "CORRUPTED" | "STALE_LOCKS" | "NOT_INITIALIZED";
}

async function runDoctor() {
  console.log("================================================================================");
  console.log("                  TFT 18 CHANGE TRACKER — DATABASE DOCTOR                      ");
  console.log("================================================================================");

  const dataDir = databaseRuntime.getDataDir();
  const report: DoctorReport = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    dataDir,
    dirExists: false,
    dirWritable: false,
    lockStatus: {
      pidFileExists: false,
      recordedPid: null,
      pidAlive: false,
      socketLocksCount: 0
    },
    walStatus: {
      walDirExists: false,
      walFileCount: 0,
      walTotalBytes: 0
    },
    healthCheck: {
      healthy: false,
      engine: "unknown",
      pingSuccess: false
    },
    tableStats: {},
    overallStatus: "NOT_INITIALIZED"
  };

  // 1. Check Directory
  if (fs.existsSync(dataDir)) {
    report.dirExists = true;
    try {
      const testFile = path.join(dataDir, `.doctor-write-test-${Date.now()}`);
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      report.dirWritable = true;
    } catch {
      report.dirWritable = false;
    }
  }

  // 2. Check Locks
  const pidPath = path.join(dataDir, "postmaster.pid");
  if (fs.existsSync(pidPath)) {
    report.lockStatus.pidFileExists = true;
    try {
      const content = fs.readFileSync(pidPath, "utf8");
      const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        const pid = parseInt(lines[0], 10);
        report.lockStatus.recordedPid = pid;
        try {
          process.kill(pid, 0);
          report.lockStatus.pidAlive = true;
        } catch {
          report.lockStatus.pidAlive = false;
        }
      }
    } catch {}
  }

  if (fs.existsSync(dataDir)) {
    try {
      const files = fs.readdirSync(dataDir);
      report.lockStatus.socketLocksCount = files.filter(
        (f) => f.startsWith(".s.PGSQL.") && f.includes(".lock")
      ).length;
    } catch {}
  }

  // 3. Check WAL
  const walDir = path.join(dataDir, "pg_wal");
  if (fs.existsSync(walDir)) {
    report.walStatus.walDirExists = true;
    try {
      const walFiles = fs.readdirSync(walDir);
      report.walStatus.walFileCount = walFiles.length;
      let totalBytes = 0;
      for (const wf of walFiles) {
        try {
          totalBytes += fs.statSync(path.join(walDir, wf)).size;
        } catch {}
      }
      report.walStatus.walTotalBytes = totalBytes;
    } catch {}
  }

  // 4. Test Connectivity & Ping
  const health = await checkDbHealth();
  report.healthCheck.healthy = health.healthy;
  report.healthCheck.engine = health.engine;
  report.healthCheck.error = health.error;

  if (health.healthy) {
    try {
      const db = await databaseRuntime.getDb();
      const ping = await db.execute(sql.raw("SELECT 1 as val"));
      if (ping && ping.rows && ping.rows.length > 0) {
        report.healthCheck.pingSuccess = true;
      }

      // Check key tables
      const keyTables = [
        "releases",
        "snapshots",
        "meta_archetypes",
        "meta_source_comp_observations",
        "meta_ranking_snapshots"
      ];
      for (const t of keyTables) {
        try {
          const res = await db.execute(sql.raw(`SELECT count(*) as c FROM ${t}`));
          report.tableStats[t] = parseInt(res.rows[0].c, 10);
        } catch (e: any) {
          report.tableStats[t] = -1;
        }
      }
    } catch (err: any) {
      report.healthCheck.pingSuccess = false;
      report.healthCheck.error = err.message;
    }
  }

  // 5. Evaluate Overall Status
  if (report.healthCheck.pingSuccess) {
    report.overallStatus = "HEALTHY";
  } else if (report.lockStatus.pidFileExists && !report.lockStatus.pidAlive) {
    report.overallStatus = "STALE_LOCKS";
  } else if (report.dirExists) {
    report.overallStatus = "CORRUPTED";
  } else {
    report.overallStatus = "NOT_INITIALIZED";
  }

  // Display summary
  console.log(`[Doctor] Data Directory:     ${report.dataDir}`);
  console.log(`[Doctor] Directory Exists:   ${report.dirExists ? "YES" : "NO"}`);
  console.log(`[Doctor] Directory Writable: ${report.dirWritable ? "YES" : "NO"}`);
  console.log(`[Doctor] Lock PID File:      ${report.lockStatus.pidFileExists ? `PID ${report.lockStatus.recordedPid} (Alive: ${report.lockStatus.pidAlive})` : "None"}`);
  console.log(`[Doctor] Socket Locks:       ${report.lockStatus.socketLocksCount}`);
  console.log(`[Doctor] WAL Files:          ${report.walStatus.walFileCount} (${(report.walStatus.walTotalBytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`[Doctor] DB Engine:          ${report.healthCheck.engine}`);
  console.log(`[Doctor] Ping Test:          ${report.healthCheck.pingSuccess ? "SUCCESS (SELECT 1 OK)" : "FAILED (" + (report.healthCheck.error || "unknown") + ")"}`);
  console.log("[Doctor] Table Statistics:");
  for (const [tbl, cnt] of Object.entries(report.tableStats)) {
    console.log(`  - ${tbl.padEnd(30)}: ${cnt >= 0 ? cnt + " rows" : "TABLE MISSING"}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`[Doctor] OVERALL STATUS:     ${report.overallStatus}`);
  console.log("================================================================================");

  await closeDb();

  if (report.overallStatus !== "HEALTHY") {
    console.error("[Doctor] Database requires attention or repair. Run 'npm run db:repair' if needed.");
    process.exit(1);
  } else {
    console.log("[Doctor] Database is completely healthy and operational.");
    process.exit(0);
  }
}

runDoctor().catch((err) => {
  console.error("[Doctor] Unhandled exception:", err);
  process.exit(1);
});
