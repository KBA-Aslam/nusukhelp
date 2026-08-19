-- Normalise every stored timestamp to Unix seconds (SPEC §8, *Timestamps*;
-- §19 open item 21).
--
-- A **data** migration, not a schema one. No column changes type or name — the
-- columns were always `integer` and always meant seconds. Phase 6 wrote
-- milliseconds into two of them (`insertReview` and `insertEnquiry` used a bare
-- `Date.now()`), and the defect stayed invisible because the two places that
-- read those columns treated them as milliseconds too. Phase 8 is what made it
-- matter: `admin_invites`, `login_attempts` and Better Auth's four tables all
-- store genuine seconds, so the database was left holding two different units
-- in columns of the same name and type.
--
-- Because nothing about the schema changes, `drizzle-kit generate` would emit
-- nothing here; this file is written by hand and registered in
-- `meta/_journal.json` so the generator keeps numbering from 0003.
--
-- ## The guard, and why 100000000000
--
-- Every statement is conditional on the value already looking like
-- milliseconds, which makes the migration idempotent: running it twice, or
-- against a database that was already correct, changes nothing. 1e11 seconds is
-- the year 5138 and 1e11 milliseconds is March 1973, so the threshold separates
-- the two units with about three thousand years of margin. The same constant is
-- `MILLISECOND_THRESHOLD` in `src/lib/time.ts` and is what
-- `scripts/check-timestamps.mjs` asserts against.
--
-- Integer division truncates in SQLite, which is the correct rounding: it
-- floors to the second the event actually happened in.
--
-- ## Every timestamp column, not only the two known bad ones
--
-- `reviews.reviewed_at`, `enquiries.handled_at` and `company_settings.updated_at`
-- have no writer yet — moderation lands in Phase 15 and the settings screen in
-- Phase 9 — so they hold no rows to convert today. They are listed anyway: the
-- guard makes each one free, and a migration that fixed only what was known to
-- be broken would leave the next reader guessing whether the rest had been
-- checked. The auth tables are deliberately absent, because Drizzle's
-- `{ mode: 'timestamp' }` already stores seconds (`Math.floor(unix / 1000)`)
-- and `login_attempts.window_start` and `admin_invites.*` were written in
-- seconds from the start.

UPDATE reviews SET created_at = created_at / 1000 WHERE created_at > 100000000000;
--> statement-breakpoint
UPDATE reviews SET reviewed_at = reviewed_at / 1000 WHERE reviewed_at > 100000000000;
--> statement-breakpoint
UPDATE enquiries SET created_at = created_at / 1000 WHERE created_at > 100000000000;
--> statement-breakpoint
UPDATE enquiries SET handled_at = handled_at / 1000 WHERE handled_at > 100000000000;
--> statement-breakpoint
UPDATE company_settings SET updated_at = updated_at / 1000 WHERE updated_at > 100000000000;
