import { NextResponse } from "next/server";
import { env } from "./config";
import crypto from "crypto";

export function apiSuccess<T>(data: T, metaOverrides: Record<string, any> = {}) {
  const requestId = crypto.randomBytes(6).toString("hex");
  return NextResponse.json({
    data,
    meta: {
      requestId,
      datasetKind: metaOverrides.datasetKind || env.DATA_MODE,
      generatedAt: new Date().toISOString(),
      warnings: [],
      ...metaOverrides
    }
  });
}

export function apiError(code: string, message: string, status: number = 400) {
  const requestId = crypto.randomBytes(6).toString("hex");
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId
      }
    },
    { status }
  );
}
