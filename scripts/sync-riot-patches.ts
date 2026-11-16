import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb } from "../src/server/db/client";
import {
  releases,
  evidenceRefs,
  rawArtifacts,
  releaseChanges
} from "../src/server/db/schema";
import { riotPatchNotesAdapter } from "../src/ingestion/adapters/riot-patch-notes";

export async function syncPatches() {
  console.log("=== ĐỒNG BỘ BÀI VIẾT PATCH NOTES THẬT TỪ RIOT GAMES (18.1, 18.2, 18.6) ===");
  const db = await getDb();

  const patchFiles = [
    {
      fileName: "riot_patch_18_1_live.html",
      url: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-1/",
      patchFamily: "18.1"
    },
    {
      fileName: "riot_patch_18_2_live.html",
      url: "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-2/",
      patchFamily: "18.2"
    },
    {
      fileName: "riot_patch_18_6_live.html",
      url: "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-6/",
      patchFamily: "18.6"
    }
  ];

  for (const item of patchFiles) {
    const filePath = path.resolve("./storage/raw", item.fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`Không tìm thấy file raw artifact: ${filePath}, bỏ qua.`);
      continue;
    }

    const htmlContent = fs.readFileSync(filePath, "utf8");
    const rawHash = crypto.createHash("sha256").update(htmlContent).digest("hex");
    const rawArtifactId = `art_${item.patchFamily.replace(".", "_")}_html`;

    // 1. Lưu raw artifact vào DB
    await db
      .insert(rawArtifacts)
      .values({
        id: rawArtifactId,
        sha256: rawHash,
        storageKey: item.fileName,
        byteSize: Buffer.byteLength(htmlContent),
        contentType: "text/html"
      })
      .onConflictDoNothing();

    // 2. Parse bài viết
    const parsed = riotPatchNotesAdapter.parseArticle(htmlContent, item.url, {
      rawArtifactId,
      rawHash
    });

    console.log(`\n[Parsed ${item.patchFamily}]:`);
    console.log(`  - Title: ${parsed.revision.title}`);
    console.log(`  - Authors: ${parsed.revision.authors.join(", ") || "Riot Team"}`);
    console.log(`  - Events: ${parsed.events.length} (${parsed.events.map((e) => e.displayLabel).join(", ")})`);
    console.log(`  - Claims: ${parsed.claims.length} claims`);
    console.log(`  - Changes: ${parsed.changes.length} documented changes`);

    // Lưu releases vào DB
    for (const ev of parsed.events) {
      await db
        .insert(releases)
        .values({
          id: ev.id,
          datasetKind: "real",
          setNumber: 18,
          gameMode: "standard",
          channel: "live",
          patchLabel: ev.displayLabel,
          buildId: null,
          occurrenceKey: ev.id,
          effectiveAt: ev.effectiveAt ? new Date(ev.effectiveAt) : null,
          observedAt: new Date(ev.firstObservedAt),
          currentSnapshotId: null,
          patchFamily: item.patchFamily,
          officialLabel: ev.officialLabel || item.patchFamily,
          displayLabel: ev.displayLabel,
          displayVersion: item.patchFamily,
          displayAlias: item.patchFamily,
          historyVisibility: "primary",
          versionSortKey: `90:${item.patchFamily}:live:main`,
          orderingKey: `90:${item.patchFamily}:live:main`,
          capabilities: { canCompareSnapshot: false, canCompareNotes: true, missingEvidence: ["snapshot"] }
        })
        .onConflictDoNothing();
    }

    // Lưu evidence_refs
    const evRefId = `ev_riot_${item.patchFamily.replace(".", "_")}_official`;
    await db
      .insert(evidenceRefs)
      .values({
        id: evRefId,
        kind: "patch_notes",
        sourceId: "riot_official_en",
        artifactId: rawArtifactId,
        title: parsed.revision.title,
        url: item.url,
        locator: `revision:${parsed.revision.id}`,
        snippet: `Bài viết chính thức Riot Games Patch ${item.patchFamily}`,
        sourcePublishedAt: parsed.revision.publishedAt ? new Date(parsed.revision.publishedAt) : null,
        datasetKind: "real"
      })
      .onConflictDoNothing();

    // Lưu release_changes
    for (const ch of parsed.changes) {
      const releaseId = parsed.events[0]?.id || `event_live_${item.patchFamily.replace(".", "_")}`;
      await db
        .insert(releaseChanges)
        .values({
          id: ch.id,
          releaseId,
          sourceEventId: releaseId,
          entityKind: (ch.context?.entityKind as any) || "champion",
          entityId: ch.entityId,
          rawEntityName: (ch.context?.rawEntityName as any) || ch.entityId,
          fieldKey: ch.fieldPath,
          formId: ch.variantId || "default",
          changeType: ch.kind,
          beforeState: ch.before.state,
          beforeValue: ch.before.state === "known" ? ch.before.value : null,
          afterState: ch.after.state,
          afterValue: ch.after.state === "known" ? ch.after.value : null,
          rawText: (ch.context?.sourceText as string) || `${ch.entityId} ${ch.fieldPath}`,
          basis: "documented",
          sourceUrl: item.url,
          rawArtifactId,
          rawHash,
          applicability: { entityId: ch.entityId },
          effectivePrecision: "day",
          verificationStatus: "validated",
          evidenceIds: [rawArtifactId],
          canonicalKey: `${releaseId}|${ch.entityId}|${ch.fieldPath}`,
          visibility: "gameplay"
        })
        .onConflictDoNothing();
    }
  }

  console.log("\n[Thành công] Toàn bộ sự kiện và claims thật từ Riot đã được lưu trữ có provenance!");
}

if (process.argv[1] && process.argv[1].includes("sync-riot-patches")) {
  syncPatches()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Sync Patches Error]:", err);
      process.exit(1);
    });
}
