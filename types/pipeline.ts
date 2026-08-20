/** Sales pipeline: opportunities, submissions, interviews, communications (Phase 10). */

export type OpportunityStage =
  | 'REQUIREMENT_IDENTIFIED'
  | 'MATCHED'
  | 'QUALIFIED'
  | 'CONTACTED'
  | 'CV_SUBMITTED'
  | 'INTERVIEW'
  | 'COMMERCIAL_NEGOTIATION'
  | 'SELECTED'
  | 'PO_CONTRACT'
  | 'DEPLOYED'
  | 'BILLING'
  | 'EXTENSION_REDEPLOYMENT'
  | 'LOST'
  | 'DROPPED';

/** The human answer to the score, deliberately separate from the stage. */
export type OpportunityDecision = 'PURSUE' | 'HOLD' | 'DECLINE';

export type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SHORTLISTED'
  | 'INTERVIEW'
  | 'SELECTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'ON_HOLD';

export type InterviewMode = 'PHONE' | 'VIDEO' | 'ONSITE' | 'TECHNICAL_TEST';

export type InterviewOutcome =
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'PASSED'
  | 'FAILED'
  | 'NO_SHOW'
  | 'RESCHEDULED'
  | 'CANCELLED';

export type CommunicationChannel = 'EMAIL' | 'PHONE' | 'MEETING' | 'NOTE';
export type CommunicationDirection = 'OUTBOUND' | 'INBOUND';

export interface StageInfo {
  value: OpportunityStage;
  label: string;
  is_terminal: boolean;
  order: number;
}

export interface Opportunity {
  id: string;
  requirement_id: string;
  requirement_title: string | null;
  account_id: string | null;
  stage: OpportunityStage;
  stage_label: string;
  next_stage: OpportunityStage | null;
  is_open: boolean;

  sales_owner_id: string | null;
  resourcing_owner_id: string | null;
  next_action: string | null;
  next_action_due_at: string | null;

  probability_percent: number | null;
  expected_monthly_revenue: string | null;
  expected_margin_percent: number | null;
  contract_value: string | null;
  currency: string;
  /** Commercial fields withheld from this role, named rather than absent. */
  restricted_fields: string[];

  decision: OpportunityDecision | null;
  decision_reason: string | null;
  decided_at: string | null;
  closed_reason: string | null;
  closed_at: string | null;

  submission_count: number;
  created_at: string;
  updated_at: string;
}

export interface StageHistoryEntry {
  from_stage: OpportunityStage | null;
  to_stage: OpportunityStage;
  note: string | null;
  user_id: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  opportunity_id: string | null;
  requirement_id: string;
  requirement_title: string | null;
  resource_id: string;
  resource_name: string | null;
  match_id: string | null;
  status: SubmissionStatus;
  submitted_by: string | null;
  submitted_at: string | null;

  proposed_bill_rate: string | null;
  proposed_bill_currency: string | null;
  proposed_bill_unit: string | null;
  restricted_fields: string[];

  client_feedback: string | null;
  rejection_reason: string | null;
  interview_count: number;
  /**
   * Set once this submission has been deployed.
   *
   * A submission stays SELECTED forever after the handover, so status alone
   * cannot tell us whether deploying is still possible.
   */
  deployment_id: string | null;
  created_at: string;
}

export interface SubmissionHistoryEntry {
  from_status: SubmissionStatus | null;
  to_status: SubmissionStatus;
  note: string | null;
  user_id: string | null;
  created_at: string;
}

/**
 * The duplicate warning. Carries who submitted, when and the current status —
 * a bare "already submitted" tells a recruiter nothing they can act on.
 */
export interface DuplicateCheck {
  is_duplicate: boolean;
  submission_id: string | null;
  status: SubmissionStatus | null;
  submitted_at: string | null;
  submitted_by: string | null;
}

export interface Interview {
  id: string;
  submission_id: string;
  resource_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  mode: InterviewMode;
  interviewer_name: string | null;
  interviewer_contact_id: string | null;
  location_or_link: string | null;
  round_number: number;
  outcome: InterviewOutcome;
  feedback: string | null;
  reminder_sent_at: string | null;
  created_at: string;
}

export interface Communication {
  id: string;
  direction: CommunicationDirection;
  channel: CommunicationChannel;
  subject: string | null;
  body: string | null;
  to_addresses: string[] | null;
  status: 'LOGGED' | 'QUEUED' | 'SENT' | 'FAILED';
  sent_at: string | null;
  opportunity_id: string | null;
  submission_id: string | null;
  user_id: string | null;
  created_at: string;
}
