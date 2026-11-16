import { metaRepository, incGlobalCacheGen } from "../meta/repositories/meta-repository";
import { diffService } from "./diff-service";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/client";
import {
  rawArtifacts,
  snapshots,
  championSnapshots,
  evidenceRefs,
  metaRankingSnapshots,
  metaCurrentRankingPointers,
  publicationDecisions,
  quarantineRecords,
  diffCache,
  auditLog
} from "../db/schema";
import { SnapshotPayload } from "../../domain/types";
import { eq, sql } from "drizzle-orm";
import { rawStorage } from "../storage/raw-storage";
import { getCurrentLivePatchEpochId } from "../../domain/meta/patch-epochs";

export interface ValidationReport {
  valid: boolean;
  checks: {
    name: string;
    passed: boolean;
    details?: string;
  }[];
  errors: string[];
  warnings: string[];
}

export interface CandidateSnapshotInput {
  snapshotId: string;
  releaseId: string;
  datasetKind: "real" | "demo";
  setNumber: number;
  artifactId?: string;
  rawHash: string;
  evidenceUrls?: string[];
  championCount: number;
  payload?: SnapshotPayload;
}

export interface CandidateRankingInput {
  snapshotId: string;
  datasetKind: "real" | "demo";
  boardType: "websites" | "elite";
  patchEpochId?: string;
  setNumber?: number;
  rawHash?: string;
  sourceDataAsOf?: string;
  fetchedAt?: string;
  inputObservationIds?: string[];
  inputMatchKeys?: string[];
}

export class PublicationService {
  /**
   * 1. Xác thực tính toàn vẹn của Raw Artifact (SHA-256 đối chiếu bytes lưu trữ thực tế)
   */
  async validateArtifact(artifactId: string, expectedSha256?: string): Promise<{ valid: boolean; reason?: string }> {
    const db = await getDb();
    const rows = await db.select().from(rawArtifacts).where(eq(rawArtifacts.id, artifactId)).limit(1);

    if (rows.length === 0) {
      return { valid: false, reason: `Không tìm thấy bản ghi raw_artifact trong DB: ${artifactId}` };
    }

    const artifact = rows[0];
    const storagePath = path.resolve("./storage/raw", artifact.storageKey);

    if (!fs.existsSync(storagePath)) {
      return { valid: false, reason: `Tập tin artifact không tồn tại trên ổ đĩa: ${storagePath}` };
    }

    const content = fs.readFileSync(storagePath);
    const actualHash = crypto.createHash("sha256").update(content).digest("hex");

    if (actualHash !== artifact.sha256) {
      return {
        valid: false,
        reason: `Mâu thuẫn SHA-256 của artifact: DB lưu ${artifact.sha256}, thực tế file là ${actualHash}`
      };
    }

    if (expectedSha256 && expectedSha256 !== actualHash) {
      return {
        valid: false,
        reason: `SHA-256 không khớp với mong đợi: Mong đợi ${expectedSha256}, thực tế là ${actualHash}`
      };
    }

    return { valid: true };
  }

  /**
   * 2. Kiểm duyệt Candidate Snapshot trước khi công bố
   */
  async validateSnapshot(candidate: CandidateSnapshotInput): Promise<ValidationReport> {
    const checks: ValidationReport["checks"] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check 1: Target Set must be 18
    const setPass = candidate.setNumber === 18;
    checks.push({ name: "target_set_18", passed: setPass, details: `Set ${candidate.setNumber}` });
    if (!setPass) errors.push(`Target set phải là 18, nhận được: ${candidate.setNumber}`);

    // Check 2: Fake hash detection
    const notFakeHash = !candidate.rawHash.startsWith("hash_");
    checks.push({ name: "authentic_hash", passed: notFakeHash, details: candidate.rawHash });
    if (!notFakeHash) errors.push(`Raw hash mang tiền tố giả mạo 'hash_': ${candidate.rawHash}`);

    // Check 3: Real dataset requires valid artifact
    if (candidate.datasetKind === "real") {
      if (!candidate.artifactId) {
        checks.push({ name: "real_artifact_presence", passed: false, details: "Thiếu artifactId" });
        errors.push("Dữ liệu 'real' bắt buộc phải có raw artifact đã qua kiểm tra.");
      } else {
        const artCheck = await this.validateArtifact(candidate.artifactId, candidate.rawHash);
        checks.push({ name: "artifact_integrity", passed: artCheck.valid, details: artCheck.reason });
        if (!artCheck.valid) errors.push(artCheck.reason || "Lỗi kiểm tra toàn vẹn artifact.");
      }
    }

    // Check 4: Forbid internal/fake evidence URLs in real mode
    if (candidate.datasetKind === "real" && candidate.evidenceUrls) {
      const badUrls = candidate.evidenceUrls.filter(
        (u) => u.includes("tft18.internal") || u.includes("demo.tft18.internal")
      );
      const urlPass = badUrls.length === 0;
      checks.push({
        name: "verifiable_evidence_urls",
        passed: urlPass,
        details: urlPass ? "URLs hợp lệ" : `Chứa URLs giả lập: ${badUrls.join(", ")}`
      });
      if (!urlPass) errors.push(`Evidence chứa URL giả lập nội bộ: ${badUrls.join(", ")}`);
    }

    // Check 5: Minimum roster size
    const rosterPass = candidate.championCount >= 10;
    checks.push({ name: "minimum_roster_size", passed: rosterPass, details: `${candidate.championCount} tướng` });
    if (!rosterPass) errors.push(`Số lượng tướng quá ít (${candidate.championCount} < 10)`);

    // Check 6: Recursive evidence lineage verification
    if (candidate.datasetKind === "real") {
      const db = await getDb();
      let champPayloads: any[] = [];
      if (candidate.payload && candidate.payload.champions) {
        champPayloads = candidate.payload.champions;
      } else {
        const snapRows = await db
          .select()
          .from(championSnapshots)
          .where(eq(championSnapshots.snapshotId, candidate.snapshotId));
        champPayloads = snapRows.map((r: any) => r.payload);
      }

      if (champPayloads.length > 0) {
        const collectedRefs = new Set<string>();
        const walk = (node: any) => {
          if (!node || typeof node !== "object") return;
          if (Array.isArray(node.sourceRefIds)) {
            for (const s of node.sourceRefIds) {
              if (typeof s === "string" && s.trim()) collectedRefs.add(s.trim());
            }
          }
          for (const k of Object.keys(node)) {
            if (typeof node[k] === "object") walk(node[k]);
          }
        };
        for (const p of champPayloads) walk(p);

        // Verify all collectedRefs exist in evidence_refs and do not use Date.now() timestamp
        const missingRefs: string[] = [];
        const timestampRefs: string[] = [];
        for (const refId of collectedRefs) {
          if (/_\d{13}(?:_|$)/.test(refId)) {
            timestampRefs.push(refId);
          }
          const evRow = await db
            .select({ id: evidenceRefs.id })
            .from(evidenceRefs)
            .where(eq(evidenceRefs.id, refId))
            .limit(1);
          if (evRow.length === 0) {
            missingRefs.push(refId);
          }
        }

        const noTimestamp = timestampRefs.length === 0;
        checks.push({
          name: "canonical_evidence_ids",
          passed: noTimestamp,
          details: noTimestamp ? "Evidence IDs canonical, không dùng timestamp" : `Chứa ID dùng timestamp: ${timestampRefs.join(", ")}`
        });
        if (!noTimestamp) {
          errors.push(`Phát hiện evidence ID sinh bằng Date.now() không hợp lệ: ${timestampRefs.join(", ")}`);
        }

        const allRefsExist = missingRefs.length === 0;
        checks.push({
          name: "recursive_evidence_existence",
          passed: allRefsExist,
          details: allRefsExist ? `Đã xác thực ${collectedRefs.size} sourceRefs tồn tại trong DB` : `Thiếu ${missingRefs.length} bản ghi evidence: ${missingRefs.join(", ")}`
        });
        if (!allRefsExist) {
          errors.push(`Có ${missingRefs.length} sourceRefIds không tồn tại trong evidence_refs: ${missingRefs.join(", ")}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      checks,
      errors,
      warnings
    };
  }

  /**
   * 3. Kiểm duyệt Candidate Ranking trước khi công bố
   */
  async validateRanking(candidate: CandidateRankingInput): Promise<ValidationReport> {
    const checks: ValidationReport["checks"] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const db = await getDb();

    // In real mode, all inputs must be checked against quarantine and freshness
    if (candidate.datasetKind === "real") {
      if (candidate.boardType === "elite") {
        const matchKeys = candidate.inputMatchKeys || [];
        const hasKeys = matchKeys.length > 0;
        const uniqueKeys = new Set(matchKeys);
        checks.push({ name: "elite_input_match_keys_presence", passed: hasKeys, details: `${matchKeys.length} match inputs` });
        if (!hasKeys) errors.push("Elite ranking (real) bắt buộc phải lưu inputMatchKeys; không thể công bố snapshot không có match lineage.");
        if (hasKeys) {
          const cardinalityPass = uniqueKeys.size === matchKeys.length;
          checks.push({ name: "elite_input_match_keys_unique", passed: cardinalityPass, details: `${uniqueKeys.size}/${matchKeys.length} match keys duy nhất` });
          if (!cardinalityPass) errors.push("Elite ranking (real) có inputMatchKeys trùng; không thể xác định lineage duy nhất.");
          const escapedKeys = Array.from(uniqueKeys).map((key) => `'${String(key).replace(/'/g, "''")}'`).join(",");
          const qMatches = await db.execute(
            sql.raw(`SELECT count(*) as cnt FROM meta_matches WHERE match_key IN (${escapedKeys}) AND status <> 'valid'`)
          );
          const invalidCount = parseInt((qMatches.rows[0] as any)?.cnt || "0", 10);
          const matchStatusPass = invalidCount === 0;
          checks.push({ name: "elite_matches_valid", passed: matchStatusPass, details: `${invalidCount} match không ở trạng thái valid` });
          if (!matchStatusPass) errors.push(`Có ${invalidCount} match đầu vào Elite không ở trạng thái valid.`);

          const missingArtifact = await db.execute(
            sql.raw(`SELECT count(*) as cnt FROM meta_matches m LEFT JOIN raw_artifacts a ON a.id = m.raw_artifact_id WHERE m.match_key IN (${escapedKeys}) AND (m.raw_artifact_id IS NULL OR m.raw_artifact_id = '' OR a.id IS NULL OR a.sha256 IS NULL)`)
          );
          const missingArtifactCount = parseInt((missingArtifact.rows[0] as any)?.cnt || "0", 10);
          const artifactPass = missingArtifactCount === 0;
          checks.push({ name: "elite_match_artifacts", passed: artifactPass, details: `${missingArtifactCount} match thiếu raw artifact` });
          if (!artifactPass) errors.push(`Có ${missingArtifactCount} match Elite thiếu raw artifact bất biến.`);

          const missingLineage = await db.execute(
            sql.raw(`SELECT count(*) as cnt FROM meta_matches m WHERE m.match_key IN (${escapedKeys}) AND (NOT EXISTS (SELECT 1 FROM meta_cohort_match_links l WHERE l.match_key = m.match_key) OR NOT EXISTS (SELECT 1 FROM meta_classifications c WHERE c.match_key = m.match_key AND c.status = 'matched'))`)
          );
          const missingLineageCount = parseInt((missingLineage.rows[0] as any)?.cnt || "0", 10);
          const lineagePass = missingLineageCount === 0;
          checks.push({ name: "elite_match_classification_and_cohort_lineage", passed: lineagePass, details: `${missingLineageCount} match thiếu cohort link hoặc classification matched` });
          if (!lineagePass) errors.push(`Có ${missingLineageCount} match Elite thiếu cohort link hoặc classification matched.`);
        }
      }

      if (candidate.boardType === "websites") {
        if (!candidate.inputObservationIds || candidate.inputObservationIds.length === 0) {
          checks.push({
            name: "input_observation_ids_presence",
            passed: false,
            details: "Thiếu danh sách inputObservationIds"
          });
          errors.push("Bảng xếp hạng websites (real mode) bắt buộc phải có inputObservationIds đầu vào.");
        } else {
          checks.push({
            name: "input_observation_ids_presence",
            passed: true,
            details: `${candidate.inputObservationIds.length} observations`
          });

          const obsIds = candidate.inputObservationIds;
          const qObs = await db.execute(
            sql.raw(`SELECT count(*) as cnt FROM meta_source_comp_observations WHERE id IN (${obsIds.map((o) => `'${o}'`).join(",")}) AND status = 'quarantined'`)
          );
          const qCount = parseInt((qObs.rows[0] as any)?.cnt || "0", 10);
          const obsPass = qCount === 0;
          checks.push({ name: "website_observations_not_quarantined", passed: obsPass, details: `${qCount} quan sát bị cách ly` });
          if (!obsPass) errors.push(`Có ${qCount} quan sát website đầu vào đang trong trạng thái bị cách ly (quarantined).`);

          // 1. Cardinality check
          const obsRows = await db.execute(
            sql.raw(`SELECT id, source_id, source_data_as_of, source_published_at, fetched_at, created_at, status FROM meta_source_comp_observations WHERE id IN (${obsIds.map((o) => `'${o}'`).join(",")})`)
          );
          const foundCount = obsRows.rows.length;
          const expectedCount = obsIds.length;
          const cardinalityPass = foundCount === expectedCount;
          checks.push({
            name: "input_observation_cardinality",
            passed: cardinalityPass,
            details: `Tìm thấy ${foundCount}/${expectedCount} observations`
          });
          if (!cardinalityPass) {
            errors.push(`Số lượng observation tìm thấy (${foundCount}) không khớp số lượng yêu cầu (${expectedCount})`);
          }

          // 2. Status check: only status = 'valid' permitted
          const invalidStatusRows = (obsRows.rows as any[]).filter((r) => r.status !== "valid");
          const statusPass = invalidStatusRows.length === 0;
          checks.push({
            name: "input_observations_all_valid",
            passed: statusPass,
            details: statusPass ? "100% observations có status = valid" : `Có ${invalidStatusRows.length} observations không hợp lệ`
          });
          if (!statusPass) {
            errors.push(`Có ${invalidStatusRows.length} observations đầu vào không mang trạng thái 'valid'.`);
          }

          // 3. Per-source Freshness Gate:
          const perSourceDates = new Map<string, Date[]>();
          for (const r of obsRows.rows as any[]) {
            const sid = r.source_id;
            if (!perSourceDates.has(sid)) perSourceDates.set(sid, []);
            // Use authentic statistical data window or network verification timestamp (contentObservedAt / fetched_at)
            const dStr = r.source_data_as_of || r.source_published_at || r.fetched_at || r.created_at;
            if (dStr) {
              const d = new Date(dStr);
              if (!isNaN(d.getTime())) perSourceDates.get(sid)!.push(d);
            }
          }

          let allSourcesFresh = true;
          const sourceFreshnessDetails: string[] = [];
          const staleSources: string[] = [];

          for (const [sourceId, dates] of perSourceDates.entries()) {
            if (dates.length === 0) {
              allSourcesFresh = false;
              staleSources.push(`${sourceId} (thiếu timestamp xác thực)`);
              sourceFreshnessDetails.push(`${sourceId}: thiếu timestamp`);
            } else {
              const oldestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
              const ageHours = (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60);
              if (ageHours > 48) {
                allSourcesFresh = false;
                staleSources.push(`${sourceId} (${Math.floor(ageHours)}h > 48h)`);
                sourceFreshnessDetails.push(`${sourceId}: ${Math.floor(ageHours)}h > 48h`);
              } else {
                sourceFreshnessDetails.push(`${sourceId}: ${Math.floor(ageHours)}h <= 48h`);
              }
            }
          }

          checks.push({
            name: "per_source_freshness",
            passed: allSourcesFresh,
            details: sourceFreshnessDetails.join("; ")
          });
          if (!allSourcesFresh) {
            errors.push(`Per-source freshness gate thất bại: các nguồn sau bị quá hạn 48h hoặc thiếu timestamp: ${staleSources.join(", ")}`);
          }
        }
      }

      // Freshness Gate (Requirement 1): Raw source age must not exceed 48 hours for real dataset publication
      let isFresh = true;
      let freshnessReason = "";
      const sourceTimestamp = candidate.sourceDataAsOf || candidate.fetchedAt;
      if (!sourceTimestamp) {
        isFresh = false;
        freshnessReason = "Thiếu bằng chứng thời gian dữ liệu nguồn (sourceDataAsOf / fetchedAt)";
      } else {
        const asOfDate = new Date(sourceTimestamp);
        if (isNaN(asOfDate.getTime())) {
          isFresh = false;
          freshnessReason = `Timestamp nguồn không hợp lệ: ${sourceTimestamp}`;
        } else {
          const ageHours = (Date.now() - asOfDate.getTime()) / (1000 * 60 * 60);
          if (ageHours > 48) {
            isFresh = false;
            freshnessReason = `Dữ liệu (${sourceTimestamp}) đã cũ ${Math.floor(ageHours)} giờ (> 48h)`;
          }
        }
      }
      checks.push({
        name: "freshness_gate",
        passed: isFresh,
        details: isFresh ? "Đạt chuẩn freshness gate (<= 48h)" : freshnessReason
      });
      if (!isFresh) {
        errors.push(`Không thể công bố ranking chính thức: Raw source không đạt freshness gate (${freshnessReason}).`);
      }
    }

    return {
      valid: errors.length === 0,
      checks,
      errors,
      warnings
    };
  }

  /**
   * 4. Quyết định công bố Snapshot qua Gate
   */
  async publishSnapshot(candidate: CandidateSnapshotInput): Promise<{ published: boolean; report: ValidationReport }> {
    const report = await this.validateSnapshot(candidate);
    const db = await getDb();
    const decisionId = `pd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      return await db.transaction(async (tx: any) => {
        if (report.valid) {
          await tx.update(snapshots).set({ status: "published" }).where(eq(snapshots.id, candidate.snapshotId));
          await tx.insert(publicationDecisions).values({
            id: decisionId,
            entityType: "snapshot",
            entityId: candidate.snapshotId,
            decision: "published",
            reason: "Vượt qua toàn bộ quy chuẩn kiểm duyệt tự động (Target Set 18, authentic hash, valid artifact).",
            decidedBy: "PublicationService",
            validationReport: report as any
          });
          return { published: true, report };
        } else {
          await tx
            .update(snapshots)
            .set({ status: "quarantined", reason: report.errors.join("; ") })
            .where(eq(snapshots.id, candidate.snapshotId));

          await tx.insert(publicationDecisions).values({
            id: decisionId,
            entityType: "snapshot",
            entityId: candidate.snapshotId,
            decision: "quarantined",
            reason: report.errors.join("; "),
            decidedBy: "PublicationService",
            validationReport: report as any
          });

          return { published: false, report };
        }
      });
    } finally {
      invalidateAllCaches();
    }
  }

  /**
   * 5. Quyết định công bố Ranking Snapshot qua Gate
   */
  async publishRanking(candidate: CandidateRankingInput): Promise<{ published: boolean; report: ValidationReport }> {
    const report = await this.validateRanking(candidate);
    const db = await getDb();
    const decisionId = `pd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
    return await db.transaction(async (tx: any) => {
      if (report.valid) {
        await tx
          .update(metaRankingSnapshots)
          .set({ status: "published" })
          .where(eq(metaRankingSnapshots.id, candidate.snapshotId));

        // The pointer is part of the same transaction. Any failure aborts publication,
        // so readers cannot observe a published snapshot with a stale pointer.
        const [snapshotRow] = await tx
          .select({ totals: metaRankingSnapshots.totals })
          .from(metaRankingSnapshots)
          .where(eq(metaRankingSnapshots.id, candidate.snapshotId));
        const totals = (snapshotRow?.totals || {}) as Record<string, number>;
        const inputCount = (candidate.inputObservationIds?.length || 0) + (candidate.inputMatchKeys?.length || 0);
        const rankedCount = (totals.rankedTierS || 0) + (totals.rankedTierA || 0) + (totals.rankedTierB || 0) + (totals.rankedTierC || 0);
        const patchEpoch = candidate.patchEpochId || getCurrentLivePatchEpochId();
        const pointerId = `pointer_${candidate.boardType}_${patchEpoch}_${candidate.datasetKind}`;
        const fingerprint = crypto.createHash("sha256").update(JSON.stringify({
          snapshotId: candidate.snapshotId,
          inputObservationIds: [...(candidate.inputObservationIds || [])].sort(),
          inputMatchKeys: [...(candidate.inputMatchKeys || [])].sort(),
          rankedCount
        })).digest("hex");
        const publishedAt = new Date();

        await tx
          .insert(metaCurrentRankingPointers)
          .values({
            id: pointerId,
            boardType: candidate.boardType,
            patchEpochId: patchEpoch,
            datasetKind: candidate.datasetKind,
            rankingSnapshotId: candidate.snapshotId,
            publishedAt,
            inputCount,
            rankedCount,
            fingerprint
          })
          .onConflictDoUpdate({
            target: metaCurrentRankingPointers.id,
            set: {
              rankingSnapshotId: candidate.snapshotId,
              publishedAt,
              inputCount,
              rankedCount,
              fingerprint
            }
          });

        await tx.insert(publicationDecisions).values({
          id: decisionId,
          entityType: "ranking",
          entityId: candidate.snapshotId,
          decision: "published",
          reason: "Đầu vào hợp lệ, không phụ thuộc vào bản ghi bị cách ly, đạt per-source freshness.",
          decidedBy: "PublicationService",
          validationReport: report as any
        });
        return { published: true, report };
      } else {
        const isStale = report.errors.some((e) => e.includes("freshness") || e.includes("quá hạn") || e.includes("cũ"));
        const fallbackStatus = isStale ? "stale" : "quarantined";
        await tx.execute(
          sql.raw(`UPDATE meta_ranking_snapshots SET status = '${fallbackStatus}', quarantine_reason = '${report.errors.join("; ").replace(/'/g, "''")}' WHERE id = '${candidate.snapshotId}'`)
        );
        try {
          await tx.execute(
            sql.raw(`DELETE FROM meta_current_ranking_pointers WHERE ranking_snapshot_id = '${candidate.snapshotId}'`)
          );
        } catch {}
        await tx.insert(publicationDecisions).values({
          id: decisionId,
          entityType: "ranking",
          entityId: candidate.snapshotId,
          decision: fallbackStatus,
          reason: report.errors.join("; "),
          decidedBy: "PublicationService",
          validationReport: report as any
        });
        return { published: false, report };
      }
    });
    } finally {
      invalidateAllCaches();
    }
  }

  /**
   * 6. Thu hồi (Retract) một thực thể và lan truyền thu hồi các phụ thuộc
   */
  async retractEntity(entityType: "snapshot" | "ranking" | "observation", entityId: string, reason: string): Promise<void> {
    const db = await getDb();
    const decisionId = `pd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await db.transaction(async (tx: any) => {
        if (entityType === "snapshot") {
          await tx.execute(
            sql.raw(`UPDATE snapshots SET status = 'withdrawn', reason = '${reason.replace(/'/g, "''")}' WHERE id = '${entityId}'`)
          );
          // Purge diff cache referencing this snapshot
          await tx.execute(
            sql.raw(`DELETE FROM diff_cache WHERE from_snapshot_id = '${entityId}' OR to_snapshot_id = '${entityId}'`)
          );
        } else if (entityType === "ranking") {
          await tx.execute(
            sql.raw(`UPDATE meta_ranking_snapshots SET status = 'quarantined', quarantine_reason = '${reason.replace(/'/g, "''")}' WHERE id = '${entityId}'`)
          );
          try {
            await tx.execute(
              sql.raw(`DELETE FROM meta_current_ranking_pointers WHERE ranking_snapshot_id = '${entityId}'`)
            );
          } catch {}
        }

        await tx.insert(publicationDecisions).values({
          id: decisionId,
          entityType,
          entityId,
          decision: "retracted",
          reason,
          decidedBy: "PublicationService",
          validationReport: { retractedAt: new Date().toISOString() } as any
        });

        await tx.insert(auditLog).values({
          id: `al_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          actor: "PublicationService:retract",
          action: "retract",
          targetId: entityId,
          reason
        });
      });
    } finally {
      invalidateAllCaches();
    }
  }
}

function invalidateAllCaches(): void {
  try {
    incGlobalCacheGen();
  } catch {}
  try {
    metaRepository.clearCache();
  } catch {}
  try {
    diffService.clearCache();
  } catch {}
}
export const publicationService = new PublicationService();
