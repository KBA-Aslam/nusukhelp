import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { BrandIcon } from '@/components/ui/brand-icons';
import { KuficPattern } from '@/components/ui/kufic-pattern';
import { OgeeArchOutline } from '@/components/ui/ogee-arch';
import { COVERAGE_AREAS } from '@/content/services';

import { LeadRule, Section, SectionHeading } from './section';

/**
 * §5 item 6 — coverage. Four areas, "the core B2B differentiator".
 *
 * Rebuilt in Phase 4b (§7, texture amendment). Four identical boxes read as a
 * table of contents rather than a claim about presence on the ground, so each
 * card now carries two things:
 *
 *  - **its own glyph** — the Kaaba for Makkah, the dome for Madinah, the
 *    aircraft for Jeddah, the compass for anywhere else in the Kingdom;
 *  - **a shared ogee arch motif** at low opacity, which is what makes them
 *    read as a set.
 *
 * The arch here is the **third and final** surface for the signature (§7): hero
 * mask, two-division cards, coverage cards. It was removed from these cards in
 * Phase 4 and is restored deliberately, with the cost understood — every extra
 * surface spends some of the device's force.
 *
 * The Kufic lattice sits behind the whole band. The heading block carries its
 * own opaque `bg-sand` and the cards are opaque white, so no text sits over the
 * pattern — a measured constraint, not a stylistic one: `--brass-ink` on sand
 * clears AA by 0.18 and any pattern under it spends more than that. See
 * `kufic-pattern.tsx`.
 */
export function Coverage() {
  const t = useTranslations('coverage');

  return (
    <Section
      tone="sand"
      labelledBy="coverage-heading"
      backdrop={
        <KuficPattern id="coverage" ink="var(--color-brass)" opacity={0.06} />
      }
    >
      {/* Opaque, so the eyebrow never lands on a lattice stroke. */}
      <div className="bg-sand pb-6">
        <SectionHeading
          tone="sand"
          id="coverage-heading"
          eyebrow={t('eyebrow')}
          heading={t('heading')}
        />
      </div>

      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {COVERAGE_AREAS.map((area) => (
          <li
            key={area.id}
            className="relative overflow-hidden rounded-[2px] border border-hairline bg-white p-6"
          >
            {/* Shared motif — what makes four cards a set. */}
            <OgeeArchOutline
              stroke="var(--color-brass)"
              opacity={0.14}
              className="pointer-events-none absolute -end-4 -top-3 h-28 w-auto"
            />

            <div className="relative">
              <LeadRule tone="sand" width="w-8" />
              <span className="mt-4 block text-brass">
                <BrandIcon name={area.id} />
              </span>
              <h3 className="mt-4 font-display text-lg text-ink">
                <Bidi>{t(`areas.${area.id}.name`)}</Bidi>
              </h3>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-slate">
                <Bidi>{t(`areas.${area.id}.detail`)}</Bidi>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
