import { nightsBetween } from '@/lib/time';

import type { PaymentStatus } from '@/db/schema';

/**
 * The booking arithmetic (§9.6), with no database and no I/O.
 *
 * Split out of `db/queries/bookings-calc.ts` so that the booking form can show
 * a running total (§13.3) from **the same expressions the server will use**.
 * Importing the query module into a client component would pull Drizzle and the
 * Cloudflare context into the browser bundle; importing a second, hand-written
 * copy of the sums into the form would be worse than either — it would be a
 * running total that agrees with the saved figure most of the time.
 *
 * The client figure remains display only. §9.6 is categorical that every value
 * is recomputed server-side on submit, and `recalculateBooking` is the only
 * thing that writes one. What lives here is the shared arithmetic, not shared
 * authority.
 *
 * Every quantity is a whole Saudi Riyal (§8). Nothing divides, nothing rounds,
 * nothing is a float.
 */

export type RoomLineInput = {
  numberOfRooms: number;
  numberOfGuests: number;
  pricePerNight: number;
};

export type ServiceLineInput = {
  quantity: number;
  unitPrice: number;
};

/** `numberOfRooms × nights × pricePerNight` (§9.6). */
export function roomSubtotal(room: RoomLineInput, nights: number): number {
  return room.numberOfRooms * nights * room.pricePerNight;
}

/** `quantity × unitPrice` (§9.6). */
export function serviceTotal(service: ServiceLineInput): number {
  return service.quantity * service.unitPrice;
}

/**
 * The §9.2 ladder, and the whole of it.
 *
 * Note `>=` on the last rung, not `==`. An overpayment — a transposed digit, or
 * an agency settling two bookings with one transfer — reads as *paid*, because
 * it plainly is. The refund conversation belongs to the overpayment warning in
 * §9.3, not to a status that would otherwise sit at `partially_paid` while the
 * client has handed over more than the full amount.
 */
export function derivePaymentStatus(
  amountPaid: number,
  totalValue: number,
): PaymentStatus {
  if (amountPaid <= 0) return 'unpaid';
  if (amountPaid >= totalValue) return 'paid';
  return 'partially_paid';
}

export type BookingTotals = {
  totalNights: number;
  totalRooms: number;
  totalGuests: number;
  roomsSubtotal: number;
  servicesSubtotal: number;
  totalValue: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  /** `totalValue − amountPaid`. Negative when the booking is overpaid. */
  balanceDue: number;
};

/**
 * The whole derivation, given the parts.
 *
 * Kept separate from the database call below so that the booking form can show
 * a running total (§13.3) from the same expressions the server will use — the
 * client figure is display only and is recomputed on submit (§9.6), but it
 * should at least be *the same arithmetic*, not a second implementation that
 * happens to agree most of the time.
 */
export function computeBookingTotals(input: {
  checkInDate: number | null;
  checkOutDate: number | null;
  rooms: readonly RoomLineInput[];
  services: readonly ServiceLineInput[];
  discountAmount: number;
  vatAmount: number;
  amountPaid: number;
}): BookingTotals {
  const totalNights = nightsBetween(input.checkInDate, input.checkOutDate);

  const roomsSubtotal = input.rooms.reduce(
    (sum, room) => sum + roomSubtotal(room, totalNights),
    0,
  );
  const servicesSubtotal = input.services.reduce(
    (sum, service) => sum + serviceTotal(service),
    0,
  );

  // §9.9: `vatAmount` is always 0 and nothing writes to it. It stays in the
  // expression because the expression is the spec's, and a term that is
  // structurally zero costs nothing to carry — whereas leaving it out and
  // adding it back on the day of VAT registration means finding every place
  // that computed a total.
  const totalValue =
    roomsSubtotal + servicesSubtotal - input.discountAmount + input.vatAmount;

  return {
    totalNights,
    totalRooms: input.rooms.reduce((sum, room) => sum + room.numberOfRooms, 0),
    totalGuests: input.rooms.reduce((sum, room) => sum + room.numberOfGuests, 0),
    roomsSubtotal,
    servicesSubtotal,
    totalValue,
    amountPaid: input.amountPaid,
    paymentStatus: derivePaymentStatus(input.amountPaid, totalValue),
    balanceDue: totalValue - input.amountPaid,
  };
}

