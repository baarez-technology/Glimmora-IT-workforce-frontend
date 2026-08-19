'use client';

import { CheckCircle2, FlaskConical, History, Sliders } from 'lucide-react';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import {
  ErrorState,
  InlineWarning,
  PermissionDeniedState,
  TableLoadingState,
} from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { useScoringConfigurations, matchingKeys } from '@/hooks/use-matching';
import { useSimulateConfig } from '@/hooks/use-scoring';
import { useAuthStore } from '@/lib/auth-store';
import { formatDateTime, formatScore } from '@/lib/format';
import { OPPORTUNITY_BAND_LABELS, formatDelta } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import type { ScoringConfiguration } from '@/types/matching';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Matching weights, versioned.
 *
 * AD-2: scoring rules are data, not code. Changing how Glimmora ranks a
 * candidate is an administrator action taken here, and every match records the
 * rule version that produced it — so a score from six months ago stays
 * explainable after the rules move on.
 *
 * Phase 9 extends this screen with the addressability, commercial and
 * opportunity rule sets, plus a simulation preview. Only matching weights are
 * editable today.
 */

const COMPONENT_LABELS: Record<string, string> = {
  skills: 'Skills',
  experience: 'Experience',
  technology: 'Technology',
  availability: 'Availability',
  location: 'Location',
  cost: 'Cost fit',
  commercial: 'Commercial fit',
};

const COMPONENT_ORDER = [
  'skills',
  'experience',
  'technology',
  'availability',
  'location',
  'cost',
  'commercial',
];

function WeightEditor({
  active,
  onPublished,
}: {
  active: ScoringConfiguration;
  onPublished: () => void;
}) {
  const baseline = React.useMemo(
    () => ({ ...(active.payload.weights ?? {}) }) as Record<string, number>,
    [active],
  );
  const [weights, setWeights] = React.useState<Record<string, number>>(baseline);
  const [name, setName] = React.useState('');

  React.useEffect(() => setWeights(baseline), [baseline]);

  const total = COMPONENT_ORDER.reduce((sum, key) => sum + (Number(weights[key]) || 0), 0);
  const balanced = Math.abs(total - 100) < 0.01;
  const changed = COMPONENT_ORDER.some((key) => (weights[key] ?? 0) !== (baseline[key] ?? 0));

  const publish = useMutation({
    mutationFn: () =>
      api.post<ScoringConfiguration>('/scoring/configurations', {
        kind: 'MATCH_WEIGHTS',
        name: name.trim(),
        payload: { ...active.payload, weights },
        activate: false,
      }),
    onSuccess: () => {
      setName('');
      onPublished();
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Publish a new weighting</CardTitle>
        <CardDescription>
          Weights must total 100. Publishing creates the next version without activating it, so you
          can review before it affects any run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COMPONENT_ORDER.map((key) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`weight-${key}`}>{COMPONENT_LABELS[key] ?? key}</Label>
              <Input
                id={`weight-${key}`}
                type="number"
                min={0}
                max={100}
                step={1}
                value={String(weights[key] ?? 0)}
                onChange={(event) =>
                  setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))
                }
              />
            </div>
          ))}
        </div>

        <div
          className={cn(
            'flex items-center justify-between rounded-md border p-3 text-sm',
            balanced ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5',
          )}
          role="status"
          aria-live="polite"
        >
          <span>Total weight</span>
          <span className="tabular font-semibold">
            {total}
            {balanced ? '' : ' — must be 100'}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1 space-y-1.5">
            <Label htmlFor="ruleset-name">Name this version</Label>
            <Input
              id="ruleset-name"
              value={name}
              placeholder="e.g. Skills-weighted for SAP demand"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button
            onClick={() => publish.mutate()}
            disabled={!balanced || !changed || name.trim().length < 2 || publish.isPending}
            loading={publish.isPending}
          >
            Publish version
          </Button>
          {changed ? (
            <Button variant="ghost" onClick={() => setWeights(baseline)}>
              Reset
            </Button>
          ) : null}
        </div>

        {publish.isError ? <ErrorState error={publish.error} /> : null}
        {!changed ? (
          <p className="text-xs text-muted-foreground">
            These are the active weights. Change one to publish a new version.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * What would activating this draft actually do?
 *
 * An admin editing a weight is changing how the business prioritises its sales
 * effort. Activating first and finding out afterwards is how a scoring system
 * loses trust in its first week, so the impact is shown before the decision.
 */
function SimulationPanel({ configId, onClose }: { configId: string; onClose: () => void }) {
  const simulate = useSimulateConfig();

  React.useEffect(() => {
    simulate.mutate(configId);
    // Fire once per version chosen; the mutation object itself is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId]);

  const result = simulate.data;

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden />
              Impact preview
            </CardTitle>
            <CardDescription>
              Recent requirements re-scored under this draft. Nothing is saved and nothing is
              activated — this is what would happen if you activated it.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {simulate.isError ? (
          <ErrorState error={simulate.error} />
        ) : simulate.isPending ? (
          <TableLoadingState rows={4} columns={5} />
        ) : result && result.evaluated === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing has been scored yet, so there is no impact to preview. Score a requirement
            first and this comparison becomes meaningful.
          </p>
        ) : result ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <div className="text-2xs text-muted-foreground">Requirements re-scored</div>
                <div className="mt-0.5 text-xl font-semibold tabular">{result.evaluated}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xs text-muted-foreground">Scores that move</div>
                <div className="mt-0.5 text-xl font-semibold tabular">{result.changed}</div>
              </div>
              <div
                className={cn(
                  'rounded-md border p-3',
                  result.band_changes > 0 && 'border-warning/50 bg-warning/5',
                )}
              >
                <div className="text-2xs text-muted-foreground">Band changes</div>
                <div className="mt-0.5 text-xl font-semibold tabular">{result.band_changes}</div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Average movement {formatDelta(result.average_delta)} points. Band changes matter most
              — they change what Sales is told to do.
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requirement</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead>Band</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.slice(0, 15).map((row) => (
                  <TableRow key={row.requirement_id}>
                    <TableCell className="text-sm">
                      {row.requirement_title ?? 'Untitled requirement'}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatScore(row.before_score)}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatScore(row.after_score)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular',
                        row.delta > 0 && 'text-success',
                        row.delta < 0 && 'text-destructive',
                      )}
                    >
                      {formatDelta(row.delta)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.band_changed ? (
                        <span className="text-warning">
                          {OPPORTUNITY_BAND_LABELS[row.before_band]} →{' '}
                          {OPPORTUNITY_BAND_LABELS[row.after_band]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">unchanged</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ScoringRules() {
  const can = useAuthStore((state) => state.can);
  const queryClient = useQueryClient();
  const configurations = useScoringConfigurations('MATCH_WEIGHTS');
  const [simulating, setSimulating] = React.useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: matchingKeys.configurations('MATCH_WEIGHTS') });
    void queryClient.invalidateQueries({ queryKey: matchingKeys.all });
  };

  const activate = useMutation({
    mutationFn: (id: string) =>
      api.post<ScoringConfiguration>(`/scoring/configurations/${id}/activate`),
    onSuccess: invalidate,
  });

  if (!can('scoring_config:read')) return <PermissionDeniedState />;

  const canEdit = can('scoring_config:edit');
  const versions = configurations.data ?? [];
  const active = versions.find((config) => config.is_active);

  return (
    <>
      <PageHeader
        title="Scoring Rules"
        description="How Glimmora ranks a candidate against a requirement. These weights are configuration, not code — publishing a new version changes the next run, and every stored match records which version produced it."
      />

      {configurations.isError ? (
        <ErrorState error={configurations.error} onRetry={() => void configurations.refetch()} />
      ) : configurations.isLoading ? (
        <TableLoadingState rows={3} columns={4} />
      ) : (
        <div className="space-y-4">
          {active ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-muted-foreground" aria-hidden />
                      {active.name}
                    </CardTitle>
                    <CardDescription>
                      Version {active.version} · in force since {formatDateTime(active.created_at)}
                    </CardDescription>
                  </div>
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {COMPONENT_ORDER.map((key) => {
                    const weight = Number(active.payload.weights?.[key] ?? 0);
                    return (
                      <li key={key} className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">
                          {COMPONENT_LABELS[key] ?? key}
                        </div>
                        <div className="mt-0.5 text-lg font-semibold tabular">{weight}%</div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${weight}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {active.notes ? (
                  <p className="mt-3 text-xs text-muted-foreground">{active.notes}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <InlineWarning>
            Changing the weights does not rescore anything on its own. Existing matches keep the
            version that produced them; re-run matching on a requirement to score it under the new
            rules.
          </InlineWarning>

          {canEdit && active ? <WeightEditor active={active} onPublished={invalidate} /> : null}

          {simulating ? (
            <SimulationPanel configId={simulating} onClose={() => setSimulating(null)} />
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" aria-hidden />
                Version history
              </CardTitle>
              <CardDescription>
                Older versions are kept so historical scores stay explainable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Weights</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="tabular">v{config.version}</TableCell>
                      <TableCell>{config.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {COMPONENT_ORDER.map((key) => `${COMPONENT_LABELS[key] ?? key} ${config.payload.weights?.[key] ?? 0}`).join(' · ')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(config.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {config.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : canEdit ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSimulating(config.id)}
                            >
                              Preview impact
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => activate.mutate(config.id)}
                              disabled={activate.isPending}
                            >
                              Activate
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="muted">Superseded</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {activate.isError ? <ErrorState error={activate.error} /> : null}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
