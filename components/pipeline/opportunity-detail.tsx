'use client';

import { MessageSquarePlus, ThumbsDown, ThumbsUp } from 'lucide-react';
import * as React from 'react';

import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  useCommunications,
  useLogCommunication,
  useRecordDecision,
} from '@/hooks/use-pipeline';
import { formatDateTime } from '@/lib/format';
import { DECISION_LABELS, DECISION_VARIANT } from '@/lib/pipeline';
import type { CommunicationChannel, Opportunity, OpportunityDecision } from '@/types/pipeline';

/**
 * The two things about an opportunity that are not its stage.
 *
 * **The decision** is the human answer to the score, deliberately separate from
 * the stage (AD-5): a team can decline something that scored 91, and that
 * disagreement is the most interesting row in any post-mortem. It had no UI at
 * all until now.
 *
 * **The communication log** is what turns a stage change into something a
 * colleague can pick up — "contacted" means nothing without knowing who said
 * what to whom.
 */

const DECISIONS: OpportunityDecision[] = ['PURSUE', 'HOLD', 'DECLINE'];
const CHANNELS: CommunicationChannel[] = ['NOTE', 'EMAIL', 'PHONE', 'MEETING'];

export function DecisionForm({ opportunity }: { opportunity: Opportunity }) {
  const [decision, setDecision] = React.useState<OpportunityDecision>(
    opportunity.decision ?? 'PURSUE',
  );
  const [reason, setReason] = React.useState('');
  const record = useRecordDecision(opportunity.id);

  const needsReason = decision === 'DECLINE';

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pursue this?
        </h4>
        {opportunity.decision ? (
          <Badge variant={DECISION_VARIANT[opportunity.decision]}>
            {DECISION_LABELS[opportunity.decision]}
            {opportunity.decided_at ? ` · ${formatDateTime(opportunity.decided_at)}` : ''}
          </Badge>
        ) : (
          <span className="text-2xs text-muted-foreground">No decision recorded</span>
        )}
      </div>

      {opportunity.decision_reason ? (
        <p className="text-sm text-muted-foreground">{opportunity.decision_reason}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`decision-${opportunity.id}`}>Decision</Label>
          <Select
            id={`decision-${opportunity.id}`}
            value={decision}
            onChange={(event) => setDecision(event.target.value as OpportunityDecision)}
          >
            {DECISIONS.map((value) => (
              <option key={value} value={value}>
                {DECISION_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`decision-reason-${opportunity.id}`}>
            {needsReason ? 'Reason (required)' : 'Reason'}
          </Label>
          <Input
            id={`decision-reason-${opportunity.id}`}
            value={reason}
            placeholder={needsReason ? 'Why are we walking away?' : 'Optional'}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={needsReason && !reason.trim()}
          />
        </div>
      </div>

      <p className="text-2xs text-muted-foreground">
        A decision is not a stage move. Recording &ldquo;decline&rdquo; on something that scored
        well is exactly the disagreement a post-mortem needs to see.
      </p>

      {record.isError ? <ErrorState error={record.error} /> : null}

      <Button
        size="sm"
        disabled={record.isPending || (needsReason && !reason.trim())}
        loading={record.isPending}
        onClick={() =>
          record.mutate(
            { decision, reason: reason.trim() || undefined },
            { onSuccess: () => setReason('') },
          )
        }
      >
        {decision === 'DECLINE' ? (
          <ThumbsDown aria-hidden />
        ) : (
          <ThumbsUp aria-hidden />
        )}
        Record decision
      </Button>
    </div>
  );
}

export function CommunicationLog({ opportunityId }: { opportunityId: string }) {
  const [channel, setChannel] = React.useState<CommunicationChannel>('NOTE');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  const timeline = useCommunications({ opportunity_id: opportunityId });
  const log = useLogCommunication();

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Contact log
      </h4>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`channel-${opportunityId}`}>Channel</Label>
          <Select
            id={`channel-${opportunityId}`}
            value={channel}
            onChange={(event) => setChannel(event.target.value as CommunicationChannel)}
          >
            {CHANNELS.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`subject-${opportunityId}`}>Subject</Label>
          <Input
            id={`subject-${opportunityId}`}
            value={subject}
            placeholder="Called procurement about the rate"
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`body-${opportunityId}`}>What happened</Label>
        <Input
          id={`body-${opportunityId}`}
          value={body}
          placeholder="Optional detail"
          onChange={(event) => setBody(event.target.value)}
        />
      </div>

      {log.isError ? <ErrorState error={log.error} /> : null}

      <Button
        size="sm"
        variant="outline"
        disabled={!subject.trim() || log.isPending}
        loading={log.isPending}
        onClick={() =>
          log.mutate(
            {
              channel,
              subject: subject.trim(),
              body: body.trim() || undefined,
              opportunity_id: opportunityId,
            },
            {
              onSuccess: () => {
                setSubject('');
                setBody('');
              },
            },
          )
        }
      >
        <MessageSquarePlus aria-hidden />
        Log it
      </Button>

      {timeline.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (timeline.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing logged yet. &ldquo;Contacted&rdquo; means little without a record of who said
          what.
        </p>
      ) : (
        <ol className="space-y-2 border-t pt-2">
          {(timeline.data ?? []).map((item) => (
            <li key={item.id} className="text-xs">
              <span className="font-medium">{item.subject ?? item.channel}</span>
              <span className="text-muted-foreground">
                {' '}
                · {item.channel.toLowerCase()} · {formatDateTime(item.created_at)}
                {item.status !== 'LOGGED' ? ` · ${item.status.toLowerCase()}` : ''}
              </span>
              {item.body ? <p className="mt-0.5 text-muted-foreground">{item.body}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
