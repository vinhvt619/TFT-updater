import fs from "fs";
import { getDb } from "../src/server/db/client";
import { snapshots, auditLog } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { ImportEnvelopeSchema } from "../src/domain/schemas";
import { snapshotService } from "../src/server/services/snapshot-service";
import crypto from "crypto";

async function main() {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf("--id");
  const fileIdx = args.indexOf("--file");

  if (idIdx === -1 || fileIdx === -1 || !args[idIdx + 1] || !args[fileIdx + 1]) {
    console.error("Usage: tsx scripts/correct-snapshot.ts --id <snapshot-id> --file <corrected-envelope-path>");
    process.exit(1);
  }

  const snapshotId = args[idIdx + 1];
  const filePath = args[fileIdx + 1];

  const rawText = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const envelope = ImportEnvelopeSchema.parse(JSON.parse(rawText));

  console.log(`[Correct] Creating revision correcting snapshot: ${snapshotId}...`);
  const res = await snapshotService.importEnvelope(envelope as any, true);

  const db = await getDb();
  await db.insert(auditLog).values({
    id: `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    actor: "cli_admin",
    action: "correct_snapshot",
    targetId: res.snapshotId,
    reason: `Chỉnh lý số liệu từ tệp ${filePath} thay thế cho ${snapshotId}`,
    evidenceRefs: envelope.evidence.map((e) => e.id)
  });

  console.log(`[Correct] Success! Created published revision: ${res.snapshotId}`);
}

main().catch(console.error);
