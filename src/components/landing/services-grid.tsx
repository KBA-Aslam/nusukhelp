import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { BrandIcon } from '@/components/ui/brand-icons';
import { ButtonLink } from '@/components/ui/cta';
import { Section, SectionHeading } from '@/components/ui/section';
import { SERVICES } from '@/content/services';
import { Link } from '@/i18n/navigation';

/**
 * §5 item 4 — the services grid. Seven cards off `content/services.ts`.
 *
 * Six tiles and then card 07, which §5 gives "distinct treatment": the
 * prototype draws it as a full-width ink band under the grid rather than a
 * seventh tile. It stays in the same array and is separated here by
 * `emphasis`, so the count, the order and any future structured data (§17) all
 * still come from one list.
 *
 * The whole card is the link, not just the *Read more* text — a 44px target
 * rule that a phone-first audience notices, and the arrow keeps the affordance
 * visible for everyone else.
 */
export function ServicesGrid() {
  const t = useTranslations('services');

  const cards = SERVICES.filter((service) => service.emphasis === 'card');
  const feature = SERVICES.find((service) => service.emphasis === 'feature');

  return (
    <Section tone="sand" labelledBy="services-heading">
      <SectionHeading
        tone="sand"
        id="services-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
        intro={t('intro')}
      />

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
        {cards.map((service) => (
          <li key={service.id}>
            <Link
              href={service.href}
              className="group flex h-full flex-col rounded-[2px] border border-hairline bg-white p-6 transition-colors hover:border-brass sm:p-7"
            >
              <span className="block text-brass transition-colors group-hover:text-brass-ink">
                <BrandIcon name={service.id} />
              </span>
              <h3 className="mt-5 font-display text-xl text-ink">
                <Bidi>{t(`items.${service.id}.title`)}</Bidi>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                <Bidi>{t(`items.${service.id}.summary`)}</Bidi>
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-verdant">
                <Bidi>{t('readMore')}</Bidi>
                <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Card 07 — B2B. */}
      {feature ? (
        <div className="mt-6 rounded-[2px] bg-ink p-7 sm:p-9 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <p className="flex items-center gap-3 font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-gilt uppercase">
              <span className="text-gilt">
                <BrandIcon name={feature.id} className="h-6 w-6" />
              </span>
              <Bidi>{t('items.b2b.eyebrow')}</Bidi>
            </p>
            <h3 className="mt-3 font-display text-2xl text-white sm:text-[1.625rem]">
              <Bidi>{t('items.b2b.title')}</Bidi>
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-onink lg:text-base">
              <Bidi>{t('items.b2b.summary')}</Bidi>
            </p>
          </div>

          <div className="mt-7 shrink-0 lg:mt-0">
            <ButtonLink href={feature.href} variant="gilt" fullWidthOnMobile>
              {t('items.b2b.cta')}
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </Section>
  );
}
