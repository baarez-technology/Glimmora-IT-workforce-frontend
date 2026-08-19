'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { Select } from '@/components/ui/select';
import { useLogActivity } from '@/hooks/use-accounts';
import { ACTIVITY_TYPE_LABELS, LOGGABLE_ACTIVITY_TYPES } from '@/lib/accounts';
import { ApiError } from '@/lib/api';

const schema = z.object({
  activity_type: z.enum(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK']),
  subject: z.string().min(2, 'Say what happened'),
  body: z.string().optional(),
  outcome: z.string().optional(),
  follow_up_at: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LogActivityDialog({
  open,
  onOpenChange,
  accountId,
  contactId,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  contactId?: string;
  projectId?: string;
}) {
  const logActivity = useLogActivity();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { activity_type: 'CALL', subject: '', body: '', outcome: '', follow_up_at: '' },
  });

  React.useEffect(() => {
    if (open) {
      reset({ activity_type: 'CALL', subject: '', body: '', outcome: '', follow_up_at: '' });
      setServerError(null);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await logActivity.mutateAsync({
        activity_type: values.activity_type,
        subject: values.subject,
        body: values.body || null,
        outcome: values.outcome || null,
        // datetime-local gives a naive local value; the API stores UTC.
        follow_up_at: values.follow_up_at
          ? new Date(values.follow_up_at).toISOString()
          : null,
        account_id: accountId ?? null,
        contact_id: contactId ?? null,
        project_id: projectId ?? null,
      });
      toast.success('Activity logged.');
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'The activity could not be saved.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
          <DialogDescription>
            A timeline entry, not a CRM record. Set a follow-up date and it appears on your
            follow-up queue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="activity_type">Type</Label>
              <Select id="activity_type" {...register('activity_type')}>
                {LOGGABLE_ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ACTIVITY_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="subject">What happened</Label>
              <Input
                id="subject"
                placeholder="Discussed upcoming SAP requirement"
                aria-invalid={Boolean(errors.subject)}
                {...register('subject')}
              />
              {errors.subject && (
                <p className="text-xs text-destructive">{errors.subject.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Notes (optional)</Label>
            <textarea
              id="body"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('body')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="outcome">Outcome (optional)</Label>
              <Input id="outcome" placeholder="Two extensions likely in Q3" {...register('outcome')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="follow_up_at">Follow up on (optional)</Label>
              <Input id="follow_up_at" type="datetime-local" {...register('follow_up_at')} />
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
            <Button type="submit" loading={isSubmitting}>
              Log activity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
