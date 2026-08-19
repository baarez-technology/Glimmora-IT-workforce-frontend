'use client';

import { CheckCircle2, CircleAlert, CircleDot, RefreshCw, XCircle } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { CardLoadingState, ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useHealth, usePublicConfig } from '@/hooks/use-system';
import { CURRENT_PHASE } from '@/lib/navigation';
import type { ComponentState } from '@/types/api';

const COMPONENT_LABELS: Record<string, string> = {
  database: 'Database',
  vector_store: 'Vector store',
  object_storage: 'Document storage',
  cache: 'Cache',
  queue: 'Background jobs',
  llm: 'AI extraction',
  embeddings: 'Embeddings',
  email: 'Email',
};

const PHASES = [
  { number: 1, name: 'Discovery & architecture' },
  { number: 2, name: 'Foundation & design system' },
  { number: 3, name: 'Authentication, roles & security' },
  { number: 4, name: 'Accounts, projects & activity' },
  { number: 5, name: 'Requirements & AI JD parsing' },
  { number: 6, name: 'Talent cloud & CV intelligence' },
  { number: 7, name: 'AI matching engine' },
  { number: 8, name: 'Reverse matching & zero-bench' },
  { number: 9, name: 'Addressability & opportunity scoring' },
  { number: 10, name: 'Sales & submission pipeline' },
  { number: 11, name: 'Deployment, billing & dashboards' },
  { number: 12, name: 'Notifications, Excel, audit & hardening' },
];

function StateIcon({ state }: { state: ComponentState }) {
  if (state === 'ok') return <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />;
  if (state === 'fallback') return <CircleAlert className="h-4 w-4 text-warning" aria-hidden />;
  return <XCircle className="h-4 w-4 text-destructive" aria-hidden />;
}

export default function SystemStatusPage() {
  const health = useHealth();
  const config = usePublicConfig();

  if (health.isLoading) {
    return (
      <>
        <PageHeader title="System status" />
        <CardLoadingState count={3} />
      </>
    );
  }

  if (health.isError) {
    return (
      <>
        <PageHeader title="System status" />
        <ErrorState error={health.error} onRetry={() => void health.refetch()} />
      </>
    );
  }

  const data = health.data;
  const degradedEntries = data ? Object.entries(data.degraded) : [];

  return (
    <>
      <PageHeader
        title="System status"
        description="Dependency health and build progress. Every dependency has a documented fallback, so a degraded run is reported here rather than hidden."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void health.refetch();
              void config.refetch();
            }}
            loading={health.isFetching}
          >
            <RefreshCw aria-hidden />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Dependencies</CardTitle>
                <CardDescription>
                  {data?.status === 'healthy'
                    ? 'All dependencies are running on their primary implementation.'
                    : 'Some dependencies are running on a documented fallback.'}
                </CardDescription>
              </div>
              <Badge
                variant={
                  data?.status === 'healthy'
                    ? 'success'
                    : data?.status === 'degraded'
                      ? 'warning'
                      : 'destructive'
                }
              >
                {data?.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data?.components.map((component) => (
                <li key={component.name} className="flex items-start gap-3 py-2.5">
                  <StateIcon state={component.state} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {COMPONENT_LABELS[component.name] ?? component.name}
                    </div>
                    {component.detail ? (
                      <div className="text-xs text-muted-foreground">{component.detail}</div>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      component.state === 'ok'
                        ? 'success'
                        : component.state === 'fallback'
                          ? 'warning'
                          : 'destructive'
                    }
                  >
                    {component.state === 'ok' ? 'primary' : component.state}
                  </Badge>
                </li>
              ))}
            </ul>

            {degradedEntries.length > 0 && (
              <>
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground">
                  {degradedEntries.length} of {data?.components.length} dependencies are on a
                  fallback. The platform stays usable — data richness and search quality degrade in
                  the ways listed above.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Environment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Environment" value={data?.environment} />
              <Row label="API version" value={data?.version} />
              <Row label="Base currency" value={config.data?.base_currency} />
              <Row label="Timezone" value={config.data?.default_timezone} />
              <Row
                label="AI provider"
                value={config.data ? (config.data.ai_enabled ? 'Enabled' : 'Fallback parser') : undefined}
              />
              <Row
                label="Upload limit"
                value={config.data ? `${config.data.max_upload_mb} MB` : undefined}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business thresholds</CardTitle>
              <CardDescription>Configured alert timings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row
                label="SLA urgent"
                value={
                  config.data ? `< ${config.data.sla_thresholds_hours.urgent} hours left` : undefined
                }
              />
              <Row
                label="SLA due soon"
                value={
                  config.data
                    ? `< ${config.data.sla_thresholds_hours.due_soon} hours left`
                    : undefined
                }
              />
              <Row
                label="Document expiring"
                value={
                  config.data ? `within ${config.data.document_expiring_soon_days} days` : undefined
                }
              />
              <Row
                label="Bench milestones"
                value={config.data ? `${config.data.bench_milestone_days.join(' / ')} days` : undefined}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Build progress</CardTitle>
          <CardDescription>
            V1 is delivered in 12 phases. A phase counts as complete only when the UI, API,
            database, validation, authorization, error handling, tests and documentation all work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PHASES.map((phase) => {
              const done = phase.number <= CURRENT_PHASE;
              return (
                <li
                  key={phase.number}
                  className="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm"
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="tabular text-xs text-muted-foreground">{phase.number}</span>
                  <span className={done ? 'font-medium' : 'text-muted-foreground'}>
                    {phase.name}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  );
}
