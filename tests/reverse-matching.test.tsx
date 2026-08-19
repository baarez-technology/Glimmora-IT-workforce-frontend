import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BenchRadar } from '@/components/matching/bench-radar';
import { RedeploymentWorkbench } from '@/components/matching/redeployment-workbench';
import { useAuthStore } from '@/lib/auth-store';
import { ROUTE_VARIANT, benchUrgency, rankBench, reachabilityNote } from '@/lib/matching';
import type {
  BenchRadar as BenchRadarData,
  BenchRow,
  ReverseRun,
  Suggestion,
} from '@/types/matching';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/intelligence/reverse-matching',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/* -------------------------------------------------------------------- data */

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'sug-1',
    requirement_id: 'req-1',
    requirement_title: 'Senior SAP FICO Consultant',
    account_name: 'Milaha',
    overall_score: 86,
    priority_score: 86,
    band: 'STRONG',
    confidence: 1,
    route: {
      route_type: 'DIRECT',
      label: 'Milaha (direct)',
      reachability: 1,
      via_account_id: null,
    },
    components: [
      {
        key: 'skills',
        label: 'Skills',
        score: 90,
        weight: 30,
        contribution: 27,
        evidence: '1/1 mandatory',
        detail: {},
      },
      {
        key: 'experience',
        label: 'Experience',
        score: 100,
        weight: 20,
        contribution: 20,
        evidence: '9 years against 5 required',
        detail: {},
      },
    ],
    gaps: [],
    reasons: ['Available now'],
    warnings: [],
    missing_information: [],
    restricted_components: [],
    narrative: 'A strong match at 86%.',
    weights_version: 1,
    engine_version: '1.0.0',
    computed_at: '2026-08-19T09:00:00Z',
    ...overrides,
  };
}

const RUN: ReverseRun = {
  resource_id: 'res-1',
  resource_name: 'Rahul Menon',
  availability_status: 'AVAILABLE_SOON',
  available_from: '2026-09-17',
  computed_at: '2026-08-19T09:00:00Z',
  total: 1,
  suggestions: [makeSuggestion()],
};

const RADAR: BenchRadarData = {
  total: 2,
  on_bench_now: 1,
  without_a_suggestion: 1,
  rows: [
    {
      resource_id: 'res-1',
      resource_name: 'Rahul Menon',
      headline: 'Senior SAP FICO Consultant',
      availability_status: 'AVAILABLE_SOON',
      available_from: '2026-09-17',
      days_until_available: 29,
      blocks_deployment: false,
      top_suggestion: makeSuggestion(),
    },
    {
      resource_id: 'res-2',
      resource_name: 'Elena Vasquez',
      headline: 'Cloud Engineer',
      availability_status: 'AVAILABLE',
      available_from: '2026-08-19',
      days_until_available: 0,
      blocks_deployment: true,
      top_suggestion: null,
    },
  ],
};

const RESOURCES = {
  items: [
    { id: 'res-1', full_name: 'Rahul Menon' },
    { id: 'res-2', full_name: 'Elena Vasquez' },
  ],
  total: 2,
  page: 1,
  page_size: 100,
  pages: 1,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockApi(run: ReverseRun = RUN, radar: BenchRadarData = RADAR) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    if (url.includes('/bench-radar')) return json(radar);
    if (url.includes('/reverse-matching/resources/')) return json(run);
    if (url.includes('/resources')) return json(RESOURCES);
    return json({});
  });
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'hr@glimmora.ai',
      full_name: 'Test Resourcing',
      role: 'HR_RESOURCING',
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

beforeEach(() => signIn(['reverse_matching:read', 'reverse_matching:run', 'resource:read']));
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: 'anonymous', expiresAt: null });
});

/* --------------------------------------------------------------- the rules */

describe('route presentation', () => {
  it('explains a highly reachable route as barely discounted', () => {
    const note = reachabilityNote({
      route_type: 'DIRECT',
      label: 'Milaha (direct)',
      reachability: 1,
      via_account_id: null,
    });
    expect(note).toMatch(/highly reachable/i);
  });

  it('says an unknown route was NOT discounted, not that it is unreachable', () => {
    const note = reachabilityNote({
      route_type: 'UNKNOWN',
      label: null,
      reachability: null,
      via_account_id: null,
    });
    expect(note).toMatch(/not adjusted/i);
    expect(note).not.toMatch(/unreachable/i);
  });

  it('calls an effectively closed door what it is', () => {
    const note = reachabilityNote({
      route_type: 'NO_KNOWN_ROUTE',
      label: 'Cold Prospect',
      reachability: 0.05,
      via_account_id: null,
    });
    expect(note).toMatch(/unreachable/i);
  });

  it('colours a direct route differently from a missing one', () => {
    expect(ROUTE_VARIANT.DIRECT).toBe('success');
    expect(ROUTE_VARIANT.NO_KNOWN_ROUTE).toBe('warning');
    expect(ROUTE_VARIANT.UNKNOWN).toBe('muted');
  });
});

describe('bench urgency', () => {
  it('escalates as the runway shortens', () => {
    expect(benchUrgency(0).variant).toBe('destructive');
    expect(benchUrgency(5).variant).toBe('destructive');
    expect(benchUrgency(20).variant).toBe('warning');
    expect(benchUrgency(60).variant).toBe('info');
  });

  it('does not invent urgency for an unrecorded end date', () => {
    expect(benchUrgency(null).variant).toBe('muted');
    expect(benchUrgency(null).label).toMatch(/no end date/i);
  });

  it('says "on the bench now" rather than "0 days left"', () => {
    expect(benchUrgency(0).label).toMatch(/on the bench now/i);
  });
});

describe('bench ordering', () => {
  it('works the soonest first', () => {
    const ordered = rankBench(RADAR.rows);
    expect(ordered[0]?.resource_id).toBe('res-2');
  });

  it('at equal urgency, puts somebody with nowhere to go first', () => {
    const [first, second] = RADAR.rows;
    const covered: BenchRow = { ...first!, resource_id: 'a', days_until_available: 10 };
    const uncovered: BenchRow = {
      ...second!,
      resource_id: 'b',
      days_until_available: 10,
      top_suggestion: null,
    };
    expect(rankBench([covered, uncovered])[0]?.resource_id).toBe('b');
  });
});

/* --------------------------------------------------------------- workbench */

describe('redeployment workbench', () => {
  it('ranks by priority and names the route', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<RedeploymentWorkbench />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText('Senior SAP FICO Consultant')).toBeInTheDocument(),
    );
    expect(screen.getAllByText('Milaha (direct)').length).toBeGreaterThan(0);
    expect(screen.getByText('redeployment priority')).toBeInTheDocument();
  });

  it('shows the priority arithmetic rather than asserting it', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<RedeploymentWorkbench />, { wrapper });

    await waitFor(() => expect(screen.getByText(/Route to this seat/i)).toBeInTheDocument());
    expect(screen.getByText(/× reachability 1/)).toBeInTheDocument();
  });

  it('never shows a suggestion without its component breakdown', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<RedeploymentWorkbench />, { wrapper });

    await waitFor(() => expect(screen.getByText('Skills')).toBeInTheDocument());
    expect(screen.getByText('1/1 mandatory')).toBeInTheDocument();
  });

  it('is explicit that priority is not the Opportunity Score', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<RedeploymentWorkbench />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/not the\s+Opportunity Score/i)).toBeInTheDocument(),
    );
  });

  it('distinguishes "never searched" from "searched and found nothing"', async () => {
    vi.stubGlobal('fetch', mockApi({ ...RUN, computed_at: null, total: 0, suggestions: [] }));
    const { unmount } = render(<RedeploymentWorkbench />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText(/No next assignments found yet/i)).toBeInTheDocument(),
    );
    unmount();

    vi.stubGlobal('fetch', mockApi({ ...RUN, total: 0, suggestions: [] }));
    render(<RedeploymentWorkbench />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText(/No open requirement currently fits/i)).toBeInTheDocument(),
    );
  });

  it('tells a read-only role it cannot start a search', async () => {
    signIn(['reverse_matching:read', 'resource:read']);
    vi.stubGlobal('fetch', mockApi({ ...RUN, computed_at: null, total: 0, suggestions: [] }));
    render(<RedeploymentWorkbench />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/your role cannot start a search/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: /find next assignments/i }),
    ).not.toBeInTheDocument();
  });

  it('refuses the screen without the read permission', () => {
    signIn([]);
    vi.stubGlobal('fetch', mockApi());
    render(<RedeploymentWorkbench />, { wrapper });

    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------- radar */

describe('bench radar', () => {
  it('leads with the number that matters', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<BenchRadar />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText('Nowhere identified to go')).toBeInTheDocument(),
    );
    expect(screen.getByText(/drive to zero/i)).toBeInTheDocument();
  });

  it('flags a consultant nobody has found a seat for', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<BenchRadar />, { wrapper });

    await waitFor(() => expect(screen.getByText('Elena Vasquez')).toBeInTheDocument());
    expect(screen.getByText('Nothing identified')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /search now/i })).toBeInTheDocument();
  });

  it('surfaces a work-authorisation blocker on the board', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<BenchRadar />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/blocks deployment/i)).toBeInTheDocument(),
    );
  });

  it('reports the dedupe outcome after a sweep', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.includes('/bench-sweep')) {
        return json({ examined: 4, raised: 0, skipped_duplicate: 4 });
      }
      if (url.includes('/bench-radar')) return json(RADAR);
      return json({});
    });
    vi.stubGlobal('fetch', fetcher);

    render(<BenchRadar />, { wrapper });
    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /run sweep now/i }));

    await waitFor(() => expect(screen.getByText(/Sweep complete/i)).toBeInTheDocument());
    expect(screen.getByText(/alerts once — not every morning/i)).toBeInTheDocument();
  });

  it('says so plainly when nobody is approaching the bench', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi(RUN, { total: 0, on_bench_now: 0, without_a_suggestion: 0, rows: [] }),
    );
    render(<BenchRadar />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Nobody is approaching the bench/i)).toBeInTheDocument(),
    );
  });

  it('hides the sweep button from a role that cannot run it', async () => {
    signIn(['reverse_matching:read']);
    vi.stubGlobal('fetch', mockApi());
    render(<BenchRadar />, { wrapper });

    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /run sweep now/i })).not.toBeInTheDocument();
  });
});
