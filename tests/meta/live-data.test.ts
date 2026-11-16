import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { SET18_CHAMPION_REGISTRY, canonicalSet18ChampionId, resolveSet18Champion } from "../../src/domain/meta/set18-registry";
import { ITEM_REGISTRY, itemAssetUrl, resolveItemInfo } from "../../src/domain/meta/item-registry";
import { accountKeyForPuuid, RiotCredentialsError, RiotTftProvider } from "../../src/ingestion/meta/providers/riot-tft";
import { normalizeRiotMatch } from "../../src/ingestion/meta/riot-normalizer";
import { getPatchEpoch, resolvePatchEpoch } from "../../src/domain/meta/patch-epochs";

import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "../../src/domain/meta/asset-manifest";

describe("live identity, patch and Riot evidence gates", () => {
  it("resolves source aliases to one Set 18 identity and rejects unknown keys", () => {
    const fromSource = resolveSet18Champion("DA_18_Ahri");
    expect(fromSource).not.toBeNull();
    expect(resolveSet18Champion("Ahri")?.canonicalId).toBe(fromSource?.canonicalId);
    expect(resolveSet18Champion("TFT18_DA_18_Ahri")?.canonicalId).toBe(fromSource?.canonicalId);
    expect(canonicalSet18ChampionId("definitely-not-a-set18-champion")).toBeNull();
    expect(SET18_CHAMPION_REGISTRY.length).toBeGreaterThan(0);
  });

  it("uses a versioned CommunityDragon path for each known item and no unknown fallback", () => {
    const definitions = Object.values(ITEM_REGISTRY);
    expect(definitions.length).toBeGreaterThan(20);
    for (const definition of definitions) {
      expect(["versioned", "unresolved"]).toContain(definition.assetStatus);
      if (definition.assetStatus === "versioned") {
        expect(definition.imageUrl).toContain(`raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/`);
        expect(definition.sourceAssetPath).toMatch(/\.png$/);
        expect(itemAssetUrl(definition.key)).toBe(definition.imageUrl);
      } else {
        expect(definition.imageUrl).toBe("");
        expect(itemAssetUrl(definition.key)).toBeNull();
      }
    }
    expect(resolveItemInfo("unknown_item_from_a_bad_scrape")).toBeNull();
    expect(itemAssetUrl("unknown_item_from_a_bad_scrape")).toBeNull();
  });

  it("hashes PUUIDs with HMAC and never exposes the PUUID as an account key", () => {
    const key = accountKeyForPuuid("puuid-for-round10-test", "round10-test-secret");
    expect(key).toMatch(/^riot_[0-9a-f]{64}$/);
    expect(key).not.toContain("puuid-for-round10-test");
    expect(key).toBe(accountKeyForPuuid("puuid-for-round10-test", "round10-test-secret"));
    expect(() => accountKeyForPuuid("puuid-for-round10-test", "short")).toThrow(RiotCredentialsError);
    expect(crypto.createHash("sha256").update(key).digest("hex")).toHaveLength(64);
  });

  it("retries a bounded Riot 429 and returns the second receipt", async () => {
    let calls = 0;
    const provider = new RiotTftProvider({
      apiKey: "riot-test-key",
      maxRetries: 2,
      sleep: async () => undefined,
      fetchImpl: (async () => {
        calls++;
        if (calls === 1) return new Response(JSON.stringify({}), { status: 429, headers: { "retry-after": "0" } });
        return new Response(JSON.stringify(["KR_MATCH_1"]), { status: 200, headers: { etag: "test" } });
      }) as typeof fetch
    });
    await expect(provider.fetchMatchIds("asia", "puuid-test-1234", 1)).resolves.toEqual(["KR_MATCH_1"]);
    expect(calls).toBe(2);
  });

  it("quarantines unknown Riot champions/items instead of inventing an identity", () => {
    const participants = Array.from({ length: 8 }, (_, index) => ({
      puuid: `puuid-round10-${index}`,
      placement: index + 1,
      level: 8,
      units: [{
        character_id: index === 0 ? "DA_18_Ahri" : "DA_18_Ashe",
        tier: 2,
        items: index === 0 ? ["TFT_Item_InfinityEdge"] : []
      }],
      traits: [],
      augments: []
    }));
    participants[7].units[0].items = ["TFT_Item_ThisDoesNotExist"];
    const result = normalizeRiotMatch({
      metadata: { match_id: "KR_TEST_ROUND10_1" },
      info: {
        queue_id: 1100,
        tft_set_number: 18,
        game_version: "Version 18.2",
        game_datetime: Date.parse("2026-09-10T12:00:00.000Z"),
        game_length: 1800,
        participants
      }
    }, {
      region: "KR",
      patchEpochId: "epoch_18_2",
      accountKeySecret: "round10-test-secret",
      rawArtifactId: "art_riot_round10_fixture",
      fetchedAt: "2026-09-10T12:01:00.000Z",
      cohortAccountKeys: []
    });

    expect(result.match.status).toBe("quarantined");
    expect(result.diagnostics.unknownItemKeys.some((key) => key.toLowerCase() === "tft_item_thisdoesnotexist")).toBe(true);
    expect(result.match.rawArtifactId).toBe("art_riot_round10_fixture");
    expect(result.match.patchEpochId).toBe("epoch_18_2");
    expect(result.match.participants.every((p) => !p.accountKey.includes("puuid-round10"))).toBe(true);
  });

  it("keeps exact patch epochs and does not resolve an unsupported label", () => {
    expect(getPatchEpoch("epoch_18_1_hotfix_2026_08_27")?.precision).toBe("hotfix_verified");
    expect(resolvePatchEpoch({ patchLabel: "18.2", channel: "live" })?.id).toBe("epoch_18_2");
    expect(resolvePatchEpoch({ patchLabel: "18.1a", channel: "live" })).toBeNull();
  });
});
