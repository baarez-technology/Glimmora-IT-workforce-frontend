'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister } from '@/hooks/use-jobfeed';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Create an individual account.
 *
 * Separate from the staff sign-in: this is self-service, and the account it
 * creates sees only its own job feed. The role is never sent — the server
 * decides it, so a crafted request cannot ask to be an administrator.
 */

/**
 * Mirrors the server's password policy so the rules are stated before
 * submission rather than bounced back afterwards. The server still enforces
 * them; this is courtesy, not security.
 */
const schema = z
  .object({
    full_name: z.string().min(2, 'Enter your name'),
    email: z.string().min(1, 'Enter your email address').email('Enter a valid email address'),
    password: z
      .string()
      .min(12, 'At least 12 characters')
      .refine(
        (value) => !/^[A-Za-z]+$/.test(value) && !/^\d+$/.test(value),
        'Mix letters with numbers or symbols',
      ),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'The two passwords do not match',
    path: ['confirm'],
  })
  .refine(
    (values) => {
      const local = values.email.split('@')[0] ?? '';
      return local.length === 0 || !values.password.toLowerCase().includes(local.toLowerCase());
    },
    { message: 'Must not contain your email address', path: ['password'] },
  );

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const register_ = useRegister();
  const login = useAuthStore((state) => state.login);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const password = watch('password') ?? '';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await register_.mutateAsync({
        email: values.email,
        full_name: values.full_name.trim(),
        password: values.password,
      });
      // Straight in — asking somebody to type the password they just chose a
      // second time is friction with no purpose.
      await login(values.email, values.password);
      router.replace('/jobs/feed');
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'The account could not be created. Please try again.',
      );
    }
  });

  const rules: Array<[string, boolean]> = [
    ['At least 12 characters', password.length >= 12],
    ['Letters mixed with numbers or symbols', !/^[A-Za-z]*$/.test(password) || password === ''],
  ];

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            G
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold">Glimmora</div>
            <div className="text-xs text-muted-foreground">Workforce Intelligence Engine</div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            For your own job feed. Nobody else can see it, including Glimmora staff.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Your name</Label>
              <Input
                id="full_name"
                autoComplete="name"
                autoFocus
                aria-invalid={Boolean(errors.full_name)}
                {...register('full_name')}
              />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              <ul className="space-y-0.5 pt-0.5">
                {rules.map(([label, met]) => (
                  <li
                    key={label}
                    className={`flex items-center gap-1.5 text-2xs ${
                      met && password ? 'text-success' : 'text-muted-foreground'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirm)}
                {...register('confirm')}
              />
              {errors.confirm && (
                <p className="text-xs text-destructive">{errors.confirm.message}</p>
              )}
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{formError}</span>
              </div>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Create account
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
