import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { Link } from '@/i18n/navigation';
import { PRIMARY_NAV, whatsappUrl } from '@/lib/site';

import { BrandLockup } from './brand-lockup';
import { LocaleSwitcher } from './locale-switcher';
import { MobileNav } from './mobile-nav';

/**
 * Public site header (prototype 02, top band).
 *
 * Nusuk Help lockup only. §7: *the division mark never appears in the public
 * site header* — Al Haramain surfaces in the footer division line, on its own
 * page body, in the admin panel and on the invoice, and nowhere else.
 *
 * Sand ground with a single hairline rule beneath it, per the "everything stays
 * flat" rule: no shadow, no blur, no colour change on scroll.
 */
export function SiteHeader() {
  const t = useTranslations();

  return (
    <header className="relative border-b border-hairline bg-sand">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-6 px-5 sm:px-8 lg:h-22 lg:px-12">
        <BrandLockup
          tone="light"
          href="/"
          label={t('header.homeLabel')}
          eyebrow={t('header.eyebrow')}
        />

        <nav
          aria-label={t('header.primaryNavLabel')}
          className="ms-auto hidden lg:block"
        >
          <ul className="flex items-center gap-8">
            {PRIMARY_NAV.map((item) => (
              <li key={item.labelKey}>
                <Link
                  href={item.href}
                  className="text-sm text-slate transition-colors hover:text-verdant"
                >
                  <Bidi>{t(`nav.${item.labelKey}`)}</Bidi>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-5 lg:ms-0">
          <div className="hidden lg:block">
            <LocaleSwitcher />
          </div>

          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden min-h-11 items-center rounded-[2px] bg-verdant px-6 text-sm font-semibold tracking-[0.03em] text-white transition-colors hover:bg-pine lg:inline-flex"
          >
            <Bidi>{t('cta.freeConsultation')}</Bidi>
          </a>

          <MobileNav />
        </div>
      </div>
    </header>
  );
}
