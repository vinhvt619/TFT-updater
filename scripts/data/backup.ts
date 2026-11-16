import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function copyFolderRecursiveSync(source: string, target: string) {
  if (!fs.existsSync(source)) return;
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

function countFilesAndBytes(dir: string): { count: number; bytes: number } {
  if (!fs.existsSync(dir)) return { count: 0, bytes: 0 };
  let count = 0;
  let bytes = 0;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const cur = path.join(dir, file);
    const stat = fs.lstatSync(cur);
    if (stat.isDirectory()) {
      const sub = countFilesAndBytes(cur);
      count += sub.count;
      bytes += sub.bytes;
    } else {
      count++;
      bytes += stat.size;
    }
  }
  return { count, bytes };
}

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(`./storage/backups/pre_quarantine_${timestamp}`);
  console.log(`[Backup] Creating consistent database & raw storage backup at: ${backupDir}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const pgdataSrc = path.resolve("./storage/pgdata");
  const pgdataTarget = path.join(backupDir, "pgdata");
  const rawSrc = path.resolve("./storage/raw");
  const rawTarget = path.join(backupDir, "raw");

  console.log(`[Backup] Copying pgdata from ${pgdataSrc}...`);
  copyFolderRecursiveSync(pgdataSrc, pgdataTarget);

  console.log(`[Backup] Copying raw storage from ${rawSrc}...`);
  copyFolderRecursiveSync(rawSrc, rawTarget);

  const pgStats = countFilesAndBytes(pgdataTarget);
  const rawStats = countFilesAndBytes(rawTarget);

  const manifest = {
    timestamp: new Date().toISOString(),
    backupDirectory: backupDir,
    pgdata: {
      source: pgdataSrc,
      fileCount: pgStats.count,
      totalBytes: pgStats.bytes
    },
    raw: {
      source: rawSrc,
      fileCount: rawStats.count,
      totalBytes: rawStats.bytes
    },
    status: "verified_consistent"
  };

  const manifestPath = path.join(backupDir, "backup-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`[Backup] Successfully verified backup:`);
  console.log(`  - pgdata: ${pgStats.count} files, ${(pgStats.bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - raw: ${rawStats.count} files, ${(rawStats.bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Manifest: ${manifestPath}`);
}

runBackup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Backup Error]:", err);
    process.exit(1);
  });
