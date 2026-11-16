import { getDb } from "../../src/server/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const metaTables = ["meta_matches", "meta_cohort_snapshots", "meta_source_comp_observations", "meta_ranking_snapshots", "snapshots", "releases"];
  console.log("=== TABLE COLUMNS ===");
  for (const t of metaTables) {
    const cols = await db.execute(sql.raw(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`));
    console.log(`\nTable ${t}:`);
    console.log(cols.rows.map((c: any) => c.column_name).join(", "));
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
