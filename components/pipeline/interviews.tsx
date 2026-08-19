'use client';

import { BellRing, CalendarClock, CalendarPlus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import {
  EmptyState,
  ErrorState,
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
  useInterviews,
  useRecordInterviewOutcome,
  useScheduleInterview,
  useSubmissions,
} from '@/hooks/use-pipeline';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatRelative } from '@/lib/format';
import { OUTCOME_LABELS, OUTCOME_VARIANT, SUBMISSION_STATUS_LABELS } from '@/lib/pipeline';
import type { Interview, InterviewOutcome } from '@/types/pipeline';

/**
 * Lightweight interview scheduling (SOW section 10 NEW).
 *
 * Deliberately lightweight: this is not a calendar product. Scheduling records
 * the round, moves the submission and the opportunity, and raises exactly one
 * reminder — deduped per interview, so a rescheduled round does not spam the
 * owner.
 */

const MODES = ['VIDEO', 'PHONE', 'ONSITE', 'TECHNICAL_TEST'] as const;

const OUTCOMES: InterviewOutcome[] = [
  'COMPLETED',
  'PASSED',
  'FAILED',
  'NO_SHOW',
  'RESCHEDULED',
  'CANCELLED',
];

function ScheduleForm() {
  const [submissionId, setSubmissionId] = React.useState('');
  const [when, setWhen] = React.useState('');
  const [mode, setMode] = React.useState<string>('VIDEO');
  const [interviewer, setInterviewer] = React.useState('');

  // Only live submissions can be interviewed; a rejected candidate cannot.
  const submissions = useSubmissions();
  const schedule = useScheduleInterview();

  const eligible = (submissions.data ?? []).filter((item) =>
    ['SUBMITTED', 'SHORTLISTED', 'INTERVIEW', 'ON_HOLD'].includes(item.status),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-muted-foreground" aria-hidden />
          Schedule an interview
        </CardTitle>
        <CardDescription>
          Moves the submission to interviewing, pulls the opportunity forward, and raises one
          reminder for the owner.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="interview-submission">Candidate</Label>
            <Select
              id="interview-submission"
              value={submissionId}
              onChange={(event) => setSubmissionId(event.target.value)}
            >
              <option value="">Select a live submission…</option>
              {eligible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.resource_name} — {item.requirement_title} (
                  {SUBMISSION_STATUS_LABELS[item.status]})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interview-when">Date and time</Label>
            <Input
              id="interview-when"
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interview-mode">Mode</Label>
            <Select
              id="interview-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              {MODES.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="interview-interviewer">Interviewer</Label>
            <Input
              id="interview-interviewer"
              value={interviewer}
              placeholder="Optional"
              onChange={(event) => setInterviewer(event.target.value)}
            />
          </div>
        </div>

        {eligible.length === 0 && !submissions.isLoading ? (
          <p className="text-xs text-muted-foreground">
            No live submissions to interview. Put a candidate forward first.
          </p>
        ) : null}

        {schedule.isError ? <ErrorState error={schedule.error} /> : null}

        <Button
          disabled={!submissionId || !when || schedule.isPending}
          loading={schedule.isPending}
          onClick={() =>
            schedule.mutate(
              {
                submission_id: submissionId,
                // datetime-local has no zone; the browser's offset is the
                // user's intent, so convert rather than sending naive text.
                scheduled_at: new Date(when).toISOString(),
                mode,
                ...(interviewer.trim() ? { interviewer_name: interviewer.trim() } : {}),
              },
              {
                onSuccess: () => {
                  setWhen('');
                  setInterviewer('');
                },
              },
            )
          }
        >
          Schedule
        </Button>
      </CardContent>
    </Card>
  );
}

function OutcomeForm({ interview, onDone }: { interview: Interview; onDone: () => void }) {
  const [outcome, setOutcome] = React.useState<InterviewOutcome>('COMPLETED');
  const [feedback, setFeedback] = React.useState('');
  const record = useRecordInterviewOutcome(interview.id);

  return (
    <div className="mt-3 space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`outcome-${interview.id}`}>Outcome</Label>
          <Select
            id={`outcome-${interview.id}`}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as InterviewOutcome)}
          >
            {OUTCOMES.map((value) => (
              <option key={value} value={value}>
                {OUTCOME_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`feedback-${interview.id}`}>Feedback</Label>
          <Input
            id={`feedback-${interview.id}`}
            value={feedback}
            placeholder="What did the client say?"
            onChange={(event) => setFeedback(event.target.value)}
          />
        </div>
      </div>

      {outcome === 'PASSED' ? (
        <p className="text-xs text-muted-foreground">
          Passing moves the candidate to selected.
        </p>
      ) : outcome === 'FAILED' ? (
        <p className="text-xs text-muted-foreground">
          A failed round does not close the submission — you decide whether to reject or hold.
        </p>
      ) : null}

      {record.isError ? <ErrorState error={record.error} /> : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={record.isPending}
          onClick={() =>
            record.mutate(
              { outcome, feedback: feedback.trim() || undefined },
              { onSuccess: onDone },
            )
          }
        >
          Record outcome
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function InterviewCard({ interview, canWrite }: { interview: Interview; canWrite: boolean }) {
  const [recording, setRecording] = React.useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{interview.resource_name ?? 'Candidate'}</span>
              <Badge variant="outline">Round {interview.round_number}</Badge>
              <Badge variant={OUTCOME_VARIANT[interview.outcome]}>
                {OUTCOME_LABELS[interview.outcome]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {interview.mode.replace(/_/g, ' ').toLowerCase()} ·{' '}
              {formatDateTime(interview.scheduled_at)} ({formatRelative(interview.scheduled_at)}) ·{' '}
              {interview.duration_minutes} min
              {interview.interviewer_name ? ` · with ${interview.interviewer_name}` : ''}
            </p>
            {interview.feedback ? (
              <p className="mt-1 text-sm">{interview.feedback}</p>
            ) : null}
            {interview.reminder_sent_at ? (
              <p className="mt-1 flex items-center gap-1 text-2xs text-muted-foreground">
                <BellRing className="h-3 w-3" aria-hidden />
                Reminder raised {formatRelative(interview.reminder_sent_at)}
              </p>
            ) : null}
          </div>

          {canWrite && interview.outcome === 'SCHEDULED' ? (
            <Button variant="outline" size="sm" onClick={() => setRecording((value) => !value)}>
              Record outcome
            </Button>
          ) : null}
        </div>

        {recording ? (
          <OutcomeForm interview={interview} onDone={() => setRecording(false)} />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function Interviews() {
  const can = useAuthStore((state) => state.can);
  const [daysAhead, setDaysAhead] = React.useState(30);
  const interviews = useInterviews(daysAhead);

  if (!can('interview:read')) return <PermissionDeniedState />;

  const canWrite = can('interview:write');
  const rows = interviews.data ?? [];

  return (
    <>
      <PageHeader
        title="Interviews"
        description="Scheduled client interviews and their outcomes. Scheduling raises a reminder for the submission's owner."
      />

      {canWrite ? (
        <div className="mb-4">
          <ScheduleForm />
        </div>
      ) : null}

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Look ahead</span>
            <Select
              value={String(daysAhead)}
              onChange={(event) => setDaysAhead(Number(event.target.value))}
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </Select>
          </label>
        </CardContent>
      </Card>

      {interviews.isError ? (
        <ErrorState error={interviews.error} onRetry={() => void interviews.refetch()} />
      ) : interviews.isLoading ? (
        <TableLoadingState rows={4} columns={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No interviews scheduled in the next ${daysAhead} days`}
          description="Scheduled interviews appear here with their round number and outcome. Put a candidate forward and schedule one above."
          action={
            <Button asChild variant="outline">
              <Link href="/sales/submissions">Go to submissions</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" aria-hidden />
            <strong className="tabular text-foreground">{rows.length}</strong> scheduled in the
            next {daysAhead} days
          </p>
          {rows.map((interview) => (
            <InterviewCard key={interview.id} interview={interview} canWrite={canWrite} />
          ))}
        </div>
      )}
    </>
  );
}
