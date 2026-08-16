/**
 * Drizzle schema for the D1 database.
 *
 * Tables land here phase by phase. Two standing rules from the spec:
 *
 * - Money is `integer`, whole Saudi Riyals. Never `real`, never minor units.
 * - There is no `invoices` table. A booking is the only record; the invoice PDF
 *   is a view of its current state.
 *
 * Phase 2 adds the public-side tables only: reviews, enquiries, and the single
 * company_settings row. Auth arrives in Phase 8, lookups and agencies in
 * Phase 9, bookings and everything downstream of them in Phase 10.
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

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
    // Spec §8 declares this as `.references(() => user.id)`. The `user` table
    // does not exist until Phase 8, and D1 enforces foreign keys: a child row
    // whose parent table is missing fails to insert even when the key is NULL
    // ("no such table: main.user"), which would break public review submission
    // in Phase 6. The constraint is added by the Phase 8 migration; see §8.
    reviewedBy: text('reviewed_by'),
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
    // Same Phase 8 deferral as reviews.reviewedBy above.
    handledBy: text('handled_by'),
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
