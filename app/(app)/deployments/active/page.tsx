'use client';

import * as React from 'react';

import { Deployments } from '@/components/delivery/deployments';
import { TableLoadingState } from '@/components/states';

/**
 * Phase 11 - consultants currently deployed and billing.
 *
 * Suspense because the list reads ?resource= to focus a single consultant when
 * arrived at from a submission, and useSearchParams needs a boundary to
 * prerender.
 */
export default function ActiveDeploymentsPage() {
  return (
    <React.Suspense fallback={<TableLoadingState rows={5} columns={6} />}>
      <Deployments />
    </React.Suspense>
  );
}
