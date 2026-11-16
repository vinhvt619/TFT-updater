import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/server/db/client";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const rawMode = new URL(request.url).searchParams.get("mode") || new URL(request.url).searchParams.get("dataset") || "real";
    if (rawMode !== "real" && rawMode !== "demo") {
      return NextResponse.json({ error: { code: "INVALID_DATASET", message: "mode phải là demo hoặc real" } }, { status: 400 });
    }
    const datasetKind = rawMode;
    const sourcesConfigPath = path.join(process.cwd(), "config", "meta-sources.json");
    const regionsConfigPath = path.join(process.cwd(), "config", "meta-regions.json");

    const sourcesData = fs.existsSync(sourcesConfigPath)
      ? JSON.parse(fs.readFileSync(sourcesConfigPath, "utf-8"))
      : { sources: [] };

    const regionsData = fs.existsSync(regionsConfigPath)
      ? JSON.parse(fs.readFileSync(regionsConfigPath, "utf-8"))
      : { regions: [] };

    const db = await getDb();
    const result: any = await db.execute(sql.raw(`
      SELECT source_id,
        count(*) FILTER (WHERE dataset_kind = '${datasetKind}') AS collected_observations,
        count(*) FILTER (WHERE dataset_kind = '${datasetKind}' AND status = 'valid') AS valid_observations,
        count(*) FILTER (WHERE dataset_kind = '${datasetKind}' AND status = 'valid' AND archetype_id IS NOT NULL AND (inferred->>'reviewStatus') IN ('auto_matched','approved')) AS qualified_observations,
        count(*) FILTER (WHERE dataset_kind = '${datasetKind}' AND status = 'quarantined') AS quarantined_observations,
        max(fetched_at) FILTER (WHERE dataset_kind = '${datasetKind}') AS last_fetched_at,
        max(source_data_as_of) FILTER (WHERE dataset_kind = '${datasetKind}') AS source_data_as_of
      FROM meta_source_comp_observations
      GROUP BY source_id
    `));
    const runtimeBySource = new Map((result.rows || result || []).map((row: any) => [row.source_id, row]));
    const configuredSources = Array.isArray(sourcesData.sources) ? sourcesData.sources : [];
    const sourceIds = new Set([
      ...configuredSources.map((source: any) => source.id || source.sourceId).filter(Boolean),
      ...runtimeBySource.keys()
    ]);
    const sources = Array.from(sourceIds).map((sourceId) => {
      const configured = configuredSources.find((source: any) => (source.id || source.sourceId) === sourceId) || {};
      const runtime: any = runtimeBySource.get(sourceId);
      const validObservations = Number(runtime?.valid_observations || 0);
      const collectedObservations = Number(runtime?.collected_observations || 0);
      const qualifiedObservations = Number(runtime?.qualified_observations || 0);
      return {
        ...configured,
        sourceId,
        status: validObservations > 0 ? "available" : "collecting",
        collectedObservations,
        validObservations,
        qualifiedObservations,
        contributingObservations: qualifiedObservations,
        contributionStatus: qualifiedObservations > 0 ? "contributing" : validObservations > 0 ? "collected_not_qualified" : "collecting",
        quarantinedObservations: Number(runtime?.quarantined_observations || 0),
        lastFetchedAt: runtime?.last_fetched_at || null,
        sourceDataAsOf: runtime?.source_data_as_of || null
      };
    });

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      sources,
      regions: regionsData.regions
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
