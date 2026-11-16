import { NextRequest, NextResponse } from "next/server";
import { metaRepository } from "@/server/meta/repositories/meta-repository";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; archetypeId: string }> }
) {
  try {
    const { id, archetypeId } = await context.params;
    const snap = await metaRepository.getRankingSnapshot(id);

    if (!snap) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Không tìm thấy snapshot: ${id}` } },
        { status: 404 }
      );
    }

    const row = snap.rows.find((r) => r.archetypeId === archetypeId);
    if (!row) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Không tìm thấy đội hình: ${archetypeId} trong snapshot ${id}` } },
        { status: 404 }
      );
    }

    const archetype = await metaRepository.getArchetypeById(archetypeId);

    return NextResponse.json({
      snapshotId: snap.id,
      boardType: snap.rankingScope.boardType,
      patchEpochId: snap.rankingScope.patchEpochId,
      asOf: snap.rankingScope.asOf,
      archetype,
      row,
      rankingVersion: snap.rankingScope.rankingVersion
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
