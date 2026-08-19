/** Matching and scoring-configuration types (Phase 7). */

export type MatchBand = 'STRONG' | 'GOOD' | 'POSSIBLE' | 'WEAK';

export type MatchComponentKey =
  | 'skills'
  | 'experience'
  | 'technology'
  | 'availability'
  | 'location'
  | 'cost'
  | 'commercial';

/**
 * One weighted component of a match.
 *
 * `score` is deliberately nullable: a component nobody has the data for is
 * unknown, not zero, and the UI must say so rather than draw an empty bar
 * (SCORING.md section 1).
 */
export interface MatchComponent {
  key: MatchComponentKey | string;
  label: string;
  score: number | null;
  weight: number;
  contribution: number;
  evidence: string | null;
  detail: Record<string, unknown>;
}

export interface Match {
  id: string;
  requirement_id: string;
  resource_id: string;
  resource_name: string | null;
  resource_headline: string | null;
  resource_type: string | null;
  availability_status: string | null;

  overall_score: number;
  band: MatchBand;
  /** Share of the total weight that was answered by known data. */
  confidence: number;

  components: MatchComponent[];
  gaps: string[];
  reasons: string[];
  warnings: string[];
  missing_information: string[];
  /** Components the caller's role is not allowed to see, named rather than hidden. */
  restricted_components: string[];
  narrative: string | null;

  weights_version: number | null;
  engine_version: string;
  computed_at: string;
}

export interface MatchRun {
  requirement_id: string;
  requirement_title: string;
  computed_at: string | null;
  weights_version: number | null;
  total: number;
  matches: Match[];
}

export type ScoringConfigKind =
  | 'MATCH_WEIGHTS'
  | 'ADDRESSABILITY_RULES'
  | 'COMMERCIAL_BANDS'
  | 'OPPORTUNITY_WEIGHTS';

export interface ScoringConfiguration {
  id: string;
  kind: ScoringConfigKind;
  name: string;
  version: number;
  is_active: boolean;
  payload: {
    weights?: Record<string, number>;
    thresholds?: Record<string, unknown>;
    [key: string]: unknown;
  };
  notes: string | null;
  created_at: string;
}

/* ------------------------------------------------- reverse matching (Phase 8) */

export type RouteType =
  | 'DIRECT'
  | 'VIA_PARTNER'
  | 'VIA_PRIME'
  | 'VIA_VENDOR'
  | 'NO_KNOWN_ROUTE'
  | 'UNKNOWN';

export interface RouteInfo {
  route_type: RouteType;
  label: string | null;
  /**
   * 0–1, or null when the requirement names no account. Null is *unknown*,
   * never "unreachable" — the priority is not discounted for it.
   */
  reachability: number | null;
  via_account_id: string | null;
}

/** One ranked next-assignment option for a consultant. */
export interface Suggestion {
  id: string;
  requirement_id: string;
  requirement_title: string | null;
  account_name: string | null;

  overall_score: number;
  /** match x reachability. Not the Opportunity Score — that arrives in Phase 9. */
  priority_score: number | null;
  band: MatchBand;
  confidence: number;
  route: RouteInfo;

  components: MatchComponent[];
  gaps: string[];
  reasons: string[];
  warnings: string[];
  missing_information: string[];
  restricted_components: string[];
  narrative: string | null;

  weights_version: number | null;
  engine_version: string;
  computed_at: string;
}

/**
 * The explainable core shared by a forward match and a reverse suggestion.
 *
 * The same pair scores identically whichever direction it was discovered from,
 * so the explanation UI is written once against this shape rather than twice.
 */
export type Explainable = Pick<
  Match,
  | 'overall_score'
  | 'band'
  | 'confidence'
  | 'components'
  | 'gaps'
  | 'reasons'
  | 'warnings'
  | 'missing_information'
  | 'restricted_components'
  | 'narrative'
  | 'engine_version'
>;

export interface ReverseRun {
  resource_id: string;
  resource_name: string;
  availability_status: string;
  available_from: string | null;
  computed_at: string | null;
  total: number;
  suggestions: Suggestion[];
}

export interface BenchRow {
  resource_id: string;
  resource_name: string;
  headline: string | null;
  availability_status: string;
  available_from: string | null;
  days_until_available: number | null;
  blocks_deployment: boolean;
  top_suggestion: Suggestion | null;
}

export interface BenchRadar {
  total: number;
  on_bench_now: number;
  /** Unbilled capacity with nowhere identified to go. The number to act on. */
  without_a_suggestion: number;
  rows: BenchRow[];
}

export interface SweepResult {
  examined: number;
  raised: number;
  skipped_duplicate: number;
}
