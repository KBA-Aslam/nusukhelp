import type { Metadata } from 'next';

import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Coverage } from '@/components/landing/coverage';
import { TwoDivisions } from '@/components/landing/two-divisions';
import { ClosingCta } from '@/components/pages/closing-cta';
import { PageHeader } from '@/components/pages/page-header';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/cta';
import { Section, SectionHeading } from '@/components/ui/section';
import { ABOUT_FACTS } from '@/content/pages';
import { whatsappUrl } from '@/lib/site';

/**
 * `/about` — company, two divisions, mission, coverage (§4).
 *
 * §4 names four things and two of them already exist as landing sections, so
 * they are **imported, not rebuilt**: `TwoDivisions` is the signature element
 * and the clearest statement of the brand hierarchy in §1, and `Coverage` is
 * the same four areas with the same glyphs. Rewriting either under an `about.*`
 * namespace would give the company two descriptions of its own structure, and
 * the arch on the division cards would have to be drawn twice.
 *
 * What is this page's own: the mission, the facts list, and the independence
 * section.
 *
 * ## Independence
 *
 * §7 names a site at `nusukhelp.com` reading as officially connected to the
 * Ministry's Nusuk platform as the largest business risk in the project, and
 * `/about` is where a reader goes to resolve exactly that question. So the
 * disclaimer is not left to the footer here: the section says plainly what the
 * name means and what the company is not, and then renders `footer.disclaimer`
 * itself — the same string, so the legally reviewed wording (§19 item 1) cannot
 * be updated in the footer and missed here.
 *
 * ## Grounds
 *
 * ink → mist → sand → mist → sand → ink. `TwoDivisions` and `Coverage` fix
 * their own tone at sand, which is what sets the alternation for the sections
 * around them.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about.meta' });

  return { title: t('title'), description: t('description') };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <AboutHeader />
      <Mission />
      <TwoDivisions />
      <Independence />
      <Coverage />
      <AboutClose />
    </>
  );
}

function AboutHeader() {
  const t = useTranslations('about');

  return (
    <PageHeader eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />
  );
}

function Mission() {
  const t = useTranslations('about.mission');
  const tFacts = useTranslations('about.facts');

  return (
    <Section tone="mist" labelledBy="mission-heading">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <div>
          <SectionHeading
            tone="mist"
            id="mission-heading"
            eyebrow={t('eyebrow')}
            heading={t('heading')}
          />

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate">
            <Bidi>{t('bodyOne')}</Bidi>
          </p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate">
            <Bidi>{t('bodyTwo')}</Bidi>
          </p>
        </div>

        {/* Facts, not claims — every row is a statement from §1 that a reader
            could check, which is what makes the block worth its space beside
            the prose. */}
        <dl className="rounded-[2px] border border-hairline bg-white p-6 sm:p-8">
          {ABOUT_FACTS.map((fact, index) => (
            <div
              key={fact.id}
              className={index > 0 ? 'mt-5 border-t border-hairline pt-5' : ''}
            >
              <dt className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
                <Bidi>{tFacts(`${fact.id}.label`)}</Bidi>
              </dt>
              <dd className="mt-2 text-[0.9375rem] leading-relaxed text-slate">
                <Bidi>{tFacts(`${fact.id}.value`)}</Bidi>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}

function Independence() {
  const t = useTranslations('about.independence');
  const tFooter = useTranslations('footer');

  return (
    <Section tone="mist" labelledBy="independence-heading">
      <div className="max-w-3xl">
        <SectionHeading
          tone="mist"
          id="independence-heading"
          eyebrow={t('eyebrow')}
          heading={t('heading')}
        />

        <p className="mt-6 text-base leading-relaxed text-slate">
          <Bidi>{t('body')}</Bidi>
        </p>

        {/* The sitewide disclaimer, read from the key the footer and the
            consultation block read. Not restated as `about.*` copy. */}
        <p className="mt-6 border-s-2 border-brass ps-5 text-[0.9375rem] leading-relaxed text-slate">
          <Bidi>{tFooter('disclaimer')}</Bidi>
        </p>
      </div>
    </Section>
  );
}

function AboutClose() {
  const t = useTranslations('about.closing');
  const tCta = useTranslations('cta');
  const tWhatsapp = useTranslations('whatsapp');

  return (
    <ClosingCta
      eyebrow={t('eyebrow')}
      heading={t('heading')}
      body={t('body')}
      actions={
        <>
          <ButtonLink
            href={whatsappUrl(tWhatsapp('consultation'))}
            variant="gilt"
            fullWidthOnMobile
          >
            {tCta('freeConsultation')}
          </ButtonLink>
          <ButtonLink href="/contact" variant="outlineOnDark" fullWidthOnMobile>
            {t('contactCta')}
          </ButtonLink>
        </>
      }
    />
  );
}
