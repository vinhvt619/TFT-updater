import { getDb } from "../../src/server/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();

  console.log("\n=== RELEASES BY DATASET KIND ===");
  const rels = await db.execute(sql.raw("SELECT id, dataset_kind, channel, patch_label, build_id, current_snapshot_id FROM releases"));
  console.log(JSON.stringify(rels.rows, null, 2));

  console.log("\n=== SNAPSHOTS ===");
  const snaps = await db.execute(sql.raw("SELECT id, release_id, revision, status, reason, raw_hash FROM snapshots"));
  console.log(JSON.stringify(snaps.rows, null, 2));

  const evs = await db.execute(sql.raw("SELECT id, kind, source_id, title, url, dataset_kind FROM evidence_refs"));

  console.log("\n=== META MATCHES BY DATASET KIND ===");
  const matches = await db.execute(sql.raw("SELECT dataset_kind, count(*) as count FROM meta_matches GROUP BY dataset_kind"));
  console.table(matches.rows);

  console.log("\n=== META RANKING SNAPSHOTS BY DATASET KIND & BOARD TYPE ===");
  const rankSnaps = await db.execute(sql.raw("SELECT dataset_kind, board_type, count(*) as count FROM meta_ranking_snapshots GROUP BY dataset_kind, board_type"));
  console.table(rankSnaps.rows);

  console.log("\n=== META SOURCE COMP OBSERVATIONS BY DATASET KIND ===");
  const obs = await db.execute(sql.raw("SELECT dataset_kind, source_id, count(*) as count FROM meta_source_comp_observations GROUP BY dataset_kind, source_id"));
  console.table(obs.rows);

  const fs = await import("node:fs");
  const manifest = {
    generatedAt: new Date().toISOString(),
    releases: rels.rows,
    snapshots: snaps.rows,
    evidenceRefs: evs.rows,
    matchesSummary: matches.rows,
    rankingSnapshotsSummary: rankSnaps.rows,
    observationsSummary: obs.rows
  };
  fs.writeFileSync("./storage/audit_manifest_initial.json", JSON.stringify(manifest, null, 2));
  console.log("Wrote manifest to ./storage/audit_manifest_initial.json");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
