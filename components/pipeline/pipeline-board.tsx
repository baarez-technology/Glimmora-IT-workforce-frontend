'use client';

import { AlertTriangle, ArrowRight, ChevronDown, MessageSquare, UserX } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { CommunicationLog, DecisionForm } from '@/components/pipeline/opportunity-detail';
import {
  EmptyState,
  ErrorState,
  InlineWarning,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  useChangeStage,
  useOpportunityHistory,
  usePipelineBoard,
  usePipelineStages,
} from '@/hooks/use-pipeline';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatMoney, formatRelative } from '@/lib/format';
import {
  DECISION_LABELS,
  DECISION_VARIANT,
  STAGE_LABELS,
  funnelCounts,
  groupByStage,
  isOverdue,
  isUnowned,
  stageVariant,
} from '@/lib/pipeline';
import { cn } from '@/lib/utils';
import type { Opportunity, OpportunityStage } from '@/types/pipeline';

/**
 * The 12-stage sales pipeline (SOW section 10).
 *
 * A board's real job is not to look like a funnel — it is to show what has
 * stalled. Overdue next actions and unowned open work are surfaced above the
 * columns, because those are the rows somebody has to touch today.
 */

function StageMoveForm({
  opportunity,
  stages,
  onDone,
}: {
  opportunity: Opportunity;
  stages: { value: OpportunityStage; label: string; is_terminal: boolean }[];
  onDone: () => void;
}) {
  const [stage, setStage] = React.useState<OpportunityStage>(
    opportunity.next_stage ?? 'QUALIFIED',
  );
  const [note, setNote] = React.useState('');
  const change = useChangeStage(opportunity.id);

  const selected = stages.find((item) => item.value === stage);
  const needsReason = Boolean(selected?.is_terminal);

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`stage-${opportunity.id}`}>Move to</Label>
          <Select
            id={`stage-${opportunity.id}`}
            value={stage}
            onChange={(event) => setStage(event.target.value as OpportunityStage)}
          >
            {stages
              .filter((item) => item.value !== opportunity.stage)
              .map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`note-${opportunity.id}`}>
            {needsReason ? 'Reason (required)' : 'Note'}
          </Label>
          <Input
            id={`note-${opportunity.id}`}
            value={note}
            placeholder={needsReason ? 'Why was it lost or dropped?' : 'Optional'}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={needsReason && !note.trim()}
          />
        </div>
      </div>

      {needsReason ? (
        <p className="text-xs text-muted-foreground">
          Closing needs a reason — a lost deal with no explanation teaches nobody anything.
        </p>
      ) : null}

      {change.isError ? <ErrorState error={change.error} /> : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={change.isPending || (needsReason && !note.trim())}
          onClick={() =>
            change.mutate(
              { stage, note: note.trim() || undefined },
              { onSuccess: onDone },
            )
          }
        >
          Move stage
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function OpportunityCard({
  opportunity,
  stages,
  canWrite,
}: {
  opportunity: Opportunity;
  stages: { value: OpportunityStage; label: string; is_terminal: boolean }[];
  canWrite: boolean;
}) {
  const [moving, setMoving] = React.useState(false);
  const [showDetail, setShowDetail] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const history = useOpportunityHistory(showHistory ? opportunity.id : undefined);

  const overdue = isOverdue(opportunity);

  return (
    <Card className={cn(overdue && 'border-destructive/50')}>
      <CardContent className="space-y-2 p-3">
        <Link
          href={`/demand/requirements/${opportunity.requirement_id}`}
          className="block text-sm font-medium underline-offset-4 hover:underline"
        >
          {opportunity.requirement_title ?? 'Untitled requirement'}
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          {opportunity.decision ? (
            <Badge variant={DECISION_VARIANT[opportunity.decision]}>
              {DECISION_LABELS[opportunity.decision]}
            </Badge>
          ) : null}
          {opportunity.submission_count > 0 ? (
            <Badge variant="outline">
              {opportunity.submission_count} submission
              {opportunity.submission_count === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {isUnowned(opportunity) ? (
            <Badge variant="warning">
              <UserX className="h-3 w-3" aria-hidden />
              No owner
            </Badge>
          ) : null}
        </div>

        {opportunity.next_action ? (
          <p className={cn('text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>
            {opportunity.next_action}
            {opportunity.next_action_due_at
              ? ` — ${overdue ? 'overdue' : 'due'} ${formatRelative(opportunity.next_action_due_at)}`
              : ''}
          </p>
        ) : opportunity.is_open ? (
          <p className="text-xs text-muted-foreground">No next action set</p>
        ) : null}

        {opportunity.contract_value ? (
          <p className="text-xs tabular text-muted-foreground">
            {formatMoney(opportunity.contract_value, opportunity.currency, { compact: true })}
          </p>
        ) : opportunity.restricted_fields.length > 0 ? (
          <p className="text-2xs text-muted-foreground">Commercial figures hidden by your role</p>
        ) : null}

        {!opportunity.is_open && opportunity.closed_reason ? (
          <p className="text-xs text-muted-foreground">
            Closed: {opportunity.closed_reason}
          </p>
        ) : null}

        {moving ? (
          <StageMoveForm
            opportunity={opportunity}
            stages={stages}
            onDone={() => setMoving(false)}
          />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {canWrite ? (
              <Button variant="outline" size="sm" onClick={() => setMoving(true)}>
                <ArrowRight aria-hidden />
                {opportunity.next_stage
                  ? `Move to ${STAGE_LABELS[opportunity.next_stage]}`
                  : 'Change stage'}
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetail((value) => !value)}
                aria-expanded={showDetail}
              >
                <MessageSquare aria-hidden />
                Decide &amp; log
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((value) => !value)}
              aria-expanded={showHistory}
            >
              <ChevronDown
                aria-hidden
                className={cn('transition-transform', showHistory && 'rotate-180')}
              />
              History
            </Button>
          </div>
        )}

        {showDetail ? (
          <div className="space-y-2">
            <DecisionForm opportunity={opportunity} />
            <CommunicationLog opportunityId={opportunity.id} />
          </div>
        ) : null}

        {showHistory ? (
          history.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <ol className="space-y-1 border-t pt-2 text-2xs text-muted-foreground">
              {history.data?.map((entry, index) => (
                <li key={`${entry.created_at}-${index}`}>
                  {entry.from_stage ? `${STAGE_LABELS[entry.from_stage]} → ` : ''}
                  <span className="font-medium text-foreground">
                    {STAGE_LABELS[entry.to_stage]}
                  </span>{' '}
                  · {formatDateTime(entry.created_at)}
                  {entry.note ? ` · ${entry.note}` : ''}
                </li>
              ))}
            </ol>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PipelineBoard() {
  const can = useAuthStore((state) => state.can);
  const [mine, setMine] = React.useState(false);
  const [showClosed, setShowClosed] = React.useState(false);

  const stages = usePipelineStages();
  const board = usePipelineBoard(mine);

  if (!can('opportunity:read')) return <PermissionDeniedState />;

  const canWrite = can('opportunity:write');
  const all = board.data ?? [];
  const counts = funnelCounts(all);

  // Columns hide terminal stages unless asked for; the *move* form always
  // offers them, because closing an opportunity must not depend on a display
  // filter.
  const visibleStages = (stages.data ?? []).filter((stage) => showClosed || !stage.is_terminal);
  const columns = groupByStage(
    all.filter((item) => showClosed || item.is_open),
    visibleStages,
  );

  return (
    <>
      <PageHeader
        title="Sales Pipeline"
        description="Requirement identified through to billing. The board exists to show what has stalled — overdue next actions and unowned work come first."
      />

      {board.isError ? (
        <ErrorState error={board.error} onRetry={() => void board.refetch()} />
      ) : board.isLoading || stages.isLoading ? (
        <TableLoadingState rows={4} columns={5} />
      ) : all.length === 0 ? (
        <EmptyState
          title="Nothing in the pipeline yet"
          description="An opportunity opens when you decide to pursue a requirement — or automatically the first time you put a consultant forward for it."
          action={
            <Button asChild>
              <Link href="/demand/requirements">Go to requirements</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Open opportunities</div>
                <div className="mt-1 text-2xl font-semibold tabular">{counts.open}</div>
              </CardContent>
            </Card>
            <Card className={cn(counts.overdue > 0 && 'border-destructive/50')}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Overdue next actions</div>
                <div
                  className={cn(
                    'mt-1 text-2xl font-semibold tabular',
                    counts.overdue > 0 && 'text-destructive',
                  )}
                >
                  {counts.overdue}
                </div>
              </CardContent>
            </Card>
            <Card className={cn(counts.unowned > 0 && 'border-warning/50')}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Open, no owner</div>
                <div
                  className={cn(
                    'mt-1 text-2xl font-semibold tabular',
                    counts.unowned > 0 && 'text-warning',
                  )}
                >
                  {counts.unowned}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Closed</div>
                <div className="mt-1 text-2xl font-semibold tabular">{counts.closed}</div>
              </CardContent>
            </Card>
          </div>

          {counts.overdue > 0 ? (
            <InlineWarning>
              <strong className="tabular">{counts.overdue}</strong> opportunit
              {counts.overdue === 1 ? 'y has' : 'ies have'} an overdue next action. A pipeline
              stops moving one missed follow-up at a time.
            </InlineWarning>
          ) : null}

          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mine}
                  onChange={(event) => setMine(event.target.checked)}
                  className="h-4 w-4"
                />
                Only mine
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showClosed}
                  onChange={(event) => setShowClosed(event.target.checked)}
                  className="h-4 w-4"
                />
                Show closed
              </label>
            </CardContent>
          </Card>

          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map(({ stage, items }) => (
              <section
                key={stage.value}
                className="w-72 shrink-0"
                aria-label={`${stage.label}, ${items.length} opportunities`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant={stageVariant(stage.value)}>{stage.label}</Badge>
                  <span className="text-xs tabular text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="rounded-md border border-dashed p-3 text-2xs text-muted-foreground">
                      Nothing at this stage
                    </p>
                  ) : (
                    items.map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        stages={stages.data ?? []}
                        canWrite={canWrite}
                      />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>

          <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Stages may skip forward and may go back — both happen in real deals, and every move is
            recorded so the funnel stays countable.
          </p>
        </div>
      )}
    </>
  );
}
