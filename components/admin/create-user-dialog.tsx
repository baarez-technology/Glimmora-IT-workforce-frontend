'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw } from 'lucide-react';
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
import { useCreateUser } from '@/hooks/use-identity';
import { ApiError } from '@/lib/api';
import { ROLE_LABELS, ROLE_ORDER } from '@/lib/roles';
import type { Role } from '@/types/api';

const schema = z.object({
  full_name: z.string().min(2, 'Enter a full name'),
  email: z.string().email('Enter a valid email address'),
  job_title: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGEMENT', 'SALES', 'HR_RESOURCING']),
  password: z.string().min(12, 'Use at least 12 characters'),
});

type FormValues = z.infer<typeof schema>;

const ROLE_HINTS: Record<Role, string> = {
  ADMIN: 'Full control, including users, scoring rules and the audit trail.',
  MANAGEMENT: 'Reads the whole business including cost and margin. Cannot administer users.',
  SALES: 'Demand, accounts and submissions. Sees bill rates and margin, not consultant cost.',
  HR_RESOURCING: 'Talent, documents and redeployment. Sees consultant cost, not client margin.',
};

/** Generates a password that satisfies the server policy on the first attempt. */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const random = crypto.getRandomValues(new Uint32Array(14));
  const body = Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
  return `Glm-${body}`;
}

export function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createUser = useCreateUser();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', email: '', job_title: '', role: 'SALES', password: '' },
  });

  const selectedRole = watch('role');

  React.useEffect(() => {
    if (open) {
      reset({
        full_name: '',
        email: '',
        job_title: '',
        role: 'SALES',
        password: generatePassword(),
      });
      setServerError(null);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await createUser.mutateAsync({
        ...values,
        job_title: values.job_title || undefined,
        // The creator sets a temporary password; the user replaces it on first
        // sign-in so nobody else knows their working credential.
        must_change_password: true,
      });
      toast.success(`${values.full_name} created. Share the temporary password securely.`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        let matched = false;
        for (const detail of error.details) {
          if (detail.field in schema.shape) {
            setError(detail.field as keyof FormValues, { message: detail.message });
            matched = true;
          }
        }
        if (!matched) setServerError(error.message);
      } else {
        setServerError('The user could not be created.');
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            The new user signs in with a temporary password and must change it immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" aria-invalid={Boolean(errors.full_name)} {...register('full_name')} />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="job_title">Job title (optional)</Label>
              <Input id="job_title" {...register('job_title')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select id="role" {...register('role')}>
              {ROLE_ORDER.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_HINTS[selectedRole]}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Temporary password</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                className="font-mono"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setValue('password', generatePassword(), { shouldValidate: true })}
                aria-label="Generate a new password"
              >
                <RefreshCw aria-hidden />
              </Button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Share this over a secure channel. It is not stored anywhere you can read it again.
            </p>
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
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
