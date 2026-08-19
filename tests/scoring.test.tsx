import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommercialCalculator } from '@/components/scoring/commercial-calculator';
import { OpportunityBoard } from '@/components/scoring/opportunity-board';
import { ScoreExplanation, ScoreHeadline } from '@/components/scoring/score-explanation';
import { useAuthStore } from '@/lib/auth-store';
import {
  closeableGaps,
  confidenceNote,
  earnedPoints,
  isReproducible,
  recomputeScore,
  supplyGateNote,
} from '@/lib/scoring';
import type { OpportunityScoreResult, ScoreFactor } from '@/types/scoring';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/intelligence/scoring',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/* -------------------------------------------------------------------- data */

const FACTORS: ScoreFactor[] = [
  {
    key: 'outsourcing_friendly',
    label: 'Contract / outsourcing friendly',
    state: 'MET',
    points: 10,
    max_points: 10,
    evidence: 'Account contracts are outsourcing friendly',
  },
  {
    key: 'existing_customer',
    label: 'Existing Glimmora customer',
    state: 'MET',
    points: 20,
    max_points: 20,
    evidence: 'Existing Glimmora customer',
  },
  {
    key: 'partner_route',
    label: 'Partner / prime route available',
    state: 'NOT_APPLICABLE',
    points: 0,
    max_points: 15,
    evidence: 'Direct relationship — no partner route required',
  },
  {
    key: 'approved_vendor',
    label: 'Approved vendor (MSA / vendor registration)',
    state: 'NOT_MET',
    points: 0,
    max_points: 20,
    evidence: 'Not an approved vendor and no MSA — procurement will block a submission',
  },
  {
    key: 'decision_maker',
    label: 'Decision maker known',
    state: 'UNKNOWN',
    points: 0,
    max_points: 10,
    evidence: 'No contacts recorded for this account',
  },
];

function makeResult(overrides: Partial<OpportunityScoreResult> = {}): OpportunityScoreResult {
  return {
    id: 'score-1',
    requirement_id: 'req-1',
    requirement_title: 'Senior SAP FICO Consultant',
    score: 91,
    band: 'PURSUE_NOW',
    confidence: 1,
    talent_match_score: 94,
    addressability_score: 88,
    addressability_band: 'HIGHLY_ADDRESSABLE',
    supply_gate: 1,
    commercial_score: 91,
    components: [
      { key: 'talent_match', label: 'Talent match', score: 94, weight: 0.4, contribution: 37.6 },
      {
        key: 'addressability',
        label: 'Addressability',
        score: 88,
        weight: 0.35,
        contribution: 30.8,
      },
      { key: 'commercial', label: 'Commercial', score: 91, weight: 0.25, contribution: 22.75 },
    ],
    factors: FACTORS,
    commercial_breakdown: [
      { key: 'margin', label: 'Margin', points: 52, max_points: 60, evidence: '34.7% gross margin' },
    ],
    commercial: {
      monthly_revenue: '22000.00',
      monthly_cost: '14375.00',
      gross_profit: '7625.00',
      margin_percent: 34.66,
      contract_value: '528000.00',
      total_profit: '183000.00',
      duration_months: 24,
      positions: 1,
      currency: 'QAR',
      is_converted: false,
      one_off_total: '9000.00',
      one_off_monthly: '375.00',
      missing_information: [],
    },
    positives: ['Existing Glimmora customer', 'Healthy 35% margin'],
    risks: ['Not an approved vendor and no MSA — procurement will block a submission'],
    missing_information: ['Decision maker known'],
    suppressors: [],
    recommended_action: 'Submit CVs today; assign an owner',
    narrative: 'Scores 91 — a strong opportunity.',
    restricted_fields: [],
    addressability_config_version: 1,
    commercial_config_version: 1,
    opportunity_config_version: 1,
    engine_version: '1.0.0',
    computed_at: '2026-08-19T09:00:00Z',
    ...overrides,
  };
}

const REQUIREMENTS = { items: [], total: 0, page: 1, page_size: 100, pages: 1 };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockApi(board: OpportunityScoreResult[] = [makeResult()]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.includes('/scoring/opportunities')) return json(board);
    if (url.includes('/scoring/commercial/preview')) return json(makeResult().commercial);
    if (url.includes('/requirements')) return json(REQUIREMENTS);
    return json({});
  });
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'u1',
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

beforeEach(() => signIn(['scoring:read', 'scoring:run', 'commercial:run', 'requirement:read']));
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: 'anonymous', expiresAt: null });
});

/* --------------------------------------------------------------- the rules */

describe('factor accounting', () => {
  it('does not count a NOT_APPLICABLE factor as points anyone could have earned', () => {
    // 10 + 20 + 20 + 10 = 60 available; the 15-point route is not on offer.
    const { earned, available } = earnedPoints(FACTORS);
    expect(earned).toBe(30);
    expect(available).toBe(60);
  });

  it('treats only NOT_MET and UNKNOWN as closeable gaps', () => {
    const gaps = closeableGaps(FACTORS).map((factor) => factor.key);
    expect(gaps).toEqual(['approved_vendor', 'decision_maker']);
    expect(gaps).not.toContain('partner_route');
  });
});

describe('score arithmetic', () => {
  it('recomputes the headline from the components', () => {
    expect(recomputeScore(makeResult())).toBeCloseTo(91.15, 1);
    expect(isReproducible(makeResult())).toBe(true);
  });

  it('flags a breakdown that does not reproduce the stored score', () => {
    expect(isReproducible(makeResult({ score: 40 }))).toBe(false);
  });

  it('grades confidence so a thin score cannot pass for a solid one', () => {
    expect(confidenceNote(1).tone).toBe('success');
    expect(confidenceNote(0.7).tone).toBe('warning');
    expect(confidenceNote(0.4).tone).toBe('destructive');
  });

  it('says nothing about the supply gate when it did nothing', () => {
    expect(supplyGateNote(1)).toBeNull();
    expect(supplyGateNote(null)).toBeNull();
    expect(supplyGateNote(0.35)).toMatch(/nobody to send/i);
  });
});

/* -------------------------------------------------------------- rendering */

describe('score explanation', () => {
  it('renders all four factor states distinctly', () => {
    render(<ScoreExplanation result={makeResult()} />);

    expect(screen.getAllByText('Met').length).toBe(2);
    expect(screen.getByText('Not met')).toBeInTheDocument();
    expect(screen.getByText('Not required')).toBeInTheDocument();
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });

  it('presents a correct zero as "not required", never as a deficiency', () => {
    render(<ScoreExplanation result={makeResult()} />);

    expect(screen.getByText('Direct relationship — no partner route required')).toBeInTheDocument();
    // The route must not appear in the closeable-gaps list.
    const missing = screen.getByText('Fill these in to sharpen the score').closest('div');
    expect(missing?.textContent).not.toContain('Partner / prime route');
  });

  it('shows every component with its weight and contribution', () => {
    render(<ScoreExplanation result={makeResult()} />);

    expect(screen.getByText('Talent match')).toBeInTheDocument();
    expect(screen.getByText('+37.60')).toBeInTheDocument();
    expect(screen.getByText('+30.80')).toBeInTheDocument();
    expect(screen.getByText('+22.75')).toBeInTheDocument();
  });

  it('explains redistribution when a component could not be assessed', () => {
    const result = makeResult({
      confidence: 0.75,
      commercial_score: null,
      components: [
        { key: 'talent_match', label: 'Talent match', score: 94, weight: 0.4, contribution: 52.5 },
        {
          key: 'addressability',
          label: 'Addressability',
          score: 88,
          weight: 0.35,
          contribution: 38.5,
        },
        { key: 'commercial', label: 'Commercial', score: null, weight: 0.25, contribution: 0 },
      ],
    });
    render(<ScoreExplanation result={result} />);

    expect(screen.getByText('Not assessed')).toBeInTheDocument();
    expect(screen.getByText(/redistributed/i)).toBeInTheDocument();
    expect(screen.getByText(/not counted as zero/i)).toBeInTheDocument();
  });

  it('shows the recommended action prominently', () => {
    render(<ScoreExplanation result={makeResult()} />);
    expect(screen.getByText('Recommended next action')).toBeInTheDocument();
    expect(screen.getByText('Submit CVs today; assign an owner')).toBeInTheDocument();
  });

  it('surfaces a band cap as a distinct blocker', () => {
    render(
      <ScoreExplanation
        result={makeResult({ suppressors: ['Negative margin at current rates'], band: 'REVIEW' })}
      />,
    );
    expect(screen.getByText('Band capped')).toBeInTheDocument();
    expect(screen.getByText('Negative margin at current rates')).toBeInTheDocument();
  });

  it('explains what the supply gate did when it bit', () => {
    render(<ScoreExplanation result={makeResult({ supply_gate: 0.35 })} />);
    expect(screen.getByText(/reachability with nobody to send/i)).toBeInTheDocument();
  });

  it('names commercial figures withheld by role rather than hiding the section', () => {
    render(
      <ScoreExplanation
        result={makeResult({ commercial: null, restricted_fields: ['gross_profit', 'margin_percent'] })}
      />,
    );
    expect(screen.getByText(/hidden by your role/i)).toBeInTheDocument();
  });

  it('records which rule versions produced the score', () => {
    render(<ScoreExplanation result={makeResult()} />);
    expect(screen.getByText(/addressability rules v1/i)).toBeInTheDocument();
  });
});

describe('score headline', () => {
  it('never shows the number without its band and confidence', () => {
    render(<ScoreHeadline result={makeResult()} />);

    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText('Pursue now')).toBeInTheDocument();
    expect(screen.getByText(/100% of inputs known/)).toBeInTheDocument();
  });

  it('marks a low-confidence score so it cannot read as a firm one', () => {
    render(<ScoreHeadline result={makeResult({ confidence: 0.4 })} />);
    expect(screen.getByText(/only 40% of inputs known/)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ board */

describe('opportunity board', () => {
  it('lists scored requirements with their three components', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<OpportunityBoard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText('Senior SAP FICO Consultant')).toBeInTheDocument(),
    );
    expect(screen.getByText('Talent 94')).toBeInTheDocument();
    expect(screen.getByText('Addressability 88')).toBeInTheDocument();
    expect(screen.getByText('Commercial 91')).toBeInTheDocument();
  });

  it('expands into the full explanation on demand', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<OpportunityBoard />, { wrapper });

    await waitFor(() => expect(screen.getByRole('button', { name: /explain/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /explain/i }));

    expect(screen.getByText('Can we reach this client?')).toBeInTheDocument();
  });

  it('says a score is advice, not a decision', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<OpportunityBoard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/advice, not a decision/i)).toBeInTheDocument(),
    );
  });

  it('says nothing has been scored rather than showing an empty table', async () => {
    vi.stubGlobal('fetch', mockApi([]));
    render(<OpportunityBoard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Nothing has been scored yet/i)).toBeInTheDocument(),
    );
  });

  it('refuses the screen without the read permission', () => {
    signIn([]);
    vi.stubGlobal('fetch', mockApi());
    render(<OpportunityBoard />, { wrapper });

    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });

  it('hides recompute from a role that cannot run scoring', async () => {
    signIn(['scoring:read', 'requirement:read']);
    vi.stubGlobal('fetch', mockApi());
    render(<OpportunityBoard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText('Senior SAP FICO Consultant')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /recompute/i })).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------- calculator */

describe('commercial calculator', () => {
  it('shows margin and profit from the entered rates', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<CommercialCalculator />, { wrapper });

    await waitFor(() => expect(screen.getByText('Gross margin')).toBeInTheDocument());
    expect(screen.getByText('34.7%')).toBeInTheDocument();
  });

  it('states plainly that nothing is saved', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<CommercialCalculator />, { wrapper });

    expect(screen.getByText(/Nothing here is saved/i)).toBeInTheDocument();
  });

  it('explains that one-off costs are spread across the engagement', () => {
    vi.stubGlobal('fetch', mockApi());
    render(<CommercialCalculator />, { wrapper });

    expect(screen.getByText(/not of\s+month one/i)).toBeInTheDocument();
  });

  it('refuses the screen without the commercial permission', () => {
    signIn(['scoring:read']);
    vi.stubGlobal('fetch', mockApi());
    render(<CommercialCalculator />, { wrapper });

    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});
