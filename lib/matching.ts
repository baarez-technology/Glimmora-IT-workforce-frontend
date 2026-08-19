import type {
  BenchRow,
  Explainable,
  Match,
  MatchBand,
  MatchComponent,
  RouteInfo,
  RouteType,
} from '@/types/matching';

/**
 * Presentation rules for a match.
 *
 * The rule the whole screen is built around: **a match is never shown as a bare
 * percentage** (MATCHING.md section 5). Every helper here exists so the number
 * always arrives with the band, the components, the gaps and the confidence
 * that produced it.
 */

export const BAND_LABELS: Record<MatchBand, string> = {
  STRONG: 'Strong match',
  GOOD: 'Good match',
  POSSIBLE: 'Possible match',
  WEAK: 'Weak match',
};

export const BAND_VARIANT: Record<MatchBand, 'success' | 'info' | 'warning' | 'muted'> = {
  STRONG: 'success',
  GOOD: 'info',
  POSSIBLE: 'warning',
  WEAK: 'muted',
};

export const BAND_ORDER: MatchBand[] = ['STRONG', 'GOOD', 'POSSIBLE', 'WEAK'];

/** Bar colour. Deliberately the same scale as the band, so nothing contradicts. */
export function scoreTone(score: number | null): string {
  if (score === null) return 'bg-muted-foreground/30';
  if (score >= 80) return 'bg-success';
  if (score >= 65) return 'bg-info';
  if (score >= 50) return 'bg-warning';
  return 'bg-destructive';
}

/**
 * How much of the picture is actually known.
 *
 * A 72 at 45% confidence and a 72 at 95% confidence are different claims, and
 * a recruiter who cannot tell them apart will trust the wrong one.
 */
export function confidenceLabel(confidence: number): {
  label: string;
  tone: 'success' | 'warning' | 'destructive';
  description: string;
} {
  const percent = Math.round(confidence * 100);
  if (confidence >= 0.85) {
    return {
      label: `${percent}% complete`,
      tone: 'success',
      description: 'Scored on essentially complete information.',
    };
  }
  if (confidence >= 0.6) {
    return {
      label: `${percent}% complete`,
      tone: 'warning',
      description: 'Some inputs are missing — treat the score as indicative.',
    };
  }
  return {
    label: `${percent}% complete`,
    tone: 'destructive',
    description: 'Too little recorded to rely on this score. Fill in the gaps first.',
  };
}

/** Components that were assessed, heaviest contribution first. */
export function knownComponents(match: Explainable): MatchComponent[] {
  return match.components
    .filter((component) => component.score !== null)
    .sort((a, b) => b.contribution - a.contribution);
}

export function unknownComponents(match: Explainable): MatchComponent[] {
  return match.components.filter((component) => component.score === null);
}

/**
 * Recompute the headline from the stored components.
 *
 * Used by the UI to prove the number rather than assert it: if this disagrees
 * with `overall_score`, the explanation panel says so instead of quietly
 * showing a figure it cannot justify.
 */
export function recomputeScore(match: Explainable): number | null {
  const known = match.components.filter((c) => c.score !== null && c.weight > 0);
  const weight = known.reduce((total, c) => total + c.weight, 0);
  if (weight === 0) return null;
  return known.reduce((total, c) => total + (c.score ?? 0) * c.weight, 0) / weight;
}

/**
 * Whether the breakdown on screen adds up to the headline.
 *
 * False whenever the role is not allowed to see every component, which is why
 * `restricted_components` is checked first — that is a permission boundary, not
 * an arithmetic error, and must not be reported as one.
 */
export function isReproducible(match: Explainable): boolean {
  if (match.restricted_components.length > 0) return false;
  const recomputed = recomputeScore(match);
  if (recomputed === null) return false;
  return Math.abs(recomputed - match.overall_score) < 0.5;
}

/** Sort a run for display: score descending, then name for a stable order. */
export function rankMatches(matches: Match[]): Match[] {
  return [...matches].sort(
    (a, b) =>
      b.overall_score - a.overall_score ||
      (a.resource_name ?? '').localeCompare(b.resource_name ?? ''),
  );
}

export function countByBand(matches: Match[]): Record<MatchBand, number> {
  const counts: Record<MatchBand, number> = { STRONG: 0, GOOD: 0, POSSIBLE: 0, WEAK: 0 };
  for (const match of matches) counts[match.band] += 1;
  return counts;
}

/**
 * Whether this match carries a blocker a recruiter must resolve before
 * submitting. Warnings that read as blockers are phrased by the engine; this
 * only decides how loudly the list renders them.
 */
export function hasBlocker(match: Explainable): boolean {
  return (
    match.gaps.length > 0 ||
    match.warnings.some((warning) => {
      const text = warning.toLowerCase();
      return (
        text.includes('expired') || text.includes('above the client rate') || text.includes('lose money')
      );
    })
  );
}

/* ------------------------------------------------- reverse matching (Phase 8) */

export const ROUTE_LABELS: Record<RouteType, string> = {
  DIRECT: 'Direct',
  VIA_PARTNER: 'Via partner',
  VIA_PRIME: 'Via prime contractor',
  VIA_VENDOR: 'Via vendor / MSP',
  NO_KNOWN_ROUTE: 'No route recorded',
  UNKNOWN: 'Account not recorded',
};

export const ROUTE_VARIANT: Record<RouteType, 'success' | 'info' | 'warning' | 'muted'> = {
  DIRECT: 'success',
  VIA_PARTNER: 'info',
  VIA_PRIME: 'info',
  VIA_VENDOR: 'info',
  NO_KNOWN_ROUTE: 'warning',
  UNKNOWN: 'muted',
};

/**
 * How a route affects the ranking, in words.
 *
 * The distinction that matters: an *unknown* route does not discount anything.
 * Telling the user "we did not reduce this" is different from telling them
 * "we could not reach this", and conflating them would hide real work.
 */
export function reachabilityNote(route: RouteInfo): string {
  if (route.reachability === null) {
    return 'No account on the requirement, so the ranking was not adjusted. Recording the account will sharpen it.';
  }
  const percent = Math.round(route.reachability * 100);
  if (route.reachability >= 0.9) return `Highly reachable (${percent}%) — ranked at close to full match value.`;
  if (route.reachability >= 0.7) return `Reachable through a recorded route (${percent}%).`;
  if (route.reachability >= 0.4) return `Hard to reach (${percent}%) — the ranking is discounted accordingly.`;
  return `Effectively unreachable (${percent}%) — opening a route is the first job here.`;
}

/** Days-to-bench, coloured by how urgent it is. Mirrors the alert severities. */
export function benchUrgency(days: number | null): {
  label: string;
  variant: 'destructive' | 'warning' | 'info' | 'muted';
} {
  if (days === null) return { label: 'No end date recorded', variant: 'muted' };
  if (days <= 0) return { label: 'On the bench now', variant: 'destructive' };
  if (days <= 7) return { label: `${days} days left`, variant: 'destructive' };
  if (days <= 30) return { label: `${days} days left`, variant: 'warning' };
  return { label: `${days} days left`, variant: 'info' };
}

/** Sort a bench board the way it should be worked: soonest and least covered first. */
export function rankBench(rows: BenchRow[]): BenchRow[] {
  return [...rows].sort((a, b) => {
    const aDays = a.days_until_available ?? Number.MAX_SAFE_INTEGER;
    const bDays = b.days_until_available ?? Number.MAX_SAFE_INTEGER;
    if (aDays !== bDays) return aDays - bDays;
    // At equal urgency, somebody with nowhere to go needs attention first.
    return Number(Boolean(a.top_suggestion)) - Number(Boolean(b.top_suggestion));
  });
}
