import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Locale-aware navigation primitives. Import `Link` from here — never from
 * `next/link` — in anything under `/[locale]`, or the locale prefix is dropped
 * and the link silently bounces through the middleware redirect.
 *
 * `/admin/*` is outside the locale tree and keeps using `next/link` directly.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
