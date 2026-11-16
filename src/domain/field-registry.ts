import { StatUnit } from "./types";

export type ImpactDirection = "higher_is_buff" | "lower_is_buff" | "unknown";

export interface FieldDefinition {
  key: string;
  labelVi: string;
  labelEn: string;
  unit: StatUnit;
  direction: ImpactDirection;
  epsilon: number;
  allowRelativePercent: boolean;
  displayPrecision: number;
}

export const FIELD_REGISTRY: Record<string, FieldDefinition> = {
  health: {
    key: "health",
    labelVi: "Máu",
    labelEn: "Health",
    unit: "flat",
    direction: "higher_is_buff",
    epsilon: 1e-6,
    allowRelativePercent: true,
    displayPrecision: 0
  },
  attack_damage: {
    key: "attack_damage",
    labelVi: "Sát thương vật lý (AD)",
    labelEn: "Attack Damage",
    unit: "flat",
    direction: "higher_is_buff",
    epsilon: 1e-6,
    allowRelativePercent: true,
    displayPrecision: 0
  },
  attack_speed: {
    key: "attack_speed",
    labelVi: "Tốc độ đánh",
    labelEn: "Attack Speed",
    unit: "attacks_per_second",
    direction: "higher_is_buff",
    epsilon: 1e-4,
    allowRelativePercent: true,
    displayPrecision: 2
  },
  armor: {
    key: "armor",
    labelVi: "Giáp",
    labelEn: "Armor",
    unit: "flat",
    direction: "higher_is_buff",
    epsilon: 1e-6,
    allowRelativePercent: true,
    displayPrecision: 0
  },
  magic_resistance: {
    key: "magic_resistance",
    labelVi: "Kháng phép",
    labelEn: "Magic Resist",
    unit: "flat",
    direction: "higher_is_buff",
    epsilon: 1e-6,
    allowRelativePercent: true,
    displayPrecision: 0
  },
  attack_range: {
    key: "attack_range",
    labelVi: "Tầm đánh",
    labelEn: "Attack Range",
    unit: "hexes",
    direction: "unknown",
    epsilon: 1e-6,
    allowRelativePercent: false,
    displayPrecision: 0
  },
  mana_start: {
    key: "mana_start",
    labelVi: "Năng lượng khởi đầu",
    labelEn: "Starting Mana",
    unit: "mana",
    direction: "higher_is_buff",
    epsilon: 1e-6,
    allowRelativePercent: false,
    displayPrecision: 0
  },
  mana_max: {
    key: "mana_max",
    labelVi: "Năng lượng tối đa",
    labelEn: "Max Mana",
    unit: "mana",
    direction: "lower_is_buff",
    epsilon: 1e-6,
    allowRelativePercent: true,
    displayPrecision: 0
  },
  crit_chance: {
    key: "crit_chance",
    labelVi: "Tỉ lệ chí mạng",
    labelEn: "Critical Chance",
    unit: "percent",
    direction: "higher_is_buff",
    epsilon: 1e-6,
    allowRelativePercent: false,
    displayPrecision: 0
  },
  crit_multiplier: {
    key: "crit_multiplier",
    labelVi: "Sát thương chí mạng",
    labelEn: "Crit Multiplier",
    unit: "ratio",
    direction: "higher_is_buff",
    epsilon: 1e-6,
    allowRelativePercent: true,
    displayPrecision: 2
  },
  cost: {
    key: "cost",
    labelVi: "Giá tiền",
    labelEn: "Cost",
    unit: "gold",
    direction: "unknown",
    epsilon: 1e-6,
    allowRelativePercent: false,
    displayPrecision: 0
  }
};

export function getFieldDefinition(fieldKey: string): FieldDefinition {
  if (FIELD_REGISTRY[fieldKey]) {
    return FIELD_REGISTRY[fieldKey];
  }
  // Fallback for custom or ability parameters
  return {
    key: fieldKey,
    labelVi: fieldKey,
    labelEn: fieldKey,
    unit: "flat",
    direction: "unknown",
    epsilon: 1e-6,
    allowRelativePercent: true,
    displayPrecision: 2
  };
}
