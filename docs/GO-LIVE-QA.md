# Manual QA — public site

Everything in this file is something **automation could not settle**. The
machine-checkable parts of Phase 7 are already verified and are not repeated
here: headers were confirmed with `curl` against the deployed site (documents
and static assets, including on an edge-cache HIT), the sitemap was counted, the
JSON-LD was parsed out of the built HTML in both locales, contrast was computed
for every text token against every ground it lands on, and the page was loaded
in Chrome with no CSP violations in the console.

What is left needs a human, a real device, or a decision.

> **This is not a go-live checklist on its own.** Phase 6 is unbuilt (§19 item
> 13): there are no forms, no Turnstile, and no `/reviews` route, while the
> header navigation and the landing reviews CTA both link to it. Two links on
> the live site 404 today. Work through this file, but do not launch on it.

---

## 1. Real-device rendering

Minimum supported width is **360 px** (§20). The build was verified in Chrome's
device emulation only, which does not reproduce Safari's viewport units, iOS
font synthesis, or how any of it looks in sunlight.

| # | Check | Where |
|---|---|---|
| 1.1 | Every page renders with **no horizontal scroll** at 360 px and 390 px | iPhone Safari, Android Chrome |
| 1.2 | The hero's arch-masked photograph is not clipped or letterboxed, and the arch apex sits over the umbrella fan | iPhone Safari |
| 1.3 | Section bands alternate correctly and no two adjacent bands read as one | All |
| 1.4 | The ogee arch outlines on the two division cards do not overlap the card headings at 360 px | iPhone Safari |
| 1.5 | Marcellus renders on headings and IBM Plex Sans on body — **not** a system serif substitute | iPhone Safari, Android Chrome |
| 1.6 | The footer's three link columns stack cleanly and every link is comfortably tappable (44 px floor) | Both |
| 1.7 | The page does not zoom or reflow after orientation change | iPhone Safari |
| 1.8 | The mobile nav disclosure opens, closes on Escape, closes after navigating, and does not trap scroll | Both |
| 1.9 | iPad portrait and landscape — the `lg` breakpoint lands where it should | iPad Safari |
| 1.10 | The Open Graph card renders correctly when the URL is pasted into WhatsApp, iMessage and X | Real chats |

**On 1.10 specifically:** the card is `public/og/nusuk-help.png`, 1200×630. Paste
a link to `https://nusukhelp.com/en` and to `https://nusukhelp.com/ar` and check
the title, description and image all appear. Facebook's and X's debuggers cache
aggressively — if the card is wrong after a fix, re-scrape rather than assuming.

---

## 2. WhatsApp links

Every CTA on the site is a `wa.me` deep link with a pre-filled, translated
message. **None of this can be tested without a phone with WhatsApp installed**,
and desktop WhatsApp Web behaves differently.

> The number is still the placeholder from §19 item 3 — the Saudi office line,
> `+966 57 679 9128`, standing in until the client supplies a dedicated WhatsApp
> Business number. Every check below has to be repeated after that swap.

| # | Check |
|---|---|
| 2.1 | Header *Free consultation* opens WhatsApp to the right number with no pre-filled text |
| 2.2 | Hero *Free consultation* opens with the consultation message pre-filled |
| 2.3 | The consultation band's CTA does the same |
| 2.4 | `/b2b` and the reservation page CTAs open with the **B2B** message, not the consultation one |
| 2.5 | Each of the six reservation sections pre-fills a message naming **that** service |
| 2.6 | On `/ar`, the pre-filled message arrives in Arabic and is not mangled or reversed |
| 2.7 | Every pre-fill arrives with its punctuation and line breaks intact after URL encoding |
| 2.8 | The `tel:` links in the footer and on `/contact` dial correctly, both numbers |
| 2.9 | The `mailto:` link opens a compose window with the address filled |
| 2.10 | Links behave from **inside** other apps' in-app browsers (Instagram, Facebook) — a common failure point |

---

## 3. RTL at mobile widths

`/ar` currently holds **English placeholder values** against real keys (§19 item
5), which is deliberate — it makes the layout testable now. That means these
checks are about **direction and mirroring**, not about reading the Arabic.
Repeat the whole section after the translation drop, when line lengths change.

| # | Check |
|---|---|
| 3.1 | The whole page mirrors: navigation, cards, footer columns, list markers all start from the right |
| 3.2 | Latin runs keep their punctuation — no `.across Saudi Arabia`, no `966 57 679 9128+` |
| 3.3 | Phone numbers, email addresses and "B2B" read left-to-right inside right-to-left copy |
| 3.4 | Arrow glyphs on links point **left** on `/ar` |
| 3.5 | The locale switcher's `English` / `العربية` pair does not reorder around its separator |
| 3.6 | The reservation jump list wraps without overlapping at 360 px |
| 3.7 | Nothing is cut off at the start edge — a `ml-*`/`mr-*` that escaped the logical-property rule shows up here |
| 3.8 | Switching locale mid-page keeps you on the same page, not at the homepage |
| 3.9 | The mobile nav panel opens from the correct side |
| 3.10 | Headings and eyebrows are right-aligned; the hero photograph sits on the correct side at `lg` |

---

## 4. Accessibility — the parts a tool cannot answer

Contrast, landmarks, heading order and focus targets are done. These need a
person.

| # | Check |
|---|---|
| 4.1 | Tab from the top of the page: the skip link appears, and activating it puts focus **in the content**, not back in the header |
| 4.2 | Activating a reservation anchor moves focus into that section — the next Tab should reach that section's links, not the rest of the jump list |
| 4.3 | The brass focus ring is visible against every ground, including the ink and pine bands |
| 4.4 | A screen reader announces the star rating once, as a rating — not "black star" five times (needs a published review to test) |
| 4.5 | VoiceOver on iOS can reach and operate the mobile nav disclosure |
| 4.6 | The page is usable at 200% browser zoom without horizontal scroll |

---

## 5. Client decisions outstanding

These are not tests. They are switches nobody should flip without the client.

| # | Decision | Detail |
|---|---|---|
| 5.1 | **HSTS `preload`** | Currently off. Submitting to the browser preload list is close to irreversible and binds *every future subdomain* of `nusukhelp.com` to HTTPS. §19 item 15 |
| 5.2 | **Cloudflare's managed `robots.txt`** | On. It prepends an AI-crawler block (GPTBot, ClaudeBot, Google-Extended, Amazonbot and others get `Disallow: /`) ahead of our rules. Our `/admin` disallow is unaffected — RFC 9309 merges duplicate `User-agent: *` groups. Toggle: dashboard → Security Settings → filter *Bot traffic* → *"Set your preference to block training in robots.txt"*. §19 item 14 |
| 5.3 | **`workers_dev`** | Still `true`, so `nusukhelp.lazykba.workers.dev` serves the same site. Canonicals point at `nusukhelp.com` and mitigate the duplicate meanwhile. Turn off at actual go-live, after Phase 6. §19 item 16 |
| 5.4 | **Search Console** | Submit `https://nusukhelp.com/sitemap.xml` for both locales once the site is genuinely live — not before Phase 6, or the first crawl finds the 404s |
