import { describe, expect, it } from "vitest";
import {
  compareTftVersions,
  getAdjacentReleasePairs,
  parseTftVersion,
  sortReleaseMeta
} from "../../src/domain/versioning";

describe("TFT release versioning", () => {
  it("keeps explicit hotfix letters separate from the base patch", () => {
    const base = parseTftVersion("18.1 Bản Ra Mắt", "live", "demo_live_18_1");
    const hotfixA = parseTftVersion("18.1a Hotfix", "live", "demo_live_18_1_a");
    const hotfixB = parseTftVersion("18.1b Hotfix", "live", "demo_live_18_1_b");

    expect(base.displayVersion).toBe("18.1");
    expect(base.hotfixSuffix).toBeNull();
    expect(hotfixA.displayVersion).toBe("18.1a");
    expect(hotfixB.displayVersion).toBe("18.1b");
    expect(compareTftVersions(base, hotfixA)).toBeLessThan(0);
    expect(compareTftVersions(hotfixA, hotfixB)).toBeLessThan(0);
  });

  it("sorts PBE revisions and retains revision identity", () => {
    const r1 = parseTftVersion("PBE 18.1 r1", "pbe", "pbe_18_1_r1", "pbe_build_18_1_r1");
    const r2 = parseTftVersion("PBE 18.1 r2", "pbe", "pbe_18_1_r2", "pbe_build_18_1_r2");
    expect(r1.kind).toBe("pbe_revision");
    expect(r1.pbeRevision).toBe("1");
    expect(r2.pbeRevision).toBe("2");
    expect(compareTftVersions(r1, r2)).toBeLessThan(0);
  });

  it("produces adjacent pairs in semantic order instead of observed insertion order", () => {
    const rows = [
      { id: "b", datasetKind: "demo", patchLabel: "18.1b", channel: "live", occurrenceKey: "b", buildId: null, effectiveAt: "2026-08-28", observedAt: "2026-08-28", currentSnapshotId: "s-b" },
      { id: "base", datasetKind: "demo", patchLabel: "18.1", channel: "live", occurrenceKey: "base", buildId: null, effectiveAt: "2026-08-25", observedAt: "2026-08-25", currentSnapshotId: "s-base" },
      { id: "a", datasetKind: "demo", patchLabel: "18.1a", channel: "live", occurrenceKey: "a", buildId: null, effectiveAt: "2026-08-26", observedAt: "2026-08-26", currentSnapshotId: "s-a" }
    ] as any;
    const sorted = sortReleaseMeta(rows);
    expect(sorted.map((row) => row.id)).toEqual(["base", "a", "b"]);
    expect(getAdjacentReleasePairs(rows).map((pair) => [pair.from.id, pair.to.id])).toEqual([["base", "a"], ["a", "b"]]);
  });
});
