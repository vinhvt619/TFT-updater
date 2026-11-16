import { rankingService } from "../../src/server/meta/services/ranking-service";
import { getCurrentLivePatchEpochId } from "../../src/domain/meta/patch-epochs";

async function main() {
  const args = process.argv.slice(2);
  let boardType = "websites";
  let epoch = getCurrentLivePatchEpochId();
  let region = "all";
  let windowHours = 72;
  let datasetKind: "real" | "demo" = "demo";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--board" && args[i + 1]) boardType = args[++i];
    if (args[i] === "--epoch" && args[i + 1]) epoch = args[++i];
    if (args[i] === "--region" && args[i + 1]) region = args[++i];
    if (args[i] === "--dataset" && args[i + 1]) {
      const d = args[++i];
      if (d === "real" || d === "demo") datasetKind = d;
    }
    if (args[i] === "--window" && args[i + 1]) {
      const w = args[++i].replace("h", "");
      windowHours = parseInt(w, 10) || 72;
    }
  }

  console.log(`[Rank] Calculating ranking for board=${boardType}, epoch=${epoch}, region=${region}, window=${windowHours}h, dataset=${datasetKind}...`);

  if (boardType === "websites") {
    const snap = await rankingService.computeWebsitesRanking(epoch, datasetKind);
    console.log(`[Rank] Created Websites Snapshot: ${snap.id}`);
    console.log(`Totals: Tier S=${snap.totals.rankedTierS}, A=${snap.totals.rankedTierA}, B=${snap.totals.rankedTierB}, C=${snap.totals.rankedTierC}`);
  } else {
    const snap = await rankingService.computeEliteRanking(region, epoch, windowHours, datasetKind);
    console.log(`[Rank] Created Elite Snapshot: ${snap.id}`);
    console.log(`Totals: Tier S=${snap.totals.rankedTierS}, A=${snap.totals.rankedTierA}, B=${snap.totals.rankedTierB}, C=${snap.totals.rankedTierC}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
