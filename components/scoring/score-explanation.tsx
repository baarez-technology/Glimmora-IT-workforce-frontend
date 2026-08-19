'use client';

import { AlertTriangle, Check, CircleHelp, EyeOff, Lightbulb, Minus, Sparkles, X } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { formatMoney, formatPercent, formatScore } from '@/lib/format';
import {
  ADDRESSABILITY_BAND_LABELS,
  ADDRESSABILITY_BAND_VARIANT,
  FACTOR_STATE_PRESENTATION,
  OPPORTUNITY_BAND_LABELS,
  OPPORTUNITY_BAND_VARIANT,
  confidenceNote,
  earnedPoints,
  isReproducible,
  recomputeScore,
  scoreTone,
  supplyGateNote,
} from '@/lib/scoring';
import { cn } from '@/lib/utils';
import type { OpportunityScoreResult, ScoreFactor } from '@/types/scoring';

/**
 * The full explainability object, rendered.
 *
 * SCORING.md section 6: no score is ever shown as a bare number. What makes
 * this screen different from the match explanation is the **four factor
 * states** — a factor scoring zero because it does not apply must look nothing
 * like one scoring zero because nobody filled it in.
 */

const STATE_ICON = {
  check: Check,
  cross: X,
  minus: Minus,
  question: CircleHelp,
} as const;

function FactorRow({ factor }: { factor: ScoreFactor }) {
  const presentation = FACTOR_STATE_PRESENTATION[factor.state];
  const Icon = STATE_ICON[presentation.icon as keyof typeof STATE_ICON];

  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          presentation.tone === 'success' && 'bg-success/15 text-success',
          presentation.tone === 'destructive' && 'bg-destructive/12 text-destructive',
          presentation.tone === 'warning' && 'bg-warning/15 text-warning',
          presentation.tone === 'muted' && 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        <Icon className="h-3 w-3" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{factor.label}</span>
          <span className="flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">
              {presentation.label}
            </span>
            <span className="text-sm tabular">
              {formatScore(factor.points)}
              <span className="text-muted-foreground">/{formatScore(factor.max_points)}</span>
            </span>
          </span>
        </div>
        {factor.evidence ? (
          <p
            className={cn(
              'mt-0.5 text-xs',
              factor.state === 'NOT_APPLICABLE' ? 'text-muted-foreground' : 'text-muted-foreground',
            )}
          >
            {factor.evidence}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Callout({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: 'danger' | 'warning' | 'neutral' | 'positive';
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={cn(
        'rounded-md border p-3',
        tone === 'danger' && 'border-destructive/40 bg-destructive/5',
        tone === 'warning' && 'border-warning/40 bg-warning/5',
        tone === 'positive' && 'border-success/30 bg-success/5',
        tone === 'neutral' && 'border-border bg-muted/40',
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <span
          className={cn(
            tone === 'danger' && 'text-destructive',
            tone === 'warning' && 'text-warning',
            tone === 'positive' && 'text-success',
            tone === 'neutral' && 'text-muted-foreground',
          )}
          aria-hidden
        >
          {icon}
        </span>
        {title}
      </div>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-muted-foreground">
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreHeadline({ result }: { result: OpportunityScoreResult }) {
  const confidence = confidenceNote(result.confidence);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div>
        <div className="text-5xl font-semibold tabular leading-none">
          {formatScore(result.score)}
        </div>
        <div className="mt-1 text-2xs uppercase tracking-wide text-muted-foreground">
          Opportunity Score
        </div>
      </div>
      <div className="space-y-1.5">
        <Badge variant={OPPORTUNITY_BAND_VARIANT[result.band]}>
          {OPPORTUNITY_BAND_LABELS[result.band]}
        </Badge>
        <div
          className={cn(
            'text-xs',
            confidence.tone === 'success' && 'text-muted-foreground',
            confidence.tone === 'warning' && 'text-warning',
            confidence.tone === 'destructive' && 'text-destructive',
          )}
        >
          Scored on {confidence.label}
        </div>
      </div>
    </div>
  );
}

export function ScoreExplanation({ result }: { result: OpportunityScoreResult }) {
  const factors = result.factors;
  const { earned, available } = earnedPoints(factors);
  const recomputed = recomputeScore(result);
  const gateNote = supplyGateNote(result.supply_gate);

  return (
    <div className="space-y-5">
      {result.narrative ? <p className="text-sm leading-relaxed">{result.narrative}</p> : null}

      {result.suppressors.length > 0 ? (
        <Callout
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          title="Band capped"
          items={result.suppressors}
          tone="danger"
        />
      ) : null}

      {/* --- the three components --- */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How the score was composed
        </h4>
        <ul className="space-y-3">
          {result.components.map((component) => (
            <li key={component.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{component.label}</span>
                <span className="flex items-baseline gap-2 text-sm">
                  {component.score !== null ? (
                    <span className="tabular font-semibold">{formatScore(component.score)}</span>
                  ) : (
                    <span className="text-xs text-warning">Not assessed</span>
                  )}
                  <span className="text-2xs text-muted-foreground tabular">
                    weight {component.weight}
                  </span>
                  <span className="w-14 text-right text-2xs text-muted-foreground tabular">
                    +{component.contribution.toFixed(2)}
                  </span>
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={component.score ?? undefined}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${component.label} score`}
              >
                <div
                  className={cn('h-full rounded-full transition-all', scoreTone(component.score))}
                  style={{ width: component.score !== null ? `${component.score}%` : '100%' }}
                />
              </div>
            </li>
          ))}
        </ul>

        {result.components.some((c) => c.score === null) ? (
          <p className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            A component that could not be assessed had its weight{' '}
            <strong className="text-foreground">redistributed</strong> across the others, not
            counted as zero — an unassessed opportunity is unknown, not bad. That is why the score
            is shown at {formatPercent(result.confidence * 100, 0)} confidence.
          </p>
        ) : null}

        {recomputed !== null && !isReproducible(result) ? (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
            The components sum to {formatScore(recomputed)} but the snapshot says{' '}
            {formatScore(result.score)}. Recompute to refresh it.
          </p>
        ) : null}
      </div>

      {/* --- addressability factors --- */}
      {factors.length > 0 ? (
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Can we reach this client?
            </h4>
            <div className="flex items-center gap-2">
              {result.addressability_band ? (
                <Badge variant={ADDRESSABILITY_BAND_VARIANT[result.addressability_band]}>
                  {ADDRESSABILITY_BAND_LABELS[result.addressability_band]}
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground tabular">
                {formatScore(earned)}/{formatScore(available)} points
              </span>
            </div>
          </div>
          <ul className="divide-y">
            {factors.map((factor) => (
              <FactorRow key={factor.key} factor={factor} />
            ))}
          </ul>
          {gateNote ? (
            <p className="mt-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
              {gateNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* --- commercial --- */}
      {result.commercial ? (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Does the money work?
          </h4>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Monthly revenue', formatMoney(result.commercial.monthly_revenue, result.commercial.currency)],
              ['Monthly cost', formatMoney(result.commercial.monthly_cost, result.commercial.currency)],
              ['Gross profit', formatMoney(result.commercial.gross_profit, result.commercial.currency)],
              ['Margin', result.commercial.margin_percent !== null ? formatPercent(result.commercial.margin_percent) : '—'],
              ['Contract value', formatMoney(result.commercial.contract_value, result.commercial.currency, { compact: true })],
              ['Total profit', formatMoney(result.commercial.total_profit, result.commercial.currency, { compact: true })],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border p-3">
                <dt className="text-2xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular">{value}</dd>
              </div>
            ))}
          </dl>
          {result.commercial.is_converted ? (
            <p className="mt-2 text-xs text-warning">
              Some figures were converted from another currency — an estimate, not a quote.
            </p>
          ) : null}
          {result.commercial_breakdown.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {result.commercial_breakdown.map((sub) => (
                <li key={sub.key}>
                  <span className="font-medium text-foreground">{sub.label}</span>{' '}
                  {formatScore(sub.points)}/{formatScore(sub.max_points)} — {sub.evidence}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : result.restricted_fields.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium text-foreground">Commercial figures hidden by your role</p>
            <p className="mt-0.5">
              The score and its reasoning are shown in full; the underlying rates, margin and
              contract value are restricted.
            </p>
          </div>
        </div>
      ) : null}

      <Callout
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="In our favour"
        items={result.positives}
        tone="positive"
      />
      <Callout
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        title="Risks"
        items={result.risks}
        tone="warning"
      />
      <Callout
        icon={<Lightbulb className="h-3.5 w-3.5" />}
        title="Fill these in to sharpen the score"
        items={result.missing_information}
        tone="neutral"
      />

      {result.recommended_action ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
            Recommended next action
          </div>
          <p className="mt-1 text-sm">{result.recommended_action}</p>
        </div>
      ) : null}

      <p className="text-2xs text-muted-foreground">
        Engine {result.engine_version} · addressability rules v
        {result.addressability_config_version ?? '—'} · commercial bands v
        {result.commercial_config_version ?? '—'} · opportunity weights v
        {result.opportunity_config_version ?? '—'}
      </p>
    </div>
  );
}
