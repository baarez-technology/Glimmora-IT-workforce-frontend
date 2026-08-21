'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { useCreateResource, useUpdateResource } from '@/hooks/use-talent';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { AVAILABILITY_LABELS, RESOURCE_TYPE_LABELS } from '@/lib/talent';
import type {
  AvailabilityStatus,
  Resource,
  ResourceType,
  VisaStatus,
} from '@/types/talent';

/**
 * Add or edit a consultant.
 *
 * The money fields are role-gated in both directions. Sales never reaches this
 * form (it has no `resource:write`), but HR holds cost and not bill rate — so a
 * field the actor cannot see is never rendered *and never sent*. Posting a
 * hidden field as null would silently wipe a number the editor was not even
 * allowed to read.
 */

const VISA_STATUSES: VisaStatus[] = ['UNKNOWN', 'NOT_REQUIRED', 'VALID', 'IN_PROCESS', 'EXPIRED'];
const VISA_LABELS: Record<VisaStatus, string> = {
  UNKNOWN: 'Unknown',
  NOT_REQUIRED: 'Not required',
  VALID: 'Valid',
  IN_PROCESS: 'In process',
  EXPIRED: 'Expired',
};

const schema = z.object({
  full_name: z.string().min(2, 'A name is required'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  resource_type: z.string(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  total_experience_years: z.string().optional(),
  relevant_experience_years: z.string().optional(),
  current_location_country: z
    .string()
    .length(2, 'Use the two-letter country code')
    .optional()
    .or(z.literal('')),
  current_location_city: z.string().optional(),
  nationality: z.string().optional(),
  willing_to_relocate: z.boolean(),
  visa_status: z.string(),
  visa_country: z
    .string()
    .length(2, 'Use the two-letter country code')
    .optional()
    .or(z.literal('')),
  availability_status: z.string(),
  available_from: z.string().optional(),
  notice_period_days: z.string().optional(),
  expected_cost_amount: z.string().optional(),
  expected_cost_currency: z.string().optional(),
  target_billing_amount: z.string().optional(),
  target_billing_currency: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function defaultsFor(resource?: Resource): FormValues {
  return {
    full_name: resource?.full_name ?? '',
    email: resource?.email ?? '',
    phone: resource?.phone ?? '',
    resource_type: resource?.resource_type ?? 'CONSULTANT',
    headline: resource?.headline ?? '',
    summary: resource?.summary ?? '',
    total_experience_years: resource?.total_experience_years?.toString() ?? '',
    relevant_experience_years: resource?.relevant_experience_years?.toString() ?? '',
    current_location_country: resource?.current_location_country ?? '',
    current_location_city: resource?.current_location_city ?? '',
    nationality: resource?.nationality ?? '',
    willing_to_relocate: resource?.willing_to_relocate ?? false,
    visa_status: resource?.visa_status ?? 'UNKNOWN',
    visa_country: resource?.visa_country ?? '',
    availability_status: resource?.availability_status ?? 'NOT_AVAILABLE',
    available_from: resource?.available_from ?? '',
    notice_period_days: resource?.notice_period_days?.toString() ?? '0',
    expected_cost_amount: resource?.expected_cost_amount ?? '',
    expected_cost_currency: resource?.expected_cost_currency ?? 'QAR',
    target_billing_amount: resource?.target_billing_amount ?? '',
    target_billing_currency: resource?.target_billing_currency ?? 'QAR',
    notes: resource?.notes ?? '',
  };
}

/** Empty string means "not given" for an optional field, not "set it to blank". */
function textOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ResourceFormDialog({
  open,
  onOpenChange,
  resource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create; pass a consultant to edit them. */
  resource?: Resource;
}) {
  const can = useAuthStore((state) => state.can);
  const canSeeCost = can('resource.cost:view');
  const canSeeBilling = can('billing.rate:view');

  const create = useCreateResource();
  const update = useUpdateResource(resource?.id ?? '');
  const [serverError, setServerError] = React.useState<string | null>(null);

  const editing = Boolean(resource);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(resource),
  });

  React.useEffect(() => {
    if (open) {
      reset(defaultsFor(resource));
      setServerError(null);
    }
  }, [open, resource, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const payload: Record<string, unknown> = {
      full_name: values.full_name.trim(),
      email: textOrNull(values.email),
      phone: textOrNull(values.phone),
      resource_type: values.resource_type as ResourceType,
      headline: textOrNull(values.headline),
      summary: textOrNull(values.summary),
      total_experience_years: numberOrNull(values.total_experience_years),
      relevant_experience_years: numberOrNull(values.relevant_experience_years),
      current_location_country: textOrNull(values.current_location_country)?.toUpperCase() ?? null,
      current_location_city: textOrNull(values.current_location_city),
      nationality: textOrNull(values.nationality),
      willing_to_relocate: values.willing_to_relocate,
      visa_status: values.visa_status as VisaStatus,
      visa_country: textOrNull(values.visa_country)?.toUpperCase() ?? null,
      availability_status: values.availability_status as AvailabilityStatus,
      available_from: textOrNull(values.available_from),
      notice_period_days: numberOrNull(values.notice_period_days) ?? 0,
      notes: textOrNull(values.notes),
    };

    // A rate the actor cannot see is never sent. Sending it as null would blank
    // a figure they were not allowed to read in the first place.
    if (canSeeCost) {
      payload.expected_cost_amount = textOrNull(values.expected_cost_amount);
      payload.expected_cost_currency = values.expected_cost_amount
        ? values.expected_cost_currency?.toUpperCase()
        : null;
      payload.expected_cost_unit = values.expected_cost_amount ? 'MONTHLY' : null;
    }
    if (canSeeBilling) {
      payload.target_billing_amount = textOrNull(values.target_billing_amount);
      payload.target_billing_currency = values.target_billing_amount
        ? values.target_billing_currency?.toUpperCase()
        : null;
      payload.target_billing_unit = values.target_billing_amount ? 'MONTHLY' : null;
    }

    try {
      if (resource) {
        await update.mutateAsync(payload);
        toast.success(`${values.full_name} updated.`);
      } else {
        await create.mutateAsync(payload);
        toast.success(`${values.full_name} added to the talent cloud.`);
      }
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'The consultant could not be saved.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${resource?.full_name}` : 'Add a consultant'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Corrections here flow straight into matching and the bench radar.'
              : 'A profile entered by hand is marked as reviewed. To have the platform extract one from a CV, use Upload a CV instead.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                aria-invalid={Boolean(errors.full_name)}
                {...register('full_name')}
              />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resource_type">Category</Label>
              <Select id="resource_type" {...register('resource_type')}>
                {(Object.keys(RESOURCE_TYPE_LABELS) as ResourceType[]).map((value) => (
                  <option key={value} value={value}>
                    {RESOURCE_TYPE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="headline">Headline (optional)</Label>
            <Input
              id="headline"
              placeholder="Senior SAP FICO Consultant, 11 years"
              {...register('headline')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" {...register('phone')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="total_experience_years">Total experience (years)</Label>
              <Input
                id="total_experience_years"
                type="number"
                min={0}
                max={60}
                step="0.5"
                {...register('total_experience_years')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relevant_experience_years">Relevant experience</Label>
              <Input
                id="relevant_experience_years"
                type="number"
                min={0}
                max={60}
                step="0.5"
                {...register('relevant_experience_years')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nationality">Nationality (optional)</Label>
              <Input id="nationality" placeholder="Indian" {...register('nationality')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="current_location_country">Country code</Label>
              <Input
                id="current_location_country"
                placeholder="QA"
                maxLength={2}
                aria-invalid={Boolean(errors.current_location_country)}
                {...register('current_location_country')}
              />
              {errors.current_location_country && (
                <p className="text-xs text-destructive">
                  {errors.current_location_country.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="current_location_city">City (optional)</Label>
              <Input id="current_location_city" placeholder="Doha" {...register('current_location_city')} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  {...register('willing_to_relocate')}
                />
                Willing to relocate
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="visa_status">Visa status</Label>
              <Select id="visa_status" {...register('visa_status')}>
                {VISA_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {VISA_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visa_country">Visa country code (optional)</Label>
              <Input
                id="visa_country"
                placeholder="QA"
                maxLength={2}
                aria-invalid={Boolean(errors.visa_country)}
                {...register('visa_country')}
              />
              {errors.visa_country && (
                <p className="text-xs text-destructive">{errors.visa_country.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="availability_status">Availability</Label>
              <Select id="availability_status" {...register('availability_status')}>
                {(Object.keys(AVAILABILITY_LABELS) as AvailabilityStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {AVAILABILITY_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="available_from">Available from (optional)</Label>
              <Input id="available_from" type="date" {...register('available_from')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice_period_days">Notice period (days)</Label>
              <Input
                id="notice_period_days"
                type="number"
                min={0}
                max={365}
                {...register('notice_period_days')}
              />
            </div>
          </div>

          {canSeeCost || canSeeBilling ? (
            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground">
                Rates (monthly)
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {canSeeCost ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="expected_cost_amount">Expected cost</Label>
                    <div className="flex gap-2">
                      <Input
                        id="expected_cost_amount"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="What Glimmora pays"
                        {...register('expected_cost_amount')}
                      />
                      <Input
                        aria-label="Cost currency"
                        className="w-24"
                        maxLength={3}
                        {...register('expected_cost_currency')}
                      />
                    </div>
                  </div>
                ) : null}
                {canSeeBilling ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="target_billing_amount">Target bill rate</Label>
                    <div className="flex gap-2">
                      <Input
                        id="target_billing_amount"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="What the client pays"
                        {...register('target_billing_amount')}
                      />
                      <Input
                        aria-label="Billing currency"
                        className="w-24"
                        maxLength={3}
                        {...register('target_billing_currency')}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              {!canSeeCost || !canSeeBilling ? (
                <p className="text-xs text-muted-foreground">
                  Your role sees one side of the rate only. The other is left untouched by this
                  form rather than blanked.
                </p>
              ) : null}
            </fieldset>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary (optional)</Label>
            <textarea
              id="summary"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('summary')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Internal notes (optional)</Label>
            <textarea
              id="notes"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('notes')}
            />
          </div>

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
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Save changes' : 'Add consultant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
