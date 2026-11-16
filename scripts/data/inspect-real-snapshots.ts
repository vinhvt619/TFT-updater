import { getDb } from "../../src/server/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const res = await db.execute(
    sql.raw("SELECT id, dataset_kind, board_type, status, quarantine_reason FROM meta_ranking_snapshots WHERE dataset_kind = 'real'")
  );
  console.log("Real ranking snapshots in DB:");
  console.log(JSON.stringify(res.rows, null, 2));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
