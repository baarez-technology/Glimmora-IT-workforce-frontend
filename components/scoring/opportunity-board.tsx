'use client';

import { ChevronDown, Play, RefreshCw, Target } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { ScoreExplanation, ScoreHeadline } from '@/components/scoring/score-explanation';
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
import { useRecomputeScore, useScoreExplanation, useOpportunityBoard } from '@/hooks/use-scoring';
import { useRequirements } from '@/hooks/use-requirements';
import { useAuthStore } from '@/lib/auth-store';
import { formatRelative, formatScore } from '@/lib/format';
import {
  OPPORTUNITY_BAND_LABELS,
  OPPORTUNITY_BAND_ORDER,
  OPPORTUNITY_BAND_VARIANT,
} from '@/lib/scoring';
import { cn } from '@/lib/utils';
import type { OpportunityBand, OpportunityScoreResult } from '@/types/scoring';

/**
 * Opportunity scoring — the question the SOW says the platform exists to answer:
 * *should Glimmora pursue this at all?*
 *
 * Talent match alone is what off-the-shelf staffing tools measure. Composing it
 * with whether we can reach the client and whether the money works is the
 * product, so the board leads with the composite and every row expands into the
 * factors behind it.
 */

function ScoreRow({ result, canRun }: { result: OpportunityScoreResult; canRun: boolean }) {
  const [open, setOpen] = React.useState(false);
  const recompute = useRecomputeScore(result.requirement_id);
  const headingId = `score-${result.requirement_id}`;

  return (
    <Card className={cn(result.suppressors.length > 0 && 'border-warning/50')}>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <Link
              id={headingId}
              href={`/demand/requirements/${result.requirement_id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {result.requirement_title ?? 'Untitled requirement'}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Talent {formatScore(result.talent_match_score)}</span>
              <span>Addressability {formatScore(result.addressability_score)}</span>
              <span>Commercial {formatScore(result.commercial_score)}</span>
            </div>
            {result.suppressors.length > 0 ? (
              <p className="mt-1 text-xs text-warning">{result.suppressors[0]}</p>
            ) : null}
          </div>

          <div className="text-right">
            <div className="text-2xl font-semibold tabular leading-none">
              {formatScore(result.score)}
            </div>
            <Badge variant={OPPORTUNITY_BAND_VARIANT[result.band]} className="mt-1">
              {OPPORTUNITY_BAND_LABELS[result.band]}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {canRun ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => recompute.mutate()}
                disabled={recompute.isPending}
                aria-label={`Recompute ${result.requirement_title ?? 'this requirement'}`}
              >
                <RefreshCw className={cn(recompute.isPending && 'animate-spin')} aria-hidden />
              </Button>
            ) : null}
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
        </div>

        {open ? (
          <div
            id={`${headingId}-detail`}
            role="region"
            aria-labelledby={headingId}
            className="border-t bg-muted/20 p-4"
          >
            <ScoreExplanation result={result} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Single-requirement view, used from the requirement detail page. */
export function RequirementScore({ requirementId }: { requirementId: string }) {
  const can = useAuthStore((state) => state.can);
  const explanation = useScoreExplanation(requirementId);
  const recompute = useRecomputeScore(requirementId);

  if (!can('scoring:read')) return null;

  if (explanation.isLoading) return <LoadingState label="Scoring…" />;
  if (explanation.isError) {
    return <ErrorState error={explanation.error} onRetry={() => void explanation.refetch()} />;
  }
  if (!explanation.data) return null;

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <ScoreHeadline result={explanation.data} />
          {can('scoring:run') ? (
            <Button onClick={() => recompute.mutate()} disabled={recompute.isPending}>
              {recompute.isPending ? (
                <RefreshCw className="animate-spin" aria-hidden />
              ) : (
                <Play aria-hidden />
              )}
              Recompute
            </Button>
          ) : null}
        </div>
        <ScoreExplanation result={explanation.data} />
      </CardContent>
    </Card>
  );
}

export function OpportunityBoard() {
  const can = useAuthStore((state) => state.can);
  const [band, setBand] = React.useState<OpportunityBand | ''>('');

  const board = useOpportunityBoard(band);
  const requirements = useRequirements({ page: 1, page_size: 100, open_only: true });

  if (!can('scoring:read')) return <PermissionDeniedState />;

  const canRun = can('scoring:run');
  const rows = board.data ?? [];
  const scoredIds = new Set(rows.map((row) => row.requirement_id));
  const unscored = (requirements.data?.items ?? []).filter((item) => !scoredIds.has(item.id));

  return (
    <>
      <PageHeader
        title="Opportunity Scoring"
        description="Talent match, addressability and commercial value composed into one number — the answer to whether Glimmora should pursue this at all. Every score expands into the factors that produced it."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Band</span>
            <Select value={band} onChange={(event) => setBand(event.target.value as OpportunityBand | '')}>
              <option value="">All bands</option>
              {OPPORTUNITY_BAND_ORDER.map((value) => (
                <option key={value} value={value}>
                  {OPPORTUNITY_BAND_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
          {band ? (
            <Button variant="ghost" size="sm" onClick={() => setBand('')}>
              Clear filter
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {board.isError ? (
        <ErrorState error={board.error} onRetry={() => void board.refetch()} />
      ) : board.isLoading ? (
        <TableLoadingState rows={5} columns={4} />
      ) : rows.length === 0 ? (
        band ? (
          <NoResultsState onClear={() => setBand('')} />
        ) : (
          <EmptyState
            title="Nothing has been scored yet"
            description="Scoring is explicit — nothing is computed in the background. Open a requirement and recompute its score, or run matching first so the talent component has something to read."
            action={
              <Button asChild>
                <Link href="/demand/requirements">Go to requirements</Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="space-y-4">
          <InlineWarning>
            A score is advice, not a decision. It says what the recorded facts support — a human
            decides whether to pursue, and the recommended action names what to fix first.
          </InlineWarning>

          <div className="space-y-3">
            {rows.map((result) => (
              <ScoreRow key={result.requirement_id} result={result} canRun={canRun} />
            ))}
          </div>

          {unscored.length > 0 ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {unscored.length} open requirement{unscored.length === 1 ? '' : 's'} not scored yet
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  These have never been through the scoring engine, so they are absent from the
                  board rather than ranked at zero.
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {unscored.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/demand/requirements/${item.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <p className="text-2xs text-muted-foreground">
            Scores are snapshots — recomputing appends a new one rather than overwriting, so a past
            decision stays explainable. Last board refresh {formatRelative(rows[0]?.computed_at)}.
          </p>
        </div>
      )}
    </>
  );
}
