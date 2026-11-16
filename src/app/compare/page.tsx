import React, { Suspense } from 'react';
import { snapshotRepository } from '@/server/repositories/snapshot-repository';
import { CompareContent } from '@/components/compare/compare-content';
import { DatasetKind } from '@/domain/types';

export const dynamic = 'force-dynamic';

export default async function ComparePage() {
  // Demo fixtures are kept for automated tests only; public pages always use
  // the published Real history and fail closed when it is unavailable.
  const datasetKind: DatasetKind = 'real';
  const releases = await snapshotRepository.getReleases('real', { includeArchive: false });

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải trang so sánh...</div>}>
      <CompareContent initialReleases={releases} initialDatasetKind={datasetKind} />
    </Suspense>
  );
}
