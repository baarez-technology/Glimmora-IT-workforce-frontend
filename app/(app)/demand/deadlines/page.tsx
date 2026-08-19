'use client';

import { AlarmClock, CircleCheck, RefreshCw, TimerOff, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import {
  CardLoadingState,
  EmptyState,
  ErrorState,
  PermissionDeniedState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeadlineBoard } from '@/hooks/use-requirements';
import { useAuthStore } from '@/lib/auth-store';
import { PRIORITY_SOURCE_LABELS, formatRateRange } from '@/lib/demand';
import { cn } from '@/lib/utils';
import type { DeadlineState, Requirement } from '@/types/demand';

const COLUMNS: Array<{
  key: 'urgent' | 'due_soon' | 'safe' | 'expired';
  state: DeadlineState;
  title: string;
  hint: string;
  icon: typeof AlarmClock;
  accent: string;
}> = [
  {
    key: 'urgent',
    state: 'URGENT',
    title: 'Urgent',
    hint: 'Under 8 hours left — submit today or lose the seat',
    icon: TriangleAlert,
    accent: 'border-destructive/50 bg-destructive/5',
  },
  {
    key: 'due_soon',
    state: 'DUE_SOON',
    title: 'Due soon',
    hint: 'Under 24 hours left',
    icon: AlarmClock,
    accent: 'border-warning/50 bg-warning/5',
  },
  {
    key: 'safe',
    state: 'SAFE',
    title: 'On track',
    hint: 'More than a day of window remaining',
    icon: CircleCheck,
    accent: 'border-success/40 bg-success/5',
  },
  {
    key: 'expired',
    state: 'EXPIRED',
    title: 'Expired',
    hint: 'Window closed — confirm with the client whether it is still open',
    icon: TimerOff,
    accent: 'border-border bg-muted/40',
  },
];

export default function DeadlinesPage() {
  const can = useAuthStore((state) => state.can);
  const board = useDeadlineBoard();

  if (!can('requirement:read')) return <PermissionDeniedState />;

  if (board.isLoading) {
    return (
      <>
        <PageHeader title="Submission deadlines" />
        <CardLoadingState count={4} />
      </>
    );
  }

  if (board.isError) {
    return (
      <>
        <PageHeader title="Submission deadlines" />
        <ErrorState error={board.error} onRetry={() => void board.refetch()} />
      </>
    );
  }

  const data = board.data;
  const total = data ? Object.values(data.counts).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <>
      <PageHeader
        title="Submission deadlines"
        description="Open requirements grouped by how much of their submission window is left. VMS and MSP requirements commonly allow only 24–48 hours; missing the window loses the seat however good the candidate is."
        actions={
          <Button variant="outline" size="sm" onClick={() => void board.refetch()} loading={board.isFetching}>
            <RefreshCw aria-hidden />
            Refresh
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyState
          title="No requirements carry a deadline"
          description="Requirements arriving through a VMS or MSP get a submission window. Add one to a requirement and it will appear here."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const items = data?.[column.key] ?? [];
            const Icon = column.icon;

            return (
              <Card key={column.key} className={cn('border', items.length > 0 && column.accent)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4" aria-hidden />
                      {column.title}
                    </CardTitle>
                    <span className="text-lg font-semibold tabular">{items.length}</span>
                  </div>
                  <CardDescription className="text-xs">{column.hint}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-2">
                  {items.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">Nothing here</p>
                  ) : (
                    items.map((requirement) => (
                      <DeadlineCard key={requirement.id} requirement={requirement} />
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function DeadlineCard({ requirement }: { requirement: Requirement }) {
  return (
    <Link
      href={`/demand/requirements/${requirement.id}`}
      className="block rounded-md border bg-card p-3 transition-colors hover:border-primary/40"
    >
      <div className="text-sm font-medium leading-snug">{requirement.title}</div>

      <div className="mt-1 text-xs text-muted-foreground">
        {[requirement.account_name, requirement.location].filter(Boolean).join(' · ') || '—'}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{requirement.priority_source.split('_')[0]}</Badge>
        {requirement.positions > 1 && (
          <Badge variant="muted">{requirement.positions} positions</Badge>
        )}
        {requirement.needs_review && <Badge variant="warning">Unreviewed</Badge>}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium tabular">{requirement.deadline?.label}</span>
        <span className="text-2xs text-muted-foreground tabular">
          {formatRateRange(
            requirement.rate_min,
            requirement.rate_max,
            requirement.rate_currency,
            requirement.rate_unit,
          )}
        </span>
      </div>

      <div className="mt-1 truncate text-2xs text-muted-foreground">
        {PRIORITY_SOURCE_LABELS[requirement.priority_source]}
      </div>
    </Link>
  );
}
