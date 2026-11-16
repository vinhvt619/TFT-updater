import {
  NormalizedMatch,
  MatchParticipant,
  CohortSnapshot,
  CohortMember
} from "../../../domain/meta/schemas";
import { SET18_ARCHETYPES } from "../../../domain/meta/archetypes";

/**
 * Trình tạo số giả ngẫu nhiên có Seed cố định (Mulberry32)
 * Đảm bảo fixture tái lập 100% khi chạy lại.
 */
export function createDeterministicPRNG(seed: number = 182026) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class DemoMatchProvider {
  private prng: () => number;

  constructor(seed: number = 182026) {
    this.prng = createDeterministicPRNG(seed);
  }

  /**
   * Sinh snapshot Top N Challenger mô phỏng cho khu vực
   */
  generateDemoCohort(region: string, topN: number = 50): CohortSnapshot {
    const anchor = new Date();
    anchor.setUTCHours(12, 0, 0, 0);
    const now = anchor.toISOString();
    const snapshotId = `cohort_${region.toLowerCase()}_demo_v1`;
    const members: CohortMember[] = [];
    const prefix = region.toLowerCase();

    for (let rank = 1; rank <= topN; rank++) {
      const lp = 1600 - rank * 18 + Math.floor(this.prng() * 10);
      members.push({
        snapshotId,
        accountKey: `acc_${prefix}_${rank.toString().padStart(2, "0")}`,
        puuid: `puuid_${prefix}_${rank}_demo`,
        summonerName: `${region} Pro ${rank}`,
        riotIdName: `${region} Pro ${rank}`,
        riotIdTag: region,
        rank: "CHALLENGER",
        leaguePoints: lp,
        leaderboardRank: rank
      });
    }

    return {
      id: snapshotId,
      region,
      capturedAt: now,
      topN,
      queue: "1100", // TFT Ranked Queue chuẩn
      members,
      sourceUrl: "",
      rawArtifactId: "",
      fetchedAt: now
    };
  }

  /**
   * Sinh trận đấu demo với phân bổ thứ hạng 1–8 đa dạng cho thành viên cohort
   * Bao gồm cả kết quả Top 4 và Bottom 4 (hạng 5–8)
   */
  generateDemoMatch(
    matchIndex: number,
    region: string,
    cohortMembers: CohortMember[],
    patchEpochId: string = "epoch_18_2",
    endedAtDate?: Date
  ): NormalizedMatch {
    const anchor = new Date();
    anchor.setUTCHours(12, 0, 0, 0);
    const matchEndTime = endedAtDate || new Date(anchor.getTime() - (matchIndex % 72) * 3600 * 1000);
    const matchStartTime = new Date(matchEndTime.getTime() - 1800 * 1000);
    const matchKey = `match_${region.toLowerCase()}_18_2_${matchIndex.toString().padStart(4, "0")}`;

    // Lấy 2 đến 3 thành viên cohort tham gia lobby
    const cohortCount = 2 + (matchIndex % 2); // 2 hoặc 3 thành viên
    const startIdx = (matchIndex * 3) % cohortMembers.length;
    const cohortInLobby: CohortMember[] = [];
    for (let c = 0; c < cohortCount; c++) {
      cohortInLobby.push(cohortMembers[(startIdx + c) % cohortMembers.length]);
    }

    // Định sẵn phân bổ thứ hạng cho các thành viên cohort sao cho có cả Top 4 và Bottom 4:
    // Ví dụ mẫu các kịch bản placement:
    const placementScenarios: number[][] = [
      [1, 5, 8], // 1 Top 4, 2 Bottom 4
      [2, 6, 7], // 1 Top 4, 2 Bottom 4
      [3, 4, 6], // 2 Top 4, 1 Bottom 4
      [1, 3, 5], // 2 Top 4, 1 Bottom 4
      [4, 7, 8], // 1 Top 4, 2 Bottom 4
      [2, 3, 4], // 3 Top 4 (Trận xuất sắc)
      [5, 6, 8], // 0 Top 4 (Trận thua sạch)
      [1, 4, 7]  // 2 Top 4, 1 Bottom 4
    ];
    const scenario = placementScenarios[matchIndex % placementScenarios.length];

    const participants: MatchParticipant[] = [];
    const usedPlacements = new Set<number>();

    // 1. Phân bổ thành viên cohort trước
    for (let c = 0; c < cohortInLobby.length; c++) {
      const member = cohortInLobby[c];
      const placement = scenario[c];
      usedPlacements.add(placement);

      // Phân bổ đội hình cho thành viên cohort
      const archetypeIdx = (matchIndex + c * 2) % SET18_ARCHETYPES.length;
      const archetype = SET18_ARCHETYPES[archetypeIdx];
      const isTop4 = placement <= 4;
      const carryTier = isTop4 ? (placement === 1 ? 3 : 2) : 2;

      const units: any[] = [];
      if (archetype.coreCarryChampionId) {
        units.push({
          championId: archetype.coreCarryChampionId,
          tier: carryTier,
          items: ["Guinsoo's Rageblade", "Infinity Edge"]
        });
      }
      if (archetype.coreTankChampionId) {
        units.push({
          championId: archetype.coreTankChampionId,
          tier: 2,
          items: ["Sunfire Cape", "Warmog's Armor"]
        });
      }

      for (const coreId of (archetype.coreChampionIds || []).slice(2)) {
        if (coreId) {
          units.push({
            championId: coreId,
            tier: isTop4 ? 2 : 1,
            items: []
          });
        }
      }

      participants.push({
        matchKey,
        accountKey: member.accountKey,
        riotIdName: member.summonerName,
        riotIdTag: region,
        placement,
        level: isTop4 ? 8 : 7,
        timeEliminated: isTop4 ? 1800 - placement * 40 : 1200 - placement * 30,
        totalDamageToPlayers: isTop4 ? 65000 + (5 - placement) * 10000 : 30000 + placement * 2000,
        units,
        traits: archetype.keyTraitIds.map((t) => ({
          traitId: t,
          numUnits: 4,
          tierCurrent: 2
        })),
        augments: ["Silver Augment", "Gold Augment", "Prismatic Augment"]
      });
    }

    // 2. Điền các thứ hạng còn lại cho người chơi ngoài cohort (Lobby context)
    let nonCohortIdx = 0;
    for (let p = 1; p <= 8; p++) {
      if (usedPlacements.has(p)) continue;

      const placement = p;
      const isTop4 = placement <= 4;
      const archetype = SET18_ARCHETYPES[(matchIndex + nonCohortIdx + 3) % SET18_ARCHETYPES.length];

      participants.push({
        matchKey,
        accountKey: `acc_non_cohort_${region.toLowerCase()}_${matchIndex}_${nonCohortIdx}`,
        riotIdName: `Lobby Player ${placement}`,
        riotIdTag: region,
        placement,
        level: isTop4 ? 8 : 7,
        timeEliminated: isTop4 ? 1750 - placement * 40 : 1100 - placement * 30,
        totalDamageToPlayers: isTop4 ? 55000 : 25000,
        units: [
          ...(archetype.coreCarryChampionId ? [{ championId: archetype.coreCarryChampionId, tier: isTop4 ? 2 : 1, items: ["Guinsoo's Rageblade"] }] : []),
          ...(archetype.coreTankChampionId ? [{ championId: archetype.coreTankChampionId, tier: 2, items: [] }] : [])
        ],
        traits: archetype.keyTraitIds.map((t) => ({ traitId: t, numUnits: 2, tierCurrent: 1 })),
        augments: ["Silver Augment", "Gold Augment"]
      });
      nonCohortIdx++;
    }

    // Sắp xếp lại participants theo placement tăng dần (1 -> 8)
    participants.sort((a, b) => a.placement - b.placement);

    return {
      matchKey,
      provider: "riot",
      region,
      gameMode: "ranked_standard",
      queue: "1100",
      setNumber: 18,
      patchEpochId,
      gameVersion: "Version 18.2",
      startedAt: matchStartTime.toISOString(),
      endedAt: matchEndTime.toISOString(),
      durationSeconds: 1800,
      participants,
      rawArtifactId: "",
      fetchedAt: matchEndTime.toISOString(),
      sourceDataAsOf: matchEndTime.toISOString(),
      status: "valid",
      quarantineReason: null,
      cohortAccountKeys: cohortInLobby.map((member) => member.accountKey)
    };
  }
}

export const demoMatchProvider = new DemoMatchProvider();
