'use client';

import {
  CalendarClock,
  CheckCircle2,
  FileText,
  ListTodo,
  Mail,
  Pencil,
  Phone,
  Settings2,
  Users,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { EditActivityDialog } from '@/components/accounts/edit-activity-dialog';
import { ConfirmAction } from '@/components/confirm-action';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCompleteFollowUp, useDeleteActivity } from '@/hooks/use-accounts';
import { ACTIVITY_TYPE_LABELS } from '@/lib/accounts';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Activity, ActivityType } from '@/types/accounts';

const ICONS: Record<ActivityType, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  NOTE: FileText,
  TASK: ListTodo,
  STATUS_CHANGE: Settings2,
  SYSTEM: Settings2,
};

export function ActivityTimeline({
  activities,
  isLoading,
  error,
  onRetry,
  emptyDescription,
  showAccount = false,
}: {
  activities: Activity[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyDescription?: string;
  showAccount?: boolean;
}) {
  const complete = useCompleteFollowUp();
  const remove = useDeleteActivity();
  const canWrite = useAuthStore((state) => state.can)('activity:write');
  const [editing, setEditing] = React.useState<Activity | null>(null);

  if (isLoading) return <LoadingState label="Loading timeline…" />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (activities.length === 0) {
    return (
      <EmptyState
        title="No activity recorded yet"
        description={
          emptyDescription ??
          'Log a call, email, meeting or note to start building this account’s history.'
        }
      />
    );
  }

  const onComplete = async (activity: Activity) => {
    try {
      await complete.mutateAsync(activity.id);
      toast.success('Follow-up marked complete.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not complete the follow-up.');
    }
  };

  return (
    <ol className="relative space-y-0">
      {activities.map((activity, index) => {
        const Icon = ICONS[activity.activity_type];
        const isLast = index === activities.length - 1;

        return (
          <li key={activity.id} className="relative flex gap-3 pb-5">
            {!isLast && (
              <span
                className="absolute left-[15px] top-8 h-full w-px bg-border"
                aria-hidden
              />
            )}

            <span
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card',
                activity.is_follow_up_overdue && 'border-destructive/50 text-destructive',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{activity.subject}</span>
                <Badge variant="muted">{ACTIVITY_TYPE_LABELS[activity.activity_type]}</Badge>
                {activity.is_follow_up_overdue && (
                  <Badge variant="destructive">Follow-up overdue</Badge>
                )}
                {activity.is_follow_up_open && !activity.is_follow_up_overdue && (
                  <Badge variant="warning">
                    <CalendarClock className="h-3 w-3" aria-hidden />
                    Due {formatRelative(activity.follow_up_at)}
                  </Badge>
                )}
              </div>

              {activity.body && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {activity.body}
                </p>
              )}
              {activity.outcome && (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Outcome: </span>
                  {activity.outcome}
                </p>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
                <span title={formatDateTime(activity.occurred_at)}>
                  {formatRelative(activity.occurred_at)}
                </span>
                {activity.user_name && <span>by {activity.user_name}</span>}
                {showAccount && activity.account_name && <span>{activity.account_name}</span>}
                {activity.contact_name && <span>with {activity.contact_name}</span>}
                {activity.project_name && <span>on {activity.project_name}</span>}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {activity.is_follow_up_open && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => void onComplete(activity)}
                    loading={complete.isPending && complete.variables === activity.id}
                  >
                    <CheckCircle2 aria-hidden />
                    Mark follow-up complete
                  </Button>
                )}
                {canWrite && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setEditing(activity)}
                    >
                      <Pencil aria-hidden />
                      Edit
                    </Button>
                    <ConfirmAction
                      iconOnly
                      label={`Delete "${activity.subject}"`}
                      confirmLabel="Confirm delete"
                      successMessage="Activity deleted."
                      errorMessage="The activity could not be deleted."
                      isPending={remove.isPending}
                      onConfirm={() => remove.mutateAsync(activity.id)}
                    />
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
      {editing ? (
        <EditActivityDialog
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
          activity={editing}
        />
      ) : null}
    </ol>
  );
}
