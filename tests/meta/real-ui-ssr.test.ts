import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import MetaWebsitesPage from "../../src/app/meta/websites/page";
import CompDetailPage from "../../src/app/meta/comps/[archetypeId]/page";
import { GET as getCompDetail } from "../../src/app/api/v1/meta/comps/[id]/route";
import { CompRow } from "../../src/components/meta/comp-row";
import { RankingRow } from "../../src/domain/meta/schemas";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import * as sourceVerification from "../../src/server/meta/services/source-verification";

describe("Real UI SSR & Component Integrity Suite", () => {
  afterEach(() => vi.restoreAllMocks());
  it("MetaWebsitesPage SSR renders real mode with honest 2/5 sources and empty states", async () => {
    // Historical fixture acceptance uses its actual observation window, not the execution date.
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-13T13:00:00Z"));
    const pageComponent = await MetaWebsitesPage({
      searchParams: Promise.resolve({ mode: "real", patch: "epoch_18_2" })
    });

    const html = renderToStaticMarkup(pageComponent);

    // 1. Phải ghi rõ chế độ thật
    expect(html).toContain("Chế độ Dữ liệu thật (Real)");

    // 2. Phải ghi nhận đúng 3/5 nguồn xác minh (TFT Academy, tactics.tools & TFT Flex)
    expect(html).toContain("3/5 nguồn đã xác minh");
    expect(html).toContain("TFT Academy");
    expect(html).toContain("tactics.tools");
    expect(html).toContain("TFT Flex");

    // 3. Phải hiển thị link trực tiếp tới nguồn
    expect(html).toContain("https://tftacademy.com/tierlist/comps/");

    // 4. Tuyệt đối không vẽ board static giả lập cho hàng rỗng
    // Empty-board behavior is checked below with a specific empty CompRow.
  });

  it("current time marks the old fixture sources stale despite a published ranking pointer", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-13T00:00:00Z"));
    const html=renderToStaticMarkup(await MetaWebsitesPage({searchParams:Promise.resolve({mode:"real",patch:"epoch_18_2"})}));
    expect(html).toContain("0/5 nguồn đã xác minh");
    expect(html).toContain("Dữ liệu quá hạn");
    expect(html).not.toContain('data-board-shape="hex-grid-4x7"');
  });

  it("CompRow trong mode=real với recommendedBoard rỗng chỉ render honest empty state, không fallback static", () => {
    const emptyRow: RankingRow = {
      archetypeId: "comp_test_no_source",
      archetypeNameVi: "Đội hình Chưa Có Nguồn",
      archetypeNameEn: "Unverified Comp",
      tier: null,
      candidateTier: null,
      status: "collecting",
      score: null,
      confidenceScore: null,
      consensusLabel: "Chưa đủ nguồn",
      playstyle: "standard",
      recommendedBoard: [], // Bàn cờ rỗng
      coreChampionIds: [],
      coreCarryChampionId: null,
      coreTankChampionId: null,
      sourceVotes: {},
      validSourceCount: 0,
      missingSources: [],
      contradictionLevel: "none"
    } as any;

    // Render ở mode=real
    const htmlReal = renderToStaticMarkup(
      React.createElement(CompRow, {
        row: emptyRow,
        boardType: "websites",
        rankNumber: 1,
        datasetKind: "real",
        isExpanded: true
      })
    );

    // Phải render thông báo rỗng trung thực
    expect(htmlReal).toContain("Chưa có dữ liệu đội hình kiểm chứng từ nguồn");
    expect(htmlReal).toContain("Chưa có bố trí bàn cờ từ nguồn kiểm chứng thực tế");
    expect(htmlReal).toContain("Hệ thống tuân thủ nguyên tắc không suy đoán");

    // Không render ô cờ hay tướng giả lập
    expect(htmlReal).not.toContain("Sơ đồ vị trí đứng (Bàn cờ TFT 4 hàng x 7 ô)");
  });

  it("MetaWebsitesPage SSR preserves snapshotId and archive flag in detail links during archive browsing", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-13T13:00:00Z"));
    const html = renderToStaticMarkup(
      await MetaWebsitesPage({
        searchParams: Promise.resolve({
          mode: "real",
          patch: "epoch_18_2",
          snapshotId: "rank_websites_epoch_18_2_1789115824645",
          archive: "true"
        })
      })
    );

    // Links to comp detail must preserve snapshotId and archive=true
    expect(html).toContain("snapshotId=rank_websites_epoch_18_2_1789115824645");
    expect(html).toContain("archive=true");
  });

  it("CompDetailPage SSR provides backUrl preserving snapshotId, patch and archive flag", async () => {
    const html = renderToStaticMarkup(
      await CompDetailPage({
        params: Promise.resolve({ archetypeId: "comp_ahri_morgana" }),
        searchParams: Promise.resolve({
          mode: "real",
          patch: "epoch_18_2",
          snapshotId: "rank_websites_epoch_18_2_1789115824645",
          archive: "true"
        })
      })
    );

    // Back link must retain parameters
    expect(html).toContain('href="/meta/websites?mode=real&amp;patch=epoch_18_2&amp;snapshotId=rank_websites_epoch_18_2_1789115824645&amp;archive=true"');
  });

  it("CompDetail API returns 400 SCOPE_MISMATCH when snapshot patch does not match query patch", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/meta/comps/comp_ahri_morgana?mode=real&patch=epoch_18_1&snapshotId=rank_websites_epoch_18_2_1789115824645"
    );
    const res = await getCompDetail(req, {
      params: Promise.resolve({ id: "comp_ahri_morgana" })
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("SCOPE_MISMATCH");
  });

  it("CompDetail API returns 200 when snapshot patch matches query patch in archive mode", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/meta/comps/comp_ahri_morgana?mode=real&patch=epoch_18_2&snapshotId=rank_websites_epoch_18_2_1789115824645&archive=true"
    );
    const res = await getCompDetail(req, {
      params: Promise.resolve({ id: "comp_ahri_morgana" })
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.archetype).toBeDefined();
    expect(json.archetype?.id).toBe("comp_ahri_morgana");
  });

  it("CompDetailPage SSR renders verified board grid for archived snapshot, including patch label and units", async () => {
    vi.spyOn(sourceVerification, "verifySourceObservation").mockResolvedValue({
      verified: true,
      gates: { freshnessPass: true, evidencePresencePass: true }
    } as any);

    const archivedBoard = [
      { championId: "ahri", star: 2, row: 3, col: 0, items: ["item_archive_gunblade"] }
    ];
    vi.spyOn(metaRepository, "getRankingSnapshot").mockResolvedValue({
      id: "snapshot_archived_test",
      datasetKind: "real",
      publicationStatus: "published",
      status: "ranked",
      rankingScope: { patchEpochId: "epoch_18_2", boardType: "websites" },
      generatedAt: "2026-09-13T12:00:00Z",
      sourceDataAsOf: "2026-09-13T12:00:00Z",
      inputObservationIds: ["obs_archive_test"],
      warnings: [],
      totals: {},
      rows: [
        {
          archetypeId: "comp_ahri_morgana",
          archetypeNameVi: "Thần Chú Thuật Sư",
          tier: "S",
          status: "ranked",
          score: 95,
          selectedSourceBuildId: "build_archive_test",
          recommendedBoard: archivedBoard,
          sourceVotes: {}
        }
      ]
    } as any);

    vi.spyOn(metaRepository, "getLatestSourceObservations").mockResolvedValue([
      {
        id: "obs_archive_test",
        archetypeId: "comp_ahri_morgana",
        sourceId: "tftacademy",
        status: "valid",
        builds: [
          {
            id: "build_archive_test",
            units: archivedBoard.map((u) => ({
              championId: u.championId,
              starLevel: u.star,
              position: { row: u.row, col: u.col },
              items: u.items
            }))
          }
        ]
      }
    ] as any);

    const html = renderToStaticMarkup(
      await CompDetailPage({
        params: Promise.resolve({ archetypeId: "comp_ahri_morgana" }),
        searchParams: Promise.resolve({
          mode: "real",
          patch: "epoch_18_2",
          snapshotId: "snapshot_archived_test",
          archive: "true"
        })
      })
    );

    // Board title and unit layout must be rendered from snapshot
    expect(html).toContain("Bàn cờ vị trí đứng &amp; Trang bị tối ưu");
    expect(html).toContain("Sơ đồ vị trí đứng (Bàn cờ TFT 4 hàng x 7 ô)");
    expect(html).toContain("archive gunblade");
    // Patch label must be dynamic
    expect(html).toContain("18.2");
  });

  it("CompDetailPage SSR renders honest empty state and no board grid when archetype is not present in snapshot", async () => {
    vi.spyOn(metaRepository, "getRankingSnapshot").mockResolvedValue({
      id: "snapshot_archived_empty",
      datasetKind: "real",
      publicationStatus: "published",
      status: "ranked",
      rankingScope: { patchEpochId: "epoch_18_2", boardType: "websites" },
      generatedAt: "2026-09-13T12:00:00Z",
      sourceDataAsOf: "2026-09-13T12:00:00Z",
      inputObservationIds: ["obs_other"],
      warnings: [],
      totals: {},
      rows: [
        {
          archetypeId: "comp_akali_camille",
          tier: "S",
          recommendedBoard: []
        }
      ]
    } as any);

    const html = renderToStaticMarkup(
      await CompDetailPage({
        params: Promise.resolve({ archetypeId: "comp_ahri_morgana" }),
        searchParams: Promise.resolve({
          mode: "real",
          patch: "epoch_18_2",
          snapshotId: "snapshot_archived_empty",
          archive: "true"
        })
      })
    );

    // When archetype is not in the verified snapshot rows, it renders the honest empty state
    expect(html).toContain("Chưa có dữ liệu đội hình và trang bị từ nguồn");
    expect(html).not.toContain("Sơ đồ vị trí đứng (Bàn cờ TFT 4 hàng x 7 ô)");
  });

  it("CompDetailPage SSR rejects scope-mismatched snapshot by not rendering archived board", async () => {
    const html = renderToStaticMarkup(
      await CompDetailPage({
        params: Promise.resolve({ archetypeId: "comp_ahri_morgana" }),
        searchParams: Promise.resolve({
          mode: "real",
          patch: "epoch_18_1", // patch mismatch with snapshot epoch_18_2
          snapshotId: "rank_websites_epoch_18_2_1789115824645",
          archive: "true"
        })
      })
    );

    // Mismatched snapshot is rejected (rawWebSnap = null), so no verified board from that snapshot is shown
    expect(html).toContain("Chưa có dữ liệu đội hình và trang bị từ nguồn");
    expect(html).not.toContain("Sơ đồ vị trí đứng (Bàn cờ TFT 4 hàng x 7 ô)");
  });

  it("CompDetail API rejects elite snapshot when requesting websites comp detail", async () => {
    const eliteSnapId = "rank_elite_epoch_18_2_1789115824645";
    const req = new NextRequest(
      `http://localhost:3000/api/v1/meta/comps/comp_ahri_morgana?mode=real&patch=epoch_18_2&snapshotId=${eliteSnapId}&archive=true`
    );
    const res = await getCompDetail(req, {
      params: Promise.resolve({ id: "comp_ahri_morgana" })
    });
    expect([400, 404]).toContain(res.status);
  });

  it("R4-01: CompDetailPage SSR does not attach unrelated archetype evidence to verified archive board", async () => {
    vi.spyOn(sourceVerification, "verifySourceObservation").mockResolvedValue({
      verified: true,
      gates: { freshnessPass: true, evidencePresencePass: true }
    } as any);

    const archivedBoard = [
      { championId: "ahri", star: 2, row: 3, col: 0, items: ["item_archive_gunblade"] }
    ];
    vi.spyOn(metaRepository, "getRankingSnapshot").mockResolvedValue({
      id: "snapshot_archived_r4_01",
      datasetKind: "real",
      publicationStatus: "published",
      status: "ranked",
      rankingScope: { patchEpochId: "epoch_18_2", boardType: "websites" },
      generatedAt: "2026-09-13T12:00:00Z",
      sourceDataAsOf: "2026-09-13T12:00:00Z",
      inputObservationIds: ["obs_r4_01"],
      warnings: [],
      totals: {},
      rows: [
        {
          archetypeId: "comp_ahri_morgana",
          archetypeNameVi: "Thần Chú Thuật Sư",
          tier: "S",
          status: "ranked",
          score: 95,
          selectedSourceBuildId: "build_r4_01",
          recommendedBoard: archivedBoard,
          sourceVotes: {}
        }
      ]
    } as any);

    vi.spyOn(metaRepository, "getLatestSourceObservations").mockResolvedValue([
      {
        id: "obs_r4_01",
        archetypeId: "comp_ahri_morgana",
        sourceId: "tftacademy",
        status: "valid",
        builds: [
          {
            id: "build_r4_01",
            units: archivedBoard.map((u) => ({
              championId: u.championId,
              starLevel: u.star,
              position: { row: u.row, col: u.col },
              items: u.items
            }))
          }
        ]
      }
    ] as any);

    const realArch = await metaRepository.getArchetypeById("comp_ahri_morgana", "real");
    const tamperedArch = {
      ...realArch,
      variants: [
        {
          ...(realArch?.variants?.[0] || {}),
          id: "unrelated_variant",
          nameVi: "Biến thể không liên quan",
          sourceUrl: "https://example.com/unrelated-variant-source",
          evidenceId: "UNRELATED_VARIANT_EVIDENCE",
          recommendedBoard: []
        }
      ]
    };
    vi.spyOn(metaRepository, "getArchetypeById").mockResolvedValue(tamperedArch as any);

    const html = renderToStaticMarkup(
      await CompDetailPage({
        params: Promise.resolve({ archetypeId: "comp_ahri_morgana" }),
        searchParams: Promise.resolve({
          mode: "real",
          patch: "epoch_18_2",
          snapshotId: "snapshot_archived_r4_01",
          archive: "true"
        })
      })
    );

    // Bàn cờ từ snapshot lưu trữ phải hiển thị
    expect(html).toContain("Bàn cờ vị trí đứng &amp; Trang bị tối ưu");
    // Không mượn URL hay evidence của biến thể không liên quan
    expect(html).not.toContain("https://example.com/unrelated-variant-source");
    expect(html).not.toContain("UNRELATED_VARIANT_EVIDENCE");
  });

  it("R4-02: CompDetail API rejects requested buildId when row has no matching build binding", async () => {
    vi.spyOn(sourceVerification, "verifySourceObservation").mockResolvedValue({
      verified: true,
      gates: { freshnessPass: true, evidencePresencePass: true }
    } as any);

    const archivedBoard = [
      { championId: "ahri", star: 2, row: 3, col: 0, items: ["item_archive_gunblade"] }
    ];
    vi.spyOn(metaRepository, "getRankingSnapshot").mockResolvedValue({
      id: "snapshot_archived_r4_02",
      datasetKind: "real",
      publicationStatus: "published",
      status: "ranked",
      rankingScope: { patchEpochId: "epoch_18_2", boardType: "websites" },
      generatedAt: "2026-09-13T12:00:00Z",
      sourceDataAsOf: "2026-09-13T12:00:00Z",
      inputObservationIds: ["obs_r4_02"],
      warnings: [],
      totals: {},
      rows: [
        {
          archetypeId: "comp_ahri_morgana",
          archetypeNameVi: "Thần Chú Thuật Sư",
          tier: "S",
          status: "ranked",
          score: 95,
          selectedSourceBuildId: null, // Không có binding buildId
          recommendedBoard: archivedBoard,
          sourceVotes: {}
        }
      ]
    } as any);

    vi.spyOn(metaRepository, "getLatestSourceObservations").mockResolvedValue([
      {
        id: "obs_r4_02",
        archetypeId: "comp_ahri_morgana",
        sourceId: "tftacademy",
        status: "valid",
        builds: [
          {
            id: "build_some_other",
            units: archivedBoard.map((u) => ({
              championId: u.championId,
              starLevel: u.star,
              position: { row: u.row, col: u.col },
              items: u.items
            }))
          }
        ]
      }
    ] as any);

    const req = new NextRequest(
      "http://localhost:3000/api/v1/meta/comps/comp_ahri_morgana?mode=real&patch=epoch_18_2&snapshotId=snapshot_archived_r4_02&archive=true&buildId=nonexistent_build"
    );
    const res = await getCompDetail(req, {
      params: Promise.resolve({ id: "comp_ahri_morgana" })
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("SCOPE_MISMATCH");
  });

  it("R4-02: CompDetailPage SSR renders honest empty state and no board when requested buildId is not matched", async () => {
    vi.spyOn(sourceVerification, "verifySourceObservation").mockResolvedValue({
      verified: true,
      gates: { freshnessPass: true, evidencePresencePass: true }
    } as any);

    const archivedBoard = [
      { championId: "ahri", star: 2, row: 3, col: 0, items: ["item_archive_gunblade"] }
    ];
    vi.spyOn(metaRepository, "getRankingSnapshot").mockResolvedValue({
      id: "snapshot_archived_r4_02b",
      datasetKind: "real",
      publicationStatus: "published",
      status: "ranked",
      rankingScope: { patchEpochId: "epoch_18_2", boardType: "websites" },
      generatedAt: "2026-09-13T12:00:00Z",
      sourceDataAsOf: "2026-09-13T12:00:00Z",
      inputObservationIds: ["obs_r4_02b"],
      warnings: [],
      totals: {},
      rows: [
        {
          archetypeId: "comp_ahri_morgana",
          archetypeNameVi: "Thần Chú Thuật Sư",
          tier: "S",
          status: "ranked",
          score: 95,
          selectedSourceBuildId: null,
          recommendedBoard: archivedBoard,
          sourceVotes: {}
        }
      ]
    } as any);

    vi.spyOn(metaRepository, "getLatestSourceObservations").mockResolvedValue([
      {
        id: "obs_r4_02b",
        archetypeId: "comp_ahri_morgana",
        sourceId: "tftacademy",
        status: "valid",
        builds: [
          {
            id: "build_some_other",
            units: archivedBoard.map((u) => ({
              championId: u.championId,
              starLevel: u.star,
              position: { row: u.row, col: u.col },
              items: u.items
            }))
          }
        ]
      }
    ] as any);

    const html = renderToStaticMarkup(
      await CompDetailPage({
        params: Promise.resolve({ archetypeId: "comp_ahri_morgana" }),
        searchParams: Promise.resolve({
          mode: "real",
          patch: "epoch_18_2",
          snapshotId: "snapshot_archived_r4_02b",
          archive: "true",
          buildId: "nonexistent_build"
        })
      })
    );

    // Không render bàn cờ của build khác khi requested buildId không khớp
    expect(html).toContain("Chưa có dữ liệu đội hình và trang bị từ nguồn");
    expect(html).not.toContain("Sơ đồ vị trí đứng (Bàn cờ TFT 4 hàng x 7 ô)");
  });

  it("Live DB: CompDetailPage renders comp_teemo_yordle with historical snapshot without throwing", async () => {
    const comp = await CompDetailPage({
      params: Promise.resolve({ archetypeId: "comp_teemo_yordle" }),
      searchParams: Promise.resolve({
        mode: "real",
        patch: "epoch_18_2",
        snapshotId: "rank_websites_epoch_18_2_1789304905604",
        archive: "true"
      })
    });
    const html = renderToStaticMarkup(comp);
    expect(html).toContain("Quay lại Bảng xếp hạng Đội hình");
    expect(html).toContain("Bàn cờ vị trí đứng &amp; Trang bị tối ưu");
  });
});
