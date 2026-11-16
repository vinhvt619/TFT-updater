import fs from "node:fs";
import path from "node:path";
import { getDb } from "../../src/server/db/client";
import { sql } from "drizzle-orm";

export interface AuditFinding {
  table: string;
  id: string;
  severity: "P0_SYNTHETIC" | "P0_FAKE_HASH" | "P1_UNVERIFIED_PROVENANCE";
  reason: string;
  datasetKind: string;
  details: Record<string, any>;
  dependentRecords?: { table: string; id: string }[];
}

export interface AuditManifest {
  auditTime: string;
  datasetScope: string;
  summary: {
    totalInspected: number;
    totalFlagged: number;
    byTable: Record<string, { inspected: number; flagged: number }>;
  };
  findings: AuditFinding[];
}

export async function runAudit(options: { dataset?: string; outFile?: string } = {}): Promise<AuditManifest> {
  const targetDataset = options.dataset || "real";
  console.log(`[Audit] Running read-only data integrity audit on scope: ${targetDataset}...`);

  const db = await getDb();
  const findings: AuditFinding[] = [];
  const byTable: Record<string, { inspected: number; flagged: number }> = {};

  // 1. Audit Snapshots
  const snaps = await db.execute(sql.raw("SELECT id, release_id, revision, status, reason, raw_hash, gameplay_hash FROM snapshots"));
  byTable["snapshots"] = { inspected: snaps.rows.length, flagged: 0 };
  for (const s of snaps.rows as any[]) {
    // Check fake hash or override-based snapshot
    if (s.raw_hash && s.raw_hash.startsWith("hash_")) {
      findings.push({
        table: "snapshots",
        id: s.id,
        severity: "P0_FAKE_HASH",
        reason: `Snapshot mang hash tự sinh (${s.raw_hash}), không được trích xuất từ artifact thật`,
        datasetKind: "real",
        details: { releaseId: s.release_id, rawHash: s.raw_hash, status: s.status }
      });
      byTable["snapshots"].flagged++;
    } else if (s.id === "snap_live_18_1" || s.id === "snap_live_18_2" || s.id === "snap_pbe_18_3") {
      findings.push({
        table: "snapshots",
        id: s.id,
        severity: "P0_SYNTHETIC",
        reason: "Snapshot được dựng từ mảng override số liệu trong create-real-patch-18-2.ts",
        datasetKind: "real",
        details: { releaseId: s.release_id, status: s.status }
      });
      byTable["snapshots"].flagged++;
    }
  }

  // 2. Audit Evidence Refs
  const evs = await db.execute(sql.raw("SELECT id, kind, source_id, title, url, dataset_kind FROM evidence_refs"));
  byTable["evidence_refs"] = { inspected: evs.rows.length, flagged: 0 };
  for (const e of evs.rows as any[]) {
    if (targetDataset !== "all" && e.dataset_kind !== targetDataset) continue;
    if (e.url && (e.url.includes("tft18.internal") || e.url.includes("demo.tft18.internal"))) {
      findings.push({
        table: "evidence_refs",
        id: e.id,
        severity: "P0_SYNTHETIC",
        reason: `Evidence dẫn link giả lập nội bộ (${e.url}) gán nhãn ${e.dataset_kind}`,
        datasetKind: e.dataset_kind,
        details: { url: e.url, kind: e.kind, title: e.title }
      });
      byTable["evidence_refs"].flagged++;
    }
  }

  // 3. Audit Meta Matches
  const matches = await db.execute(sql.raw("SELECT match_key, provider, region, queue, dataset_kind, raw_artifact_id FROM meta_matches"));
  byTable["meta_matches"] = { inspected: matches.rows.length, flagged: 0 };
  for (const m of matches.rows as any[]) {
    if (targetDataset !== "all" && m.dataset_kind !== targetDataset) continue;
    if (m.dataset_kind === "real" && (m.match_key.startsWith("match_real_") || !m.raw_artifact_id || m.raw_artifact_id === "")) {
      findings.push({
        table: "meta_matches",
        id: m.match_key,
        severity: "P0_SYNTHETIC",
        reason: "Trận đấu xếp hạng tự sinh từ seed-real.ts, không có Riot match API payload thật",
        datasetKind: m.dataset_kind,
        details: { provider: m.provider, region: m.region, rawArtifactId: m.raw_artifact_id }
      });
      byTable["meta_matches"].flagged++;
    }
  }

  // 4. Audit Meta Cohort Snapshots
  const cohorts = await db.execute(sql.raw("SELECT id, region, top_n, queue, source_url FROM meta_cohort_snapshots"));
  byTable["meta_cohort_snapshots"] = { inspected: cohorts.rows.length, flagged: 0 };
  for (const c of cohorts.rows as any[]) {
    if (c.id.includes("_real_")) {
      findings.push({
        table: "meta_cohort_snapshots",
        id: c.id,
        severity: "P0_SYNTHETIC",
        reason: "Cohort snapshot nạp từ file JSON tự sinh PUUID và chỉnh LP trong seed-real.ts",
        datasetKind: "real",
        details: { region: c.region, topN: c.top_n }
      });
      byTable["meta_cohort_snapshots"].flagged++;
    }
  }

  // 5. Audit Meta Source Comp Observations
  const obs = await db.execute(sql.raw("SELECT id, source_id, dataset_kind, source_comp_id, snapshot_id FROM meta_source_comp_observations"));
  byTable["meta_source_comp_observations"] = { inspected: obs.rows.length, flagged: 0 };
  for (const o of obs.rows as any[]) {
    if (targetDataset !== "all" && o.dataset_kind !== targetDataset) continue;
    if (o.dataset_kind === "real") {
      findings.push({
        table: "meta_source_comp_observations",
        id: o.id,
        severity: "P1_UNVERIFIED_PROVENANCE",
        reason: `Quan sát website mang nhãn real nhưng trả số liệu hardcode từ provider ${o.source_id}`,
        datasetKind: o.dataset_kind,
        details: { sourceId: o.source_id, sourceCompId: o.source_comp_id, snapshotId: o.snapshot_id }
      });
      byTable["meta_source_comp_observations"].flagged++;
    }
  }

  // 6. Audit Meta Ranking Snapshots (Phụ thuộc vào dữ liệu giả)
  const rankSnaps = await db.execute(sql.raw("SELECT id, dataset_kind, board_type, patch_epoch_id FROM meta_ranking_snapshots"));
  byTable["meta_ranking_snapshots"] = { inspected: rankSnaps.rows.length, flagged: 0 };
  for (const r of rankSnaps.rows as any[]) {
    if (targetDataset !== "all" && r.dataset_kind !== targetDataset) continue;
    if (r.dataset_kind === "real") {
      findings.push({
        table: "meta_ranking_snapshots",
        id: r.id,
        severity: "P0_SYNTHETIC",
        reason: `Ranking snapshot mục ${r.board_type} tính toán từ các trận đấu/quan sát giả mạo`,
        datasetKind: r.dataset_kind,
        details: { boardType: r.board_type, patchEpochId: r.patch_epoch_id }
      });
      byTable["meta_ranking_snapshots"].flagged++;
    }
  }

  const totalInspected = Object.values(byTable).reduce((acc, v) => acc + v.inspected, 0);
  const totalFlagged = findings.length;

  const manifest: AuditManifest = {
    auditTime: new Date().toISOString(),
    datasetScope: targetDataset,
    summary: {
      totalInspected,
      totalFlagged,
      byTable
    },
    findings
  };

  const outputPath = options.outFile || path.resolve("./storage/audit-manifest.json");
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

  console.log("\n[Audit Result Summary]");
  console.log(`  - Scope: ${targetDataset}`);
  console.log(`  - Total records inspected: ${totalInspected}`);
  console.log(`  - Total records flagged:   ${totalFlagged}`);
  for (const [t, s] of Object.entries(byTable)) {
    console.log(`    * ${t.padEnd(30)}: ${s.flagged} flagged / ${s.inspected} inspected`);
  }
  console.log(`  - Audit manifest saved to: ${outputPath}\n`);

  return manifest;
}

if (process.argv[1] && process.argv[1].endsWith("audit.ts")) {
  const args = process.argv.slice(2);
  let dataset = "real";
  let outFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dataset" && args[i + 1]) {
      dataset = args[i + 1];
      i++;
    } else if (args[i] === "--out" && args[i + 1]) {
      outFile = args[i + 1];
      i++;
    }
  }

  runAudit({ dataset, outFile })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Audit Error]:", err);
      process.exit(1);
    });
}
