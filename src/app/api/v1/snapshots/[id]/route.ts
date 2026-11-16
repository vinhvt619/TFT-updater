import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/server/api-helpers";
import { snapshotRepository } from "@/server/repositories/snapshot-repository";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const snap = await snapshotRepository.getSnapshotById(id);
    if (!snap) {
      return apiError("not_found", `Snapshot not found: ${id}`, 404);
    }
    return apiSuccess(snap);
  } catch (err: any) {
    return apiError("internal_error", err.message, 500);
  }
}
