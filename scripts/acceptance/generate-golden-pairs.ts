import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { extractDetailComp } from "../../scripts/meta/ingest-tftflex";

function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function safeParseJsObject(str: string): any {
  const json = str
    .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(json);
}

async function main() {
  const baseDir = path.resolve("./tests/fixtures/raw-expected-pairs");
  const rawDir = path.join(baseDir, "raw");
  const expectedDir = path.join(baseDir, "expected");

  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(expectedDir, { recursive: true });

  // 1. TFTFlex Akali Camille Detail
  const tftflexSource = path.resolve("./storage/raw/tftflex_detail_akali_camille.html");
  const tftflexHash = hashFile(tftflexSource);
  const tftflexRawDest = path.join(rawDir, `${tftflexHash}.html`);
  fs.copyFileSync(tftflexSource, tftflexRawDest);

  const tftflexHtml = fs.readFileSync(tftflexRawDest, "utf8");
  const tftflexParsed = extractDetailComp(tftflexHtml, "akali-camille");
  const tftflexExpected = {
    sourceId: "tftflex",
    rawSha256: tftflexHash,
    parsed: {
      slug: tftflexParsed.slug,
      title: tftflexParsed.title,
      publishedAt: tftflexParsed.publishedAt,
      buildsCount: tftflexParsed.builds.length,
      primaryBuild: {
        label: tftflexParsed.builds[0]?.label,
        unitsCount: tftflexParsed.builds[0]?.units.length,
        units: tftflexParsed.builds[0]?.units
      },
      sourceLeadChampionId: tftflexParsed.sourceLeadChampionId
    }
  };
  fs.writeFileSync(
    path.join(expectedDir, `${tftflexHash}.json`),
    JSON.stringify(tftflexExpected, null, 2),
    "utf8"
  );
  console.log(`✓ Generated TFTFlex pair: ${tftflexHash}`);

  // 2. TFT Academy Dragon Princess Guide
  const academySource = path.resolve("./storage/raw/tftacademy/set-18-dragon-princess.html");
  const academyHash = hashFile(academySource);
  const academyRawDest = path.join(rawDir, `${academyHash}.html`);
  fs.copyFileSync(academySource, academyRawDest);

  const academyHtml = fs.readFileSync(academyRawDest, "utf8");
  const start = academyHtml.indexOf("queriedGuide:");
  const objStart = academyHtml.indexOf("{", start);
  let depth = 0;
  let end = objStart;
  for (let i = objStart; i < academyHtml.length; i++) {
    if (academyHtml[i] === "{") depth++;
    else if (academyHtml[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const guide = safeParseJsObject(academyHtml.slice(objStart, end));
  const academyExpected = {
    sourceId: "tftacademy",
    rawSha256: academyHash,
    parsed: {
      title: guide.title,
      tier: guide.tier,
      finalCompUnitsCount: guide.finalComp?.length,
      finalCompSample: (guide.finalComp || []).slice(0, 3).map((u: any) => ({
        apiName: u.apiName,
        boardIndex: u.boardIndex,
        items: u.items
      }))
    }
  };
  fs.writeFileSync(
    path.join(expectedDir, `${academyHash}.json`),
    JSON.stringify(academyExpected, null, 2),
    "utf8"
  );
  console.log(`✓ Generated TFT Academy pair: ${academyHash}`);

  // 3. tactics.tools nextdata
  const tacticsSource = path.resolve("./storage/raw/tactics_tools_nextdata.json");
  const tacticsHash = hashFile(tacticsSource);
  const tacticsRawDest = path.join(rawDir, `${tacticsHash}.json`);
  fs.copyFileSync(tacticsSource, tacticsRawDest);

  const tacticsRaw = JSON.parse(fs.readFileSync(tacticsRawDest, "utf8"));
  const groups = tacticsRaw.initialData?.groups || tacticsRaw.props?.pageProps?.initialData?.groups || [];
  const tacticsExpected = {
    sourceId: "tactics_tools",
    rawSha256: tacticsHash,
    parsed: {
      totalGroups: groups.length,
      sampleGroups: groups.slice(0, 3).map((g: any) => ({
        count: g.full?.count,
        place: g.full?.place,
        top4: g.full?.top4,
        win: g.full?.win,
        top4Rate: g.full?.count > 0 ? Math.round((g.full.top4 / g.full.count) * 1000) / 1000 : null,
        winRate: g.full?.count > 0 ? Math.round((g.full.win / g.full.count) * 1000) / 1000 : null
      }))
    }
  };
  fs.writeFileSync(
    path.join(expectedDir, `${tacticsHash}.json`),
    JSON.stringify(tacticsExpected, null, 2),
    "utf8"
  );
  console.log(`✓ Generated tactics.tools pair: ${tacticsHash}`);

  // 4. DataTFT raw strategies
  const datatftSource = path.resolve("./storage/raw/datatft_strategies.json");
  const datatftHash = hashFile(datatftSource);
  const datatftRawDest = path.join(rawDir, `${datatftHash}.json`);
  fs.copyFileSync(datatftSource, datatftRawDest);

  const datatftRaw = JSON.parse(fs.readFileSync(datatftRawDest, "utf8"));
  const strats = datatftRaw.result?.data || [];
  const datatftExpected = {
    sourceId: "datatft",
    rawSha256: datatftHash,
    parsed: {
      totalStrategies: strats.length,
      firstStrategy: {
        id: strats[0]?.id,
        compName: strats[0]?.compName,
        metricsNullProof: {
          averagePlacement: null,
          top4Rate: null,
          winRate: null
        }
      }
    }
  };
  fs.writeFileSync(
    path.join(expectedDir, `${datatftHash}.json`),
    JSON.stringify(datatftExpected, null, 2),
    "utf8"
  );
  console.log(`✓ Generated DataTFT pair: ${datatftHash}`);

  // 5. MetaTFT cluster stats
  const metatftSource = path.resolve("./storage/raw/metatft_cluster_info.json");
  const metatftHash = hashFile(metatftSource);
  const metatftRawDest = path.join(rawDir, `${metatftHash}.json`);
  fs.copyFileSync(metatftSource, metatftRawDest);

  const metatftRaw = JSON.parse(fs.readFileSync(metatftRawDest, "utf8"));
  const clusters = metatftRaw.cluster_info ? Object.values(metatftRaw.cluster_info) : (Array.isArray(metatftRaw) ? metatftRaw : metatftRaw.clusters || []);
  const metatftExpected = {
    sourceId: "metatft",
    rawSha256: metatftHash,
    parsed: {
      totalClusters: clusters.length,
      firstCluster: {
        clusterId: (clusters[0] as any)?.cluster_id || (clusters[0] as any)?.id,
        sampleCount: (clusters[0] as any)?.count || (clusters[0] as any)?.places?.reduce((a: number, b: number) => a + b, 0)
      }
    }
  };
  fs.writeFileSync(
    path.join(expectedDir, `${metatftHash}.json`),
    JSON.stringify(metatftExpected, null, 2),
    "utf8"
  );
  console.log(`✓ Generated MetaTFT pair: ${metatftHash}`);
}

main().catch(console.error);
