import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobFeed } from '@/components/jobfeed/job-feed';
import { ConnectAlerts } from '@/components/jobfeed/connect-alerts';
import { JobSearch } from '@/components/jobfeed/job-search';
import { useAuthStore } from '@/lib/auth-store';
import { WORKPLACE_LABELS, WORKPLACE_ORDER, jobSubtitle } from '@/lib/jobfeed';
import { NAVIGATION, isVisibleTo } from '@/lib/navigation';
import { ROLE_ORDER } from '@/lib/roles';
import type { JobFeedItem } from '@/types/jobfeed';

/**
 * The individual job feed.
 *
 * The feed is private by row on the server. These tests cover what the client
 * is responsible for: showing the right filter, never implying an arrangement
 * the source did not state, and keeping staff navigation away from a role that
 * holds two permissions.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/jobs/feed',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function signInAsIndividual(permissions = ['job_feed:read', 'job_feed:write']) {
  useAuthStore.setState({
    user: {
      id: 'user-1',
      email: 'person@example.com',
      full_name: 'Test Person',
      role: 'INDIVIDUAL',
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

function makeItem(overrides: Partial<JobFeedItem> = {}): JobFeedItem {
  return {
    id: 'item-1',
    received_at: '2026-10-01T08:00:00Z',
    is_read: false,
    is_saved: false,
    posting_id: 'posting-1',
    title: 'Senior Python Developer',
    company_name: 'Ras Laffan Logistics',
    location: 'Doha, Qatar',
    country: 'QA',
    workplace_type: 'REMOTE',
    description: 'Backend role, fully remote.',
    url: 'https://example.com/job/1',
    source: 'LINKEDIN_ALERT',
    source_name: 'linkedin',
    posted_at: '2026-09-28',
    ...overrides,
  };
}

function json(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function mockApi(items: JobFeedItem[] = []) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/job-feed/counts')) {
      return json({
        total: items.length,
        unread: items.filter((item) => !item.is_read).length,
        saved: items.filter((item) => item.is_saved).length,
        ONSITE: items.filter((item) => item.workplace_type === 'ONSITE').length,
        REMOTE: items.filter((item) => item.workplace_type === 'REMOTE').length,
        HYBRID: items.filter((item) => item.workplace_type === 'HYBRID').length,
        UNKNOWN: items.filter((item) => item.workplace_type === 'UNKNOWN').length,
      });
    }
    if (url.includes('/job-feed')) {
      return json({ items, total: items.length, limit: 50, offset: 0 });
    }
    return json({});
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: 'anonymous', expiresAt: null });
});

/* --------------------------------------------------------- presentation */

describe('workplace presentation', () => {
  it('names an unstated arrangement rather than hiding it', () => {
    // The whole point: a source that never said is not the same as onsite.
    expect(WORKPLACE_LABELS.UNKNOWN).toBe('Not stated');
  });

  it('offers all four arrangements as filters', () => {
    expect(WORKPLACE_ORDER).toHaveLength(4);
    expect(WORKPLACE_ORDER).toContain('UNKNOWN');
  });

  it('builds a subtitle from whichever parts exist', () => {
    expect(jobSubtitle('Milaha', 'Doha')).toBe('Milaha · Doha');
    expect(jobSubtitle('Milaha', null)).toBe('Milaha');
    expect(jobSubtitle(null, null)).toBe('');
  });
});

/* ------------------------------------------------------------- the feed */

describe('the feed', () => {
  beforeEach(() => signInAsIndividual());

  it('lists the jobs that reached this person', async () => {
    vi.stubGlobal('fetch', mockApi([makeItem()]));
    render(<JobFeed />, { wrapper });

    expect(await screen.findByText('Senior Python Developer')).toBeInTheDocument();
    expect(screen.getByText('Ras Laffan Logistics · Doha, Qatar')).toBeInTheDocument();
  });

  it('says the feed is private', async () => {
    vi.stubGlobal('fetch', mockApi([makeItem()]));
    render(<JobFeed />, { wrapper });

    expect(await screen.findByText(/Only you can see this feed/i)).toBeInTheDocument();
  });

  it('asks the API for one arrangement when a filter is chosen', async () => {
    const fetchMock = mockApi([makeItem()]);
    vi.stubGlobal('fetch', fetchMock);
    render(<JobFeed />, { wrapper });

    await screen.findByText('Senior Python Developer');
    await userEvent.click(screen.getByRole('button', { name: /^Remote/ }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes('workplace_type=REMOTE'),
        ),
      ).toBe(true),
    );
  });

  it('explains the Not stated filter rather than leaving it cryptic', async () => {
    vi.stubGlobal('fetch', mockApi([makeItem({ workplace_type: 'UNKNOWN' })]));
    render(<JobFeed />, { wrapper });

    await screen.findByText('Senior Python Developer');
    await userEvent.click(screen.getByRole('button', { name: /^Not stated/ }));

    expect(await screen.findByText(/never said whether the role is/i)).toBeInTheDocument();
  });

  it('offers somewhere to start when the feed is empty', async () => {
    vi.stubGlobal('fetch', mockApi([]));
    render(<JobFeed />, { wrapper });

    expect(await screen.findByText(/No jobs yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add a job/i }).length).toBeGreaterThan(0);
  });

  it('refuses the screen to anyone without the permission', () => {
    signInAsIndividual([]);
    vi.stubGlobal('fetch', mockApi([]));
    render(<JobFeed />, { wrapper });

    expect(screen.queryByText(/Your job feed/i)).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------- the boundary */

describe('an individual is not staff', () => {
  const individual = { role: 'INDIVIDUAL' as const, permissions: ['job_feed:read', 'job_feed:write'] };

  it('sees only the two job screens in navigation', () => {
    const visible = NAVIGATION.flatMap((section) => section.items).filter((item) =>
      isVisibleTo(item, individual),
    );

    expect(visible.map((item) => item.href).sort()).toEqual([
      '/jobs/connect',
      '/jobs/feed',
      '/jobs/saved',
      '/jobs/search',
    ]);
  });

  it('sees no staff screen at all', () => {
    const visible = NAVIGATION.flatMap((section) => section.items)
      .filter((item) => isVisibleTo(item, individual))
      .map((item) => item.href);

    // The four that previously declared no gate are the ones worth naming:
    // before this feature they would have shown to anybody signed in.
    for (const staffOnly of ['/dashboard', '/system', '/deployments/active', '/admin/users']) {
      expect(visible).not.toContain(staffOnly);
    }
  });

  it('is never offered as a role an administrator can assign', () => {
    // Individuals register themselves. Listing the role in the admin picker
    // would offer a choice the API refuses.
    expect(ROLE_ORDER).not.toContain('INDIVIDUAL');
  });

  it('still sees the staff screens when signed in as staff', () => {
    const sales = { role: 'SALES' as const, permissions: ['opportunity:read', 'deployment:read'] };
    const visible = NAVIGATION.flatMap((section) => section.items)
      .filter((item) => isVisibleTo(item, sales))
      .map((item) => item.href);

    expect(visible).toContain('/sales/pipeline');
    expect(visible).not.toContain('/jobs/feed');
  });
});

/* ------------------------------------------------------------ job search */

function mockSearchApi(
  options: { available?: boolean; results?: unknown[]; stillRunning?: boolean } = {},
) {
  const { available = true, results = [], stillRunning = false } = options;
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/job-feed/search/available')) {
      return json({ available, provider: available ? 'apify' : null });
    }
    if (url.includes('/job-feed/search/')) {
      return json({
        search_id: 'run-1',
        status: stillRunning ? 'RUNNING' : 'SUCCEEDED',
        results: stillRunning ? [] : results,
        error: null,
      });
    }
    if (url.includes('/job-feed/search') && init?.method === 'POST') {
      return json({ search_id: 'run-1', status: 'RUNNING' });
    }
    return json({ items: [], total: 0, limit: 50, offset: 0 });
  });
}

describe('job search', () => {
  beforeEach(() => signInAsIndividual());

  it('says so when no provider is configured instead of offering a dead box', async () => {
    vi.stubGlobal('fetch', mockSearchApi({ available: false }));
    render(<JobSearch />, { wrapper });

    expect(await screen.findByText(/not configured on this deployment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Search$/ })).toBeDisabled();
  });

  it('warns that leaving the arrangement on Any returns unstated results', async () => {
    // The provider only labels the arrangement when asked for one. Users
    // should know that before they wonder why everything says "Not stated".
    vi.stubGlobal('fetch', mockSearchApi());
    render(<JobSearch />, { wrapper });

    expect(
      await screen.findByText(/most results arrive without a stated arrangement/i),
    ).toBeInTheDocument();
  });

  it('will not search without a title', async () => {
    vi.stubGlobal('fetch', mockSearchApi());
    render(<JobSearch />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText('Job titles')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Search$/ })).toBeDisabled();
  });

  it('sends the arrangement to the server rather than filtering afterwards', async () => {
    const fetchMock = mockSearchApi();
    vi.stubGlobal('fetch', fetchMock);
    render(<JobSearch />, { wrapper });

    await userEvent.type(await screen.findByLabelText('Job titles'), 'Python Developer');
    await userEvent.selectOptions(screen.getByLabelText('Arrangement'), 'REMOTE');
    await userEvent.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(posted).toBeDefined();
      expect(String((posted![1] as RequestInit).body)).toContain('REMOTE');
    });
  });

  it('tells the reader a search takes time rather than looking stuck', async () => {
    vi.stubGlobal('fetch', mockSearchApi({ stillRunning: true }));
    render(<JobSearch />, { wrapper });

    await userEvent.type(await screen.findByLabelText('Job titles'), 'Developer');
    await userEvent.click(screen.getByRole('button', { name: /^Search$/ }));

    expect(await screen.findByText(/about thirty seconds/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------ connect alerts */

function mockConnectApi(connection: Record<string, unknown> = {}) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/alerts/connection')) {
      return json({
        enabled: true,
        forwarding_address: 'jobs+abc123@jobs.glimmora.ai',
        verified: false,
        count: 0,
        last_received_at: null,
        ...connection,
      });
    }
    return json({});
  });
}

describe('connecting LinkedIn alerts', () => {
  beforeEach(() => signInAsIndividual());

  it('does not claim LinkedIn is sending us anything', async () => {
    // The honesty point. A "Connect with LinkedIn" button would make people
    // believe LinkedIn delivers the jobs. Their forwarding rule does.
    vi.stubGlobal('fetch', mockConnectApi());
    render(<ConnectAlerts />, { wrapper });

    expect(
      await screen.findByText(/no way to send us your alerts directly/i),
    ).toBeInTheDocument();
  });

  it('shows the private forwarding address', async () => {
    vi.stubGlobal('fetch', mockConnectApi());
    render(<ConnectAlerts />, { wrapper });

    const field = await screen.findByLabelText('Your forwarding address');
    expect(field).toHaveValue('jobs+abc123@jobs.glimmora.ai');
  });

  it('says nothing has arrived rather than implying it works', async () => {
    vi.stubGlobal('fetch', mockConnectApi());
    render(<ConnectAlerts />, { wrapper });

    expect(await screen.findByText(/Not connected yet/i)).toBeInTheDocument();
    expect(screen.getByText(/turns green on its own/i)).toBeInTheDocument();
  });

  it('confirms once alerts have actually been received', async () => {
    vi.stubGlobal(
      'fetch',
      mockConnectApi({ verified: true, count: 3, last_received_at: '2026-10-01T08:00:00Z' }),
    );
    render(<ConnectAlerts />, { wrapper });

    expect(await screen.findByText(/Receiving alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/3 jobs received/i)).toBeInTheDocument();
  });

  it('warns when forwarding is not switched on yet', async () => {
    vi.stubGlobal('fetch', mockConnectApi({ enabled: false }));
    render(<ConnectAlerts />, { wrapper });

    expect(await screen.findByText(/not switched on for this deployment/i)).toBeInTheDocument();
  });

  it('offers pasting an alert so the feature works before any DNS', async () => {
    vi.stubGlobal('fetch', mockConnectApi());
    render(<ConnectAlerts />, { wrapper });

    expect(await screen.findByLabelText('The email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import into my feed/i })).toBeDisabled();
  });
});
