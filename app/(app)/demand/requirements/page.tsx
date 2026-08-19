'use client';

import { Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
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
import { useRequirements, type RequirementQuery } from '@/hooks/use-requirements';
import { useAuthStore } from '@/lib/auth-store';
import {
  DEADLINE_LABELS,
  DEADLINE_VARIANT,
  PRIORITY_SOURCE_LABELS,
  PRIORITY_SOURCE_ORDER,
  REQUIREMENT_STATUS_ORDER,
  REQUIREMENT_STATUS_VARIANT,
  formatRateRange,
} from '@/lib/demand';
import { humanizeEnum } from '@/lib/format';
import type { PrioritySource, RequirementStatus } from '@/types/demand';

const EMPTY_QUERY: RequirementQuery = {
  page: 1,
  page_size: 25,
  q: '',
  status: '',
  priority_source: '',
  review_status: '',
};

export default function RequirementsPage() {
  const can = useAuthStore((state) => state.can);
  const [query, setQuery] = React.useState<RequirementQuery>(EMPTY_QUERY);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => setQuery((q) => ({ ...q, q: search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const requirements = useRequirements(query);

  if (!can('requirement:read')) return <PermissionDeniedState />;

  const isFiltered = Boolean(query.q || query.status || query.priority_source || query.review_status);
  const pendingReview = requirements.data?.items.filter((item) => item.needs_review).length ?? 0;

  return (
    <>
      <PageHeader
        title="Requirements"
        description="Every IT resource requirement Glimmora is tracking, in pursuit-priority order. P1 is an existing customer; P5 usually carries a 24–48 hour submission window."
        actions={
          can('jd:parse') ? (
            <Button asChild>
              <Link href="/demand/requirements/new">
                <Plus aria-hidden />
                Add requirement
              </Link>
            </Button>
          ) : undefined
        }
      />

      {pendingReview > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-warning/40 bg-warning/5 p-3">
          <Sparkles className="h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span className="text-sm">
            <strong className="tabular">{pendingReview}</strong> parsed requirement
            {pendingReview === 1 ? '' : 's'} awaiting review. Until reviewed, they are not usable by
            matching.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setQuery((q) => ({ ...q, review_status: 'PENDING_REVIEW', page: 1 }))
            }
          >
            Show only these
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              placeholder="Search title, role or description…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
              aria-label="Search requirements"
            />
            <Select
              value={query.status ?? ''}
              onChange={(event) =>
                setQuery((q) => ({
                  ...q,
                  status: event.target.value as RequirementStatus | '',
                  page: 1,
                }))
              }
              className="max-w-[12rem]"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {REQUIREMENT_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {humanizeEnum(status)}
                </option>
              ))}
            </Select>
            <Select
              value={query.priority_source ?? ''}
              onChange={(event) =>
                setQuery((q) => ({
                  ...q,
                  priority_source: event.target.value as PrioritySource | '',
                  page: 1,
                }))
              }
              className="max-w-[18rem]"
              aria-label="Filter by demand source"
            >
              <option value="">All sources</option>
              {PRIORITY_SOURCE_ORDER.map((source) => (
                <option key={source} value={source}>
                  {PRIORITY_SOURCE_LABELS[source]}
                </option>
              ))}
            </Select>
            <Select
              value={query.review_status ?? ''}
              onChange={(event) =>
                setQuery((q) => ({
                  ...q,
                  review_status: event.target.value as RequirementQuery['review_status'],
                  page: 1,
                }))
              }
              className="max-w-[14rem]"
              aria-label="Filter by review state"
            >
              <option value="">Reviewed and unreviewed</option>
              <option value="PENDING_REVIEW">Awaiting review</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </div>

          {requirements.isLoading ? (
            <TableLoadingState rows={6} columns={6} />
          ) : requirements.isError ? (
            <ErrorState error={requirements.error} onRetry={() => void requirements.refetch()} />
          ) : requirements.data && requirements.data.items.length === 0 ? (
            isFiltered ? (
              <NoResultsState
                onClear={() => {
                  setSearch('');
                  setQuery(EMPTY_QUERY);
                }}
              />
            ) : (
              <EmptyState
                title="No requirements yet"
                description="Paste a job description and the platform will extract the structured fields for you to review."
                action={
                  can('jd:parse') ? (
                    <Button asChild>
                      <Link href="/demand/requirements/new">Add the first requirement</Link>
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.data?.items.map((requirement) => (
                  <TableRow key={requirement.id}>
                    <TableCell>
                      <Link
                        href={`/demand/requirements/${requirement.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {requirement.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[
                          requirement.account_name,
                          requirement.location,
                          requirement.positions > 1 ? `${requirement.positions} positions` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">
                        {requirement.priority_source.split('_')[0]}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={REQUIREMENT_STATUS_VARIANT[requirement.status]}>
                          {humanizeEnum(requirement.status)}
                        </Badge>
                        {requirement.needs_review && (
                          <Badge variant="warning">Awaiting review</Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      {requirement.deadline ? (
                        <>
                          <Badge variant={DEADLINE_VARIANT[requirement.deadline.state]}>
                            {DEADLINE_LABELS[requirement.deadline.state]}
                          </Badge>
                          <div className="mt-0.5 text-2xs text-muted-foreground tabular">
                            {requirement.deadline.label}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex max-w-[16rem] flex-wrap gap-1">
                        {requirement.skills.slice(0, 3).map((skill) => (
                          <Badge key={skill.id} variant="muted">
                            {skill.name}
                          </Badge>
                        ))}
                        {requirement.skills.length > 3 && (
                          <Badge variant="muted">+{requirement.skills.length - 3}</Badge>
                        )}
                        {requirement.skills.length === 0 && (
                          <span className="text-xs text-muted-foreground">Not recorded</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-xs tabular">
                      {formatRateRange(
                        requirement.rate_min,
                        requirement.rate_max,
                        requirement.rate_currency,
                        requirement.rate_unit,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {requirements.data && requirements.data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {requirements.data.page} of {requirements.data.pages} ·{' '}
                {requirements.data.total} requirements
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={requirements.data.page <= 1}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={requirements.data.page >= requirements.data.pages}
                  onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
