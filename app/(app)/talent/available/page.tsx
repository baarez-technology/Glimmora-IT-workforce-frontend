'use client';

import { TalentDirectory } from '@/components/talent/talent-directory';

/** Ready now or ready soon — notice periods included. Not the bench. */
export default function AvailablePage() {
  return <TalentDirectory mode="available" />;
}
