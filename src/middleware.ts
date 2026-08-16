import createMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  /**
   * Public routes only.
   *
   * The negative lookahead excludes `admin` deliberately: §6 puts the admin
   * panel outside the locale tree entirely, and §12 gives it its own auth
   * middleware in Phase 8. Running the i18n middleware over `/admin/*` would
   * rewrite those URLs to `/en/admin/*` and break the auth guard before it is
   * even written.
   *
   * `_next`, `_vercel`, and anything with a file extension are excluded so the
   * middleware never runs for build assets or the static files in `public/`.
   */
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
};
