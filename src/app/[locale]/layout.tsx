import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider, useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import {
  localeDirection,
  localeHtmlLang,
  routing,
  type Locale,
} from '@/i18n/routing';
import { marcellus, plexSans } from '@/lib/fonts';
import { plexArabic } from '@/lib/fonts-arabic';
import { SITE_URL } from '@/lib/site';

import '../globals.css';

/**
 * The public root layout.
 *
 * There is no `app/layout.tsx` above this one. Every public URL is locale
 * prefixed (§6), so the locale segment is the outermost thing there is and this
 * file owns `<html>` — which it has to, because `lang`, `dir` and the font
 * stack all depend on the locale and none of them can be decided a level up.
 *
 * `/admin/*` is deliberately outside this tree. It is English-only, always LTR,
 * and unprefixed, and it will get its own layout in Phase 8.
 */

/**
 * Both locales are prerendered at build time. Combined with `setRequestLocale`
 * below, this keeps the public site fully static: the Worker runs on a cache
 * miss and on revalidation, not on every request (§17).
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t('defaultTitle'),
      template: t('titleTemplate', { page: '%s' }),
    },
    description: t('defaultDescription'),
    // Per-page canonicals, `hreflang` alternates, Open Graph and JSON-LD are
    // Phase 7 (§17). Setting partial alternates here would emit them for every
    // page pointing at the locale root, which is worse than not having them.
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // The middleware only lets known locales through, but a page can also be
  // reached by a direct render during the build. Validate rather than trust.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const typedLocale = locale as Locale;
  const isArabic = typedLocale === 'ar';

  return (
    <html
      lang={localeHtmlLang[typedLocale]}
      dir={localeDirection[typedLocale]}
      className={[
        marcellus.variable,
        plexSans.variable,
        // The Arabic face is attached only on `/ar`. See `fonts-arabic.ts` for
        // why `preload: false` is what actually keeps it off the English pages.
        isArabic ? plexArabic.variable : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* 100dvh, never 100vh — see §20.1. */}
      <body className="flex min-h-dvh flex-col antialiased">
        <NextIntlClientProvider>
          <SkipLink />
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

/**
 * Visible only on keyboard focus. Part of the §7 quality floor, and cheap to
 * get right here rather than retrofit once the landing page has nine sections
 * of navigation ahead of its content.
 */
function SkipLink() {
  const t = useTranslations('skip');

  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-[2px] focus:bg-verdant focus:px-4 focus:text-sm focus:font-semibold focus:text-white"
    >
      {t('toContent')}
    </a>
  );
}
