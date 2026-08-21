'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { InlineWarning } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useChangeRequirementStatus } from '@/hooks/use-requirements';
import { ApiError } from '@/lib/api';
import {
  REQUIREMENT_STATUSES_NEEDING_REASON,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_TRANSITIONS,
} from '@/lib/demand';
import type { Requirement, RequirementStatus } from '@/types/demand';

/**
 * Move a requirement's status.
 *
 * The dropdown offers only the moves the API will accept, taken from the same
 * transition table the service enforces — a legal-looking option that returns
 * 409 is worse than no option. Closing or shelving asks for a reason, because
 * "why did we lose this" is the question the pipeline exists to answer.
 */
export function RequirementStatusForm({
  requirement,
  onDone,
}: {
  requirement: Requirement;
  onDone: () => void;
}) {
  const allowed = REQUIREMENT_TRANSITIONS[requirement.status];
  const [status, setStatus] = React.useState<RequirementStatus | ''>('');
  const [reason, setReason] = React.useState('');
  const change = useChangeRequirementStatus(requirement.id);
  const [error, setError] = React.useState<string | null>(null);

  const needsReason =
    status !== '' && REQUIREMENT_STATUSES_NEEDING_REASON.includes(status as RequirementStatus);
  const blockedByReview =
    status === 'QUALIFIED' && requirement.review_status === 'PENDING_REVIEW';

  if (allowed.length === 0) {
    return (
      <InlineWarning>
        This requirement is closed as won. That is a terminal state — there is nowhere left to move
        it, and rewriting history would break the reporting built on it.
      </InlineWarning>
    );
  }

  const submit = () => {
    if (!status) return;
    setError(null);
    change.mutate(
      { status: status as RequirementStatus, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(
            `Moved to ${REQUIREMENT_STATUS_LABELS[status as RequirementStatus].toLowerCase()}.`,
          );
          onDone();
        },
        onError: (caught) =>
          setError(
            caught instanceof ApiError ? caught.message : 'The status could not be changed.',
          ),
      },
    );
  };

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <p className="text-sm font-medium">
        Currently {REQUIREMENT_STATUS_LABELS[requirement.status].toLowerCase()}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="requirement-status">Move to</Label>
          <Select
            id="requirement-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as RequirementStatus | '')}
          >
            <option value="">Choose a status…</option>
            {allowed.map((value) => (
              <option key={value} value={value}>
                {REQUIREMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="requirement-status-reason">
            Reason{needsReason ? '' : ' (optional)'}
          </Label>
          <Input
            id="requirement-status-reason"
            value={reason}
            placeholder={needsReason ? 'Why is it moving?' : 'Optional note'}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={needsReason && !reason.trim()}
          />
        </div>
      </div>

      {blockedByReview ? (
        <InlineWarning>
          The extracted fields have not been reviewed yet. Accept the parse on the Review tab before
          qualifying this requirement.
        </InlineWarning>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={submit}
          loading={change.isPending}
          disabled={!status || (needsReason && !reason.trim()) || blockedByReview}
        >
          Change status
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
