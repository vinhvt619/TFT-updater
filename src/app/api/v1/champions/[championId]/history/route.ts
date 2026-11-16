import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/server/api-helpers";
import { snapshotRepository } from "@/server/repositories/snapshot-repository";

export async function GET(req: NextRequest, context: { params: Promise<{ championId: string }> }) {
  try {
    const { championId } = await context.params;
    const { searchParams } = new URL(req.url);
    const requested = searchParams.get("dataset") || searchParams.get("mode") || "real";
    if (requested !== "real") return apiError("demo_not_public", "Dữ liệu thử nghiệm chỉ dành cho kiểm thử nội bộ.", 403);
    const datasetKind = "real" as const;

    const includeArchive = searchParams.get("includeArchive") === "1" || searchParams.get("scope") === "archive";
    const allReleases = await snapshotRepository.getReleases(datasetKind, { includeArchive });
    const historyEntries = [];

    for (const rel of allReleases) {
      if (!rel.currentSnapshotId) continue;
      // Chỉ đọc dữ liệu từ snapshot đã công bố chính thức (published)
      if (rel.currentSnapshotStatus !== "published") {
        continue;
      }
      const champ = await snapshotRepository.getChampionAtSnapshot(rel.currentSnapshotId, championId);
      historyEntries.push({
        releaseId: rel.id,
        patchLabel: rel.patchLabel,
        channel: rel.channel,
        effectiveAt: rel.effectiveAt,
        snapshotId: rel.currentSnapshotId,
        present: champ !== null,
        champion: champ
      });
    }

    return apiSuccess({
      championId,
      datasetKind,
      history: historyEntries
    }, { datasetKind });
  } catch (err: any) {
    return apiError("internal_error", err.message, 500);
  }
}
