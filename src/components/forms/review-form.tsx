'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';

import { Field, Honeypot, fieldProps } from '@/components/forms/fields';
import { errorKeyFor } from '@/components/forms/submission';
import { TurnstileWidget } from '@/components/forms/turnstile-widget';
import { Bidi } from '@/components/ui/bidi';
import { HONEYPOT_FIELD } from '@/lib/request-guards';
import { TURNSTILE_FIELD } from '@/lib/turnstile';
import {
  REVIEW_COMMENT_MIN,
  reviewSchema,
  type ReviewFormValues,
  type ReviewInput,
} from '@/lib/validation/review';

/**
 * The review submission form (§14.1).
 *
 * ## The confirmation tells the truth
 *
 * §14.1 is explicit and this is the part of the component to leave alone: on
 * success the form says the review has been **received and will appear once it
 * has been checked**. It does not say "published", it does not say "thank you
 * for your review, it's now live", and it does **not render a preview of the
 * review as it will appear**. An unapproved review is not published, and a
 * customer who is told otherwise goes looking for it, fails to find it, and
 * concludes it was deleted — which is a worse outcome than the short wait.
 *
 * The form is replaced by the confirmation rather than reset beneath it, so
 * there is no half-state where a submitted review still sits in the inputs
 * looking editable.
 *
 * ## Validation
 *
 * `reviewSchema` is the same module the API validates against, so the inline
 * errors and the server's decision cannot disagree about what is acceptable.
 * The client copy is a courtesy — the server re-checks everything, because
 * anything can POST to `/api/reviews`.
 *
 * Error messages are per-field strings from the catalogue rather than Zod's
 * own, which are English-only and would have been the one untranslated surface
 * on an otherwise fully translated site.
 */
export function ReviewForm() {
  const t = useTranslations('forms');
  const tReview = useTranslations('forms.review');
  const locale = useLocale();

  const [submitted, setSubmitted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues, unknown, ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 5 },
  });

  async function onSubmit(values: ReviewInput) {
    setFailure(null);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, [TURNSTILE_FIELD]: token ?? '' }),
      });

      if (response.ok) {
        setSubmitted(true);
        return;
      }

      const body = (await response.json().catch(() => null)) as {
        reason?: string;
      } | null;
      setFailure(errorKeyFor(body?.reason));
    } catch {
      setFailure('network');
    }
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="rounded-[2px] border border-hairline bg-white p-7 sm:p-9"
      >
        <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
          <Bidi>{tReview('success.eyebrow')}</Bidi>
        </p>
        <h3 className="mt-4 font-display text-xl text-ink sm:text-[1.5rem]">
          <Bidi>{tReview('success.heading')}</Bidi>
        </h3>
        {/* §14.1's wording. Received, and will appear after a check. */}
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate">
          <Bidi>{tReview('success.body')}</Bidi>
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="relative rounded-[2px] border border-hairline bg-white p-6 sm:p-8"
    >
      <Honeypot register={register(HONEYPOT_FIELD)} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="review-name"
          label={t('fields.name')}
          error={errors.name ? tReview('errors.name') : undefined}
          required
        >
          <input
            {...register('name')}
            {...fieldProps('review-name', { invalid: !!errors.name })}
            type="text"
            autoComplete="name"
          />
        </Field>

        <Field
          id="review-email"
          label={t('fields.email')}
          hint={t('fields.emailHint')}
          error={errors.email ? tReview('errors.email') : undefined}
          required
        >
          <input
            {...register('email')}
            {...fieldProps('review-email', { invalid: !!errors.email, hint: true })}
            type="email"
            inputMode="email"
            autoComplete="email"
          />
        </Field>

        <Field
          id="review-rating"
          label={t('fields.rating')}
          error={errors.rating ? tReview('errors.rating') : undefined}
          required
        >
          <select
            {...register('rating')}
            {...fieldProps('review-rating', { invalid: !!errors.rating })}
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {t('fields.ratingOption', { rating: value })}
              </option>
            ))}
          </select>
        </Field>

        <Field id="review-country" label={t('fields.country')}>
          <input
            {...register('country')}
            {...fieldProps('review-country')}
            type="text"
            autoComplete="country-name"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field id="review-service" label={t('fields.serviceUsed')}>
            <input
              {...register('serviceUsed')}
              {...fieldProps('review-service')}
              type="text"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            id="review-comment"
            label={t('fields.comment')}
            hint={t('fields.commentHint', { min: REVIEW_COMMENT_MIN })}
            error={errors.comment ? tReview('errors.comment') : undefined}
            required
          >
            <textarea
              {...register('comment')}
              {...fieldProps('review-comment', { invalid: !!errors.comment, hint: true })}
              rows={5}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6">
        <TurnstileWidget
          locale={locale}
          onToken={setToken}
          onError={() => setFailure('rejected')}
        />
      </div>

      {failure ? (
        <p
          role="alert"
          className="mt-5 rounded-[2px] border border-error/40 bg-error/5 px-4 py-3 text-sm text-error"
        >
          <Bidi>{t(`errors.${failure}`)}</Bidi>
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-[2px] bg-verdant px-6 text-sm font-semibold tracking-[0.03em] text-white transition-colors hover:bg-pine disabled:opacity-60 sm:w-auto"
        >
          <Bidi>{isSubmitting ? t('submitting') : tReview('submit')}</Bidi>
        </button>

        {/* Said before submitting, not only after. Someone deciding whether to
            write a review should know it is moderated. */}
        <p className="text-xs leading-relaxed text-slate">
          <Bidi>{tReview('moderationNote')}</Bidi>
        </p>
      </div>
    </form>
  );
}
