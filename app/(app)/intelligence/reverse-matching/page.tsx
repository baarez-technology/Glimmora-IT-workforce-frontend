'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { RedeploymentWorkbench } from '@/components/matching/redeployment-workbench';
import { LoadingState } from '@/components/states';

/** Phase 8 — Resource → Demand. The radar links here with ?resource=<id>. */
function ReverseMatchingContent() {
  const resource = useSearchParams().get('resource') ?? undefined;
  return <RedeploymentWorkbench resourceId={resource} />;
}

export default function ReverseMatchingPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading redeployment options…" />}>
      <ReverseMatchingContent />
    </Suspense>
  );
}
