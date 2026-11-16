import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/server/api-helpers";
import { snapshotRepository } from "@/server/repositories/snapshot-repository";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const evidence = await snapshotRepository.getEvidenceById(id);
    if (!evidence) {
      return apiError("not_found", `Evidence record not found: ${id}`, 404);
    }
    return apiSuccess(evidence);
  } catch (err: any) {
    return apiError("internal_error", err.message, 500);
  }
}
