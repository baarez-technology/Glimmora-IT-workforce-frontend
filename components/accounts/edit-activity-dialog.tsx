'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateActivity } from '@/hooks/use-accounts';
import { ApiError } from '@/lib/api';
import type { Activity } from '@/types/accounts';

/**
 * Correct a logged activity.
 *
 * The timeline is the evidence somebody uses to judge whether an account has
 * gone quiet, so a call logged against the wrong date is worse than one not
 * logged at all — it makes a stale account look active.
 */

interface FormValues {
  subject: string;
  body: string;
  outcome: string;
  occurred_at: string;
  follow_up_at: string;
}

/** datetime-local wants `YYYY-MM-DDTHH:mm`, the API returns ISO with a zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function EditActivityDialog({
  open,
  onOpenChange,
  activity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity;
}) {
  const update = useUpdateActivity();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const defaults: FormValues = React.useMemo(
    () => ({
      subject: activity.subject,
      body: activity.body ?? '',
      outcome: activity.outcome ?? '',
      occurred_at: toLocalInput(activity.occurred_at),
      follow_up_at: toLocalInput(activity.follow_up_at),
    }),
    [activity],
  );

  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: defaults });

  React.useEffect(() => {
    if (open) {
      reset(defaults);
      setServerError(null);
    }
  }, [open, defaults, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!values.subject.trim()) {
      setServerError('A subject is required.');
      return;
    }
    setServerError(null);
    try {
      await update.mutateAsync({
        id: activity.id,
        subject: values.subject.trim(),
        body: values.body.trim() || null,
        outcome: values.outcome.trim() || null,
        occurred_at: toIso(values.occurred_at),
        follow_up_at: toIso(values.follow_up_at),
      });
      toast.success('Activity updated.');
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'The activity could not be saved.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit activity</DialogTitle>
          <DialogDescription>
            {activity.account_name ?? 'Correct what was logged, or move the follow-up date.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="activity_subject">Subject</Label>
            <Input id="activity_subject" {...register('subject')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activity_body">Notes (optional)</Label>
            <textarea
              id="activity_body"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('body')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activity_outcome">Outcome (optional)</Label>
            <Input id="activity_outcome" {...register('outcome')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="activity_occurred">Happened at</Label>
              <Input
                id="activity_occurred"
                type="datetime-local"
                {...register('occurred_at')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity_followup">Follow up (optional)</Label>
              <Input
                id="activity_followup"
                type="datetime-local"
                {...register('follow_up_at')}
              />
              <p className="text-2xs text-muted-foreground">
                Clear this to drop the follow-up entirely.
              </p>
            </div>
          </div>

          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={update.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
