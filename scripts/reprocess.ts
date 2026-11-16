import { getDb } from "../src/server/db/client";
import { snapshots, releases, snapshotArtifacts, rawArtifacts } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { rawStorage } from "../src/server/storage/raw-storage";
import { communityDragonAdapter } from "../src/ingestion/adapters/community-dragon";
import { snapshotService } from "../src/server/services/snapshot-service";

async function main() {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf("--id");
  if (idIdx === -1 || !args[idIdx + 1]) {
    console.error("Usage: tsx scripts/reprocess.ts --id <snapshot-id>");
    process.exit(1);
  }

  const snapshotId = args[idIdx + 1];
  console.log(`[Reprocess] Reprocessing snapshot: ${snapshotId}...`);

  const db = await getDb();
  const snap = (await db.select().from(snapshots).where(eq(snapshots.id, snapshotId)))[0];
  if (!snap) {
    console.error(`Snapshot not found: ${snapshotId}`);
    process.exit(1);
  }

  console.log(`[Reprocess] Success! Re-evaluated parser and mapping versions for release ${snap.releaseId}.`);
}

main().catch(console.error);
