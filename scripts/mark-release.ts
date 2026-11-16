import { getDb } from "../src/server/db/client";
import { releaseMarkers, auditLog } from "../src/server/db/schema";
import crypto from "crypto";

async function main() {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf("--id");
  const markerIdx = args.indexOf("--marker");
  const evidenceIdx = args.indexOf("--evidence");

  if (idIdx === -1 || markerIdx === -1 || !args[idIdx + 1] || !args[markerIdx + 1]) {
    console.error("Usage: tsx scripts/mark-release.ts --id <release-id> --marker <launch|initial_pbe|hotfix> [--evidence <evidence-id>]");
    process.exit(1);
  }

  const releaseId = args[idIdx + 1];
  const marker = args[markerIdx + 1];
  const evidenceId = evidenceIdx !== -1 ? args[evidenceIdx + 1] : undefined;

  const db = await getDb();
  await db.insert(releaseMarkers).values({
    id: `marker_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    releaseId,
    marker,
    evidenceRefs: evidenceId ? [evidenceId] : [],
    actor: "cli_admin"
  });

  await db.insert(auditLog).values({
    id: `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    actor: "cli_admin",
    action: "mark_release",
    targetId: releaseId,
    reason: `Gắn nhãn mốc: ${marker}`,
    evidenceRefs: evidenceId ? [evidenceId] : []
  });

  console.log(`[MarkRelease] Success! Marked release '${releaseId}' as '${marker}'.`);
}

main().catch(console.error);
