import { defineRouting } from 'next-intl/routing';

/**
 * Locale routing (§6).
 *
 * `localePrefix: 'always'` is the whole point: every public URL carries its
 * locale, so `/` redirects to `/en` and there is no unprefixed variant of a
 * page competing with it for the same content. That keeps the `hreflang`
 * alternates and canonicals in §17 unambiguous — one URL per page per locale.
 *
 * `localeDetection: false` because a pilgrim landing on the site from an
 * Arabic-speaking country still gets `/en` unless they ask for Arabic. Silent
 * redirection based on `Accept-Language` produces cached pages under the wrong
 * locale at the edge and makes shared links behave differently per visitor.
 *
 * Admin is deliberately absent from this config. `/admin/*` is English-only and
 * unprefixed (§6), and the middleware matcher below excludes it outright.
 */
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

/** Text direction per locale. Arabic is the only RTL locale (§6). */
export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

/** Native names, used by the locale switcher — each shown in its own script. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

/** BCP 47 tags for `<html lang>` and `hreflang` alternates. */
export const localeHtmlLang: Record<Locale, string> = {
  en: 'en',
  ar: 'ar',
};
