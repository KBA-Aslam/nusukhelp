/**
 * Cloudflare Turnstile (§2, §14).
 *
 * The **site key** is public by design — it is rendered into the HTML for the
 * widget script to read, and Cloudflare's own documentation treats it as
 * non-secret. It is therefore a build-time `NEXT_PUBLIC_*` variable rather than
 * a Wrangler secret: the forms are inside statically generated pages, so the
 * value has to be baked into the HTML at build time; there is no request in
 * which a Worker could supply it.
 *
 * The **secret key** never appears in this file. It is a Wrangler secret, read
 * server-side in `lib/server-env.ts`, and used only by `verifyTurnstile` below.
 *
 * ## What happens when the site key is unset
 *
 * `TURNSTILE_SITE_KEY` is an empty string, the widget renders nothing, and the
 * form submits without a token — which the API rejects, because verification is
 * server-side and fails closed. A misconfigured build produces a form that does
 * not work, never a form that silently skips its bot check. `isTurnstileConfigured`
 * exists so the form can say so plainly instead of failing at submit.
 */

export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export function isTurnstileConfigured(): boolean {
  return TURNSTILE_SITE_KEY.length > 0;
}

/** The form field the widget writes its token into, per Cloudflare's docs. */
export const TURNSTILE_FIELD = 'cf-turnstile-response';

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Server-side verification of a Turnstile token.
 *
 * Returns `false` for every failure mode there is — no token, no configured
 * secret, a network error reaching Cloudflare, a rejected token. A caller
 * cannot accidentally treat "we could not check" as "the check passed", which
 * is the usual way a CAPTCHA integration ends up decorative.
 *
 * `remoteip` is sent because Cloudflare uses it as a signal; it is the same
 * `CF-Connecting-IP` the rate limiter hashes, and it is not stored here.
 */
export async function verifyTurnstile({
  token,
  secret,
  remoteIp,
}: {
  token: string | null;
  secret: string | null;
  remoteIp: string | null;
}): Promise<boolean> {
  if (!token || !secret) return false;

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    if (!response.ok) return false;

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    // A network failure reaching Cloudflare is not permission to skip the
    // check. The submitter sees a "try again" error, which is honest.
    return false;
  }
}
