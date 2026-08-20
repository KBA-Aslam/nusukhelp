import { z } from 'zod';

import { HOTEL_CATEGORIES, HOTEL_CITIES } from '@/db/schema';

import { optionalText } from './fields';

/**
 * The Phase 9 admin schemas — shared client and server, **server authoritative**
 * (Appendix B, §15).
 *
 * Almost every field on these forms is optional free text. `optionalText` and
 * the rest of the field shapes live in `fields.ts`, shared with the booking and
 * payment schemas — see the note there on why empty collapses to `null`.
 */

/* --------------------------------------------------------------------------
   Lookup lists (§8)
   -------------------------------------------------------------------------- */

/**
 * `sortOrder` is coerced, because a `<input type="number">` submits a string.
 * It is also bounded: the field exists to arrange a dropdown, and a sort key of
 * 10^9 is someone typing in the wrong box.
 */
export const lookupSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  // Meal plans only. Short by nature — RO, BB, HB, FB, AI.
  code: z.string().trim().max(8).optional().or(z.literal('')),
  /**
   * Service types only. **Whole Saudi Riyals** (§8 — no decimals, no minor
   * units), which is why this is `int()` and not a float: a price of `12.5`
   * is rejected at the boundary rather than silently truncated somewhere later.
   */
  defaultPrice: z
    .union([z.literal(''), z.coerce.number().int().min(0).max(10_000_000)])
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type LookupValues = z.input<typeof lookupSchema>;

export const hotelSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter the hotel name.').max(120),
    city: z.enum(HOTEL_CITIES),
    cityOther: z.string().trim().max(80).optional().or(z.literal('')),
    // A hotel may genuinely have no category — an unrated guest house — so
    // the empty option is a real choice rather than a missing answer.
    category: z.union([z.literal(''), z.enum(HOTEL_CATEGORIES)]).optional(),
  })
  .refine(
    (values) => values.city !== 'other' || Boolean(values.cityOther?.trim()),
    { message: 'Name the city.', path: ['cityOther'] },
  );

export type HotelValues = z.input<typeof hotelSchema>;

/* --------------------------------------------------------------------------
   Agencies (§8, §13.8)
   -------------------------------------------------------------------------- */

/**
 * Only the name is required.
 *
 * An agency is often created mid-call with nothing but a name to hand, and a
 * form that refuses to save until every field is filled is a form staff work
 * around by typing rubbish into it. The profile is editable afterwards.
 *
 * The email is validated *if present* rather than merely length-checked,
 * because it is the one field here that something later sends mail to.
 */
export const agencySchema = z.object({
  agencyName: z.string().trim().min(2, 'Enter the agency name.').max(120),
  contactPerson: optionalText(80),
  mobile: optionalText(40),
  whatsapp: optionalText(40),
  email: z
    .union([z.literal(''), z.email('Enter a valid email address.').max(160)])
    .transform((value) => (value ? value : null))
    .nullable(),
  country: optionalText(80),
  address: optionalText(300),
  notes: optionalText(2000),
});

export type AgencyValues = z.input<typeof agencySchema>;

/* --------------------------------------------------------------------------
   Company settings (§4, §10)
   -------------------------------------------------------------------------- */

/**
 * `numberPrefix` is constrained rather than free.
 *
 * It is the `AHR` in `AHR-2026-00041` (§9.1), so it goes into a booking number
 * that is quoted in emails, printed on invoices and searched on. Uppercase
 * letters only, two to six of them: a prefix containing a space or a hyphen
 * would make the number ambiguous to parse and ugly to read.
 *
 * Changing it does **not** renumber existing bookings — those numbers are
 * stored, not derived — which is stated on the form rather than left to be
 * discovered.
 */
export const companySchema = z.object({
  legalName: z.string().trim().min(2, 'Enter the legal name.').max(160),
  tradingName: optionalText(160),
  crNumber: optionalText(40),
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(80),
  country: optionalText(80),
  phonePrimary: optionalText(40),
  phoneSecondary: optionalText(40),
  whatsapp: optionalText(40),
  email: z
    .union([z.literal(''), z.email('Enter a valid email address.').max(160)])
    .transform((value) => (value ? value : null))
    .nullable(),
  website: optionalText(160),
  bankName: optionalText(120),
  bankAccountName: optionalText(120),
  bankIban: optionalText(60),
  numberPrefix: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,6}$/, 'Two to six capital letters, nothing else.'),
  defaultTerms: optionalText(5000),
  preparedByLabel: optionalText(80),
  approvedByName: optionalText(80),
});

export type CompanyValues = z.input<typeof companySchema>;
