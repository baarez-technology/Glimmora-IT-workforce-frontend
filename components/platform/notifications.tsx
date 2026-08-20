'use client';

import { Bell, BellOff, Check, CheckCheck, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import {
  EmptyState,
  ErrorState,
  NoResultsState,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useRunSweeps,
  useUnreadCount,
} from '@/hooks/use-platform';
import { useAuthStore } from '@/lib/auth-store';
import { formatRelative } from '@/lib/format';
import { CATEGORY_LABELS, SEVERITY_VARIANT, rankNotifications } from '@/lib/platform';
import { cn } from '@/lib/utils';
import type { Notification, NotificationCategory } from '@/types/platform';

/**
 * The notification centre.
 *
 * Ordered by urgency then recency, because that is the order somebody should
 * work them in — a chronological list buries a CRITICAL work-permit expiry
 * under a week of routine INFO alerts.
 */

const CATEGORIES: NotificationCategory[] = [
  'SUBMISSION_SLA',
  'DOCUMENT_EXPIRY',
  'BENCH_REDEPLOYMENT',
  'INTERVIEW_REMINDER',
  'FOLLOW_UP_OVERDUE',
  'PROJECT_ENDING',
  'SYSTEM',
];

function NotificationCard({ notification }: { notification: Notification }) {
  const markRead = useMarkRead();

  return (
    <Card className={cn(!notification.is_read && 'border-l-4 border-l-primary')}>
      <CardContent className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY_VARIANT[notification.severity]}>
              {notification.severity.toLowerCase()}
            </Badge>
            <Badge variant="outline">{CATEGORY_LABELS[notification.category]}</Badge>
            {!notification.is_read ? (
              <span className="text-2xs font-medium uppercase tracking-wide text-primary">
                New
              </span>
            ) : null}
          </div>

          <p className={cn('mt-1.5 text-sm', !notification.is_read && 'font-medium')}>
            {notification.title}
          </p>
          {notification.body ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p>
          ) : null}
          <p className="mt-1 text-2xs text-muted-foreground">
            {formatRelative(notification.created_at)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {notification.action_url ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={notification.action_url}>Open</Link>
            </Button>
          ) : null}
          {!notification.is_read ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markRead.mutate(notification.id)}
              disabled={markRead.isPending}
              aria-label={`Mark "${notification.title}" as read`}
            >
              <Check aria-hidden />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function Notifications() {
  const can = useAuthStore((state) => state.can);
  const [unreadOnly, setUnreadOnly] = React.useState(true);
  const [category, setCategory] = React.useState<NotificationCategory | ''>('');

  const notifications = useNotifications({ unread_only: unreadOnly, category });
  const counts = useUnreadCount();
  const markAll = useMarkAllRead();
  const sweeps = useRunSweeps();
  const canSweep = can('user:create');

  if (!can('notification:read')) return <PermissionDeniedState />;

  const rows = rankNotifications(notifications.data ?? []);
  const unread = counts.data;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="SLA deadlines, document expiry, redeployment, interviews and overdue follow-ups. Each fact alerts once — a repeated warning is a warning people learn to ignore."
        actions={
          <div className="flex gap-2">
            {canSweep ? (
              <Button
                variant="outline"
                onClick={() => sweeps.mutate()}
                disabled={sweeps.isPending}
                title="Normally scheduled. Safe to press — every alert dedupes."
              >
                <RefreshCw
                  className={cn(sweeps.isPending && 'animate-spin')}
                  aria-hidden
                />
                Run sweeps now
              </Button>
            ) : null}
            {unread && unread.total > 0 ? (
              <Button
                variant="outline"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                <CheckCheck aria-hidden />
                Mark all read
              </Button>
            ) : null}
          </div>
        }
      />

      {sweeps.isSuccess ? (
        <div className="mb-4 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
          Sweeps complete:{' '}
          {Object.entries(sweeps.data)
            .map(([name, result]) => `${name.replace(/_/g, ' ')} raised ${result.raised}`)
            .join(', ')}
          . A fact that already alerted stays quiet.
        </div>
      ) : null}

      {unread ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bell className="h-3.5 w-3.5" aria-hidden />
                Unread
              </div>
              <div className="mt-1 text-2xl font-semibold tabular">{unread.total}</div>
            </CardContent>
          </Card>
          <Card className={cn(unread.critical > 0 && 'border-destructive/40')}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Critical</div>
              <div
                className={cn(
                  'mt-1 text-2xl font-semibold tabular',
                  unread.critical > 0 && 'text-destructive',
                )}
              >
                {unread.critical}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
              className="h-4 w-4"
            />
            Unread only
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Category</span>
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value as NotificationCategory | '')}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
        </CardContent>
      </Card>

      {notifications.isError ? (
        <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />
      ) : notifications.isLoading ? (
        <TableLoadingState rows={4} columns={3} />
      ) : rows.length === 0 ? (
        category ? (
          <NoResultsState onClear={() => setCategory('')} />
        ) : unreadOnly ? (
          <EmptyState
            title="Nothing needs your attention"
            description="Every alert addressed to you has been read. Untick 'unread only' to see the history."
            action={
              <Button variant="outline" onClick={() => setUnreadOnly(false)}>
                <BellOff aria-hidden />
                Show all
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No notifications yet"
            description="Alerts appear here when a submission deadline approaches, a document is expiring, a consultant is heading for the bench, or a follow-up slips."
          />
        )
      ) : (
        <div className="space-y-3">
          {rows.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </>
  );
}
