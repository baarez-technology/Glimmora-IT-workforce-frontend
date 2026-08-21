import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequirementStatusForm } from '@/components/demand/status-form';
import { ResourceFormDialog } from '@/components/talent/resource-form-dialog';
import { TalentDirectory } from '@/components/talent/talent-directory';
import { useAuthStore } from '@/lib/auth-store';
import { REQUIREMENT_TRANSITIONS } from '@/lib/demand';
import type { Requirement } from '@/types/demand';
import type { Resource } from '@/types/talent';

/**
 * The talent write surface.
 *
 * Every hook these screens call existed and was tested on the backend; none of
 * them had a control. These tests exist so the controls cannot quietly vanish
 * again — a capability with no button is indistinguishable from one that was
 * never built.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/talent/resources',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'res-1' }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function signIn(permissions: string[], role = 'HR_RESOURCING') {
  useAuthStore.setState({
    user: {
      id: 'user-1',
      email: 'resourcing@glimmora.ai',
      full_name: 'Test Resourcing',
      role,
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

function json(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function mockApi(items: Resource[] = []) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/resources'))
      return json({ items, total: items.length, page: 1, pages: 1, page_size: 25 });
    return json({});
  });
}

const HR_PERMISSIONS = [
  'resource:read',
  'resource:create',
  'resource:update',
  'cv:parse',
  'document:read',
  'document:write',
  'resource.cost:view',
];

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: 'anonymous', expiresAt: null });
});

describe('talent directory actions', () => {
  beforeEach(() => signIn(HR_PERMISSIONS));

  it('offers a way to add a consultant and to upload a CV', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<TalentDirectory />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Add consultant/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Upload a CV/i })).toBeInTheDocument();
  });

  it('does not tell a reader to upload a CV when they cannot', async () => {
    // Sales reads the talent cloud but cannot add to it. Telling them to upload
    // a CV would be an instruction with no affordance.
    signIn(['resource:read']);
    vi.stubGlobal('fetch', mockApi());
    render(<TalentDirectory />, { wrapper });

    await waitFor(() => expect(screen.getByText(/No consultants yet/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Upload a CV/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Ask Resourcing/i)).toBeInTheDocument();
  });
});

describe('consultant form', () => {
  it('shows the cost field to a role that may see cost', async () => {
    signIn(HR_PERMISSIONS);
    vi.stubGlobal('fetch', mockApi());
    render(<ResourceFormDialog open onOpenChange={vi.fn()} />, { wrapper });

    expect(screen.getByLabelText('Expected cost')).toBeInTheDocument();
  });

  it('hides the bill rate from a role that may not see it', async () => {
    // Resourcing negotiates cost, not the client price. Rendering the field
    // would leak it; posting it as null would wipe it.
    signIn(HR_PERMISSIONS);
    vi.stubGlobal('fetch', mockApi());
    render(<ResourceFormDialog open onOpenChange={vi.fn()} />, { wrapper });

    expect(screen.queryByLabelText('Target bill rate')).not.toBeInTheDocument();
    expect(screen.getByText(/sees one side of the rate only/i)).toBeInTheDocument();
  });

  it('requires a name before it will save', async () => {
    signIn(HR_PERMISSIONS);
    vi.stubGlobal('fetch', mockApi());
    render(<ResourceFormDialog open onOpenChange={vi.fn()} />, { wrapper });

    await userEvent.click(screen.getByRole('button', { name: /Add consultant/i }));
    expect(await screen.findByText(/A name is required/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------- requirement status */

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: 'req-1',
    title: 'Senior SAP FICO Consultant',
    status: 'QUALIFIED',
    review_status: 'ACCEPTED',
    ...overrides,
  } as Requirement;
}

describe('requirement status', () => {
  beforeEach(() => signIn(['requirement:read', 'requirement:update']));

  it('offers only the moves the API will accept', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<RequirementStatusForm requirement={makeRequirement()} onDone={vi.fn()} />, {
      wrapper,
    });

    const select = screen.getByLabelText('Move to');
    const offered = Array.from(select.querySelectorAll('option'))
      .map((option) => option.getAttribute('value'))
      .filter(Boolean);

    expect(offered).toEqual(REQUIREMENT_TRANSITIONS.QUALIFIED);
    // NEW is not reachable from QUALIFIED, so it must not be offered.
    expect(offered).not.toContain('NEW');
  });

  it('says a won requirement is terminal rather than offering a dead dropdown', () => {
    vi.stubGlobal('fetch', mockApi());
    render(
      <RequirementStatusForm requirement={makeRequirement({ status: 'CLOSED_WON' })} onDone={vi.fn()} />,
      { wrapper },
    );

    expect(screen.getByText(/terminal state/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Move to')).not.toBeInTheDocument();
  });

  it('will not close a requirement without a reason', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<RequirementStatusForm requirement={makeRequirement()} onDone={vi.fn()} />, {
      wrapper,
    });

    await userEvent.selectOptions(screen.getByLabelText('Move to'), 'CLOSED_LOST');
    expect(screen.getByRole('button', { name: /Change status/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Reason'), 'Client cancelled the programme');
    expect(screen.getByRole('button', { name: /Change status/i })).toBeEnabled();
  });

  it('blocks qualifying a requirement whose parse is still unreviewed', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(
      <RequirementStatusForm
        requirement={makeRequirement({ status: 'ON_HOLD', review_status: 'PENDING_REVIEW' })}
        onDone={vi.fn()}
      />,
      { wrapper },
    );

    await userEvent.selectOptions(screen.getByLabelText('Move to'), 'QUALIFIED');
    expect(screen.getByText(/have not been reviewed yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change status/i })).toBeDisabled();
  });
});
