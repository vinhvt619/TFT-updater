import { describe, it, expect } from "vitest";
import {
  parseChangeDetail,
  rowImpact,
  getFieldPolarity
} from "@/domain/meta/change-impact";
import type { ReleaseChangeRow } from "@/domain/types";

describe("FIN-04: Unified Compare Impact Model Audit", () => {
  const makeChange = (overrides: Partial<ReleaseChangeRow>): ReleaseChangeRow => ({
    id: "change_1",
    releaseId: "rel_1",
    sourceEventId: "evt_1",
    entityKind: "champion",
    entityId: "tft18_ahri",
    rawEntityName: "Ahri",
    fieldKey: null,
    formId: null,
    starLevel: null,
    unit: null,
    changeType: "",
    before: { state: "known", value: 10 },
    after: { state: "known", value: 20 },
    rawText: "Thay đổi chỉ số",
    basis: "documented",
    sourceUrl: null,
    rawArtifactId: null,
    rawHash: null,
    sourceLocator: null,
    parserVersion: "1.0",
    applicability: {},
    effectivePrecision: null,
    verificationStatus: "verified",
    evidenceIds: [],
    ...overrides
  });

  it("identifies starting mana increase as buff and decrease as nerf", () => {
    const manaStartInc = makeChange({
      fieldKey: "mana_start",
      rawText: "Năng lượng khởi đầu: 10 ⇒ 20",
      before: { state: "known", value: 10 },
      after: { state: "known", value: 20 }
    });
    expect(getFieldPolarity(manaStartInc)).toBe("higher_is_buff");
    expect(rowImpact(manaStartInc)).toBe("buff");
    expect(parseChangeDetail(manaStartInc).type).toBe("buff");

    const manaStartDec = makeChange({
      fieldKey: "mana_start",
      rawText: "Năng lượng khởi đầu: 30 ⇒ 20",
      before: { state: "known", value: 30 },
      after: { state: "known", value: 20 }
    });
    expect(rowImpact(manaStartDec)).toBe("nerf");
    expect(parseChangeDetail(manaStartDec).type).toBe("nerf");
  });

  it("identifies max mana increase as nerf and decrease as buff", () => {
    const manaMaxInc = makeChange({
      fieldKey: "mana_max",
      rawText: "Năng lượng tối đa: 50 ⇒ 60",
      before: { state: "known", value: 50 },
      after: { state: "known", value: 60 }
    });
    expect(getFieldPolarity(manaMaxInc)).toBe("lower_is_buff");
    expect(rowImpact(manaMaxInc)).toBe("nerf");
    expect(parseChangeDetail(manaMaxInc).type).toBe("nerf");

    const manaMaxDec = makeChange({
      fieldKey: "mana_max",
      rawText: "Năng lượng tối đa: 60 ⇒ 50",
      before: { state: "known", value: 60 },
      after: { state: "known", value: 50 }
    });
    expect(rowImpact(manaMaxDec)).toBe("buff");
    expect(parseChangeDetail(manaMaxDec).type).toBe("buff");
  });

  it("preserves mixed vector impact and formats multi-star values without truncating to single float", () => {
    // 1 star damage increased from 100 to 110, 2 star damage decreased from 200 to 190
    const mixedVectorChange = makeChange({
      fieldKey: "attack_damage",
      rawText: "Sát thương theo sao: 100 / 200 ⇒ 110 / 190",
      before: { state: "known", value: [100, 200] },
      after: { state: "known", value: [110, 190] }
    });

    expect(rowImpact(mixedVectorChange)).toBe("mixed");
    const parsed = parseChangeDetail(mixedVectorChange);
    expect(parsed.type).toBe("mixed");
    expect(parsed.typeLabelVi).toBe("Điều chỉnh hỗn hợp");
    expect(parsed.beforeVal).toBe("100 / 200");
    expect(parsed.afterVal).toBe("110 / 190");
  });

  it("retains unknown/adjustment status for fields with unknown polarity (e.g. attack_range)", () => {
    const rangeChange = makeChange({
      fieldKey: "attack_range",
      rawText: "Tầm đánh: 1 ⇒ 2",
      before: { state: "known", value: 1 },
      after: { state: "known", value: 2 }
    });

    expect(getFieldPolarity(rangeChange)).toBe("unknown");
    expect(rowImpact(rangeChange)).toBe("unknown");
    const parsed = parseChangeDetail(rangeChange);
    expect(parsed.type).toBe("adjustment");
    expect(parsed.typeLabelVi).toBe("Chưa xác định");
  });
});
