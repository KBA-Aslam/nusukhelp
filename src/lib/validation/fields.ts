import { z } from 'zod';

/**
 * The field shapes the admin schemas are built from.
 *
 * Phase 9 and Phase 10 each wrote their own `optionalText`, with the same body
 * and one silent difference — Phase 10's carried `.default(null)` and Phase 9's
 * did not. Phase 11 would have been the third copy, so the shapes live here
 * instead and each schema composes them.
 *
 * The point is not brevity. Two copies of "empty string means null" stay in
 * step until the day one of them starts trimming and the other does not, and
 * the way that surfaces is a stored `' '` that every `value || '—'` in the
 * panel renders as a blank rather than as an em dash.
 *
 * ## Why empty collapses to `null`
 *
 * An HTML form sends an untouched input as `''`, never as absent. Storing `''`
 * where the column means *unknown* gives two representations of nothing, and
 * then `contactPerson || '—'` renders correctly while `contactPerson === null`
 * quietly stops being true. So it collapses once, at the boundary.
 */

/** Free text that may be left blank. Empty → `null`. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();

/** A lookup id from a `<select>` whose first option is "not chosen". */
export const optionalId = optionalText(60);

/**
 * Whole Saudi Riyals (§8) — integer, bounded, never a float.
 *
 * `12.5` is **rejected** rather than rounded somewhere later: §8 requires the
 * stored value to equal the displayed value, and the only way to keep that true
 * is to refuse the input that cannot be stored.
 *
 * `minimum` is a parameter because zero means different things in different
 * places. A discount of zero is the normal case; a *payment* of zero is not a
 * payment, and the message has to say so in the words of the form it appears
 * on.
 */
export function riyals(minimum = 0, minMessage = 'Cannot be negative.') {
  return z.coerce
    .number()
    .int('Amounts are in whole Riyals — no decimals.')
    .min(minimum, minMessage)
    .max(10_000_000, 'That looks like a mistake.');
}

/**
 * `YYYY-MM-DD` or empty — what a native `<input type="date">` speaks (§20.3),
 * and the only thing it speaks.
 *
 * Conversion to the stored Unix seconds happens server-side through
 * `lib/time.ts`, never here, so these schemas stay importable by client forms
 * without dragging the clock into two places.
 */
export const dateString = z
  .string()
  .trim()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date.')
  .default('');

/** The same shape where the date is required, with its own message. */
export const requiredDateString = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message);
