import { NextResponse } from "next/server";
import { apiSuccess, apiError } from "@/server/api-helpers";
import { env } from "@/server/config";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const configPath = path.resolve(env.SOURCES_CONFIG_PATH);
    let sourcesConfig = { sources: [] };
    if (fs.existsSync(configPath)) {
      sourcesConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }

    return apiSuccess({
      dataMode: env.DATA_MODE,
      targetSet: env.TARGET_SET,
      ingestEnabled: env.INGEST_ENABLED,
      ingestIntervalMinutes: env.INGEST_INTERVAL_MINUTES,
      sources: sourcesConfig.sources,
      lastCheckedAt: new Date().toISOString()
    });
  } catch (err: any) {
    return apiError("internal_error", err.message, 500);
  }
}
