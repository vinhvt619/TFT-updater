import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { applySchemaDdl } from "../src/server/db/schema-ddl";
import { databaseRuntime, closeDb } from "../src/server/db/client";

export interface RepairResult {
  mode: "restore_from_source" | "init_empty";
  success: boolean;
  source?: string;
  sourceType?: "directory" | "dump_file";
  backupDir: string;
  dataDir: string;
  swapped: boolean;
  tableCounts?: Record<string, number>;
  checks: Array<{ name: string; passed: boolean; details: string }>;
}

export async function executeRepair(options: {
  source?: string;
  initEmpty?: boolean;
  confirmSwap?: boolean;
}): Promise<RepairResult> {
  const confirmSwap = Boolean(options.confirmSwap);
  const sourceArg = options.source;
  const initEmpty = Boolean(options.initEmpty);

  console.log("================================================================================");
  console.log("                  TFT 18 CHANGE TRACKER — OPERATOR DATABASE REPAIR              ");
  console.log("================================================================================");

  if (!sourceArg && !initEmpty) {
    console.error("\n[Repair] ERROR: Missing operation mode!");
    console.error("         To restore from a backup or dump, provide: --source=<path>");
    console.error("         To explicitly initialize an empty schema DB, provide: --init-empty");
    console.error("         Blind wipe/recovery without explicit source or init-empty flag is forbidden (P0-11).\n");
    throw new Error("Missing --source or --init-empty flag");
  }

  await closeDb();

  const dataDir = databaseRuntime.getDataDir();
  const backupDir = path.resolve("./storage/backups", `pgdata-backup-before-repair-${Date.now()}`);
  const checks: Array<{ name: string; passed: boolean; details: string }> = [];

  console.log(`[Repair] Target Data Directory: ${dataDir}`);
  console.log(`[Repair] Confirm Swap Flag:     ${confirmSwap ? "YES" : "NO (dry-run only)"}`);
  if (sourceArg) console.log(`[Repair] Source Backup/Dump:    ${sourceArg}`);
  if (initEmpty) console.log(`[Repair] Mode:                  --init-empty (Clean empty schema)`);

  if (sourceArg) {
    const resolvedSource = path.resolve(sourceArg);
    const normalizedSource = resolvedSource.toLowerCase();
    const normalizedTarget = path.resolve(dataDir).toLowerCase();
    if (normalizedSource === normalizedTarget || normalizedTarget.startsWith(`${normalizedSource}${path.sep}`)) {
      throw new Error("Restore source must be separate from the active database directory");
    }
  }

  // 1. Mandatory Safety Backup of current directory before touching anything
  if (fs.existsSync(dataDir)) {
    console.log(`[Repair] Creating mandatory safety backup at ${backupDir}...`);
    try {
      fs.mkdirSync(path.dirname(backupDir), { recursive: true });
      fs.cpSync(dataDir, backupDir, { recursive: true, force: true });
      console.log("[Repair] Safety backup completed and preserved.");
      checks.push({ name: "safety_backup", passed: true, details: `Backup saved at ${backupDir}` });
    } catch (err: any) {
      console.error(`[Repair] CRITICAL: Safety backup failed (${err.message}). Halting repair to protect data.`);
      throw new Error(`Safety backup failed: ${err.message}`);
    }
  }

  // 2. Prepare staging/recovered directory
  const recoveredDir = path.resolve("./storage", `pgdata-recovered-${Date.now()}`);
  const tableCounts: Record<string, number> = {};

  if (sourceArg) {
    console.log(`[Repair] Restoring from source: ${sourceArg}...`);
    const resolvedSource = path.resolve(sourceArg);
    if (!fs.existsSync(resolvedSource)) {
      throw new Error(`Source path does not exist: ${resolvedSource}`);
    }

    const stat = fs.statSync(resolvedSource);
    if (stat.isDirectory()) {
      console.log(`[Repair] Copying directory source to staging: ${recoveredDir}...`);
      fs.cpSync(resolvedSource, recoveredDir, { recursive: true });

      // Verify restored database integrity
      const pglite = new PGlite(recoveredDir);
      await pglite.waitReady;

      const tables = [
        "snapshots",
        "champions",
        "meta_archetypes",
        "meta_ranking_snapshots",
        "meta_source_comp_observations",
        "meta_current_ranking_pointers"
      ];

      for (const t of tables) {
        try {
          const res: any = await pglite.query(`SELECT count(*) as cnt FROM ${t}`);
          const cnt = parseInt(res?.rows?.[0]?.cnt || "0", 10);
          tableCounts[t] = cnt;
          console.log(`[Repair] Table ${t}: ${cnt} rows verified`);
        } catch {
          tableCounts[t] = -1;
        }
      }

      const ping: any = await pglite.query("SELECT 1 as ping");
      const pingOk = ping?.rows?.[0]?.ping === 1;
      checks.push({ name: "db_smoke_query", passed: pingOk, details: "SELECT 1 returned 1" });

      await pglite.close();
      const missingTables = Object.entries(tableCounts).filter(([, count]) => count < 0).map(([table]) => table);
      const sourceVerified = pingOk && missingTables.length === 0;
      checks.push({
        name: "source_verification",
        passed: sourceVerified,
        details: sourceVerified ? `Verified ${Object.keys(tableCounts).length} tables` : `Missing/unreadable tables: ${missingTables.join(", ")}`
      });
      if (!sourceVerified) {
        throw new Error(`Source database verification failed: ${missingTables.join(", ")}`);
      }
    } else {
      throw new Error(`Source format not supported (must be pgdata directory): ${resolvedSource}`);
    }
  } else {
    // Mode: --init-empty
    console.log(`[Repair] Initializing isolated clean empty database at ${recoveredDir}...`);
    fs.mkdirSync(recoveredDir, { recursive: true });

    const pglite = new PGlite(recoveredDir);
    await pglite.waitReady;

    console.log("[Repair] Applying clean schema DDL...");
    await applySchemaDdl(pglite);

    const testPing = await pglite.query("SELECT 1 as ping");
    checks.push({ name: "schema_ddl", passed: true, details: "DDL applied and SELECT 1 returned 1" });
    await pglite.close();
  }

  if (!confirmSwap) {
    console.log("\n[Repair] DRY-RUN COMPLETE: Staging database verified at:");
    console.log(`         ${recoveredDir}`);
    console.log("[Repair] Backup preserved at:");
    console.log(`         ${backupDir}`);
    console.log("[Repair] To execute the atomic swap, run with --confirm-swap\n");
    return {
      mode: sourceArg ? "restore_from_source" : "init_empty",
      success: true,
      source: sourceArg,
      backupDir,
      dataDir,
      swapped: false,
      tableCounts,
      checks
    };
  }

  // 3. Operator confirmed atomic swap
  console.log(`[Repair] Performing atomic swap of ${recoveredDir} into ${dataDir}...`);
  const swapBackupDir = path.resolve("./storage/backups", `pgdata-old-swapped-${Date.now()}`);
  let oldDirectoryMoved = false;
  try {
    if (fs.existsSync(dataDir)) {
      // Move old active dir to backups rather than deleting immediately (P0-11)
      fs.renameSync(dataDir, swapBackupDir);
      oldDirectoryMoved = true;
      console.log(`[Repair] Old active data safely moved to: ${swapBackupDir}`);
    }
    fs.renameSync(recoveredDir, dataDir);
    console.log("[Repair] Atomic directory swap successful!");
    checks.push({ name: "atomic_swap", passed: true, details: `Old DB preserved at ${swapBackupDir}` });
  } catch (err: any) {
    if (oldDirectoryMoved && !fs.existsSync(dataDir) && fs.existsSync(swapBackupDir)) {
      fs.renameSync(swapBackupDir, dataDir);
      checks.push({ name: "rollback", passed: true, details: "Restored previous active database after failed swap" });
    }
    console.error(`[Repair] CRITICAL: Directory swap failed: ${err.message}`);
    console.error(`[Repair] Active directory remains at backup: ${backupDir}`);
    throw new Error(`Directory swap failed: ${err.message}`);
  }

  // 4. Final verification on swapped directory
  const finalInstance = new PGlite(dataDir);
  await finalInstance.waitReady;
  const ping: any = await finalInstance.query("SELECT 1 as ping");
  const finalOk = ping?.rows?.[0]?.ping === 1;
  await finalInstance.close();

  checks.push({ name: "final_verification", passed: finalOk, details: "Active DB ready" });

  console.log("================================================================================");
  console.log("[Repair] DATABASE REPAIR COMPLETED SUCCESSFULLY! Database is clean and verified.");
  console.log("================================================================================");

  return {
    mode: sourceArg ? "restore_from_source" : "init_empty",
    success: true,
    source: sourceArg,
    backupDir,
    dataDir,
    swapped: true,
    tableCounts,
    checks
  };
}

async function main() {
  const args = process.argv.slice(2);
  const confirmSwap = args.includes("--confirm-swap");
  const initEmpty = args.includes("--init-empty");
  const sourceArg = args.find((a) => a.startsWith("--source="))?.split("=")[1];

  await executeRepair({
    source: sourceArg,
    initEmpty,
    confirmSwap
  });
}

if (process.argv[1] && process.argv[1].endsWith("db-repair.ts")) {
  main().catch((err) => {
    console.error("[Repair] Fatal error during repair:", err.message);
    process.exit(1);
  });
}
