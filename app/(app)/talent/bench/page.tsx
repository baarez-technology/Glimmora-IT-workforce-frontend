'use client';

import { TalentDirectory } from '@/components/talent/talent-directory';

/** Unbilled capacity — the number the redeployment engine drives to zero. */
export default function BenchPage() {
  return <TalentDirectory mode="bench" />;
}
