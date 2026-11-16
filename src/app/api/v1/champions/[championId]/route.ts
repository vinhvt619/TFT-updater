import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/server/api-helpers";
import { snapshotRepository } from "@/server/repositories/snapshot-repository";
import { toCanonicalChampionId } from "@/domain/identity";

export async function GET(req: NextRequest, context: { params: Promise<{ championId: string }> }) {
  try {
    const { championId: rawChampionId } = await context.params;
    const { searchParams } = new URL(req.url);
    const requestedSnapshotId = searchParams.get("snapshotId");
    const canonicalId = toCanonicalChampionId(rawChampionId, 18);

    // 1. Nếu người dùng chỉ định snapshotId cụ thể: kiểm tra tồn tại và trạng thái cách ly
    if (requestedSnapshotId) {
      const snap = await snapshotRepository.getSnapshotById(requestedSnapshotId);
      if (!snap) {
        return apiError("snapshot_not_found", `Không tìm thấy snapshot: ${requestedSnapshotId}`, 404);
      }

      if ((snap as any).status === "quarantined") {
        return apiError(
          "snapshot_quarantined",
          `Snapshot ${requestedSnapshotId} đã bị cách ly: ${(snap as any).reason || (snap as any).quarantineReason || "violation"}`,
          410
        );
      }

      if ((snap as any).status !== "published") {
        return apiError(
          "snapshot_not_published",
          `Snapshot ${requestedSnapshotId} chưa được công bố chính thức (trạng thái: ${(snap as any).status})`,
          400
        );
      }
      const snapshotMeta = await snapshotRepository.getSnapshotReleaseMeta(requestedSnapshotId);
      if (!snapshotMeta || snapshotMeta.datasetKind !== "real") return apiError("demo_not_public", "Snapshot thử nghiệm không được hiển thị ở trang công khai.", 403);

      // Snapshot hợp lệ và đã công bố -> lấy dữ liệu tướng tại snapshot này
      const champ = await snapshotRepository.getChampionAtSnapshot(requestedSnapshotId, canonicalId);
      if (champ) {
        return apiSuccess(champ);
      }
      if (rawChampionId !== canonicalId) {
        const rawChamp = await snapshotRepository.getChampionAtSnapshot(requestedSnapshotId, rawChampionId);
        if (rawChamp) {
          return apiSuccess(rawChamp);
        }
      }

      return apiError(
        "champion_not_in_snapshot",
        `Không tìm thấy tướng ${rawChampionId} trong snapshot ${requestedSnapshotId}`,
        404
      );
    }

    // 2. Nếu người dùng KHÔNG chỉ định snapshotId: tự động tìm snapshot mới nhất ĐÃ CÔNG BỐ (published)
    const latestPublishedSnapshotId = await snapshotRepository.getLatestSnapshotId("real");
    if (latestPublishedSnapshotId) {
      const champ = await snapshotRepository.getChampionAtSnapshot(latestPublishedSnapshotId, canonicalId);
      if (champ) {
        return apiSuccess(champ);
      }
      if (rawChampionId !== canonicalId) {
        const rawChamp = await snapshotRepository.getChampionAtSnapshot(latestPublishedSnapshotId, rawChampionId);
        if (rawChamp) {
          return apiSuccess(rawChamp);
        }
      }
    }

    return apiError("not_found", `Không tìm thấy tướng ${rawChampionId} trong snapshot Real đã công bố.`, 404);
  } catch (err: any) {
    return apiError("internal_error", err.message, 500);
  }
}

