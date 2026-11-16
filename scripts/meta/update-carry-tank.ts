import { getDb } from "../../src/server/db/client";
import { classifyUnitRole } from "../../src/domain/meta/item-registry";
import { isNonShopEntity } from "../../src/domain/meta/board-validator";
import { metaSourceCompObservations } from "../../src/server/db/schema-meta";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const rows = await db.execute(
    `SELECT o.id, o.original_name, b.units 
     FROM meta_source_comp_observations o 
     JOIN meta_source_comp_builds b ON o.id = b.observation_id 
     WHERE b.board_kind = 'primary'`
  );

  console.log(`Found ${rows.rows.length} primary builds`);

  for (const r of rows.rows as any[]) {
    const units = (r.units || []) as any[];
    let bestCarry: string | null = null;
    let maxCScore = 0;
    let bestTank: string | null = null;
    let maxTScore = 0;

    for (const u of units) {
      const cid = u.championId || u.sourceChampionKey;
      if (isNonShopEntity(cid)) continue; // Never pick non-shop entities

      const itemKeys = (u.items || []).map((it: any) => it.itemId || it.sourceItemKey);
      const role = classifyUnitRole(itemKeys);

      if ((u.isCarry || role.isCarry) && role.carryScore > maxCScore) {
        maxCScore = role.carryScore;
        bestCarry = cid;
      }
      if ((u.isTank || role.isTank) && role.tankScore > maxTScore) {
        maxTScore = role.tankScore;
        bestTank = cid;
      }
    }

    if (bestCarry || bestTank) {
      console.log(`Updating ${r.original_name} (${r.id}): carry=${bestCarry}, tank=${bestTank}`);
      await db
        .update(metaSourceCompObservations)
        .set({
          carryChampionId: bestCarry,
          tankChampionId: bestTank
        })
        .where(eq(metaSourceCompObservations.id, r.id));
    }
  }

  console.log("Done updating carry and tank!");
}

main().catch(console.error);
