import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { classifyTacticsGroup } from "../../src/ingestion/meta/tactics-tools-classifier";
import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";

describe("Tactics.tools Group Classifier - Order Invariance & Threshold Suite", () => {
  // Use the immutable JSON receipt for the classifier invariance fixture.
  // The live HTML is allowed to change its current five groups between runs.
  const tacticsJsonPath = path.resolve("./storage/raw/tactics_tools_nextdata.json");

  it("P1-7: Phân loại nhóm tactics.tools theo signature tập tướng độc lập thứ tự mảng", () => {
    if (!fs.existsSync(tacticsJsonPath)) {
      console.warn("Chưa có raw artifact tactics.tools");
      return;
    }

    const nextData = JSON.parse(fs.readFileSync(tacticsJsonPath, "utf8"));
    const originalGroups = nextData.initialData?.groups || [];

    expect(originalGroups.length).toBeGreaterThanOrEqual(5);

    // 1. Phân loại theo thứ tự ban đầu
    const originalMatches = originalGroups
      .map((g: any) => classifyTacticsGroup(g, { minConfidence: 0.50 }))
      .filter((r: any) => r.matched);

    expect(originalMatches.length).toBe(5);
    const matchedArchetypeIds = originalMatches.map((r: any) => r.archetypeId);
    expect(matchedArchetypeIds).toContain("comp_masteryi_duelist");
    expect(matchedArchetypeIds).toContain("comp_dragon_princess");
    expect(matchedArchetypeIds).toContain("comp_draven_reroll");
    expect(matchedArchetypeIds).toContain("comp_akali_ninja");
    expect(matchedArchetypeIds).toContain("comp_caitlyn_enforcer");

    // 1b. Khẳng định tên archetype và champion signature của Blossom Master Yi & Vi (Decoupled khỏi Weave Got This)
    const yiMatch = originalMatches.find((r: any) => r.archetypeId === "comp_masteryi_duelist");
    expect(yiMatch).not.toBeNull();
    expect(yiMatch.name).toBe("Blossom Master Yi & Vi (Dueling Blades)");
    expect(yiMatch.topUnits).toContain("tft18_da_18_masteryi_ad");
    expect(yiMatch.topUnits).toContain("tft18_da_vi18");

    // 1c. Khẳng định SET18_ARCHETYPES đã tách độc lập Blossom Master Yi & Vi và Weave Got This
    const yiArch = SET18_ARCHETYPES.find((a) => a.id === "comp_masteryi_duelist");
    expect(yiArch).not.toBeNull();
    expect(yiArch!.nameEn).toBe("Blossom Master Yi & Vi (Dueling Blades)");
    expect(yiArch!.coreCarryChampionId).toBe("DA_18_MasterYi_AD");
    expect(yiArch!.coreTankChampionId).toBe("DA_Vi18");

    const weaveArch = SET18_ARCHETYPES.find((a) => a.id === "comp_weave_got_this");
    expect(weaveArch).not.toBeNull();
    expect(weaveArch!.nameEn).toBe("Weave Got This (Alune & Ahri Spellweaver)");
    expect(weaveArch!.coreCarryChampionId).toBe("DA_18_Alune");
    expect(weaveArch!.coreTankChampionId).toBe("DA_18_Lillia");

    // 2. Đảo ngược hoàn toàn thứ tự mảng groups
    const reversedGroups = [...originalGroups].reverse();
    const reversedMatches = reversedGroups
      .map((g: any) => classifyTacticsGroup(g, { minConfidence: 0.50 }))
      .filter((r: any) => r.matched);

    expect(reversedMatches.length).toBe(5);
    const reversedArchetypeIds = reversedMatches.map((r: any) => r.archetypeId);
    expect(reversedArchetypeIds.sort()).toEqual(matchedArchetypeIds.sort());

    // 3. Xáo trộn ngẫu nhiên thứ tự mảng groups
    const shuffledGroups = [originalGroups[3], originalGroups[0], originalGroups[4], originalGroups[1], originalGroups[2]];
    const shuffledMatches = shuffledGroups
      .map((g: any) => classifyTacticsGroup(g, { minConfidence: 0.50 }))
      .filter((r: any) => r.matched);

    expect(shuffledMatches.length).toBe(5);
    const shuffledArchetypeIds = shuffledMatches.map((r: any) => r.archetypeId);
    expect(shuffledArchetypeIds.sort()).toEqual(matchedArchetypeIds.sort());

    // Kiểm tra độ tin cậy của tất cả các trận phân loại đều >= 0.50
    for (const match of shuffledMatches) {
      expect(match.confidence).toBeGreaterThanOrEqual(0.50);
    }
  });

  it("P1-7: Cách ly và từ chối các group không đạt ngưỡng tin cậy >= 0.50", () => {
    // Nhóm giả mạo với tập tướng lạ hoắc
    const fakeGroup = {
      full: {
        units: [
          ["random_unit_a", 2, 1000, 4.5],
          ["random_unit_b", 2, 900, 4.2],
          ["random_unit_c", 2, 800, 4.8]
        ]
      }
    };

    const result = classifyTacticsGroup(fakeGroup, { minConfidence: 0.50 });
    expect(result.matched).toBe(false);
    expect(result.confidence).toBeLessThan(0.50);
    expect(result.reason).toContain("quá thấp");
  });
});
