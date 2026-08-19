import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ActivityTimeline } from '@/components/accounts/activity-timeline';
import { AddressabilityCard } from '@/components/accounts/addressability-card';
import { ADDRESSABILITY_FACTORS, RELATION_TYPE_LABELS } from '@/lib/accounts';
import type { Activity, AddressabilitySignals } from '@/types/accounts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/accounts/customers',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'account-1' }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const emptySignals: AddressabilitySignals = {
  contract_outsourcing_friendly: false,
  existing_customer: false,
  partner_or_prime_route: false,
  approved_vendor: false,
  decision_maker_known: false,
  signals_met: 0,
  signals_total: 5,
  missing: [
    'Confirm whether this account buys contract or outsourced resources',
    'Not recorded as an existing customer',
    'No partner or prime route recorded',
    'Not recorded as an approved vendor and no MSA',
    'No decision maker identified',
  ],
};

const milahaSignals: AddressabilitySignals = {
  contract_outsourcing_friendly: true,
  existing_customer: true,
  partner_or_prime_route: false,
  approved_vendor: true,
  decision_maker_known: true,
  signals_met: 4,
  signals_total: 5,
  missing: ['No partner or prime route recorded'],
};

describe('addressability card', () => {
  it('shows how many facts are recorded, not a score', () => {
    render(<AddressabilityCard signals={milahaSignals} routeCount={0} />);

    expect(screen.getByText('Addressability inputs')).toBeInTheDocument();
    expect(screen.getByText(/Not a score yet/i)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('/5')).toBeInTheDocument();
  });

  it('lists every factor with the points it carries', () => {
    render(<AddressabilityCard signals={emptySignals} routeCount={0} />);

    for (const factor of ADDRESSABILITY_FACTORS) {
      expect(screen.getByText(factor.label)).toBeInTheDocument();
      expect(screen.getAllByText(`+${factor.points}`).length).toBeGreaterThan(0);
    }
  });

  it('explains that unrecorded facts are unknown, not a no', () => {
    render(<AddressabilityCard signals={emptySignals} routeCount={0} />);

    expect(screen.getByText(/5 facts still unrecorded/i)).toBeInTheDocument();
    expect(screen.getByText(/not because it is a no/i)).toBeInTheDocument();
  });

  it('treats a direct relationship as neutral, not as a failing route', () => {
    render(<AddressabilityCard signals={milahaSignals} routeCount={0} />);

    expect(
      screen.getByText('Direct relationship — no partner route required.'),
    ).toBeInTheDocument();
  });

  it('confirms readiness once every input is recorded', () => {
    render(
      <AddressabilityCard
        signals={{ ...milahaSignals, partner_or_prime_route: true, signals_met: 5, missing: [] }}
        routeCount={1}
      />,
    );

    expect(screen.getByText('All inputs recorded')).toBeInTheDocument();
    expect(screen.getByText('Ready for opportunity scoring')).toBeInTheDocument();
  });

  it('renders nothing when the caller has no signals', () => {
    const { container } = render(<AddressabilityCard signals={null} routeCount={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    activity_type: 'CALL',
    subject: 'Discussed upcoming SAP requirement',
    body: null,
    outcome: null,
    occurred_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    follow_up_at: null,
    completed_at: null,
    is_follow_up_open: false,
    is_follow_up_overdue: false,
    user_id: 'user-1',
    user_name: 'Daniel Fernandes',
    account_id: 'account-1',
    account_name: 'Milaha',
    contact_id: null,
    contact_name: null,
    project_id: null,
    project_name: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('activity timeline', () => {
  it('renders an entry with who logged it', () => {
    render(<ActivityTimeline activities={[activity()]} />, { wrapper });

    expect(screen.getByText('Discussed upcoming SAP requirement')).toBeInTheDocument();
    expect(screen.getByText('by Daniel Fernandes')).toBeInTheDocument();
    expect(screen.getByText('Call')).toBeInTheDocument();
  });

  it('flags an overdue follow-up', () => {
    render(
      <ActivityTimeline
        activities={[
          activity({
            follow_up_at: new Date(Date.now() - 86_400_000).toISOString(),
            is_follow_up_open: true,
            is_follow_up_overdue: true,
          }),
        ]}
      />,
      { wrapper },
    );

    expect(screen.getByText('Follow-up overdue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark follow-up complete/i })).toBeInTheDocument();
  });

  it('offers no completion action when there is no follow-up', () => {
    render(<ActivityTimeline activities={[activity()]} />, { wrapper });
    expect(screen.queryByRole('button', { name: /mark follow-up complete/i })).toBeNull();
  });

  it('shows an empty state rather than a blank panel', () => {
    render(<ActivityTimeline activities={[]} />, { wrapper });
    expect(screen.getByText('No activity recorded yet')).toBeInTheDocument();
  });
});

describe('routing labels', () => {
  it('describes each relation from Glimmora’s point of view', () => {
    expect(RELATION_TYPE_LABELS.SUBCONTRACTS_THROUGH).toBe('We subcontract through');
    expect(RELATION_TYPE_LABELS.VENDOR_TO).toBe('We supply via');
  });
});
