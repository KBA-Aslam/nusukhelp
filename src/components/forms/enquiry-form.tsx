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
  ENQUIRY_AUDIENCES,
  ENQUIRY_MESSAGE_MIN,
  enquirySchema,
  type EnquiryAudience,
  type EnquiryInput,
} from '@/lib/validation/enquiry';

/**
 * The enquiry form (§14.2), with the audience split.
 *
 * ## The split is two radio buttons, not two forms
 *
 * §14.2 captures `audience` for triage, and the temptation is a separate form
 * per audience — which would mean two components, two sets of copy, and one of
 * them quietly falling behind the other. Instead the audience is the form's
 * first control, and it changes exactly two things: whether the company field
 * is offered, and which pre-filled context the notification email carries.
 * Everything else is the same enquiry.
 *
 * `defaultAudience` lets a page open the form on the right one — `/contact`
 * defaults to pilgrim, and the same component on a B2B surface can open on
 * agency without a second implementation.
 *
 * ## WhatsApp stays the primary action
 *
 * §14.3 ranks the WhatsApp deep link first and this form second, and the page
 * around it keeps that order. The form is the fallback and, more importantly,
 * the record: a WhatsApp conversation is not in the database and cannot be
 * triaged in the admin panel.
 */
export function EnquiryForm({
  defaultAudience = 'pilgrim',
}: {
  defaultAudience?: EnquiryAudience;
}) {
  const t = useTranslations('forms');
  const tEnquiry = useTranslations('forms.enquiry');
  const locale = useLocale();

  const [submitted, setSubmitted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryInput>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { audience: defaultAudience },
  });

  const audience = watch('audience');

  async function onSubmit(values: EnquiryInput) {
    setFailure(null);

    try {
      const response = await fetch('/api/enquiries', {
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
          <Bidi>{tEnquiry('success.eyebrow')}</Bidi>
        </p>
        <h3 className="mt-4 font-display text-xl text-ink sm:text-[1.5rem]">
          <Bidi>{tEnquiry('success.heading')}</Bidi>
        </h3>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate">
          <Bidi>{tEnquiry('success.body')}</Bidi>
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

      {/* The audience split. A radio group rather than a select: two options
          that change what the form asks for should both be visible without an
          interaction, and a fieldset gives the group a proper accessible name
          instead of leaving two loose radios labelled only individually. */}
      <fieldset>
        <legend className="text-[0.8125rem] font-semibold text-ink">
          <Bidi>{tEnquiry('audience.legend')}</Bidi>
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ENQUIRY_AUDIENCES.map((value) => (
            <label
              key={value}
              className={[
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-[2px] border px-4 py-3 text-[0.9375rem] transition-colors',
                audience === value
                  ? 'border-verdant bg-mist/60 text-ink'
                  : 'border-hairline text-slate hover:border-brass',
              ].join(' ')}
            >
              <input
                {...register('audience')}
                type="radio"
                value={value}
                className="h-4 w-4 accent-verdant"
              />
              <Bidi>{tEnquiry(`audience.${value}`)}</Bidi>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field
          id="enquiry-name"
          label={t('fields.name')}
          error={errors.name ? tEnquiry('errors.name') : undefined}
          required
        >
          <input
            {...register('name')}
            {...fieldProps('enquiry-name', { invalid: !!errors.name })}
            type="text"
            autoComplete="name"
          />
        </Field>

        <Field
          id="enquiry-email"
          label={t('fields.email')}
          error={errors.email ? tEnquiry('errors.email') : undefined}
          required
        >
          <input
            {...register('email')}
            {...fieldProps('enquiry-email', { invalid: !!errors.email })}
            type="email"
            inputMode="email"
            autoComplete="email"
          />
        </Field>

        <Field id="enquiry-phone" label={t('fields.phone')}>
          <input
            {...register('phone')}
            {...fieldProps('enquiry-phone')}
            // `type="tel"` per §20.4 — it brings up the phone keypad rather
            // than a full keyboard, and this market types +966 numbers.
            type="tel"
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>

        {/* Offered only to agencies. A pilgrim has no company, and an empty
            field they must skip is one more thing between them and sending. */}
        {audience === 'agency' ? (
          <Field id="enquiry-company" label={t('fields.company')}>
            <input
              {...register('company')}
              {...fieldProps('enquiry-company')}
              type="text"
              autoComplete="organization"
            />
          </Field>
        ) : (
          <Field id="enquiry-service" label={t('fields.serviceInterest')}>
            <input
              {...register('serviceInterest')}
              {...fieldProps('enquiry-service')}
              type="text"
            />
          </Field>
        )}

        <div className="sm:col-span-2">
          <Field
            id="enquiry-message"
            label={t('fields.message')}
            hint={tEnquiry(`messageHint.${audience}`, {
              min: ENQUIRY_MESSAGE_MIN,
            })}
            error={errors.message ? tEnquiry('errors.message') : undefined}
            required
          >
            <textarea
              {...register('message')}
              {...fieldProps('enquiry-message', {
                invalid: !!errors.message,
                hint: true,
              })}
              rows={6}
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

      <div className="mt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-[2px] bg-verdant px-6 text-sm font-semibold tracking-[0.03em] text-white transition-colors hover:bg-pine disabled:opacity-60 sm:w-auto"
        >
          <Bidi>{isSubmitting ? t('submitting') : tEnquiry('submit')}</Bidi>
        </button>
      </div>
    </form>
  );
}
