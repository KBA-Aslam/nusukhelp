# Secrets and build-time configuration

Every value the deployed site needs that is not in the repo. **You type these,
not Claude Code** — `wrangler secret put` prompts on stdin, so no key is ever
pasted into a chat, a file, or a commit (RUNBOOK 1.4).

---

## 1. Create the Turnstile widget

Cloudflare dashboard → **Turnstile** → *Add widget*.

| Field | Value |
|---|---|
| Widget name | `nusukhelp.com` |
| Hostnames | `nusukhelp.com` and `www.nusukhelp.com`. The `nusukhelp.lazykba.workers.dev` preview URL was needed while `workers_dev` was `true`; it is now `false` (§19 item 16) and that hostname can be dropped from the widget |
| Widget mode | **Managed** |

It gives you two values. They are not interchangeable:

- a **site key** (`0x4AAA…`) — **public**, goes in the build (step 3 below);
- a **secret key** (`0x4AAA…`) — goes in `wrangler secret put` (step 2).

---

## 2. The three Wrangler secrets

Run each command, paste the value at the prompt, press Enter.

```bash
# The Turnstile SECRET key from step 1 — not the site key.
npx wrangler secret put TURNSTILE_SECRET_KEY

# From resend.com -> API Keys. Sending permission is enough.
npx wrangler secret put RESEND_API_KEY

# A random 32-byte value. Generate it yourself and paste the output:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx wrangler secret put IP_HASH_SALT
```

Verify all three landed, without printing their values:

```bash
npx wrangler secret list
```

### What each one does if it is missing

Every one of them **fails closed** — the endpoint rejects the submission rather
than skipping the check (§15).

| Secret | Missing behaviour |
|---|---|
| `TURNSTILE_SECRET_KEY` | Every submission is rejected `403`. Verification cannot be skipped, including when Cloudflare itself is unreachable |
| `IP_HASH_SALT` | Every submission is rejected `503`. An unsalted hash of an IPv4 address is reversible by brute force in seconds, so hashing without it is not anonymisation |
| `RESEND_API_KEY` | Enquiries are still **stored** and appear in the admin queue; only the notification email is skipped, and the failure is logged. A Resend outage must not turn a captured lead into an error page |

**`IP_HASH_SALT` cannot be rotated casually.** Changing it changes every future
hash, so existing rows stop matching and each submitter's 24-hour rate-limit
allowance resets once. That is the only consequence — no data is lost — but do
not rotate it on a whim.

---

## 3. The one build-time variable

The Turnstile **site key** is public and has to be in the HTML, so it is a
build-time variable, not a Wrangler secret. Put it in `.env.production` at the
repo root — gitignored, and read by `next build`:

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA...
```

Then rebuild and deploy — a secret set with `wrangler secret put` takes effect
immediately, but this one is baked into the HTML and needs a build:

```bash
npm run deploy
```

**Until this is set, both forms render a visible "verification is not
configured" notice and cannot be submitted.** That state is deliberate and
loud: a build that forgets the key must produce a form that does not work,
never one that silently accepts whatever a bot sends.

### If the widget passes but the form still says "we could not verify"

The two keys fail in different places, and this is what it looks like when the
**secret** is wrong while the **site key** is right: the Turnstile widget shows
*Success*, and `POST /api/reviews` still answers `403 rejected`. The widget only
proves the site key and the hostname list are correct — it never touches the
secret.

Read the Worker log to see Cloudflare's own reason:

```bash
npx wrangler tail --format pretty
```

| Logged code | What it means |
|---|---|
| `invalid-input-secret` | The value in `TURNSTILE_SECRET_KEY` is not a Turnstile secret at all — most often the **site key** pasted into the secret slot, or a truncated paste. Re-run `wrangler secret put` with the widget's secret key |
| `invalid-input-response` | The secret is fine; the token was missing, reused or expired. A token is single-use and valid for 300 seconds. This is also what a genuine bot produces — the guard working |
| `timeout-or-duplicate` | The same token was submitted twice |

Cloudflare returns `invalid-input-secret` as **HTTP 400 with a JSON body**, not
as a `200` carrying `success: false`, which is why `verifyTurnstile` parses the
body whatever the status — an early `!response.ok` return would throw away the
one field that names the problem.

A secret takes effect the moment `wrangler secret put` completes. Unlike the
site key it is **not** baked into the build, so no redeploy is needed.

---

## 4. Resend domain verification

The notification sender is `notifications@send.nusukhelp.com`
(`src/lib/email.ts`). Resend rejects an unverified `from` with a 403, which
means enquiries would be stored but never notified.

In the Resend dashboard, add **`send.nusukhelp.com`** as the domain — not
`nusukhelp.com` — and publish the records it gives you in Cloudflare DNS.

### Why a subdomain, and why this is the rule for every future sender

Two reasons, and the first is the binding one:

1. **The apex MX stays free.** Verifying `nusukhelp.com` itself as a sending
   domain wants an MX record on the apex, and the apex is reserved for real
   mailboxes (`someone@nusukhelp.com`) the client intends to host later. Every
   record Resend asks for attaches to `send.nusukhelp.com` instead, so the apex
   is left alone.
2. **Reputation isolation.** A deliverability problem with automated mail
   cannot damage the domain the company's human correspondence goes out on.
   Resend recommends a sending subdomain for exactly this reason.

This applies to **every sender this project adds**, not just the enquiry
notification — the Phase 8 staff invite emails send from the same subdomain.

Resend shows the exact records when you add the domain; publish them verbatim
in Cloudflare DNS, all on the `send` subdomain. Wrangler manages the DNS records
for the two custom hostnames (§3) but not this one, so these are added by hand
in the dashboard and will not conflict.

Tracked as §19 open item 18.

To confirm it works end to end, submit a real enquiry through `/contact` and
watch the Worker log:

```bash
npx wrangler tail --format pretty
```

A failure prints `enquiry notification failed:` with the status Resend returned.

---

## 5. The two auth secrets — Phase 8

Both are set. They are recorded here because rotating them has consequences
worth knowing before you do it, not because anything is outstanding.

```bash
# A random 32-byte value. Generate it and pipe it straight in, so the value
# never appears in a terminal, a file or a shell history:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" \
  | npx wrangler secret put BETTER_AUTH_SECRET

# The canonical origin. Not really a secret — it is in every URL the site
# serves — but §3 keeps it alongside the others so there is one place to look.
echo "https://nusukhelp.com" | npx wrangler secret put BETTER_AUTH_URL
```

| Secret | Missing behaviour | Rotation |
|---|---|---|
| `BETTER_AUTH_SECRET` | **`/admin/*` fails with a 500 and a message naming this variable.** Deliberate: Better Auth will otherwise generate its own, and a generated secret differs per isolate, so sessions signed by one Worker instance are rejected by the next — an intermittent, unreproducible "you were signed out" | Signs out **everyone, immediately**. No data is lost; each person signs in again |
| `BETTER_AUTH_URL` | Falls back to `SITE_URL` from `lib/site.ts`, which is the same value. Nothing breaks | Harmless |

The public site is unaffected by either. `lib/auth.ts` builds the Better Auth
instance lazily, on the first admin request, so a missing secret never reaches a
marketing page.

### There is no secret for the invite tokens

Worth stating, because it looks like an omission. Invite tokens are 32 bytes of
`crypto.getRandomValues` and are stored as an unsalted SHA-256 digest. A salt
would add nothing: there is no dictionary to try against 256 bits of entropy, so
the digest exists only so that a stolen row cannot be replayed as a working
link. `IP_HASH_SALT` is a different problem — IPv4 has four billion values, which
*is* a dictionary — which is why that one has a salt and this does not.

---

## 6. Seeding the first admin account

Once the secrets above are set and the Phase 8 migration is applied, the panel
has no accounts and no way to make one from the browser: there is no public
sign-up, and only an admin can invite (§12). The first account is created by a
one-off script:

```bash
npm run seed:admin:remote    # or seed:admin:local against the local D1
```

It asks for a name, an email and a password, hashes the password with **Better
Auth's own `hashPassword`** so the sign-in verifier can read it, and writes the
`user` and credential `account` rows. The password is read with echo off and
reaches D1 in a temporary file that is deleted immediately; nothing is passed on
a command line.

**It refuses to run if any account already exists.** After the first one, every
further account comes from an invitation sent inside the panel, which is what
keeps `admin_invites` a complete record of who let whom in.
