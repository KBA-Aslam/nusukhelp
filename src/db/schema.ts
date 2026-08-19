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

/* ---------- Agencies (repeat B2B clients) ----------

   The one table in Phase 9 that holds data staff typed rather than data the
   seed supplied, which is why it archives rather than deletes: an agency is
   named on every booking it ever placed, and §13.8's profile is a history.
   `isArchived` takes it out of the pickers without taking it out of the past.
   ------------------------------------------------------------------------ */

export const agencies = sqliteTable(
  'agencies',
  {
    id: text('id').primaryKey(),
    agencyName: text('agency_name').notNull(),
    contactPerson: text('contact_person'),
    mobile: text('mobile'),
    whatsapp: text('whatsapp'),
    email: text('email'),
    country: text('country'),
    address: text('address'),
    notes: text('notes'),
    isArchived: integer('is_archived', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('idx_agencies_name').on(t.agencyName),
    index('idx_agencies_contact').on(t.contactPerson),
  ],
);

/* ---------- Lookup tables ----------

   §8: *lookup tables, not enums*, because the admin has to be able to add an
   option at runtime. Every one of them carries `isActive` rather than a delete:
   from Phase 10 a booking snapshots the name it used, so deactivating a room
   type stops it being offered on new bookings without disturbing the old ones.
   `sortOrder` exists because these are pickers, and alphabetical order is wrong
   for every one of them — "Double, Quad, Quint, Single, Triple" is not how
   anyone reads a room list.
   ------------------------------------------------------------------------ */

export const roomTypes = sqliteTable('room_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const mealPlans = sqliteTable('meal_plans', {
  id: text('id').primaryKey(),
  code: text('code').notNull(), // RO, BB, HB, FB, AI
  name: text('name').notNull(), // Room Only, Bed & Breakfast, ...
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const serviceTypes = sqliteTable('service_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // Whole Saudi Riyals, like every money column (§8). A default only — the
  // booking form may override it, and the booking stores what was charged.
  defaultPrice: integer('default_price'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const HOTEL_CITIES = ['makkah', 'madinah', 'jeddah', 'other'] as const;
export const HOTEL_CATEGORIES = [
  'economy',
  '1_star',
  '2_star',
  '3_star',
  '4_star',
  '5_star',
] as const;

export const hotels = sqliteTable(
  'hotels',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    city: text('city', { enum: HOTEL_CITIES }).notNull(),
    // Only meaningful when `city` is `other`; §8 keeps the common three as an
    // enum because they are what the scheduler and the reports group by.
    cityOther: text('city_other'),
    category: text('category', { enum: HOTEL_CATEGORIES }),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('idx_hotels_name').on(t.name)],
);

export const paymentMethods = sqliteTable('payment_methods', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

/* ---------- Bookings (the core entity) ----------

   **The booking is the only record. The invoice is a PDF view of it.**

   There is no `invoices` table below and there never will be one. §9.1 gives a
   booking exactly one number however many times its PDF is downloaded, §9.4
   accumulates instalments against the booking itself, and §13.2 recognises
   value once, at `bookingDate`. An invoice entity breaks all three at the same
   time: billing a 5,000 booking in two parts becomes two rows, the scheduler
   shows the stay twice, and the month's revenue is 5,000 or 10,000 depending on
   which table the report happens to join. That model was tried and rejected —
   the phantom duplicates are the reason this is a comment rather than a table.

   The cost is accepted deliberately. Nothing archives what a client was shown,
   because nothing was stored; `audit_log` at the foot of this file is what pays
   for it, and §13.10 makes its before/after values the *only* record of a
   superseded figure.
   ------------------------------------------------------------------------ */

/**
 * The lifecycle, and the money, as two independent axes (§9.2).
 *
 * They are never merged. "Show me confirmed bookings" has to include the ones
 * that are half paid, and "show me what is unpaid" has to include the ones that
 * have already checked out — one column cannot answer both, and the version
 * that tries answers neither.
 */
export const BOOKING_STATUSES = [
  'draft',
  'confirmed',
  'checked_in',
  'checked_out',
  'completed',
  'cancelled',
] as const;

export const PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid'] as const;

export const BOOKING_SOURCES = ['direct', 'allotment', 'custom'] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const bookings = sqliteTable(
  'bookings',
  {
    id: text('id').primaryKey(),

    /**
     * `AHR-2026-00041`, allocated **at confirmation, not at creation** (§9.1),
     * which is why it is nullable: a draft has no number, and abandoned drafts
     * therefore leave no gaps in the series.
     */
    bookingNumber: text('booking_number').unique(),
    year: integer('year'),
    sequence: integer('sequence'),

    /* --- Agency: a soft link plus a snapshot (§9.5) ---
       `agencyId` stays for filtering and for the §13.8 profile; the columns
       beside it are copies. Renaming an agency next year must not rewrite the
       name on a booking made this year — that booking's PDF has already gone
       out under the old one. `set null` for the same reason: losing the link
       must not lose the booking. */
    agencyId: text('agency_id').references(() => agencies.id, {
      onDelete: 'set null',
    }),
    agencyName: text('agency_name').notNull(),
    contactPerson: text('contact_person'),
    agencyMobile: text('agency_mobile'),
    agencyWhatsapp: text('agency_whatsapp'),
    agencyEmail: text('agency_email'),
    agencyCountry: text('agency_country'),
    agencyAddress: text('agency_address'),

    /* --- Guest --- */
    guestName: text('guest_name'),
    guestMobile: text('guest_mobile'),
    guestEmail: text('guest_email'),
    guestCountry: text('guest_country'),

    /* --- Hotel: snapshot, same reasoning as the agency --- */
    hotelId: text('hotel_id').references(() => hotels.id, {
      onDelete: 'set null',
    }),
    hotelName: text('hotel_name'),
    hotelCity: text('hotel_city'),
    hotelCategory: text('hotel_category'),
    confirmationNumber: text('confirmation_number'),
    brnVrn: text('brn_vrn'),
    bookingSource: text('booking_source', { enum: BOOKING_SOURCES }),

    /* --- Stay ---
       Unix seconds at UTC midnight of the calendar day, like every other
       integer time column (§8). `lib/time.ts` does the conversion to and from
       the `YYYY-MM-DD` a native date input speaks; nothing here parses a date
       string by hand. `totalNights` is derived from the two dates and is never
       typed in (§9.6). */
    checkInDate: integer('check_in_date'),
    checkOutDate: integer('check_out_date'),
    totalNights: integer('total_nights').notNull().default(0),
    totalRooms: integer('total_rooms').notNull().default(0),
    totalGuests: integer('total_guests').notNull().default(0),

    /** When the work was written — what §13.2 recognises booking value at. */
    bookingDate: integer('booking_date').notNull(),
    dueDate: integer('due_date'),
    currency: text('currency').notNull().default('SAR'),

    /* --- Money: `integer`, whole Saudi Riyals, all of it derived (§9.6) ---
       Only `discountAmount` is typed in by a person. The rest is recomputed
       server-side by `recalculateBooking` and never accepted from a client. */
    roomsSubtotal: integer('rooms_subtotal').notNull().default(0),
    servicesSubtotal: integer('services_subtotal').notNull().default(0),
    discountAmount: integer('discount_amount').notNull().default(0),
    /**
     * Always 0. Deliberate, not vestigial (§9.9): the company is not
     * VAT-registered, nothing writes here, and neither PDF style renders it.
     * The column exists so that registering later is a rate in
     * `company_settings` and a template change rather than a migration of every
     * booking ever made.
     */
    vatAmount: integer('vat_amount').notNull().default(0),
    totalValue: integer('total_value').notNull().default(0),
    /** `SUM(payments.amount) WHERE isReversed = false`. Derived, never set. */
    amountPaid: integer('amount_paid').notNull().default(0),

    status: text('status', { enum: BOOKING_STATUSES })
      .notNull()
      .default('draft'),

    /**
     * Derived from `amountPaid` against `totalValue`, and recalculated on
     * **both** sides — payment changes *and* booking edits (§9.2). Reducing a
     * booking's value can flip it from partially paid to fully paid with no
     * payment having moved.
     */
    paymentStatus: text('payment_status', { enum: PAYMENT_STATUSES })
      .notNull()
      .default('unpaid'),

    notes: text('notes'),
    /** The T&C in force when the booking was confirmed (§9.5). */
    terms: text('terms'),
    cancelReason: text('cancel_reason'),

    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
    updatedBy: text('updated_by').references(() => user.id),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    confirmedAt: integer('confirmed_at'),
    completedAt: integer('completed_at'),
    cancelledAt: integer('cancelled_at'),
  },
  (t) => [
    index('idx_bk_status').on(t.status),
    index('idx_bk_payment_status').on(t.paymentStatus),
    index('idx_bk_checkin').on(t.checkInDate),
    index('idx_bk_checkout').on(t.checkOutDate),
    index('idx_bk_booking_date').on(t.bookingDate),
    index('idx_bk_agency').on(t.agencyId),
    index('idx_bk_year').on(t.year),
    index('idx_bk_confirmation').on(t.confirmationNumber),
    index('idx_bk_brn').on(t.brnVrn),
  ],
);

/**
 * Room lines. `cascade` here and on services, because these rows have no
 * meaning apart from their booking. Payments cascade too, but only so that
 * deleting a draft cannot orphan anything — a booking with payments against it
 * is never deleted at all (§9.8).
 */
export const bookingRooms = sqliteTable(
  'booking_rooms',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    roomTypeId: text('room_type_id').references(() => roomTypes.id),
    /** Snapshot, and what supports a room type typed in by hand (§9.5). */
    roomTypeName: text('room_type_name').notNull(),
    mealPlanId: text('meal_plan_id').references(() => mealPlans.id),
    mealPlanCode: text('meal_plan_code'),
    numberOfRooms: integer('number_of_rooms').notNull().default(1),
    numberOfGuests: integer('number_of_guests').notNull().default(1),
    /** Copied from the booking's dates, so a line always carries its own. */
    nights: integer('nights').notNull(),
    pricePerNight: integer('price_per_night').notNull(),
    /** `numberOfRooms × nights × pricePerNight`, computed server-side. */
    subtotal: integer('subtotal').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('idx_rooms_booking').on(t.bookingId)],
);

export const bookingServices = sqliteTable(
  'booking_services',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    serviceTypeId: text('service_type_id').references(() => serviceTypes.id),
    serviceName: text('service_name').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull(),
    /** `quantity × unitPrice`, computed server-side. */
    total: integer('total').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('idx_services_booking').on(t.bookingId)],
);

/**
 * Instalments against a booking, unlimited in number (§9.4).
 *
 * **Nothing deletes a payment.** Reversal sets `isReversed` and records the
 * reason, the user and the time; the history then shows the original *and* the
 * reversal, which is what a refund actually looks like. `amountPaid` sums only
 * the rows where `isReversed` is false.
 *
 * The table ships in Phase 10 although the recording UI is Phase 11, because
 * `recalculateBooking` sums it from the first booking that exists. An empty sum
 * is 0, which is `unpaid`, which is the honest answer — and the alternative
 * would be writing the derivation twice, once against a stub and once for real.
 */
export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    /** Whole Saudi Riyals (§8). */
    amount: integer('amount').notNull(),
    /** When the money arrived — what §13.2 recognises *received* at. */
    paidAt: integer('paid_at').notNull(),
    methodId: text('method_id').references(() => paymentMethods.id),
    methodName: text('method_name'),
    reference: text('reference'),
    notes: text('notes'),
    isReversed: integer('is_reversed', { mode: 'boolean' })
      .notNull()
      .default(false),
    reversedAt: integer('reversed_at'),
    reversedBy: text('reversed_by').references(() => user.id),
    reverseReason: text('reverse_reason'),
    recordedBy: text('recorded_by')
      .notNull()
      .references(() => user.id),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('idx_payments_booking').on(t.bookingId)],
);

/**
 * One row per calendar year, holding the last sequence issued (§9.1).
 *
 * Allocation is a single atomic statement — `INSERT … ON CONFLICT DO UPDATE …
 * RETURNING` — because D1 has no interactive transactions. Two executives
 * confirming at the same instant get different numbers.
 */
export const bookingCounters = sqliteTable('booking_counters', {
  year: integer('year').primaryKey(),
  lastSequence: integer('last_sequence').notNull().default(0),
});

/* ---------- Audit ----------

   This matters more here than in a system that stores its documents. Because
   the invoice is re-rendered from current state, an edit leaves no superseded
   copy anywhere — so `changes` has to carry the full before *and* after values,
   not merely the fact that something changed (§13.10). It is the only record of
   what a client was previously shown.
   ------------------------------------------------------------------------ */

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    /* Nullable, and `set null` on the reference: deactivating a staff account
       must not erase what they did. */
    actorId: text('actor_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    /** JSON. `{ before: {...}, after: {...} }` for an edit. */
    changes: text('changes'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('idx_audit_entity').on(t.entityType, t.entityId),
    index('idx_audit_created').on(t.createdAt),
  ],
);
