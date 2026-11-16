import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/server/api-helpers";
import { snapshotRepository } from "@/server/repositories/snapshot-repository";
import { normalizeSearchString, toCanonicalChampionId } from "@/domain/identity";
import bilingualData from "@/domain/meta/set18-champions-bilingual.json";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const requestedMode = searchParams.get("mode") || searchParams.get("dataset") || "real";
    if (requestedMode !== "real") return apiError("demo_not_public", "Dữ liệu thử nghiệm chỉ dành cho kiểm thử nội bộ.", 403);
    const mode = "real" as const;
    let snapshotId = searchParams.get("snapshotId");

    if (!snapshotId) {
      snapshotId = await snapshotRepository.getLatestSnapshotId(mode);
    }

    if (!snapshotId) {
      return apiSuccess({
        query: q,
        normalizedQuery: normalizeSearchString(q),
        snapshotId: null,
        status: "collecting",
        total: 0,
        items: []
      }, { datasetKind: mode });
    }

    const snapshotRelease = await snapshotRepository.getSnapshotReleaseMeta(snapshotId);
    if (!snapshotRelease || snapshotRelease.datasetKind !== mode) {
      return apiError("dataset_mismatch", "snapshotId không thuộc dataset đang yêu cầu", 400);
    }

    if (!q) {
      return apiSuccess({
        query: "",
        normalizedQuery: "",
        snapshotId,
        total: 0,
        items: []
      }, { datasetKind: mode });
    }

    const champions = await snapshotRepository.getChampionsAtSnapshot(snapshotId);
    const normalizedQ = normalizeSearchString(q);
    const qLower = q.toLowerCase();
    const qCanonical = toCanonicalChampionId(q, 18);

    // Build reverse map of source aliases from bilingual JSON
    const aliasMap: Record<string, string[]> = {};
    for (const [sourceKey, names] of Object.entries(bilingualData as Record<string, { vi: string; en: string }>)) {
      const canon = toCanonicalChampionId(sourceKey, 18);
      if (!aliasMap[canon]) aliasMap[canon] = [];
      aliasMap[canon].push(sourceKey.toLowerCase());
      if (names.vi) aliasMap[canon].push(normalizeSearchString(names.vi));
      if (names.en) aliasMap[canon].push(normalizeSearchString(names.en));
    }

    const matchedItems: any[] = [];

    for (const champ of champions) {
      const p: any = (champ as any).payload || champ;
      const champId = String((champ as any).championId || p.championId || "").toLowerCase();
      const canonicalId = toCanonicalChampionId(champId, 18);

      const enName = typeof p?.name === "string" 
        ? p.name 
        : (p?.name?.en?.value || p?.name?.en || "");
      const viName = typeof p?.name === "string"
        ? p.name
        : (p?.name?.vi?.value || p?.name?.vi || "");

      const normEn = normalizeSearchString(enName);
      const normVi = normalizeSearchString(viName);

      const matchedFields: string[] = [];

      // Check ID matches
      if (champId === qLower) matchedFields.push("champion_id_exact");
      else if (champId.includes(qLower)) matchedFields.push("champion_id_substr");

      if (canonicalId === qCanonical) matchedFields.push("canonical_id_exact");
      else if (canonicalId.includes(qLower)) matchedFields.push("canonical_id_substr");

      // Check names
      if (normEn === normalizedQ) matchedFields.push("name_en_exact");
      else if (normEn.includes(normalizedQ)) matchedFields.push("name_en_substr");

      if (normVi === normalizedQ) matchedFields.push("name_vi_exact");
      else if (normVi.includes(normalizedQ)) matchedFields.push("name_vi_substr");

      // Check aliases from bilingual dictionary
      const aliases = aliasMap[canonicalId] || aliasMap[champId] || [];
      if (aliases.some((a) => a === normalizedQ || a === qLower)) {
        matchedFields.push("alias_exact");
      } else if (aliases.some((a) => a.includes(normalizedQ))) {
        matchedFields.push("alias_substr");
      }

      if (matchedFields.length > 0) {
        const costValue = typeof p?.cost === "number" ? p.cost : (p?.cost?.value ?? null);
        matchedItems.push({
          championId: champ.championId || champId,
          canonicalId,
          name: {
            en: enName,
            vi: viName
          },
          cost: costValue,
          traits: p?.traits || [],
          matchedFields
        });
      }
    }

    // Sort exact matches higher than substring matches
    matchedItems.sort((a, b) => {
      const aIsExact = a.matchedFields.some((f: string) => f.includes("exact"));
      const bIsExact = b.matchedFields.some((f: string) => f.includes("exact"));
      if (aIsExact && !bIsExact) return -1;
      if (!aIsExact && bIsExact) return 1;
      return a.championId.localeCompare(b.championId);
    });

    return apiSuccess({
      query: q,
      normalizedQuery: normalizedQ,
      snapshotId,
      total: matchedItems.length,
      items: matchedItems
    }, { datasetKind: mode });
  } catch (err: any) {
    return apiError("internal_error", err.message, 500);
  }
}
