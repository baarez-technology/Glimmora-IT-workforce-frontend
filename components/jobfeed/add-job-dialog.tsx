'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/api';
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
import { useAddJob, useColleagues } from '@/hooks/use-jobfeed';
import { ApiError } from '@/lib/api';
import { WORKPLACE_LABELS, WORKPLACE_ORDER } from '@/lib/jobfeed';
import type { WorkplaceType } from '@/types/jobfeed';

/**
 * Add a job to your own feed.
 *
 * Leaving the arrangement on "Work it out from the description" is the honest
 * default: the server reads the text and records UNKNOWN when it cannot tell,
 * rather than assuming onsite.
 */

interface FormValues {
  title: string;
  company_name: string;
  location: string;
  country: string;
  workplace_type: WorkplaceType | '';
  url: string;
  description: string;
}

const DEFAULTS: FormValues = {
  title: '',
  company_name: '',
  location: '',
  country: '',
  workplace_type: '',
  url: '',
  description: '',
};

export function AddJobDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddJob();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [recipients, setRecipients] = React.useState<string[]>([]);
  const [shareNote, setShareNote] = React.useState('');
  const colleagues = useColleagues(open);

  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: DEFAULTS,
  });

  React.useEffect(() => {
    if (open) {
      reset(DEFAULTS);
      setServerError(null);
      setRecipients([]);
      setShareNote('');
    }
  }, [open, reset]);

  const title = watch('title');

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await add.mutateAsync({
        title: values.title.trim(),
        company_name: values.company_name.trim() || null,
        location: values.location.trim() || null,
        country: values.country ? values.country.toUpperCase() : null,
        workplace_type: values.workplace_type || null,
        url: values.url.trim() || null,
        description: values.description.trim() || null,
        recipient_ids: recipients,
        share_note: shareNote.trim() || null,
      });
      toast.success(
        recipients.length === 1
          ? 'Added and sent to 1 colleague.'
          : `Added and sent to ${recipients.length} colleagues.`,
      );
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'The job could not be added.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a job and send it to the team</DialogTitle>
          <DialogDescription>
            A role you found off-platform. Whoever is hiring is a company Sales could approach, so
            this goes to the colleagues who will act on it as well as to your own feed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="job_title">Job title</Label>
            <Input id="job_title" placeholder="Senior Python Developer" {...register('title')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="job_company">Company (optional)</Label>
              <Input id="job_company" {...register('company_name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job_location">Location (optional)</Label>
              <Input id="job_location" placeholder="Doha, Qatar" {...register('location')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="job_workplace">Arrangement</Label>
              <Select id="job_workplace" {...register('workplace_type')}>
                <option value="">Work it out from the description</option>
                {WORKPLACE_ORDER.filter((value) => value !== 'UNKNOWN').map((value) => (
                  <option key={value} value={value}>
                    {WORKPLACE_LABELS[value]}
                  </option>
                ))}
                <option value="UNKNOWN">Not stated</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job_country">Country code (optional)</Label>
              <Input id="job_country" placeholder="QA" maxLength={2} {...register('country')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job_url">Link (optional)</Label>
            <Input id="job_url" placeholder="https://…" {...register('url')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job_description">Description (optional)</Label>
            <textarea
              id="job_description"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Paste the posting. The arrangement is read from this when you leave it to be worked out."
              {...register('description')}
            />
          </div>

          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <div className="space-y-1.5 rounded-md border bg-muted/40 p-3">
            <Label>Send to</Label>
            <p className="text-2xs text-muted-foreground">
              A job nobody is told about helps nobody. Pick at least one colleague.
            </p>
            {colleagues.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading colleagues…</p>
            ) : (colleagues.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                There is nobody else holding the job offers workspace yet.
              </p>
            ) : (
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border bg-background p-1">
                {(colleagues.data ?? []).map((person) => {
                  const active = recipients.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setRecipients((current) =>
                          current.includes(person.id)
                            ? current.filter((id) => id !== person.id)
                            : [...current, person.id],
                        )
                      }
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-sm transition-colors',
                        active ? 'bg-primary/10 font-medium' : 'hover:bg-muted',
                      )}
                    >
                      <span className="truncate">{person.full_name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {ROLE_LABELS[person.role as Role] ?? person.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <Input
              placeholder="Why it is worth their time (optional)"
              value={shareNote}
              maxLength={500}
              onChange={(event) => setShareNote(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={add.isPending}
              disabled={title.trim().length < 2 || recipients.length === 0}
            >
              Add and send
              {recipients.length > 1 ? ` to ${recipients.length}` : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
