/**
 * Shared API types mirroring the backend Pydantic schemas.
 *
 * Kept hand-written and small in Phase 2; each later phase adds the types for
 * the endpoints it delivers.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DUPLICATE_SUBMISSION'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR';

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    request_id?: string;
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PageQuery {
  page?: number;
  page_size?: number;
  sort?: string;
  q?: string;
}

/* ------------------------------------------------------------------ system */

export type HealthState = 'healthy' | 'degraded' | 'unhealthy';
export type ComponentState = 'ok' | 'fallback' | 'down';

export interface ComponentHealth {
  name: string;
  state: ComponentState;
  detail: string | null;
}

export interface HealthResponse {
  status: HealthState;
  version: string;
  environment: string;
  components: ComponentHealth[];
  degraded: Record<string, string>;
}

export interface PublicConfig {
  app_name: string;
  environment: string;
  api_prefix: string;
  base_currency: string;
  default_timezone: string;
  max_upload_mb: number;
  ai_enabled: boolean;
  sla_thresholds_hours: { urgent: number; due_soon: number };
  document_expiring_soon_days: number;
  bench_milestone_days: number[];
}

/* ------------------------------------------------------- identity (Phase 3) */

export type Role = 'ADMIN' | 'MANAGEMENT' | 'SALES' | 'HR_RESOURCING';

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  job_title: string | null;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  permissions: string[];
}

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  job_title: string | null;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleSummary {
  role: Role;
  label: string;
  description: string;
  permission_count: number;
  permissions: string[];
}

export interface PermissionMatrixRow {
  permission: string;
  is_field_permission: boolean;
  roles: Record<string, boolean>;
}

export interface RoleCatalogue {
  roles: RoleSummary[];
  matrix: PermissionMatrixRow[];
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  ip_address: string | null;
  request_id: string | null;
  created_at: string;
}

/* -------------------------------------------------- intelligence (Phase 9) */

export type OpportunityBand = 'PURSUE_NOW' | 'PURSUE' | 'REVIEW' | 'DEPRIORITIZE';
export type FactorState = 'MET' | 'NOT_MET' | 'NOT_APPLICABLE' | 'UNKNOWN';

export interface ScoreFactor {
  key: string;
  label: string;
  state: FactorState;
  points: number;
  max_points: number;
  evidence: string | null;
}

export interface ScoreComponent {
  score: number | null;
  weight: number;
  contribution: number;
}

/** The explainability contract — no score is ever rendered without this. */
export interface ScoreExplanation {
  score: number;
  band: OpportunityBand;
  confidence: number;
  components: Record<string, ScoreComponent>;
  factors: ScoreFactor[];
  positives: string[];
  risks: string[];
  missing_information: string[];
  recommended_action: string;
  narrative: string;
  scoring_config_version: string;
  engine_version: string;
  computed_at: string;
}

/* ------------------------------------------------------------------- jobs */

export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface JobHandle {
  job_id: string;
  status: JobStatus;
  poll_url: string;
}
