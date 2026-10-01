'use client';

import { Send } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

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
import { useColleagues, useShareJob } from '@/hooks/use-jobfeed';
import { ApiError } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/api';

/**
 * Pass a job to a colleague.
 *
 * The handover Sales and Resourcing actually do: one of them finds a role the
 * other should see. It writes into the recipient's feed rather than sending a
 * message about it, so the job lands where they already work instead of in a
 * channel they have to act on separately.
 */
export function ShareJobDialog({
  itemId,
  jobTitle,
  trigger,
}: {
  itemId: string;
  jobTitle: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [note, setNote] = React.useState('');

  // Only fetch the picker once it can be seen.
  const colleagues = useColleagues(open);
  const share = useShareJob(itemId);

  const reset = () => {
    setSelected([]);
    setNote('');
  };

  const submit = async () => {
    try {
      const result = await share.mutateAsync({ recipient_ids: selected, note: note || null });
      toast.success(
        result.delivered === 1
          ? 'Sent to 1 colleague.'
          : `Sent to ${result.delivered} colleagues.`,
      );
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That could not be sent.');
    }
  };

  const people = colleagues.data ?? [];

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Send aria-hidden />
          Share
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this job</DialogTitle>
            <DialogDescription>
              It lands in their feed, marked as coming from you. {jobTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Send to</Label>
              {colleagues.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading colleagues…</p>
              ) : people.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  There is nobody else holding the job offers workspace yet.
                </p>
              ) : (
                <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border p-1">
                  {people.map((person) => {
                    const active = selected.includes(person.id);
                    return (
                      <button
                        key={person.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setSelected((current) =>
                            current.includes(person.id)
                              ? current.filter((id) => id !== person.id)
                              : [...current, person.id],
                          )
                        }
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-sm transition-colors',
                          active ? 'bg-primary/10 font-medium' : 'hover:bg-muted',
                        )}
                      >
                        <span className="truncate">{person.full_name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {ROLE_LABELS[person.role as Role] ?? person.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="share_note">Note (optional)</Label>
              <Input
                id="share_note"
                placeholder="Looks like a fit for the Milaha bench"
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              loading={share.isPending}
              disabled={selected.length === 0}
            >
              <Send aria-hidden />
              Send{selected.length > 1 ? ` to ${selected.length}` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
