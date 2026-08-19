'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { PageHeader } from '@/components/layout/page-header';
import { InlineWarning } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useChangePassword } from '@/hooks/use-identity';

const MIN_LENGTH = 12;

const schema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().min(MIN_LENGTH, `Use at least ${MIN_LENGTH} characters`),
    confirm_password: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    path: ['confirm_password'],
    message: 'The two passwords do not match',
  })
  .refine((values) => values.new_password !== values.current_password, {
    path: ['new_password'],
    message: 'Choose a password you have not used before',
  });

type FormValues = z.infer<typeof schema>;

/** Mirrors the server policy so the user sees the rules before submitting. */
function policyChecks(value: string) {
  return [
    { label: `At least ${MIN_LENGTH} characters`, met: value.length >= MIN_LENGTH },
    {
      label: 'Mixes letters with numbers or symbols',
      met: value.length > 0 && !/^[a-zA-Z]+$/.test(value) && !/^\d+$/.test(value),
    },
  ];
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const changePassword = useChangePassword();

  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const newPassword = watch('new_password');
  const checks = policyChecks(newPassword ?? '');

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await changePassword.mutateAsync({
        current_password: values.current_password,
        new_password: values.new_password,
      });

      toast.success('Password changed. Please sign in again.');
      // Changing a password revokes every session, including this one.
      await logout();
      router.replace('/login');
    } catch (error) {
      if (error instanceof ApiError) {
        let matched = false;
        for (const detail of error.details) {
          if (detail.field === 'current_password' || detail.field === 'new_password') {
            setError(detail.field, { message: detail.message });
            matched = true;
          }
        }
        if (!matched) setServerError(error.message);
      } else {
        setServerError('The password could not be changed. Please try again.');
      }
    }
  });

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Change password"
        description="Changing your password signs you out of every device."
      />

      {user?.must_change_password && (
        <div className="mb-6">
          <InlineWarning>
            Your account was created with a temporary password. Set your own password to continue —
            the rest of the platform is unavailable until you do.
          </InlineWarning>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New password</CardTitle>
          <CardDescription>
            This platform holds cost rates, margins and personal documents. Use a password you do
            not use anywhere else.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="current_password">Current password</Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.current_password)}
                {...register('current_password')}
              />
              {errors.current_password && (
                <p className="text-xs text-destructive">{errors.current_password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.new_password)}
                {...register('new_password')}
              />
              {errors.new_password && (
                <p className="text-xs text-destructive">{errors.new_password.message}</p>
              )}

              <ul className="mt-2 space-y-1">
                {checks.map((check) => (
                  <li
                    key={check.label}
                    className={`flex items-center gap-1.5 text-xs ${
                      check.met ? 'text-success' : 'text-muted-foreground'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm new password</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirm_password)}
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
              )}
            </div>

            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{serverError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="submit" loading={isSubmitting}>
                Change password
              </Button>
              {!user?.must_change_password && (
                <Button type="button" variant="ghost" onClick={() => router.back()}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
