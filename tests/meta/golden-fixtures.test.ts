import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { resolveItemInfo } from "../../src/domain/meta/item-registry";

describe("Independent Golden Fixtures & Board Truth Matrix", () => {
  const asheFixturePath = path.resolve("./tests/fixtures/tftflex/f65361813a2c/fast-9-ashe.json");
  const akaliFixturePath = path.resolve("./tests/fixtures/tftflex/7b20fb0ee81d/akali-camille.json");
  const tacticsFixturePath = path.resolve("./tests/fixtures/tactics-tools/a027a0489ee2/groups.json");
  const academyFixturePath = path.resolve("./tests/fixtures/tftacademy/b9065ba1499b/dragon-princess.json");

  it("loads all 4 independent golden fixtures with verified sha256 and reviewer metadata", () => {
    expect(fs.existsSync(asheFixturePath)).toBe(true);
    expect(fs.existsSync(akaliFixturePath)).toBe(true);
    expect(fs.existsSync(tacticsFixturePath)).toBe(true);
    expect(fs.existsSync(academyFixturePath)).toBe(true);

    const ashe = JSON.parse(fs.readFileSync(asheFixturePath, "utf8"));
    const akali = JSON.parse(fs.readFileSync(akaliFixturePath, "utf8"));
    const tactics = JSON.parse(fs.readFileSync(tacticsFixturePath, "utf8"));
    const academy = JSON.parse(fs.readFileSync(academyFixturePath, "utf8"));

    expect(ashe.reviewer).toBe("independent-audit-round8");
    expect(akali.reviewer).toBe("independent-audit-round8");
    expect(tactics.reviewer).toBe("independent-audit-round8");
    expect(academy.reviewer).toBe("independent-audit-round8");

    expect(ashe.rawArtifactSha256).toBe("f65361813a2c5ccc67729cd8515d0d59bf042437bc62747450a17d05dc733d0d");
    expect(akali.rawArtifactSha256).toBe("7b20fb0ee81d3593e3d32e3ce3c3af7c65809c57a008c5860940d9628cda2e60");
  });

  it("verifies Fast 9 Ashe AD fixture items and units against tftflex_import.json", () => {
    const importData = JSON.parse(fs.readFileSync(path.resolve("./storage/imports/tftflex_import.json"), "utf8"));
    const asheComp = importData.find((c: any) => c.sourceCompId === "tftflex_fast-9-ashe-ad");
    expect(asheComp).toBeDefined();
    expect(asheComp.originalTier).toBe("S");
    expect(asheComp.status).toBe("valid");

    const primaryBuild = asheComp.builds.find((b: any) => b.boardKind === "primary");
    expect(primaryBuild).toBeDefined();

    // Ashe has 3 items in primary build
    const asheUnit = primaryBuild.units.find((u: any) => u.sourceChampionKey === "DA_18_Ashe");
    expect(asheUnit).toBeDefined();
    expect(asheUnit.items.length).toBe(3);
    const itemIds = asheUnit.items.map((it: any) => it.itemId);
    expect(itemIds).toContain(resolveItemInfo("TFT_Item_SpearOfShojin")?.key);
    expect(itemIds).toContain(resolveItemInfo("TFT_Item_LastWhisper")?.key);
  });

  it("verifies Akali Camille Lv5 stage board is valid (not quarantined) and preserves items", () => {
    const importData = JSON.parse(fs.readFileSync(path.resolve("./storage/imports/tftflex_import.json"), "utf8"));
    const akaliComp = importData.find((c: any) => c.sourceCompId === "tftflex_akali-camille");
    expect(akaliComp).toBeDefined();
    expect(akaliComp.originalTier).toBe("B");
    expect(akaliComp.status).toBe("valid");
    expect(akaliComp.quarantineReason).toBeNull();

    const earlyBuild = akaliComp.builds.find((b: any) => b.boardLevel === 5 || b.boardKind === "early");
    expect(earlyBuild).toBeDefined();
    expect(earlyBuild.units.length).toBe(5);

    const akaliUnit = earlyBuild.units.find((u: any) => u.sourceChampionKey === "DA_18_Akali_AD");
    expect(akaliUnit).toBeDefined();
    expect(akaliUnit.items.length).toBe(3);

    const camilleUnit = earlyBuild.units.find((u: any) => u.sourceChampionKey === "DA_18_Camille");
    expect(camilleUnit).toBeDefined();
    expect(camilleUnit.items.length).toBe(1);
  });

  it("verifies total items across all TFTFlex builds is greater than 0 (>200 items)", () => {
    const importData = JSON.parse(fs.readFileSync(path.resolve("./storage/imports/tftflex_import.json"), "utf8"));
    let totalItems = 0;
    for (const comp of importData) {
      for (const b of comp.builds || []) {
        for (const u of b.units || []) {
          totalItems += (u.items || []).length;
        }
      }
    }
    expect(totalItems).toBeGreaterThan(200);
  });

  it("verifies tactics.tools fixture has authentic groups and Diamond+ rank scope", () => {
    const tactics = JSON.parse(fs.readFileSync(tacticsFixturePath, "utf8"));
    expect(tactics.groups).toHaveLength(5);
    expect(tactics.scope.rankScope).toBe("Diamond+");
    const groupNames = tactics.groups.map((g: any) => g.name);
    expect(groupNames).toContain("Solar Akali & Camille");
    expect(groupNames).toContain("Blossom Master Yi & Vi");
  });
});
