import { NextResponse } from 'next/server';

import { countEnquiriesByIpSince, insertEnquiry } from '@/db/queries/enquiries';
import { sendEnquiryNotification } from '@/lib/email';
import {
  HONEYPOT_FIELD,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_SECONDS,
  clientIp,
  hashIp,
  honeypotTripped,
  localeFromReferer,
} from '@/lib/request-guards';
import { ipHashSalt, turnstileSecret } from '@/lib/server-env';
import { nowSeconds } from '@/lib/time';
import { TURNSTILE_FIELD, verifyTurnstile } from '@/lib/turnstile';
import { enquirySchema } from '@/lib/validation/enquiry';

/**
 * `POST /api/enquiries` — public enquiry submission (§14.2).
 *
 * The same guards as `/api/reviews`, in the same order and from the same
 * module, plus the audience split. Two deliberate differences:
 *
 * **No URL scan.** A `spam` status is a review concept: reviews are published,
 * so a link in one is an attempt to publish a link. An enquiry is a private
 * message to the company, and a travel agency writing "our site is
 * example.com" is the most ordinary sentence in a B2B first contact. Flagging
 * it would train staff to ignore the flag.
 *
 * **The notification is best-effort.** The enquiry is stored first and the
 * email is sent afterwards, and a Resend failure does not fail the request —
 * see `sendEnquiryNotification`. A captured lead that did not trigger an email
 * is a smaller problem than an error page that makes a customer submit twice or
 * give up.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Failure = 'invalid' | 'rejected' | 'rate_limited' | 'unavailable';

function fail(reason: Failure, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('invalid', 400);
  }

  // Honeypot — answered as a success, storing nothing. See the note on the
  // reviews route for why a bot must not learn it tripped a trap.
  if (
    typeof body === 'object' &&
    body !== null &&
    honeypotTripped((body as Record<string, unknown>)[HONEYPOT_FIELD])
  ) {
    return NextResponse.json({ ok: true });
  }

  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) return fail('invalid', 400);
  const input = parsed.data;

  const ip = clientIp(request);
  const verified = await verifyTurnstile({
    token: input[TURNSTILE_FIELD] || null,
    secret: await turnstileSecret(),
    remoteIp: ip,
  });
  if (!verified) return fail('rejected', 403);

  const ipHash = await hashIp(ip, await ipHashSalt());
  if (!ipHash) {
    console.error('enquiry rejected: no client IP or IP_HASH_SALT is not set');
    return fail('unavailable', 503);
  }

  const recent = await countEnquiriesByIpSince(
    ipHash,
    nowSeconds() - RATE_LIMIT_WINDOW_SECONDS,
  );
  if (recent >= RATE_LIMIT_MAX) return fail('rate_limited', 429);

  const stored = await insertEnquiry({
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    company: input.company || null,
    // The audience split (§14.2) — validated as an enum, so the column can only
    // ever hold one of its own two values.
    audience: input.audience,
    serviceInterest: input.serviceInterest || null,
    message: input.message,
    locale: localeFromReferer(request),
    ipHash,
  });

  // Stored first, notified second, and the result is not awaited into the
  // response's success. The record is the system of record; the email is a
  // prompt to go and read it.
  await sendEnquiryNotification(stored);

  return NextResponse.json({ ok: true });
}
