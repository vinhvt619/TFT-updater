import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/api-helpers";
import { metaRepository } from "@/server/meta/repositories/meta-repository";
import { canonicalSet18ChampionId } from "@/domain/meta/set18-registry";

export const dynamic = "force-dynamic";

/** Source-backed item recommendations extracted from the latest Real boards. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const championId = searchParams.get("championId");
  if (!championId) return apiError("invalid_input", "Thiếu championId", 400);
  const canonical = canonicalSet18ChampionId(championId) || championId;
  const snapshot = await metaRepository.getLatestRankingSnapshot("websites", "real");
  const recommendations = new Map<string, { itemId: string; sourceUrl: string | null; archetypeId: string; sourceBuildId: string | null }>();
  for (const row of snapshot?.rows || []) {
    const items = row.recommendedItems && typeof row.recommendedItems === "object" ? row.recommendedItems as Record<string, string[]> : {};
    for (const [rawChampionId, itemIds] of Object.entries(items)) {
      if ((canonicalSet18ChampionId(rawChampionId) || rawChampionId) !== canonical) continue;
      for (const itemId of itemIds || []) {
        if (!recommendations.has(itemId)) recommendations.set(itemId, { itemId, sourceUrl: row.recommendedBoard?.find((unit: any) => unit.boardProvenance?.sourceUrl)?.boardProvenance?.sourceUrl || null, archetypeId: row.archetypeId, sourceBuildId: row.selectedSourceBuildId || null });
      }
    }
  }
  return apiSuccess({ championId: canonical, recommendations: Array.from(recommendations.values()), snapshotId: snapshot?.id || null, status: snapshot ? "source_recommendation" : "unavailable" });
}
