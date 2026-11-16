import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type RawChampion = { apiName?: string; name?: string; cost?: number; traits?: string[]; tileIcon?: string; squareIcon?: string; icon?: string; entityKind?: string };

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || null : null;
}

function fail(message: string): never {
  console.error(`[set18-registry] ${message}`);
  process.exit(1);
}

function canonicalToken(sourceApiName: string): string {
  return sourceApiName.toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^da_/, "")
    .replace(/^18_/, "")
    .replace(/18(?=_)/g, "")
    .replace(/18$/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

async function main() {
  const input = readArg("--input");
  const output = readArg("--output") || "src/domain/meta/generated-set18-registry.json";
  const endpoint = readArg("--endpoint") || "https://raw.communitydragon.org/latest/cdragon/tft/en_us.json";

  let payload: any;
  let rawBytes: Buffer;
  let sourceLocator = endpoint;
  if (input) {
    if (!fs.existsSync(input)) fail(`Không tìm thấy raw CommunityDragon payload: ${input}`);
    const bytes = fs.readFileSync(input);
    rawBytes = bytes;
    sourceLocator = path.relative(process.cwd(), path.resolve(input)).replace(/\\/g, "/");
    try {
      payload = JSON.parse(bytes.toString("utf8"));
    } catch (error: any) {
      fail(`Raw payload không phải JSON hợp lệ: ${error.message}`);
    }
  } else {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) fail(`Không lấy được CommunityDragon (${response.status})`);
    rawBytes = Buffer.from(await response.arrayBuffer());
    payload = JSON.parse(rawBytes.toString("utf8"));
  }

  const rawSet = payload?.sets?.["18"] || payload?.setData?.find((set: any) => Number(set.number) === 18) || payload?.payload?.champions;
  const rawChampions = Array.isArray(rawSet) ? rawSet : rawSet?.champions;
  const champions: RawChampion[] = Array.isArray(rawChampions) ? rawChampions : [];
  const set18Champions = champions.filter((champion) => String(champion.apiName || "").startsWith("DA_"));
  const shopChampions = set18Champions.filter((champion) => Array.isArray(champion.traits) && champion.traits.length > 0);
  if (shopChampions.length === 0) fail("Payload không chứng minh được Set 18 có tướng cửa hàng; không tạo registry.");

  const rawHash = crypto.createHash("sha256").update(rawBytes).digest("hex");
  const capturedAt = input && fs.existsSync(input)
    ? fs.statSync(input).mtime.toISOString()
    : new Date().toISOString();
  const entries = set18Champions.map((champion) => ({
    sourceApiName: champion.apiName || "",
    nameEn: champion.name || champion.apiName || "",
    cost: typeof champion.cost === "number" ? champion.cost : null,
    traits: champion.traits || [],
    iconSourcePath: champion.tileIcon || champion.squareIcon || champion.icon || null,
    canonicalId: champion.apiName ? `tft18_${canonicalToken(champion.apiName)}` : null,
    entityKind: champion.entityKind || (Array.isArray(champion.traits) && champion.traits.length > 0 ? "shop_champion" : "unknown")
  })).filter((entry) => entry.sourceApiName && entry.canonicalId);

  if (entries.length === 0) fail("Không có champion apiName hợp lệ; registry sẽ không được ghi.");
  const result = {
    schemaVersion: "round10.set18-registry.v1",
    datasetKind: "real",
    setNumber: 18,
    channel: endpoint.includes("/pbe/") ? "pbe" : "live",
    source: {
      endpoint,
      sourceLocator,
      rawSha256: rawHash,
      capturedAt
    },
    shopChampionCount: shopChampions.length,
    entries
  };
  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");
  console.log(`[set18-registry] Đã ghi ${entries.length} source keys (${shopChampions.length} shop champions) vào ${outputPath}`);
}

main().catch((error: any) => fail(error?.message || String(error)));
