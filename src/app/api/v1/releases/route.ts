import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/server/api-helpers";
import { snapshotRepository } from "@/server/repositories/snapshot-repository";
import { env } from "@/server/config";
import { DatasetKind } from "@/domain/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requested = searchParams.get("dataset") || searchParams.get("mode") || env.DATA_MODE;
    if (requested !== "demo" && requested !== "real") {
      return apiError("invalid_dataset", "dataset/mode phải là demo hoặc real", 400);
    }
    const datasetKind = requested as DatasetKind;
    if (datasetKind === "demo") return apiError("demo_not_public", "Dữ liệu thử nghiệm chỉ dành cho kiểm thử nội bộ.", 403);
    const includeArchive = searchParams.get("includeArchive") === "1" || searchParams.get("scope") === "archive";
    const releases = await snapshotRepository.getReleases(datasetKind, { includeArchive: includeArchive ? true : false });
    return apiSuccess(releases, { datasetKind });
  } catch (err: any) {
    return apiError("internal_error", err.message, 500);
  }
}
