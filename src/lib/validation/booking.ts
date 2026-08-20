import { z } from 'zod';

import { BOOKING_SOURCES, HOTEL_CATEGORIES, HOTEL_CITIES } from '@/db/schema';

import {
  dateString,
  optionalId as sharedOptionalId,
  optionalText as sharedOptionalText,
  requiredDateString,
  riyals as sharedRiyals,
} from './fields';

/**
 * The booking schemas — shared client and server, **server authoritative**
 * (Appendix B, §15).
 *
 * ## Two schemas over one field set
 *
 * A draft and a confirmed booking are the same shape held to different
 * standards, so there are two parses rather than one schema with a dozen
 * conditionals.
 *
 * - **`bookingDraftSchema`** accepts almost anything. A draft is by definition
 *   half-finished (§9.10): it is autosaved on every step change, which means it
 *   is saved *before* the person has reached the fields the booking will
 *   eventually need. A draft save that could fail validation would be a draft
 *   save that silently does not happen, which is precisely the twenty minutes
 *   of lost entry §20.4 exists to prevent.
 * - **`bookingConfirmSchema`** is the real gate, applied at the moment a number
 *   is allocated (§9.1) and on every subsequent edit. Confirming is where the
 *   booking becomes a document someone else relies on.
 *
 * The second is built from the first with `.extend`, so a field cannot be added
 * to one and forgotten in the other.
 *
 * ## Dates cross as strings
 *
 * `YYYY-MM-DD`, because that is what a native `<input type="date">` speaks
 * (§20.3) and the only thing it speaks. Conversion to the stored Unix seconds
 * happens once, server-side, through `lib/time.ts` — never here, so that the
 * schema stays importable by the client form without dragging the clock into
 * two places.
 *
 * ## Money is integer, at the boundary
 *
 * Every price and total is `z.coerce.number().int()`: a price of `12.5` is
 * *rejected* rather than rounded somewhere later (§8 — whole Saudi Riyals, and
 * the stored value equals the displayed value). The same rule the Phase 9
 * service-type default price follows.
 */

/**
 * The shapes come from `fields.ts`; what is local is the `.default(null)`.
 *
 * A booking form field that was never reached is *absent* from the autosaved
 * payload, not empty — step 6 has not been rendered yet when step 2 saves — so
 * every optional field needs a default for the lenient draft parse to succeed.
 * That is a property of this form, not of optional text everywhere, which is
 * why it is applied here rather than baked into the shared shape.
 */
const optionalText = (max: number) => sharedOptionalText(max).default(null);
const optionalId = sharedOptionalId.default(null);
const riyals = sharedRiyals();

const count = (max: number) =>
  z.coerce.number().int('Enter a whole number.').min(1, 'At least 1.').max(max);

/* --------------------------------------------------------------------------
   Line items (§13.3 steps 5 and 6)
   -------------------------------------------------------------------------- */

/**
 * A room line.
 *
 * `roomTypeName` is required even though `roomTypeId` may be null, because the
 * name is the snapshot the booking keeps (§9.5) and a line typed in by hand —
 * an unusual configuration a hotel offers once — has no lookup row behind it.
 * `nights` is absent by design: it is derived from the booking's two dates and
 * is never entered (§9.6).
 */
export const roomLineSchema = z.object({
  roomTypeId: optionalId,
  roomTypeName: z.string().trim().min(1, 'Choose a room type.').max(80),
  mealPlanId: optionalId,
  mealPlanCode: optionalText(8),
  numberOfRooms: count(999),
  numberOfGuests: count(9999),
  pricePerNight: riyals,
});

export const serviceLineSchema = z.object({
  serviceTypeId: optionalId,
  serviceName: z.string().trim().min(1, 'Name the service.').max(120),
  quantity: count(9999),
  unitPrice: riyals,
});

export type RoomLineValues = z.input<typeof roomLineSchema>;
export type ServiceLineValues = z.input<typeof serviceLineSchema>;

/* --------------------------------------------------------------------------
   The booking
   -------------------------------------------------------------------------- */

export const bookingDraftSchema = z.object({
  /* Step 1 — agency. The name is the one thing a draft must carry, because the
     column is NOT NULL and because a draft with no agency is not identifiable
     in the Drafts list a person is later asked to review (§13.6). */
  agencyId: optionalId,
  agencyName: z.string().trim().min(1, 'Choose or name the agency.').max(120),
  contactPerson: optionalText(80),
  agencyMobile: optionalText(40),
  agencyWhatsapp: optionalText(40),
  agencyEmail: optionalText(160),
  agencyCountry: optionalText(80),
  agencyAddress: optionalText(300),

  /* Step 2 — guest. */
  guestName: optionalText(120),
  guestMobile: optionalText(40),
  guestEmail: optionalText(160),
  guestCountry: optionalText(80),

  /* Step 3 — hotel. */
  hotelId: optionalId,
  hotelName: optionalText(120),
  hotelCity: z.union([z.literal(''), z.enum(HOTEL_CITIES)]).default(''),
  hotelCategory: z
    .union([z.literal(''), z.enum(HOTEL_CATEGORIES)])
    .default(''),
  confirmationNumber: optionalText(60),
  brnVrn: optionalText(60),
  bookingSource: z.union([z.literal(''), z.enum(BOOKING_SOURCES)]).default(''),

  /* Step 4 — stay. */
  checkInDate: dateString,
  checkOutDate: dateString,

  /* Steps 5 and 6 — the repeaters. Unlimited, per §13.3, and capped only where
     a number that large is a runaway loop rather than a booking. */
  rooms: z.array(roomLineSchema).max(60).default([]),
  services: z.array(serviceLineSchema).max(60).default([]),

  /* Step 7 — review. */
  discountAmount: riyals.default(0),
  dueDate: dateString,
  notes: optionalText(2000),
});

export type BookingValues = z.input<typeof bookingDraftSchema>;
export type BookingParsed = z.output<typeof bookingDraftSchema>;

/**
 * What confirming additionally requires (§9.1, §13.3).
 *
 * A hotel and a stay, because the scheduler reads `checkInDate` and
 * `checkOutDate` directly (§13.5) and a confirmed booking that appears on no
 * calendar is a booking nobody arrives for. At least one room, because a
 * booking with no rooms has a total of zero and would report as fully paid the
 * moment it was created — `derivePaymentStatus` is right to say so, and the
 * place to stop it is here.
 */
export const bookingConfirmSchema = bookingDraftSchema
  .extend({
    hotelName: z.string().trim().min(1, 'Enter the hotel.').max(120),
    checkInDate: requiredDateString('Enter the check-in date.'),
    checkOutDate: requiredDateString('Enter the check-out date.'),
    rooms: z.array(roomLineSchema).min(1, 'Add at least one room.').max(60),
  })
  .refine((values) => values.checkOutDate > values.checkInDate, {
    // String comparison is safe and exact on `YYYY-MM-DD`, which is why the
    // format is fixed rather than merely conventional.
    message: 'Check-out must be after check-in.',
    path: ['checkOutDate'],
  })
  .refine(
    (values) =>
      values.discountAmount <=
      values.rooms.reduce(
        (sum, room) => sum + room.numberOfRooms * room.pricePerNight,
        0,
      ) +
        values.services.reduce(
          (sum, service) => sum + service.quantity * service.unitPrice,
          0,
        ),
    {
      // Per-night prices are not multiplied out here — this is a sanity bound,
      // not the total. `recalculateBooking` computes the real figure. The point
      // is only that a discount cannot exceed everything on the booking, which
      // would give a negative total value and a booking that reads as overpaid
      // the moment it is created.
      message: 'The discount is larger than the booking.',
      path: ['discountAmount'],
    },
  );

/* --------------------------------------------------------------------------
   Cancellation (§9.8)
   -------------------------------------------------------------------------- */

/**
 * A reason is required, and it is required because the booking is not deleted:
 * the row stays visible in the list with a badge for as long as the business
 * exists, and "cancelled" with no reason beside it is a question nobody can
 * answer six months later.
 */
export const cancelBookingSchema = z.object({
  cancelReason: z
    .string()
    .trim()
    .min(4, 'Give a reason — it stays on the booking.')
    .max(500),
});

export type CancelBookingValues = z.input<typeof cancelBookingSchema>;
