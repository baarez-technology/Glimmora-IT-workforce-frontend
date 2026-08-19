import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginPage from '@/app/(auth)/login/page';
import { useAuthStore } from '@/lib/auth-store';
import { isVisibleTo, NAVIGATION } from '@/lib/navigation';
import type { CurrentUser } from '@/types/api';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams(),
}));

const salesUser: CurrentUser = {
  id: 'user-1',
  email: 'sales@glimmora.ai',
  full_name: 'Daniel Fernandes',
  role: 'SALES',
  job_title: 'Account Manager',
  is_active: true,
  must_change_password: false,
  last_login_at: null,
  permissions: ['account:read', 'requirement:create', 'billing.rate:view', 'margin:view'],
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockLogin(result: { ok: boolean; status?: number; message?: string } = { ok: true }) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/auth/login')) {
      if (!result.ok) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'UNAUTHENTICATED',
              message: result.message ?? 'Those sign-in details are not correct.',
              request_id: 'r-9',
            },
          }),
          { status: result.status ?? 401, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          access_token: 'token-abc',
          token_type: 'bearer',
          expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
          user: salesUser,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

beforeEach(() => {
  replace.mockClear();
  useAuthStore.setState({ status: 'anonymous', user: null, expiresAt: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login page', () => {
  it('validates the form before calling the API', async () => {
    const fetchMock = mockLogin();
    vi.stubGlobal('fetch', fetchMock);

    render(<LoginPage />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs in and redirects', async () => {
    vi.stubGlobal('fetch', mockLogin());

    render(<LoginPage />, { wrapper });
    await userEvent.type(screen.getByLabelText(/email address/i), 'sales@glimmora.ai');
    await userEvent.type(screen.getByLabelText(/password/i), 'Glimmora-Test-2026!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/system'));
    expect(useAuthStore.getState().user?.email).toBe('sales@glimmora.ai');
  });

  it('shows the server message on a rejected sign-in, without leaking why', async () => {
    vi.stubGlobal('fetch', mockLogin({ ok: false }));

    render(<LoginPage />, { wrapper });
    await userEvent.type(screen.getByLabelText(/email address/i), 'sales@glimmora.ai');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Those sign-in details are not correct.');
    expect(alert.textContent).not.toMatch(/user|exists|unknown/i);
    expect(replace).not.toHaveBeenCalled();
  });

  it('routes a temporary password straight to the change-password screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: 'token-abc',
              token_type: 'bearer',
              expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
              user: { ...salesUser, must_change_password: true },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    render(<LoginPage />, { wrapper });
    await userEvent.type(screen.getByLabelText(/email address/i), 'sales@glimmora.ai');
    await userEvent.type(screen.getByLabelText(/password/i), 'Temp-Password-2026!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/account/password'));
  });

  it('surfaces a lockout message rather than a generic failure', async () => {
    vi.stubGlobal(
      'fetch',
      mockLogin({ ok: false, message: 'Too many failed attempts. Try again in 15 minutes.' }),
    );

    render(<LoginPage />, { wrapper });
    await userEvent.type(screen.getByLabelText(/email address/i), 'sales@glimmora.ai');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/15 minutes/);
  });
});

describe('session store', () => {
  it('keeps the access token out of browser storage', async () => {
    vi.stubGlobal('fetch', mockLogin());

    await useAuthStore.getState().login('sales@glimmora.ai', 'Glimmora-Test-2026!');

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(JSON.stringify(window.localStorage)).not.toContain('token-abc');
    expect(window.sessionStorage.length).toBe(0);
  });

  it('clears the session on logout even if the server call fails', async () => {
    vi.stubGlobal('fetch', mockLogin());
    await useAuthStore.getState().login('sales@glimmora.ai', 'Glimmora-Test-2026!');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('answers permission questions from the signed-in user', async () => {
    vi.stubGlobal('fetch', mockLogin());
    await useAuthStore.getState().login('sales@glimmora.ai', 'Glimmora-Test-2026!');

    const { can, hasRole } = useAuthStore.getState();
    expect(can('margin:view')).toBe(true);
    expect(can('resource.cost:view')).toBe(false);
    expect(hasRole('SALES')).toBe(true);
    expect(hasRole('ADMIN')).toBe(false);
  });
});

describe('navigation visibility', () => {
  const adminItems = NAVIGATION.flatMap((section) => section.items).filter((item) =>
    item.href.startsWith('/admin/'),
  );

  it('hides user administration from non-admins', () => {
    const users = adminItems.find((item) => item.href === '/admin/users')!;

    expect(isVisibleTo(users, { role: 'ADMIN', permissions: ['user:read'] })).toBe(true);
    expect(isVisibleTo(users, { role: 'SALES', permissions: [] })).toBe(false);
    expect(isVisibleTo(users, { role: 'MANAGEMENT', permissions: ['user:read'] })).toBe(false);
  });

  it('hides the audit log from sales and resourcing', () => {
    const audit = adminItems.find((item) => item.href === '/admin/audit')!;

    expect(isVisibleTo(audit, { role: 'MANAGEMENT', permissions: ['audit:view'] })).toBe(true);
    expect(isVisibleTo(audit, { role: 'SALES', permissions: [] })).toBe(false);
    expect(isVisibleTo(audit, { role: 'HR_RESOURCING', permissions: [] })).toBe(false);
  });

  it('shows the role catalogue to everyone', () => {
    const roles = adminItems.find((item) => item.href === '/admin/roles')!;

    for (const role of ['ADMIN', 'MANAGEMENT', 'SALES', 'HR_RESOURCING'] as const) {
      expect(isVisibleTo(roles, { role, permissions: ['role:read'] })).toBe(true);
    }
  });

  it('hides billing from resourcing, which cannot see client rates', () => {
    const billing = NAVIGATION.flatMap((section) => section.items).find(
      (item) => item.href === '/billing/revenue',
    )!;

    expect(isVisibleTo(billing, { role: 'HR_RESOURCING', permissions: [] })).toBe(false);
    expect(isVisibleTo(billing, { role: 'SALES', permissions: [] })).toBe(true);
  });
});
