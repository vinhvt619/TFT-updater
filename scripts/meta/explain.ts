import { metaRepository } from "../../src/server/meta/repositories/meta-repository";

async function main() {
  const args = process.argv.slice(2);
  let snapshotId = "";
  let compId = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--snapshot" && args[i + 1]) snapshotId = args[++i];
    if (args[i] === "--comp" && args[i + 1]) compId = args[++i];
  }

  if (!snapshotId) {
    // Lấy snapshot mới nhất
    const snap = await metaRepository.getLatestRankingSnapshot("websites", "demo");
    if (!snap) {
      console.log("Chưa có ranking snapshot nào.");
      process.exit(0);
    }
    snapshotId = snap.id;
  }

  const snap = await metaRepository.getRankingSnapshot(snapshotId);
  if (!snap) {
    console.error(`Không tìm thấy snapshot: ${snapshotId}`);
    process.exit(1);
  }

  const targetComp = compId
    ? snap.rows.find((r) => r.archetypeId === compId)
    : snap.rows[0];

  if (!targetComp) {
    console.error(`Không tìm thấy đội hình: ${compId}`);
    process.exit(1);
  }

  console.log("==========================================================");
  console.log(`  GIẢI THÍCH XẾP HẠNG: ${targetComp.archetypeNameVi || targetComp.archetypeId}`);
  console.log("==========================================================");
  console.log(`Snapshot ID: ${snap.id}`);
  console.log(`Bảng: ${snap.rankingScope.boardType.toUpperCase()} | Patch: ${snap.rankingScope.patchEpochId}`);
  console.log(`Điểm số: ${targetComp.score ?? "Chưa có"} | Tier: ${targetComp.tier ?? "Chưa công bố"} | Ứng viên: ${targetComp.candidateTier ?? "Chưa có"}`);
  console.log(`Trạng thái: ${targetComp.status} (${targetComp.consensusLabel || "N/A"})`);

  if (snap.rankingScope.boardType === "websites") {
    console.log("\nChi tiết phiếu từ 5 website:");
    for (const [sId, v] of Object.entries(targetComp.sourceVotes)) {
      console.log(`  - ${sId}: Tier gốc '${v.originalTier || "None"}', Điểm phiếu: ${v.normalizedVote ?? "None"} (Thống kê: ${v.isStatistical})`);
    }
  } else {
    console.log("\nSố liệu thô toàn bộ hạng 1-8:");
    console.log(`  - Lượt chơi: ${targetComp.rawMetrics.appearances}`);
    console.log(`  - Số trận riêng biệt: ${targetComp.rawMetrics.uniqueMatches}`);
    console.log(`  - Số tài khoản: ${targetComp.rawMetrics.uniqueAccounts}`);
    console.log(`  - Tỷ lệ Top 4 thô: ${(Number(targetComp.rawMetrics.rawTop4Rate || 0) * 100).toFixed(1)}%`);
    console.log(`  - Tỷ lệ Thắng thô (Top 1): ${(Number(targetComp.rawMetrics.rawWinRate || 0) * 100).toFixed(1)}%`);
    console.log(`  - Hạng trung bình thô: ${targetComp.rawMetrics.rawAveragePlacement ?? "N/A"}`);
  }

  if (targetComp.reasonCodes && targetComp.reasonCodes.length > 0) {
    console.log("\nLý do & Tiêu chí chất lượng:");
    for (const r of targetComp.reasonCodes) {
      console.log(`  * ${r}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
