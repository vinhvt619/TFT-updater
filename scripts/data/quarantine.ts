import fs from "node:fs";
import path from "node:path";
import { getDb } from "../../src/server/db/client";
import { sql } from "drizzle-orm";
import { AuditManifest, AuditFinding } from "./audit";

export interface QuarantineReport {
  appliedAt: string;
  isDryRun: boolean;
  manifestPath: string;
  quarantinedCounts: Record<string, number>;
  retractedDependencies: {
    diffCacheCleared: number;
    rankingSnapshotsQuarantined: number;
  };
  details: {
    recordId: string;
    table: string;
    reason: string;
  }[];
}

export async function runQuarantine(options: {
  manifestPath?: string;
  apply?: boolean;
}): Promise<QuarantineReport> {
  const isApply = options.apply === true;
  const manifestFile = options.manifestPath || path.resolve("./storage/audit-manifest.json");

  console.log(`[Quarantine] Mode: ${isApply ? "APPLY (Ghi vào DB)" : "DRY-RUN (Chỉ kiểm tra, không ghi DB)"}`);
  console.log(`[Quarantine] Reading audit manifest from: ${manifestFile}`);

  if (!fs.existsSync(manifestFile)) {
    throw new Error(`Không tìm thấy audit manifest tại: ${manifestFile}. Hãy chạy pnpm data:audit trước.`);
  }

  const manifest: AuditManifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const db = await getDb();

  const quarantinedCounts: Record<string, number> = {};
  const details: { recordId: string; table: string; reason: string }[] = [];
  let diffCacheCleared = 0;
  let rankingSnapshotsQuarantined = 0;

  const quarantinedSnapshotIds = new Set<string>();

  for (const finding of manifest.findings) {
    quarantinedCounts[finding.table] = (quarantinedCounts[finding.table] || 0) + 1;
    details.push({
      recordId: finding.id,
      table: finding.table,
      reason: finding.reason
    });

    if (finding.table === "snapshots") {
      quarantinedSnapshotIds.add(finding.id);
    }
  }

  if (isApply) {
    console.log(`[Quarantine] Applying quarantine status to ${manifest.findings.length} records...`);

    // 1. Quarantining snapshots
    for (const finding of manifest.findings.filter((f) => f.table === "snapshots")) {
      await db.execute(
        sql.raw(`UPDATE snapshots SET status = 'quarantined', reason = '${finding.reason.replace(/'/g, "''")}' WHERE id = '${finding.id}'`)
      );
      await db.execute(
        sql.raw(`INSERT INTO quarantine_records (id, table_name, record_id, severity, reason, manifest_path, quarantined_at)
                 VALUES ('qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}', 'snapshots', '${finding.id}', '${finding.severity}', '${finding.reason.replace(/'/g, "''")}', '${manifestFile.replace(/\\/g, "/")}', NOW())`)
      );
      await db.execute(
        sql.raw(`INSERT INTO audit_log (id, actor, action, target_id, reason, created_at)
                 VALUES ('al_${Date.now()}_${Math.random().toString(36).slice(2, 8)}', 'system:quarantine', 'quarantine', '${finding.id}', '${finding.reason.replace(/'/g, "''")}', NOW())`)
      );
    }

    // 2. Quarantining meta_matches
    for (const finding of manifest.findings.filter((f) => f.table === "meta_matches")) {
      await db.execute(
        sql.raw(`UPDATE meta_matches SET status = 'quarantined', quarantine_reason = '${finding.reason.replace(/'/g, "''")}' WHERE match_key = '${finding.id}'`)
      );
      await db.execute(
        sql.raw(`INSERT INTO quarantine_records (id, table_name, record_id, severity, reason, manifest_path, quarantined_at)
                 VALUES ('qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}', 'meta_matches', '${finding.id}', '${finding.severity}', '${finding.reason.replace(/'/g, "''")}', '${manifestFile.replace(/\\/g, "/")}', NOW())`)
      );
    }

    // 3. Quarantining meta_source_comp_observations
    for (const finding of manifest.findings.filter((f) => f.table === "meta_source_comp_observations")) {
      await db.execute(
        sql.raw(`UPDATE meta_source_comp_observations SET status = 'quarantined', quarantine_reason = '${finding.reason.replace(/'/g, "''")}' WHERE id = '${finding.id}'`)
      );
      await db.execute(
        sql.raw(`INSERT INTO quarantine_records (id, table_name, record_id, severity, reason, manifest_path, quarantined_at)
                 VALUES ('qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}', 'meta_source_comp_observations', '${finding.id}', '${finding.severity}', '${finding.reason.replace(/'/g, "''")}', '${manifestFile.replace(/\\/g, "/")}', NOW())`)
      );
    }

    // 4. Quarantining meta_ranking_snapshots (dependent on fake matches or fake observations)
    for (const finding of manifest.findings.filter((f) => f.table === "meta_ranking_snapshots")) {
      await db.execute(
        sql.raw(`UPDATE meta_ranking_snapshots SET status = 'quarantined', quarantine_reason = '${finding.reason.replace(/'/g, "''")}' WHERE id = '${finding.id}'`)
      );
      await db.execute(
        sql.raw(`INSERT INTO quarantine_records (id, table_name, record_id, severity, reason, manifest_path, quarantined_at)
                 VALUES ('qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}', 'meta_ranking_snapshots', '${finding.id}', '${finding.severity}', '${finding.reason.replace(/'/g, "''")}', '${manifestFile.replace(/\\/g, "/")}', NOW())`)
      );
      rankingSnapshotsQuarantined++;
    }

    // 5. Evidence refs and cohorts quarantined via quarantine_records
    for (const finding of manifest.findings.filter((f) => f.table === "evidence_refs" || f.table === "meta_cohort_snapshots")) {
      await db.execute(
        sql.raw(`INSERT INTO quarantine_records (id, table_name, record_id, severity, reason, manifest_path, quarantined_at)
                 VALUES ('qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}', '${finding.table}', '${finding.id}', '${finding.severity}', '${finding.reason.replace(/'/g, "''")}', '${manifestFile.replace(/\\/g, "/")}', NOW())`)
      );
    }

    // 6. Clear diff_cache entries referencing quarantined snapshots
    if (quarantinedSnapshotIds.size > 0) {
      const snapList = Array.from(quarantinedSnapshotIds).map((s) => `'${s}'`).join(", ");
      const delRes = await db.execute(
        sql.raw(`DELETE FROM diff_cache WHERE from_snapshot_id IN (${snapList}) OR to_snapshot_id IN (${snapList})`)
      );
      diffCacheCleared = (delRes as any).rowCount || 1;
    }
  } else {
    rankingSnapshotsQuarantined = manifest.findings.filter((f) => f.table === "meta_ranking_snapshots").length;
    diffCacheCleared = quarantinedSnapshotIds.size > 0 ? 1 : 0;
  }

  const report: QuarantineReport = {
    appliedAt: new Date().toISOString(),
    isDryRun: !isApply,
    manifestPath: manifestFile,
    quarantinedCounts,
    retractedDependencies: {
      diffCacheCleared,
      rankingSnapshotsQuarantined
    },
    details
  };

  const reportPath = path.resolve("./storage/quarantine-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n[Quarantine Summary]");
  console.log(`  - Status: ${isApply ? "APPLIED TO DATABASE" : "DRY-RUN (NO CHANGES APPLIED)"}`);
  console.log(`  - Records quarantined: ${details.length}`);
  for (const [tbl, cnt] of Object.entries(quarantinedCounts)) {
    console.log(`    * ${tbl.padEnd(32)}: ${cnt}`);
  }
  console.log(`  - Dependent ranking snapshots: ${rankingSnapshotsQuarantined}`);
  console.log(`  - Diff cache cleared:          ${diffCacheCleared}`);
  console.log(`  - Report saved to: ${reportPath}\n`);

  return report;
}

if (process.argv[1] && process.argv[1].endsWith("quarantine.ts")) {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  let manifestPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manifest" && args[i + 1]) {
      manifestPath = args[i + 1];
      i++;
    }
  }

  runQuarantine({ manifestPath, apply: isApply })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Quarantine Error]:", err);
      process.exit(1);
    });
}
