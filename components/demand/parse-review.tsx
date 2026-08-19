'use client';

import { AlertTriangle, Check, CircleAlert, Eye, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { EvidenceText } from '@/components/demand/evidence-text';
import { ErrorState, InlineWarning, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAcceptParse, useParseResult, useRejectParse } from '@/hooks/use-requirements';
import { ApiError } from '@/lib/api';
import { CONFIDENCE_VARIANT, formatParsedValue } from '@/lib/demand';
import { cn } from '@/lib/utils';
import type { ParsedField } from '@/types/demand';

/**
 * Side-by-side review of an AI-extracted requirement.
 *
 * Nothing here is business data yet. The reviewer confirms each flagged field —
 * money and dates always, plus anything the parser was unsure about — and only
 * then does the requirement become usable by the rest of the platform (AD-7).
 */
export function ParseReview({ requirementId }: { requirementId: string }) {
  const router = useRouter();
  const parse = useParseResult(requirementId);
  const accept = useAcceptParse(requirementId);
  const reject = useRejectParse(requirementId);

  const [confirmed, setConfirmed] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (parse.isLoading) return <LoadingState label="Loading the extraction…" />;
  if (parse.isError) {
    return <ErrorState error={parse.error} onRetry={() => void parse.refetch()} />;
  }

  const data = parse.data;
  if (!data) return null;

  const found = data.fields.filter((field) => field.value !== null && field.value !== undefined);
  const missing = data.fields.filter((field) => field.value === null || field.value === undefined);
  const required = data.confirmation_required;
  const outstanding = required.filter((field) => !confirmed.has(field));
  const activeField = data.fields.find((field) => field.field === selected) ?? null;

  const toggle = (field: string) => {
    setConfirmed((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const confirmAll = () => setConfirmed(new Set(required));

  const onAccept = async () => {
    setError(null);
    try {
      await accept.mutateAsync({ confirmed_fields: Array.from(confirmed) });
      toast.success('Requirement accepted. It is now usable by the rest of the platform.');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The requirement could not be accepted.');
    }
  };

  const onReject = async () => {
    setError(null);
    try {
      await reject.mutateAsync('Rejected at review');
      toast.success('Requirement rejected and closed.');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The requirement could not be rejected.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                Review the extracted fields
              </CardTitle>
              <CardDescription>
                Nothing here counts as business data until you accept it. Click a field to see the
                exact words it came from.
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={data.used_fallback ? 'warning' : 'muted'}>
                {data.provider === 'null' ? 'Rule-based parser' : data.provider}
              </Badge>
              <span className="text-2xs text-muted-foreground">
                overall confidence {Math.round(data.overall_confidence * 100)}%
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {data.used_fallback && (
            <InlineWarning>
              AI extraction was unavailable, so these fields came from the rule-based parser. Check
              them carefully before accepting.
            </InlineWarning>
          )}

          {data.warnings.map((warning) => (
            <InlineWarning key={warning}>{warning}</InlineWarning>
          ))}

          {data.unresolved_skills.length > 0 && (
            <InlineWarning>
              These skills are not on the master list yet and will be created for an administrator
              to merge: <strong>{data.unresolved_skills.join(', ')}</strong>
            </InlineWarning>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3">
            <span className="text-sm">
              <strong className="tabular">{outstanding.length}</strong> of{' '}
              <span className="tabular">{required.length}</span> fields still need confirming
            </span>
            {outstanding.length > 0 && (
              <Button variant="outline" size="sm" onClick={confirmAll}>
                <Check aria-hidden />
                Confirm all as shown
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              Rates and dates always need a human eye — a wrong rate corrupts every commercial
              figure downstream.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Extracted values</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {found.map((field) => (
                <FieldRow
                  key={field.field}
                  field={field}
                  isConfirmed={confirmed.has(field.field)}
                  isSelected={selected === field.field}
                  onSelect={() => setSelected(field.field)}
                  onToggle={() => toggle(field.field)}
                />
              ))}
            </ul>

            {missing.length > 0 && (
              <div className="mt-4 rounded-md border border-dashed p-3">
                <p className="text-xs font-medium">The parser did not find these</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Left blank rather than guessed. Fill them in on the requirement after accepting.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {missing.map((field) => (
                    <Badge key={field.field} variant="muted">
                      {field.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" aria-hidden />
              Source job description
            </CardTitle>
            <CardDescription>
              {activeField
                ? `Showing where "${activeField.label}" came from`
                : 'Select a field to highlight its evidence'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EvidenceText
              text={data.source_text}
              start={activeField?.evidence_start}
              end={activeField?.evidence_end}
            />
            {activeField && !activeField.evidence && (
              <p className="mt-2 text-xs text-muted-foreground">
                This value was inferred rather than quoted, so there is no exact span to highlight.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void onAccept()} loading={accept.isPending} disabled={outstanding.length > 0}>
          <Check aria-hidden />
          Accept requirement
        </Button>
        <Button variant="outline" onClick={() => void onReject()} loading={reject.isPending}>
          <X aria-hidden />
          Reject
        </Button>
        {outstanding.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Confirm the {outstanding.length} highlighted field{outstanding.length === 1 ? '' : 's'}{' '}
            to enable accepting.
          </span>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  isConfirmed,
  isSelected,
  onSelect,
  onToggle,
}: {
  field: ParsedField;
  isConfirmed: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <li
      className={cn(
        'flex items-start gap-3 py-2.5 transition-colors',
        isSelected && 'bg-accent/5',
      )}
    >
      {field.requires_confirmation ? (
        <input
          type="checkbox"
          checked={isConfirmed}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0 rounded border-input"
          aria-label={`Confirm ${field.label}`}
        />
      ) : (
        <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-label="Accepted automatically" />
      )}

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
        aria-pressed={isSelected}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium">{field.label}</span>
          <Badge variant={CONFIDENCE_VARIANT[field.level]}>
            {Math.round(field.confidence * 100)}%
          </Badge>
          {field.requires_confirmation && !isConfirmed && (
            <Badge variant="warning">
              <CircleAlert className="h-3 w-3" aria-hidden />
              Confirm
            </Badge>
          )}
        </div>
        <div className="mt-0.5 break-words text-sm text-muted-foreground">
          {formatParsedValue(field.value)}
        </div>
        {field.evidence && (
          <div className="mt-1 truncate font-mono text-2xs text-muted-foreground/80">
            “{field.evidence}”
          </div>
        )}
      </button>
    </li>
  );
}
