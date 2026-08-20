import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { nowSeconds } from '@/lib/time';
import type { RecordPaymentParsed } from '@/lib/validation/payment';

import { getDb } from '../index';
import { payments, user } from '../schema';
import { recalculateBooking, type BookingTotals } from './bookings-calc';

/**
 * Payments — instalments against a booking (§9.4).
 *
 * ## Nothing here writes a total
 *
 * Every function in this file ends by calling `recalculateBooking`, and none of
 * them touches `amountPaid` or `paymentStatus` itself. That is Phase 10
 * ruling 2, and it is the whole reason the `payments` table shipped a phase
 * before this one: the derivation has a single implementation that sums stored
 * rows, so a payment recorded here and a booking edited over there can never
 * arrive at two different answers. The tempting shortcut — `amountPaid + amount`
 * on insert — is exactly the bug the design exists to prevent, and the way it
 * surfaces is a booking reading *paid* on the detail screen and *partially
 * paid* on the list.
 *
 * ## Nothing here deletes
 *
 * A payment is reversed, never removed (§9.4). Reversal is an update that sets
 * `isReversed` and records the reason, the user and the time; the history then
 * shows the original **and** the reversal, which is what a refund actually
 * looks like on paper. `recalculateBooking` sums only the rows where
 * `isReversed` is false, so the money moves and the record stays.
 *
 * ## Method names are snapshotted
 *
 * `methodName` is copied from the lookup row at the moment of recording (§9.5),
 * alongside the soft `methodId`. Renaming "Bank transfer" to "SWIFT" next year
 * must not rewrite what a receipt already said, and the payment method may also
 * be one the list no longer offers.
 */

export type Payment = {
  id: string;
  bookingId: string;
  amount: number;
  paidAt: number;
  methodId: string | null;
  methodName: string | null;
  reference: string | null;
  notes: string | null;
  isReversed: boolean;
  reversedAt: number | null;
  reverseReason: string | null;
  createdAt: number;
  /** Joined, not snapshotted — see the note in `listAuditForEntity`. */
  recordedByName: string | null;
  reversedByName: string | null;
};

/**
 * One booking's payment history, **oldest first**.
 *
 * The opposite order to the audit timeline, and deliberately: this reads as a
 * statement of account — an advance, then a settlement — and a statement runs
 * forwards. `paidAt` orders it rather than `createdAt`, because a payment
 * entered late still happened when it happened; `createdAt` only breaks ties
 * between two payments on the same day.
 */
export async function listPayments(bookingId: string): Promise<Payment[]> {
  const db = getDb();
  const reverser = alias(user, 'reverser');

  const rows = await db
    .select({
      id: payments.id,
      bookingId: payments.bookingId,
      amount: payments.amount,
      paidAt: payments.paidAt,
      methodId: payments.methodId,
      methodName: payments.methodName,
      reference: payments.reference,
      notes: payments.notes,
      isReversed: payments.isReversed,
      reversedAt: payments.reversedAt,
      reverseReason: payments.reverseReason,
      createdAt: payments.createdAt,
      recordedByName: user.name,
      reversedByName: reverser.name,
    })
    .from(payments)
    .leftJoin(user, eq(payments.recordedBy, user.id))
    .leftJoin(reverser, eq(payments.reversedBy, reverser.id))
    .where(eq(payments.bookingId, bookingId))
    .orderBy(asc(payments.paidAt), asc(payments.createdAt));

  return rows.map((row) => ({
    ...row,
    isReversed: Boolean(row.isReversed),
    recordedByName: row.recordedByName ?? null,
    reversedByName: row.reversedByName ?? null,
  }));
}

/** One payment, for the guards in front of a reversal. */
export async function getPayment(id: string): Promise<{
  id: string;
  bookingId: string;
  amount: number;
  isReversed: boolean;
} | null> {
  const db = getDb();

  const [row] = await db
    .select({
      id: payments.id,
      bookingId: payments.bookingId,
      amount: payments.amount,
      isReversed: payments.isReversed,
    })
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);

  return row ? { ...row, isReversed: Boolean(row.isReversed) } : null;
}

export type RecordedPayment = {
  id: string;
  totals: BookingTotals;
};

/**
 * Insert the payment, then recalculate — in that order, always.
 *
 * `paidAt` arrives already converted to seconds: the schema speaks
 * `YYYY-MM-DD` because that is what the date input speaks, and `lib/time.ts`
 * is the only clock (§8).
 *
 * The returned totals are the stored ones, so a caller that wants to say
 * *"balance now 4,000"* does not read the booking again to find out.
 */
export type RecordPaymentInput = Omit<RecordPaymentParsed, 'paidAt'> & {
  /** Seconds, converted by the caller — `lib/time.ts` is the only clock (§8). */
  paidAt: number;
  /** Resolved from the lookup and copied in (§9.5). */
  methodName: string | null;
};

export async function recordPayment(
  bookingId: string,
  input: RecordPaymentInput,
  userId: string,
): Promise<RecordedPayment> {
  const db = getDb();
  const id = crypto.randomUUID();

  await db.insert(payments).values({
    id,
    bookingId,
    amount: input.amount,
    paidAt: input.paidAt,
    methodId: input.methodId,
    methodName: input.methodName,
    reference: input.reference,
    notes: input.notes,
    recordedBy: userId,
    createdAt: nowSeconds(),
  });

  const totals = await recalculateBooking(bookingId);
  return { id, totals };
}

/**
 * Reverse a payment (§9.4) — an update, never a delete.
 *
 * The `isReversed = false` in the `where` is not belt and braces. It makes the
 * statement idempotent: two taps on **Reverse**, or a retry after a dropped
 * connection, cannot overwrite the first reversal's reason and timestamp with
 * the second one's. The action checks as well, but the check and the write are
 * two round trips on D1 and something can always land between them.
 */
export async function reversePayment(
  payment: { id: string; bookingId: string },
  reason: string,
  userId: string,
): Promise<BookingTotals> {
  const db = getDb();

  await db
    .update(payments)
    .set({
      isReversed: true,
      reversedAt: nowSeconds(),
      reversedBy: userId,
      reverseReason: reason,
    })
    .where(and(eq(payments.id, payment.id), eq(payments.isReversed, false)));

  return recalculateBooking(payment.bookingId);
}
