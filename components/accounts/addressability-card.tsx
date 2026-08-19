'use client';

import { Check, CircleHelp, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ADDRESSABILITY_FACTORS } from '@/lib/accounts';
import { cn } from '@/lib/utils';
import type { AddressabilitySignals } from '@/types/accounts';

/**
 * The Addressability inputs an account contributes.
 *
 * This is not the score — Phase 9 computes that from these facts plus the
 * requirement, the talent pool and the commercials. What this card does is make
 * *unrecorded* facts visible now, because an account with blank flags will
 * later score badly for the wrong reason: not "we cannot reach them" but
 * "nobody told us whether we can" (SCORING.md section 1).
 */
export function AddressabilityCard({
  signals,
  routeCount,
}: {
  signals: AddressabilitySignals | null;
  routeCount: number;
}) {
  if (!signals) return null;

  const { signals_met: met, signals_total: total } = signals;
  const completeness = Math.round((met / total) * 100);

  const tone =
    met >= 4 ? 'text-success' : met >= 2 ? 'text-warning' : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Addressability inputs</CardTitle>
            <CardDescription>
              What Phase 9 will score this account on. Not a score yet.
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={cn('text-2xl font-semibold tabular', tone)}>
              {met}
              <span className="text-base text-muted-foreground">/{total}</span>
            </div>
            <div className="text-2xs text-muted-foreground">recorded</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div
          className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={completeness}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Addressability facts recorded"
        >
          <div
            className={cn(
              'h-full rounded-full transition-all',
              met >= 4 ? 'bg-success' : met >= 2 ? 'bg-warning' : 'bg-muted-foreground/40',
            )}
            style={{ width: `${completeness}%` }}
          />
        </div>

        <ul className="space-y-2.5">
          {ADDRESSABILITY_FACTORS.map((factor) => {
            const isMet = Boolean(signals[factor.key]);
            // A direct relationship legitimately needs no partner route. That is
            // a neutral zero, not a deficiency, so it must not read as a failure.
            const isNeutral =
              factor.key === 'partner_or_prime_route' &&
              !isMet &&
              routeCount === 0 &&
              signals.existing_customer;

            return (
              <li key={factor.key} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    isMet && 'bg-success/15 text-success',
                    !isMet && isNeutral && 'bg-muted text-muted-foreground',
                    !isMet && !isNeutral && 'bg-warning/15 text-warning',
                  )}
                >
                  {isMet ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : isNeutral ? (
                    <Minus className="h-3 w-3" aria-hidden />
                  ) : (
                    <CircleHelp className="h-3 w-3" aria-hidden />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'text-sm',
                        isMet ? 'font-medium' : 'text-muted-foreground',
                      )}
                    >
                      {factor.label}
                    </span>
                    <span className="shrink-0 text-2xs tabular text-muted-foreground">
                      +{factor.points}
                    </span>
                  </div>
                  {!isMet && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {isNeutral
                        ? 'Direct relationship — no partner route required.'
                        : factor.hint}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {signals.missing.length > 0 && (
          <div className="mt-4 rounded-md border border-warning/40 bg-warning/5 p-3">
            <p className="text-xs font-medium">
              {signals.missing.length} fact{signals.missing.length === 1 ? '' : 's'} still
              unrecorded
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Until these are confirmed, this account will score low because the answer is
              unknown — not because it is a no.
            </p>
          </div>
        )}

        {signals.missing.length === 0 && (
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="success">All inputs recorded</Badge>
            <span className="text-xs text-muted-foreground">Ready for opportunity scoring</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
