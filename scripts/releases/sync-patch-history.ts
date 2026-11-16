import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb, closeDb } from "../../src/server/db/client";
import { evidenceRefs, rawArtifacts, releaseChanges } from "../../src/server/db/schema";
import { riotPatchNotesAdapter } from "../../src/ingestion/adapters/riot-patch-notes";
import { GameplayChange } from "../../src/domain/releases/types";
import registry from "../../src/domain/meta/generated-set18-registry.json";

const RAW_DIR = path.resolve("storage/raw");
const URLS = {
  "18.1": "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1/",
  "18.2": "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-2/"
} as const;

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").trim();
const championNames = new Set((registry.entries as Array<{ nameEn: string; canonicalId: string }>).map((entry) => normalize(entry.nameEn)));
const traitNames = new Set((registry.entries as Array<{ traits: string[] }>).flatMap((entry) => entry.traits || []).map(normalize));

function classify(change: GameplayChange): "champion" | "trait" | "item" | "augment" | "system" | "bugfix" | "unknown" {
  const text = String(change.context?.sourceText || "").trim();
  const first = normalize(text.split(/[:\s]/)[0] || "");
  if (change.kind === "bugfix" || /^fixed\b/i.test(text) || /^mobile\b/i.test(text)) return "bugfix";
  if (/\b(hand of justice|bloodthirster|infinity edge|jeweled gauntlet|radiant|artifact|anvil|item|tactician|ornn)\b/i.test(text)) return "item";
  if (/\baugment\b/i.test(text)) return "augment";
  if (change.entityId !== "unknown" && /^tft18_/.test(change.entityId)) {
    const name = normalize(change.entityId.replace(/^tft18_/, "").replace(/_(?:ap|ad|form)$/, ""));
    if (championNames.has(name) || Array.from(championNames).some((known) => known.startsWith(name) || name.startsWith(known))) return "champion";
  }
  if (traitNames.has(first)) return "trait";
  // An unmapped name remains a system/raw entity.  It is never silently
  // promoted to a champion merely because the parser produced a `tft18_*`
  // shaped identifier.
  return "system";
}

function stateValue(value: any): { state: string; value: any } {
  if (!value || value.state === "missing" || value.state === "not_applicable" || value.state === "conflict") return { state: value?.state || "missing", value: null };
  return { state: "known", value: value.value ?? null };
}

function unitFor(change: GameplayChange): string | null {
  const text = String(change.context?.sourceText || "");
  if (/%/.test(text)) return "%";
  return text.match(/\b(AD|AP|AS|MR|HP|Mana|seconds?|gold)\b/i)?.[1] || null;
}

function rawEntityName(change: GameplayChange): string | null {
  if (change.entityId === "unknown") return null;
  return change.entityId.replace(/^tft18_/, "");
}

function locatorFor(eventId: string, patch: "18.1" | "18.2"): string {
  const suffix = eventId.includes("aug27") ? "#patch-august-27th" : eventId.includes("aug28") ? "#patch-august-28th" : eventId.includes("aug31") ? "#patch-august-31st-and-september-1st" : "";
  return `riot_patch_${patch.replace(".", "_")}_live.html${suffix}`;
}

async function main() {
  const db = await getDb();
  const allEventIds = ["event_live_18_1_launch", "event_live_18_1_mid_aug27", "event_live_18_1_mid_aug28", "event_live_18_1_mid_aug31", "event_live_18_2_main", "rel_live_18_2"];
  await db.delete(releaseChanges).where(inArray(releaseChanges.releaseId, allEventIds));
  const report: any = { run: "releases:sync:history", parserVersion: riotPatchNotesAdapter.parserVersion, sources: [], claims: 0, changes: 0, byRelease: {} };
  for (const patch of ["18.1", "18.2"] as const) {
    const filePath = path.join(RAW_DIR, `riot_patch_${patch.replace(".", "_")}_live.html`);
    if (!fs.existsSync(filePath)) throw new Error(`Missing immutable Riot raw artifact: ${filePath}`);
    const bytes = fs.readFileSync(filePath);
    const rawHash = crypto.createHash("sha256").update(bytes).digest("hex");
    const rawArtifactId = `art_18_${patch === "18.1" ? "1" : "2"}_html`;
    await db.insert(rawArtifacts).values({ id: rawArtifactId, sha256: rawHash, storageKey: `riot_patch_${patch.replace(".", "_")}_live.html`, byteSize: bytes.byteLength, contentType: "text/html" }).onConflictDoUpdate({ target: rawArtifacts.id, set: { sha256: rawHash, byteSize: bytes.byteLength, contentType: "text/html" } });
    const parsed = riotPatchNotesAdapter.parseArticle(bytes.toString("utf8"), URLS[patch], { rawArtifactId, rawHash });
    const evidenceId = `ev_riot_${patch.replace(".", "_")}_official`;
    await db.insert(evidenceRefs).values({ id: evidenceId, kind: "patch_notes", sourceId: "riot-official", artifactId: rawArtifactId, title: parsed.revision.title, url: URLS[patch], locator: `revision:${parsed.revision.id}`, snippet: `Riot Games TFT patch ${patch}; raw sha256 ${rawHash}`, sourcePublishedAt: parsed.revision.publishedAt ? new Date(parsed.revision.publishedAt) : null, datasetKind: "real" }).onConflictDoUpdate({ target: evidenceRefs.id, set: { artifactId: rawArtifactId, url: URLS[patch], locator: `revision:${parsed.revision.id}`, snippet: `Riot Games TFT patch ${patch}; raw sha256 ${rawHash}` } });
    const changesByEvent = new Map<string, GameplayChange[]>();
    for (const change of parsed.changes) {
      if (!change.releaseEventId) continue;
      const list = changesByEvent.get(change.releaseEventId) || [];
      list.push(change);
      changesByEvent.set(change.releaseEventId, list);
    }
    if (patch === "18.1" && !changesByEvent.has("event_live_18_1_launch")) {
      changesByEvent.set("event_live_18_1_launch", [{ id: "change_event_live_18_1_launch_overview", releaseEventId: "event_live_18_1_launch", fromSnapshotId: null, toSnapshotId: null, entityId: "unknown", variantId: "default", fieldPath: "release_overview", context: { sourceText: "Riot Games published the 18.1 launch notes; no earlier Set 18 snapshot is available for a numeric delta." }, kind: "mechanic", before: { state: "missing", reason: "No pre-launch Set 18 baseline", evidenceIds: [evidenceId] }, after: { state: "missing", reason: "Launch notes describe the new set without a comparable snapshot", evidenceIds: [evidenceId] }, evidenceIds: [evidenceId], validationStatus: "validated" }]);
    }
    for (const [eventId, eventChanges] of changesByEvent.entries()) {
      const releaseIds = eventId === "event_live_18_2_main" ? [eventId, "rel_live_18_2"] : [eventId];
      for (const releaseId of releaseIds) {
        const rows = eventChanges.map((change, index) => {
          const before = stateValue(change.before);
          const after = stateValue(change.after);
          const entityKind = classify(change);
          const entityId = change.entityId === "unknown" ? null : change.entityId;
          return { id: `${releaseId}_${change.id}_${index}`.slice(0, 250), releaseId, sourceEventId: eventId, entityKind, entityId, rawEntityName: rawEntityName(change), fieldKey: change.fieldPath || null, formId: change.variantId || null, starLevel: null, unit: unitFor(change), changeType: change.kind, beforeState: before.state, beforeValue: before.value, afterState: after.state, afterValue: after.value, rawText: String(change.context?.sourceText || change.id), basis: "documented", sourceUrl: URLS[patch], rawArtifactId, rawHash, sourceLocator: locatorFor(eventId, patch), parserVersion: riotPatchNotesAdapter.parserVersion, applicability: { entityKind, entityId, formId: change.variantId || "default" }, effectivePrecision: eventId.includes("aug") ? "date" : "day", verificationStatus: change.validationStatus === "conflict" ? "conflict" : "validated", evidenceIds: [evidenceId] };
        });
        if (rows.length) {
          await db.insert(releaseChanges).values(rows as any[]).onConflictDoNothing();
          report.byRelease[releaseId] = rows.length;
          report.changes += rows.length;
          report.claims += rows.length;
        }
      }
    }
    report.sources.push({ patch, url: URLS[patch], rawArtifactId, rawHash, bytes: bytes.byteLength, parsedEvents: parsed.events.length, parsedClaims: parsed.claims.length, parsedChanges: parsed.changes.length });
  }
  await db.execute(sql.raw(`UPDATE releases SET capabilities='{"canCompareSnapshot":true,"canCompareNotes":true,"missingEvidence":[]}'::jsonb WHERE id='rel_live_18_2'`));
  await db.execute(sql.raw(`UPDATE releases SET capabilities='{"canCompareSnapshot":false,"canCompareNotes":true,"missingEvidence":["snapshot"]}'::jsonb WHERE id IN ('event_live_18_1_launch','event_live_18_1_mid_aug27','event_live_18_1_mid_aug28','event_live_18_1_mid_aug31','event_live_18_2_main')`));
  console.log(JSON.stringify(report, null, 2));
  await closeDb();
}

main().catch(async (error) => { console.error("[releases:sync:history] Fatal:", error?.message || error); try { await closeDb(); } catch {} process.exit(1); });
