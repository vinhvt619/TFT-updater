import { describe, expect, it } from "vitest";
import { dedupeReleaseChanges, summarizeDocumentedChanges, rowImpact, isNoopChange } from "../../src/server/services/diff-service";
import type { ReleaseChangeRow } from "../../src/domain/types";

function change(overrides: Partial<ReleaseChangeRow> = {}): ReleaseChangeRow {
  return {
    id: "change-1",
    releaseId: "release-18-2",
    sourceEventId: "event-18-2",
    entityKind: "champion",
    entityId: "tft18_ahri",
    rawEntityName: "Ahri",
    fieldKey: "ability_damage",
    formId: null,
    starLevel: null,
    unit: "damage",
    changeType: "buff",
    before: { state: "known", value: [425, 640] },
    after: { state: "known", value: [455, 685] },
    rawText: "Ahri: sát thương kỹ năng 425/640 → 455/685",
    basis: "documented",
    sourceUrl: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-2/",
    rawArtifactId: "raw-18-2",
    rawHash: "hash-18-2",
    sourceLocator: "section:ahri:ability_damage",
    parserVersion: "1.1.0",
    applicability: {},
    effectivePrecision: "patch",
    verificationStatus: "verified",
    evidenceIds: ["raw-18-2"],
    ...overrides
  };
}

describe("tổng hợp thay đổi từ patch notes", () => {
  it("không đếm lặp cùng bằng chứng và tách tướng, trang bị, tộc hệ, lõi", () => {
    const rows = [
      change(),
      change({ id: "duplicate-row" }),
      change({ id: "item-row", entityKind: "item", entityId: "item_guardian_angel", rawEntityName: "Giáp Thiên Thần", fieldKey: "stats", rawText: "Giáp Thiên Thần: giáp 30 → 35" }),
      change({ id: "trait-row", entityKind: "trait", entityId: "trait_dragon", rawEntityName: "Rồng", fieldKey: "threshold", rawText: "Rồng: ngưỡng kích hoạt 5 → 4" }),
      change({ id: "augment-row", entityKind: "augment", entityId: "augment_arcana", rawEntityName: "Lõi Arcana", fieldKey: "effect", rawText: "Lõi Arcana: hiệu ứng được tăng" }),
      change({ id: "bugfix-row", entityKind: "bugfix", entityId: null, rawEntityName: "Veigar", fieldKey: "tooltip", changeType: "tooltip_only", rawText: "Sửa lỗi hiển thị mô tả Veigar" })
    ];

    expect(dedupeReleaseChanges(rows)).toHaveLength(5);
    const result = summarizeDocumentedChanges(rows, 120);

    expect(result.visible).toHaveLength(4);
    expect(result.hidden).toHaveLength(1);
    expect(result.summary.rosterTotal).toBe(120);
    expect(result.summary.changedChampionCount).toBe(1);
    expect(result.summary.observedUnchangedChampionCount).toBeNull(); // Sparse notes cannot observe unchanged champions across roster
    expect(result.summary.changedItemCount).toBe(1);
    expect(result.summary.changedTraitCount).toBe(1);
    expect(result.summary.changedAugmentCount).toBe(1);
    expect(result.summary.hiddenMaintenanceCount).toBe(1);
    expect(result.summary.totalChampions).toBe(120);
  });

  it("giữ trạng thái chưa biết thay vì dựng số liệu từ văn bản thiếu giá trị", () => {
    const result = summarizeDocumentedChanges([
      change({ before: { state: "missing" }, after: { state: "known", value: 10 }, changeType: "changed", rawText: "Ahri: giá trị mới 10; giá trị cũ không có" })
    ]);

    expect(result.summary.unresolvedClaimCount).toBe(1);
    expect(result.summary.unknownCount).toBe(1);
    expect(result.visible[0].before.state).toBe("missing");
  });

  it("áp dụng quy tắc ĐTCL: giảm năng lượng tối đa và hồi chiêu là buff, tăng là nerf", () => {
    const buffMana = change({ id: "mana-buff", entityId: "tft18_ahri", fieldKey: "mana_max", before: { state: "known", value: 80 }, after: { state: "known", value: 60 }, rawText: "Ahri: Năng lượng tối đa 80 → 60" });
    const nerfMana = change({ id: "mana-nerf", entityId: "tft18_lux", fieldKey: "mana_max", before: { state: "known", value: 60 }, after: { state: "known", value: 80 }, rawText: "Lux: Năng lượng tối đa 60 → 80" });
    const buffCd = change({ id: "cd-buff", entityId: "tft18_kennen", fieldKey: "cooldown", before: { state: "known", value: 12 }, after: { state: "known", value: 10 }, rawText: "Kennen: Thời gian hồi chiêu 12s → 10s" });
    const nerfCd = change({ id: "cd-nerf", entityId: "tft18_amumu", fieldKey: "cooldown", before: { state: "known", value: 8 }, after: { state: "known", value: 10 }, rawText: "Amumu: Thời gian hồi chiêu 8s → 10s" });

    const result = summarizeDocumentedChanges([buffMana, nerfMana, buffCd, nerfCd], 60);
    expect(result.summary.changedChampionCount).toBe(4);
    expect(result.summary.buffedCount).toBe(2); // Ahri & Kennen
    expect(result.summary.nerfedCount).toBe(2); // Lux & Amumu
    expect(result.summary.mixedCount).toBe(0);
  });

  it("phân loại hỗn hợp (mixed) khi cùng một tướng vừa có buff vừa có nerf", () => {
    const mixedChamp = [
      change({ id: "ahri-ad-buff", entityId: "tft18_ahri", fieldKey: "attack_damage", before: { state: "known", value: 50 }, after: { state: "known", value: 55 }, rawText: "Ahri: AD 50 → 55" }),
      change({ id: "ahri-mana-nerf", entityId: "tft18_ahri", fieldKey: "mana_max", before: { state: "known", value: 50 }, after: { state: "known", value: 70 }, rawText: "Ahri: Năng lượng tối đa 50 → 70" })
    ];

    const result = summarizeDocumentedChanges(mixedChamp, 60);
    expect(result.summary.changedChampionCount).toBe(1);
    expect(result.summary.mixedCount).toBe(1);
    expect(result.summary.buffedCount).toBe(0);
    expect(result.summary.nerfedCount).toBe(0);
  });

  it("thiếu rosterTotal thì totalChampions là null và không tự fallback bằng changedChampionCount", () => {
    const rows = [
      change({ id: "c1", entityId: "tft18_ahri" }),
      change({ id: "c2", entityId: "tft18_lux" })
    ];

    const result = summarizeDocumentedChanges(rows, null);
    expect(result.summary.changedChampionCount).toBe(2);
    expect(result.summary.rosterTotal).toBeNull();
    expect(result.summary.totalChampions).toBeNull();
    expect(result.summary.observedUnchangedChampionCount).toBeNull();
    expect(result.summary.coverage).toBe("unavailable");
  });

  it("thay đổi của trang bị, lõi, tộc hệ không làm tăng đếm buff của tướng", () => {
    const nonChampRows = [
      change({ id: "item-buff", entityKind: "item", entityId: "item_ie", fieldKey: "ad", changeType: "buff", before: { state: "known", value: 30 }, after: { state: "known", value: 35 }, rawText: "Vô Cực Kiếm: AD 30 → 35" }),
      change({ id: "trait-buff", entityKind: "trait", entityId: "trait_sorcerer", fieldKey: "ap", changeType: "buff", before: { state: "known", value: 20 }, after: { state: "known", value: 25 }, rawText: "Pháp Sư: AP 20 → 25" }),
      change({ id: "augment-buff", entityKind: "augment", entityId: "aug_feather", fieldKey: "as", changeType: "buff", before: { state: "known", value: 15 }, after: { state: "known", value: 20 }, rawText: "Nhẹ Nhàng: AS 15 → 20" })
    ];

    const result = summarizeDocumentedChanges(nonChampRows, 60);
    expect(result.summary.changedChampionCount).toBe(0);
    expect(result.summary.buffedCount).toBe(0);
    expect(result.summary.changedItemCount).toBe(1);
    expect(result.summary.changedTraitCount).toBe(1);
    expect(result.summary.changedAugmentCount).toBe(1);
  });

  describe("Kiểm thử hồi quy tóm tắt thay đổi", () => {
    it("1. R04-mixed-stars: một trường ở các cấp sao vừa tăng vừa giảm phân loại vào mixedCount = 1", () => {
      const mixedRow = change({
        before: { state: "known", value: [100, 200] },
        after: { state: "known", value: [110, 190] }
      });
      const result = summarizeDocumentedChanges([mixedRow]);
      expect(result.summary.mixedCount).toBe(1);
      expect(result.summary.buffedCount).toBe(0);
      expect(result.summary.nerfedCount).toBe(0);
    });

    it("2. R04-comma-decimal: số thập phân có dấu phẩy 1,9 -> 2,0 không bị tách mảng và nhận diện là buff", () => {
      const decimalRow = change({
        fieldKey: "attack_speed",
        unit: "attacks/second",
        before: { state: "known", value: "1,9" },
        after: { state: "known", value: "2,0" },
        rawText: "Tốc độ đánh"
      });
      expect(rowImpact(decimalRow)).toBe("buff");
    });

    it("3. R04-field-priority: ngữ nghĩa fieldKey đã biết ưu tiên hơn từ khóa trong rawText", () => {
      const priorityRow = change({
        fieldKey: "mana_start",
        unit: "mana",
        before: { state: "known", value: 10 },
        after: { state: "known", value: 20 },
        rawText: "Starting Mana / Max Mana 10/100 → 20/100"
      });
      expect(rowImpact(priorityRow)).toBe("buff");
    });

    it("4. R04-unresolved-identity: giữ claims entityId=null riêng, không đếm vào changedChampionCount", () => {
      const unresolvedRows = [
        change({ entityId: null, rawEntityName: "Tên chưa ánh xạ A" }),
        change({ id: "fixture-2", entityId: null, rawEntityName: "Tên chưa ánh xạ B" })
      ];
      const result = summarizeDocumentedChanges(unresolvedRows);
      expect(result.summary.changedChampionCount).toBe(0);
    });

    it("5. R04-unchanged-coverage: sparse patch notes không suy diễn observedUnchangedChampionCount", () => {
      const result = summarizeDocumentedChanges([change()], 120);
      expect(result.summary.observedUnchangedChampionCount).toBeNull();
    });

    it("6. R04-noop: thay đổi before=after không làm tăng changedChampionCount", () => {
      const noopRow = change({
        before: { state: "known", value: 100 },
        after: { state: "known", value: 100 }
      });
      const result = summarizeDocumentedChanges([noopRow]);
      expect(result.summary.changedChampionCount).toBe(0);
    });

    it("7. R04-unknown-polarity: fieldKey có direction unknown không tự ý phân loại thành buff khi tăng số", () => {
      const unknownRow = change({
        fieldKey: "attack_range",
        unit: "hexes",
        changeType: "changed",
        before: { state: "known", value: 1 },
        after: { state: "known", value: 2 },
        rawText: "Thông số có direction unknown trong FIELD_REGISTRY"
      });
      expect(rowImpact(unknownRow)).toBe("unknown");
    });

    it("8. R04-text-mechanic-noop & count: cơ chế khác nhau không bị coi là no-op dù cùng số và tăng changedChampionCount", () => {
      const mechanic = change({
        fieldKey: "targeting_rule",
        unit: null,
        changeType: "changed",
        before: { state: "known", value: "Đánh hàng trước, sát thương 100" },
        after: { state: "known", value: "Đánh hàng sau, sát thương 100" },
        rawText: "Thay đổi lựa chọn mục tiêu"
      });
      expect(isNoopChange(mechanic)).toBe(false);
      const res = summarizeDocumentedChanges([mechanic]);
      expect(res.summary.changedChampionCount).toBe(1);
    });

    it("9. R04-unresolved-claim-counter: claims thiếu canonical identity được tính vào unresolvedClaimCount dù có số", () => {
      const unresolvedRows = [
        change({ entityId: null, rawEntityName: "Chưa ánh xạ A", sourceLocator: "fixture:1", rawText: "Chưa ánh xạ A: 100 -> 110" }),
        change({ id: "fixture-2", entityId: null, rawEntityName: "Chưa ánh xạ B", sourceLocator: "fixture:2", rawText: "Chưa ánh xạ B: 100 -> 110" })
      ];
      const res = summarizeDocumentedChanges(unresolvedRows);
      expect(res.summary.unresolvedClaimCount).toBe(2);
    });

    it("10. R04-noop-gameplay-counter: no-op 100 -> 100 không làm tăng gameplayChangeCount", () => {
      const noopRow = change({
        before: { state: "known", value: 100 },
        after: { state: "known", value: 100 }
      });
      const res = summarizeDocumentedChanges([noopRow]);
      expect(res.summary.gameplayChangeCount).toBe(0);
    });
  });
});

it("ẩn lỗi/hiển thị và loại Double Up khỏi Standard nhưng giữ bằng chứng",()=>{
 const summary=summarizeDocumentedChanges([change({id:"m1",entityKind:"system",entityId:null,rawText:"Fixed an exploit where items became permanent"}),change({id:"m2",entityKind:"system",entityId:null,rawText:"Added a spinner graphic to loading screens"}),change({id:"m3",entityKind:"system",entityId:null,rawText:"Double Up has been reenabled"})]);
 expect(summary.visible).toHaveLength(0);expect(summary.hidden).toHaveLength(3);expect(summary.summary.hiddenMaintenanceCount).toBe(2);expect(summary.summary.hiddenOutOfScopeCount).toBe(1);
});

it("G10-05: Augment visual/cosmetic bugfix được ẩn khỏi visible và đếm vào hiddenMaintenanceCount", () => {
  const row = change({
    id: "aug-bugfix-1",
    entityKind: "augment",
    entityId: null,
    rawEntityName: "Augment Pillars",
    rawText: "Augment Pillars no longer have white boxes appearing in the icon right after acquiring an Augment"
  });
  const summary = summarizeDocumentedChanges([row]);
  expect(summary.visible).toHaveLength(0);
  expect(summary.hidden).toHaveLength(1);
  expect(summary.summary.hiddenMaintenanceCount).toBe(1);
});

