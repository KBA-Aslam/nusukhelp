'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  checkLoginLimit,
  clearLoginAttempts,
  recordFailedLogin,
} from '@/db/queries/login-attempts';
import { getAuth } from '@/lib/auth';
import { clientIpFromHeaders, hashIp } from '@/lib/request-guards';
import { ipHashSalt } from '@/lib/server-env';
import { signInSchema } from '@/lib/validation/auth';

/**
 * Sign in (§12).
 *
 * ## One failure message, always
 *
 * §15: *auth errors are generic — no user enumeration*. A wrong address, a
 * wrong password, a deactivated account and a malformed submission all produce
 * the same sentence. Anything more specific tells someone probing the form
 * which addresses have accounts, and "this account has been deactivated" tells
 * them the password they just tried was the right one.
 *
 * The rate-limit message is the one deliberate exception, and it leaks nothing:
 * it is about the requester's own address, not about any account.
 */

const GENERIC_FAILURE = 'That email address and password do not match.';

export type SignInState = { error: string | null };

export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const requestHeaders = await headers();

  /* ---- Rate limit (§12 — 5 per 15 minutes per IP hash) ------------------
     Keyed on the salted hash, never the address (§15). Two cases where there
     is no key, and they are not the same case:

     - **No address.** Only happens off Cloudflare, in `next dev`, where
       `CF-Connecting-IP` is not set. There is no per-address bucket to keep,
       and inventing a shared one would rate-limit a developer's whole machine
       into a single counter. Skip.
     - **No salt.** A deploy is missing `IP_HASH_SALT`. That is a
       misconfiguration, not a local quirk, and the fail-closed rule that
       governs the public forms governs this too: refuse rather than run an
       unlimited login form. */
  const ip = clientIpFromHeaders(requestHeaders);
  const salt = await ipHashSalt();

  if (ip && !salt) {
    console.error('sign-in refused: IP_HASH_SALT is not set');
    return { error: 'Sign-in is unavailable. Please contact the administrator.' };
  }

  const ipHash = await hashIp(ip, salt);
  const now = Math.floor(Date.now() / 1000);

  if (ipHash) {
    const limit = await checkLoginLimit(ipHash, now);
    if (limit.blocked) {
      return {
        error: `Too many sign-in attempts. Try again in ${Math.ceil(
          limit.retryAfter / 60,
        )} minutes.`,
      };
    }
  }

  /* ---- Validate ------------------------------------------------------- */
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    if (ipHash) await recordFailedLogin(ipHash, now);
    return { error: GENERIC_FAILURE };
  }

  /* ---- Authenticate ---------------------------------------------------- */
  const auth = await getAuth();

  let signedIn: { isActive?: boolean | null } | null = null;

  try {
    const result = await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: requestHeaders,
    });
    signedIn = result.user as { isActive?: boolean | null };
  } catch {
    // Better Auth throws an APIError for a bad address and a bad password
    // alike. It is not inspected: the answer is the same sentence either way.
    if (ipHash) await recordFailedLogin(ipHash, now);
    return { error: GENERIC_FAILURE };
  }

  /**
   * A deactivated account gets no session.
   *
   * Better Auth knows nothing about `isActive` — it is one of this project's
   * additional user fields — so it will happily authenticate a deactivated
   * person whose password is still correct. Deactivating already revoked their
   * existing sessions (`db/queries/users.ts`); this closes the other door, by
   * throwing away the session that was just created.
   *
   * `getSessionUser` refuses inactive users on every request as well, so a
   * session surviving this would still be useless. Three layers, because being
   * removed from a system and still being able to sign in to it is the kind of
   * failure nobody notices until it matters.
   */
  if (signedIn && signedIn.isActive === false) {
    try {
      await auth.api.signOut({ headers: requestHeaders });
    } catch (error) {
      console.error('failed to discard the session of an inactive user', error);
    }
    if (ipHash) await recordFailedLogin(ipHash, now);
    return { error: GENERIC_FAILURE };
  }

  if (ipHash) await clearLoginAttempts(ipHash);

  // Outside the `try`. `redirect` works by throwing, and catching it here would
  // turn a successful sign-in into the generic failure message.
  redirect(safeNextPath(formData.get('next')));
}

/**
 * Where to land after signing in.
 *
 * The value comes from a query parameter the middleware wrote, which means it
 * also comes from whatever a visitor typed into the address bar — so it is
 * validated rather than trusted. Only a path inside `/admin` is accepted;
 * anything else, including a protocol-relative `//evil.example` that a browser
 * would read as an absolute URL, falls back to the dashboard. An open redirect
 * on a login form is how a convincing phishing link gets built.
 */
function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '/admin';
  if (!value.startsWith('/admin')) return '/admin';
  if (value.startsWith('//')) return '/admin';
  // `/admin/login` would bounce a freshly signed-in person back to the form.
  if (value === '/admin/login' || value.startsWith('/admin/login?')) {
    return '/admin';
  }
  return value;
}
