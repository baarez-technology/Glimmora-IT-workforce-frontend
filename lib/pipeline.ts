import type {
  InterviewOutcome,
  Opportunity,
  OpportunityDecision,
  OpportunityStage,
  StageInfo,
  Submission,
  SubmissionStatus,
} from '@/types/pipeline';

/**
 * Presentation rules for the pipeline.
 *
 * The board's job is to make stalled work visible. Everything here serves that:
 * an overdue next action, an opportunity with no owner, a submission sitting at
 * DRAFT — those are the rows somebody has to touch today.
 */

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  REQUIREMENT_IDENTIFIED: 'Requirement identified',
  MATCHED: 'Matched',
  QUALIFIED: 'Qualified',
  CONTACTED: 'Client contacted',
  CV_SUBMITTED: 'CV submitted',
  INTERVIEW: 'Interview',
  COMMERCIAL_NEGOTIATION: 'Commercial negotiation',
  SELECTED: 'Selected',
  PO_CONTRACT: 'PO / contract',
  DEPLOYED: 'Deployed',
  BILLING: 'Billing',
  EXTENSION_REDEPLOYMENT: 'Extension / redeployment',
  LOST: 'Lost',
  DROPPED: 'Dropped',
};

export const STAGE_ORDER: OpportunityStage[] = [
  'REQUIREMENT_IDENTIFIED',
  'MATCHED',
  'QUALIFIED',
  'CONTACTED',
  'CV_SUBMITTED',
  'INTERVIEW',
  'COMMERCIAL_NEGOTIATION',
  'SELECTED',
  'PO_CONTRACT',
  'DEPLOYED',
  'BILLING',
  'EXTENSION_REDEPLOYMENT',
];

export const TERMINAL_STAGES: OpportunityStage[] = ['LOST', 'DROPPED'];

/** Colour by how far down the funnel, so a board reads at a glance. */
export function stageVariant(
  stage: OpportunityStage,
): 'success' | 'info' | 'warning' | 'muted' | 'destructive' {
  if (stage === 'LOST') return 'destructive';
  if (stage === 'DROPPED') return 'muted';
  const index = STAGE_ORDER.indexOf(stage);
  if (index >= STAGE_ORDER.indexOf('PO_CONTRACT')) return 'success';
  if (index >= STAGE_ORDER.indexOf('CV_SUBMITTED')) return 'info';
  return 'warning';
}

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interviewing',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  ON_HOLD: 'On hold',
};

export const SUBMISSION_STATUS_VARIANT: Record<
  SubmissionStatus,
  'success' | 'info' | 'warning' | 'muted' | 'destructive'
> = {
  DRAFT: 'muted',
  SUBMITTED: 'info',
  SHORTLISTED: 'info',
  INTERVIEW: 'warning',
  SELECTED: 'success',
  REJECTED: 'destructive',
  WITHDRAWN: 'muted',
  ON_HOLD: 'warning',
};

/** Statuses that hold the seat. Mirrors BLOCKING_SUBMISSION_STATUSES server-side. */
export const LIVE_SUBMISSION_STATUSES: SubmissionStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'SHORTLISTED',
  'INTERVIEW',
  'SELECTED',
  'ON_HOLD',
];

export function isLive(submission: Submission): boolean {
  return LIVE_SUBMISSION_STATUSES.includes(submission.status);
}

export const DECISION_LABELS: Record<OpportunityDecision, string> = {
  PURSUE: 'Pursue',
  HOLD: 'Hold',
  DECLINE: 'Decline',
};

export const DECISION_VARIANT: Record<OpportunityDecision, 'success' | 'warning' | 'muted'> = {
  PURSUE: 'success',
  HOLD: 'warning',
  DECLINE: 'muted',
};

export const OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  PASSED: 'Passed',
  FAILED: 'Failed',
  NO_SHOW: 'No show',
  RESCHEDULED: 'Rescheduled',
  CANCELLED: 'Cancelled',
};

export const OUTCOME_VARIANT: Record<
  InterviewOutcome,
  'success' | 'info' | 'warning' | 'muted' | 'destructive'
> = {
  SCHEDULED: 'info',
  COMPLETED: 'info',
  PASSED: 'success',
  FAILED: 'destructive',
  NO_SHOW: 'destructive',
  RESCHEDULED: 'warning',
  CANCELLED: 'muted',
};

/** Whether a next action has slipped. The board's single most useful signal. */
export function isOverdue(opportunity: Opportunity): boolean {
  if (!opportunity.next_action_due_at || !opportunity.is_open) return false;
  return new Date(opportunity.next_action_due_at).getTime() < Date.now();
}

/** Open work with nobody assigned. Silent stalls start here. */
export function isUnowned(opportunity: Opportunity): boolean {
  return opportunity.is_open && !opportunity.sales_owner_id;
}

export function groupByStage(
  opportunities: Opportunity[],
  stages: StageInfo[],
): Array<{ stage: StageInfo; items: Opportunity[] }> {
  return stages.map((stage) => ({
    stage,
    items: opportunities.filter((item) => item.stage === stage.value),
  }));
}

/** Funnel counts for the summary strip, terminal stages kept separate. */
export function funnelCounts(opportunities: Opportunity[]): {
  open: number;
  advanced: number;
  closed: number;
  overdue: number;
  unowned: number;
} {
  return {
    open: opportunities.filter((item) => item.is_open).length,
    advanced: opportunities.filter(
      (item) => item.stage === 'BILLING' || item.stage === 'DEPLOYED',
    ).length,
    closed: opportunities.filter((item) => !item.is_open).length,
    overdue: opportunities.filter(isOverdue).length,
    unowned: opportunities.filter(isUnowned).length,
  };
}

/** Human sentence for the duplicate warning, from the parts the API returns. */
export function duplicateMessage(check: {
  status: SubmissionStatus | null;
  submitted_by: string | null;
  submitted_at: string | null;
}): string {
  const status = check.status ? SUBMISSION_STATUS_LABELS[check.status].toLowerCase() : 'live';
  const who = check.submitted_by ?? 'another user';
  const when = check.submitted_at
    ? new Date(check.submitted_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'not yet submitted';
  return `Already on this requirement — ${status}, put forward by ${who} (${when}).`;
}
