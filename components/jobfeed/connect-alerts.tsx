'use client';

import { Check, Copy, Mail, Sparkles } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import {
  ErrorState,
  InlineWarning,
  LoadingState,
  PermissionDeniedState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAlertConnection, usePasteAlert } from '@/hooks/use-jobfeed';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatRelative } from '@/lib/format';

/**
 * Connecting LinkedIn job alerts.
 *
 * The honesty problem this screen exists to avoid: a button labelled "Connect
 * with LinkedIn" would make people believe LinkedIn is sending us their jobs.
 * It is not, and no API exists that would let it. Their own forwarding rule is
 * what delivers the mail, so the screen says that in as many words and shows
 * the address doing the work.
 */

const PROVIDERS: Array<{ name: string; steps: string[] }> = [
  {
    name: 'Gmail',
    steps: [
      'Settings, then See all settings',
      'Filters and Blocked Addresses, then Create a new filter',
      'In From, enter jobalerts-noreply@linkedin.com',
      'Create filter, then tick Forward it to and add the address above',
    ],
  },
  {
    name: 'Outlook',
    steps: [
      'Settings, then Mail, then Rules',
      'Add new rule',
      'Condition: From contains linkedin.com',
      'Action: Forward to, and add the address above',
    ],
  },
];

export function ConnectAlerts() {
  const can = useAuthStore((state) => state.can);
  const connection = useAlertConnection();
  const paste = usePasteAlert();

  const [copied, setCopied] = React.useState(false);
  const [pasted, setPasted] = React.useState('');
  const [result, setResult] = React.useState<string | null>(null);

  if (!can('job_feed:read')) return <PermissionDeniedState />;
  if (connection.isLoading) return <LoadingState label="Loading your connection…" />;
  if (connection.isError) {
    return <ErrorState error={connection.error} onRetry={() => void connection.refetch()} />;
  }

  const data = connection.data;
  if (!data) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.forwarding_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy. Select the address and copy it by hand.');
    }
  };

  const importPasted = async () => {
    setResult(null);
    try {
      const outcome = await paste.mutateAsync({ body: pasted });
      if (!outcome.recognised) {
        setResult(outcome.message ?? 'That does not look like a LinkedIn job alert.');
        return;
      }
      setPasted('');
      setResult(
        `Added ${outcome.added} job${outcome.added === 1 ? '' : 's'} to your feed` +
          (outcome.unparsed > 0 ? `, and could not read ${outcome.unparsed}.` : '.'),
      );
      toast.success('Imported into your feed.');
    } catch (error) {
      setResult(error instanceof ApiError ? error.message : 'That could not be imported.');
    }
  };

  return (
    <>
      <PageHeader
        title="Connect your LinkedIn job alerts"
        description="LinkedIn has no way to send us your alerts directly, so you forward them. Takes a minute, and only needs doing once."
        actions={
          data.verified ? (
            <Badge variant="success">
              <Check className="h-3 w-3" aria-hidden />
              Receiving alerts
            </Badge>
          ) : (
            <Badge variant="muted">Not connected yet</Badge>
          )
        }
      />

      {!data.enabled ? (
        <InlineWarning>
          Forwarding is not switched on for this deployment yet, so the address below will not
          receive anything. You can still import an alert by pasting it, lower down.
        </InlineWarning>
      ) : null}

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" aria-hidden />
            Your private forwarding address
          </CardTitle>
          <CardDescription>
            Unique to you. Anything sent here lands in your feed and nobody else&apos;s.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              readOnly
              value={data.forwarding_address}
              aria-label="Your forwarding address"
              className="max-w-md font-mono text-sm"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button variant="outline" onClick={() => void copy()}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          {data.verified ? (
            <p className="text-sm text-success">
              Working. {data.count} job{data.count === 1 ? '' : 's'} received
              {data.last_received_at ? `, most recently ${formatRelative(data.last_received_at)}` : ''}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing has arrived yet. This turns green on its own once the first alert comes
              through — there is no button to press.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map((provider) => (
          <Card key={provider.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{provider.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
                {provider.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden />
            Or paste an alert now
          </CardTitle>
          <CardDescription>
            Open a LinkedIn alert email, select all, copy, and paste it here. Useful for trying
            this out before the forwarding rule is set up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pasted_alert">The email</Label>
            <textarea
              id="pasted_alert"
              rows={6}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder="Paste the whole email here…"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {result ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">{result}</div>
          ) : null}

          <Button
            onClick={() => void importPasted()}
            loading={paste.isPending}
            disabled={pasted.trim().length < 20}
          >
            Import into my feed
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
