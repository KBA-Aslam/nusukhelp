import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { COVERAGE_AREAS } from '@/content/services';

import { LeadRule, Section, SectionHeading } from './section';

/**
 * §5 item 6 — coverage. Four areas, "the core B2B differentiator".
 *
 * The prototype leads each card with a small filled ogee arch. That is not
 * built: §7 closes the arch to the hero mask and the two-division cards, and
 * the whole point of a signature device is that it stops being one when it
 * turns up on every card. The cards take the same brass hairline as the rest of
 * the page instead. Recorded against §7 in the spec.
 */
export function Coverage() {
  const t = useTranslations('coverage');

  return (
    <Section tone="sand" labelledBy="coverage-heading">
      <SectionHeading
        tone="sand"
        id="coverage-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
      />

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4 lg:gap-6">
        {COVERAGE_AREAS.map((area) => (
          <li
            key={area.id}
            className="rounded-[2px] border border-hairline bg-white p-6"
          >
            <LeadRule tone="sand" width="w-8" />
            <h3 className="mt-4 font-display text-lg text-ink">
              <Bidi>{t(`areas.${area.id}.name`)}</Bidi>
            </h3>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-slate">
              <Bidi>{t(`areas.${area.id}.detail`)}</Bidi>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
