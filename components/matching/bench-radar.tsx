'use client';

import { AlertTriangle, RadarIcon, RefreshCw, ShieldAlert } from 'lucide-react';
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
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBenchRadar, useRunBenchSweep } from '@/hooks/use-matching';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate, formatScore } from '@/lib/format';
import { ROUTE_VARIANT, benchUrgency, rankBench } from '@/lib/matching';
import { cn } from '@/lib/utils';

/**
 * The bench radar.
 *
 * One number on this screen matters more than the rest: **how many people have
 * nowhere identified to go**. Everything else is context. Unbilled capacity
 * with a named next seat is a scheduling task; unbilled capacity with nothing
 * behind it is money leaving the business every day it stays that way.
 */

function Tile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'warning' | 'danger';
  hint: string;
}) {
  return (
    <Card
      className={cn(
        tone === 'warning' && 'border-warning/40',
        tone === 'danger' && 'border-destructive/40',
      )}
    >
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={cn(
            'mt-1 text-3xl font-semibold tabular',
            tone === 'warning' && 'text-warning',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {value}
        </div>
        <p className="mt-1 text-2xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function BenchRadar() {
  const can = useAuthStore((state) => state.can);
  const [daysAhead, setDaysAhead] = React.useState(90);

  const radar = useBenchRadar(daysAhead);
  const sweep = useRunBenchSweep();

  if (!can('reverse_matching:read')) return <PermissionDeniedState />;

  const canRun = can('reverse_matching:run');
  const rows = rankBench(radar.data?.rows ?? []);

  return (
    <>
      <PageHeader
        title="Redeployment Radar"
        description="Everyone on the bench or heading for it, soonest first. The engine looks 90/60/30/15/7 days ahead of a consultant coming free and alerts Resourcing before the bench starts costing money."
        actions={
          canRun ? (
            <Button
              variant="outline"
              onClick={() => sweep.mutate()}
              disabled={sweep.isPending}
              title="Normally runs automatically each morning"
            >
              {sweep.isPending ? <RefreshCw className="animate-spin" aria-hidden /> : <RadarIcon aria-hidden />}
              Run sweep now
            </Button>
          ) : undefined
        }
      />

      {radar.isError ? (
        <ErrorState error={radar.error} onRetry={() => void radar.refetch()} />
      ) : radar.isLoading ? (
        <TableLoadingState rows={6} columns={5} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Tile
              label="Approaching or on the bench"
              value={radar.data?.total ?? 0}
              tone="neutral"
              hint={`Within the next ${daysAhead} days`}
            />
            <Tile
              label="Unbilled right now"
              value={radar.data?.on_bench_now ?? 0}
              tone={radar.data?.on_bench_now ? 'warning' : 'neutral'}
              hint="Available today and not generating revenue"
            />
            <Tile
              label="Nowhere identified to go"
              value={radar.data?.without_a_suggestion ?? 0}
              tone={radar.data?.without_a_suggestion ? 'danger' : 'neutral'}
              hint="The number this engine exists to drive to zero"
            />
          </div>

          {sweep.isError ? <ErrorState error={sweep.error} /> : null}
          {sweep.isSuccess ? (
            <InlineWarning>
              Sweep complete: {sweep.data.examined} consultants examined, {sweep.data.raised} new
              alerts raised, {sweep.data.skipped_duplicate} milestones already notified. A milestone
              alerts once — not every morning until the consultant rolls off.
            </InlineWarning>
          ) : null}

          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
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
            </CardContent>
          </Card>

          {rows.length === 0 ? (
            <EmptyState
              title="Nobody is approaching the bench"
              description={`No consultant becomes available in the next ${daysAhead} days. That is the state this engine exists to maintain.`}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Consultant</TableHead>
                      <TableHead>Free from</TableHead>
                      <TableHead>Runway</TableHead>
                      <TableHead>Best next seat</TableHead>
                      <TableHead className="text-right">Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const urgency = benchUrgency(row.days_until_available);
                      return (
                        <TableRow key={row.resource_id}>
                          <TableCell>
                            <Link
                              href={`/talent/resources/${row.resource_id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {row.resource_name}
                            </Link>
                            {row.headline ? (
                              <div className="text-xs text-muted-foreground">{row.headline}</div>
                            ) : null}
                            {row.blocks_deployment ? (
                              <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                                <ShieldAlert className="h-3 w-3" aria-hidden />
                                Work authorisation blocks deployment
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(row.available_from)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={urgency.variant}>{urgency.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {row.top_suggestion ? (
                              <>
                                <Link
                                  href={`/demand/requirements/${row.top_suggestion.requirement_id}`}
                                  className="text-sm underline-offset-4 hover:underline"
                                >
                                  {row.top_suggestion.requirement_title}
                                </Link>
                                <div className="mt-1">
                                  <Badge
                                    variant={ROUTE_VARIANT[row.top_suggestion.route.route_type]}
                                  >
                                    {row.top_suggestion.route.label}
                                  </Badge>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5 text-sm text-destructive">
                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                                <span>Nothing identified</span>
                                <Button variant="link" size="sm" asChild className="h-auto p-0">
                                  <Link
                                    href={`/intelligence/reverse-matching?resource=${row.resource_id}`}
                                  >
                                    Search now
                                  </Link>
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular">
                            {row.top_suggestion
                              ? formatScore(row.top_suggestion.priority_score)
                              : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
