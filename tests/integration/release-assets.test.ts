import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { riotPatchNotesAdapter } from "../../src/ingestion/adapters/riot-patch-notes";
import { parseTftVersion } from "../../src/domain/versioning";
import { communityDragonAssetUrl, VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "../../src/domain/meta/asset-manifest";

describe("release catalogue and asset evidence", () => {
  it("keeps every 18.1 hotfix section as independently parseable claims", () => {
    const html = fs.readFileSync(path.resolve("storage/raw/riot_patch_18_1_live.html"), "utf8");
    const parsed = riotPatchNotesAdapter.parseArticle(html, "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-1-notes/", {
      rawArtifactId: "integration-18-1",
      rawHash: "integration-18-1"
    });
    expect(parsed.events.filter((event) => /27\/08|28\/08|31\/08/.test(event.displayLabel)).length).toBeGreaterThanOrEqual(3);
    expect(parsed.claims.length).toBeGreaterThanOrEqual(60);
  });

  it("sorts small releases by semantic suffix and preserves numeric PBE revisions", () => {
    expect(parseTftVersion("18.1a").versionKey).toBe("live:18.1:a:");
    expect(parseTftVersion("18.1b").versionKey).toBe("live:18.1:b:");
    const pbe = parseTftVersion("PBE", "pbe", "", "633df11c");
    expect(pbe.pbeRevision).toBe("633df11c");
    expect(pbe.versionKey).toBe("pbe:unknown:base:633df11c");
  });

  it("uses the verified immutable CommunityDragon asset namespace", () => {
    expect(VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION).toBe("16.18");
    expect(communityDragonAssetUrl("assets/characters/tft18_gromp/tft18_gromp_square.png")).toContain("raw.communitydragon.org/16.18/game/assets/");
  });
});
