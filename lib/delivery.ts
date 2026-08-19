import type {
  BillingRecord,
  BillingStatus,
  Deployment,
  DeploymentStatus,
  MonthlySummaryRow,
} from '@/types/delivery';

/**
 * Presentation rules for delivery and billing.
 *
 * One rule outranks the rest: **projected revenue is never shown as earned
 * revenue** (ASSUMPTIONS.md A15). Everything here keeps the two visually and
 * numerically distinct — a headline that quietly folds a forecast into the
 * total would make the platform's central claim untrue.
 */

export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatus, string> = {
  PENDING_START: 'Starting soon',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  ENDED: 'Ended',
};

export const DEPLOYMENT_STATUS_VARIANT: Record<
  DeploymentStatus,
  'success' | 'info' | 'warning' | 'muted'
> = {
  PENDING_START: 'info',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  ENDED: 'muted',
};

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  PROJECTED: 'Projected',
  CONFIRMED: 'Confirmed',
  INVOICED: 'Invoiced',
  CANCELLED: 'Cancelled',
};

export const BILLING_STATUS_VARIANT: Record<
  BillingStatus,
  'success' | 'info' | 'warning' | 'muted'
> = {
  // Deliberately not "success": a projection is arithmetic, not achievement.
  PROJECTED: 'warning',
  CONFIRMED: 'success',
  INVOICED: 'info',
  CANCELLED: 'muted',
};

/** Statuses that count as money the business actually earned. */
export const REALISED_STATUSES: BillingStatus[] = ['CONFIRMED', 'INVOICED'];

export function isRealised(record: BillingRecord): boolean {
  return REALISED_STATUSES.includes(record.status);
}

/** Runway colouring, matching the zero-bench alert severities. */
export function runwayVariant(
  days: number | null,
): 'destructive' | 'warning' | 'info' | 'muted' {
  if (days === null) return 'muted';
  if (days <= 7) return 'destructive';
  if (days <= 30) return 'warning';
  return 'info';
}

export function runwayLabel(days: number | null): string {
  if (days === null) return 'No end date';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Ends today';
  return `${days} days left`;
}

/**
 * Sum the confirmed side of a set of records.
 *
 * Takes only realised statuses on purpose — the caller cannot accidentally
 * include projections by passing the wrong filter.
 */
export function confirmedTotal(records: BillingRecord[]): number {
  return records
    .filter(isRealised)
    .reduce((total, record) => total + Number(record.revenue_amount), 0);
}

export function projectedTotal(records: BillingRecord[]): number {
  return records
    .filter((record) => record.status === 'PROJECTED')
    .reduce((total, record) => total + Number(record.revenue_amount), 0);
}

/**
 * Does the summary agree with the underlying records?
 *
 * The management dashboard is only trustworthy if it reconciles, so the UI
 * checks rather than assumes — a mismatch is surfaced, not hidden.
 */
export function reconciles(
  records: BillingRecord[],
  summaryRow: MonthlySummaryRow | undefined,
): boolean {
  if (!summaryRow) return records.length === 0;
  const confirmed = confirmedTotal(records);
  return Math.abs(confirmed - Number(summaryRow.confirmed_revenue)) < 0.01;
}

/** Margin colouring against the 30% target from SCORING.md. */
export function marginVariant(
  margin: number | null,
): 'success' | 'warning' | 'destructive' | 'muted' {
  if (margin === null) return 'muted';
  if (margin >= 30) return 'success';
  if (margin > 0) return 'warning';
  return 'destructive';
}

/** Chart-ready trend, with the two revenue kinds kept separate. */
export function trendSeries(rows: MonthlySummaryRow[]): Array<{
  period: string;
  confirmed: number;
  projected: number;
  total: number;
}> {
  return rows.map((row) => {
    const confirmed = Number(row.confirmed_revenue);
    const projected = Number(row.projected_revenue);
    return { period: row.period, confirmed, projected, total: confirmed + projected };
  });
}

/** The tallest bar in a trend, for scaling. Never zero, so nothing divides by it. */
export function trendPeak(rows: MonthlySummaryRow[]): number {
  const peak = Math.max(
    0,
    ...trendSeries(rows).map((row) => row.total),
  );
  return peak > 0 ? peak : 1;
}

export function isExtension(deployment: Deployment): boolean {
  return deployment.extension_of_deployment_id !== null;
}

export function shortPeriod(period: string): string {
  const [year, month] = period.split('-');
  if (!year || !month) return period;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}
