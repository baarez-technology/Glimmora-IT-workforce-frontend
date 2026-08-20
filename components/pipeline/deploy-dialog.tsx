'use client';

import { Briefcase } from 'lucide-react';
import * as React from 'react';

import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateDeployment } from '@/hooks/use-delivery';
import type { Submission } from '@/types/pipeline';

/**
 * Place a selected candidate.
 *
 * This is the handover from pipeline to delivery, and it was the one step of
 * the journey with no button: a submission could reach SELECTED and stop there,
 * because deploying was only reachable through the API.
 *
 * The rates default from the submission and the consultant but are **copied**
 * into the deployment, not referenced — a renegotiation later must not rewrite
 * an earlier month's billing.
 */
export function DeployForm({
  submission,
  onDone,
}: {
  submission: Submission;
  onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = React.useState(today);
  const [end, setEnd] = React.useState('');
  const [rate, setRate] = React.useState(submission.proposed_bill_rate ?? '');
  const deploy = useCreateDeployment();

  const invalidRange = Boolean(end) && end < start;

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <p className="text-sm font-medium">
        Deploy {submission.resource_name ?? 'this consultant'}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`deploy-start-${submission.id}`}>Start date</Label>
          <Input
            id={`deploy-start-${submission.id}`}
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`deploy-end-${submission.id}`}>End date</Label>
          <Input
            id={`deploy-end-${submission.id}`}
            type="date"
            value={end}
            min={start}
            onChange={(event) => setEnd(event.target.value)}
            aria-invalid={invalidRange}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`deploy-rate-${submission.id}`}>Bill rate (monthly)</Label>
          <Input
            id={`deploy-rate-${submission.id}`}
            type="number"
            min={0}
            placeholder="From the submission"
            value={rate ?? ''}
            onChange={(event) => setRate(event.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        The rates are copied onto the deployment, so a later renegotiation creates an extension
        rather than rewriting this engagement&apos;s billing. Leaving the end date blank projects a
        bounded twelve-month horizon.
      </p>

      {invalidRange ? (
        <p className="text-xs text-destructive">The end date cannot be before the start.</p>
      ) : null}
      {deploy.isError ? <ErrorState error={deploy.error} /> : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!start || invalidRange || deploy.isPending}
          loading={deploy.isPending}
          onClick={() =>
            deploy.mutate(
              {
                submission_id: submission.id,
                start_date: start,
                end_date: end || undefined,
                bill_rate: rate || undefined,
              },
              { onSuccess: onDone },
            )
          }
        >
          <Briefcase aria-hidden />
          Create deployment
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
