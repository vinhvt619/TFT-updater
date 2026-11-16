import { Suspense } from 'react';
import { snapshotRepository } from '@/server/repositories/snapshot-repository';
import { toCanonicalChampionId } from '@/domain/identity';
import { ChampionDetailContent } from './champion-detail-content';

export const dynamic = 'force-dynamic';

interface ChampionDetailPageProps {
  params: Promise<{ championId: string }>;
  searchParams?: Promise<{ from?: string; to?: string; snapshotId?: string }>;
}

export default async function ChampionDetailPage({ params, searchParams }: ChampionDetailPageProps) {
  const { championId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const canonicalId = toCanonicalChampionId(championId);

  const rawFrom = resolvedSearchParams.from;
  const isSnapshotFrom = rawFrom && rawFrom !== "catalogue" && rawFrom !== "compare";
  const requestedSnapshotId = resolvedSearchParams.to || (isSnapshotFrom ? rawFrom : undefined) || resolvedSearchParams.snapshotId;
  let targetSnapshotId = requestedSnapshotId;
  let initialQuarantine: { isQuarantined: boolean; snapshotId: string; reason?: string } | undefined = undefined;
  let initialError: string | undefined = undefined;
  let champion = null;

  if (requestedSnapshotId) {
    const snap = await snapshotRepository.getSnapshotById(requestedSnapshotId);
    if (!snap) {
      initialError = `Không tìm thấy snapshot: ${requestedSnapshotId}`;
    } else if ((snap as any).status === "quarantined") {
      initialQuarantine = {
        isQuarantined: true,
        snapshotId: requestedSnapshotId,
        reason: (snap as any).reason || (snap as any).quarantineReason || "violation"
      };
    } else if ((snap as any).status !== "published") {
      initialError = `Ảnh chụp ${requestedSnapshotId} chưa được công bố chính thức`;
    } else if ((await snapshotRepository.getSnapshotReleaseMeta(requestedSnapshotId))?.datasetKind !== "real") {
      initialError = "Ảnh chụp thử nghiệm không được hiển thị trên trang công khai";
    } else {
      champion = await snapshotRepository.getChampionAtSnapshot(requestedSnapshotId, championId);
      if (!champion) {
        initialError = `Không tìm thấy tướng ${championId} trong snapshot ${requestedSnapshotId}`;
      }
    }
  } else {
    targetSnapshotId = (await snapshotRepository.getLatestSnapshotId('real')) || undefined;
    if (targetSnapshotId) {
      champion = await snapshotRepository.getChampionAtSnapshot(targetSnapshotId, championId);
    }
  }

  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">Đang tải hồ sơ tướng...</div>}>
      <ChampionDetailContent
        championId={champion?.championId || canonicalId}
        initialChampion={champion}
        snapshotId={targetSnapshotId}
        initialQuarantine={initialQuarantine}
        initialError={initialError}
      />
    </Suspense>
  );
}
