/** Requirement, parsing and SLA types (Phase 5). */

export type PrioritySource =
  | 'P1_EXISTING_CUSTOMER'
  | 'P2_PARTNER_PRIME'
  | 'P3_PROJECT'
  | 'P4_ENTERPRISE_GOV'
  | 'P5_VENDOR_MSP_VMS'
  | 'P6_EXTERNAL_APPROVED';

export type RequirementSource =
  | 'MANUAL'
  | 'JD_PASTE'
  | 'DOCUMENT_UPLOAD'
  | 'EMAIL'
  | 'EXCEL_IMPORT'
  | 'API';

export type ContractType =
  | 'CONTRACT'
  | 'CONTRACT_TO_HIRE'
  | 'PERMANENT'
  | 'OUTSOURCED_SERVICE';

export type WorkMode = 'ONSITE' | 'HYBRID' | 'REMOTE';

export type RateUnit = 'HOURLY' | 'DAILY' | 'MONTHLY' | 'ANNUAL';

export type RequirementStatus =
  | 'NEW'
  | 'PARSED'
  | 'UNDER_REVIEW'
  | 'QUALIFIED'
  | 'ON_HOLD'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'
  | 'EXPIRED';

export type ReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED';

export type SkillImportance = 'MANDATORY' | 'PREFERRED' | 'NICE_TO_HAVE';

export type DeadlineState = 'NONE' | 'SAFE' | 'DUE_SOON' | 'URGENT' | 'EXPIRED';

export interface DeadlineInfo {
  state: DeadlineState;
  deadline: string | null;
  hours_remaining: number | null;
  is_overdue: boolean;
  label: string;
}

export interface RequirementSkill {
  id: string;
  skill_id: string;
  name: string;
  category: string | null;
  importance: SkillImportance;
  min_years: number | null;
}

export interface Requirement {
  id: string;
  title: string;
  role: string | null;
  description_raw: string | null;

  location: string | null;
  country: string | null;
  work_mode: WorkMode | null;
  contract_type: ContractType | null;

  experience_min_years: number | null;
  experience_max_years: number | null;
  duration_months: number | null;
  positions: number;
  start_by_date: string | null;
  availability_requirement: string | null;

  rate_min: string | null;
  rate_max: string | null;
  rate_currency: string | null;
  rate_unit: RateUnit | null;

  account_id: string | null;
  account_name: string | null;
  end_customer_id: string | null;
  end_customer_name: string | null;
  route_account_id: string | null;
  route_account_name: string | null;
  project_id: string | null;
  project_name: string | null;

  priority_source: PrioritySource;
  source: RequirementSource;
  source_detail: string | null;
  external_reference: string | null;
  status: RequirementStatus;
  is_active: boolean;
  owner_id: string | null;
  owner_name: string | null;
  notes: string | null;

  response_deadline_at: string | null;
  deadline: DeadlineInfo | null;

  review_status: ReviewStatus;
  parse_confidence: number | null;
  parse_model: string | null;
  parsed_at: string | null;
  needs_review: boolean;

  skills: RequirementSkill[];
  created_at: string;
  updated_at: string;
}

export interface RequirementStatusHistoryEntry {
  id: string;
  from_status: RequirementStatus | null;
  to_status: RequirementStatus;
  user_id: string | null;
  user_name: string | null;
  reason: string | null;
  created_at: string;
}

/** One extracted field, with what a reviewer needs to verify it. */
export interface ParsedField {
  field: string;
  label: string;
  value: unknown;
  confidence: number;
  /** HIGH pre-fills, MEDIUM must be confirmed, LOW is left blank. */
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  requires_confirmation: boolean;
  evidence: string | null;
  evidence_start: number | null;
  evidence_end: number | null;
}

export interface ParseResult {
  requirement_id: string;
  source_text: string;
  provider: string;
  model_id: string;
  used_fallback: boolean;
  overall_confidence: number;
  fields: ParsedField[];
  unresolved_skills: string[];
  warnings: string[];
  confirmation_required: string[];
}

export interface DeadlineBoard {
  urgent: Requirement[];
  due_soon: Requirement[];
  safe: Requirement[];
  expired: Requirement[];
  counts: Record<string, number>;
}

export interface SkillOption {
  id: string;
  name: string;
  category: string | null;
  needs_review: boolean;
}
