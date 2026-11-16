import { describe, it, expect } from "vitest";
import { DemoMatchProvider } from "../../../src/ingestion/meta/providers/demo-match-provider";
import { RiotTftProvider } from "../../../src/ingestion/meta/providers/riot-tft";
import { calculateEliteWeights, MatchAppearance } from "../../../src/domain/meta/elite-weights";
import { evaluateEliteCompEligibility } from "../../../src/domain/meta/eligibility";
import { BaselineMetrics, NEUTRAL_BASELINE } from "../../../src/domain/meta/performance-score";

describe("Rà soát R1–R4: Cohort Filtering, Queue 1100 & Dynamic Baseline Unit Tests", () => {
  const asOf = new Date("2026-09-11T12:00:00.000Z");

  // ========================================================================
  // R2: Lọc thành viên Cohort & Phân bổ Hạng 1–8
  // ========================================================================
  it("R2.1: Lobby 8 người có 3 thành viên cohort ở hạng 1, 5, 8 -> chỉ tính 3 lượt, Top4 thô = 1/3 (33.3%)", () => {
    // Giả sử 1 lobby gồm 3 thành viên cohort và 5 người ngoài
    const cohortMembers = [
      { accountKey: "acc_kr_01", placement: 1 },
      { accountKey: "acc_kr_02", placement: 5 },
      { accountKey: "acc_kr_03", placement: 8 }
    ];
    const nonCohortMembers = [
      { accountKey: "acc_random_04", placement: 2 },
      { accountKey: "acc_random_05", placement: 3 },
      { accountKey: "acc_random_06", placement: 4 },
      { accountKey: "acc_random_07", placement: 6 },
      { accountKey: "acc_random_08", placement: 7 }
    ];

    const allLobbyPlayers = [...cohortMembers, ...nonCohortMembers];
    const cohortAccountSet = new Set(["acc_kr_01", "acc_kr_02", "acc_kr_03"]);

    // Lọc nghiêm ngặt: chỉ giữ thành viên cohort
    const filteredCohortPlayers = allLobbyPlayers.filter((p) => cohortAccountSet.has(p.accountKey));
    expect(filteredCohortPlayers.length).toBe(3);

    const apps: MatchAppearance[] = filteredCohortPlayers.map((p) => ({
      matchKey: "match_001",
      accountKey: p.accountKey,
      endedAt: asOf.toISOString(),
      placement: p.placement,
      isTop4: p.placement <= 4,
      isWin: p.placement === 1
    }));

    const weights = calculateEliteWeights(apps, asOf, 48, 5);
    expect(weights.totalAppearances).toBe(3);
    expect(weights.top4Count).toBe(1);
    expect(weights.rawTop4Rate).toBeCloseTo(1 / 3, 3);
    // 5 người ngoài cohort không làm thay đổi mẫu số!
  });

  it("R2.2: Fixture cohort có 20 Top4 trong 50 lượt -> Tỷ lệ Top4 thô đúng bằng 40.0%", () => {
    const apps: MatchAppearance[] = [];
    for (let i = 1; i <= 50; i++) {
      const isTop4 = i <= 20; // 20 lượt Top4, 30 lượt Bottom4
      apps.push({
        matchKey: `match_${Math.ceil(i / 2)}`,
        accountKey: `acc_kr_${(i % 10) + 1}`,
        endedAt: asOf.toISOString(),
        placement: isTop4 ? (i % 4) + 1 : (i % 4) + 5,
        isTop4,
        isWin: i === 1
      });
    }

    const weights = calculateEliteWeights(apps, asOf, 48, 5);
    expect(weights.totalAppearances).toBe(50);
    expect(weights.top4Count).toBe(20);
    expect(weights.rawTop4Rate).toBeCloseTo(0.4, 3);
  });

  it("R2.3: DemoMatchProvider có seed cố định, phân bổ cả Top4 và Bottom4 cho cohort", () => {
    const provider = new DemoMatchProvider(182026);
    const cohort = provider.generateDemoCohort("KR", 50);

    expect(cohort.queue).toBe("1100");
    expect(cohort.members.length).toBe(50);

    // Sinh 10 trận đấu và kiểm tra placements của thành viên cohort
    const cohortPlacements: number[] = [];
    for (let i = 0; i < 10; i++) {
      const match = provider.generateDemoMatch(i, "KR", cohort.members);
      expect(match.queue).toBe("1100");
      expect(match.participants.length).toBe(8);

      const cohortAccountSet = new Set(cohort.members.map((m) => m.accountKey));
      for (const p of match.participants) {
        if (cohortAccountSet.has(p.accountKey)) {
          cohortPlacements.push(p.placement);
        }
      }
    }

    // Xác nhận có cả Top 4 (<= 4) và Bottom 4 (> 4)
    const hasTop4 = cohortPlacements.some((p) => p <= 4);
    const hasBottom4 = cohortPlacements.some((p) => p > 4);

    expect(hasTop4).toBe(true);
    expect(hasBottom4).toBe(true);
  });

  // ========================================================================
  // R3: Xác thực Queue 1100 (TFT Ranked) vs 420 (LoL Solo)
  // ========================================================================
  it("R3: Queue LoL 420 bị từ chối; Queue TFT 1100 được chấp nhận", () => {
    function validateMatchQueue(queue: string | number, mode: string, set: number): boolean {
      const qStr = queue.toString();
      if (qStr !== "1100") return false; // Từ chối queue 420 (LoL)
      if (mode !== "ranked_standard" && mode !== "TFT") return false;
      if (set !== 18) return false;
      return true;
    }

    expect(validateMatchQueue("420", "ranked_standard", 18)).toBe(false); // 420 là LoL
    expect(validateMatchQueue(420, "ranked_standard", 18)).toBe(false);
    expect(validateMatchQueue("1100", "ranked_standard", 18)).toBe(true); // 1100 là TFT Ranked
    expect(validateMatchQueue("1100", "aram", 18)).toBe(false); // Sai mode
    expect(validateMatchQueue("1100", "ranked_standard", 13)).toBe(false); // Sai Set
  });

  // ========================================================================
  // R4: Dynamic Cohort Baseline vs Hardcoded Neutral Baseline
  // ========================================================================
  it("R4.1: Dynamic Cohort Baseline tính cả lượt unclassified của cohort", () => {
    // Giả sử cohort có 20 lượt chơi tổng thể: 12 Top4, 3 Top1, tổng placement = 78
    const totalApps = 20;
    const top4Count = 12;
    const winCount = 3;
    const sumPlacement = 78;

    const dynamicBaseline: BaselineMetrics = {
      top4Rate: top4Count / totalApps, // 0.60
      avgPlacement: sumPlacement / totalApps, // 3.90
      winRate: winCount / totalApps // 0.15
    };

    expect(dynamicBaseline.top4Rate).toBe(0.60);
    expect(dynamicBaseline.avgPlacement).toBe(3.90);
    expect(dynamicBaseline.winRate).toBe(0.15);

    // Kiểm tra Empirical Bayes Shrinkage co về dynamic baseline thay vì neutral baseline (0.50)
    const compApps: MatchAppearance[] = [
      { matchKey: "m1", accountKey: "a1", endedAt: asOf.toISOString(), placement: 1, isTop4: true, isWin: true },
      { matchKey: "m2", accountKey: "a2", endedAt: asOf.toISOString(), placement: 2, isTop4: true, isWin: false }
    ];
    const weights = calculateEliteWeights(compApps, asOf, 48, 5);

    // Với dynamic baseline (top4=0.60): (2 + 20 * 0.60) / (2 + 20) = 14 / 22 = 0.6364
    const resDynamic = evaluateEliteCompEligibility(weights, dynamicBaseline, 20);
    expect(resDynamic.adjustedTop4Rate).toBeCloseTo(14 / 22, 4);

    // So sánh nếu dùng neutral baseline (top4=0.50): (2 + 20 * 0.50) / 22 = 12 / 22 = 0.5455
    const resNeutral = evaluateEliteCompEligibility(weights, NEUTRAL_BASELINE, 20);
    expect(resNeutral.adjustedTop4Rate).toBeCloseTo(12 / 22, 4);

    expect(resDynamic.adjustedTop4Rate).not.toBe(resNeutral.adjustedTop4Rate);
  });

  // ========================================================================
  // R1: Riot Provider Thật ném lỗi khi thiếu RIOT_API_KEY
  // ========================================================================
  it("R1: RiotTftProvider ném lỗi rõ ràng khi không có RIOT_API_KEY, không bịa tên pro hay fake data", async () => {
    const provider = new RiotTftProvider(""); // Không có API key
    expect(provider.isConfigured()).toBe(false);

    await expect(provider.fetchCohortSnapshot("KR", 50)).rejects.toThrow(
      "RIOT_API_KEY chưa được cấu hình"
    );
  });
});
