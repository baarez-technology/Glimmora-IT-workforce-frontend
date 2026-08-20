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
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAccounts, useAddRoute } from '@/hooks/use-accounts';
import { RELATION_TYPE_LABELS, RELATION_TYPE_ORDER } from '@/lib/accounts';
import { ApiError } from '@/lib/api';
import type { RelationType } from '@/types/accounts';

const schema = z.object({
  to_account_id: z.string().min(1, 'Choose the partner or prime to route through'),
  relation_type: z.enum(['SUBCONTRACTS_THROUGH', 'PRIME_FOR', 'PARTNER_OF', 'VENDOR_TO']),
  is_preferred_route: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  to_account_id: '',
  relation_type: 'SUBCONTRACTS_THROUGH',
  is_preferred_route: false,
  notes: '',
};

export function AddRouteDialog({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
}) {
  const addRoute = useAddRoute(accountId);
  const accounts = useAccounts({ page_size: 100 });
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  React.useEffect(() => {
    if (open) {
      reset(DEFAULTS);
      setServerError(null);
    }
  }, [open, reset]);

  // A route points at a different account — never at itself.
  const targets = (accounts.data?.items ?? []).filter((account) => account.id !== accountId);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await addRoute.mutateAsync({
        to_account_id: values.to_account_id,
        relation_type: values.relation_type as RelationType,
        is_preferred_route: values.is_preferred_route,
        notes: values.notes || undefined,
      });
      toast.success('Route added.');
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'The route could not be saved.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add route</DialogTitle>
          <DialogDescription>
            Record an indirect route only when a partner or prime is required to bid. A partner or
            prime route is worth 15 points of Addressability.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="relation_type">Relationship</Label>
            <Select id="relation_type" {...register('relation_type')}>
              {RELATION_TYPE_ORDER.map((relation) => (
                <option key={relation} value={relation}>
                  {RELATION_TYPE_LABELS[relation]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="to_account_id">Partner / prime account</Label>
            <Select
              id="to_account_id"
              aria-invalid={Boolean(errors.to_account_id)}
              {...register('to_account_id')}
            >
              <option value="">Select an account…</option>
              {targets.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            {errors.to_account_id && (
              <p className="text-xs text-destructive">{errors.to_account_id.message}</p>
            )}
            {accounts.data && targets.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No other accounts exist yet. Create a partner or prime account first, then add the
                route.
              </p>
            )}
          </div>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-input"
              {...register('is_preferred_route')}
            />
            <span className="min-w-0">
              <span className="block text-sm">Preferred route</span>
              <span className="block text-xs text-muted-foreground">
                The route we lead with when more than one is available.
              </span>
            </span>
          </label>

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
            <Button type="submit" loading={isSubmitting} disabled={targets.length === 0}>
              Add route
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
