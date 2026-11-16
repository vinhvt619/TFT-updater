import { snapshotRepository } from "@/server/repositories/snapshot-repository";
import { ChampionCatalogue } from "@/components/champions/champion-catalogue";

export const dynamic = "force-dynamic";

export default async function ChampionsPage() {
  const snapshotId = await snapshotRepository.getLatestSnapshotId("real");
  const champions = snapshotId ? await snapshotRepository.getChampionsAtSnapshot(snapshotId) : [];
  return <ChampionCatalogue champions={champions} snapshotId={snapshotId} />;
}
