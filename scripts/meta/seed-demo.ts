import { getDb } from "../../src/server/db/client";
import { sql } from "drizzle-orm";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";
import { metaTftProvider } from "../../src/ingestion/meta/providers/metatft";
import { tftAcademyProvider } from "../../src/ingestion/meta/providers/tftacademy";
import { tftFlexProvider } from "../../src/ingestion/meta/providers/tftflex";
import { dataTftProvider } from "../../src/ingestion/meta/providers/datatft";
import { tacticsToolsProvider } from "../../src/ingestion/meta/providers/tactics-tools";
import { demoMatchProvider } from "../../src/ingestion/meta/providers/demo-match-provider";
import { classifyBoard } from "../../src/domain/meta/board-classifier";
import { rankingService } from "../../src/server/meta/services/ranking-service";

export async function runSeedMetaDemo() {
  console.log("==========================================================");
  console.log("  TFT MÙA 18 - SEED DEMO DATA PIPELINE (M0 - M4)          ");
  console.log("==========================================================");

  // 1. Lưu các Archetypes chuẩn Set 18
  console.log("\n[1/6] Lưu 10 Canonical Archetypes chuẩn Mùa 18...");
  for (const arch of SET18_ARCHETYPES) {
    await metaRepository.saveArchetype(arch);
  }
  console.log(`✓ Đã lưu ${SET18_ARCHETYPES.length} đội hình vào meta_archetypes & meta_variants.`);

  // 2. Thu thập và lưu quan sát từ 5 website
  console.log("\n[2/6] Thu thập dữ liệu từ 5 website meta...");
  const metatftObs = await metaTftProvider.fetchObservations({ datasetKind: "demo" });
  const academyObs = await tftAcademyProvider.fetchObservations({ datasetKind: "demo" });
  const flexObs = await tftFlexProvider.fetchObservations({ datasetKind: "demo" });
  const datatftObs = await dataTftProvider.fetchObservations({ datasetKind: "demo" });
  const tacticsObs = await tacticsToolsProvider.fetchObservations({ datasetKind: "demo" });

  const allObs = [
    ...metatftObs,
    ...academyObs,
    ...flexObs,
    ...datatftObs,
    ...tacticsObs
  ];

  const snapId = "site_snap_demo_round11_epoch_18_2_v1";
  await metaRepository.saveSourceObservations(
    snapId,
    "combined_sites",
    { patchEpochId: "epoch_18_2", setNumber: 18 },
    allObs,
    "demo"
  );
  // Normalize observations left by older demo seeds. Demo provenance is an
  // internal fixture namespace and must never retain a production website URL.
  await (await getDb()).execute(sql.raw(`
    UPDATE meta_source_comp_observations
    SET source_url = '/demo/evidence/sources/' || source_id || '/' || source_comp_id,
        evidence_ref_ids = jsonb_build_array('demo_evidence_' || source_id)
    WHERE dataset_kind = 'demo'
  `));
  console.log(`✓ Đã lưu ${allObs.length} quan sát từ 5 nguồn (MetaTFT, TFT Academy, TFT Flex, DataTFT, tactics.tools).`);

  // 3. Tính toán Ranking Snapshot Mục A: Tổng hợp các trang meta
  console.log("\n[3/6] Tính toán điểm đồng thuận và xếp hạng Mục A...");
  const websiteRank = await rankingService.computeWebsitesRanking("epoch_18_2", "demo");
  console.log(`✓ Snapshot Mục A tạo thành công: ID = ${websiteRank.id}`);
  console.log(`  - Tier S: ${websiteRank.totals.rankedTierS}`);
  console.log(`  - Tier A: ${websiteRank.totals.rankedTierA}`);
  console.log(`  - Tier B: ${websiteRank.totals.rankedTierB}`);
  console.log(`  - Tier C: ${websiteRank.totals.rankedTierC}`);
  console.log(`  - Tạm thời (Provisional): ${websiteRank.totals.provisionalCount}`);

  // 4. Tạo Cohorts Top 50 Challenger cho KR, VN, NA, EUW
  console.log("\n[4/6] Khởi tạo Cohorts Top 50 Challenger (KR, VN, NA, EUW)...");
  const regions = ["KR", "VN", "NA", "EUW"];
  const cohortsByRegion: Record<string, any> = {};

  for (const reg of regions) {
    const cohort = demoMatchProvider.generateDemoCohort(reg, 50);
    await metaRepository.saveCohortSnapshot(cohort);
    cohortsByRegion[reg] = cohort;
    console.log(`  ✓ Cohort ${reg}: 50 tài khoản Challenger đã lưu.`);
  }

  // 5. Tạo 240 trận đấu mẫu chân thực (60 trận mỗi khu vực) đủ thứ hạng 1-8
  console.log("\n[5/6] Tạo 240 trận đấu chuẩn Ranked (placement 1-8) và phân loại bàn cờ...");
  let matchCount = 0;
  let classifiedCount = 0;

  for (const reg of regions) {
    const cohort = cohortsByRegion[reg];
    for (let i = 0; i < 60; i++) {
      const match = demoMatchProvider.generateDemoMatch(
        matchCount,
        reg,
        cohort.members,
        "epoch_18_2"
      );
      await metaRepository.saveNormalizedMatch(match, cohort.id, "demo");
      matchCount++;

      // Phân loại bàn cờ cho từng participant
      for (const p of match.participants) {
        const cls = classifyBoard(p, SET18_ARCHETYPES);
        await metaRepository.saveClassification(cls);
        if (cls.status === "matched") classifiedCount++;
      }
    }
  }
  console.log(`✓ Đã lưu ${matchCount} trận đấu, phân loại ${matchCount * 8} người chơi (${classifiedCount} lượt khớp archetype).`);

  // 6. Tính toán Ranking Snapshots Mục B (từng vùng và Tổng hợp đa khu vực)
  console.log("\n[6/6] Tính toán điểm và xếp hạng Mục B: Cao thủ các khu vực...");
  for (const reg of regions) {
    const eliteSnap = await rankingService.computeEliteRanking(reg, "epoch_18_2", 72, "demo");
    console.log(`  ✓ Xếp hạng ${reg}: S=${eliteSnap.totals.rankedTierS}, A=${eliteSnap.totals.rankedTierA}, B=${eliteSnap.totals.rankedTierB}, C=${eliteSnap.totals.rankedTierC}`);
  }

  const globalSnap = await rankingService.computeEliteRanking("all", "epoch_18_2", 72, "demo");
  console.log(`  ✓ Bảng Tổng Hợp (Macro-Average): S=${globalSnap.totals.rankedTierS}, A=${globalSnap.totals.rankedTierA}, B=${globalSnap.totals.rankedTierB}, C=${globalSnap.totals.rankedTierC}`);

  console.log("\n==========================================================");
  console.log("  SEED DEMO HOÀN TẤT THÀNH CÔNG! DỮ LIỆU ĐÃ SẴN SÀNG      ");
  console.log("==========================================================");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeedMetaDemo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed demo failed:", err);
      process.exit(1);
    });
}
import { pathToFileURL } from "node:url";
