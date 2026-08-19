import { getCloudflareContext } from '@opennextjs/cloudflare';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { drizzle } from 'drizzle-orm/d1';

import * as schema from '@/db/schema';
import type { Role } from '@/lib/roles';
import { secretFrom } from '@/lib/server-env';
import { SITE_URL } from '@/lib/site';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@/lib/validation/auth';

/**
 * Better Auth — email and password, invite only (§12).
 *
 * ## Why this is a function and not a module-level constant
 *
 * Every Better Auth tutorial exports `export const auth = betterAuth({...})`.
 * That cannot work here: the adapter needs the D1 binding, and on Workers the
 * binding lives on the request's `env`, which does not exist while modules are
 * being evaluated. So the instance is built from the `env` in hand and
 * **memoised per isolate** in a `WeakMap` keyed on that object — Workers hands
 * the same `env` to every request an isolate serves, so in practice the
 * construction cost is paid once per isolate rather than once per request, and
 * the map holds nothing alive that the runtime was going to keep anyway.
 *
 * ## Better Auth's HTTP endpoints are **not mounted**
 *
 * Every tutorial mounts `app/api/auth/[...all]/route.ts` and forwards requests
 * to `auth.handler`. There is no such route here, and its absence is a
 * deliberate part of §12 rather than an omission.
 *
 * Nothing in this project needs it. §4 requires all admin mutations to be
 * Server Actions, and they are: sign-in, sign-out and accepting an invite all
 * call `auth.api.*` directly, in process, and the `nextCookies` plugin below
 * puts the cookies where Next expects them. No Better Auth *client* is created
 * anywhere in the codebase, so nothing on the browser side ever addresses these
 * URLs.
 *
 * What mounting it would cost is concrete. §12's login rate limit lives in the
 * sign-in server action; a reachable `POST /api/auth/sign-in/email` is a second
 * door to the same check that does not have it, which makes the limit
 * decorative — an attacker who found the endpoint would simply use it. It would
 * also expose sign-out, get-session, and the password-reset endpoints of a flow
 * this project does not have.
 *
 * `basePath` is still set. It is what Better Auth builds cookie paths and
 * origin checks from; it does not require a route to exist behind it.
 *
 * ## Sign-up is off, and that is the whole access model
 *
 * `disableSignUp: true` closes the sign-up endpoint at the library level, so it
 * stays closed however it is reached — including from this project's own code.
 * There is no public registration route because there is no way to register at
 * all: the first account comes from the seed script (`scripts/seed-admin.mjs`)
 * and every account after it from an invitation an existing admin sent
 * (`/admin/settings/users`). Accepting an invitation writes the user through
 * the internal adapter rather than through sign-up — see
 * `app/admin/(auth)/accept-invite/[token]/actions.ts`.
 */

/**
 * Session lifetime (§12 — *7-day rolling expiry*).
 *
 * `updateAge` is what makes it rolling: any request more than a day after the
 * session was last written pushes `expiresAt` out to a fresh seven days, so
 * someone using the panel daily is never signed out, while an abandoned session
 * on a shared phone dies a week after its last use. A day is the interval
 * rather than every request because each renewal is a D1 write.
 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

type AuthInstance = ReturnType<typeof buildAuth>;

const instances = new WeakMap<object, AuthInstance>();

function buildAuth(env: CloudflareEnv) {
  const secret = secretFrom(env, 'BETTER_AUTH_SECRET');
  const baseURL = secretFrom(env, 'BETTER_AUTH_URL') ?? SITE_URL;

  if (!secret) {
    /**
     * Fails closed, loudly (§15, and the same rule as `lib/server-env.ts`).
     *
     * Better Auth will happily fall back to a generated secret if none is
     * given, and a generated secret is different in every isolate — sessions
     * would be signed by one Worker instance and rejected by the next, which
     * presents as an intermittent, unreproducible "you were signed out". A
     * deploy missing this secret must not start, so that the failure is a
     * five-hundred with a clear message rather than a mystery.
     */
    throw new Error(
      'BETTER_AUTH_SECRET is not set. Run `npx wrangler secret put BETTER_AUTH_SECRET` — see docs/SECRETS.md.',
    );
  }

  return betterAuth({
    appName: 'Al Haramain Reservation',
    secret,
    baseURL,
    basePath: '/api/auth',

    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: 'sqlite',
      schema,
    }),

    emailAndPassword: {
      enabled: true,
      // See the note at the top of this file. This is the access model.
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      // The panel has no "forgot password" flow. An admin re-invites instead,
      // which is one code path rather than two and keeps every account creation
      // and recovery visible in `admin_invites`.
      requireEmailVerification: false,
    },

    user: {
      additionalFields: {
        /**
         * `input: false` on both, and it matters.
         *
         * It stops either field being set from a request body. Without it a
         * crafted sign-up or update-user payload carrying `role: "admin"` would
         * be written straight through — the classic mass-assignment escalation.
         * Roles are set by the invite an admin created and by the role action
         * on `/admin/settings/users`, both of which write through the server
         * with an explicit value.
         */
        role: { type: 'string', required: false, input: false },
        isActive: { type: 'boolean', required: false, input: false },
      },
    },

    session: {
      expiresIn: SESSION_MAX_AGE_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      /**
       * No cookie cache — deliberately.
       *
       * Caching the session in a signed cookie saves a D1 read per request, at
       * the price of a stale copy of the user row for the cache's lifetime.
       * That is exactly the wrong trade here: deactivating an account and
       * demoting a role are the two things §12 asks for, and both must take
       * effect on the next request, not up to five minutes later. The read is
       * one indexed lookup.
       */
      cookieCache: { enabled: false },
    },

    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      },
      /**
       * Cloudflare's own header, not `X-Forwarded-For` (§15, and the same
       * reasoning as `lib/request-guards.ts`): the edge sets it and a client
       * cannot spoof it. It is recorded on the session row so an admin can
       * recognise a session they do not know.
       */
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'],
      },
    },

    /**
     * Better Auth's own limiter is off; ours is in
     * `db/queries/login-attempts.ts` and is enforced by the login action.
     *
     * Two reasons. Its default storage is process memory, and a Worker isolate
     * is created and discarded freely — five attempts per isolate is not a
     * limit. Its database storage keys on the raw IP address, which §15 says
     * this project does not store.
     */
    rateLimit: { enabled: false },

    // Nothing about this deployment should be reported anywhere. It is also a
    // network call the Worker would otherwise make on cold start.
    telemetry: { enabled: false },

    trustedOrigins: [baseURL],

    /**
     * `nextCookies` must be last in the list.
     *
     * It hooks the end of the response pipeline and copies Better Auth's
     * `Set-Cookie` headers onto Next's cookie store, which is what lets the
     * login **server action** establish a session — a server action returns a
     * value, not a `Response`, so without this the session cookie would be set
     * on a response nobody sees. §12 requires all admin mutations to be server
     * actions, so this is load-bearing rather than a convenience.
     */
    plugins: [nextCookies()],
  });
}

/**
 * The request's Better Auth instance.
 *
 * Async because `getCloudflareContext({ async: true })` is the accessor that
 * also works outside a request, which is where the build's module tracing
 * evaluates things. The synchronous one throws there.
 */
export async function getAuth(): Promise<AuthInstance> {
  const { env } = await getCloudflareContext({ async: true });

  const cached = instances.get(env);
  if (cached) return cached;

  const auth = buildAuth(env);
  instances.set(env, auth);
  return auth;
}

/** The session shape the admin panel works with, once narrowed by the guard. */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
};
