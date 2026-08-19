/**
 * The project's clock (§8, *Timestamps*).
 *
 * **Every `integer` timestamp column in this database stores Unix seconds,
 * UTC.** Not milliseconds. The rule is one line in the spec and it was still
 * broken in Phase 6: `insertReview` and `insertEnquiry` wrote a bare
 * `Date.now()`, which is milliseconds, and because the two call sites that read
 * those columns *also* treated them as milliseconds, nothing looked wrong —
 * dates rendered correctly and the rate limit worked. It only became visible in
 * Phase 8, when `admin_invites`, `login_attempts` and Better Auth's four tables
 * arrived storing genuine seconds and the database ended up holding two
 * different units in columns of the same name and the same type. Migration
 * `0002` converted the stored values; this module is what stops it recurring.
 *
 * So there is one function, and inline arithmetic on `Date.now()` does not
 * appear anywhere else. A unit conversion that is written out at fourteen call
 * sites is a unit conversion that will be wrong at one of them.
 *
 * `scripts/check-timestamps.mjs` is the backstop: it walks every table in the
 * live database and fails if any timestamp column holds a value large enough to
 * be milliseconds. Run it after any phase that adds a table.
 *
 * ## What this is not for
 *
 * Drizzle columns declared `{ mode: 'timestamp' }` — the six on the Better Auth
 * tables — take a `Date` and convert it themselves, storing the same Unix
 * seconds. Pass those a `new Date()`, not this. The distinction is a
 * TypeScript-level one; the column and the stored value are identical.
 */

/** The current time as Unix seconds, UTC. The only way to stamp a row. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * A stored timestamp as a `Date`, for `formatDate` and friends.
 *
 * The inverse of `nowSeconds`, and it exists for the same reason: `new
 * Date(row.createdAt)` is silently wrong for a seconds column — it reads
 * 1,787,100,799 as 21 January 1970 — and it is wrong in a way that renders
 * without complaint. Naming the conversion makes the missing `* 1000` a
 * missing function call instead of a plausible-looking line.
 */
export function fromSeconds(seconds: number): Date {
  return new Date(seconds * 1000);
}

/**
 * The boundary between the two units, used by the guard in
 * `scripts/check-timestamps.mjs` and by migration `0002`.
 *
 * 1e11 seconds is the year 5138; 1e11 milliseconds is March 1973. Every real
 * timestamp this system will ever hold is below it in seconds and above it in
 * milliseconds, so a single comparison separates them with about three thousand
 * years of margin on the side that matters.
 */
export const MILLISECOND_THRESHOLD = 100_000_000_000;

/* --------------------------------------------------------------------------
   Calendar dates (Phase 10)

   Check-in, check-out, booking date and due date are **days**, not instants.
   They still live in `integer` columns of Unix seconds like everything else
   (§8), fixed at UTC midnight of the day in question, and they still go through
   this module rather than being parsed at each call site — for exactly the
   reason the rest of this file exists.

   The pairing matters more than either function. A native `<input type="date">`
   speaks `YYYY-MM-DD` and nothing else; the database speaks seconds. Two
   conversions written inline, in a form that has four date fields and a list
   that filters on three of them, is a `* 1000` waiting to happen.
   -------------------------------------------------------------------------- */

/** Seconds in a day. Named because `86_400` in an expression reads as noise. */
export const SECONDS_PER_DAY = 86_400;

/**
 * `2026-08-19` → the Unix seconds of that day at UTC midnight.
 *
 * Returns `null` for empty or malformed input, because that is what an
 * untouched date input submits and a booking may legitimately have no due date.
 *
 * `Date.UTC` rather than `new Date('2026-08-19')`: the string form is
 * *specified* as UTC for the date-only shape, but the same code with a
 * `YYYY-MM-DDTHH:mm` value is local, and relying on which overload you happen
 * to be in is how a booking ends up a day early for whoever runs the Worker.
 * Fixing the day at UTC midnight also keeps `formatDate` honest: 00:00 UTC is
 * 03:00 in Riyadh, the same calendar day, which is the whole point of §6
 * pinning the zone.
 */
export function dateStringToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const seconds = Date.UTC(Number(year), Number(month) - 1, Number(day)) / 1000;

  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * The inverse: stored seconds → `YYYY-MM-DD`, for the `value` of a date input.
 *
 * `toISOString().slice(0, 10)` is correct here *because* the stored value is
 * UTC midnight — the same expression on an arbitrary instant would drift a day
 * for anyone east of Greenwich, which is everyone this system serves.
 */
export function secondsToDateString(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '';
  return fromSeconds(seconds).toISOString().slice(0, 10);
}

/**
 * Nights between two stored dates (§9.6 — *nights are never entered manually*).
 *
 * Both arguments are UTC midnights, so the difference is a whole number of days
 * with no rounding and no daylight-saving hazard (Saudi Arabia observes none in
 * any case; the arithmetic is in UTC regardless). A check-out on or before the
 * check-in gives 0 rather than a negative, so a half-filled draft cannot
 * produce a negative subtotal on its way to being corrected.
 */
export function nightsBetween(
  checkIn: number | null | undefined,
  checkOut: number | null | undefined,
): number {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((checkOut - checkIn) / SECONDS_PER_DAY));
}

/**
 * Today, as UTC midnight of the current **Riyadh** day.
 *
 * The distinction is not pedantry: at 01:00 Riyadh time it is still yesterday
 * in UTC, so a plain UTC truncation would tell the completion page (§9.7) that
 * a check-out due today has not happened yet, for three hours every night.
 * `en-CA` because it formats as `YYYY-MM-DD`, which is the shape the parser
 * above already speaks.
 */
export function todayInRiyadh(): number {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return dateStringToSeconds(formatted) ?? 0;
}
