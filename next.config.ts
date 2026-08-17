import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Content Security Policy (§15).
 *
 * ## Why `'unsafe-inline'` is in `script-src`, and what would be needed to
 * remove it
 *
 * The App Router bootstraps by inlining the RSC payload as
 * `self.__next_f.push(...)` script elements, whose content changes with every
 * build. Three ways to allow that:
 *
 *  1. **Hashes.** Impossible to maintain — the payload is per page and per
 *     build, so the policy would have to be generated alongside the HTML.
 *  2. **A nonce.** The correct answer on a dynamic site, and the wrong one
 *     here: a nonce must be unique per response, which means generating it in
 *     middleware and rendering the page per request. This site is statically
 *     generated and served from Cloudflare's edge cache (§17); a nonce would
 *     opt every public page out of that, turning a cache hit into a Worker
 *     invocation for every visitor. That trade is not worth making for a
 *     brochure site with no authenticated public surface and no user-generated
 *     HTML.
 *  3. **`'unsafe-inline'`.** What is here.
 *
 * What that leaves is worth being precise about, because "unsafe" reads worse
 * than it is in this context. The directive does not permit loading scripts
 * from anywhere new — `script-src 'self'` still holds, so an injected
 * `<script src>` pointing off-origin is blocked, and so is `eval`. It permits
 * *inline* script, which is only reachable if something already injects markup
 * into the page. The public site renders no user-supplied HTML: every string
 * goes through React's escaping, and the one place raw text meets a script
 * element — the JSON-LD block — escapes `<` explicitly (see
 * `components/seo/json-ld.tsx`).
 *
 * **Phase 8 changes this calculation.** `/admin/*` is authenticated, dynamic
 * and rendered per request, so it can carry a nonce cheaply and should: that is
 * where a stored-XSS bug would actually cost something. The nonce belongs in
 * the admin middleware with a policy of its own, not in this one.
 *
 * **Phase 6 will add hosts.** Turnstile needs `challenges.cloudflare.com` in
 * `script-src` and `frame-src`. It is not listed yet — a policy that permits a
 * host nothing loads from is a policy nobody trusts. Tracked in §19.
 *
 * The rest is the standard hardening set: nothing may frame this site
 * (`frame-ancestors 'none'`, alongside the X-Frame-Options header for older
 * agents), nothing may be embedded as a plugin (`object-src 'none'`), no
 * injected `<base>` may re-root relative URLs (`base-uri 'self'`), and forms
 * may only post to this origin (`form-action 'self'`) — which matters from
 * Phase 6, when there are forms.
 *
 * `img-src` allows `data:` for the inline SVG the components draw, and `blob:`
 * for the Phase 12 PDF preview. `font-src 'self'` alone is enough because
 * `next/font` self-hosts both families — no Google Fonts request is made at
 * runtime.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * HSTS (§15).
 *
 * Two years, subdomains included. **`preload` is deliberately absent.**
 * Submitting to the browser preload list is close to irreversible — removal
 * takes months to propagate through browser releases — and it would bind every
 * future subdomain of `nusukhelp.com` to HTTPS forever, including one the
 * client might stand up on a service that does not do TLS. That is a decision
 * for the client to make knowingly, not one to ship inside a launch commit.
 * Raised in the go-live checklist.
 */
const STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains';

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'Strict-Transport-Security', value: STRICT_TRANSPORT_SECURITY },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    // Nothing on this site uses any of these. Denying them outright means a
    // third-party embed cannot quietly acquire one either.
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

const nextConfig: NextConfig = {
  eslint: {
    // Lint is run explicitly via `npm run lint`; keep builds focused on compiling.
    ignoreDuringBuilds: false,
  },

  /**
   * Response headers (§15).
   *
   * These are applied by the Next routing layer inside the Worker, so they
   * reach every HTML document — including one served from the incremental
   * cache, because the headers are attached to the response as it is built,
   * not fetched from the cache with it.
   *
   * They do **not** reach the files in `.open-next/assets` (`/_next/static/*`,
   * `/images/*`, `/logos/*`). Cloudflare's static-asset layer answers those
   * before the Worker is invoked at all, which is the point of it. That is
   * fine for the policy headers, which govern documents rather than
   * subresources, and `public/_headers` covers the two that are worth setting
   * on an asset — see that file.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
      {
        /**
         * §15 — `noindex, nofollow` on all `/admin/*`.
         *
         * The route tree lands in Phase 8. The header is here now so the panel
         * cannot be briefly crawlable on the day it ships, and because the
         * requirement belongs with the other security headers rather than
         * scattered into a layout's metadata. It costs nothing while there is
         * nothing at `/admin`.
         */
        source: '/admin/:path*',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

// Gives `next dev` access to the Cloudflare bindings declared in wrangler.jsonc
// (DB, NEXT_INC_CACHE_KV, BACKUPS) through getCloudflareContext().
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
void initOpenNextCloudflareForDev();
