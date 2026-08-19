/** Deployments, billing and dashboards (Phase 11). */

export type DeploymentStatus = 'PENDING_START' | 'ACTIVE' | 'ON_HOLD' | 'ENDED';

/**
 * PROJECTED is deliberately not "revenue". It is arithmetic from the
 * deployment's dates and rates; only CONFIRMED and INVOICED are money the
 * business actually earned (ASSUMPTIONS.md A15).
 */
export type BillingStatus = 'PROJECTED' | 'CONFIRMED' | 'INVOICED' | 'CANCELLED';

export interface Deployment {
  id: string;
  resource_id: string;
  resource_name: string | null;
  account_id: string | null;
  requirement_id: string | null;
  submission_id: string | null;

  role_title: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  actual_end_date: string | null;
  effective_end: string | null;
  days_remaining: number | null;
  status: DeploymentStatus;

  bill_rate: string | null;
  bill_currency: string;
  bill_unit: string;
  cost_rate: string | null;
  cost_currency: string;
  cost_unit: string;
  /** Money fields withheld from this role, named rather than silently absent. */
  restricted_fields: string[];

  working_days_per_month: number;
  hours_per_day: number;
  extension_of_deployment_id: string | null;
  end_reason: string | null;
  created_at: string;
}

export interface EndingSoonRow {
  deployment: Deployment;
  days_remaining: number;
}

export interface BillingRecord {
  id: string;
  deployment_id: string;
  resource_name: string | null;
  role_title: string | null;
  period_year: number;
  period_month: number;
  period_label: string;

  revenue_amount: string;
  cost_amount: string;
  gross_profit: string;
  margin_percent: number | null;
  currency: string;

  status: BillingStatus;
  /** True when the month was pro-rated for a partial period. */
  is_estimated: boolean;
  billable_days: number | null;
  notes: string | null;
  created_at: string;
}

export interface ProjectionResult {
  created: number;
  updated: number;
  /** Periods a human had confirmed. Left untouched by the generator. */
  protected: number;
  deployments: number | null;
}

export interface MonthlySummaryRow {
  period: string;
  year: number;
  month: number;
  confirmed_revenue: string;
  confirmed_cost: string;
  confirmed_profit: string;
  confirmed_margin_percent: number | null;
  projected_revenue: string;
  projected_cost: string;
  projected_profit: string;
  records: number;
}

export interface BillingHeadline {
  period: string | null;
  confirmed_revenue: string;
  projected_revenue: string;
  confirmed_margin_percent: number | null;
  lifetime_confirmed_revenue: string;
  lifetime_gross_profit: string;
  /** Projections nobody has checked yet. */
  unconfirmed_periods: number;
}

/* ------------------------------------------------------------- dashboards */

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
}

export interface Funnel {
  active_requirements: number;
  stages: FunnelStage[];
  closed: FunnelStage[];
  open_total: number;
  reached_deployment: number;
}

export interface ManagementDashboard {
  headline: BillingHeadline;
  trend: MonthlySummaryRow[];
  active_deployments: number;
  bench_count: number;
  accounts: number;
  opportunity_bands: Record<string, number>;
  funnel: Funnel;
}

export interface SalesDashboard {
  my_open_opportunities: number;
  overdue_next_actions: number;
  unowned_opportunities: number;
  live_submissions: number;
  interviews_next_14_days: number;
  sla_due_within_48h: number;
  top_opportunities: Array<{
    requirement_id: string;
    title: string;
    score: number;
    band: string;
  }>;
}

export interface HrDashboard {
  total_resources: number;
  bench_count: number;
  deployed_count: number;
  awaiting_review: number;
  deployments_ending_30d: number;
  bench_without_a_suggestion: number;
  documents_expired: number;
  documents_expiring_soon: number;
}

export interface AdminDashboard {
  active_users: number;
  audit_events_7d: number;
  unread_notifications: number;
  top_actions_7d: Array<{ action: string; count: number }>;
  active_requirements_unscored: number;
  active_requirements_unpriced: number;
}
