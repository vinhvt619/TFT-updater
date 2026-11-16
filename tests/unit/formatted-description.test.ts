import { describe, it, expect } from "vitest";
import { resolveExactValue, cleanRiotTags } from "@/components/ui/formatted-description";
import type { NumericParameter } from "@/domain/types";

describe("FIN-01: FormattedDescription and resolveExactValue audit", () => {
  it("never invents synthetic numbers for unknown tokens (returns 'Chưa có dữ liệu', not 250 / 375 / 600)", () => {
    const unknownTokens = [
      "UnknownSpellDamageCalc",
      "completely_random_token_xyz",
      "MagicDamageCalc99",
      "ShieldAmountCalcSpecial",
      "HexRadiusSpecial"
    ];

    for (const token of unknownTokens) {
      const result = resolveExactValue(token, { championId: "tft18_ahri", cost: 4 });
      expect(result).toBe("Chưa có dữ liệu");
      expect(result).not.toContain("250");
      expect(result).not.toContain("375");
      expect(result).not.toContain("600");
    }
  });

  it("resolves exact parameters correctly per patch without leaking between two patches", () => {
    // Patch 1 parameters: Ahri damage 250 / 375 / 1000
    const patch1Params: NumericParameter[] = [
      {
        key: "MagicDamageCalc1",
        labelVi: "Sát thương phép",
        labelEn: "Magic Damage",
        unit: "flat",
        contextKey: "magic_damage",
        byStar: {
          1: { state: "known", value: 250, sourceRefIds: ["p1"], quality: "extracted", origin: "source" },
          2: { state: "known", value: 375, sourceRefIds: ["p1"], quality: "extracted", origin: "source" },
          3: { state: "known", value: 1000, sourceRefIds: ["p1"], quality: "extracted", origin: "source" }
        }
      }
    ];

    // Patch 2 parameters: Ahri buffed to 280 / 420 / 1200
    const patch2Params: NumericParameter[] = [
      {
        key: "MagicDamageCalc1",
        labelVi: "Sát thương phép",
        labelEn: "Magic Damage",
        unit: "flat",
        contextKey: "magic_damage",
        byStar: {
          1: { state: "known", value: 280, sourceRefIds: ["p2"], quality: "extracted", origin: "source" },
          2: { state: "known", value: 420, sourceRefIds: ["p2"], quality: "extracted", origin: "source" },
          3: { state: "known", value: 1200, sourceRefIds: ["p2"], quality: "extracted", origin: "source" }
        }
      }
    ];

    const valPatch1 = resolveExactValue("MagicDamageCalc1", { parameters: patch1Params });
    const valPatch2 = resolveExactValue("MagicDamageCalc1", { parameters: patch2Params });

    expect(valPatch1).toBe("250 / 375 / 1000");
    expect(valPatch2).toBe("280 / 420 / 1200");

    // Single star level resolution
    const star2Patch1 = resolveExactValue("MagicDamageCalc1", { parameters: patch1Params, starLevel: 2 });
    const star2Patch2 = resolveExactValue("MagicDamageCalc1", { parameters: patch2Params, starLevel: 2 });
    expect(star2Patch1).toBe("375");
    expect(star2Patch2).toBe("420");
  });

  it("handles percentage units correctly and prevents 30%% double percent formatting", () => {
    const percentParams: NumericParameter[] = [
      {
        key: "SlowPercent",
        labelVi: "Làm chậm",
        labelEn: "Slow Percent",
        unit: "percent",
        contextKey: "slow",
        byStar: {
          1: { state: "known", value: 30, sourceRefIds: ["p1"], quality: "extracted", origin: "source" },
          2: { state: "known", value: 30, sourceRefIds: ["p1"], quality: "extracted", origin: "source" },
          3: { state: "known", value: 30, sourceRefIds: ["p1"], quality: "extracted", origin: "source" }
        }
      }
    ];

    const val = resolveExactValue("SlowPercent", { parameters: percentParams, starLevel: 1 });
    expect(val).toBe("30%");

    // Verify that without parameters, token returns 'Chưa có dữ liệu' (fail-closed, no unverified fallback)
    const defaultVal = resolveExactValue("slowpercent");
    expect(defaultVal).toBe("Chưa có dữ liệu");
  });

  it("cleans Riot markup and handles scale tags into clean Vietnamese", () => {
    const raw = "<rules>Nội Tại:</rules> Đòn đánh gây thêm <magicDamage>100%i:scaleAP%</magicDamage> sát thương.";
    const cleaned = cleanRiotTags(raw);
    expect(cleaned).not.toContain("<rules>");
    expect(cleaned).not.toContain("</magicDamage>");
    expect(cleaned).toContain("(SMPT)");
  });
});
