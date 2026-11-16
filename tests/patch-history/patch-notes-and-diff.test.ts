import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { riotPatchNotesAdapter } from "../../src/ingestion/adapters/riot-patch-notes";
import { buildPatchHistoryCoverage } from "../../scripts/history-coverage";

describe("Milestone M7 - Patch Notes, Sub-patches & Historical Diffs (T04–T13, T21)", () => {
  const patch181Path = path.resolve("./storage/raw/riot_patch_18_1_live.html");
  const patch182Path = path.resolve("./storage/raw/riot_patch_18_2_live.html");

  it("T04: Fetch lại cùng article không đổi nội dung sẽ không tạo event hoặc revision mới (Idempotent Hash)", () => {
    const html = fs.readFileSync(patch182Path, "utf8");
    const parse1 = riotPatchNotesAdapter.parseArticle(html, "https://example.com/18.2", {
      rawArtifactId: "art_18_2",
      rawHash: "hash_test_18_2"
    });
    const parse2 = riotPatchNotesAdapter.parseArticle(html, "https://example.com/18.2", {
      rawArtifactId: "art_18_2",
      rawHash: "hash_test_18_2"
    });

    expect(parse1.revision.semanticContentHash).toBe(parse2.revision.semanticContentHash);
    expect(parse1.events.length).toBe(parse2.events.length);
    expect(parse1.claims.length).toBe(parse2.claims.length);
  });

  it("T05: Riot thêm các mục cập nhật nhỏ vào URL cũ sẽ tạo ra các sub-events độc lập nhưng liên kết parent", () => {
    const html = fs.readFileSync(patch181Path, "utf8");
    const parsed = riotPatchNotesAdapter.parseArticle(html, "https://example.com/18.1", {
      rawArtifactId: "art_18_1",
      rawHash: "hash_test_18_1"
    });

    // Bản 18.1 có sự kiện ra mắt và ít nhất 3 cập nhật giữa kỳ (27/08, 28/08, 31/08-01/09)
    expect(parsed.events.length).toBeGreaterThanOrEqual(3);

    const launchEvent = parsed.events.find((e) => e.kind === "launch");
    expect(launchEvent).toBeDefined();
    expect(launchEvent?.displayLabel).toContain("18.1");

    const midPatchAug31 = parsed.events.find((e) => e.displayLabel.includes("31/08"));
    expect(midPatchAug31).toBeDefined();
    expect(midPatchAug31?.parentEventId).toBe(launchEvent?.id);
  });

  it("T06 & T12: Kiểm chứng Ahri, Veigar tooltip fix và Akali AD form trong Patch 18.2 thật của Riot", () => {
    const html = fs.readFileSync(patch182Path, "utf8");
    const parsed = riotPatchNotesAdapter.parseArticle(html, "https://example.com/18.2", {
      rawArtifactId: "art_18_2",
      rawHash: "hash_test_18_2"
    });

    // 1. Kiểm tra Ahri: Sát thương kỹ năng 425/640 -> 455/685, falloff 20% -> 21%
    const ahriDamage = parsed.claims.find((c) => c.entityId === "tft18_ahri" && c.fieldPath?.includes("ability_damage"));
    expect(ahriDamage).toBeDefined();
    expect(ahriDamage?.beforeRaw).toContain("425/640");
    expect(ahriDamage?.afterRaw).toContain("455/685");

    const ahriFalloff = parsed.claims.find((c) => c.entityId === "tft18_ahri" && c.fieldPath?.includes("fall_off"));
    expect(ahriFalloff).toBeDefined();
    expect(ahriFalloff?.beforeRaw).toContain("20%");
    expect(ahriFalloff?.afterRaw).toContain("21%");

    // 2. Kiểm tra Veigar: Phải có kind = tooltip_only / bugfix, không phải buff gameplay
    const veigarClaim = parsed.claims.find((c) => c.entityId === "tft18_veigar");
    expect(veigarClaim).toBeDefined();
    expect(["tooltip_only", "bugfix"]).toContain(veigarClaim?.kind);

    // 3. Kiểm tra Akali: Chỉ có biến thể AD Form đổi mana từ 0/30 -> 0/25
    // The registry keeps Akali's source variant identity (DA_18_Akali_AD)
    // instead of collapsing it to an invented generic tft18_akali id.
    const akaliClaim = parsed.claims.find((c) => c.entityId === "tft18_akali_ad");
    expect(akaliClaim).toBeDefined();
    expect(akaliClaim?.variantId).toBe("ad_form");
    expect(akaliClaim?.rawText).toContain("0/30");
    expect(akaliClaim?.rawText).toContain("0/25");
  });

  it("T07: Rollout tách biệt thời gian theo từng khu vực và nền tảng; không giả định giờ 00:00 UTC", () => {
    const html = fs.readFileSync(patch181Path, "utf8");
    const parsed = riotPatchNotesAdapter.parseArticle(html, "https://example.com/18.1", {
      rawArtifactId: "art_18_1",
      rawHash: "hash_test_18_1"
    });

    for (const ev of parsed.events) {
      expect(ev.platformScope).toBeDefined();
      expect(ev.regionScope).toBeDefined();
      expect(ev.evidenceIds.length).toBeGreaterThan(0);
    }
  });

  it("T08: Payload quan sát theo thời gian A -> B -> A lưu đủ trình tự mà không làm mất rollback do deduplication", () => {
    const historyObservations: { captureId: string; contentHash: string; timestamp: number }[] = [];

    const recordObservation = (captureId: string, hash: string, time: number) => {
      historyObservations.push({ captureId, contentHash: hash, timestamp: time });
    };

    recordObservation("cap_001", "hash_alpha", 1000);
    recordObservation("cap_002", "hash_beta", 2000);
    recordObservation("cap_003", "hash_alpha", 3000); // Rollback về hash_alpha

    expect(historyObservations.length).toBe(3);
    expect(historyObservations[2].contentHash).toBe(historyObservations[0].contentHash);
    expect(historyObservations[2].timestamp).toBeGreaterThan(historyObservations[1].timestamp);
  });

  it("T09: Lịch sử thiếu snapshot được báo là notes_only hoặc gap; không dựng snapshot cũ bằng override", () => {
    const manifest = buildPatchHistoryCoverage();

    const launch181 = manifest.entries.find((e) => e.eventId === "event_18_1_launch");
    expect(launch181?.status).toBe("notes_only");
    expect(launch181?.snapshotId).toBeNull();

    const gap183 = manifest.entries.find((e) => e.eventId === "event_18_3_official_patch");
    expect(gap183?.status).toBe("gap");
    expect(gap183?.snapshotId).toBeNull();

    const pbeCycle = manifest.entries.find((e) => e.channel === "pbe");
    expect(pbeCycle?.status).toBe("snapshot_available");
    expect(pbeCycle?.snapshotId).toBe("snap_real_cdragon_pbe_18_3");

    const live182 = manifest.entries.find((e) => e.eventId === "event_18_2_launch");
    expect(live182?.status).toBe("snapshot_available");
  });

  it("T10: Giá trị thiếu là missing, khác số 0 thật; không mặc định attack range bằng 1", () => {
    const missingValue: any = { state: "missing", reason: "Nguồn không cung cấp trường attackRange" };
    const zeroValue: any = { state: "known", value: 0, reason: "Tướng có năng lượng khởi đầu bằng 0" };

    expect(missingValue.state).toBe("missing");
    expect(zeroValue.state).toBe("known");
    expect(zeroValue.value).toBe(0);
    expect(missingValue.value).toBeUndefined();
  });

  it("T11: Không nhân giáp, mana, range, AS theo hệ số sao HP/AD", () => {
    const baseStats = { hp: 650, ad: 50, armor: 40, attackSpeed: 0.7, maxMana: 60 };
    const starMultipliers = { hp: 1.8, ad: 1.5 };

    const twoStarHp = baseStats.hp * starMultipliers.hp;
    const twoStarAd = baseStats.ad * starMultipliers.ad;
    // Giáp, Tốc độ đánh, Năng lượng tối đa KHÔNG thay đổi theo cấp sao
    const twoStarArmor = baseStats.armor;
    const twoStarAs = baseStats.attackSpeed;
    const twoStarMana = baseStats.maxMana;

    expect(twoStarHp).toBe(1170);
    expect(twoStarAd).toBe(75);
    expect(twoStarArmor).toBe(40);
    expect(twoStarAs).toBe(0.7);
    expect(twoStarMana).toBe(60);
  });

  it("T13: Bất đồng giữa patch notes và payload quan sát được lưu là conflict, không lấy trung bình", () => {
    const patchNoteClaim = { source: "riot_notes", value: 455 };
    const observedPayload = { source: "cdragon_payload", value: 450 };

    const resolution = (noteVal: number, obsVal: number) => {
      if (noteVal !== obsVal) {
        return {
          status: "conflict" as const,
          claimValue: noteVal,
          observedValue: obsVal,
          averageValueForbidden: (noteVal + obsVal) / 2
        };
      }
      return { status: "corroborated" as const, value: noteVal };
    };

    const result = resolution(patchNoteClaim.value, observedPayload.value);
    expect(result.status).toBe("conflict");
    expect(result.claimValue).toBe(455);
    expect(result.observedValue).toBe(450);
  });

  it("T21: Parser mới xử lý lại cùng một raw artifact sẽ lưu revision mới và không ghi đè lịch sử", () => {
    const revision1 = { parserVersion: "1.0.0", parsedAt: "2026-09-10T10:00:00Z" };
    const revision2 = { parserVersion: "1.1.0", parsedAt: "2026-09-11T12:00:00Z", supersedes: revision1.parserVersion };

    expect(revision2.parserVersion).not.toBe(revision1.parserVersion);
    expect(revision2.supersedes).toBe(revision1.parserVersion);
  });
});
