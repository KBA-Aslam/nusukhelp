-- Seed data for the Phase 9 lookup tables, and the placeholder
-- `company_settings` row (SPEC §8, *Lookup tables, not enums*).
--
-- **Separate from `0003`, which created the tables, because this is content and
-- that was structure.** The lists below are the client's to change — through
-- `/admin/settings/lists`, at runtime, which is the entire reason §8 makes these
-- tables rather than enums — whereas the schema is not. Keeping them in one file
-- would invite the next person to "fix" a seeded row by editing an applied
-- migration, which changes nothing in any database that already ran it.
--
-- ## The ids are slugs, not UUIDs
--
-- A seeded row gets a readable, deterministic id (`rt_double`, `mp_bb`); a row
-- an admin adds later gets a `crypto.randomUUID()`. Two benefits, both practical:
-- the seed is identical in the local and the remote database, so a booking
-- exported from one is intelligible against the other; and it is obvious at a
-- glance which rows shipped with the system and which were added by hand.
--
-- ## Every INSERT is `OR IGNORE`
--
-- So the file is idempotent, and so that re-seeding a database someone has
-- already edited cannot overwrite their work. A migration that silently reset
-- the client's price list would be exactly the kind of destruction the project
-- avoids everywhere else.
--
-- ## The hotels are placeholders — §19 open item 7
--
-- Six well-known properties, three in Makkah and three in Madinah, so that the
-- Phase 10 booking form has something real-shaped to pick from. The client
-- confirms the actual list before go-live, and does it in the UI rather than
-- here. Nothing depends on these specific rows: from Phase 10 a booking
-- snapshots the hotel name it used, so replacing this list never disturbs a
-- booking already written.

-- ---- Room types (§8) ----
INSERT OR IGNORE INTO room_types (id, name, sort_order, is_active) VALUES
  ('rt_single',    'Single',    10, 1),
  ('rt_double',    'Double',    20, 1),
  ('rt_triple',    'Triple',    30, 1),
  ('rt_quad',      'Quad',      40, 1),
  ('rt_quint',     'Quint',     50, 1),
  ('rt_hexa',      'Hexa',      60, 1),
  ('rt_suite',     'Suite',     70, 1),
  ('rt_family',    'Family',    80, 1),
  ('rt_apartment', 'Apartment', 90, 1);
--> statement-breakpoint

-- ---- Meal plans (§8) — sorted by how much is included, not alphabetically ----
INSERT OR IGNORE INTO meal_plans (id, code, name, sort_order, is_active) VALUES
  ('mp_ro', 'RO', 'Room Only',        10, 1),
  ('mp_bb', 'BB', 'Bed & Breakfast',  20, 1),
  ('mp_hb', 'HB', 'Half Board',       30, 1),
  ('mp_fb', 'FB', 'Full Board',       40, 1),
  ('mp_ai', 'AI', 'All Inclusive',    50, 1);
--> statement-breakpoint

-- ---- Service types (§8) ----
-- `default_price` is left NULL rather than guessed. A wrong default that looks
-- authoritative is worse than an empty field: it gets accepted without thought
-- and ends up on an invoice. The client sets these on /admin/settings/lists.
INSERT OR IGNORE INTO service_types (id, name, default_price, sort_order, is_active) VALUES
  ('st_extra_bed',        'Extra Bed',        NULL, 10, 1),
  ('st_airport_transfer', 'Airport Transfer', NULL, 20, 1),
  ('st_ziyarat',          'Ziyarat',          NULL, 30, 1),
  ('st_visa',             'Visa',             NULL, 40, 1),
  ('st_transport',        'Transport',        NULL, 50, 1),
  ('st_laundry',          'Laundry',          NULL, 60, 1);
--> statement-breakpoint

-- ---- Payment methods (§8) ----
INSERT OR IGNORE INTO payment_methods (id, name, sort_order, is_active) VALUES
  ('pm_cash',          'Cash',          10, 1),
  ('pm_bank_transfer', 'Bank Transfer', 20, 1),
  ('pm_card',          'Card',          30, 1),
  ('pm_online',        'Online',        40, 1),
  ('pm_other',         'Other',         50, 1);
--> statement-breakpoint

-- ---- Hotels — PLACEHOLDER, §19 item 7. created_at is Unix seconds (§8). ----
INSERT OR IGNORE INTO hotels (id, name, city, city_other, category, is_active, created_at) VALUES
  ('ht_sample_mk_1', 'Hilton Suites Makkah',        'makkah',  NULL, '5_star', 1, 1787145600),
  ('ht_sample_mk_2', 'Swissotel Al Maqam Makkah',   'makkah',  NULL, '5_star', 1, 1787145600),
  ('ht_sample_mk_3', 'Al Kiswah Towers',            'makkah',  NULL, '3_star', 1, 1787145600),
  ('ht_sample_md_1', 'Anwar Al Madinah Movenpick',  'madinah', NULL, '5_star', 1, 1787145600),
  ('ht_sample_md_2', 'Dar Al Iman InterContinental','madinah', NULL, '4_star', 1, 1787145600),
  ('ht_sample_md_3', 'Al Eiman Royal',              'madinah', NULL, '3_star', 1, 1787145600);
--> statement-breakpoint

-- ---- The single company_settings row — PLACEHOLDER, §19 item 4 ----
--
-- Phase 2 created the table and left it empty. The row exists from here so that
-- `/admin/settings/company` has something to edit and the Phase 12 invoice
-- header has something to read; the legal name, CR number, address and bank
-- details are client deliverables that block go-live, not the build.
--
-- The values that are *not* placeholders are the ones the spec fixes: the
-- number prefix is `AHR` (§9.1), and there is no VAT number or VAT line because
-- the company is not VAT-registered (§9.9, Appendix A).
INSERT OR IGNORE INTO company_settings (
  id, legal_name, trading_name, cr_number,
  address_line1, address_line2, city, country,
  phone_primary, phone_secondary, whatsapp, email, website,
  bank_name, bank_account_name, bank_iban,
  number_prefix, default_terms, prepared_by_label, approved_by_name, logo_url,
  updated_at
) VALUES (
  1,
  'Al Haramain Reservation',
  'Al Haramain Reservation',
  NULL,
  NULL, NULL, 'Madinah Al Munawarah', 'Saudi Arabia',
  '+966 57 679 9128', '+880 1690 029832', '+966 57 679 9128',
  'Nusukhelp@outlook.com', 'https://nusukhelp.com',
  NULL, NULL, NULL,
  'AHR', NULL, 'Prepared by', NULL, NULL,
  1787145600
);
