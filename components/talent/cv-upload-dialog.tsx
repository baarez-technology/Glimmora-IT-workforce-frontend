'use client';

import { AlertTriangle, Check, CircleAlert, Sparkles, Upload, Users } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { ErrorState, InlineWarning, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
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
import { useAcceptCV, useCVParseResult, useParseCV } from '@/hooks/use-talent';
import { ApiError } from '@/lib/api';
import { CONFIDENCE_VARIANT, formatParsedValue } from '@/lib/demand';
import { cn } from '@/lib/utils';
import type { CVParseResult, ParsedCVField } from '@/types/talent';

/**
 * Upload a CV, then review what the parser extracted.
 *
 * Two steps on purpose (AD-7). Parsing creates a profile in a `needs_review`
 * state that the rest of the platform refuses to submit; a human confirms each
 * flagged field, and only then is it real talent data. The extraction is never
 * treated as fact just because a model was confident.
 *
 * Review can be resumed later — see `CVReviewDialog`. A profile parked in
 * `needs_review` with no way back to it would be a consultant nobody could ever
 * make matchable.
 */

const ACCEPT = '.pdf,.doc,.docx,.txt';

function FieldRow({
  field,
  confirmed,
  onToggle,
}: {
  field: ParsedCVField;
  confirmed: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-md border p-3',
        field.requires_confirmation && !confirmed && 'border-warning/50 bg-warning/5',
        confirmed && 'border-success/40 bg-success/5',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{field.label}</span>
          <Badge variant={CONFIDENCE_VARIANT[field.level]}>
            {Math.round(field.confidence * 100)}%
          </Badge>
          {field.requires_confirmation ? <Badge variant="outline">Needs confirming</Badge> : null}
        </div>
        <p className="mt-0.5 break-words text-sm">{formatParsedValue(field.value)}</p>
        {field.evidence ? (
          <p className="mt-1 border-l-2 pl-2 text-xs italic text-muted-foreground">
            &ldquo;{field.evidence}&rdquo;
          </p>
        ) : null}
      </div>

      {field.requires_confirmation ? (
        <Button
          type="button"
          variant={confirmed ? 'outline' : 'default'}
          size="sm"
          onClick={onToggle}
          aria-pressed={confirmed}
        >
          <Check aria-hidden />
          {confirmed ? 'Confirmed' : 'Confirm'}
        </Button>
      ) : null}
    </li>
  );
}

/** The shared review body: provenance, duplicates, warnings, field list. */
function ParseReviewBody({
  result,
  confirmed,
  onToggle,
}: {
  result: CVParseResult;
  confirmed: Set<string>;
  onToggle: (field: string) => void;
}) {
  const outstanding = result.fields.filter(
    (field) => field.requires_confirmation && !confirmed.has(field.field),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          Extracted with <strong>{result.model_id}</strong> at{' '}
          <strong>{Math.round(result.overall_confidence * 100)}%</strong> overall confidence.
        </span>
        {result.used_fallback ? <Badge variant="outline">Rule-based fallback</Badge> : null}
      </div>

      {result.duplicates.length > 0 ? (
        <InlineWarning>
          <p className="font-medium">
            <Users className="mr-1 inline h-4 w-4" aria-hidden />
            This person may already be in the talent cloud
          </p>
          <ul className="mt-1 space-y-1">
            {result.duplicates.map((duplicate) => (
              <li key={duplicate.resource_id}>
                <Link
                  href={`/talent/resources/${duplicate.resource_id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {duplicate.full_name}
                </Link>{' '}
                <span className="text-muted-foreground">&mdash; {duplicate.reason}</span>
              </li>
            ))}
          </ul>
        </InlineWarning>
      ) : null}

      {result.warnings.length > 0 ? (
        <InlineWarning>
          <ul className="space-y-1">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </InlineWarning>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">
          Extracted fields
          {outstanding.length > 0 ? (
            <span className="ml-2 text-xs font-normal text-warning">
              <CircleAlert className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              {outstanding.length} still to confirm
            </span>
          ) : null}
        </p>
        <ul className="space-y-2">
          {result.fields.map((field) => (
            <FieldRow
              key={field.field}
              field={field}
              confirmed={confirmed.has(field.field)}
              onToggle={() => onToggle(field.field)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function useConfirmations(reset: unknown) {
  const [confirmed, setConfirmed] = React.useState<Set<string>>(new Set());
  React.useEffect(() => setConfirmed(new Set()), [reset]);
  const toggle = React.useCallback((field: string) => {
    setConfirmed((previous) => {
      const next = new Set(previous);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);
  return { confirmed, toggle };
}

function outstandingOf(result: CVParseResult | null | undefined, confirmed: Set<string>) {
  return (result?.fields ?? []).filter(
    (field) => field.requires_confirmation && !confirmed.has(field.field),
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden />
      {message}
    </div>
  );
}

export function CVUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const parse = useParseCV();
  const [result, setResult] = React.useState<CVParseResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { confirmed, toggle } = useConfirmations(open);
  const accept = useAcceptCV(result?.resource_id ?? '');

  React.useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
    }
  }, [open]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setResult(await parse.mutateAsync(file));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'The CV could not be read. Try a PDF, Word file or plain text.',
      );
    }
  };

  const outstanding = outstandingOf(result, confirmed);

  const onAccept = async () => {
    if (!result) return;
    setError(null);
    try {
      await accept.mutateAsync({ confirmed_fields: Array.from(confirmed) });
      toast.success('Profile accepted. The consultant is now matchable.');
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The profile could not be accepted.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload a CV</DialogTitle>
          <DialogDescription>
            The platform extracts a profile for you to review. Nothing becomes matchable talent
            until a human confirms it.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cv-file">CV file</Label>
              <Input
                id="cv-file"
                type="file"
                accept={ACCEPT}
                disabled={parse.isPending}
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
              <p className="text-xs text-muted-foreground">
                PDF, Word or plain text. The profile is created straight away but stays out of
                matching until you accept it.
              </p>
            </div>

            {parse.isPending ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                <Sparkles className="h-4 w-4 animate-pulse" aria-hidden />
                Reading the CV…
              </div>
            ) : null}
          </div>
        ) : (
          <ParseReviewBody result={result} confirmed={confirmed} onToggle={toggle} />
        )}

        {error ? <ErrorBanner message={error} /> : null}

        <DialogFooter>
          {result ? (
            <Button variant="ghost" asChild>
              <Link href={`/talent/resources/${result.resource_id}`}>Review later</Link>
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {result ? (
            <Button
              onClick={() => void onAccept()}
              loading={accept.isPending}
              disabled={outstanding.length > 0}
              title={
                outstanding.length > 0 ? 'Confirm every flagged field before accepting' : undefined
              }
            >
              <Upload aria-hidden />
              Accept profile
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Resume the review of a profile already parked in `needs_review`. */
export function CVReviewDialog({
  open,
  onOpenChange,
  resourceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
}) {
  const parseResult = useCVParseResult(resourceId, open);
  const accept = useAcceptCV(resourceId);
  const { confirmed, toggle } = useConfirmations(open);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const outstanding = outstandingOf(parseResult.data, confirmed);

  const onAccept = async () => {
    setError(null);
    try {
      await accept.mutateAsync({ confirmed_fields: Array.from(confirmed) });
      toast.success('Profile accepted. The consultant is now matchable.');
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The profile could not be accepted.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review the extracted profile</DialogTitle>
          <DialogDescription>
            Confirm each flagged field. Until then this consultant stays out of matching and cannot
            be submitted.
          </DialogDescription>
        </DialogHeader>

        {parseResult.isLoading ? (
          <LoadingState label="Loading the extraction…" />
        ) : parseResult.isError ? (
          <ErrorState error={parseResult.error} onRetry={() => void parseResult.refetch()} />
        ) : parseResult.data ? (
          <ParseReviewBody result={parseResult.data} confirmed={confirmed} onToggle={toggle} />
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => void onAccept()}
            loading={accept.isPending}
            disabled={!parseResult.data || outstanding.length > 0}
            title={
              outstanding.length > 0 ? 'Confirm every flagged field before accepting' : undefined
            }
          >
            <Check aria-hidden />
            Accept profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
