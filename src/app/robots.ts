import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/**
 * `robots.txt` (§17, §15).
 *
 * Two rules and a sitemap pointer. `/admin` is disallowed because §15 requires
 * it — the route tree does not exist until Phase 8, and having the line in
 * place first means the panel is never briefly crawlable on the day it ships.
 *
 * **`Disallow` is not a security control**, and nothing here is treated as one.
 * It asks well-behaved crawlers not to *index* the admin panel; it does not
 * stop anyone reaching it, and it is a published list of paths. What actually
 * protects `/admin` is the middleware guard plus the independent session and
 * role check in every server action (§15, §12). This line exists so search
 * results never carry a login page, and for no other reason.
 *
 * `/api` is disallowed on the same grounds: the Phase 6 review and enquiry
 * endpoints are for forms, not for readers, and an indexed JSON error response
 * is only ever noise.
 *
 * The sitemap is announced absolutely, at the canonical host — a relative
 * reference is invalid in `robots.txt`, and pointing at the `workers.dev`
 * preview hostname would advertise the duplicate §17 warns about.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
