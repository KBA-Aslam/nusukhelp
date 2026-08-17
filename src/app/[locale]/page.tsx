import type { Metadata } from 'next';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { B2bHighlight } from '@/components/landing/b2b-highlight';
import { ContactSplit } from '@/components/landing/contact-split';
import { Coverage } from '@/components/landing/coverage';
import { FreeConsultation } from '@/components/landing/free-consultation';
import { Hero } from '@/components/landing/hero';
import { ReviewsSection } from '@/components/landing/reviews-section';
import { ServicesGrid } from '@/components/landing/services-grid';
import { TwoDivisions } from '@/components/landing/two-divisions';
import { WhyChooseUs } from '@/components/landing/why-choose-us';
import { JsonLd } from '@/components/seo/json-ld';
import { COVERAGE_PLACES } from '@/content/services';
import {
  getPublishedReviews,
  getPublishedReviewSummary,
} from '@/db/queries/reviews';
import { pageMetadata } from '@/lib/metadata';
import { jsonLdDocument, travelAgencySchema } from '@/lib/structured-data';

/** How many reviews the landing band shows. The full list is `/reviews`. */
const LANDING_REVIEW_COUNT = 3;

/**
 * Re-render at most once an hour, on top of on-demand revalidation.
 *
 * On-demand revalidation on review approval (§14.1) is the mechanism that puts
 * a new review on the site, and it stays the primary one. This is the backstop
 * for a case it does not cover: prerendering happens during `next build`, where
 * D1 is reached through Wrangler's **local** proxy, not production. A deploy
 * from a machine with an empty local database therefore ships a landing page
 * whose reviews band is empty — and with nothing but on-demand revalidation it
 * would stay empty until the next approval, which could be weeks. An hourly
 * window costs one Worker invocation per hour per locale and closes that gap.
 *
 * **Verified end to end, not assumed.** With this window temporarily set to
 * 60s: a row inserted directly into *remote* D1 was absent from the live page
 * immediately after the insert (cached), and present 40 seconds later without
 * a deploy. So a Worker re-render reads the production binding, and the
 * backstop does what it claims. Cleanup order matters — delete the remote row
 * *before* redeploying, because a deploy re-prerenders from local D1.
 */
export const revalidate = 3600;

/**
 * The landing page's title is the site's own — `meta.defaultTitle` already ends
 * in the brand name, so it is passed as an untemplated title rather than run
 * through ` · Nusuk Help` a second time. Every other page templates.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return pageMetadata({
    locale,
    path: '/',
    title: t('defaultTitle'),
    description: t('defaultDescription'),
    untemplatedTitle: true,
  });
}

/**
 * Landing page — the complete story, in the order §5 sets it.
 *
 *   1. Hero                2. Two divisions       3. Free consultation
 *   4. Services            5. Why choose us       6. Coverage
 *   7. B2B highlight       8. Reviews             9. Contact
 *
 * The order is the argument the page makes, so the sections are listed here
 * flat rather than wrapped in anything clever — the file should read like §5.
 *
 * Only the reviews band touches the database. It is read at render time, which
 * for this page means at build and again on each revalidation: approving a
 * review in the admin panel revalidates this page, which is what puts the new
 * quote on the site (§14.1). Nothing here is dynamic per request.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Required in every page of a statically rendered locale tree, not just the
  // layout — without it the page opts into dynamic rendering on first use of a
  // translation, and the whole route falls out of the static build.
  setRequestLocale(locale);

  const [reviews, reviewSummary] = await Promise.all([
    getPublishedReviews(LANDING_REVIEW_COUNT),
    // Over *every* published review, not over the three above — see the query.
    getPublishedReviewSummary(),
  ]);

  const t = await getTranslations({ locale, namespace: 'meta' });
  const tCoverage = await getTranslations({ locale, namespace: 'coverage' });

  return (
    <>
      {/* §17 — `TravelAgency` on the landing page, with `AggregateRating`
          attached only once a review has actually been published. The name and
          description are the same strings the page and its metadata use. */}
      <JsonLd
        data={jsonLdDocument([
          travelAgencySchema({
            locale,
            name: t('siteName'),
            description: t('defaultDescription'),
            areaServed: COVERAGE_PLACES.map((area) =>
              tCoverage(`areas.${area.id}.name`),
            ),
            reviews: reviewSummary,
          }),
        ])}
      />

      <Hero />
      <TwoDivisions />
      <FreeConsultation />
      <ServicesGrid />
      <WhyChooseUs />
      <Coverage />
      <B2bHighlight />
      <ReviewsSection reviews={reviews} />
      <ContactSplit />
    </>
  );
}
