import { NextRequest, NextResponse } from "next/server";
import { resolveSet18Champion } from "@/domain/meta/set18-registry";
import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "@/domain/meta/asset-manifest";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const resolvedParams = await params;
  const file = resolvedParams.file || "";
  const championId = file.replace(/\.(?:png|jpe?g|webp)$/i, "");
  const entry = resolveSet18Champion(championId);

  if (entry?.iconSourcePath) {
    const assetPath = entry.iconSourcePath
      .replace(/^\/+/, "")
      .replace(/\.(?:tex|dds)$/i, ".png");
    const cdnUrl = `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/${assetPath}`;
    return NextResponse.redirect(cdnUrl, 307);
  }

  return new NextResponse("Not Found", { status: 404 });
}
