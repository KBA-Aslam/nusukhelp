'use server';

import { revalidatePath } from 'next/cache';

import { logAudit } from '@/db/queries/audit';
import { getBooking } from '@/db/queries/bookings';
import { getPaymentMethod } from '@/db/queries/lookups';
import {
  getPayment,
  recordPayment,
  reversePayment,
} from '@/db/queries/payments';
import {
  fieldErrorsFrom,
  refuseMessage,
  type FieldErrors,
} from '@/lib/action-result';
import { requireCapability } from '@/lib/auth-guard';
import { formatSAR } from '@/lib/format';
import { dateStringToSeconds, todayInRiyadh } from '@/lib/time';
import {
  recordPaymentSchema,
  reversePaymentSchema,
  type RecordPaymentValues,
} from '@/lib/validation/payment';

/**
 * Payment mutations (§9.4, §13.4).
 *
 * ## The guards, and why they are here rather than in the form
 *
 * `requireCapability` is the first statement of each action — recording is
 * admin and executive, reversing is **admin only** (§12). The detail screen
 * hides what a role cannot do, but hiding a control is not a permission: a
 * server action is a POST that can be made without ever loading the page it
 * belongs to.
 *
 * The §9.4 status rules are enforced here for the same reason. A payment
 * against a draft or a cancelled booking is refused by this module, not by the
 * absence of a button.
 *
 * ## Two things are warned about, neither is blocked
 *
 * Paying more than the balance due, and dating a payment in the future. Both
 * happen legitimately — a client overpays and is owed a refund; a transfer is
 * recorded the day before it lands — and both are usually a typo. §9.3 already
 * settled how this project answers that question: return `kind: 'confirm'` with
 * the sentence to show, and take the same submission back with
 * `acknowledged: true`. The person decides; the system makes sure they saw it.
 *
 * ## Nothing here computes a total
 *
 * `recordPayment` and `reversePayment` end by calling `recalculateBooking`
 * (Phase 10 ruling 2). These actions read the figures back from what it wrote,
 * so the balance quoted in the confirmation is the balance that is stored.
 */

export type PaymentActionResult =
  | { ok: true; message: string }
  | { ok: false; kind: 'error'; message: string }
  | { ok: false; kind: 'invalid'; message: string; fieldErrors: FieldErrors }
  | { ok: false; kind: 'confirm'; warnings: string[] };

/**
 * A reversal has nothing to warn about — it can only ever reduce what is owed,
 * and the reason field is already the moment of second thought. Saying so in
 * the type keeps the form from carrying a branch that cannot happen.
 */
export type ReversalActionResult = Exclude<
  PaymentActionResult,
  { kind: 'confirm' }
>;

function refuse(
  error: unknown,
  fallback: string,
): { ok: false; kind: 'error'; message: string } {
  return { ok: false, kind: 'error', message: refuseMessage(error, fallback) };
}

/* --------------------------------------------------------------------------
   Recording (§9.4)
   -------------------------------------------------------------------------- */

export async function recordPaymentAction(input: {
  bookingId: string;
  values: RecordPaymentValues;
  acknowledged?: boolean;
}): Promise<PaymentActionResult> {
  try {
    const user = await requireCapability('recordPayments');

    const booking = await getBooking(input.bookingId);
    if (!booking) {
      return { ok: false, kind: 'error', message: 'That booking is gone.' };
    }

    // §9.4, both of them. A draft has no number and no agreed value yet, so a
    // payment against it has nothing to be a payment *for*; a cancelled booking
    // is a closed record, and money moving after cancellation is a refund —
    // which is a reversal of what is already there, not a new instalment.
    if (booking.status === 'draft') {
      return {
        ok: false,
        kind: 'error',
        message: 'Confirm the booking before recording a payment against it.',
      };
    }
    if (booking.status === 'cancelled') {
      return {
        ok: false,
        kind: 'error',
        message:
          'This booking is cancelled. A refund is recorded by reversing the original payment, which keeps both entries in the history.',
      };
    }

    const parsed = recordPaymentSchema.safeParse(input.values);
    if (!parsed.success) {
      return {
        ok: false,
        kind: 'invalid',
        message: 'Some details need attention.',
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      };
    }

    // The schema guarantees the shape; `dateStringToSeconds` is the only clock
    // (§8), and it cannot return null for a string that matched the pattern.
    const paidAt = dateStringToSeconds(parsed.data.paidAt);
    if (paidAt === null) {
      return {
        ok: false,
        kind: 'invalid',
        message: 'Some details need attention.',
        fieldErrors: { paidAt: 'Enter the date the money arrived.' },
      };
    }

    if (!input.acknowledged) {
      const warnings = recordWarnings(booking, parsed.data.amount, paidAt);
      if (warnings.length > 0) {
        return { ok: false, kind: 'confirm', warnings };
      }
    }

    // §9.5 — the name is copied, not referenced. Renaming a method next year
    // must not rewrite what a receipt already said.
    let methodName: string | null = null;
    if (parsed.data.methodId) {
      const method = await getPaymentMethod(parsed.data.methodId);
      if (!method) {
        return {
          ok: false,
          kind: 'invalid',
          message: 'Some details need attention.',
          fieldErrors: { methodId: 'Choose a payment method from the list.' },
        };
      }
      methodName = method.name;
    }

    const { id, totals } = await recordPayment(
      input.bookingId,
      { ...parsed.data, paidAt, methodName },
      user.id,
    );

    await logAudit({
      actorId: user.id,
      action: 'payment.recorded',
      entityType: 'booking',
      entityId: input.bookingId,
      changes: {
        before: {
          amountPaid: booking.amountPaid,
          paymentStatus: booking.paymentStatus,
        },
        after: {
          amountPaid: totals.amountPaid,
          paymentStatus: totals.paymentStatus,
        },
        detail: {
          paymentId: id,
          amount: parsed.data.amount,
          method: methodName,
          reference: parsed.data.reference,
        },
      },
    });

    revalidatePath(`/admin/bookings/${input.bookingId}`);
    revalidatePath('/admin/bookings');

    return { ok: true, message: settledMessage(totals.balanceDue) };
  } catch (error) {
    return refuse(error, 'Could not record the payment.');
  }
}

/**
 * The two warnings, in figures the person can check against the money strip.
 *
 * The overpayment figure is computed from the incoming amount against the
 * booking's *stored* `amountPaid` — the same numbers `recalculateBooking` is
 * about to work from — so the sentence quotes what will actually be true.
 */
function recordWarnings(
  booking: { amountPaid: number; totalValue: number },
  amount: number,
  paidAt: number,
): string[] {
  const warnings: string[] = [];

  const balanceDue = booking.totalValue - booking.amountPaid;
  if (amount > balanceDue) {
    warnings.push(
      `That is more than the balance due (${formatSAR(balanceDue)}). Recording it leaves the booking overpaid by ${formatSAR(
        amount - balanceDue,
      )}, and a refund may be owed.`,
    );
  }

  if (paidAt > todayInRiyadh()) {
    warnings.push(
      'The payment date is in the future. Money received is reported against that date, so this payment will count in a later month than today.',
    );
  }

  return warnings;
}

function settledMessage(balanceDue: number): string {
  if (balanceDue > 0) {
    return `Payment recorded. ${formatSAR(balanceDue)} still due.`;
  }
  if (balanceDue < 0) {
    return `Payment recorded. The booking is overpaid by ${formatSAR(-balanceDue)}.`;
  }
  return 'Payment recorded. The booking is paid in full.';
}

/* --------------------------------------------------------------------------
   Reversing (§9.4) — admin only, and never a delete
   -------------------------------------------------------------------------- */

export async function reversePaymentAction(input: {
  paymentId: string;
  values: { reverseReason: string };
}): Promise<ReversalActionResult> {
  try {
    const user = await requireCapability('reversePayments');

    const payment = await getPayment(input.paymentId);
    if (!payment) {
      return { ok: false, kind: 'error', message: 'That payment is gone.' };
    }

    // Not an error. Two taps, or a retry after a dropped connection on a phone,
    // should read as "already done" rather than as a failure — and the update
    // itself refuses the second write, so nothing was overwritten.
    if (payment.isReversed) {
      return { ok: true, message: 'That payment was already reversed.' };
    }

    const parsed = reversePaymentSchema.safeParse(input.values);
    if (!parsed.success) {
      return {
        ok: false,
        kind: 'invalid',
        message: 'A reason is needed.',
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      };
    }

    const booking = await getBooking(payment.bookingId);

    const totals = await reversePayment(
      payment,
      parsed.data.reverseReason,
      user.id,
    );

    await logAudit({
      actorId: user.id,
      action: 'payment.reversed',
      entityType: 'booking',
      entityId: payment.bookingId,
      changes: {
        before: {
          amountPaid: booking?.amountPaid ?? null,
          paymentStatus: booking?.paymentStatus ?? null,
        },
        after: {
          amountPaid: totals.amountPaid,
          paymentStatus: totals.paymentStatus,
        },
        detail: {
          paymentId: payment.id,
          amount: payment.amount,
          reason: parsed.data.reverseReason,
        },
      },
    });

    revalidatePath(`/admin/bookings/${payment.bookingId}`);
    revalidatePath('/admin/bookings');

    return {
      ok: true,
      message: `Payment reversed. Paid is now ${formatSAR(totals.amountPaid)}.`,
    };
  } catch (error) {
    return refuse(error, 'Could not reverse the payment.');
  }
}
