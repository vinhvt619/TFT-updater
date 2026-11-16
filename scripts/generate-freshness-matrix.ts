import fs from "node:fs";
import path from "node:path";
import { metaRepository } from "../src/server/meta/repositories/meta-repository";
import { getDb } from "../src/server/db/client";

async function generateFreshnessMatrix() {
  const repo = metaRepository;
  const db = await getDb();

  const publishedSnapshot = await repo.getLatestRankingSnapshot("websites", "real");
  const allObs = await repo.getLatestSourceObservations("epoch_18_2", "real");

  const sources = ["tftacademy", "tactics_tools", "tftflex"];
  const matrix: any[] = [];

  for (const src of sources) {
    const srcObs = allObs.filter((o) => o.sourceId === src);
    const dates = srcObs
      .map((o) => (o.sourceDataAsOf ? new Date(o.sourceDataAsOf).getTime() : null))
      .filter((t): t is number => t !== null);

    const oldest = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null;
    const newest = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;

    const ageHours = oldest ? (Date.now() - new Date(oldest).getTime()) / (1000 * 60 * 60) : null;

    matrix.push({
      sourceId: src,
      observationsCount: srcObs.length,
      scope: (publishedSnapshot?.rankingScope?.rankScopesBySource as any)?.[src] || "All",
      oldestSourceDataAsOf: oldest,
      newestSourceDataAsOf: newest,
      ageHours: ageHours ? Number(ageHours.toFixed(1)) : null,
      freshnessPassed: ageHours !== null && ageHours <= 48,
      provenanceReceiptsCount: srcObs.filter((o) => (o.evidenceRefIds || []).length > 0).length,
      sampleUrls: srcObs.slice(0, 3).map((o) => o.sourceUrl),
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    rankingSnapshotId: publishedSnapshot?.id,
    effectiveSources: publishedSnapshot?.rankingScope?.effectiveSources,
    overallSourceDataAsOf: publishedSnapshot?.sourceDataAsOf,
    gatePolicy: "Per-source oldest observation sourceDataAsOf <= 48 hours (no fallback to fetchedAt/createdAt)",
    matrix
  };

  fs.writeFileSync(path.resolve("receipt-freshness-matrix.json"), JSON.stringify(output, null, 2), "utf-8");
  console.log("Wrote receipt-freshness-matrix.json successfully");
}

generateFreshnessMatrix().catch(console.error);
