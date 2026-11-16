import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/server/api-helpers";
import { snapshotRepository } from "@/server/repositories/snapshot-repository";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedDataset = searchParams.get("dataset") || searchParams.get("mode") || "real";
    if (requestedDataset !== "real") return apiError("demo_not_public", "Dữ liệu thử nghiệm chỉ dành cho kiểm thử nội bộ.", 403);
    const snapshotId = searchParams.get("snapshotId") || await snapshotRepository.getLatestSnapshotId("real");
    if (!snapshotId) return apiError("no_published_snapshot", "Chưa có snapshot Real đã công bố.", 404);
    const meta = await snapshotRepository.getSnapshotReleaseMeta(snapshotId);
    if (!meta || meta.datasetKind !== "real" || meta.currentSnapshotStatus !== "published") return apiError("snapshot_not_public", "Snapshot không thuộc dữ liệu Real đã công bố.", 403);
    const champions = await snapshotRepository.getChampionsAtSnapshot(snapshotId);
    return apiSuccess(champions, { datasetKind: "real", snapshotId });
  } catch (err: any) {
    return apiError("internal_error", err.message, 500);
  }
}
