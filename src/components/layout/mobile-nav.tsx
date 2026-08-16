'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { PRIMARY_NAV, whatsappUrl } from '@/lib/site';

import { LocaleSwitcher } from './locale-switcher';

/**
 * Small-screen navigation.
 *
 * A disclosure rather than a full-screen modal: the panel pushes down under the
 * header and the page keeps scrolling behind it. That avoids the scroll-lock
 * plumbing a modal needs, which is the usual source of the iOS Safari bug where
 * the body jumps to the top when the overlay closes (§20.1).
 *
 * Every control here is at least 44px tall (§20.3).
 */
export function MobileNav() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();

  // Close after navigating. The panel is rendered inside a layout that
  // survives route changes, so nothing else would close it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t('header.closeMenu') : t('header.openMenu')}
        className="-me-2 flex h-11 w-11 items-center justify-center rounded-[2px] lg:hidden"
      >
        <span aria-hidden="true" className="flex w-6 flex-col gap-[5px]">
          <span className="h-[1.6px] w-full bg-ink" />
          <span className="h-[1.6px] w-full bg-ink" />
          <span className="h-[1.6px] w-full bg-ink" />
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full z-40 border-b border-hairline bg-sand lg:hidden"
        >
          <nav aria-label={t('header.primaryNavLabel')} className="px-5 py-2">
            <ul className="flex flex-col">
              {PRIMARY_NAV.map((item) => (
                <li key={item.labelKey} className="border-b border-hairline/70 last:border-b-0">
                  <Link
                    href={item.href}
                    className="flex min-h-12 items-center text-[0.9375rem] text-slate"
                  >
                    {t(`nav.${item.labelKey}`)}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 py-4">
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-center rounded-[2px] bg-verdant px-5 text-sm font-semibold tracking-[0.03em] text-white"
              >
                {t('cta.freeConsultation')}
              </a>
              <LocaleSwitcher />
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
