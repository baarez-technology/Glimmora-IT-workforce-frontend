'use client';

import { Calculator } from 'lucide-react';
import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { ErrorState, PermissionDeniedState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useCommercialPreview } from '@/hooks/use-scoring';
import { useAuthStore } from '@/lib/auth-store';
import { formatMoney, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CommercialFigures } from '@/types/scoring';

/**
 * The what-if commercial calculator.
 *
 * Persists nothing — it exists so a salesperson can answer "what would we make
 * on this?" before committing to a rate. One-off costs are amortised across the
 * engagement, so the margin shown is the margin of the deal rather than of an
 * arbitrary first month.
 */

const UNITS = ['MONTHLY', 'DAILY', 'HOURLY', 'ANNUAL'];
const CURRENCIES = ['QAR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR'];

interface FormState {
  bill_rate: string;
  bill_unit: string;
  bill_currency: string;
  cost_rate: string;
  cost_unit: string;
  cost_currency: string;
  visa_cost: string;
  insurance_cost: string;
  other_cost: string;
  duration_months: string;
  positions: string;
}

const INITIAL: FormState = {
  bill_rate: '22000',
  bill_unit: 'MONTHLY',
  bill_currency: 'QAR',
  cost_rate: '14000',
  cost_unit: 'MONTHLY',
  cost_currency: 'QAR',
  visa_cost: '',
  insurance_cost: '',
  other_cost: '',
  duration_months: '12',
  positions: '1',
};

function Figure({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className={cn('rounded-md border p-3', emphasis && 'bg-muted/40')}>
      <div className="text-2xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-0.5 tabular font-semibold',
          emphasis ? 'text-xl' : 'text-sm',
          tone === 'positive' && 'text-success',
          tone === 'negative' && 'text-destructive',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function CommercialCalculator() {
  const can = useAuthStore((state) => state.can);
  const [form, setForm] = React.useState<FormState>(INITIAL);
  const preview = useCommercialPreview();

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = React.useCallback(() => {
    preview.mutate({
      bill_rate: form.bill_rate || undefined,
      bill_unit: form.bill_unit,
      bill_currency: form.bill_currency,
      cost_rate: form.cost_rate || undefined,
      cost_unit: form.cost_unit,
      cost_currency: form.cost_currency,
      visa_cost: form.visa_cost || undefined,
      insurance_cost: form.insurance_cost || undefined,
      other_cost: form.other_cost || undefined,
      duration_months: form.duration_months ? Number(form.duration_months) : undefined,
      positions: form.positions ? Number(form.positions) : 1,
    });
    // `preview` is a stable mutation object; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  React.useEffect(() => {
    const timer = setTimeout(submit, 300);
    return () => clearTimeout(timer);
  }, [submit]);

  if (!can('commercial:run')) return <PermissionDeniedState />;

  const result: CommercialFigures | undefined = preview.data;
  const margin = result?.margin_percent ?? null;

  return (
    <>
      <PageHeader
        title="Commercial Calculator"
        description="What would Glimmora make on this engagement? Nothing here is saved — change any number and the figures update."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" aria-hidden />
              Inputs
            </CardTitle>
            <CardDescription>
              Rates in any unit or currency; everything is normalised to a monthly QAR basis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Client bill rate
              </legend>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="bill_rate">Rate</Label>
                  <Input id="bill_rate" type="number" min={0} value={form.bill_rate} onChange={set('bill_rate')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bill_unit">Unit</Label>
                  <Select id="bill_unit" value={form.bill_unit} onChange={set('bill_unit')}>
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>{unit.toLowerCase()}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bill_currency">Currency</Label>
                  <Select id="bill_currency" value={form.bill_currency} onChange={set('bill_currency')}>
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Consultant cost
              </legend>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="cost_rate">Rate</Label>
                  <Input id="cost_rate" type="number" min={0} value={form.cost_rate} onChange={set('cost_rate')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cost_unit">Unit</Label>
                  <Select id="cost_unit" value={form.cost_unit} onChange={set('cost_unit')}>
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>{unit.toLowerCase()}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cost_currency">Currency</Label>
                  <Select id="cost_currency" value={form.cost_currency} onChange={set('cost_currency')}>
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                One-off costs
              </legend>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="visa_cost">Visa</Label>
                  <Input id="visa_cost" type="number" min={0} placeholder="0" value={form.visa_cost} onChange={set('visa_cost')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="insurance_cost">Insurance</Label>
                  <Input id="insurance_cost" type="number" min={0} placeholder="0" value={form.insurance_cost} onChange={set('insurance_cost')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="other_cost">Other</Label>
                  <Input id="other_cost" type="number" min={0} placeholder="0" value={form.other_cost} onChange={set('other_cost')} />
                </div>
              </div>
              <p className="text-2xs text-muted-foreground">
                Spread across the engagement, so the margin shown is the margin of the deal — not of
                month one.
              </p>
            </fieldset>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="duration_months">Duration (months)</Label>
                <Input id="duration_months" type="number" min={1} max={120} value={form.duration_months} onChange={set('duration_months')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="positions">Positions</Label>
                <Input id="positions" type="number" min={1} max={50} value={form.positions} onChange={set('positions')} />
              </div>
            </div>

            <Button variant="outline" onClick={() => setForm(INITIAL)}>
              Reset
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Result</CardTitle>
            <CardDescription>Nothing on this screen is saved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.isError ? <ErrorState error={preview.error} /> : null}

            {result ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Figure
                    label="Gross margin"
                    value={margin !== null ? formatPercent(margin) : '—'}
                    emphasis
                    tone={margin === null ? undefined : margin > 0 ? 'positive' : 'negative'}
                  />
                  <Figure
                    label="Monthly gross profit"
                    value={formatMoney(result.gross_profit, result.currency)}
                    emphasis
                    tone={
                      result.gross_profit === null
                        ? undefined
                        : Number(result.gross_profit) > 0
                          ? 'positive'
                          : 'negative'
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Figure label="Monthly revenue" value={formatMoney(result.monthly_revenue, result.currency)} />
                  <Figure label="Monthly cost" value={formatMoney(result.monthly_cost, result.currency)} />
                  <Figure label="One-off / month" value={formatMoney(result.one_off_monthly, result.currency)} />
                  <Figure label="Contract value" value={formatMoney(result.contract_value, result.currency, { compact: true })} />
                  <Figure label="Total profit" value={formatMoney(result.total_profit, result.currency, { compact: true })} />
                  <Figure label="Duration" value={`${result.duration_months} months`} />
                </div>

                {result.is_converted ? (
                  <p className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
                    Figures were converted from another currency using the configured rate table.
                    Treat them as an estimate, not a quote.
                  </p>
                ) : null}

                {result.missing_information.length > 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-xs">
                    <p className="font-medium">Cannot complete the calculation</p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {result.missing_information.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a bill rate to see the figures.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
