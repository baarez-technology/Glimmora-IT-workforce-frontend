'use client';

import {
  AlertTriangle,
  Ban,
  Construction,
  Inbox,
  Loader2,
  RefreshCw,
  ServerCrash,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * The four states every data screen must handle, plus an honest placeholder for
 * screens a later phase delivers. Centralised so no screen invents its own
 * empty message and so "no results" never looks like "something broke".
 */

interface StateShellProps {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'danger';
  className?: string;
}

function StateShell({ icon, title, description, action, tone = 'neutral', className }: StateShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center',
        tone === 'warning' && 'border-warning/40 bg-warning/5',
        tone === 'danger' && 'border-destructive/40 bg-destructive/5',
        className,
      )}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <div
        className={cn(
          'mb-4 flex h-12 w-12 items-center justify-center rounded-full',
          tone === 'neutral' && 'bg-muted text-muted-foreground',
          tone === 'warning' && 'bg-warning/15 text-warning',
          tone === 'danger' && 'bg-destructive/12 text-destructive',
        )}
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ loading */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function TableLoadingState({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-label="Loading results">
      <div className="flex gap-3 border-b pb-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardLoadingState({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border p-5">
          <Skeleton className="mb-3 h-4 w-1/3" />
          <Skeleton className="mb-2 h-7 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- empty */

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <StateShell icon={<Inbox className="h-6 w-6" />} title={title} description={description} action={action} />
  );
}

/** "Your filters matched nothing" is a different message from "there is no data". */
export function NoResultsState({ onClear }: { onClear?: () => void }) {
  return (
    <StateShell
      icon={<Inbox className="h-6 w-6" />}
      title="No results match those filters"
      description="Try widening the date range, clearing a filter, or searching for a broader term."
      action={
        onClear ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
}

/* -------------------------------------------------------------------- error */

export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const apiError = error instanceof ApiError ? error : undefined;

  if (apiError?.isPermissionError) return <PermissionDeniedState />;

  const isOffline = apiError?.status === 0;
  const icon = isOffline ? <WifiOff className="h-6 w-6" /> : <ServerCrash className="h-6 w-6" />;
  const heading =
    title ?? (isOffline ? 'Cannot reach the Glimmora API' : 'That did not load');
  const message =
    apiError?.message ??
    (error instanceof Error ? error.message : 'Something went wrong while loading this view.');

  return (
    <StateShell
      tone="danger"
      icon={icon}
      title={heading}
      description={
        <>
          <p>{message}</p>
          {apiError?.details.length ? (
            <ul className="mt-2 list-inside list-disc text-left">
              {apiError.details.map((detail) => (
                <li key={`${detail.field}-${detail.message}`}>
                  <span className="font-medium">{detail.field}</span>: {detail.message}
                </li>
              ))}
            </ul>
          ) : null}
          {apiError?.requestId ? (
            <p className="mt-2 font-mono text-2xs text-muted-foreground">
              Reference: {apiError.requestId}
            </p>
          ) : null}
        </>
      }
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden />
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

/* --------------------------------------------------------------- permission */

export function PermissionDeniedState({ description }: { description?: React.ReactNode }) {
  return (
    <StateShell
      tone="warning"
      icon={<Ban className="h-6 w-6" />}
      title="You do not have access to this"
      description={
        description ?? (
          <>
            This view holds commercial or personal data restricted to certain roles. Ask an
            administrator if you believe you should have access.
          </>
        )
      }
    />
  );
}

/* ------------------------------------------------------------- not yet built */

/**
 * An honest placeholder. The navigation shows the full information architecture
 * from day one, but an unbuilt screen says exactly that instead of pretending to
 * work — no fake buttons, no dead navigation.
 */
export function NotBuiltYetState({
  title,
  phase,
  description,
}: {
  title: string;
  phase: number;
  description?: string;
}) {
  return (
    <StateShell
      icon={<Construction className="h-6 w-6" />}
      title={`${title} arrives in Phase ${phase}`}
      description={
        <>
          {description ? <p className="mb-2">{description}</p> : null}
          <p>
            This screen is part of the planned build and is not implemented yet. Nothing here is a
            placeholder pretending to work.
          </p>
          <p className="mt-2">
            <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/system">
              View system status
            </Link>
          </p>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ inline */

export function InlineWarning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
