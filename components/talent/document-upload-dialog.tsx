'use client';

import { Upload } from 'lucide-react';
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
import { Select } from '@/components/ui/select';
import { useUploadDocument } from '@/hooks/use-talent';
import { ApiError } from '@/lib/api';
import { DOCUMENT_TYPE_ORDER, isWorkAuthorisation } from '@/lib/talent';
import type { DocumentType } from '@/types/talent';

/**
 * Attach a document to a consultant.
 *
 * The expiry date is the point of this screen. A visa or work permit with no
 * recorded expiry cannot be warned about, and an unwarned lapse stops billing
 * on a live deployment — so the form insists on one for work authorisation
 * rather than accepting a file and quietly losing the date.
 */

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  CV: 'CV',
  PASSPORT: 'Passport',
  ID: 'National ID',
  QID: 'Qatar ID (QID)',
  VISA: 'Visa',
  WORK_PERMIT: 'Work permit',
  CONTRACT: 'Contract',
  CERTIFICATE: 'Certificate',
  OTHER: 'Other',
};

interface FormValues {
  doc_type: DocumentType;
  title: string;
  issue_date: string;
  expiry_date: string;
  issuing_country: string;
  reference_number: string;
}

const DEFAULTS: FormValues = {
  doc_type: 'PASSPORT',
  title: '',
  issue_date: '',
  expiry_date: '',
  issuing_country: '',
  reference_number: '',
};

export function DocumentUploadDialog({
  open,
  onOpenChange,
  resourceId,
  resourceName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceName?: string;
}) {
  const upload = useUploadDocument(resourceId);
  const [file, setFile] = React.useState<File | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: DEFAULTS,
  });

  const docType = watch('doc_type');
  const expiry = watch('expiry_date');
  const issue = watch('issue_date');

  const needsExpiry = isWorkAuthorisation(docType);
  const missingExpiry = needsExpiry && !expiry;
  const backwardsDates = Boolean(issue && expiry) && expiry < issue;
  const alreadyExpired = Boolean(expiry) && expiry < new Date().toISOString().slice(0, 10);

  React.useEffect(() => {
    if (open) {
      reset(DEFAULTS);
      setFile(null);
      setServerError(null);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!file) {
      setServerError('Choose a file to upload.');
      return;
    }
    setServerError(null);
    try {
      await upload.mutateAsync({
        file,
        doc_type: values.doc_type,
        title: values.title || undefined,
        issue_date: values.issue_date || undefined,
        expiry_date: values.expiry_date || undefined,
        issuing_country: values.issuing_country
          ? values.issuing_country.toUpperCase()
          : undefined,
        reference_number: values.reference_number || undefined,
      });
      toast.success('Document uploaded.');
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'The document could not be uploaded.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Upload a document{resourceName ? ` for ${resourceName}` : ''}
          </DialogTitle>
          <DialogDescription>
            Record the expiry date and the platform will warn before it lapses. An expired work
            permit stops billing on a live deployment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="document-file">File</Label>
            <Input
              id="document-file"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc_type">Document type</Label>
              <Select id="doc_type" {...register('doc_type')}>
                {DOCUMENT_TYPE_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {DOC_TYPE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title (optional)</Label>
              <Input id="title" placeholder="Qatar work visa 2026" {...register('title')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="issue_date">Issued (optional)</Label>
              <Input id="issue_date" type="date" {...register('issue_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiry_date">
                Expires{needsExpiry ? '' : ' (optional)'}
              </Label>
              <Input
                id="expiry_date"
                type="date"
                min={issue || undefined}
                aria-invalid={missingExpiry || backwardsDates}
                {...register('expiry_date')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="issuing_country">Issuing country code (optional)</Label>
              <Input
                id="issuing_country"
                placeholder="QA"
                maxLength={2}
                {...register('issuing_country')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reference_number">Reference number (optional)</Label>
              <Input id="reference_number" {...register('reference_number')} />
            </div>
          </div>

          {missingExpiry ? (
            <InlineWarning>
              A {DOC_TYPE_LABELS[docType].toLowerCase()} needs an expiry date. Without one the
              platform cannot warn you before it lapses, and the consultant will show as blocked
              from deployment.
            </InlineWarning>
          ) : null}
          {backwardsDates ? (
            <p className="text-xs text-destructive">The expiry cannot be before the issue date.</p>
          ) : null}
          {alreadyExpired && !backwardsDates ? (
            <InlineWarning>
              That date is in the past. The consultant will be flagged as blocked from deployment
              until a renewal is uploaded.
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
            <Button
              type="submit"
              loading={upload.isPending}
              disabled={!file || missingExpiry || backwardsDates}
            >
              <Upload aria-hidden />
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
