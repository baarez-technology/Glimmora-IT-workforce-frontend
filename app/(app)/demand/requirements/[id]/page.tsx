'use client';

import { ArrowLeft, GitBranch, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { ParseReview } from '@/components/demand/parse-review';
import { RequirementStatusForm } from '@/components/demand/status-form';
import { RequirementScore } from '@/components/scoring/opportunity-board';
import { PageHeader } from '@/components/layout/page-header';
import {
  CardLoadingState,
  ErrorState,
  InlineWarning,
  PermissionDeniedState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRequirement, useRequirementHistory } from '@/hooks/use-requirements';
import { useAuthStore } from '@/lib/auth-store';
import {
  CONTRACT_TYPE_LABELS,
  DEADLINE_LABELS,
  DEADLINE_VARIANT,
  PRIORITY_SOURCE_LABELS,
  REQUIREMENT_STATUS_VARIANT,
  SKILL_IMPORTANCE_VARIANT,
  SOURCE_LABELS,
  formatRateRange,
} from '@/lib/demand';
import { formatDate, formatDateTime, humanizeEnum } from '@/lib/format';

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const requirementId = params?.id;
  const can = useAuthStore((state) => state.can);

  const requirement = useRequirement(requirementId);
  const history = useRequirementHistory(requirementId);
  const [statusOpen, setStatusOpen] = React.useState(false);

  if (!can('requirement:read')) return <PermissionDeniedState />;

  if (requirement.isLoading) {
    return (
      <>
        <PageHeader title="Requirement" />
        <CardLoadingState count={3} />
      </>
    );
  }

  if (requirement.isError) {
    return (
      <>
        <PageHeader title="Requirement" />
        <ErrorState error={requirement.error} onRetry={() => void requirement.refetch()} />
      </>
    );
  }

  const data = requirement.data;
  if (!data) return null;

  const defaultTab = searchParams.get('tab') === 'review' && data.needs_review ? 'review' : 'overview';

  return (
    <>
      <Link
        href="/demand/requirements"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All requirements
      </Link>

      <PageHeader
        title={data.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={REQUIREMENT_STATUS_VARIANT[data.status]}>
              {humanizeEnum(data.status)}
            </Badge>
            <Badge variant="outline">{PRIORITY_SOURCE_LABELS[data.priority_source]}</Badge>
            {data.deadline && (
              <Badge variant={DEADLINE_VARIANT[data.deadline.state]}>
                {DEADLINE_LABELS[data.deadline.state]} · {data.deadline.label}
              </Badge>
            )}
            {[data.role, data.account_name, data.location].filter(Boolean).join(' · ')}
          </span>
        }
        actions={
          can('requirement:update') ? (
            <Button variant="outline" onClick={() => setStatusOpen((value) => !value)}>
              <GitBranch aria-hidden />
              Change status
            </Button>
          ) : undefined
        }
      />

      {statusOpen && can('requirement:update') ? (
        <div className="mb-4">
          <RequirementStatusForm requirement={data} onDone={() => setStatusOpen(false)} />
        </div>
      ) : null}

      {data.needs_review && defaultTab !== 'review' && (
        <div className="mb-4">
          <InlineWarning>
            This requirement was extracted from a job description and has not been reviewed yet. It
            is excluded from matching until you accept the fields.
          </InlineWarning>
        </div>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {data.needs_review && (
            <TabsTrigger value="review">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Review extraction
            </TabsTrigger>
          )}
          {can('scoring:read') ? <TabsTrigger value="score">Score</TabsTrigger> : null}
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Requirement details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Detail label="Role" value={data.role} />
                <Detail label="Positions" value={String(data.positions)} />
                <Detail label="Location" value={data.location} />
                <Detail label="Work mode" value={data.work_mode && humanizeEnum(data.work_mode)} />
                <Detail
                  label="Contract type"
                  value={data.contract_type ? CONTRACT_TYPE_LABELS[data.contract_type] : null}
                />
                <Detail
                  label="Duration"
                  value={data.duration_months ? `${data.duration_months} months` : null}
                />
                <Detail
                  label="Experience"
                  value={
                    data.experience_min_years
                      ? `${data.experience_min_years}${
                          data.experience_max_years ? `–${data.experience_max_years}` : '+'
                        } years`
                      : null
                  }
                />
                <Detail label="Start by" value={formatDate(data.start_by_date)} />
                <Detail label="Availability" value={data.availability_requirement} />
                <Detail
                  label="Rate"
                  value={formatRateRange(
                    data.rate_min,
                    data.rate_max,
                    data.rate_currency,
                    data.rate_unit,
                  )}
                />
                <Detail label="Owner" value={data.owner_name} />
                <Detail label="Route" value={data.route_account_name} />

                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Skills</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.skills.length > 0 ? (
                      data.skills.map((skill) => (
                        <Badge key={skill.id} variant={SKILL_IMPORTANCE_VARIANT[skill.importance]}>
                          {skill.name}
                          {skill.importance === 'PREFERRED' ? ' (preferred)' : ''}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        None recorded — matching will have nothing to work with.
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Provenance</CardTitle>
                  <CardDescription>Where this record came from</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Detail label="Intake" value={SOURCE_LABELS[data.source]} />
                  <Detail label="Detail" value={data.source_detail} />
                  <Detail
                    label="Review state"
                    value={humanizeEnum(data.review_status)}
                  />
                  {data.parse_model && (
                    <>
                      <Detail label="Parser" value={data.parse_model} />
                      <Detail
                        label="Confidence"
                        value={
                          data.parse_confidence !== null
                            ? `${Math.round(data.parse_confidence * 100)}%`
                            : null
                        }
                      />
                      <Detail label="Parsed" value={formatDateTime(data.parsed_at)} />
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {data.needs_review && requirementId && (
          <TabsContent value="review">
            <ParseReview requirementId={requirementId} />
          </TabsContent>
        )}

        {can('scoring:read') && requirementId ? (
          <TabsContent value="score">
            <RequirementScore requirementId={requirementId} />
          </TabsContent>
        ) : null}

        <TabsContent value="source">
          <Card>
            <CardHeader>
              <CardTitle>Source text</CardTitle>
              <CardDescription>
                Kept verbatim so any extracted value can be traced back to it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.description_raw ? (
                <pre className="scrollbar-thin max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 font-sans text-sm leading-relaxed">
                  {data.description_raw}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This requirement was entered by hand, so there is no source document.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-5">
              {history.data && history.data.length > 0 ? (
                <ul className="divide-y">
                  {history.data.map((entry) => (
                    <li key={entry.id} className="py-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {entry.from_status && (
                          <>
                            <span className="text-muted-foreground">
                              {humanizeEnum(entry.from_status)}
                            </span>
                            <span aria-hidden>→</span>
                          </>
                        )}
                        <Badge variant={REQUIREMENT_STATUS_VARIANT[entry.to_status]}>
                          {humanizeEnum(entry.to_status)}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(entry.created_at)}
                        {entry.user_name ? ` · ${entry.user_name}` : ''}
                        {entry.reason ? ` · ${entry.reason}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value || '—'}</div>
    </div>
  );
}
