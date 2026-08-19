import type { Role } from '@/types/api';

/** Display metadata for roles. Mirrors app/core/permissions.py. */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  MANAGEMENT: 'Management',
  SALES: 'Sales',
  HR_RESOURCING: 'HR / Resourcing',
};

export const ROLE_ORDER: Role[] = ['ADMIN', 'MANAGEMENT', 'SALES', 'HR_RESOURCING'];

export const ROLE_BADGE_VARIANT: Record<Role, 'default' | 'info' | 'success' | 'warning'> = {
  ADMIN: 'warning',
  MANAGEMENT: 'default',
  SALES: 'info',
  HR_RESOURCING: 'success',
};
