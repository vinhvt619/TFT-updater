import { describe, it, expect } from "vitest";
import { SET18_ARCHETYPES } from "../../../src/domain/meta/archetypes";
import { classifyBoard, inferObservedCarry, calculateClassifierCoverage } from "../../../src/domain/meta/board-classifier";
import { calculateSimilarity, matchArchetype } from "../../../src/domain/meta/archetype-matching";
import { MatchParticipant } from "../../../src/domain/meta/schemas";

describe("Milestone M2 - Archetype Matching & Board Classifier", () => {
  const dravenArchetype = SET18_ARCHETYPES.find((a) => a.id === "comp_draven_reroll")!;
  const ahriArchetype = SET18_ARCHETYPES.find((a) => a.id === "comp_ahri_fast8")!;

  it("U15: Nhận diện đúng đội hình dù chủ lực chỉ 2 sao (không bắt buộc 3 sao)", () => {
    const participant: MatchParticipant = {
      matchKey: "match_01",
      accountKey: "acc_kr_01",
      riotIdName: "ChallengerKR",
      riotIdTag: "KR1",
      placement: 5, // Trận thua (top 5)
      level: 7,
      timeEliminated: 1600,
      totalDamageToPlayers: 55000,
      units: [
        { championId: "DA_Draven18", tier: 2, items: ["Guinsoo's Rageblade", "Infinity Edge"] },
        { championId: "DA_Taric18", tier: 2, items: ["Sunfire Cape"] },
        { championId: "DA_18_Hecarim", tier: 2, items: [] },
        { championId: "DA_Sentinel18", tier: 2, items: [] },
        { championId: "DA_18_Maokai", tier: 1, items: [] }
      ],
      traits: [
        { traitId: "DA_DravenUniqueTrait18", numUnits: 1, tierCurrent: 1 },
        { traitId: "DA_18_Vanguard", numUnits: 2, tierCurrent: 1 }
      ],
      augments: []
    };

    const result = classifyBoard(participant, SET18_ARCHETYPES);
    expect(result.status).toBe("matched");
    expect(result.archetypeId).toBe("comp_draven_reroll");
    expect(result.similarityScore).toBeGreaterThanOrEqual(0.70);
  });

  it("U16: Placement thay đổi nhưng bàn cờ giữ nguyên thì kết quả phân loại không đổi", () => {
    const baseUnits = [
      { championId: "DA_18_Ahri", tier: 2, items: ["Blue Buff", "Jeweled Gauntlet", "Rabadon's Deathcap"] },
      { championId: "DA_18_Sett", tier: 2, items: ["Sunfire Cape"] },
      { championId: "DA_Karma18", tier: 2, items: [] },
      { championId: "DA_18_MasterYi_AD", tier: 2, items: [] },
      { championId: "DA_18_Yorick", tier: 2, items: [] }
    ];
    const baseTraits = [
      { traitId: "DA_18_Blossom", numUnits: 4, tierCurrent: 2 },
      { traitId: "DA_18_Spellweaver", numUnits: 2, tierCurrent: 1 }
    ];

    const top1Participant: MatchParticipant = {
      matchKey: "match_win",
      accountKey: "acc_01",
      riotIdName: "Player1",
      riotIdTag: "TAG",
      placement: 1,
      level: 8,
      timeEliminated: 2100,
      totalDamageToPlayers: 95000,
      units: baseUnits,
      traits: baseTraits,
      augments: []
    };

    const top8Participant: MatchParticipant = {
      matchKey: "match_loss",
      accountKey: "acc_02",
      riotIdName: "Player2",
      riotIdTag: "TAG",
      placement: 8,
      level: 8,
      timeEliminated: 1200,
      totalDamageToPlayers: 32000,
      units: baseUnits,
      traits: baseTraits,
      augments: []
    };

    const resWin = classifyBoard(top1Participant, SET18_ARCHETYPES);
    const resLoss = classifyBoard(top8Participant, SET18_ARCHETYPES);

    expect(resWin.status).toBe(resLoss.status);
    expect(resWin.archetypeId).toBe(resLoss.archetypeId);
    expect(resWin.similarityScore).toBe(resLoss.similarityScore);
    expect(resWin.archetypeId).toBe("comp_ahri_fast8");
  });

  it("U17: Hai đội hình cùng có Sett nhưng khác carry thì không ghép sai", () => {
    // Bàn cờ Draven có Sett kẹp phụ
    const matchDraven = matchArchetype(
      SET18_ARCHETYPES,
      "DA_Draven18",
      ["DA_Draven18", "DA_Taric18", "DA_18_Hecarim", "DA_Sentinel18", "DA_18_Sett"],
      ["DA_DravenUniqueTrait18", "DA_18_Vanguard"]
    );
    expect(matchDraven.bestMatch?.archetype.id).toBe("comp_draven_reroll");

    // Bàn cờ Ahri có Sett tank chính
    const matchAhri = matchArchetype(
      SET18_ARCHETYPES,
      "DA_18_Ahri",
      ["DA_18_Ahri", "DA_18_Sett", "DA_Karma18", "DA_18_MasterYi_AD"],
      ["DA_18_Blossom", "DA_18_Spellweaver"]
    );
    expect(matchAhri.bestMatch?.archetype.id).toBe("comp_ahri_fast8");
  });

  it("U18: Người chơi chết sớm dưới 4 tướng phải unclassified, không đoán mò", () => {
    const earlyDeathParticipant: MatchParticipant = {
      matchKey: "match_early",
      accountKey: "acc_03",
      riotIdName: "EarlyDead",
      riotIdTag: "VN2",
      placement: 8,
      level: 4,
      timeEliminated: 500,
      totalDamageToPlayers: 8000,
      units: [
        { championId: "DA_18_Kobuko", tier: 1, items: [] },
        { championId: "DA_18_Sett", tier: 1, items: [] }
      ],
      traits: [{ traitId: "DA_18_Brawler", numUnits: 2, tierCurrent: 1 }],
      augments: []
    };

    const res = classifyBoard(earlyDeathParticipant, SET18_ARCHETYPES);
    expect(res.status).toBe("unclassified");
    expect(res.archetypeId).toBeNull();
  });

  it("Kiểm tra tỷ lệ bao phủ và phát hiện độ lệch (Coverage Bias) Top 4 vs Bottom 4", () => {
    const classifications = [
      { placement: 1, status: "matched" },
      { placement: 2, status: "matched" },
      { placement: 3, status: "matched" },
      { placement: 4, status: "matched" },
      { placement: 5, status: "matched" },
      { placement: 6, status: "unclassified" },
      { placement: 7, status: "matched" },
      { placement: 8, status: "unclassified" }
    ];

    const coverage = calculateClassifierCoverage(classifications);
    expect(coverage.totalCount).toBe(8);
    expect(coverage.top4ClassifiedRate).toBe(1.0); // 4/4
    expect(coverage.bottom4ClassifiedRate).toBe(0.5); // 2/4
    expect(coverage.gap).toBe(0.5);
    expect(coverage.hasCoverageBias).toBe(true); // gap > 0.15
  });
});
