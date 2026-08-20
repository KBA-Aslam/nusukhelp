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

> **Status: complete as of Phase 1.** The zone is Active on Cloudflare
> nameservers (`fatima`/`ruben`), and `nusukhelp.com` and `www.nusukhelp.com`
> are both attached to the Worker as Custom Domains, serving over HTTPS.
>
> Step 4 initially failed: the apex carried the registrar's parked `A` records,
> and the Workers domains API rejects a hostname with externally managed DNS
> (code 100117). Deleting those two records cleared it. The zone has **no `MX`
> records at all**, so the mail warning below turned out not to apply.
>
> Wrangler now owns the proxied DNS records for both hostnames. Do not add `A`
> or `CNAME` records for them by hand — that recreates the same conflict, and
> because the trigger step is atomic it would break every subsequent deploy,
> not just the domain attachment.

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

### Phase 4 rulings — where the build departs from the prototypes

All nine sections above are built. The prototypes draw **eight** bands, and the
differences were resolved as follows rather than silently.

**1. The B2B highlight has no prototype.** `prototype/02-landing-desktop.svg`
folds it into service card 07 — the ink band under the services grid — and
heads the six-point section "Why agencies choose us", which is item 5's slot
with item 7's framing. §5 asks for both sections, so item 7 is built to the
spec and **its copy is new**: eyebrow, heading, body, CTA and six pillars, none
of them client-approved. This is the one part of the landing page that needs a
copy review before go-live, alongside §19 item 8. The pillars describe
capabilities rather than making promises, per Appendix A; the confidential
invoicing pillar refers to the no-amounts invoice style in §10.

It is built on the **mist** ground, not ink. Every other B2B moment on the page
is dark, and the reviews band directly below it is ink — two dark bands in
sequence read as one band with a seam.

**2. "Icon-led" is a brass hairline, not an icon.** §5 item 5 says icon-led;
the prototypes draw no icons anywhere on this page. Each card and point is led
by a short brass rule instead — 58px across a card's top-start corner, 34px
above a point. That is the §7 design language ("hairline rules, 2px radius, no
drop shadows"), and a commissioned icon set would be a second visual system
competing with the ogee arch. `content/services.ts` therefore carries no `icon`
field, and no `headOffice` field either: nothing renders it, and an unused
field is the kind of speculative flexibility this project has ruled against.
Both are one line per entry to add back if icons are ever commissioned.

**3. The arch stays closed to two surfaces.** §7 allows the ogee arch on the
hero mask and the two-division card outlines *and nowhere else*. The prototypes
exceed that twice — a filled arch as the coverage card icon, and a repeating
arch arcade behind the consultation band at 10% opacity. Neither is built. A
signature device stops being one when it appears on every card.

**4. One string per card, at full length.** The desktop and mobile prototypes
carry different service-card copy ("Haramain High-Speed Rail" vs "Haramain
Rail"). The desktop wording is the single source: it is also the correct name,
and two keys per card would mean translating everything twice and eventually
updating one and not the other. Verified in Chrome at a 390px viewport — every
full-length title sets on one line, summaries wrap to at most two, and neither
axis scrolls.

**5. Eyebrow colour depends on the ground.** §7's rule that every eyebrow uses
`--brass-ink` is a fix for brass-on-light failing AA. On the ink and pine bands
that same value is 1.9:1 — worse than the bug — so dark bands use `--gilt`,
which §7 measures at 7.8:1 and exempts. Encoded once in the section component;
no section chooses.

---

## 6. Internationalisation

- Locales: `en` (default), `ar`. Always-prefixed routing.
- Arabic layout sets `dir="rtl"` on `<html>`
- **All spacing uses logical properties** — `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`. Never `ml-*`, `mr-*`, `left-*`, `right-*` in shared components.
- Directional icons mirror with `rtl:-scale-x-100`
- **All user-visible copy is wrapped in `<Bidi>`** — see below
- Western Arabic numerals (`1234`) in both locales
- `hreflang` alternates on every page
- **Admin is English-only.** No locale prefix, `dir="ltr"` always.

### Bidirectional isolation — `<Bidi>`

Added in Phase 3, after the full stop of an English paragraph rendered at the
*start* of its last line on `/ar`:

```
.complete ground handling across Saudi Arabia
```

A block inside `<html dir="rtl">` establishes a bidi paragraph with an RTL base
direction. Latin text inside it forms strong LTR runs, but sentence-final
punctuation is a **neutral**, and the Unicode Bidirectional Algorithm resolves
neutrals at a paragraph's end to the *paragraph's* level rather than to the run
beside them. The period takes RTL and lands at the far left.

**Every piece of user-visible copy inside `/[locale]` goes through
`<Bidi>`** (`src/components/ui/bidi.tsx` — a `<bdi dir="auto">` wrapper). It is
inert on `/en` and on Arabic text, and load-bearing for Latin text on `/ar`.

Two things that do **not** work, recorded so they are not retried:

| Attempt | Why it fails |
|---|---|
| `unicode-bidi: isolate` on the block | A block already establishes its own bidi paragraph — there is no outer context to isolate from. The wrapper must be **inline**, around the run. |
| `direction: ltr` or `unicode-bidi: plaintext` on the paragraph | Fixes the punctuation but flips the base direction, so `text-align: start` resolves left. English copy then left-aligns inside a right-aligned page, hiding the alignment bugs `/ar` exists to expose. |

**This is not scaffolding for the placeholder period.** It does not come out
when open item 5 lands. Real Arabic copy still embeds permanent Latin islands
that need isolating: "Nusuk Help", "Al Haramain Reservation", "B2B", email
addresses, phone numbers such as `+966 57 679 9128` — where the leading `+` is
itself a neutral and migrates to the wrong end — and, on the admin side from
Phase 10, booking numbers like `AHR-2026-00041`.

### Fonts

Latin: **Marcellus** for display (headings only) and **IBM Plex Sans** for body
and UI. Arabic: **IBM Plex Sans Arabic**, loaded only on `/ar`.

Marcellus has no Arabic glyphs, so `/ar` takes IBM Plex Sans Arabic for display
as well as body — the swap is made once, on `<html>`, by overriding the two font
theme variables under `[lang="ar"]`, so no component branches on locale to pick
a family.

> **Corrected in Phase 3.** This line previously read *"Inter (Latin)"*, carried
> over from a draft written before the prototypes landed. It never matched §7,
> `CLAUDE.md` or `prototype/01-design-system.svg`, all three of which specify
> Marcellus + IBM Plex Sans. §7 is and was authoritative; Inter is not used
> anywhere in this project.

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

#### Contrast correction — brass as text on light

Added in Phase 3. `--brass` is **2.9:1** against `--sand`. That is fine for the
hairline rules, borders and ornament it was measured from, but it fails WCAG AA
for text — and the prototype also sets the tracked-capital eyebrows in it, at
11px. The quality floor below requires AA, so the two uses are separated:

```css
--brass:     #B08E4F;  /* rules, borders, ornament — unchanged, §7 token */
--brass-ink: #8A6A38;  /* brass darkened for text on light — 4.7:1 on sand */
```

`--brass-ink` is a derived value, not a ninth palette colour. It exists only so
an eyebrow or a small label can sit on `--sand` or `--mist` and still pass. The
darker tone is already in the design language — the *partially paid* badge in
`prototype/01-design-system.svg` uses `#8A6A22`.

No equivalent is needed on dark: `--gilt` on `--ink` is 7.8:1.

Every eyebrow from Phase 4 onward uses `text-brass-ink`. If an eyebrow renders
in `text-brass`, that is the bug.

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

### Texture amendment — Phase 4b

The landing page as first built read **sparse rather than considered**. "Spend
boldness once" was guidance against generic template design, not an argument for
austerity, and it was applied too literally. Four additions, all texture
*beneath* the signature rather than competing with it. Nothing in *Structure*
above is relaxed: no drop shadows, 2px radius, hairline rules, restrained
motion, AA contrast everywhere.

**1. Custom icon set — restored.** `content/services.ts` carries an `icon` field
again on services, why-choose-us points and coverage areas, and the glyphs
render. They are **drawn for this project**, not taken from an icon library: a
17-glyph monoline set in `components/ui/brand-icons.tsx`, ~28px, sharing the
ogee curve and the square-Kufic right angles already established — a
crescent-arch for hotels, a Kaaba silhouette for Makkah, a dome for Madinah, an
inverted ogee as the map pin. Brass on light grounds, gilt on dark, via
`currentColor`.

**Content ids are the icon keys.** There is no `icon` field on the content
entries. `BrandIconName` is derived as `ServiceId | WhyChooseUsId |
CoverageAreaId` and the glyph map is a total `Record` over that union, so adding
an entry to `SERVICES`, `WHY_CHOOSE_US` or `COVERAGE_AREAS` without drawing its
glyph **fails the build** rather than rendering a blank square. A separate field
would duplicate the id exactly and could drift from it. If a glyph ever needs to
be shared by two entries, that is the moment to add the field — not before.

**The per-card hairline is removed.** It was the lead device while there were no
icons; with a glyph on every card it reads as leftover scaffolding. Hairline
rules remain everywhere else they do real work — section dividers, the footer
rule, the contact cards, which have no icon.

> This reverses the Phase 4 ruling in §5 that dropped the `icon` field. That
> ruling was correct about not pre-paying for flexibility — the field was
> unrendered at the time — and is superseded now that the glyphs exist and
> render. The `headOffice` field stays dropped; nothing renders it.

**2. Hero photography.** The hero panel takes a photograph of Haram or Madinah
architecture behind the ogee mask, heavily tinted toward `--ink` so the display
type over it still clears AA.

**Licence route: Unsplash.** Chosen over Wikimedia Commons deliberately. The
Commons candidates are CC BY-SA 4.0, and tinting and cropping a photograph makes
a derivative that ShareAlike would require be released under a compatible
licence — a standing obligation on a commercial site, plus a credit line to
maintain. The Unsplash licence permits commercial use with no attribution and no
ShareAlike; its two prohibitions (reselling unmodified images, building a
competing stock service) do not apply here. **The client is sourcing the
photograph themselves** — do not pick one.

**Delivered in Phase 4c — §19 item 6 is closed.** The client supplied the
courtyard umbrellas at Al Masjid an-Nabawi at night, 1024 × 1536 portrait.
Cropped to 1024 × 1191 top-anchored so the umbrella fan's radial geometry sits
under the arch apex; the 345px dropped from the bottom was the marble
foreground, the weakest band in the frame. Served at 860 × 1000 WebP, 146 KB —
twice the 430px panel, `unoptimized` per §17. The Kufic lattice placeholder is
gone, as this section said it would be.

**The tint is 0.60 `--ink`, and it is not doing what it was briefed to do.** The
brief asked for a tint heavy enough to keep the heading and body at AA over the
image. Measured over all 860,000 pixels of the actual crop:

| Tint | White heading | `--onink` body | Mean luminance |
|---|---|---|---|
| 0.45 | 2.74 | 1.59 | 0.096 |
| 0.55 | 3.66 | 2.13 | 0.074 |
| **0.60** | **4.22** | **2.45** | **0.065** |
| 0.65 | 4.95 | 2.88 | 0.056 |
| 0.75 | 6.85 | 3.98 | 0.042 |

**No text sits over this panel in either layout** — on `lg` it is a separate
grid column, below `lg` it sits under the copy — so none of those ratios
currently binds anything. 0.60 was chosen to seat the photograph in the ink
band, not to rescue contrast.

If text is ever moved over the image, the numbers say what it costs: white
display type clears 4.5:1 at a tint of about 0.62, but `--onink` body type does
not reach 4.5:1 until roughly 0.78 — by which point the mean luminance is 0.04
and the photograph is effectively black. Body copy over this image means
switching it to white, not tinting harder.

**3. Geometric pattern — two permitted surfaces.** A tiling square-Kufic lattice
derived from the grid in the Al Haramain mark — not a stock arabesque — at an
opacity low enough that no text contrast is affected. Permitted on exactly two
surfaces:

| Surface | Ground | Pattern ink | Status |
|---|---|---|---|
| Behind the free-consultation block | `--pine` | `--gilt` | permanent |
| Behind the coverage section | `--sand` | `--brass` | permanent |
| Inside the hero arch mask | `--panel` | `--gilt` | **placeholder only** |

The third surface was added by decision, which is the process this section
requires — anywhere else still needs a decision, not a commit. It is
**temporary**: the lattice inside the arch is there so the empty panel reads as
intentional rather than unfinished, and it comes out when the photograph lands.
No text sits over any of the three.

The measured contrast for every text colour that sits over these grounds is
recorded in `components/ui/kufic-pattern.tsx`.

**4. Coverage cards.** Each city card carries its icon plus a low-opacity ogee
arch motif, so the four read as a set with individual identity rather than four
identical boxes.

### Phase 4c — brand assets

**The mark lost its English wordmark.** The artwork was redrawn as the dome and
its Arabic calligraphy alone (1770 × 1847, and 1763 × 1867 for the cream
variant — both changed from the old 1835 × 2059). Two consequences, both
handled:

- Intrinsic dimensions now live on `LOGO` in `lib/site.ts`, not hard-coded in
  the component. A stale pair reserves the wrong space and shifts the header as
  the image decodes.
- The lockup was retuned. With the wordmark gone the dome fills the whole box,
  so at an unchanged height it rendered visibly larger and crowded the Latin
  "NUSUK HELP" beside it. The box is a little shorter and the gap a little
  wider, since the mark's own type is no longer there to do that spacing.

`docs/prototype/logos/` and `public/logos/` are byte-identical — verified by
checksum, not by eye. Keep them that way.

**Favicons — the symbol only, on `--sand`.** A wordmark is a smudge at 16px, and
the artwork no longer has one. `favicon.ico` packs 16/32/48 as PNG-in-ICO;
`icon.png` (192) and `apple-icon.png` (180) use the App Router's file
conventions; `manifest.webmanifest` comes from `app/manifest.ts` and carries
192, 512 and a separate **maskable** 512 with a wider safe zone — Android crops
maskable icons to the launcher's shape, usually a circle, and the dome's finial
is the first thing lost. Filled backgrounds are `--sand`, never white: white
against `--sand` reads visibly cold. The `any`-purpose icons stay transparent.

> This reverses the Phase 4 ruling that removed the arch from the coverage
> cards. **The arch is now a three-surface device** — hero mask, two-division
> card outlines, coverage cards — where *Structure* above says "and appears
> nowhere else". That sentence is amended by this section, deliberately and
> with the trade-off understood: each further surface costs the arch some of
> its force as a signature. Three is the ceiling. A fourth needs a conversation
> about the design language, not a component change.

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

**The rule is enforced, not merely stated.** Two things keep it true:

- **`src/lib/time.ts` is the only clock.** `nowSeconds()` stamps every row and
  `fromSeconds()` reads one back for display. No `Date.now()` arithmetic appears
  anywhere else in `src/` — a unit conversion written out at a dozen call sites
  is one that will be wrong at one of them. Drizzle columns declared
  `{ mode: 'timestamp' }` (the six on the Better Auth tables) are the exception
  in TypeScript only: they take a `Date` and store the same Unix seconds.
- **`npm run check:timestamps:remote`** walks every table in the live database
  and fails if any `INTEGER` column named `*_at` (plus `window_start`) holds a
  value above 1e11 — the boundary between seconds and milliseconds, which is the
  year 5138 in one unit and March 1973 in the other. It discovers its columns
  from `sqlite_master` and `PRAGMA table_info` rather than from a list, so a
  table added in a later phase is checked without anyone remembering to add it.
  **Run it after any phase that adds a table.** If a new time column is named
  something other than `*_at`, add it to `EXTRA_COLUMNS` in the script — the
  failure mode of the naming convention is a check silently not happening.

> **This was a real defect, found in Phase 8 and fixed before Phase 9** (§19
> item 21, now closed). Phase 6 wrote a bare `Date.now()` in `insertReview` and
> `insertEnquiry`, so `reviews.created_at` and `enquiries.created_at` held
> milliseconds. Nothing looked wrong, because the two places that read those
> columns — the rate-limit comparison and `/reviews`'s
> `new Date(review.createdAt)` — treated them as milliseconds too. Phase 8 is
> what made it matter: `admin_invites`, `login_attempts` and Better Auth's four
> tables all store genuine seconds, leaving two different units in columns of
> the same name and the same type, one join away from being silently wrong.
> Migration `0002_timestamps_to_seconds.sql` converted the stored values and is
> idempotent — every statement is guarded on the value still looking like
> milliseconds.

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

### Deferred constraints — `reviews.reviewedBy`, `enquiries.handledBy`

The schema above is the **target** state. Two of its foreign keys cannot be
created in the phase that creates their table.

`reviews` and `enquiries` ship in Phase 2, on the public side. Their moderation
columns — `reviewedBy` and `handledBy` — point at `user.id`, but the `user`
table does not exist until Phase 8. D1 enforces foreign keys, and SQLite
resolves the parent table at write time rather than at `CREATE TABLE`: with the
parent missing, **any** insert into the child fails with
`no such table: main.user`, including inserts that leave the key `NULL`.
Shipping the constraint in Phase 2 would therefore break public review and
enquiry submission in Phase 6.

Both columns are consequently created as plain `text` in migration `0000`, with
no `.references()` in `src/db/schema.ts`. **Phase 8 adds the constraint**, once
`user` exists. SQLite cannot add a foreign key to an existing column via
`ALTER TABLE`, so the Phase 8 migration does it by table rebuild: create the new
table with the constraint, `INSERT … SELECT` the rows across, drop the old
table, rename, recreate the indexes. Both tables are small and the rebuild runs
before either has meaningful volume.

Until then the reference is enforced in application code only — the moderation
actions write an authenticated `user.id` or nothing.

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

A draft is a real row in `bookings` with `bookingNumber = null` and `status = 'draft'`, autosaved server-side on every step change and on a 1.5 s debounce while typing (§20.4). **No browser storage** — not `localStorage`, not `sessionStorage`. Losing twenty minutes of entry to a dropped connection is the failure mode that makes staff stop using the system, and a draft that only exists in one phone's browser is already lost.

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

### Phase 12 rulings — where the build departs from §10 and §20.2

Phase 12 is built: `lib/pdf/` (types, sanitiser, builder, amount-in-words,
mark), `components/pdf/` (theme and the two documents), the **Generate PDF**
card on the booking detail screen, and two test suites. **No migration** — the
invoice is a view of a booking, so this phase adds no table and no column.
Thirteen things needed deciding.

**1 — The shared fields are written out twice, and that is the ruling.**
`InvoiceFullData` and `InvoiceConfidentialData` are declared independently, with
~30 non-financial fields duplicated between them. Deriving one from the other —
`InvoiceFullData = InvoiceConfidentialData & Money` — would remove the
duplication and was rejected by the client for a specific reason: the
confidential type would then grow silently every time the *full* invoice gained
a field, and edits to that type are precisely the ones that must be rare and
scrutinised. It is meant to be read top to bottom as a complete inventory of
what may leave the building. **This is a deliberate exception to the project's
derive-rather-than-duplicate habit. Do not "fix" it.**

**2 — A literal `style` tag on each type, because structural typing leaves the
hole open.** TypeScript compares shapes, not names, so without it
`InvoiceFullData` would be assignable to `InvoiceConfidentialData` — it has
every field the confidential shape has and more — and
`const toConfidential = (b) => b` would compile clean while handing the
confidential document the whole priced object. `style: 'full'` and
`style: 'confidential'` make the two mutually unassignable, which leaves
`toConfidential` as the only way to obtain the confidential shape. The client
called this the crux of the design. The tag doubles as the word the screen uses
to name what it just produced.

**3 — The company header is split too.** Bank details are money, and §10 hides
them entirely on the confidential style, so `InvoiceCompanyConfidential` has no
IBAN field. One shared company object would have re-opened the hole one level
down.

**4 — `vatAmount` reaches neither document, and `dueDate` only the full one.**
The VAT column is structurally zero (§9.9) and a zero VAT line on a document
titled INVOICE is exactly the impression Appendix A forbids, so it is not
carried into the PDF layer at all. `dueDate` is a date rather than an amount,
but it exists solely to say when money is owed, and §10's list of what the
confidential style shows does not include it.

**5 — No number, no document.** `toInvoiceSource` returns `null` for a draft
(§9.1 allocates the number at confirmation) and for a database with no
`company_settings` row. The card then says which of the two it is and what to do
about it, rather than offering a control that would produce a document
identified by nothing.

**6 — The timestamp is stamped at the tap, not at page render.** The server
hands down `InvoiceSource` — everything except `generatedAt` — and the click
handler adds the clock reading. A screen opened at 14:30 and tapped at 15:10
must say 15:10, because that header line is the only thing distinguishing two
downloads of one booking number (§10). `formatStatementTimestamp()` in
`lib/format.ts` renders it in `Asia/Riyadh` with Latin digits, like every other
formatted value.

**7 — Helvetica, not the brand faces.** Marcellus and IBM Plex Sans would have
to be fetched and embedded at generation time, and a font fetch that fails on
hotel wifi either loses the download or substitutes silently — the second being
the failure mode this phase exists to eliminate. The identity is carried by the
mark, the palette and the layout. Embedding the brand faces is a small,
self-contained follow-up; **§19 item 23**.

**8 — `AHR_MARK_SRC` lives in `lib/pdf/mark.ts`, away from everything that
imports react-pdf.** `components/pdf/invoice-theme.ts` calls `StyleSheet.create`
at module scope, so importing that one string from there pulled the entire PDF
library into the booking screen's initial JavaScript and defeated the dynamic
import. Measured: the route went from **572 kB first load to 113 kB**, with
react-pdf now fetched on the tap that needs it. The mark itself is fetched
same-origin rather than inlined as a data URI — it is a 250 KB PNG.

**9 — The footer carries the VAT disclaimer and no page numbers.** A dynamic
`<Text render={…}>` child inside the fixed footer made react-pdf drop **the
entire footer block** from the output — silently, with no error and a
well-formed PDF. That was found by the text-layer test, not by looking at the
render. §10 does not ask for page numbers; the disclaimer is required, so the
disclaimer stayed and the numbers went.

**10 — Kebab-case filenames.** §10 names the components
`InvoiceFullDocument.tsx` and `InvoiceConfidentialDocument.tsx`; the files are
`invoice-full-document.tsx` and `invoice-confidential-document.tsx`, per
Appendix B. The *components* are named exactly as §10 says.

**11 — Generate and share are two taps, deliberately.** §10 requires an explicit
style choice every time, so neither radio is preselected and **Generate** stays
disabled until one is picked. Generating then produces a panel that scrolls
itself into view, is announced (`role="status"`), and says in words which style
was produced and what is in it — *"Confidential invoice ready — no amounts in
it"* or *"Full invoice ready — every amount is in it… do not send this to an end
client"* — before offering **Share**. The client's ruling: the filename carries
the style, but nobody reads a filename on a phone before hitting share, so the
answer has to be given after the fact, not only asked for beforehand. The second
tap also keeps `navigator.share` inside its own user gesture, which iOS Safari
requires. Changing the selection clears the panel, so a stale answer can never
sit above a newly chosen style. Failures say outright that nothing was produced,
and **nothing ever falls back to the other style**.

**12 — Verification is a text-layer test whose detector is proven to fire.**
`tests/invoice-pdf.test.tsx` renders real PDFs and extracts their text with
`unpdf`, because a figure can be white on white, clipped off the page or hidden
behind a box and still be selectable, copyable and greppable by the recipient.
The same detector runs over the full style, where it **must** find the amounts —
so a broken extractor turns the full-invoice assertion red instead of letting
the confidential one pass for the wrong reason. On the client's instruction the
negative case was also run by hand once: `pricePerNight` was temporarily added to
`BookingRoomConfidential`, carried through `toConfidential` and rendered in the
confidential document; the suite failed, naming `SAR` and `1,750`; the leak was
then removed. `tests/invoice-delivery.test.tsx` covers the other half — that the
style is named on screen after generation — and was likewise confirmed to fail
against a version of the panel that said only *"Your PDF is ready"*.

**13 — A cancelled booking still produces a document, and neither style says so.**
§10 is silent on this and inventing a watermark was not the build's call, so the
documents are unchanged and the card carries a line saying the booking is
cancelled and that the document will not mention it. Whether a cancelled booking
should refuse to produce an invoice at all is **§19 item 24**, for the client.

**14 — The panel's CSP had to gain `'wasm-unsafe-eval'`, and the suite had to
gain a browser.** Both documents are laid out by `yoga-layout`, which is
WebAssembly, and the admin policy permitted none — so the feature was
non-functional in every browser while 35 tests passed against it in jsdom and
Node, where no policy exists. The keyword is WebAssembly-only and `'unsafe-eval'`
was explicitly not added; the full diagnosis, the standing rule that anything
depending on browser policy needs a real-browser test, and the three assertions
in `tests/invoice-browser.test.ts` are recorded in §15. Ten of the phase's tests
now run in headless Chrome or assert the WebAssembly dependency directly.

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

**Phase 5 ruling — the public `/terms` page does not reproduce this section.**
These booking terms are snapshotted onto a booking at confirmation and are
editable in company settings, so a hard-coded copy of them on the marketing
site would drift from the authoritative text the first time an admin edited it
— and the drifted copy would be the one a customer read *before* booking, which
is the worst place for the two to disagree. `/terms` instead carries a
`bookingTerms` section stating that the terms in force are issued with the
confirmation and printed in full on the invoice, listing what they cover
(payment and confirmation, cancellation and refund, hotel policy, and changes
outside the company's control) and inviting the reader to ask for the current
version. One text, one place. If the public site ever needs to *display* these
terms, it must read them from `company_settings`, not restate them.

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

### Phase 8 rulings — where the build departs from the section above

Phase 8 is built, deployed and pinned to **Better Auth 1.7**. Seven things had
to be decided that this section did not settle, and one of them changes the §8
schema.

**1 — The auth tables are Better Auth 1.7's, not §8's listing.** §8 was written
before the version was pinned, and its four auth tables are a *subset* of what
the library actually writes. The Drizzle adapter builds every insert from Better
Auth's internal model and runs `checkMissingFields` first, which throws
`The field "x" does not exist in the "y" Drizzle schema` the moment a column it
wants is absent — so a subset is not a smaller schema, it is a broken one. The
additions, all in migration `0001_phase8_auth.sql`:

- `account.issuer` — 1.7 namespaces credentials by issuer (`local:credential`
  for a password account) and enforces a unique index on `(issuer, account_id)`.
- `account.access_token`, `refresh_token`, `id_token`,
  `access_token_expires_at`, `refresh_token_expires_at`, `scope` — unused; this
  project has no social sign-in and none is planned. They exist because the
  adapter writes the whole account model.
- `verification.updated_at` — required, with an `onUpdate` default.

The timestamp columns on these four tables are declared
`integer(..., { mode: 'timestamp' })` in Drizzle. **That is not a change of
storage format**: `timestamp` mode is an integer column holding Unix seconds,
exactly §8's convention, with a `Date` on the TypeScript side. Better Auth hands
the adapter `Date` objects, so a plain `integer()` would fail to bind. The
migration's SQL is identical either way.

**2 — Two tables §8 does not list.** `login_attempts` (see ruling 4) and, on
`admin_invites`, two columns beyond §8: `name`, so the invitation can address
the person and pre-fill their account, and `revoked_at`, so an invitation can be
withdrawn before it is used and so re-inviting the same address kills the
earlier link rather than leaving two live.

**3 — Better Auth's HTTP endpoints are not mounted, and accepting an invite
does not go through sign-up.** There is no `app/api/auth/[...all]/route.ts`.
Nothing needs one: §4 requires all admin mutations to be Server Actions, and
sign-in, sign-out and invite acceptance all call `auth.api.*` in process, with
the `nextCookies` plugin handling the cookies. No Better Auth client is created
anywhere, so nothing on the browser side addresses those URLs.

Mounting it would have a specific cost. The §12 login rate limit lives in the
sign-in server action, so a reachable `POST /api/auth/sign-in/email` would be a
second door to the same check without it — which makes the limit decorative.
The route was built, deployed, and then removed once that was noticed; the
first deploy of this phase had it, and the endpoint answered `401` to a bogus
sign-in with no limit applied.

Sign-up is separately closed by `emailAndPassword.disableSignUp`, at the library
level rather than the routing level, so it stays closed however it is reached —
including from this project's own code. Invite acceptance therefore writes the
account through Better Auth's internal adapter, hashing with `ctx.password.hash`
so the stored value is exactly what the sign-in verifier expects.

**4 — The login rate limit is this project's, not Better Auth's.** §12 asks for
five attempts per fifteen minutes *per IP hash*. Better Auth's built-in limiter
defaults to process memory — per-isolate in a Worker, and therefore not a limit
— and its database mode keys on the raw address, which §15 says this project
does not store. So it is switched off and replaced by `login_attempts`: one row
per salted hash, a fixed fifteen-minute window reset in place, cleared on a
successful sign-in. The row is reused rather than deleted, so no cleanup job has
to exist. Failing closed has one deliberate exception: with no
`CF-Connecting-IP` at all — which happens only off Cloudflare, in `next dev` —
the limit is skipped rather than applied to a shared bucket. A *missing*
`IP_HASH_SALT` on a real deploy refuses the sign-in, as everywhere else.

**5 — `/admin/*` gets a nonce-based CSP.** `next.config.ts` had recorded that
Phase 8 would change the calculation, and it has. The public site keeps
`script-src 'self' 'unsafe-inline'` because a nonce forces per-request rendering
and those pages are cache-served; the admin panel is authenticated and dynamic
already, and is the only surface where a stored-XSS bug reaches booking data. The
policy is generated per response in `middleware.ts` and set on both the request
(which is how Next stamps the nonce onto its own scripts) and the response.
`next.config.ts`'s header rules now exclude `/admin` from the static CSP, because
two `Content-Security-Policy` headers on one response are enforced as their
intersection — a policy nobody wrote.

**6 — Deactivation is checked in three places, and the last admin is
protected.** Deactivating an account revokes its session rows immediately; the
sign-in action refuses a deactivated user even with the right password; and
`getSessionUser` re-checks `isActive` on every request. Separately, the users
screen refuses to demote or deactivate the last active admin — nothing could
undo it, since there is no public sign-up and the seed script needs the database
credentials.

**7 — Roles live in `src/lib/roles.ts`, not in the schema file.** The list is
needed by the Drizzle schema, by the server-side guards, and by client
components that render a role badge or selector. Declaring it in `db/schema.ts`
would pull Drizzle into a browser bundle, so the dependency runs the other way:
`db/schema.ts` imports the list and re-exports it. The §12 permission table
itself is transcribed once, in `src/lib/permissions.ts`, and both the UI and the
server actions read from that one map.

There is no "forgot password" flow, deliberately. Recovery is an admin
re-inviting from `/admin/settings/users`, which is one code path instead of two
and leaves every account creation and recovery visible in `admin_invites`.

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

**The default view names the count.** *"1 unfinished draft — Resume"*, linking straight to the filter. Without it the filter is only reachable by opening a select and choosing an option whose existence you would have to already know about, and a draft nobody can find is a draft that was lost — the outcome §9.10 is written to prevent, reached through the interface rather than through a purge. Found in Phase 10's first device test: the autosave worked, the row was on the server, and the person who created it reported it as gone.

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

### Phase 9 rulings — where the build departs from §4 and §13.8

Phase 9 is built and deployed: the five lookup tables with their seed,
`/admin/settings/lists`, `/admin/settings/company`, and agencies. Five things
needed deciding.

**1 — Viewers can read agencies; only admin and executive can change one.** §12's
table names "Manage agencies" and says nothing about *reading* one, and the two
readings lead to different screens. The reading taken: `/admin/agencies` and the
profile require `viewPanel`, every mutation requires `manageAgencies`. A viewer
can already open a booking, and from Phase 10 every booking carries the agency's
name and contact details on its face — so hiding the agency list from a viewer
would conceal nothing they cannot already see, while making the panel
inconsistent about what "read-only" means. The create, edit and archive controls
are not rendered for a viewer *and* the actions behind them refuse one.

**2 — Two routes §4 does not list.** `/admin/agencies/new` and
`/admin/agencies/[id]/edit`. §4's map names the list and the profile; the Phase 9
brief asks for CRUD, which needs somewhere to do the C and the U. Dedicated
routes rather than modals, because §20 makes the panel a phone product first and
a modal holding eight fields on a phone is a full screen with a worse back
button.

**3 — The agency profile ships without its figures.** §13.8 asks for total
bookings, rooms, guests, value, received and outstanding, plus recent bookings
and a **+ New booking** button. Every one of those reads the `bookings` table,
which arrives in Phase 10. The screen therefore ships with the contact details
and an explicit placeholder where the totals go. The **+ New booking** button is
*absent* rather than disabled: it would point at `/admin/bookings/new`, which
does not exist, and a dead link in front of staff is worse than a button that
appears when it works — the same rule the sidebar follows in listing only routes
that exist.

**4 — Lookup entries are retired, never deleted.** Every list carries `isActive`
and no delete, and the button says *Retire*. From Phase 10 a booking snapshots
the room type name, meal plan code and hotel name it used, and the foreign keys
point back here, so deleting a room type to tidy a list would be deleting part of
a booking's history. Agencies get `isArchived` for the same reason. This is the
same instinct as deactivating rather than deleting a staff account.

**5 — A migration file may not use `/* … */` comments.** Learned the hard way:
`0004_seed_lookups.sql` applied cleanly with `wrangler d1 execute --file` and
failed under `wrangler d1 migrations apply --remote` with
`SQL code did not contain a statement [code: 7500]`. The applier chunks a file on
`--> statement-breakpoint` and rejects a chunk that opens with a block comment;
the drizzle-generated migrations only ever use `--`, which is why nothing had hit
it before. **Use `--` line comments in every hand-written migration.** The seed
was written to be idempotent (`INSERT OR IGNORE` throughout), so recovering meant
simply re-running it — it executed twice against the remote database and produced
exactly one copy of every row.

### Phase 10 rulings — where the build departs from §8, §13.4 and §20

Phase 10 is built and deployed: migration `0005_phase10_bookings.sql` (bookings,
booking_rooms, booking_services, payments, booking_counters, audit_log) applied
local and remote, the seven-step creation form, the list with its filters and
the Drafts view, the detail screen, edit with the §9.3 guards, cancel, draft
delete, and audit logging. Seven things needed deciding, and every one of them
turns on the same fact: **the booking is the only record, so there is nothing
downstream to reconcile and nothing upstream to check against.**

**1 — `payments` ships in Phase 10, a phase ahead of its UI.** §18 gives payments
to Phase 11, and this build creates the table anyway. The reason is §9.2's
requirement that `paymentStatus` recalculate on *both* sides — payments and
booking edits. Stubbing the sum until Phase 11 would mean writing the derivation
twice, once against a stub and once for real, which is precisely the duplication
the single-function design exists to prevent. `SUM` over no rows is `COALESCE`d
to 0, which is `unpaid`, which is the honest answer for a booking nobody has paid
for. Nothing writes to the table this phase.

**2 — `recalculateBooking` is the single writer of every derived column, and
that is the load-bearing decision of the phase.** `roomsSubtotal`,
`servicesSubtotal`, `totalValue`, `totalNights`, `totalRooms`, `totalGuests`,
`amountPaid` and `paymentStatus` are written in exactly one function
(`db/queries/bookings-calc.ts`), which reads stored rows and is called last by
every mutation. Phases 11 and 12 must call it rather than compute their own: a
payment action that updates a total itself, or a report that re-derives a status
in SQL "just for that query", is how two copies of a figure start disagreeing —
and the way they disagree is that a booking reads *paid* on one screen and
*partially paid* on another. The pure arithmetic lives in `lib/booking-math.ts`,
with no database imports, so the form's running total uses the same expressions
without pulling Drizzle into the browser bundle; the *authority* stays in the
query module.

**3 — The §9.3 warnings are enforced server-side, not in the browser.** An edit
that would drop `totalValue` below `amountPaid`, or that touches a completed
booking, returns `kind: 'confirm'` with the warning sentences and is re-submitted
with `acknowledged: true`. Warning only in the form would be a warning a direct
POST never sees, and §9.3 is explicit that neither case blocks the save —
sometimes a refund genuinely is owed. Only *cancelled* refuses outright.

**4 — The Drafts filter is `?status=draft`, not a separate view.** §13.6 asks for
a Drafts filter and §9.10 keeps drafts out of everything else; both are the same
query parameter, so there is one code path and no chance of two definitions of
"draft" drifting apart. Drafts untouched for 30 days carry a **Stale** badge.
Nothing on that screen deletes on a schedule, and nothing should be added that
does: the badge is an invitation to a person, not a countdown.

> **Amended after the first device test, and the amendment is the lesson.** The
> filter alone was not enough. A draft autosaved correctly on an Android phone,
> the browser was closed mid-form, and the booking list said nothing about it —
> so the row sat on the server while the person who created it reported their
> work as lost. Nothing had deleted anything; the interface had simply not
> mentioned it, which from the seat of the person using it is the same event.
> The list now shows the count and a **Resume** link on the default view, a
> draft opens back into the form in `create` mode with autosave still running,
> and its button says *Resume* rather than *Edit*. **Excluding drafts from a
> view is correct; leaving them unmentioned is not** — the same instinct that
> forbids the TTL purge, applied to what the screen says rather than to what the
> database does.

**5 — Record payment and Download PDF are absent from the detail screen, not
disabled.** §13.4 lists both among the actions; they belong to Phases 11 and 12.
This follows the Phase 9 ruling on the agency profile's **+ New booking**
button — a dead control in front of staff is worse than one that appears when it
works. Each section says plainly what is coming, so the screen reads unfinished
rather than broken. The same ruling now pays out in reverse: **+ New booking** is
live on the agency profile, pointing at `/admin/bookings/new?agency=<id>`, and
the §13.8 figures have replaced the Phase 9 placeholder. They exclude drafts and
cancelled bookings, matching §13.2 exactly — an agency total that does not
reconcile with the report is worse than no agency total.

**6 — A burned booking number beats a duplicate one.** Allocation is §9.1's
single atomic statement, and it runs *after* the booking has been saved, so
every failure mode leaves a gap in the year's sequence rather than two bookings
quoting `AHR-2026-00041`. A gap is a cosmetic problem someone may one day ask
about; a duplicate is a financial one, with two totals and no way to tell which
invoice a payment referred to. Confirming is likewise the last step of the action
and the redirect sits outside the `try`, so a confirmed booking is never reported
as a failure and re-confirmed.

**7 — Draft autosave runs on two triggers, one more than §20.4 asks for.** The
spec asks for a save on step change; the build also debounces 1.5 s after the
last keystroke, because a step is not a small unit — step 5 can hold four room
rows — and a save that only happens at the boundary loses everything typed into
whichever step someone was standing in when the phone call ended. That is the
same class of loss the autosave exists to prevent, and this project has already
had one report of it. Both triggers, plus Confirm, go through a single
`persistDraft` holding an **in-flight lock**: without it a debounce firing as
someone taps Confirm would call `createDraft` twice and leave two half-finished
bookings where the person made one — and the id is read from a ref rather than
from React state for the same reason, since state arriving a render late would
send `id: null` and produce a duplicate *numbered* booking.

**8 — Four calendar-date columns had to be added to the timestamp checker by
hand.** `check_in_date`, `check_out_date`, `booking_date` and `due_date` are days
rather than instants and none matches the `*_at` convention
`scripts/check-timestamps.mjs` discovers columns by, so all four are now in
`EXTRA_COLUMNS` — the case §8 warns about, where the failure mode is a check
silently not happening. It was verified the way §8 asks rather than assumed: a
millisecond value was written into `bookings.check_in_date` in the local
database, the checker was confirmed to name that column and exit non-zero, and
the row was removed. Both databases pass across 38 columns in 21 tables.

### Phase 11 rulings — where the build departs from §9.4 and §13.4

Phase 11 is built: `db/queries/payments.ts`, the two server actions, the record
panel and the payment history on the booking detail screen. **No migration** —
`payments` shipped in Phase 10 (ruling 1), so this phase adds no table and no
column. Six things needed deciding.

**1 — `recalculateBooking` stayed the only writer, which was the whole point of
shipping the table early.** Neither action touches `amountPaid` or
`paymentStatus`; both insert or update a payment row and then call the Phase 10
function, which sums stored rows. The shortcut this design refuses is
`amountPaid + amount` on insert, and the reason is not tidiness: a booking whose
paid figure was incremented in one place and derived in another reads *paid* on
the detail screen and *partially paid* on the list, and there is no way to tell
which one the client was shown.

**2 — Two warnings, neither of them blocking, where §9.4 asks for none.**
Paying more than the balance due and dating a payment in the future are both
things a person does by accident far more often than on purpose — and both are
occasionally exactly right, because clients genuinely overpay and transfers
genuinely land tomorrow. Refusing them would be wrong; letting them through
silently would be worse. So they take the shape §9.3 already established for
booking edits: the action answers `kind: 'confirm'` with the sentence to show,
and the same submission returns with `acknowledged: true`. The button changes
its own label to **Record it anyway**, so the second tap is a different act from
the first. Editing any field clears the warning, because acknowledging a
sentence about an amount no longer in the box is not acknowledgement.

**3 — The two §9.4 status rules are enforced in the action, not by the missing
button.** A payment cannot be recorded against a `draft` or a `cancelled`
booking. The detail screen also does not offer the panel in either state, but
that is a courtesy — the rule lives in `recordPaymentAction`, because a server
action is a POST that can be made without ever loading the page. The refusal on
a cancelled booking says what to do instead: *a refund is recorded by reversing
the original payment, which keeps both entries in the history.* A refusal that
does not name the right path is a refusal that gets worked around.

**4 — "A small modal, not a page" (§13.4) was built as a panel inside the
Payments card.** The requirement that carries the meaning is *not a page* —
staff must not lose the booking they are looking at to record money against it.
A true modal on a phone brings the problems §20 exists to avoid: scroll locking,
focus traps, and iOS repositioning a fixed overlay when the keyboard opens. The
panel opens in place, directly beneath the history it is about, and the money
strip stays on screen above it.

**5 — These two forms are controlled, where every other lifecycle form on the
screen is a plain `<form action>` that works without JavaScript.** React resets
an uncontrolled form once its action resolves, which would wipe the amount,
date, reference and notes at exactly the moment the answer says *look at this
again*. Holding the values in state is what makes "record it anyway" a second
tap rather than a second round of typing on a phone. It is a real cost — these
two controls need JavaScript where **Mark completed** and **Cancel** do not —
and it is paid for the acknowledge round trip specifically, not adopted as the
house style.

**6 — Reversal is idempotent, and a second attempt is not an error.** The update
carries `is_reversed = 0` in its `WHERE`, so a double tap or a retry after a
dropped connection cannot overwrite the first reversal's reason, user and
timestamp with the second one's. The action checks first as well, and when it
finds the payment already reversed it answers *"That payment was already
reversed"* as a **success**: from where the person is sitting the thing they
asked for is true, and reporting a failure would invite them to try again.

**7 — Device-tested, and the amendment is the lesson: an answer nobody sees is
not an answer.** The client ran the sequence against **AHR-2026-00001** and
reported two failures — a reversal that "did not recalculate" and an edit that
"saved silently". The audit trail says otherwise on both counts, and that is the
finding. The reversal logged `amountPaid 1,675 → 1,175`, `paid →
partially_paid`, exactly as designed; the edit logged nothing at all, because
the action correctly refused it and returned the §9.3 overpayment warning. **The
server was right twice and inaudible twice.**

> The warning panel rendered at the top of a seven-step form while **Save
> changes** sat in the sticky bar at the bottom of a phone screen. Nothing
> scrolled, nothing took focus, and the bar said nothing — so the tap appeared
> to do nothing, which reads as *saved*. Meanwhile the reversal's own
> confirmation sentence, *"Payment reversed. Paid is now SAR 1,175"*, was
> computed by the action and discarded by the form, leaving a reversal that had
> worked indistinguishable from one that had failed.
>
> Both are now one component. `components/admin/warning-panel.tsx` scrolls
> itself into view, takes focus, announces through `role="alert"`, and states
> **"Nothing has been saved yet"** — because the failure it replaces was someone
> believing the opposite. `PaymentsSection` owns a single status line that both
> recording and reversing write to, so the last thing to happen is the thing the
> screen describes; previously each component kept its own answer and a stale
> *"paid in full"* could sit under a money strip that said otherwise.
>
> This is the Phase 10 draft lesson again, one layer up. There the rule was
> *excluding data from a view is correct; leaving it unmentioned is not*. Here
> it is: **refusing a write is correct; refusing it silently is not.** A
> confirm-then-repeat design has exactly one hard requirement — that the person
> sees the sentence they are being asked to confirm — and meeting it is not the
> caller's business to remember.

**8 — The phase has automated tests, and they exist because nothing else could
have caught this.** `tsc`, `eslint` and `next build` all passed on the build
that failed the live test, because both defects were behaviour rather than
types. `npm test` now runs two suites:

- `tests/payments.test.ts` — the client's own sequence (1,675 booking; 500 in;
  2,000 warned; 1,175 to settle; the 500 reversed; the booking edited to 500)
  against **a real D1** through Wrangler's platform proxy, with the real
  migrations, the real query modules and the real server actions. It asserts the
  **stored** `amountPaid` and `paymentStatus` at every step, never the return
  value, and it asserts that a warning writes *nothing*. Persistence goes to a
  temporary directory, never `.wrangler`, so tests and `npm run dev` never share
  a database.
- `tests/warning-visibility.test.tsx` — that the answers reach the screen. Both
  assertions were confirmed to fail against the unfixed components before the
  fix was kept, which is the only way to know a test tests anything.

Phase 12 inherits both. The invoice PDF renders the figures this phase writes,
so the sequence test is what stops a PDF quietly disagreeing with the booking.

**§19 item 20 still stands** — no build phase can sign in to the panel, so device
QA of the §20.6 checks remains the client's to run, against **AHR-2026-00001**
(§19 item 22). Note that the live test left that booking with a fourth payment
of SAR 500 recorded after the reversal, which is why it currently reads *paid*
at 1,675; reversing it puts the booking back to 1,175 and is itself a one-tap
check of the fix.

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

**Added in Phase 4 — on-demand revalidation is not sufficient on its own.**
Prerendering happens during `next build`, where D1 is reached through
Wrangler's *local* proxy rather than production. A deploy from a machine whose
local database is empty therefore ships a landing page with an empty reviews
band, and with nothing but approval-triggered revalidation it would stay empty
until the next approval — which could be weeks after the deploy. The landing
page carries `export const revalidate = 3600` as the backstop: one Worker
invocation per hour per locale, and the band is never more than an hour stale.
On-demand revalidation on approval remains the primary mechanism and is what
makes a newly approved review appear promptly.

Two consequences worth remembering:

- **Never seed the local database with sample reviews.** Whatever is in local
  D1 at build time is baked into the deployed HTML until the first
  revalidation. Test rows must be deleted before building.
- **Every deploy is preceded by confirming local `reviews` is empty.** This is
  a required pre-deploy step, not a caution: a stale local row ships as real
  content on the live site and stays there until a revalidation replaces it.
  A review nobody wrote, presented as a customer's words, is a worse failure
  than an empty band.

  ```bash
  npx wrangler d1 execute nusukhelp-db --local \
    --command "SELECT COUNT(*) FROM reviews;"   # must be 0 before `npm run deploy`
  ```
- The public query lives in `src/db/queries/reviews.ts` and returns
  `PublicReview`, a type with **no email field at all** — the same
  allow-list discipline as the confidential invoice in §10, so a reviewer's
  address cannot reach a component that might print it.

### 14.2 Enquiries

Captures `audience` (pilgrim or agency) for triage. On submit: store, notify the company inbox via Resend, confirm to the user.

### 14.3 Contact actions

- **Primary:** WhatsApp deep link with pre-filled message naming the service
- **Secondary:** enquiry form

WhatsApp converts far better in this market; the form is a fallback and a record.

### Phase 6 rulings

Built: `/api/reviews`, `/api/enquiries`, both forms, the `/reviews` route, the
Resend notification, and a pre-filled WhatsApp message on every CTA. Secrets and
their failure modes are documented in `docs/SECRETS.md`.

**1. Every guard fails closed.** A missing `TURNSTILE_SECRET_KEY`, a missing
`IP_HASH_SALT`, an unreachable Cloudflare, a network error — each rejects the
submission. Nothing in either endpoint treats "could not check" as "check
passed", which is the usual way a CAPTCHA integration ends up decorative. The
same reflex governs the site key: with it unset the forms render a visible
"not configured" notice rather than submitting without a token.

**2. The honeypot answers `200`.** A bot that trips it gets a success response
and nothing is stored. An error would teach the next version of the script to
omit the field; a success never tells it anything at all.

**3. The URL scan flags, it does not discard.** A comment containing a link is
stored as `spam` rather than `pending` — stored, because §13 keeps a Spam tab
and hard-deletes nothing, so a false positive is recoverable by a human while a
silent drop is not. The pattern is deliberately loose for the same reason: the
cost of over-matching is a genuine review landing one tab away from where it
would otherwise be.

**4. Enquiries get no URL scan.** A `spam` status is a *review* concept: reviews
are published, so a link in one is an attempt to publish a link. An enquiry is a
private message, and "our site is example.com" is the most ordinary sentence in
a B2B first contact. Flagging it would train staff to ignore the flag.

**5. Rate limits are per table.** Three reviews per IP hash per 24 hours and
three enquiries, counted separately. Someone who has left three reviews can
still send an enquiry — the abuse the limit targets is repetition of one kind of
submission, and a customer doing both is not a bot. Reviews are counted across
**all** statuses including `spam`, or the most abusive submitters would have an
unlimited quota.

**6. The notification is best-effort and the enquiry is stored first.** A Resend
failure is logged and returns `ok` to the submitter, because the record is in
the database and §13's triage queue is what the company actually works from. An
error page would make a customer submit twice or give up, and the lead is
already captured.

**7. The confirmation says what §14.1 requires and nothing more.** *Received,
and will appear once we have reviewed it.* No "published", no preview of the
review as it will appear. The form is replaced by the confirmation rather than
reset beneath it, so there is no half-state where a submitted review still sits
in the inputs looking editable. The moderation note is also shown **before**
submitting — someone deciding whether to write a review should know it is
checked first.

**8. Email never leaves the server.** `PublicReview` has no email field,
`getPublishedReviewSummary` selects two aggregates and no columns, and
`StoredEnquiry` drops the IP hash before the row reaches the email template.
Each is the §10 allow-list discipline applied to a different leak: the type
makes it impossible rather than unlikely.

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

### Phase 7 — headers, as built and verified

Set in `next.config.ts` for documents and `public/_headers` for static assets,
and **confirmed with `curl` against the deployed site**, not inferred: CSP,
HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and
`Permissions-Policy` are present on HTML responses *including on an edge-cache
HIT*, and `nosniff` plus HSTS are present on `/_next/static/*` and `/og/*`.
`X-Robots-Tag: noindex, nofollow` is live on `/admin/*` ahead of the route tree
existing.

Two headers need the split explained. Next's `headers()` cannot reach static
assets at all — Cloudflare's asset layer answers those before the Worker is
invoked, which is what makes them free — so `public/_headers` carries the two
that mean something on a subresource. CSP and `X-Frame-Options` govern
documents, not the images a document pulls in, and are not repeated there.

**CSP carries `script-src 'unsafe-inline'`, deliberately.** The App Router
inlines the RSC payload as `self.__next_f.push(...)`, whose content changes per
page and per build. Hashes are unmaintainable; a nonce must be unique per
response, which means rendering every public page per request and giving up the
edge cache that §17 is built on. What remains is narrower than the directive's
name suggests: `script-src 'self'` still blocks off-origin script and `eval`,
and the site renders no user-supplied HTML — React escapes every string, and the
JSON-LD block escapes `<` explicitly. **Phase 8 must not inherit this
reasoning.** `/admin/*` is authenticated and rendered per request, so it can
carry a nonce cheaply and should; that is where a stored-XSS bug would cost
something. **Phase 6 must add `challenges.cloudflare.com` to `script-src` and
`frame-src`** for Turnstile — deliberately absent until something loads from it.

**HSTS is `max-age=63072000; includeSubDomains`, with no `preload`.**
Submitting to the browser preload list is close to irreversible and would bind
every future subdomain of `nusukhelp.com` to HTTPS, including one the client
might stand up on a service that does not do TLS. That is the client's call to
make knowingly, not something to ship inside a launch commit. It is on the
go-live checklist.

### Phase 7 — the contrast tokens were re-measured, and two failed

§7's quality floor requires WCAG AA. Phase 3 added `--color-brass-ink` because
`--color-brass` is 2.9:1 on sand and fails it for the tracked-capital eyebrows,
and recorded the replacement at 4.68:1. **That number was correct and is still
correct — it was simply measured against one ground.** The eyebrow also sets on
`--color-mist`, which is darker, and there it was **4.27:1: below AA.** So the
token introduced to fix the contrast bug was carrying it on every mist band,
which is roughly half the sections on the site. `--color-brass-ink` is now
`#846434` — same hue, one step darker, 5.10:1 on sand, 4.65:1 on mist, 5.53:1 on
white.

Two more failed in the same sweep. `--color-muted` (`#8a968f`, from the
prototype) was **2.87:1 on sand**, and it was setting the "last updated" line on
both legal pages; it is now `#5f6c66`. `--color-placeholder` (`#9aa8a2`) was
**2.6:1 on white** — a placeholder is text, and it would have shipped failing in
Phase 6's forms; it is now `#69776f`. Both clear 4.5:1 on sand, mist and white
at their original hues.

**The lesson is about method, not about the numbers.** A colour token is not a
pair, it is a token against every ground it renders on, and a single-ground
measurement cannot establish AA for a token the design system deliberately
reuses across grounds. Every text token on the site has now been measured
against every ground it can land on — the full matrix is in the Phase 7 report.
Re-run that matrix, not a spot check, whenever a token or a ground changes.

### Phase 12 — `'wasm-unsafe-eval'` on the admin policy, and nothing else

Phase 12 deployed with a working PDF pipeline that could not run in a browser.
The first tap failed identically on desktop and iPhone:

```
Aborted(CompileError: WebAssembly.instantiate(): Compiling or instantiating
WebAssembly module violates the following Content Security policy directive
because 'unsafe-eval' is not an allowed source of script in the following
Content Security Policy directive: script-src 'self' 'nonce-...'
'strict-dynamic')
```

**The cause is the layout engine, not font subsetting.**
`@react-pdf/renderer` → `@react-pdf/layout` → `yoga-layout`, Facebook's Flexbox
engine compiled with Emscripten. Every `<View>` and `<Text>` box in both
documents is measured by it, so there is no configuration that avoids it — it is
not an optional feature, it is how a page is laid out. `yoga-layout@3.2.1`
exports only `.` and `./load`; the asm.js entrypoints some versions ship are not
exported, and the WebAssembly is inlined as base64 rather than fetched as a
`.wasm` file. Avoiding it would mean patching a transitive dependency.

**The fix is one keyword, on the admin policy only.** The error message names
`'unsafe-eval'`, and taking it at its word would have been the wrong fix: that
keyword also re-opens `eval()`, `new Function()` and string timers across the
entire authenticated surface — the whole policy weakened to ship one feature.
`'wasm-unsafe-eval'` is a distinct CSP Level 3 keyword permitting WebAssembly
compilation and nothing else, and it survives `'strict-dynamic'` (which
suppresses allow-lists, not the eval keywords). The admin `script-src` is now:

```
script-src 'self' 'nonce-{nonce}' 'strict-dynamic' 'wasm-unsafe-eval'
```

Nothing else moved. `connect-src` stays `'self'` because the module never leaves
the bundle, and **the public policy in `next.config.ts` is untouched** — the
public site runs no WebAssembly. The policy now lives in `src/lib/admin-csp.ts`
as a pure function so the browser test can serve the exact header the middleware
sends rather than a copy of it.

**The operational cost belongs with the business, not in this section.**
`'wasm-unsafe-eval'` requires **iOS 16.4 / Safari 16.4 or newer**. On an older
staff phone, invoice generation fails outright — §19 item 25.

### The test gap this exposed, which matters more than the bug

Phase 12 shipped with **35 passing tests against a feature that was completely
non-functional in a browser**. Every one of them ran in jsdom or in Node, where
a Content-Security-Policy does not exist, so not one could have caught it. The
text-layer tests were right about what the PDF contains; they simply could not
see that no PDF was ever produced.

**Standing rule from this.** Any feature that depends on browser policy — WASM,
Web Workers, Service Workers, `navigator.share`, clipboard, storage partitioning,
anything CSP-sensitive — needs a **real-browser test**, not a jsdom one. jsdom
tests remain the right tool for component behaviour and for what a document
contains; they are structurally incapable of testing what a browser *permits*.

`tests/invoice-browser.test.ts` is the pattern: it bundles the real pipeline with
Vite, serves it from a local server under the exact `adminCsp()` header, and
drives headless Chrome through `playwright-core` (which uses the locally
installed Chrome — no browser download). It asserts three things:

1. a PDF is produced under the shipped policy;
2. `eval('1+1')` still throws under it — the assertion that keeps the fix honest,
   since a future "fix" reaching for `'unsafe-eval'` would generate PDFs happily
   and pass every other test in the repository;
3. under the policy **as it was before the fix**, generation fails with that
   CompileError — the negative control proving the suite detects the bug it was
   written for.

Two details worth keeping. The eval probe runs as page script at module load,
not through `page.evaluate()`: Chrome exempts debugger-initiated evaluation from
the eval restriction, so a probe called from the test reports `allowed: 2` under
a policy that forbids eval — a false negative on the one assertion that must not
have one. WebAssembly *is* policed on that path, which is why generation can stay
a callable function. And where no local Chrome exists the suite **skips loudly**,
with a console warning saying the pipeline is unverified on that machine, rather
than passing quietly.

`tests/wasm-dependency.test.ts` holds the other end: it spies on
`WebAssembly.instantiate`/`compile` and asserts a render still touches them, so
the policy keyword stays tied to its reason. If a future react-pdf drops
WebAssembly, that test fails, and the correct response is to **tighten the
policy**, not to relax the test.

### Phase 7 — accessibility fixes

Four, all structural rather than cosmetic. `<main>` and any `<Section>` with an
`id` take `tabIndex={-1}`: following a fragment scrolls the page but moves focus
only if the target can hold it, so without it "Skip to content" and the six
reservation anchors scrolled the page and left focus behind in the navigation.
The star rating moved from `aria-label` on a `<p>` to visually hidden text —
ARIA does not permit labelling a `generic` role, support is inconsistent, and
where it is dropped the rating went unannounced entirely because the glyphs
beside it are `aria-hidden`. The unlinked brand lockup lost its `aria-label` for
the same reason; the linked one keeps it, because a link needs an accessible
name.

---

## 16. Backups

> **Two prerequisites before this phase can start**, neither of which was in
> place at Phase 1:
>
> 1. **R2 must be enabled on the Cloudflare account.** It was not, and the API
>    returns error 10042 (*"Please enable R2 through the Cloudflare Dashboard"*)
>    for both bucket creation and any deploy carrying an R2 binding. Enabling it
>    requires a payment method on file even for the free 10 GB tier. Tracked as
>    §19 open item 10, owner Client.
> 2. **Wrangler must be re-authenticated with the `r2` scope.** The OAuth token
>    minted at Phase 1 has `d1`, `workers_kv`, and `workers*` but no `r2` scope
>    at all, so a fresh `wrangler login` is needed after R2 is switched on.
>
> Then: `npx wrangler r2 bucket create nusukhelp-backups`, uncomment the
> `r2_buckets` block in `wrangler.jsonc`, re-run `npm run cf-typegen` to pick up
> the `BACKUPS` binding in `worker-configuration.d.ts`, and
> deploy. Do not add the cron trigger before the handler exists.

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

**Image pipeline — decided in Phase 4, not before.** Next's default image
optimiser needs `sharp`, which does not run on Workers, so `next/image` on this
stack needs either Cloudflare Images or `unoptimized`. Phase 3 sidestepped the
question rather than pre-empting it: the three brand marks are rendered with
`next/image` and a per-image `unoptimized` prop, at roughly 3% of their native
raster size, where the optimiser has nothing to win anyway. Nothing global is
set. The decision lands in Phase 4, when real photography arrives and the
tradeoff is measurable — see §19 open item 6.

**Cloudflare Images is a paid add-on. Bring the client the cost before
configuring it — do not enable it and report the billing afterwards.** The
client's position, and the default assumption to work from: plain `unoptimized`
WebP at correct dimensions may well be enough at this site's traffic. So the
Phase 4 recommendation starts from the free path and only argues for the paid
one with measurements attached — the same standard §14 sets for the Workers Paid
plan, where an upgrade may be recommended only above a measured threshold and
only with the numbers. Serve correctly sized WebP by hand first; reach for the
product if and only if the evidence says the hand-rolled path is not enough.

### Phase 7 rulings

Everything in the list above is built and verified against the deployed site.
Five decisions were made along the way that are not obvious from the code.

**1. One source of `hreflang`, and it is the page head.** next-intl's middleware
emits alternates as a `Link` response header by default, and it was doing so —
producing a second set that disagreed with the head's in two ways. Its
`x-default` pointed at the unprefixed root while the head's points at `/en`, and
it is generated mechanically from whatever path was requested, so it advertised
`en`/`ar` alternates for URLs that do not exist. `alternateLinks: false` is now
set in `src/i18n/routing.ts`. The head and `sitemap.xml` are the only two
emitters, and they agree because both are built from `localeUrl` in
`src/lib/metadata.ts`.

**2. The sitemap has its own route list, and `/reviews` is not in it.**
`src/lib/public-routes.ts`. Deriving it from `PRIMARY_NAV` would have submitted
`/reviews` — a route Phase 6 builds — to Google as a 404; deriving it from the
footer would have listed `/b2b` four times. Navigation answers "where can a
reader go from here" and a sitemap answers "which documents exist"; those only
look like the same list. **Add `/reviews` in Phase 6, in the commit that builds
the page.**

**3. No `lastModified` in the sitemap.** The honest value is the last edit to a
page's copy and nothing in the repo tracks that per route. A build timestamp
would tell Google every page changed on every deploy, which teaches a crawler to
stop believing the file.

**4. Structured data states nothing the client has not supplied.** Google's
rich-result guidance rewards `address`, `priceRange` and `openingHours` on a
`LocalBusiness`, and all three are §19 open item 4 or worse — this company
quotes per booking, so a price band would be fiction. A missing property costs
an enhancement; a wrong one is a false statement about a business in a
machine-readable form that is harder to retract than a line of copy. They land
when item 4 does. `AggregateRating` is attached only when at least one review is
actually published, from a dedicated aggregate query over **all** published
reviews rather than a reduction over the three the landing band renders.

**5. Cloudflare prepends a managed `robots.txt` to ours, and it is left on.**
The zone has Cloudflare's managed `robots.txt` enabled, so the file served at
`/robots.txt` is Cloudflare's AI-crawler block (a `Content-Signal` line and
`Disallow: /` for Amazonbot, GPTBot, ClaudeBot, Google-Extended and others)
followed by ours. `User-agent: *` therefore appears twice. **This does not
weaken the `/admin` disallow**: RFC 9309 requires that "the matching groups'
rules MUST be combined into one group", and within the combined group the most
specific match wins — `Disallow: /admin` is 6 octets against `Allow: /`'s 1, so
`/admin/*` stays disallowed. The toggle is Cloudflare dashboard → Security
Settings → filter by Bot traffic → *"Set your preference to block training in
robots.txt"*. **Nothing was changed** — whether to let AI crawlers train on this
site is the client's decision, not a build one. §19 open item 14.

**6. The Open Graph card is a committed static asset**, generated by
`scripts/generate-og-image.js` and not by `next/og` at request time — a WASM
renderer inside an 8 ms CPU budget (§2), for an image that changes only when the
brand does. One card serves both locales: the mark and the "NUSUK HELP" wordmark
are Latin islands in both, and the single English descriptor line is consistent
with the rest of `/ar` while §19 item 5 is open. **An Arabic card is a second run
of that script once the translation lands.**

---

## 18. Build order

**Recommended: ship Release 1 publicly before starting Release 2.** The marketing site generates business and depends on nothing in the admin panel. Coupling them means the revenue-generating site sits finished and unpublished while the operational system is built.

### Release 1 — Public website

**Phase 1 — Foundation.** Next.js + TypeScript + Tailwind v4, OpenNext Cloudflare adapter, Wrangler config, D1 created, KV namespace created and bound for the incremental cache, R2 bucket bound, Drizzle configured. No cron trigger yet. Deploy hello-world to the custom domain. *Verify deployment before writing features.*

**Phase 2 — Public schema.** `reviews`, `enquiries`, `company_settings`. Migration applied. The two moderation foreign keys are deferred to Phase 8 — see §8, *Deferred constraints*.

**Phase 3 — Shell.** Root layout, next-intl, both locale layouts with RTL, fonts, design tokens, header with brand hierarchy, footer with disclaimer.

**Phase 4 — Landing.** `content/services.ts` typed source of truth. All nine sections. English first, then Arabic.

**Phase 5 — Detail pages.** `/al-haramain-reservation` with six anchors, `/b2b`, `/about`, `/contact`, legal.

**Phase 6 — Forms.** Turnstile, reviews API, enquiries API with audience split, notification email, WhatsApp CTAs. **Built after Phase 7**, which had shipped ahead of it. The three Phase 7 carry-overs are done: the `/reviews` route exists, it is in `PUBLIC_ROUTES` and therefore in the sitemap, and `challenges.cloudflare.com` is in `script-src` and `frame-src`. Rulings in §14.

**Phase 7 — Launch prep.** SEO metadata, sitemap, JSON-LD, security headers, Lighthouse, accessibility, RTL QA. **Built and deployed, tagged `phase-7-seo`.** It shipped before Phase 6, so it was deliberately not tagged `v1.0-public`. With Phase 6 now built, Release 1 is code-complete and carries the tag **`release-1-complete`**; `v1.0-public` stays reserved for the go-live commit (§19, *The go-live tag is reserved*). What remains is the open items marked *Go-live* in §19 — chiefly the Turnstile secret and the Resend domain in `docs/SECRETS.md`.

### Release 2 — Admin panel

**Phase 8 — Auth.** Better Auth with D1, login, middleware guard, invite flow, users settings, seed first admin. Also rebuilds `reviews` and `enquiries` to add the two moderation foreign keys deferred out of Phase 2 (§8, *Deferred constraints*). **Built and deployed.** Migration `0001_phase8_auth.sql` is applied local and remote, and both foreign keys are live. The departures from §8 and §12 that the build forced — chiefly Better Auth 1.7's own column set, this project's own login rate limiter, and a nonce-based CSP for `/admin/*` — are recorded as *Phase 8 rulings* in §12.

**Phase 9 — Foundations.** Lookup tables with seed data, company settings page, agencies CRUD. **Built and deployed.** Migrations `0003` (schema) and `0004` (seed) are applied local and remote; the seed is separate from the schema because the lists are the client's to edit at runtime, and it is idempotent so re-running it cannot overwrite their work. The departures from §4 and §13.8 — chiefly viewer read access to agencies, the two CRUD routes, and the agency profile shipping without the figures that need `bookings` — are recorded as *Phase 9 rulings* in §13.

**Phase 10 — Bookings.** Full schema. Stepped mobile-first creation form. Rooms and services repeaters. Server-side calculation. Server-side draft autosave on step change. Confirm with atomic numbering. List with search and filters, including the Drafts filter with 30-day stale marking for manual deletion (§9.10). Detail screen. Edit with the section 9.3 guards. Cancel. Audit logging with before/after values. **Built and deployed.** Migration `0005_phase10_bookings.sql` is applied local and remote and creates six tables — `bookings`, `booking_rooms`, `booking_services`, `payments`, `booking_counters`, `audit_log`. `payments` deliberately arrives a phase ahead of its UI so that the derivation has one implementation rather than two; the departures from §8, §13.4 and §20 are recorded as *Phase 10 rulings* in §13. **Device-tested on Android**, which found one defect and one addition: the Drafts filter was not discoverable enough to count as the work being findable (ruling 4), and autosave now runs on a typing debounce as well as on step change (ruling 7). The build itself still cannot sign in to check a screen — accounts are the client's to create (§19 item 20).

**Phase 11 — Payments.** Unlimited instalments recorded against a booking. Derived `amountPaid` and `paymentStatus`, recalculated on payment *and* on booking edit. Reversal with reason. Payment history on the booking detail screen. The table and the derivation already exist (Phase 10 ruling 1); **this phase must call `recalculateBooking` rather than compute either figure itself** (ruling 2). **Built.** No migration — the table shipped a phase early, so there was nothing to add. Recording warns without blocking on an overpayment or a future date, reversal is admin-only and idempotent, and both are logged against the booking so they appear in the one timeline staff read. The departures from §9.4 and §13.4 are recorded as *Phase 11 rulings* in §13. **Device-tested against AHR-2026-00001**, which found two defects — both of them the same defect: the server answered correctly and the answer never reached the screen (ruling 7). The phase now carries the project's first automated tests, running the full money sequence against a real D1 and asserting the stored derived values at every step (ruling 8). Remaining device QA is the client's (§19 items 20 and 22).

**Phase 12 — PDF.** Two type shapes, sanitiser, two separate document components, generation UI, amount-in-words, generation timestamp in the header. Web Share API delivery with download fallback (section 20.2). **Test on a real iPhone before moving on** — verify A4 dimensions, page breaks, and the share sheet. **Test the confidential style specifically for leaks** — inspect extracted PDF text, not just the visual render. **Built and deployed.** No migration — the invoice is a view of a booking. Two independent types with the confidential shape carrying no price field at all, a literal `style` tag closing the structural-typing hole, an allow-list sanitiser, two separate documents, and a generation card that names the style it produced *after the fact*. The departures from §10 and §20.2 are recorded as *Phase 12 rulings* in §10. Verified by extracting the rendered PDF's text layer — and the leak detector was proven to fire, both automatically against the full style and by hand against a temporarily leaked confidential one. **Device QA on a real iPhone — A4 dimensions on paper, page breaks and the share sheet — remains the client's** (§19 items 20 and 22).

**Phase 13 — Scheduler.** Calendar with four views, check-in and check-out lists with filters, completion page and dashboard alert.

**Phase 14 — Dashboard & reports.** Aggregates, cards, alerts, charts, monthly and annual reports, CSV export. **Ends with the plan measurement in §2** — p95 CPU per request and D1 rows read per day, from `wrangler tail` and dashboard analytics. Recommend the Workers Paid plan only if p95 CPU > 8 ms or rows read > 3M/day, and only with the numbers attached.

**Phase 15 — Reminders & moderation.** Reminder CRUD, dashboard surfacing, review moderation queue, enquiry triage.

**Phase 16 — Hardening.** Backup handler plus the cron trigger added to `wrangler.jsonc`, restore test, permission audit across all roles, and the **full device QA matrix in section 20.6** — every cell, on real hardware. Mobile issues found here are expensive; catching them at each phase is cheaper than a single pass at the end.

---

## 19. Open items

**These block go-live, not the build.** Every phase proceeds with placeholders and swaps in the real asset when it lands. Nothing on this list is a reason to stop or to wait.

| # | Item | Owner | Blocks | Build against |
|---|---|---|---|---|
| 1 | Confirm brand naming with Saudi legal advisor — **and the affiliation disclaimer, both language versions together** | Client | Go-live | Current names as specified; disclaimer as drafted in `en.json` and `ar.json` |
| 2 | Logo and wordmark | Client | Go-live | The prototype marks — final enough to build on |
| 3 | WhatsApp business number for public CTAs | Client | Go-live | Placeholder number, single constant |
| 4 | Legal name, CR number, full address, bank details | Client | Go-live | Placeholder values in `company_settings` |
| 5 | Arabic translation of all public copy | Client | Go-live | Real keys, English placeholder values |
| ~~6~~ | ~~Photography for landing and service sections~~ | Client | — | **Done in Phase 4c.** Hero image supplied and in place; see §7. Service-section photography, if any, still uses colour blocks at the correct ratio. |
| 7 | Confirm hotel list for initial seed | Client | Go-live | A sample seed list |
| 8 | Legal review of permit-assistance copy | Client | Go-live | The copy as drafted, per Appendix A |
| 9 | Verify current ZATCA VAT registration threshold | Client | Future | n/a — see §9.9 |
| 10 | Enable R2 on the Cloudflare account (needs a payment method on file, free 10 GB tier) | Client | **Phase 16** | Nothing — the `BACKUPS` binding stays commented out in `wrangler.jsonc` until then |
| ~~11~~ | ~~Delete the registrar's parked `A` records on the `nusukhelp.com` apex in Cloudflare DNS~~ | Client | — | **Done in Phase 1.** Records deleted, both custom domains attached and serving over HTTPS. See §3. |
| 12 | Legal review of `/privacy` and `/terms` | Client | Go-live | The drafts written in Phase 5 — starting points, not finished documents |
| ~~13~~ | ~~Phase 6 is unbuilt~~ | Build | — | **Done.** Forms, Turnstile, both endpoints and `/reviews` shipped; the navigation links now resolve. See §14 |
| ~~17~~ | ~~Create the Turnstile widget, set the site key and the three secrets~~ | Client | — | **Done and verified live.** The site key is in the served HTML and the widget passes on `nusukhelp.com`. The first secret set was the wrong value — the Worker logged `400 invalid-input-secret` and rejected every submission — and the replacement verifies: a bogus token now returns `invalid-input-response`, which is the guard working rather than a misconfiguration. Both forms submit successfully through a real browser |
| ~~18~~ | ~~Verify **`send.nusukhelp.com`** as a sending domain in Resend~~ | Client | — | **Done and verified end to end.** A live enquiry through `/contact` returned `200` with no `enquiry notification failed:` in the Worker log, and the notification arrived in the inbox. The subdomain rule stands for every future sender, Phase 8’s invite emails included |
| 14 | Decide on Cloudflare's managed `robots.txt` — it prepends an AI-crawler block ahead of ours (see §17 below) | Client | Go-live | The combined file as served today; our `/admin` disallow is effective either way |
| 15 | Decide on HSTS `preload` — a near-irreversible commitment for every future subdomain (§15) | Client | Go-live | `max-age=63072000; includeSubDomains`, no `preload` |
| ~~16~~ | ~~Turn `workers_dev` off in `wrangler.jsonc`~~ | Build | — | **Done.** `workers_dev: false` is deployed. `nusukhelp.lazykba.workers.dev` now returns 404 — the hostname still resolves on Cloudflare's shared addresses, but no Worker is attached — while both custom domains serve 200. The preview URL was how every phase got verified over HTTPS, which is why it deliberately outlived Phase 7 |
| ~~21~~ | ~~Normalise `reviews.created_at` and `enquiries.created_at` to Unix **seconds**~~ | Build | — | **Done, as a standalone change between Phase 8 and Phase 9.** Found in Phase 8 while inspecting live data and deliberately left out of that commit — migrating a live table holding a real customer review is not something to bundle into an unrelated phase. The client ruled it a live data-integrity bug that gets more expensive with every phase that queries by date, and fixed it on its own. Migration `0002` converted the stored values (guarded, idempotent); `src/lib/time.ts` is now the only clock and no `Date.now()` arithmetic remains in `src/`; `npm run check:timestamps:*` asserts the invariant across **every** table, discovering its columns from the database rather than a list. The checker was confirmed to fail on the real defect before the migration was applied, and to pass after. The one affected row — a genuine pending review — kept its value and now reads `2026-08-19 00:53:19` UTC |
| 20 | ~~Seed the first admin account~~ — done; **one account now exists remotely**. What remains is that nobody but the client holds a panel credential, so no build phase can verify an admin screen on a real device. Phase 10 shipped unverified visually for this reason | Client | **Device QA of every admin phase** | Nothing. Either the client runs the §20.6 checks on the live panel themselves, or they create an account for the build to use — the values are theirs to type either way (docs/SECRETS.md, RUNBOOK §1.4) |
| ~~19~~ | ~~End-to-end verification of both public forms on the live site~~ | Build | — | **Done.** A review submitted through the real form stored as `pending`, was absent from a render that had seen the row, appeared only after approval — `22:26:44Z` approved, `23:22:01Z` visible, the ISR window turning `HIT → STALE → HIT` — and carried no reviewer email in HTML, JSON or structured data. An enquiry stored and notified. Both test rows deleted; the guards fail closed. Tagged `release-1-complete` |
| 22 | Delete the test booking **AHR-2026-00001** from remote D1 and reset the 2026 row in `booking_counters` | Build | Go-live | Nothing — the booking stays on purpose. It is the record Phases 11 and 12 are verified against, and a real one beats an invented one |
| 23 | Decide whether the invoice PDF should embed the brand faces (Marcellus + IBM Plex Sans) instead of Helvetica | Client | Future | Helvetica, with the identity carried by the mark, palette and layout — see §10, Phase 12 ruling 7 |
| 24 | Decide whether a **cancelled** booking should still produce an invoice PDF, and whether the document should say so | Client | Go-live | It produces both styles, unchanged; the screen says the booking is cancelled and that the document does not — see §10, Phase 12 ruling 13 |
| 25 | **Confirm every staff phone runs iOS 16.4 or newer.** Invoice PDF generation needs `'wasm-unsafe-eval'` in the admin CSP (§15), which Safari added in 16.4 — on an older iPhone, generating either style **fails outright**, with no fallback. This is an operational constraint on the business, not a technical footnote | Client | **Phase 12 in use** | Nothing. The policy is deployed; what is unknown is the devices it has to run on |

Item 1 now covers two things, and they go to the advisor **together**. The
affiliation disclaimer is a legal statement, not marketing copy, and it is the
standing mitigation for what §7 calls the largest business risk in the project.
An English-only version protects nobody reading Arabic, so `footer.disclaimer`
is the one message key that is genuinely translated rather than placeholdered
(§19 item 5 notwithstanding — see `src/messages/README.md`). Both language
versions must be reviewed as a pair: an Arabic rendering that is weaker than the
English one leaves the Arabic audience with a disclaimer that does not disclaim.
It also means the disclaimer must **not** be quietly overwritten when the bulk
translation drop lands.

Item 12 is new in Phase 5 and needs its scope stated precisely, because the two
pages are not equally provisional. Both are **drafted, not reviewed**: the
liability, governing-law, retention and data-rights wording is a lawyer's to
write, and nothing in either page should be treated as settled. But one part of
`/privacy` is not a drafting question at all — the `collect` and `use` sections
describe what the site actually does, and they were written from
`db/schema.ts` and `db/queries/reviews.ts` rather than from a template. A
published review shows the name, country, rating and comment the reviewer gave,
and never the email address, because `PublicReview` has no email field (§14.1).
That description must stay accurate from day one and must be updated whenever
the schema or the queries change, regardless of where the legal review has got
to. A wrong description of behaviour is a misrepresentation whoever reviews the
wording afterwards.

Item 8 (legal review of the permit-assistance copy) and item 12 go to the same
advisor and should go together: `/terms` now carries a `permits` section that
restates Appendix A in the binding document, so the two texts have to agree.

Item 10 is the exception to the framing above: it blocks build work, not just
go-live. R2 was not enabled when Phase 1 shipped, and a deploy carrying an
`r2_buckets` binding for a bucket that does not exist fails outright — so the
binding is commented out rather than present. Nothing writes to R2 before
Phase 16, so the deferral is free until then. See §16 for the full prerequisite.

Item 11 is closed. It is left in the table rather than deleted because the
failure mode is worth remembering: the Workers domains API will not take a
hostname that already has externally managed DNS records (code 100117), and
because the trigger step is atomic, that single conflict aborted the entire
deploy — `www` and the `workers.dev` preview URL included, not just the apex.
Deleting the two parked `A` records was the whole fix. Wrangler now owns the
records for both hostnames; adding one by hand would reproduce the same
breakage. See §3.

Item 22 exists because the alternative was worse. Phase 10's device test left one
real booking, **AHR-2026-00001**, in the remote database, and the client ruled
that it stays: payments (Phase 11) and both invoice styles (Phase 12) get
verified against a booking that a person actually created through the form on a
phone, not against a fixture written to make the code pass. A seeded row agrees
with whatever assumptions the seed was written under; a real one carries the
snapshot, the terms and the audit trail that the real path produced.

What that buys has to be paid back before go-live, and in two parts, because
deleting the booking alone is not enough. `booking_counters` holds the year's
last sequence, so the row for **2026** must be reset to `0` in the same pass —
otherwise the first genuine booking of the year is issued `AHR-2026-00002` and
the series starts with a gap nobody can explain. Both are deliberate acts by a
person against the remote database; nothing in the build deletes either one, and
nothing should be added that does (§9.10).

### The go-live tag is reserved

**`v1.0-public` is not to be used until the actual go-live commit**, after the
items above have landed. Release 1 is code-complete — every phase from 1 to 7 is
built and deployed — and the finished build is tagged **`release-1-complete`**,
which describes what is in the tree without claiming a status the project has
not reached. The site cannot go live while `/ar` serves English placeholder
strings (item 5) and the WhatsApp number is a placeholder (item 3), so a tag
saying "public" would be wrong in the one way a tag most needs to be right:
other people navigate by it.

This is the same rule that produced `phase-7-seo` rather than `v1.0-public`
when Phase 6 was still unbuilt, generalised. A tag has to pass two tests — the
work its name claims is genuinely in the tree, **and** the name does not assert
a status the project has not reached. Prefer descriptive build-state names, and
spend a go-live name once, at go-live.

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
- **Autosave drafts** on step change **and on a debounce while typing** — 1.5 s after the last keystroke. Losing twenty minutes of entry to a dropped connection or a phone call is the failure mode that makes staff stop using the system, and the step boundary alone does not prevent it: a step can be twenty fields long, and everything typed into the step someone is standing in when the call ends goes with it. Both triggers go through one save function holding an in-flight lock, so they cannot create two draft rows for one booking.
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
