import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../src/server/db/schema";
import { applySchemaDdl } from "../../src/server/db/schema-ddl";
import { seedTestBaseline } from "../../src/server/db/baseline-seed";

export async function bootstrapCiDatabase(targetDir: string) {
  console.log("================================================================================");
  console.log("             BOOTSTRAP CI / ACCEPTANCE TEST DATABASE ENVIRONMENT                ");
  console.log("================================================================================");
  console.log(`[Bootstrap] Target Directory: ${targetDir}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const pglite = new PGlite(targetDir);
  await pglite.waitReady;
  console.log("[Bootstrap] PGlite connection established.");

  console.log("[Bootstrap] Step 1: Applying clean schema DDL...");
  await applySchemaDdl(pglite);
  console.log("[Bootstrap] Schema DDL applied successfully.");

  const db = drizzle(pglite, { schema });

  console.log("[Bootstrap] Step 2: Seeding test acceptance baseline...");
  await seedTestBaseline(db);
  console.log("[Bootstrap] Baseline test seed applied successfully.");

  console.log("[Bootstrap] Step 3: Verifying database health & table counts...");
  const ping: any = await pglite.query("SELECT 1 as ping");
  if (ping?.rows?.[0]?.ping !== 1) {
    throw new Error("Smoke query SELECT 1 failed");
  }

  const requiredTables = [
    "releases",
    "snapshots",
    "champions",
    "release_changes",
    "meta_archetypes",
    "meta_ranking_snapshots",
    "meta_source_comp_observations"
  ];

  const counts: Record<string, number> = {};
  for (const t of requiredTables) {
    const res: any = await pglite.query(`SELECT count(*) as cnt FROM ${t}`);
    const cnt = parseInt(res?.rows?.[0]?.cnt || "0", 10);
    counts[t] = cnt;
    console.log(`[Bootstrap]   - ${t.padEnd(30)}: ${cnt} rows`);
    if (cnt === 0 && t !== "meta_cohort_snapshots") {
      throw new Error(`Bootstrap verification failed: table ${t} is empty!`);
    }
  }

  await pglite.close();
  console.log("================================================================================");
  console.log("[Bootstrap] SUCCESS: Test database is healthy and ready for CI / acceptance.");
  console.log("================================================================================");
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const target = process.env.PGDATA_DIR
    ? path.resolve(process.env.PGDATA_DIR)
    : path.resolve("./storage/pgdata-ci-test");

  bootstrapCiDatabase(target)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Bootstrap Error]:", err);
      process.exit(1);
    });
}
