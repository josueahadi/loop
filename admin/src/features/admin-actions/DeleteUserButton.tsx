'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDeleteUser } from './hooks';

// Admin account deletion with the fraud-blocklist option. Typing DELETE guards
// against an accidental irreversible action; the blocklist checkbox keeps a
// hashed anti-re-registration record when the removal is for false documents.
export function DeleteUserButton({
  userId,
  userName,
  trigger,
}: {
  userId: string;
  userName: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [blocklist, setBlocklist] = useState(false);
  const [reason, setReason] = useState('');
  const del = useDeleteUser();

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  function reset() {
    setConfirmText('');
    setBlocklist(false);
    setReason('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Delete {userName}&apos;s account?</DialogTitle>
          <DialogDescription>
            This permanently erases the account and the records it owns. Shared
            records (conversations, ratings given) are kept for the other party
            with this user&apos;s identity removed. Payment records are retained
            de-identified. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={blocklist}
              onChange={(e) => setBlocklist(e.target.checked)}
            />
            <span>
              Removal for false documents — block this email and phone from
              re-registering (a hashed record is kept).
            </span>
          </label>

          {blocklist && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="delete-reason">Reason (audited)</Label>
              <Textarea
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. submitted a forged vehicle registration"
                rows={2}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
            <input
              id="delete-confirm"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!canDelete || del.isPending}
            onClick={() =>
              del.mutate(
                { id: userId, blocklist, reason: reason.trim() || undefined },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
