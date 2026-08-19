'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { diffBooking, logAudit } from '@/db/queries/audit';
import { getCompanySettings } from '@/db/queries/company';
import {
  cancelBooking,
  confirmBooking,
  createDraft,
  deleteDraft,
  getBooking,
  saveBooking,
  setBookingStatus,
} from '@/db/queries/bookings';
import { computeBookingTotals } from '@/lib/booking-math';
import { NotAuthorisedError, requireCapability } from '@/lib/auth-guard';
import { formatSAR } from '@/lib/format';
import { dateStringToSeconds } from '@/lib/time';
import {
  bookingConfirmSchema,
  bookingDraftSchema,
  cancelBookingSchema,
  type BookingValues,
} from '@/lib/validation/booking';

/**
 * Booking mutations (§9.3, §9.8, §13.3).
 *
 * ## Every action re-checks
 *
 * The panel layout guards what renders; these guard what happens. A server
 * action is a POST that can be made without ever loading the page it belongs
 * to, so `requireCapability` is the first statement of each one — before the
 * arguments are read and before the database is touched (§12, *Enforcement*).
 * `cancelBookings` is admin-only; the rest are admin and executive.
 *
 * ## Warnings are answers, not obstacles
 *
 * §9.3 asks for two warnings on edit and is explicit that neither blocks the
 * save: an overpayment sometimes genuinely means a refund is owed, and editing
 * a completed booking is sometimes exactly what the accountant asked for. So an
 * action that finds one returns `kind: 'confirm'` with the sentences to show,
 * and the same call arrives again with `acknowledged: true`. The alternative —
 * warning in the browser only — is a warning that a direct POST never sees.
 */

export type BookingActionResult =
  | { ok: true; id: string; bookingNumber?: string | null }
  | { ok: false; kind: 'error'; message: string }
  | { ok: false; kind: 'invalid'; message: string; fieldErrors: FieldErrors }
  | { ok: false; kind: 'confirm'; warnings: string[] };

/** Dotted paths — `rooms.0.pricePerNight` — so the form can mark the row. */
export type FieldErrors = Record<string, string>;

/**
 * One sentence for the person, and the detail in the log.
 *
 * A `NotAuthorisedError` is answered the same way whatever caused it, and a
 * database fault is never described — telling the caller which of the two it
 * was is telling them the shape of a system they have no business knowing
 * (`lib/auth-guard.ts`).
 */
function refuseMessage(error: unknown, fallback: string): string {
  if (error instanceof NotAuthorisedError) {
    return 'You do not have permission to do that.';
  }
  console.error(fallback, error);
  return fallback;
}

function refuse(error: unknown, fallback: string): BookingActionResult {
  return { ok: false, kind: 'error', message: refuseMessage(error, fallback) };
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join('.');
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/* --------------------------------------------------------------------------
   Draft autosave (§9.10, §20.4)
   -------------------------------------------------------------------------- */

/**
 * Save the draft, creating it on the first call.
 *
 * Called on every step change, which is why it parses with the lenient schema
 * and why a validation failure here is reported rather than thrown: a draft
 * that refuses to save because step 5 is empty while the person is still on
 * step 2 is a draft that quietly does not exist, and the twenty minutes of
 * entry it was holding go with the connection (§20.4).
 *
 * It returns the id so the form can keep saving over the same row instead of
 * leaving a trail of half-finished bookings behind each step.
 */
export async function saveDraftAction(input: {
  id: string | null;
  values: BookingValues;
}): Promise<BookingActionResult> {
  try {
    const user = await requireCapability('createBookings');

    const parsed = bookingDraftSchema.safeParse(input.values);
    if (!parsed.success) {
      return {
        ok: false,
        kind: 'invalid',
        message: 'Some details need attention.',
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      };
    }

    if (!input.id) {
      const id = await createDraft(parsed.data, user.id);
      await logAudit({
        actorId: user.id,
        action: 'booking.created',
        entityType: 'booking',
        entityId: id,
      });
      revalidatePath('/admin/bookings');
      return { ok: true, id };
    }

    const existing = await getBooking(input.id);
    if (!existing) {
      return { ok: false, kind: 'error', message: 'That booking is gone.' };
    }
    if (existing.status !== 'draft') {
      // A confirmed booking is edited through `saveBookingAction`, which has the
      // §9.3 guards in front of it. Autosave must not become a way around them.
      return {
        ok: false,
        kind: 'error',
        message: 'This booking is confirmed — edit it from its own screen.',
      };
    }

    await saveBooking(input.id, parsed.data, user.id);
    revalidatePath('/admin/bookings');
    return { ok: true, id: input.id };
  } catch (error) {
    return refuse(error, 'Could not save the draft.');
  }
}

/* --------------------------------------------------------------------------
   Confirming (§9.1)
   -------------------------------------------------------------------------- */

/**
 * Save the final state, then allocate the number.
 *
 * In that order, and not the other way round: the number is the thing that must
 * not be issued twice, so it is issued last, once everything that could fail
 * has already succeeded. A booking saved but not numbered is a draft the person
 * can confirm again; a number issued against a booking that then failed to save
 * is a number in the wild attached to nothing.
 */
export async function confirmBookingAction(input: {
  id: string | null;
  values: BookingValues;
}): Promise<BookingActionResult> {
  let confirmedId: string | null = null;

  try {
    const user = await requireCapability('confirmBookings');

    const parsed = bookingConfirmSchema.safeParse(input.values);
    if (!parsed.success) {
      return {
        ok: false,
        kind: 'invalid',
        message: 'The booking is not ready to confirm.',
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      };
    }

    let id = input.id;
    if (id) {
      const existing = await getBooking(id);
      if (!existing) {
        return { ok: false, kind: 'error', message: 'That booking is gone.' };
      }
      if (existing.status !== 'draft') {
        return {
          ok: false,
          kind: 'error',
          message: 'This booking already has a number.',
        };
      }
      await saveBooking(id, parsed.data, user.id);
    } else {
      // No draft row yet — the whole form arrived in one submit, which is what
      // happens when someone fills it in offline and reconnects.
      id = await createDraft(parsed.data, user.id);
      await logAudit({
        actorId: user.id,
        action: 'booking.created',
        entityType: 'booking',
        entityId: id,
      });
    }

    const settings = await getCompanySettings();
    const bookingNumber = await confirmBooking(id, user.id, {
      prefix: settings?.numberPrefix ?? 'AHR',
      // §9.5 — snapshotted now, so the booking always carries the terms that
      // applied when it was made, whatever settings say next year.
      terms: settings?.defaultTerms ?? null,
    });

    await logAudit({
      actorId: user.id,
      action: 'booking.confirmed',
      entityType: 'booking',
      entityId: id,
      changes: { detail: { bookingNumber } },
    });

    confirmedId = id;
    revalidatePath('/admin/bookings');
  } catch (error) {
    return refuse(error, 'Could not confirm the booking.');
  }

  // Outside the `try`: `redirect` works by throwing, and catching it here would
  // report a failure on a booking that was in fact confirmed — and invite the
  // person to confirm it a second time, which is how duplicate numbers happen.
  redirect(`/admin/bookings/${confirmedId}`);
}

/* --------------------------------------------------------------------------
   Editing a confirmed booking (§9.3)
   -------------------------------------------------------------------------- */

/**
 * Bookings stay editable after confirmation — hotels change, dates shift, room
 * counts move (§9.3). What changes is what has to be said out loud first.
 */
export async function saveBookingAction(input: {
  id: string;
  values: BookingValues;
  acknowledged?: boolean;
}): Promise<BookingActionResult> {
  try {
    const user = await requireCapability('editBookings');

    const existing = await getBooking(input.id);
    if (!existing) {
      return { ok: false, kind: 'error', message: 'That booking is gone.' };
    }

    // §9.3, and the one guard that refuses outright. A cancelled booking is a
    // historical record with its payments intact; editing it would rewrite what
    // was cancelled.
    if (existing.status === 'cancelled') {
      return {
        ok: false,
        kind: 'error',
        message: 'Cancelled bookings cannot be edited.',
      };
    }

    const schema =
      existing.status === 'draft' ? bookingDraftSchema : bookingConfirmSchema;
    const parsed = schema.safeParse(input.values);
    if (!parsed.success) {
      return {
        ok: false,
        kind: 'invalid',
        message: 'Some details need attention.',
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      };
    }

    if (!input.acknowledged) {
      const warnings = editWarnings(existing, parsed.data);
      if (warnings.length > 0) {
        return { ok: false, kind: 'confirm', warnings };
      }
    }

    await saveBooking(input.id, parsed.data, user.id);

    // Read back rather than assuming: the after-values that matter most are the
    // derived ones, and `recalculateBooking` is what decided them.
    const after = await getBooking(input.id);
    const changes = after
      ? diffBooking(
          existing as unknown as Record<string, unknown>,
          after as unknown as Record<string, unknown>,
        )
      : null;

    // §13.10 — full before and after. Because the invoice is re-rendered rather
    // than stored, this entry is the only surviving record of the figures the
    // client was previously shown. A draft has no such history to protect, and
    // logging every autosave would bury the edits that matter.
    if (existing.status !== 'draft' && changes) {
      await logAudit({
        actorId: user.id,
        action: 'booking.updated',
        entityType: 'booking',
        entityId: input.id,
        changes,
      });
    }

    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${input.id}`);
    return { ok: true, id: input.id };
  } catch (error) {
    return refuse(error, 'Could not save the booking.');
  }
}

/**
 * The two §9.3 warnings, in the spec's own words.
 *
 * The overpayment figure is computed from the incoming values against the
 * payments already recorded — the same arithmetic the server is about to run,
 * so the number quoted in the warning is the number that will be stored.
 */
function editWarnings(
  existing: { status: string; amountPaid: number; completedAt: number | null },
  values: {
    checkInDate: string;
    checkOutDate: string;
    rooms: readonly { numberOfRooms: number; numberOfGuests: number; pricePerNight: number }[];
    services: readonly { quantity: number; unitPrice: number }[];
    discountAmount: number;
  },
): string[] {
  const warnings: string[] = [];

  const totals = computeBookingTotals({
    checkInDate: dateStringToSeconds(values.checkInDate),
    checkOutDate: dateStringToSeconds(values.checkOutDate),
    rooms: values.rooms,
    services: values.services,
    discountAmount: values.discountAmount,
    vatAmount: 0,
    amountPaid: existing.amountPaid,
  });

  if (existing.amountPaid > totals.totalValue) {
    warnings.push(
      `Paid amount (${formatSAR(existing.amountPaid)}) exceeds the new booking value (${formatSAR(
        totals.totalValue,
      )}). A refund of ${formatSAR(existing.amountPaid - totals.totalValue)} may be owed.`,
    );
  }

  if (existing.status === 'completed') {
    warnings.push(
      'This booking is completed. Editing will change the reported total for the month it belongs to.',
    );
  }

  return warnings;
}

/* --------------------------------------------------------------------------
   Lifecycle — plain forms, so they work with no JavaScript at all
   -------------------------------------------------------------------------- */

export type SimpleActionState = { error: string | null };

export async function markCompletedAction(
  _previous: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  try {
    const user = await requireCapability('markCompleted');
    const id = String(formData.get('id') ?? '');

    const existing = await getBooking(id);
    if (!existing) return { error: 'That booking is gone.' };
    if (existing.status === 'cancelled' || existing.status === 'draft') {
      return { error: 'Only a live booking can be completed.' };
    }

    await setBookingStatus(id, 'completed', user.id);
    await logAudit({
      actorId: user.id,
      action: 'booking.completed',
      entityType: 'booking',
      entityId: id,
      changes: { before: { status: existing.status }, after: { status: 'completed' } },
    });

    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath('/admin/bookings');
    return { error: null };
  } catch (error) {
    return { error: refuseMessage(error, 'Could not mark the booking completed.') };
  }
}

/** Admin only (§12), and a reason is required (§9.8). */
export async function cancelBookingAction(
  _previous: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  try {
    const user = await requireCapability('cancelBookings');
    const id = String(formData.get('id') ?? '');

    const parsed = cancelBookingSchema.safeParse({
      cancelReason: formData.get('cancelReason') ?? '',
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Give a reason.' };
    }

    const existing = await getBooking(id);
    if (!existing) return { error: 'That booking is gone.' };
    if (existing.status === 'cancelled') return { error: null };
    if (existing.status === 'draft') {
      return { error: 'A draft is deleted, not cancelled.' };
    }

    await cancelBooking(id, parsed.data.cancelReason, user.id);
    await logAudit({
      actorId: user.id,
      action: 'booking.cancelled',
      entityType: 'booking',
      entityId: id,
      changes: {
        before: { status: existing.status },
        after: { status: 'cancelled' },
        detail: { reason: parsed.data.cancelReason },
      },
    });

    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath('/admin/bookings');
    return { error: null };
  } catch (error) {
    return { error: refuseMessage(error, 'Could not cancel the booking.') };
  }
}

/**
 * Delete a draft — the only outright deletion in the system (§9.8), and always
 * a person's deliberate act on the Drafts list. Nothing schedules this.
 */
export async function deleteDraftAction(
  _previous: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  let deleted = false;

  try {
    const user = await requireCapability('createBookings');
    const id = String(formData.get('id') ?? '');

    const existing = await getBooking(id);
    if (!existing) return { error: 'That draft is gone.' };
    if (existing.status !== 'draft') {
      return { error: 'Only drafts can be deleted.' };
    }

    await deleteDraft(id);
    await logAudit({
      actorId: user.id,
      action: 'booking.draft_deleted',
      entityType: 'booking',
      entityId: id,
      changes: { before: { agencyName: existing.agencyName, totalValue: existing.totalValue } },
    });

    revalidatePath('/admin/bookings');
    deleted = true;
  } catch (error) {
    return { error: refuseMessage(error, 'Could not delete the draft.') };
  }

  if (deleted) redirect('/admin/bookings?status=draft');
  return { error: null };
}
