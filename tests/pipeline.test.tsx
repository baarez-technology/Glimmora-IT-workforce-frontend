import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Interviews } from '@/components/pipeline/interviews';
import { PipelineBoard } from '@/components/pipeline/pipeline-board';
import { DecisionForm } from '@/components/pipeline/opportunity-detail';
import { Submissions } from '@/components/pipeline/submissions';
import { useAuthStore } from '@/lib/auth-store';
import {
  STAGE_ORDER,
  duplicateMessage,
  funnelCounts,
  groupByStage,
  isLive,
  isOverdue,
  isUnowned,
  stageVariant,
} from '@/lib/pipeline';
import type { Interview, Opportunity, StageInfo, Submission } from '@/types/pipeline';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/sales/pipeline',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/* -------------------------------------------------------------------- data */

const STAGES: StageInfo[] = [
  ...STAGE_ORDER.map((value, order) => ({
    value,
    label: value.replace(/_/g, ' '),
    is_terminal: false,
    order,
  })),
  { value: 'LOST' as const, label: 'Lost', is_terminal: true, order: 12 },
  { value: 'DROPPED' as const, label: 'Dropped', is_terminal: true, order: 13 },
];

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    requirement_id: 'req-1',
    requirement_title: 'Senior SAP FICO Consultant',
    account_id: 'acc-1',
    stage: 'CV_SUBMITTED',
    stage_label: 'CV submitted',
    next_stage: 'INTERVIEW',
    is_open: true,
    sales_owner_id: 'user-1',
    resourcing_owner_id: null,
    next_action: 'Chase procurement',
    next_action_due_at: '2099-01-01T09:00:00Z',
    probability_percent: 40,
    expected_monthly_revenue: '22000.00',
    expected_margin_percent: 34,
    contract_value: '528000.00',
    currency: 'QAR',
    restricted_fields: [],
    decision: null,
    decision_reason: null,
    decided_at: null,
    closed_reason: null,
    closed_at: null,
    submission_count: 1,
    created_at: '2026-08-01T09:00:00Z',
    updated_at: '2026-08-01T09:00:00Z',
    ...overrides,
  };
}

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 'sub-1',
    opportunity_id: 'opp-1',
    requirement_id: 'req-1',
    requirement_title: 'Senior SAP FICO Consultant',
    resource_id: 'res-1',
    resource_name: 'Rahul Menon',
    match_id: 'match-1',
    status: 'SUBMITTED',
    submitted_by: 'user-1',
    submitted_at: '2026-08-10T09:00:00Z',
    proposed_bill_rate: '21000.00',
    proposed_bill_currency: 'QAR',
    proposed_bill_unit: 'MONTHLY',
    restricted_fields: [],
    client_feedback: null,
    rejection_reason: null,
    interview_count: 0,
    created_at: '2026-08-10T09:00:00Z',
    ...overrides,
  };
}

function makeInterview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: 'int-1',
    submission_id: 'sub-1',
    resource_name: 'Rahul Menon',
    scheduled_at: '2099-01-05T10:00:00Z',
    duration_minutes: 60,
    mode: 'VIDEO',
    interviewer_name: 'Procurement Lead',
    interviewer_contact_id: null,
    location_or_link: null,
    round_number: 1,
    outcome: 'SCHEDULED',
    feedback: null,
    reminder_sent_at: '2026-08-10T09:00:00Z',
    created_at: '2026-08-10T09:00:00Z',
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockApi(options: {
  opportunities?: Opportunity[];
  submissions?: Submission[];
  interviews?: Interview[];
  duplicate?: Record<string, unknown>;
} = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    if (url.includes('/opportunities/stages')) return json(STAGES);
    if (url.includes('/check-duplicate')) {
      return json(options.duplicate ?? { is_duplicate: false });
    }
    if (url.includes('/opportunities')) return json(options.opportunities ?? []);
    if (url.includes('/submissions')) return json(options.submissions ?? []);
    if (url.includes('/interviews')) return json(options.interviews ?? []);
    if (url.includes('/requirements')) {
      return json({ items: [{ id: 'req-1', title: 'Senior SAP FICO Consultant' }], total: 1 });
    }
    if (url.includes('/resources')) {
      return json({ items: [{ id: 'res-1', full_name: 'Rahul Menon' }], total: 1 });
    }
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

beforeEach(() =>
  signIn([
    'opportunity:read',
    'opportunity:write',
    'submission:read',
    'submission:write',
    'interview:read',
    'interview:write',
    'deployment:write',
    'requirement:read',
    'resource:read',
  ]),
);
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: 'anonymous', expiresAt: null });
});

/* --------------------------------------------------------------- the rules */

describe('pipeline presentation rules', () => {
  it('colours the funnel by how far down it is', () => {
    expect(stageVariant('QUALIFIED')).toBe('warning');
    expect(stageVariant('CV_SUBMITTED')).toBe('info');
    expect(stageVariant('DEPLOYED')).toBe('success');
    expect(stageVariant('LOST')).toBe('destructive');
  });

  it('flags an overdue next action only while the opportunity is open', () => {
    const overdue = makeOpportunity({ next_action_due_at: '2020-01-01T00:00:00Z' });
    expect(isOverdue(overdue)).toBe(true);

    // A closed deal cannot be overdue — chasing it would be noise.
    expect(isOverdue({ ...overdue, is_open: false })).toBe(false);
    expect(isOverdue(makeOpportunity({ next_action_due_at: null }))).toBe(false);
  });

  it('flags open work with nobody assigned', () => {
    expect(isUnowned(makeOpportunity({ sales_owner_id: null }))).toBe(true);
    expect(isUnowned(makeOpportunity())).toBe(false);
    expect(isUnowned(makeOpportunity({ sales_owner_id: null, is_open: false }))).toBe(false);
  });

  it('counts the funnel with closed deals kept separate', () => {
    const counts = funnelCounts([
      makeOpportunity(),
      makeOpportunity({ id: 'b', stage: 'LOST', is_open: false }),
      makeOpportunity({ id: 'c', sales_owner_id: null }),
      makeOpportunity({ id: 'd', next_action_due_at: '2020-01-01T00:00:00Z' }),
    ]);

    expect(counts.open).toBe(3);
    expect(counts.closed).toBe(1);
    expect(counts.unowned).toBe(1);
    expect(counts.overdue).toBe(1);
  });

  it('groups opportunities into their stage columns', () => {
    const columns = groupByStage(
      [makeOpportunity(), makeOpportunity({ id: 'b', stage: 'INTERVIEW' })],
      STAGES,
    );
    const cvSubmitted = columns.find((column) => column.stage.value === 'CV_SUBMITTED');
    const interview = columns.find((column) => column.stage.value === 'INTERVIEW');

    expect(cvSubmitted?.items).toHaveLength(1);
    expect(interview?.items).toHaveLength(1);
  });

  it('knows which submission statuses still hold the seat', () => {
    expect(isLive(makeSubmission({ status: 'SUBMITTED' }))).toBe(true);
    expect(isLive(makeSubmission({ status: 'INTERVIEW' }))).toBe(true);
    // Circumstances change: these free the seat again.
    expect(isLive(makeSubmission({ status: 'REJECTED' }))).toBe(false);
    expect(isLive(makeSubmission({ status: 'WITHDRAWN' }))).toBe(false);
  });

  it('builds a duplicate warning that names who, when and what happened', () => {
    const message = duplicateMessage({
      status: 'SHORTLISTED',
      submitted_by: 'Aisha Rahman',
      submitted_at: '2026-08-10T09:00:00Z',
    });

    expect(message).toContain('shortlisted');
    expect(message).toContain('Aisha Rahman');
    expect(message).toContain('10 Aug 2026');
  });

  it('does not invent a submitter when one is unknown', () => {
    const message = duplicateMessage({
      status: null,
      submitted_by: null,
      submitted_at: null,
    });
    expect(message).toContain('another user');
    expect(message).toContain('not yet submitted');
  });
});

/* --------------------------------------------------------------- the board */

describe('pipeline board', () => {
  it('leads with what has stalled', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        opportunities: [
          makeOpportunity({ next_action_due_at: '2020-01-01T00:00:00Z' }),
          makeOpportunity({ id: 'b', sales_owner_id: null }),
        ],
      }),
    );
    render(<PipelineBoard />, { wrapper });

    await waitFor(() => expect(screen.getByText('Overdue next actions')).toBeInTheDocument());
    expect(screen.getByText('Open, no owner')).toBeInTheDocument();
    expect(screen.getByText(/one missed follow-up at a time/i)).toBeInTheDocument();
  });

  it('renders a column per stage', async () => {
    vi.stubGlobal('fetch', mockApi({ opportunities: [makeOpportunity()] }));
    render(<PipelineBoard />, { wrapper });

    await waitFor(() =>
      expect(screen.getAllByText('Senior SAP FICO Consultant').length).toBeGreaterThan(0),
    );
    expect(screen.getByRole('region', { name: /CV SUBMITTED/i })).toBeInTheDocument();
  });

  it('requires a reason before a stage can be closed', async () => {
    vi.stubGlobal('fetch', mockApi({ opportunities: [makeOpportunity()] }));
    render(<PipelineBoard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Move to Interview/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /Move to Interview/i }));

    await userEvent.selectOptions(screen.getByLabelText('Move to'), 'LOST');
    expect(screen.getByText(/teaches nobody anything/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Move stage$/ })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Reason \(required\)/), 'Client picked incumbent');
    expect(screen.getByRole('button', { name: /^Move stage$/ })).toBeEnabled();
  });

  it('says nothing is in the pipeline rather than showing empty columns', async () => {
    vi.stubGlobal('fetch', mockApi({ opportunities: [] }));
    render(<PipelineBoard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Nothing in the pipeline yet/i)).toBeInTheDocument(),
    );
  });

  it('names commercial figures withheld by the role', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        opportunities: [
          makeOpportunity({
            contract_value: null,
            expected_monthly_revenue: null,
            restricted_fields: ['contract_value'],
          }),
        ],
      }),
    );
    render(<PipelineBoard />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Commercial figures hidden by your role/i)).toBeInTheDocument(),
    );
  });

  it('refuses the screen without the read permission', () => {
    signIn([]);
    vi.stubGlobal('fetch', mockApi());
    render(<PipelineBoard />, { wrapper });

    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});

/* --------------------------------------------------------------- duplicate */

describe('submissions', () => {
  it('warns about a duplicate before the user commits', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        submissions: [makeSubmission()],
        duplicate: {
          is_duplicate: true,
          submission_id: 'sub-1',
          status: 'SUBMITTED',
          submitted_at: '2026-08-10T09:00:00Z',
          submitted_by: 'Aisha Rahman',
        },
      }),
    );
    render(<Submissions />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Senior SAP FICO Consultant/ })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(screen.getByLabelText('Requirement'), 'req-1');
    await userEvent.selectOptions(screen.getByLabelText('Consultant'), 'res-1');

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Already submitted')).toBeInTheDocument();
    expect(screen.getByText(/Aisha Rahman/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit candidate/i })).toBeDisabled();
  });

  it('allows the submission when there is no duplicate', async () => {
    vi.stubGlobal('fetch', mockApi({ submissions: [makeSubmission()] }));
    render(<Submissions />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Senior SAP FICO Consultant/ })).toBeInTheDocument(),
    );
    await userEvent.selectOptions(screen.getByLabelText('Requirement'), 'req-1');
    await userEvent.selectOptions(screen.getByLabelText('Consultant'), 'res-1');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Submit candidate/i })).toBeEnabled(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('requires a reason before rejecting', async () => {
    vi.stubGlobal('fetch', mockApi({ submissions: [makeSubmission()] }));
    render(<Submissions />, { wrapper });

    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^Update$/ }));

    await userEvent.selectOptions(screen.getByLabelText('New status'), 'REJECTED');
    expect(screen.getByText(/most useful feedback the pipeline produces/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Save status$/ })).toBeDisabled();
  });

  it('explains that a closed submission frees the seat', async () => {
    vi.stubGlobal('fetch', mockApi({ submissions: [makeSubmission()] }));
    render(<Submissions />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/can be resubmitted — circumstances change/i)).toBeInTheDocument(),
    );
  });

  it('hides the proposed rate from a role that cannot see it', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        submissions: [
          makeSubmission({
            proposed_bill_rate: null,
            restricted_fields: ['proposed_bill_rate'],
          }),
        ],
      }),
    );
    render(<Submissions />, { wrapper });

    await waitFor(() => expect(screen.getByText('hidden')).toBeInTheDocument());
  });

  it('points at matching when nothing has been submitted', async () => {
    vi.stubGlobal('fetch', mockApi({ submissions: [] }));
    render(<Submissions />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/No CVs have been submitted yet/i)).toBeInTheDocument(),
    );
  });
});

describe('handover to delivery', () => {
  it('offers Deploy only on a selected submission', async () => {
    // The pipeline used to end at SELECTED with no button — a dead end.
    vi.stubGlobal(
      'fetch',
      mockApi({
        submissions: [
          makeSubmission({ id: 'a', status: 'SELECTED' }),
          makeSubmission({ id: 'b', status: 'SUBMITTED', resource_name: 'Not selected yet' }),
        ],
      }),
    );
    render(<Submissions />, { wrapper });

    await waitFor(() => expect(screen.getByText('Not selected yet')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /^Deploy$/ })).toHaveLength(1);
  });

  it('explains that the rates are copied onto the deployment', async () => {
    vi.stubGlobal('fetch', mockApi({ submissions: [makeSubmission({ status: 'SELECTED' })] }));
    render(<Submissions />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Deploy$/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /^Deploy$/ }));

    expect(screen.getByText(/rates are copied onto the deployment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create deployment/i })).toBeEnabled();
  });

  it('rejects an end date before the start', async () => {
    vi.stubGlobal('fetch', mockApi({ submissions: [makeSubmission({ status: 'SELECTED' })] }));
    render(<Submissions />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Deploy$/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /^Deploy$/ }));

    const end = screen.getByLabelText('End date');
    await userEvent.clear(end);
    await userEvent.type(end, '2020-01-01');

    expect(screen.getByText(/cannot be before the start/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create deployment/i })).toBeDisabled();
  });

  it('hides Deploy from a role that cannot write deployments', async () => {
    signIn(['submission:read', 'submission:write']);
    vi.stubGlobal('fetch', mockApi({ submissions: [makeSubmission({ status: 'SELECTED' })] }));
    render(<Submissions />, { wrapper });

    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^Deploy$/ })).not.toBeInTheDocument();
  });
});

describe('opportunity decision', () => {
  it('is presented as separate from the stage', () => {
    vi.stubGlobal('fetch', mockApi());
    render(<DecisionForm opportunity={makeOpportunity()} />, { wrapper });

    expect(screen.getByText(/A decision is not a stage move/i)).toBeInTheDocument();
    expect(screen.getByText(/No decision recorded/i)).toBeInTheDocument();
  });

  it('requires a reason before declining', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<DecisionForm opportunity={makeOpportunity()} />, { wrapper });

    await userEvent.selectOptions(screen.getByLabelText('Decision'), 'DECLINE');
    expect(screen.getByRole('button', { name: /Record decision/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Reason \(required\)/), 'Rate too low');
    expect(screen.getByRole('button', { name: /Record decision/i })).toBeEnabled();
  });

  it('shows an existing decision and its reason', () => {
    vi.stubGlobal('fetch', mockApi());
    render(
      <DecisionForm
        opportunity={makeOpportunity({
          decision: 'DECLINE',
          decision_reason: 'No route into the account',
          decided_at: '2026-08-19T09:00:00Z',
        })}
      />,
      { wrapper },
    );

    expect(screen.getByText(/No route into the account/)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------- interviews */

describe('interviews', () => {
  it('shows a scheduled interview with its round and reminder', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({ interviews: [makeInterview()], submissions: [makeSubmission()] }),
    );
    render(<Interviews />, { wrapper });

    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText(/Reminder raised/i)).toBeInTheDocument();
  });

  it('offers only live submissions to interview', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        interviews: [],
        submissions: [
          makeSubmission({ id: 'live', status: 'SUBMITTED' }),
          makeSubmission({ id: 'dead', status: 'REJECTED', resource_name: 'Rejected Person' }),
        ],
      }),
    );
    render(<Interviews />, { wrapper });

    await waitFor(() =>
      expect(screen.getByLabelText('Candidate').querySelectorAll('option').length).toBeGreaterThan(1),
    );
    const options = screen.getByLabelText('Candidate').querySelectorAll('option');
    const labels = Array.from(options).map((option) => option.textContent ?? '');

    expect(labels.some((label) => label.includes('Rahul Menon'))).toBe(true);
    expect(labels.some((label) => label.includes('Rejected Person'))).toBe(false);
  });

  it('says a failed round does not close the submission', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({ interviews: [makeInterview()], submissions: [makeSubmission()] }),
    );
    render(<Interviews />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Record outcome/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /Record outcome/i }));
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'FAILED');

    expect(screen.getByText(/does not close the submission/i)).toBeInTheDocument();
  });

  it('says nothing is scheduled rather than showing an empty list', async () => {
    vi.stubGlobal('fetch', mockApi({ interviews: [], submissions: [] }));
    render(<Interviews />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/No interviews scheduled in the next 30 days/i)).toBeInTheDocument(),
    );
  });

  it('hides scheduling from a read-only role', async () => {
    signIn(['interview:read', 'submission:read']);
    vi.stubGlobal('fetch', mockApi({ interviews: [makeInterview()] }));
    render(<Interviews />, { wrapper });

    await waitFor(() => expect(screen.getByText('Rahul Menon')).toBeInTheDocument());
    expect(screen.queryByLabelText('Candidate')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record outcome/i })).not.toBeInTheDocument();
  });
});
