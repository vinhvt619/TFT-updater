import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb } from "../../src/server/db/client";
import {
  releases,
  snapshots,
  champions,
  championSnapshots,
  evidenceRefs,
  snapshotEvidence,
  rawArtifacts,
  publicationDecisions
} from "../../src/server/db/schema";
import { communityDragonAdapter } from "../../src/ingestion/adapters/community-dragon";
import { PublicationService } from "../../src/server/services/publication-service";
import { eq, and } from "drizzle-orm";

async function ingestGameplaySnapshots() {
  console.log("=== INGESTING GENUINE GAMEPLAY SNAPSHOTS (CDRAGON LIVE & PBE VIA PUBLICATION SERVICE) ===");
  const db = await getDb();
  const publicationService = new PublicationService();

  const configs = [
    {
      releaseId: "rel_live_18_2",
      snapshotId: "snap_real_cdragon_live_18_2",
      channel: "live" as const,
      patchLabel: "CommunityDragon Live (Khu Rừng Kỳ Bí Set 18)",
      rawFile: "storage/raw/sha256/57/57cdb0d702fe0f64d3fdb8a850efeef55d338253409d5f2127a749c0db0cba69.json",
      artifactId: "art_cdragon_live_18_2",
      sourceUrl: "https://raw.communitydragon.org/latest/cdragon/tft/vi_vn.json",
      title: "CommunityDragon TFT Live Roster (Set 18)"
    },
    {
      releaseId: "rel_pbe_18_3",
      snapshotId: "snap_real_cdragon_pbe_18_3",
      channel: "pbe" as const,
      patchLabel: "CommunityDragon PBE (Thử Nghiệm Mới Nhất Set 18)",
      rawFile: "storage/raw/sha256/63/633df11cf5ccd0eb692a1df15dc24decd9fc0535b639071acda3e363e32c4aec.json",
      artifactId: "art_cdragon_pbe_18_3",
      sourceUrl: "https://raw.communitydragon.org/pbe/cdragon/tft/en_us.json",
      title: "CommunityDragon TFT PBE Roster (Set 18)"
    }
  ];

  for (const cfg of configs) {
    const filePath = path.resolve(cfg.rawFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Raw file not found: ${filePath}`);
    }

    const rawBuffer = fs.readFileSync(filePath);
    const rawSha256 = crypto.createHash("sha256").update(rawBuffer).digest("hex");
    const byteSize = rawBuffer.length;

    // 1. Register raw artifact
    await db
      .insert(rawArtifacts)
      .values({
        id: cfg.artifactId,
        sha256: rawSha256,
        storageKey: cfg.rawFile.replace(/^storage\/raw\//, ""),
        byteSize,
        contentType: "application/json"
      })
      .onConflictDoUpdate({
        target: rawArtifacts.id,
        set: {
          sha256: rawSha256,
          byteSize,
          storageKey: cfg.rawFile.replace(/^storage\/raw\//, "")
        }
      });

    console.log(`[Raw Artifact] Registered ${cfg.artifactId} (SHA-256: ${rawSha256.slice(0, 16)}..., ${byteSize} bytes)`);

    // 2. Normalize payload
    const norm = await communityDragonAdapter.normalize(rawBuffer, {
      id: cfg.channel === "live" ? "community_dragon_live" : "community_dragon_pbe",
      channel: cfg.channel,
      targetSet: 18
    });

    if (!norm.success || !norm.payload) {
      throw new Error(`Normalization failed for ${cfg.releaseId}: ${norm.errorCode}`);
    }

    const payload = norm.payload;
    const gameplayHash = crypto.createHash("sha256").update(JSON.stringify(payload.champions)).digest("hex");
    const presentationHash = crypto.createHash("sha256").update(JSON.stringify({ label: cfg.patchLabel })).digest("hex");

    console.log(`[Normalized] ${cfg.releaseId}: ${payload.champions.length} Set 18 champions. Gameplay Hash: ${gameplayHash.slice(0, 16)}...`);

    // 3. Ensure release exists
    await db
      .insert(releases)
      .values({
        id: cfg.releaseId,
        datasetKind: "real",
        setNumber: 18,
        gameMode: "standard",
        channel: cfg.channel,
        patchLabel: cfg.patchLabel,
        buildId: rawSha256.slice(0, 8),
        occurrenceKey: cfg.releaseId,
        effectiveAt: null,
        observedAt: fs.statSync(filePath).mtime,
        currentSnapshotId: cfg.snapshotId
      })
      .onConflictDoUpdate({
        target: releases.id,
        set: {
          currentSnapshotId: cfg.snapshotId,
          patchLabel: cfg.patchLabel,
          buildId: rawSha256.slice(0, 8)
        }
      });

    // 4. Register evidence ref using the exact ID produced by the adapter
    const evRefId = norm.evidence[0].id;
    await db
      .insert(evidenceRefs)
      .values({
        id: evRefId,
        kind: "raw_artifact",
        sourceId: cfg.channel === "live" ? "community_dragon_live" : "community_dragon_pbe",
        artifactId: cfg.artifactId,
        title: cfg.title,
        url: cfg.sourceUrl,
        locator: "sets.18.champions",
        snippet: `Dữ liệu gameplay bất biến thực tế Set 18 (${payload.champions.length} tướng)`,
        sourcePublishedAt: null,
        datasetKind: "real"
      })
      .onConflictDoUpdate({
        target: evidenceRefs.id,
        set: {
          artifactId: cfg.artifactId,
          title: cfg.title,
          url: cfg.sourceUrl
        }
      });

    // 5. Determine revision and superseding
    const existingSnaps = await db.select().from(snapshots).where(eq(snapshots.releaseId, cfg.releaseId));
    const revision = existingSnaps.length + 1;
    const supersedesSnapshotId = existingSnaps.length > 0 ? existingSnaps[existingSnaps.length - 1].id : null;

    await db
      .insert(snapshots)
      .values({
        id: cfg.snapshotId,
        releaseId: cfg.releaseId,
        revision,
        status: "draft",
        supersedesSnapshotId,
        parserVersion: "1.0.0",
        mappingVersion: "1.0.0",
        schemaVersion: "1.0.0",
        rawHash: rawSha256,
        gameplayHash,
        presentationHash,
        coverage: {
          rosterCompleteness: payload.rosterCompleteness,
          fieldCoverage: payload.fieldCoverage
        }
      })
      .onConflictDoUpdate({
        target: snapshots.id,
        set: {
          status: "draft",
          rawHash: rawSha256,
          gameplayHash,
          presentationHash,
          reason: null
        }
      });

    // Link evidence to snapshot
    await db
      .insert(snapshotEvidence)
      .values({
        snapshotId: cfg.snapshotId,
        evidenceId: evRefId
      })
      .onConflictDoNothing();

    // 6. Insert Champions and Champion Snapshots
    for (const c of payload.champions) {
      await db
        .insert(champions)
        .values({
          id: c.championId,
          setNumber: 18,
          canonicalKey: c.championId
        })
        .onConflictDoNothing();

      await db
        .insert(championSnapshots)
        .values({
          snapshotId: cfg.snapshotId,
          championId: c.championId,
          payload: c as any
        })
        .onConflictDoUpdate({
          target: [championSnapshots.snapshotId, championSnapshots.championId],
          set: {
            payload: c as any
          }
        });
    }

    // 7. Gate verification & publication via PublicationService
    const pubRes = await publicationService.publishSnapshot({
      snapshotId: cfg.snapshotId,
      releaseId: cfg.releaseId,
      datasetKind: "real",
      setNumber: 18,
      artifactId: cfg.artifactId,
      rawHash: rawSha256,
      evidenceUrls: [cfg.sourceUrl],
      championCount: payload.champions.length,
      payload
    });

    if (!pubRes.published) {
      throw new Error(`Publication rejected by PublicationService: ${pubRes.report.errors.join(", ")}`);
    }

    console.log(`✓ Published snapshot ${cfg.snapshotId} for release ${cfg.releaseId} via PublicationService!`);
  }

  console.log("\n=== ALL REAL GAMEPLAY SNAPSHOTS INGESTED AND PUBLISHED SUCCESSFULLY ===");
}

ingestGameplaySnapshots()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
