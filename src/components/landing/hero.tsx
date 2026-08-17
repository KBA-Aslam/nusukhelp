import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import {
  HERO_PANEL_ASPECT,
  OgeeArchClipDefs,
  OgeeArchMask,
  OgeeArchPanelOutline,
} from '@/components/ui/ogee-arch';
import { whatsappUrl } from '@/lib/site';

import { ArrowLink, ButtonLink } from './cta';
import { CONTAINER } from './section';

/**
 * §5 item 1 — hero. Ink band, three CTAs, arch-masked panel.
 *
 * The three CTAs are ranked, not equal: *Free consultation* is the conversion
 * path and takes the filled button, *Explore services* moves down the page, and
 * *Al Haramain Reservation* leaves for the B2B side with a line of explanation
 * under it. The mobile prototype draws only the first — but §5 specifies three,
 * so the other two stack below it rather than disappearing on a phone, which is
 * where most of this traffic actually is.
 *
 * The panel is a **solid colour block at the correct aspect ratio**, per §19's
 * placeholder rule: photography is open item 6, and a wrong-ratio placeholder
 * would hide the layout bugs a placeholder exists to expose. It is decorative
 * until then, so it carries no alt text — when the photograph lands it becomes
 * an `<Image>` and needs one.
 */
export function Hero() {
  const t = useTranslations('home.hero');
  const tCta = useTranslations('cta');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <section className="bg-ink" aria-labelledby="hero-title">
      <OgeeArchClipDefs />

      <div
        className={`${CONTAINER} grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16 lg:py-20`}
      >
        <div className="max-w-2xl">
          <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-gilt uppercase">
            <Bidi>{t('eyebrow')}</Bidi>
          </p>

          <h1
            id="hero-title"
            className="mt-6 font-display text-[2.25rem] leading-[1.12] text-white sm:text-5xl lg:text-[3.875rem]"
          >
            {/* One key, one string — the gilt second clause is markup inside
                the message, not a second message. A translator moves the tags
                with the words; two keys would have let the halves drift. */}
            <Bidi>
              {t.rich('title', {
                gilt: (chunks) => (
                  <span className="text-gilt">{chunks}</span>
                ),
              })}
            </Bidi>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-onink lg:text-[1.0625rem]">
            <Bidi>{t('body')}</Bidi>
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <ButtonLink
              href={whatsappUrl(tWhatsapp('consultation'))}
              variant="primary"
              fullWidthOnMobile
            >
              {tCta('freeConsultation')}
            </ButtonLink>
            <ButtonLink
              href="/al-haramain-reservation"
              variant="outlineOnDark"
              fullWidthOnMobile
            >
              {t('exploreServices')}
            </ButtonLink>
          </div>

          <ArrowLink
            href="/al-haramain-reservation"
            className="mt-8 text-gilt hover:text-brass"
            sublabel={
              <span className="text-[0.8125rem] text-onink-muted">
                <Bidi>{t('divisionNote')}</Bidi>
              </span>
            }
          >
            {t('divisionLink')}
          </ArrowLink>
        </div>

        {/* Photography placeholder — open item 6. */}
        <div
          className={`relative mx-auto w-full max-w-[17rem] sm:max-w-[21.5rem] lg:mx-0 lg:w-[26.875rem] ${HERO_PANEL_ASPECT}`}
        >
          <OgeeArchMask className="h-full w-full bg-panel" />
          <OgeeArchPanelOutline className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    </section>
  );
}
