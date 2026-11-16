import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "../src/server/db/schema";
import { applySchemaDdl } from "../src/server/db/schema-ddl";
import { seedTestBaseline } from "../src/server/db/baseline-seed";

let tempTestDir: string | null = null;

export async function setup() {
  const uniqueId = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
  tempTestDir = path.join(os.tmpdir(), `tft-vitest-run-${uniqueId}`);

  process.env.PGDATA_DIR = tempTestDir;
  process.env.TFT_TEST_RUNNER_DIR = path.resolve(tempTestDir);
  process.env.VITEST = "true";

  console.log(`[Vitest GlobalSetup] Initializing clean test database at ${tempTestDir}...`);
  const pglite = new PGlite(tempTestDir);
  await pglite.waitReady;
  
  try {
    fs.writeFileSync(path.join(tempTestDir, ".test-owned"), "true");
  } catch {}

  await applySchemaDdl(pglite);
  const drizzle = drizzlePglite(pglite, { schema });
  await seedTestBaseline(drizzle);

  await pglite.close();
  console.log("[Vitest GlobalSetup] Clean test database ready.");
}

export async function teardown() {
  console.log("[Vitest GlobalTeardown] Cleaning up test database...");
  if (tempTestDir && fs.existsSync(tempTestDir)) {
    try {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
      console.log(`[Vitest GlobalTeardown] Removed ${tempTestDir}.`);
    } catch (err: any) {
      console.warn("[Vitest GlobalTeardown] Could not remove temp dir:", err.message);
    }
  }
}
