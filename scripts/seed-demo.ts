import { getDb } from "../src/server/db/client";
import { sql } from "drizzle-orm";
import { snapshotService } from "../src/server/services/snapshot-service";
import { ImportEnvelope, ChampionRecord, EvidenceRecord } from "../src/domain/types";
import { evidenceRefs, releaseMarkers, releases } from "../src/server/db/schema";
import { env } from "../src/server/config";
import { pathToFileURL } from "node:url";

export async function runSeed() {
  if (env.DATA_MODE === "real") {
    console.error("[Seed] Refusing to seed demo fixtures into DATA_MODE=real!");
    process.exit(1);
  }

  console.log("[Seed] Starting Demo Fixture Seeding (4 releases, 8+ champions, 10 balance edge-cases)...");

  const commonEvidence: EvidenceRecord[] = [
    {
      id: "ev_demo_pbe_notes_01",
      kind: "demo_fixture",
      sourceId: "demo_source",
      title: "Ghi chú PBE đợt 1 (Minh họa Demo)",
      url: "/demo/evidence/pbe/18.0.1",
      locator: "section#champions",
      snippet: "Khởi tạo thông số thử nghiệm TFT mùa 18.",
      sourcePublishedAt: "2026-08-01T10:00:00Z",
      datasetKind: "demo"
    },
    {
      id: "ev_demo_pbe_notes_02",
      kind: "demo_fixture",
      sourceId: "demo_source",
      title: "Ghi chú PBE đợt 2 (Minh họa Demo)",
      url: "/demo/evidence/pbe/18.0.2",
      locator: "section#balance",
      snippet: "Cân bằng đợt 2: Tăng máu Tướng A, giảm năng lượng Tướng B.",
      sourcePublishedAt: "2026-08-10T10:00:00Z",
      datasetKind: "demo"
    },
    {
      id: "ev_demo_launch_notes",
      kind: "demo_fixture",
      sourceId: "demo_source",
      title: "Thông báo Ra mắt Chính thức Mùa 18 (Minh họa Demo)",
      url: "/demo/evidence/live/18.1",
      locator: "section#patch-notes",
      snippet: "Phiên bản chính thức TFT mùa 18 ra mắt toàn cầu.",
      sourcePublishedAt: "2026-08-25T10:00:00Z",
      datasetKind: "demo"
    },
    {
      id: "ev_demo_hotfix_notes",
      kind: "demo_fixture",
      sourceId: "demo_source",
      title: "Bản vá khẩn cấp 18.1b (Minh họa Demo)",
      url: "/demo/evidence/live/18.1b",
      locator: "section#hotfix",
      snippet: "Sửa lỗi và cân bằng nóng ngày thứ 2 sau ra mắt.",
      sourcePublishedAt: "2026-08-27T10:00:00Z",
      datasetKind: "demo"
    }
  ];

  // Helper to build champion
  function buildChampionA(hpVal: number = 800): ChampionRecord {
    return {
      championId: "demo_champion_a",
      sourceApiNames: ["TFT18_DemoChampionA"],
      name: {
        en: { state: "known", value: "Demo Champion A (Caitlyn)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
        vi: { state: "known", value: "Tướng Minh Họa A (Xạ Thủ)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
      },
      aliases: ["ChampA", "Sniper"],
      cost: { state: "known", value: 2, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      traitIds: { state: "known", value: ["demo_trait_enforcer", "demo_trait_sniper"], sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      icon: { state: "known", value: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/51.png", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      entityKind: "shop_champion",
      variants: [
        {
          variantKey: "base",
          label: "Cơ bản",
          stats: [
            {
              key: "health",
              labelVi: "Máu",
              labelEn: "Health",
              unit: "flat",
              contextKey: "base",
              byStar: {
                1: { state: "known", value: hpVal, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: hpVal * 1.8, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: hpVal * 3.24, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            },
            {
              key: "attack_damage",
              labelVi: "Sát thương vật lý (AD)",
              labelEn: "Attack Damage",
              unit: "flat",
              contextKey: "base",
              byStar: {
                1: { state: "known", value: 55, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: 83, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: 124, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            },
            {
              key: "attack_speed",
              labelVi: "Tốc độ đánh",
              labelEn: "Attack Speed",
              unit: "attacks_per_second",
              contextKey: "base",
              byStar: {
                1: { state: "known", value: 0.75, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: 0.75, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: 0.75, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            }
          ],
          abilities: [
            {
              abilityKey: "ace_in_the_hole",
              name: {
                en: { state: "known", value: "Ace in the Hole", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                vi: { state: "known", value: "Bắn Tỉa Chuẩn Xác", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              },
              description: {
                en: { state: "known", value: "Fire a massive shot dealing physical damage to the furthest target.", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                vi: { state: "known", value: "Bắn một phát đạn tầm xa gây sát thương vật lý lên kẻ địch xa nhất.", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              },
              parameters: [
                {
                  key: "damage",
                  labelVi: "Sát thương phát bắn",
                  labelEn: "Bullet Damage",
                  unit: "flat",
                  contextKey: "active",
                  byStar: {
                    1: { state: "known", value: 250, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                    2: { state: "known", value: 400, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                    3: { state: "known", value: 700, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
                  }
                }
              ]
            }
          ]
        }
      ]
    };
  }

  function buildChampionB(manaMax: number = 80): ChampionRecord {
    return {
      championId: "demo_champion_b",
      sourceApiNames: ["TFT18_DemoChampionB"],
      name: {
        en: { state: "known", value: "Demo Champion B (Mage)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
        vi: { state: "known", value: "Tướng Minh Họa B (Phù Thủy)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
      },
      aliases: ["ChampB"],
      cost: { state: "known", value: 1, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      traitIds: { state: "known", value: ["demo_trait_sorcerer"], sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      icon: { state: "known", value: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/1.png", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      entityKind: "shop_champion",
      variants: [
        {
          variantKey: "base",
          label: "Cơ bản",
          stats: [
            {
              key: "mana_start",
              labelVi: "Năng lượng khởi đầu",
              labelEn: "Starting Mana",
              unit: "mana",
              contextKey: "base",
              byStar: {
                1: { state: "known", value: 0, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: 0, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: 0, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            },
            {
              key: "mana_max",
              labelVi: "Năng lượng tối đa",
              labelEn: "Max Mana",
              unit: "mana",
              contextKey: "base",
              byStar: {
                1: { state: "known", value: manaMax, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: manaMax, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: manaMax, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            }
          ],
          abilities: []
        }
      ]
    };
  }

  function buildChampionC(spell3StarDamage: number = 800): ChampionRecord {
    return {
      championId: "demo_champion_c",
      sourceApiNames: ["TFT18_DemoChampionC"],
      name: {
        en: { state: "known", value: "Demo Champion C (Assassin)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
        vi: { state: "known", value: "Tướng Minh Họa C (Sát Thủ)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
      },
      aliases: ["ChampC"],
      cost: { state: "known", value: 3, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      traitIds: { state: "known", value: ["demo_trait_assassin"], sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      icon: { state: "known", value: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/238.png", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      entityKind: "shop_champion",
      variants: [
        {
          variantKey: "base",
          label: "Cơ bản",
          stats: [],
          abilities: [
            {
              abilityKey: "shadow_slash",
              name: {
                en: { state: "known", value: "Shadow Slash", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                vi: { state: "known", value: "Đao Bóng Đêm", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              },
              description: {
                en: { state: "known", value: "Slash enemies in a line dealing magic damage.", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                vi: { state: "known", value: "Vung đao bóng tối gây sát thương phép thuật lên diện rộng.", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              },
              parameters: [
                {
                  key: "slash_damage",
                  labelVi: "Sát thương chém",
                  labelEn: "Slash Damage",
                  unit: "flat",
                  contextKey: "active",
                  byStar: {
                    1: { state: "known", value: 300, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                    2: { state: "known", value: 450, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                    3: { state: "known", value: spell3StarDamage, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
                  }
                }
              ]
            }
          ]
        }
      ]
    };
  }

  function buildChampionD(hp: number = 1000, ad: number = 70): ChampionRecord {
    return {
      championId: "demo_champion_d",
      sourceApiNames: ["TFT18_DemoChampionD"],
      name: {
        en: { state: "known", value: "Demo Champion D (Bruiser)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
        vi: { state: "known", value: "Tướng Minh Họa D (Đấu Sĩ)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
      },
      aliases: ["ChampD"],
      cost: { state: "known", value: 4, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      traitIds: { state: "known", value: ["demo_trait_bruiser"], sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      icon: { state: "known", value: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/86.png", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      entityKind: "shop_champion",
      variants: [
        {
          variantKey: "base",
          label: "Cơ bản",
          stats: [
            {
              key: "health",
              labelVi: "Máu",
              labelEn: "Health",
              unit: "flat",
              contextKey: "base",
              byStar: {
                1: { state: "known", value: hp, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: hp * 1.8, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: hp * 3.24, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            },
            {
              key: "attack_damage",
              labelVi: "Sát thương vật lý (AD)",
              labelEn: "Attack Damage",
              unit: "flat",
              contextKey: "base",
              byStar: {
                1: { state: "known", value: ad, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: ad * 1.5, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: ad * 2.25, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            }
          ],
          abilities: []
        }
      ]
    };
  }

  function buildChampionE(descText: string = "Tạo lá chắn 300 máu cho bản thân trong 4 giây."): ChampionRecord {
    return {
      championId: "demo_champion_e",
      sourceApiNames: ["TFT18_DemoChampionE"],
      name: {
        en: { state: "known", value: "Demo Champion E (Guardian)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
        vi: { state: "known", value: "Tướng Minh Họa E (Hộ Vệ)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
      },
      aliases: ["ChampE"],
      cost: { state: "known", value: 2, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      traitIds: { state: "known", value: ["demo_trait_guardian"], sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      icon: { state: "known", value: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/89.png", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      entityKind: "shop_champion",
      variants: [
        {
          variantKey: "base",
          label: "Cơ bản",
          stats: [],
          abilities: [
            {
              abilityKey: "guardian_shield",
              name: {
                en: { state: "known", value: "Guardian Shield", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                vi: { state: "known", value: "Khiên Hộ Vệ", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              },
              description: {
                en: { state: "known", value: descText, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                vi: { state: "known", value: descText, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              },
              parameters: [
                {
                  key: "shield_value",
                  labelVi: "Lượng lá chắn",
                  labelEn: "Shield Amount",
                  unit: "flat",
                  contextKey: "active",
                  byStar: {
                    1: { state: "known", value: 300, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                    2: { state: "known", value: 500, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                    3: { state: "known", value: 850, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
                  }
                }
              ]
            }
          ]
        }
      ]
    };
  }

  function buildChampionF(): ChampionRecord {
    return {
      championId: "demo_champion_f",
      sourceApiNames: ["TFT18_DemoChampionF"],
      name: {
        en: { state: "known", value: "Demo Champion F (EdgeCases)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
        vi: { state: "known", value: "Tướng Minh Họa F (Đặc Biệt)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
      },
      aliases: ["ChampF"],
      cost: { state: "known", value: 1, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      traitIds: { state: "known", value: ["demo_trait_special"], sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      icon: { state: "known", value: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/35.png", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      entityKind: "shop_champion",
      variants: [
        {
          variantKey: "base",
          label: "Cơ bản",
          stats: [
            {
              key: "mana_start",
              labelVi: "Năng lượng khởi đầu",
              labelEn: "Starting Mana",
              unit: "mana",
              contextKey: "base",
              byStar: {
                1: { state: "known", value: 0, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: 0, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: 0, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            },
            {
              key: "armor",
              labelVi: "Giáp",
              labelEn: "Armor",
              unit: "flat",
              contextKey: "base",
              byStar: {
                1: { state: "missing", reason: "Chưa cập nhật ở nguồn PBE", sourceRefIds: [] }
              }
            },
            {
              key: "attack_range",
              labelVi: "Tầm đánh",
              labelEn: "Attack Range",
              unit: "hexes",
              contextKey: "base",
              byStar: {
                1: { state: "not_applicable", reason: "Tướng cận chiến không tính tầm bắn ô xa", sourceRefIds: [] }
              }
            }
          ],
          abilities: []
        }
      ]
    };
  }

  function buildChampionG(): ChampionRecord {
    return {
      championId: "demo_champion_g",
      sourceApiNames: ["TFT18_DemoChampionG"],
      name: {
        en: { state: "known", value: "Demo Champion G (TwoForms)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
        vi: { state: "known", value: "Tướng Minh Họa G (Song Dạng)", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
      },
      aliases: ["ChampG"],
      cost: { state: "known", value: 5, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      traitIds: { state: "known", value: ["demo_trait_shapeshifter", "demo_trait_legendary"], sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      icon: { state: "known", value: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/126.png", sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
      entityKind: "shop_champion",
      variants: [
        {
          variantKey: "melee",
          label: "Dạng Cận Chiến (Melee)",
          stats: [
            {
              key: "health",
              labelVi: "Máu (Cận chiến)",
              labelEn: "Health (Melee)",
              unit: "flat",
              contextKey: "form_melee",
              byStar: {
                1: { state: "known", value: 1200, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: 2160, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: 3888, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            }
          ],
          abilities: []
        },
        {
          variantKey: "ranged",
          label: "Dạng Đánh Xa (Ranged)",
          stats: [
            {
              key: "health",
              labelVi: "Máu (Đánh xa)",
              labelEn: "Health (Ranged)",
              unit: "flat",
              contextKey: "form_ranged",
              byStar: {
                1: { state: "known", value: 900, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                2: { state: "known", value: 1620, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" },
                3: { state: "known", value: 2916, sourceRefIds: ["ev_demo_pbe_notes_01"], quality: "extracted", origin: "manual" }
              }
            }
          ],
          abilities: []
        }
      ]
    };
  }

  function buildChampionH(): ChampionRecord {
    return {
      championId: "demo_champion_h",
      sourceApiNames: ["TFT18_DemoChampionH"],
      name: {
        en: { state: "known", value: "Demo Champion H (Newcomer)", sourceRefIds: ["ev_demo_launch_notes"], quality: "extracted", origin: "manual" },
        vi: { state: "known", value: "Tướng Minh Họa H (Tân Binh)", sourceRefIds: ["ev_demo_launch_notes"], quality: "extracted", origin: "manual" }
      },
      aliases: ["ChampH"],
      cost: { state: "known", value: 3, sourceRefIds: ["ev_demo_launch_notes"], quality: "extracted", origin: "manual" },
      traitIds: { state: "known", value: ["demo_trait_enforcer"], sourceRefIds: ["ev_demo_launch_notes"], quality: "extracted", origin: "manual" },
      icon: { state: "known", value: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/222.png", sourceRefIds: ["ev_demo_launch_notes"], quality: "extracted", origin: "manual" },
      entityKind: "shop_champion",
      variants: [
        {
          variantKey: "base",
          label: "Cơ bản",
          stats: [
            {
              key: "health",
              labelVi: "Máu",
              labelEn: "Health",
              unit: "flat",
              contextKey: "base",
              byStar: {
                1: { state: "known", value: 750, sourceRefIds: ["ev_demo_launch_notes"], quality: "extracted", origin: "manual" }
              }
            }
          ],
          abilities: []
        }
      ]
    };
  }

  function buildDemoExtraChampion(id: string, nameEn: string, nameVi: string, cost: number): ChampionRecord {
    const evidenceRef = "ev_demo_launch_notes";
    const known = (value: any) => ({ state: "known" as const, value, sourceRefIds: [evidenceRef], quality: "extracted" as const, origin: "manual" as const });
    return {
      championId: id,
      sourceApiNames: [`TFT18_${id}`],
      name: { en: known(nameEn), vi: known(nameVi) },
      aliases: [id],
      cost: known(cost),
      traitIds: known(["demo_trait_enforcer"]),
      icon: known("/demo/assets/champion-placeholder.svg"),
      entityKind: "shop_champion",
      variants: [{
        variantKey: "base",
        label: "Cơ bản",
        stats: [{
          key: "health",
          labelVi: "Máu",
          labelEn: "Health",
          unit: "flat",
          contextKey: "base",
          byStar: { 1: known(700), 2: known(1260), 3: known(2268) }
        }],
        abilities: []
      }]
    };
  }

  const buildChampionI = () => buildDemoExtraChampion("demo_champion_i", "Demo Champion I", "Tướng Minh Họa I", 2);
  const buildChampionJ = () => buildDemoExtraChampion("demo_champion_j", "Demo Champion J", "Tướng Minh Họa J", 4);

  // Release 1: PBE A (Snapshot gốc)
  const envPbeA: ImportEnvelope = {
    importSchemaVersion: "1",
    idempotencyKey: "demo_pbe_a_v1",
    release: {
      channel: "pbe",
      patchLabel: "PBE 18.0.1 (Demo)",
      buildId: "pbe_build_01",
      effectiveAt: "2026-08-01T10:00:00Z",
      timePrecision: "day",
      timeBasis: "verified_release",
      occurrenceKey: "demo_pbe_18_0_1"
    },
    payload: {
      schemaVersion: "1.0.0",
      datasetKind: "demo",
      setNumber: 18,
      gameMode: "standard",
      channel: "pbe",
      rosterCompleteness: "complete",
      fieldCoverage: { health: { known: 7, applicable: 7 } },
      champions: [
        buildChampionA(800),
        buildChampionB(80),
        buildChampionC(800),
        buildChampionD(1000, 70),
        buildChampionE("Tạo lá chắn 300 máu cho bản thân trong 4 giây."),
        buildChampionF(),
        buildChampionG(),
        buildChampionH(),
        buildChampionI(),
        buildChampionJ()
        // Note: Champion H is NOT in PBE A
      ]
    },
    evidence: commonEvidence,
    notes: ["Bản PBE sớm nhất đã lưu trong dữ liệu demo."]
  };

  // Release 2: PBE B (Cân bằng đợt 2: Tướng A tăng máu 800->880; Tướng B giảm mana 80->70)
  const envPbeB: ImportEnvelope = {
    importSchemaVersion: "1",
    idempotencyKey: "demo_pbe_b_v1",
    release: {
      channel: "pbe",
      patchLabel: "PBE 18.0.2 (Demo)",
      buildId: "pbe_build_02",
      effectiveAt: "2026-08-10T10:00:00Z",
      timePrecision: "day",
      timeBasis: "verified_release",
      occurrenceKey: "demo_pbe_18_0_2"
    },
    payload: {
      schemaVersion: "1.0.0",
      datasetKind: "demo",
      setNumber: 18,
      gameMode: "standard",
      channel: "pbe",
      rosterCompleteness: "complete",
      fieldCoverage: { health: { known: 7, applicable: 7 } },
      champions: [
        buildChampionA(880), // +10% buff
        buildChampionB(70),  // -10 mana buff
        buildChampionC(950), // 3-star buff
        buildChampionD(1100, 60), // Mixed: HP buff, AD nerf
        buildChampionE("Tạo một vùng lá chắn 300 máu bảo hộ đồng minh xung quanh."), // Text change
        buildChampionF(),
        buildChampionG(),
        buildChampionH(),
        buildChampionI(),
        buildChampionJ()
      ]
    },
    evidence: commonEvidence,
    notes: ["Bản PBE thứ hai với các điều chỉnh cân bằng."]
  };

  // PBE revisions are separate occurrences. They are kept in the timeline so
  // a compare request can never silently jump over a mid-PBE snapshot.
  const envPbe181r1: ImportEnvelope = {
    ...envPbeB,
    idempotencyKey: "demo_pbe_18_1_r1_v1",
    release: {
      ...envPbeB.release,
      patchLabel: "PBE 18.1 r1 (Demo)",
      buildId: "pbe_build_18_1_r1",
      effectiveAt: "2026-08-20T10:00:00Z",
      occurrenceKey: "demo_pbe_18_1_r1"
    },
    notes: ["PBE 18.1 revision r1; số liệu minh họa có bằng chứng demo riêng."]
  };

  const envPbe181r2: ImportEnvelope = {
    ...envPbe181r1,
    idempotencyKey: "demo_pbe_18_1_r2_v1",
    release: {
      ...envPbe181r1.release,
      patchLabel: "PBE 18.1 r2 (Demo)",
      buildId: "pbe_build_18_1_r2",
      effectiveAt: "2026-08-22T10:00:00Z",
      occurrenceKey: "demo_pbe_18_1_r2"
    },
    payload: {
      ...envPbe181r1.payload,
      champions: [
        buildChampionA(900),
        buildChampionB(68),
        buildChampionC(950),
        buildChampionD(1120, 60),
        buildChampionE("Tạo một vùng lá chắn 320 máu bảo hộ đồng minh xung quanh."),
        buildChampionF(),
        buildChampionG(),
        buildChampionH(),
        buildChampionI(),
        buildChampionJ()
      ]
    },
    notes: ["PBE 18.1 revision r2; thay đổi được giữ riêng trong timeline."]
  };

  // Release 3: Live A (Bản ra mắt chính thức; bổ sung Tướng H)
  const envLiveA: ImportEnvelope = {
    importSchemaVersion: "1",
    idempotencyKey: "demo_live_a_v1",
    release: {
      channel: "live",
      patchLabel: "18.1 Bản Ra Mắt (Demo)",
      buildId: "live_build_18_1",
      effectiveAt: "2026-08-25T10:00:00Z",
      timePrecision: "day",
      timeBasis: "verified_release",
      occurrenceKey: "demo_live_18_1"
    },
    payload: {
      schemaVersion: "1.0.0",
      datasetKind: "demo",
      setNumber: 18,
      gameMode: "standard",
      channel: "live",
      rosterCompleteness: "complete",
      fieldCoverage: { health: { known: 8, applicable: 8 } },
      champions: [
        buildChampionA(880),
        buildChampionB(70),
        buildChampionC(950),
        buildChampionD(1100, 60),
        buildChampionE("Tạo một vùng lá chắn 300 máu bảo hộ đồng minh xung quanh."),
        buildChampionF(),
        buildChampionG(),
        buildChampionH(), // Added champion
        buildChampionI(),
        buildChampionJ()
      ]
    },
    evidence: commonEvidence,
    notes: ["Bản phát hành Live chính thức mở màn TFT mùa 18."]
  };

  // Release 4: Live Hotfix A (Patch 18.1b)
  const envLiveHotfix: ImportEnvelope = {
    importSchemaVersion: "1",
    idempotencyKey: "demo_live_hotfix_v1",
    release: {
      channel: "live",
      patchLabel: "18.1b Hotfix (Demo)",
      buildId: "live_build_18_1_b",
      effectiveAt: "2026-08-27T10:00:00Z",
      timePrecision: "day",
      timeBasis: "verified_release",
      occurrenceKey: "demo_live_18_1_b"
    },
    payload: {
      schemaVersion: "1.0.0",
      datasetKind: "demo",
      setNumber: 18,
      gameMode: "standard",
      channel: "live",
      rosterCompleteness: "complete",
      fieldCoverage: { health: { known: 8, applicable: 8 } },
      champions: [
        buildChampionA(850), // Hotfix nerf nhẹ A
        buildChampionB(70),
        buildChampionC(900),
        buildChampionD(1100, 60),
        buildChampionE("Tạo một vùng lá chắn 300 máu bảo hộ đồng minh xung quanh."),
        buildChampionF(),
        buildChampionG(),
        buildChampionH(),
        buildChampionI(),
        buildChampionJ()
      ]
    },
    evidence: commonEvidence,
    notes: ["Bản vá lỗi khẩn cấp sau ra mắt."]
  };

  const envLiveHotfixA: ImportEnvelope = {
    ...envLiveA,
    idempotencyKey: "demo_live_18_1a_v1",
    release: {
      ...envLiveA.release,
      patchLabel: "18.1a Hotfix (Demo)",
      buildId: "live_build_18_1_a",
      effectiveAt: "2026-08-26T10:00:00Z",
      occurrenceKey: "demo_live_18_1_a"
    },
    payload: {
      ...envLiveA.payload,
      champions: [
        buildChampionA(860),
        buildChampionB(70),
        buildChampionC(930),
        buildChampionD(1100, 60),
        buildChampionE("Tạo một vùng lá chắn 300 máu bảo hộ đồng minh xung quanh."),
        buildChampionF(),
        buildChampionG(),
        buildChampionH(),
        buildChampionI(),
        buildChampionJ()
      ]
    },
    notes: ["Hotfix 18.1a được giữ nguyên như một mốc riêng trong Demo Mode."]
  };

  const envLive182: ImportEnvelope = {
    ...envLiveA,
    idempotencyKey: "demo_live_18_2_v1",
    release: {
      ...envLiveA.release,
      patchLabel: "18.2 (Demo)",
      buildId: "live_build_18_2",
      effectiveAt: "2026-09-02T10:00:00Z",
      occurrenceKey: "demo_live_18_2"
    },
    payload: {
      ...envLiveA.payload,
      champions: [
        buildChampionA(900),
        buildChampionB(65),
        buildChampionC(980),
        buildChampionD(1150, 62),
        buildChampionE("Tạo một vùng lá chắn 340 máu bảo hộ đồng minh xung quanh."),
        buildChampionF(),
        buildChampionG(),
        buildChampionH(),
        buildChampionI(),
        buildChampionJ()
      ]
    },
    notes: ["Bản 18.2 demo; mốc chính thức tiếp theo sau 18.1b."]
  };

  const envelopes = [envPbeA, envPbeB, envPbe181r1, envPbe181r2, envLiveA, envLiveHotfixA, envLiveHotfix, envLive182];
  const db = await getDb();

  // Keep explicit no-snapshot nodes in the demo timeline so the UI can prove
  // notes-only and gap behavior without inventing a full champion state.
  await db.insert(evidenceRefs).values([
    {
      id: "ev_demo_notes_only_18_0",
      kind: "demo_fixture",
      sourceId: "demo_source",
      title: "Mốc ghi chú 18.0 không có snapshot (Demo)",
      url: "/demo/evidence/live/18.0-notes-only",
      locator: "section#notes-only",
      snippet: "Mốc chỉ có ghi chú; old/new numeric state không được suy diễn.",
      datasetKind: "demo"
    },
    {
      id: "ev_demo_gap_18_3",
      kind: "demo_fixture",
      sourceId: "demo_source",
      title: "Khoảng trống dữ liệu 18.3 (Demo)",
      url: "/demo/evidence/live/18.3-gap",
      locator: "section#gap",
      snippet: "Chưa có snapshot tương thích cho mốc này; hiển thị gap fail-closed.",
      datasetKind: "demo"
    }
  ]).onConflictDoNothing();
  await db.insert(releases).values([
    {
      id: "rel_demo_live_18_0_notes_only",
      datasetKind: "demo",
      setNumber: 18,
      gameMode: "standard",
      channel: "live",
      patchLabel: "18.0 Notes Only (Demo)",
      buildId: null,
      occurrenceKey: "demo_live_18_0_notes_only",
      effectiveAt: new Date("2026-07-25T10:00:00Z"),
      observedAt: new Date("2026-09-15T05:00:00Z"),
      currentSnapshotId: null,
      evidenceStatus: "notes_only"
    },
    {
      id: "rel_demo_live_18_3_gap",
      datasetKind: "demo",
      setNumber: 18,
      gameMode: "standard",
      channel: "live",
      patchLabel: "18.3 Gap (Demo)",
      buildId: null,
      occurrenceKey: "demo_live_18_3_gap",
      effectiveAt: new Date("2026-09-10T10:00:00Z"),
      observedAt: new Date("2026-09-15T05:00:01Z"),
      currentSnapshotId: null,
      evidenceStatus: "gap"
    }
  ]).onConflictDoUpdate({
    target: releases.id,
    set: {
      datasetKind: "demo",
      patchLabel: sql`excluded.patch_label`,
      channel: sql`excluded.channel`,
      occurrenceKey: sql`excluded.occurrence_key`,
      effectiveAt: sql`excluded.effective_at`,
      observedAt: sql`excluded.observed_at`,
      currentSnapshotId: sql`excluded.current_snapshot_id`,
      evidenceStatus: sql`excluded.evidence_status`
    }
  });

  for (const envItem of envelopes) {
    const res = await snapshotService.importEnvelope(envItem, true);
    console.log(`[Seed] Imported ${envItem.release.patchLabel} -> Snapshot: ${res.snapshotId} (New: ${res.isNew})`);
    
    // Add markers if launch
    if (envItem.release.occurrenceKey === "demo_live_18_1") {
      await db.insert(releaseMarkers).values({
        id: `marker_launch_${res.releaseId}`,
        releaseId: res.releaseId,
        marker: "launch",
        evidenceRefs: ["ev_demo_launch_notes"],
        actor: "seed_script"
      }).onConflictDoNothing();
    } else if (envItem.release.occurrenceKey === "demo_pbe_18_0_1") {
      await db.insert(releaseMarkers).values({
        id: `marker_initial_${res.releaseId}`,
        releaseId: res.releaseId,
        marker: "initial_pbe",
        evidenceRefs: ["ev_demo_pbe_notes_01"],
        actor: "seed_script"
      }).onConflictDoNothing();
    }
  }

  console.log("[Seed] Demo seeding completed successfully!");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seed] Failed:", err);
      process.exit(1);
    });
}
