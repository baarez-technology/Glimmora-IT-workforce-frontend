'use client';

import * as React from 'react';

import { Deployments } from '@/components/delivery/deployments';
import { TableLoadingState } from '@/components/states';

/** Phase 11 - the 90/60/30/15/7-day horizons. */
export default function EndingSoonPage() {
  return (
    <React.Suspense fallback={<TableLoadingState rows={5} columns={6} />}>
      <Deployments endingSoon />
    </React.Suspense>
  );
}
