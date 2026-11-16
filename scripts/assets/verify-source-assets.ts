import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import registry from "../../src/domain/meta/generated-set18-registry.json";
import { ITEM_REGISTRY } from "../../src/domain/meta/item-registry";
import { communityDragonAssetUrl, VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION, VERIFIED_ASSET_EVIDENCE } from "../../src/domain/meta/asset-manifest";

type Asset = { entity: string; kind: "champion" | "item"; url: string; sourceAssetPath: string };

function pngDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function assets(): Asset[] {
  const rows: Asset[] = [];
  for (const entry of registry.entries as Array<{ canonicalId: string; iconSourcePath: string }>) {
    if (!entry.iconSourcePath) continue;
    rows.push({ entity: entry.canonicalId, kind: "champion", sourceAssetPath: entry.iconSourcePath, url: communityDragonAssetUrl(entry.iconSourcePath) });
  }
  for (const [key, item] of Object.entries(ITEM_REGISTRY)) {
    if (!item.sourceAssetPath) continue;
    rows.push({ entity: key, kind: "item", sourceAssetPath: item.sourceAssetPath, url: communityDragonAssetUrl(item.sourceAssetPath) });
  }
  return Array.from(new Map(rows.map((row) => [row.url, row])).values());
}

async function probe(asset: Asset) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(asset.url, { signal: controller.signal, headers: { accept: "image/png,image/*;q=0.8" } });
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "";
    const dimensions = pngDimensions(bytes);
    return {
      ...asset,
      status: response.status,
      contentType,
      byteSize: bytes.length,
      sha256: bytes.length ? crypto.createHash("sha256").update(bytes).digest("hex") : null,
      decoded: response.ok && contentType.toLowerCase().includes("image/") && Boolean(dimensions?.width && dimensions?.height),
      width: dimensions?.width || null,
      height: dimensions?.height || null,
      error: response.ok ? null : `HTTP ${response.status}`
    };
  } catch (error: any) {
    return { ...asset, status: 0, contentType: "", byteSize: 0, sha256: null, decoded: false, width: null, height: null, error: error?.name === "AbortError" ? "timeout" : String(error?.message || error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const list = assets();
  const results: any[] = [];
  for (let index = 0; index < list.length; index += 8) {
    const batch = await Promise.all(list.slice(index, index + 8).map(probe));
    results.push(...batch);
  }
  const manifest = {
    schemaVersion: "round12.asset-manifest.v1",
    generatedAt: new Date().toISOString(),
    patchVersion: "18.2",
    assetVersion: VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION,
    source: "https://raw.communitydragon.org/",
    evidence: VERIFIED_ASSET_EVIDENCE,
    requiredCount: results.length,
    decodedCount: results.filter((row) => row.decoded).length,
    brokenCount: results.filter((row) => !row.decoded).length,
    unknownIdentityCount: results.filter((row) => !row.entity).length,
    assets: results
  };
  const outDir = path.resolve("artifacts/release-verification");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "asset-manifest.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(outDir, "asset-fetch-audit.json"), JSON.stringify({ generatedAt: manifest.generatedAt, assetVersion: manifest.assetVersion, requiredCount: manifest.requiredCount, decodedCount: manifest.decodedCount, brokenCount: manifest.brokenCount, broken: results.filter((row) => !row.decoded) }, null, 2));
  console.log(JSON.stringify({ requiredCount: manifest.requiredCount, decodedCount: manifest.decodedCount, brokenCount: manifest.brokenCount, assetVersion: manifest.assetVersion }, null, 2));
  if (process.argv.includes("--strict") && manifest.brokenCount > 0) process.exitCode = 2;
}

main().catch((error) => { console.error("[assets:verify:source] Fatal:", error); process.exit(1); });

