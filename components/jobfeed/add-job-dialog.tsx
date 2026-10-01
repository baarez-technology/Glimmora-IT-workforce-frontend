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
import { Select } from '@/components/ui/select';
import { useAddJob } from '@/hooks/use-jobfeed';
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

  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: DEFAULTS,
  });

  React.useEffect(() => {
    if (open) {
      reset(DEFAULTS);
      setServerError(null);
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
      });
      toast.success('Added to your feed.');
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'The job could not be added.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a job</DialogTitle>
          <DialogDescription>
            A role you found elsewhere, kept with the rest. Only you can see it.
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

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={add.isPending} disabled={title.trim().length < 2}>
              Add to my feed
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
