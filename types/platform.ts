/** Notifications, Excel import and export (Phase 12). */

export type NotificationCategory =
  | 'SUBMISSION_SLA'
  | 'DOCUMENT_EXPIRY'
  | 'BENCH_REDEPLOYMENT'
  | 'INTERVIEW_REMINDER'
  | 'FOLLOW_UP_OVERDUE'
  | 'PROJECT_ENDING'
  | 'SYSTEM';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Notification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface UnreadCount {
  total: number;
  critical: number;
  by_category: Record<string, number>;
}

export type ImportEntity =
  | 'customers'
  | 'contacts'
  | 'projects'
  | 'requirements'
  | 'resources'
  | 'deployments'
  | 'billing';

export type ImportStatus = 'STAGED' | 'COMMITTED' | 'DISCARDED' | 'FAILED';

/**
 * How a staged row was classified.
 *
 * `INVALID` is never written. `DUPLICATE` matches something already stored and
 * is skipped rather than merged. `WARNING` imports fine but something is worth
 * knowing first.
 */
export type RowState = 'VALID' | 'INVALID' | 'DUPLICATE' | 'WARNING';

export interface ImportRow {
  row_number: number;
  validation_state: RowState;
  raw: Record<string, unknown> | null;
  normalized: Record<string, unknown> | null;
  errors: string[];
  warnings: string[];
  created_entity_id: string | null;
}

export interface ImportBatch {
  id: string;
  entity_type: ImportEntity;
  filename: string;
  status: ImportStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  warning_rows: number;
  committed_rows: number;
  file_errors: string[];
  is_committable: boolean;
  created_at: string;
  committed_at: string | null;
}

export interface ImportPreview {
  batch: ImportBatch;
  rows: ImportRow[];
}

export interface CommitResult {
  created: number;
  skipped: number;
  /** Invalid rows, which were never written to a business table. */
  never_written: number;
}

export interface ImportColumn {
  key: string;
  label: string;
  kind: string;
  required: boolean;
  choices: string[] | null;
  hint: string | null;
}

export interface ImportEntityInfo {
  entity: ImportEntity;
  columns: ImportColumn[];
}
