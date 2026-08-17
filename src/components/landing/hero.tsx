import { useTranslations } from 'next-intl';

import Image from 'next/image';

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
 * The panel now carries the photograph (§19 item 6, closed) behind the ogee
 * mask. It is not decoration — it is the one image on the page and it names a
 * real place — so it takes a described `alt` from the message catalogue rather
 * than `alt=""`, and the description is translated with everything else.
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

        {/*
          The photograph — §19 open item 6, closed. Masjid an-Nabawi's courtyard
          umbrellas at night, supplied by the client under the Unsplash licence
          (§7): commercial use, no attribution, no ShareAlike.

          Cropped 1024×1191 from a 1024×1536 portrait source — top-anchored, so
          the umbrella fan's radial geometry sits under the arch apex and the
          weakest band (bottom marble foreground) is what gets dropped. Served
          at 860×1000 WebP, 146 KB: twice the 430px panel, which is all the
          resolution the panel can use.

          `unoptimized` per §17 — the file is already sized and encoded for its
          one job, and Cloudflare's image product is paid. The Kufic lattice
          that stood in here is gone, as §7 said it would be when the image
          landed.

          The ink tint is 0.60. Note what it is *not* doing: no text sits over
          this panel in either layout — on `lg` it is a separate grid column, and
          below `lg` it sits under the copy — so the tint is there to seat the
          photograph in the ink band, not to rescue contrast. The measured
          numbers are in the Phase 4c note in §7.
        */}
        <div
          className={`relative mx-auto w-full max-w-[17rem] sm:max-w-[21.5rem] lg:mx-0 lg:w-[26.875rem] ${HERO_PANEL_ASPECT}`}
        >
          <OgeeArchMask className="relative h-full w-full overflow-hidden bg-panel">
            <Image
              src="/images/hero-madinah.webp"
              alt={t('imageAlt')}
              width={860}
              height={1000}
              priority
              unoptimized
              className="h-full w-full object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-ink opacity-60"
            />
          </OgeeArchMask>
          <OgeeArchPanelOutline className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    </section>
  );
}
