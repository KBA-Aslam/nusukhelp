import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

/**
 * Two middlewares in one file, because Next allows exactly one.
 *
 * `/admin/*` gets the §12 guard and its own Content-Security-Policy; everything
 * else gets next-intl's locale routing, unchanged from Phase 3. The branch is
 * on the pathname and the two never meet: running the i18n middleware over an
 * admin URL would rewrite it to `/en/admin/*`, and the admin panel is outside
 * the locale tree by design (§4, §6).
 */

const intlMiddleware = createMiddleware(routing);

/* --------------------------------------------------------------------------
   Admin
   -------------------------------------------------------------------------- */

/** Reachable without a session — the two ways *in* (§4). */
const PUBLIC_ADMIN_PREFIXES = ['/admin/login', '/admin/accept-invite'];

/**
 * The **first** of §12's two enforcement layers, and explicitly not the one
 * that enforces.
 *
 * `getSessionCookie` reads the cookie and checks that it is there. It does not
 * validate the signature and it does not go to the database — deliberately:
 * middleware runs on every admin request, and a D1 round trip here would be
 * paid again a moment later by the page that also has to check properly. What
 * this buys is that a signed-out visitor gets a login screen instead of a
 * flash of the panel's chrome followed by a redirect.
 *
 * Anyone holding a stale or forged cookie gets past this and is stopped by
 * `requirePageAccess` / `requireCapability` (`lib/auth-guard.ts`), which read
 * the session row and the user's role and are where the actual boundary is.
 * Server actions are directly invocable and never see this file at all.
 */
function guardAdmin(request: NextRequest, nonce: string): NextResponse {
  const { pathname, search } = request.nextUrl;

  const isPublicAdminRoute = PUBLIC_ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isPublicAdminRoute && !getSessionCookie(request)) {
    const login = new URL('/admin/login', request.url);
    // Where they were going, so the login screen can send them back there. The
    // value is validated as a same-origin admin path before it is used — see
    // `safeNextPath` in the login action.
    login.searchParams.set('next', `${pathname}${search}`);
    return withAdminHeaders(NextResponse.redirect(login), nonce);
  }

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  // `next/headers` exposes headers but never the pathname, and
  // `requirePageAccess` needs it to build the same `?next=` when it is the
  // layer that turns a visitor away.
  headers.set('x-admin-path', `${pathname}${search}`);
  headers.set('Content-Security-Policy', adminCsp(nonce));

  return withAdminHeaders(
    NextResponse.next({ request: { headers } }),
    nonce,
  );
}

/**
 * The admin Content-Security-Policy (§15).
 *
 * The public site runs `script-src 'self' 'unsafe-inline'`, and `next.config.ts`
 * explains at length why: a nonce has to be unique per response, which means
 * rendering per request, and the public pages are statically generated and
 * cache-served. **The admin panel is the opposite case on every count.** It is
 * authenticated, it is dynamic already, nothing about it is cacheable, and it
 * is the only surface where a stored-XSS bug would reach booking data and
 * customer records. So it gets the strict policy the public site cannot afford.
 *
 * The nonce reaches Next's own bootstrap scripts by being on the **request**
 * header: Next parses `Content-Security-Policy` off the incoming request, finds
 * the `nonce-` value, and stamps it on every script tag it renders. That is why
 * `guardAdmin` sets the header in both directions.
 *
 * `style-src` keeps `'unsafe-inline'`. React writes inline `style` attributes,
 * and an attribute cannot carry a nonce; CSP Level 3's `'unsafe-hashes'` would
 * be the alternative and buys nothing here, since the threat this policy is
 * built against is script execution.
 */
function adminCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    // `blob:` is for the Phase 12 invoice PDF, which is rendered in the
    // browser and previewed from an object URL.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * The response headers `/admin/*` carries.
 *
 * `next.config.ts` sets the rest of the security headers for every path and the
 * `X-Robots-Tag` for this one; what cannot live there is the CSP, because it
 * changes per response. The header set here is the same policy the request
 * carried, so the browser enforces exactly what Next rendered against.
 */
function withAdminHeaders(
  response: NextResponse,
  nonce: string,
): NextResponse {
  response.headers.set('Content-Security-Policy', adminCsp(nonce));
  return response;
}

/* --------------------------------------------------------------------------
   Entry point
   -------------------------------------------------------------------------- */

export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    return guardAdmin(request, crypto.randomUUID());
  }

  return intlMiddleware(request);
}

export const config = {
  /**
   * Public routes **and** `/admin/*`.
   *
   * Phase 3's matcher excluded `admin` because nothing was there yet and
   * next-intl would have rewritten those URLs into the locale tree. Now that
   * the branch above keeps the two apart, admin has to be matched — it is the
   * half of the path that needs a middleware at all.
   *
   * `api`, `_next`, `_vercel` and anything with a file extension stay excluded,
   * so this never runs for build assets or the files in `public/`. The only
   * routes under `/api` are the two public form endpoints; Better Auth's own
   * HTTP endpoints are not mounted at all, for the reasons set out in
   * `lib/auth.ts`.
   */
  matcher: ['/admin/:path*', '/((?!api|admin|_next|_vercel|.*\\..*).*)'],
};
