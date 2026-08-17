/**
 * The submission guards shared by both public endpoints (§14.1, §15).
 *
 * §14.1 lists five protections for reviews and §14.2 asks the enquiry endpoint
 * for the same set. They live here rather than in either route so the two
 * cannot drift — the failure that matters is one endpoint quietly losing a
 * check the other keeps.
 */

/** Reviews and enquiries alike: 3 submissions per IP hash per 24 hours. */
export const RATE_LIMIT_MAX = 3;
export const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The client's address, from Cloudflare's own header.
 *
 * `CF-Connecting-IP` is set by the edge and cannot be spoofed by the client —
 * unlike `X-Forwarded-For`, which is whatever the request said it was and would
 * make the rate limit a suggestion. Returns `null` off-platform (local `next
 * dev`), which callers treat as unrateable rather than as a shared bucket: see
 * `hashIp`.
 */
export function clientIp(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP');
}

/**
 * SHA-256 of `salt + ip`, hex encoded (§15 — *IP storage: hashed with a secret
 * salt*).
 *
 * The salt is what makes this anonymisation rather than theatre. IPv4 is 4
 * billion values: an unsalted hash of an address is reversible by brute force
 * in seconds, so a plain SHA-256 would store personal data in a form that only
 * looks protected. With a secret salt the digest is useless to anyone who
 * obtains the database without also obtaining the Wrangler secret.
 *
 * Returns `null` when there is no address or no salt. The endpoints reject in
 * that case rather than storing an unsalted or empty-keyed hash.
 */
export async function hashIp(
  ip: string | null,
  salt: string | null,
): Promise<string | null> {
  if (!ip || !salt) return null;

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${ip}`),
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The honeypot field name.
 *
 * Rendered as a real input, visually hidden and `tabindex="-1"`, with a name a
 * naive bot wants to fill. A human never sees it; a form-filling script fills
 * everything it finds.
 *
 * `website` rather than something obviously fake, because the point is that it
 * looks like a field worth completing.
 */
export const HONEYPOT_FIELD = 'website';

export function honeypotTripped(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Does the text contain a URL? (§14.1 — automatic `spam` flag.)
 *
 * Three shapes, because spam rarely writes `https://`: an explicit scheme, a
 * bare `www.`, and a bare `domain.tld/…` or `domain.tld` on a known-ish TLD
 * shape. The last is the loose one, and it is deliberately loose — the
 * consequence of a false positive here is that a genuine review lands in the
 * admin's Spam tab instead of the Pending tab, where a human sees it either
 * way. §13 keeps both tabs and hard-deletes nothing, which is what makes
 * erring toward `spam` safe.
 *
 * The comment is still **stored**. This flags, it does not discard: a rejected
 * submission the submitter believes went through is worse than a queue entry.
 */
const URL_PATTERNS: readonly RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\//i,
  /\bwww\.[a-z0-9-]+/i,
  /\b[a-z0-9-]+\.[a-z]{2,24}(?:\/|\b)/i,
];

export function containsUrl(text: string): boolean {
  return URL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Which locale the submitter was reading, from the `Referer` path.
 *
 * Stored on the row so an admin moderating the queue knows which language to
 * answer in (§13 shows locale on every row). Read from a header rather than
 * accepted as a body field: it is metadata about the request, not something a
 * submitter fills in, and there is no reason to let a client set it.
 *
 * The **first path segment** is what decides, not a substring search. Every
 * public URL is locale-prefixed (§6), and a naive `includes('/ar')` would be
 * one plausible route away from matching the wrong thing.
 */
export function localeFromReferer(request: Request): string {
  const referer = request.headers.get('Referer');
  if (!referer) return 'en';

  try {
    const [segment] = new URL(referer).pathname.split('/').filter(Boolean);
    return segment === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}
