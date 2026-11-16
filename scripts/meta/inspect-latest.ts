import { metaRepository } from "../../src/server/meta/repositories/meta-repository";

async function main() {
  const latestWeb = await metaRepository.getLatestRankingSnapshot("websites", "demo");
  const latestElite = await metaRepository.getLatestRankingSnapshot("elite", "demo");

  console.log("=== TRUY VẾT SNAPSHOT MỤC A (WEBSITES) ===");
  if (latestWeb) {
    console.log(`Snapshot ID: ${latestWeb.id}`);
    console.log(`Thời điểm sinh: ${latestWeb.generatedAt}`);
    console.log(`Số đội hình xếp hạng: ${latestWeb.rows.length}`);
    const topComp = latestWeb.rows[0];
    if (topComp) {
      console.log(`Đội hình dẫn đầu: ${topComp.archetypeNameVi} (Tier ${topComp.tier}, Điểm: ${topComp.score})`);
      console.log(`Các nguồn đóng góp phiếu:`, Object.keys(topComp.sourceVotes));
      for (const [sId, vote] of Object.entries(topComp.sourceVotes)) {
        console.log(`  - ${sId}: Tier gốc = ${(vote as any).originalTier}, Điểm quy đổi = ${(vote as any).normalizedVote}`);
      }
    }
  }

  console.log("\n=== TRUY VẾT SNAPSHOT MỤC B (CAO THỦ KHU VỰC) ===");
  if (latestElite) {
    console.log(`Snapshot ID: ${latestElite.id}`);
    console.log(`Thời điểm sinh: ${latestElite.generatedAt}`);
    console.log(`Cohort Snapshots liên kết:`, latestElite.rankingScope.cohortSnapshotIds);
    console.log(`Khu vực hiệu lực (Effective Regions):`, latestElite.rankingScope.effectiveRegions);
    console.log(`Độ chính xác Epoch (Precision):`, latestElite.rankingScope.epochPrecision);
    console.log(`Độ bao phủ thực tế (Coverage):`, latestElite.coverage);
    const topComp = latestElite.rows[0];
    if (topComp) {
      console.log(`Đội hình dẫn đầu: ${topComp.archetypeNameVi} (Tier ${topComp.tier}, Điểm: ${topComp.score})`);
      console.log(`Chỉ số thô (Raw Metrics):`, topComp.rawMetrics);
      console.log(`Chỉ số sau Bayes Shrinkage (Adjusted):`, topComp.adjustedMetrics);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
