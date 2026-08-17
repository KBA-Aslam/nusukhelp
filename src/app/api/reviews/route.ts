import { NextResponse } from 'next/server';

import { countReviewsByIpSince, insertReview } from '@/db/queries/reviews';
import {
  HONEYPOT_FIELD,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  clientIp,
  containsUrl,
  hashIp,
  honeypotTripped,
  localeFromReferer,
} from '@/lib/request-guards';
import { ipHashSalt, turnstileSecret } from '@/lib/server-env';
import { TURNSTILE_FIELD, verifyTurnstile } from '@/lib/turnstile';
import { reviewSchema } from '@/lib/validation/review';

/**
 * `POST /api/reviews` — public review submission (§14.1).
 *
 * The five protections §14.1 requires, in the order they run, cheapest first:
 *
 *   1. **Honeypot** — a filled hidden field means a bot. Answered `200` with a
 *      success body and nothing stored. Deliberate: a bot that gets an error
 *      learns the field is a trap and the next version omits it, whereas one
 *      that gets a success never finds out its submissions go nowhere.
 *   2. **Shape** — the shared Zod schema, including the 20-character minimum.
 *   3. **Turnstile** — verified server-side against Cloudflare, failing closed.
 *   4. **Rate limit** — 3 per IP hash per 24 hours, counted across all statuses.
 *   5. **URL scan** — a comment containing a link is stored as `spam` rather
 *      than `pending`. Stored, not discarded: the admin has a Spam tab (§13)
 *      and a false positive there is recoverable, while a silent drop is not.
 *
 * Everything that decides the outcome is derived here. Nothing in the request
 * body can set `status`, `ipHash` or `createdAt`, so no submitter can publish
 * their own review — which is the whole point of §14.1's move to moderation.
 *
 * ## The response never says a review is live
 *
 * Success returns `{ ok: true }` and the form renders the §14.1 wording: the
 * review has been *received* and will appear once it has been checked. There is
 * no preview of the review "as it will appear", because an unapproved review is
 * not published and the interface must not suggest it is.
 */

export const runtime = 'nodejs';
/** Never cached, never prerendered — it is a mutation. */
export const dynamic = 'force-dynamic';

/** Deliberately vague. A submitter learns nothing about which guard fired. */
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

  // 1. Honeypot. Checked before anything expensive, and before validation —
  //    a bot's payload often fails the schema too, and this must not depend on
  //    which failure comes first.
  if (
    typeof body === 'object' &&
    body !== null &&
    honeypotTripped((body as Record<string, unknown>)[HONEYPOT_FIELD])
  ) {
    return NextResponse.json({ ok: true });
  }

  // 2. Shape.
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return fail('invalid', 400);
  const input = parsed.data;

  // 3. Turnstile. `verifyTurnstile` returns false for a missing secret, a
  //    missing token and a network failure alike — there is no path through
  //    this that treats "could not check" as "passed".
  const ip = clientIp(request);
  const verified = await verifyTurnstile({
    token: input[TURNSTILE_FIELD] || null,
    secret: await turnstileSecret(),
    remoteIp: ip,
  });
  if (!verified) return fail('rejected', 403);

  // 4. Rate limit. A missing salt or a missing address stops the write rather
  //    than storing an unhashed address or sharing one bucket between every
  //    submitter — see `hashIp`.
  const ipHash = await hashIp(ip, await ipHashSalt());
  if (!ipHash) {
    console.error('review rejected: no client IP or IP_HASH_SALT is not set');
    return fail('unavailable', 503);
  }

  const recent = await countReviewsByIpSince(
    ipHash,
    Date.now() - RATE_LIMIT_WINDOW_MS,
  );
  if (recent >= RATE_LIMIT_MAX) return fail('rate_limited', 429);

  // 5. URL scan decides the status, and the status is decided only here.
  const status = containsUrl(input.comment) ? 'spam' : 'pending';

  await insertReview({
    name: input.name,
    email: input.email,
    rating: input.rating,
    comment: input.comment,
    serviceUsed: input.serviceUsed || null,
    country: input.country || null,
    status,
    ipHash,
    locale: localeFromReferer(request),
  });

  return NextResponse.json({ ok: true });
}
