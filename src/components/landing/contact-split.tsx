import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { BrandIcon } from '@/components/ui/brand-icons';
import { CONTACT_AUDIENCES } from '@/content/services';
import { whatsappUrl } from '@/lib/site';

import { ArrowLink } from './cta';
import { Section, SectionHeading } from './section';

/**
 * §5 item 9 — contact, split by audience.
 *
 * Pilgrims get the WhatsApp deep link (§14.3: primary in this market), agencies
 * get the B2B enquiry page. The two pre-filled WhatsApp messages are message
 * keys rather than English strings built in code — the pre-fill is copy the
 * reader sees, so it is translated with everything else.
 *
 * The two cards were hard-coded until Phase 4c and now map over
 * `CONTACT_AUDIENCES`, so their ids key their glyphs the same way every other
 * card on the page does. `href: null` means the WhatsApp link, which has to be
 * built at render because it carries a translated message.
 */
export function ContactSplit() {
  const t = useTranslations('contact');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <Section tone="sand" labelledBy="contact-heading">
      <SectionHeading
        tone="sand"
        id="contact-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
      />

      <div className="mt-10 grid gap-5 lg:mt-12 lg:grid-cols-2 lg:gap-6">
        {CONTACT_AUDIENCES.map((audience) => (
          <div
            key={audience.id}
            className="rounded-[2px] border border-hairline bg-white p-7 sm:p-9"
          >
            <span className="block text-brass">
              <BrandIcon name={audience.id} />
            </span>
            <h3 className="mt-5 font-display text-xl text-ink sm:text-[1.375rem]">
              <Bidi>{t(`${audience.id}.title`)}</Bidi>
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              <Bidi>{t(`${audience.id}.body`)}</Bidi>
            </p>
            <ArrowLink
              href={
                audience.href ?? whatsappUrl(tWhatsapp('consultation'))
              }
              className="mt-4 text-verdant hover:text-pine"
            >
              {t(`${audience.id}.cta`)}
            </ArrowLink>
          </div>
        ))}
      </div>
    </Section>
  );
}
