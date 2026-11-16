import { NextResponse } from "next/server";
import { checkDbHealth, getDatabaseFingerprint } from "@/server/db/client";

export async function GET() {
  const dbHealth = await checkDbHealth();
  if (!dbHealth.healthy) {
    return NextResponse.json({ status: "not_ready", error: dbHealth.error }, { status: 503 });
  }
  const fingerprint = await getDatabaseFingerprint();
  return NextResponse.json({ status: "ready", db: dbHealth, databaseFingerprint: fingerprint });
}
