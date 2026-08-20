import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataTransfer } from '@/components/platform/data-transfer';
import { Notifications } from '@/components/platform/notifications';
import { useAuthStore } from '@/lib/auth-store';
import {
  ROW_STATE_PRESENTATION,
  SEVERITY_VARIANT,
  commitSummary,
  isBlocked,
  rankNotifications,
  rankRows,
  rowsNeedingAttention,
  willImport,
} from '@/lib/platform';
import type {
  ImportBatch,
  ImportPreview,
  ImportRow,
  Notification,
  UnreadCount,
} from '@/types/platform';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/notifications',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/* -------------------------------------------------------------------- data */

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    category: 'SUBMISSION_SLA',
    severity: 'WARNING',
    title: 'QA Automation Engineer — 24h to submit',
    body: 'The submission window closes 20 Aug 2026 at 09:00 UTC.',
    entity_type: 'requirement',
    entity_id: 'req-1',
    action_url: '/demand/requirements/req-1',
    payload: null,
    is_read: false,
    read_at: null,
    created_at: '2026-08-19T09:00:00Z',
    ...overrides,
  };
}

function makeRow(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    row_number: 2,
    validation_state: 'VALID',
    raw: { name: 'Milaha', country: 'QA' },
    normalized: { name: 'Milaha', country: 'QA' },
    errors: [],
    warnings: [],
    created_entity_id: null,
    ...overrides,
  };
}

function makeBatch(overrides: Partial<ImportBatch> = {}): ImportBatch {
  return {
    id: 'batch-1',
    entity_type: 'customers',
    filename: 'clients.xlsx',
    status: 'STAGED',
    total_rows: 4,
    valid_rows: 2,
    invalid_rows: 1,
    duplicate_rows: 1,
    warning_rows: 0,
    committed_rows: 0,
    file_errors: [],
    is_committable: true,
    created_at: '2026-08-19T09:00:00Z',
    committed_at: null,
    ...overrides,
  };
}

const UNREAD: UnreadCount = {
  total: 3,
  critical: 1,
  by_category: { SUBMISSION_SLA: 2, DOCUMENT_EXPIRY: 1 },
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockApi(
  options: {
    notifications?: Notification[];
    unread?: UnreadCount;
    batches?: ImportBatch[];
    preview?: ImportPreview;
  } = {},
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    if (url.includes('/notifications/unread-count')) return json(options.unread ?? UNREAD);
    if (url.includes('/notifications')) return json(options.notifications ?? []);
    if (url.includes('/imports/entities')) {
      return json([
        { entity: 'customers', columns: [{ key: 'name', label: 'Name', required: true }] },
        { entity: 'resources', columns: [{ key: 'full_name', label: 'Full name' }] },
      ]);
    }
    if (url.includes('/imports')) return json(options.batches ?? []);
    return json({});
  });
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'admin@glimmora.ai',
      full_name: 'Test Admin',
      role: 'ADMIN',
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

beforeEach(() => signIn(['notification:read', 'import:run', 'export:run']));
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: 'anonymous', expiresAt: null });
});

/* --------------------------------------------------------------- the rules */

describe('notification presentation rules', () => {
  it('escalates severity colouring', () => {
    expect(SEVERITY_VARIANT.CRITICAL).toBe('destructive');
    expect(SEVERITY_VARIANT.WARNING).toBe('warning');
    expect(SEVERITY_VARIANT.INFO).toBe('info');
  });

  it('ranks by urgency first, then recency', () => {
    // A chronological list buries a critical expiry under a week of INFO.
    const ordered = rankNotifications([
      makeNotification({ id: 'a', severity: 'INFO', created_at: '2026-08-19T10:00:00Z' }),
      makeNotification({ id: 'b', severity: 'CRITICAL', created_at: '2026-08-10T10:00:00Z' }),
      makeNotification({ id: 'c', severity: 'WARNING', created_at: '2026-08-18T10:00:00Z' }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties on recency within a severity', () => {
    const ordered = rankNotifications([
      makeNotification({ id: 'older', severity: 'WARNING', created_at: '2026-08-01T00:00:00Z' }),
      makeNotification({ id: 'newer', severity: 'WARNING', created_at: '2026-08-19T00:00:00Z' }),
    ]);
    expect(ordered[0]?.id).toBe('newer');
  });
});

describe('import presentation rules', () => {
  it('gives every row state a distinct meaning', () => {
    // Rendering them alike is how somebody commits expecting one thing.
    const meanings = Object.values(ROW_STATE_PRESENTATION).map((item) => item.meaning);
    expect(new Set(meanings).size).toBe(4);
    expect(ROW_STATE_PRESENTATION.INVALID.meaning).toMatch(/NOT be imported/);
    expect(ROW_STATE_PRESENTATION.DUPLICATE.meaning).toMatch(/skipped/i);
    expect(ROW_STATE_PRESENTATION.WARNING.meaning).toMatch(/will be imported/i);
  });

  it('counts valid and warning rows as importable, nothing else', () => {
    expect(willImport(makeBatch({ valid_rows: 2, warning_rows: 3 }))).toBe(5);
    // Invalid and duplicate rows are excluded by construction.
    expect(willImport(makeBatch({ valid_rows: 0, warning_rows: 0, invalid_rows: 9 }))).toBe(0);
  });

  it('summarises what commit will and will not do', () => {
    const summary = commitSummary(makeBatch());
    expect(summary).toMatch(/2 rows will be imported/);
    expect(summary).toMatch(/1 invalid will be skipped/);
    expect(summary).toMatch(/1 already exist/);
  });

  it('treats a file-level error as blocking', () => {
    expect(isBlocked(makeBatch())).toBe(false);
    expect(isBlocked(makeBatch({ file_errors: ['Required column missing: Name'] }))).toBe(true);
  });

  it('puts problem rows first so they are actually seen', () => {
    const ordered = rankRows([
      makeRow({ row_number: 2, validation_state: 'VALID' }),
      makeRow({ row_number: 3, validation_state: 'DUPLICATE' }),
      makeRow({ row_number: 4, validation_state: 'INVALID' }),
      makeRow({ row_number: 5, validation_state: 'WARNING' }),
    ]);
    expect(ordered.map((row) => row.validation_state)).toEqual([
      'INVALID',
      'WARNING',
      'DUPLICATE',
      'VALID',
    ]);
  });

  it('picks out the rows a human has to look at', () => {
    const rows = [
      makeRow({ row_number: 2, validation_state: 'VALID' }),
      makeRow({ row_number: 3, validation_state: 'INVALID' }),
      makeRow({ row_number: 4, validation_state: 'WARNING' }),
    ];
    expect(rowsNeedingAttention(rows).map((row) => row.row_number)).toEqual([3, 4]);
  });
});

/* ------------------------------------------------------- notifications UI */

describe('notification centre', () => {
  it('shows the unread and critical counts', async () => {
    vi.stubGlobal('fetch', mockApi({ notifications: [makeNotification()] }));
    render(<Notifications />, { wrapper });

    await waitFor(() => expect(screen.getByText('Unread')).toBeInTheDocument());
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('states that a fact alerts once', async () => {
    vi.stubGlobal('fetch', mockApi({ notifications: [makeNotification()] }));
    render(<Notifications />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Each fact alerts once/i)).toBeInTheDocument(),
    );
  });

  it('links an alert to the thing it is about', async () => {
    vi.stubGlobal('fetch', mockApi({ notifications: [makeNotification()] }));
    render(<Notifications />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
        'href',
        '/demand/requirements/req-1',
      ),
    );
  });

  it('offers to mark a single alert read only while it is unread', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        notifications: [
          makeNotification({ id: 'a', is_read: false }),
          makeNotification({ id: 'b', is_read: true, title: 'Already read' }),
        ],
      }),
    );
    render(<Notifications />, { wrapper });

    await waitFor(() => expect(screen.getByText('Already read')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /mark ".*" as read/i })).toHaveLength(1);
  });

  it('distinguishes an empty unread inbox from having no alerts at all', async () => {
    vi.stubGlobal('fetch', mockApi({ notifications: [] }));
    const { unmount } = render(<Notifications />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Nothing needs your attention/i)).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /show all/i }));
    await waitFor(() =>
      expect(screen.getByText(/No notifications yet/i)).toBeInTheDocument(),
    );
    unmount();
  });

  it('refuses the screen without the read permission', () => {
    signIn([]);
    vi.stubGlobal('fetch', mockApi());
    render(<Notifications />, { wrapper });

    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------- import UI */

describe('import and export', () => {
  it('offers a template before asking for a file', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<DataTransfer />, { wrapper });

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /download template/i })).toBeInTheDocument(),
    );
  });

  it('says plainly that nothing is written until commit', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<DataTransfer />, { wrapper });

    await waitFor(() =>
      expect(
        screen.getByText(/Nothing is written until you commit/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/invalid row is never written at all/i)).toBeInTheDocument();
  });

  it('explains that exports respect field permissions', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<DataTransfer />, { wrapper });

    await waitFor(() =>
      expect(
        screen.getByText(/does not get a column for it/i),
      ).toBeInTheDocument(),
    );
  });

  it('offers an export for every entity', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<DataTransfer />, { wrapper });

    await waitFor(() => expect(screen.getByText('Export')).toBeInTheDocument());
    expect(screen.getAllByRole('link', { name: /Billing records/i })).toHaveLength(1);
  });

  it('lists past imports with what was skipped', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        batches: [
          makeBatch({ status: 'COMMITTED', committed_rows: 2, invalid_rows: 1, duplicate_rows: 1 }),
        ],
      }),
    );
    render(<DataTransfer />, { wrapper });

    await waitFor(() => expect(screen.getByText('clients.xlsx')).toBeInTheDocument());
    expect(screen.getByText('Imported')).toBeInTheDocument();
    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });

  it('says nothing has been imported rather than showing an empty table', async () => {
    vi.stubGlobal('fetch', mockApi({ batches: [] }));
    render(<DataTransfer />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/Nothing imported yet/i)).toBeInTheDocument(),
    );
  });

  it('hides the import wizard from a role that can only export', async () => {
    signIn(['export:run']);
    vi.stubGlobal('fetch', mockApi());
    render(<DataTransfer />, { wrapper });

    await waitFor(() => expect(screen.getByText('Export')).toBeInTheDocument());
    expect(screen.queryByText(/Import from a spreadsheet/i)).not.toBeInTheDocument();
  });

  it('refuses the screen to a role with neither permission', () => {
    signIn([]);
    vi.stubGlobal('fetch', mockApi());
    render(<DataTransfer />, { wrapper });

    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});
