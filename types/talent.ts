/** Talent cloud, document and CV-parsing types (Phase 6). */

export type ResourceType =
  | 'EMPLOYEE'
  | 'BENCH'
  | 'CONSULTANT'
  | 'FREELANCER'
  | 'PARTNER_RESOURCE'
  | 'PREVIOUS_CANDIDATE'
  | 'PRE_VETTED_CANDIDATE';

export type AvailabilityStatus = 'AVAILABLE' | 'AVAILABLE_SOON' | 'DEPLOYED' | 'NOT_AVAILABLE';

export type VisaStatus = 'NOT_REQUIRED' | 'VALID' | 'IN_PROCESS' | 'EXPIRED' | 'UNKNOWN';

export type AssessmentStatus = 'NOT_ASSESSED' | 'PENDING' | 'PASSED' | 'FAILED';

export type Proficiency = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export type DocumentType =
  | 'CV'
  | 'ID'
  | 'PASSPORT'
  | 'VISA'
  | 'WORK_PERMIT'
  | 'QID'
  | 'CONTRACT'
  | 'CERTIFICATE'
  | 'OTHER';

export type DocumentExpiryState = 'NOT_APPLICABLE' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export interface DocumentExpiryInfo {
  state: DocumentExpiryState;
  expiry_date: string | null;
  days_remaining: number | null;
  is_expired: boolean;
  label: string;
}

export interface ResourceSkill {
  id: string;
  skill_id: string;
  name: string;
  category: string | null;
  years: number | null;
  proficiency: Proficiency;
  last_used_year: number | null;
  is_primary: boolean;
}

export interface ResourceExperienceEntry {
  id: string;
  company: string | null;
  project_name: string | null;
  role: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  location: string | null;
  technologies: string[] | null;
}

export interface ResourceCertification {
  id: string;
  name: string;
  issuer: string | null;
  issued_at: string | null;
  expires_at: string | null;
  credential_id: string | null;
  expiry_state: DocumentExpiryState;
}

export interface Resource {
  id: string;
  code: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  resource_type: ResourceType;
  headline: string | null;
  summary: string | null;
  total_experience_years: number | null;
  relevant_experience_years: number | null;
  current_location_country: string | null;
  current_location_city: string | null;
  willing_to_relocate: boolean;
  nationality: string | null;
  visa_status: VisaStatus;
  visa_country: string | null;
  availability_status: AvailabilityStatus;
  available_from: string | null;
  notice_period_days: number;
  ready_from: string | null;
  expected_cost_amount: string | null;
  expected_cost_currency: string | null;
  expected_cost_unit: string | null;
  target_billing_amount: string | null;
  target_billing_currency: string | null;
  target_billing_unit: string | null;
  assessment_status: AssessmentStatus;
  assessment_score: number | null;
  assessment_notes: string | null;
  partner_account_id: string | null;
  partner_account_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  notes: string | null;
  review_status: string;
  source: string;
  parse_confidence: number | null;
  parse_model: string | null;
  parsed_at: string | null;
  needs_review: boolean;
  is_bench: boolean;
  work_authorisation: DocumentExpiryInfo | null;
  blocks_deployment: boolean;
  skills: ResourceSkill[];
  experience: ResourceExperienceEntry[];
  certifications: ResourceCertification[];
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceDocument {
  id: string;
  resource_id: string;
  resource_name: string | null;
  document_id: string;
  doc_type: DocumentType;
  doc_type_label: string;
  title: string | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  issue_date: string | null;
  reference_number: string | null;
  issuing_country: string | null;
  notes: string | null;
  expiry: DocumentExpiryInfo;
  is_work_authorisation: boolean;
  can_download: boolean;
  created_at: string;
}

export interface DuplicateMatch {
  resource_id: string;
  full_name: string;
  email: string | null;
  reason: string;
  confidence: number;
}

export interface ParsedCVField {
  field: string;
  label: string;
  value: unknown;
  confidence: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  requires_confirmation: boolean;
  evidence: string | null;
}

export interface CVParseResult {
  resource_id: string;
  source_text: string;
  provider: string;
  model_id: string;
  used_fallback: boolean;
  overall_confidence: number;
  fields: ParsedCVField[];
  warnings: string[];
  confirmation_required: string[];
  duplicates: DuplicateMatch[];
}

export interface ExpiringDocuments {
  expired: ResourceDocument[];
  expiring_soon: ResourceDocument[];
  counts: Record<string, number>;
}
