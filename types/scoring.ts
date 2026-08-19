/** Opportunity scoring, addressability and the commercial calculator (Phase 9). */

export type OpportunityBand = 'PURSUE_NOW' | 'PURSUE' | 'REVIEW' | 'DEPRIORITIZE';

export type AddressabilityBand =
  | 'HIGHLY_ADDRESSABLE'
  | 'ADDRESSABLE'
  | 'CONDITIONAL'
  | 'NOT_ADDRESSABLE';

/**
 * Why a factor scored what it did.
 *
 * `NOT_MET` means we checked and the answer is no. `UNKNOWN` means nobody has
 * filled it in. `NOT_APPLICABLE` means zero is the correct answer — a direct
 * customer needs no partner route. Rendering these three the same way is what
 * turns a useful score into a misleading one.
 */
export type FactorState = 'MET' | 'NOT_MET' | 'NOT_APPLICABLE' | 'UNKNOWN';

export interface ScoreComponent {
  key: 'talent_match' | 'addressability' | 'commercial' | string;
  label: string;
  score: number | null;
  weight: number;
  contribution: number;
}

export interface ScoreFactor {
  key: string;
  label: string;
  state: FactorState;
  points: number;
  max_points: number;
  evidence: string | null;
}

export interface CommercialSubScore {
  key: string;
  label: string;
  points: number;
  max_points: number;
  evidence: string;
}

export interface CommercialFigures {
  monthly_revenue: string | null;
  monthly_cost: string | null;
  gross_profit: string | null;
  margin_percent: number | null;
  contract_value: string | null;
  total_profit: string | null;
  duration_months: number;
  positions: number;
  currency: string;
  /** True when a figure was converted — an estimate, never a quote. */
  is_converted: boolean;
  one_off_total: string;
  one_off_monthly: string;
  missing_information: string[];
}

export interface OpportunityScoreResult {
  id: string | null;
  requirement_id: string;
  requirement_title: string | null;

  score: number;
  band: OpportunityBand;
  confidence: number;

  talent_match_score: number | null;
  addressability_score: number | null;
  addressability_band: AddressabilityBand | null;
  supply_gate: number | null;
  commercial_score: number | null;

  components: ScoreComponent[];
  factors: ScoreFactor[];
  commercial_breakdown: CommercialSubScore[];
  commercial: CommercialFigures | null;

  positives: string[];
  risks: string[];
  missing_information: string[];
  suppressors: string[];
  recommended_action: string | null;
  narrative: string | null;
  /** Money fields withheld from this role, named rather than silently absent. */
  restricted_fields: string[];

  addressability_config_version: number | null;
  commercial_config_version: number | null;
  opportunity_config_version: number | null;
  engine_version: string;
  computed_at: string;
}

export interface SimulationRow {
  requirement_id: string;
  requirement_title: string | null;
  before_score: number;
  after_score: number;
  delta: number;
  before_band: OpportunityBand;
  after_band: OpportunityBand;
  band_changed: boolean;
}

export interface SimulationResult {
  kind: string;
  evaluated: number;
  changed: number;
  band_changes: number;
  average_delta: number;
  distribution_before: Record<string, number>;
  distribution_after: Record<string, number>;
  rows: SimulationRow[];
}

export interface CommercialPreviewRequest {
  bill_rate?: string;
  bill_unit?: string;
  bill_currency?: string;
  cost_rate?: string;
  cost_unit?: string;
  cost_currency?: string;
  visa_cost?: string;
  insurance_cost?: string;
  other_cost?: string;
  duration_months?: number;
  positions?: number;
}
