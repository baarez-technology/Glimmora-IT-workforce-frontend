import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MatchExplanation, MatchScore } from '@/components/matching/match-explanation';
import { MatchingWorkbench } from '@/components/matching/matching-workbench';
import { useAuthStore } from '@/lib/auth-store';
import {
  BAND_LABELS,
  confidenceLabel,
  countByBand,
  hasBlocker,
  isReproducible,
  knownComponents,
  rankMatches,
  recomputeScore,
  scoreTone,
  unknownComponents,
} from '@/lib/matching';
import type { Match, MatchRun } from '@/types/matching';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/intelligence/matching',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/* -------------------------------------------------------------------- data */

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    requirement_id: 'req-1',
    resource_id: 'res-1',
    resource_name: 'Rahul Menon',
    resource_headline: 'Senior SAP FICO Consultant',
    resource_type: 'CONSULTANT',
    availability_status: 'AVAILABLE',
    overall_score: 90.8,
    band: 'STRONG',
    confidence: 1,
    components: [
      {
        key: 'skills',
        label: 'Skills',
        score: 95,
        weight: 30,
        contribution: 28.5,
        evidence: '2/2 mandatory, 1/1 preferred',
        detail: { mandatory_matched: 2, mandatory_total: 2 },
      },
      {
        key: 'experience',
        label: 'Experience',
        score: 100,
        weight: 20,
        contribution: 20,
        evidence: '9 years against 6 required',
        detail: {},
      },
      {
        key: 'technology',
        label: 'Technology',
        score: 100,
        weight: 15,
        contribution: 15,
        evidence: '1/1 matched (primary)',
        detail: {},
      },
      {
        key: 'availability',
        label: 'Availability',
        score: 100,
        weight: 10,
        contribution: 10,
        evidence: 'Available on or before the start date',
        detail: {},
      },
      {
        key: 'location',
        label: 'Location',
        score: 100,
        weight: 10,
        contribution: 10,
        evidence: 'Already in the city',
        detail: {},
      },
      {
        key: 'cost',
        label: 'Cost fit',
        score: 50,
        weight: 10,
        contribution: 5,
        evidence: '32% margin at the client rate',
        detail: { margin: 0.32 },
      },
      {
        key: 'commercial',
        label: 'Commercial fit',
        score: 45,
        weight: 5,
        contribution: 2.25,
        evidence: null,
        detail: { margin: 0.32 },
      },
    ],
    gaps: [],
    reasons: ['Skills: 2/2 mandatory', 'Available now'],
    warnings: [],
    missing_information: [],
    restricted_components: [],
    narrative: 'Rahul Menon is a strong match at 90.8%.',
    weights_version: 1,
    engine_version: '1.0.0',
    computed_at: '2026-08-18T09:00:00Z',
    ...overrides,
  };
}

const RUN: MatchRun = {
  requirement_id: 'req-1',
  requirement_title: 'Senior SAP FICO Consultant',
  computed_at: '2026-08-18T09:00:00Z',
  weights_version: 1,
  total: 1,
  matches: [makeMatch()],
};

const REQUIREMENTS = {
  items: [{ id: 'req-1', title: 'Senior SAP FICO Consultant' }],
  total: 1,
  page: 1,
  page_size: 100,
  pages: 1,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockApi(run: MatchRun = RUN) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    if (url.includes('/requirements?') || url.endsWith('/requirements')) return json(REQUIREMENTS);
    if (url.includes('/matching/requirements/')) return json(run);
    return json({});
  });
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'user-1',
      email: 'sales@glimmora.ai',
      full_name: 'Test Sales',
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

beforeEach(() => {
  signIn(['matching:read', 'matching:run', 'requirement:read']);
});

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: 'anonymous', expiresAt: null });
});

/* ---------------------------------------------------------------- the rules */

describe('match presentation rules', () => {
  it('recomputes the headline from the components', () => {
    const match = makeMatch();
    expect(recomputeScore(match)).toBeCloseTo(match.overall_score, 1);
    expect(isReproducible(match)).toBe(true);
  });

  it('flags a breakdown that does not add up to the stored score', () => {
    expect(isReproducible(makeMatch({ overall_score: 40 }))).toBe(false);
  });

  it('does not call a restricted breakdown an arithmetic error', () => {
    // Hidden components are a permission boundary, not a broken score.
    const restricted = makeMatch({
      components: makeMatch().components.filter((c) => !['cost', 'commercial'].includes(c.key)),
      restricted_components: ['Cost fit', 'Commercial fit'],
    });
    expect(isReproducible(restricted)).toBe(false);
  });

  it('separates assessed components from unknown ones', () => {
    const match = makeMatch({
      components: [
        ...makeMatch().components.slice(0, 5),
        {
          key: 'cost',
          label: 'Cost fit',
          score: null,
          weight: 10,
          contribution: 0,
          evidence: 'Cost or client rate not recorded',
          detail: {},
        },
      ],
    });

    expect(knownComponents(match)).toHaveLength(5);
    expect(unknownComponents(match).map((c) => c.label)).toEqual(['Cost fit']);
  });

  it('orders assessed components by what they actually contributed', () => {
    const ordered = knownComponents(makeMatch()).map((c) => c.key);
    expect(ordered[0]).toBe('skills');
    expect(ordered.at(-1)).toBe('commercial');
  });

  it('grades confidence so a thin score cannot pass for a solid one', () => {
    expect(confidenceLabel(1).tone).toBe('success');
    expect(confidenceLabel(0.7).tone).toBe('warning');
    expect(confidenceLabel(0.3).tone).toBe('destructive');
  });

  it('never paints an unknown component as a score', () => {
    expect(scoreTone(null)).not.toContain('success');
    expect(scoreTone(90)).toContain('success');
  });

  it('treats a missing mandatory skill as a blocker', () => {
    expect(hasBlocker(makeMatch())).toBe(false);
    expect(hasBlocker(makeMatch({ gaps: ['SAP FICO'] }))).toBe(true);
    expect(
      hasBlocker(makeMatch({ warnings: ['Work authorisation has expired — cannot be deployed'] })),
    ).toBe(true);
  });

  it('ranks by score and counts by band', () => {
    const matches = [
      makeMatch({ id: 'a', overall_score: 61, band: 'POSSIBLE' }),
      makeMatch({ id: 'b', overall_score: 88, band: 'STRONG' }),
    ];
    expect(rankMatches(matches).map((m) => m.id)).toEqual(['b', 'a']);
    expect(countByBand(matches)).toMatchObject({ STRONG: 1, POSSIBLE: 1, GOOD: 0, WEAK: 0 });
  });
});

/* --------------------------------------------------------------- rendering */

describe('match explanation', () => {
  it('shows every component with its weight and evidence', () => {
    render(<MatchExplanation match={makeMatch()} />);

    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('2/2 mandatory, 1/1 preferred')).toBeInTheDocument();
    expect(screen.getByText('9 years against 6 required')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar').length).toBe(7);
  });

  it('says which components could not be assessed instead of scoring them zero', () => {
    const match = makeMatch({
      components: makeMatch().components.map((component) =>
        component.key === 'cost' ? { ...component, score: null, contribution: 0 } : component,
      ),
      confidence: 0.9,
      missing_information: ['Cost fit'],
    });

    render(<MatchExplanation match={match} />);

    expect(screen.getByText(/1 component could not be assessed/i)).toBeInTheDocument();
    expect(screen.getByText(/rather than counted as zero/i)).toBeInTheDocument();
  });

  it('names components hidden by the role rather than quietly dropping them', () => {
    const match = makeMatch({
      components: makeMatch().components.filter((c) => !['cost', 'commercial'].includes(c.key)),
      restricted_components: ['Cost fit', 'Commercial fit'],
    });

    render(<MatchExplanation match={match} />);

    expect(screen.getByText(/hidden by your role/i)).toBeInTheDocument();
  });

  it('surfaces missing mandatory skills as a distinct blocker', () => {
    render(<MatchExplanation match={makeMatch({ gaps: ['SAP FICO', 'SAP MM'] })} />);

    expect(screen.getByText('Missing mandatory skills')).toBeInTheDocument();
    expect(screen.getByText('SAP FICO')).toBeInTheDocument();
    expect(screen.getByText('SAP MM')).toBeInTheDocument();
  });

  it('shows warnings a recruiter must clear before submitting', () => {
    render(
      <MatchExplanation
        match={makeMatch({ warnings: ['Work authorisation has expired — cannot be deployed'] })}
      />,
    );

    expect(screen.getByText('Before submitting')).toBeInTheDocument();
    expect(
      screen.getByText('Work authorisation has expired — cannot be deployed'),
    ).toBeInTheDocument();
  });

  it('warns when the breakdown cannot reproduce the stored total', () => {
    render(<MatchExplanation match={makeMatch({ overall_score: 40 })} />);
    expect(screen.getByText(/does not reproduce the stored total/i)).toBeInTheDocument();
  });
});

describe('match score', () => {
  it('never renders a percentage without its band and evidence level', () => {
    render(<MatchScore match={makeMatch()} />);

    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText(BAND_LABELS.STRONG)).toBeInTheDocument();
    expect(screen.getByText(/Evidence 100% complete/)).toBeInTheDocument();
  });

  it('marks a thin-evidence score so it cannot be read as a confident one', () => {
    render(<MatchScore match={makeMatch({ confidence: 0.4 })} />);
    expect(screen.getByText(/Evidence 40% complete/)).toBeInTheDocument();
  });
});

/* --------------------------------------------------------------- workbench */

describe('matching workbench', () => {
  it('shows the ranked list with an expandable explanation', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<MatchingWorkbench />, { wrapper });

    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());
    expect(screen.getByText('91')).toBeInTheDocument();

    // Collapsed rows still carry the band — no bare percentages anywhere.
    expect(screen.getAllByText(BAND_LABELS.STRONG).length).toBeGreaterThan(0);
  });

  it('collapses the explanation on demand', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<MatchingWorkbench />, { wrapper });

    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());
    const toggle = screen.getByRole('button', { name: /hide/i });
    await userEvent.click(toggle);

    expect(screen.getByRole('button', { name: /explain/i })).toBeInTheDocument();
  });

  it('says matching has never run rather than showing an empty result', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({ ...RUN, computed_at: null, weights_version: null, total: 0, matches: [] }),
    );
    render(<MatchingWorkbench />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/has not been run for this requirement/i)).toBeInTheDocument(),
    );
    expect(screen.getAllByRole('button', { name: /^run matching$/i }).length).toBeGreaterThan(0);
  });

  it('distinguishes "ran and found nobody" from "never ran"', async () => {
    vi.stubGlobal('fetch', mockApi({ ...RUN, total: 0, matches: [] }));
    render(<MatchingWorkbench />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/No resource in the talent cloud fits/i)).toBeInTheDocument(),
    );
  });

  it('tells a read-only role it cannot start a run, and hides the button', async () => {
    signIn(['matching:read', 'requirement:read']);
    vi.stubGlobal(
      'fetch',
      mockApi({ ...RUN, computed_at: null, weights_version: null, total: 0, matches: [] }),
    );
    render(<MatchingWorkbench />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/your role cannot start a run/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /run matching/i })).not.toBeInTheDocument();
  });

  it('refuses the screen outright without the read permission', () => {
    signIn([]);
    vi.stubGlobal('fetch', mockApi());
    render(<MatchingWorkbench />, { wrapper });

    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });

  it('says the ranking is advice, not a decision', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<MatchingWorkbench />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/ranked suggestions, not a decision/i)).toBeInTheDocument(),
    );
  });

  it('records which rule version produced the snapshot', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<MatchingWorkbench />, { wrapper });

    await waitFor(() => expect(screen.getAllByText(/on rule set v1/).length).toBeGreaterThan(0));
  });
});
