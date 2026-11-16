import { describe, it, expect } from "vitest";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";

describe("Ranking Scope Truthfulness & Provenance Integrity Suite", () => {
  it("P1-9: Ranking response tách bạch nguồn được yêu cầu và nguồn thật sự đóng góp", async () => {
    const webSnap = await metaRepository.getLatestRankingSnapshot("websites", "real", { patchEpochId: "epoch_18_2" });
    expect(webSnap).not.toBeNull();
    expect(webSnap?.rankingScope).not.toBeNull();

    const scope = webSnap!.rankingScope;

    // 1. requestedSources phải liệt kê đủ 5 nguồn theo specification
    expect(scope.requestedSources).toEqual([
      "metatft",
      "tftacademy",
      "tftflex",
      "datatft",
      "tactics_tools"
    ]);

    // 2. effectiveSources chỉ được lấy từ coverage đã lưu; snapshot cũ thiếu coverage không được điền nguồn giả.
    expect(scope.effectiveSources).not.toBeNull();
    expect(scope.effectiveSources).toEqual(webSnap!.coverage.effectiveSources || []);
    const requestedSources = scope.requestedSources || [];
    expect(scope.effectiveSources!.every((source) => requestedSources.includes(source))).toBe(true);

    // 3. Snapshot không có bằng chứng coverage phải trả danh sách rỗng.
    if (!webSnap!.coverage.effectiveSources) {
      expect(scope.effectiveSources).toEqual([]);
      expect(scope.sourceIds).toEqual([]);
    }

    // 4. epochPrecision phải trung thực là base_patch_only, không mạo nhận hotfix_verified
    expect(scope.epochPrecision).toBe("base_patch_only");

    // 5. rankScope và regions phản ánh đúng thực tế
    expect(scope.effectiveRegions).toEqual(["Global"]);
  });

  it("P0-4: Dữ liệu real mode không bị lấp chỗ trống bằng mock hay fallback tĩnh", async () => {
    const webSnap = await metaRepository.getLatestRankingSnapshot("websites", "real", { patchEpochId: "epoch_18_2" });
    expect(webSnap).not.toBeNull();

    // Các archetype chưa đủ 2 nguồn độc lập để cấp tier chính thức phải có tier: null
    const collectingRows = webSnap!.rows.filter((r) => r.status === "collecting");
    expect(collectingRows.length).toBeGreaterThanOrEqual(6);

    for (const r of collectingRows) {
      expect(r.tier).toBeNull();
      if (r.validSourceCount === 0) {
        expect(r.score).toBeNull();
        expect(r.candidateTier).toBeNull();
      }
    }
  });
});
