export const VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION = "16.18";

export const VERIFIED_ASSET_EVIDENCE = [
  {
    entity: "champion:tft18_gromp",
    url: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/characters/tft18_gromp/tft18_gromp_square.png`,
    status: 200,
    contentType: "image/png",
    evidence: "Source asset verification 2026-09-15"
  },
  {
    entity: "item:tft_item_infinityedge",
    url: `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/game/assets/maps/tft/icons/items/hexcore/tft_item_infinityedge.png`,
    status: 200,
    contentType: "image/png",
    evidence: "Source asset verification 2026-09-15"
  }
] as const;

/** The TFT patch (18.2) and CommunityDragon asset namespace are separate. */
export const ASSET_POLICY = {
  source: "CommunityDragon raw archive",
  assetVersion: VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION,
  patchVersion: "18.2",
  immutableEvidenceRequired: true,
  mutableNamespaces: ["latest", "pbe"]
} as const;

export function communityDragonAssetUrl(sourceAssetPath: string): string {
  let normalized = sourceAssetPath.replace(/^\/+/, "").replace(/\.(?:tex|dds)$/i, ".png");
  if (normalized.startsWith("assets/")) normalized = `game/${normalized}`;
  return `https://raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/${normalized}`;
}
