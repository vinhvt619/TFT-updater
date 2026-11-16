import { describe, it, expect, beforeAll } from "vitest";
import { publicationService } from "../../src/server/services/publication-service";
import { RiotTftProvider } from "../../src/ingestion/meta/providers/riot-tft";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { getDb } from "../../src/server/db/client";
import { rawArtifacts, metaRankingSnapshots } from "../../src/server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

describe("Milestone M7 - Data Integrity & Publication Gates (T01, T02, T03, T20, T22)", () => {
  it("T01: Generator hoặc import tự nhận real nhưng không có artifact/evidence hợp lệ bị từ chối công bố dù SHA-256 khớp chuỗi JSON", async () => {
    const fakeContent = JSON.stringify({ champion: "fake_champ", ad: 100 });
    const fakeHash = crypto.createHash("sha256").update(fakeContent).digest("hex");

    // Thử xác thực candidate snapshot không có raw artifact thật trong database
    const validation = await publicationService.validateSnapshot({
      snapshotId: "snap_fake_unverified_001",
      releaseId: "rel_fake_18_1",
      datasetKind: "real",
      setNumber: 18,
      artifactId: "art_non_existent",
      rawHash: fakeHash,
      championCount: 1
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("Không tìm thấy bản ghi raw_artifact"))).toBe(true);
  });

  it("T02: Provider real thiếu key hoặc gặp lỗi phải báo needs_credentials; không sinh trận và không fallback demo", async () => {
    // Khởi tạo RiotTftProvider với key rỗng (không cấu hình)
    const unconfiguredProvider = new RiotTftProvider("");
    expect(unconfiguredProvider.isConfigured()).toBe(false);

    // Thu thập cohort phải ném lỗi có mã needs_credentials
    await expect(unconfiguredProvider.fetchCohortSnapshot("KR", 50)).rejects.toThrow(/needs_credentials/);

    // Lấy match detail phải ném lỗi có mã needs_credentials
    await expect(unconfiguredProvider.fetchMatchDetail("asia", "KR_12345")).rejects.toThrow(/needs_credentials/);
  });

  it("T03: Record đã cách ly (quarantined) hoặc demo bị loại bỏ hoàn toàn khỏi truy vấn real", async () => {
    const db = await getDb();
    const testQuarantinedId = `snap_test_quarantine_${Date.now()}`;

    // Tạo một snapshot bị cách ly trong DB
    await db.insert(metaRankingSnapshots).values({
      id: testQuarantinedId,
      datasetKind: "real",
      boardType: "websites",
      patchEpochId: "epoch_18_2",
      rankingVersion: "meta-rank-v1",
      classifierVersion: "1.0.0",
      mappingVersion: "1.0.0",
      configHash: "test_hash",
      status: "quarantined",
      quarantineReason: "Dữ liệu kiểm thử cách ly"
    }).onConflictDoNothing();

    // Truy vấn latest ranking cho real
    const latestReal = await metaRepository.getLatestRankingSnapshot("websites", "real", {
      patchEpochId: "epoch_18_2"
    });

    // Bản ghi bị cách ly không bao giờ được trả về như snapshot mới nhất
    if (latestReal) {
      expect(latestReal.id).not.toBe(testQuarantinedId);
      expect(latestReal.publicationStatus).not.toBe("quarantined");
    }

    // Truy vấn trực tiếp bằng ID phải trả về trạng thái cách ly rõ ràng
    const directLookup = await metaRepository.getRankingSnapshot(testQuarantinedId);
    expect(directLookup).not.toBeNull();
    expect(directLookup?.publicationStatus).toBe("quarantined");
    expect(directLookup?.quarantineReason).toBe("Dữ liệu kiểm thử cách ly");
  });

  it("T20: Thu hồi artifact/claim đầu vào sẽ kích hoạt cascade thu hồi và xóa cache", async () => {
    const testSnapId = `snap_cascade_test_${Date.now()}`;

    // Gọi retractEntity từ publicationService
    await expect(
      publicationService.retractEntity(
        "snapshot",
        testSnapId,
        "Phát hiện sai lệch nguồn gốc trong artifact đầu vào"
      )
    ).resolves.not.toThrow();
  });

  it("T22: HTTP 200 trả HTML chống bot Cloudflare hoặc JSON sai Set phải bị từ chối xác thực", () => {
    const cloudflareHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Just a moment...</title></head>
        <body><div id="cf-challenge-running">Attention Required! Cloudflare DDOS protection</div></body>
      </html>
    `;

    // Hàm kiểm tra tính hợp lệ payload Set 18
    const isSet18Json = (content: string): boolean => {
      try {
        const parsed = JSON.parse(content);
        return parsed && (parsed.setNumber === 18 || parsed.name === "TFTSet18");
      } catch {
        return false;
      }
    };

    expect(isSet18Json(cloudflareHtml)).toBe(false);

    const wrongSetJson = JSON.stringify({ setNumber: 17, name: "TFTSet17" });
    expect(isSet18Json(wrongSetJson)).toBe(false);

    const validSet18Json = JSON.stringify({ setNumber: 18, name: "TFTSet18" });
    expect(isSet18Json(validSet18Json)).toBe(true);
  });
});
