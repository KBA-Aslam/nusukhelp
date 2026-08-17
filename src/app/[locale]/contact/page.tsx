import type { Metadata } from 'next';

import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { EnquiryForm } from '@/components/forms/enquiry-form';
import { PageHeader } from '@/components/pages/page-header';
import { Bidi } from '@/components/ui/bidi';
import { BrandIcon } from '@/components/ui/brand-icons';
import { ButtonLink } from '@/components/ui/cta';
import { Section, SectionHeading } from '@/components/ui/section';
import { CONTACT_AUDIENCES } from '@/content/services';
import { pageMetadata } from '@/lib/metadata';
import { CONTACT_CHANNELS, whatsappUrl } from '@/lib/site';

/**
 * `/contact` — split by audience, pilgrims vs agencies (§4).
 *
 * The split is the page, not a decoration on it: a pilgrim wants a free
 * consultation and an agency wants a quote, and the two need different things
 * in the first message. So each panel adds an `include` line naming what to
 * send — the single change most likely to turn a first message into a useful
 * one.
 *
 * The audiences, their titles, bodies and CTAs are `CONTACT_AUDIENCES` and the
 * `contact.*` keys the landing band already uses (§5 item 9). Only `include`
 * and the page's own header are new.
 *
 * ## Channels
 *
 * §14.3 ranks WhatsApp first and the form second; the form is Phase 6, so this
 * page ships with the direct channels and does not gesture at a form that is
 * not there. `CONTACT_CHANNELS` lives in `lib/site.ts` with the rest of the
 * company constants, because §19 items 3 and 4 will replace those numbers and
 * they must change in one file.
 *
 * The WhatsApp row is the one whose `href` is `null`: its deep link carries a
 * translated pre-fill and can only be built at render.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact.page.meta' });

  return pageMetadata({
    locale,
    path: '/contact',
    title: t('title'),
    description: t('description'),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <ContactHeader />
      <Audiences />
      <EnquirySection />
      <DirectLines />
    </>
  );
}

/**
 * The enquiry form (§14.2), placed **after** the WhatsApp panels and before the
 * direct lines.
 *
 * That order is §14.3's ranking made into a layout: WhatsApp converts far
 * better in this market and gets the top of the page, and the form is the
 * fallback — and the record, which WhatsApp is not. Putting the form first
 * would read as the primary path and quietly invert the ranking the spec sets.
 */
function EnquirySection() {
  const t = useTranslations('forms.enquiry.section');

  return (
    <Section tone="sand" labelledBy="enquiry-heading">
      <div className="max-w-3xl">
        <SectionHeading
          tone="sand"
          id="enquiry-heading"
          eyebrow={t('eyebrow')}
          heading={t('heading')}
          intro={t('intro')}
        />
        <div className="mt-8 lg:mt-10">
          {/* Opens on the pilgrim panel — the larger audience on this page.
              An agency switches with one tap, and `/b2b` sends its readers
              straight to WhatsApp with the B2B pre-fill anyway. */}
          <EnquiryForm defaultAudience="pilgrim" />
        </div>
      </div>
    </Section>
  );
}

function ContactHeader() {
  const t = useTranslations('contact.page');

  return (
    <PageHeader eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />
  );
}

function Audiences() {
  const t = useTranslations('contact');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <Section tone="sand" labelledBy="audiences-heading">
      <SectionHeading
        tone="sand"
        id="audiences-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
      />

      <div className="mt-10 grid gap-5 lg:mt-12 lg:grid-cols-2 lg:gap-6">
        {CONTACT_AUDIENCES.map((audience) => {
          const isPilgrims = audience.id === 'pilgrims';

          return (
            <div
              key={audience.id}
              className="flex flex-col rounded-[2px] border border-hairline bg-white p-7 sm:p-9"
            >
              <span className="block text-brass">
                <BrandIcon name={audience.id} className="h-8 w-8" />
              </span>

              <h3 className="mt-5 font-display text-xl text-ink sm:text-[1.5rem]">
                <Bidi>{t(`${audience.id}.title`)}</Bidi>
              </h3>

              <p className="mt-3 text-base leading-relaxed text-slate">
                <Bidi>{t(`${audience.id}.body`)}</Bidi>
              </p>

              <p className="mt-4 grow border-s-2 border-brass ps-5 text-sm leading-relaxed text-slate">
                <Bidi>{t(`${audience.id}.include`)}</Bidi>
              </p>

              <div className="mt-7">
                {/* Both audiences land on WhatsApp — §14.3 makes it the primary
                    action for each — but with different pre-filled messages, so
                    the first line already says who is writing. The agency panel
                    keeps `/b2b` reachable from the nav rather than spending its
                    one button on it. */}
                <ButtonLink
                  href={whatsappUrl(
                    tWhatsapp(isPilgrims ? 'consultation' : 'b2b'),
                  )}
                  variant={isPilgrims ? 'primary' : 'outlineOnLight'}
                  fullWidthOnMobile
                >
                  {t(`${audience.id}.cta`)}
                </ButtonLink>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function DirectLines() {
  const t = useTranslations('contact');
  const tFooter = useTranslations('footer');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <Section tone="mist" labelledBy="direct-heading">
      <SectionHeading
        tone="mist"
        id="direct-heading"
        eyebrow={t('direct.eyebrow')}
        heading={t('direct.heading')}
      />

      <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-[1.3fr_1fr] lg:gap-10">
        <dl className="rounded-[2px] border border-hairline bg-white p-6 sm:p-8">
          {CONTACT_CHANNELS.map((channel, index) => (
            <div
              key={channel.labelKey}
              className={index > 0 ? 'mt-4 border-t border-hairline pt-4' : ''}
            >
              <dt className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
                <Bidi>{t(`channels.${channel.labelKey}`)}</Bidi>
              </dt>
              <dd>
                <a
                  href={channel.href ?? whatsappUrl(tWhatsapp('consultation'))}
                  {...(channel.href
                    ? {}
                    : { target: '_blank', rel: 'noopener noreferrer' })}
                  className="inline-flex min-h-11 items-center text-[0.9375rem] text-verdant transition-colors hover:text-pine"
                >
                  {/* Every value here is a Latin island — a `+`-prefixed number
                      or an address. The leading `+` is a bidi neutral and lands
                      at the wrong end of the string on `/ar` without this. */}
                  <Bidi>{channel.value}</Bidi>
                </a>
              </dd>
            </div>
          ))}
        </dl>

        <div className="rounded-[2px] border border-hairline bg-white p-6 sm:p-8">
          <h3 className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
            <Bidi>{t('office.heading')}</Bidi>
          </h3>
          <address className="mt-3 text-[0.9375rem] leading-relaxed text-slate not-italic">
            {/* The same `footer.location` the footer renders — a place name, so
                it translates, which is why it is copy rather than a constant. */}
            <Bidi>{tFooter('location')}</Bidi>
          </address>
          <p className="mt-5 border-t border-hairline pt-5 text-sm leading-relaxed text-slate">
            <Bidi>{t('office.note')}</Bidi>
          </p>
        </div>
      </div>
    </Section>
  );
}
