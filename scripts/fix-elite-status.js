import { PGlite } from '@electric-sql/pglite';

async function main() {
  const db = new PGlite('./storage/pgdata');
  const res = await db.query("UPDATE meta_ranking_snapshots SET status = 'collecting' WHERE board_type = 'elite' AND dataset_kind = 'real'");
  console.log("Updated rows:", res.affectedRows);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
