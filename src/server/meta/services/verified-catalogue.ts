import type { RankingSnapshot } from "@/domain/meta/schemas";
import { metaRepository } from "@/server/meta/repositories/meta-repository";
import { verifySourceObservation } from "./source-verification";

export interface VerifiedWebsiteOptions {
  referenceTime?: string;
  mode?: "current" | "archive";
  maxAgeHours?: number;
}

/** 
 * Public current rankings require current, claim-bound source observations, not just an old pointer.
 * FIN-02: Separates current mode (real-time clock) from archive mode (snapshot clock).
 * FIN-03: Enforces strict input observation lineage; never passes through when inputObsIds is empty.
 */
export async function verifiedWebsiteSnapshot(
  snapshot: RankingSnapshot,
  optionsOrRefTime?: string | VerifiedWebsiteOptions
): Promise<RankingSnapshot> {
  if (snapshot.datasetKind !== "real" || snapshot.publicationStatus !== "published") {
    return { ...snapshot, rows: [], status: "collecting" };
  }

  const options: VerifiedWebsiteOptions =
    typeof optionsOrRefTime === "string"
      ? { referenceTime: optionsOrRefTime }
      : optionsOrRefTime || {};

  const mode = options.mode ?? "current";
  const maxAgeHours = options.maxAgeHours ?? 72;

  const inputObsIds = new Set(snapshot.inputObservationIds || []);
  let observations: any[] = [];
  if (inputObsIds.size > 0 && typeof (metaRepository as any).getSourceObservationsByIds === "function") {
    observations = await (metaRepository as any).getSourceObservationsByIds(Array.from(inputObsIds));
  }
  if (observations.length === 0) {
    observations = await metaRepository.getLatestSourceObservations(snapshot.rankingScope.patchEpochId, "real");
  }

  // FIN-02: Chế độ hiện tại kiểm tra theo clock thời gian thực; lịch sử dùng clock snapshot/ngày phát hành
  let effectiveRefTime = options.referenceTime;
  if (!effectiveRefTime) {
    if (mode === "archive") {
      const timestamps = [
        ...Object.values((snapshot.rankingScope as any)?.sourceDataAsOfBySource || {}),
        snapshot.rankingGeneratedAt,
        snapshot.generatedAt,
        snapshot.sourceDataAsOf,
        ...observations.map((o: any) => o.sourceDataAsOf || o.observedAt || o.fetchedAt)
      ]
        .map((t: any) => (t ? new Date(t).getTime() : NaN))
        .filter((t: number) => !isNaN(t));

      if (timestamps.length > 0) {
        effectiveRefTime = new Date(Math.max(...timestamps)).toISOString();
      } else {
        effectiveRefTime =
          snapshot.rankingGeneratedAt ||
          snapshot.generatedAt ||
          snapshot.sourceDataAsOf ||
          new Date().toISOString();
      }
    } else {
      effectiveRefTime = new Date().toISOString();
    }
  }

  const verified = await Promise.all(
    observations.map(async (obs) => ({
      obs,
      report: await verifySourceObservation(obs, {
        patchEpochId: snapshot.rankingScope.patchEpochId,
        maxAgeHours,
        referenceTime: effectiveRefTime
      })
    }))
  );

  const verifiedObs = verified.filter((r) => r.report.verified).map((r) => r.obs);

function normalizeChampId(id: string): string {
  if (!id) return "";
  return id
    .toLowerCase()
    .replace(/^(?:tft18_)?(?:da_18_|da18_|da_)?/, "")
    .replace(/^tft18_/, "")
    .replace(/18(?=_|$)/g, "");
}

function normalizeItemId(id: string): string {
  if (!id) return "";
  return id
    .toLowerCase()
    .replace(/^(?:tft18_)?(?:item_)?(?:18_)?(?:da_18_|da18_|da_)?/, "")
    .replace(/^tft18_/, "")
    .replace(/^item_/, "");
}

function normalizeItems(items: any[]): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => (typeof it === "string" ? normalizeItemId(it) : normalizeItemId(it?.itemId || it?.sourceItemKey || "")))
    .filter(Boolean)
    .sort();
}

function matchUnit(rowUnit: any, sourceUnit: any): boolean {
  // 1. Champion ID
  const rowChamp = normalizeChampId(rowUnit.championId);
  const sourceChamp = normalizeChampId(sourceUnit.championId || sourceUnit.sourceChampionKey);
  if (!rowChamp || !sourceChamp || rowChamp !== sourceChamp) {
    return false;
  }

  // 2. Star level / tier (nếu source hoặc row có chỉ định)
  const rowStar = rowUnit.star ?? rowUnit.starLevel ?? rowUnit.tier;
  const sourceStar = sourceUnit.starLevel ?? sourceUnit.star ?? sourceUnit.tier;
  if (sourceStar != null && rowStar != null && sourceStar !== rowStar) {
    return false;
  }

  // 3. Items & Item Ownership (chủ sở hữu trang bị)
  const rowItems = normalizeItems(rowUnit.items);
  const sourceItems = normalizeItems(sourceUnit.items);
  if (rowItems.length !== sourceItems.length) {
    return false;
  }
  for (let i = 0; i < rowItems.length; i++) {
    if (rowItems[i] !== sourceItems[i]) {
      return false;
    }
  }

  // 4. Coordinates / Position
  const rowPos =
    rowUnit.position !== undefined
      ? rowUnit.position
      : rowUnit.row !== undefined && rowUnit.col !== undefined
        ? { row: rowUnit.row, col: rowUnit.col }
        : null;

  const sourcePos =
    sourceUnit.position !== undefined
      ? sourceUnit.position
      : sourceUnit.row !== undefined && sourceUnit.col !== undefined
        ? { row: sourceUnit.row, col: sourceUnit.col }
        : null;

  if (sourcePos != null) {
    if (rowPos == null || rowPos.row !== sourcePos.row || rowPos.col !== sourcePos.col) {
      return false;
    }
  } else {
    // Tọa độ nguồn thiếu phải giữ missing, không hợp thức hóa row tự điền
    if (rowPos != null) {
      return false;
    }
  }

  return true;
}

function validateBoard(recommendedBoard: any[], sourceBuildUnits: any[]): boolean {
  if (recommendedBoard.length !== sourceBuildUnits.length) {
    return false;
  }

  const availableSourceUnits = [...sourceBuildUnits];
  for (const rUnit of recommendedBoard) {
    const matchIdx = availableSourceUnits.findIndex((sUnit) => matchUnit(rUnit, sUnit));
    if (matchIdx === -1) {
      return false;
    }
    availableSourceUnits.splice(matchIdx, 1);
  }

  return true;
}

  // FIN-03 & REV-05: Ràng buộc chặt chẽ lineage đầu vào và đối chiếu build/board/ownership.
  // 1. Nếu snapshot không có inputObservationIds (inputObsIds.size === 0), không có hàng nào được chứng thực.
  // 2. Row phải khớp với ít nhất 1 observation hợp lệ trong inputObservationIds.
  // 3. Nếu row có selectedSourceBuildId -> buildId đó phải thuộc về một trong các builds của observation nguồn.
  // 4. Nếu row có recommendedBoard -> phải đối chiếu chính xác roster/multiplicity/sao/đồ/chủ đồ/tọa độ theo schema nguồn.
  const rows =
    inputObsIds.size === 0
      ? []
      : snapshot.rows.filter((row) => {
          // Tìm các observations nguồn hợp lệ cùng archetypeId nằm trong inputObservationIds
          const matchingObs = verifiedObs.filter(
            (obs) => inputObsIds.has(obs.id) && obs.archetypeId === row.archetypeId
          );
          if (matchingObs.length === 0) return false;

          const allBuilds = matchingObs.flatMap((obs) => obs.builds || []);

          // 1. Đối chiếu selectedSourceBuildId
          let targetBuild: any = null;
          let boundObs: any = null;
          if (row.selectedSourceBuildId) {
            for (const obs of matchingObs) {
              const b = (obs.builds || []).find((b: any) => b.id === row.selectedSourceBuildId);
              if (b) {
                targetBuild = b;
                boundObs = obs;
                break;
              }
            }
            if (!targetBuild) {
              // Tampered buildId: must be rejected fail-closed
              return false;
            }
          }

          // 2. Đối chiếu recommendedBoard
          if (row.recommendedBoard && row.recommendedBoard.length > 0) {
            if (!targetBuild) {
              for (const obs of matchingObs) {
                const b = (obs.builds || []).find((b: any) => validateBoard(row.recommendedBoard, b.units || []));
                if (b) {
                  targetBuild = b;
                  boundObs = obs;
                  break;
                }
              }
            }
            if (!targetBuild || !validateBoard(row.recommendedBoard, targetBuild.units || [])) {
              // Tampered or unsubstantiated board: must be rejected fail-closed
              return false;
            }
          }

          if (targetBuild && boundObs) {
              // R5-01: Ràng buộc toàn bộ metadata của recommendedBoard với boundObs và targetBuild đã kiểm chứng
              const verifiedProvenance = {
                sourceId: boundObs.sourceId,
                observationId: boundObs.id,
                buildId: targetBuild.id,
                sourceUrl: boundObs.sourceUrl || null,
                rawArtifactId: boundObs.rawArtifactId || null,
                rawLocator: boundObs.rawLocator || null,
                sourceLocator: boundObs.sourceLocator || null,
                boardCompleteness: (targetBuild.boardCompleteness || "exact") as "exact" | "partial" | "conditional"
              };

              row.selectedSourceBuildId = targetBuild.id;
              (row as any).selectedSourceBuildName = targetBuild.name || null;
              (row as any).selectedSourceUrl = boundObs.sourceUrl || null;
              (row as any).selectedEvidenceId = boundObs.rawArtifactId || (boundObs.evidenceRefIds && boundObs.evidenceRefIds[0]) || null;
              (row as any).selectedSourceId = boundObs.sourceId;

              // Nếu các unit có boardProvenance, chuẩn hóa và ràng buộc lại theo boundObs/targetBuild
              if (row.recommendedBoard.some((u: any) => u.boardProvenance)) {
                row.recommendedBoard = row.recommendedBoard.map((u: any) =>
                  u.boardProvenance ? { ...u, boardProvenance: verifiedProvenance } : u
                );
              }
            }

          return true;
        });

  return {
    ...snapshot,
    rows,
    status: rows.length ? snapshot.status : "collecting",
    warnings: [
      ...snapshot.warnings,
      ...(rows.length < snapshot.rows.length ? ["Đã ẩn đội hình thiếu bằng chứng hợp lệ hoặc dữ liệu đã quá hạn."] : [])
    ],
    totals: {
      ...snapshot.totals,
      totalArchetypes: rows.length,
      rankedTierS: rows.filter((r) => r.tier === "S").length,
      rankedTierA: rows.filter((r) => r.tier === "A").length,
      rankedTierB: rows.filter((r) => r.tier === "B").length,
      rankedTierC: rows.filter((r) => r.tier === "C").length
    }
  };
}