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
| Hostnames | `nusukhelp.com`, `www.nusukhelp.com`, and `nusukhelp.lazykba.workers.dev` while `workers_dev` is still `true` in `wrangler.jsonc` |
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

---

## 4. Resend domain verification

The notification sender is `notifications@nusukhelp.com` (`src/lib/email.ts`).
Resend rejects an unverified `from` with a 403, which means enquiries would be
stored but never notified.

In the Resend dashboard, add `nusukhelp.com` as a domain and publish the DKIM
and SPF records it gives you in Cloudflare DNS. Tracked as a §19 open item.

To confirm it works end to end, submit a real enquiry through `/contact` and
watch the Worker log:

```bash
npx wrangler tail --format pretty
```

A failure prints `enquiry notification failed:` with the status Resend returned.

---

## 5. Later phases

Not needed yet; listed so this file stays the one place to look (§3).

| Secret | Lands in |
|---|---|
| `BETTER_AUTH_SECRET` | Phase 8 — auth |
| `BETTER_AUTH_URL` | Phase 8 — auth |
