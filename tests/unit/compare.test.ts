import { describe, it, expect } from "vitest";
import { compareSnapshots, compareChampionRecords } from "../../src/domain/compare";
import { ChampionRecord, SnapshotPayload } from "../../src/domain/types";
import { normalizeSearchString } from "../../src/domain/identity";
import { SET18_CHAMPION_REGISTRY } from "../../src/domain/meta/set18-registry";

function createMockChampion(overrides: Partial<ChampionRecord> = {}): ChampionRecord {
  return {
    championId: "tft18_mock_champ",
    sourceApiNames: ["TFT18_MockChamp"],
    name: {
      en: { state: "known", value: "Mock Champion", sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" },
      vi: { state: "known", value: "Tướng Giả Định", sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" }
    },
    aliases: ["MockChamp"],
    cost: { state: "known", value: 3, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" },
    traitIds: { state: "known", value: ["trait_a", "trait_b"], sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" },
    icon: { state: "known", value: "/icons/mock.png", sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" },
    entityKind: "shop_champion",
    variants: [
      {
        variantKey: "base",
        label: "Cơ bản",
        stats: [
          {
            key: "health",
            labelVi: "Máu",
            labelEn: "Health",
            unit: "flat",
            contextKey: "base",
            byStar: {
              1: { state: "known", value: 800, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" },
              2: { state: "known", value: 1440, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" },
              3: { state: "known", value: 2592, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" }
            }
          },
          {
            key: "mana_max",
            labelVi: "Năng lượng tối đa",
            labelEn: "Max Mana",
            unit: "mana",
            contextKey: "base",
            byStar: {
              1: { state: "known", value: 80, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" },
              2: { state: "known", value: 80, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" },
              3: { state: "known", value: 80, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" }
            }
          }
        ],
        abilities: []
      }
    ],
    ...overrides
  };
}

function createMockSnapshot(champions: ChampionRecord[], completeness: "complete" | "partial" = "complete"): SnapshotPayload {
  return {
    schemaVersion: "1.0.0",
    datasetKind: "demo",
    setNumber: 18,
    gameMode: "standard",
    channel: "live",
    rosterCompleteness: completeness,
    fieldCoverage: {},
    champions
  };
}

describe("Diff Engine Unit Tests (Section 13.1)", () => {
  it("U01: Máu 800 -> 880: Delta +80, +10%, buff", () => {
    const c1 = createMockChampion();
    const c2 = createMockChampion();
    c2.variants[0].stats[0].byStar[1] = {
      state: "known",
      value: 880,
      sourceRefIds: ["ref-2"],
      quality: "extracted",
      origin: "source"
    };

    const diffs = compareChampionRecords(c1, c2);
    const hpDiff = diffs.find((d) => d.fieldKey === "health");
    expect(hpDiff).toBeDefined();
    expect(hpDiff!.absoluteDelta).toBe(80);
    expect(hpDiff!.relativeDeltaPercent).toBeCloseTo(10, 1);
    expect(hpDiff!.impact).toBe("buff");
  });

  it("U02: Mana tối đa 80 -> 70: Delta -10, -12.5%, buff ở field theo registry", () => {
    const c1 = createMockChampion();
    const c2 = createMockChampion();
    c2.variants[0].stats[1].byStar[1] = {
      state: "known",
      value: 70,
      sourceRefIds: ["ref-2"],
      quality: "extracted",
      origin: "source"
    };

    const diffs = compareChampionRecords(c1, c2);
    const manaDiff = diffs.find((d) => d.fieldKey === "mana_max");
    expect(manaDiff).toBeDefined();
    expect(manaDiff!.absoluteDelta).toBe(-10);
    expect(manaDiff!.relativeDeltaPercent).toBeCloseTo(-12.5, 1);
    expect(manaDiff!.impact).toBe("buff");
  });

  it("U03: Baseline 0 -> 20: Delta +20, phần trăm null, không Infinity", () => {
    const c1 = createMockChampion();
    const c2 = createMockChampion();
    c1.variants[0].stats[0].byStar[1] = {
      state: "known",
      value: 0,
      sourceRefIds: ["ref-1"],
      quality: "extracted",
      origin: "source"
    };
    c2.variants[0].stats[0].byStar[1] = {
      state: "known",
      value: 20,
      sourceRefIds: ["ref-2"],
      quality: "extracted",
      origin: "source"
    };

    const diffs = compareChampionRecords(c1, c2);
    const hpDiff = diffs.find((d) => d.fieldKey === "health");
    expect(hpDiff).toBeDefined();
    expect(hpDiff!.absoluteDelta).toBe(20);
    expect(hpDiff!.relativeDeltaPercent).toBeNull();
  });

  it("U04: Phần trăm 25 -> 30: +5 điểm phần trăm", () => {
    const c1 = createMockChampion();
    const c2 = createMockChampion();
    c1.variants[0].stats.push({
      key: "crit_chance",
      labelVi: "Tỉ lệ chí mạng",
      labelEn: "Critical Chance",
      unit: "percent",
      contextKey: "base",
      byStar: {
        1: { state: "known", value: 25, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" }
      }
    });
    c2.variants[0].stats.push({
      key: "crit_chance",
      labelVi: "Tỉ lệ chí mạng",
      labelEn: "Critical Chance",
      unit: "percent",
      contextKey: "base",
      byStar: {
        1: { state: "known", value: 30, sourceRefIds: ["ref-2"], quality: "extracted", origin: "source" }
      }
    });

    const diffs = compareChampionRecords(c1, c2);
    const critDiff = diffs.find((d) => d.fieldKey === "crit_chance");
    expect(critDiff).toBeDefined();
    expect(critDiff!.percentagePointDelta).toBe(5);
  });

  it("U06: Missing so với known 0: Availability/unknown, không buff/nerf", () => {
    const c1 = createMockChampion();
    const c2 = createMockChampion();
    c1.variants[0].stats[0].byStar[1] = {
      state: "missing",
      reason: "No data",
      sourceRefIds: []
    };
    c2.variants[0].stats[0].byStar[1] = {
      state: "known",
      value: 0,
      sourceRefIds: ["ref-2"],
      quality: "extracted",
      origin: "source"
    };

    const diffs = compareChampionRecords(c1, c2);
    const diff = diffs.find((d) => d.fieldKey === "health");
    expect(diff).toBeDefined();
    expect(diff!.kind).toBe("availability");
    expect(diff!.impact).toBe("unknown");
  });

  it("U07: Hai bên cùng missing: Không báo thay đổi gameplay", () => {
    const c1 = createMockChampion();
    const c2 = createMockChampion();
    c1.variants[0].stats[0].byStar[1] = { state: "missing", reason: "N/A", sourceRefIds: [] };
    c2.variants[0].stats[0].byStar[1] = { state: "missing", reason: "N/A", sourceRefIds: [] };

    const diffs = compareChampionRecords(c1, c2);
    const diff = diffs.find((d) => d.fieldKey === "health");
    expect(diff).toBeUndefined();
  });

  it("U08: Roster partial mất một tướng: Không kết luận removed", () => {
    const c1 = createMockChampion({ championId: "tft18_c1" });
    const snapA = createMockSnapshot([c1], "complete");
    const snapB = createMockSnapshot([], "partial");

    const result = compareSnapshots(snapA, snapB, "snap-a", "snap-b");
    const champ = result.champions.find((c) => c.championId === "tft18_c1");
    expect(champ).toBeDefined();
    expect(champ!.status).toBe("availability_changed");
  });

  it("U09: Roster đầy đủ và xóa được xác nhận: Removed có evidence/context", () => {
    const c1 = createMockChampion({ championId: "tft18_c1" });
    const snapA = createMockSnapshot([c1], "complete");
    const snapB = createMockSnapshot([], "complete");

    const result = compareSnapshots(snapA, snapB, "snap-a", "snap-b");
    const champ = result.champions.find((c) => c.championId === "tft18_c1");
    expect(champ).toBeDefined();
    expect(champ!.status).toBe("removed");
  });

  it("U10: Thứ tự trait đổi không tạo diff giả", () => {
    const c1 = createMockChampion({
      traitIds: { state: "known", value: ["trait_a", "trait_b"], sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" }
    });
    const c2 = createMockChampion({
      traitIds: { state: "known", value: ["trait_b", "trait_a"], sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" }
    });

    const diffs = compareChampionRecords(c1, c2);
    expect(diffs.find((d) => d.fieldKey === "trait_ids")).toBeUndefined();
  });

  it("U14: Chênh lệch nhỏ hơn epsilon không hiển thị đổi", () => {
    const c1 = createMockChampion();
    const c2 = createMockChampion();
    c2.variants[0].stats[0].byStar[1] = {
      state: "known",
      value: 800.00000001,
      sourceRefIds: ["ref-2"],
      quality: "extracted",
      origin: "source"
    };

    const diffs = compareChampionRecords(c1, c2);
    expect(diffs.find((d) => d.fieldKey === "health")).toBeUndefined();
  });

  it("U15: Đảo 100 -> 120 (+20%) thành 120 -> 100 (-16.67%)", () => {
    const c1 = createMockChampion();
    const c2 = createMockChampion();
    c1.variants[0].stats[0].byStar[1] = { state: "known", value: 100, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" };
    c2.variants[0].stats[0].byStar[1] = { state: "known", value: 120, sourceRefIds: ["ref-2"], quality: "extracted", origin: "source" };

    const diff1 = compareChampionRecords(c1, c2).find((d) => d.fieldKey === "health");
    expect(diff1!.relativeDeltaPercent).toBeCloseTo(20, 1);

    const diff2 = compareChampionRecords(c2, c1).find((d) => d.fieldKey === "health");
    expect(diff2!.relativeDeltaPercent).toBeCloseTo(-16.67, 1);
  });

  it("U16: Tăng máu, giảm sát thương -> Mixed", () => {
    const c1 = createMockChampion();
    const c2 = createMockChampion();
    c1.variants[0].stats.push({
      key: "attack_damage",
      labelVi: "AD",
      labelEn: "AD",
      unit: "flat",
      contextKey: "base",
      byStar: {
        1: { state: "known", value: 60, sourceRefIds: ["ref-1"], quality: "extracted", origin: "source" }
      }
    });
    c2.variants[0].stats.push({
      key: "attack_damage",
      labelVi: "AD",
      labelEn: "AD",
      unit: "flat",
      contextKey: "base",
      byStar: {
        1: { state: "known", value: 50, sourceRefIds: ["ref-2"], quality: "extracted", origin: "source" } // Nerf
      }
    });
    // HP buff
    c2.variants[0].stats[0].byStar[1] = { state: "known", value: 880, sourceRefIds: ["ref-2"], quality: "extracted", origin: "source" };

    const snapA = createMockSnapshot([c1]);
    const snapB = createMockSnapshot([c2]);
    const result = compareSnapshots(snapA, snapB, "a", "b");
    expect(result.champions[0].summaryImpact).toBe("mixed");
  });

  it("U19: Cùng snapshot A/A: 0 thay đổi, không crash", () => {
    const c1 = createMockChampion();
    const snapA = createMockSnapshot([c1]);
    const result = compareSnapshots(snapA, snapA, "a", "a");
    expect(result.summary.changedChampions).toBe(0);
    expect(result.champions[0].status).toBe("unchanged");
  });

  it("U20: Tìm kiếm không dấu và chữ đ", () => {
    expect(normalizeSearchString("Đại Tướng")).toBe("dai tuong");
    expect(normalizeSearchString("Đòn Đánh")).toBe("don danh");
    expect(normalizeSearchString("Caitlyn Bắn Tỉa")).toBe("caitlyn ban tia");
  });

  it("U21: Locale Invariance: Cùng gameplay vi_vn / en_us (khác ngôn ngữ mô tả và bản dịch) cho changedChampions = 0", () => {
    const cVi: ChampionRecord = {
      ...createMockChampion({ championId: "tft18_ahri" }),
      name: {
        en: { state: "known", value: "Ahri", sourceRefIds: ["ev-1"], quality: "extracted", origin: "source" },
        vi: { state: "known", value: "Ahri", sourceRefIds: ["ev-1"], quality: "extracted", origin: "source" }
      },
      traitIds: {
        state: "known",
        value: ["da_18_spirit", "da_18_arcanist"],
        sourceRefIds: ["ev-1"],
        quality: "extracted",
        origin: "source"
      },
      variants: [
        {
          variantKey: "base",
          label: "Cơ bản",
          stats: [
            {
              key: "health",
              labelVi: "Máu",
              labelEn: "Health",
              unit: "flat",
              contextKey: "base",
              byStar: { 1: { state: "known", value: 650, sourceRefIds: ["ev-1"], quality: "extracted", origin: "source" } }
            }
          ],
          abilities: [
            {
              abilityKey: "tft18_ahri_spell",
              name: {
                en: { state: "known", value: "Spirit Orb", sourceRefIds: ["ev-1"], quality: "extracted", origin: "source" },
                vi: { state: "known", value: "Tinh Linh Cầu", sourceRefIds: ["ev-1"], quality: "extracted", origin: "source" }
              },
              description: {
                en: { state: "known", value: "Fires an orb dealing magic damage.", sourceRefIds: ["ev-1"], quality: "extracted", origin: "source" },
                vi: { state: "known", value: "Phóng một quả cầu linh hồn gây sát thương phép.", sourceRefIds: ["ev-1"], quality: "extracted", origin: "source" }
              },
              parameters: [
                {
                  key: "magicdamage",
                  labelVi: "Sát thương phép",
                  labelEn: "Magic Damage",
                  unit: "flat",
                  contextKey: "ability",
                  byStar: {
                    1: { state: "known", value: 455, sourceRefIds: ["ev-1"], quality: "extracted", origin: "source" },
                    2: { state: "known", value: 685, sourceRefIds: ["ev-1"], quality: "extracted", origin: "source" }
                  }
                }
              ]
            }
          ]
        }
      ]
    };

    // cEn có cùng thông số gameplay nhưng mô tả tiếng Anh hoàn toàn khác văn bản tiếng Việt
    const cEn: ChampionRecord = {
      ...cVi,
      variants: [
        {
          variantKey: "base",
          label: "Base",
          stats: [
            {
              key: "health",
              labelVi: "Health",
              labelEn: "Health",
              unit: "flat",
              contextKey: "base",
              byStar: { 1: { state: "known", value: 650, sourceRefIds: ["ev-2"], quality: "extracted", origin: "source" } }
            }
          ],
          abilities: [
            {
              abilityKey: "tft18_ahri_spell",
              name: {
                en: { state: "known", value: "Spirit Orb", sourceRefIds: ["ev-2"], quality: "extracted", origin: "source" },
                vi: { state: "known", value: "Spirit Orb", sourceRefIds: ["ev-2"], quality: "extracted", origin: "source" }
              },
              description: {
                en: { state: "known", value: "English localized text with different phrasing entirely.", sourceRefIds: ["ev-2"], quality: "extracted", origin: "source" },
                vi: { state: "known", value: "Văn bản mô tả dịch thuật đã được cập nhật nhưng thông số bất biến.", sourceRefIds: ["ev-2"], quality: "extracted", origin: "source" }
              },
              parameters: [
                {
                  key: "magicdamage",
                  labelVi: "Magic Damage",
                  labelEn: "Magic Damage",
                  unit: "flat",
                  contextKey: "ability",
                  byStar: {
                    1: { state: "known", value: 455, sourceRefIds: ["ev-2"], quality: "extracted", origin: "source" },
                    2: { state: "known", value: 685, sourceRefIds: ["ev-2"], quality: "extracted", origin: "source" }
                  }
                }
              ]
            }
          ]
        }
      ]
    };

    const snapVi = createMockSnapshot([cVi]);
    const snapEn = createMockSnapshot([cEn]);
    const result = compareSnapshots(snapVi, snapEn, "snap_vi", "snap_en");

    expect(result.summary.changedChampions).toBe(0);
    expect(result.summary.buffedCount).toBe(0);
    expect(result.summary.nerfedCount).toBe(0);
    expect(result.champions[0].status).toBe("unchanged");
    expect(result.champions[0].fieldDiffs).toHaveLength(0);
  });

  describe("Group B (R03 / P1) — Khôi phục danh tính và đếm đúng thay đổi tướng", () => {
    it("74 tướng có cùng gameplay, chỉ khác alias/ảnh/nguồn -> roster 74, 0 tướng thay đổi", () => {
      // Snapshot A dùng legacy compatibility IDs (tft18_da_...) từ raw CommunityDragon ban đầu
      const snapAChampions: ChampionRecord[] = SET18_CHAMPION_REGISTRY.map((entry) => {
        const legacyId = entry.aliases.find((a) => a.startsWith("tft18_da_")) || entry.canonicalId;
        return createMockChampion({
          championId: legacyId,
          sourceApiNames: [entry.sourceApiName],
          name: {
            en: { state: "known", value: entry.nameEn, sourceRefIds: ["ev-live"], quality: "extracted", origin: "source" },
            vi: { state: "known", value: entry.nameVi, sourceRefIds: ["ev-live"], quality: "extracted", origin: "source" }
          },
          cost: { state: "known", value: entry.cost ?? 3, sourceRefIds: ["ev-live"], quality: "extracted", origin: "source" },
          traitIds: { state: "known", value: entry.traits, sourceRefIds: ["ev-live"], quality: "extracted", origin: "source" },
          icon: { state: "known", value: `https://raw.communitydragon.org/18.2/game/${legacyId}.png`, sourceRefIds: ["ev-live"], quality: "extracted", origin: "source" },
          variants: [
            {
              variantKey: "base",
              label: "Cơ bản",
              stats: [
                {
                  key: "health",
                  labelVi: "Máu",
                  labelEn: "Health",
                  unit: "flat",
                  contextKey: "base",
                  byStar: {
                    1: { state: "known", value: 650, sourceRefIds: ["ev-live"], quality: "extracted", origin: "source" }
                  }
                }
              ],
              abilities: []
            }
          ]
        });
      });

      // Snapshot B dùng canonical IDs chuẩn hóa, URL ảnh phiên bản khác, sourceRefIds khác, nhưng cùng gameplay
      const snapBChampions: ChampionRecord[] = SET18_CHAMPION_REGISTRY.map((entry) => {
        return createMockChampion({
          championId: entry.canonicalId,
          sourceApiNames: [entry.sourceApiName],
          name: {
            en: { state: "known", value: entry.nameEn, sourceRefIds: ["ev-pbe"], quality: "extracted", origin: "source" },
            vi: { state: "known", value: entry.nameVi, sourceRefIds: ["ev-pbe"], quality: "extracted", origin: "source" }
          },
          cost: { state: "known", value: entry.cost ?? 3, sourceRefIds: ["ev-pbe"], quality: "extracted", origin: "source" },
          traitIds: { state: "known", value: entry.traits, sourceRefIds: ["ev-pbe"], quality: "extracted", origin: "source" },
          icon: { state: "known", value: `https://raw.communitydragon.org/pbe/game/${entry.canonicalId}.png`, sourceRefIds: ["ev-pbe"], quality: "extracted", origin: "source" },
          variants: [
            {
              variantKey: "base",
              label: "Cơ bản",
              stats: [
                {
                  key: "health",
                  labelVi: "Máu",
                  labelEn: "Health",
                  unit: "flat",
                  contextKey: "base",
                  byStar: {
                    1: { state: "known", value: 650, sourceRefIds: ["ev-pbe"], quality: "extracted", origin: "source" }
                  }
                }
              ],
              abilities: []
            }
          ]
        });
      });

      expect(snapAChampions).toHaveLength(74);
      expect(snapBChampions).toHaveLength(74);

      const snapA = createMockSnapshot(snapAChampions);
      const snapB = createMockSnapshot(snapBChampions);

      const result = compareSnapshots(snapA, snapB, "snap_a", "snap_b");

      // Khẳng định cốt lõi R03: Khác ID lưu / replay không được gây ra 74 added + 74 removed
      expect(result.summary.totalChampions).toBe(74);
      expect(result.summary.changedChampions).toBe(0);
      expect(result.summary.buffedCount).toBe(0);
      expect(result.summary.nerfedCount).toBe(0);
      expect(result.summary.mixedCount).toBe(0);
      expect(result.summary.neutralCount).toBe(0);
      expect(result.summary.unknownCount).toBe(0);

      // Mọi tướng đều là unchanged
      expect(result.champions.every((c) => c.status === "unchanged")).toBe(true);
    });

    it("sửa đúng 1 tướng trong 74 tướng -> changedChampions = 1", () => {
      const knownNum = (value: number) => ({
        state: "known" as const,
        value,
        sourceRefIds: ["ev-test"],
        quality: "extracted" as const,
        origin: "source" as const
      });

      const snapAChampions: ChampionRecord[] = SET18_CHAMPION_REGISTRY.map((entry) =>
        createMockChampion({
          championId: entry.canonicalId,
          variants: [{ variantKey: "base", label: "Base", stats: [{ key: "health", labelVi: "Máu", labelEn: "Health", unit: "flat", contextKey: "base", byStar: { 1: knownNum(600) } }], abilities: [] }]
        })
      );
      const snapBChampions: ChampionRecord[] = SET18_CHAMPION_REGISTRY.map((entry) =>
        createMockChampion({
          championId: entry.canonicalId,
          variants: [{ variantKey: "base", label: "Base", stats: [{ key: "health", labelVi: "Máu", labelEn: "Health", unit: "flat", contextKey: "base", byStar: { 1: knownNum(600) } }], abilities: [] }]
        })
      );

      // Sửa duy nhất tướng đầu tiên (buff máu 600 -> 650)
      snapBChampions[0].variants[0].stats[0].byStar[1] = knownNum(650);

      const snapA = createMockSnapshot(snapAChampions);
      const snapB = createMockSnapshot(snapBChampions);

      const result = compareSnapshots(snapA, snapB, "snap_a", "snap_b");
      expect(result.summary.totalChampions).toBe(74);
      expect(result.summary.changedChampions).toBe(1);
      expect(result.summary.buffedCount).toBe(1);
      expect(result.summary.nerfedCount).toBe(0);
      expect(result.summary.mixedCount).toBe(0);
    });

    it("cùng 1 tướng thay đổi nhiều trường (HP buff + Mana nerf) vẫn đếm changedChampions = 1 và summaryImpact = mixed", () => {
      const knownNum = (value: number) => ({
        state: "known" as const,
        value,
        sourceRefIds: ["ev-test"],
        quality: "extracted" as const,
        origin: "source" as const
      });

      const cA = createMockChampion({
        championId: "tft18_ahri",
        variants: [
          {
            variantKey: "base",
            label: "Base",
            stats: [
              { key: "health", labelVi: "Máu", labelEn: "Health", unit: "flat", contextKey: "base", byStar: { 1: knownNum(600) } },
              { key: "mana_max", labelVi: "Mana tối đa", labelEn: "Max Mana", unit: "mana", contextKey: "base", byStar: { 1: knownNum(60) } }
            ],
            abilities: []
          }
        ]
      });

      const cB = createMockChampion({
        championId: "tft18_ahri",
        variants: [
          {
            variantKey: "base",
            label: "Base",
            stats: [
              { key: "health", labelVi: "Máu", labelEn: "Health", unit: "flat", contextKey: "base", byStar: { 1: knownNum(650) } }, // Buff (+50 HP)
              { key: "mana_max", labelVi: "Mana tối đa", labelEn: "Max Mana", unit: "mana", contextKey: "base", byStar: { 1: knownNum(80) } }  // Nerf (+20 Max Mana)
            ],
            abilities: []
          }
        ]
      });

      const snapA = createMockSnapshot([cA]);
      const snapB = createMockSnapshot([cB]);

      const result = compareSnapshots(snapA, snapB, "snap_a", "snap_b");
      expect(result.summary.totalChampions).toBe(1);
      expect(result.summary.changedChampions).toBe(1);
      expect(result.summary.mixedCount).toBe(1);
      expect(result.summary.buffedCount).toBe(0);
      expect(result.summary.nerfedCount).toBe(0);
      expect(result.champions[0].fieldDiffs).toHaveLength(2);
    });

    it("thêm (added) hoặc bớt (removed) tướng được phản ánh chính xác trong diff", () => {
      const c1 = createMockChampion({ championId: "tft18_ahri" });
      const c2 = createMockChampion({ championId: "tft18_lux" });

      // snapA chỉ có c1, snapB có cả c1 và c2 -> c2 added
      const snapA = createMockSnapshot([c1]);
      const snapB = createMockSnapshot([c1, c2]);
      const resAdd = compareSnapshots(snapA, snapB, "a", "b");

      expect(resAdd.summary.totalChampions).toBe(2);
      expect(resAdd.summary.changedChampions).toBe(1);
      const luxDiff = resAdd.champions.find((c) => c.championId === "tft18_lux");
      expect(luxDiff?.status).toBe("added");

      // Ngược lại: snapB -> snapA -> c2 removed
      const resRem = compareSnapshots(snapB, snapA, "b", "a");
      expect(resRem.summary.totalChampions).toBe(2);
      expect(resRem.summary.changedChampions).toBe(1);
      const luxRem = resRem.champions.find((c) => c.championId === "tft18_lux");
      expect(luxRem?.status).toBe("removed");
    });
  });
});
