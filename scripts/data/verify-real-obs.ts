import { metaRepository } from "../../src/server/meta/repositories/meta-repository";

async function main() {
  const obs = await metaRepository.getLatestSourceObservations("epoch_18_2", "real");
  console.log(`Found ${obs.length} unquarantined real observations:`);
  for (const o of obs) {
    console.log(`- [${o.sourceId}] ${o.archetypeId} -> Tier: ${o.originalTier} (URL: ${o.sourceUrl})`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
