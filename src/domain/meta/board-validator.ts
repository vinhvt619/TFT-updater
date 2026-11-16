import bilingualData from "./set18-champions-bilingual.json";
import { resolveItemInfo, normalizeItemKey } from "./item-registry";
import { resolveSet18Champion } from "./set18-registry";

// Special spawned/summoned entities that can appear on board but are not shop champions
export const SPAWNED_BOARD_ENTITIES = new Set<string>([
  "tft_trainingdummy",
  "trainingdummy",
  "targetdummy"
]);

// Trait / monster entities that belong to Set 18 roster
export const VALID_PATCH_TRAIT_ENTITIES = new Set<string>([
  "da_gromp18_ap",
  "da_murkwolf18",
  "da_18_sentry",
  "da_cinderling18",
  "da_scuttlecrab18",
  "da_krug18",
  "da_sentinel18",
  "da_brambleback18",
  "da_18_elderdragon",
  "da_crimsonraptor18"
]);

export function isPatchTraitEntity(key: string): boolean {
  if (!key) return false;
  const normalized = key.toLowerCase().replace(/^tft18_/, "").trim();
  return VALID_PATCH_TRAIT_ENTITIES.has(normalized);
}

export function isSpawnedEntity(key: string): boolean {
  if (!key) return false;
  const normalized = key.toLowerCase().replace(/^tft18_/, "").trim();
  return SPAWNED_BOARD_ENTITIES.has(normalized);
}

export const KNOWN_NON_SHOP_ENTITIES = SPAWNED_BOARD_ENTITIES;

export interface BoardPosition {
  row: number; // 0..3
  col: number; // 0..6
}

export interface BoardUnitInput {
  championId?: string;
  rawKey?: string;
  key?: string;
  name?: string;
  nameVi?: string;
  nameEn?: string;
  cost?: number;
  tier?: number;
  starLevel?: number;
  items?: string[];
  position?: BoardPosition | null;
  isCarry?: boolean;
  isTank?: boolean;
}

export interface BoardValidationResult {
  valid: boolean;
  quarantined: boolean;
  quarantineReason?: string;
  errors: string[];
  warnings: string[];
  shopUnits: BoardUnitInput[];
  boardUnits?: BoardUnitInput[];
  nonShopEntities: string[];
  unknownEntities: string[];
}

/**
 * Kiểm tra một champion key có phải là tướng hợp lệ mua được trong cửa hàng Mùa 18 (cost 1..5) không
 * dựa trên gameplay artifact và Patch Champion Registry (gồm 74 tướng shop).
 */
export function isShopChampion(
  championKey: string,
  catalogMap?: Map<string, { cost: number; nameVi?: string; nameEn?: string }>
): boolean {
  if (!championKey) return false;

  const registryEntry = resolveSet18Champion(championKey);
  if (registryEntry) return registryEntry.entityKind === "shop_champion";

  const normalized = championKey.toLowerCase().replace(/^tft18_/, "").trim();

  // 1. Tra cứu catalog map theo patch nếu có
  if (catalogMap) {
    const fromCat = catalogMap.get(championKey) || catalogMap.get(`tft18_${normalized}`) || catalogMap.get(normalized);
    if (fromCat) {
      return fromCat.cost >= 1 && fromCat.cost <= 5;
    }
  }

  // 2. Tra cứu danh mục tướng chuẩn Set 18 (74 tướng shop theo gameplay artifact)
  if (VALID_PATCH_TRAIT_ENTITIES.has(normalized)) {
    return true;
  }

  const keys = Object.keys(bilingualData);
  const matchedKey = keys.find(
    (k) => k.toLowerCase() === normalized || `tft18_${k.toLowerCase()}` === championKey.toLowerCase()
  );

  return Boolean(matchedKey);
}

/**
 * Kiểm tra một entity key có phải là thực thể hợp lệ xuất hiện trên bàn cờ Set 18
 * (gồm 74 shop champions + các thực thể triệu hồi / token hợp lệ).
 */
export function isValidBoardEntity(
  entityKey: string,
  catalogMap?: Map<string, { cost: number; nameVi?: string; nameEn?: string }>
): boolean {
  if (!entityKey) return false;
  return isShopChampion(entityKey, catalogMap) || isSpawnedEntity(entityKey);
}

/**
 * Kiểm tra một champion key có phải là thực thể ngoài shop (ví dụ Training Dummy, token không mua được)
 */
export function isNonShopEntity(
  championKey: string,
  catalogMap?: Map<string, { cost: number; nameVi?: string; nameEn?: string }>
): boolean {
  if (!championKey) return false;
  return isSpawnedEntity(championKey) || !isShopChampion(championKey, catalogMap);
}

/**
 * Validate toàn diện bộ danh sách tướng trên bàn cờ:
 * 1. Join canonical roster, loại bỏ/quarantine unknown entity.
 * 2. Kiểm tra kích thước bàn cờ (6-10 tướng).
 * 3. Kiểm tra vị trí (row 0..3, col 0..6, không trùng lặp vị trí).
 * 4. Kiểm tra trang bị (tối đa 3 trang bị/tướng, phải thuộc ITEM_REGISTRY).
 * 5. Kiểm tra cost (1..5 vàng cho shop champions).
 */
export function validateBoardUnits(
  units: BoardUnitInput[],
  options: {
    catalogMap?: Map<string, { cost: number; nameVi?: string; nameEn?: string }>;
    minBoardSize?: number;
    maxBoardSize?: number;
    allowTraitEntities?: boolean;
    allowSpawnedEntities?: boolean;
    boardKind?: "primary" | "alternate" | "early" | "flex" | "max_cap";
    boardLevel?: number | null;
  } = {}
): BoardValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let minSize = options.minBoardSize ?? 6;
  if (options.minBoardSize === undefined) {
    if (options.boardKind === "early") {
      minSize = 4;
    } else if (options.boardLevel !== undefined && options.boardLevel !== null && options.boardLevel <= 5) {
      minSize = Math.max(3, options.boardLevel);
    }
  }
  const maxSize = options.maxBoardSize ?? 10;
  const allowTraits = options.allowTraitEntities ?? true;
  const allowSpawned = options.allowSpawnedEntities ?? false;

  const nonShopEntities: string[] = [];
  const unknownEntities: string[] = [];
  const validShopUnits: BoardUnitInput[] = [];
  const validBoardUnits: BoardUnitInput[] = [];

  const occupiedPositions = new Set<string>();

  for (const u of units) {
    const rawKey = u.championId || (u as any).rawKey || (u as any).key;

    if (isShopChampion(rawKey, options.catalogMap)) {
      // Cost validation for shop champion
      let resolvedCost = u.cost;
      if (options.catalogMap) {
        const cInfo = options.catalogMap.get(rawKey) || options.catalogMap.get(rawKey.toLowerCase());
        if (cInfo && cInfo.cost) resolvedCost = cInfo.cost;
      }
      if (resolvedCost !== undefined && (resolvedCost < 1 || resolvedCost > 5)) {
        errors.push(`Tướng ${rawKey} có giá tiền không hợp lệ: ${resolvedCost} vàng (yêu cầu 1-5 vàng)`);
      }
      validShopUnits.push(u);
      validBoardUnits.push(u);
    } else if (isSpawnedEntity(rawKey)) {
      nonShopEntities.push(rawKey);
      if (allowSpawned) {
        warnings.push(`Thực thể triệu hồi/sinh thêm (non-shop entity): ${rawKey}`);
        validBoardUnits.push(u);
      } else {
        errors.push(`Phát hiện thực thể không phải tướng cửa hàng (non-shop entity): ${rawKey}`);
      }
    } else if (isPatchTraitEntity(rawKey)) {
      if (allowTraits) {
        validShopUnits.push(u);
        validBoardUnits.push(u);
      } else {
        nonShopEntities.push(rawKey);
        warnings.push(`Thực thể tộc hệ/quái vật (trait entity): ${rawKey}`);
        validBoardUnits.push(u);
      }
    } else {
      unknownEntities.push(rawKey);
      errors.push(`Thực thể không xác định trên bàn cờ: ${rawKey}`);
      continue;
    }

    // Position validation
    if (u.position) {
      const { row, col } = u.position;
      if (row < 0 || row > 3 || col < 0 || col > 6) {
        errors.push(`Tướng ${rawKey} có tọa độ không hợp lệ: hàng ${row}, cột ${col} (yêu cầu hàng 0-3, cột 0-6)`);
      }
      const posKey = `${row},${col}`;
      if (occupiedPositions.has(posKey)) {
        errors.push(`Xung đột vị trí: Ô cờ [hàng ${row}, cột ${col}] bị chiếm bởi nhiều hơn 1 tướng`);
      }
      occupiedPositions.add(posKey);
    }

    // Items validation
    if (u.items && u.items.length > 0) {
      if (u.items.length > 3) {
        errors.push(`Tướng ${rawKey} có ${u.items.length} trang bị (vượt quá giới hạn tối đa 3 trang bị)`);
      }
      for (const it of u.items) {
        const itemInfo = resolveItemInfo(it);
        const norm = normalizeItemKey(it);
        if (!itemInfo) {
          errors.push(`Trang bị không nhận diện được: ${it || norm} trên tướng ${rawKey}`);
        }
      }
    }
  }

  // Shop champion size check (excludes Training Dummy and other spawned non-shop entities)
  const effectiveShopUnits = validShopUnits;
  if (effectiveShopUnits.length < minSize || effectiveShopUnits.length > maxSize) {
    errors.push(
      `Kích thước bàn cờ không hợp lệ: ${effectiveShopUnits.length} tướng (yêu cầu từ ${minSize} đến ${maxSize} tướng)`
    );
  }

  const quarantined = unknownEntities.length > 0 || errors.length > 0;
  const valid = errors.length === 0 && !quarantined;

  return {
    valid,
    quarantined,
    quarantineReason: quarantined ? errors.join("; ") : undefined,
    errors,
    warnings,
    shopUnits: validShopUnits,
    boardUnits: validBoardUnits,
    nonShopEntities,
    unknownEntities
  };
}
