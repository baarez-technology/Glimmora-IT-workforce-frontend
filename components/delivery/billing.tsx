'use client';

import { CheckCircle2, Info, PlusCircle, RefreshCw } from 'lucide-react';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import {
  EmptyState,
  ErrorState,
  InlineWarning,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCreateBillingRecord,
  useDeployments,
  useBillingHeadline,
  useBillingRecords,
  useBillingSummary,
  useConfirmBilling,
  useGenerateProjections,
} from '@/hooks/use-delivery';
import { useAuthStore } from '@/lib/auth-store';
import { formatMoney, formatPercent } from '@/lib/format';
import {
  BILLING_STATUS_LABELS,
  BILLING_STATUS_VARIANT,
  marginVariant,
  shortPeriod,
  trendPeak,
  trendSeries,
} from '@/lib/delivery';
import { cn } from '@/lib/utils';
import type { BillingRecord, BillingStatus } from '@/types/delivery';

/**
 * Billing, revenue and margin.
 *
 * The rule this screen exists to uphold: **a projection is never presented as
 * earned revenue.** Confirmed and projected are separate columns, separate bar
 * segments and separate totals throughout — never one number
 * (ASSUMPTIONS.md A15).
 */

function ConfirmForm({ record, onDone }: { record: BillingRecord; onDone: () => void }) {
  const [revenue, setRevenue] = React.useState(record.revenue_amount);
  const [cost, setCost] = React.useState(record.cost_amount);
  const [notes, setNotes] = React.useState('');
  const confirm = useConfirmBilling(record.id);

  const profit = Number(revenue) - Number(cost);
  const margin = Number(revenue) > 0 ? (profit / Number(revenue)) * 100 : null;

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`rev-${record.id}`}>Revenue</Label>
          <Input
            id={`rev-${record.id}`}
            type="number"
            min={0}
            value={revenue}
            onChange={(event) => setRevenue(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cost-${record.id}`}>Cost</Label>
          <Input
            id={`cost-${record.id}`}
            type="number"
            min={0}
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`note-${record.id}`}>Note</Label>
          <Input
            id={`note-${record.id}`}
            value={notes}
            placeholder="Why it differs, if it does"
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Gross profit {formatMoney(profit, record.currency)} · margin{' '}
        {margin === null ? '—' : formatPercent(margin)}. The projection was arithmetic;
        confirming records what actually happened, so correct the figures if they differ.
      </p>

      {confirm.isError ? <ErrorState error={confirm.error} /> : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={confirm.isPending}
          onClick={() =>
            confirm.mutate(
              {
                revenue_amount: revenue,
                cost_amount: cost,
                notes: notes.trim() || undefined,
              },
              { onSuccess: onDone },
            )
          }
        >
          <CheckCircle2 aria-hidden />
          Confirm {record.period_label}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RecordRow({ record, canWrite }: { record: BillingRecord; canWrite: boolean }) {
  const [confirming, setConfirming] = React.useState(false);

  return (
    <>
      <TableRow>
        <TableCell className="tabular">{record.period_label}</TableCell>
        <TableCell>
          <div className="text-sm">{record.resource_name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{record.role_title}</div>
        </TableCell>
        <TableCell>
          <Badge variant={BILLING_STATUS_VARIANT[record.status]}>
            {BILLING_STATUS_LABELS[record.status]}
          </Badge>
          {record.is_estimated && record.billable_days ? (
            <div className="mt-0.5 text-2xs text-muted-foreground">
              {record.billable_days} billable days
            </div>
          ) : null}
        </TableCell>
        <TableCell className="text-right tabular">
          {formatMoney(record.revenue_amount, record.currency)}
        </TableCell>
        <TableCell className="text-right tabular">
          {formatMoney(record.gross_profit, record.currency)}
        </TableCell>
        <TableCell className="text-right">
          <Badge variant={marginVariant(record.margin_percent)}>
            {record.margin_percent === null ? '—' : formatPercent(record.margin_percent)}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          {canWrite && record.status === 'PROJECTED' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming((value) => !value)}
            >
              Confirm
            </Button>
          ) : null}
        </TableCell>
      </TableRow>

      {confirming ? (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/20">
            <ConfirmForm record={record} onDone={() => setConfirming(false)} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/** Confirmed and projected as separate stacked segments, never one total. */
function RevenueTrend({ months = 12 }: { months?: number }) {
  const summary = useBillingSummary(months);
  const rows = summary.data ?? [];

  if (summary.isLoading) return <TableLoadingState rows={3} columns={4} />;
  if (summary.isError) {
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No billing periods yet"
        description="Generate projections from an active deployment and the trend appears here."
      />
    );
  }

  const peak = trendPeak(rows);
  const series = trendSeries(rows);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-success" aria-hidden />
            Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-warning/60" aria-hidden />
            Projected — not yet earned
          </span>
        </div>

        <ul className="space-y-2">
          {series.map((row) => (
            <li key={row.period} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs tabular text-muted-foreground">
                {shortPeriod(row.period)}
              </span>
              <div
                className="flex h-5 flex-1 overflow-hidden rounded-sm bg-muted"
                role="img"
                aria-label={`${row.period}: ${row.confirmed} confirmed, ${row.projected} projected`}
              >
                <div
                  className="h-full bg-success"
                  style={{ width: `${(row.confirmed / peak) * 100}%` }}
                />
                <div
                  className="h-full bg-warning/60"
                  style={{ width: `${(row.projected / peak) * 100}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-xs tabular">
                {formatMoney(row.confirmed, 'QAR', { compact: true })}
                {row.projected > 0 ? (
                  <span className="text-muted-foreground">
                    {' '}
                    +{formatMoney(row.projected, 'QAR', { compact: true })}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}


/**
 * Record a month by hand.
 *
 * The SOW asks for billing to be "lightweight — manual entry or Excel import".
 * Projections cover the common case, but a month that predates the system or an
 * ad-hoc invoice still has to be recordable, or the headline revenue figure is
 * only ever as complete as the generator.
 */
function ManualEntryForm({ onDone }: { onDone: () => void }) {
  const now = new Date();
  const [deploymentId, setDeploymentId] = React.useState('');
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [revenue, setRevenue] = React.useState('');
  const [cost, setCost] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const deployments = useDeployments();
  const create = useCreateBillingRecord();

  const profit = Number(revenue || 0) - Number(cost || 0);
  const margin = Number(revenue) > 0 ? (profit / Number(revenue)) * 100 : null;

  return (
    <Card className="mb-4">
      <CardContent className="space-y-4 p-4">
        <p className="text-sm font-medium">Record a month by hand</p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="manual-deployment">Deployment</Label>
            <Select
              id="manual-deployment"
              value={deploymentId}
              onChange={(event) => setDeploymentId(event.target.value)}
            >
              <option value="">Select…</option>
              {(deployments.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.resource_name} — {item.role_title}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-year">Year</Label>
            <Input
              id="manual-year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-month">Month</Label>
            <Input
              id="manual-month"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-revenue">Revenue</Label>
            <Input
              id="manual-revenue"
              type="number"
              min={0}
              value={revenue}
              onChange={(event) => setRevenue(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-cost">Cost</Label>
            <Input
              id="manual-cost"
              type="number"
              min={0}
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="manual-notes">Note</Label>
            <Input
              id="manual-notes"
              value={notes}
              placeholder="Why this was entered by hand"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Gross profit {formatMoney(profit, 'QAR')} · margin{' '}
          {margin === null ? '—' : formatPercent(margin)}. A hand-entered month is recorded as
          confirmed, not projected — somebody typed what actually happened.
        </p>

        {create.isError ? <ErrorState error={create.error} /> : null}

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!deploymentId || !revenue || create.isPending}
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                {
                  deployment_id: deploymentId,
                  period_year: Number(year),
                  period_month: Number(month),
                  revenue_amount: revenue,
                  cost_amount: cost || '0',
                  notes: notes.trim() || undefined,
                },
                { onSuccess: onDone },
              )
            }
          >
            Record month
          </Button>
          <Button variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BillingWorkbench({
  view = 'records',
}: {
  view?: 'records' | 'revenue' | 'margin';
} = {}) {
  const can = useAuthStore((state) => state.can);
  const [status, setStatus] = React.useState<BillingStatus | ''>('');
  const [manualEntry, setManualEntry] = React.useState(false);

  const headline = useBillingHeadline();
  const records = useBillingRecords({ status: status || undefined });
  const summary = useBillingSummary(12);
  const generate = useGenerateProjections();

  if (!can('billing:read')) return <PermissionDeniedState />;

  const canWrite = can('billing:write');
  const rows = records.data ?? [];
  const head = headline.data;

  const titles = {
    records: 'Active Billing',
    revenue: 'Revenue',
    margin: 'Margin',
  } as const;
  const descriptions = {
    records: 'One row per deployment per month. Projections are arithmetic; confirming one records what actually happened.',
    revenue: 'Monthly billable revenue generated through the engine. Confirmed and projected are never added together.',
    margin: 'Gross profit and margin by period, from the same records the revenue view reads.',
  } as const;

  return (
    <>
      <PageHeader
        title={titles[view]}
        description={descriptions[view]}
        actions={
          canWrite ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setManualEntry((value) => !value)}>
                <PlusCircle aria-hidden />
                Record a month
              </Button>
            <Button
              variant="outline"
              onClick={() => generate.mutate(undefined)}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <RefreshCw className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw aria-hidden />
              )}
              Generate projections
            </Button>
            </div>
          ) : undefined
        }
      />

      {manualEntry && canWrite ? (
        <ManualEntryForm onDone={() => setManualEntry(false)} />
      ) : null}

      {headline.isError ? (
        <ErrorState error={headline.error} onRetry={() => void headline.refetch()} />
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">
                Confirmed this month{head?.period ? ` (${shortPeriod(head.period)})` : ''}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular text-success">
                {formatMoney(head?.confirmed_revenue ?? 0, 'QAR')}
              </div>
            </CardContent>
          </Card>
          <Card className="border-warning/40">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Projected, not yet earned</div>
              <div className="mt-1 text-2xl font-semibold tabular text-warning">
                {formatMoney(head?.projected_revenue ?? 0, 'QAR')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Confirmed margin</div>
              <div className="mt-1 text-2xl font-semibold tabular">
                {head?.confirmed_margin_percent === null ||
                head?.confirmed_margin_percent === undefined
                  ? '—'
                  : formatPercent(head.confirmed_margin_percent)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Lifetime confirmed</div>
              <div className="mt-1 text-2xl font-semibold tabular">
                {formatMoney(head?.lifetime_confirmed_revenue ?? 0, 'QAR', { compact: true })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {head && head.unconfirmed_periods > 0 ? (
        <InlineWarning>
          <strong className="tabular">{head.unconfirmed_periods}</strong> billing period
          {head.unconfirmed_periods === 1 ? '' : 's'} are still projections. They are shown
          separately and are <strong>not</strong> counted as revenue until somebody confirms them
          against what was actually invoiced.
        </InlineWarning>
      ) : null}

      {view !== 'records' ? (
        <div className="mt-4">
          <RevenueTrend months={12} />
        </div>
      ) : null}

      {view === 'margin' ? (
        <Card className="mt-4">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Confirmed revenue</TableHead>
                  <TableHead className="text-right">Confirmed cost</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary.data ?? []).map((row) => (
                  <TableRow key={row.period}>
                    <TableCell className="tabular">{row.period}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.confirmed_revenue, 'QAR')}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.confirmed_cost, 'QAR')}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.confirmed_profit, 'QAR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={marginVariant(row.confirmed_margin_percent)}>
                        {row.confirmed_margin_percent === null
                          ? '—'
                          : formatPercent(row.confirmed_margin_percent)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {view === 'records' ? (
        <>
          <Card className="mb-4 mt-4">
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <Select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as BillingStatus | '')}
                >
                  <option value="">All statuses</option>
                  {(
                    ['PROJECTED', 'CONFIRMED', 'INVOICED', 'CANCELLED'] as BillingStatus[]
                  ).map((value) => (
                    <option key={value} value={value}>
                      {BILLING_STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </label>
              {generate.isSuccess ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" aria-hidden />
                  {generate.data.created} created, {generate.data.updated} refreshed,{' '}
                  {generate.data.protected} confirmed periods left untouched.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {records.isError ? (
            <ErrorState error={records.error} onRetry={() => void records.refetch()} />
          ) : records.isLoading ? (
            <TableLoadingState rows={6} columns={7} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No billing records yet"
              description="Billing rows are generated from active deployments. Generate projections to create them, then confirm each month against what was actually invoiced."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Consultant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Gross profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((record) => (
                      <RecordRow key={record.id} record={record} canWrite={canWrite} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      <p className={cn('mt-4 text-2xs text-muted-foreground')}>
        Regenerating projections never overwrites a confirmed month — a human&apos;s check of what
        actually happened outranks the arithmetic.
      </p>
    </>
  );
}
