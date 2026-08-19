'use client';

import { useActionState, useState } from 'react';

import {
  BUTTON_DANGER,
  BUTTON_SECONDARY,
  FormMessage,
  Label,
  TEXTAREA,
} from '@/components/admin/ui';

import {
  cancelBookingAction,
  markCompletedAction,
  deleteDraftAction,
  type SimpleActionState,
} from '../actions';

/**
 * The lifecycle buttons on the booking detail screen (§13.4).
 *
 * Each is a real `<form>` posting to a server action, so each works with the
 * keyboard, announces its own error, and cannot be fired by a stray click on
 * something else. `useActionState` gives the pending state and the message
 * without any of them needing a store.
 *
 * **No `window.confirm`.** The browser dialogs block every subsequent event and
 * are unstyleable; cancelling reveals the reason box instead, which is a better
 * confirmation anyway — you cannot cancel a booking without saying why (§9.8),
 * so the field *is* the confirmation step.
 */

const EMPTY: SimpleActionState = { error: null };

export function MarkCompletedButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(markCompletedAction, EMPTY);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={BUTTON_SECONDARY}>
        Mark completed
      </button>
      {state.error ? (
        <p className="mt-2 text-xs text-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Cancelling (§9.8) — admin only, reason required, and never a delete. The
 * booking keeps its number, its history and its payments; it simply stops
 * counting.
 */
export function CancelBookingForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(cancelBookingAction, EMPTY);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={BUTTON_DANGER}>
        Cancel booking
      </button>
    );
  }

  return (
    <form action={action} className="w-full space-y-3 rounded-[2px] border border-error/30 bg-error/5 p-4">
      <input type="hidden" name="id" value={id} />

      <div>
        <Label htmlFor="cancelReason">Why is it being cancelled?</Label>
        <p className="mt-1 text-xs text-muted">
          The reason stays on the booking. Payments already recorded are kept —
          a refund is entered as a reversal, not a deletion.
        </p>
        <div className="mt-2">
          <textarea id="cancelReason" name="cancelReason" required className={TEXTAREA} />
        </div>
      </div>

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="flex flex-wrap gap-2.5">
        <button type="submit" disabled={pending} className={BUTTON_DANGER}>
          Cancel this booking
        </button>
        <button type="button" onClick={() => setOpen(false)} className={BUTTON_SECONDARY}>
          Keep it
        </button>
      </div>
    </form>
  );
}

/**
 * Deleting a draft — the only outright deletion in the system (§9.8), and it
 * takes two deliberate clicks because there is nothing to undo it with.
 */
export function DeleteDraftForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteDraftAction, EMPTY);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={BUTTON_DANGER}>
        Delete draft
      </button>
    );
  }

  return (
    <form action={action} className="w-full space-y-3 rounded-[2px] border border-error/30 bg-error/5 p-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-ink">
        This draft is deleted for good. Only drafts can be deleted — a confirmed
        booking is cancelled instead, and keeps its history.
      </p>

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="flex flex-wrap gap-2.5">
        <button type="submit" disabled={pending} className={BUTTON_DANGER}>
          Delete it
        </button>
        <button type="button" onClick={() => setOpen(false)} className={BUTTON_SECONDARY}>
          Keep it
        </button>
      </div>
    </form>
  );
}
