import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { Link } from '@/i18n/navigation';
import {
  EMAIL,
  EMAIL_HREF,
  FOOTER_B2B,
  FOOTER_COMPANY,
  FOOTER_SERVICES,
  LOGO,
  PHONE_DISPLAY,
  PHONE_HREF,
  type NavItem,
} from '@/lib/site';

import { BrandLockup } from './brand-lockup';

/**
 * Public site footer (prototype 02, bottom band).
 *
 * Three jobs, in the order §5 lists them:
 *
 *  1. Services / B2B / Company link columns.
 *  2. The **division line** — this is the one place on the public site outside
 *     `/al-haramain-reservation` where the Al Haramain mark appears, in gilt on
 *     ink, stating the relationship explicitly (§1): *Al Haramain Reservation —
 *     a Nusuk Help B2B service division.*
 *  3. The **affiliation disclaimer**, required sitewide and in both languages.
 *
 * The disclaimer is not decorative small print. §7 names the risk of a site at
 * nusukhelp.com reading as officially connected to the Saudi Ministry of Hajj
 * and Umrah's Nusuk platform as the largest business risk in the project, and
 * this line is its standing mitigation. It renders on every public page because
 * it lives in the layout, not in a page — do not move it into one.
 */
export function SiteFooter() {
  const t = useTranslations();

  return (
    <footer
      aria-label={t('footer.landmarkLabel')}
      className="bg-ink text-onink"
    >
      <div className="mx-auto max-w-[90rem] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-10">
          {/* Brand column */}
          <div>
            <BrandLockup tone="dark" label={t('meta.siteName')} />

            <p className="mt-5 text-[0.8125rem] text-onink-muted">
              <Bidi>{t('footer.tagline')}</Bidi>
            </p>

            {/* One block, not three lines with air between them (Phase 4c).
                The 44px tap targets on the phone and email are kept as padding
                on the links themselves rather than as gaps in the list, so the
                address reads as a single unit while both links stay comfortably
                tappable. The gap to the columns above is unchanged. */}
            <address className="mt-6 text-[0.8125rem] leading-[1.55] not-italic text-onink-muted">
              <p>
                <Bidi>{t('footer.location')}</Bidi>
              </p>
              <p>
                <a
                  href={PHONE_HREF}
                  aria-label={t('footer.phoneLabel', { number: PHONE_DISPLAY })}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-gilt"
                >
                  {/* The leading `+` is a bidi neutral. Unisolated on `/ar` it
                      resolves to the paragraph direction and renders at the
                      wrong end — `966 57 679 9128+`. This one survives the
                      Arabic translation, since the number never changes script. */}
                  <Bidi>{PHONE_DISPLAY}</Bidi>
                </a>
              </p>
              <p>
                <a
                  href={EMAIL_HREF}
                  aria-label={t('footer.emailLabel', { address: EMAIL })}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-gilt"
                >
                  <Bidi>{EMAIL}</Bidi>
                </a>
              </p>
            </address>
          </div>

          <FooterColumn
            heading={t('footer.services.heading')}
            items={FOOTER_SERVICES}
            namespace="footer.services"
          />
          <FooterColumn
            heading={t('footer.b2b.heading')}
            items={FOOTER_B2B}
            namespace="footer.b2b"
          />
          <FooterColumn
            heading={t('footer.company.heading')}
            items={FOOTER_COMPANY}
            namespace="footer.company"
          />
        </div>

        {/* Gilt hairline — the only rule on the ink ground. */}
        <hr className="mt-14 border-0 border-t border-gilt/25 lg:mt-16" />

        {/* Division line + disclaimer */}
        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="flex items-center gap-3.5">
            <Image
              src={LOGO.ahrOnDark.src}
              alt=""
              width={LOGO.ahrOnDark.width}
              height={LOGO.ahrOnDark.height}
              unoptimized
              className="h-9 w-auto opacity-90"
            />
            <span className="flex flex-col">
              <span className="text-[0.8125rem] font-semibold tracking-[0.09em] text-gilt">
                <Bidi>{t('footer.division.name')}</Bidi>
              </span>
              <span className="mt-0.5 text-xs text-onink-muted">
                <Bidi>{t('footer.division.relationship')}</Bidi>
              </span>
            </span>
          </div>

          <p className="max-w-xl text-xs leading-relaxed text-onink-muted lg:text-end">
            <Bidi>{t('footer.disclaimer')}</Bidi>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  items,
  namespace,
}: {
  heading: string;
  items: readonly NavItem[];
  namespace: string;
}) {
  const t = useTranslations(namespace);

  return (
    <nav aria-label={heading}>
      <h2 className="text-[0.6875rem] font-semibold tracking-[0.24em] text-gilt uppercase">
        <Bidi>{heading}</Bidi>
      </h2>
      <ul className="mt-4 space-y-0.5">
        {items.map((item) => (
          <li key={`${item.href}-${item.labelKey}`}>
            <Link
              href={item.href}
              className="inline-flex min-h-9 items-center text-[0.8125rem] text-onink transition-colors hover:text-gilt"
            >
              <Bidi>{t(item.labelKey)}</Bidi>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
