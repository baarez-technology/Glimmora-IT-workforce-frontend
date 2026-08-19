import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  EmptyState,
  ErrorState,
  LoadingState,
  NotBuiltYetState,
  PermissionDeniedState,
} from '@/components/states';
import { ApiError } from '@/lib/api';
import {
  formatMoney,
  formatPercent,
  formatScore,
  formatTimeRemaining,
  humanizeEnum,
  initials,
} from '@/lib/format';
import { CURRENT_PHASE, NAVIGATION, findNavItem, isBuilt } from '@/lib/navigation';

describe('shared states', () => {
  it('announces loading to assistive technology', () => {
    render(<LoadingState label="Loading requirements…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading requirements…');
  });

  it('renders an empty state distinct from an error', () => {
    render(<EmptyState title="No requirements yet" description="Add one to get started." />);
    expect(screen.getByText('No requirements yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces the API error message, field details and request id', () => {
    const error = new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'The requirement could not be saved.',
      status: 422,
      details: [{ field: 'response_deadline_at', message: 'Must be in the future' }],
      requestId: 'req-123',
    });

    render(<ErrorState error={error} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('The requirement could not be saved.')).toBeInTheDocument();
    expect(screen.getByText(/Must be in the future/)).toBeInTheDocument();
    expect(screen.getByText(/req-123/)).toBeInTheDocument();
  });

  it('renders a 403 as a permission state, not a crash', () => {
    const error = new ApiError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to do that.',
      status: 403,
    });

    render(<ErrorState error={error} />);
    expect(screen.getByText('You do not have access to this')).toBeInTheDocument();
  });

  it('explains an unreachable API rather than showing a raw failure', () => {
    const error = new ApiError({
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Cannot reach the Glimmora API. Check that the backend is running.',
      status: 0,
    });

    render(<ErrorState error={error} />);
    expect(screen.getByText('Cannot reach the Glimmora API')).toBeInTheDocument();
  });

  it('names the delivering phase on an unbuilt screen', () => {
    render(<NotBuiltYetState title="Reverse Matching" phase={8} />);
    expect(screen.getByText('Reverse Matching arrives in Phase 8')).toBeInTheDocument();
  });

  it('explains why a permission state happened', () => {
    render(<PermissionDeniedState />);
    expect(screen.getByText(/commercial or personal data/i)).toBeInTheDocument();
  });
});

describe('formatters', () => {
  it('formats money with its currency and no float drift', () => {
    expect(formatMoney(48000, 'QAR')).toContain('48,000');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(1_500_000, 'QAR', { compact: true })).toMatch(/1\.5M/);
  });

  it('formats scores as whole numbers on a 0-100 scale', () => {
    expect(formatScore(91.15)).toBe('91');
    expect(formatScore(null)).toBe('—');
  });

  it('formats margin percentages', () => {
    expect(formatPercent(34.25)).toBe('34.3%');
  });

  it('labels an expired deadline as overdue, never as negative time', () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatTimeRemaining(past)).toMatch(/overdue$/);

    const future = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
    expect(formatTimeRemaining(future)).toMatch(/left$/);
  });

  it('humanizes enum values for display', () => {
    expect(humanizeEnum('PRIME_CONTRACTOR')).toBe('Prime contractor');
    expect(humanizeEnum(null)).toBe('—');
  });

  it('derives initials safely', () => {
    expect(initials('Rahul Menon')).toBe('RM');
    expect(initials(undefined)).toBe('?');
  });
});

describe('navigation', () => {
  it('covers the full information architecture', () => {
    const sections = NAVIGATION.map((section) => section.label);
    expect(sections).toEqual(
      expect.arrayContaining([
        'Demand',
        'Accounts',
        'Talent',
        'AI Intelligence',
        'Sales',
        'Deployments',
        'Billing',
        'Administration',
      ]),
    );
  });

  it('assigns every item a delivering phase', () => {
    for (const section of NAVIGATION) {
      for (const item of section.items) {
        expect(item.phase).toBeGreaterThanOrEqual(2);
        expect(item.phase).toBeLessThanOrEqual(12);
      }
    }
  });

  it('uses unique hrefs so routing never collides', () => {
    const hrefs = NAVIGATION.flatMap((section) => section.items).map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('marks only current-phase screens as built', () => {
    const built = NAVIGATION.flatMap((s) => s.items).filter(isBuilt);
    expect(built.every((item) => item.phase <= CURRENT_PHASE)).toBe(true);
    expect(built.map((item) => item.href)).toContain('/system');
  });

  it('resolves a nested path back to its nav item', () => {
    expect(findNavItem('/talent/resources/abc-123')?.label).toBe('All Resources');
    expect(findNavItem('/nowhere')).toBeUndefined();
  });
});
