import { eq, sql } from 'drizzle-orm';

import { computeBookingTotals, type BookingTotals } from '@/lib/booking-math';

import { getDb } from '../index';
import { bookingRooms, bookingServices, bookings, payments } from '../schema';

/**
 * Every derived value in the system, computed in one place (§9.6).
 *
 * ## Why this file exists at all
 *
 * `amountPaid` and `paymentStatus` move for two entirely different reasons, and
 * the reasons live in different phases. A payment recorded, reversed or deleted
 * changes the numerator (§9.4, Phase 11). **A booking edited changes the
 * denominator** (§9.3, this phase): drop a 5,000 booking to 4,000 and a 4,000
 * part-payment has just become payment in full, with nothing in the payments
 * table having moved at all.
 *
 * §9.2 states that plainly — *"the derivation must run on both sides"* — and the
 * only way to keep that true across three phases is for there to be exactly one
 * function that does it. So `recalculateBooking` is the single writer of
 * `roomsSubtotal`, `servicesSubtotal`, `totalValue`, `totalNights`,
 * `totalRooms`, `totalGuests`, `amountPaid` and `paymentStatus`, and every
 * mutation path in Phases 10, 11 and 12 ends by calling it.
 *
 * **If a second place ever computes `amountPaid` or `paymentStatus`, that is
 * the bug this design exists to prevent.** A payment action that updates the
 * total itself, or a report that re-derives the status in SQL "just for the
 * query", is how the two copies start disagreeing — and the way they disagree
 * is that a booking reads *paid* on one screen and *partially paid* on another.
 *
 * ## Where the arithmetic itself lives
 *
 * In `lib/booking-math.ts`, which has no database imports, so the booking form
 * can show a running total from the same expressions without dragging Drizzle
 * into the browser bundle. The *authority* stays here: that module computes,
 * this one writes.
 */

export * from '@/lib/booking-math';

/* --------------------------------------------------------------------------
   The one writer
   -------------------------------------------------------------------------- */

/**
 * Recompute every derived column on a booking from its current rows, and write
 * them back. Returns the figures, so a caller that needs to warn about an
 * overpayment (§9.3) does not have to read them again.
 *
 * Call this at the end of **every** mutation that can move a figure:
 *
 * - creating or updating a draft (rooms, services, dates, discount)
 * - confirming
 * - editing a confirmed booking
 * - recording a payment · reversing one · deleting one (Phase 11)
 *
 * Four reads and one write, not a transaction. D1 has no interactive
 * transactions, so there is no way to hold the rows still while computing; the
 * mitigation is that this function is cheap, idempotent, and derives everything
 * from stored rows rather than from anything passed in — so running it twice,
 * or running it after a concurrent edit, converges rather than compounds. The
 * caller writes its rows first and recalculates second, always in that order.
 */
export async function recalculateBooking(
  bookingId: string,
): Promise<BookingTotals> {
  const db = getDb();

  const [booking] = await db
    .select({
      checkInDate: bookings.checkInDate,
      checkOutDate: bookings.checkOutDate,
      discountAmount: bookings.discountAmount,
      vatAmount: bookings.vatAmount,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new Error(`recalculateBooking: no booking ${bookingId}`);
  }

  const rooms = await db
    .select({
      numberOfRooms: bookingRooms.numberOfRooms,
      numberOfGuests: bookingRooms.numberOfGuests,
      pricePerNight: bookingRooms.pricePerNight,
    })
    .from(bookingRooms)
    .where(eq(bookingRooms.bookingId, bookingId));

  const services = await db
    .select({
      quantity: bookingServices.quantity,
      unitPrice: bookingServices.unitPrice,
    })
    .from(bookingServices)
    .where(eq(bookingServices.bookingId, bookingId));

  // §9.4: reversed payments are excluded from the sum and kept in the history.
  // `COALESCE` because SUM over no rows is NULL, and a booking with no payments
  // must read 0 — which is `unpaid`, which is correct and is why the payments
  // table ships in this phase rather than being stubbed.
  const [paid] = await db
    .select({
      amountPaid: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(
      sql`${payments.bookingId} = ${bookingId} AND ${payments.isReversed} = 0`,
    );

  const totals = computeBookingTotals({
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    rooms,
    services,
    discountAmount: booking.discountAmount,
    vatAmount: booking.vatAmount,
    amountPaid: Number(paid?.amountPaid ?? 0),
  });

  await db
    .update(bookings)
    .set({
      totalNights: totals.totalNights,
      totalRooms: totals.totalRooms,
      totalGuests: totals.totalGuests,
      roomsSubtotal: totals.roomsSubtotal,
      servicesSubtotal: totals.servicesSubtotal,
      totalValue: totals.totalValue,
      amountPaid: totals.amountPaid,
      paymentStatus: totals.paymentStatus,
    })
    .where(eq(bookings.id, bookingId));

  return totals;
}
