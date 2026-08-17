import type { Metadata } from 'next';

import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ClosingCta } from '@/components/pages/closing-cta';
import { PageHeader } from '@/components/pages/page-header';
import { Bidi } from '@/components/ui/bidi';
import { BrandIcon } from '@/components/ui/brand-icons';
import { ButtonLink } from '@/components/ui/cta';
import { Section, SectionHeading } from '@/components/ui/section';
import { B2B_STEPS } from '@/content/pages';
import { B2B_PILLARS, RESERVATION_SERVICES } from '@/content/services';
import { Link } from '@/i18n/navigation';
import { whatsappUrl } from '@/lib/site';

/**
 * `/b2b` — travel agency partnership (§4).
 *
 * ## What is new here and what is borrowed
 *
 * The landing page's B2B highlight (§5 item 7) is the summary; this is the
 * page. So the two share their substance rather than restating it:
 *
 *  - **What we handle** maps `RESERVATION_SERVICES` and reads
 *    `services.items.<id>.title | summary` — the same six strings as the
 *    landing cards, the footer column and the jump list on the reservation
 *    page. A renamed service changes once.
 *  - **What a partnership gives you** maps `B2B_PILLARS` and reads
 *    `b2bHighlight.pillars.*`, the landing band's own copy. Duplicating those
 *    six paragraphs under a `b2b.*` key would guarantee that one copy gets
 *    edited and the other does not, and the reader would find the company
 *    describing itself two ways.
 *
 * Genuinely new: the four-step process, and the confidential-documentation
 * band — the §10 invoice style stated plainly, which is the most concrete
 * thing this company offers an agency and has nowhere else to be said at
 * length.
 *
 * ## Appendix A
 *
 * No promise about rates, availability or turnaround. Step 2 says a person
 * checks availability rather than implying an instant confirmation, and the
 * closing band offers to say no.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'b2b.meta' });

  return { title: t('title'), description: t('description') };
}

export default async function B2bPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <B2bHeader />
      <WhatWeHandle />
      <HowItWorks />
      <Benefits />
      <ConfidentialDocumentation />
      <B2bClose />
    </>
  );
}

function B2bHeader() {
  const t = useTranslations('b2b');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <PageHeader
      eyebrow={t('eyebrow')}
      title={t('title')}
      lead={t('lead')}
      actions={
        <>
          <ButtonLink
            href={whatsappUrl(tWhatsapp('b2b'))}
            variant="gilt"
            fullWidthOnMobile
          >
            {t('cta')}
          </ButtonLink>
          <ButtonLink
            href="/al-haramain-reservation"
            variant="outlineOnDark"
            fullWidthOnMobile
          >
            {t('servicesCta')}
          </ButtonLink>
        </>
      }
    />
  );
}

function WhatWeHandle() {
  const t = useTranslations('b2b.handle');
  const tServices = useTranslations('services');

  return (
    <Section tone="sand" labelledBy="handle-heading">
      <SectionHeading
        tone="sand"
        id="handle-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
        intro={t('intro')}
      />

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
        {RESERVATION_SERVICES.map((service) => (
          <li key={service.id}>
            <Link
              href={service.href}
              className="group flex h-full flex-col rounded-[2px] border border-hairline bg-white p-6 transition-colors hover:border-brass sm:p-7"
            >
              <span className="block text-brass transition-colors group-hover:text-brass-ink">
                <BrandIcon name={service.id} />
              </span>
              <h3 className="mt-5 font-display text-xl text-ink">
                <Bidi>{tServices(`items.${service.id}.title`)}</Bidi>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                <Bidi>{tServices(`items.${service.id}.summary`)}</Bidi>
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-verdant">
                <Bidi>{tServices('readMore')}</Bidi>
                <span
                  aria-hidden="true"
                  className="inline-block rtl:-scale-x-100"
                >
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function HowItWorks() {
  const t = useTranslations('b2b.process');

  return (
    <Section tone="mist" labelledBy="process-heading">
      <SectionHeading
        tone="mist"
        id="process-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
      />

      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4 lg:gap-8">
        {B2B_STEPS.map((step, index) => (
          <li key={step.id} className="border-t border-brass pt-5">
            {/* The number is the ordering made visible; the list element
                already carries the order for assistive tech, so it is
                decoration. */}
            <p
              aria-hidden="true"
              className="font-display text-[1.75rem] leading-none text-brass"
            >
              {String(index + 1).padStart(2, '0')}
            </p>
            <h3 className="mt-4 text-[1.0625rem] font-semibold text-ink">
              <Bidi>{t(`steps.${step.id}.title`)}</Bidi>
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              <Bidi>{t(`steps.${step.id}.body`)}</Bidi>
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * The six pillars, read from `b2bHighlight.pillars.*` — the landing band's own
 * copy, deliberately not duplicated under `b2b.*`. Only the section's eyebrow
 * and heading are this page's, because here they introduce a page rather than
 * summarise one.
 */
function Benefits() {
  const t = useTranslations('b2b.benefits');
  const tPillars = useTranslations('b2bHighlight');

  return (
    <Section tone="sand" labelledBy="benefits-heading">
      <SectionHeading
        tone="sand"
        id="benefits-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
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
              <Bidi>{tPillars(`pillars.${pillar.id}.title`)}</Bidi>
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              <Bidi>{tPillars(`pillars.${pillar.id}.body`)}</Bidi>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * The §10 confidential invoice style, said in the reader's terms.
 *
 * Worth its own band because it is the one capability here that a competitor
 * cannot claim without building it, and because an agency has to understand it
 * before it is worth anything to them.
 */
function ConfidentialDocumentation() {
  const t = useTranslations('b2b.confidential');

  return (
    <Section tone="mist" labelledBy="confidential-heading">
      <div className="rounded-[2px] border border-hairline bg-white p-7 sm:p-10 lg:flex lg:items-start lg:gap-12">
        <span className="block shrink-0 text-brass">
          <BrandIcon name="confidentialInvoicing" className="h-10 w-10" />
        </span>

        <div className="mt-6 lg:mt-0">
          <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
            <Bidi>{t('eyebrow')}</Bidi>
          </p>
          <h2
            id="confidential-heading"
            className="mt-4 max-w-2xl font-display text-[1.625rem] leading-[1.2] text-ink sm:text-[2rem]"
          >
            <Bidi>{t('heading')}</Bidi>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate">
            <Bidi>{t('body')}</Bidi>
          </p>
          <p className="mt-4 max-w-2xl border-s-2 border-brass ps-5 text-sm leading-relaxed text-slate">
            <Bidi>{t('note')}</Bidi>
          </p>
        </div>
      </div>
    </Section>
  );
}

function B2bClose() {
  const t = useTranslations('b2b.closing');
  const tB2b = useTranslations('b2b');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <ClosingCta
      eyebrow={t('eyebrow')}
      heading={t('heading')}
      body={t('body')}
      actions={
        <>
          <ButtonLink
            href={whatsappUrl(tWhatsapp('b2b'))}
            variant="gilt"
            fullWidthOnMobile
          >
            {tB2b('cta')}
          </ButtonLink>
          <ButtonLink href="/contact" variant="outlineOnDark" fullWidthOnMobile>
            {t('contactCta')}
          </ButtonLink>
        </>
      }
    />
  );
}
