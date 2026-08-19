import { eq, sql } from 'drizzle-orm';

import { getDb } from '../index';
import { loginAttempts } from '../schema';

/**
 * The login rate limit (§12 — five attempts per fifteen minutes per IP hash).
 *
 * ## What counts as an attempt
 *
 * A **failed** sign-in. Successes clear the counter, so someone who mistypes a
 * password three times and then gets it right starts from zero again rather
 * than carrying three-fifths of a lockout around for a quarter of an hour.
 *
 * ## The window is fixed, not sliding
 *
 * `windowStart` is stamped by the first failure and the row resets when fifteen
 * minutes have passed since then. A sliding window is more precise and needs a
 * row per attempt; a fixed one needs a row per address and, at its very worst,
 * lets ten attempts through across a window boundary. Ten attempts per half
 * hour is still an unusable rate for guessing a twelve-character passphrase,
 * and this is the difference between a table that stays at a few dozen rows
 * forever and one that grows without a cleanup job to trim it.
 */

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

export type LoginLimit = {
  blocked: boolean;
  /** Seconds until the window resets. Zero unless blocked. */
  retryAfter: number;
};

/**
 * Is this address currently locked out?
 *
 * Read-only — call it before attempting the sign-in. `recordFailedLogin`
 * increments; this only looks.
 */
export async function checkLoginLimit(
  ipHash: string,
  nowSeconds: number,
): Promise<LoginLimit> {
  const db = getDb();

  const [row] = await db
    .select({
      count: loginAttempts.count,
      windowStart: loginAttempts.windowStart,
    })
    .from(loginAttempts)
    .where(eq(loginAttempts.ipHash, ipHash))
    .limit(1);

  if (!row) return { blocked: false, retryAfter: 0 };

  const elapsed = nowSeconds - row.windowStart;
  if (elapsed >= LOGIN_WINDOW_SECONDS) return { blocked: false, retryAfter: 0 };
  if (row.count < LOGIN_MAX_ATTEMPTS) return { blocked: false, retryAfter: 0 };

  return { blocked: true, retryAfter: LOGIN_WINDOW_SECONDS - elapsed };
}

/**
 * Counts one failure against the address.
 *
 * A single upsert rather than a read followed by a write: two failures arriving
 * together would both read the same count and both write it plus one, and the
 * limit would be worth twice what it says. The `CASE` in the update is what
 * makes an elapsed window reset in place — the row is reused, never deleted, so
 * the table holds one row per address that has ever reached the login screen.
 */
export async function recordFailedLogin(
  ipHash: string,
  nowSeconds: number,
): Promise<void> {
  const db = getDb();

  await db
    .insert(loginAttempts)
    .values({ ipHash, count: 1, windowStart: nowSeconds })
    .onConflictDoUpdate({
      target: loginAttempts.ipHash,
      set: {
        count: sql`CASE
          WHEN ${nowSeconds} - ${loginAttempts.windowStart} >= ${LOGIN_WINDOW_SECONDS}
          THEN 1
          ELSE ${loginAttempts.count} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${nowSeconds} - ${loginAttempts.windowStart} >= ${LOGIN_WINDOW_SECONDS}
          THEN ${nowSeconds}
          ELSE ${loginAttempts.windowStart}
        END`,
      },
    });
}

/** Clears the counter after a successful sign-in. */
export async function clearLoginAttempts(ipHash: string): Promise<void> {
  const db = getDb();

  await db
    .update(loginAttempts)
    .set({ count: 0, windowStart: 0 })
    .where(eq(loginAttempts.ipHash, ipHash));
}
