import { useTranslations } from 'next-intl';

import { ReviewStars } from '@/components/reviews/stars';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/cta';
import { Section, SectionHeading } from '@/components/ui/section';
import type { PublicReview } from '@/db/queries/reviews';

/**
 * §5 item 8 — reviews. Ink band, published reviews only.
 *
 * The list comes from the page as `PublicReview[]`, a shape that has no email
 * field to leak (§14.1). Everything here is moderated content: a review reaches
 * this component only after an admin approves it, and approval triggers the
 * on-demand revalidation that rebuilds this page.
 *
 * The **empty state is honest**. Until the first review is approved the section
 * says nothing has been published yet — it does not fabricate testimonials, and
 * it does not hide, because the *Leave a review* CTA is the point of the band.
 * The prototype's three quotes are mockup content, not seed data.
 *
 * The CTA points at `/reviews`, which carries the full published list and the
 * submission form itself (Phase 6).
 */
export function ReviewsSection({ reviews }: { reviews: PublicReview[] }) {
  const t = useTranslations('reviews');

  return (
    <Section tone="ink" labelledBy="reviews-heading">
      <SectionHeading
        tone="ink"
        id="reviews-heading"
        eyebrow={t('eyebrow')}
        heading={t('heading')}
        action={
          <ButtonLink href="/reviews" variant="outlineOnDark" fullWidthOnMobile>
            {t('cta')}
          </ButtonLink>
        }
      />

      {reviews.length > 0 ? (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex flex-col rounded-[2px] bg-panel-deep p-6 sm:p-7"
            >
              <ReviewStars rating={review.rating} tone="onDark" />

              <blockquote className="mt-4 grow text-sm leading-relaxed text-onink">
                <Bidi>{review.comment}</Bidi>
              </blockquote>

              <p className="mt-5 text-xs text-gilt">
                {/* Name and country are two separate strings from two separate
                    people — each is isolated on its own, so a Latin name beside
                    an Arabic country (or the reverse) cannot drag the separator
                    to the wrong end on `/ar`. The separator is punctuation, not
                    copy, so it is not a message key. */}
                <Bidi>{review.name}</Bidi>
                {review.country ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <Bidi>{review.country}</Bidi>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 max-w-xl text-sm leading-relaxed text-onink-muted lg:mt-12">
          <Bidi>{t('empty')}</Bidi>
        </p>
      )}

      {/* The moderation note explains the delay to someone who has just
          submitted a review. With nothing published, the empty state already
          says the same thing in more words — printing both reads as a stutter. */}
      {reviews.length > 0 ? (
        <p className="mt-8 text-[0.8125rem] text-onink-muted">
          <Bidi>{t('moderationNote')}</Bidi>
        </p>
      ) : null}
    </Section>
  );
}
