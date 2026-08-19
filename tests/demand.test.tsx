import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EvidenceText } from '@/components/demand/evidence-text';
import { ParseReview } from '@/components/demand/parse-review';
import {
  DEADLINE_LABELS,
  DEADLINE_VARIANT,
  PRIORITY_SOURCE_LABELS,
  formatParsedValue,
  formatRateRange,
} from '@/lib/demand';
import type { ParseResult } from '@/types/demand';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/demand/requirements/req-1',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'req-1' }),
}));

const SOURCE_TEXT = `Job Title: Senior SAP FICO Consultant
Location: Doha, Qatar
Rate: QAR 18,000 - 22,000 per month`;

const PARSE_RESULT: ParseResult = {
  requirement_id: 'req-1',
  source_text: SOURCE_TEXT,
  provider: 'null',
  model_id: 'deterministic-jd-parser-v1',
  used_fallback: false,
  overall_confidence: 0.86,
  fields: [
    {
      field: 'title',
      label: 'Title',
      value: 'Senior SAP FICO Consultant',
      confidence: 0.92,
      level: 'HIGH',
      requires_confirmation: false,
      evidence: 'Senior SAP FICO Consultant',
      evidence_start: 11,
      evidence_end: 37,
    },
    {
      field: 'rate_min',
      label: 'Rate from',
      value: '18000',
      confidence: 0.8,
      level: 'MEDIUM',
      requires_confirmation: true,
      evidence: 'QAR 18,000 - 22,000 per month',
      evidence_start: 70,
      evidence_end: 99,
    },
    {
      field: 'response_deadline_at',
      label: 'Submission deadline',
      value: '2026-08-20T09:00:00Z',
      confidence: 0.8,
      level: 'MEDIUM',
      requires_confirmation: true,
      evidence: null,
      evidence_start: null,
      evidence_end: null,
    },
    {
      field: 'duration_months',
      label: 'Duration (months)',
      value: null,
      confidence: 0,
      level: 'LOW',
      requires_confirmation: false,
      evidence: null,
      evidence_start: null,
      evidence_end: null,
    },
  ],
  unresolved_skills: [],
  warnings: [],
  confirmation_required: ['rate_min', 'response_deadline_at'],
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockApi(result: ParseResult = PARSE_RESULT, acceptStatus = 200) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/parse-result')) {
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/accept-parse')) {
      if (acceptStatus !== 200) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Confirm the highlighted fields before accepting.',
              details: [{ field: 'rate_min', message: 'Rate from needs confirming' }],
            },
          }),
          { status: acceptStatus, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ id: 'req-1', review_status: 'ACCEPTED' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/reject-parse')) {
      return new Response(JSON.stringify({ id: 'req-1', review_status: 'REJECTED' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe('evidence highlighting', () => {
  it('marks the span a value came from', () => {
    render(<EvidenceText text={SOURCE_TEXT} start={11} end={37} />);

    const mark = screen.getByText('Senior SAP FICO Consultant');
    expect(mark.tagName).toBe('MARK');
  });

  it('renders the plain source when there is no span to highlight', () => {
    const { container } = render(<EvidenceText text={SOURCE_TEXT} start={null} end={null} />);

    expect(container.querySelector('mark')).toBeNull();
    expect(screen.getByText(/Senior SAP FICO Consultant/)).toBeInTheDocument();
  });

  it('ignores an out-of-range span rather than crashing', () => {
    const { container } = render(<EvidenceText text="short" start={100} end={200} />);
    expect(container.querySelector('mark')).toBeNull();
  });
});

describe('parse review', () => {
  it('shows which fields still need confirming', async () => {
    vi.stubGlobal('fetch', mockApi());

    render(<ParseReview requirementId="req-1" />, { wrapper });

    expect(await screen.findByText('Review the extracted fields')).toBeInTheDocument();
    // The counter is split across elements, so match on the containing node.
    const counter = screen.getByText(/fields still need confirming/i);
    expect(counter.textContent).toMatch(/2\s*of\s*2/);
  });

  it('blocks accepting until money and dates are confirmed', async () => {
    vi.stubGlobal('fetch', mockApi());

    render(<ParseReview requirementId="req-1" />, { wrapper });
    const accept = await screen.findByRole('button', { name: /accept requirement/i });

    expect(accept).toBeDisabled();
    expect(screen.getByText(/Confirm the 2 highlighted fields/i)).toBeInTheDocument();
  });

  it('enables accepting once every flagged field is confirmed', async () => {
    vi.stubGlobal('fetch', mockApi());

    render(<ParseReview requirementId="req-1" />, { wrapper });
    await screen.findByText('Review the extracted fields');

    await userEvent.click(screen.getByRole('button', { name: /confirm all as shown/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /accept requirement/i })).toBeEnabled(),
    );
  });

  it('states plainly that nothing is business data until accepted', async () => {
    vi.stubGlobal('fetch', mockApi());

    render(<ParseReview requirementId="req-1" />, { wrapper });
    expect(
      await screen.findByText(/Nothing here counts as business data until you accept it/i),
    ).toBeInTheDocument();
  });

  it('lists fields the parser did not find, rather than guessing them', async () => {
    vi.stubGlobal('fetch', mockApi());

    render(<ParseReview requirementId="req-1" />, { wrapper });

    expect(await screen.findByText('The parser did not find these')).toBeInTheDocument();
    expect(screen.getByText(/Left blank rather than guessed/i)).toBeInTheDocument();
    expect(screen.getByText('Duration (months)')).toBeInTheDocument();
  });

  it('warns when the rule-based parser was used as a fallback', async () => {
    vi.stubGlobal('fetch', mockApi({ ...PARSE_RESULT, used_fallback: true }));

    render(<ParseReview requirementId="req-1" />, { wrapper });
    expect(
      await screen.findByText(/AI extraction was unavailable/i),
    ).toBeInTheDocument();
  });

  it('names skills that are not on the master yet', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({ ...PARSE_RESULT, unresolved_skills: ['Quantum Widgetry'] }),
    );

    render(<ParseReview requirementId="req-1" />, { wrapper });
    expect(await screen.findByText(/Quantum Widgetry/)).toBeInTheDocument();
  });

  it('surfaces a server rejection instead of failing silently', async () => {
    vi.stubGlobal('fetch', mockApi(PARSE_RESULT, 422));

    render(<ParseReview requirementId="req-1" />, { wrapper });
    await screen.findByText('Review the extracted fields');
    await userEvent.click(screen.getByRole('button', { name: /confirm all as shown/i }));
    await userEvent.click(await screen.findByRole('button', { name: /accept requirement/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Confirm the highlighted fields before accepting.',
    );
  });
});

describe('demand formatting', () => {
  it('formats a rate range as one readable phrase', () => {
    expect(formatRateRange('18000', '22000', 'QAR', 'MONTHLY')).toBe(
      'QAR 18,000 – 22,000 per month',
    );
    expect(formatRateRange('65', null, 'USD', 'HOURLY')).toBe('USD 65 per hour');
    expect(formatRateRange(null, null, null, null)).toBe('—');
  });

  it('formats extracted values without inventing content', () => {
    expect(formatParsedValue(null)).toBe('—');
    expect(formatParsedValue([])).toBe('—');
    expect(formatParsedValue(['Java', 'AWS'])).toBe('Java, AWS');
    expect(formatParsedValue(18)).toBe('18');
  });

  it('gives urgent and expired deadlines an alarming colour', () => {
    expect(DEADLINE_VARIANT.URGENT).toBe('destructive');
    expect(DEADLINE_VARIANT.EXPIRED).toBe('destructive');
    expect(DEADLINE_VARIANT.SAFE).toBe('success');
    expect(DEADLINE_LABELS.DUE_SOON).toBe('Due soon');
  });

  it('labels demand sources in SOW pursuit-priority order', () => {
    expect(PRIORITY_SOURCE_LABELS.P1_EXISTING_CUSTOMER).toContain('P1');
    expect(PRIORITY_SOURCE_LABELS.P5_VENDOR_MSP_VMS).toContain('VMS');
  });
});
