import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb, closeDb } from "../../src/server/db/client";
import { evidenceRefs, rawArtifacts, releaseChanges } from "../../src/server/db/schema";
import { riotPatchNotesAdapter } from "../../src/ingestion/adapters/riot-patch-notes";
import { GameplayChange } from "../../src/domain/releases/types";
import { resolveSet18Champion } from "../../src/domain/meta/set18-registry";

const RAW_DIR = path.resolve("storage/raw");
const SOURCES = {
  "18.1": "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/",
  "18.2": "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-2/"
} as const;
const RELEASE_IDS = ["event_live_18_1_launch", "event_live_18_1_mid_aug27", "event_live_18_1_mid_aug28", "event_live_18_1_mid_aug31", "rel_live_18_2"];
const CLEANUP_RELEASE_IDS = [...RELEASE_IDS, "event_live_18_2_main"];

function stateValue(value: any) {
  return value?.state === "known" ? { state: "known", value: value.value ?? null } : { state: value?.state || "missing", value: null };
}

function classify(change: GameplayChange): "champion" | "trait" | "item" | "augment" | "system" | "bugfix" {
  const text = String(change.context?.sourceText || "");
  const parsedKind = String((change.context as any)?.entityKind || "");
  if (change.kind === "bugfix" || change.kind === "tooltip_only" || /\bbug\s*fix|tooltip|sửa lỗi|lỗi hiển thị/i.test(text)) return "bugfix";
  if (change.kind === "numeric" && resolveSet18Champion(change.entityId)) return "champion";
  if (parsedKind === "item" || parsedKind === "trait" || parsedKind === "augment") return parsedKind;
  if (/\b(augment|lõi nâng cấp)\b/i.test(text)) return "augment";
  if (/^(?:Radiant\s+|Artifact\s+)?(?:Infinity Edge|Bloodthirster|Hand of Justice|Edge of Night|Blighting Jewel|Forbidden Idol|Luden[’']s Tempest|Navori Flickerblade)/i.test(text)) return "item";
  if (/\b(trait|tộc|hệ)\b/i.test(text)) return "trait";
  return "system";
}

function canonicalKey(change: GameplayChange, entityKind: string, rawText: string) {
  const before = change.before?.state === "known" ? change.before.value : null;
  const after = change.after?.state === "known" ? change.after.value : null;
  return [change.releaseEventId || "", entityKind, change.entityId || "", change.variantId || "", change.fieldPath || "", change.kind, JSON.stringify(before), JSON.stringify(after), rawText.trim()].join("|").toLowerCase();
}

function releaseForEvent(eventId: string): string {
  return eventId === "event_live_18_2_main" ? "rel_live_18_2" : eventId;
}

async function main() {
  const db = await getDb();
  // Remove the old 18.2 notes-event rows as part of the same transaction
  // boundary. They are an archived alias of rel_live_18_2 and must never be
  // counted a second time, while the canonical rows retain the raw evidence.
  await db.delete(releaseChanges).where(inArray(releaseChanges.releaseId, CLEANUP_RELEASE_IDS));
  const report: any = { run: "releases:sync:official-notes", parserVersion: riotPatchNotesAdapter.parserVersion, sources: [], byRelease: {}, duplicatesSuppressed: 0 };
  const seen = new Set<string>();
  for (const patch of ["18.1", "18.2"] as const) {
    const filePath = path.join(RAW_DIR, `riot_patch_${patch.replace(".", "_")}_live.html`);
    if (!fs.existsSync(filePath)) throw new Error(`Thiếu raw artifact bất biến: ${filePath}`);
    const bytes = fs.readFileSync(filePath);
    const rawHash = crypto.createHash("sha256").update(bytes).digest("hex");
    const rawArtifactId = `art_18_${patch === "18.1" ? "1" : "2"}_html`;
    const existing = await db.select().from(rawArtifacts).where(eq(rawArtifacts.id, rawArtifactId)).limit(1);
    if (existing[0] && existing[0].sha256 !== rawHash) throw new Error(`Raw artifact ${rawArtifactId} đổi hash; dừng fail-closed.`);
    await db.insert(rawArtifacts).values({ id: rawArtifactId, sha256: rawHash, storageKey: `riot_patch_${patch.replace(".", "_")}_live.html`, byteSize: bytes.byteLength, contentType: "text/html" }).onConflictDoNothing();
    const parsed = riotPatchNotesAdapter.parseArticle(bytes.toString("utf8"), SOURCES[patch], { rawArtifactId, rawHash });
    const evidenceId = `ev_riot_${patch.replace(".", "_")}_official`;
    await db.insert(evidenceRefs).values({ id: evidenceId, kind: "patch_notes", sourceId: "riot-official", artifactId: rawArtifactId, title: parsed.revision.title, url: SOURCES[patch], locator: `revision:${parsed.revision.id}`, snippet: `Riot Games TFT ${patch}; raw sha256 ${rawHash}`, sourcePublishedAt: parsed.revision.publishedAt ? new Date(parsed.revision.publishedAt) : null, datasetKind: "real" }).onConflictDoNothing();
    let inserted = 0;
    for (const change of parsed.changes) {
      if (!change.releaseEventId) continue;
      const releaseId = releaseForEvent(change.releaseEventId);
      if (!RELEASE_IDS.includes(releaseId)) continue;
      const entityKind = classify(change);
      const rawText = String(change.context?.sourceText || change.id);
      const key = canonicalKey(change, entityKind, rawText);
      if (seen.has(key)) { report.duplicatesSuppressed++; continue; }
      seen.add(key);
      const entity = resolveSet18Champion(change.entityId);
      const rawEntityName = String((change.context as any)?.rawEntityName || "").trim() || null;
      const before = stateValue(change.before);
      const after = stateValue(change.after);
      const row = {
        id: `${releaseId}_${change.id}`.slice(0, 250), releaseId, sourceEventId: change.releaseEventId, entityKind,
        entityId: entity?.canonicalId || (change.entityId === "unknown" ? null : change.entityId), rawEntityName: entity?.nameVi || rawEntityName,
        fieldKey: change.fieldPath || null, formId: change.variantId || null, starLevel: null, unit: null, changeType: change.kind,
        beforeState: before.state, beforeValue: before.value, afterState: after.state, afterValue: after.value, rawText, basis: "documented",
        sourceUrl: SOURCES[patch], rawArtifactId, rawHash, sourceLocator: `riot_patch_${patch.replace(".", "_")}_live.html`, parserVersion: riotPatchNotesAdapter.parserVersion,
        applicability: { entityKind, entityId: entity?.canonicalId || change.entityId || null, formId: change.variantId || "default" },
        effectivePrecision: /aug/i.test(change.releaseEventId) ? "date" : "day", verificationStatus: change.validationStatus === "conflict" ? "conflict" : "validated",
        evidenceIds: [evidenceId], canonicalKey: key, visibility: entityKind === "bugfix" ? "maintenance" : "gameplay"
      };
      await db.insert(releaseChanges).values(row as any).onConflictDoNothing();
      inserted++;
      report.byRelease[releaseId] = (report.byRelease[releaseId] || 0) + 1;
    }
    report.sources.push({ patch, url: SOURCES[patch], rawArtifactId, rawHash, bytes: bytes.byteLength, parsedEvents: parsed.events.length, parsedClaims: parsed.claims.length, parsedChanges: parsed.changes.length, inserted });
  }
  await db.execute(sql.raw(`UPDATE releases SET capabilities='{\"canCompareSnapshot\":true,\"canCompareNotes\":true,\"missingEvidence\":[]}'::jsonb WHERE id='rel_live_18_2'`));
  await db.execute(sql.raw(`UPDATE releases SET capabilities='{\"canCompareSnapshot\":false,\"canCompareNotes\":true,\"missingEvidence\":[\"snapshot\"]}'::jsonb WHERE id IN ('event_live_18_1_launch','event_live_18_1_mid_aug27','event_live_18_1_mid_aug28','event_live_18_1_mid_aug31')`));
  report.totalChanges = Object.values(report.byRelease).reduce((total: number, value: any) => total + Number(value), 0);
  console.log(JSON.stringify(report, null, 2));
  await closeDb();
}

main().catch(async (error) => { console.error("[releases:sync:official-notes] Fatal:", error?.message || error); try { await closeDb(); } catch {} process.exit(1); });
