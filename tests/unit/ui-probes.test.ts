import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { describe, it, expect, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  artifacts: [] as any[],
  evidence: [] as any[],
  snapshots: [] as any[],
  queries: 0
}));

vi.mock("@/server/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/client")>();
  return {
    ...actual,
    closeDb: vi.fn(async () => {}),
    getDb: vi.fn(async () => ({
      select: () => ({
        from: (table: any) => ({
          where: () => ({
            limit: async () => {
              dbMock.queries++;
              const name = table[Symbol.for("drizzle:Name")];
              if (name === "raw_artifacts") return dbMock.artifacts;
              if (name === "meta_source_snapshots") return dbMock.snapshots;
              return dbMock.evidence;
            }
          })
        })
      })
    }))
  };
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TftBoardGrid } from "../../src/components/meta/tft-board-grid";
import { CompRow } from "../../src/components/meta/comp-row";
import { BoardUnit } from "../../src/domain/meta/schemas";
import MetaWebsitesPage from "../../src/app/meta/websites/page";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { SET18_CHAMPION_REGISTRY, resolveSet18Champion } from "../../src/domain/meta/set18-registry";
import {
  verifySourceObservation,
  resolveRawArtifact,
  resolveEvidenceRefs,
  KNOWN_PROVIDER_ARTIFACTS,
  KNOWN_GUIDE_ARTIFACTS
} from "../../src/server/meta/services/source-verification";

describe("UI and server rendering regressions", () => {
  const entry = SET18_CHAMPION_REGISTRY.find(
    (x) => x.traits.length > 0 && x.aliases.some((a) => a !== x.canonicalId && resolveSet18Champion(a)?.canonicalId === x.canonicalId)
  )!;
  const alias = entry.aliases.find((a) => a !== entry.canonicalId && resolveSet18Champion(a)?.canonicalId === entry.canonicalId)!;

  const unit = (championId: string, col: number) => ({
    championId,
    items: [],
    position: { row: 0, col },
    nameVi: entry.nameVi,
    cost: entry.cost,
    starLevel: null
  });

  const renderBoard = (units: any[]) => renderToStaticMarkup(React.createElement(TftBoardGrid, { boardUnits: units, showItemList: false }));
  const traitBar = (html: string) => html.slice(0, html.indexOf("Sơ đồ vị trí đứng"));
  const countBar = (html: string) =>
    Array.from(traitBar(html).matchAll(/text-\[10px\] px-1 rounded bg-black\/40 text-slate-400 font-mono">([0-9]+)/g), (m) => Number(m[1]));

  it("R05-exact-id-dedupe: hai quân cùng chuỗi ID chỉ tính 1 mốc kích hoạt", () => {
    const duplicateHtml = renderBoard([unit(entry.canonicalId, 0), unit(entry.canonicalId, 1)]);
    expect(countBar(duplicateHtml)).toEqual(Array(entry.traits.length).fill(1));
  });

  it("R05-unplaced-exclusion: quân chưa đặt ngoài bàn cờ không tính vào traits trên sân", () => {
    const unplacedHtml = renderBoard([unit(entry.canonicalId, 99)]);
    expect(countBar(unplacedHtml)).toEqual([]);
  });

  it("R05-canonical-alias-dedupe: hai quân alias khác chuỗi nhưng cùng canonical ID chỉ tính 1 mốc kích hoạt", () => {
    const aliasHtml = renderBoard([unit(entry.canonicalId, 0), unit(alias, 1)]);
    expect(countBar(aliasHtml)).toEqual(Array(entry.traits.length).fill(1));
  });

  describe("R09 Source Verification Gate & Evidence Lineage", () => {
    it("resolveRawArtifact & resolveEvidenceRefs: positive control resolve thật, arbitrary ID không resolve", async () => {
      // Positive controls
      const artPos = await resolveRawArtifact("art_tftacademy_18_2");
      expect(artPos.resolved).toBe(true);

      const evPos = await resolveEvidenceRefs(["ev_tftacademy_18_2"], "tftacademy");
      expect(evPos.resolved).toBe(true);

      // Negative controls (arbitrary dangling IDs trong kiểm thử)
      const artNeg = await resolveRawArtifact("art_7f91a3");
      expect(artNeg.resolved).toBe(false);

      const evNeg = await resolveEvidenceRefs(["ev_7f91a3"], "metatft");
      expect(evNeg.resolved).toBe(false);
    });

    it("R09 SSR: positive control có bằng chứng thật tăng verifiedCount=1; ca generic dangling / stale / rỗng giữ 0/5", async () => {
      const originalRanking = metaRepository.getLatestRankingSnapshot;
      const originalObservations = metaRepository.getLatestSourceObservations;
      (metaRepository as any).getLatestRankingSnapshot = async () => null;

      const now = new Date().toISOString();

      // 1. Positive Control: observation thật có raw artifact và evidence hợp lệ
      const positiveFixture: any = {
        id: "obs_tftacademy_pos_control",
        datasetKind: "real",
        sourceId: "tftacademy",
        sourceCompId: "set-18-dragon-princess",
        sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-dragon-princess",
        scope: { patchEpochId: "epoch_18_2" },
        originalName: "Dragon Princess",
        originalTier: "S",
        status: "valid",
        observedAt: now,
        evidenceRefIds: ["ev_tftacademy_18_2"],
        rawArtifactId: "art_tftacademy_18_2",
        metrics: {},
        builds: []
      };

      // 2. Generic dangling fixture: URL nhà cung cấp bình thường nhưng mang ID tùy ý không tồn tại (kiểm thử hồi quy)
      const genericDanglingFixture: any = {
        id: "internal-observation",
        datasetKind: "real",
        sourceId: "metatft",
        sourceCompId: "internal-comp",
        sourceUrl: "https://www.metatft.com/comps",
        scope: { patchEpochId: "epoch_18_2" },
        originalName: "Internal regression fixture",
        originalTier: null,
        status: "valid",
        observedAt: now,
        evidenceRefIds: ["ev_7f91a3"],
        rawArtifactId: "art_7f91a3",
        metrics: {},
        builds: []
      };

      try {
        // Test A: Positive Control -> 1/5 nguồn đã xác minh (TFT Academy)
        (metaRepository as any).getLatestSourceObservations = async () => [positiveFixture];
        let html = renderToStaticMarkup(await MetaWebsitesPage({ searchParams: Promise.resolve({ patch: "epoch_18_2" }) }));
        expect(Number(html.match(/([0-5])\/5 nguồn đã xác minh/)?.[1])).toBe(1);
        expect(html).toContain("TFT Academy");
        expect(html).toContain("Đã xác minh (1 guide)");

        // Test B: R09-stale -> 0/5 nguồn đã xác minh, nhãn Dữ liệu quá hạn
        (metaRepository as any).getLatestSourceObservations = async () => [{ ...positiveFixture, status: "stale" }];
        html = renderToStaticMarkup(await MetaWebsitesPage({ searchParams: Promise.resolve({ patch: "epoch_18_2" }) }));
        expect(Number(html.match(/([0-5])\/5 nguồn đã xác minh/)?.[1])).toBe(0);
        expect(html).toContain("Dữ liệu quá hạn");

        // Test C: R09-missing-evidence -> 0/5 nguồn đã xác minh, nhãn Thiếu bằng chứng
        (metaRepository as any).getLatestSourceObservations = async () => [{ ...positiveFixture, status: "valid", evidenceRefIds: [], rawArtifactId: "" }];
        html = renderToStaticMarkup(await MetaWebsitesPage({ searchParams: Promise.resolve({ patch: "epoch_18_2" }) }));
        expect(Number(html.match(/([0-5])\/5 nguồn đã xác minh/)?.[1])).toBe(0);
        expect(html).toContain("Thiếu bằng chứng");

        // Test D: R09-generic-dangling-evidence (kiểm thử hồi quy) -> 0/5 nguồn đã xác minh, nhãn Chưa xác minh
        (metaRepository as any).getLatestSourceObservations = async () => [genericDanglingFixture];
        html = renderToStaticMarkup(await MetaWebsitesPage({ searchParams: Promise.resolve({ patch: "epoch_18_2" }) }));
        expect(Number(html.match(/([0-5])\/5 nguồn đã xác minh/)?.[1])).toBe(0);
        expect(html).toContain("Chưa xác minh");
      } finally {
        (metaRepository as any).getLatestRankingSnapshot = originalRanking;
        (metaRepository as any).getLatestSourceObservations = originalObservations;
      }
    });

    describe("Supplemental Gate Probes (13 cases)", () => {
      const base: any = {
        id: "review-only",
        datasetKind: "real",
        sourceId: "tftacademy",
        sourceCompId: "review-only",
        sourceUrl: "https://tftacademy.com/tierlist",
        scope: { patchEpochId: "epoch_18_2" },
        originalName: "Memory fixture only",
        originalTier: null,
        status: "valid",
        observedAt: "2026-10-12T00:00:00.000Z",
        evidenceRefIds: ["ev_tftacademy_18_2"],
        rawArtifactId: "art_tftacademy_18_2",
        metrics: {},
        builds: []
      };

      const cases: [string, any, any, boolean][] = [
        ["generic-dangling-closed", { sourceId: "metatft", rawArtifactId: "art_7f91a3", evidenceRefIds: ["ev_7f91a3"] }, { patchEpochId: "epoch_18_2" }, false],
        ["stale-status-closed", { status: "stale" }, { patchEpochId: "epoch_18_2" }, false],
        ["demo-dataset-closed", { datasetKind: "demo" }, { patchEpochId: "epoch_18_2" }, false],
        ["scope-mismatch-closed", {}, { patchEpochId: "epoch_18_3" }, false],
        ["allowlisted-evidence-without-record-or-artifact", { rawArtifactId: "" }, { patchEpochId: "epoch_18_2" }, false],
        ["resolved-artifact-bypasses-dangling-evidence", { evidenceRefIds: ["ev_7f91a3"] }, { patchEpochId: "epoch_18_2" }, false],
        ["cross-provider-artifact", { sourceId: "metatft", evidenceRefIds: [] }, { patchEpochId: "epoch_18_2" }, false],
        ["cross-patch-18-2-proof-for-18-3", { scope: { patchEpochId: "epoch_18_3" } }, { patchEpochId: "epoch_18_3" }, false],
        ["tactics-arbitrary-evidence", { sourceId: "tactics_tools", rawArtifactId: "", evidenceRefIds: ["ev_7f91a3"] }, { patchEpochId: "epoch_18_2" }, false],
        ["invalid-time-with-max-age", { observedAt: "not-a-time" }, { patchEpochId: "epoch_18_2", maxAgeHours: 48, referenceTime: "2026-10-12T00:00:00Z" }, false],
        ["outdated-with-explicit-policy-closed", { observedAt: "2020-01-01T00:00:00Z" }, { patchEpochId: "epoch_18_2", maxAgeHours: 48, referenceTime: "2026-10-12T00:00:00Z" }, false]
      ];

      for (const [id, changes, options, expected] of cases) {
        it(id, async () => {
          const input = { ...base, ...changes };
          const report = await verifySourceObservation(input, options);
          expect(report.verified).toBe(expected);
        });
      }

      it("non-raw-file-rejected", async () => {
        const report = await resolveRawArtifact("../../package.json");
        expect(report.resolved).toBe(false);
      });

      it("SSR-old-status-valid-is-not-currently-verified", async () => {
        const ranking = metaRepository.getLatestRankingSnapshot;
        const obs = metaRepository.getLatestSourceObservations;
        try {
          (metaRepository as any).getLatestRankingSnapshot = async () => null;
          (metaRepository as any).getLatestSourceObservations = async () => [{ ...base, observedAt: "2020-01-01T00:00:00Z" }];
          const html = renderToStaticMarkup(await MetaWebsitesPage({ searchParams: Promise.resolve({ patch: "epoch_18_2" }) }));
          const actual = Number(html.match(/([0-5])\/5 nguồn đã xác minh/)?.[1]);
          expect(actual).toBe(0);
        } finally {
          (metaRepository as any).getLatestRankingSnapshot = ranking;
          (metaRepository as any).getLatestSourceObservations = obs;
        }
      });
    });

    describe("Branch Probes (6 cases)", () => {
      const branchBase: any = {
        id: "review-only",
        datasetKind: "real",
        sourceId: "tftacademy",
        sourceCompId: "set-18-dragon-princess",
        sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-dragon-princess",
        scope: { patchEpochId: "epoch_18_2" },
        originalName: "Memory fixture only",
        status: "valid",
        observedAt: "2026-10-12T00:00:00Z",
        evidenceRefIds: ["ev_tftacademy_18_2"],
        rawArtifactId: "art_tftacademy_18_2",
        metrics: {},
        builds: []
      };
      const branchOptions = {
        patchEpochId: "epoch_18_2",
        maxAgeHours: 48,
        referenceTime: "2026-10-12T01:00:00Z"
      };
      const guide = "tftacademy/set-18-dragon-princess.html";

      it("pinned-registry-positive-control", async () => {
        const report = await verifySourceObservation(branchBase, branchOptions);
        expect(report.verified).toBe(true);
      });

      it("guide-file-cross-provider-evidence", async () => {
        const input = {
          ...branchBase,
          sourceId: "metatft",
          rawArtifactId: "art_metatft_18_2",
          evidenceRefIds: ["ev_tftacademy_set-18-dragon-princess"]
        };
        const report = await verifySourceObservation(input, branchOptions);
        expect(report.verified).toBe(false);
      });

      it("guide-file-tamper-no-expected-digest", async () => {
        const input = {
          ...branchBase,
          sourceCompId: "set-18-dragon-princess",
          sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-dragon-princess",
          evidenceRefIds: ["ev_tftacademy_set-18-dragon-princess"]
        };
        const baseline = await verifySourceObservation(input, branchOptions);
        expect(baseline.verified).toBe(true);

        let tamperedReads = 0;
        const target = path.resolve("storage/raw", guide);
        const original = fs.readFileSync.bind(fs) as any;
        const spy = vi.spyOn(fs, "readFileSync").mockImplementation(((file: any, ...args: any[]) =>
          path.resolve(String(file)) === target
            ? (tamperedReads++, Buffer.from("Review-only mutated raw bytes; no file was written."))
            : original(file, ...args)) as any);

        try {
          const report = await verifySourceObservation(input, branchOptions);
          expect(tamperedReads).toBeGreaterThan(0);
          expect(report.verified).toBe(false);
        } finally {
          spy.mockRestore();
        }
      });

      it("db-evidence-cross-patch", async () => {
        dbMock.evidence = [
          {
            id: "ev_db_review",
            datasetKind: "real",
            sourceId: "tftacademy",
            kind: "raw_artifact",
            artifactId: "art_tftacademy_18_2"
          }
        ];
        try {
          const input = {
            ...branchBase,
            scope: { patchEpochId: "epoch_18_3" },
            rawArtifactId: "",
            evidenceRefIds: ["ev_db_review"]
          };
          const report = await verifySourceObservation(input, {
            ...branchOptions,
            patchEpochId: "epoch_18_3"
          });
          expect(report.verified).toBe(false);
        } finally {
          dbMock.evidence = [];
        }
      });

      it("db-evidence-artifact-join-mismatch", async () => {
        const bytes = fs.readFileSync(path.resolve("storage/raw", guide));
        dbMock.artifacts = [
          {
            id: "art_db_review",
            storageKey: guide,
            sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
            byteSize: bytes.length
          }
        ];
        dbMock.evidence = [
          {
            id: "ev_db_review",
            datasetKind: "real",
            sourceId: "tftacademy",
            kind: "raw_artifact",
            artifactId: "art_db_review"
          }
        ];
        try {
          const input = {
            ...branchBase,
            evidenceRefIds: ["ev_db_review"]
          };
          const report = await verifySourceObservation(input, branchOptions);
          expect(report.verified).toBe(false);
        } finally {
          dbMock.evidence = [];
          dbMock.artifacts = [];
        }
      });

      it("content-addressed-raw-without-provider-scope-proof", async () => {
        const input = {
          ...branchBase,
          sourceId: "metatft",
          scope: { patchEpochId: "epoch_18_3" },
          rawArtifactId: "1b6e86fd4cdb398d582bd339bc588f2c11c1563aa2336dc9f8a1d7aa6adcf38d",
          evidenceRefIds: []
        };
        const report = await verifySourceObservation(input, {
          ...branchOptions,
          patchEpochId: "epoch_18_3"
        });
        expect(report.verified).toBe(false);
      });
    });

    describe("Lineage & Provenance Probes (4 cases + controls)", () => {
      const lineageBase: any = {
        id: "review-only",
        datasetKind: "real",
        sourceId: "tftacademy",
        sourceCompId: "set-18-dragon-princess",
        sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-dragon-princess",
        scope: { patchEpochId: "epoch_18_2" },
        originalName: "Memory fixture only",
        status: "valid",
        observedAt: "2026-10-12T00:00:00Z",
        rawArtifactId: "art_tftacademy_set-18-dragon-princess_b9065ba1499b",
        evidenceRefIds: ["ev_tftacademy_set-18-dragon-princess"],
        metrics: {},
        builds: []
      };
      const lineageOptions = {
        patchEpochId: "epoch_18_2",
        maxAgeHours: 48,
        referenceTime: "2026-10-12T01:00:00Z"
      };

      it("all-pinned-files-match-manifests", () => {
        const rows = [
          ...Object.entries(KNOWN_PROVIDER_ARTIFACTS).map(([id, a]) => ({ id, kind: "provider", a })),
          ...Object.entries(KNOWN_GUIDE_ARTIFACTS).map(([id, a]) => ({ id, kind: "guide", a }))
        ].map(({ id, kind, a }) => {
          const file = path.resolve("storage/raw", a.storageFile);
          const bytes = fs.readFileSync(file);
          const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
          return {
            id,
            kind,
            file: a.storageFile,
            expectedHash: a.sha256,
            actualHash,
            expectedSize: a.byteSize,
            actualSize: bytes.length,
            status: actualHash === a.sha256 && bytes.length === a.byteSize ? "PASS" : "FAIL"
          };
        });
        const failures = rows.filter((r) => r.status === "FAIL");
        expect(failures).toEqual([]);
      });

      it("same-guide-positive-control", async () => {
        const report = await verifySourceObservation(lineageBase, lineageOptions);
        expect(report.verified).toBe(true);
      });

      it("different-guide-same-provider-patch-rejected", async () => {
        const input = {
          ...lineageBase,
          evidenceRefIds: ["ev_tftacademy_set-18-solar-kayle"]
        };
        const report = await verifySourceObservation(input, lineageOptions);
        expect(report.verified).toBe(false);
      });

      it("db-provider-and-patch-cannot-come-from-caller", async () => {
        const storageKey = "tftacademy/set-18-dragon-princess.html";
        const bytes = fs.readFileSync(path.resolve("storage/raw", storageKey));
        const row = {
          id: "art_tftacademy_metatft_unattested",
          storageKey,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          byteSize: bytes.length
        };
        dbMock.artifacts = [row];
        const inputs = [
          { ...lineageBase, rawArtifactId: row.id, evidenceRefIds: [] },
          { ...lineageBase, sourceId: "metatft", scope: { patchEpochId: "epoch_18_3" }, rawArtifactId: row.id, evidenceRefIds: [] }
        ];
        try {
          const reports = [];
          for (const input of inputs) {
            reports.push(await verifySourceObservation(input, { ...lineageOptions, patchEpochId: input.scope.patchEpochId }));
          }
          const actual = reports.map((r) => r.verified);
          expect(actual).toEqual([false, false]);
        } finally {
          dbMock.artifacts = [];
        }
      });

      it("db-provenance-with-real-receipt-positive-and-negative-controls", async () => {
        const storageKey = "tftacademy/set-18-dragon-princess.html";
        const bytes = fs.readFileSync(path.resolve("storage/raw", storageKey));
        const row = {
          id: "art_db_attested_dragon_princess",
          storageKey,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          byteSize: bytes.length
        };
        const snapshotReceipt = {
          id: "snap_tftacademy_set18_dp",
          sourceId: "tftacademy",
          datasetKind: "real",
          status: "published",
          rawArtifactId: row.id,
          scope: { patchEpochId: "epoch_18_2" }
        };
        dbMock.artifacts = [row];
        dbMock.snapshots = [snapshotReceipt];

        try {
          // Positive control: observation khớp receipt thật trong DB -> verified: true
          const positiveInput = {
            ...lineageBase,
            rawArtifactId: row.id,
            evidenceRefIds: []
          };
          const posReport = await verifySourceObservation(positiveInput, lineageOptions);
          expect(posReport.verified).toBe(true);

          // Negative control 1: caller đổi provider sang metatft -> verified: false
          const wrongProviderInput = {
            ...lineageBase,
            sourceId: "metatft",
            rawArtifactId: row.id,
            evidenceRefIds: []
          };
          const wrongProvReport = await verifySourceObservation(wrongProviderInput, lineageOptions);
          expect(wrongProvReport.verified).toBe(false);

          // Negative control 2: caller đổi scope sang epoch_18_3 -> verified: false
          const wrongPatchInput = {
            ...lineageBase,
            scope: { patchEpochId: "epoch_18_3" },
            rawArtifactId: row.id,
            evidenceRefIds: []
          };
          const wrongPatchReport = await verifySourceObservation(wrongPatchInput, {
            ...lineageOptions,
            patchEpochId: "epoch_18_3"
          });
          expect(wrongPatchReport.verified).toBe(false);
        } finally {
          dbMock.artifacts = [];
          dbMock.snapshots = [];
        }
      });
    });

    describe("Attestation & Claim Lineage Probes (6 cases)", () => {
      const base: any = {
        id: "review-memory-observation",
        datasetKind: "real",
        sourceId: "tftacademy",
        sourceCompId: "set-18-dragon-princess",
        sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-dragon-princess",
        scope: { patchEpochId: "epoch_18_2" },
        originalName: "Memory control; not product data",
        status: "valid",
        observedAt: "2026-10-12T00:00:00Z",
        rawArtifactId: "art_tftacademy_18_2",
        evidenceRefIds: ["ev_tftacademy_set-18-dragon-princess"],
        metrics: {},
        builds: []
      };
      const options = {
        patchEpochId: "epoch_18_2",
        maxAgeHours: 48,
        referenceTime: "2026-10-12T01:00:00Z"
      };
      const storageKey = "tftacademy/set-18-dragon-princess.html";
      const bytes = fs.readFileSync(path.resolve("storage/raw", storageKey));
      const artifact = {
        id: "art_db_receipt_review_unknown",
        storageKey,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        byteSize: bytes.length
      };
      const snapshot = {
        id: "snapshot_memory_receipt",
        sourceId: "tftacademy",
        datasetKind: "real",
        status: "published",
        rawArtifactId: artifact.id,
        scope: { patchEpochId: "epoch_18_2" },
        observedAt: new Date(base.observedAt),
        fetchedAt: new Date(base.observedAt),
        parserVersion: "1.0.0",
        createdAt: new Date(base.observedAt)
      };

      async function receiptCase(id: string, receipt: any, evidence: any, expected: boolean) {
        dbMock.artifacts = [artifact];
        dbMock.snapshots = receipt ? [receipt] : [];
        dbMock.evidence = evidence ? [evidence] : [];
        const input = { ...base, rawArtifactId: artifact.id, evidenceRefIds: [] };
        try {
          const report = await verifySourceObservation(input, options);
          expect(report.verified).toBe(expected);
        } finally {
          dbMock.artifacts = [];
          dbMock.snapshots = [];
          dbMock.evidence = [];
        }
      }

      it("real-published-snapshot-receipt-positive-control", async () => {
        await receiptCase("real-published-snapshot-receipt-positive-control", snapshot, null, true);
      });

      it("demo-snapshot-cannot-attest-real-observation", async () => {
        await receiptCase("demo-snapshot-cannot-attest-real-observation", { ...snapshot, datasetKind: "demo" }, null, false);
      });

      it("quarantined-snapshot-cannot-attest-real-observation", async () => {
        await receiptCase("quarantined-snapshot-cannot-attest-real-observation", { ...snapshot, status: "quarantined" }, null, false);
      });

      it("demo-evidence-receipt-cannot-attest-real-observation", async () => {
        await receiptCase(
          "demo-evidence-receipt-cannot-attest-real-observation",
          null,
          {
            id: "ev_memory_demo_receipt",
            kind: "demo_fixture",
            datasetKind: "demo",
            sourceId: "tftacademy",
            artifactId: artifact.id,
            title: "Memory Demo receipt only",
            url: base.sourceUrl,
            locator: "memory fixture",
            snippet: "Patch 18.2"
          },
          false
        );
      });

      it("exact-guide-with-parent-tierlist-positive-control", async () => {
        const report = await verifySourceObservation(base, options);
        expect(report.verified).toBe(true);
      });

      it("unknown-comp-containing-guide-slug-must-not-verify", async () => {
        const fakeSlug = "set-18-dragon-princess-review-unknown";
        const input = {
          ...base,
          sourceCompId: fakeSlug,
          sourceUrl: "https://tftacademy.com/tierlist/comps/" + fakeSlug
        };
        const parent = fs.readFileSync(path.resolve("storage/raw/tftacademy_tierlist_live.html"), "utf8");
        const guideContent = bytes.toString("utf8");
        const report = await verifySourceObservation(input, options);
        expect(parent.includes(fakeSlug) || guideContent.includes(fakeSlug)).toBe(false);
        expect(report.verified).toBe(false);
      });
    });

    describe("Claim Routing & Cross-Branch Probes (6 cases)", () => {
      const base: any = {
        id: "memory-claim-routing-control",
        datasetKind: "real",
        sourceId: "tftacademy",
        sourceCompId: "set-18-dragon-princess",
        sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-dragon-princess",
        scope: { patchEpochId: "epoch_18_2" },
        originalName: "Memory fixture, not product data",
        status: "valid",
        observedAt: "2026-10-12T00:00:00Z",
        rawArtifactId: "art_tftacademy_18_2",
        evidenceRefIds: ["ev_tftacademy_set-18-dragon-princess"],
        metrics: {},
        builds: []
      };
      const options = {
        patchEpochId: "epoch_18_2",
        maxAgeHours: 48,
        referenceTime: "2026-10-12T01:00:00Z"
      };
      const unknownSlug = "set-18-dragon-princess-review-unknown";
      const unknown = {
        ...base,
        sourceCompId: unknownSlug,
        sourceUrl: "https://tftacademy.com/tierlist/comps/" + unknownSlug
      };
      const raw = fs.readFileSync(path.resolve("storage/raw/tftacademy_tierlist_live.html"), "utf8");

      it("exact-guide-positive-control", async () => {
        const report = await verifySourceObservation(base, options);
        expect(report.verified).toBe(true);
      });

      it("unknown-claim-guide-path-rejected-control", async () => {
        expect(raw.includes(unknownSlug)).toBe(false);
        const report = await verifySourceObservation(unknown, options);
        expect(report.verified).toBe(false);
      });

      it("same-unknown-claim-raw-only-must-reject", async () => {
        const report = await verifySourceObservation({ ...unknown, evidenceRefIds: [] }, options);
        expect(report.verified).toBe(false);
      });

      it("same-unknown-claim-generic-provider-evidence-must-reject", async () => {
        const report = await verifySourceObservation({ ...unknown, evidenceRefIds: ["ev_tftacademy_18_2"] }, options);
        expect(report.verified).toBe(false);
      });

      const dbEvidence = {
        id: "ev_db_claim_memory",
        kind: "raw_artifact",
        datasetKind: "real",
        sourceId: "tftacademy",
        artifactId: "art_tftacademy_18_2",
        title: "Memory claim locator",
        url: base.sourceUrl,
        locator: 'tierlist.comps[slug="set-18-dragon-princess"]',
        snippet: "Dragon Princess; Patch 18.2"
      };

      it("db-evidence-same-claim-positive-control", async () => {
        dbMock.evidence = [dbEvidence];
        try {
          const report = await verifySourceObservation({ ...base, evidenceRefIds: [dbEvidence.id] }, options);
          expect(report.verified).toBe(true);
        } finally {
          dbMock.evidence = [];
        }
      });

      it("db-evidence-other-comp-same-parent-must-reject", async () => {
        expect(raw.includes("set-18-solar-kayle")).toBe(true);
        dbMock.evidence = [
          {
            ...dbEvidence,
            url: "https://tftacademy.com/tierlist/comps/set-18-solar-kayle",
            locator: 'tierlist.comps[slug="set-18-solar-kayle"]',
            snippet: "Solar Kayle; Patch 18.2"
          }
        ];
        try {
          const report = await verifySourceObservation({ ...base, evidenceRefIds: [dbEvidence.id] }, options);
          expect(report.verified).toBe(false);
        } finally {
          dbMock.evidence = [];
        }
      });
    });

    describe("Adversarial Claim & Provenance Hardening Probes (7 cases)", () => {
      const base: any = {
        id: "memory-adversarial-control",
        datasetKind: "real",
        sourceId: "tftacademy",
        sourceCompId: "set-18-dragon-princess",
        sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-dragon-princess",
        scope: { patchEpochId: "epoch_18_2" },
        originalName: "Memory fixture, not product data",
        status: "valid",
        observedAt: "2026-10-12T00:00:00Z",
        rawArtifactId: "art_tftacademy_18_2",
        evidenceRefIds: ["ev_tftacademy_18_2"],
        metrics: {},
        builds: []
      };
      const options = {
        patchEpochId: "epoch_18_2",
        maxAgeHours: 48,
        referenceTime: "2026-10-12T01:00:00Z"
      };

      it("prefix-comp-slug-present-as-substring-in-raw-must-reject", async () => {
        // "set-18-dragon" is a substring of "set-18-dragon-princess" in tftacademy_tierlist_live.html, but not a real comp slug
        const rawOnly = await verifySourceObservation(
          {
            ...base,
            sourceCompId: "set-18-dragon",
            sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-dragon",
            evidenceRefIds: []
          },
          options
        );
        const genericEv = await verifySourceObservation(
          {
            ...base,
            sourceCompId: "set-18-dragon",
            sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-dragon",
            evidenceRefIds: ["ev_tftacademy_18_2"]
          },
          options
        );
        expect(rawOnly.verified).toBe(false);
        expect(genericEv.verified).toBe(false);
      });

      it("common-html-word-comp-slug-must-reject", async () => {
        // "tierlist" appears in the HTML content, so set-18-tierlist must not pass via substring includes
        const report = await verifySourceObservation(
          {
            ...base,
            sourceCompId: "set-18-tierlist",
            sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-tierlist",
            evidenceRefIds: []
          },
          options
        );
        expect(report.verified).toBe(false);
      });

      it("conflicting-sourceCompId-and-sourceUrl-must-reject", async () => {
        // Both Dragon Princess and Solar Kayle exist in raw, but observation mixes them
        const report = await verifySourceObservation(
          {
            ...base,
            sourceCompId: "set-18-dragon-princess",
            sourceUrl: "https://tftacademy.com/tierlist/comps/set-18-solar-kayle",
            evidenceRefIds: []
          },
          options
        );
        expect(report.verified).toBe(false);
      });

      it("missing-sourceCompId-or-review-only-placeholder-must-reject", async () => {
        const emptyComp = await verifySourceObservation(
          { ...base, sourceCompId: "", sourceUrl: "https://tftacademy.com/tierlist", evidenceRefIds: [] },
          options
        );
        const reviewOnly = await verifySourceObservation(
          { ...base, sourceCompId: "review-only", sourceUrl: "https://tftacademy.com/tierlist", evidenceRefIds: [] },
          options
        );
        expect(emptyComp.verified).toBe(false);
        expect(reviewOnly.verified).toBe(false);
      });

      it("missing-scope-patchEpochId-must-reject", async () => {
        const report = await verifySourceObservation(
          { ...base, scope: {} as any },
          { maxAgeHours: 48, referenceTime: "2026-10-12T01:00:00Z" }
        );
        expect(report.verified).toBe(false);
        expect(report.gates.scopePass).toBe(false);
      });

      it("db-evidence-conflicting-id-or-unsubstantiated-web-article-must-reject", async () => {
        dbMock.evidence = [
          {
            id: "ev_tftacademy_set-18-solar-kayle_custom1234",
            kind: "raw_artifact",
            datasetKind: "real",
            sourceId: "tftacademy",
            artifactId: "art_tftacademy_18_2",
            title: "TFT Academy Tierlist",
            url: "https://tftacademy.com/tierlist",
            locator: "tierlist.comps",
            snippet: "Patch 18.2 tierlist"
          },
          {
            id: "ev_db_web_article_unspecific",
            kind: "web_article",
            datasetKind: "real",
            sourceId: "tftacademy",
            artifactId: null,
            title: "TFT Academy General Article",
            url: "https://tftacademy.com/tierlist",
            locator: "article.body",
            snippet: "Patch 18.2 general notes"
          }
        ];
        try {
          const conflictingIdReport = await verifySourceObservation(
            { ...base, evidenceRefIds: ["ev_tftacademy_set-18-solar-kayle_custom1234"] },
            options
          );
          const unspecificWebArticleReport = await verifySourceObservation(
            { ...base, evidenceRefIds: ["ev_db_web_article_unspecific"] },
            options
          );
          expect(conflictingIdReport.verified).toBe(false);
          expect(unspecificWebArticleReport.verified).toBe(false);
        } finally {
          dbMock.evidence = [];
        }
      });

      it("db-artifact-provenance-receipt-from-other-comp-must-reject", async () => {
        const storageKey = "tftacademy_tierlist_live.html";
        const bytes = fs.readFileSync(path.resolve("storage/raw", storageKey));
        const customArt = {
          id: "art_db_shared_tierlist_custom",
          storageKey,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          byteSize: bytes.length
        };
        dbMock.artifacts = [customArt];
        dbMock.snapshots = [];
        dbMock.evidence = [
          {
            id: "ev_receipt_solar_kayle",
            kind: "raw_artifact",
            datasetKind: "real",
            sourceId: "tftacademy",
            artifactId: customArt.id,
            title: "Solar Kayle Guide",
            url: "https://tftacademy.com/tierlist/comps/set-18-solar-kayle",
            locator: 'tierlist.comps[slug="set-18-solar-kayle"]',
            snippet: "Patch 18.2 Solar Kayle"
          }
        ];
        try {
          const report = await verifySourceObservation(
            {
              ...base,
              rawArtifactId: customArt.id,
              evidenceRefIds: []
            },
            options
          );
          expect(report.verified).toBe(false);
        } finally {
          dbMock.artifacts = [];
          dbMock.evidence = [];
        }
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. R05: 4x7 Hex Staggered Board & Personal Arrangement State
  // ---------------------------------------------------------------------------
  describe("R05: 4x7 Hex Staggered Board & Personal Arrangement", () => {
    it("renders 28 hex cells (4 rows x 7 cols) with staggered rows and preserves source board by default", () => {
      const units: BoardUnit[] = [
        {
          championId: "tft18_caitlyn",
          nameVi: "Caitlyn",
          cost: 4,
          tier: 2,
          position: { row: 3, col: 0 },
          items: ["TFT_Item_InfinityEdge"],
          isCarry: true
        },
        {
          championId: "tft18_shen",
          nameVi: "Shen",
          cost: 4,
          tier: 2,
          position: { row: 0, col: 3 },
          items: ["TFT_Item_WarmogsArmor"],
          isTank: true
        }
      ];

      const html = renderToStaticMarkup(React.createElement(TftBoardGrid, { boardUnits: units }));
      expect(html).toContain('data-board-shape="hex-grid-4x7"');
      const hexMatches = html.match(/data-cell-shape="hex"/g) || [];
      expect(hexMatches).toHaveLength(28);
      expect(html).toContain('data-row-stagger="indented"');
      expect(html).not.toContain("Bản sắp xếp cá nhân");
      expect(html).not.toContain("Khôi phục bàn cờ gốc");
    });

    it("shows 'Bản sắp xếp cá nhân' and 'Khôi phục bàn cờ gốc' when custom positions are active without mutating source boardUnits or items", () => {
      const sourceUnits: BoardUnit[] = [
        {
          championId: "tft18_caitlyn",
          nameVi: "Caitlyn",
          cost: 4,
          tier: 2,
          position: { row: 3, col: 0 },
          items: ["TFT_Item_InfinityEdge"],
          isCarry: true
        }
      ];

      const html = renderToStaticMarkup(
        React.createElement(TftBoardGrid, {
          boardUnits: sourceUnits,
          initialCustomPositions: { 0: { row: 3, col: 6 } }
        })
      );
      expect(html).toContain("Bản sắp xếp cá nhân");
      expect(html).toContain("Khôi phục bàn cờ gốc");
      expect(html).toContain("Hàng 4, Ô 7");
      // Source boardUnits and item ownership remain completely untouched
      expect(sourceUnits[0].position).toEqual({ row: 3, col: 0 });
      expect(sourceUnits[0].items).toEqual(["TFT_Item_InfinityEdge"]);
    });
  });

  describe("R6-01: CompRow board completeness badge verification", () => {
    const makeRow = (completeness: "exact" | "partial" | "conditional") => ({
      archetypeId: "comp_test_completeness",
      nameVi: "Đội hình Thử nghiệm Completeness",
      tier: "S" as const,
      consensusLabel: "Đồng thuận S",
      score: 95,
      sourceVotes: [],
      selectedSourceBuildId: "build_comp_1",
      recommendedBoard: [
        {
          championId: "tft18_ahri",
          cost: 4,
          tier: 2,
          position: { row: 3, col: 0 },
          items: ["item_gunblade"],
          boardProvenance: {
            sourceId: "tftacademy",
            observationId: "obs_comp_1",
            buildId: "build_comp_1",
            sourceUrl: "https://example.com/guide",
            boardCompleteness: completeness
          }
        }
      ]
    });

    it("renders 'Bàn cờ đầy đủ' with emerald badge when completeness is exact", () => {
      const html = renderToStaticMarkup(React.createElement(CompRow, { row: makeRow("exact") as any, datasetKind: "real", boardType: "websites", rankNumber: 1 }));
      expect(html).toContain("Bàn cờ đầy đủ");
      expect(html).toContain("bg-emerald-950/80");
    });

    it("renders 'Bàn cờ có điều kiện' with amber badge when completeness is conditional", () => {
      const html = renderToStaticMarkup(React.createElement(CompRow, { row: makeRow("conditional") as any, datasetKind: "real", boardType: "websites", rankNumber: 1 }));
      expect(html).toContain("Bàn cờ có điều kiện");
      expect(html).toContain("bg-amber-950/80");
    });

    it("renders 'Bàn cờ một phần' with slate badge when completeness is partial", () => {
      const html = renderToStaticMarkup(React.createElement(CompRow, { row: makeRow("partial") as any, datasetKind: "real", boardType: "websites", rankNumber: 1 }));
      expect(html).toContain("Bàn cờ một phần");
      expect(html).toContain("bg-slate-800");
    });
  });
});

