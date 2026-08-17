import type { Metadata } from 'next';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LegalArticle } from '@/components/pages/legal-article';
import { Bidi } from '@/components/ui/bidi';
import { TERMS_SECTIONS } from '@/content/legal';

/**
 * `/terms` (§4, *Legal*).
 *
 * **A drafted starting point, not a reviewed legal document** — §19 open item
 * 12, with `/privacy`.
 *
 * ## It does not reproduce §11
 *
 * §11's booking terms are snapshotted onto each booking at confirmation and are
 * editable in company settings, so a hard-coded copy here would drift from the
 * authoritative text the first time an admin edited it — and the drifted copy
 * would be the one a customer read before booking. The `bookingTerms` section
 * says instead that those terms are issued with the confirmation and printed on
 * the invoice, and lists what they cover. One text, one place. See the Phase 5
 * note in §11 of the spec.
 *
 * ## The two compliance sections
 *
 * `permits` restates Appendix A in the binding document rather than only in
 * marketing copy: official channels, the decision is the authorities', no
 * privileged access, no promised approval. `independence` renders
 * `footer.disclaimer` itself — passed in as an appendix rather than copied into
 * a `terms.*` key, so the legally reviewed wording (§19 item 1) is the same
 * string here, in the footer and in the consultation block.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'terms.meta' });

  return { title: t('title'), description: t('description') };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'footer' });

  return (
    <LegalArticle
      namespace="terms"
      locale={locale}
      sections={TERMS_SECTIONS}
      appendix={{ independence: <Bidi>{t('disclaimer')}</Bidi> }}
    />
  );
}
