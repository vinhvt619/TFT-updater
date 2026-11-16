import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import registry from "../../src/domain/meta/generated-set18-registry.json";
import { ITEM_REGISTRY } from "../../src/domain/meta/item-registry";
import { communityDragonAssetUrl, VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION, VERIFIED_ASSET_EVIDENCE } from "../../src/domain/meta/asset-manifest";

function dimensions(bytes: Buffer) {
  return bytes.length >= 24 && bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null;
}

async function probe(entity: string, kind: string, sourceAssetPath: string) {
  const url = communityDragonAssetUrl(sourceAssetPath);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: "image/png,image/*;q=0.8" } });
    const bytes = Buffer.from(await response.arrayBuffer());
    const size = dimensions(bytes);
    return { entity, kind, url, sourceAssetPath, status: response.status, contentType: response.headers.get("content-type") || "", byteSize: bytes.length, sha256: bytes.length ? crypto.createHash("sha256").update(bytes).digest("hex") : null, decoded: response.ok && Boolean(size?.width && size?.height), width: size?.width || null, height: size?.height || null };
  } catch (error: any) { return { entity, kind, url, sourceAssetPath, status: 0, contentType: "", byteSize: 0, sha256: null, decoded: false, width: null, height: null, error: String(error?.message || error) }; }
}

async function main() {
  const assets = [
    ...(registry.entries as Array<{ canonicalId: string; iconSourcePath: string | null }>).filter((entry) => entry.iconSourcePath).map((entry) => ({ entity: entry.canonicalId, kind: "champion", sourceAssetPath: entry.iconSourcePath! })),
    ...Object.values(ITEM_REGISTRY).filter((item) => item.sourceAssetPath).map((item) => ({ entity: item.key, kind: "item", sourceAssetPath: item.sourceAssetPath! }))
  ];
  const results: any[] = [];
  for (let index = 0; index < assets.length; index += 8) results.push(...await Promise.all(assets.slice(index, index + 8).map((asset) => probe(asset.entity, asset.kind, asset.sourceAssetPath))));
  const report = { schemaVersion: "round13.asset-manifest.v1", validationScope: "PNG signature and dimensions; browser decode acceptance is separate", generatedAt: new Date().toISOString(), assetVersion: VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION, source: "https://raw.communitydragon.org/", evidence: VERIFIED_ASSET_EVIDENCE, requiredCount: results.length, decodedCount: results.filter((row) => row.decoded).length, brokenCount: results.filter((row) => !row.decoded).length, assets: results };
  const outDir = path.resolve(process.env.TFT_ASSET_AUDIT_OUT || "artifacts/asset-verification");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "asset-manifest.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "asset-fetch-audit.json"), JSON.stringify({ ...report, assets: results.filter((row) => !row.decoded) }, null, 2));
  console.log(JSON.stringify({ requiredCount: report.requiredCount, decodedCount: report.decodedCount, brokenCount: report.brokenCount, assetVersion: report.assetVersion }, null, 2));
  if (process.argv.includes("--strict") && report.brokenCount > 0) process.exitCode = 2;
}

main().catch((error) => { console.error("[assets:verify:current] Fatal:", error); process.exit(1); });
