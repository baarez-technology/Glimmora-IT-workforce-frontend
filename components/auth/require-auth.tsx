'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { LoadingState } from '@/components/states';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Client-side route guard.
 *
 * This is a usability control, not a security control — the API rejects every
 * unauthorised request on its own (SECURITY.md section 4). Its job is to avoid
 * showing an authenticated shell to someone whose session has gone.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  React.useEffect(() => {
    if (status === 'idle') void bootstrap();
  }, [status, bootstrap]);

  React.useEffect(() => {
    if (status === 'anonymous') {
      const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [status, pathname, router]);

  // A user who must change their password can reach that page and nothing else.
  React.useEffect(() => {
    if (
      status === 'authenticated' &&
      user?.must_change_password &&
      pathname !== '/account/password'
    ) {
      router.replace('/account/password');
    }
  }, [status, user?.must_change_password, pathname, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex h-dvh items-center justify-center">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  return <>{children}</>;
}
