'use client';

import { ChevronDown, GitCompareArrows, Play, RefreshCw, Sliders } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { MatchExplanation, MatchScore } from '@/components/matching/match-explanation';
import { PageHeader } from '@/components/layout/page-header';
import {
  EmptyState,
  ErrorState,
  InlineWarning,
  LoadingState,
  NoResultsState,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useMatches, useRunMatching, type MatchFilters } from '@/hooks/use-matching';
import { useRequirements } from '@/hooks/use-requirements';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatRelative, pluralize } from '@/lib/format';
import { BAND_LABELS, BAND_ORDER, BAND_VARIANT, countByBand, hasBlocker } from '@/lib/matching';
import { cn } from '@/lib/utils';
import type { Match, MatchBand } from '@/types/matching';

/**
 * Demand → Resource matching.
 *
 * Two design rules run through the screen:
 *
 * 1. Matching is **explicit**. Opening this page never recomputes anything; it
 *    shows the last stored snapshot and says how old it is (AD-4). Recompute is
 *    a button, and it is audited.
 * 2. No row shows a bare percentage. Every match is expandable into the full
 *    component breakdown, and the collapsed row still carries the band, the
 *    evidence level and any blocker.
 */

function MatchRow({
  match,
  requirementId,
  defaultOpen,
}: {
  match: Match;
  requirementId: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(Boolean(defaultOpen));
  const blocked = hasBlocker(match);
  const headingId = `match-${match.resource_id}`;

  return (
    <Card className={cn(blocked && 'border-warning/50')}>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                id={headingId}
                href={`/talent/resources/${match.resource_id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {match.resource_name ?? 'Unnamed resource'}
              </Link>
              {match.availability_status ? (
                <Badge variant="muted">{match.availability_status.replace(/_/g, ' ')}</Badge>
              ) : null}
              {blocked ? <Badge variant="warning">Needs attention</Badge> : null}
            </div>
            {match.resource_headline ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {match.resource_headline}
              </p>
            ) : null}
            {match.gaps.length > 0 ? (
              <p className="mt-1 text-xs text-destructive">
                Missing {match.gaps.slice(0, 3).join(', ')}
                {match.gaps.length > 3 ? ` +${match.gaps.length - 3} more` : ''}
              </p>
            ) : null}
          </div>

          <MatchScore match={match} />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={`${headingId}-detail`}
          >
            <ChevronDown
              aria-hidden
              className={cn('transition-transform', open && 'rotate-180')}
            />
            {open ? 'Hide' : 'Explain'}
          </Button>
        </div>

        {open ? (
          <div
            id={`${headingId}-detail`}
            role="region"
            aria-labelledby={headingId}
            className="border-t bg-muted/20 p-4"
          >
            <MatchExplanation match={match} />
            <p className="mt-4 text-2xs text-muted-foreground">
              Scored by engine {match.engine_version}
              {match.weights_version ? ` on rule set v${match.weights_version}` : ''} ·{' '}
              {formatDateTime(match.computed_at)} ·{' '}
              <Link
                href={`/demand/requirements/${requirementId}`}
                className="underline underline-offset-4"
              >
                View requirement
              </Link>
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BandSummary({ matches }: { matches: Match[] }) {
  const counts = countByBand(matches);
  return (
    <div className="flex flex-wrap gap-2">
      {BAND_ORDER.map((band) => (
        <Badge key={band} variant={counts[band] > 0 ? BAND_VARIANT[band] : 'muted'}>
          <span className="tabular">{counts[band]}</span> {BAND_LABELS[band].toLowerCase()}
        </Badge>
      ))}
    </div>
  );
}

export function MatchingWorkbench() {
  const can = useAuthStore((state) => state.can);
  const [requirementId, setRequirementId] = React.useState('');
  const [filters, setFilters] = React.useState<MatchFilters>({ band: '', min_score: '' });

  const requirements = useRequirements({ page: 1, page_size: 100, open_only: true });
  const matches = useMatches(requirementId || undefined, filters);
  const run = useRunMatching(requirementId);

  const canRun = can('matching:run');

  // Select the first open requirement once, so the screen is useful on arrival
  // without silently changing the user's choice later.
  React.useEffect(() => {
    const first = requirements.data?.items[0];
    if (!requirementId && first) setRequirementId(first.id);
  }, [requirements.data, requirementId]);

  if (!can('matching:read')) return <PermissionDeniedState />;

  const isFiltered = Boolean(filters.band || filters.min_score);
  const data = matches.data;
  const neverRun = Boolean(data && data.computed_at === null);

  return (
    <>
      <PageHeader
        title="Requirement Matching"
        description="Demand → Resource. Every match carries the components, gaps and warnings behind its score — a percentage on its own is not something you can put in front of a client."
        actions={
          canRun && requirementId ? (
            <Button onClick={() => run.mutate(25)} disabled={run.isPending}>
              {run.isPending ? (
                <RefreshCw className="animate-spin" aria-hidden />
              ) : (
                <Play aria-hidden />
              )}
              {neverRun ? 'Run matching' : 'Re-run matching'}
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Requirement</span>
            <Select
              value={requirementId}
              onChange={(event) => setRequirementId(event.target.value)}
              disabled={requirements.isLoading}
            >
              <option value="">Select a requirement…</option>
              {requirements.data?.items.map((requirement) => (
                <option key={requirement.id} value={requirement.id}>
                  {requirement.title}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Band</span>
            <Select
              value={filters.band ?? ''}
              onChange={(event) =>
                setFilters((current) => ({ ...current, band: event.target.value as MatchBand | '' }))
              }
            >
              <option value="">All bands</option>
              {BAND_ORDER.map((band) => (
                <option key={band} value={band}>
                  {BAND_LABELS[band]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Minimum score</span>
            <Select
              value={String(filters.min_score ?? '')}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  min_score: event.target.value === '' ? '' : Number(event.target.value),
                }))
              }
            >
              <option value="">Any score</option>
              <option value="80">80 and above</option>
              <option value="65">65 and above</option>
              <option value="50">50 and above</option>
            </Select>
          </label>

          {isFiltered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ band: '', min_score: '' })}
            >
              Clear filters
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {requirements.isError ? (
        <ErrorState error={requirements.error} onRetry={() => void requirements.refetch()} />
      ) : requirements.isLoading ? (
        <LoadingState label="Loading requirements…" />
      ) : !requirements.data?.items.length ? (
        <EmptyState
          title="No open requirements to match against"
          description="Matching starts from demand. Capture a requirement first — paste a JD or enter one manually — and it will appear here."
          action={
            <Button asChild>
              <Link href="/demand/requirements/new">Add a requirement</Link>
            </Button>
          }
        />
      ) : !requirementId ? (
        <EmptyState
          title="Choose a requirement"
          description="Pick one above to see who Glimmora can put forward, and why."
        />
      ) : matches.isError ? (
        <ErrorState error={matches.error} onRetry={() => void matches.refetch()} />
      ) : matches.isLoading ? (
        <TableLoadingState rows={4} columns={3} />
      ) : neverRun ? (
        <EmptyState
          title="Matching has not been run for this requirement"
          description={
            canRun
              ? 'Nothing is computed in the background. Run matching to score the talent cloud against this requirement — the run is recorded in the audit log.'
              : 'Nothing is computed in the background, and your role cannot start a run. Ask Sales or Resourcing to run matching for this requirement.'
          }
          action={
            canRun ? (
              <Button onClick={() => run.mutate(25)} disabled={run.isPending}>
                <Play aria-hidden />
                Run matching
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BandSummary matches={data?.matches ?? []} />
            <p className="text-xs text-muted-foreground">
              {data?.total ?? 0} {pluralize(data?.total ?? 0, 'match', 'matches')} · computed{' '}
              {formatRelative(data?.computed_at)}
              {data?.weights_version ? ` on rule set v${data.weights_version}` : ''}
            </p>
          </div>

          {run.isError ? <ErrorState error={run.error} /> : null}

          <InlineWarning>
            These are ranked suggestions, not a decision. The engine scores what has been recorded —
            a human decides who goes forward, and every warning below has to be cleared first.
          </InlineWarning>

          {data && data.matches.length === 0 ? (
            isFiltered ? (
              <NoResultsState onClear={() => setFilters({ band: '', min_score: '' })} />
            ) : (
              <EmptyState
                title="No resource in the talent cloud fits this requirement"
                description="Matching ran and returned nothing. Either the mandatory skills are not held by anyone reviewed, or the experience bar excludes the pool. Widening the requirement or accepting a parsed profile will change this."
              />
            )
          ) : (
            <div className="space-y-3">
              {data?.matches.map((match, index) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  requirementId={requirementId}
                  defaultOpen={index === 0}
                />
              ))}
            </div>
          )}

          <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Sliders className="h-3 w-3" aria-hidden />
            Weights are configuration, not code. An administrator can publish a new rule set and
            re-run without a deploy.
            <GitCompareArrows className="h-3 w-3" aria-hidden />
          </p>
        </div>
      )}
    </>
  );
}
