'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { Link, usePathname } from '@/i18n/navigation';
import { localeNames, routing, type Locale } from '@/i18n/routing';

/**
 * en / ar toggle.
 *
 * A client component solely so it can read the current pathname: switching
 * language should keep the reader on the page they are on, not drop them at the
 * homepage. `usePathname` from `@/i18n/navigation` returns the path *without*
 * the locale prefix, and `Link`'s `locale` prop re-adds the other one — so
 * `/en/about` becomes `/ar/about` with no manual string surgery.
 *
 * Rendered as links rather than a select so both locales are crawlable and the
 * pair works with JavaScript disabled.
 */
export function LocaleSwitcher() {
  const active = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations('localeSwitcher');

  return (
    <div
      className="flex items-center"
      role="group"
      aria-label={t('label')}
    >
      {routing.locales.map((locale, index) => {
        const isActive = locale === active;

        return (
          <span key={locale} className="flex items-center">
            {index > 0 ? (
              /* A hairline rule, not a "/" character. A literal slash between
                 an LTR and an RTL run is a bidi neutral with a strong run on
                 either side, so its resolved position depends on the paragraph
                 direction — it is the one separator on the site that would sit
                 differently on `/en` and `/ar`. A zero-text element has no
                 direction to resolve, and a thin rule is what §7 asks for
                 anyway. */
              <span
                aria-hidden="true"
                className="mx-2 h-3 w-px shrink-0 bg-hairline"
              />
            ) : null}
            <Link
              href={pathname}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              aria-current={isActive ? 'true' : undefined}
              aria-label={
                isActive ? undefined : t('switchTo', { language: localeNames[locale] })
              }
              className={[
                'inline-flex min-h-11 items-center px-1 text-sm transition-colors',
                isActive
                  ? 'font-semibold text-ink'
                  : 'text-slate hover:text-verdant',
              ].join(' ')}
            >
              {/* The two names are opposite-direction runs either side of a
                  neutral separator — the one place on the site where both
                  scripts sit on a single line. Without isolation the "/" and
                  the Latin "English" reorder around the Arabic on `/ar`. */}
              <Bidi>{localeNames[locale]}</Bidi>
            </Link>
          </span>
        );
      })}
    </div>
  );
}
