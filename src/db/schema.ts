/**
 * Drizzle schema for the D1 database.
 *
 * Tables land here from Phase 2 onwards. Two standing rules from the spec:
 *
 * - Money is `integer`, whole Saudi Riyals. Never `real`, never minor units.
 * - There is no `invoices` table. A booking is the only record; the invoice PDF
 *   is a view of its current state.
 */

export {};
