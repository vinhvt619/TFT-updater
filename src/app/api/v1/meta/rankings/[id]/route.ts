import { NextRequest, NextResponse } from "next/server";
import { metaRepository } from "@/server/meta/repositories/meta-repository";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const snap = await metaRepository.getRankingSnapshot(id);

    if (!snap) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Không tìm thấy ranking snapshot: ${id}` } },
        { status: 404 }
      );
    }

    return NextResponse.json(snap);
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
