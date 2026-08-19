import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SystemStatusPage from '@/app/(app)/system/page';
import type { HealthResponse, PublicConfig } from '@/types/api';

const health: HealthResponse = {
  status: 'degraded',
  version: '0.2.0',
  environment: 'local',
  components: [
    { name: 'database', state: 'fallback', detail: 'sqlite (postgres not configured)' },
    { name: 'vector_store', state: 'fallback', detail: 'in-process cosine (qdrant not configured)' },
    { name: 'llm', state: 'fallback', detail: 'deterministic rule-based parser (no LLM provider)' },
    { name: 'email', state: 'ok', detail: null },
  ],
  degraded: {
    database: 'sqlite (postgres not configured)',
    vector_store: 'in-process cosine (qdrant not configured)',
    llm: 'deterministic rule-based parser (no LLM provider)',
  },
};

const config: PublicConfig = {
  app_name: 'Glimmora IT Workforce Intelligence Engine',
  environment: 'local',
  api_prefix: '/api/v1',
  base_currency: 'QAR',
  default_timezone: 'Asia/Qatar',
  max_upload_mb: 10,
  ai_enabled: false,
  sla_thresholds_hours: { urgent: 8, due_soon: 24 },
  document_expiring_soon_days: 60,
  bench_milestone_days: [90, 60, 30, 15, 7],
};

function mockFetch(overrides: { healthStatus?: number } = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/system/health')) {
      if (overrides.healthStatus && overrides.healthStatus >= 400) {
        return new Response(
          JSON.stringify({
            error: { code: 'INTERNAL_ERROR', message: 'Health check failed.', request_id: 'r-1' },
          }),
          { status: overrides.healthStatus, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(health), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/system/config')) {
      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('system status page', () => {
  it('renders live dependency health from the API', async () => {
    vi.stubGlobal('fetch', mockFetch());

    render(<SystemStatusPage />, { wrapper });

    await waitFor(() => expect(screen.getByText('Dependencies')).toBeInTheDocument());

    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Vector store')).toBeInTheDocument();
    expect(screen.getByText('AI extraction')).toBeInTheDocument();
    expect(screen.getByText('sqlite (postgres not configured)')).toBeInTheDocument();
  });

  it('reports a degraded run instead of showing it as healthy', async () => {
    vi.stubGlobal('fetch', mockFetch());

    render(<SystemStatusPage />, { wrapper });

    await waitFor(() => expect(screen.getByText('degraded')).toBeInTheDocument());
    expect(
      screen.getByText(/Some dependencies are running on a documented fallback/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/3 of 4 dependencies are on a fallback/i)).toBeInTheDocument();
  });

  it('shows the configured business thresholds', async () => {
    vi.stubGlobal('fetch', mockFetch());

    render(<SystemStatusPage />, { wrapper });

    await waitFor(() => expect(screen.getByText('90 / 60 / 30 / 15 / 7 days')).toBeInTheDocument());
    expect(screen.getByText('< 8 hours left')).toBeInTheDocument();
    expect(screen.getByText('within 60 days')).toBeInTheDocument();
    expect(screen.getByText('Fallback parser')).toBeInTheDocument();
  });

  it('renders the error state, not a crash, when health cannot be read', async () => {
    vi.stubGlobal('fetch', mockFetch({ healthStatus: 500 }));

    render(<SystemStatusPage />, { wrapper });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Health check failed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
