'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/states';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side failures are reported to the console with the digest so they
    // can be correlated with a server log entry.
    console.error('Unhandled UI error', { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div className="p-6">
      <ErrorState error={error} onRetry={reset} title="This screen ran into a problem" />
    </div>
  );
}
