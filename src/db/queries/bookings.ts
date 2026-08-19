import type { BatchItem } from 'drizzle-orm/batch';
import { and, asc, desc, eq, gte, like, lte, ne, or, sql, type SQL } from 'drizzle-orm';

import type { BookingParsed } from '@/lib/validation/booking';
import { dateStringToSeconds, nightsBetween, nowSeconds } from '@/lib/time';

import { getDb } from '../index';
import {
  bookingRooms,
  bookingServices,
  bookings,
  type BookingSource,
  type BookingStatus,
  type PaymentStatus,
} from '../schema';
import { recalculateBooking, type BookingTotals } from './bookings-calc';

/**
 * Bookings — the core entity, and the only one (§8).
 *
 * There is no invoice table for these functions to keep in step, which is what
 * makes them as short as they are: a booking's rooms, services and totals are
 * one row and two child tables, payments accumulate against it, and the PDF is
 * rendered from whatever this file returns at the moment it is asked.
 *
 * Two rules run through every mutation here:
 *
 * 1. **Rows first, `recalculateBooking` second.** Nothing in this file writes
 *    `totalValue`, `amountPaid` or `paymentStatus` by hand — see the note at
 *    the top of `bookings-calc.ts`. The derivation is one function and it runs
 *    last, over stored rows.
 * 2. **Snapshots are copies, not references** (§9.5). The agency and hotel
 *    details, the room type and meal plan names, and the terms are written into
 *    the booking. Editing an agency next year cannot rewrite a booking made
 *    this year, because that booking's PDF has already been sent.
 */

/* --------------------------------------------------------------------------
   Shapes
   -------------------------------------------------------------------------- */

export type BookingRoom = {
  id: string;
  roomTypeId: string | null;
  roomTypeName: string;
  mealPlanId: string | null;
  mealPlanCode: string | null;
  numberOfRooms: number;
  numberOfGuests: number;
  nights: number;
  pricePerNight: number;
  subtotal: number;
  sortOrder: number;
};

export type BookingService = {
  id: string;
  serviceTypeId: string | null;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
};

export type Booking = {
  id: string;
  bookingNumber: string | null;
  year: number | null;
  sequence: number | null;

  agencyId: string | null;
  agencyName: string;
  contactPerson: string | null;
  agencyMobile: string | null;
  agencyWhatsapp: string | null;
  agencyEmail: string | null;
  agencyCountry: string | null;
  agencyAddress: string | null;

  guestName: string | null;
  guestMobile: string | null;
  guestEmail: string | null;
  guestCountry: string | null;

  hotelId: string | null;
  hotelName: string | null;
  hotelCity: string | null;
  hotelCategory: string | null;
  confirmationNumber: string | null;
  brnVrn: string | null;
  bookingSource: BookingSource | null;

  checkInDate: number | null;
  checkOutDate: number | null;
  totalNights: number;
  totalRooms: number;
  totalGuests: number;

  bookingDate: number;
  dueDate: number | null;

  roomsSubtotal: number;
  servicesSubtotal: number;
  discountAmount: number;
  vatAmount: number;
  totalValue: number;
  amountPaid: number;

  status: BookingStatus;
  paymentStatus: PaymentStatus;

  notes: string | null;
  terms: string | null;
  cancelReason: string | null;

  createdBy: string;
  updatedBy: string | null;
  createdAt: number;
  updatedAt: number;
  confirmedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
};

export type BookingWithLines = Booking & {
  rooms: BookingRoom[];
  services: BookingService[];
};

/** What a list row needs, and no more — the list is the busiest query here. */
export type BookingSummary = {
  id: string;
  bookingNumber: string | null;
  agencyName: string;
  guestName: string | null;
  hotelName: string | null;
  hotelCity: string | null;
  checkInDate: number | null;
  checkOutDate: number | null;
  totalRooms: number;
  totalGuests: number;
  totalValue: number;
  amountPaid: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  updatedAt: number;
};

const SUMMARY_COLUMNS = {
  id: bookings.id,
  bookingNumber: bookings.bookingNumber,
  agencyName: bookings.agencyName,
  guestName: bookings.guestName,
  hotelName: bookings.hotelName,
  hotelCity: bookings.hotelCity,
  checkInDate: bookings.checkInDate,
  checkOutDate: bookings.checkOutDate,
  totalRooms: bookings.totalRooms,
  totalGuests: bookings.totalGuests,
  totalValue: bookings.totalValue,
  amountPaid: bookings.amountPaid,
  status: bookings.status,
  paymentStatus: bookings.paymentStatus,
  updatedAt: bookings.updatedAt,
} as const;

/* --------------------------------------------------------------------------
   Reading
   -------------------------------------------------------------------------- */

export async function getBooking(id: string): Promise<BookingWithLines | null> {
  const db = getDb();

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) return null;

  const rooms = await db
    .select()
    .from(bookingRooms)
    .where(eq(bookingRooms.bookingId, id))
    .orderBy(asc(bookingRooms.sortOrder));

  const services = await db
    .select()
    .from(bookingServices)
    .where(eq(bookingServices.bookingId, id))
    .orderBy(asc(bookingServices.sortOrder));

  return { ...(booking as Booking), rooms, services };
}

export type BookingFilters = {
  /** §13.6's search: number, agency, contact, guest, hotel, confirmation, BRN, phone. */
  search?: string;
  /**
   * A specific lifecycle state, or nothing.
   *
   * **Nothing means "not a draft."** Drafts are excluded from every ordinary
   * view (§9.10) and reached through the Drafts filter, which is this parameter
   * set to `draft` — one code path for both, rather than a boolean that has to
   * agree with the status filter beside it.
   */
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  agencyId?: string;
  hotelId?: string;
  city?: string;
  createdBy?: string;
  /** Which date the range applies to. */
  dateField?: 'booking' | 'checkIn' | 'checkOut';
  from?: number | null;
  to?: number | null;
  limit?: number;
};

export async function listBookings(
  filters: BookingFilters = {},
): Promise<BookingSummary[]> {
  const db = getDb();
  const where: SQL[] = [];

  if (filters.status) {
    where.push(eq(bookings.status, filters.status));
  } else {
    where.push(ne(bookings.status, 'draft'));
  }

  if (filters.paymentStatus) {
    where.push(eq(bookings.paymentStatus, filters.paymentStatus));
  }
  if (filters.agencyId) where.push(eq(bookings.agencyId, filters.agencyId));
  if (filters.hotelId) where.push(eq(bookings.hotelId, filters.hotelId));
  if (filters.city) where.push(eq(bookings.hotelCity, filters.city));
  if (filters.createdBy) where.push(eq(bookings.createdBy, filters.createdBy));

  const column =
    filters.dateField === 'checkIn'
      ? bookings.checkInDate
      : filters.dateField === 'checkOut'
        ? bookings.checkOutDate
        : bookings.bookingDate;

  if (filters.from) where.push(gte(column, filters.from));
  if (filters.to) where.push(lte(column, filters.to));

  const term = filters.search?.trim();
  if (term) {
    // `%` and `_` are LIKE wildcards; searching for "50%" should find "50%".
    // Same treatment as the agency search, for the same reason.
    const pattern = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

    const match = or(
      like(bookings.bookingNumber, pattern),
      like(bookings.agencyName, pattern),
      like(bookings.contactPerson, pattern),
      like(bookings.guestName, pattern),
      like(bookings.hotelName, pattern),
      like(bookings.confirmationNumber, pattern),
      like(bookings.brnVrn, pattern),
      like(bookings.agencyMobile, pattern),
      like(bookings.guestMobile, pattern),
    );
    if (match) where.push(match);
  }

  return db
    .select(SUMMARY_COLUMNS)
    .from(bookings)
    .where(and(...where))
    // Drafts by when they were last touched — the Drafts list is a review queue
    // and the stale ones are the point (§9.10). Everything else by the date the
    // booking was written, which is the order staff think in.
    .orderBy(
      filters.status === 'draft'
        ? desc(bookings.updatedAt)
        : desc(bookings.bookingDate),
      desc(bookings.createdAt),
    )
    .limit(filters.limit ?? 200);
}

/**
 * The §13.8 agency profile figures, which Phase 9 shipped a placeholder for
 * because this table did not exist yet.
 *
 * Drafts and cancelled bookings are excluded from every figure, per §9.8 and
 * §9.10 — the same exclusion the dashboard's three money figures use (§13.2),
 * and it has to be the same or an agency's total will not match the report's.
 */
export async function getAgencyTotals(agencyId: string): Promise<{
  bookingCount: number;
  totalRooms: number;
  totalGuests: number;
  totalValue: number;
  received: number;
  outstanding: number;
}> {
  const db = getDb();

  const [row] = await db
    .select({
      bookingCount: sql<number>`COUNT(*)`,
      totalRooms: sql<number>`COALESCE(SUM(${bookings.totalRooms}), 0)`,
      totalGuests: sql<number>`COALESCE(SUM(${bookings.totalGuests}), 0)`,
      totalValue: sql<number>`COALESCE(SUM(${bookings.totalValue}), 0)`,
      received: sql<number>`COALESCE(SUM(${bookings.amountPaid}), 0)`,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.agencyId, agencyId),
        ne(bookings.status, 'draft'),
        ne(bookings.status, 'cancelled'),
      ),
    );

  const totalValue = Number(row?.totalValue ?? 0);
  const received = Number(row?.received ?? 0);

  return {
    bookingCount: Number(row?.bookingCount ?? 0),
    totalRooms: Number(row?.totalRooms ?? 0),
    totalGuests: Number(row?.totalGuests ?? 0),
    totalValue,
    received,
    outstanding: totalValue - received,
  };
}

/* --------------------------------------------------------------------------
   Writing
   -------------------------------------------------------------------------- */

/**
 * The columns a form owns, mapped from validated input.
 *
 * Everything derived is absent by construction: this object cannot carry
 * `totalValue` or `paymentStatus`, so no call site can accidentally set one.
 * The empty-string-to-null narrowing on the three enum-ish fields happens here
 * rather than in the schema, because `''` is what a `<select>` with no choice
 * made submits and `null` is what the column means.
 */
function toColumns(input: BookingParsed) {
  return {
    agencyId: input.agencyId,
    agencyName: input.agencyName,
    contactPerson: input.contactPerson,
    agencyMobile: input.agencyMobile,
    agencyWhatsapp: input.agencyWhatsapp,
    agencyEmail: input.agencyEmail,
    agencyCountry: input.agencyCountry,
    agencyAddress: input.agencyAddress,

    guestName: input.guestName,
    guestMobile: input.guestMobile,
    guestEmail: input.guestEmail,
    guestCountry: input.guestCountry,

    hotelId: input.hotelId,
    hotelName: input.hotelName,
    hotelCity: input.hotelCity || null,
    hotelCategory: input.hotelCategory || null,
    confirmationNumber: input.confirmationNumber,
    brnVrn: input.brnVrn,
    bookingSource: input.bookingSource || null,

    checkInDate: dateStringToSeconds(input.checkInDate),
    checkOutDate: dateStringToSeconds(input.checkOutDate),
    dueDate: dateStringToSeconds(input.dueDate),

    discountAmount: input.discountAmount,
    notes: input.notes,
  };
}

/**
 * Replace a booking's room and service lines.
 *
 * Delete-then-insert rather than a per-row diff: the form is a repeater whose
 * rows have no stable identity for the person using it — dragging a room to the
 * top and editing its price is one gesture, and matching that to an UPDATE by
 * id is work that buys nothing on a booking with four rooms. The four
 * statements go in one `db.batch`, which D1 runs as a single transaction, so a
 * booking is never briefly roomless.
 *
 * `nights` is stamped onto each line from the booking's dates, never taken from
 * the client (§9.6).
 */
async function replaceLines(
  bookingId: string,
  input: BookingParsed,
): Promise<void> {
  const db = getDb();
  const nights = nightsBetween(
    dateStringToSeconds(input.checkInDate),
    dateStringToSeconds(input.checkOutDate),
  );

  const statements: BatchItem<'sqlite'>[] = [
    db.delete(bookingRooms).where(eq(bookingRooms.bookingId, bookingId)),
    db.delete(bookingServices).where(eq(bookingServices.bookingId, bookingId)),
  ];

  if (input.rooms.length > 0) {
    statements.push(
      db.insert(bookingRooms).values(
        input.rooms.map((room, index) => ({
          id: crypto.randomUUID(),
          bookingId,
          roomTypeId: room.roomTypeId,
          roomTypeName: room.roomTypeName,
          mealPlanId: room.mealPlanId,
          mealPlanCode: room.mealPlanCode,
          numberOfRooms: room.numberOfRooms,
          numberOfGuests: room.numberOfGuests,
          nights,
          pricePerNight: room.pricePerNight,
          subtotal: room.numberOfRooms * nights * room.pricePerNight,
          sortOrder: index,
        })),
      ),
    );
  }

  if (input.services.length > 0) {
    statements.push(
      db.insert(bookingServices).values(
        input.services.map((service, index) => ({
          id: crypto.randomUUID(),
          bookingId,
          serviceTypeId: service.serviceTypeId,
          serviceName: service.serviceName,
          quantity: service.quantity,
          unitPrice: service.unitPrice,
          total: service.quantity * service.unitPrice,
          sortOrder: index,
        })),
      ),
    );
  }

  await db.batch(
    statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]],
  );
}

/**
 * Create the draft row (§9.10).
 *
 * `bookingNumber` stays null — numbers are allocated at confirmation (§9.1), so
 * an abandoned draft leaves no gap in the series. `bookingDate` is stamped now
 * and is the date the work was written; it is what §13.2 recognises the value
 * at, and it does not move when the booking is later confirmed, because the
 * work was done on the day it was done.
 */
export async function createDraft(
  input: BookingParsed,
  userId: string,
): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = nowSeconds();

  await db.insert(bookings).values({
    id,
    ...toColumns(input),
    bookingDate: now,
    status: 'draft',
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  await replaceLines(id, input);
  await recalculateBooking(id);

  return id;
}

/**
 * Save over an existing booking — the draft autosave, and the confirmed-booking
 * edit, which are the same write with different guards in front of them (§9.3).
 *
 * Returns the recalculated totals so the caller can raise the overpayment
 * warning without a second read.
 */
export async function saveBooking(
  id: string,
  input: BookingParsed,
  userId: string,
): Promise<BookingTotals> {
  const db = getDb();

  await db
    .update(bookings)
    .set({ ...toColumns(input), updatedBy: userId, updatedAt: nowSeconds() })
    .where(eq(bookings.id, id));

  await replaceLines(id, input);
  return recalculateBooking(id);
}

/**
 * Allocate the next sequence for a year (§9.1).
 *
 * One statement, because D1 has no interactive transactions and a read followed
 * by a write would hand two executives confirming at the same moment the same
 * number.
 *
 * **The failure direction is deliberate.** If this succeeds and the update that
 * writes the number onto the booking then fails, the sequence is burned and the
 * year's numbering has a gap. That is the right way round: a gap in AHR
 * numbering is a cosmetic problem that someone might one day ask about, and a
 * duplicate number is a financial one — two bookings quoting `AHR-2026-00041`
 * at two different agencies, with two different totals, and no way to tell
 * which invoice a payment referred to.
 */
async function allocateSequence(year: number): Promise<number> {
  const db = getDb();

  const rows = await db.all<{ last_sequence: number }>(
    sql`INSERT INTO booking_counters (year, last_sequence) VALUES (${year}, 1)
        ON CONFLICT(year) DO UPDATE SET last_sequence = last_sequence + 1
        RETURNING last_sequence`,
  );

  const sequence = Number(rows?.[0]?.last_sequence);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error('Could not allocate a booking number.');
  }

  return sequence;
}

export function formatBookingNumber(
  prefix: string,
  year: number,
  sequence: number,
): string {
  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Confirm a draft: allocate the number, snapshot the terms, stamp the time.
 *
 * The year comes from `bookingDate` rather than from the clock, so a booking
 * written on 31 December and confirmed on 1 January carries the year its value
 * is recognised in (§13.2) — otherwise the number and the report would disagree
 * about which year it belonged to.
 */
export async function confirmBooking(
  id: string,
  userId: string,
  options: { prefix: string; terms: string | null },
): Promise<string> {
  const db = getDb();

  const [row] = await db
    .select({ bookingDate: bookings.bookingDate })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!row) throw new Error(`confirmBooking: no booking ${id}`);

  const year = new Date(row.bookingDate * 1000).getUTCFullYear();
  const sequence = await allocateSequence(year);
  const bookingNumber = formatBookingNumber(options.prefix, year, sequence);
  const now = nowSeconds();

  await db
    .update(bookings)
    .set({
      bookingNumber,
      year,
      sequence,
      status: 'confirmed',
      // §9.5 — the terms in force at this moment, kept with the booking so the
      // PDF always renders the terms that applied when it was made.
      terms: options.terms,
      confirmedAt: now,
      updatedBy: userId,
      updatedAt: now,
    })
    .where(eq(bookings.id, id));

  return bookingNumber;
}

/** Move along the lifecycle: checked_in, checked_out, completed (§9.7). */
export async function setBookingStatus(
  id: string,
  status: Exclude<BookingStatus, 'draft' | 'cancelled'>,
  userId: string,
): Promise<void> {
  const db = getDb();
  const now = nowSeconds();

  await db
    .update(bookings)
    .set({
      status,
      completedAt: status === 'completed' ? now : undefined,
      updatedBy: userId,
      updatedAt: now,
    })
    .where(eq(bookings.id, id));
}

/**
 * Cancel (§9.8). Never a delete: the row keeps its number, its history and its
 * payments, drops out of every total and out of the scheduler, and stays in the
 * list behind a badge. Refunds are recorded as payment reversals, not by
 * removing what was paid.
 */
export async function cancelBooking(
  id: string,
  reason: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  const now = nowSeconds();

  await db
    .update(bookings)
    .set({
      status: 'cancelled',
      cancelReason: reason,
      cancelledAt: now,
      updatedBy: userId,
      updatedAt: now,
    })
    .where(eq(bookings.id, id));
}

/**
 * Delete a draft — **the only outright deletion in the system** (§9.8, §9.10),
 * and only ever triggered by a person looking at the Drafts list.
 *
 * There is no TTL purge and no cleanup cron behind this function, and none
 * should be added: silently deleting someone's half-finished work is worse than
 * leaving clutter in a list. The guard against deleting anything else is here
 * as well as in the action, because this is the one function in the file that
 * cannot be undone.
 */
export async function deleteDraft(id: string): Promise<void> {
  const db = getDb();

  await db
    .delete(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.status, 'draft')));
}
