import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../../src/app/api/v1/champions/search/route";

describe("Phase F4: Champion Registry & Search API", () => {
  const snapshotId = "snap_real_cdragon_live_18_2";

  it("searches all 7 required fixture champions by name (Akali, Kayle, Ashe, Ahri, Draven, Cassiopeia, Master Yi)", async () => {
    const fixtureChampions = [
      { query: "Akali", expectedId: "tft18_da_18_akali_ad" },
      { query: "Kayle", expectedId: "tft18_da_18_kayle" },
      { query: "Ashe", expectedId: "tft18_da_18_ashe" },
      { query: "Ahri", expectedId: "tft18_da_18_ahri" },
      { query: "Draven", expectedId: "tft18_da_draven18" },
      { query: "Cassiopeia", expectedId: "tft18_da_18_cassiopeia" },
      { query: "Master Yi", expectedId: "tft18_da_18_masteryi_ad" }
    ];

    for (const { query, expectedId } of fixtureChampions) {
      const req = new NextRequest(`http://localhost:3000/api/v1/champions/search?q=${encodeURIComponent(query)}&snapshotId=${snapshotId}`);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.items.length).toBeGreaterThan(0);
      const found = json.data.items.find((item: any) => item.championId === expectedId);
      expect(found).toBeDefined();
    }
  });

  it("supports case-insensitive normalized name search", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/champions/search?q=mAsTeR%20yI&snapshotId=${snapshotId}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.items.some((item: any) => item.championId === "tft18_da_18_masteryi_ad")).toBe(true);
  });

  it("supports lookup by canonical ID prefix and source key", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/champions/search?q=DA_18_Ashe&snapshotId=${snapshotId}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.items.length).toBeGreaterThan(0);
    expect(json.data.items[0].championId).toBe("tft18_da_18_ashe");
  });

  it("returns empty items when query is empty", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/champions/search?q=&snapshotId=${snapshotId}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.total).toBe(0);
    expect(json.data.items).toEqual([]);
  });
});
