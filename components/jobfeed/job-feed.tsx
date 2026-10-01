'use client';

import { Bookmark, BookmarkCheck, CheckCheck, ExternalLink, Plus, Send } from 'lucide-react';
import * as React from 'react';

import { AddJobDialog } from '@/components/jobfeed/add-job-dialog';
import { ConfirmAction } from '@/components/confirm-action';
import { ShareJobDialog } from '@/components/jobfeed/share-job-dialog';
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
import { Input } from '@/components/ui/input';
import {
  useJobFeed,
  useDeleteJob,
  useJobFeedCounts,
  useMarkAllJobsRead,
  useSetItemState,
} from '@/hooks/use-jobfeed';
import { useAuthStore } from '@/lib/auth-store';
import { formatRelative } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/roles';
import type { Role } from '@/types/api';
import {
  SOURCE_LABELS,
  WORKPLACE_LABELS,
  WORKPLACE_ORDER,
  WORKPLACE_VARIANT,
  jobSubtitle,
} from '@/lib/jobfeed';
import { cn } from '@/lib/utils';
import type { JobFeedItem, WorkplaceType } from '@/types/jobfeed';

/**
 * One person's job feed.
 *
 * Everything here is private to the signed-in individual — the API scopes by
 * row, so there is no "whose feed" selector and no way to ask for anyone
 * else's.
 */

function JobCard({ item }: { item: JobFeedItem }) {
  const state = useSetItemState(item.id);
  const remove = useDeleteJob();
  const can = useAuthStore((store) => store.can);

  return (
    <Card className={cn(!item.is_read && 'border-l-4 border-l-primary')}>
      <CardContent className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={WORKPLACE_VARIANT[item.workplace_type]}>
              {WORKPLACE_LABELS[item.workplace_type]}
            </Badge>
            <Badge variant="outline">{SOURCE_LABELS[item.source]}</Badge>
            {!item.is_read ? (
              <span className="text-2xs font-medium uppercase tracking-wide text-primary">New</span>
            ) : null}
          </div>

          <p className={cn('mt-1.5 text-sm', !item.is_read && 'font-medium')}>{item.title}</p>
          {jobSubtitle(item.company_name, item.location) ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {jobSubtitle(item.company_name, item.location)}
            </p>
          ) : null}
          {item.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
          ) : null}
          <p className="mt-1 text-2xs text-muted-foreground">
            {formatRelative(item.received_at)}
          </p>

          {item.shared_by_name ? (
            <div className="mt-2 rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1.5">
              <p className="text-2xs">
                <Send className="mr-1 inline h-3 w-3 align-[-2px] text-accent" aria-hidden />
                Shared by{' '}
                <span className="font-medium">{item.shared_by_name}</span>
                {item.shared_by_role
                  ? ` · ${ROLE_LABELS[item.shared_by_role as Role] ?? item.shared_by_role}`
                  : ''}
              </p>
              {item.share_note ? (
                <p className="mt-0.5 text-2xs italic text-muted-foreground">
                  &ldquo;{item.share_note}&rdquo;
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {item.url ? (
            <Button variant="outline" size="sm" asChild>
              <a href={item.url} target="_blank" rel="noreferrer noopener">
                <ExternalLink aria-hidden />
                Open
              </a>
            </Button>
          ) : null}
          {can('job_feed:share') ? (
            <ShareJobDialog
              itemId={item.id}
              jobTitle={item.title}
              trigger={
                <Button variant="outline" size="sm" aria-label={`Share ${item.title}`}>
                  <Send aria-hidden />
                  Share
                </Button>
              }
            />
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            disabled={state.isPending}
            onClick={() => state.mutate({ is_saved: !item.is_saved })}
            aria-pressed={item.is_saved}
            aria-label={item.is_saved ? `Unsave ${item.title}` : `Save ${item.title}`}
          >
            {item.is_saved ? (
              <BookmarkCheck className="text-primary" aria-hidden />
            ) : (
              <Bookmark aria-hidden />
            )}
          </Button>
          {can('job_feed:write') ? (
            <ConfirmAction
              label={`Remove ${item.title}`}
              confirmLabel="Remove?"
              iconOnly
              isPending={remove.isPending}
              successMessage="Removed from your feed."
              errorMessage="That could not be removed."
              onConfirm={() => remove.mutateAsync(item.id)}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function JobFeed({
  savedOnly = false,
  sharedOnly = false,
}: { savedOnly?: boolean; sharedOnly?: boolean } = {}) {
  const can = useAuthStore((state) => state.can);

  const [workplace, setWorkplace] = React.useState<WorkplaceType | ''>('');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [addOpen, setAddOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const feed = useJobFeed({
    workplace_type: workplace,
    unread_only: unreadOnly,
    saved_only: savedOnly,
    shared_only: sharedOnly,
    q: query,
  });
  const counts = useJobFeedCounts({ saved_only: savedOnly, shared_only: sharedOnly });
  const markAll = useMarkAllJobsRead();

  if (!can('job_feed:read')) return <PermissionDeniedState />;

  const items = feed.data?.items ?? [];
  const isFiltered = Boolean(workplace || query || unreadOnly);
  const unread = counts.data?.unread ?? 0;

  return (
    <>
      <PageHeader
        title={sharedOnly ? 'Shared with me' : savedOnly ? 'Saved jobs' : 'Your job feed'}
        description={
          sharedOnly
            ? 'Jobs a colleague passed across. Add one here to send it the other way.'
            : savedOnly
              ? 'The roles you kept. Private to you.'
              : 'Jobs that reached you, newest first. Only you can see this feed.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {!savedOnly && !sharedOnly && unread > 0 ? (
              <Button
                variant="outline"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                <CheckCheck aria-hidden />
                Mark all read
              </Button>
            ) : null}
            {can('job_feed:share') && sharedOnly ? (
              <Button onClick={() => setAddOpen(true)}>
                <Plus aria-hidden />
                Add a job
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search title or company…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
              aria-label="Search your feed"
            />
            {!savedOnly && !sharedOnly ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(event) => setUnreadOnly(event.target.checked)}
                  className="h-4 w-4"
                />
                Unread only
              </label>
            ) : null}

          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={workplace === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setWorkplace('')}
              aria-pressed={workplace === ''}
            >
              All
              {counts.data ? (
                <span className="ml-1 tabular opacity-70">{counts.data.total}</span>
              ) : null}
            </Button>
            {WORKPLACE_ORDER.map((value) => (
              <Button
                key={value}
                variant={workplace === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWorkplace(value)}
                aria-pressed={workplace === value}
              >
                {WORKPLACE_LABELS[value]}
                {counts.data ? (
                  <span className="ml-1 tabular opacity-70">{counts.data[value]}</span>
                ) : null}
              </Button>
            ))}
          </div>

          {workplace === 'UNKNOWN' ? (
            <p className="text-xs text-muted-foreground">
              These are jobs whose source never said whether the role is onsite, remote or
              hybrid. They are kept separate rather than guessed at.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {feed.isError ? (
        <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
      ) : feed.isLoading ? (
        <TableLoadingState rows={4} columns={3} />
      ) : items.length === 0 ? (
        isFiltered ? (
          <NoResultsState
            onClear={() => {
              setWorkplace('');
              setSearch('');
              setUnreadOnly(false);
            }}
          />
        ) : sharedOnly ? (
          <EmptyState
            title="Nothing shared with you yet"
            description="When Sales or Resourcing passes a job across, it lands here with a note about who sent it. Found one off-platform? Add it here and it goes straight to them."
            action={
              can('job_feed:share') ? (
                <Button onClick={() => setAddOpen(true)}>
                  <Plus aria-hidden />
                  Add a job
                </Button>
              ) : undefined
            }
          />
        ) : savedOnly ? (
          <EmptyState
            title="Nothing saved yet"
            description="Jobs you save from your feed appear here."
          />
        ) : (
          <EmptyState
            title="No jobs yet"
            description="Search the open market and save what is worth keeping. A job found off-platform is added from Shared with me, so it reaches the team rather than only you."
          />
        )
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <JobCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {feed.data && feed.data.total > items.length ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Showing {items.length} of {feed.data.total}
        </p>
      ) : null}

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
