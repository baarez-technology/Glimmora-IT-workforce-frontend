'use client';

import { AlertTriangle, Briefcase, ChevronDown, Send, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { DeployForm } from '@/components/pipeline/deploy-dialog';
import {
  EmptyState,
  ErrorState,
  NoResultsState,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  useChangeSubmissionStatus,
  useCreateSubmission,
  useDuplicateCheck,
  useSubmissionHistory,
  useSubmissions,
} from '@/hooks/use-pipeline';
import { useRequirements } from '@/hooks/use-requirements';
import { useResources } from '@/hooks/use-talent';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import {
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_VARIANT,
  duplicateMessage,
} from '@/lib/pipeline';
import { cn } from '@/lib/utils';
import type { Submission, SubmissionStatus } from '@/types/pipeline';

/**
 * Submissions — the unit of candidate.
 *
 * The screen is built around one guarantee: you cannot put the same consultant
 * forward twice for the same requirement while a live submission exists. The
 * check runs *before* the user commits, because discovering a duplicate on
 * submit means they have already told the client somebody was coming.
 */

const STATUS_ORDER: SubmissionStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'SHORTLISTED',
  'INTERVIEW',
  'SELECTED',
  'ON_HOLD',
  'REJECTED',
  'WITHDRAWN',
];

function SubmitForm() {
  const [requirementId, setRequirementId] = React.useState('');
  const [resourceId, setResourceId] = React.useState('');
  const [rate, setRate] = React.useState('');

  const requirements = useRequirements({ page: 1, page_size: 100, open_only: true });
  const resources = useResources({ page: 1, page_size: 100 });
  const duplicate = useDuplicateCheck(requirementId || undefined, resourceId || undefined);
  const create = useCreateSubmission();

  const isDuplicate = Boolean(duplicate.data?.is_duplicate);
  const ready = Boolean(requirementId && resourceId) && !isDuplicate;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Put a consultant forward</CardTitle>
        <CardDescription>
          The duplicate check runs as soon as both are chosen — before you commit, not after.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="submit-requirement">Requirement</Label>
            <Select
              id="submit-requirement"
              value={requirementId}
              onChange={(event) => setRequirementId(event.target.value)}
            >
              <option value="">Select…</option>
              {requirements.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="submit-resource">Consultant</Label>
            <Select
              id="submit-resource"
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
            >
              <option value="">Select…</option>
              {resources.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="submit-rate">Proposed rate (monthly)</Label>
            <Input
              id="submit-rate"
              type="number"
              min={0}
              placeholder="Optional"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </div>
        </div>

        {isDuplicate && duplicate.data ? (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3"
            role="alert"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">Already submitted</p>
              <p className="mt-0.5 text-muted-foreground">{duplicateMessage(duplicate.data)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Withdraw or close the existing submission first if the situation has changed.
              </p>
            </div>
          </div>
        ) : null}

        {create.isError ? <ErrorState error={create.error} /> : null}

        <Button
          disabled={!ready || create.isPending}
          loading={create.isPending}
          onClick={() =>
            create.mutate(
              {
                requirement_id: requirementId,
                resource_id: resourceId,
                status: 'SUBMITTED',
                ...(rate
                  ? {
                      proposed_bill_rate: rate,
                      proposed_bill_currency: 'QAR',
                      proposed_bill_unit: 'MONTHLY',
                    }
                  : {}),
              },
              {
                onSuccess: () => {
                  setResourceId('');
                  setRate('');
                },
              },
            )
          }
        >
          <Send aria-hidden />
          Submit candidate
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusForm({ submission, onDone }: { submission: Submission; onDone: () => void }) {
  const [status, setStatus] = React.useState<SubmissionStatus>('SHORTLISTED');
  const [note, setNote] = React.useState('');
  const change = useChangeSubmissionStatus(submission.id);

  const needsReason = status === 'REJECTED';

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`status-${submission.id}`}>New status</Label>
          <Select
            id={`status-${submission.id}`}
            value={status}
            onChange={(event) => setStatus(event.target.value as SubmissionStatus)}
          >
            {STATUS_ORDER.filter((value) => value !== submission.status).map((value) => (
              <option key={value} value={value}>
                {SUBMISSION_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`note-${submission.id}`}>
            {needsReason ? 'Rejection reason (required)' : 'Note or client feedback'}
          </Label>
          <Input
            id={`note-${submission.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={needsReason ? 'Why did the client decline?' : 'Optional'}
            aria-invalid={needsReason && !note.trim()}
          />
        </div>
      </div>

      {needsReason ? (
        <p className="text-xs text-muted-foreground">
          A rejection reason is the most useful feedback the pipeline produces — it is what
          sharpens the next submission.
        </p>
      ) : null}

      {change.isError ? <ErrorState error={change.error} /> : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={change.isPending || (needsReason && !note.trim())}
          onClick={() =>
            change.mutate(
              {
                status,
                ...(needsReason
                  ? { rejection_reason: note.trim() }
                  : note.trim()
                    ? { client_feedback: note.trim() }
                    : {}),
              },
              { onSuccess: onDone },
            )
          }
        >
          Save status
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function SubmissionRow({
  submission,
  canWrite,
  canDeploy,
}: {
  submission: Submission;
  canWrite: boolean;
  canDeploy: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [deploying, setDeploying] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const history = useSubmissionHistory(showHistory ? submission.id : undefined);

  // The pipeline hands over to delivery here, and only here.
  //
  // A submission stays SELECTED after it is deployed, so status alone would
  // keep offering Deploy on a consultant who is already placed — a button that
  // can only ever return 409. `deployment_id` is what actually decides it.
  const deployed = submission.deployment_id !== null;
  const deployable = canDeploy && submission.status === 'SELECTED' && !deployed;

  return (
    <>
      <TableRow>
        <TableCell>
          <Link
            href={`/talent/resources/${submission.resource_id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {submission.resource_name ?? 'Unknown consultant'}
          </Link>
          {submission.interview_count > 0 ? (
            <div className="text-2xs text-muted-foreground">
              {submission.interview_count} interview
              {submission.interview_count === 1 ? '' : 's'}
            </div>
          ) : null}
        </TableCell>
        <TableCell className="text-sm">
          <Link
            href={`/demand/requirements/${submission.requirement_id}`}
            className="underline-offset-4 hover:underline"
          >
            {submission.requirement_title ?? '—'}
          </Link>
        </TableCell>
        <TableCell>
          <Badge variant={SUBMISSION_STATUS_VARIANT[submission.status]}>
            {SUBMISSION_STATUS_LABELS[submission.status]}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">{formatDate(submission.submitted_at)}</TableCell>
        <TableCell className="text-right text-sm tabular">
          {submission.proposed_bill_rate
            ? formatMoney(submission.proposed_bill_rate, submission.proposed_bill_currency ?? 'QAR')
            : submission.restricted_fields.length > 0
              ? 'hidden'
              : '—'}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            {deployable ? (
              <Button size="sm" onClick={() => setDeploying((value) => !value)}>
                <Briefcase aria-hidden />
                Deploy
              </Button>
            ) : deployed ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/deployments/active?resource=${submission.resource_id}`}>
                  <Briefcase aria-hidden />
                  View deployment
                </Link>
              </Button>
            ) : null}
            {canWrite ? (
              <Button variant="outline" size="sm" onClick={() => setEditing((value) => !value)}>
                Update
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((value) => !value)}
              aria-expanded={showHistory}
            >
              <ChevronDown
                aria-hidden
                className={cn('transition-transform', showHistory && 'rotate-180')}
              />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {editing || showHistory || deploying ? (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/20">
            <div className="space-y-3">
              {deploying ? (
                <DeployForm submission={submission} onDone={() => setDeploying(false)} />
              ) : null}
              {editing ? (
                <StatusForm submission={submission} onDone={() => setEditing(false)} />
              ) : null}

              {submission.client_feedback ? (
                <p className="text-sm">
                  <span className="font-medium">Client feedback:</span>{' '}
                  {submission.client_feedback}
                </p>
              ) : null}
              {submission.rejection_reason ? (
                <p className="text-sm text-destructive">
                  <span className="font-medium">Rejected:</span> {submission.rejection_reason}
                </p>
              ) : null}

              {showHistory ? (
                history.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : (
                  <ol className="space-y-1 text-xs text-muted-foreground">
                    {history.data?.map((entry, index) => (
                      <li key={`${entry.created_at}-${index}`}>
                        {entry.from_status
                          ? `${SUBMISSION_STATUS_LABELS[entry.from_status]} → `
                          : ''}
                        <span className="font-medium text-foreground">
                          {SUBMISSION_STATUS_LABELS[entry.to_status]}
                        </span>{' '}
                        · {formatDateTime(entry.created_at)}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </li>
                    ))}
                  </ol>
                )
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function Submissions() {
  const can = useAuthStore((state) => state.can);
  const [status, setStatus] = React.useState<SubmissionStatus | ''>('');

  const submissions = useSubmissions({ status: status || undefined });

  if (!can('submission:read')) return <PermissionDeniedState />;

  const canWrite = can('submission:write');
  const canDeploy = can('deployment:write');
  const rows = submissions.data ?? [];

  return (
    <>
      <PageHeader
        title="Submissions"
        description="Every CV Glimmora has put in front of a client, with duplicate protection so the same consultant is never sent twice for the same seat."
      />

      {canWrite ? (
        <div className="mb-4">
          <SubmitForm />
        </div>
      ) : null}

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as SubmissionStatus | '')}
            >
              <option value="">All statuses</option>
              {STATUS_ORDER.map((value) => (
                <option key={value} value={value}>
                  {SUBMISSION_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
          {status ? (
            <Button variant="ghost" size="sm" onClick={() => setStatus('')}>
              Clear filter
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {submissions.isError ? (
        <ErrorState error={submissions.error} onRetry={() => void submissions.refetch()} />
      ) : submissions.isLoading ? (
        <TableLoadingState rows={5} columns={6} />
      ) : rows.length === 0 ? (
        status ? (
          <NoResultsState onClear={() => setStatus('')} />
        ) : (
          <EmptyState
            title="No CVs have been submitted yet"
            description="Run matching on a requirement, then put the best candidate forward. The submission opens the opportunity automatically."
            action={
              <Button asChild>
                <Link href="/intelligence/matching">Go to matching</Link>
              </Button>
            }
          />
        )
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Proposed rate</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((submission) => (
                  <SubmissionRow
                    key={submission.id}
                    submission={submission}
                    canWrite={canWrite}
                    canDeploy={canDeploy}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-2xs text-muted-foreground">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        A withdrawn or rejected candidate can be resubmitted — circumstances change. Only a live
        submission holds the seat.
      </p>
    </>
  );
}
