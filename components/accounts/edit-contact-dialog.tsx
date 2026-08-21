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
import { useUpdateContact } from '@/hooks/use-accounts';
import { ApiError } from '@/lib/api';
import type { Contact } from '@/types/accounts';

/**
 * Correct a contact.
 *
 * People change jobs. Marking a leaver inactive matters more than tidiness:
 * decision-maker count feeds Addressability, and an outbound email to somebody
 * who left is a wasted approach on a live pursuit.
 */

const schema = z.object({
  full_name: z.string().min(2, 'A name is required'),
  title: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  linkedin_url: z.string().optional(),
  is_decision_maker: z.boolean(),
  is_primary: z.boolean(),
  is_active: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function defaultsFor(contact: Contact): FormValues {
  return {
    full_name: contact.full_name,
    title: contact.title ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    linkedin_url: contact.linkedin_url ?? '',
    is_decision_maker: contact.is_decision_maker,
    is_primary: contact.is_primary,
    is_active: contact.is_active,
    notes: contact.notes ?? '',
  };
}

export function EditContactDialog({
  open,
  onOpenChange,
  contact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
}) {
  const update = useUpdateContact();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(contact),
  });

  React.useEffect(() => {
    if (open) {
      reset(defaultsFor(contact));
      setServerError(null);
    }
  }, [open, contact, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await update.mutateAsync({
        id: contact.id,
        full_name: values.full_name.trim(),
        title: values.title?.trim() || null,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        linkedin_url: values.linkedin_url?.trim() || null,
        is_decision_maker: values.is_decision_maker,
        is_primary: values.is_primary,
        is_active: values.is_active,
        notes: values.notes?.trim() || null,
      });
      toast.success('Contact updated.');
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'The contact could not be saved.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {contact.full_name}</DialogTitle>
          <DialogDescription>
            A decision maker is worth 10 points of Addressability, so keeping this accurate changes
            how the account scores.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit_full_name">Full name</Label>
              <Input
                id="edit_full_name"
                aria-invalid={Boolean(errors.full_name)}
                {...register('full_name')}
              />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_title">Job title (optional)</Label>
              <Input id="edit_title" {...register('title')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit_email">Email (optional)</Label>
              <Input
                id="edit_email"
                type="email"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_phone">Phone (optional)</Label>
              <Input id="edit_phone" {...register('phone')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit_linkedin_url">LinkedIn (optional)</Label>
            <Input id="edit_linkedin_url" {...register('linkedin_url')} />
          </div>

          <fieldset className="space-y-2.5">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-input"
                {...register('is_decision_maker')}
              />
              <span className="min-w-0">
                <span className="block text-sm">Decision maker</span>
                <span className="block text-xs text-muted-foreground">
                  The person who signs — worth 10 points of Addressability.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-input"
                {...register('is_primary')}
              />
              <span className="min-w-0">
                <span className="block text-sm">Primary contact</span>
                <span className="block text-xs text-muted-foreground">
                  The default person to reach on this account.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-input"
                {...register('is_active')}
              />
              <span className="min-w-0">
                <span className="block text-sm">Still at the organisation</span>
                <span className="block text-xs text-muted-foreground">
                  Untick when somebody leaves. They stop counting towards Addressability and drop
                  out of outreach.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="edit_notes">Notes (optional)</Label>
            <textarea
              id="edit_notes"
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
