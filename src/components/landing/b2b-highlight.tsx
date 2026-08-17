import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { BrandIcon } from '@/components/ui/brand-icons';
import { ButtonLink } from '@/components/ui/cta';
import { Section, SectionHeading } from '@/components/ui/section';
import { B2B_PILLARS } from '@/content/services';

/**
 * §5 item 7 — the B2B highlight. Six pillars and a *Become our partner* CTA.
 *
 * **This is the one section with no prototype.** `02-landing-desktop.svg` draws
 * eight bands where §5 lists nine: it folds the B2B highlight into service card
 * 07 and heads the six-point section "Why agencies choose us". §5 asks for
 * both, so this is built to the spec and its copy is new — it needs a copy
 * review before go-live, and is flagged in §5 of the spec.
 *
 * Two deliberate choices, both to keep it from reading as a repeat of the two
 * sections it sits between:
 *
 *  - **Mist, not ink.** Every other B2B moment on this page is dark, and the
 *    reviews band immediately below is ink — two dark bands in a row would read
 *    as one long band with a seam.
 *  - **Capabilities, not claims.** Appendix A forbids absolute promises about
 *    availability, pricing or outcomes, so the pillars describe what the
 *    company does, one of them carries "subject to availability", and none
 *    claims privileged access to anything official.
 */
export function B2bHighlight() {
  const t = useTranslations('b2bHighlight');

  return (
    <Section tone="mist" labelledBy="b2b-heading">
      <SectionHeading
        tone="mist"
        id="b2b-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
        intro={t('body')}
        action={
          <ButtonLink href="/b2b" variant="primary" fullWidthOnMobile>
            {t('cta')}
          </ButtonLink>
        }
      />

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
        {B2B_PILLARS.map((pillar) => (
          <li
            key={pillar.id}
            className="rounded-[2px] border border-hairline bg-white p-6 sm:p-7"
          >
            <span className="block text-brass">
              <BrandIcon name={pillar.id} />
            </span>
            <h3 className="mt-4 text-[1.0625rem] font-semibold text-ink">
              <Bidi>{t(`pillars.${pillar.id}.title`)}</Bidi>
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              <Bidi>{t(`pillars.${pillar.id}.body`)}</Bidi>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
