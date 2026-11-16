import { snapshotService } from "../src/server/services/snapshot-service";

async function main() {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf("--id");
  const reasonIdx = args.indexOf("--reason");

  if (idIdx === -1 || !args[idIdx + 1] || reasonIdx === -1 || !args[reasonIdx + 1]) {
    console.error("Usage: tsx scripts/approve-snapshot.ts --id <snapshotId> --reason <text>");
    process.exit(1);
  }

  const snapshotId = args[idIdx + 1];
  const reason = args[reasonIdx + 1];

  console.log(`[Approve] Approving snapshot: ${snapshotId}...`);
  await snapshotService.approveSnapshot(snapshotId, reason, "cli_operator");
  console.log(`[Approve] Success! Snapshot ${snapshotId} has been published and set as current snapshot.`);
}

main().catch((err) => {
  console.error("[Approve] Failed:", err);
  process.exit(1);
});
