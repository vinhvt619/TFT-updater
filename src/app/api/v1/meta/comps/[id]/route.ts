import { NextRequest, NextResponse } from "next/server";
import { metaRepository } from "@/server/meta/repositories/meta-repository";
import { getCurrentLivePatchEpochId } from "@/domain/meta/patch-epochs";
import { verifiedWebsiteSnapshot } from "@/server/meta/services/verified-catalogue";
import { getDb } from "@/server/db/client";
import { metaMatchParticipants, metaMatches, metaClassifications } from "@/server/db/schema-meta";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const { id } = await context.params;
    const rawMode = searchParams.get("mode") || "real";
    if (rawMode !== "real" && rawMode !== "demo") {
      return NextResponse.json({ error: { code: "INVALID_DATASET", message: "mode phải là demo hoặc real" } }, { status: 400 });
    }
    if (rawMode === "demo") return NextResponse.json({ error: { code: "DEMO_NOT_PUBLIC", message: "Dữ liệu thử nghiệm chỉ dành cho kiểm thử nội bộ." } }, { status: 403 });
    const requestedMode = "real" as const;
    const patchEpochId = searchParams.get("patch") || getCurrentLivePatchEpochId();
    const snapshotId = searchParams.get("snapshotId") || searchParams.get("snapshot");
    const isArchive = searchParams.get("archive") === "true" || Boolean(snapshotId) || (Boolean(searchParams.get("patch")) && searchParams.get("patch") !== getCurrentLivePatchEpochId());

    const archetype = await metaRepository.getArchetypeById(id, requestedMode);

    if (!archetype) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Không tìm thấy đội hình: ${id}` } },
        { status: 404 }
      );
    }

    // Lấy ranking hàng mới nhất từ Mục A và Mục B theo mode
    let rawWebSnap: any = null;
    if (snapshotId) {
      rawWebSnap = await metaRepository.getRankingSnapshot(snapshotId);
      if (!rawWebSnap) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: `Không tìm thấy snapshot: ${snapshotId}` } },
          { status: 404 }
        );
      }
      const snapPatch = rawWebSnap.rankingScope?.patchEpochId || rawWebSnap.patchEpochId;
      const snapBoardType = rawWebSnap.rankingScope?.boardType || rawWebSnap.boardType;
      if (snapPatch !== patchEpochId || rawWebSnap.datasetKind !== requestedMode || snapBoardType !== "websites") {
        return NextResponse.json(
          { error: { code: "SCOPE_MISMATCH", message: "Snapshot không thuộc phạm vi yêu cầu." } },
          { status: 400 }
        );
      }
    } else {
      rawWebSnap = await metaRepository.getLatestRankingSnapshot("websites", requestedMode, { patchEpochId });
    }
    const webSnap = rawWebSnap
      ? await verifiedWebsiteSnapshot(rawWebSnap, {
          mode: isArchive ? "archive" : "current",
          referenceTime: isArchive ? (rawWebSnap.sourceDataAsOf || rawWebSnap.generatedAt || undefined) : undefined,
          maxAgeHours: 72
        })
      : null;
    const eliteSnap = await metaRepository.getLatestRankingSnapshot("elite", requestedMode, { patchEpochId });

    const webRow = webSnap?.rows?.find((r) => r.archetypeId === id) || null;
    const requestedBuildId = searchParams.get("buildId");
    if (requestedBuildId) {
      if (!webRow || webRow.selectedSourceBuildId !== requestedBuildId) {
        return NextResponse.json(
          { error: { code: "SCOPE_MISMATCH", message: "Build ID không khớp với bản lưu." } },
          { status: 400 }
        );
      }
    }
    const eliteRow = eliteSnap?.rows?.find((r) => r.archetypeId === id) || null;

    // Lấy các trận minh họa từ database theo đúng datasetKind và trạng thái hợp lệ (status = 'valid')
    const db = await getDb();
    const validMatches = await db
      .select()
      .from(metaMatches)
      .where(
        and(
          eq(metaMatches.datasetKind, requestedMode),
          eq(metaMatches.status, "valid"),
          eq(metaMatches.patchEpochId, patchEpochId)
        )
      );

    const validMatchMap = new Map<string, any>(validMatches.map((m: any) => [m.matchKey, m]));
    const validMatchKeys = validMatches.map((m: any) => m.matchKey);

    const exampleMatches: any[] = [];
    if (validMatchKeys.length > 0) {
      const classRows = await db
        .select()
        .from(metaClassifications)
        .where(
          and(
            eq(metaClassifications.archetypeId, id),
            eq(metaClassifications.status, "matched")
          )
        )
        .limit(30);

      const relevantClassRows = classRows.filter((c: any) => validMatchMap.has(c.matchKey));
      if (relevantClassRows.length > 0) {
        const participants = await db.select().from(metaMatchParticipants);
        for (const c of relevantClassRows) {
          const p = participants.find(
            (part: any) => part.matchKey === c.matchKey && part.accountKey === c.accountKey
          );
          const m = validMatchMap.get(c.matchKey);
          if (p && m) {
            exampleMatches.push({
              matchKey: m.matchKey,
              region: m.region,
              endedAt: m.endedAt,
              placement: p.placement,
              level: p.level,
              units: p.units,
              traits: p.traits,
              riotIdName: p.riotIdName,
              riotIdTag: p.riotIdTag
            });
          }
        }
      }
    }

    // Sắp xếp các trận minh họa: ưu tiên Top 1-4 trước, nhưng vẫn đầy đủ mẫu 1-8
    exampleMatches.sort((a, b) => a.placement - b.placement);

    return NextResponse.json({
      archetype,
      requestedMode,
      websiteRanking: webRow
        ? { snapshotId: webSnap?.id, row: webRow }
        : null,
      eliteRanking: eliteRow
        ? { snapshotId: eliteSnap?.id, row: eliteRow }
        : null,
      exampleMatches: exampleMatches.slice(0, 15) // 15 trận minh họa
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
