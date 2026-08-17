import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { ArrowLink } from '@/components/ui/cta';
import { KuficCorners, OgeeArchOutline } from '@/components/ui/ogee-arch';
import { Section, SectionHeading } from '@/components/ui/section';
import { whatsappUrl } from '@/lib/site';

/**
 * §5 item 2 — the two divisions. The signature element.
 *
 * A horizontal split on desktop that **stacks vertically on mobile**, which
 * §20.5 says must be designed for from the start rather than adapted
 * afterwards: the two cards are a grid that collapses to one column, not a
 * flex row with an override.
 *
 * This is the second and last place the ogee arch is allowed to appear (§7) —
 * as a hairline outline in the top-end corner of each card, brass on the light
 * card and gilt on the ink one, exactly as the prototype sets it. The
 * square-Kufic corner brackets from the Al Haramain mark come with it.
 *
 * Note the logo rule holding here without a logo: the Al Haramain *mark* may
 * not appear anywhere on the landing page — only its name does, on the ink
 * card. The mark's public-site surfaces are the footer division line and the
 * reservation page body.
 */
export function TwoDivisions() {
  const t = useTranslations('home.divisions');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <Section tone="sand" labelledBy="divisions-heading">
      <SectionHeading
        tone="sand"
        id="divisions-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
      />

      <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-2 lg:gap-10">
        {/* Pilgrims — Nusuk Help */}
        <DivisionCard
          tone="light"
          eyebrow={t('pilgrims.eyebrow')}
          name={t('pilgrims.name')}
          points={[
            t('pilgrims.points.guidance'),
            t('pilgrims.points.platform'),
            t('pilgrims.points.permits'),
          ]}
          cta={t('pilgrims.cta')}
          href={whatsappUrl(tWhatsapp('consultation'))}
        />

        {/* Agencies — Al Haramain Reservation */}
        <DivisionCard
          tone="dark"
          eyebrow={t('agencies.eyebrow')}
          name={t('agencies.name')}
          points={[
            t('agencies.points.reservations'),
            t('agencies.points.groundHandling'),
            t('agencies.points.rates'),
          ]}
          cta={t('agencies.cta')}
          href="/al-haramain-reservation"
        />
      </div>
    </Section>
  );
}

function DivisionCard({
  tone,
  eyebrow,
  name,
  points,
  cta,
  href,
}: {
  tone: 'light' | 'dark';
  eyebrow: string;
  name: string;
  points: readonly string[];
  cta: string;
  href: string;
}) {
  const dark = tone === 'dark';

  return (
    <div
      className={[
        'relative overflow-hidden rounded-[2px] p-7 sm:p-9',
        dark ? 'bg-ink' : 'border border-hairline bg-white',
      ].join(' ')}
    >
      <KuficCorners stroke={dark ? 'var(--color-gilt)' : 'var(--color-brass)'} />

      {/* The arch. Decorative, inset from the end edge as the prototype places
          it, and never over the text — at 390px it starts below the eyebrow and
          the heading reserves the space beside it, which is what the mobile
          prototype does with a smaller arch further down the card. */}
      <OgeeArchOutline
        stroke={dark ? 'var(--color-gilt)' : 'var(--color-brass)'}
        opacity={0.55}
        className="pointer-events-none absolute end-6 top-12 h-16 w-auto sm:end-8 sm:top-6 sm:h-28"
      />

      <div className="relative">
        <p
          className={`font-sans text-[0.6875rem] font-semibold tracking-[0.24em] uppercase ${
            dark ? 'text-gilt' : 'text-brass-ink'
          }`}
        >
          <Bidi>{eyebrow}</Bidi>
        </p>

        <h3
          className={`mt-4 pe-16 font-display text-2xl sm:pe-0 sm:text-[1.6875rem] ${
            dark ? 'text-white' : 'text-ink'
          }`}
        >
          <Bidi>{name}</Bidi>
        </h3>

        <ul className={`mt-5 space-y-2 text-sm ${dark ? 'text-onink' : 'text-slate'}`}>
          {points.map((point) => (
            <li key={point} className="flex gap-2.5">
              {/* An em dash as a list marker is decoration; the list semantics
                  carry the meaning, so it is hidden from assistive tech. */}
              <span aria-hidden="true" className={dark ? 'text-gilt' : 'text-brass'}>
                —
              </span>
              <Bidi>{point}</Bidi>
            </li>
          ))}
        </ul>

        <ArrowLink
          href={href}
          className={`mt-6 ${dark ? 'text-gilt hover:text-brass' : 'text-verdant hover:text-pine'}`}
        >
          {cta}
        </ArrowLink>
      </div>
    </div>
  );
}
