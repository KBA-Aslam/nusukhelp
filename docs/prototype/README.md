# nusukhelp.com — UI prototype

Companion to `nusukhelp-specification.md` (v3.0).

> **v3.0 note.** The admin panel is built around **bookings**, not invoices. The invoice is a PDF
> rendered from a booking's current state, downloaded from the booking detail screen — it is never
> stored as a record. Mockups 04 and 05 reflect this.

## Opening in Figma

**File → Import…** and select the `.svg` files. Each becomes its own page. Text imports as
editable layers; shapes as editable vectors.

Install these fonts first, or Figma will substitute:

- **Marcellus** — display, headings only (Google Fonts, free)
- **IBM Plex Sans** — body and UI (Google Fonts, free)
- **IBM Plex Sans Arabic** — Arabic pages (Google Fonts, free)

## Files

| File | Size | What it shows |
|---|---|---|
| `01-design-system.svg` | 1440 × 2260 | Logo rules, palette, type scale, signature device, components |
| `02-landing-desktop.svg` | 1440 × 4208 | Complete public landing page |
| `03-landing-mobile.svg` | 390 × 2394 | Same page at phone width |
| `04-admin-dashboard-desktop.svg` | 1440 × 1120 | Sidebar, alert list, value-vs-received chart, booking table |
| `05-admin-booking-mobile.svg` | 1784 × 1180 | Four phone frames: steps 1, 5, 7 and the booking detail |
| `06-invoice-a4-both-styles.svg` | 1798 × 1423 | Both A4 invoice templates, side by side |

## Logo assets (`logos/`)

The two supplied SVGs were PNG images inside an SVG wrapper — raster, not vector. Backgrounds
have been removed and four working variants produced:

| File | Use |
|---|---|
| `nusuk-help-logo.png` | Parent mark, transparent — light backgrounds |
| `nusuk-help-logo-light.png` | Parent mark, cream — dark backgrounds |
| `ahr-logo-tile.png` | Division mark on its green tile |
| `ahr-logo-gold.png` | Division mark, gold cutout — dark backgrounds |

**Caveat:** these are raster. They will soften if scaled beyond native size. Have a designer
redraw both as true vector before any print work.

## Logo placement rules

| Surface | Mark |
|---|---|
| Public site header & footer | Nusuk Help |
| Landing, About, Contact | Nusuk Help |
| Al Haramain Reservation page body | Al Haramain |
| Footer division line | Al Haramain (small, gold) |
| Admin panel — every screen | Al Haramain only |
| Invoice PDF — both styles | Al Haramain only |

The division mark never appears in the public site header.

## Palette — measured from the artwork

| Token | Hex | Source |
|---|---|---|
| `--ink` | `#0C2923` | AHR tile ground |
| `--pine` | `#0B3B31` | Nusuk calligraphy |
| `--verdant` | `#14614C` | Primary actions |
| `--brass` | `#B08E4F` | Gold in the Nusuk mark |
| `--gilt` | `#D4B467` | Gold in the AHR mark |
| `--mist` | `#E7EFEA` | Section tint |
| `--sand` | `#FAF7F1` | Page ground |
| `--slate` | `#47554F` | Body text |

The two golds genuinely differ between the marks. Brass is for light backgrounds, gilt for dark.

## Signature device

The **ogee arch**, taken from the dome in the Nusuk Help mark. It masks the hero panel and
outlines the two-division cards — and appears nowhere else. Everything around it stays flat:
hairline rules, 2px radius, no drop shadows.

Square-Kufic corner brackets from the AHR mark appear on cards at ~45% opacity. A whisper,
not a second signature.

## Still to supply

Photography (Makkah / Madinah), Arabic translations, company legal name and CR number,
bank details, WhatsApp business number. See section 19 of the specification.
