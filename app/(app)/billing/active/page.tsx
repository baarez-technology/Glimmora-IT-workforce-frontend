'use client';

import { BillingWorkbench } from '@/components/delivery/billing';

/** Phase 11 — monthly billing records per deployment. */
export default function ActiveBillingPage() {
  return <BillingWorkbench view="records" />;
}
