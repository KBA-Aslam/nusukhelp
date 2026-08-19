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
