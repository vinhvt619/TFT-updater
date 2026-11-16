import { describe, it, expect, beforeAll } from "vitest";
import { metaRepository } from "../../../src/server/meta/repositories/meta-repository";
import { rankingService } from "../../../src/server/meta/services/ranking-service";
import { SET18_ARCHETYPES } from "../../../src/domain/meta/archetypes";

describe("Milestone M4 & M6 - Meta Comps Integration Pipeline", () => {
  beforeAll(async () => {
    // Đảm bảo archetypes đã có trong database
    for (const arch of SET18_ARCHETYPES) {
      await metaRepository.saveArchetype(arch);
    }
  }, 30000);

  it("Lưu và truy vấn danh sách 10 canonical archetypes thành công", async () => {
    const archetypes = await metaRepository.listArchetypes();
    expect(archetypes.length).toBeGreaterThanOrEqual(10);

    const draven = await metaRepository.getArchetypeById("comp_draven_reroll");
    expect(draven).not.toBeNull();
    expect(draven?.nameVi).toContain("Draven");
    expect(draven?.coreCarryChampionId).toBe("DA_Draven18");
  });

  it("Tính toán và truy vấn snapshot Mục A (Websites) thành công", async () => {
    const snap = await rankingService.computeWebsitesRanking("epoch_18_2", "demo");
    expect(snap.id).toBeDefined();
    expect(snap.rankingScope.boardType).toBe("websites");
    expect(snap.rows.length).toBeGreaterThanOrEqual(10);

    // Lấy lại từ repository
    const fetched = await metaRepository.getRankingSnapshot(snap.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(snap.id);
    expect(fetched?.rows[0].archetypeNameVi).toBeDefined();
  });

  it("Tính toán và truy vấn snapshot Mục B (Elite) thành công", async () => {
    const snap = await rankingService.computeEliteRanking("all", "epoch_18_2", 72, "demo");
    expect(snap.id).toBeDefined();
    expect(snap.rankingScope.boardType).toBe("elite");
    expect(snap.rows.length).toBeGreaterThanOrEqual(10);

    // Kiểm tra tính đầy đủ của số liệu thô
    const firstRow = snap.rows[0];
    expect(firstRow.rawMetrics).toBeDefined();
  });

  it("Tính toán lặp lại (idempotency) không gây crash hay duplicate primary keys", async () => {
    const snap1 = await rankingService.computeWebsitesRanking("epoch_18_2", "demo");
    const snap2 = await rankingService.computeWebsitesRanking("epoch_18_2", "demo");
    expect(snap1).toBeDefined();
    expect(snap2).toBeDefined();
  });
});
