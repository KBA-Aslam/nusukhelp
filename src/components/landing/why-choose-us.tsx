import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { BrandIcon } from '@/components/ui/brand-icons';
import { Section, SectionHeading } from '@/components/ui/section';
import { WHY_CHOOSE_US } from '@/content/services';

/**
 * §5 item 5 — six points on a mist band.
 *
 * §5 calls these "icon-led"; the prototype leads each one with a 34px brass
 * hairline and no icon at all. The rule is what is built — see the note in
 * `content/services.ts`. It is decorative either way, so the points stay
 * legible with it stripped out.
 */
export function WhyChooseUs() {
  const t = useTranslations('whyChooseUs');

  return (
    <Section tone="mist" labelledBy="why-heading">
      <SectionHeading
        tone="mist"
        id="why-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
      />

      <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-12">
        {WHY_CHOOSE_US.map((point) => (
          <li key={point.id}>
            <span className="block text-brass">
              <BrandIcon name={point.id} />
            </span>
            <h3 className="mt-4 text-[1.0625rem] font-semibold text-ink">
              <Bidi>{t(`points.${point.id}.title`)}</Bidi>
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate">
              <Bidi>{t(`points.${point.id}.body`)}</Bidi>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
