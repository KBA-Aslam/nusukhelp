import type { Metadata } from 'next';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LegalArticle } from '@/components/pages/legal-article';
import { PRIVACY_SECTIONS } from '@/content/legal';

/**
 * `/privacy` (§4, *Legal*).
 *
 * **A drafted starting point, not a reviewed legal document.** Tracked as §19
 * open item 12, alongside `/terms`. What it must be right about from day one is
 * the factual part — what this site actually collects and what it publishes —
 * because that is a description of behaviour, not a legal opinion, and a wrong
 * description is a misrepresentation whoever reviews the wording afterwards.
 *
 * So the `collect` and `use` sections were written from `db/schema.ts` rather
 * than from a template: the `reviews` table's columns are name, email, rating,
 * comment, country, locale and an IP hash, and `PublicReview` in
 * `db/queries/reviews.ts` carries **no email field at all** (§14.1). The policy
 * says exactly that — a published review shows name, country, rating and
 * comment, and the address is stored but never rendered.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy.meta' });

  return { title: t('title'), description: t('description') };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LegalArticle
      namespace="privacy"
      locale={locale}
      sections={PRIVACY_SECTIONS}
    />
  );
}
