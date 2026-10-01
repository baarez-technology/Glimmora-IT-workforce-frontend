import type { JobSource, WorkplaceType } from '@/types/jobfeed';

/**
 * How the four arrangements are named and coloured.
 *
 * `UNKNOWN` reads as "Not stated" rather than being hidden or folded into
 * onsite. It is information — the source did not say — and a reader filtering
 * for remote roles deserves to know these exist rather than silently losing
 * them.
 */
export const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  ONSITE: 'Onsite',
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  UNKNOWN: 'Not stated',
};

export const WORKPLACE_VARIANT: Record<
  WorkplaceType,
  'default' | 'info' | 'success' | 'warning' | 'muted'
> = {
  ONSITE: 'default',
  REMOTE: 'success',
  HYBRID: 'info',
  UNKNOWN: 'muted',
};

/** The order the filter chips appear in. */
export const WORKPLACE_ORDER: WorkplaceType[] = ['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN'];

/**
 * Where a posting came from.
 *
 * MANUAL reads "Added manually" rather than "Added by you": the posting is
 * shared across everyone it reached, so a job one person typed in and passed
 * to a colleague would otherwise tell the recipient they added it themselves.
 * Who put it in *your* feed is the handover line on the card, not this badge.
 */
export const SOURCE_LABELS: Record<JobSource, string> = {
  LINKEDIN_ALERT: 'LinkedIn alert',
  SEARCH: 'Search',
  MANUAL: 'Added manually',
};

/** "Doha, Qatar · Ras Laffan Logistics" — whichever parts exist. */
export function jobSubtitle(company: string | null, location: string | null): string {
  return [company, location].filter(Boolean).join(' · ');
}
