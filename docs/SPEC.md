# nusukhelp.com — Architecture & Development Specification

**Version** 3.0
**Date** 11 August 2026
**Domain** nusukhelp.com
**Status** Approved for implementation

> **Changes from 2.0 — significant.** The admin panel's core entity is now the **booking**. In 2.0 the invoice *was* the booking record, which broke as soon as a client paid in instalments: each bill created a phantom duplicate booking, doubling scheduler entries and inflating every count. Bookings and payments are now separate, and the invoice is a **PDF rendering of a booking's current state** rather than a stored entity. This removes the entire invoice table set, invoice drafts, invoice cancellation, and the billed-vs-collected distinction. Net effect: roughly a third less admin work than 2.0.

---

## 1. Project overview

A bilingual marketing website with a private reservation-and-invoicing back-office, for a Saudi-based Hajj & Umrah ground-handling and reservation company based in Madinah.

### Brand hierarchy

**Nusuk Help is the parent brand.** Al Haramain Reservation is its B2B division.

```
NUSUK HELP
Your Trusted Hajj & Umrah Assistance Partner
│
├── Pilgrim services ....... consultancy, permits, ziyarat, guidance
│                           (headline offer: FREE CONSULTATION)
│
└── AL HARAMAIN RESERVATION ... B2B division
                                hotels, transport, rail, ziyarat,
                                ground handling, agency support
```

Footer carries the relationship explicitly — *"Al Haramain Reservation — a Nusuk Help B2B service division."*

### Company details

```
Trading name    Al Haramain Reservation
Location        Madinah Al Munawarah, Saudi Arabia
Phone           +966 57 679 9128  /  +880 1690 029832
Email           Nusukhelp@outlook.com
Website         www.nusukhelp.com
Approved by     Al Bani
```

### Two modes

**Public mode** — fully static, no accounts. Service information, company information, customer reviews. The only public write operations are submitting a review and submitting an enquiry.

**Admin mode** — invite-only authenticated area. The company's operational record of bookings, payments, scheduling, and reporting.

### The central design decision

**The booking is the only record. The invoice is a view of it.**

A booking holds the agency, guest, hotel, dates, rooms, services, and its total value. Payments are recorded against it as they arrive. The invoice PDF is generated on demand and always shows the booking's state at that moment:

```
BOOKING  AHR-2026-00041          value 5,000
├── payment  1,000  ·  15 Aug  ·  bank transfer
└── payment  4,000  ·  22 Aug  ·  cash
                                  paid 5,000  ·  due 0
```

Download the PDF after the advance → *total 5,000 · paid 1,000 · due 4,000*.
Download it after settlement → *total 5,000 · paid 5,000 · due 0*.
Edit the booking down to 4,000 → *total 4,000 · paid 1,000 · due 3,000*, and the dashboard follows.

**Why this matters.** The alternative — storing each bill as its own record — means a client paying in two instalments produces two documents that the system reads as two bookings. The scheduler would show two check-ins for one stay, and every booking count, room count, and guest count would inflate. One booking, many payments, one live document is the shape that keeps the numbers honest.

It is **not** a booking engine, an availability system, a channel manager, or a voucher system. Bookings are entered by staff after being arranged elsewhere.

---

## 2. Technology stack

```
Framework        Next.js 15 (App Router) + TypeScript (strict)
Styling          Tailwind CSS v4
Hosting          Cloudflare Workers via @opennextjs/cloudflare
Database         Cloudflare D1 (SQLite)
ORM              Drizzle ORM + drizzle-kit
Auth             Better Auth (email + password, invite-only)
i18n             next-intl
PDF              @react-pdf/renderer (browser-side, admin only)
Anti-spam        Cloudflare Turnstile
Email            Resend (free tier)
Charts           Recharts
Forms            React Hook Form + Zod
Icons            lucide-react
Page cache       Cloudflare KV (OpenNext incremental cache)
Backups          Cloudflare R2 + scheduled Worker cron
```

**Running cost:** $0/month plus domain renewal (~$10–15/year).

> **Watch item.** The Cloudflare free plan allows 10 ms CPU per request and 5M D1 row-reads/day. The dashboard's aggregate queries and the scheduler are heavier than a simple list view. If either becomes slow, the Workers Paid plan at $5/month raises CPU to 30 seconds. Build on free; upgrade if measurements say so, not preemptively.

**What "measurements say so" means, concretely.** Measure at the end of Phase 14 — once the dashboard aggregates, the scheduler, and the reports all exist, because those are the heavy paths and anything measured earlier is measuring the easy case. Take the numbers from `npx wrangler tail` and the Cloudflare dashboard analytics, and report two figures:

```
p95 CPU per request      upgrade threshold  > 8 ms
D1 rows read per day     upgrade threshold  > 3M/day
```

Either threshold being crossed justifies recommending the $5/month Workers Paid plan. Neither being crossed means staying on free. **Any recommendation to upgrade must arrive with the measurements attached** — not as a precaution, not as a hunch, and not before Phase 14 is finished.

### Why these choices

**Cloudflare over Vercel.** Vercel's Hobby plan prohibits commercial use, and its definition covers lead-generating business sites; Pro is $20/month/seat. Cloudflare's free tier has no commercial-use restriction. *(Any recommendation to host this on Vercel should be disregarded — it is a licence violation for this project.)*

**D1 over Postgres/Supabase.** Postgres from a Worker requires a serverless driver or Hyperdrive; Supabase's free tier pauses inactive projects. D1 is a native binding on the same platform.

**Browser-side PDF generation.** Server-side rendering would exceed the CPU budget. `@react-pdf/renderer` runs in the admin's browser: the Worker returns booking JSON, the browser assembles and downloads the file. Zero server CPU. *Do not substitute Puppeteer or any server renderer.*

**Static public pages.** All marketing pages are statically generated and cache-served from Cloudflare's edge cache. The Worker is invoked only on a cache miss and on revalidation — not on every request. At this site's traffic that is still effectively free.

Approving a review triggers on-demand revalidation of the landing page and `/reviews` in both locales (§13.11), so the pages are static but not frozen. That requires the OpenNext incremental cache to have somewhere to live: a KV namespace, bound in `wrangler.jsonc` from Phase 1 (§3). Note that this is what rules out a pure static export as a fallback — an export would drop revalidation, and new reviews would only appear on the next deploy.

---

## 3. Infrastructure

### Domain setup

The domain stays with its current registrar. Only nameservers move to Cloudflare — required because Workers Custom Domains need an active Cloudflare zone, and apex domains cannot use the external-CNAME shortcut.

1. Cloudflare dashboard → Add a site → `nusukhelp.com` → Free plan
2. Review the auto-imported DNS records against the current provider
3. Replace nameservers at the registrar with the two Cloudflare provides
4. Worker → Settings → Domains & Routes → Add Custom Domain

> **Before switching nameservers:** export or screenshot every existing DNS record — especially MX, SPF, DKIM, and DMARC. The company uses `Nusukhelp@outlook.com`; if that mailbox is tied to this domain and its MX records are missed during import, email stops working silently. Verify every record while the old nameservers are still authoritative.

### Bindings

```jsonc
// wrangler.jsonc
{
  "name": "nusukhelp",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    { "binding": "DB", "database_name": "nusukhelp-db", "database_id": "..." }
  ],
  "kv_namespaces": [
    // OpenNext incremental cache — required for on-demand revalidation
    { "binding": "NEXT_INC_CACHE_KV", "id": "..." }
  ],
  "r2_buckets": [
    { "binding": "BACKUPS", "bucket_name": "nusukhelp-backups" }
  ]
  // No cron trigger yet — added in Phase 16 with the backup handler (§16)
}
```

The KV namespace is created once with `npx wrangler kv namespace create NEXT_INC_CACHE_KV` and its id pasted in. Both bindings exist from Phase 1 even though backups aren't written until Phase 16; the cron **trigger** does not, because a schedule firing at a handler that doesn't exist is noise in the logs and a false sense of coverage.

### Secrets

Set via `wrangler secret put`, never committed:

```
BETTER_AUTH_SECRET
BETTER_AUTH_URL
TURNSTILE_SECRET_KEY
RESEND_API_KEY
IP_HASH_SALT
```

---

## 4. Route map

### Public — `/[locale]/*` where locale ∈ `{en, ar}`

| Route | Content |
|---|---|
| `/` | Landing — the complete story (section 5) |
| `/al-haramain-reservation` | Full depth on all six reservation services, one anchored section each |
| `/b2b` | Travel agency partnership |
| `/about` | Company, two divisions, mission, coverage |
| `/reviews` | Full review list + submission form |
| `/contact` | Split by audience — pilgrims vs agencies |
| `/privacy`, `/terms` | Legal |

Anchors on `/al-haramain-reservation`: `#hotels`, `#transport`, `#rail`, `#ziyarat`, `#permits`, `#ground-handling`.

> **SEO tradeoff, accepted deliberately.** One page competing for six search intents ranks worse than six focused pages. The sections are self-contained, so promoting the two strongest (hotels, transport) to standalone routes later is a low-cost change.

### Admin — `/admin/*` (no locale prefix, English only)

| Route | Purpose |
|---|---|
| `/admin/login` | Email + password |
| `/admin/accept-invite/[token]` | Set password, activate account |
| `/admin` | Dashboard |
| `/admin/bookings` | List, search, filter |
| `/admin/bookings/new` | Create booking |
| `/admin/bookings/[id]` | View, record payment, download PDF, complete, cancel |
| `/admin/bookings/[id]/edit` | Edit — allowed after confirmation, with guards |
| `/admin/schedule` | Check-in / check-out calendar |
| `/admin/schedule/check-ins` | Upcoming check-in list |
| `/admin/schedule/check-outs` | Upcoming check-out list |
| `/admin/completion` | Bookings past check-out awaiting completion |
| `/admin/reminders` | Task reminders linked to bookings |
| `/admin/agencies` | Agency list |
| `/admin/agencies/[id]` | Profile, booking history, financial history, **+ New Booking** |
| `/admin/reports` | Monthly and annual summaries |
| `/admin/reviews` | Moderate |
| `/admin/enquiries` | Public enquiry submissions |
| `/admin/settings/company` | Company details for the invoice header |
| `/admin/settings/lists` | Room types, meal plans, service types, hotels, payment methods |
| `/admin/settings/users` | Invite staff, deactivate accounts |

All admin mutations use **Server Actions**, not API routes.

> There is no `/admin/invoices` route. The invoice is a PDF generated from a booking, not a stored record with its own list, detail page, or lifecycle.

---

## 5. Landing page structure

In order:

1. **Hero** — headline, three CTAs: *Free Consultation* (primary), *Explore Services*, *Al Haramain Reservation →*
2. **Two divisions** — the signature element; full-width band splitting into Nusuk Help (pilgrims) and Al Haramain Reservation (agencies)
3. **Free consultation block** — full-width feature section, not a card. *No registration required. No consultation fee.* Single WhatsApp CTA. This is the strongest conversion opportunity on the site.
4. **Services grid** — 7 summary cards linking to anchors; card 07 (B2B) gets distinct treatment
5. **Why choose us** — six icon-led points
6. **Coverage** — Makkah, Madinah, Jeddah, other. Reinforces Saudi-side local presence, the core B2B differentiator.
7. **B2B highlight** — six pillars, *Become Our Partner* CTA
8. **Reviews** — published reviews + submission form
9. **Contact** — split: pilgrims → Free Consultation, agencies → B2B Enquiry

Footer: Services / B2B / Company columns, division line, affiliation disclaimer.

---

## 6. Internationalisation

- Locales: `en` (default), `ar`. Always-prefixed routing.
- Arabic layout sets `dir="rtl"` on `<html>`
- **All spacing uses logical properties** — `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`. Never `ml-*`, `mr-*`, `left-*`, `right-*` in shared components.
- Directional icons mirror with `rtl:-scale-x-100`
- Western Arabic numerals (`1234`) in both locales
- `hreflang` alternates on every page
- **Admin is English-only.** No locale prefix, `dir="ltr"` always.

Fonts: Inter (Latin), IBM Plex Sans Arabic (Arabic, loaded only on `/ar`).

---

## 7. Design direction

> **Important caution.** "Nusuk" is the Saudi Ministry of Hajj and Umrah's official platform brand. A site at nusukhelp.com that copies Nusuk's visual identity risks reading as official affiliation. Mitigations, all required:
> - Distinct logo and wordmark — do not imitate the Nusuk mark
> - Palette adjacent, not identical
> - Persistent footer disclaimer in both languages: *"Nusuk Help is an independent travel services provider. We are not affiliated with, endorsed by, or connected to Nusuk or the Saudi Ministry of Hajj and Umrah."*
> - Same disclaimer on the consultation block
>
> Confirm the naming with a Saudi legal advisor before investing in brand assets. **This is the largest business risk in the project.**

### Tokens — measured from the supplied logo artwork

Every value below was sampled from the two marks, not invented. The deep green specified in v1.1 was confirmed within a few points; the notable correction is that the two marks use **different golds**, so both are retained.

```css
--ink:      #0C2923;  /* deep pine — AHR tile ground; darkest surface */
--pine:     #0B3B31;  /* brand green — Nusuk calligraphy */
--verdant:  #14614C;  /* mid green — primary actions */
--brass:    #B08E4F;  /* gold in the Nusuk mark — accents on light */
--gilt:     #D4B467;  /* gold in the AHR mark — accents on dark */
--mist:     #E7EFEA;  /* pale green tint — section backgrounds */
--sand:     #FAF7F1;  /* warm off-white — page ground */
--slate:    #47554F;  /* body text */
```

One palette everywhere — public site, admin panel, and invoice PDF — so printed documents match the brand.

### Logo placement — enforced, not advisory

| Surface | Mark |
|---|---|
| Public site header & footer | Nusuk Help |
| Landing, About, Contact | Nusuk Help |
| `/al-haramain-reservation` page body | Al Haramain |
| Footer division line | Al Haramain (small, gilt) |
| Admin panel — every screen | Al Haramain **only** |
| Invoice PDF — both styles | Al Haramain **only** |

The division mark never appears in the public site header.

> **Asset note.** The supplied SVG files are PNG images inside an SVG wrapper — raster, not vector. Cleaned transparent variants are in `prototype/logos/`, but they will soften if scaled beyond native size. Commission a true vector redraw before any print production.

### Signature device — the ogee arch

### Structure

The **ogee arch** from the dome in the Nusuk Help mark is the one bold device. It masks the hero panel and outlines the two-division cards — and appears nowhere else. Everything around it stays disciplined:

- **Type:** Marcellus for display (headings only), IBM Plex Sans for body and UI. Plex was chosen because IBM Plex Sans Arabic is its sibling — one superfamily across both scripts rather than two unrelated faces.
- Eyebrows set in tracked Plex capitals, quoting the logo lockups
- Section dividers as thin brass rules, not shadows or gradients
- Cards: subtle border, 2px radius, no drop shadows
- **Square-Kufic corner brackets** from the AHR mark on cards at ~45% opacity — a whisper, not a second signature
- Motion restrained; respect `prefers-reduced-motion`
- Consistent photographic treatment across Makkah/Madinah imagery

See `prototype/01-design-system.svg` for the full specimen sheet.

### Quality floor

Responsive to 360 px. Visible keyboard focus. WCAG AA contrast. Alt text throughout. Reduced motion respected.

---

## 8. Data model

Drizzle schema, D1/SQLite dialect.

### Money convention

**All money columns are `integer`, storing whole Saudi Riyals.** SAR only — no multi-currency, no sub-units. Stored value equals displayed value: `1500` renders as `SAR 1,500`.

SQLite has no `DECIMAL`; `REAL` is floating-point and accumulates drift across thousands of rows. Integer arithmetic is exact.

### Timestamps

`integer` Unix seconds, UTC. Displayed in `Asia/Riyadh`.

### Lookup tables, not enums

Room types, meal plans, service types, hotel categories, hotels, and payment methods are **editable lookup tables**, because the admin needs to add options at runtime. Hardcoded enums cannot grow, and retrofitting once historical rows reference enum strings is painful.

### Schema

```ts
// src/db/schema.ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/* ---------- Auth (Better Auth) ---------- */

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  role: text('role', { enum: ['admin', 'executive', 'viewer'] }).notNull().default('executive'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  password: text('password'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const adminInvites = sqliteTable('admin_invites', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  role: text('role', { enum: ['admin', 'executive', 'viewer'] }).notNull().default('executive'),
  tokenHash: text('token_hash').notNull().unique(),   // SHA-256, never plaintext
  invitedBy: text('invited_by').notNull().references(() => user.id),
  expiresAt: integer('expires_at').notNull(),          // 7 days
  acceptedAt: integer('accepted_at'),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_invites_email').on(t.email)]);

/* ---------- Agencies (repeat B2B clients) ---------- */

export const agencies = sqliteTable('agencies', {
  id: text('id').primaryKey(),
  agencyName: text('agency_name').notNull(),
  contactPerson: text('contact_person'),
  mobile: text('mobile'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  country: text('country'),
  address: text('address'),
  notes: text('notes'),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [
  index('idx_agencies_name').on(t.agencyName),
  index('idx_agencies_contact').on(t.contactPerson),
]);

/* ---------- Lookup tables ---------- */

export const roomTypes = sqliteTable('room_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),          // Single, Double, Triple, Quad, Quint, Hexa, Suite, Family, Apartment
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const mealPlans = sqliteTable('meal_plans', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),          // RO, BB, HB, FB, AI
  name: text('name').notNull(),          // Room Only, Bed & Breakfast, ...
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const serviceTypes = sqliteTable('service_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),          // Extra Bed, Airport Transfer, Ziyarat, Visa, Transport, Laundry
  defaultPrice: integer('default_price'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const hotels = sqliteTable('hotels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city', { enum: ['makkah', 'madinah', 'jeddah', 'other'] }).notNull(),
  cityOther: text('city_other'),
  category: text('category', {
    enum: ['economy', '1_star', '2_star', '3_star', '4_star', '5_star'],
  }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_hotels_name').on(t.name)]);

export const paymentMethods = sqliteTable('payment_methods', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),          // Cash, Bank Transfer, Card, Online, Other
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

/* ---------- Bookings (the core entity) ---------- */

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  bookingNumber: text('booking_number').unique(),   // AHR-2026-00041, null while draft
  year: integer('year'),
  sequence: integer('sequence'),

  // agency snapshot — frozen at confirmation
  agencyId: text('agency_id').references(() => agencies.id, { onDelete: 'set null' }),
  agencyName: text('agency_name').notNull(),
  contactPerson: text('contact_person'),
  agencyMobile: text('agency_mobile'),
  agencyWhatsapp: text('agency_whatsapp'),
  agencyEmail: text('agency_email'),
  agencyCountry: text('agency_country'),
  agencyAddress: text('agency_address'),

  // guest
  guestName: text('guest_name'),
  guestMobile: text('guest_mobile'),
  guestEmail: text('guest_email'),
  guestCountry: text('guest_country'),

  // hotel — snapshot
  hotelId: text('hotel_id').references(() => hotels.id, { onDelete: 'set null' }),
  hotelName: text('hotel_name'),
  hotelCity: text('hotel_city'),
  hotelCategory: text('hotel_category'),
  confirmationNumber: text('confirmation_number'),
  brnVrn: text('brn_vrn'),
  bookingSource: text('booking_source', {
    enum: ['direct', 'allotment', 'custom'],
  }),

  // stay — drives the scheduler, completion, and all booking counts
  checkInDate: integer('check_in_date'),
  checkOutDate: integer('check_out_date'),
  totalNights: integer('total_nights').notNull().default(0),   // derived
  totalRooms: integer('total_rooms').notNull().default(0),     // derived
  totalGuests: integer('total_guests').notNull().default(0),   // derived

  bookingDate: integer('booking_date').notNull(),   // when written — drives monthly revenue
  dueDate: integer('due_date'),
  currency: text('currency').notNull().default('SAR'),

  roomsSubtotal: integer('rooms_subtotal').notNull().default(0),
  servicesSubtotal: integer('services_subtotal').notNull().default(0),
  discountAmount: integer('discount_amount').notNull().default(0),
  vatAmount: integer('vat_amount').notNull().default(0),   // always 0 — not VAT-registered
  totalValue: integer('total_value').notNull().default(0), // derived
  amountPaid: integer('amount_paid').notNull().default(0), // derived from payments

  status: text('status', {
    enum: ['draft', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled'],
  }).notNull().default('draft'),

  paymentStatus: text('payment_status', {
    enum: ['unpaid', 'partially_paid', 'paid'],
  }).notNull().default('unpaid'),        // derived, never set by hand

  notes: text('notes'),                  // special requests
  terms: text('terms'),                  // snapshot of T&C at confirmation
  cancelReason: text('cancel_reason'),

  createdBy: text('created_by').notNull().references(() => user.id),
  updatedBy: text('updated_by').references(() => user.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  confirmedAt: integer('confirmed_at'),
  completedAt: integer('completed_at'),
  cancelledAt: integer('cancelled_at'),
}, (t) => [
  index('idx_bk_status').on(t.status),
  index('idx_bk_payment_status').on(t.paymentStatus),
  index('idx_bk_checkin').on(t.checkInDate),
  index('idx_bk_checkout').on(t.checkOutDate),
  index('idx_bk_booking_date').on(t.bookingDate),
  index('idx_bk_agency').on(t.agencyId),
  index('idx_bk_year').on(t.year),
  index('idx_bk_confirmation').on(t.confirmationNumber),
  index('idx_bk_brn').on(t.brnVrn),
]);

export const bookingRooms = sqliteTable('booking_rooms', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  roomTypeId: text('room_type_id').references(() => roomTypes.id),
  roomTypeName: text('room_type_name').notNull(),   // snapshot, supports custom
  mealPlanId: text('meal_plan_id').references(() => mealPlans.id),
  mealPlanCode: text('meal_plan_code'),             // snapshot
  numberOfRooms: integer('number_of_rooms').notNull().default(1),
  numberOfGuests: integer('number_of_guests').notNull().default(1),
  nights: integer('nights').notNull(),
  pricePerNight: integer('price_per_night').notNull(),
  subtotal: integer('subtotal').notNull(),          // rooms × nights × pricePerNight
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [index('idx_rooms_booking').on(t.bookingId)]);

export const bookingServices = sqliteTable('booking_services', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  serviceTypeId: text('service_type_id').references(() => serviceTypes.id),
  serviceName: text('service_name').notNull(),      // snapshot, supports custom
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull(),
  total: integer('total').notNull(),                // quantity × unitPrice
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [index('idx_services_booking').on(t.bookingId)]);

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  paidAt: integer('paid_at').notNull(),
  methodId: text('method_id').references(() => paymentMethods.id),
  methodName: text('method_name'),                  // snapshot
  reference: text('reference'),
  notes: text('notes'),
  isReversed: integer('is_reversed', { mode: 'boolean' }).notNull().default(false),
  reversedAt: integer('reversed_at'),
  reversedBy: text('reversed_by').references(() => user.id),
  reverseReason: text('reverse_reason'),
  recordedBy: text('recorded_by').notNull().references(() => user.id),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_payments_booking').on(t.bookingId)]);

export const bookingCounters = sqliteTable('booking_counters', {
  year: integer('year').primaryKey(),
  lastSequence: integer('last_sequence').notNull().default(0),
});

/* No invoice tables. The invoice is a PDF rendered from a booking's current
   state — it is never stored as a row. See section 10. */

/* ---------- Reminders ---------- */

export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  dueAt: integer('due_at').notNull(),
  priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
  assignedTo: text('assigned_to').references(() => user.id),
  status: text('status', {
    enum: ['pending', 'completed', 'cancelled'],
  }).notNull().default('pending'),
  completedAt: integer('completed_at'),
  createdBy: text('created_by').notNull().references(() => user.id),
  createdAt: integer('created_at').notNull(),
}, (t) => [
  index('idx_reminders_due').on(t.dueAt),
  index('idx_reminders_status').on(t.status),
]);

/* ---------- Public content ---------- */

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),          // stored, NEVER displayed publicly
  rating: integer('rating').notNull(),     // 1–5
  comment: text('comment').notNull(),
  serviceUsed: text('service_used'),
  country: text('country'),
  status: text('status', {
    enum: ['pending', 'published', 'hidden', 'spam'],
  }).notNull().default('pending'),
  ipHash: text('ip_hash'),
  locale: text('locale').notNull().default('en'),
  createdAt: integer('created_at').notNull(),
  reviewedAt: integer('reviewed_at'),
  reviewedBy: text('reviewed_by').references(() => user.id),
}, (t) => [
  index('idx_reviews_status').on(t.status),
  index('idx_reviews_created').on(t.createdAt),
]);

export const enquiries = sqliteTable('enquiries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  company: text('company'),
  audience: text('audience', { enum: ['pilgrim', 'agency'] }).notNull().default('pilgrim'),
  serviceInterest: text('service_interest'),
  message: text('message').notNull(),
  locale: text('locale').notNull().default('en'),
  status: text('status', { enum: ['new', 'contacted', 'closed'] }).notNull().default('new'),
  ipHash: text('ip_hash'),
  createdAt: integer('created_at').notNull(),
  handledBy: text('handled_by').references(() => user.id),
  handledAt: integer('handled_at'),
}, (t) => [index('idx_enquiries_status').on(t.status)]);

/* ---------- Company settings ---------- */

export const companySettings = sqliteTable('company_settings', {
  id: integer('id').primaryKey().default(1),   // single row
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
  approvedByName: text('approved_by_name'),    // "Al Bani"
  logoUrl: text('logo_url'),
  updatedAt: integer('updated_at').notNull(),
});

/* ---------- Audit ---------- */

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').references(() => user.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  changes: text('changes'),                 // JSON
  createdAt: integer('created_at').notNull(),
}, (t) => [index('idx_audit_entity').on(t.entityType, t.entityId)]);
```

---

## 9. Business rules

### 9.1 Booking numbering

Format: `AHR-{YYYY}-{NNNNN}` — five digits, e.g. `AHR-2026-00041`. Single series. Sequence resets each calendar year. Prefix configurable in company settings.

The number identifies the **booking**, and the invoice PDF carries the same number. One booking, one number, however many times the PDF is downloaded.

Numbers are assigned **at confirmation, not at draft creation**, so abandoned drafts don't leave gaps. Never manually entered.

D1 has no interactive transactions, so allocation uses one atomic statement:

```sql
INSERT INTO booking_counters (year, last_sequence) VALUES (?, 1)
ON CONFLICT(year) DO UPDATE SET last_sequence = last_sequence + 1
RETURNING last_sequence;
```

Safe under concurrency — two executives confirming simultaneously receive different sequences.

### 9.2 Two independent status fields

A booking can be *confirmed and partially paid at the same time*. These are separate dimensions and must not be collapsed into one field, or filtering breaks ("show confirmed bookings" would miss every partially-paid one).

```
status          draft → confirmed → checked_in → checked_out → completed
                (+ cancelled, terminal from any non-draft state)

paymentStatus   unpaid → partially_paid → paid
                derived from payments, never set by hand
```

Both render as separate badges throughout the UI.

**paymentStatus derivation**, recalculated after any payment insert, reversal, deletion, **or booking edit**:

```
amountPaid = SUM(payments.amount) WHERE isReversed = false

amountPaid === 0              → unpaid
0 < amountPaid < totalValue   → partially_paid
amountPaid >= totalValue      → paid
```

Note the recalculation on edit. Reducing a booking's value can flip it from partially paid to fully paid without any payment changing — the derivation must run on both sides.

### 9.3 Editing a booking

**Bookings stay editable after confirmation.** Hotels change, dates shift, room counts move. This is normal operational reality and the system must accommodate it.

When a booking is edited, everything downstream follows automatically:

```
Booking value 5,000, paid 1,000  →  PDF reads:  total 5,000 · paid 1,000 · due 4,000
Edit value down to 4,000         →  PDF reads:  total 4,000 · paid 1,000 · due 3,000
                                 →  Dashboard revenue for that month: 5,000 becomes 4,000
```

No document reconciliation is needed, because no document was stored — the PDF is regenerated from current state each time.

**Guards, all required:**

- **Overpayment warning.** If an edit would drop `totalValue` below `amountPaid`, warn before saving: *"Paid amount (SAR 5,000) exceeds the new booking value (SAR 4,000). A refund of SAR 1,000 may be owed."* Do not block the save — sometimes a refund genuinely is owed — but never let it pass silently.
- **Completed-booking warning.** Editing a booking marked `completed` changes a closed month's figures. Warn explicitly: *"This booking is completed. Editing will change the reported total for August 2026."*
- **Full audit trail.** Every edit writes to `audit_log` with the before and after values. Since the document is not stored, the audit log is the only record of what the client was previously shown.
- **Cancelled bookings are not editable.**

### 9.4 Payments

Payments accumulate against a booking with no limit — one, two, or ten instalments all work the same way. Each records amount, date, method, reference, notes, and who recorded it.

Payments are never hard-deleted. Reversal sets `isReversed = true` and records reason, user, and timestamp; the history shows both the original and the reversal. `amountPaid` and `paymentStatus` recalculate accordingly.

Only Admin can reverse a payment. Payments cannot be recorded against `draft` or `cancelled` bookings.

### 9.5 Snapshots

At confirmation, the agency's name, contact person, phone, email, and address are copied into the booking row, along with hotel details, room type names, meal plan codes, service names, and payment method names. Later edits to agency or lookup records never alter existing bookings. `agencyId` stays as a soft link for filtering and history.

Terms & conditions are snapshotted at the same moment, so a booking always carries the terms that applied when it was made.

### 9.6 Calculation — always server-side

```
room.subtotal      = numberOfRooms × nights × pricePerNight
service.total      = quantity × unitPrice

roomsSubtotal      = SUM(room.subtotal)
servicesSubtotal   = SUM(service.total)
totalValue         = roomsSubtotal + servicesSubtotal − discountAmount + vatAmount

amountPaid         = SUM(payments.amount) WHERE isReversed = false
balanceDue         = totalValue − amountPaid

nights             = checkOutDate − checkInDate  (in days)
totalRooms         = SUM(room.numberOfRooms)
totalGuests        = SUM(room.numberOfGuests)
```

Nights are **never** entered manually — always derived from the two dates. Client-side figures are display only and recalculated on submit.

### 9.7 Booking completion

A booking is flagged for completion when `checkOutDate < today` AND `status` is `confirmed` or `checked_out`. The `/admin/completion` page lists these with a one-click **Mark completed** action, and the dashboard shows the count as an alert.

### 9.8 Cancellation

Cancelling requires a reason and sets `status = 'cancelled'` with a timestamp. Cancelled bookings:

- are excluded from all revenue and booking-count totals
- disappear from the scheduler
- remain visible in the booking list with a clear badge
- keep their payment history intact — refunds are recorded as reversals, not deletions

Only Admin can cancel. Bookings are never hard-deleted; drafts are the only records that can be removed outright.

### 9.9 VAT status

The company is **not VAT-registered**. Therefore:

- The document is titled **"INVOICE"** — never "Tax Invoice"
- No VAT registration number anywhere on the template
- No VAT line, no tax subtotal
- No ZATCA QR code or cryptographic stamp

**`vatAmount` stays in the schema at `0`.** It is deliberate, not vestigial. Registering for VAT later needs more than one column — a rate in `company_settings` and a change to the invoice template as well — and having the column already there makes that migration smaller. Nothing writes to it in the meantime; it is never displayed, never summed, and never rendered on either PDF style.

**The footer disclaimer is approved copy.** The invoice footer reads *"Not a tax invoice. The company is not VAT-registered."* This does not conflict with Appendix A, which forbids **titling** the document "Tax Invoice". The document is titled "INVOICE"; the footer is a factual disclaimer about registration status, and stating it plainly is the point.

> Saudi VAT registration becomes mandatory once annual taxable supplies exceed a ZATCA-set threshold. Confirm the current figure with an accountant.

### 9.10 Drafts

A draft is a real row in `bookings` with `bookingNumber = null` and `status = 'draft'`, autosaved server-side on every step change (§20.4). **No browser storage** — not `localStorage`, not `sessionStorage`. Losing twenty minutes of entry to a dropped connection is the failure mode that makes staff stop using the system, and a draft that only exists in one phone's browser is already lost.

Drafts are excluded from every count, total, and scheduler view, and carry no booking number until confirmation (§9.1), so abandoned ones cost nothing but clutter.

**Cleanup is manual, never automatic.** Drafts with no activity for 30 days surface under a **Drafts** filter in `/admin/bookings`, where a person can review and delete them deliberately. There is no TTL purge and no scheduled cleanup job — silently deleting someone's half-finished work is worse than leaving clutter in a list. Drafts remain the only records that can be removed outright (§9.8), and even then only by a human acting on purpose.

---

## 10. Invoice PDF — two styles

The invoice is **not a stored record**. It is a PDF rendered on demand from a booking's current state, downloaded from the booking detail screen. Both styles come from the same booking, A4 portrait, in the brand palette, browser-side via `@react-pdf/renderer`.

### The document is a live statement

Because nothing is stored, the same booking produces different — and always current — documents over time:

```
After the advance     total 5,000  ·  paid 1,000  ·  due 4,000
After settlement      total 5,000  ·  paid 5,000  ·  due 0
After an edit         total 4,000  ·  paid 1,000  ·  due 3,000
```

The booking number stays the same throughout. This is correct behaviour: there is one booking, so there is one number.

> **Required because of this.** Every PDF carries a generation timestamp in the header — *"Statement as of 22 Aug 2026, 14:30"*. Without it, a client holding two downloads of `AHR-2026-00041` showing different figures has no way to tell which is current. This line costs nothing and prevents a predictable dispute.

### Style 1 — Full invoice

Complete booking and financial information: room rates, per-night prices, subtotals, service prices, total value, amount paid, balance due, payment status, amount in words, bank details.

### Style 2 — Confidential invoice (no amounts)

Professional proof of booking with **zero monetary values**, for cases where the agency's B2B rates must not be exposed.

Shown: company header, booking number, generation timestamp, agency, guest, hotel, confirmation number, BRN/VRN, booking source, check-in, check-out, nights, room types with room and guest counts, meal plans, service names with quantities, notes, terms, declaration, signature area.

Hidden entirely: price per night, room subtotals, service unit prices, service totals, discount, total value, amount paid, balance due, payment status, amount in words, bank details, and any other figure in SAR.

This style doubles as the **booking confirmation document** — proof of booking for a client who must not see B2B rates.

### How the hiding is implemented — this is the critical part

**Do not pass the full invoice object and conditionally skip rendering price fields.** That approach leaks: the data still reaches the component, so it can surface through a later refactor, and in some renderers through text layers or metadata. It is also one careless line away from breaking.

Instead, define two distinct types where the confidential shape has **no price fields at all**:

```ts
// src/lib/pdf/types.ts

export type BookingRoomFull = {
  roomTypeName: string;
  mealPlanCode: string | null;
  numberOfRooms: number;
  numberOfGuests: number;
  nights: number;
  pricePerNight: number;
  subtotal: number;
};

export type BookingRoomConfidential = {
  roomTypeName: string;
  mealPlanCode: string | null;
  numberOfRooms: number;
  numberOfGuests: number;
  nights: number;
  // no pricePerNight, no subtotal — the fields do not exist on this type
};

export type InvoiceFullData = { /* ...all financial fields... */ };
export type InvoiceConfidentialData = { /* ... no financial fields ... */ };
```

A sanitiser builds the confidential object by explicitly listing safe fields — never by deleting keys from the full object, which leaves them recoverable through spread operators and serialisation:

```ts
export function toConfidential(b: InvoiceFullData): InvoiceConfidentialData {
  return {
    bookingNumber: b.bookingNumber,
    generatedAt: b.generatedAt,
    agencyName: b.agencyName,
    // ... explicit allow-list only
    rooms: b.rooms.map((r) => ({
      roomTypeName: r.roomTypeName,
      mealPlanCode: r.mealPlanCode,
      numberOfRooms: r.numberOfRooms,
      numberOfGuests: r.numberOfGuests,
      nights: r.nights,
    })),
    services: b.services.map((s) => ({
      serviceName: s.serviceName,
      quantity: s.quantity,
    })),
  };
}
```

The confidential PDF component accepts only `InvoiceConfidentialData`. TypeScript then makes the leak impossible to write — referencing a price field in that component is a compile error.

**Additional requirements:**

- Separate components: `InvoiceFullDocument.tsx` and `InvoiceConfidentialDocument.tsx`. No shared component with an `showPrices` boolean — that is the same conditional-rendering trap in different clothing.
- Filename carries no amounts: `AHR-2026-00001.pdf` and `AHR-2026-00001-confidential.pdf`
- No PDF metadata containing figures
- Confidential PDFs are clearly labelled in the UI so staff know which they generated

### Generation UI

On the booking detail page:

```
Generate PDF
  ○ Full invoice — shows all amounts
  ○ Confidential invoice — hides all amounts
[ Generate ]
```

The choice is explicit each time. No remembered default — the cost of accidentally sending the wrong one is high.

### Layout

```
┌──────────────────────────────────────────────┐
│  [logo]                            INVOICE   │
│  Al Haramain Reservation     AHR-2026-00041  │
│  Madinah Al Munawarah        Statement as of │
│  Phone / Email / Website     22 Aug 26, 14:30│
├──────────────────────────────────────────────┤
│  BILL TO                  BOOKING            │
│  Agency name              Hotel, city, cat.  │
│  Contact person           Conf. no / BRN     │
│  Phone / email / country  Source             │
│  Guest: ...               In / Out / Nights  │
├──────────────────────────────────────────────┤
│  ROOMS                                       │
│  Type   Meal  Rooms  Guests  Nights  [Rate]  [Subtotal] │
├──────────────────────────────────────────────┤
│  EXTRA SERVICES                              │
│  Service          Qty  [Unit price]  [Total] │
├──────────────────────────────────────────────┤
│  [ Rooms subtotal / Services subtotal /      │
│    Discount / TOTAL VALUE / Paid / Balance / │
│    Payment status / Amount in words ]        │
├──────────────────────────────────────────────┤
│  Notes & special requests                    │
│  [ Bank details ]                            │
├──────────────────────────────────────────────┤
│  TERMS & CONDITIONS (6 clauses)              │
│  DECLARATION                                 │
├──────────────────────────────────────────────┤
│  Prepared By: ______    Approved By: Al Bani │
│  Not a tax invoice. Not VAT-registered.      │
└──────────────────────────────────────────────┘
```

`[ bracketed ]` sections and columns appear in the full style only. See `prototype/06-invoice-a4-both-styles.svg` for both rendered at size.

### Amount in words

SAR only, so a single converter. `3450` → *"Three Thousand Four Hundred Fifty Saudi Riyals Only"*. No decimal handling needed. Full style only.

---

## 11. Terms & conditions

Snapshotted onto each booking at confirmation, so a booking always carries the terms that applied when it was made. Editable in company settings. Both PDF styles carry them in full.

**TERMS & CONDITIONS**

1. **Payment & Confirmation:** Full payment must be received before final confirmation/approval. Any outstanding payment may result in cancellation without prior notice.
2. **Cancellation & Refund:** Cancellation, amendment, or refund is subject to the applicable hotel/supplier policy and management charges. No cancellation or refund is permitted after final confirmation/Nusuk approval unless officially authorized.
3. **Hotel Policy:** Check-in/out time, room allocation, occupancy, breakfast, extra bed, special requests, taxes, deposits, and other hotel services are subject to the hotel's prevailing policies and availability.
4. **No-Show & Early Departure:** No-show, late arrival, early check-out, or unused nights are generally non-refundable and may be charged in full according to hotel policy.
5. **Guest Information:** The agency/client is responsible for providing accurate guest and booking information. Any additional charges or consequences arising from incorrect information shall be borne by the responsible party.
6. **Unforeseen Circumstances:** The agency shall not be responsible for changes, cancellations, hotel relocation, service interruptions, or losses caused by hotels, suppliers, government regulations, Nusuk, transportation issues, or circumstances beyond the agency's reasonable control.

**DECLARATION**

> By accepting this invoice, the agency/client acknowledges and agrees to the above Terms & Conditions and all applicable hotel, supplier, and reservation policies.

*(Wording changed from "voucher" to "invoice" to match the document type.)*

---

## 12. Authentication & roles

**Better Auth**, email + password, D1 adapter via Drizzle. Invite-only — no public signup route, no `/admin/register`.

1. First admin account seeded by a one-off script
2. Admin invites by email from `/admin/settings/users`
3. Random token generated; **only its SHA-256 hash stored**
4. Plaintext token emailed via Resend as a link to `/admin/accept-invite/[token]`
5. Invitee sets a password; account activates
6. Invites expire after 7 days

### Permissions

| Capability | Admin | Executive | Viewer |
|---|---|---|---|
| View dashboard, bookings, schedule, reports | ✓ | ✓ | ✓ |
| Create bookings | ✓ | ✓ | ✗ |
| Confirm bookings | ✓ | ✓ | ✗ |
| Edit bookings | ✓ | ✓ | ✗ |
| Generate either PDF style | ✓ | ✓ | ✗ |
| Record payments | ✓ | ✓ | ✗ |
| Reverse payments | ✓ | ✗ | ✗ |
| Cancel bookings | ✓ | ✗ | ✗ |
| Mark completed | ✓ | ✓ | ✗ |
| Manage agencies | ✓ | ✓ | ✗ |
| Create reminders | ✓ | ✓ | ✗ |
| Moderate reviews | ✓ | ✓ | ✗ |
| Manage lookup lists | ✓ | ✗ | ✗ |
| Invite / deactivate users | ✓ | ✗ | ✗ |
| Edit company settings | ✓ | ✗ | ✗ |
| View audit log | ✓ | ✗ | ✗ |

### Enforcement — two layers, both required

1. `middleware.ts` guards `/admin/*`, redirects unauthenticated to login
2. **Every server action independently re-checks session and role**

Middleware alone is insufficient — server actions are directly invocable and must not assume it ran. Permissions are enforced server-side, not merely hidden in the UI.

Session: HTTP-only, Secure, SameSite=Lax, 7-day rolling expiry.
Login rate limit: 5 attempts per 15 minutes per IP hash, generic failure message.

Two-factor authentication is deferred to v2, once meaningful financial history exists. Better Auth supports it as a plugin.

---

## 13. Admin features

### 13.1 Dashboard — built from bookings

**Booking cards:** total bookings, this month's bookings, upcoming check-ins (7 days), upcoming check-outs (7 days), total rooms and guests this month.

**Financial cards:** booking value this month, amount received, outstanding, average booking value — each with prior-month delta.

**Alerts** — the action list:
- Bookings awaiting completion (check-out passed, not completed)
- Upcoming check-ins with outstanding balance — *"Check-in tomorrow — outstanding SAR 2,500"*
- Overdue bookings (`dueDate < today`, not fully paid)
- Pending reminders due today
- Reviews awaiting moderation

**Charts:** monthly booking value vs received (12-month), revenue by service category (donut), monthly booking count.

**Recent activity** from the audit log.

### 13.2 The three money figures

```
Booking value   SUM(totalValue)     where status NOT IN (draft, cancelled)
Received        SUM(payments.amount) where isReversed = false
Outstanding     Booking value − Received
```

**Booking value is recognised at `bookingDate`** — when the work was written, not when money arrived. **Received is recognised at `paidAt`.** They answer different questions and are always shown as separate figures. Drafts and cancelled bookings are excluded from both.

Because bookings are editable, a past month's booking value can change. This is intended — the figure reflects what the bookings are actually worth now. The audit log preserves what it was before.

### 13.3 Booking creation

Mobile-first stepped form — executives will create bookings from a phone, and a single long form with repeating groups is unusable at 375 px.

```
Step 1  Agency      search saved agencies, or add new
Step 2  Guest       name, mobile, email, country
Step 3  Hotel       select from list or enter; confirmation no, BRN/VRN, source
Step 4  Stay        check-in, check-out  → nights auto-calculated
Step 5  Rooms       + Add room (unlimited): type, meal plan, rooms,
                    guests, price/night → subtotal auto
Step 6  Services    + Add extra service (unlimited): name, qty, unit price
Step 7  Review      totals, discount, notes, due date → Save draft / Confirm
```

Running total visible throughout. From an agency profile, **+ New booking** pre-fills step 1 and skips to step 2.

The form autosaves to a server-side draft row on every step change, per §9.10 — the draft is a `bookings` record with `bookingNumber = null`, never browser storage.

Confirming allocates the booking number. Editing afterwards uses the same form, pre-filled, with the guards in section 9.3.

### 13.4 Booking detail — the main working screen

This is where staff spend their time. It carries:

- **Header** — booking number, both status badges, agency and guest, hotel and dates
- **Money strip** — total value, paid, balance due, prominent and always visible
- **Rooms and services** — as entered, with subtotals
- **Payment history** — every instalment with date, method, reference, and who recorded it; reversals shown inline, struck through
- **Actions** — Record payment · Download PDF (full or confidential) · Edit · Mark completed · Cancel
- **Timeline** — the audit trail for this booking

**Record payment** is a small modal, not a page: amount, date, method, reference, notes. On save, `amountPaid` and `paymentStatus` recalculate immediately.


### 13.5 Scheduler

`/admin/schedule` — calendar with month, week, day, and list views. Check-ins and check-outs as distinct event types, colour-coded by payment status so unpaid upcoming arrivals stand out.

Each event shows agency, guest, hotel, rooms, guests, and payment status. Clicking opens the booking.

The scheduler reads `bookings.checkInDate` and `checkOutDate` directly. Because there is one booking per stay regardless of how many times it is billed, a stay appears exactly once — the failure the v2.0 model produced.

Dedicated list views at `/admin/schedule/check-ins` and `/check-outs`, filterable by today / tomorrow / this week / custom range, hotel, agency, payment status.

### 13.6 Search & filters

Search across: booking number, agency name, contact person, guest name, hotel name, confirmation number, BRN/VRN, phone.

Filter by: status, payment status, date range (booking / check-in / check-out), agency, hotel, city, created-by.

A **Drafts** filter lists draft bookings, with those untouched for 30 days marked as stale for manual deletion (§9.10). Nothing here deletes on a schedule.

### 13.7 Reports

**Monthly** — bookings, rooms, guests, completed, upcoming, cancelled, check-ins, check-outs, booking value, received, outstanding.

**Annual** — the same per month in a table, with year totals at the bottom.

Filterable by date range, agency, hotel, city, status, executive. CSV export.

### 13.8 Agency profile

Contact details, plus: total bookings, total rooms, total guests, total booking value, total received, outstanding, and recent bookings. **+ New booking** button.

### 13.9 Reminders

Linked to a booking or standalone. Title, description, due date/time, priority, assignee, status. Pending reminders due today surface on the dashboard.

### 13.10 Booking history

Every booking shows a timeline from the audit log: created, confirmed, edited (with before/after values), payment added, payment reversed, PDF generated (with style), status changed, completed, cancelled — each with user and timestamp.

This matters more than in a stored-invoice system. Since documents are regenerated rather than archived, the audit log is the **only** record of what a client was previously shown. Edits must log the full before/after, not just that a change occurred.

### 13.11 Review moderation

`/admin/reviews` is a moderation queue, not a passive list. Nothing a customer submits reaches the public site until someone approves it.

**Default view: pending.** The page opens on reviews awaiting a decision, newest first, so the queue is the first thing seen rather than something to navigate to. Tabs switch between Pending, Published, Hidden, and Spam, each showing a count.

**Each row shows** rating, name, country, the full comment, service used, locale, and submission date. The submitter's email is visible to staff here — it is the only place in the system it appears, and it never leaves the admin panel.

**Actions per review:**

| Action | Result |
|---|---|
| Approve | `pending` → `published`; appears on the public site |
| Reject | `pending` → `hidden`; never appears, kept for reference |
| Mark spam | any → `spam`; filtered out of all views by default |
| Unpublish | `published` → `hidden`; removes a live review |
| Restore | `hidden` → `published` |

Every transition stamps `reviewedAt` and `reviewedBy`, and writes to the audit log. **No review is ever hard-deleted** — if a decision turns out to be wrong, the record is still there to reverse.

Bulk approve and bulk mark-spam are available on the pending tab, since spam usually arrives in batches.

**Dashboard alert.** A pending count appears in the dashboard alert list — *"4 reviews awaiting approval"* — linking straight to the queue. Without this, reviews sit unapproved for weeks and genuine customers wonder why their review never appeared.

**Revalidation.** Approving or unpublishing triggers on-demand revalidation of the landing page and `/reviews` in both locales, so the change is live within seconds rather than waiting for the next deploy.

**Optional, worth considering:** an email notification to the company inbox when a review is submitted. Turns the queue from something you must remember to check into something that reaches you. Low cost — the Resend integration already exists for enquiries.

---

## 14. Public features

### 14.1 Reviews — moderated

**Changed from v1.1.** Reviews now enter as `pending` and appear publicly only after an admin approves them.

Rationale: instant publishing on an open endpoint reliably attracts spam and abuse within weeks, and on a site serving pilgrims the reputational cost of one offensive review appearing live is high. Moderation adds a short delay and removes the risk entirely.

Protections still apply at submission: Turnstile, honeypot, 3 submissions per IP hash per 24 hours, minimum 20-character comment, automatic `spam` flag for comments containing URLs. These reduce what reaches the queue; the queue catches the rest.

**Tell the submitter the truth.** The confirmation message must say the review will appear after a check — not imply it is already live. Otherwise the customer looks for their review, doesn't find it, and assumes it was deleted.

> Thank you — your review has been received and will appear on the site once we've reviewed it.

Do not show a fake preview of the review "as it will appear." An unapproved review is not published, and the interface should not suggest otherwise.

**Email is never rendered publicly** — not in HTML, not in JSON, not in structured data.

Approval triggers on-demand revalidation of the static pages.

### 14.2 Enquiries

Captures `audience` (pilgrim or agency) for triage. On submit: store, notify the company inbox via Resend, confirm to the user.

### 14.3 Contact actions

- **Primary:** WhatsApp deep link with pre-filled message naming the service
- **Secondary:** enquiry form

WhatsApp converts far better in this market; the form is a fallback and a record.

---

## 15. Security

| Area | Measure |
|---|---|
| Passwords | Better Auth hashing (scrypt) |
| Invite tokens | SHA-256 hashed at rest |
| Sessions | HTTP-only, Secure, SameSite=Lax |
| Server actions | Independent session + role check in every action |
| Confidential PDF | Type-level exclusion — price data never reaches the component |
| Input validation | Zod schemas shared client/server; server authoritative |
| SQL | Drizzle parameterised queries only |
| IP storage | Hashed with a secret salt |
| Headers | CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff |
| Admin indexing | `noindex, nofollow` on all `/admin/*` |
| Secrets | Wrangler secrets only |
| Auth errors | Generic — no user enumeration |
| Client bundles | No credentials or admin logic shipped to public routes |
| Audit log | Append-only; no UI path to edit or delete |

---

## 16. Backups

**Automated** — scheduled Worker, weekly (Monday 03:00 UTC). The cron trigger is added to `wrangler.jsonc` in Phase 16, when the handler exists — not in Phase 1. It exports `bookings`, `booking_rooms`, `booking_services`, `payments`, `agencies`, and `company_settings` as JSON to R2 under `backups/{YYYY-MM-DD}.json`. Retain 12 weeks.

**Manual** — monthly `wrangler d1 export nusukhelp-db --output=./backup.sql`, stored outside Cloudflare.

Restore must be documented and tested once before go-live. An untested backup is not a backup.

---

## 17. SEO

- All public pages statically generated and cache-served; the Worker runs only on cache miss and on revalidation
- Unique title and meta description per page per locale
- `hreflang` alternates (`en`, `ar`, `x-default`)
- Open Graph and Twitter cards
- JSON-LD: `TravelAgency` on landing, `Service` on reservation sections, `AggregateRating` on reviews (published only, no emails)
- `sitemap.xml` both locales; `robots.txt` disallowing `/admin`
- Canonical URLs everywhere
- WebP images with explicit dimensions

---

## 18. Build order

**Recommended: ship Release 1 publicly before starting Release 2.** The marketing site generates business and depends on nothing in the admin panel. Coupling them means the revenue-generating site sits finished and unpublished while the operational system is built.

### Release 1 — Public website

**Phase 1 — Foundation.** Next.js + TypeScript + Tailwind v4, OpenNext Cloudflare adapter, Wrangler config, D1 created, KV namespace created and bound for the incremental cache, R2 bucket bound, Drizzle configured. No cron trigger yet. Deploy hello-world to the custom domain. *Verify deployment before writing features.*

**Phase 2 — Public schema.** `reviews`, `enquiries`, `company_settings`. Migration applied.

**Phase 3 — Shell.** Root layout, next-intl, both locale layouts with RTL, fonts, design tokens, header with brand hierarchy, footer with disclaimer.

**Phase 4 — Landing.** `content/services.ts` typed source of truth. All nine sections. English first, then Arabic.

**Phase 5 — Detail pages.** `/al-haramain-reservation` with six anchors, `/b2b`, `/about`, `/contact`, legal.

**Phase 6 — Forms.** Turnstile, reviews API, enquiries API with audience split, notification email, WhatsApp CTAs.

**Phase 7 — Launch prep.** SEO metadata, sitemap, JSON-LD, security headers, Lighthouse, accessibility, RTL QA. **→ Go live.**

### Release 2 — Admin panel

**Phase 8 — Auth.** Better Auth with D1, login, middleware guard, invite flow, users settings, seed first admin.

**Phase 9 — Foundations.** Lookup tables with seed data, company settings page, agencies CRUD.

**Phase 10 — Bookings.** Full schema. Stepped mobile-first creation form. Rooms and services repeaters. Server-side calculation. Server-side draft autosave on step change. Confirm with atomic numbering. List with search and filters, including the Drafts filter with 30-day stale marking for manual deletion (§9.10). Detail screen. Edit with the section 9.3 guards. Cancel. Audit logging with before/after values.

**Phase 11 — Payments.** Unlimited instalments recorded against a booking. Derived `amountPaid` and `paymentStatus`, recalculated on payment *and* on booking edit. Reversal with reason. Payment history on the booking detail screen.

**Phase 12 — PDF.** Two type shapes, sanitiser, two separate document components, generation UI, amount-in-words, generation timestamp in the header. Web Share API delivery with download fallback (section 20.2). **Test on a real iPhone before moving on** — verify A4 dimensions, page breaks, and the share sheet. **Test the confidential style specifically for leaks** — inspect extracted PDF text, not just the visual render.

**Phase 13 — Scheduler.** Calendar with four views, check-in and check-out lists with filters, completion page and dashboard alert.

**Phase 14 — Dashboard & reports.** Aggregates, cards, alerts, charts, monthly and annual reports, CSV export. **Ends with the plan measurement in §2** — p95 CPU per request and D1 rows read per day, from `wrangler tail` and dashboard analytics. Recommend the Workers Paid plan only if p95 CPU > 8 ms or rows read > 3M/day, and only with the numbers attached.

**Phase 15 — Reminders & moderation.** Reminder CRUD, dashboard surfacing, review moderation queue, enquiry triage.

**Phase 16 — Hardening.** Backup handler plus the cron trigger added to `wrangler.jsonc`, restore test, permission audit across all roles, and the **full device QA matrix in section 20.6** — every cell, on real hardware. Mobile issues found here are expensive; catching them at each phase is cheaper than a single pass at the end.

---

## 19. Open items

**These block go-live, not the build.** Every phase proceeds with placeholders and swaps in the real asset when it lands. Nothing on this list is a reason to stop or to wait.

| # | Item | Owner | Blocks | Build against |
|---|---|---|---|---|
| 1 | Confirm brand naming with Saudi legal advisor | Client | Go-live | Current names as specified |
| 2 | Logo and wordmark | Client | Go-live | The prototype marks — final enough to build on |
| 3 | WhatsApp business number for public CTAs | Client | Go-live | Placeholder number, single constant |
| 4 | Legal name, CR number, full address, bank details | Client | Go-live | Placeholder values in `company_settings` |
| 5 | Arabic translation of all public copy | Client | Go-live | Real keys, English placeholder values |
| 6 | Photography for landing and service sections | Client | Go-live | Solid colour blocks at the correct aspect ratios |
| 7 | Confirm hotel list for initial seed | Client | Go-live | A sample seed list |
| 8 | Legal review of permit-assistance copy | Client | Go-live | The copy as drafted, per Appendix A |
| 9 | Verify current ZATCA VAT registration threshold | Client | Future | n/a — see §9.9 |

Two placeholder rules matter more than the rest:

**Copy.** Write everything in English first. The Arabic message files still get the **real keys** immediately, with English strings as their placeholder values — that way the `/ar` routes render, the RTL layout is testable throughout the build, and the translation drop is a values-only change with no structural surprises. Do not defer the Arabic files until the translation arrives.

**Imagery.** Where photography goes, use solid colour blocks at the **correct aspect ratios**. Wrong-ratio placeholders hide exactly the layout bugs the placeholder is there to expose.

---

## 20. Responsive & mobile

**The admin panel is a mobile product first.** Executives will create bookings, record payments, and generate PDFs from a phone far more often than from a desktop. Anything that only works well on a large screen is broken, not merely inconvenient.

Target devices: iPhone (Safari), Android (Chrome), iPad, laptop, desktop. Minimum supported width **360 px**.

### 20.1 Why the previous billing tool broke on iPhone — and why this one won't

The most likely causes of A4 output breaking on iOS:

| Approach | Failure on iOS |
|---|---|
| `window.print()` + `@media print` + `@page { size: A4 }` | iOS Safari largely ignores `@page` sizing and renders against the **viewport width**, not the paper. A 390 px phone layout gets stretched onto A4 — tables clip, columns collapse, page breaks land mid-row. |
| `html2canvas` + `jsPDF` | Rasterises the DOM to a bitmap. Text becomes blurry, file sizes balloon, and page breaks cut through table rows because the image has no concept of content structure. |
| Headless Chrome on the server | Not viable here — exceeds the Worker CPU budget entirely. |

**`@react-pdf/renderer` avoids all of this** because it does not use the browser's print or layout engine. It composes the PDF from primitives with page dimensions declared in code:

```tsx
<Page size="A4" style={styles.page}>   {/* 595.28 × 841.89 pt, always */}
```

The output is byte-identical whether generated on an iPhone, an Android tablet, or a desktop. The phone downloads a finished file; it never renders it. **No `window.print()` anywhere in this project.**

### 20.2 iOS-specific requirements for PDF delivery

Generating correctly is not the same as delivering correctly. iOS Safari needs explicit handling:

- **Do not rely on `<a download>` alone.** iOS Safari's support for the `download` attribute is unreliable and has historically opened the file in place instead of saving it. Implement a fallback that opens the blob URL, and always revoke the object URL afterwards to free memory.
- **Use the Web Share API as the primary mobile path.** `navigator.share({ files: [pdfFile] })` is well supported on iOS and is what the workflow actually wants — it hands the PDF straight to WhatsApp, Mail, or Files in one tap. Since agencies are contacted mostly over WhatsApp, this is the better mobile action, with download as the fallback.
- **Keep the document light.** PDF generation runs in the phone's browser. Older devices have limited memory. The logo must be an optimised PNG or SVG measured in kilobytes, not a multi-megabyte photo. No decorative images in the template.
- **Register fonts explicitly** with `Font.register()`. Do not depend on system fonts being present — output must not vary by device.
- **Set `wrap={false}` on table rows** so a room or service line never splits across a page boundary.
- **Test `Font.registerHyphenationCallback`** to disable automatic hyphenation, which otherwise breaks agency and hotel names awkwardly.
- **Verify on a real iPhone**, not the simulator. Memory behaviour and the share sheet differ.

### 20.3 Layout rules for the admin panel

**Tables become cards below `md`.** A ten-column booking list is unusable on a phone. Below the breakpoint each row renders as a card showing booking number, agency, dates, total, and both status badges. Horizontal scroll is a last resort, never the default, and never for a primary list.

**Tap targets minimum 44 × 44 px.** Apple's own guidance, and the practical floor for reliable one-handed use. This applies especially to the add and remove buttons on room and service rows, which are easy to make too small.

**Inputs at `font-size: 16px` or larger.** iOS Safari automatically zooms the page when focusing an input smaller than 16 px, and the zoom does not reverse cleanly. This single rule prevents a whole class of "the page jumped" complaints.

**Use `100dvh`, never `100vh`.** iOS Safari's toolbar shows and hides as you scroll; `100vh` refers to the larger height and causes content to sit under the toolbar.

**Respect safe-area insets.** Notched iPhones need `env(safe-area-inset-bottom)` padding on any sticky bottom bar, or the primary action sits under the home indicator.

**Sticky action bar on forms.** Save, Issue, and Add Payment stay reachable at the bottom of the viewport rather than requiring a scroll to the end of a long form. Include safe-area padding.

**Correct keyboards.** `inputMode="numeric"` on room counts, guest counts, and quantities; `inputMode="decimal"` on prices; `type="tel"` on phone fields; `type="email"` on email. Wrong keyboard means slower entry and more mistakes.

**Native date pickers.** `type="date"` for check-in and check-out. iOS and Android both provide good native pickers; a custom calendar component is worse on mobile and adds bundle weight.

**No hover-dependent affordances.** Anything revealed only on hover is invisible on touch. Actions must be visible, or behind an explicit menu button.

**Avoid `position: fixed` near focused inputs.** iOS repositions fixed elements unpredictably when the keyboard opens. Prefer `sticky` within a scroll container.

### 20.4 The booking form specifically

This is the hardest screen to get right on a phone: repeating room rows, repeating service rows, and a running total, all in one flow.

- The **stepped form** (section 13.3) exists for this reason — seven short screens instead of one long one.
- Each room and service row is a **collapsible card**, showing a one-line summary when collapsed (*"Double Room × 2 — SAR 1,200"*) and expanding to edit. Ten room types on one screen is otherwise unmanageable.
- The **running total stays pinned** so it's visible without scrolling.
- **Autosave drafts** on step change. Losing twenty minutes of entry to a dropped connection or a phone call is the failure mode that makes staff stop using the system.
- **Confirm before leaving** an unsaved step.

### 20.5 Public site

Standard responsive work, but two things need explicit attention:

- **RTL testing at every breakpoint.** Arabic layouts break differently on mobile than on desktop — verify both, on device.
- **The two-division signature band** (section 5) is designed as a horizontal split. On mobile it stacks vertically; the design must be planned for that from the start, not adapted afterwards.

### 20.6 QA matrix — required before go-live

Every row tested on a real device:

| Device | Public site | Booking list | Booking form | PDF (both styles) |
|---|---|---|---|---|
| iPhone (Safari) | ✓ | ✓ | ✓ | ✓ + share sheet |
| Android (Chrome) | ✓ | ✓ | ✓ | ✓ + share sheet |
| iPad (Safari) | ✓ | ✓ | ✓ | ✓ |
| Desktop (Chrome, Safari, Firefox) | ✓ | ✓ | ✓ | ✓ |

PDF verification means **opening the generated file and checking A4 dimensions, page breaks, and that no table row is split** — not just confirming a file downloaded. For the confidential style, additionally extract the PDF's text layer and confirm no figures appear.

---

## Appendix A — Copy rules

Compliance constraints, not style preferences.

**Permit assistance.** Present strictly as *assistance, guidance, and coordination*. Never imply permits can be obtained outside official channels, that approval is guaranteed, or that the company has privileged access to any official system. Preferred: "We guide you through the official permit process." Prohibited: "We get you Riyadh-ul-Jannah permits."

**Nusuk affiliation.** Never describe the company as official, authorised, approved, licensed by, or partnered with Nusuk or the Ministry of Hajj and Umrah. Disclaimer in the footer sitewide and in the consultation block.

**Invoice naming.** "INVOICE" only. Never "Tax Invoice." No VAT number, no VAT line.

**Guarantees.** No absolute promises about availability, pricing, or outcomes — "subject to availability" where relevant.

**Free consultation.** "Free" must be unqualified. If a condition ever attaches, the copy changes with it.

---

## Appendix B — Conventions

- TypeScript `strict: true`, no `any`
- Server Components by default; `'use client'` only where interactivity requires it
- Server Actions for all admin mutations
- Zod schemas in `src/lib/validation/`, shared client and server
- Database access only through `src/db/queries/` — no inline Drizzle in components
- kebab-case files, PascalCase components
- Every money value through `formatSAR()` — never raw interpolation
- Dates through `formatDate()` with `Asia/Riyadh`
- No `ml-*` / `mr-*` / `left-*` / `right-*` in any shared component
- All derived values (nights, totals, paymentStatus) computed server-side and never trusted from the client
