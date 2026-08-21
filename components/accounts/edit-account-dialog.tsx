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
import { useUpdateAccount } from '@/hooks/use-accounts';
import { ACCOUNT_TYPE_LABELS } from '@/lib/accounts';
import { ApiError } from '@/lib/api';
import type { Account, AccountType, RelationshipStatus } from '@/types/accounts';

/**
 * Correct an account.
 *
 * The five commercial flags are not administrative detail: they are inputs to
 * the Addressability score, so an account wrongly marked as having no MSA is an
 * opportunity scored too low and never pursued. Being unable to fix them meant
 * the score could stay wrong forever.
 */

const schema = z.object({
  name: z.string().min(2, 'Enter the organisation name'),
  legal_name: z.string().optional(),
  account_type: z.enum(['CUSTOMER', 'PARTNER', 'PRIME_CONTRACTOR', 'VENDOR_MSP', 'PROSPECT']),
  relationship_status: z.enum(['ACTIVE', 'DORMANT', 'TARGET', 'BLOCKED']),
  country: z.string().length(2, 'Use a 2-letter country code').or(z.literal('')),
  city: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  payment_terms_days: z.string().optional(),
  is_existing_customer: z.boolean(),
  is_existing_partner: z.boolean(),
  is_approved_vendor: z.boolean(),
  has_msa: z.boolean(),
  contract_outsourcing_friendly: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const COMMERCIAL_FLAGS: Array<{ name: keyof FormValues; label: string; hint: string }> = [
  {
    name: 'contract_outsourcing_friendly',
    label: 'Buys contract / outsourced resources',
    hint: 'If they only hire permanently, they are not addressable for us.',
  },
  {
    name: 'is_existing_customer',
    label: 'Existing Glimmora customer',
    hint: 'We have delivered to them before.',
  },
  {
    name: 'is_existing_partner',
    label: 'Existing partner',
    hint: 'We work alongside them on other accounts.',
  },
  {
    name: 'is_approved_vendor',
    label: 'Approved vendor',
    hint: 'We are on their approved supplier list.',
  },
  { name: 'has_msa', label: 'MSA in place', hint: 'A master service agreement is signed.' },
];

const RELATIONSHIP_STATUSES: RelationshipStatus[] = ['TARGET', 'ACTIVE', 'DORMANT', 'BLOCKED'];

const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  TARGET: 'Target',
  ACTIVE: 'Active',
  DORMANT: 'Dormant',
  BLOCKED: 'Blocked',
};

function defaultsFor(account: Account): FormValues {
  return {
    name: account.name,
    legal_name: account.legal_name ?? '',
    account_type: account.account_type as FormValues['account_type'],
    relationship_status: account.relationship_status as FormValues['relationship_status'],
    country: account.country ?? '',
    city: account.city ?? '',
    industry: account.industry ?? '',
    website: account.website ?? '',
    payment_terms_days: account.payment_terms_days?.toString() ?? '',
    is_existing_customer: account.is_existing_customer,
    is_existing_partner: account.is_existing_partner,
    is_approved_vendor: account.is_approved_vendor,
    has_msa: account.has_msa,
    contract_outsourcing_friendly: account.contract_outsourcing_friendly,
    notes: account.notes ?? '',
  };
}

export function EditAccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
}) {
  const update = useUpdateAccount(account.id);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(account),
  });

  React.useEffect(() => {
    if (open) {
      reset(defaultsFor(account));
      setServerError(null);
    }
  }, [open, account, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const terms = values.payment_terms_days?.trim();
    try {
      await update.mutateAsync({
        name: values.name.trim(),
        legal_name: values.legal_name?.trim() || null,
        account_type: values.account_type as AccountType,
        relationship_status: values.relationship_status as RelationshipStatus,
        country: values.country ? values.country.toUpperCase() : null,
        city: values.city?.trim() || null,
        industry: values.industry?.trim() || null,
        website: values.website?.trim() || null,
        payment_terms_days: terms ? Number(terms) : null,
        is_existing_customer: values.is_existing_customer,
        is_existing_partner: values.is_existing_partner,
        is_approved_vendor: values.is_approved_vendor,
        has_msa: values.has_msa,
        contract_outsourcing_friendly: values.contract_outsourcing_friendly,
        notes: values.notes?.trim() || null,
      });
      toast.success('Account updated. Addressability will be rescored.');
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'The account could not be saved.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {account.name}</DialogTitle>
          <DialogDescription>
            The commercial flags below feed the Addressability score directly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Organisation name</Label>
              <Input id="name" aria-invalid={Boolean(errors.name)} {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legal_name">Legal name (optional)</Label>
              <Input id="legal_name" {...register('legal_name')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="account_type">Account type</Label>
              <Select id="account_type" {...register('account_type')}>
                {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((value) => (
                  <option key={value} value={value}>
                    {ACCOUNT_TYPE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relationship_status">Relationship</Label>
              <Select id="relationship_status" {...register('relationship_status')}>
                {RELATIONSHIP_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {RELATIONSHIP_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="country">Country code</Label>
              <Input
                id="country"
                maxLength={2}
                placeholder="QA"
                aria-invalid={Boolean(errors.country)}
                {...register('country')}
              />
              {errors.country && (
                <p className="text-xs text-destructive">{errors.country.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City (optional)</Label>
              <Input id="city" {...register('city')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry (optional)</Label>
              <Input id="industry" {...register('industry')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="website">Website (optional)</Label>
              <Input id="website" placeholder="https://…" {...register('website')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_terms_days">Payment terms (days, optional)</Label>
              <Input
                id="payment_terms_days"
                type="number"
                min={0}
                max={365}
                {...register('payment_terms_days')}
              />
            </div>
          </div>

          <fieldset className="space-y-2.5 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Commercial facts — these drive Addressability
            </legend>
            {COMMERCIAL_FLAGS.map((flag) => (
              <label key={flag.name} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-input"
                  {...register(flag.name as 'has_msa')}
                />
                <span className="min-w-0">
                  <span className="block text-sm">{flag.label}</span>
                  <span className="block text-xs text-muted-foreground">{flag.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
