import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { extractDetailComp } from "../../scripts/meta/ingest-tftflex";
import { createDataTftMetrics } from "../../scripts/meta/ingest-datatft";
import { calculateMetaTftMetrics } from "../../scripts/meta/ingest-metatft";
import { validateBoardUnits } from "../../src/domain/meta/board-validator";

describe("P0-08: Raw Artifact & Parser Golden Tests", () => {
  const baseDir = path.resolve("./tests/fixtures/raw-expected-pairs");
  const rawDir = path.join(baseDir, "raw");
  const expectedDir = path.join(baseDir, "expected");

  function computeHash(filePath: string): string {
    const bytes = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }

  function safeParseJsObject(str: string): any {
    const json = str
      .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(json);
  }

  it("TFTFlex: computes authentic raw SHA-256 and validates parsed builds against expected fixture", () => {
    const expectedHash = "7b20fb0ee81d3593e3d32e3ce3c3af7c65809c57a008c5860940d9628cda2e60";
    const rawPath = path.join(rawDir, `${expectedHash}.html`);
    const expectedPath = path.join(expectedDir, `${expectedHash}.json`);

    expect(fs.existsSync(rawPath)).toBe(true);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const actualHash = computeHash(rawPath);
    expect(actualHash).toBe(expectedHash);

    const rawHtml = fs.readFileSync(rawPath, "utf8");
    const parsed = extractDetailComp(rawHtml, "akali-camille");
    const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));

    expect(parsed.slug).toBe(expected.parsed.slug);
    expect(parsed.builds.length).toBe(expected.parsed.buildsCount);
    expect(parsed.builds[0].units.length).toBe(expected.parsed.primaryBuild.unitsCount);
    expect(parsed.builds[0].label).toBe(expected.parsed.primaryBuild.label);
    expect(parsed.builds[0].units).toEqual(expected.parsed.primaryBuild.units);
    expect(parsed.sourceLeadChampionId).toBe(expected.parsed.sourceLeadChampionId);
  });

  it("TFT Academy: computes authentic raw SHA-256 and parses guide finalComp positioning", () => {
    const expectedHash = "b9065ba1499bafa0adb9a43f79d8b61b634afa225245a4ff286d75b078547ee1";
    const rawPath = path.join(rawDir, `${expectedHash}.html`);
    const expectedPath = path.join(expectedDir, `${expectedHash}.json`);

    expect(fs.existsSync(rawPath)).toBe(true);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const actualHash = computeHash(rawPath);
    expect(actualHash).toBe(expectedHash);

    const rawHtml = fs.readFileSync(rawPath, "utf8");
    const start = rawHtml.indexOf("queriedGuide:");
    const objStart = rawHtml.indexOf("{", start);
    let depth = 0;
    let end = objStart;
    for (let i = objStart; i < rawHtml.length; i++) {
      if (rawHtml[i] === "{") depth++;
      else if (rawHtml[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    const guide = safeParseJsObject(rawHtml.slice(objStart, end));
    const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));

    expect(guide.title).toBe(expected.parsed.title);
    expect(guide.finalComp.length).toBe(expected.parsed.finalCompUnitsCount);
  });

  it("tactics.tools: computes authentic raw SHA-256 and verifies statistical placement/top4 rates", () => {
    const expectedHash = "a027a0489ee24540500603bf9aadf318dc6435259797543a13ba69d47c439b84";
    const rawPath = path.join(rawDir, `${expectedHash}.json`);
    const expectedPath = path.join(expectedDir, `${expectedHash}.json`);

    expect(fs.existsSync(rawPath)).toBe(true);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const actualHash = computeHash(rawPath);
    expect(actualHash).toBe(expectedHash);

    const nextData = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    const groups = nextData.initialData?.groups || nextData.props?.pageProps?.initialData?.groups || [];
    const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));

    expect(groups.length).toBe(expected.parsed.totalGroups);
    expect(groups[0].full.count).toBe(expected.parsed.sampleGroups[0].count);
    expect(groups[0].full.place).toBe(expected.parsed.sampleGroups[0].place);
    expect(Math.round((groups[0].full.top4 / groups[0].full.count) * 1000) / 1000).toBe(expected.parsed.sampleGroups[0].top4Rate);
    expect(Math.round((groups[0].full.win / groups[0].full.count) * 1000) / 1000).toBe(expected.parsed.sampleGroups[0].winRate);
  });

  it("DataTFT: computes authentic raw SHA-256 and proves zero synthetic placement/top4/winRate metrics", () => {
    const expectedHash = "aadcf06c15a2fd9bd97e874dad81cb5b84c2ab832839ec5b9aae0f200eea6f0c";
    const rawPath = path.join(rawDir, `${expectedHash}.json`);
    const expectedPath = path.join(expectedDir, `${expectedHash}.json`);

    expect(fs.existsSync(rawPath)).toBe(true);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const actualHash = computeHash(rawPath);
    expect(actualHash).toBe(expectedHash);

    const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    const strats = raw.result?.data || [];
    const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));

    expect(strats.length).toBe(expected.parsed.totalStrategies);
    expect(createDataTftMetrics()).toMatchObject(expected.parsed.firstStrategy.metricsNullProof);
  });

  it("MetaTFT: refuses inconsistent placement buckets instead of publishing derived metrics", () => {
    const invalid = calculateMetaTftMetrics({ cluster: "1", count: 100, places: [10, 10, 10, 10, 10, 10, 10, 10] });
    expect(invalid.validDistribution).toBe(false);
    expect(invalid.averagePlacement).toBeNull();
    expect(invalid.top4Rate).toBeNull();
    expect(invalid.winRate).toBeNull();

    const valid = calculateMetaTftMetrics({ cluster: "1", count: 80, places: [10, 10, 10, 10, 10, 10, 10, 10] });
    expect(valid.validDistribution).toBe(true);
    expect(valid.averagePlacement).toBe(4.5);
    expect(valid.top4Rate).toBe(0.5);
    expect(valid.winRate).toBe(0.125);
  });

  it("board validator quarantines every unknown item key", () => {
    const result = validateBoardUnits([
      { championId: "DA_18_Akali_AD", items: ["definitely_not_a_real_item"] },
      { championId: "DA_18_Ornn" },
      { championId: "DA_18_Camille" },
      { championId: "DA_18_Leona" }
    ], { minBoardSize: 4 });
    expect(result.valid).toBe(false);
    expect(result.quarantined).toBe(true);
    expect(result.errors.join(" ")).toContain("definitely_not_a_real_item");
  });

  it("MetaTFT: computes authentic raw SHA-256 and verifies authentic cluster count buckets", () => {
    const expectedHash = "1b6e86fd4cdb398d582bd339bc588f2c11c1563aa2336dc9f8a1d7aa6adcf38d";
    const rawPath = path.join(rawDir, `${expectedHash}.json`);
    const expectedPath = path.join(expectedDir, `${expectedHash}.json`);

    expect(fs.existsSync(rawPath)).toBe(true);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const actualHash = computeHash(rawPath);
    expect(actualHash).toBe(expectedHash);

    const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    const clusters = raw.cluster_info ? Object.values(raw.cluster_info) : (Array.isArray(raw) ? raw : raw.clusters || []);
    const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));

    expect(clusters.length).toBe(expected.parsed.totalClusters);
    expect((clusters[0] as any)?.cluster_id || (clusters[0] as any)?.id).toBe(expected.parsed.firstCluster.clusterId);
  });
});
