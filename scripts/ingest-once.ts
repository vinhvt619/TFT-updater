import { ingestOnce } from "../src/ingestion/ingest";

async function main() {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf("--source");
  if (sourceIdx === -1 || !args[sourceIdx + 1]) {
    console.error("Usage: tsx scripts/ingest-once.ts --source <id>");
    process.exit(1);
  }

  const sourceId = args[sourceIdx + 1];
  console.log(`[IngestOnce] Executing ingestion for source: ${sourceId}...`);

  const result = await ingestOnce(sourceId);
  console.log(`[IngestOnce] Finished with status: ${result.status}`);
  console.log(`Run ID: ${result.runId}`);
  console.log(`Diagnostics:`, JSON.stringify(result.diagnostics, null, 2));
}

main().catch(console.error);
