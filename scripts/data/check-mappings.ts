import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";
import { toCanonicalChampionId } from "../../src/domain/identity";
import { getDb } from "../../src/server/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const res = await db.execute(sql.raw("SELECT id FROM champions"));
  const dbChampIds = new Set(res.rows.map((r: any) => r.id));

  const allArchChampIds = new Set<string>();
  for (const a of SET18_ARCHETYPES) {
    if (a.coreCarryChampionId) allArchChampIds.add(a.coreCarryChampionId);
    if (a.coreTankChampionId) allArchChampIds.add(a.coreTankChampionId);
    for (const c of a.coreChampionIds || []) allArchChampIds.add(c);
    for (const c of a.flexChampionIds || []) allArchChampIds.add(c);
  }

  console.log("Total unique champion IDs in archetypes:", allArchChampIds.size);
  const unmapped: string[] = [];
  const mapped: Record<string, string> = {};

  for (const raw of Array.from(allArchChampIds)) {
    const canonical = toCanonicalChampionId(raw, 18);
    if (dbChampIds.has(canonical)) {
      mapped[raw] = canonical;
    } else {
      unmapped.push(raw);
    }
  }

  console.log("Successfully mapped directly via toCanonicalChampionId:", Object.keys(mapped).length);
  console.log("Unmapped IDs count:", unmapped.length);
  if (unmapped.length > 0) {
    console.log("Unmapped samples:", unmapped);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
