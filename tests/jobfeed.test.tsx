import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobFeed } from '@/components/jobfeed/job-feed';
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

function signInWithFeed(permissions = ['job_feed:read', 'job_feed:write']) {
  useAuthStore.setState({
    user: {
      id: 'user-1',
      email: 'person@example.com',
      full_name: 'Test Person',
      role: 'SALES',
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
    shared_by_name: null,
    shared_by_role: null,
    share_note: null,
    shared_at: null,
    share_acknowledged: false,
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
  beforeEach(() => signInWithFeed());

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

  it('points an empty feed at search, not at adding a job by hand', async () => {
    // Adding a job is a hand-off to the team, so it lives on the shared tab.
    // Offering it here would invite a private pile nobody acts on.
    vi.stubGlobal('fetch', mockApi([]));
    render(<JobFeed />, { wrapper });

    expect(await screen.findByText(/No jobs yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Search the open market/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add a job/i })).not.toBeInTheDocument();
  });

  it('refuses the screen to anyone without the permission', () => {
    signInWithFeed([]);
    vi.stubGlobal('fetch', mockApi([]));
    render(<JobFeed />, { wrapper });

    expect(screen.queryByText(/Your job feed/i)).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------- the boundary */

describe('who holds the job offers workspace', () => {
  const sourcing = {
    role: 'SALES' as const,
    permissions: ['job_feed:read', 'job_feed:write', 'job_feed:share', 'opportunity:read'],
  };

  it('is one sidebar entry, not four', () => {
    const jobItems = NAVIGATION.flatMap((section) => section.items).filter((item) =>
      item.href.startsWith('/jobs'),
    );

    expect(jobItems).toHaveLength(1);
    expect(jobItems[0]?.href).toBe('/jobs');
  });

  it('shows it to a role holding the feed', () => {
    const visible = NAVIGATION.flatMap((section) => section.items)
      .filter((item) => isVisibleTo(item, sourcing))
      .map((item) => item.href);

    expect(visible).toContain('/jobs');
    // Still staff: the business screens did not go anywhere.
    expect(visible).toContain('/sales/pipeline');
  });

  it('hides it from a role that does not hold the feed', () => {
    const management = {
      role: 'MANAGEMENT' as const,
      permissions: ['opportunity:read', 'billing:read'],
    };
    const visible = NAVIGATION.flatMap((section) => section.items)
      .filter((item) => isVisibleTo(item, management))
      .map((item) => item.href);

    expect(visible).not.toContain('/jobs');
  });

  it('no longer offers an external role an administrator could assign', () => {
    expect(ROLE_ORDER).not.toContain('INDIVIDUAL');
    expect(ROLE_ORDER).toEqual(['ADMIN', 'MANAGEMENT', 'SALES', 'HR_RESOURCING']);
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
  beforeEach(() => signInWithFeed());

  it('says so when no provider is configured instead of offering a dead box', async () => {
    vi.stubGlobal('fetch', mockSearchApi({ available: false }));
    render(<JobSearch />, { wrapper });

    expect(await screen.findByText(/not configured on this deployment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Search$/ })).toBeDisabled();
  });

  it('explains what an Any search costs, since that is how the filter works', async () => {
    // The provider only labels the arrangement when asked for one, so an "Any"
    // search has to ask three times for the arrangement filter to mean
    // anything. That is real money, so the screen must say so rather than
    // spending it quietly. Asserts the offer is explained, not its wording.
    vi.stubGlobal('fetch', mockSearchApi());
    render(<JobSearch />, { wrapper });

    expect(await screen.findByText(/thorough search/i)).toBeInTheDocument();
    expect(screen.getByText(/three provider runs instead of one/i)).toBeInTheDocument();
  });

  it('will not search without a title', async () => {
    vi.stubGlobal('fetch', mockSearchApi());
    render(<JobSearch />, { wrapper });

    await waitFor(() => expect(screen.getByLabelText('Job titles')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Search$/ })).toBeDisabled();
  });

  it('asks the form for no arrangement, and fans out to get one instead', async () => {
    // The arrangement is chosen beside the results, not before the search:
    // the provider only reports it on a filtered run, so the way to filter a
    // broad search afterwards is to have asked for all three up front.
    const fetchMock = mockSearchApi();
    vi.stubGlobal('fetch', fetchMock);
    render(<JobSearch />, { wrapper });

    await userEvent.type(await screen.findByLabelText('Job titles'), 'Python Developer');
    expect(screen.queryByLabelText('Arrangement')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(posted).toBeDefined();
      const body = String((posted![1] as RequestInit).body);
      expect(body).toContain('"thorough":true');
      expect(body).toContain('"workplace_type":null');
    });
  });

  it('tells the reader a search takes time rather than looking stuck', async () => {
    vi.stubGlobal('fetch', mockSearchApi({ stillRunning: true }));
    render(<JobSearch />, { wrapper });

    await userEvent.type(await screen.findByLabelText('Job titles'), 'Developer');
    await userEvent.click(screen.getByRole('button', { name: /^Search$/ }));

    // Matched on the duration, not the exact sentence: the point of the test is
    // that waiting is explained at all, and pinning the wording made a copy
    // correction look like a regression.
    expect(await screen.findByText(/seconds/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------- the handover tab */

describe('shared-with-me section', () => {
  beforeEach(() => signInWithFeed());

  it('is a section of its own, not a checkbox buried in the feed', async () => {
    // Sales and Resourcing hand jobs to each other; that inbox has to be
    // somewhere you can point at, not a filter you have to know about.
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/counts')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                total: 1, unread: 1, saved: 0, shared: 1,
                ONSITE: 0, REMOTE: 1, HYBRID: 0, UNKNOWN: 0,
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            ),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                makeItem({
                  shared_by_name: 'Daniel Fernandes',
                  shared_by_role: 'SALES',
                  share_note: 'Good fit for the Milaha bench',
                  shared_at: '2026-10-01T09:00:00Z',
                }),
              ],
              total: 1, limit: 50, offset: 0,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }),
    );

    render(<JobFeed sharedOnly />, { wrapper });

    expect(await screen.findByText('Shared with me')).toBeInTheDocument();
    expect(await screen.findByText(/Daniel Fernandes/)).toBeInTheDocument();
    expect(screen.getByText(/Good fit for the Milaha bench/)).toBeInTheDocument();
  });

  it('is where a job found off-platform is added, so it reaches the team', async () => {
    signInWithFeed(['job_feed:read', 'job_feed:write', 'job_feed:share']);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [], total: 0, limit: 50, offset: 0 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    render(<JobFeed sharedOnly />, { wrapper });

    expect(await screen.findByText(/Nothing shared with you yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add a job/i }).length).toBeGreaterThan(0);
  });

  it('does not offer it to somebody who cannot share', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [], total: 0, limit: 50, offset: 0 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    signInWithFeed(['job_feed:read', 'job_feed:write']);
    render(<JobFeed sharedOnly />, { wrapper });

    expect(await screen.findByText(/Nothing shared with you yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add a job/i })).not.toBeInTheDocument();
  });
});
