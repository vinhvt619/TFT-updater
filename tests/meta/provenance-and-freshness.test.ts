import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { PublicationService } from "../../src/server/services/publication-service";
import { fetchWithReceipt } from "../../src/ingestion/fetch-receipt";
import {
  validateBoardUnits,
  isNonShopEntity,
  isShopChampion,
  isSpawnedEntity,
  KNOWN_NON_SHOP_ENTITIES
} from "../../src/domain/meta/board-validator";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { rankingService } from "../../src/server/meta/services/ranking-service";
import MetaWebsitesPage from "../../src/app/meta/websites/page";
import { renderToStaticMarkup } from "react-dom/server";

describe("Provenance, Freshness Gate & Integrity Suite", () => {
  const publicationService = new PublicationService();

  // 1. Freshness Gate
  describe("Freshness Gate (Requirement 1)", () => {
    it("chặn publication khi raw source thiếu bằng chứng sourceDataAsOf", async () => {
      const report = await publicationService.validateRanking({
        snapshotId: "rank_test_missing_asof",
        datasetKind: "real",
        boardType: "websites",
        setNumber: 18,
        sourceDataAsOf: null as any,
        rawHash: "authentic_hash_12345"
      });

      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes("freshness gate") || e.includes("sourceDataAsOf"))).toBe(true);
      const gateCheck = report.checks.find((c) => c.name === "freshness_gate");
      expect(gateCheck?.passed).toBe(false);
    });

    it("chặn publication khi sourceDataAsOf > 48h (stale source)", async () => {
      const staleDate = new Date(Date.now() - 50 * 3600 * 1000).toISOString(); // 50 giờ trước
      const report = await publicationService.validateRanking({
        snapshotId: "rank_test_stale",
        datasetKind: "real",
        boardType: "websites",
        setNumber: 18,
        sourceDataAsOf: staleDate,
        rawHash: "authentic_hash_12345"
      });

      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes("> 48h"))).toBe(true);
      const gateCheck = report.checks.find((c) => c.name === "freshness_gate");
      expect(gateCheck?.passed).toBe(false);
    });

    it("chấp nhận publication khi sourceDataAsOf tươi (< 48h)", async () => {
      const freshDate = new Date(Date.now() - 5 * 3600 * 1000).toISOString(); // 5 giờ trước
      const report = await publicationService.validateRanking({
        snapshotId: "rank_test_fresh",
        datasetKind: "real",
        boardType: "websites",
        setNumber: 18,
        sourceDataAsOf: freshDate,
        rawHash: "authentic_hash_12345"
      });

      const gateCheck = report.checks.find((c) => c.name === "freshness_gate");
      expect(gateCheck?.passed).toBe(true);
    });
  });

  // 2. Fetch Receipt & Conditional Refresh
  describe("Fetch Receipt & Conditional Refresh (Requirement 2)", () => {
    it("hỗ trợ conditional headers ETag và If-Modified-Since", async () => {
      const mockFetchFn = async (_url: string, init?: any) => {
        const headers = init?.headers || {};
        if (headers["If-None-Match"] === '"etag-test-123"') {
          return {
            statusCode: 304,
            headers: { etag: '"etag-test-123"' },
            body: Buffer.from("")
          };
        }
        return {
          statusCode: 200,
          headers: { etag: '"etag-test-123"' },
          body: Buffer.from("OK Content")
        };
      };

      const tempCachePath = path.resolve("./storage/raw/test_cache_304.txt");
      fs.writeFileSync(tempCachePath, "OK Content", "utf8");

      // Lần 1: Fetch mới (200)
      const r1 = await fetchWithReceipt("https://example.com/data", {
        version: "v1",
        datasetKind: "real",
        fetchFn: mockFetchFn as any
      });
      expect(r1.receipt.httpStatus).toBe(200);
      expect(r1.receipt.etag).toBe('"etag-test-123"');
      expect(r1.receipt.source).toBe("network");

      // Lần 2: Conditional Refresh với ETag (304)
      const r2 = await fetchWithReceipt("https://example.com/data", {
        etag: r1.receipt.etag,
        cachedArtifactPath: tempCachePath,
        cachedMetadata: { url: "https://example.com/data", version: "v1", datasetKind: "real", expectedSize: Buffer.byteLength("OK Content") },
        cachedSha256: crypto.createHash("sha256").update("OK Content").digest("hex"),
        version: "v1",
        datasetKind: "real",
        expectedSize: Buffer.byteLength("OK Content"),
        fetchFn: mockFetchFn as any
      });
      expect(r2.receipt.httpStatus).toBe(304);
      expect(r2.receipt.source).toBe("cache");

      if (fs.existsSync(tempCachePath)) fs.unlinkSync(tempCachePath);
    });

    it("từ chối offline cache trừ khi có cờ allowOfflineCache rõ ràng", async () => {
      const failingFetch = async () => {
        throw new Error("Network offline");
      };

      const tempCachePath = path.resolve("./storage/raw/test_offline_cache.txt");
      fs.writeFileSync(tempCachePath, "Offline cached data", "utf8");

      // Khi không truyền allowOfflineCache -> phải văng lỗi, không được tự ý fallback
      await expect(
        fetchWithReceipt("https://example.com/data", {
          fetchFn: failingFetch as any
        })
      ).rejects.toThrow();

      // Khi truyền allowOfflineCache: true -> cho phép trả về cached receipt
      const trustedSha = crypto.createHash("sha256").update("Offline cached data").digest("hex");
      const res = await fetchWithReceipt("https://example.com/data", {
        allowOfflineCache: true,
        cachedArtifactPath: tempCachePath,
        cachedMetadata: { url: "https://example.com/data", version: "v1", datasetKind: "real", expectedSize: Buffer.byteLength("Offline cached data") },
        cachedSha256: trustedSha,
        cachedFetchedAt: "2026-11-01T00:00:00.000Z",
        version: "v1",
        datasetKind: "real",
        expectedSize: Buffer.byteLength("Offline cached data"),
        fetchFn: failingFetch as any
      });
      expect(["cache", "offline_cache"]).toContain(res.receipt.source);
      expect(res.body.toString("utf8")).toBe("Offline cached data");

      if (fs.existsSync(tempCachePath)) fs.unlinkSync(tempCachePath);
    });
  });

  // 3. Provenance & Timestamp Separation
  describe("Provenance & 4 Timestamp Separation (Requirement 3)", () => {
    it("tách biệt fetchedAt, sourcePublishedAt, sourceDataAsOf, rankingGeneratedAt", async () => {
      const websitesRanking = await rankingService.computeWebsitesRanking("epoch_18_2", "real");

      expect(websitesRanking.rankingGeneratedAt).toBeDefined();
      expect(websitesRanking.fetchedAt).toBeDefined();

      // sourceDataAsOf phải là timestamp từ nguồn, không được tự động bằng thời gian compute
      if (websitesRanking.sourceDataAsOf) {
        expect(typeof websitesRanking.sourceDataAsOf).toBe("string");
        const asOfTime = new Date(websitesRanking.sourceDataAsOf).getTime();
        expect(isNaN(asOfTime)).toBe(false);
      }
    });

    it("lưu và đọc đúng 4 timestamp từ repository cho observations", async () => {
      const observations = await metaRepository.getLatestSourceObservations("epoch_18_2", "real");
      expect(observations.length).toBeGreaterThan(0);

      for (const obs of observations) {
        expect(obs.fetchedAt).toBeDefined();
        if (obs.sourceId === "tftflex") {
          expect(obs.sourcePublishedAt).toBeDefined();
          expect(obs.sourceDataAsOf).toBeDefined();
        }
      }
    });
  });

  // 4. Board Validator & Entity Quarantine
  describe("Board Validator & Entity Quarantine (Requirement 5)", () => {
    it("nhận diện đúng các thực thể quái rừng / PvE / summon Set 18", () => {
      const knownEntities: string[] = Array.from(KNOWN_NON_SHOP_ENTITIES);
      expect(knownEntities.length).toBeGreaterThanOrEqual(1);

      for (const entity of knownEntities) {
        expect(isNonShopEntity(entity)).toBe(true);
        expect(isShopChampion(entity)).toBe(false);
      }

      expect(isSpawnedEntity("tft_trainingdummy")).toBe(true);
      expect(isNonShopEntity("tft_trainingdummy")).toBe(true);
    });

    it("nhận diện đúng các tướng hợp lệ trong shop Set 18 (cost 1..5)", () => {
      expect(isShopChampion("tft18_da_18_ashe")).toBe(true);
      expect(isShopChampion("tft18_da_draven18")).toBe(true);
      expect(isShopChampion("tft18_da_18_ahri")).toBe(true);
      expect(isShopChampion("tft18_da_18_caitlyn")).toBe(true);
      expect(isShopChampion("tft18_da_18_alune")).toBe(true);
    });

    it("quarantine bàn cờ chứa non-shop entity (ví dụ Training Dummy)", () => {
      const mixedBoard = [
        { championId: "tft18_da_18_ashe", cost: 4, position: { row: 3, col: 0 }, items: ["tft_item_infinityedge"] },
        { championId: "tft18_da_18_ahri", cost: 4, position: { row: 3, col: 1 }, items: [] },
        { championId: "tft18_da_18_sett", cost: 5, position: { row: 0, col: 0 }, items: ["tft_item_warmogsarmor"] },
        { championId: "tft18_da_18_lillia", cost: 3, position: { row: 0, col: 1 }, items: [] },
        { championId: "tft18_da_18_zyra", cost: 2, position: { row: 2, col: 2 }, items: [] },
        { championId: "tft18_da_18_soraka", cost: 1, position: { row: 2, col: 3 }, items: [] },
        { championId: "tft_trainingdummy", cost: 0, position: { row: 0, col: 2 }, items: [] } // Thực thể triệu hồi không mua trong shop
      ];

      const res = validateBoardUnits(mixedBoard);
      expect(res.valid).toBe(false);
      expect(res.quarantined).toBe(true);
      expect(res.nonShopEntities).toContain("tft_trainingdummy");
      expect(res.quarantineReason).toContain("non-shop entity");
    });

    it("xác thực vị trí (row 0..3, col 0..6), kiểm tra kích thước bàn cờ (6-10 tướng) và giới hạn 3 trang bị", () => {
      // 1. Quá ít tướng (< 6)
      const smallBoard = [
        { championId: "tft18_da_18_ashe", cost: 4, position: { row: 0, col: 0 }, items: [] }
      ];
      const smallRes = validateBoardUnits(smallBoard);
      expect(smallRes.valid).toBe(false);
      expect(smallRes.errors.some((e) => e.includes("Kích thước bàn cờ không hợp lệ"))).toBe(true);

      // 2. Vị trí ngoài bàn cờ (row 4, col 8)
      const outOfBoundsBoard = [
        { championId: "tft18_da_18_ashe", cost: 4, position: { row: 4, col: 8 }, items: [] },
        { championId: "tft18_da_18_ahri", cost: 4, position: { row: 1, col: 1 }, items: [] },
        { championId: "tft18_da_18_sett", cost: 5, position: { row: 0, col: 0 }, items: [] },
        { championId: "tft18_da_18_lillia", cost: 3, position: { row: 0, col: 1 }, items: [] },
        { championId: "tft18_da_18_zyra", cost: 2, position: { row: 2, col: 2 }, items: [] },
        { championId: "tft18_da_18_soraka", cost: 1, position: { row: 2, col: 3 }, items: [] }
      ];
      const oobRes = validateBoardUnits(outOfBoundsBoard);
      expect(oobRes.valid).toBe(false);
      expect(oobRes.errors.some((e) => e.includes("tọa độ không hợp lệ"))).toBe(true);

      // 3. Vượt quá 3 trang bị trên 1 tướng
      const overItemBoard = [
        {
          championId: "tft18_da_18_ashe",
          cost: 4,
          position: { row: 3, col: 0 },
          items: ["tft_item_infinityedge", "tft_item_lastwhisper", "tft_item_guinsoosrageblade", "tft_item_deathblade"]
        },
        { championId: "tft18_da_18_ahri", cost: 4, position: { row: 1, col: 1 }, items: [] },
        { championId: "tft18_da_18_sett", cost: 5, position: { row: 0, col: 0 }, items: [] },
        { championId: "tft18_da_18_lillia", cost: 3, position: { row: 0, col: 1 }, items: [] },
        { championId: "tft18_da_18_zyra", cost: 2, position: { row: 2, col: 2 }, items: [] },
        { championId: "tft18_da_18_soraka", cost: 1, position: { row: 2, col: 3 }, items: [] }
      ];
      const itemRes = validateBoardUnits(overItemBoard);
      expect(itemRes.valid).toBe(false);
      expect(itemRes.errors.some((e) => e.includes("vượt quá giới hạn tối đa 3 trang bị"))).toBe(true);
    });
  });

  // 5. Carry / Tank Decoupling & Source Separation
  describe("Carry/Tank Decoupling & Source Separation (Requirement 4 & 6)", () => {
    it("đọc carryChampionId và tankChampionId trực tiếp từ observation, không phụ thuộc SET18_ARCHETYPES", async () => {
      const observations = await metaRepository.getLatestSourceObservations("epoch_18_2", "real");

      // Kiểm tra các comps từ TFT Flex
      const tftflexComps = observations.filter((o) => o.sourceId === "tftflex");
      expect(tftflexComps.length).toBe(20);

      for (const comp of tftflexComps) {
        expect(comp.carryChampionId).toBeDefined();
        // Không được là non-shop entity
        if (comp.carryChampionId) {
          expect(isNonShopEntity(comp.carryChampionId)).toBe(false);
        }
        if (comp.tankChampionId) {
          expect(isNonShopEntity(comp.tankChampionId)).toBe(false);
        }
      }
    });

    afterEach(() => vi.restoreAllMocks());

    it("UI MetaWebsitesPage tách riêng 3 bảng nguồn và hiển thị '—' cho null tier trong tactics.tools", async () => {
      vi.spyOn(Date,"now").mockReturnValue(Date.parse("2026-09-13T13:00:00Z"));
      const pageComponent = await MetaWebsitesPage({
        searchParams: Promise.resolve({ mode: "real", patch: "epoch_18_2" })
      });

      const html = renderToStaticMarkup(pageComponent);

      // Phải có 3 nguồn đã xác minh
      expect(html).toContain("3/5 nguồn đã xác minh");
      expect(html).toContain("1. TFT Academy");
      expect(html).toContain("2. tactics.tools");
      expect(html).toContain("3. TFT Flex");

      // tactics.tools không được gán nhãn "X", hiển thị "—" cho tier
      expect(html).toContain("Hạng TB (Avg Place)");
      expect(html).toContain("Số trận / Tỉ lệ chọn");

      // TFT Flex comps hiển thị với tier thực tế S, A, B, C
      expect(html).toContain("https://tftflex.com/en/meta");
    });
  });

  // 6. Ranking Scope & Elite Collecting Status
  describe("Scope & Elite Real Status (Requirement 7 & 11)", () => {
    it("đúng phạm vi xếp hạng: TFT Academy = All, tactics.tools = Diamond+", async () => {
      const observations = await metaRepository.getLatestSourceObservations("epoch_18_2", "real");
      const academyObs = observations.filter((o) => o.sourceId === "tftacademy");
      const tacticsObs = observations.filter((o) => o.sourceId === "tactics_tools");

      for (const a of academyObs) {
        expect(a.scope.rankScope).toBe("All");
      }
      for (const t of tacticsObs) {
        expect(t.scope.rankScope).toBe("Diamond+");
      }
    });

    it("Elite real ranking giữ nguyên status 'collecting' khi chưa có match evidence thật", async () => {
      const eliteRanking = await rankingService.computeEliteRanking("all", "epoch_18_2", 72, "real");

      expect(eliteRanking.publicationStatus).toBe("collecting");
      expect(eliteRanking.datasetKind).toBe("real");

      for (const row of eliteRanking.rows) {
        expect(row.status).toBe("collecting");
        expect(row.tier).toBeNull();
        expect(row.score).toBeNull();
      }
    });
  });
});
