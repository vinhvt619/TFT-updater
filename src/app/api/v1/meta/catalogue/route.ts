import {verifiedWebsiteSnapshot} from "@/server/meta/services/verified-catalogue";
import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api-helpers";
import { metaRepository } from "@/server/meta/repositories/meta-repository";

export const dynamic = "force-dynamic";

/**
 * Public board catalogue.  `verified` is sourced from the published Real
 * ranking snapshot; reference data is never exposed through the public API.
 * and carries no Real metrics, votes, or source claims.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "real";
  const view = searchParams.get("view") || "verified";
  if (mode !== "real" && mode !== "demo") return apiError("invalid_dataset", "mode phải là real hoặc demo", 400);
  if (mode === "demo" || view === "reference") return apiError("demo_not_public", "Dữ liệu thử nghiệm chỉ dành cho kiểm thử nội bộ.", 403);
  if (view !== "verified" && view !== "reference") return apiError("invalid_view", "view phải là verified hoặc reference", 400);
  const snapshot = await metaRepository.getLatestRankingSnapshot("websites", "real");
  const verified = snapshot ? await verifiedWebsiteSnapshot(snapshot) : null;
  const rows = verified?.rows || [];
  return apiSuccess(rows.map((row: any) => ({
    ...row,
    origin: "verified_source_build",
    verificationStatus: row.recommendedBoard?.length && row.recommendedBoard.every((unit: any) => unit.boardProvenance) ? "verified" : "partial",
    editorialTier: null,
    editorialOrder: null
  })), { datasetKind: "real", view: "verified", isolation: { realMetricsIncluded: true, demoTemplatesUsed: false } });
}
