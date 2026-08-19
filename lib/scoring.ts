import type {
  AddressabilityBand,
  FactorState,
  OpportunityBand,
  OpportunityScoreResult,
  ScoreFactor,
} from '@/types/scoring';

/**
 * Presentation rules for the Opportunity Score.
 *
 * The rule everything here serves: **a correct zero must never look like a
 * failure.** A direct customer needs no partner route, and rendering that
 * alongside "no decision maker identified" would send Sales chasing a problem
 * that does not exist (SCORING.md section 2).
 */

export const OPPORTUNITY_BAND_LABELS: Record<OpportunityBand, string> = {
  PURSUE_NOW: 'Pursue now',
  PURSUE: 'Pursue',
  REVIEW: 'Review',
  DEPRIORITIZE: 'Deprioritize',
};

export const OPPORTUNITY_BAND_VARIANT: Record<
  OpportunityBand,
  'success' | 'info' | 'warning' | 'muted'
> = {
  PURSUE_NOW: 'success',
  PURSUE: 'info',
  REVIEW: 'warning',
  DEPRIORITIZE: 'muted',
};

export const OPPORTUNITY_BAND_ORDER: OpportunityBand[] = [
  'PURSUE_NOW',
  'PURSUE',
  'REVIEW',
  'DEPRIORITIZE',
];

export const ADDRESSABILITY_BAND_LABELS: Record<AddressabilityBand, string> = {
  HIGHLY_ADDRESSABLE: 'Highly addressable',
  ADDRESSABLE: 'Addressable',
  CONDITIONAL: 'Conditional',
  NOT_ADDRESSABLE: 'Not addressable',
};

export const ADDRESSABILITY_BAND_VARIANT: Record<
  AddressabilityBand,
  'success' | 'info' | 'warning' | 'destructive'
> = {
  HIGHLY_ADDRESSABLE: 'success',
  ADDRESSABLE: 'info',
  CONDITIONAL: 'warning',
  NOT_ADDRESSABLE: 'destructive',
};

/** How each factor state renders. The four are deliberately distinct. */
export const FACTOR_STATE_PRESENTATION: Record<
  FactorState,
  { label: string; tone: 'success' | 'destructive' | 'muted' | 'warning'; icon: string }
> = {
  MET: { label: 'Met', tone: 'success', icon: 'check' },
  NOT_MET: { label: 'Not met', tone: 'destructive', icon: 'cross' },
  // Zero points, and that is the right answer. Never a deficiency.
  NOT_APPLICABLE: { label: 'Not required', tone: 'muted', icon: 'minus' },
  // Zero points because nobody has told us. A data-entry task, not a verdict.
  UNKNOWN: { label: 'Not recorded', tone: 'warning', icon: 'question' },
};

export function scoreTone(score: number | null): string {
  if (score === null) return 'bg-muted-foreground/30';
  if (score >= 80) return 'bg-success';
  if (score >= 65) return 'bg-info';
  if (score >= 50) return 'bg-warning';
  return 'bg-destructive';
}

/** Factors a human can actually close, separated from correct zeroes. */
export function closeableGaps(factors: ScoreFactor[]): ScoreFactor[] {
  return factors.filter((factor) => factor.state === 'NOT_MET' || factor.state === 'UNKNOWN');
}

export function earnedPoints(factors: ScoreFactor[]): { earned: number; available: number } {
  return {
    earned: factors.reduce((total, factor) => total + factor.points, 0),
    // NOT_APPLICABLE points are not "available" — nobody can ever earn them
    // here, so counting them would understate how well the account scores.
    available: factors
      .filter((factor) => factor.state !== 'NOT_APPLICABLE')
      .reduce((total, factor) => total + factor.max_points, 0),
  };
}

/**
 * Recompute the headline from the components, so the UI can prove the number
 * rather than assert it.
 */
export function recomputeScore(result: OpportunityScoreResult): number | null {
  const known = result.components.filter((c) => c.score !== null);
  if (known.length === 0) return null;
  return known.reduce((total, c) => total + c.contribution, 0);
}

export function isReproducible(result: OpportunityScoreResult): boolean {
  const recomputed = recomputeScore(result);
  if (recomputed === null) return false;
  return Math.abs(recomputed - result.score) < 1;
}

export function confidenceNote(confidence: number): {
  label: string;
  tone: 'success' | 'warning' | 'destructive';
} {
  const percent = Math.round(confidence * 100);
  if (confidence >= 0.85) return { label: `${percent}% of inputs known`, tone: 'success' };
  if (confidence >= 0.6) return { label: `${percent}% of inputs known`, tone: 'warning' };
  return { label: `only ${percent}% of inputs known`, tone: 'destructive' };
}

/** What the supply gate did, in words. 1.0 means it did nothing. */
export function supplyGateNote(gate: number | null): string | null {
  if (gate === null || gate >= 1) return null;
  return `Addressability was multiplied by ${gate} because of limited talent supply — reachability with nobody to send is not addressability.`;
}

export function formatDelta(delta: number): string {
  if (delta === 0) return 'no change';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
}
