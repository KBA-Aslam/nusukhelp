import { useTranslations } from 'next-intl';

/**
 * Five stars, `rating` of them filled.
 *
 * One component for both surfaces — the landing band on ink and the `/reviews`
 * list on light — because the accessibility treatment is the part that matters
 * and it should exist once. `tone` changes two colours and nothing else.
 *
 * ## Why the label is hidden text and not `aria-label`
 *
 * The glyphs are `aria-hidden`, otherwise a screen reader reads "black star"
 * five times per review. That makes the label the *only* thing announcing the
 * rating — and an `aria-label` here would sit on a `<p>`, which maps to the
 * `generic` role. ARIA does not permit labelling `generic`: some screen readers
 * announce it anyway, others drop it silently, and the ones that drop it would
 * leave the rating unannounced altogether. `sr-only` text is read by all of
 * them, and it translates like any other string.
 *
 * `reviews.ratingLabel` is the same key on both surfaces.
 */
export function ReviewStars({
  rating,
  tone,
}: {
  rating: number;
  tone: 'onDark' | 'onLight';
}) {
  const t = useTranslations('reviews');
  const onDark = tone === 'onDark';

  return (
    <p className="text-sm tracking-[0.18em]">
      <span className="sr-only">{t('ratingLabel', { rating })}</span>
      <span aria-hidden="true">
        {[1, 2, 3, 4, 5].map((position) => {
          const filled = position <= rating;
          return (
            <span
              key={position}
              className={
                filled
                  ? onDark
                    ? 'text-gilt'
                    : 'text-brass'
                  : onDark
                    ? 'text-onink-muted/40'
                    : 'text-hairline'
              }
            >
              ★
            </span>
          );
        })}
      </span>
    </p>
  );
}
