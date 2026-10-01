'use client';

import { Bookmark, BookmarkCheck, CheckCheck, ExternalLink, Plus } from 'lucide-react';
import * as React from 'react';

import { AddJobDialog } from '@/components/jobfeed/add-job-dialog';
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
  useJobFeedCounts,
  useMarkAllJobsRead,
  useSetItemState,
} from '@/hooks/use-jobfeed';
import { useAuthStore } from '@/lib/auth-store';
import { formatRelative } from '@/lib/format';
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
        </div>
      </CardContent>
    </Card>
  );
}

export function JobFeed({ savedOnly = false }: { savedOnly?: boolean } = {}) {
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
    q: query,
  });
  const counts = useJobFeedCounts();
  const markAll = useMarkAllJobsRead();

  if (!can('job_feed:read')) return <PermissionDeniedState />;

  const items = feed.data?.items ?? [];
  const isFiltered = Boolean(workplace || query || unreadOnly);
  const unread = counts.data?.unread ?? 0;

  return (
    <>
      <PageHeader
        title={savedOnly ? 'Saved jobs' : 'Your job feed'}
        description={
          savedOnly
            ? 'The roles you kept. Private to you.'
            : 'Jobs that reached you, newest first. Only you can see this feed.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {!savedOnly && unread > 0 ? (
              <Button
                variant="outline"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                <CheckCheck aria-hidden />
                Mark all read
              </Button>
            ) : null}
            {can('job_feed:write') ? (
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
            {!savedOnly ? (
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
        ) : savedOnly ? (
          <EmptyState
            title="Nothing saved yet"
            description="Jobs you save from your feed appear here."
          />
        ) : (
          <EmptyState
            title="No jobs yet"
            description="Once your LinkedIn alerts are connected they will arrive here. In the meantime you can add a job you found elsewhere."
            action={
              can('job_feed:write') ? (
                <Button onClick={() => setAddOpen(true)}>
                  <Plus aria-hidden />
                  Add a job
                </Button>
              ) : undefined
            }
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
