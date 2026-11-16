import { describe, it, expect } from "vitest";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";

describe("Real-Mode Empty State & Golden Board Lineage Suite", () => {
  it("P0-4 & P0-5: Đội hình không có nguồn thực tế trả về empty state trung thực, không fallback tĩnh", async () => {
    // comp_hecarim_cavalry không có trong 8 guides của TFT Academy hay tactics.tools
    const arch = await metaRepository.getArchetypeById("comp_hecarim_cavalry", "real");
    expect(arch).not.toBeNull();

    // 1. Không mượn carry / tank đã seed tĩnh
    expect(arch!.coreCarryChampionId).toBeNull();
    expect(arch!.coreTankChampionId).toBeNull();
    expect(arch!.coreChampionIds).toEqual([]);

    // 2. Không mượn conditions tĩnh
    expect(arch!.requiredConditions).toEqual([]);

    // 3. Không mượn recommendedItems tĩnh
    expect(arch!.recommendedItems).toEqual({});

    // 4. Bàn cờ rỗng hoàn toàn trong mode real
    expect(arch!.variants.length).toBeGreaterThan(0);
    for (const v of arch!.variants) {
      expect(v.recommendedBoard).toEqual([]);
      expect(v.sourceUrl).toBeNull();
      expect(v.evidenceId).toBeNull();
    }
  });

  it("P0-4: Chế độ demo vẫn phục vụ fixture đã dán nhãn cho mục đích kiểm thử", async () => {
    const archDemo = await metaRepository.getArchetypeById("comp_hecarim_cavalry", "demo");
    expect(archDemo).not.toBeNull();

    // Chế độ demo giữ nguyên fixture kiểm thử
    expect(archDemo!.variants[0].recommendedBoard.length).toBeGreaterThan(0);
  });

  it("P0-5 & P1-6 & P1-10: Đội hình có nguồn thực tế suy ra carry/tank, catalog cost, và provenance link", async () => {
    // comp_dragon_princess có guide thực tế từ TFT Academy
    const arch = await metaRepository.getArchetypeById("comp_dragon_princess", "real");
    expect(arch).not.toBeNull();

    // 1. Có bàn cờ 8 tướng từ Positioning Example
    const board = arch!.variants[0].recommendedBoard;
    expect(board.length).toBe(8);

    // 2. Champion cost được giải mã từ canonical catalog (Elder Dragon là tướng bậc cao 5 vàng, không phải mặc định cost 2)
    const elderDragonUnit = board.find((u) => u.championId.includes("elderdragon"));
    expect(elderDragonUnit).not.toBeNull();
    expect(elderDragonUnit!.cost).not.toBeNull();
    expect(elderDragonUnit!.cost).toBe(5);

    // 3. Carry và Tank được phân loại theo vai trò trang bị thực tế, assert ID chính xác không chỉ toBeDefined
    expect(arch!.coreCarryChampionId).not.toBeNull();
    expect(arch!.coreCarryChampionId).toBe("tft18_da_18_morgana");
    expect(arch!.coreTankChampionId).not.toBeNull();
    expect(arch!.coreTankChampionId).toBe("tft18_da_18_maokai");

    // 4. Variant có direct source URL và evidence link
    const variant = arch!.variants[0];
    expect(variant.sourceUrl).toContain("https://tftacademy.com/tierlist/comps/set-18-dragon-princess");
    expect(variant.evidenceId).toMatch(/^ev_tftacademy_set-18-dragon-princess_/);
  });
});
