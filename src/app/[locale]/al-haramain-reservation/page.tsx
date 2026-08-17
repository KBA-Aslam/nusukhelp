import type { Metadata } from 'next';

import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ClosingCta } from '@/components/pages/closing-cta';
import { PageHeader } from '@/components/pages/page-header';
import { JsonLd } from '@/components/seo/json-ld';
import { Bidi } from '@/components/ui/bidi';
import { BrandIcon } from '@/components/ui/brand-icons';
import { ArrowLink, ButtonLink } from '@/components/ui/cta';
import { CONTAINER, Section, type Tone } from '@/components/ui/section';
import {
  RESERVATION_SECTIONS,
  type ReservationSection,
} from '@/content/reservation';
import { pageMetadata } from '@/lib/metadata';
import { LOGO, whatsappUrl } from '@/lib/site';
import {
  jsonLdDocument,
  organisationReference,
  serviceSchema,
} from '@/lib/structured-data';

/** This page's locale-less path — used by its metadata and its `Service` ids. */
const PATH = '/al-haramain-reservation';

/**
 * `/al-haramain-reservation` — full depth on all six reservation services, one
 * anchored section each (§4).
 *
 * ## The anchors
 *
 * `#hotels`, `#transport`, `#rail`, `#ziyarat`, `#permits`, `#ground-handling`
 * — and none of them is written down on this page. They come from
 * `RESERVATION_SECTIONS`, which derives them from `RESERVATION_SERVICES`, which
 * is also what the landing cards and the footer Services column link to. One
 * list, three consumers: a renamed anchor cannot leave a link pointing at
 * nothing.
 *
 * §4 accepts the SEO cost of this — one page competing for six search intents
 * ranks worse than six focused pages — on the grounds that the sections are
 * self-contained, so promoting hotels and transport to their own routes later
 * is a low-cost change. Keeping every section's copy under
 * `reservation.sections.<id>` is what keeps that true.
 *
 * ## The mark
 *
 * This is the one public page whose **body** carries the Al Haramain mark (§7).
 * It is passed to `PageHeader` from here rather than derived from the route,
 * because a rule enforced by a single explicit call site is harder to violate
 * by accident than one enforced by a lookup any page could match.
 *
 * ## Appendix A
 *
 * The permits section is the compliance-critical one and is built so it cannot
 * render without its note: `ReservationSection.note` is a flag on the data, not
 * a paragraph a future edit could drop. The copy presents permit work strictly
 * as assistance, guidance and coordination, and the note states the three
 * things Appendix A forbids implying — that permits come from anywhere but the
 * official channels, that this company has privileged access to them, or that
 * any approval is guaranteed.
 *
 * "Subject to availability" appears wherever a rate or a room is described,
 * for the same reason.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'reservation.meta' });

  return pageMetadata({
    locale,
    path: PATH,
    title: t('title'),
    description: t('description'),
  });
}

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Required in every page of a statically rendered locale tree — see the note
  // on the landing page. Without it the first translation call opts the route
  // into dynamic rendering.
  setRequestLocale(locale);

  return (
    <>
      <ReservationServicesJsonLd locale={locale} />

      <ReservationHeader />
      <AnchorNav />

      {RESERVATION_SECTIONS.map((section, index) => (
        <ServiceSection
          key={section.id}
          section={section}
          // Sand, mist, sand, mist — derived from position rather than listed
          // per section, so inserting a service cannot produce two adjacent
          // bands of the same ground.
          tone={index % 2 === 0 ? 'sand' : 'mist'}
        />
      ))}

      <ReservationClose />
    </>
  );
}

/**
 * §17 — one `Service` node per anchored section.
 *
 * The names and descriptions are the strings the sections themselves render:
 * `services.items.<id>.title` and `reservation.sections.<id>.lead`. A crawler
 * therefore reads exactly what a person reads, in whichever locale it asked
 * for, and a copy edit updates both at once.
 *
 * The organisation is included by reference only — identity, no description.
 * The full node belongs to the landing page; see `structured-data.ts`.
 */
function ReservationServicesJsonLd({ locale }: { locale: string }) {
  const t = useTranslations();

  return (
    <JsonLd
      data={jsonLdDocument([
        organisationReference({ locale, name: t('meta.siteName') }),
        ...RESERVATION_SECTIONS.map((section) =>
          serviceSchema({
            locale,
            path: PATH,
            anchor: section.anchor,
            name: t(`services.items.${section.id}.title`),
            description: t(`reservation.sections.${section.id}.lead`),
          }),
        ),
      ])}
    />
  );
}

function ReservationHeader() {
  const t = useTranslations('reservation');
  const tFooter = useTranslations('footer');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <PageHeader
      eyebrow={t('eyebrow')}
      title={t('title')}
      lead={t('lead')}
      mark={{
        src: LOGO.ahrTile.src,
        width: LOGO.ahrTile.width,
        height: LOGO.ahrTile.height,
        alt: tFooter('division.logoAlt'),
      }}
      actions={
        <>
          <ButtonLink
            href={whatsappUrl(tWhatsapp('b2b'))}
            variant="gilt"
            fullWidthOnMobile
          >
            {t('cta')}
          </ButtonLink>
          <ButtonLink href="/b2b" variant="outlineOnDark" fullWidthOnMobile>
            {t('partnerCta')}
          </ButtonLink>
        </>
      }
    />
  );
}

/**
 * The six anchors as a jump list.
 *
 * Plain `<a href="#…">`, not the locale-aware `Link`: these are fragments of
 * the page the reader is already on, and routing them through the router would
 * turn a scroll into a navigation. The locale prefix is irrelevant to a
 * fragment.
 */
function AnchorNav() {
  const t = useTranslations();

  return (
    <nav
      aria-label={t('reservation.onThisPage')}
      className="border-b border-hairline bg-sand"
    >
      <div className={CONTAINER}>
        <p className="pt-8 font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
          <Bidi>{t('reservation.onThisPage')}</Bidi>
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-0 pb-6">
          {RESERVATION_SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.anchor}`}
                className="inline-flex min-h-11 items-center text-sm text-slate transition-colors hover:text-verdant"
              >
                <Bidi>{t(`services.items.${section.id}.title`)}</Bidi>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function ServiceSection({
  section,
  tone,
}: {
  section: ReservationSection;
  tone: Tone;
}) {
  const t = useTranslations('reservation');
  const tServices = useTranslations('services');
  const tWhatsapp = useTranslations('whatsapp');

  // The section's name is the service's name — `services.items.<id>.title`,
  // the same string on the landing card, in the footer, and in the jump list
  // above. It is also what the CTA and the WhatsApp pre-fill name (§14.3),
  // which is why it is read once here and passed on.
  const name = tServices(`items.${section.id}.title`);
  const headingId = `${section.anchor}-heading`;

  return (
    <Section id={section.anchor} labelledBy={headingId} tone={tone}>
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-16">
        <div>
          <span className="block text-brass">
            <BrandIcon name={section.id} className="h-8 w-8" />
          </span>

          <h2
            id={headingId}
            className="mt-5 font-display text-[1.625rem] leading-[1.2] text-ink sm:text-[2rem]"
          >
            <Bidi>{name}</Bidi>
          </h2>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate">
            <Bidi>{t(`sections.${section.id}.lead`)}</Bidi>
          </p>

          <ArrowLink
            href={whatsappUrl(tWhatsapp('serviceEnquiry', { service: name }))}
            className="mt-4 text-verdant hover:text-pine"
          >
            {t('sectionCta', { service: name })}
          </ArrowLink>
        </div>

        <div className="rounded-[2px] border border-hairline bg-white p-6 sm:p-8">
          <ul className="divide-y divide-hairline">
            {section.points.map((point) => (
              <li
                key={point}
                className="flex gap-3 py-3.5 text-[0.9375rem] leading-relaxed text-slate first:pt-0 last:pb-0"
              >
                <span aria-hidden="true" className="text-brass">
                  —
                </span>
                <Bidi>{t(`sections.${section.id}.points.${point}`)}</Bidi>
              </li>
            ))}
          </ul>

          {/* Appendix A. Rendered from a flag on the data so the permits
              section cannot ship without it. */}
          {section.note ? (
            <div className="mt-6 border-t border-brass/40 pt-5">
              <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
                <Bidi>{t('noteLabel')}</Bidi>
              </p>
              <p className="mt-3 text-[0.875rem] leading-relaxed text-slate">
                <Bidi>{t(`sections.${section.id}.note`)}</Bidi>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function ReservationClose() {
  const t = useTranslations('reservation.closing');
  const tReservation = useTranslations('reservation');
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
            {tReservation('cta')}
          </ButtonLink>
          <ButtonLink href="/contact" variant="outlineOnDark" fullWidthOnMobile>
            {t('contactCta')}
          </ButtonLink>
        </>
      }
    />
  );
}
