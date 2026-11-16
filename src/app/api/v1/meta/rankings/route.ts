import {verifiedWebsiteSnapshot} from "@/server/meta/services/verified-catalogue";
import { NextRequest, NextResponse } from "next/server";
import { metaRepository } from "@/server/meta/repositories/meta-repository";
import { getCurrentLivePatchEpochId } from "@/domain/meta/patch-epochs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const board = searchParams.get("board") === "elite" ? "elite" : "websites";
    const region = searchParams.get("region") || "all";
    const windowStr = searchParams.get("window") || "72h";
    const windowHours = parseInt(windowStr.replace("h", ""), 10) || 72;
    const snapshotId = searchParams.get("snapshotId") || searchParams.get("snapshot");
    const patchEpochId = searchParams.get("patch") || getCurrentLivePatchEpochId();
    const isArchive = searchParams.get("archive") === "true" || Boolean(searchParams.get("patch") && searchParams.get("patch") !== getCurrentLivePatchEpochId());
    const rawMode = searchParams.get("mode") || "real";
    if (rawMode !== "real" && rawMode !== "demo") {
      return NextResponse.json({ error: { code: "INVALID_DATASET", message: "mode phải là demo hoặc real" } }, { status: 400 });
    }
    const requestedMode = rawMode as "real" | "demo";
    if (requestedMode === "demo") return NextResponse.json({ error: { code: "DEMO_NOT_PUBLIC", message: "Dữ liệu thử nghiệm chỉ dành cho kiểm thử nội bộ." } }, { status: 403 });

    // 1. Nếu có snapshot ID cụ thể
    if (snapshotId) {
      const snap = await metaRepository.getRankingSnapshot(snapshotId);
      if (!snap) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: `Không tìm thấy ranking snapshot: ${snapshotId}` } },
          { status: 404 }
        );
      }

      if (snap.datasetKind !== requestedMode) {
        return NextResponse.json(
          { error: { code: "DATASET_MISMATCH", message: "snapshot không thuộc mode đang yêu cầu" } },
          { status: 400 }
        );
      }

      // Kiểm tra trạng thái cách ly / thu hồi (Rule 87 / F7)
      if (snap.publicationStatus === "quarantined" || snap.publicationStatus === "retracted") {
        return NextResponse.json(
          {
            error: {
              code: "SNAPSHOT_REVOKED",
              message: `Snapshot ${snapshotId} đã bị cách ly hoặc thu hồi do vi phạm tính toàn vẹn dữ liệu.`,
              publicationStatus: snap.publicationStatus,
              quarantineReason: snap.quarantineReason || "Dữ liệu không đạt tiêu chuẩn chứng minh nguồn."
            }
          },
          { status: 410 }
        );
      }

      if (snap.publicationStatus !== "published") return NextResponse.json({error:{code:"SNAPSHOT_NOT_PUBLIC",message:"Snapshot chưa được công bố."}},{status:409});
      const snapBoardType = snap.rankingScope?.boardType || (snap as any).boardType;
      const snapPatch = snap.rankingScope?.patchEpochId || (snap as any).patchEpochId;
      if (snapBoardType !== board || snapPatch !== patchEpochId) return NextResponse.json({error:{code:"SCOPE_MISMATCH",message:"Snapshot không thuộc phạm vi yêu cầu."}},{status:400});
      const isHistoricalSnapshot = Boolean(snapshotId);
      const isArchiveEffective = isArchive || isHistoricalSnapshot;
      return NextResponse.json(
        board === "websites"
          ? await verifiedWebsiteSnapshot(snap, { mode: isArchiveEffective ? "archive" : "current", maxAgeHours: 72 })
          : snap
      );
    }

    // 2. Lấy snapshot theo đúng toàn bộ phạm vi yêu cầu (Strict Scope Filtering, không fallback ngầm real -> demo)
    const snap = await metaRepository.getLatestRankingSnapshot(board, requestedMode, {
      region,
      patchEpochId,
      windowHours
    });

    if (!snap) {
      // P0-09: Elite board endpoint must return HTTP 200 with honest collecting status, never 404
      if (board === "elite") {
        const missingCredentials = [
          !process.env.RIOT_API_KEY ? "RIOT_API_KEY" : null,
          !process.env.ACCOUNT_KEY_HMAC_SECRET || process.env.ACCOUNT_KEY_HMAC_SECRET.length < 16
            ? "ACCOUNT_KEY_HMAC_SECRET"
            : null
        ].filter(Boolean) as string[];
        const hasRiotCredentials = missingCredentials.length === 0;
        return NextResponse.json(
          {
            status: "collecting",
            ready: false,
            missingCredential: missingCredentials[0] || null,
            missingCredentials,
            message: hasRiotCredentials
              ? `Mục đội hình cao thủ đang ở trạng thái collecting (${region} - ${windowHours}h) và đang chờ hoàn thiện dữ liệu trận.`
              : `Mục đội hình cao thủ đang ở trạng thái collecting do thiếu credential: ${missingCredentials.join(", ")}.`,
            rows: [],
            totals: {
              totalArchetypes: 0,
              rankedTierS: 0,
              rankedTierA: 0,
              rankedTierB: 0,
              rankedTierC: 0,
              provisionalCount: 0,
              collectingCount: 0
            },
            requestedScope: {
              board,
              region,
              windowHours,
              patchEpochId,
              datasetKind: requestedMode
            }
          },
          { status: 200 }
        );
      }

      // GET là read-only; không tự ý mutate hoặc sinh ranking trong route GET (Section 12.1)
      return NextResponse.json(
        {
          error: {
            code: "NO_DATA_AVAILABLE",
            message: requestedMode === "real"
              ? `Chưa có snapshot xếp hạng đã kiểm chứng cho phạm vi yêu cầu (Board: ${board}, Epoch: ${patchEpochId}, Region: ${region}, Window: ${windowHours}h, Dataset: real).`
              : `Chưa có snapshot demo cho phạm vi yêu cầu. Vui lòng chạy pnpm meta:seed:demo.`,
            requestedScope: {
              board,
              region,
              windowHours,
              patchEpochId,
              datasetKind: requestedMode
            },
            status: "collecting"
          }
        },
        { status: 404 }
      );
    }

    if (board === "elite" && requestedMode === "real") {
      const missingCredentials = [
        !process.env.RIOT_API_KEY ? "RIOT_API_KEY" : null,
        !process.env.ACCOUNT_KEY_HMAC_SECRET || process.env.ACCOUNT_KEY_HMAC_SECRET.length < 16
          ? "ACCOUNT_KEY_HMAC_SECRET"
          : null
      ].filter(Boolean) as string[];
      return NextResponse.json({
        ...snap,
        ready: snap.publicationStatus === "published" && missingCredentials.length === 0,
        missingCredential: missingCredentials[0] || null,
        missingCredentials,
        requestedScope: {
          board,
          region,
          windowHours,
          patchEpochId,
          datasetKind: requestedMode
        }
      });
    }

    const verified =
      board === "websites"
        ? await verifiedWebsiteSnapshot(snap, { mode: isArchive ? "archive" : "current", maxAgeHours: 72 })
        : snap;
    return NextResponse.json({
      ...verified,
      requestedScope: {
        board,
        region,
        windowHours,
        patchEpochId,
        datasetKind: requestedMode
      }
    });
  } catch (error: any) {
    console.error("API /api/v1/meta/rankings error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message || "Lỗi máy chủ nội bộ" } },
      { status: 500 }
    );
  }
}
