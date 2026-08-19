'use client';

import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLE_LABELS } from '@/lib/roles';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, initials } from '@/lib/format';

export function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [signingOut, setSigningOut] = React.useState(false);

  if (!user) return null;

  const onSignOut = async () => {
    setSigningOut(true);
    await logout();
    router.replace('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Account menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-2xs font-semibold text-primary-foreground">
          {initials(user.full_name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-xs font-medium">{user.full_name}</span>
          <span className="block text-2xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="pb-0">{user.full_name}</DropdownMenuLabel>
        <div className="px-2 pb-2 text-xs text-muted-foreground">
          <div className="truncate">{user.email}</div>
          {user.last_login_at && (
            <div className="mt-1">Last signed in {formatDateTime(user.last_login_at)}</div>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="cursor-default focus:bg-transparent" disabled>
          <ShieldCheck aria-hidden />
          <span className="flex-1">{ROLE_LABELS[user.role]}</span>
          <span className="text-2xs text-muted-foreground">
            {user.permissions.length} permissions
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => router.push('/account/password')}>
          <KeyRound aria-hidden />
          Change password
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void onSignOut();
          }}
          disabled={signingOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
