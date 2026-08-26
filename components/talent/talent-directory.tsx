'use client';

import { FileUp, ShieldAlert, TriangleAlert, UserPlus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { CVUploadDialog } from '@/components/talent/cv-upload-dialog';
import { ResourceFormDialog } from '@/components/talent/resource-form-dialog';
import {
  EmptyState,
  ErrorState,
  NoResultsState,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAvailableResources, useResources, type ResourceQuery } from '@/hooks/use-talent';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/format';
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_ORDER,
  AVAILABILITY_VARIANT,
  EXPIRY_VARIANT,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_ORDER,
  formatExperience,
  formatRate,
} from '@/lib/talent';
import type { AvailabilityStatus, ResourceType } from '@/types/talent';

const EMPTY_QUERY: ResourceQuery = {
  page: 1,
  page_size: 25,
  q: '',
  resource_type: '',
  availability_status: '',
};

/**
 * One screen, three lists.
 *
 * `bench` and `available` are different questions and were previously the same
 * one: both pages passed benchOnly, so "Available" showed the bench under a
 * heading promising something else. The bench is unbilled capacity; available
 * is who can start within a window, which the API works out from notice period
 * as well as end date.
 */
export function TalentDirectory({
  mode = 'all',
}: {
  mode?: 'all' | 'bench' | 'available';
}) {
  const benchOnly = mode === 'bench';
  const can = useAuthStore((state) => state.can);
  const [query, setQuery] = React.useState<ResourceQuery>({
    ...EMPTY_QUERY,
    bench_only: benchOnly || undefined,
  });
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => setQuery((q) => ({ ...q, q: search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [withinDays, setWithinDays] = React.useState(30);

  // Only the list on screen is fetched. Both hooks must be called — rules of
  // hooks — but the one that is not showing stays disabled rather than making
  // a request nobody reads.
  const showAvailable = mode === 'available';
  const listed = useResources(query, { enabled: !showAvailable });
  const available = useAvailableResources(
    { ...query, within_days: withinDays },
    { enabled: showAvailable },
  );
  const resources = showAvailable ? available : listed;

  const [addOpen, setAddOpen] = React.useState(false);
  const [cvOpen, setCvOpen] = React.useState(false);

  if (!can('resource:read')) return <PermissionDeniedState />;

  const canCreate = can('resource:create');
  const canParseCV = can('cv:parse');

  const isFiltered = Boolean(query.q || query.resource_type || query.availability_status);
  const blocked = resources.data?.items.filter((item) => item.blocks_deployment).length ?? 0;

  return (
    <>
      <PageHeader
        title={mode === 'bench' ? 'Bench' : mode === 'available' ? 'Available' : 'Talent Cloud'}
        description={
          mode === 'bench'
            ? 'Unbilled capacity. This is the number the redeployment engine exists to drive to zero.'
            : mode === 'available'
              ? `Who can start within ${withinDays} days, counting notice periods — not the same list as the bench.`
              : 'Every consultant, employee, freelancer and pre-vetted candidate Glimmora can put forward.'
        }
        actions={
          canCreate || canParseCV ? (
            <div className="flex flex-wrap gap-2">
              {canParseCV ? (
                <Button variant="outline" onClick={() => setCvOpen(true)}>
                  <FileUp aria-hidden />
                  Upload a CV
                </Button>
              ) : null}
              {canCreate ? (
                <Button onClick={() => setAddOpen(true)}>
                  <UserPlus aria-hidden />
                  Add consultant
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {blocked > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <span className="text-sm">
            <strong className="tabular">{blocked}</strong> consultant
            {blocked === 1 ? ' has' : 's have'} an expired work authorisation. They cannot be
            deployed or billed until it is renewed.
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/talent/documents">Review documents</Link>
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              placeholder="Search name, headline or code…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
              aria-label="Search resources"
            />
            {mode === 'available' ? (
              <Select
                value={String(withinDays)}
                onChange={(event) => setWithinDays(Number(event.target.value))}
                aria-label="Ready within"
                className="w-[11rem]"
              >
                <option value="7">Ready in 7 days</option>
                <option value="14">Ready in 14 days</option>
                <option value="30">Ready in 30 days</option>
                <option value="60">Ready in 60 days</option>
                <option value="90">Ready in 90 days</option>
              </Select>
            ) : null}
            <Select
              value={query.resource_type ?? ''}
              onChange={(event) =>
                setQuery((q) => ({
                  ...q,
                  resource_type: event.target.value as ResourceType | '',
                  page: 1,
                }))
              }
              className="max-w-[16rem]"
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {RESOURCE_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {RESOURCE_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Select
              value={query.availability_status ?? ''}
              onChange={(event) =>
                setQuery((q) => ({
                  ...q,
                  availability_status: event.target.value as AvailabilityStatus | '',
                  page: 1,
                }))
              }
              className="max-w-[14rem]"
              aria-label="Filter by availability"
            >
              <option value="">Any availability</option>
              {AVAILABILITY_ORDER.map((status) => (
                <option key={status} value={status}>
                  {AVAILABILITY_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>

          {resources.isLoading ? (
            <TableLoadingState rows={6} columns={6} />
          ) : resources.isError ? (
            <ErrorState error={resources.error} onRetry={() => void resources.refetch()} />
          ) : resources.data && resources.data.items.length === 0 ? (
            isFiltered ? (
              <NoResultsState
                onClear={() => {
                  setSearch('');
                  setQuery({ ...EMPTY_QUERY, bench_only: benchOnly || undefined });
                }}
              />
            ) : (
              <EmptyState
                title={
                  mode === 'bench'
                    ? 'Nobody on the bench'
                    : mode === 'available'
                      ? 'Nobody free in this window'
                      : 'No consultants yet'
                }
                description={
                  mode === 'available'
                    ? 'Widen the window, or check the bench for people already unbilled.'
                    : benchOnly
                    ? 'Every consultant is currently deployed or unavailable. That is the goal.'
                    : canParseCV
                      ? 'Upload a CV and the platform will extract a profile for you to review, or enter one by hand.'
                      : 'Nobody with your role can add consultants. Ask Resourcing to build the talent cloud.'
                }
                action={
                  !benchOnly && canParseCV ? (
                    <Button onClick={() => setCvOpen(true)}>
                      <FileUp aria-hidden />
                      Upload a CV
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Work authorisation</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.data?.items.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell>
                      <Link
                        href={`/talent/resources/${resource.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {resource.full_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[
                          resource.headline,
                          resource.current_location_city,
                          formatExperience(resource.total_experience_years),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {resource.needs_review && (
                        <Badge variant="warning" className="mt-1">
                          Awaiting review
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">
                        {RESOURCE_TYPE_LABELS[resource.resource_type]}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={AVAILABILITY_VARIANT[resource.availability_status]}>
                        {AVAILABILITY_LABELS[resource.availability_status]}
                      </Badge>
                      {resource.ready_from && (
                        <div className="mt-0.5 text-2xs text-muted-foreground">
                          ready {formatDate(resource.ready_from)}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {resource.work_authorisation ? (
                        <>
                          <Badge variant={EXPIRY_VARIANT[resource.work_authorisation.state]}>
                            {resource.blocks_deployment && (
                              <TriangleAlert className="h-3 w-3" aria-hidden />
                            )}
                            {resource.work_authorisation.label}
                          </Badge>
                          {resource.blocks_deployment && (
                            <div className="mt-0.5 text-2xs text-destructive">
                              Cannot be billed
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex max-w-[15rem] flex-wrap gap-1">
                        {resource.skills.slice(0, 3).map((skill) => (
                          <Badge key={skill.id} variant="muted">
                            {skill.name}
                          </Badge>
                        ))}
                        {resource.skills.length > 3 && (
                          <Badge variant="muted">+{resource.skills.length - 3}</Badge>
                        )}
                        {resource.skills.length === 0 && (
                          <span className="text-xs text-muted-foreground">Not recorded</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-xs tabular">
                      {/* Absent for roles without the field permission. */}
                      {resource.expected_cost_amount
                        ? formatRate(
                            resource.expected_cost_amount,
                            resource.expected_cost_currency,
                            resource.expected_cost_unit,
                          )
                        : resource.target_billing_amount
                          ? formatRate(
                              resource.target_billing_amount,
                              resource.target_billing_currency,
                              resource.target_billing_unit,
                            )
                          : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {resources.data && resources.data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {resources.data.page} of {resources.data.pages} · {resources.data.total}{' '}
                consultants
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resources.data.page <= 1}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resources.data.page >= resources.data.pages}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ResourceFormDialog open={addOpen} onOpenChange={setAddOpen} />
      <CVUploadDialog open={cvOpen} onOpenChange={setCvOpen} />
    </>
  );
}
