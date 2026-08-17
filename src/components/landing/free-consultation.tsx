import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/cta';
import { KuficPattern } from '@/components/ui/kufic-pattern';
import { CONTAINER } from '@/components/ui/section';
import { whatsappUrl } from '@/lib/site';

/**
 * §5 item 3 — the free consultation block.
 *
 * "A full-width feature section, not a card. This is the strongest conversion
 * opportunity on the site." One CTA, and it is WhatsApp: §14.3 makes the
 * WhatsApp deep link the primary contact action in this market and the form the
 * fallback.
 *
 * Two copy rules bind here, both from Appendix A:
 *
 *  - **"Free" stays unqualified.** No asterisk, no "terms apply", no condition
 *    of any kind attached to the word. If a condition ever attaches, the copy
 *    changes with it.
 *  - **The affiliation disclaimer repeats here.** §7 requires it in the footer
 *    *and* in the consultation block — this is the block where a reader is
 *    closest to believing the company acts for Nusuk, so it is exactly where
 *    the disclaimer earns its place. It reads the same `footer.disclaimer` key
 *    the footer does, so the legally reviewed wording (§19 item 1) can never be
 *    updated in one place and missed in the other.
 */
export function FreeConsultation() {
  const t = useTranslations('home.consultation');
  const tFooter = useTranslations('footer');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <section
      className="relative isolate overflow-hidden bg-pine"
      aria-labelledby="consultation-heading"
    >
      {/* Kufic lattice — the first of the two surfaces §7 permits it on. The
          panel below is opaque, so every string in this block sits on a clean
          ground; the pattern shows in the band around it. */}
      <KuficPattern id="consultation" ink="var(--color-gilt)" opacity={0.06} />

      <div className={`relative ${CONTAINER} py-14 lg:py-20`}>
        <div className="rounded-[2px] bg-panel-deep px-6 py-12 text-center sm:px-12 lg:py-16">
          <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-gilt uppercase">
            <Bidi>{t('eyebrow')}</Bidi>
          </p>

          <h2
            id="consultation-heading"
            className="mx-auto mt-5 max-w-3xl font-display text-[2rem] leading-[1.15] text-white sm:text-[2.75rem]"
          >
            <Bidi>{t('heading')}</Bidi>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-onink">
            <Bidi>{t('body')}</Bidi>
          </p>

          <div className="mt-9 flex justify-center">
            <ButtonLink
              href={whatsappUrl(tWhatsapp('consultation'))}
              variant="gilt"
              fullWidthOnMobile
            >
              {t('cta')}
            </ButtonLink>
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-xs leading-relaxed text-onink-muted">
            <Bidi>{tFooter('disclaimer')}</Bidi>
          </p>
        </div>
      </div>
    </section>
  );
}
