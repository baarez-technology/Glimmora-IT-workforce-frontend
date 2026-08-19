'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
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
import { useCreateAccount } from '@/hooks/use-accounts';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER } from '@/lib/accounts';
import { ApiError } from '@/lib/api';

const schema = z.object({
  name: z.string().min(2, 'Enter the organisation name'),
  account_type: z.enum(['CUSTOMER', 'PARTNER', 'PRIME_CONTRACTOR', 'VENDOR_MSP', 'PROSPECT']),
  country: z.string().length(2, 'Use a 2-letter country code').or(z.literal('')),
  city: z.string().optional(),
  industry: z.string().optional(),
  is_existing_customer: z.boolean(),
  is_existing_partner: z.boolean(),
  is_approved_vendor: z.boolean(),
  has_msa: z.boolean(),
  contract_outsourcing_friendly: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/** The five commercial facts the Addressability engine will score on. */
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

export function CreateAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const createAccount = useCreateAccount();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      account_type: 'CUSTOMER',
      country: 'QA',
      city: '',
      industry: '',
      is_existing_customer: false,
      is_existing_partner: false,
      is_approved_vendor: false,
      has_msa: false,
      contract_outsourcing_friendly: true,
    },
  });

  React.useEffect(() => {
    if (open) setServerError(null);
  }, [open]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const account = await createAccount.mutateAsync({
        ...values,
        country: values.country || null,
        city: values.city || null,
        industry: values.industry || null,
      });
      toast.success(`${account.name} created.`);
      reset();
      onOpenChange(false);
      router.push(`/accounts/customers/${account.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const nameError = error.details.find((detail) => detail.field === 'name');
        if (nameError) setError('name', { message: nameError.message });
        else setServerError(error.message);
      } else {
        setServerError('The account could not be created.');
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
          <DialogDescription>
            The commercial flags below are what the Opportunity Score reads later. Record what you
            know; anything left unticked shows as unconfirmed rather than as a no.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Organisation name</Label>
            <Input id="name" aria-invalid={Boolean(errors.name)} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="account_type">Type</Label>
              <Select id="account_type" {...register('account_type')}>
                {ACCOUNT_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {ACCOUNT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" maxLength={2} placeholder="QA" {...register('country')} />
              {errors.country && (
                <p className="text-xs text-destructive">{errors.country.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="Doha" {...register('city')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" placeholder="Energy, Banking, Government…" {...register('industry')} />
          </div>

          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Commercial facts (Addressability inputs)
            </legend>
            <div className="space-y-2.5">
              {COMMERCIAL_FLAGS.map((flag) => (
                <label key={flag.name} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-input"
                    {...register(flag.name)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm">{flag.label}</span>
                    <span className="block text-xs text-muted-foreground">{flag.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

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
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
