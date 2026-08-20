import type {
  ImportBatch,
  ImportRow,
  NotificationCategory,
  NotificationSeverity,
  RowState,
} from '@/types/platform';

/**
 * Presentation rules for notifications and imports.
 *
 * The import rule that matters: **the four row states must never look alike.**
 * `INVALID` will not be written, `DUPLICATE` already exists, `WARNING` will be
 * written despite a caveat, and `VALID` is clean. Rendering them the same way
 * is how somebody clicks commit expecting one thing and gets another.
 */

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  SUBMISSION_SLA: 'Submission deadline',
  DOCUMENT_EXPIRY: 'Document expiry',
  BENCH_REDEPLOYMENT: 'Redeployment',
  INTERVIEW_REMINDER: 'Interview',
  FOLLOW_UP_OVERDUE: 'Overdue follow-up',
  PROJECT_ENDING: 'Project ending',
  SYSTEM: 'System',
};

export const SEVERITY_VARIANT: Record<
  NotificationSeverity,
  'info' | 'warning' | 'destructive'
> = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'destructive',
};

export const SEVERITY_ORDER: NotificationSeverity[] = ['CRITICAL', 'WARNING', 'INFO'];

/** Most urgent first, then newest — the order somebody should work them in. */
export function rankNotifications<T extends { severity: NotificationSeverity; created_at: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const bySeverity =
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export const ROW_STATE_PRESENTATION: Record<
  RowState,
  { label: string; variant: 'success' | 'destructive' | 'warning' | 'muted'; meaning: string }
> = {
  VALID: { label: 'Valid', variant: 'success', meaning: 'Will be imported' },
  INVALID: {
    label: 'Invalid',
    variant: 'destructive',
    meaning: 'Will NOT be imported — fix and re-upload',
  },
  DUPLICATE: {
    label: 'Duplicate',
    variant: 'muted',
    meaning: 'Already exists — will be skipped',
  },
  WARNING: {
    label: 'Warning',
    variant: 'warning',
    meaning: 'Will be imported, but check it first',
  },
};

/** How many rows commit would actually write. */
export function willImport(batch: ImportBatch): number {
  return batch.valid_rows + batch.warning_rows;
}

export function isBlocked(batch: ImportBatch): boolean {
  return batch.file_errors.length > 0;
}

/**
 * A one-sentence summary of what commit will do, in the user's terms.
 *
 * Written so the number that gets skipped is as prominent as the number that
 * lands — a preview that only advertises successes invites a nasty surprise.
 */
export function commitSummary(batch: ImportBatch): string {
  const importing = willImport(batch);
  const parts: string[] = [
    `${importing} row${importing === 1 ? '' : 's'} will be imported`,
  ];
  if (batch.invalid_rows > 0) {
    parts.push(`${batch.invalid_rows} invalid will be skipped`);
  }
  if (batch.duplicate_rows > 0) {
    parts.push(`${batch.duplicate_rows} already exist`);
  }
  return `${parts.join(', ')}.`;
}

export function rowsNeedingAttention(rows: ImportRow[]): ImportRow[] {
  return rows.filter(
    (row) => row.validation_state === 'INVALID' || row.validation_state === 'WARNING',
  );
}

/** Column order for the preview table: problems first, so they are seen. */
export function rankRows(rows: ImportRow[]): ImportRow[] {
  const weight: Record<RowState, number> = {
    INVALID: 0,
    WARNING: 1,
    DUPLICATE: 2,
    VALID: 3,
  };
  return [...rows].sort(
    (a, b) =>
      weight[a.validation_state] - weight[b.validation_state] ||
      a.row_number - b.row_number,
  );
}
