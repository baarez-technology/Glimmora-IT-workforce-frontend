'use client';

import { Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';

/**
 * A destructive action that takes two presses.
 *
 * No modal: a dialog for "are you sure" is a click people learn to dismiss
 * without reading. The button changing into its own confirmation, in place and
 * in the destructive colour, is harder to do by reflex — and it reverts on its
 * own after a few seconds so a stray first press leaves nothing armed.
 *
 * Every one of these is a soft delete server-side. The record stops appearing
 * in lists; the history that referenced it stays intact.
 */
export function ConfirmAction({
  onConfirm,
  isPending = false,
  label,
  confirmLabel = 'Confirm',
  successMessage,
  errorMessage = 'That could not be completed.',
  icon = <Trash2 aria-hidden />,
  variant = 'ghost',
  size = 'sm',
  iconOnly = false,
  disabled = false,
  disabledReason,
}: {
  /** Runs on the second press. Return the mutation's promise, or fire-and-forget. */
  onConfirm: () => Promise<unknown> | void;
  isPending?: boolean;
  /** Accessible name for the first press, e.g. "Archive Milaha". */
  label: string;
  confirmLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  icon?: React.ReactNode;
  variant?: 'ghost' | 'outline' | 'destructive';
  size?: 'sm' | 'default';
  iconOnly?: boolean;
  disabled?: boolean;
  /** Shown as a tooltip when disabled, so the reason is never a mystery. */
  disabledReason?: string;
}) {
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (disabled) {
    return (
      <Button variant={variant} size={size} disabled title={disabledReason}>
        {icon}
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </Button>
    );
  }

  if (!armed) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => setArmed(true)}
        aria-label={iconOnly ? label : undefined}
      >
        {icon}
        {iconOnly ? null : label}
      </Button>
    );
  }

  return (
    <Button
      variant="destructive"
      size={size}
      loading={isPending}
      onClick={async () => {
        try {
          await onConfirm();
          if (successMessage) toast.success(successMessage);
          setArmed(false);
        } catch (error) {
          toast.error(error instanceof ApiError ? error.message : errorMessage);
          setArmed(false);
        }
      }}
    >
      {confirmLabel}
    </Button>
  );
}
