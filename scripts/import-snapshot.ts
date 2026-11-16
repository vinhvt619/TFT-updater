import fs from "fs";
import { ImportEnvelopeSchema } from "../src/domain/schemas";
import { snapshotService } from "../src/server/services/snapshot-service";

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const isDryRun = args.includes("--dry-run");

  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error("Usage: tsx scripts/import-snapshot.ts --file <path> [--dry-run]");
    process.exit(1);
  }

  const filePath = args[fileIdx + 1];
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rawJson = JSON.parse(rawText);
  const parsed = ImportEnvelopeSchema.safeParse(rawJson);

  if (!parsed.success) {
    console.error("[Import] Validation failed:");
    console.error(parsed.error.format());
    process.exit(1);
  }

  const envelope = parsed.data as any;
  console.log(`[Import] Validated envelope successfully!`);
  console.log(`- Channel: ${envelope.release.channel}`);
  console.log(`- Patch Label: ${envelope.release.patchLabel}`);
  console.log(`- Champions count: ${envelope.payload.champions.length}`);
  console.log(`- Evidence count: ${envelope.evidence.length}`);

  if (isDryRun) {
    console.log("[Import] DRY-RUN mode enabled: No database modifications made.");
    process.exit(0);
  }

  const res = await snapshotService.importEnvelope(envelope, false);
  console.log(`[Import] Success! Created staging snapshot: ${res.snapshotId} (Release: ${res.releaseId})`);
  console.log(`To publish this snapshot, run:`);
  console.log(`  pnpm snapshot:approve -- --id ${res.snapshotId} --reason "Duyệt dữ liệu nhập thủ công"`);
}

main().catch((err) => {
  console.error("[Import] Error:", err);
  process.exit(1);
});
