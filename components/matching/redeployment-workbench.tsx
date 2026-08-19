'use client';

import { ChevronDown, Play, RefreshCw, Route as RouteIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { MatchExplanation, MatchScore } from '@/components/matching/match-explanation';
import {
  EmptyState,
  ErrorState,
  InlineWarning,
  LoadingState,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useReverseMatches, useRunReverseMatching } from '@/hooks/use-matching';
import { useResources } from '@/hooks/use-talent';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate, formatRelative, formatScore, pluralize } from '@/lib/format';
import { ROUTE_LABELS, ROUTE_VARIANT, reachabilityNote } from '@/lib/matching';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/types/matching';

/**
 * Resource → Demand: where does this consultant go next?
 *
 * Ranked by **redeployment priority** — match quality discounted by whether the
 * seat is actually winnable — rather than by fit alone. A 94% match at an
 * account nobody can reach is not a 94% opportunity, and ranking it first would
 * send Resourcing chasing a door that does not open.
 */

function RouteBadge({ suggestion }: { suggestion: Suggestion }) {
  const { route } = suggestion;
  return (
    <Badge variant={ROUTE_VARIANT[route.route_type]}>
      <RouteIcon className="h-3 w-3" aria-hidden />
      {route.label ?? ROUTE_LABELS[route.route_type]}
    </Badge>
  );
}

function SuggestionRow({ suggestion, rank }: { suggestion: Suggestion; rank: number }) {
  const [open, setOpen] = React.useState(rank === 0);
  const headingId = `suggestion-${suggestion.id}`;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <span className="text-lg font-semibold tabular text-muted-foreground" aria-hidden>
            {rank + 1}
          </span>

          <div className="min-w-0 flex-1">
            <Link
              id={headingId}
              href={`/demand/requirements/${suggestion.requirement_id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {suggestion.requirement_title ?? 'Untitled requirement'}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <RouteBadge suggestion={suggestion} />
            </div>
            {suggestion.gaps.length > 0 ? (
              <p className="mt-1 text-xs text-destructive">
                Missing {suggestion.gaps.slice(0, 3).join(', ')}
              </p>
            ) : null}
          </div>

          <div className="text-right">
            <div className="text-2xl font-semibold tabular leading-none">
              {formatScore(suggestion.priority_score)}
            </div>
            <div className="text-2xs text-muted-foreground">redeployment priority</div>
          </div>

          <MatchScore match={suggestion} />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={`${headingId}-detail`}
          >
            <ChevronDown aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
            {open ? 'Hide' : 'Explain'}
          </Button>
        </div>

        {open ? (
          <div
            id={`${headingId}-detail`}
            role="region"
            aria-labelledby={headingId}
            className="space-y-4 border-t bg-muted/20 p-4"
          >
            <div className="rounded-md border bg-background p-3">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Route to this seat
              </h4>
              <p className="text-sm">{suggestion.route.label ?? 'Not recorded'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {reachabilityNote(suggestion.route)}
              </p>
              <p className="mt-2 text-2xs text-muted-foreground">
                Priority = match {formatScore(suggestion.overall_score)}
                {suggestion.route.reachability !== null
                  ? ` × reachability ${suggestion.route.reachability}`
                  : ' (not adjusted — no account recorded)'}{' '}
                = {formatScore(suggestion.priority_score)}
              </p>
            </div>

            <MatchExplanation match={suggestion} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RedeploymentWorkbench({ resourceId: initialId }: { resourceId?: string } = {}) {
  const can = useAuthStore((state) => state.can);
  const [resourceId, setResourceId] = React.useState(initialId ?? '');

  const resources = useResources({ page: 1, page_size: 100 });
  const run = useRunReverseMatching(resourceId);
  const suggestions = useReverseMatches(resourceId || undefined);

  React.useEffect(() => {
    const first = resources.data?.items[0];
    if (!resourceId && first) setResourceId(first.id);
  }, [resources.data, resourceId]);

  if (!can('reverse_matching:read')) return <PermissionDeniedState />;

  const canRun = can('reverse_matching:run');
  const data = suggestions.data;
  const neverRun = Boolean(data && data.computed_at === null);

  return (
    <>
      <PageHeader
        title="Reverse Matching"
        description="Where does this consultant go next? Ranked by redeployment priority — how well they fit, discounted by whether the seat is actually reachable — with the route to each one named."
        actions={
          canRun && resourceId ? (
            <Button onClick={() => run.mutate(10)} disabled={run.isPending}>
              {run.isPending ? <RefreshCw className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              {neverRun ? 'Find next assignments' : 'Refresh'}
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex min-w-[18rem] flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Consultant</span>
            <Select
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
              disabled={resources.isLoading}
            >
              <option value="">Select a consultant…</option>
              {resources.data?.items.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.full_name}
                </option>
              ))}
            </Select>
          </label>

          {data ? (
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Availability</div>
              <div className="font-medium">
                {data.availability_status.replace(/_/g, ' ').toLowerCase()}
                {data.available_from ? ` — free ${formatDate(data.available_from)}` : ''}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {resources.isError ? (
        <ErrorState error={resources.error} onRetry={() => void resources.refetch()} />
      ) : resources.isLoading ? (
        <LoadingState label="Loading consultants…" />
      ) : !resources.data?.items.length ? (
        <EmptyState
          title="No consultants in the talent cloud yet"
          description="Redeployment starts from people. Add a consultant or parse a CV, and this screen will show where they can go next."
          action={
            <Button asChild>
              <Link href="/talent/resources">Go to the talent cloud</Link>
            </Button>
          }
        />
      ) : !resourceId ? (
        <EmptyState title="Choose a consultant" description="Pick one above to see their next billable options." />
      ) : suggestions.isError ? (
        <ErrorState error={suggestions.error} onRetry={() => void suggestions.refetch()} />
      ) : suggestions.isLoading ? (
        <TableLoadingState rows={4} columns={3} />
      ) : neverRun ? (
        <EmptyState
          title="No next assignments found yet for this consultant"
          description={
            canRun
              ? 'Nothing is computed in the background. Run the search to rank every open requirement against this person — the run is recorded in the audit log.'
              : 'Nothing is computed in the background, and your role cannot start a search. Ask Resourcing to run it.'
          }
          action={
            canRun ? (
              <Button onClick={() => run.mutate(10)} disabled={run.isPending}>
                <Play aria-hidden />
                Find next assignments
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong className="tabular">{data?.total ?? 0}</strong>{' '}
              {pluralize(data?.total ?? 0, 'option', 'options')} for {data?.resource_name}
            </p>
            <p className="text-xs text-muted-foreground">
              Computed {formatRelative(data?.computed_at)}
            </p>
          </div>

          {run.isError ? <ErrorState error={run.error} /> : null}

          <InlineWarning>
            Priority is match quality discounted by how reachable the account is. It is not the
            Opportunity Score — that composes addressability and commercial value, and arrives in
            Phase 9.
          </InlineWarning>

          {data && data.suggestions.length === 0 ? (
            <EmptyState
              title="No open requirement currently fits this consultant"
              description="The search ran and found nothing. This person needs a seat found manually, or the pipeline needs more open demand in their discipline — either way it is a human decision now, not a system gap."
            />
          ) : (
            <div className="space-y-3">
              {data?.suggestions.map((suggestion, index) => (
                <SuggestionRow key={suggestion.id} suggestion={suggestion} rank={index} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
