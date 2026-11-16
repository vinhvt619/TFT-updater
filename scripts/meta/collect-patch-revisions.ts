import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { riotPatchNotesAdapter } from "../../src/ingestion/adapters/riot-patch-notes";

interface RevisionRecord {
  id: string;
  channel: "live" | "pbe";
  sourcePath: string;
  sourceUrl: string;
  rawHash: string;
  semanticContentHash: string;
  patchLabels: string[];
  eventIds: string[];
  fetchedAt: string;
}

function collectFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /(?:riot_patch|pbe).*\.(html?|json)$/i.test(entry.name))
    .map((entry) => path.join(root, entry.name));
}

function sourceUrl(file: string): string {
  const name = path.basename(file).replace(/\.html?$/i, "");
  const patch = name.match(/(\d+[_-]\d+[a-z]?)/i)?.[1]?.replace("_", "-");
  return patch
    ? `https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-${patch}/`
    : "https://raw.communitydragon.org/pbe/cdragon/tft/";
}

async function main() {
  const files = collectFiles(path.resolve("./storage/raw"));
  const revisions: RevisionRecord[] = [];
  for (const file of files) {
    const bytes = fs.readFileSync(file);
    const rawHash = crypto.createHash("sha256").update(bytes).digest("hex");
    const channel = /pbe/i.test(file) ? "pbe" : "live";
    let parsed: ReturnType<typeof riotPatchNotesAdapter.parseArticle>;
    try {
      parsed = riotPatchNotesAdapter.parseArticle(bytes.toString("utf8"), sourceUrl(file), {
        rawArtifactId: `art_patch_${rawHash}`,
        rawHash,
        fetchedAt: fs.statSync(file).mtime.toISOString()
      });
    } catch (error: any) {
      console.warn(`[patch-revisions] bỏ qua ${file}: ${error.message}`);
      continue;
    }
    revisions.push({
      id: parsed.revision.id,
      channel,
      sourcePath: path.relative(process.cwd(), file),
      sourceUrl: parsed.revision.canonicalUrl,
      rawHash,
      semanticContentHash: parsed.revision.semanticContentHash,
      patchLabels: Array.from(new Set(parsed.events.map((event) => event.patchFamilyId).filter(Boolean) as string[])),
      eventIds: parsed.events.map((event) => event.id),
      fetchedAt: parsed.revision.fetchedAt
    });
  }
  const outputPath = path.resolve("./storage/patch-revisions.json");
  const existing = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, "utf8")) : { schemaVersion: "round10.patch-revisions.v1", revisions: [] };
  const all = [...(existing.revisions || []), ...revisions];
  const unique = Array.from(new Map(all.map((record: RevisionRecord) => [`${record.channel}:${record.rawHash}`, record])).values());
  unique.sort((a: RevisionRecord, b: RevisionRecord) => a.fetchedAt.localeCompare(b.fetchedAt));
  fs.writeFileSync(outputPath, JSON.stringify({ ...existing, generatedAt: new Date().toISOString(), revisions: unique }, null, 2), "utf8");
  console.log(`[patch-revisions] ${unique.length} raw revisions (${new Set(unique.map((r) => r.semanticContentHash)).size} semantic contents)`);
}

main().catch((error: any) => {
  console.error("[patch-revisions] failed:", error.message || error);
  process.exit(1);
});

