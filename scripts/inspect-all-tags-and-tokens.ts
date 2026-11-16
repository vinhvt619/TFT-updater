import { getDb } from "../src/server/db/client";
import { championSnapshots, snapshots } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const snap = (await db.select().from(snapshots))[0];
  const champs = await db.select().from(championSnapshots).where(eq(championSnapshots.snapshotId, snap.id));

  // 1. Find all XML-like tags in all abilities
  const allTags = new Set<string>();
  const allTokens = new Set<string>();
  const champDescriptions: { id: string; name: string; desc: string }[] = [];

  for (const c of champs) {
    const p = c.payload as any;
    const desc = p.variants?.[0]?.abilities?.[0]?.description?.vi?.value || "";
    champDescriptions.push({ id: c.championId, name: p.name?.vi?.value || c.championId, desc });

    const tagMatches = desc.match(/<\/?[a-zA-Z0-9_]+[^>]*>/g) || [];
    tagMatches.forEach((t: string) => allTags.add(t));

    const tokenMatches = desc.match(/@[a-zA-Z0-9_*]+@/g) || [];
    tokenMatches.forEach((t: string) => allTokens.add(t.slice(1, -1)));
  }

  console.log("All tags found across 74 champions:", Array.from(allTags));
  console.log("\nAll tokens found across 74 champions (" + allTokens.size + "):", Array.from(allTokens));

  process.exit(0);
}

main().catch(console.error);
