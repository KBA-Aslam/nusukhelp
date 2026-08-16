# Start here

Everything for building nusukhelp.com. Read this once, then follow
`docs/RUNBOOK.md`.

## What's in here

```
CLAUDE.md              Project constraints. Claude Code reads this every session.
.claude/settings.json  Permission allow/deny lists — already configured.
.gitignore             Already set up.
.dev.vars.example      Template for your local secrets.

docs/
  SPEC.md              The full specification. Source of truth.
  RUNBOOK.md           Phase-by-phase build instructions with prompts.
  prototype/           Six SVG mockups + cleaned logo assets.
```

## Setup — do this before anything else

```bash
cd /d/Nusuk

git init
git add .
git commit -m "docs: spec, prototype, and project instructions"

npm install -g wrangler
wrangler login          # opens a browser — approve it
wrangler whoami         # must show your account
```

If `wrangler whoami` fails, stop and fix that first. Nothing else works without it.

## Your secrets

Copy `.dev.vars.example` to `.dev.vars` and fill in real values **yourself**.
Never paste API keys into the Claude Code chat. That file is git-ignored and
read-denied to the agent.

You'll need:
- **Turnstile keys** — Cloudflare dashboard → Turnstile → add a site
- **Resend API key** — resend.com → API Keys
- **Two random strings** for `BETTER_AUTH_SECRET` and `IP_HASH_SALT`

## Then start

```bash
claude --permission-mode acceptEdits
```

Paste **Session 0** from `docs/RUNBOOK.md` — the orientation prompt. It writes
no code; it checks whether Claude Code has understood the architecture.

⚠️ If it describes invoices as stored records, or suggests Vercel, Supabase, or
Prisma, correct it before a single file is written.

## How to work through it

**One phase per session.** Paste the prompt for that phase, let it run, verify
the result yourself, `/clear`, move on.

Do not hand over the whole runbook and say "do all of this." Phase boundaries
exist so a wrong turn stays cheap.

**Phases 10 and 12 begin with a checkpoint question rather than an instruction.**
Answer-first, code-second. Those are the two phases where a wrong structural
decision costs days.

## The rule that matters most

**The booking is the only record. The invoice is a PDF view of it.**

There is no invoices table. If you ever see one appear, stop and correct it —
that model was tried and rejected because instalment billing created phantom
duplicate bookings that corrupted the scheduler and every count.

## Before you go live

- [ ] Legal advice on the Nusuk brand naming — the largest business risk
- [ ] Legal review of permit-assistance copy
- [ ] Company legal name, CR number, address, bank IBAN
- [ ] WhatsApp business number
- [ ] Arabic translations
- [ ] Photography
- [ ] Logos redrawn as true vector (current files are raster)
- [ ] Real-device testing on iPhone and Android
