import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Typed access to the Wrangler secrets the public forms need (§3, *Secrets*).
 *
 * **Server only.** Nothing here may be imported from a client component — these
 * are the values that must never reach a bundle. The Turnstile *site* key is
 * the deliberate exception and lives in `lib/turnstile.ts`, because a site key
 * is public by design and has to be in the HTML for the widget to render.
 *
 * ## Everything fails closed
 *
 * Each getter returns `null` when its secret is unset rather than throwing, and
 * **every caller treats `null` as "reject the request"** — never as "skip this
 * check". That distinction is the whole design: a deploy that forgets
 * `TURNSTILE_SECRET_KEY` must produce a form that refuses submissions, not a
 * form that accepts everything a bot sends. The failure mode of a missing
 * anti-spam secret has to be an outage, not a silent hole.
 *
 * `IP_HASH_SALT` is treated the same way. Hashing an address with a known or
 * empty salt is not hashing it — a rainbow table over the IPv4 space is
 * trivial — so a missing salt stops the write rather than storing something
 * that only looks anonymised (§15).
 */

type Secrets = {
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  IP_HASH_SALT?: string;
};

async function secret(name: keyof Secrets): Promise<string | null> {
  const { env } = await getCloudflareContext({ async: true });
  const value = (env as unknown as Secrets)[name];
  return value && value.length > 0 ? value : null;
}

export function turnstileSecret(): Promise<string | null> {
  return secret('TURNSTILE_SECRET_KEY');
}

export function resendApiKey(): Promise<string | null> {
  return secret('RESEND_API_KEY');
}

export function ipHashSalt(): Promise<string | null> {
  return secret('IP_HASH_SALT');
}
