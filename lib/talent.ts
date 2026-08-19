import type {
  AvailabilityStatus,
  DocumentExpiryState,
  DocumentType,
  ResourceType,
  VisaStatus,
} from '@/types/talent';

/** SOW section 6 — the seven categories the talent cloud covers. */
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  EMPLOYEE: 'Employee',
  BENCH: 'Bench',
  CONSULTANT: 'Consultant',
  FREELANCER: 'Freelancer',
  PARTNER_RESOURCE: 'Partner resource',
  PREVIOUS_CANDIDATE: 'Previous candidate',
  PRE_VETTED_CANDIDATE: 'Pre-vetted candidate',
};

export const RESOURCE_TYPE_ORDER: ResourceType[] = [
  'EMPLOYEE',
  'BENCH',
  'CONSULTANT',
  'FREELANCER',
  'PARTNER_RESOURCE',
  'PREVIOUS_CANDIDATE',
  'PRE_VETTED_CANDIDATE',
];

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  AVAILABLE: 'Available now',
  AVAILABLE_SOON: 'Available soon',
  DEPLOYED: 'Deployed',
  NOT_AVAILABLE: 'Not available',
};

export const AVAILABILITY_ORDER: AvailabilityStatus[] = [
  'AVAILABLE',
  'AVAILABLE_SOON',
  'DEPLOYED',
  'NOT_AVAILABLE',
];

export const AVAILABILITY_VARIANT: Record<
  AvailabilityStatus,
  'success' | 'info' | 'muted' | 'warning'
> = {
  AVAILABLE: 'success',
  AVAILABLE_SOON: 'info',
  DEPLOYED: 'muted',
  NOT_AVAILABLE: 'warning',
};

/**
 * Expiry states. An expired work permit stops billing, so it is coloured as
 * severely as a failure — because commercially, that is what it is.
 */
export const EXPIRY_VARIANT: Record<
  DocumentExpiryState,
  'success' | 'warning' | 'destructive' | 'muted'
> = {
  VALID: 'success',
  EXPIRING_SOON: 'warning',
  EXPIRED: 'destructive',
  NOT_APPLICABLE: 'muted',
};

export const EXPIRY_LABELS: Record<DocumentExpiryState, string> = {
  VALID: 'Valid',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired',
  NOT_APPLICABLE: 'Not tracked',
};

export const VISA_STATUS_VARIANT: Record<
  VisaStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'info'
> = {
  VALID: 'success',
  IN_PROCESS: 'info',
  EXPIRED: 'destructive',
  NOT_REQUIRED: 'muted',
  UNKNOWN: 'warning',
};

export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'CV',
  'PASSPORT',
  'ID',
  'QID',
  'VISA',
  'WORK_PERMIT',
  'CONTRACT',
  'CERTIFICATE',
  'OTHER',
];

/** Documents whose lapse stops a consultant working. */
export const WORK_AUTHORISATION_TYPES: DocumentType[] = ['VISA', 'WORK_PERMIT', 'QID'];

export function isWorkAuthorisation(docType: DocumentType): boolean {
  return WORK_AUTHORISATION_TYPES.includes(docType);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRate(
  amount: string | null,
  currency: string | null,
  unit: string | null,
): string {
  if (!amount) return '—';
  const value = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(
    Number(amount),
  );
  const unitLabel = unit ? unit.toLowerCase().replace('ly', '') : '';
  return [currency, value, unitLabel ? `per ${unitLabel === 'hour' ? 'hour' : unitLabel}` : '']
    .filter(Boolean)
    .join(' ');
}

export function formatExperience(years: number | null): string {
  if (years === null || years === undefined) return '—';
  return years >= 1 ? `${years.toFixed(1)} years` : 'Under a year';
}
