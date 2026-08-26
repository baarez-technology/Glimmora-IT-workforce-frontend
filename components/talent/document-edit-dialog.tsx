'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { InlineWarning } from '@/components/states';
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
import { useUpdateDocument } from '@/hooks/use-talent';
import { ApiError } from '@/lib/api';
import type { ResourceDocument } from '@/types/talent';

/**
 * Correct a document's details.
 *
 * The expiry date is the reason this screen exists. A visa recorded with the
 * wrong date either raises an alarm that is not real, or stays silent through
 * one that is — and the second failure stops billing on a live deployment.
 * Fixing it must not mean deleting the file and uploading it again.
 *
 * The file itself is never replaced here. A renewed passport is a new document,
 * not an edit to the old one.
 */

interface FormValues {
  title: string;
  issue_date: string;
  expiry_date: string;
  issuing_country: string;
  reference_number: string;
}

export function DocumentEditDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: ResourceDocument;
}) {
  const update = useUpdateDocument();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const defaults: FormValues = React.useMemo(
    () => ({
      title: document.title ?? '',
      issue_date: document.issue_date ?? '',
      expiry_date: document.expiry.expiry_date ?? '',
      issuing_country: document.issuing_country ?? '',
      reference_number: document.reference_number ?? '',
    }),
    [document],
  );

  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: defaults,
  });

  React.useEffect(() => {
    if (open) {
      reset(defaults);
      setServerError(null);
    }
  }, [open, defaults, reset]);

  const issue = watch('issue_date');
  const expiry = watch('expiry_date');

  const backwards = Boolean(issue && expiry) && expiry < issue;
  const today = new Date().toISOString().slice(0, 10);
  const clearsAnAlarm =
    document.expiry.is_expired && Boolean(expiry) && expiry >= today;
  const raisesAnAlarm =
    !document.expiry.is_expired && Boolean(expiry) && expiry < today;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await update.mutateAsync({
        id: document.id,
        title: values.title.trim() || null,
        issue_date: values.issue_date || null,
        expiry_date: values.expiry_date || null,
        issuing_country: values.issuing_country
          ? values.issuing_country.toUpperCase()
          : null,
        reference_number: values.reference_number.trim() || null,
      });
      toast.success('Document updated.');
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'The document could not be saved.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {document.doc_type_label}</DialogTitle>
          <DialogDescription>
            {document.original_filename}
            {document.resource_name ? ` · ${document.resource_name}` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="doc_edit_title">Title (optional)</Label>
            <Input id="doc_edit_title" {...register('title')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc_edit_issue">Issued (optional)</Label>
              <Input id="doc_edit_issue" type="date" {...register('issue_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc_edit_expiry">Expires</Label>
              <Input
                id="doc_edit_expiry"
                type="date"
                min={issue || undefined}
                aria-invalid={backwards}
                {...register('expiry_date')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc_edit_country">Issuing country code (optional)</Label>
              <Input
                id="doc_edit_country"
                placeholder="QA"
                maxLength={2}
                {...register('issuing_country')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc_edit_ref">Reference number (optional)</Label>
              <Input id="doc_edit_ref" {...register('reference_number')} />
            </div>
          </div>

          {backwards ? (
            <p className="text-xs text-destructive">
              The expiry cannot be before the issue date.
            </p>
          ) : null}

          {clearsAnAlarm ? (
            <InlineWarning>
              This clears an expired work authorisation. If the renewal is a new document, upload
              it rather than editing this one — the old expiry is part of the record.
            </InlineWarning>
          ) : null}
          {raisesAnAlarm ? (
            <InlineWarning>
              That date is in the past.
              {document.is_work_authorisation
                ? ' The consultant will be flagged as blocked from deployment.'
                : ''}
            </InlineWarning>
          ) : null}

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
            <Button type="submit" loading={update.isPending} disabled={backwards}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
