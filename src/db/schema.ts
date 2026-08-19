/**
 * Drizzle schema for the D1 database.
 *
 * Tables land here phase by phase. Two standing rules from the spec:
 *
 * - Money is `integer`, whole Saudi Riyals. Never `real`, never minor units.
 * - There is no `invoices` table. A booking is the only record; the invoice PDF
 *   is a view of its current state.
 *
 * Phase 2 added the public-side tables only: reviews, enquiries, and the single
 * company_settings row. Phase 8 adds auth; lookups and agencies land in
 * Phase 9, bookings and everything downstream of them in Phase 10.
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { ROLES } from '@/lib/roles';

/* ---------- Auth (Better Auth) ----------

   Four of these six tables are Better Auth's own, and their column sets are
   dictated by the library rather than by us: the Drizzle adapter builds every
   INSERT from Better Auth's internal model and runs `checkMissingFields` first,
   which throws `The field "x" does not exist in the "y" Drizzle schema` the
   moment a column it wants is absent. So the shape below is Better Auth 1.7's
   shape, and §8's listing — written before the version was pinned — is a
   subset of it. The additions are recorded as a Phase 8 ruling in §12; the ones
   that matter are `account.issuer`, `account`'s five OAuth token columns, and
   `verification.updatedAt`.

   **The timestamps are `{ mode: 'timestamp' }`, and that is not a change of
   storage format.** Drizzle's `timestamp` mode is an `integer` column holding
   Unix *seconds* — exactly §8's convention — with a `Date` on the TypeScript
   side. Better Auth hands the adapter `Date` objects, so a plain
   `integer('created_at')` would try to bind a `Date` to a number column and
   fail at runtime. The column in the migration is identical either way.
   ------------------------------------------------------------------------ */

/**
 * The role list comes from `lib/roles.ts` rather than being declared here, so
 * that a client component rendering a role badge does not have to import the
 * Drizzle schema — and, in the other direction, so there is only one list to
 * change. Re-exported because most callers reach for the role type alongside a
 * table and it would be odd to import them from two places.
 */
export { ROLES, type Role } from '@/lib/roles';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  // §12. `executive` is the default because it is the role most invitees get,
  // and because `admin` as a default would hand out payment reversal, booking
  // cancellation and user management to anyone invited without a role chosen.
  role: text('role', { enum: ROLES }).notNull().default('executive'),
  // Deactivation, not deletion (§12 — *deactivate accounts*). An inactive user
  // keeps their name on every booking and payment they touched; the guard in
  // `lib/auth-guard.ts` refuses the session instead.
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('idx_session_user').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Better Auth 1.7 namespaces credentials by issuer — `local:credential`
    // for a password account — and enforces uniqueness on (issuer, accountId).
    issuer: text('issuer').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    // scrypt, via Better Auth (§15). Never read outside the library.
    password: text('password'),
    // Unused today: the project has no social sign-in and §12 does not plan
    // one. They exist because the adapter writes the whole account model, and
    // a column it wants and cannot find is a hard failure, not a NULL.
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp',
    }),
    scope: text('scope'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    index('idx_account_user').on(t.userId),
    uniqueIndex('idx_account_issuer_account').on(t.issuer, t.accountId),
  ],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('idx_verification_identifier').on(t.identifier)],
);

/**
 * Staff invitations (§12).
 *
 * **Only the SHA-256 hash of the token is stored.** The plaintext exists for a
 * few seconds, in the link the invite email carries, and nowhere afterwards —
 * not in this table, not in a log, not in the action's return value. Anyone who
 * reads the database, including from a backup restored onto a laptop, gets
 * digests they cannot turn back into a working link.
 *
 * Rows are never deleted. An accepted invite keeps its `acceptedAt`, a revoked
 * one its `revokedAt`, an expired one simply stops validating — and the list on
 * `/admin/settings/users` is the record of who invited whom.
 */
export const adminInvites = sqliteTable(
  'admin_invites',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role', { enum: ROLES }).notNull().default('executive'),
    tokenHash: text('token_hash').notNull().unique(), // SHA-256, never plaintext
    invitedBy: text('invited_by')
      .notNull()
      .references(() => user.id),
    expiresAt: integer('expires_at').notNull(), // 7 days
    acceptedAt: integer('accepted_at'),
    revokedAt: integer('revoked_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('idx_invites_email').on(t.email)],
);

/**
 * The login rate limiter (§12 — five attempts per fifteen minutes per IP hash).
 *
 * One row per address, keyed by the **salted hash** rather than the address
 * itself, for the same reason `reviews.ipHash` is (§15): an unsalted digest of
 * an IPv4 address is reversible by brute force in seconds, so storing one would
 * put personal data in the table in a form that only looks protected.
 *
 * The row is reused rather than deleted — an elapsed window is reset in place by
 * the next attempt from that address. That holds the table at one row per
 * distinct address that has ever reached the login screen, which is a few dozen
 * rows in practice, and it means no cleanup job has to exist.
 *
 * Better Auth's own rate limiter is switched off in `lib/auth.ts` in favour of
 * this one. Its default storage is process memory, which in a Worker is
 * per-isolate and therefore not a limit at all, and its database storage keys on
 * the raw address.
 */
export const loginAttempts = sqliteTable('login_attempts', {
  ipHash: text('ip_hash').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: integer('window_start').notNull(),
});

/* ---------- Public content ---------- */

export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(), // stored, NEVER displayed publicly
    rating: integer('rating').notNull(), // 1–5
    comment: text('comment').notNull(),
    serviceUsed: text('service_used'),
    country: text('country'),
    status: text('status', {
      enum: ['pending', 'published', 'hidden', 'spam'],
    })
      .notNull()
      .default('pending'),
    ipHash: text('ip_hash'),
    locale: text('locale').notNull().default('en'),
    createdAt: integer('created_at').notNull(),
    reviewedAt: integer('reviewed_at'),
    // Deferred out of Phase 2 and **added here, in Phase 8** (§8, *Deferred
    // constraints*). The `user` table did not exist until now, and D1 enforces
    // foreign keys: a child row whose parent table is missing fails to insert
    // even when the key is NULL ("no such table: main.user"), which would have
    // broken public review submission in Phase 6. SQLite cannot add a foreign
    // key to an existing column, so migration 0001 rebuilds the table.
    reviewedBy: text('reviewed_by').references(() => user.id),
  },
  (t) => [
    index('idx_reviews_status').on(t.status),
    index('idx_reviews_created').on(t.createdAt),
  ],
);

export const enquiries = sqliteTable(
  'enquiries',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    company: text('company'),
    audience: text('audience', { enum: ['pilgrim', 'agency'] })
      .notNull()
      .default('pilgrim'),
    serviceInterest: text('service_interest'),
    message: text('message').notNull(),
    locale: text('locale').notNull().default('en'),
    status: text('status', { enum: ['new', 'contacted', 'closed'] })
      .notNull()
      .default('new'),
    ipHash: text('ip_hash'),
    createdAt: integer('created_at').notNull(),
    // Same Phase 8 deferral as reviews.reviewedBy above, resolved the same way.
    handledBy: text('handled_by').references(() => user.id),
    handledAt: integer('handled_at'),
  },
  (t) => [index('idx_enquiries_status').on(t.status)],
);

/* ---------- Company settings ---------- */

export const companySettings = sqliteTable('company_settings', {
  id: integer('id').primaryKey().default(1), // single row
  legalName: text('legal_name').notNull(),
  tradingName: text('trading_name'),
  crNumber: text('cr_number'),
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: text('city').default('Madinah Al Munawarah'),
  country: text('country').default('Saudi Arabia'),
  phonePrimary: text('phone_primary'),
  phoneSecondary: text('phone_secondary'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  website: text('website'),
  bankName: text('bank_name'),
  bankAccountName: text('bank_account_name'),
  bankIban: text('bank_iban'),
  numberPrefix: text('number_prefix').notNull().default('AHR'),
  defaultTerms: text('default_terms'),
  preparedByLabel: text('prepared_by_label'),
  approvedByName: text('approved_by_name'),
  logoUrl: text('logo_url'),
  updatedAt: integer('updated_at').notNull(),
});
