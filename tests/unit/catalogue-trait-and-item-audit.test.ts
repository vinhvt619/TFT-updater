import { describe, it, expect } from "vitest";
import { formatTraitNameVi, toCanonicalTraitId } from "@/domain/identity";
import { ITEM_DETAILS } from "@/domain/meta/item-registry";

describe("FIN-06 & FIN-07: Item Provenance and Trait Translation Audit", () => {
  it("FIN-07: translates raw and canonical Set 18 trait IDs into clean Vietnamese", () => {
    expect(formatTraitNameVi("da_18_elderwood")).toBe("Thần Rừng");
    expect(formatTraitNameVi("TFT18_BlackThorn")).toBe("Gai Đen");
    expect(formatTraitNameVi("da_18_blackthorn")).toBe("Gai Đen");
    expect(formatTraitNameVi("da_18_luxuniquetrait")).toBe("Thế Thần");
    expect(formatTraitNameVi("da_18_coven")).toBe("Tiên Hắc Ám");
    expect(formatTraitNameVi("da_18_brawler")).toBe("Đấu Sĩ");
    expect(formatTraitNameVi("da_18_hunter")).toBe("Thợ Săn");
    expect(formatTraitNameVi("da_18_spellweaver")).toBe("Thuật Sư");
    expect(formatTraitNameVi("da_dravenuniquetrait18")).toBe("Săn Thưởng");
  });

  it("FIN-07: canonicalizes case-insensitive trait keys reliably", () => {
    expect(toCanonicalTraitId("TFT18_ELDERWOOD")).toBe("da_18_elderwood");
    expect(toCanonicalTraitId("da_18_solar")).toBe("da_18_solar");
    expect(toCanonicalTraitId("thần rừng")).toBe("da_18_elderwood");
  });

  it("FIN-06 & REV-03: item registry binds provenance metadata, raw locator, and explicit unverified status", () => {
    const ie = ITEM_DETAILS["infinityedge"];
    expect(ie).toBeDefined();
    expect(ie.statsVi).toContain("+35 Sức Mạnh Công Kích");
    expect(ie.descriptionVi).toContain("chí mạng");
    expect(ie.sourceScope).toBe("TFT Set 18 Reference (Chưa kiểm chứng snapshot)");
    expect(ie.provenanceNote).toContain("CommunityDragon");
    expect(ie.verificationStatus).toBe("unverified");
    expect(ie.referenceVersion).toBe("18.1");
    expect(ie.rawLocator).toBe("CommunityDragon:infinityedge");

    const deathblade = ITEM_DETAILS["deathblade"];
    expect(deathblade).toBeDefined();
    expect(deathblade.statsVi).toContain("+55%");
    expect(deathblade.verificationStatus).toBe("unverified");
    expect(deathblade.rawLocator).toBe("CommunityDragon:deathblade");
  });
});
