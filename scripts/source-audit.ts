import fs from "fs";
import path from "path";
import { env } from "../src/server/config";
import { communityDragonAdapter } from "../src/ingestion/adapters/community-dragon";

async function main() {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf("--source");
  const sourceId = sourceIdx !== -1 ? args[sourceIdx + 1] : undefined;

  const configPath = path.resolve(env.SOURCES_CONFIG_PATH);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  const targetSources = sourceId ? config.sources.filter((s: any) => s.id === sourceId) : config.sources;

  console.log(`[SourceAudit] Auditing ${targetSources.length} source(s)...`);

  for (const src of targetSources) {
    console.log(`\n--- Auditing source: ${src.name} (${src.id}) ---`);
    console.log(`Endpoint: ${src.endpoint}`);
    const probeRes = await communityDragonAdapter.probe(src);
    console.log(`Reachable: ${probeRes.reachable}`);
    console.log(`HTTP Status: ${probeRes.httpStatus}`);
    console.log(`Has Target Set 18: ${probeRes.hasTargetSet}`);
    console.log(`Diagnostics:`, JSON.stringify(probeRes.diagnostics, null, 2));
  }
}

main().catch(console.error);
