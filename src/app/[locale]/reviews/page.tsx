import type { Metadata } from 'next';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ReviewForm } from '@/components/forms/review-form';
import { ReviewStars } from '@/components/reviews/stars';
import { PageHeader } from '@/components/pages/page-header';
import { Bidi } from '@/components/ui/bidi';
import { Section, SectionHeading } from '@/components/ui/section';
import {
  getPublishedReviews,
  type PublicReview,
} from '@/db/queries/reviews';
import { formatDate } from '@/lib/format';
import { pageMetadata } from '@/lib/metadata';

/**
 * `/reviews` — the full published list plus the submission form (§4, §14.1).
 *
 * ## Published only
 *
 * `getPublishedReviews` filters on `status = 'published'` and returns
 * `PublicReview`, a type with **no email field at all**. Nothing pending,
 * hidden or spam can reach this page, and no reviewer's address can reach a
 * component that might print it — the same allow-list discipline the
 * confidential invoice uses in §10, enforced by the type rather than by
 * remembering.
 *
 * ## The same revalidation contract as the landing page
 *
 * Approving a review revalidates this route (§13), which is what puts a new
 * review on the site. The hourly window is the backstop for the case
 * on-demand revalidation cannot cover: prerendering during `next build` reads
 * D1 through Wrangler's *local* proxy, so a deploy from a machine with an empty
 * local database would otherwise ship an empty list until the next approval.
 * See §14.1, and the fuller note on the landing page.
 */
export const revalidate = 3600;

/**
 * How many published reviews the page lists.
 *
 * A cap rather than every row: this is a static page rendered into HTML, and an
 * unbounded list would grow the document without limit as reviews accumulate.
 * Pagination is not worth building for a company that will have tens of
 * reviews, and the newest hundred is what anyone reads.
 */
const REVIEW_LIST_LIMIT = 100;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'reviewsPage.meta' });

  return pageMetadata({
    locale,
    path: '/reviews',
    title: t('title'),
    description: t('description'),
  });
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [reviews, t, tReviews] = await Promise.all([
    getPublishedReviews(REVIEW_LIST_LIMIT),
    getTranslations({ locale, namespace: 'reviewsPage' }),
    getTranslations({ locale, namespace: 'reviews' }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        lead={t('lead')}
      />

      <Section tone="sand" labelledBy="published-heading">
        <SectionHeading
          tone="sand"
          id="published-heading"
          eyebrow={tReviews('eyebrow')}
          heading={t('listHeading')}
        />

        {reviews.length > 0 ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} locale={locale} />
            ))}
          </ul>
        ) : (
          /* The honest empty state (§14.1). No fabricated testimonials, and no
             hiding the section — the form below it is the point of the page. */
          <p className="mt-10 max-w-xl text-[0.9375rem] leading-relaxed text-slate lg:mt-12">
            <Bidi>{tReviews('empty')}</Bidi>
          </p>
        )}
      </Section>

      <Section tone="mist" labelledBy="submit-heading">
        <div className="max-w-3xl">
          <SectionHeading
            tone="mist"
            id="submit-heading"
            eyebrow={t('form.eyebrow')}
            heading={t('form.heading')}
            intro={t('form.intro')}
          />
          <div className="mt-8 lg:mt-10">
            <ReviewForm />
          </div>
        </div>
      </Section>
    </>
  );
}

function ReviewCard({
  review,
  locale,
}: {
  review: PublicReview;
  locale: string;
}) {
  return (
    <li className="flex flex-col rounded-[2px] border border-hairline bg-white p-6 sm:p-7">
      <ReviewStars rating={review.rating} tone="onLight" />

      <blockquote className="mt-4 grow text-[0.9375rem] leading-relaxed text-slate">
        <Bidi>{review.comment}</Bidi>
      </blockquote>

      <footer className="mt-5 border-t border-hairline pt-4">
        <p className="text-sm font-semibold text-ink">
          {/* Name and country are two strings from two different people — each
              is isolated on its own so a Latin name beside an Arabic country
              cannot drag the separator to the wrong end on `/ar`. */}
          <Bidi>{review.name}</Bidi>
          {review.country ? (
            <>
              <span aria-hidden="true" className="text-muted">
                {' · '}
              </span>
              <span className="font-normal text-slate">
                <Bidi>{review.country}</Bidi>
              </span>
            </>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-muted">
          <Bidi>{formatDate(new Date(review.createdAt), locale)}</Bidi>
        </p>
      </footer>
    </li>
  );
}
