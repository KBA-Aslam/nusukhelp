import type { Metadata } from 'next';

import { marcellus, plexSans } from '@/lib/fonts';

import '../globals.css';

/**
 * The admin root layout.
 *
 * A **second root layout**, sitting beside `app/[locale]/layout.tsx`. There is
 * no `app/layout.tsx` above either of them, and there cannot usefully be one:
 * the public tree decides `lang`, `dir` and its font stack from the locale
 * segment, and this tree is English-only, always LTR, and unprefixed (§4, §6).
 * So each owns its own `<html>`.
 *
 * What this file does *not* contain is the panel chrome. The sidebar, the
 * signed-in user and the session guard live one level down in
 * `(panel)/layout.tsx`, because `/admin/login` and `/admin/accept-invite/[token]`
 * are reached by people who are not signed in and must not render navigation
 * they cannot use.
 */

export const metadata: Metadata = {
  title: {
    default: 'Al Haramain Reservation',
    template: '%s · Al Haramain Reservation',
  },
  /**
   * §15 — `noindex, nofollow` on all `/admin/*`.
   *
   * `next.config.ts` also sets `X-Robots-Tag` on these paths, and the
   * duplication is intended: the header covers everything under `/admin`
   * including route handlers and redirects, this covers the rendered pages,
   * and neither relies on the other having been remembered.
   */
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${marcellus.variable} ${plexSans.variable}`}
    >
      {/* 100dvh, never 100vh — §20.1. The admin panel is a phone product
          first, and this is the rule that keeps a sticky action bar off the
          underside of iOS Safari's toolbar. */}
      <body className="min-h-dvh bg-admin-ground text-slate antialiased">
        {children}
      </body>
    </html>
  );
}
