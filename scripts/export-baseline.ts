import fs from "node:fs";
import path from "node:path";
import { getDb, closeDb } from "../src/server/db/client";
import { sql } from "drizzle-orm";

async function exportBaseline() {
  console.log("[Export Baseline] Connecting to database...");
  const db = await getDb();

  const tables = [
    "sources",
    "raw_artifacts",
    "releases",
    "release_markers",
    "snapshots",
    "snapshot_artifacts",
    "champions",
    "champion_snapshots",
    "trait_snapshots",
    "evidence_refs",
    "snapshot_evidence",
    "change_notes",
    "meta_archetypes",
    "meta_variants",
    "meta_source_snapshots",
    "meta_source_comp_observations",
    "meta_source_mappings",
    "meta_patch_epoch_regions",
    "meta_cohort_snapshots",
    "meta_cohort_members",
    "meta_matches",
    "meta_match_participants",
    "meta_cohort_match_links",
    "meta_classifications",
    "meta_collection_coverage",
    "meta_ranking_snapshots",
    "meta_ranking_rows",
    "meta_ranking_inputs",
    "meta_source_comp_builds"
  ];

  const dump: Record<string, any[]> = {};

  for (const t of tables) {
    try {
      const res = await db.execute(sql.raw(`SELECT * FROM ${t}`));
      dump[t] = res.rows || [];
      console.log(`Exported ${t}: ${dump[t].length} rows`);
    } catch (err: any) {
      console.warn(`Could not export ${t}: ${err.message}`);
      dump[t] = [];
    }
  }

  const outPath = path.resolve("./storage/baseline-seed.json");
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2), "utf8");
  console.log(`[Export Baseline] Successfully wrote baseline dump to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);

  await closeDb();
}

exportBaseline().catch((e) => {
  console.error(e);
  process.exit(1);
});
