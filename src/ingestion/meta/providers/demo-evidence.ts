import { SourceCompObservation, SourceId } from "../../../domain/meta/schemas";
import { SET18_ARCHETYPES } from "../../../domain/meta/archetypes";

/**
 * Demo observations are deliberately synthetic. Keep their provenance inside
 * the local demo evidence namespace so a demo row can never look like a live
 * claim copied from a production website.
 */
export function withInternalDemoEvidence(
  observations: SourceCompObservation[],
  sourceId: SourceId
): SourceCompObservation[] {
  return observations.map((observation) => {
    const safeCompId = observation.sourceCompId.replace(/[^a-z0-9]+/gi, "_");
    // Observation ids are database primary keys shared by both datasets. The
    // demo provider fixtures intentionally use the same logical comp keys as
    // the live providers so the UI can exercise source aggregation, but their
    // physical ids must remain disjoint. Without this namespace, the demo
    // upsert can hit a live row and silently rewrite its provenance while the
    // dataset_kind column still says real.
    const demoObservationId = `demo_${observation.id}`;
    const archetype = observation.archetypeId
      ? SET18_ARCHETYPES.find((candidate) => candidate.id === observation.archetypeId)
      : undefined;
    const variant = archetype?.variants?.find((candidate) => candidate.id === observation.variantId)
      || archetype?.variants?.[0];
    const fixtureBoard = variant?.recommendedBoard?.length
      ? variant.recommendedBoard
      : (archetype?.coreChampionIds || []).map((championId, index) => ({
          championId,
          nameVi: championId,
          tier: null,
          items: [],
          position: { row: Math.min(3, Math.floor(index / 7)), col: index % 7 }
        }));
    const fixtureBuild = fixtureBoard.length > 0
      ? {
          id: `demo_build_${sourceId}_${safeCompId}`,
          observationId: demoObservationId,
          boardKind: "primary" as const,
          boardCompleteness: "exact" as const,
          boardLevel: fixtureBoard.length,
          boardLevelMin: fixtureBoard.length,
          boardLevelMax: fixtureBoard.length,
          label: "Demo fixture board",
          sourceVariantKey: observation.variantId || "demo-fixture",
          rawArtifactId: `demo_raw_${sourceId}_${safeCompId}`,
          rawLocator: `/demo/evidence/sources/${sourceId}/${encodeURIComponent(observation.sourceCompId)}#board`,
          sourceLocator: `/demo/evidence/sources/${sourceId}/${encodeURIComponent(observation.sourceCompId)}#board`,
          units: fixtureBoard.map((unit: any, index: number) => ({
            sourceChampionKey: unit.championId || `fixture_unit_${index}`,
            championId: unit.championId || null,
            starLevel: unit.tier ?? null,
            position: unit.position || { row: Math.min(3, Math.floor(index / 7)), col: index % 7 },
            items: (unit.items || []).map((itemId: string, order: number) => ({
              sourceItemKey: itemId,
              itemId,
              order
            }))
          }))
        }
      : undefined;
    return {
      ...observation,
      id: demoObservationId,
      datasetKind: "demo",
      sourceUrl: `/demo/evidence/sources/${sourceId}/${encodeURIComponent(observation.sourceCompId)}`,
      rawArtifactId: `demo_raw_${sourceId}_${safeCompId}`,
      evidenceRefIds: [`demo_evidence_${sourceId}`],
      supersedesObservationId: observation.supersedesObservationId
        ? `demo_${observation.supersedesObservationId}`
        : null,
      builds: observation.builds?.length
        ? observation.builds.map((build) => ({
            ...build,
            id: `demo_${build.id}`,
            observationId: demoObservationId,
            rawArtifactId: (build as any).rawArtifactId
              ? `demo_${(build as any).rawArtifactId}`
              : `demo_raw_${sourceId}_${safeCompId}`
          }))
        : fixtureBuild
          ? [fixtureBuild]
          : []
    };
  });
}
