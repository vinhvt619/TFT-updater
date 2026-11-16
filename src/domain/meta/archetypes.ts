import { Archetype } from "./schemas";

export const SET18_ARCHETYPES: Archetype[] = [
  {
    "id": "comp_akali_ninja",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Mặt Trời Thích Ứng (Solar Adaptor - Bản 18.2)",
    "nameEn": "Solar Adaptor (Akali & Camille)",
    "aliases": [
      "Solar Adaptor",
      "Akali Mặt Trời",
      "Camille Reroll",
      "Mặt Trời Thích Ứng"
    ],
    "coreCarryChampionId": "DA_18_Akali_AD",
    "coreTankChampionId": "DA_18_Ornn",
    "coreChampionIds": [
      "DA_18_Akali_AD",
      "DA_18_Camille",
      "DA_18_Ornn",
      "DA_18_Varus"
    ],
    "flexChampionIds": [
      "DA_18_Leona",
      "DA_18_Kennen",
      "DA_Taric18",
      "DA_18_Shen"
    ],
    "keyTraitIds": [
      "DA_18_Solar",
      "DA_18_Adaptor",
      "DA_18_Defender"
    ],
    "playstyle": "reroll",
    "requiredConditions": [
      "Slow roll ở cấp 5 để bắt Akali 3 sao, Camille 3 sao và Ornn 3 sao"
    ],
    "recommendedItems": {
      "DA_18_Akali_AD": [
        "Hand of Justice",
        "Infinity Edge",
        "Edge of Night"
      ],
      "DA_18_Ornn": [
        "Warmog's Armor",
        "Sunfire Cape",
        "Dragon's Claw"
      ],
      "DA_18_Camille": [
        "Bloodthirster",
        "Titan's Resolve",
        "Sterak's Gage"
      ]
    },
    "defaultVariantId": "var_solar_adaptor_standard",
    "variants": [
      {
        "id": "var_solar_adaptor_standard",
        "archetypeId": "comp_akali_ninja",
        "nameVi": "Mặt Trời Thích Ứng Tiêu Chuẩn",
        "nameEn": "Standard Solar Adaptor",
        "conditionDescription": "Slow roll cấp 5 kích 4 Mặt Trời, 3 Thích Ứng, 2 Hộ Vệ",
        "requiredItems": [
          "Hand of Justice"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Akali_AD",
            "nameVi": "Akali",
            "cost": 1,
            "tier": 3,
            "items": [
              "Hand of Justice",
              "Infinity Edge",
              "Edge of Night"
            ],
            "position": {
              "row": 1,
              "col": 2
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Ornn",
            "nameVi": "Ornn",
            "cost": 1,
            "tier": 3,
            "items": [
              "Warmog's Armor",
              "Sunfire Cape",
              "Dragon's Claw"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Camille",
            "nameVi": "Camille",
            "cost": 1,
            "tier": 3,
            "items": [
              "Bloodthirster",
              "Titan's Resolve"
            ],
            "position": {
              "row": 1,
              "col": 4
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Leona",
            "nameVi": "Leona",
            "cost": 1,
            "tier": 3,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Varus",
            "nameVi": "Varus",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 6
            }
          },
          {
            "championId": "DA_18_Shen",
            "nameVi": "Shen",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_Taric18",
            "nameVi": "Taric",
            "cost": 5,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 1
            }
          },
          {
            "championId": "DA_18_Kennen",
            "nameVi": "Kennen",
            "cost": 5,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 5
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_hecarim_cavalry",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Thần Rừng Liên Kích (Rapidfire Elderwood - Bản 18.2)",
    "nameEn": "Rapidfire Elderwood (Xayah & Sejuani)",
    "aliases": [
      "Rapidfire Elderwood",
      "Xayah Thần Rừng",
      "Sejuani Tiên Phong",
      "Kayle Liên Kích"
    ],
    "coreCarryChampionId": "DA_18_Xayah",
    "coreTankChampionId": "DA_18_Sejuani",
    "coreChampionIds": [
      "DA_18_Xayah",
      "DA_18_Sejuani",
      "DA_18_Ornn",
      "DA_18_Aphelios"
    ],
    "flexChampionIds": [
      "DA_18_Ezreal",
      "DA_18_Hecarim",
      "DA_18_GnarSmall",
      "DA_18_Alistar"
    ],
    "keyTraitIds": [
      "DA_18_Elderwood",
      "DA_18_Rapidfire",
      "DA_18_Vanguard"
    ],
    "playstyle": "fast8",
    "requiredConditions": [
      "Lên cấp 8 kẹp Sejuani 2 sao và nâng Xayah 3 sao làm chủ lực sát thương"
    ],
    "recommendedItems": {
      "DA_18_Xayah": [
        "Guinsoo's Rageblade",
        "Infinity Edge",
        "Bloodthirster"
      ],
      "DA_18_Sejuani": [
        "Warmog's Armor",
        "Gargoyle Stoneplate",
        "Sunfire Cape"
      ],
      "DA_18_Ezreal": [
        "Last Whisper",
        "Giant Slayer"
      ]
    },
    "defaultVariantId": "var_rapidfire_elderwood_standard",
    "variants": [
      {
        "id": "var_rapidfire_elderwood_standard",
        "archetypeId": "comp_hecarim_cavalry",
        "nameVi": "Thần Rừng Liên Kích Tiêu Chuẩn",
        "nameEn": "Standard Rapidfire Elderwood",
        "conditionDescription": "Kích hoạt 6 Thần Rừng, 4 Liên Kích, 2 Tiên Phong",
        "requiredItems": [
          "Guinsoo's Rageblade"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Xayah",
            "nameVi": "Xayah",
            "cost": 1,
            "tier": 3,
            "items": [
              "Guinsoo's Rageblade",
              "Infinity Edge",
              "Bloodthirster"
            ],
            "position": {
              "row": 3,
              "col": 6
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Sejuani",
            "nameVi": "Sejuani",
            "cost": 2,
            "tier": 2,
            "items": [
              "Warmog's Armor",
              "Gargoyle Stoneplate",
              "Sunfire Cape"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Ornn",
            "nameVi": "Ornn",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 1
            }
          },
          {
            "championId": "DA_18_Hecarim",
            "nameVi": "Hecarim",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_18_Aphelios",
            "nameVi": "Aphelios",
            "cost": 4,
            "tier": 2,
            "items": [
              "Last Whisper"
            ],
            "position": {
              "row": 3,
              "col": 5
            }
          },
          {
            "championId": "DA_18_Ezreal",
            "nameVi": "Ezreal",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 1
            }
          },
          {
            "championId": "DA_18_GnarSmall",
            "nameVi": "Gnar",
            "cost": 5,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Alistar",
            "nameVi": "Alistar",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 1,
              "col": 3
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_ahri_fast8",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Hoa Linh Thích Ứng (Blossom Adaptor / Wispful Thinking - Bản 18.2)",
    "nameEn": "Blossom Adaptor (Ahri & Sett - Wispful Thinking)",
    "aliases": [
      "Wispful Thinking",
      "Blossom Adaptor",
      "Ahri Hoa Linh",
      "Sett Đấu Sĩ",
      "Hoa Linh Thích Ứng"
    ],
    "coreCarryChampionId": "DA_18_Ahri",
    "coreTankChampionId": "DA_18_Sett",
    "coreChampionIds": [
      "DA_18_Ahri",
      "DA_18_Sett",
      "DA_Karma18",
      "DA_18_MasterYi_AD"
    ],
    "flexChampionIds": [
      "DA_18_Ashe",
      "DA_18_Sivir",
      "DA_18_Yorick",
      "DA_18_Cassiopeia"
    ],
    "keyTraitIds": [
      "DA_18_Blossom",
      "DA_18_Spellweaver",
      "DA_18_Adaptor"
    ],
    "playstyle": "fast8",
    "requiredConditions": [
      "Fast 8 ở vòng 4-2, hoàn thành Bùa Xanh và Găng Bảo Thạch cho Ahri"
    ],
    "recommendedItems": {
      "DA_18_Ahri": [
        "Blue Buff",
        "Jeweled Gauntlet",
        "Rabadon's Deathcap"
      ],
      "DA_18_Sett": [
        "Sunfire Cape",
        "Warmog's Armor",
        "Dragon's Claw"
      ],
      "DA_18_Ashe": [
        "Infinity Edge",
        "Guinsoo's Rageblade",
        "Last Whisper"
      ]
    },
    "defaultVariantId": "var_blossom_adaptor_standard",
    "variants": [
      {
        "id": "var_blossom_adaptor_standard",
        "archetypeId": "comp_ahri_fast8",
        "nameVi": "Hoa Linh Thích Ứng Tiêu Chuẩn",
        "nameEn": "Standard Blossom Adaptor",
        "conditionDescription": "Fast 8 ổn định đội hình 6 Hoa Linh, 3 Thích Ứng, 2 Đấu Sĩ",
        "requiredItems": [
          "Blue Buff"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Ahri",
            "nameVi": "Ahri",
            "cost": 4,
            "tier": 2,
            "items": [
              "Blue Buff",
              "Jeweled Gauntlet",
              "Rabadon's Deathcap"
            ],
            "position": {
              "row": 3,
              "col": 6
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Sett",
            "nameVi": "Sett",
            "cost": 4,
            "tier": 2,
            "items": [
              "Sunfire Cape",
              "Warmog's Armor",
              "Dragon's Claw"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Ashe",
            "nameVi": "Ashe",
            "cost": 5,
            "tier": 2,
            "items": [
              "Infinity Edge",
              "Guinsoo's Rageblade"
            ],
            "position": {
              "row": 3,
              "col": 1
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Sivir",
            "nameVi": "Sivir",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 5
            }
          },
          {
            "championId": "DA_Karma18",
            "nameVi": "Karma",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 6
            }
          },
          {
            "championId": "DA_18_MasterYi_AD",
            "nameVi": "Master Yi",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 1,
              "col": 3
            }
          },
          {
            "championId": "DA_18_Yorick",
            "nameVi": "Yorick",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Cassiopeia",
            "nameVi": "Cassiopeia",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 4
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_caitlyn_enforcer",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Đấu Sĩ Quái Rừng (Juggernaut Riftbeast - Bản 18.2)",
    "nameEn": "Juggernaut Caitlyn & Scuttlecrab",
    "aliases": [
      "Juggernaut Caitlyn",
      "Cua Kỳ Cục Reroll",
      "Caitlyn Thợ Săn",
      "Đấu Sĩ Quái Rừng"
    ],
    "coreCarryChampionId": "DA_18_Caitlyn",
    "coreTankChampionId": "DA_Scuttlecrab18",
    "coreChampionIds": [
      "DA_18_Caitlyn",
      "DA_Scuttlecrab18",
      "DA_Vi18",
      "DA_Amumu18"
    ],
    "flexChampionIds": [
      "DA_18_Sivir",
      "DA_Cinderling18",
      "DA_Krug18",
      "DA_18_Ashe"
    ],
    "keyTraitIds": [
      "DA_Juggernaut18",
      "DA_18_Hunter",
      "DA_Riftbeast18"
    ],
    "playstyle": "reroll",
    "requiredConditions": [
      "Slow roll ở cấp 6 nâng Caitlyn 3 sao và Cua Kỳ Cục 3 sao (Buff mạnh 18.2)"
    ],
    "recommendedItems": {
      "DA_18_Caitlyn": [
        "Infinity Edge",
        "Last Whisper",
        "Giant Slayer"
      ],
      "DA_Scuttlecrab18": [
        "Gargoyle Stoneplate",
        "Warmog's Armor",
        "Bramble Vest"
      ]
    },
    "defaultVariantId": "var_juggernaut_caitlyn_standard",
    "variants": [
      {
        "id": "var_juggernaut_caitlyn_standard",
        "archetypeId": "comp_caitlyn_enforcer",
        "nameVi": "Đấu Sĩ Quái Rừng Tiêu Chuẩn",
        "nameEn": "Standard Juggernaut Caitlyn",
        "conditionDescription": "Slow roll cấp 6 hoàn thiện Caitlyn 3 sao và Scuttlecrab 3 sao",
        "requiredItems": [
          "Infinity Edge"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Caitlyn",
            "nameVi": "Caitlyn",
            "cost": 2,
            "tier": 3,
            "items": [
              "Infinity Edge",
              "Last Whisper",
              "Giant Slayer"
            ],
            "position": {
              "row": 3,
              "col": 6
            },
            "isCarry": true
          },
          {
            "championId": "DA_Scuttlecrab18",
            "nameVi": "Cua Kỳ Cục",
            "cost": 2,
            "tier": 3,
            "items": [
              "Gargoyle Stoneplate",
              "Warmog's Armor",
              "Bramble Vest"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_Vi18",
            "nameVi": "Vi",
            "cost": 3,
            "tier": 2,
            "items": [
              "Bloodthirster"
            ],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_Amumu18",
            "nameVi": "Amumu",
            "cost": 4,
            "tier": 2,
            "items": [
              "Sunfire Cape"
            ],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_18_Sivir",
            "nameVi": "Sivir",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 5
            }
          },
          {
            "championId": "DA_Cinderling18",
            "nameVi": "Mầm Non",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 1
            }
          },
          {
            "championId": "DA_Krug18",
            "nameVi": "Quái Đá Krug",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 1,
              "col": 3
            }
          },
          {
            "championId": "DA_18_Ashe",
            "nameVi": "Ashe",
            "cost": 5,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 2
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_rengar_assassin",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Khắc Tinh Sát Thủ (Unrivaled Rengar & Kha'Zix - Bản 18.2)",
    "nameEn": "Unrivaled Rengar & Kha'Zix Reroll",
    "aliases": [
      "Unrivaled",
      "Rengar KhaZix",
      "Khắc Tinh Sát Thủ",
      "Rival Reroll"
    ],
    "coreCarryChampionId": "DA_18_Rengar",
    "coreTankChampionId": "DA_Krug18",
    "coreChampionIds": [
      "DA_18_Rengar",
      "DA_18_KhaZix",
      "DA_Krug18",
      "DA_18_Hecarim"
    ],
    "flexChampionIds": [
      "DA_18_Aphelios",
      "DA_18_Warwick",
      "DA_Murkwolf18",
      "DA_Brambleback18"
    ],
    "keyTraitIds": [
      "DA_18_Rival",
      "DA_18_Ravager",
      "DA_Riftbeast18"
    ],
    "playstyle": "reroll",
    "requiredConditions": [
      "Slow roll ở cấp 7 nâng Rengar 3 sao và Kha'Zix 3 sao"
    ],
    "recommendedItems": {
      "DA_18_Rengar": [
        "Bloodthirster",
        "Infinity Edge",
        "Hand of Justice"
      ],
      "DA_18_KhaZix": [
        "Infinity Edge",
        "Edge of Night",
        "Last Whisper"
      ],
      "DA_Krug18": [
        "Sunfire Cape",
        "Warmog's Armor",
        "Dragon's Claw"
      ]
    },
    "defaultVariantId": "var_unrivaled_standard",
    "variants": [
      {
        "id": "var_unrivaled_standard",
        "archetypeId": "comp_rengar_assassin",
        "nameVi": "Khắc Tinh Sát Thủ Tiêu Chuẩn",
        "nameEn": "Standard Unrivaled Reroll",
        "conditionDescription": "Slow roll cấp 7 nâng Rengar và Kha'Zix lên 3 sao",
        "requiredItems": [
          "Bloodthirster"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Rengar",
            "nameVi": "Rengar",
            "cost": 3,
            "tier": 3,
            "items": [
              "Bloodthirster",
              "Infinity Edge",
              "Hand of Justice"
            ],
            "position": {
              "row": 1,
              "col": 2
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_KhaZix",
            "nameVi": "Kha'Zix",
            "cost": 3,
            "tier": 3,
            "items": [
              "Infinity Edge",
              "Edge of Night",
              "Last Whisper"
            ],
            "position": {
              "row": 1,
              "col": 4
            },
            "isCarry": true
          },
          {
            "championId": "DA_Krug18",
            "nameVi": "Quái Đá Krug",
            "cost": 3,
            "tier": 3,
            "items": [
              "Sunfire Cape",
              "Warmog's Armor",
              "Dragon's Claw"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Hecarim",
            "nameVi": "Hecarim",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Aphelios",
            "nameVi": "Aphelios",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 6
            }
          },
          {
            "championId": "DA_18_Warwick",
            "nameVi": "Warwick",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 1,
              "col": 3
            }
          },
          {
            "championId": "DA_Murkwolf18",
            "nameVi": "Sói Hắc Ám",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_Brambleback18",
            "nameVi": "Bụi Gai Đỏ",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 1
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_ashe_sniper",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Ashe Bắn Tỉa (Ashe Sniper)",
    "nameEn": "Ashe Sniper",
    "aliases": [
      "Ashe Sniper",
      "Sniper Ashe"
    ],
    "coreCarryChampionId": "TFT_Ashe",
    "coreTankChampionId": "TFT_Braum",
    "coreChampionIds": [
      "TFT_Ashe",
      "TFT_Braum"
    ],
    "flexChampionIds": [],
    "keyTraitIds": [
      "Sniper"
    ],
    "playstyle": "standard",
    "requiredConditions": [],
    "recommendedItems": {},
    "defaultVariantId": "default",
    "variants": [],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },

  {
    "id": "comp_tristana_gunner",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Liên Kích Bụi Gai (Trigger Happy - Bản 18.2)",
    "nameEn": "Trigger Happy (Aphelios & Maokai)",
    "aliases": [
      "Trigger Happy",
      "Aphelios Maokai",
      "Liên Kích Bụi Gai"
    ],
    "coreCarryChampionId": "DA_18_Aphelios",
    "coreTankChampionId": "DA_Brambleback18",
    "coreChampionIds": [
      "DA_18_Aphelios",
      "DA_18_Maokai",
      "DA_Brambleback18",
      "DA_18_Diana"
    ],
    "flexChampionIds": [
      "DA_18_Alune",
      "DA_Taric18",
      "DA_18_Leona",
      "DA_18_Varus"
    ],
    "keyTraitIds": [
      "DA_18_Rapidfire",
      "DA_18_Lunar",
      "DA_Riftbeast18"
    ],
    "playstyle": "fast8",
    "requiredConditions": [
      "Fast 8 mở khóa Maokai và kích mốc 4 Liên Kích cho Aphelios"
    ],
    "recommendedItems": {
      "DA_18_Aphelios": [
        "Guinsoo's Rageblade",
        "Infinity Edge",
        "Giant Slayer"
      ],
      "DA_Brambleback18": [
        "Warmog's Armor",
        "Dragon's Claw",
        "Bramble Vest"
      ],
      "DA_18_Maokai": [
        "Sunfire Cape",
        "Gargoyle Stoneplate"
      ]
    },
    "defaultVariantId": "var_trigger_happy_standard",
    "variants": [
      {
        "id": "var_trigger_happy_standard",
        "archetypeId": "comp_tristana_gunner",
        "nameVi": "Liên Kích Bụi Gai Tiêu Chuẩn",
        "nameEn": "Standard Trigger Happy",
        "conditionDescription": "Fast 8 hoàn thiện 4 Liên Kích, 3 Mặt Trăng, 2 Quái Rừng",
        "requiredItems": [
          "Guinsoo's Rageblade"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Aphelios",
            "nameVi": "Aphelios",
            "cost": 4,
            "tier": 2,
            "items": [
              "Guinsoo's Rageblade",
              "Infinity Edge",
              "Giant Slayer"
            ],
            "position": {
              "row": 3,
              "col": 6
            },
            "isCarry": true
          },
          {
            "championId": "DA_Brambleback18",
            "nameVi": "Bụi Gai Đỏ",
            "cost": 4,
            "tier": 2,
            "items": [
              "Warmog's Armor",
              "Dragon's Claw",
              "Bramble Vest"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Maokai",
            "nameVi": "Maokai",
            "cost": 5,
            "tier": 2,
            "items": [
              "Sunfire Cape"
            ],
            "position": {
              "row": 0,
              "col": 2
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Diana",
            "nameVi": "Diana",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_18_Alune",
            "nameVi": "Alune",
            "cost": 5,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 1
            }
          },
          {
            "championId": "DA_Taric18",
            "nameVi": "Taric",
            "cost": 5,
            "tier": 2,
            "items": [],
            "position": {
              "row": 1,
              "col": 3
            }
          },
          {
            "championId": "DA_18_Leona",
            "nameVi": "Leona",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 1
            }
          },
          {
            "championId": "DA_18_Varus",
            "nameVi": "Varus",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 5
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_draven_reroll",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Draven Săn Thưởng & Rồng Ngàn Tuổi (Bản 18.2)",
    "nameEn": "Bounty Seeker Draven & Apex Dragon Fast 9",
    "aliases": [
      "Draven 5 vàng",
      "Draven Săn Thưởng",
      "Fast 9 Draven",
      "Exotics Draven"
    ],
    "coreCarryChampionId": "DA_Draven18",
    "coreTankChampionId": "DA_Taric18",
    "coreChampionIds": [
      "DA_Draven18",
      "DA_Taric18",
      "DA_18_Hecarim",
      "DA_Sentinel18"
    ],
    "flexChampionIds": [
      "DA_18_ElderDragon",
      "DA_Brambleback18",
      "DA_18_Maokai",
      "DA_18_Ashe"
    ],
    "keyTraitIds": [
      "DA_DravenUniqueTrait18",
      "DA_18_Vanguard",
      "DA_18_ApexPredator"
    ],
    "playstyle": "fast8",
    "requiredConditions": [
      "Giữ máu lên cấp 9 mở khóa Draven 5 vàng và Rồng Ngàn Tuổi"
    ],
    "recommendedItems": {
      "DA_Draven18": [
        "Guinsoo's Rageblade",
        "Infinity Edge",
        "Bloodthirster"
      ],
      "DA_Taric18": [
        "Warmog's Armor",
        "Dragon's Claw",
        "Bramble Vest"
      ],
      "DA_18_ElderDragon": [
        "Bloodthirster",
        "Titan's Resolve"
      ]
    },
    "defaultVariantId": "var_draven_bounty_standard",
    "variants": [
      {
        "id": "var_draven_bounty_standard",
        "archetypeId": "comp_draven_reroll",
        "nameVi": "Draven Săn Thưởng Fast 9",
        "nameEn": "Standard Fast 9 Draven",
        "conditionDescription": "Tập hợp các vị tướng 5 vàng đắt giá xoay quanh Draven gánh đội",
        "requiredItems": [
          "Guinsoo's Rageblade"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_Draven18",
            "nameVi": "Draven",
            "cost": 5,
            "tier": 2,
            "items": [
              "Guinsoo's Rageblade",
              "Infinity Edge",
              "Bloodthirster"
            ],
            "position": {
              "row": 3,
              "col": 6
            },
            "isCarry": true
          },
          {
            "championId": "DA_Taric18",
            "nameVi": "Taric",
            "cost": 5,
            "tier": 2,
            "items": [
              "Warmog's Armor",
              "Dragon's Claw",
              "Bramble Vest"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_ElderDragon",
            "nameVi": "Rồng Ngàn Tuổi",
            "cost": 5,
            "tier": 2,
            "items": [
              "Bloodthirster",
              "Titan's Resolve"
            ],
            "position": {
              "row": 3,
              "col": 4
            },
            "isCarry": true
          },
          {
            "championId": "DA_Sentinel18",
            "nameVi": "Người Đá",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Maokai",
            "nameVi": "Maokai",
            "cost": 5,
            "tier": 2,
            "items": [
              "Sunfire Cape"
            ],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_Brambleback18",
            "nameVi": "Bụi Gai Đỏ",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 1,
              "col": 3
            }
          },
          {
            "championId": "DA_18_Ivern",
            "nameVi": "Ivern",
            "cost": 5,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 4
            }
          },
          {
            "championId": "DA_18_Ashe",
            "nameVi": "Ashe",
            "cost": 5,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 1
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_teemo_yordle",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Yunara & Alistar Thần Chú Reroll (Bản 18.2)",
    "nameEn": "Yunara & Alistar Invoker Reroll",
    "aliases": [
      "Yunara Alistar",
      "Thần Chú Reroll",
      "Yunara Hoa Linh"
    ],
    "coreCarryChampionId": "DA_18_Yunara",
    "coreTankChampionId": "DA_18_Alistar",
    "coreChampionIds": [
      "DA_18_Yunara",
      "DA_18_Alistar",
      "DA_18_Ahri",
      "DA_18_Sett"
    ],
    "flexChampionIds": [
      "DA_Karma18",
      "DA_18_Kobuko",
      "DA_18_Teemo",
      "DA_18_Tristana"
    ],
    "keyTraitIds": [
      "DA_18_Blossom",
      "DA_18_Invoker",
      "DA_18_Brawler"
    ],
    "playstyle": "reroll",
    "requiredConditions": [
      "Slow roll cấp 6 kiếm Yunara 3 sao và Alistar 3 sao (Được buff mạnh ở bản 18.2)"
    ],
    "recommendedItems": {
      "DA_18_Yunara": [
        "Blue Buff",
        "Jeweled Gauntlet",
        "Spear of Shojin"
      ],
      "DA_18_Alistar": [
        "Gargoyle Stoneplate",
        "Warmog's Armor",
        "Sunfire Cape"
      ]
    },
    "defaultVariantId": "var_yunara_invoker_standard",
    "variants": [
      {
        "id": "var_yunara_invoker_standard",
        "archetypeId": "comp_teemo_yordle",
        "nameVi": "Yunara Thần Chú Tiêu Chuẩn",
        "nameEn": "Standard Yunara Invoker",
        "conditionDescription": "Slow roll cấp 6 hoàn thiện Yunara 3 sao và Alistar 3 sao",
        "requiredItems": [
          "Blue Buff"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Yunara",
            "nameVi": "Yunara",
            "cost": 2,
            "tier": 3,
            "items": [
              "Blue Buff",
              "Jeweled Gauntlet",
              "Spear of Shojin"
            ],
            "position": {
              "row": 3,
              "col": 6
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Alistar",
            "nameVi": "Alistar",
            "cost": 2,
            "tier": 3,
            "items": [
              "Gargoyle Stoneplate",
              "Warmog's Armor",
              "Sunfire Cape"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Sett",
            "nameVi": "Sett",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Ahri",
            "nameVi": "Ahri",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 5
            }
          },
          {
            "championId": "DA_Karma18",
            "nameVi": "Karma",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 6
            }
          },
          {
            "championId": "DA_18_Kobuko",
            "nameVi": "Kobuko",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_18_Teemo",
            "nameVi": "Teemo",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 1
            }
          },
          {
            "championId": "DA_18_Tristana",
            "nameVi": "Tristana",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 5
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_weave_got_this",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Thuật Sư Huyền Bí (Weave Got This - Bản 18.2)",
    "nameEn": "Weave Got This (Alune & Ahri Spellweaver)",
    "aliases": [
      "Weave Got This",
      "Alune Ahri",
      "Thuật Sư Huyền Bí",
      "Spellweaver Fast 8"
    ],
    "coreCarryChampionId": "DA_18_Alune",
    "coreTankChampionId": "DA_18_Lillia",
    "coreChampionIds": [
      "DA_18_Alune",
      "DA_18_Ahri",
      "DA_18_Lillia",
      "DA_18_Morgana"
    ],
    "flexChampionIds": [
      "DA_18_Cassiopeia",
      "DA_18_Sett",
      "DA_18_LeBlanc",
      "DA_18_Elise"
    ],
    "keyTraitIds": [
      "DA_18_Spellweaver",
      "DA_18_Lunar",
      "DA_18_Coven"
    ],
    "playstyle": "fast8",
    "requiredConditions": [
      "Fast 8 mở khóa Alune 2 sao kết hợp Ahri kích mốc cao Thuật Sư"
    ],
    "recommendedItems": {
      "DA_18_Alune": [
        "Spear of Shojin",
        "Jeweled Gauntlet",
        "Rabadon's Deathcap"
      ],
      "DA_18_Lillia": [
        "Warmog's Armor",
        "Dragon's Claw",
        "Bramble Vest"
      ],
      "DA_18_Ahri": [
        "Blue Buff",
        "Morellonomicon"
      ]
    },
    "defaultVariantId": "var_weave_got_this_standard",
    "variants": [
      {
        "id": "var_weave_got_this_standard",
        "archetypeId": "comp_weave_got_this",
        "nameVi": "Thuật Sư Huyền Bí Tiêu Chuẩn",
        "nameEn": "Standard Weave Got This",
        "conditionDescription": "Fast 8 hoàn thiện 6 Thuật Sư, 3 Mặt Trăng, 2 Tiên Hắc Ám",
        "requiredItems": [
          "Spear of Shojin"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Alune",
            "nameVi": "Alune",
            "cost": 5,
            "tier": 2,
            "items": [
              "Spear of Shojin",
              "Jeweled Gauntlet",
              "Rabadon's Deathcap"
            ],
            "position": {
              "row": 3,
              "col": 6
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Lillia",
            "nameVi": "Lillia",
            "cost": 4,
            "tier": 2,
            "items": [
              "Warmog's Armor",
              "Dragon's Claw",
              "Bramble Vest"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Ahri",
            "nameVi": "Ahri",
            "cost": 4,
            "tier": 2,
            "items": [
              "Blue Buff",
              "Morellonomicon"
            ],
            "position": {
              "row": 3,
              "col": 5
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Morgana",
            "nameVi": "Morgana",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 5
            }
          },
          {
            "championId": "DA_18_Cassiopeia",
            "nameVi": "Cassiopeia",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 4
            }
          },
          {
            "championId": "DA_18_Sett",
            "nameVi": "Sett",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_LeBlanc",
            "nameVi": "LeBlanc",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 1,
              "col": 3
            }
          },
          {
            "championId": "DA_18_Elise",
            "nameVi": "Elise",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_masteryi_duelist",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Kiếm Khách Hoa Linh (Blossom Master Yi & Vi - Bản 18.2)",
    "nameEn": "Blossom Master Yi & Vi (Dueling Blades)",
    "aliases": [
      "Blossom Master Yi",
      "Master Yi Vi",
      "Dueling Blades",
      "Hoa Linh Kiếm Khách",
      "Master Yi Blademaster"
    ],
    "coreCarryChampionId": "DA_18_MasterYi_AD",
    "coreTankChampionId": "DA_Vi18",
    "coreChampionIds": [
      "DA_18_MasterYi_AD",
      "DA_Vi18",
      "DA_18_Yorick",
      "DA_Krug18",
      "DA_18_Rengar"
    ],
    "flexChampionIds": [
      "DA_18_Sett",
      "DA_Nidalee18_AP",
      "DA_KogMaw18_AD"
    ],
    "keyTraitIds": [
      "DA_18_Blossom",
      "DA_18_Duelist"
    ],
    "playstyle": "reroll",
    "requiredConditions": [
      "Slow roll ở cấp 6 để bắt Master Yi 3 sao và Vi 3 sao"
    ],
    "recommendedItems": {
      "DA_18_MasterYi_AD": [
        "Infinity Edge",
        "Last Whisper",
        "Bloodthirster"
      ],
      "DA_Vi18": [
        "Warmog's Armor",
        "Dragon's Claw",
        "Bramble Vest"
      ]
    },
    "defaultVariantId": "var_blossom_masteryi_standard",
    "variants": [
      {
        "id": "var_blossom_masteryi_standard",
        "archetypeId": "comp_masteryi_duelist",
        "nameVi": "Kiếm Khách Hoa Linh Tiêu Chuẩn",
        "nameEn": "Standard Blossom Master Yi & Vi",
        "conditionDescription": "Slow roll cấp 6 hoàn thiện Master Yi & Vi 3 sao kích hoạt Hoa Linh",
        "requiredItems": [
          "Infinity Edge"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_MasterYi_AD",
            "nameVi": "Master Yi",
            "cost": 3,
            "tier": 3,
            "items": [
              "Infinity Edge",
              "Last Whisper",
              "Bloodthirster"
            ],
            "position": {
              "row": 3,
              "col": 4
            },
            "isCarry": true
          },
          {
            "championId": "DA_Vi18",
            "nameVi": "Vi",
            "cost": 2,
            "tier": 3,
            "items": [
              "Warmog's Armor",
              "Dragon's Claw",
              "Bramble Vest"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Yorick",
            "nameVi": "Yorick",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_Krug18",
            "nameVi": "Krug",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Rengar",
            "nameVi": "Rengar",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 2
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_dragon_princess",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Rồng Tối Thượng Fast 9 (Elder Dragon Fast 9 — Dragon 9)",
    "nameEn": "Elder Dragon Fast 9 — Dragon 9",
    "aliases": [
      "Dragon 9",
      "Elder Dragon Fast 9",
      "Dragon Princess",
      "Rồng 9",
      "Fast 9 Rồng"
    ],
    "coreCarryChampionId": "DA_18_ElderDragon",
    "coreTankChampionId": "DA_Taric18",
    "coreChampionIds": [
      "DA_18_ElderDragon",
      "DA_Taric18",
      "DA_Draven18",
      "DA_18_Sett"
    ],
    "flexChampionIds": [
      "DA_18_Ezreal",
      "DA_18_Ornn",
      "DA_18_Ahri",
      "DA_18_Kobuko"
    ],
    "keyTraitIds": [
      "DA_18_ApexPredator",
      "DA_18_Vanguard"
    ],
    "playstyle": "fast9",
    "requiredConditions": [
      "Cần nâng cấp lên cấp 9 để hoàn thiện form Rồng 9 xoay quanh Rồng Ngàn Tuổi 2 sao"
    ],
    "recommendedItems": {
      "DA_18_ElderDragon": [
        "Bloodthirster",
        "Titan's Resolve",
        "Infinity Edge"
      ],
      "DA_Taric18": [
        "Warmog's Armor",
        "Dragon's Claw",
        "Bramble Vest"
      ],
      "DA_Draven18": [
        "Guinsoo's Rageblade",
        "Last Whisper"
      ]
    },
    "defaultVariantId": "var_elder_dragon_fast9",
    "variants": [
      {
        "id": "var_elder_dragon_fast9",
        "archetypeId": "comp_dragon_princess",
        "nameVi": "Rồng Tối Thượng Fast 9 Tiêu Chuẩn",
        "nameEn": "Standard Elder Dragon Fast 9",
        "conditionDescription": "Lên cấp 9 hoàn thiện form Rồng 9",
        "requiredItems": [
          "Bloodthirster"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_ElderDragon",
            "nameVi": "Rồng Ngàn Tuổi",
            "cost": 5,
            "tier": 2,
            "items": [
              "Bloodthirster",
              "Titan's Resolve",
              "Infinity Edge"
            ],
            "position": {
              "row": 3,
              "col": 4
            },
            "isCarry": true
          },
          {
            "championId": "DA_Taric18",
            "nameVi": "Taric",
            "cost": 5,
            "tier": 2,
            "items": [
              "Warmog's Armor",
              "Dragon's Claw",
              "Bramble Vest"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_Draven18",
            "nameVi": "Draven",
            "cost": 5,
            "tier": 2,
            "items": [
              "Guinsoo's Rageblade",
              "Last Whisper"
            ],
            "position": {
              "row": 3,
              "col": 6
            }
          },
          {
            "championId": "DA_18_Sett",
            "nameVi": "Sett",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Ornn",
            "nameVi": "Ornn",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_18_Ezreal",
            "nameVi": "Ezreal",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 0
            }
          },
          {
            "championId": "DA_18_Ahri",
            "nameVi": "Ahri",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 1
            }
          },
          {
            "championId": "DA_18_Kobuko",
            "nameVi": "Kobuko",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 5
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_ahri_morgana",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Thần Chú Thuật Sư (Invoker Ahri — Ahri Morgana)",
    "nameEn": "Invoker Ahri & Morgana",
    "aliases": [
      "Ahri Morgana",
      "Invoker Ahri",
      "Thuật Sư Thần Chú"
    ],
    "coreCarryChampionId": "DA_18_Ahri",
    "coreTankChampionId": "DA_18_Morgana",
    "coreChampionIds": [
      "DA_18_Ahri",
      "DA_18_Morgana",
      "DA_18_Sett",
      "DA_18_Yunara"
    ],
    "flexChampionIds": [
      "DA_18_Kobuko",
      "DA_18_Alistar",
      "DA_Taric18",
      "DA_Karma18"
    ],
    "keyTraitIds": [
      "DA_18_Invoker",
      "DA_18_Spellweaver",
      "DA_18_Blossom"
    ],
    "playstyle": "fast8",
    "requiredConditions": [
      "Kích hoạt Thần Chú / Thuật Sư cho Ahri và Morgana làm cặp chủ lực - chống chịu"
    ],
    "recommendedItems": {
      "DA_18_Ahri": [
        "Blue Buff",
        "Jeweled Gauntlet",
        "Rabadon's Deathcap"
      ],
      "DA_18_Morgana": [
        "Warmog's Armor",
        "Dragon's Claw",
        "Sunfire Cape"
      ]
    },
    "defaultVariantId": "var_ahri_morgana_invoker",
    "variants": [
      {
        "id": "var_ahri_morgana_invoker",
        "archetypeId": "comp_ahri_morgana",
        "nameVi": "Thần Chú Thuật Sư Tiêu Chuẩn",
        "nameEn": "Standard Invoker Ahri & Morgana",
        "conditionDescription": "Kích hoạt 4 Thần Chú, 4 Thuật Sư",
        "requiredItems": [
          "Blue Buff"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Ahri",
            "nameVi": "Ahri",
            "cost": 4,
            "tier": 2,
            "items": [
              "Blue Buff",
              "Jeweled Gauntlet",
              "Rabadon's Deathcap"
            ],
            "position": {
              "row": 3,
              "col": 5
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Morgana",
            "nameVi": "Morgana",
            "cost": 4,
            "tier": 2,
            "items": [
              "Warmog's Armor",
              "Dragon's Claw",
              "Sunfire Cape"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Sett",
            "nameVi": "Sett",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Yunara",
            "nameVi": "Yunara",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 4
            }
          },
          {
            "championId": "DA_18_Alistar",
            "nameVi": "Alistar",
            "cost": 2,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_Karma18",
            "nameVi": "Karma",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 2,
              "col": 6
            }
          },
          {
            "championId": "DA_18_Kobuko",
            "nameVi": "Kobuko",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 1
            }
          },
          {
            "championId": "DA_Taric18",
            "nameVi": "Taric",
            "cost": 5,
            "tier": 1,
            "items": [],
            "position": {
              "row": 0,
              "col": 5
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
  {
    "id": "comp_blossom_fast9",
    "setNumber": 18,
    "gameProduct": "tft",
    "mode": "ranked_standard",
    "nameVi": "Hoa Linh Fast 9 (Blossom Ashe — Blossom Fast 9)",
    "nameEn": "Blossom Ashe & Blossom Fast 9",
    "aliases": [
      "Blossom Fast 9",
      "Blossom Ashe",
      "Hoa Linh Fast 9"
    ],
    "coreCarryChampionId": "DA_18_Ashe",
    "coreTankChampionId": "DA_18_Sett",
    "coreChampionIds": [
      "DA_18_Ashe",
      "DA_18_Sett",
      "DA_18_Ahri",
      "DA_18_Yunara"
    ],
    "flexChampionIds": [
      "DA_Taric18",
      "DA_18_Ornn",
      "DA_18_Kobuko",
      "DA_18_ElderDragon"
    ],
    "keyTraitIds": [
      "DA_18_Blossom",
      "DA_18_Brawler",
      "DA_18_Sniper"
    ],
    "playstyle": "fast9",
    "requiredConditions": [
      "Lên cấp 9 kết hợp mốc Hoa Linh cao cấp xoay quanh Ashe và Sett"
    ],
    "recommendedItems": {
      "DA_18_Ashe": [
        "Guinsoo's Rageblade",
        "Infinity Edge",
        "Last Whisper"
      ],
      "DA_18_Sett": [
        "Warmog's Armor",
        "Dragon's Claw",
        "Bramble Vest"
      ]
    },
    "defaultVariantId": "var_blossom_fast9_standard",
    "variants": [
      {
        "id": "var_blossom_fast9_standard",
        "archetypeId": "comp_blossom_fast9",
        "nameVi": "Hoa Linh Fast 9 Tiêu Chuẩn",
        "nameEn": "Standard Blossom Fast 9",
        "conditionDescription": "Lên cấp 9 kích hoạt mốc Hoa Linh cao cấp",
        "requiredItems": [
          "Guinsoo's Rageblade"
        ],
        "requiredAugments": [],
        "requiredEmblems": [],
        "substituteChampionIds": [],
        "recommendedBoard": [
          {
            "championId": "DA_18_Ashe",
            "nameVi": "Ashe",
            "cost": 4,
            "tier": 2,
            "items": [
              "Guinsoo's Rageblade",
              "Infinity Edge",
              "Last Whisper"
            ],
            "position": {
              "row": 3,
              "col": 6
            },
            "isCarry": true
          },
          {
            "championId": "DA_18_Sett",
            "nameVi": "Sett",
            "cost": 4,
            "tier": 2,
            "items": [
              "Warmog's Armor",
              "Dragon's Claw",
              "Bramble Vest"
            ],
            "position": {
              "row": 0,
              "col": 3
            },
            "isTank": true
          },
          {
            "championId": "DA_18_Ahri",
            "nameVi": "Ahri",
            "cost": 4,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 5
            }
          },
          {
            "championId": "DA_18_Yunara",
            "nameVi": "Yunara",
            "cost": 3,
            "tier": 2,
            "items": [],
            "position": {
              "row": 3,
              "col": 4
            }
          },
          {
            "championId": "DA_Taric18",
            "nameVi": "Taric",
            "cost": 5,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 2
            }
          },
          {
            "championId": "DA_18_Ornn",
            "nameVi": "Ornn",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 4
            }
          },
          {
            "championId": "DA_18_Kobuko",
            "nameVi": "Kobuko",
            "cost": 1,
            "tier": 2,
            "items": [],
            "position": {
              "row": 0,
              "col": 1
            }
          },
          {
            "championId": "DA_18_ElderDragon",
            "nameVi": "Rồng Ngàn Tuổi",
            "cost": 5,
            "tier": 1,
            "items": [],
            "position": {
              "row": 2,
              "col": 0
            }
          }
        ]
      }
    ],
    "mappingVersion": "1.0.0",
    "classifierVersion": "1.0.0"
  },
{
  "id": "comp_aphelios_elderwood",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Aphelios Thần Rừng",
  "nameEn": "Aphelios Elderwood",
  "aliases": [
    "Aphelios Thần Rừng",
    "Elderwood Aphelios"
  ],
  "coreCarryChampionId": "DA_18_Aphelios",
  "coreTankChampionId": "DA_18_Ornn",
  "coreChampionIds": [
    "DA_18_Aphelios",
    "DA_18_Lillia",
    "DA_18_Hecarim",
    "DA_18_Ornn",
    "DA_18_Diana"
  ],
  "flexChampionIds": [
    "DA_18_Alistar",
    "DA_18_Xayah",
    "DA_18_GnarSmall"
  ],
  "keyTraitIds": [
    "DA_18_Elderwood"
  ],
  "playstyle": "standard",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_aphelios_elderwood_default",
  "variants": [
    {
      "id": "var_aphelios_elderwood_default",
      "archetypeId": "comp_aphelios_elderwood",
      "nameVi": "Aphelios Thần Rừng Tiêu Chuẩn",
      "nameEn": "Standard Aphelios Elderwood",
      "conditionDescription": "Kích 4 Thần Rừng, 2 Can Trường",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_aphelios_vanguard",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Aphelios Tiên Phong",
  "nameEn": "Aphelios Vanguard",
  "aliases": [
    "Aphelios Tiên Phong",
    "Vanguard Aphelios"
  ],
  "coreCarryChampionId": "DA_18_Aphelios",
  "coreTankChampionId": "DA_Sentinel18",
  "coreChampionIds": [
    "DA_18_Aphelios",
    "DA_Sentinel18",
    "DA_Amumu18",
    "DA_18_Diana",
    "DA_Vi18"
  ],
  "flexChampionIds": [
    "DA_Nidalee18_AP",
    "DA_KogMaw18_AD",
    "DA_18_Varus"
  ],
  "keyTraitIds": [
    "DA_18_Vanguard"
  ],
  "playstyle": "standard",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_aphelios_vanguard_default",
  "variants": [
    {
      "id": "var_aphelios_vanguard_default",
      "archetypeId": "comp_aphelios_vanguard",
      "nameVi": "Aphelios Tiên Phong Tiêu Chuẩn",
      "nameEn": "Standard Aphelios Vanguard",
      "conditionDescription": "Kích 4 Tiên Phong, 2 Xạ Thủ",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_cassiopeia_reroll",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Cassiopeia Reroll",
  "nameEn": "Cassiopeia Reroll",
  "aliases": [
    "Cassiopeia Reroll",
    "Rammus Cassiopeia"
  ],
  "coreCarryChampionId": "DA_18_Cassiopeia",
  "coreTankChampionId": "DA_18_Rammus",
  "coreChampionIds": [
    "DA_18_Cassiopeia",
    "DA_18_Rammus",
    "DA_Fiddlesticks18",
    "DA_18_Ornn",
    "DA_18_Leona"
  ],
  "flexChampionIds": [
    "DA_18_Shen",
    "DA_18_Lillia"
  ],
  "keyTraitIds": [],
  "playstyle": "reroll",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_cassiopeia_reroll_default",
  "variants": [
    {
      "id": "var_cassiopeia_reroll_default",
      "archetypeId": "comp_cassiopeia_reroll",
      "nameVi": "Cassiopeia Reroll Tiêu Chuẩn",
      "nameEn": "Standard Cassiopeia Reroll",
      "conditionDescription": "Slow roll cấp 6/7 kiếm Cassiopeia 3 sao",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_kayle_reroll",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Kayle Reroll",
  "nameEn": "Kayle Reroll",
  "aliases": [
    "Kayle Reroll",
    "Kayle Sejuani"
  ],
  "coreCarryChampionId": "DA_18_Kayle",
  "coreTankChampionId": "DA_18_Ornn",
  "coreChampionIds": [
    "DA_18_Kayle",
    "DA_18_Ornn",
    "DA_18_Rakan",
    "DA_18_Leona",
    "DA_18_Sejuani"
  ],
  "flexChampionIds": [
    "DA_18_Xayah",
    "DA_18_LeBlanc"
  ],
  "keyTraitIds": [],
  "playstyle": "reroll",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_kayle_reroll_default",
  "variants": [
    {
      "id": "var_kayle_reroll_default",
      "archetypeId": "comp_kayle_reroll",
      "nameVi": "Kayle Reroll Tiêu Chuẩn",
      "nameEn": "Standard Kayle Reroll",
      "conditionDescription": "Slow roll cấp 6 bắt Kayle 3 sao",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_khazik_reroll",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Kha'Zix Reroll",
  "nameEn": "Kha'Zix Reroll",
  "aliases": [
    "Khazik Reroll",
    "Kha'Zix Reroll",
    "Kha'Zix Sát Thủ"
  ],
  "coreCarryChampionId": "DA_18_KhaZix",
  "coreTankChampionId": "DA_18_Hecarim",
  "coreChampionIds": [
    "DA_18_KhaZix",
    "DA_Fiddlesticks18",
    "DA_18_Diana",
    "DA_18_Hecarim",
    "DA_18_Ornn"
  ],
  "flexChampionIds": [
    "DA_18_Ezreal",
    "DA_18_Soraka"
  ],
  "keyTraitIds": [],
  "playstyle": "reroll",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_khazik_reroll_default",
  "variants": [
    {
      "id": "var_khazik_reroll_default",
      "archetypeId": "comp_khazik_reroll",
      "nameVi": "Kha'Zix Reroll Tiêu Chuẩn",
      "nameEn": "Standard Kha'Zix Reroll",
      "conditionDescription": "Slow roll cấp 7 bắt Kha'Zix 3 sao",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_morgana_flex",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Morgana Flex",
  "nameEn": "Morgana Flex",
  "aliases": [
    "Morgana Flex",
    "Morgana Thuật Sĩ"
  ],
  "coreCarryChampionId": "DA_18_Morgana",
  "coreTankChampionId": "DA_Taric18",
  "coreChampionIds": [
    "DA_18_Morgana",
    "DA_Taric18",
    "DA_Krug18",
    "DA_Sentinel18",
    "DA_18_Sett"
  ],
  "flexChampionIds": [
    "DA_18_Sentry",
    "DA_18_Ahri",
    "DA_Karma18"
  ],
  "keyTraitIds": [],
  "playstyle": "standard",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_morgana_flex_default",
  "variants": [
    {
      "id": "var_morgana_flex_default",
      "archetypeId": "comp_morgana_flex",
      "nameVi": "Morgana Flex Tiêu Chuẩn",
      "nameEn": "Standard Morgana Flex",
      "conditionDescription": "Lên cấp 8 kẹp Morgana và dàn chắn vững",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_morgana_nidalee",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Morgana Nidalee",
  "nameEn": "Morgana Nidalee",
  "aliases": [
    "Morgana Nidalee",
    "Nidalee Morgana"
  ],
  "coreCarryChampionId": "DA_Nidalee18_AP",
  "coreTankChampionId": "DA_Sentinel18",
  "coreChampionIds": [
    "DA_Nidalee18_AP",
    "DA_18_Morgana",
    "DA_18_Hecarim",
    "DA_Scuttlecrab18",
    "DA_Sentinel18"
  ],
  "flexChampionIds": [
    "DA_Vi18",
    "DA_18_Sentry",
    "DA_KogMaw18_AD"
  ],
  "keyTraitIds": [],
  "playstyle": "standard",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_morgana_nidalee_default",
  "variants": [
    {
      "id": "var_morgana_nidalee_default",
      "archetypeId": "comp_morgana_nidalee",
      "nameVi": "Morgana Nidalee Tiêu Chuẩn",
      "nameEn": "Standard Morgana Nidalee",
      "conditionDescription": "Lên cấp 8 kết hợp Nidalee carry phép và Morgana khống chế",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_riftbeast_tempo",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Riftbeast Tempo",
  "nameEn": "Riftbeast Tempo",
  "aliases": [
    "Riftbeast Tempo",
    "Thú Hư Không",
    "Riftbeast"
  ],
  "coreCarryChampionId": "DA_Scuttlecrab18",
  "coreTankChampionId": "DA_Sentinel18",
  "coreChampionIds": [
    "DA_Scuttlecrab18",
    "DA_Krug18",
    "DA_Brambleback18",
    "DA_Murkwolf18",
    "DA_Sentinel18"
  ],
  "flexChampionIds": [
    "DA_18_Sentry",
    "DA_Cinderling18"
  ],
  "keyTraitIds": [],
  "playstyle": "flex",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_riftbeast_tempo_default",
  "variants": [
    {
      "id": "var_riftbeast_tempo_default",
      "archetypeId": "comp_riftbeast_tempo",
      "nameVi": "Riftbeast Tempo Tiêu Chuẩn",
      "nameEn": "Standard Riftbeast Tempo",
      "conditionDescription": "Kích tối đa tộc Thú Hư Không giữ máu lấy chuỗi thắng",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_sivir_nidalee",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Sivir Nidalee",
  "nameEn": "Sivir Nidalee",
  "aliases": [
    "Sivir Nidalee",
    "Nidalee Sivir"
  ],
  "coreCarryChampionId": "DA_18_Sivir",
  "coreTankChampionId": "DA_18_Malphite",
  "coreChampionIds": [
    "DA_18_Sivir",
    "DA_Nidalee18_AP",
    "DA_18_Malphite",
    "DA_Sentinel18",
    "DA_18_RekSai"
  ],
  "flexChampionIds": [
    "DA_Krug18",
    "DA_KogMaw18_AD",
    "DA_Cinderling18"
  ],
  "keyTraitIds": [],
  "playstyle": "reroll",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_sivir_nidalee_default",
  "variants": [
    {
      "id": "var_sivir_nidalee_default",
      "archetypeId": "comp_sivir_nidalee",
      "nameVi": "Sivir Nidalee Tiêu Chuẩn",
      "nameEn": "Standard Sivir Nidalee",
      "conditionDescription": "Reroll Sivir và Nidalee 3 sao",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_soraka_zyra",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Soraka Zyra",
  "nameEn": "Soraka Zyra",
  "aliases": [
    "Soraka Zyra",
    "Zyra Soraka"
  ],
  "coreCarryChampionId": "DA_18_Soraka",
  "coreTankChampionId": "DA_18_Malphite",
  "coreChampionIds": [
    "DA_18_Soraka",
    "DA_18_Zyra",
    "DA_18_Malphite",
    "DA_Amumu18",
    "DA_Fiddlesticks18"
  ],
  "flexChampionIds": [
    "DA_18_Kennen",
    "DA_18_Yorick",
    "DA_18_Azir"
  ],
  "keyTraitIds": [],
  "playstyle": "reroll",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_soraka_zyra_default",
  "variants": [
    {
      "id": "var_soraka_zyra_default",
      "archetypeId": "comp_soraka_zyra",
      "nameVi": "Soraka Zyra Tiêu Chuẩn",
      "nameEn": "Standard Soraka Zyra",
      "conditionDescription": "Reroll Soraka và Zyra làm nguồn sát thương phép",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_veigar_reroll",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Veigar Reroll",
  "nameEn": "Veigar Reroll",
  "aliases": [
    "Veigar Reroll",
    "Veigar Pháp Sư"
  ],
  "coreCarryChampionId": "DA_18_Veigar",
  "coreTankChampionId": "DA_18_Ornn",
  "coreChampionIds": [
    "DA_18_Veigar",
    "DA_18_Ornn",
    "DA_18_RekSai",
    "DA_18_Alistar",
    "DA_18_LeBlanc"
  ],
  "flexChampionIds": [
    "DA_Fiddlesticks18",
    "DA_18_Cassiopeia"
  ],
  "keyTraitIds": [],
  "playstyle": "reroll",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_veigar_reroll_default",
  "variants": [
    {
      "id": "var_veigar_reroll_default",
      "archetypeId": "comp_veigar_reroll",
      "nameVi": "Veigar Reroll Tiêu Chuẩn",
      "nameEn": "Standard Veigar Reroll",
      "conditionDescription": "Slow roll cấp 7 bắt Veigar 3 sao",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_yunara_reroll",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Yunara Reroll",
  "nameEn": "Yunara Reroll",
  "aliases": [
    "Yunara Reroll",
    "Yunara Sejuani"
  ],
  "coreCarryChampionId": "DA_18_Yunara",
  "coreTankChampionId": "DA_18_Sejuani",
  "coreChampionIds": [
    "DA_18_Yunara",
    "DA_18_Sejuani",
    "DA_18_Yorick",
    "DA_Karma18",
    "DA_18_LeBlanc"
  ],
  "flexChampionIds": [
    "DA_18_Azir",
    "DA_18_Sett"
  ],
  "keyTraitIds": [],
  "playstyle": "reroll",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_yunara_reroll_default",
  "variants": [
    {
      "id": "var_yunara_reroll_default",
      "archetypeId": "comp_yunara_reroll",
      "nameVi": "Yunara Reroll Tiêu Chuẩn",
      "nameEn": "Standard Yunara Reroll",
      "conditionDescription": "Reroll cấp 7 hoàn thiện Yunara 3 sao",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_fast9_alune",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Fast 9 Alune AP",
  "nameEn": "Fast 9 Alune AP",
  "aliases": [
    "Fast 9 Alune AP",
    "Alune Fast 9"
  ],
  "coreCarryChampionId": "DA_18_Alune",
  "coreTankChampionId": "DA_Taric18",
  "coreChampionIds": [
    "DA_18_Alune",
    "DA_Taric18",
    "DA_Amumu18",
    "DA_18_Maokai",
    "DA_18_Diana"
  ],
  "flexChampionIds": [
    "DA_18_Lillia",
    "DA_Fiddlesticks18",
    "DA_18_Kennen",
    "DA_Lux18_Base",
    "DA_18_Ivern"
  ],
  "keyTraitIds": [],
  "playstyle": "fast9",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_fast9_alune_default",
  "variants": [
    {
      "id": "var_fast9_alune_default",
      "archetypeId": "comp_fast9_alune",
      "nameVi": "Fast 9 Alune Tiêu Chuẩn",
      "nameEn": "Standard Fast 9 Alune",
      "conditionDescription": "Lên cấp 9 kẹp tướng huyền thoại và Alune 2 sao đồ chuẩn",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_fast9_ashe",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Fast 9 Ashe AD",
  "nameEn": "Fast 9 Ashe AD",
  "aliases": [
    "Fast 9 Ashe AD",
    "Ashe Fast 9"
  ],
  "coreCarryChampionId": "DA_18_Ashe",
  "coreTankChampionId": "DA_18_Maokai",
  "coreChampionIds": [
    "DA_18_Ashe",
    "DA_18_Maokai",
    "DA_Taric18",
    "DA_Vi18",
    "DA_Amumu18"
  ],
  "flexChampionIds": [
    "DA_18_Kennen",
    "DA_18_Rakan",
    "DA_18_Ivern",
    "DA_18_Sivir"
  ],
  "keyTraitIds": [],
  "playstyle": "fast9",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_fast9_ashe_default",
  "variants": [
    {
      "id": "var_fast9_ashe_default",
      "archetypeId": "comp_fast9_ashe",
      "nameVi": "Fast 9 Ashe Tiêu Chuẩn",
      "nameEn": "Standard Fast 9 Ashe",
      "conditionDescription": "Lên cấp 9 hoàn thiện dàn tướng 5 vàng và Ashe carry",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_fast9_draven",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Fast 9 Draven AD",
  "nameEn": "Fast 9 Draven AD",
  "aliases": [
    "Fast 9 Draven AD",
    "Draven Fast 9"
  ],
  "coreCarryChampionId": "DA_Draven18",
  "coreTankChampionId": "DA_Taric18",
  "coreChampionIds": [
    "DA_Draven18",
    "DA_Taric18",
    "DA_18_Maokai",
    "DA_18_Ezreal",
    "DA_Amumu18"
  ],
  "flexChampionIds": [
    "DA_18_Kennen",
    "DA_18_Alistar",
    "DA_18_GnarSmall",
    "DA_18_Ivern"
  ],
  "keyTraitIds": [],
  "playstyle": "fast9",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_fast9_draven_default",
  "variants": [
    {
      "id": "var_fast9_draven_default",
      "archetypeId": "comp_fast9_draven",
      "nameVi": "Fast 9 Draven Tiêu Chuẩn",
      "nameEn": "Standard Fast 9 Draven",
      "conditionDescription": "Tích lợi tức lên 9 kẹp Draven carry sát thương vật lý",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
},
{
  "id": "comp_tristana_reroll",
  "setNumber": 18,
  "gameProduct": "tft",
  "mode": "ranked_standard",
  "nameVi": "Tristana Reroll",
  "nameEn": "Tristana Reroll",
  "aliases": [
    "Tristana Reroll",
    "Tristana Pháo Thủ"
  ],
  "coreCarryChampionId": "DA_18_Tristana",
  "coreTankChampionId": "DA_18_Rammus",
  "coreChampionIds": [
    "DA_18_Tristana",
    "DA_18_Rammus",
    "DA_Vi18",
    "DA_18_Kobuko",
    "DA_18_Rakan"
  ],
  "flexChampionIds": [
    "DA_18_Lillia",
    "DA_18_Rengar",
    "DA_18_Sivir"
  ],
  "keyTraitIds": [],
  "playstyle": "reroll",
  "requiredConditions": [],
  "recommendedItems": {},
  "defaultVariantId": "var_tristana_reroll_default",
  "variants": [
    {
      "id": "var_tristana_reroll_default",
      "archetypeId": "comp_tristana_reroll",
      "nameVi": "Tristana Reroll Tiêu Chuẩn",
      "nameEn": "Standard Tristana Reroll",
      "conditionDescription": "Reroll Tristana 3 sao",
      "requiredItems": [],
      "requiredAugments": [],
      "requiredEmblems": [],
      "substituteChampionIds": [],
      "recommendedBoard": []
    }
  ],
  "mappingVersion": "2.0.0",
  "classifierVersion": "2.0.0"
}
];

export function getArchetypeById(id: string): Archetype | undefined {
  if (!id) return undefined;
  const clean = id.trim().toLowerCase();
  return SET18_ARCHETYPES.find(
    (a) =>
      a.id === id ||
      a.id.toLowerCase() === clean ||
      a.id.replace(/_/g, "") === clean.replace(/_/g, "")
  );
}
