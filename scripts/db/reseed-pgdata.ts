import path from "node:path";
import { bootstrapCiDatabase } from "./bootstrap-ci-db";

async function main() {
  const targetDir = path.resolve("./storage/pgdata");
  console.log(`Re-seeding database in ${targetDir}...`);
  await bootstrapCiDatabase(targetDir);
  console.log("Database successfully re-seeded from baseline!");
}

main().catch((err) => {
  console.error("Reseed failed:", err);
  process.exit(1);
});
