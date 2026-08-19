'use client';

import {
  AlertTriangle,
  CircleHelp,
  EyeOff,
  Lightbulb,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { formatPercent, formatScore } from '@/lib/format';
import {
  BAND_LABELS,
  BAND_VARIANT,
  confidenceLabel,
  isReproducible,
  knownComponents,
  recomputeScore,
  scoreTone,
  unknownComponents,
} from '@/lib/matching';
import { cn } from '@/lib/utils';
import type { Explainable, MatchComponent } from '@/types/matching';

/**
 * The full explanation behind one match.
 *
 * This component exists to enforce one rule from MATCHING.md section 5: a match
 * is never presented as a bare percentage. Wherever a score appears, the
 * components that produced it, the gaps, the warnings and the confidence appear
 * with it — a recruiter has to be able to defend the number to a client, and
 * "the system said 87" is not a defence.
 */

/* --------------------------------------------------------------- score bar */

function ComponentRow({ component }: { component: MatchComponent }) {
  const known = component.score !== null;

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{component.label}</span>
        <span className="flex items-baseline gap-2 text-sm">
          {known ? (
            <span className="tabular font-semibold">{formatScore(component.score)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Not recorded</span>
          )}
          <span className="text-2xs text-muted-foreground tabular">
            weight {formatScore(component.weight)}
          </span>
        </span>
      </div>

      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={known ? Math.round(component.score ?? 0) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={known ? undefined : 'Not recorded'}
        aria-label={`${component.label} score`}
      >
        <div
          className={cn('h-full rounded-full transition-all', scoreTone(component.score))}
          style={{ width: known ? `${Math.min(component.score ?? 0, 100)}%` : '100%' }}
          data-unknown={known ? undefined : 'true'}
        />
      </div>

      {component.evidence ? (
        <p className="mt-1 text-xs text-muted-foreground">{component.evidence}</p>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------ header */

export function MatchScore({
  match,
  size = 'default',
}: {
  match: Explainable;
  size?: 'default' | 'lg';
}) {
  const confidence = confidenceLabel(match.confidence);

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div
          className={cn('font-semibold tabular leading-none', size === 'lg' ? 'text-4xl' : 'text-2xl')}
        >
          {formatScore(match.overall_score)}
          <span className="text-base font-normal text-muted-foreground">%</span>
        </div>
      </div>
      <div className="space-y-1">
        <Badge variant={BAND_VARIANT[match.band]}>{BAND_LABELS[match.band]}</Badge>
        <div
          className={cn(
            'text-2xs',
            confidence.tone === 'success' && 'text-muted-foreground',
            confidence.tone === 'warning' && 'text-warning',
            confidence.tone === 'destructive' && 'text-destructive',
          )}
          title={confidence.description}
        >
          Evidence {confidence.label}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- lists */

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

/* ---------------------------------------------------------------- the panel */

export function MatchExplanation({
  match,
  compact = false,
}: {
  match: Explainable;
  compact?: boolean;
}) {
  const known = knownComponents(match);
  const unknown = unknownComponents(match);
  const recomputed = recomputeScore(match);
  const reproducible = isReproducible(match);

  return (
    <div className="space-y-4">
      {match.narrative ? (
        <p className="text-sm leading-relaxed">{match.narrative}</p>
      ) : null}

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How the score was built
        </h4>
        <ul className="divide-y">
          {known.map((component) => (
            <ComponentRow key={component.key} component={component} />
          ))}
        </ul>

        {unknown.length > 0 ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium text-foreground">
                {unknown.length} component{unknown.length === 1 ? '' : 's'} could not be assessed
              </p>
              <p className="mt-0.5">
                {unknown.map((component) => component.label).join(', ')} — not recorded on the
                requirement or the resource. These were left out of the score entirely rather than
                counted as zero, which is why the evidence figure is{' '}
                {formatPercent(match.confidence * 100, 0)}.
              </p>
            </div>
          </div>
        ) : null}

        {match.restricted_components.length > 0 ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium text-foreground">
                {match.restricted_components.join(' and ')} hidden by your role
              </p>
              <p className="mt-0.5">
                These components were included in the total but are not shown to your role, so the
                bars above will not add up to {formatScore(match.overall_score)}.
              </p>
            </div>
          </div>
        ) : null}

        {!reproducible && match.restricted_components.length === 0 && recomputed !== null ? (
          <div className="mt-3 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
            <p className="font-medium">This breakdown does not reproduce the stored total.</p>
            <p className="mt-0.5 text-muted-foreground">
              Components give {formatScore(recomputed)}, the snapshot says{' '}
              {formatScore(match.overall_score)}. The match was scored by engine{' '}
              {match.engine_version}; re-run matching to refresh it.
            </p>
          </div>
        ) : null}
      </div>

      <Callout
        icon={<ShieldAlert className="h-3.5 w-3.5" />}
        title="Missing mandatory skills"
        items={match.gaps}
        tone="danger"
      />
      <Callout
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        title="Before submitting"
        items={match.warnings}
        tone="warning"
      />

      {!compact ? (
        <Callout
          icon={<Sparkles className="h-3.5 w-3.5" />}
          title="Why this candidate"
          items={match.reasons}
          tone="positive"
        />
      ) : null}

      {!compact && match.missing_information.length > 0 ? (
        <Callout
          icon={<Lightbulb className="h-3.5 w-3.5" />}
          title="Fill these in to improve the score"
          items={match.missing_information}
          tone="neutral"
        />
      ) : null}
    </div>
  );
}
