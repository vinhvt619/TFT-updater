/**
 * Deterministic Demo Mode entrypoint.
 *
 * Set the mode before loading application modules so this command remains
 * safe when the repository .env is configured for real mode. Every write
 * still carries dataset_kind=demo and uses demo-only identifiers.
 */
process.env.DATA_MODE = "demo";

async function main() {
  const { runSeed } = await import("../seed-demo");
  const { runSeedMetaDemo } = await import("../meta/seed-demo");
  const { closeDb } = await import("../../src/server/db/client");

  await runSeed();
  await runSeedMetaDemo();
  await closeDb();
  console.log("[demo seed] snapshot, website ranking and Elite demo datasets seeded.");
}

main().catch(async (error: any) => {
  console.error("[demo seed] Failed:", error?.message || error);
  try {
    const { closeDb } = await import("../../src/server/db/client");
    await closeDb();
  } catch {}
  process.exitCode = 1;
});
