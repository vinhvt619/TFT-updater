import { Archetype, SourceCompObservation, SourceCompBuild } from "./schemas";
import { inferObservedCarry } from "./board-classifier";
import { matchArchetype } from "./archetype-matching";
import { toCanonicalChampionId } from "../identity";

export interface MappingAuditCandidate {
  archetypeId: string;
  score: number;
  margin: number | null;
  reasonCodes: string[];
}

export interface MappingAudit {
  candidates: MappingAuditCandidate[];
  reviewStatus: "auto_matched" | "ambiguous" | "unmatched" | "approved";
  selectedArchetypeId: string | null;
  selectedVariantId: string | null;
  reason: string;
}

function buildUnitIds(build: SourceCompBuild): string[] {
  return (build.units || [])
    .map((unit) => unit.championId || toCanonicalChampionId(unit.sourceChampionKey, 18))
    .filter(Boolean);
}

export function auditObservationMapping(
  observation: Pick<SourceCompObservation, "builds" | "archetypeId" | "variantId">,
  archetypes: Archetype[]
): MappingAudit | null {
  const primary = (observation.builds || []).find((build) => build.boardKind === "primary") || observation.builds?.[0];
  if (!primary || primary.units.length === 0) return null;
  const unitIds = buildUnitIds(primary);
  const traitIds: string[] = [];
  const carryId = inferObservedCarry(primary.units.map((unit) => ({
    championId: unit.championId || toCanonicalChampionId(unit.sourceChampionKey, 18),
    tier: unit.starLevel,
    items: unit.items.map((item) => item.itemId || item.sourceItemKey)
  })) as any);
  const result = matchArchetype(archetypes, carryId, unitIds, traitIds);
  const sorted = result.bestMatch
    ? [result.bestMatch, ...(result.secondBestMatch ? [result.secondBestMatch] : [])]
    : [];
  const candidates = sorted.map((candidate) => ({
    archetypeId: candidate.archetype.id,
    score: candidate.similarity,
    margin: candidate.archetype.id === result.bestMatch?.archetype.id ? result.margin : null,
    reasonCodes: [
      `carry_match:${candidate.carryMatch.toFixed(4)}`,
      `unit_jaccard:${candidate.jaccard.toFixed(4)}`,
      `missing_core:${candidate.missingUnits.length}`
    ]
  }));
  const selected = result.status === "matched" && result.bestMatch ? result.bestMatch.archetype.id : null;
  const reviewStatus = result.status === "matched" ? "auto_matched" : result.status === "ambiguous" ? "ambiguous" : "unmatched";
  return {
    candidates,
    reviewStatus,
    selectedArchetypeId: selected,
    selectedVariantId: selected ? observation.variantId || null : null,
    reason: result.reason
  };
}
