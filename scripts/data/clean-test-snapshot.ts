import { getDb } from "../../src/server/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  await db.execute(sql.raw("DELETE FROM meta_ranking_rows WHERE ranking_snapshot_id = 'rank_websites_epoch_18_2_1789138753456'"));
  await db.execute(sql.raw("DELETE FROM meta_ranking_snapshots WHERE id = 'rank_websites_epoch_18_2_1789138753456'"));
  console.log("Cleaned test ranking snapshot.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
