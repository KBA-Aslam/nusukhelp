'use client';

import { useLocale, useTranslations } from 'next-intl';

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
              <span aria-hidden="true" className="px-1 text-hairline">
                /
              </span>
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
              {localeNames[locale]}
            </Link>
          </span>
        );
      })}
    </div>
  );
}
