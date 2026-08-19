'use client';

import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  FileStack,
  Send,
  ShieldCheck,
  Target,
  TrendingUp,
  UserX,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, ErrorState, InlineWarning, TableLoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAdminDashboard,
  useHrDashboard,
  useManagementDashboard,
  useSalesDashboard,
} from '@/hooks/use-delivery';
import { useAuthStore } from '@/lib/auth-store';
import { formatMoney, formatScore } from '@/lib/format';
import { shortPeriod, trendPeak, trendSeries } from '@/lib/delivery';
import { OPPORTUNITY_BAND_LABELS, OPPORTUNITY_BAND_VARIANT } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import type { Funnel } from '@/types/delivery';
import type { OpportunityBand } from '@/types/scoring';

/**
 * The role-aware dashboard.
 *
 * One route, four views. Which one you get is decided by permission, not by a
 * setting — a salesperson has no use for the admin's data-quality counters, and
 * a dashboard that shows everybody everything is a dashboard nobody reads.
 */

function Tile({
  label,
  value,
  hint,
  href,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
  icon?: React.ReactNode;
}) {
  const body = (
    <Card
      className={cn(
        'h-full transition-colors',
        href && 'hover:border-primary/50',
        tone === 'warning' && 'border-warning/40',
        tone === 'danger' && 'border-destructive/40',
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div
          className={cn(
            'mt-1 text-2xl font-semibold tabular',
            tone === 'good' && 'text-success',
            tone === 'warning' && 'text-warning',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {value}
        </div>
        {hint ? <p className="mt-1 text-2xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function FunnelStrip({ funnel }: { funnel: Funnel }) {
  const peak = Math.max(1, ...funnel.stages.map((stage) => stage.count));

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Requirement to billing</h3>
        <ul className="space-y-1.5">
          {funnel.stages.map((stage) => (
            <li key={stage.stage} className="flex items-center gap-3">
              <span className="w-44 shrink-0 truncate text-xs text-muted-foreground">
                {stage.label}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                <div
                  className="h-full bg-primary/70"
                  style={{ width: `${(stage.count / peak) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs tabular">{stage.count}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span>{funnel.active_requirements} active requirements</span>
          <span>{funnel.open_total} open opportunities</span>
          {funnel.closed.map((stage) => (
            <span key={stage.stage}>
              {stage.count} {stage.label.toLowerCase()}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ManagementView() {
  const dashboard = useManagementDashboard();

  if (dashboard.isLoading) return <TableLoadingState rows={4} columns={4} />;
  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  }
  if (!dashboard.data) return null;

  const { headline, trend, funnel } = dashboard.data;
  const peak = trendPeak(trend);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Confirmed revenue this month"
          value={formatMoney(headline.confirmed_revenue, 'QAR')}
          hint={headline.period ? shortPeriod(headline.period) : undefined}
          tone="good"
          href="/billing/revenue"
          icon={<TrendingUp className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Projected, not yet earned"
          value={formatMoney(headline.projected_revenue, 'QAR')}
          hint={`${headline.unconfirmed_periods} periods awaiting confirmation`}
          tone={headline.unconfirmed_periods > 0 ? 'warning' : 'neutral'}
          href="/billing/active"
        />
        <Tile
          label="Active deployments"
          value={dashboard.data.active_deployments}
          href="/deployments/active"
          icon={<Briefcase className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="On the bench"
          value={dashboard.data.bench_count}
          hint="Unbilled capacity"
          tone={dashboard.data.bench_count > 0 ? 'warning' : 'good'}
          href="/deployments/redeployment"
          icon={<Users className="h-3.5 w-3.5" aria-hidden />}
        />
      </div>

      <InlineWarning>
        Confirmed and projected revenue are never added together. A projection is arithmetic from a
        deployment&apos;s dates and rates; only a confirmed month is money the business earned.
      </InlineWarning>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Revenue trend</h3>
            {trend.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No billing periods yet. Generate projections from an active deployment.
              </p>
            ) : (
              <ul className="space-y-2">
                {trendSeries(trend).map((row) => (
                  <li key={row.period} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs tabular text-muted-foreground">
                      {shortPeriod(row.period)}
                    </span>
                    <div className="flex h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full bg-success"
                        style={{ width: `${(row.confirmed / peak) * 100}%` }}
                      />
                      <div
                        className="h-full bg-warning/60"
                        style={{ width: `${(row.projected / peak) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs tabular">
                      {formatMoney(row.confirmed, 'QAR', { compact: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <FunnelStrip funnel={funnel} />
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Opportunity scores</h3>
          {Object.keys(dashboard.data.opportunity_bands).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scored yet. Scores appear once a requirement goes through the engine.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(dashboard.data.opportunity_bands).map(([band, count]) => (
                <Badge key={band} variant={OPPORTUNITY_BAND_VARIANT[band as OpportunityBand]}>
                  <span className="tabular">{count}</span>{' '}
                  {OPPORTUNITY_BAND_LABELS[band as OpportunityBand]}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SalesView() {
  const dashboard = useSalesDashboard();

  if (dashboard.isLoading) return <TableLoadingState rows={3} columns={4} />;
  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  }
  if (!dashboard.data) return null;

  const data = dashboard.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          label="My open opportunities"
          value={data.my_open_opportunities}
          href="/sales/pipeline"
          icon={<Target className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Overdue next actions"
          value={data.overdue_next_actions}
          hint="A pipeline stops one missed follow-up at a time"
          tone={data.overdue_next_actions > 0 ? 'danger' : 'good'}
          href="/sales/pipeline"
          icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Open, no owner"
          value={data.unowned_opportunities}
          tone={data.unowned_opportunities > 0 ? 'warning' : 'neutral'}
          href="/sales/pipeline"
          icon={<UserX className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Live submissions"
          value={data.live_submissions}
          href="/sales/submissions"
          icon={<Send className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Interviews next 14 days"
          value={data.interviews_next_14_days}
          href="/sales/interviews"
          icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="SLA due within 48h"
          value={data.sla_due_within_48h}
          hint="VMS windows are 24-48 hours"
          tone={data.sla_due_within_48h > 0 ? 'danger' : 'neutral'}
          href="/demand/deadlines"
        />
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Highest scoring opportunities</h3>
          {data.top_opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scored yet.{' '}
              <Link href="/intelligence/scoring" className="underline underline-offset-4">
                Score a requirement
              </Link>{' '}
              to rank your pursuit list.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.top_opportunities.map((item) => (
                <li key={item.requirement_id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/demand/requirements/${item.requirement_id}`}
                    className="truncate text-sm underline-offset-4 hover:underline"
                  >
                    {item.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular">
                      {formatScore(item.score)}
                    </span>
                    <Badge variant={OPPORTUNITY_BAND_VARIANT[item.band as OpportunityBand]}>
                      {OPPORTUNITY_BAND_LABELS[item.band as OpportunityBand]}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HrView() {
  const dashboard = useHrDashboard();

  if (dashboard.isLoading) return <TableLoadingState rows={3} columns={4} />;
  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  }
  if (!dashboard.data) return null;

  const data = dashboard.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Deployed and billing"
          value={data.deployed_count}
          tone="good"
          href="/deployments/active"
          icon={<Briefcase className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="On the bench"
          value={data.bench_count}
          hint="Unbilled capacity"
          tone={data.bench_count > 0 ? 'warning' : 'good'}
          href="/talent/bench"
          icon={<Users className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Bench with nowhere to go"
          value={data.bench_without_a_suggestion}
          hint="The number the redeployment engine drives to zero"
          tone={data.bench_without_a_suggestion > 0 ? 'danger' : 'good'}
          href="/deployments/redeployment"
        />
        <Tile
          label="Rolling off within 30 days"
          value={data.deployments_ending_30d}
          tone={data.deployments_ending_30d > 0 ? 'warning' : 'neutral'}
          href="/deployments/ending-soon"
          icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Expired documents"
          value={data.documents_expired}
          hint="An expired work permit blocks billing"
          tone={data.documents_expired > 0 ? 'danger' : 'good'}
          href="/talent/documents"
          icon={<FileStack className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Expiring within 60 days"
          value={data.documents_expiring_soon}
          tone={data.documents_expiring_soon > 0 ? 'warning' : 'neutral'}
          href="/talent/documents"
        />
        <Tile
          label="Profiles awaiting review"
          value={data.awaiting_review}
          hint="Parsed CVs are not matchable until accepted"
          tone={data.awaiting_review > 0 ? 'warning' : 'neutral'}
          href="/talent/resources"
        />
        <Tile
          label="Total consultants"
          value={data.total_resources}
          href="/talent/resources"
        />
      </div>
    </div>
  );
}

function AdminView() {
  const dashboard = useAdminDashboard();

  if (dashboard.isLoading) return <TableLoadingState rows={3} columns={4} />;
  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  }
  if (!dashboard.data) return null;

  const data = dashboard.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Active users"
          value={data.active_users}
          href="/admin/users"
          icon={<Users className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Audit events (7 days)"
          value={data.audit_events_7d}
          href="/admin/audit"
          icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Requirements never scored"
          value={data.active_requirements_unscored}
          hint="A scoring engine is only as good as what has been recorded"
          tone={data.active_requirements_unscored > 0 ? 'warning' : 'good'}
          href="/intelligence/scoring"
          icon={<BadgeCheck className="h-3.5 w-3.5" aria-hidden />}
        />
        <Tile
          label="Requirements with no rate"
          value={data.active_requirements_unpriced}
          hint="Commercial score cannot be computed without one"
          tone={data.active_requirements_unpriced > 0 ? 'warning' : 'good'}
          href="/demand/requirements"
          icon={<Building2 className="h-3.5 w-3.5" aria-hidden />}
        />
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Most common actions this week</h3>
          {data.top_actions_7d.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded in the last week.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.top_actions_7d.map((row) => (
                <li key={row.action} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs">{row.action}</span>
                  <span className="tabular text-muted-foreground">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function Dashboard() {
  const can = useAuthStore((state) => state.can);
  const user = useAuthStore((state) => state.user);

  const views: Array<{ permission: string; label: string; node: React.ReactNode }> = [
    { permission: 'dashboard:management', label: 'Management', node: <ManagementView /> },
    { permission: 'dashboard:sales', label: 'Sales', node: <SalesView /> },
    { permission: 'dashboard:hr', label: 'Resourcing', node: <HrView /> },
    { permission: 'dashboard:admin', label: 'Administration', node: <AdminView /> },
  ];
  const available = views.filter((view) => can(view.permission));
  const [active, setActive] = React.useState(0);

  if (available.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState
          title="No dashboard is assigned to your role"
          description="Dashboards are role-specific. Ask an administrator if you believe you should have one."
        />
      </>
    );
  }

  const current = available[Math.min(active, available.length - 1)];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          user ? `${current?.label} view — ${user.full_name}` : `${current?.label} view`
        }
      />

      {available.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Dashboard views">
          {available.map((view, index) => (
            <button
              key={view.permission}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => setActive(index)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                index === active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted',
              )}
            >
              {view.label}
            </button>
          ))}
        </div>
      ) : null}

      {current?.node}
    </>
  );
}
