import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Dashboard } from '@/components/dashboards/dashboard';
import { BillingWorkbench } from '@/components/delivery/billing';
import { Deployments } from '@/components/delivery/deployments';
import { useAuthStore } from '@/lib/auth-store';
import {
  BILLING_STATUS_VARIANT,
  confirmedTotal,
  isExtension,
  isRealised,
  marginVariant,
  projectedTotal,
  reconciles,
  runwayLabel,
  runwayVariant,
  shortPeriod,
  trendPeak,
  trendSeries,
} from '@/lib/delivery';
import type {
  BillingHeadline,
  BillingRecord,
  Deployment,
  ManagementDashboard,
  MonthlySummaryRow,
} from '@/types/delivery';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/* -------------------------------------------------------------------- data */

function makeDeployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: 'dep-1',
    resource_id: 'res-1',
    resource_name: 'Rahul Menon',
    account_id: 'acc-1',
    requirement_id: 'req-1',
    submission_id: 'sub-1',
    role_title: 'Senior SAP FICO Consultant',
    location: 'Doha',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    actual_end_date: null,
    effective_end: '2026-12-31',
    days_remaining: 120,
    status: 'ACTIVE',
    bill_rate: '22000.00',
    bill_currency: 'QAR',
    bill_unit: 'MONTHLY',
    cost_rate: '14000.00',
    cost_currency: 'QAR',
    cost_unit: 'MONTHLY',
    restricted_fields: [],
    working_days_per_month: 22,
    hours_per_day: 8,
    extension_of_deployment_id: null,
    end_reason: null,
    created_at: '2026-01-01T09:00:00Z',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<BillingRecord> = {}): BillingRecord {
  return {
    id: 'bill-1',
    deployment_id: 'dep-1',
    resource_name: 'Rahul Menon',
    role_title: 'Senior SAP FICO Consultant',
    period_year: 2026,
    period_month: 8,
    period_label: '2026-08',
    revenue_amount: '22000.00',
    cost_amount: '14000.00',
    gross_profit: '8000.00',
    margin_percent: 36.36,
    currency: 'QAR',
    status: 'PROJECTED',
    is_estimated: true,
    billable_days: 21,
    notes: null,
    created_at: '2026-08-01T09:00:00Z',
    ...overrides,
  };
}

const HEADLINE: BillingHeadline = {
  period: '2026-08',
  confirmed_revenue: '44000.00',
  projected_revenue: '22000.00',
  confirmed_margin_percent: 36.36,
  lifetime_confirmed_revenue: '264000.00',
  lifetime_gross_profit: '96000.00',
  unconfirmed_periods: 3,
};

const SUMMARY: MonthlySummaryRow[] = [
  {
    period: '2026-07',
    year: 2026,
    month: 7,
    confirmed_revenue: '22000.00',
    confirmed_cost: '14000.00',
    confirmed_profit: '8000.00',
    confirmed_margin_percent: 36.36,
    projected_revenue: '0.00',
    projected_cost: '0.00',
    projected_profit: '0.00',
    records: 1,
  },
  {
    period: '2026-08',
    year: 2026,
    month: 8,
    confirmed_revenue: '44000.00',
    confirmed_cost: '28000.00',
    confirmed_profit: '16000.00',
    confirmed_margin_percent: 36.36,
    projected_revenue: '22000.00',
    projected_cost: '14000.00',
    projected_profit: '8000.00',
    records: 3,
  },
];

const MANAGEMENT: ManagementDashboard = {
  headline: HEADLINE,
  trend: SUMMARY,
  active_deployments: 4,
  bench_count: 2,
  accounts: 6,
  opportunity_bands: { PURSUE_NOW: 2, REVIEW: 1 },
  funnel: {
    active_requirements: 8,
    stages: [
      { stage: 'QUALIFIED', label: 'Qualified', count: 3 },
      { stage: 'CV_SUBMITTED', label: 'CV submitted', count: 2 },
      { stage: 'DEPLOYED', label: 'Deployed', count: 1 },
    ],
    closed: [{ stage: 'LOST', label: 'Lost', count: 1 }],
    open_total: 6,
    reached_deployment: 1,
  },
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockApi(
  options: {
    deployments?: Deployment[];
    endingSoon?: Array<{ deployment: Deployment; days_remaining: number }>;
    records?: BillingRecord[];
    headline?: BillingHeadline;
    summary?: MonthlySummaryRow[];
    management?: ManagementDashboard;
  } = {},
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    if (url.includes('/deployments/ending-soon')) return json(options.endingSoon ?? []);
    if (url.includes('/deployments')) return json(options.deployments ?? []);
    if (url.includes('/billing/monthly-revenue')) return json(options.headline ?? HEADLINE);
    if (url.includes('/billing/summary')) return json(options.summary ?? SUMMARY);
    if (url.includes('/billing/records')) return json(options.records ?? []);
    if (url.includes('/dashboard/management')) return json(options.management ?? MANAGEMENT);
    return json({});
  });
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'user-1',
      email: 'management@glimmora.ai',
      full_name: 'Test Manager',
      role: 'MANAGEMENT',
      is_active: true,
      must_change_password: false,
      permissions,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      last_login_at: null,
    } as never,
    status: 'authenticated',
  });
}

beforeEach(() =>
  signIn([
    'deployment:read',
    'deployment:write',
    'billing:read',
    'billing:write',
    'dashboard:management',
  ]),
);
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: 'anonymous', expiresAt: null });
});

/* --------------------------------------------------------------- the rules */

describe('billing presentation rules', () => {
  it('never colours a projection as a success', () => {
    // A projection is arithmetic, not achievement.
    expect(BILLING_STATUS_VARIANT.PROJECTED).toBe('warning');
    expect(BILLING_STATUS_VARIANT.CONFIRMED).toBe('success');
  });

  it('counts only confirmed and invoiced as earned', () => {
    expect(isRealised(makeRecord({ status: 'CONFIRMED' }))).toBe(true);
    expect(isRealised(makeRecord({ status: 'INVOICED' }))).toBe(true);
    expect(isRealised(makeRecord({ status: 'PROJECTED' }))).toBe(false);
    expect(isRealised(makeRecord({ status: 'CANCELLED' }))).toBe(false);
  });

  it('keeps the two totals apart', () => {
    const records = [
      makeRecord({ id: 'a', status: 'CONFIRMED', revenue_amount: '22000.00' }),
      makeRecord({ id: 'b', status: 'PROJECTED', revenue_amount: '22000.00' }),
      makeRecord({ id: 'c', status: 'CANCELLED', revenue_amount: '99999.00' }),
    ];

    expect(confirmedTotal(records)).toBe(22000);
    expect(projectedTotal(records)).toBe(22000);
    // Cancelled belongs to neither.
    expect(confirmedTotal(records) + projectedTotal(records)).toBe(44000);
  });

  it('reports whether the summary reconciles with the records', () => {
    const records = [makeRecord({ status: 'CONFIRMED', revenue_amount: '44000.00' })];
    expect(reconciles(records, SUMMARY[1])).toBe(true);
    expect(reconciles(records, SUMMARY[0])).toBe(false);
  });

  it('treats no records and no summary row as reconciled', () => {
    expect(reconciles([], undefined)).toBe(true);
  });

  it('colours margin against the 30% target', () => {
    expect(marginVariant(36)).toBe('success');
    expect(marginVariant(12)).toBe('warning');
    expect(marginVariant(-4)).toBe('destructive');
    expect(marginVariant(null)).toBe('muted');
  });

  it('scales a trend without dividing by zero', () => {
    expect(trendPeak([])).toBe(1);
    expect(trendPeak(SUMMARY)).toBe(66000);
  });

  it('splits a trend into confirmed and projected', () => {
    const series = trendSeries(SUMMARY);
    expect(series[1]?.confirmed).toBe(44000);
    expect(series[1]?.projected).toBe(22000);
    expect(series[1]?.total).toBe(66000);
  });

  it('formats a period for a compact axis', () => {
    expect(shortPeriod('2026-08')).toMatch(/Aug/);
    expect(shortPeriod('nonsense')).toBe('nonsense');
  });
});

describe('deployment presentation rules', () => {
  it('escalates the runway as the end approaches', () => {
    expect(runwayVariant(5)).toBe('destructive');
    expect(runwayVariant(20)).toBe('warning');
    expect(runwayVariant(90)).toBe('info');
    expect(runwayVariant(null)).toBe('muted');
  });

  it('says "ends today" rather than "0 days left"', () => {
    expect(runwayLabel(0)).toMatch(/today/i);
    expect(runwayLabel(-3)).toMatch(/overdue/i);
    expect(runwayLabel(null)).toMatch(/no end date/i);
  });

  it('recognises an extension', () => {
    expect(isExtension(makeDeployment())).toBe(false);
    expect(isExtension(makeDeployment({ extension_of_deployment_id: 'dep-0' }))).toBe(true);
  });
});

/* --------------------------------------------------------- deployments UI */

describe('deployments screen', () => {
  it('shows the runway and the agreed rate', async () => {
    vi.stubGlobal('fetch', mockApi({ deployments: [makeDeployment()] }));
    render(<Deployments />, { wrapper });

    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());
    expect(screen.getByText('120 days left')).toBeInTheDocument();
    expect(screen.getByText(/rates shown are the ones this engagement was agreed at/i))
      .toBeInTheDocument();
  });

  it('marks an extension as linked rather than as a new placement', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({ deployments: [makeDeployment({ extension_of_deployment_id: 'dep-0' })] }),
    );
    render(<Deployments />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Extension of an earlier deployment/i)).toBeInTheDocument(),
    );
  });

  it('names a bill rate withheld by the role', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        deployments: [makeDeployment({ bill_rate: null, restricted_fields: ['bill_rate'] })],
      }),
    );
    render(<Deployments />, { wrapper });

    await waitFor(() => expect(screen.getByText('hidden')).toBeInTheDocument());
  });

  it('warns that ending cancels future projections', async () => {
    vi.stubGlobal('fetch', mockApi({ deployments: [makeDeployment()] }));
    render(<Deployments />, { wrapper });

    await waitFor(() => expect(screen.getByRole('button', { name: /End$/ })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /End$/ }));

    expect(screen.getByText(/cancels any billing projected for months after/i)).toBeInTheDocument();
  });

  it('explains that extending creates a linked deployment', async () => {
    vi.stubGlobal('fetch', mockApi({ deployments: [makeDeployment()] }));
    render(<Deployments />, { wrapper });

    await waitFor(() => expect(screen.getByRole('button', { name: /Extend/ })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Extend/ }));

    expect(screen.getByText(/not an edit/i)).toBeInTheDocument();
  });

  it('points at the redeployment radar when people are rolling off', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        endingSoon: [{ deployment: makeDeployment({ days_remaining: 12 }), days_remaining: 12 }],
      }),
    );
    render(<Deployments endingSoon />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /redeployment radar/i })).toBeInTheDocument(),
    );
  });

  it('says nobody is rolling off rather than showing an empty table', async () => {
    vi.stubGlobal('fetch', mockApi({ endingSoon: [] }));
    render(<Deployments endingSoon />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Nobody rolls off in the next 90 days/i)).toBeInTheDocument(),
    );
  });

  it('refuses the screen without the read permission', () => {
    signIn([]);
    vi.stubGlobal('fetch', mockApi());
    render(<Deployments />, { wrapper });

    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------- billing UI */

describe('billing screen', () => {
  it('shows confirmed and projected as separate figures', async () => {
    vi.stubGlobal('fetch', mockApi({ records: [makeRecord()] }));
    render(<BillingWorkbench view="records" />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Confirmed this month/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Projected, not yet earned/i)).toBeInTheDocument();
  });

  it('warns that projections are not revenue until confirmed', async () => {
    vi.stubGlobal('fetch', mockApi({ records: [makeRecord()] }));
    render(<BillingWorkbench view="records" />, { wrapper });

    // The sentence is split by a <strong>, so match the contiguous fragment.
    await waitFor(() =>
      expect(
        screen.getByText(/counted as revenue until somebody confirms/i),
      ).toBeInTheDocument(),
    );
  });

  it('offers confirmation only for a projected month', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        records: [
          makeRecord({ id: 'a', status: 'PROJECTED' }),
          makeRecord({ id: 'b', status: 'CONFIRMED', period_label: '2026-07' }),
        ],
      }),
    );
    render(<BillingWorkbench view="records" />, { wrapper });

    await waitFor(() => expect(screen.getAllByText('Rahul Menon').length).toBe(2));
    expect(screen.getAllByRole('button', { name: /^Confirm$/ })).toHaveLength(1);
  });

  it('recomputes profit and margin live while confirming', async () => {
    vi.stubGlobal('fetch', mockApi({ records: [makeRecord()] }));
    render(<BillingWorkbench view="records" />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Confirm$/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /^Confirm$/ }));

    expect(screen.getByText(/The projection was arithmetic/i)).toBeInTheDocument();

    const revenue = screen.getByLabelText('Revenue');
    await userEvent.clear(revenue);
    await userEvent.type(revenue, '20000');

    // "Gross profit" is also a column header, so match the form's own line.
    await waitFor(() => expect(screen.getByText(/· margin/)).toBeInTheDocument());
  });

  it('says the generator never overwrites a confirmed month', async () => {
    vi.stubGlobal('fetch', mockApi({ records: [makeRecord()] }));
    render(<BillingWorkbench view="records" />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/never overwrites a confirmed month/i)).toBeInTheDocument(),
    );
  });

  it('labels the trend legend so projected cannot be mistaken for earned', async () => {
    vi.stubGlobal('fetch', mockApi({ records: [] }));
    render(<BillingWorkbench view="revenue" />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Projected — not yet earned/i)).toBeInTheDocument(),
    );
  });

  it('hides the generate button from a read-only role', async () => {
    signIn(['billing:read']);
    vi.stubGlobal('fetch', mockApi({ records: [makeRecord()] }));
    render(<BillingWorkbench view="records" />, { wrapper });

    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: /Generate projections/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm$/ })).not.toBeInTheDocument();
  });

  it('refuses the screen without the read permission', () => {
    signIn([]);
    vi.stubGlobal('fetch', mockApi());
    render(<BillingWorkbench />, { wrapper });

    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------- dashboards */

describe('dashboard', () => {
  it('shows management the revenue headline and the funnel', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<Dashboard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Confirmed revenue this month/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Projected, not yet earned/i)).toBeInTheDocument();
    expect(screen.getByText('Requirement to billing')).toBeInTheDocument();
  });

  it('states plainly that the two revenue figures are never added', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<Dashboard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/never added together/i)).toBeInTheDocument(),
    );
  });

  it('offers no view switcher when the role has only one dashboard', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<Dashboard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Confirmed revenue this month/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('says so plainly when a role has no dashboard', () => {
    signIn(['deployment:read']);
    vi.stubGlobal('fetch', mockApi());
    render(<Dashboard />, { wrapper });

    expect(screen.getByText(/No dashboard is assigned to your role/i)).toBeInTheDocument();
  });
});
