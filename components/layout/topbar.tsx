'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { UserMenu } from '@/components/layout/user-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { findNavItem, findNavSection } from '@/lib/navigation';
import type { HealthResponse } from '@/types/api';

function Breadcrumbs() {
  const pathname = usePathname();
  const section = findNavSection(pathname);
  const item = findNavItem(pathname);

  if (!item) {
    return <span className="text-sm font-medium">Glimmora Workforce Engine</span>;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {section && (
        <>
          <span className="truncate text-muted-foreground">{section.label}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </>
      )}
      <span className="truncate font-medium">{item.label}</span>
    </nav>
  );
}

/**
 * Health indicator.
 *
 * Deliberately visible on every screen: the platform has documented fallbacks
 * for missing infrastructure, and a degraded run must never look like a healthy
 * one (ARCHITECTURE.md section 6).
 */
function HealthIndicator() {
  const { data, isError } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => api.get<HealthResponse>('/system/health'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isError) {
    return (
      <Link href="/system">
        <Badge variant="destructive">API unreachable</Badge>
      </Link>
    );
  }

  if (!data) return null;

  const degradedCount = Object.keys(data.degraded).length;
  if (data.status === 'healthy') {
    return (
      <Link href="/system">
        <Badge variant="success">All systems normal</Badge>
      </Link>
    );
  }

  return (
    <Link href="/system" title="Some dependencies are running on a fallback">
      <Badge variant={data.status === 'unhealthy' ? 'destructive' : 'warning'}>
        {data.status === 'unhealthy'
          ? 'Database unavailable'
          : `Degraded — ${degradedCount} on fallback`}
      </Badge>
    </Link>
  );
}

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onToggleSidebar}
        aria-label="Toggle navigation"
      >
        <Menu aria-hidden />
      </Button>

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-2">
        <HealthIndicator />

        <Button variant="ghost" size="icon" disabled title="Search arrives with the talent cloud in Phase 6">
          <Search aria-hidden />
          <span className="sr-only">Search</span>
        </Button>

        <Button variant="ghost" size="icon" disabled title="Notifications arrive in Phase 12">
          <Bell aria-hidden />
          <span className="sr-only">Notifications</span>
        </Button>

        <div className="mx-1 h-6 w-px bg-border" aria-hidden />

        <UserMenu />
      </div>
    </header>
  );
}
