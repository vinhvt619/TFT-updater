import { getDb } from "../db/client";
import {
  releases,
  snapshots,
  champions,
  championSnapshots,
  evidenceRefs,
  snapshotEvidence,
  auditLog
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { ImportEnvelope, SnapshotPayload } from "../../domain/types";
import { parseTftVersion } from "../../domain/versioning";
import { rawStorage } from "../storage/raw-storage";
import { publicationService } from "./publication-service";
import { diffService } from "./diff-service";
import { metaRepository } from "../meta/repositories/meta-repository";
import crypto from "crypto";

export class SnapshotService {
  async importEnvelope(envelope: ImportEnvelope, autoPublish: boolean = false): Promise<{ snapshotId: string; releaseId: string; isNew: boolean }> {
    const db = await getDb();
    const { release: relData, payload, evidence: evList, notes } = envelope;

    // 1. Store raw artifact
    const jsonStr = JSON.stringify(envelope, null, 2);
    const artifact = rawStorage.putIfAbsent(jsonStr);

    // 2. Find or create release by occurrenceKey
    const datasetKind = payload.datasetKind;
    let releaseId = `rel_${datasetKind}_${relData.channel}_${relData.occurrenceKey}`;
    const parsedVersion = parseTftVersion(relData.patchLabel, relData.channel, relData.occurrenceKey, relData.buildId);
    const existingReleases = await db
      .select()
      .from(releases)
      .where(and(eq(releases.occurrenceKey, relData.occurrenceKey), eq(releases.datasetKind, datasetKind)))
      .limit(1);
    
    if (existingReleases.length === 0) {
      await db.insert(releases).values({
        id: releaseId,
        datasetKind,
        setNumber: payload.setNumber,
        gameMode: payload.gameMode,
        channel: relData.channel,
        patchLabel: relData.patchLabel,
        buildId: relData.buildId,
        occurrenceKey: relData.occurrenceKey,
        effectiveAt: relData.effectiveAt ? new Date(relData.effectiveAt) : null,
        observedAt: new Date(),
        currentSnapshotId: null,
        versionKey: parsedVersion.versionKey,
        displayVersion: parsedVersion.displayVersion,
        versionSortKey: parsedVersion.sortKey,
        releaseKind: parsedVersion.kind,
        hotfixSuffix: parsedVersion.hotfixSuffix,
        pbeRevision: parsedVersion.pbeRevision,
        evidenceStatus: "unknown"
      });
    } else {
      releaseId = existingReleases[0].id;
    }

    // 3. Check for existing snapshot with same gameplay hash
    const rawHash = artifact.sha256;
    const gameplayHash = crypto.createHash("sha256").update(JSON.stringify(payload.champions)).digest("hex");
    const presentationHash = crypto.createHash("sha256").update(JSON.stringify({ notes, meta: relData })).digest("hex");

    const existingSnapshots = await db
      .select()
      .from(snapshots)
      .where(and(eq(snapshots.releaseId, releaseId), eq(snapshots.gameplayHash, gameplayHash)))
      .limit(1);

    if (existingSnapshots.length > 0) {
      return {
        snapshotId: existingSnapshots[0].id,
        releaseId,
        isNew: false
      };
    }

    // Determine revision
    const allRevs = await db.select().from(snapshots).where(eq(snapshots.releaseId, releaseId));
    const revision = allRevs.length + 1;
    const snapshotId = `snap_${releaseId}_rev${revision}`;

    // 4. Save Evidence Records
    for (const ev of evList) {
      await db
        .insert(evidenceRefs)
        .values({
          id: ev.id,
          kind: ev.kind,
          sourceId: ev.sourceId,
          title: ev.title,
          url: ev.url,
          locator: ev.locator,
          snippet: ev.snippet,
          sourcePublishedAt: ev.sourcePublishedAt ? new Date(ev.sourcePublishedAt) : null,
          datasetKind: ev.datasetKind
        })
        .onConflictDoNothing();
    }

    // 5. Insert Snapshot record initially as staging
    await db.insert(snapshots).values({
      id: snapshotId,
      releaseId,
      revision,
      status: "staging",
      parserVersion: "1.0.0",
      mappingVersion: "1.0.0",
      schemaVersion: payload.schemaVersion,
      rawHash,
      gameplayHash,
      presentationHash,
      coverage: {
        rosterCompleteness: payload.rosterCompleteness,
        fieldCoverage: payload.fieldCoverage
      }
    });

    // Link evidence to snapshot
    for (const ev of evList) {
      await db
        .insert(snapshotEvidence)
        .values({
          snapshotId,
          evidenceId: ev.id
        })
        .onConflictDoNothing();
    }

    // 6. Insert Champions and Champion Snapshots
    for (const champ of payload.champions) {
      await db
        .insert(champions)
        .values({
          id: champ.championId,
          setNumber: payload.setNumber,
          canonicalKey: champ.championId
        })
        .onConflictDoNothing();

      await db
        .insert(championSnapshots)
        .values({
          snapshotId,
          championId: champ.championId,
          payload: champ as any
        })
        .onConflictDoNothing();
    }

    // If autoPublish, enforce PublicationService gating as the sole publication path
    if (autoPublish) {
      const pubResult = await publicationService.publishSnapshot({
        snapshotId,
        releaseId,
        datasetKind: payload.datasetKind || "real",
        setNumber: payload.setNumber,
        artifactId: undefined,
        rawHash,
        evidenceUrls: evList.map((e) => e.url).filter((u): u is string => Boolean(u)),
        championCount: payload.champions.length,
        payload
      });
      if (pubResult.published) {
        await db
          .update(releases)
          .set({ currentSnapshotId: snapshotId, evidenceStatus: "available" })
          .where(eq(releases.id, releaseId));
      }
    }

    diffService.clearCache();
    metaRepository.clearCache();

    return {
      snapshotId,
      releaseId,
      isNew: true
    };
  }

  async approveSnapshot(snapshotId: string, reason: string, actor: string = "cli_admin"): Promise<void> {
    const db = await getDb();
    const snapRows = await db.select().from(snapshots).where(eq(snapshots.id, snapshotId)).limit(1);
    if (snapRows.length === 0) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const snap = snapRows[0];

    // Gating strictly through PublicationService
    const pubResult = await publicationService.publishSnapshot({
      snapshotId,
      releaseId: snap.releaseId,
      datasetKind: (snap as any).datasetKind || "real",
      setNumber: 18,
      rawHash: snap.rawHash,
      championCount: 74
    });

    if (!pubResult.published) {
      throw new Error(`Snapshot publication gate rejected: ${pubResult.report.errors.join("; ")}`);
    }

    // Update release currentSnapshotId pointer
    await db
      .update(releases)
      .set({ currentSnapshotId: snapshotId })
      .where(eq(releases.id, snap.releaseId));

    // Log audit
    await db.insert(auditLog).values({
      id: `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      actor,
      action: "approve_snapshot",
      targetId: snapshotId,
      reason,
      evidenceRefs: []
    });

    diffService.clearCache();
    metaRepository.clearCache();
  }
}

export const snapshotService = new SnapshotService();
