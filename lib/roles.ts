import type { Role } from '@/types/api';

/** Display metadata for roles. Mirrors app/core/permissions.py. */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  MANAGEMENT: 'Management',
  SALES: 'Sales',
  HR_RESOURCING: 'HR / Resourcing',
  INDIVIDUAL: 'Individual',
};

/**
 * The staff roles, in the order they are shown.
 *
 * INDIVIDUAL is deliberately absent: it is not a staff role, it is never
 * assigned by an administrator, and listing it in a role picker would offer
 * a choice the API refuses.
 */
export const ROLE_ORDER: Role[] = ['ADMIN', 'MANAGEMENT', 'SALES', 'HR_RESOURCING'];

export const ROLE_BADGE_VARIANT: Record<
  Role,
  'default' | 'info' | 'success' | 'warning' | 'muted'
> = {
  ADMIN: 'warning',
  MANAGEMENT: 'default',
  SALES: 'info',
  HR_RESOURCING: 'success',
  INDIVIDUAL: 'muted',
};
