import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/server/api-helpers";
import { diffService } from "@/server/services/diff-service";
import { DatasetKind, StarLevel } from "@/domain/types";
import { normalizeSearchString } from "@/domain/identity";
import { rowImpact } from "@/domain/meta/change-impact";
import { env } from "@/server/config";

export const dynamic = "force-dynamic";

const VALID_IMPACTS = ["buff", "nerf", "mixed", "adjustment", "rework", "bugfix", "neutral", "unknown"];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromId = searchParams.get("from");
    const toId = searchParams.get("to");
    const fromReleaseId = searchParams.get("fromRelease");
    const toReleaseId = searchParams.get("toRelease");
    const requestedDataset = searchParams.get("dataset") || searchParams.get("mode") || env.DATA_MODE;
    const explicitDataset = searchParams.get("dataset");
    const explicitMode = searchParams.get("mode");
    if (explicitDataset && explicitMode && explicitDataset !== explicitMode) {
      return apiError("dataset_mode_conflict", "dataset và mode phải trùng nhau", 400);
    }
    if (requestedDataset !== "demo" && requestedDataset !== "real") {
      return apiError("invalid_dataset", "dataset/mode phải là demo hoặc real", 400);
    }
    const datasetKind = requestedDataset as DatasetKind;
    if (datasetKind === "demo") {
      return apiError("demo_not_public", "Dữ liệu thử nghiệm chỉ dành cho kiểm thử nội bộ.", 403);
    }

    if ((!fromId || !toId) && (!fromReleaseId || !toReleaseId)) {
      return apiError("invalid_input", "Vui lòng chọn đủ hai mốc bắt đầu và kết thúc.", 400);
    }

    if ((fromReleaseId && toReleaseId && fromReleaseId === toReleaseId) || (fromId && toId && fromId === toId)) {
      return apiError("same_release", "Hai mốc so sánh phải khác nhau.", 400);
    }

    const starParam = searchParams.get("star");
    let starLevel: StarLevel | undefined = undefined;
    if (starParam !== null && starParam !== "") {
      const parsedStar = parseInt(starParam, 10);
      if (isNaN(parsedStar) || ![1, 2, 3, 4].includes(parsedStar)) {
        return apiError("invalid_star", "Cấp sao không hợp lệ (hỗ trợ 1, 2, 3, 4)", 400);
      }
      starLevel = parsedStar as StarLevel;
    }

    const costParam = searchParams.get("cost");
    let costFilter: number | undefined = undefined;
    if (costParam !== null && costParam !== "") {
      const parsedCost = parseInt(costParam, 10);
      if (isNaN(parsedCost) || parsedCost < 1 || parsedCost > 10) {
        return apiError("invalid_cost", "Giá vàng không hợp lệ", 400);
      }
      costFilter = parsedCost;
    }

    const impactFilter = searchParams.get("impact");
    if (impactFilter !== null && impactFilter !== "" && !VALID_IMPACTS.includes(impactFilter)) {
      return apiError("invalid_impact", `Loại ảnh hưởng không hợp lệ (${VALID_IMPACTS.join(", ")})`, 400);
    }

    const changedOnly = searchParams.get("changedOnly") === "1" || searchParams.get("changedOnly") === "true";
    const q = searchParams.get("q") || "";
    const traitFilter = searchParams.get("trait");

    // Release IDs are the canonical public contract. Snapshot IDs remain a
    // backwards-compatible adapter for old shared links.
    const comparison = fromReleaseId && toReleaseId
      ? await diffService.getOrComputeReleaseDiff(fromReleaseId, toReleaseId, { starLevel, changedOnly, datasetKind })
      : await diffService.getOrComputeDiff(fromId!, toId!, { starLevel, changedOnly, datasetKind });

    let filteredChampions = comparison.champions;
    let filteredChanges = comparison.changes || [];

    // 2. Filter by search query (accent-insensitive)
    if (q.trim()) {
      const normQ = normalizeSearchString(q);
      filteredChampions = filteredChampions.filter((c) => {
        const normVi = normalizeSearchString(c.nameVi);
        const normEn = normalizeSearchString(c.nameEn);
        const normId = normalizeSearchString(c.championId);
        return normVi.includes(normQ) || normEn.includes(normQ) || normId.includes(normQ);
      });
      filteredChanges = filteredChanges.filter((c) => normalizeSearchString(c.rawEntityName || c.entityId || c.rawText).includes(normQ));
    }

    // 3. Filter by cost
    if (costFilter !== undefined) {
      filteredChampions = filteredChampions.filter((c) => c.cost === costFilter);
    }

    // 4. Filter by trait
    if (traitFilter) {
      filteredChampions = filteredChampions.filter((c) =>
        c.traits.some((t) => t.toLowerCase().includes(traitFilter.toLowerCase()))
      );
    }

    // 5. Filter by semantic impact via rowImpact
    if (impactFilter) {
      filteredChampions = filteredChampions.filter((c) => c.summaryImpact === impactFilter);
      filteredChanges = filteredChanges.filter((c) => {
        const impact = rowImpact(c);
        if (impactFilter === "buff" || impactFilter === "nerf") {
          return impact === impactFilter;
        }
        if (impactFilter === "adjustment") {
          return impact === "mixed" || impact === "neutral" || impact === "unknown";
        }
        return (impact as string) === impactFilter;
      });
    }

    return apiSuccess({
      ...comparison,
      champions: filteredChampions,
      changes: filteredChanges,
      coverage: comparison.coverage ? { ...comparison.coverage, status: filteredChanges.length === 0 && (comparison.changes?.length || 0) > 0 ? "no_filter_matches" : comparison.coverage.status } : undefined
    }, { datasetKind });
  } catch (err: any) {
    if (err.message?.includes("quarantined")) {
      return apiError("snapshot_quarantined", err.message, 410);
    }
    if (err.message?.includes("Cannot compare a release with itself")) {
      return apiError("same_release", err.message, 400);
    }
    if (err.message?.includes("Only published") || err.message?.includes("dataset mismatch") || err.message?.includes("different dataset") || err.message?.includes("outside the primary")) {
      return apiError("snapshot_not_comparable", err.message, 409);
    }
    if (err.message?.includes("Snapshot not found") || err.message?.includes("Release not found")) {
      return apiError("not_found", err.message, 404);
    }
    return apiError("internal_error", err.message, 500);
  }
}
