import { describe, it, expect, vi, beforeEach } from "vitest";
import { RiotTftProvider } from "@/ingestion/meta/providers/riot-tft";
import { getEliteBadgeInfo } from "@/domain/meta/elite-helper";

describe("FIN-05 & REV-04: Elite Top 200 Production Provider & Component Audit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls production RiotTftProvider and verifies topN supports 200 with upper cap 200", async () => {
    // Generate 250 challenger entries from Riot API with valid puuid (length >= 8)
    const mockEntries = Array.from({ length: 250 }, (_, i) => ({
      summonerId: `summoner_${i}`,
      puuid: `puuid_valid_hash_${i.toString().padStart(4, "0")}`,
      summonerName: `Player_${i}`,
      leaguePoints: 1200 - i,
      rank: "I",
      wins: 100,
      losses: 50
    }));

    const rawPayload = JSON.stringify({
      tier: "CHALLENGER",
      leagueId: "mock_league_id",
      queue: "RANKED_TFT",
      name: "Challenger Cohort",
      entries: mockEntries
    });

    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => rawPayload,
      headers: new Headers({ "content-type": "application/json" })
    })) as any;

    const provider = new RiotTftProvider({
      apiKey: "RGAPI-mock-key-for-audit",
      accountKeySecret: "test-audit-hmac-secret-1234567890",
      fetchImpl: mockFetch
    });

    // 1. Requesting topN = 200 slices exactly 200 (not clamped to 50!)
    const result200 = await provider.fetchCohortSnapshotWithReceipt("KR", 200);
    expect(result200.snapshot.members).toHaveLength(200);
    expect(result200.snapshot.topN).toBe(200);

    // 2. Requesting topN = 50 returns 50
    const result50 = await provider.fetchCohortSnapshotWithReceipt("KR", 50);
    expect(result50.snapshot.members).toHaveLength(50);
    expect(result50.snapshot.topN).toBe(50);

    // 3. Requesting topN = 300 is capped at 200
    const result300 = await provider.fetchCohortSnapshotWithReceipt("KR", 300);
    expect(result300.snapshot.members).toHaveLength(200);
    expect(result300.snapshot.topN).toBe(200);
  });

  it("calls production getEliteBadgeInfo and verifies verified badge is ONLY shown when ranked rows exist", () => {
    // 1. Loading state -> "Đang tải..."
    const loadingState = getEliteBadgeInfo(null, true);
    expect(loadingState.text).toBe("Đang tải...");
    expect(loadingState.isVerified).toBe(false);

    // 2. Collecting / empty state -> "Đang thu thập dữ liệu", NEVER "Dữ liệu cao thủ đã xác minh"
    const collectingState = getEliteBadgeInfo({ status: "collecting", rows: [] }, false);
    expect(collectingState.text).toBe("Đang thu thập dữ liệu");
    expect(collectingState.isVerified).toBe(false);

    const emptyNullState = getEliteBadgeInfo(null, false);
    expect(emptyNullState.text).toBe("Đang thu thập dữ liệu");
    expect(emptyNullState.isVerified).toBe(false);

    // 3. Ranked state with rows -> "Dữ liệu cao thủ đã xác minh (3 bài)"
    const readyState = getEliteBadgeInfo({ status: "ranked", rows: [{} as any, {} as any, {} as any] }, false);
    expect(readyState.text).toBe("Dữ liệu cao thủ đã xác minh (3 bài)");
    expect(readyState.isVerified).toBe(true);

    // 4. Provisional state with rows -> verified badge
    const provState = getEliteBadgeInfo({ status: "provisional", rows: [{} as any] }, false);
    expect(provState.text).toBe("Dữ liệu cao thủ đã xác minh (1 bài)");
    expect(provState.isVerified).toBe(true);
  });
});
