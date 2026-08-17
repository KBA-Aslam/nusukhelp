import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { whatsappUrl } from '@/lib/site';

import { ArrowLink } from './cta';
import { LeadRule, Section, SectionHeading } from './section';

/**
 * §5 item 9 — contact, split by audience.
 *
 * Pilgrims get the WhatsApp deep link (§14.3: primary in this market), agencies
 * get the B2B enquiry page, and the two pre-filled WhatsApp messages are
 * message keys rather than English strings built in code — the pre-fill is copy
 * the reader sees, so it is translated with everything else.
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
        <ContactCard
          title={t('pilgrims.title')}
          body={t('pilgrims.body')}
          cta={t('pilgrims.cta')}
          href={whatsappUrl(tWhatsapp('consultation'))}
        />
        <ContactCard
          title={t('agencies.title')}
          body={t('agencies.body')}
          cta={t('agencies.cta')}
          href="/b2b"
        />
      </div>
    </Section>
  );
}

function ContactCard({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-[2px] border border-hairline bg-white p-7 sm:p-9">
      <LeadRule tone="sand" />
      <h3 className="mt-5 font-display text-xl text-ink sm:text-[1.375rem]">
        <Bidi>{title}</Bidi>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate">
        <Bidi>{body}</Bidi>
      </p>
      <ArrowLink href={href} className="mt-4 text-verdant hover:text-pine">
        {cta}
      </ArrowLink>
    </div>
  );
}
