# nusukhelp.com

Bilingual marketing site (Nusuk Help) + private booking/invoicing back-office
(Al Haramain Reservation) for a Saudi Hajj & Umrah ground-handling company.

## Read before doing anything

- `docs/SPEC.md` — the full specification. **This is the source of truth.**
- `docs/prototype/` — SVG mockups. Open these before building any screen.

If this file and `docs/SPEC.md` disagree, the spec wins. If the spec is silent
on something, ask rather than inventing.

---

## Stack — do not substitute

```
Next.js 15 App Router + TypeScript (strict)
Tailwind CSS v4
Cloudflare Workers via @opennextjs/cloudflare
Cloudflare D1 (SQLite) + Drizzle ORM
Better Auth (invite-only)
next-intl (en / ar, public side only)
@react-pdf/renderer (browser-side, admin only)
Cloudflare Turnstile · Resend · Recharts · React Hook Form + Zod
```

**Rendering model.** Public pages are statically generated and cache-served from
Cloudflare's edge cache — the Worker runs only on a cache miss and on
revalidation, not on every request. Approving a review triggers on-demand
revalidation, so the OpenNext incremental cache needs a KV namespace bound in
`wrangler.jsonc` (`NEXT_INC_CACHE_KV`) from Phase 1. Do not describe the public
site as "never invoking a Worker" — that was wrong.

**Cron triggers land with their handlers.** `wrangler.jsonc` carries the D1, KV,
and R2 bindings from Phase 1, but no `triggers.crons` block until Phase 16, when
the backup handler actually exists.

**Never suggest or configure:**

- **Vercel** — its Hobby plan prohibits commercial use, and this is a commercial site.
- **Postgres / Supabase / Prisma** — the project runs on D1 with Drizzle.
- **Puppeteer / Browserless / any server-side PDF renderer** — exceeds the Worker CPU budget.
- **`window.print()` or html2canvas for PDF** — breaks A4 output on iOS Safari. This is
  the specific failure the client hit on a previous project.
- **localStorage / sessionStorage** for app state.

---

## The one architectural rule that matters most

**The booking is the only record. The invoice is a PDF view of it.**

There is no `invoices` table. There is no `/admin/invoices` route. A booking holds
its rooms, services, and total value; payments accumulate against it; the invoice
PDF is generated on demand from current state.

```
BOOKING  AHR-2026-00041          value 5,000
├── payment  1,000  ·  15 Aug
└── payment  4,000  ·  22 Aug     paid 5,000 · due 0
```

Download after the advance → *total 5,000 · paid 1,000 · due 4,000*
Download after settlement → *total 5,000 · paid 5,000 · due 0*

If you ever find yourself creating an invoice entity, stop — that model was tried
and rejected because instalment billing produced phantom duplicate bookings that
corrupted the scheduler and every count.

---

## Non-negotiables

**Money.** `integer` columns, whole Saudi Riyals, SAR only. No decimals, no minor
units, no multi-currency. Stored value equals displayed value. Never `REAL`, never
float arithmetic.

**Derived values are server-side only.** `nights`, `totalRooms`, `totalGuests`,
`roomsSubtotal`, `servicesSubtotal`, `totalValue`, `amountPaid`, `paymentStatus`
are all computed on the server and never trusted from the client. `paymentStatus`
recalculates on payment changes **and** on booking edits.

**Two status fields, never merged.** `status` (draft → confirmed → checked_in →
checked_out → completed, plus cancelled) and `paymentStatus` (unpaid →
partially_paid → paid). A booking can be confirmed and partially paid at once.

**Drafts live on the server, and nothing deletes them on a schedule.** A draft is a
`bookings` row with `bookingNumber = null`, autosaved on every step change — never
browser storage. Drafts untouched for 30 days surface under a **Drafts** filter in
`/admin/bookings` for a human to delete. No TTL purge, no cleanup cron: silently
deleting someone's half-finished work is worse than clutter. Apply the same
instinct anywhere else staff-entered data goes stale.

**Auth is checked twice.** Middleware guards `/admin/*`, and *every server action
independently re-checks session and role*. Middleware alone is not sufficient —
server actions are directly invocable.

**RTL.** In any shared component use logical properties only: `ms-*`, `me-*`,
`ps-*`, `pe-*`, `start-*`, `end-*`. Never `ml-*`, `mr-*`, `left-*`, `right-*`.

**Numbers are integers in the DB but formatted for display** — always through
`formatSAR()`, never raw interpolation. Dates through `formatDate()` with
`Asia/Riyadh`.

---

## The confidential PDF — read this carefully

Two PDF styles: full (all amounts) and confidential (zero amounts, for protecting
B2B rates from the end client).

**Do not build one component with a `showPrices` boolean. Do not pass the full
booking and skip rendering price fields.** Both leak — the data still reaches the
component and can surface through a refactor or the PDF text layer.

Instead:

1. Two types. `InvoiceConfidentialData` has **no price fields at all** — not
   optional, absent.
2. A sanitiser that builds the confidential object from an **explicit allow-list**.
   Never by deleting keys from the full object.
3. Two separate components: `InvoiceFullDocument.tsx` and
   `InvoiceConfidentialDocument.tsx`.

TypeScript then makes the leak a compile error rather than a review question.

Verify by extracting the PDF's text layer, not by looking at the render.

---

## Mobile is the primary admin surface

Staff create bookings from phones. Rules:

- Input `font-size` ≥ 16px, or iOS Safari zooms on focus and doesn't zoom back
- `100dvh`, never `100vh`
- Tap targets ≥ 44×44px
- `env(safe-area-inset-bottom)` on sticky bottom bars
- Tables become cards below `md` — horizontal scroll is a last resort
- `inputMode="numeric"` on counts, `"decimal"` on prices, `type="tel"` / `"email"`
- Native `type="date"` pickers, not a custom calendar
- Autosave the booking draft on every step change

PDF delivery on mobile: `navigator.share({ files })` as the primary path,
`<a download>` as fallback. iOS Safari's `download` attribute is unreliable.

---

## Compliance copy rules

- The document is **"INVOICE"**, never "Tax Invoice". No VAT number, no VAT line.
  The company is not VAT-registered.
- Permit services are **assistance and guidance** only. Never imply permits can be
  obtained outside official channels or that approval is guaranteed.
- Never describe the company as official, authorised, approved, or partnered with
  Nusuk or the Ministry of Hajj and Umrah. The footer disclaimer is required
  sitewide.
- "Free consultation" must stay unqualified.

---

## Conventions

- Server Components by default; `'use client'` only where interactivity requires it
- Server Actions for all admin mutations — not API routes
- DB access only through `src/db/queries/` — no inline Drizzle in components
- Zod schemas in `src/lib/validation/`, shared client and server; server authoritative
- kebab-case files, PascalCase components
- No `any`

---

## Brand

Logos in `public/logos/`. Placement is strict:

| Surface | Mark |
|---|---|
| Public header & footer, landing, about, contact | Nusuk Help |
| `/al-haramain-reservation` page body | Al Haramain |
| Footer division line | Al Haramain (small, gilt) |
| Admin panel — every screen | Al Haramain **only** |
| Invoice PDF — both styles | Al Haramain **only** |

The division mark never appears in the public site header.

```css
--ink:      #0C2923   --brass:  #B08E4F   /* gold on light */
--pine:     #0B3B31   --gilt:   #D4B467   /* gold on dark  */
--verdant:  #14614C   --mist:   #E7EFEA
--sand:     #FAF7F1   --slate:  #47554F
```

Fonts: Marcellus (display, headings only), IBM Plex Sans (body/UI),
IBM Plex Sans Arabic (`/ar` routes only).

Signature device: the ogee arch from the Nusuk Help dome. Hero panel mask and
two-division card outlines — nowhere else. Everything else stays flat: hairline
rules, 2px radius, no drop shadows.

---

## Build order

Ship Release 1 before starting Release 2. They share a repo and a database but
nothing else.

**Release 1 — public site:** foundation → public schema → shell → landing →
detail pages → forms → launch prep

**Release 2 — admin:** auth → lookup tables & agencies → bookings → payments →
PDF → scheduler → dashboard & reports → reminders & moderation → hardening

Each phase must end deployable. Verify the Cloudflare deployment works in Phase 1
before writing any feature.

---

## Commands

```bash
npm run dev              # local dev
npm run build            # production build
npx wrangler d1 migrations apply nusukhelp-db --local
npx wrangler d1 migrations apply nusukhelp-db --remote
npm run deploy           # opennextjs-cloudflare build && wrangler deploy
npx wrangler d1 export nusukhelp-db --output=./backup.sql
```

## When stuck

Cloudflare + OpenNext has more deployment friction than Vercel. If the adapter
fights you, say so rather than silently switching hosts. The fallback is a static
export of the public site on Cloudflare Pages with admin as a separate Worker —
not a move to Vercel. Note the cost of that fallback: a pure export drops
on-demand revalidation, so an approved review would not appear until the next
deploy. Raise it before taking that route.
