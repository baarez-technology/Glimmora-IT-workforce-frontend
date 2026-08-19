'use client';

import { CalendarClock, Link2, Repeat, Square } from 'lucide-react';
import Link from 'next/link';
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
  useDeployments,
  useEndDeployment,
  useEndingSoon,
  useExtendDeployment,
} from '@/hooks/use-delivery';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate, formatMoney } from '@/lib/format';
import {
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_STATUS_VARIANT,
  isExtension,
  runwayLabel,
  runwayVariant,
} from '@/lib/delivery';
import type { Deployment, DeploymentStatus } from '@/types/delivery';

/**
 * Active deployments and the ones ending soon.
 *
 * "Ending soon" is the same list the zero-bench engine reads: a consultant
 * rolling off is a redeployment task before it is an administrative one, so
 * every row links straight to the reverse-matching screen.
 */

function EndForm({ deployment, onDone }: { deployment: Deployment; onDone: () => void }) {
  const [when, setWhen] = React.useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = React.useState('');
  const end = useEndDeployment(deployment.id);

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`end-${deployment.id}`}>Actual end date</Label>
          <Input
            id={`end-${deployment.id}`}
            type="date"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`reason-${deployment.id}`}>Reason</Label>
          <Input
            id={`reason-${deployment.id}`}
            value={reason}
            placeholder="Optional"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Ending frees the consultant on the talent cloud and cancels any billing projected for
        months after this date.
      </p>
      {end.isError ? <ErrorState error={end.error} /> : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!when || end.isPending}
          onClick={() =>
            end.mutate(
              { actual_end_date: when, reason: reason.trim() || undefined },
              { onSuccess: onDone },
            )
          }
        >
          End deployment
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ExtendForm({ deployment, onDone }: { deployment: Deployment; onDone: () => void }) {
  const earliest = deployment.effective_end
    ? new Date(new Date(deployment.effective_end).getTime() + 86_400_000)
        .toISOString()
        .slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const [start, setStart] = React.useState(earliest);
  const [end, setEnd] = React.useState('');
  const [rate, setRate] = React.useState(deployment.bill_rate ?? '');
  const extend = useExtendDeployment(deployment.id);

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`ext-start-${deployment.id}`}>New start</Label>
          <Input
            id={`ext-start-${deployment.id}`}
            type="date"
            min={earliest}
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ext-end-${deployment.id}`}>New end</Label>
          <Input
            id={`ext-end-${deployment.id}`}
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ext-rate-${deployment.id}`}>Bill rate</Label>
          <Input
            id={`ext-rate-${deployment.id}`}
            type="number"
            min={0}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        An extension is a new linked deployment, not an edit — the original keeps its billing
        history and the rate change is visible.
      </p>
      {extend.isError ? <ErrorState error={extend.error} /> : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!start || extend.isPending}
          onClick={() =>
            extend.mutate(
              {
                start_date: start,
                end_date: end || undefined,
                bill_rate: rate || undefined,
              },
              { onSuccess: onDone },
            )
          }
        >
          Create extension
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DeploymentRow({ deployment, canWrite }: { deployment: Deployment; canWrite: boolean }) {
  const [action, setAction] = React.useState<'end' | 'extend' | null>(null);
  const live = deployment.status === 'ACTIVE' || deployment.status === 'PENDING_START';

  return (
    <>
      <TableRow>
        <TableCell>
          <Link
            href={`/talent/resources/${deployment.resource_id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {deployment.resource_name ?? 'Unknown consultant'}
          </Link>
          <div className="text-xs text-muted-foreground">{deployment.role_title}</div>
          {isExtension(deployment) ? (
            <div className="mt-1 flex items-center gap-1 text-2xs text-muted-foreground">
              <Link2 className="h-3 w-3" aria-hidden />
              Extension of an earlier deployment
            </div>
          ) : null}
        </TableCell>
        <TableCell>
          <Badge variant={DEPLOYMENT_STATUS_VARIANT[deployment.status]}>
            {DEPLOYMENT_STATUS_LABELS[deployment.status]}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">
          {formatDate(deployment.start_date)}
          <div className="text-xs text-muted-foreground">
            to {formatDate(deployment.effective_end)}
          </div>
        </TableCell>
        <TableCell>
          {live ? (
            <Badge variant={runwayVariant(deployment.days_remaining)}>
              {runwayLabel(deployment.days_remaining)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right text-sm tabular">
          {deployment.bill_rate
            ? formatMoney(deployment.bill_rate, deployment.bill_currency)
            : deployment.restricted_fields.includes('bill_rate')
              ? 'hidden'
              : '—'}
        </TableCell>
        <TableCell className="text-right">
          {canWrite && live ? (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAction(action === 'extend' ? null : 'extend')}
              >
                <Repeat aria-hidden />
                Extend
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAction(action === 'end' ? null : 'end')}
              >
                <Square aria-hidden />
                End
              </Button>
            </div>
          ) : null}
        </TableCell>
      </TableRow>

      {action ? (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/20">
            {action === 'end' ? (
              <EndForm deployment={deployment} onDone={() => setAction(null)} />
            ) : (
              <ExtendForm deployment={deployment} onDone={() => setAction(null)} />
            )}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function Deployments({ endingSoon = false }: { endingSoon?: boolean } = {}) {
  const can = useAuthStore((state) => state.can);
  const [status, setStatus] = React.useState<DeploymentStatus | ''>(endingSoon ? '' : 'ACTIVE');
  const [daysAhead, setDaysAhead] = React.useState(90);

  const all = useDeployments({ status: endingSoon ? '' : status });
  const ending = useEndingSoon(daysAhead);

  if (!can('deployment:read')) return <PermissionDeniedState />;

  const canWrite = can('deployment:write');
  const query = endingSoon ? ending : all;
  const rows: Deployment[] = endingSoon
    ? (ending.data ?? []).map((row) => ({ ...row.deployment, days_remaining: row.days_remaining }))
    : (all.data ?? []);

  const urgent = endingSoon ? rows.filter((row) => (row.days_remaining ?? 999) <= 30).length : 0;

  return (
    <>
      <PageHeader
        title={endingSoon ? 'Deployments Ending Soon' : 'Active Deployments'}
        description={
          endingSoon
            ? 'Consultants approaching the end of an engagement. Each one is a redeployment task before it is an administrative one.'
            : 'Everyone currently deployed and billing, with the rates the engagement was agreed at.'
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          {endingSoon ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Look ahead</span>
              <Select
                value={String(daysAhead)}
                onChange={(event) => setDaysAhead(Number(event.target.value))}
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
              </Select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as DeploymentStatus | '')}
              >
                <option value="">All statuses</option>
                {(
                  ['ACTIVE', 'PENDING_START', 'ON_HOLD', 'ENDED'] as DeploymentStatus[]
                ).map((value) => (
                  <option key={value} value={value}>
                    {DEPLOYMENT_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </CardContent>
      </Card>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <TableLoadingState rows={5} columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            endingSoon
              ? `Nobody rolls off in the next ${daysAhead} days`
              : 'No deployments yet'
          }
          description={
            endingSoon
              ? 'That is the state the redeployment engine exists to maintain.'
              : 'A deployment is created when a selected candidate is placed. Take a submission to SELECTED first.'
          }
          action={
            endingSoon ? undefined : (
              <Button asChild>
                <Link href="/sales/submissions">Go to submissions</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {endingSoon && urgent > 0 ? (
            <InlineWarning>
              <strong className="tabular">{urgent}</strong> deployment
              {urgent === 1 ? '' : 's'} end within 30 days.{' '}
              <Link
                href="/deployments/redeployment"
                className="font-medium underline underline-offset-4"
              >
                Open the redeployment radar
              </Link>{' '}
              to find their next seat.
            </InlineWarning>
          ) : null}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Runway</TableHead>
                    <TableHead className="text-right">Bill rate</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((deployment) => (
                    <DeploymentRow
                      key={deployment.id}
                      deployment={deployment}
                      canWrite={canWrite}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <CalendarClock className="h-3 w-3" aria-hidden />
            Rates shown are the ones this engagement was agreed at — a later renegotiation creates
            an extension rather than rewriting history.
          </p>
        </div>
      )}
    </>
  );
}
