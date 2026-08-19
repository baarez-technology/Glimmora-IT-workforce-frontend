import type { AccountType, ActivityType, ProjectStatus, RelationType } from '@/types/accounts';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CUSTOMER: 'Customer',
  PARTNER: 'Partner',
  PRIME_CONTRACTOR: 'Prime contractor',
  VENDOR_MSP: 'Vendor / MSP',
  PROSPECT: 'Prospect',
};

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'CUSTOMER',
  'PARTNER',
  'PRIME_CONTRACTOR',
  'VENDOR_MSP',
  'PROSPECT',
];

export const ACCOUNT_TYPE_VARIANT: Record<
  AccountType,
  'success' | 'info' | 'warning' | 'default' | 'muted'
> = {
  CUSTOMER: 'success',
  PARTNER: 'info',
  PRIME_CONTRACTOR: 'warning',
  VENDOR_MSP: 'default',
  PROSPECT: 'muted',
};

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  SUBCONTRACTS_THROUGH: 'We subcontract through',
  PRIME_FOR: 'Acts as prime for',
  PARTNER_OF: 'Partners with',
  VENDOR_TO: 'We supply via',
};

export const RELATION_TYPE_ORDER: RelationType[] = [
  'SUBCONTRACTS_THROUGH',
  'PARTNER_OF',
  'VENDOR_TO',
  'PRIME_FOR',
];

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  'PLANNED',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
];

export const PROJECT_STATUS_VARIANT: Record<
  ProjectStatus,
  'success' | 'info' | 'warning' | 'muted' | 'destructive'
> = {
  ACTIVE: 'success',
  PLANNED: 'info',
  ON_HOLD: 'warning',
  COMPLETED: 'muted',
  CANCELLED: 'destructive',
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: 'Call',
  EMAIL: 'Email',
  NOTE: 'Note',
  MEETING: 'Meeting',
  TASK: 'Task',
  STATUS_CHANGE: 'Status change',
  SYSTEM: 'System',
};

export const LOGGABLE_ACTIVITY_TYPES: ActivityType[] = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];

/**
 * The five Addressability inputs an account contributes, with the points each
 * carries in the default ruleset (SCORING.md section 2). Showing the points here
 * is what makes a missing fact feel worth filling in.
 */
export const ADDRESSABILITY_FACTORS: Array<{
  key: keyof import('@/types/accounts').AddressabilitySignals;
  label: string;
  points: number;
  hint: string;
}> = [
  {
    key: 'contract_outsourcing_friendly',
    label: 'Buys contract / outsourced resources',
    points: 10,
    hint: 'Some organisations only hire permanently. Those are not addressable for us.',
  },
  {
    key: 'existing_customer',
    label: 'Existing Glimmora customer',
    points: 20,
    hint: 'An existing relationship is the strongest single signal.',
  },
  {
    key: 'partner_or_prime_route',
    label: 'Partner or prime route available',
    points: 15,
    hint: 'Scores zero — and is fine — when we sell to this account directly.',
  },
  {
    key: 'approved_vendor',
    label: 'Approved vendor or MSA in place',
    points: 20,
    hint: 'Without vendor approval we cannot submit, however good the candidate is.',
  },
  {
    key: 'decision_maker_known',
    label: 'Decision maker identified',
    points: 10,
    hint: 'Add a contact and mark them as a decision maker.',
  },
];
