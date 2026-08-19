import type {
  ContractType,
  DeadlineState,
  PrioritySource,
  RateUnit,
  RequirementSource,
  RequirementStatus,
  SkillImportance,
} from '@/types/demand';

/** SOW section 2 — the pursuit priority order. P1 first. */
export const PRIORITY_SOURCE_LABELS: Record<PrioritySource, string> = {
  P1_EXISTING_CUSTOMER: 'P1 · Existing customer',
  P2_PARTNER_PRIME: 'P2 · Partner / prime',
  P3_PROJECT: 'P3 · Known project',
  P4_ENTERPRISE_GOV: 'P4 · Enterprise / government',
  P5_VENDOR_MSP_VMS: 'P5 · Vendor / MSP / VMS',
  P6_EXTERNAL_APPROVED: 'P6 · Approved external source',
};

export const PRIORITY_SOURCE_ORDER: PrioritySource[] = [
  'P1_EXISTING_CUSTOMER',
  'P2_PARTNER_PRIME',
  'P3_PROJECT',
  'P4_ENTERPRISE_GOV',
  'P5_VENDOR_MSP_VMS',
  'P6_EXTERNAL_APPROVED',
];

export const REQUIREMENT_STATUS_ORDER: RequirementStatus[] = [
  'NEW',
  'PARSED',
  'UNDER_REVIEW',
  'QUALIFIED',
  'ON_HOLD',
  'CLOSED_WON',
  'CLOSED_LOST',
  'EXPIRED',
];

export const REQUIREMENT_STATUS_VARIANT: Record<
  RequirementStatus,
  'default' | 'info' | 'success' | 'warning' | 'muted' | 'destructive'
> = {
  NEW: 'info',
  PARSED: 'info',
  UNDER_REVIEW: 'warning',
  QUALIFIED: 'success',
  ON_HOLD: 'warning',
  CLOSED_WON: 'success',
  CLOSED_LOST: 'muted',
  EXPIRED: 'destructive',
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  CONTRACT: 'Contract',
  CONTRACT_TO_HIRE: 'Contract to hire',
  PERMANENT: 'Permanent',
  OUTSOURCED_SERVICE: 'Outsourced service',
};

export const RATE_UNIT_LABELS: Record<RateUnit, string> = {
  HOURLY: 'per hour',
  DAILY: 'per day',
  MONTHLY: 'per month',
  ANNUAL: 'per year',
};

export const SOURCE_LABELS: Record<RequirementSource, string> = {
  MANUAL: 'Entered manually',
  JD_PASTE: 'Pasted JD',
  DOCUMENT_UPLOAD: 'Uploaded document',
  EMAIL: 'From an email',
  EXCEL_IMPORT: 'Excel import',
  API: 'API',
};

export const SKILL_IMPORTANCE_VARIANT: Record<SkillImportance, 'default' | 'info' | 'muted'> = {
  MANDATORY: 'default',
  PREFERRED: 'info',
  NICE_TO_HAVE: 'muted',
};

/**
 * SLA states. Colour carries the urgency here because this is the one board
 * where a few hours decides whether a seat is winnable at all.
 */
export const DEADLINE_VARIANT: Record<
  DeadlineState,
  'success' | 'warning' | 'destructive' | 'muted'
> = {
  SAFE: 'success',
  DUE_SOON: 'warning',
  URGENT: 'destructive',
  EXPIRED: 'destructive',
  NONE: 'muted',
};

export const DEADLINE_LABELS: Record<DeadlineState, string> = {
  SAFE: 'On track',
  DUE_SOON: 'Due soon',
  URGENT: 'Urgent',
  EXPIRED: 'Expired',
  NONE: 'No deadline',
};

/** Confidence bands shown on the review screen. */
export const CONFIDENCE_LABELS: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH: 'High confidence',
  MEDIUM: 'Check this',
  LOW: 'Not found',
};

export const CONFIDENCE_VARIANT: Record<'HIGH' | 'MEDIUM' | 'LOW', 'success' | 'warning' | 'muted'> =
  {
    HIGH: 'success',
    MEDIUM: 'warning',
    LOW: 'muted',
  };

/** Format an extracted value for the review table. */
export function formatParsedValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** A rate range as one readable phrase. */
export function formatRateRange(
  min: string | null,
  max: string | null,
  currency: string | null,
  unit: RateUnit | null,
): string {
  if (!min && !max) return '—';
  const money = (value: string) =>
    new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Number(value));

  const amount = min && max && min !== max ? `${money(min)} – ${money(max)}` : money(min ?? max!);
  return [currency, amount, unit ? RATE_UNIT_LABELS[unit] : null].filter(Boolean).join(' ');
}
