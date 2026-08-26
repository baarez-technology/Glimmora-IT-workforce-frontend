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
import { useUpdateProject } from '@/hooks/use-accounts';
import { PROJECT_STATUS_ORDER } from '@/lib/accounts';
import { ApiError } from '@/lib/api';
import { humanizeEnum } from '@/lib/format';
import type { Project, ProjectStatus } from '@/types/accounts';

/**
 * Correct a project.
 *
 * Projects are where requirements come from, so the end date matters beyond
 * tidiness: a project recorded as ending in March when it runs to June is a
 * pipeline of renewals nobody goes looking for.
 */

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
    (values) => !values.start_date || !values.end_date || values.end_date >= values.start_date,
    { message: 'End date must not be before the start date', path: ['end_date'] },
  );

type FormValues = z.infer<typeof schema>;

function defaultsFor(project: Project): FormValues {
  return {
    name: project.name,
    code: project.code ?? '',
    status: project.status as FormValues['status'],
    start_date: project.start_date ?? '',
    end_date: project.end_date ?? '',
    location: project.location ?? '',
    description: project.description ?? '',
  };
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const update = useUpdateProject(project.id);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(project),
  });

  React.useEffect(() => {
    if (open) {
      reset(defaultsFor(project));
      setServerError(null);
    }
  }, [open, project, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await update.mutateAsync({
        name: values.name.trim(),
        code: values.code?.trim() || null,
        status: values.status as ProjectStatus,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        location: values.location?.trim() || null,
        description: values.description?.trim() || null,
      });
      toast.success('Project updated.');
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'The project could not be saved.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {project.name}</DialogTitle>
          <DialogDescription>
            {project.account_name ?? 'Project details'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="project_name">Project name</Label>
              <Input
                id="project_name"
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project_code">Code (optional)</Label>
              <Input id="project_code" {...register('code')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="project_status">Status</Label>
              <Select id="project_status" {...register('status')}>
                {PROJECT_STATUS_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {humanizeEnum(value)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project_start">Start (optional)</Label>
              <Input id="project_start" type="date" {...register('start_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project_end">End (optional)</Label>
              <Input
                id="project_end"
                type="date"
                aria-invalid={Boolean(errors.end_date)}
                {...register('end_date')}
              />
              {errors.end_date && (
                <p className="text-xs text-destructive">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project_location">Location (optional)</Label>
            <Input id="project_location" placeholder="Doha" {...register('location')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project_description">Description (optional)</Label>
            <textarea
              id="project_description"
              rows={3}
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
