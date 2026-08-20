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
import { useCreateProject, useTechnologies } from '@/hooks/use-accounts';
import { PROJECT_STATUS_ORDER } from '@/lib/accounts';
import { ApiError } from '@/lib/api';
import { humanizeEnum } from '@/lib/format';
import type { ProjectStatus } from '@/types/accounts';

const schema = z
  .object({
    name: z.string().min(2, 'A project name is required'),
    code: z.string().optional(),
    status: z.enum(['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
  })
  .refine(
    (values) =>
      !values.start_date || !values.end_date || values.end_date >= values.start_date,
    { message: 'End date must not be before the start date', path: ['end_date'] },
  );

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  name: '',
  code: '',
  status: 'PLANNED',
  start_date: '',
  end_date: '',
  location: '',
  description: '',
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
}) {
  const createProject = useCreateProject();
  const technologies = useTechnologies();
  const [selectedTech, setSelectedTech] = React.useState<string[]>([]);
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
      setSelectedTech([]);
      setServerError(null);
    }
  }, [open, reset]);

  const toggleTech = (id: string) =>
    setSelectedTech((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await createProject.mutateAsync({
        account_id: accountId,
        name: values.name,
        code: values.code || null,
        status: values.status as ProjectStatus,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        location: values.location || null,
        description: values.description || null,
        technology_ids: selectedTech,
      });
      toast.success('Project added.');
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'The project could not be saved.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add project</DialogTitle>
          <DialogDescription>
            Projects are where requirements come from. Recording them early is how account
            expansion gets spotted.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Project name</Label>
              <Input
                id="name"
                placeholder="Core banking migration"
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Code (optional)</Label>
              <Input id="code" placeholder="CBM-2026" {...register('code')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" {...register('status')}>
                {PROJECT_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {humanizeEnum(status)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location (optional)</Label>
              <Input id="location" placeholder="Doha" {...register('location')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date (optional)</Label>
              <Input id="start_date" type="date" {...register('start_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End date (optional)</Label>
              <Input
                id="end_date"
                type="date"
                aria-invalid={Boolean(errors.end_date)}
                {...register('end_date')}
              />
              {errors.end_date && (
                <p className="text-xs text-destructive">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          {technologies.data && technologies.data.length > 0 && (
            <div className="space-y-1.5">
              <Label>Technologies (optional)</Label>
              <div className="flex flex-wrap gap-2 rounded-md border border-input p-2.5">
                {technologies.data.map((technology) => {
                  const active = selectedTech.includes(technology.id);
                  return (
                    <button
                      key={technology.id}
                      type="button"
                      onClick={() => toggleTech(technology.id)}
                      aria-pressed={active}
                      className={
                        active
                          ? 'rounded-full border border-primary bg-primary px-2.5 py-0.5 text-xs text-primary-foreground'
                          : 'rounded-full border border-input px-2.5 py-0.5 text-xs text-muted-foreground hover:border-foreground'
                      }
                    >
                      {technology.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('description')}
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
              Add project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
