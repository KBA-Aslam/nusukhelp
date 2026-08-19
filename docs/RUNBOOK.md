# Autonomous Build Runbook — nusukhelp.com

**Project root:** `D:\Nusuk`
**Mode:** Claude Code executes everything — code, migrations, Cloudflare deploys.
You review and approve at phase boundaries, not line by line.

---

# PART 1 — Setup for autonomy (once, ~20 min)

## 1.1 Folder

Create `D:\Nusuk` and place files exactly here:

```
D:\Nusuk\
├── CLAUDE.md                 ← root
├── .claude\
│   └── settings.json         ← create in step 1.3
└── docs\
    ├── SPEC.md               ← renamed from nusukhelp-specification.md
    └── prototype\
        ├── 01-design-system.svg
        ├── 02-landing-desktop.svg
        ├── 03-landing-mobile.svg
        ├── 04-admin-dashboard-desktop.svg
        ├── 05-admin-booking-mobile.svg
        ├── 06-invoice-a4-both-styles.svg
        └── logos\  (4 png files)
```

Open in Antigravity: **File → Open Folder → D:\Nusuk**

## 1.2 Give Claude Code Cloudflare access

In the Antigravity terminal:

```bash
cd /d/Nusuk
git init
npm install -g wrangler
wrangler login
```

`wrangler login` opens a browser, you approve, and the token is stored on your
machine. From then on **Claude Code can run any wrangler command as you** — create
D1 databases, apply migrations, deploy Workers, manage DNS.

Verify:

```bash
wrangler whoami
```

You should see your account. If this fails, nothing else will work.

## 1.3 Permission config — the important part

Create `D:\Nusuk\.claude\settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Edit",
      "Write",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(mkdir:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(cp:*)",
      "Bash(mv:*)",
      "Bash(wrangler d1 create:*)",
      "Bash(wrangler d1 execute:*)",
      "Bash(wrangler d1 migrations apply:*)",
      "Bash(wrangler d1 list)",
      "Bash(wrangler d1 info:*)",
      "Bash(wrangler r2 bucket create:*)",
      "Bash(wrangler deploy:*)",
      "Bash(wrangler versions:*)",
      "Bash(wrangler tail:*)",
      "Bash(wrangler whoami)",
      "Bash(wrangler types:*)"
    ],
    "deny": [
      "Bash(wrangler d1 delete:*)",
      "Bash(wrangler r2 bucket delete:*)",
      "Bash(wrangler delete:*)",
      "Bash(wrangler secret delete:*)",
      "Bash(rm -rf:*)",
      "Bash(git push --force:*)",
      "Bash(git reset --hard:*)",
      "Bash(npm publish:*)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./.dev.vars)"
    ]
  }
}
```

**Why the deny list is not optional.** With unrestricted wrangler access, one
confused command — `wrangler d1 delete nusukhelp-db` — destroys your production
booking data. There is no undo. The allow list covers everything the build needs;
the deny list blocks the handful of commands that are irreversible.

If Claude Code genuinely needs a denied command, it will ask and you decide.

## 1.4 Secrets stay yours

Claude Code can run `wrangler secret put`, but **you type the values**. Never paste
API keys into the chat.

Create `D:\Nusuk\.dev.vars` yourself (this is git-ignored and read-denied above):

```
BETTER_AUTH_SECRET=<generate a long random string>
TURNSTILE_SECRET_KEY=<from Cloudflare dashboard>
RESEND_API_KEY=<from resend.com>
IP_HASH_SALT=<another long random string>
```

## 1.5 Launch with autonomy

```bash
cd /d/Nusuk
claude --permission-mode acceptEdits
```

This auto-approves file edits while still gating anything not in the allow list.

**If you want zero interruptions** (higher risk, faster):

```bash
claude --dangerously-skip-permissions
```

This bypasses **all** prompts including the deny list. Only use it if you are
watching the session. I would not use it for phases that touch the remote database.

---

# PART 2 — The build

One phase per session. `/clear` between phases.

Each prompt below ends with **"Execute everything yourself"** — that is what turns
these from suggestions into actions.

---

## Session 0 — Orientation (no code)

```
Read CLAUDE.md and docs/SPEC.md sections 1, 2 and 18.

Do not write code. Tell me:
1. The core architectural rule in your own words
2. Why there is no invoices table
3. The phase order
4. Anything ambiguous or contradictory in the spec
```

⚠️ If it describes invoices as stored records, or suggests Vercel/Supabase/Prisma,
correct it now. This costs two minutes and prevents a rewrite.

---

# RELEASE 1 — Public site

## Phase 1 — Foundation and live deployment

```
Read docs/SPEC.md sections 2 and 3.

Implement Phase 1 completely, executing every step yourself:

1. Scaffold Next.js 15 App Router + TypeScript strict + Tailwind CSS v4
2. Install and configure @opennextjs/cloudflare
3. Run: wrangler d1 create nusukhelp-db
   and wrangler d1 create nusukhelp-db-preview
4. Run: wrangler r2 bucket create nusukhelp-backups
5. Write wrangler.jsonc with the real database IDs from step 3 and the
   bindings in spec section 3
6. Configure Drizzle ORM for D1
7. Build a hello-world page
8. Run the build and deploy: npm run deploy
9. Add nusukhelp.com and www.nusukhelp.com as Worker custom domains
10. Verify the live site responds over HTTPS
11. .gitignore covering .env, .dev.vars, node_modules, .open-next
12. git add and commit

Run the commands. Do not print them for me to run.
If a command fails, read the error and fix it.

Report back with the live URL and confirmation it loads.
Stop after Phase 1.
```

✅ **Open `https://nusukhelp.com` yourself before continuing.** OpenNext on
Cloudflare has real friction — discovering this in Phase 12 instead of Phase 1
is the difference between a bad day and a rewritten project.

`/clear`

---

## Phase 2 — Public schema

```
Read docs/SPEC.md section 8.

Implement Phase 2, executing everything:
- reviews, enquiries and company_settings tables in src/db/schema.ts
- Generate the migration with drizzle-kit
- Apply to local: wrangler d1 migrations apply nusukhelp-db --local
- Apply to remote: wrangler d1 migrations apply nusukhelp-db --remote
- Verify with a wrangler d1 execute query listing the tables
- Commit

Skip all booking tables — those are Phase 10.
Stop there.
```

`/clear`

---

## Phase 3 — Shell

```
Read docs/SPEC.md sections 6 and 7.
Open docs/prototype/01-design-system.svg and 02-landing-desktop.svg.

Implement Phase 3, executing everything:
- Root layout, next-intl, always-prefixed en/ar routing
- Arabic layout with dir="rtl"
- Marcellus, IBM Plex Sans, IBM Plex Sans Arabic via next/font
  (Arabic font loads only on /ar)
- Design tokens in the Tailwind config — exactly the hex values in section 7
- Copy docs/prototype/logos/*.png to public/logos/
- Header with the Nusuk Help logo
- Footer with the division line, Al Haramain gilt logo, and the affiliation
  disclaimer in both languages

Al Haramain never appears in the header.
Deploy when done and give me the URL to check.
Commit. Stop there.
```

✅ Check `/en` and `/ar` on the live URL. Confirm the Arabic layout mirrors.

`/clear`

---

## Phase 4 — Landing page

Two prompts. The first is a checkpoint.

**4a:**
```
Read docs/SPEC.md section 5.
Open docs/prototype/02-landing-desktop.svg and 03-landing-mobile.svg.

Create src/content/services.ts as a typed source of truth: all seven services,
six why-choose-us points, four coverage areas.

Show me the file. No components yet.
```

**4b:**
```
Now build all nine landing sections as components in
src/components/public/sections/, matching the prototypes.

The ogee arch is the signature — hero mask and two-division card outlines only.
Nowhere else. Mobile-first.

English copy only. Deploy and commit when done.
```

✅ Check at 390px, 768px, 1440px on the live site.

`/clear`

---

## Phase 5 — Detail pages

```
Read docs/SPEC.md section 4 and Appendix A.

Implement Phase 5, executing everything:
- /al-haramain-reservation with the six anchors from section 4
- /b2b, /about, /contact, /privacy, /terms
- Landing service cards link to the anchors
- Al Haramain logo in the reservation page body only

Appendix A copy rules are compliance requirements. Permit language especially:
assistance and guidance only, never implying permits can be obtained outside
official channels.

Deploy, commit, stop.
```

`/clear`

---

## Phase 6 — Forms

```
Read docs/SPEC.md section 14.

Implement Phase 6, executing everything:
- Turnstile on both forms
- POST /api/reviews: Turnstile + honeypot + rate limit (3/IP/24h) +
  min 20 chars + auto-spam on URLs. Saves as status 'pending'.
- POST /api/enquiries: same protections plus pilgrim/agency audience split
- Resend notification on new enquiry
- Reviews display on landing and /reviews — published only
- WhatsApp deep links with pre-filled messages on every CTA

The review confirmation must say it will appear after review.
Do not imply it is already live.

For secrets: tell me the exact wrangler secret put commands to run,
I will enter the values myself. Then deploy and commit.
```

✅ Submit a test review. Confirm it does **not** appear publicly.

`/clear`

---

## Phase 7 — Launch

```
Read docs/SPEC.md sections 15 and 17.

Implement Phase 7, executing everything:
- Security headers: CSP, HSTS, X-Frame-Options DENY, nosniff
- Metadata per page per locale, hreflang including x-default, Open Graph
- JSON-LD: TravelAgency on landing, Service on reservation sections
- sitemap.xml both locales, robots.txt disallowing /admin
- Fix any accessibility issues you find

Deploy, then give me a manual QA checklist covering things you cannot test:
real-device rendering, WhatsApp links, RTL at mobile widths.

Commit and tag v1.0-public.
```

🚀 **Release 1 live.** Pause here a few days.

---

# RELEASE 2 — Admin panel

## Phase 8 — Auth

```
Read docs/SPEC.md section 12.

Implement Phase 8, executing everything:
- Better Auth with the D1 adapter via Drizzle
- Auth tables, migration, applied local and remote
- /admin/login, middleware guard on /admin/*
- Invite flow: SHA-256 hashed tokens, Resend email,
  /admin/accept-invite/[token], 7-day expiry
- /admin/settings/users
- Seed script for the first admin account
- Admin layout with the Al Haramain logo — the only logo in /admin
- noindex on all /admin routes

Every server action independently re-checks session and role.
Middleware alone is not sufficient.

Deploy, commit, stop.
```

✅ Log out, hit `/admin/bookings` directly, confirm redirect.

**Before that check works you need an account, and the panel cannot make you
one.** There is no public sign-up — that is the access model, not an oversight
(SPEC §12). Two steps, once:

```bash
npx wrangler secret put BETTER_AUTH_SECRET   # see docs/SECRETS.md §5
npm run seed:admin:remote                    # asks for name, email, password
```

The seed script refuses to run a second time. Every account after the first
comes from an invitation sent inside `/admin/settings/users`, which is what
keeps `admin_invites` a complete record of who let whom in.

For local development the same two things are needed on the local side:
`.dev.vars` with `BETTER_AUTH_SECRET` (§1.4 above) and
`npm run seed:admin:local`. Without the secret, `/admin/*` returns a 500 naming
the variable — deliberately, because the alternative is a per-isolate generated
secret that signs people out at random.

`/clear`

---

## Between 8 and 9 — timestamp normalisation ✅ done

A standalone change, not part of either phase. Phase 6 stored
`reviews.created_at` and `enquiries.created_at` in milliseconds where §8 calls
for Unix seconds; it was invisible until Phase 8 added tables that store real
seconds. Migration `0002` converted the data, `src/lib/time.ts` became the only
clock, and this is now checkable:

```bash
npm run check:timestamps:remote
```

**Run that after any phase that adds a table.** It walks every table in the live
database and fails if a timestamp column holds milliseconds. It finds its
columns from the schema in the database, so a new table is covered
automatically — unless its time column is named something other than `*_at`, in
which case add the name to `EXTRA_COLUMNS` in the script.

---

## Phase 9 — Foundations ✅ built

Two migrations: `0003` creates the tables, `0004` seeds the lists and the
placeholder `company_settings` row. They are separate because the lists are
yours to edit at runtime and the schema is not, and `0004` is idempotent — every
insert is `INSERT OR IGNORE`, so re-running it can never overwrite an edit you
made in the UI.

**Now enter your real company details** at `/admin/settings/company`, and
confirm the hotel list at `/admin/settings/lists` — the six hotels seeded there
are placeholders (§19 item 7). Neither needs a deploy.

One trap worth remembering when you write a migration by hand: **use `--` line
comments, never `/* … */`.** `wrangler d1 migrations apply` chunks a file on
`--> statement-breakpoint` and rejects a chunk that opens with a block comment
(`SQL code did not contain a statement [code: 7500]`), even though the same file
applies fine with `wrangler d1 execute --file`.

## Phase 9 — the original brief

```
Read docs/SPEC.md section 8.

Implement Phase 9, executing everything:
- Lookup tables: roomTypes, mealPlans, serviceTypes, hotels, paymentMethods
- Seed with spec defaults, applied local and remote
- /admin/settings/lists to manage them
- /admin/settings/company
- Agencies CRUD with search, plus the agency profile page

Deploy, commit, stop.
```

Then enter your real company details in settings.

`/clear`

---

## Phase 10 — Bookings ⚠️ checkpoint first

```
Read docs/SPEC.md sections 8 and 9 carefully.

Before any code, answer:
1. Why is there no invoices table?
2. What happens to the PDF when a booking is edited after partial payment?
3. How is paymentStatus derived, and when does it recalculate?

Then show your implementation plan. No code yet.
```

Only when the answers are right:

```
Good. Implement Phase 10, executing everything:
- bookings, booking_rooms, booking_services, booking_counters
- Migration applied local and remote
- Seven-step mobile-first creation form per section 13.3
- Collapsible room and service rows, running total pinned
- Autosave draft on every step change
- All calculation server-side
- Confirm allocates the number via the atomic statement in 9.1
- Booking list with search and filters
- Booking detail screen per 13.4
- Edit with the section 9.3 guards
- Cancel with reason
- Audit log with before/after values on every edit

Match docs/prototype/05-admin-booking-mobile.svg.
Deploy, commit, stop.
```

✅ Create a booking with three room types on a real phone.

`/clear`

---

## Phase 11 — Payments

```
Read docs/SPEC.md sections 9.2 and 9.4.

Implement Phase 11, executing everything:
- payments table, unlimited instalments, migration applied both
- Record-payment modal on the booking detail screen
- amountPaid and paymentStatus derived, recalculated on payment changes
  AND on booking edits
- Reversal with reason, Admin only, never hard delete
- Payment history with reversals struck through

Then write and run a test proving this sequence:
booking 5,000 → pay 1,000 → partially_paid → pay 4,000 → paid
→ edit to 4,000 → overpayment warning fires

Deploy, commit, stop.
```

`/clear`

---

## Phase 12 — PDF ⚠️ checkpoint first

```
Read docs/SPEC.md section 10.

Before any code, show me:
1. InvoiceFullData and InvoiceConfidentialData type definitions
2. The toConfidential sanitiser

I need to confirm the confidential type has no price fields before you build.
```

Then:

```
Implement Phase 12, executing everything:
- InvoiceFullDocument.tsx and InvoiceConfidentialDocument.tsx as separate
  components. No shared component with a showPrices flag.
- A4 portrait, brand palette, Al Haramain logo
- "Statement as of ..." generation timestamp in the header
- Amount in words, SAR only, full style only
- Terms and declaration from section 11 on both styles
- navigator.share({ files }) primary, download fallback
- Font.register explicitly, wrap={false} on table rows

Match docs/prototype/06-invoice-a4-both-styles.svg.

Then write and run a script that extracts the text layer from a generated
confidential PDF and asserts no monetary figures appear. Show me the output.

Deploy, commit, stop.
```

✅ Generate both on a **real iPhone**. Check A4 size, no split rows, share sheet
opens to WhatsApp.

`/clear`

---

## Phase 13 — Scheduler

```
Read docs/SPEC.md section 13.5.

Implement Phase 13, executing everything:
- /admin/schedule with month, week, day, list views
- Check-ins and check-outs as distinct events, colour-coded by payment status
- /admin/schedule/check-ins and /check-outs with filters
- /admin/completion for bookings past check-out

All queries read bookings.checkInDate and checkOutDate directly.

Verify one booking with two payments produces exactly one check-in event.
Deploy, commit, stop.
```

`/clear`

---

## Phase 14 — Dashboard and reports

```
Read docs/SPEC.md sections 13.1, 13.2 and 13.7.
Open docs/prototype/04-admin-dashboard-desktop.svg.

Implement Phase 14, executing everything:
- Dashboard per 13.1: booking cards, financial cards, alerts, charts
- The three money figures per 13.2, never conflated
- Recharts for all charts
- Monthly and annual reports with filters and CSV export

Drafts and cancelled bookings excluded from all totals.
Deploy, commit, stop.
```

`/clear`

---

## Phase 15 — Reminders and moderation

```
Read docs/SPEC.md sections 13.9 and 13.11.

Implement Phase 15, executing everything:
- Reminders CRUD, linked to a booking or standalone, surfacing on the dashboard
- /admin/reviews queue: Pending/Published/Hidden/Spam tabs, counts,
  bulk approve, revalidation on approval
- /admin/enquiries with audience triage

Deploy, commit, stop.
```

`/clear`

---

## Phase 16 — Hardening

```
Read docs/SPEC.md sections 15, 16 and 20.

Implement Phase 16, executing everything:
- Weekly backup cron Worker exporting to R2, wired into wrangler.jsonc
- Trigger it manually to confirm it writes
- Then walk me through a restore test on a throwaway database

Then audit every server action for role checks and give me a table:
action | required role | actual check | pass/fail

Deploy, commit, tag v1.0-admin.
```

---

# PART 3 — Running it well

## What you still do

Autonomy does not mean absence. At each phase boundary:

- **Open the live URL.** Agents report success from a build passing, not from
  the page looking right.
- **Skim `git diff`.** Not every line — but read auth, money calculation, and
  the confidential PDF closely.
- **Test on a real phone** from Phase 10 onward.

## Course corrections

**Suggests Vercel / Supabase / Prisma**
→ *"Re-read CLAUDE.md. Those are explicitly excluded and the reasons are given."*

**Creates an invoices table**
→ *"Stop. Re-read SPEC.md section 1, 'The central design decision.' There is no
invoices table. Revert that and show me the corrected schema."*

**Prints commands instead of running them**
→ *"Run them yourself. You have wrangler access."*

**Deployment fails on OpenNext**
→ *"Read the actual error and fix it. Do not switch hosting providers — Vercel
is a licence violation for this project."*

**Claims a phase is done but it isn't**
→ *"List every requirement in spec section X and mark each done or not done."*

**Session goes sideways mid-phase**
→ `/clear`, then `git reset --hard HEAD` (run this yourself — it is denied to the
agent), then restart the phase with a narrower prompt.

## If quotas or account issues appear

If Antigravity causes trouble, run the same sessions in a plain terminal:

```bash
cd D:\Nusuk
claude --permission-mode acceptEdits
```

Nothing in this runbook depends on the IDE.

## Only you can supply

- [ ] Company legal name, CR number, Madinah address, bank IBAN
- [ ] WhatsApp business number
- [ ] Arabic translation of all public copy
- [ ] Photography
- [ ] Logo redrawn as true vector — current files are raster
- [ ] **Legal advice on the Nusuk brand naming** — the largest business risk
- [ ] Legal review of permit-assistance copy
- [ ] Real-device testing
