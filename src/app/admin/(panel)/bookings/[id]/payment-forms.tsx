'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Field,
  FormMessage,
  INPUT,
  Label,
  SELECT,
  TEXTAREA,
} from '@/components/admin/ui';
import type { FieldErrors } from '@/lib/action-result';
import { formatSAR } from '@/lib/format';
import type { RecordPaymentValues } from '@/lib/validation/payment';

import {
  recordPaymentAction,
  reversePaymentAction,
  type PaymentActionResult,
} from './payment-actions';

/**
 * The two money forms on the booking detail screen (§13.4, §9.4).
 *
 * ## Why these are controlled, when the lifecycle buttons are not
 *
 * `MarkCompletedButton` and the rest are plain `<form action={…}>` posts that
 * work with no JavaScript at all. These two are not, and the reason is the
 * acknowledge round trip: an overpayment or a future date comes back as a
 * warning, and the person then confirms **the same submission**. React resets
 * an uncontrolled form once its action resolves, so the amount, date, reference
 * and notes someone just typed on a phone would be wiped by the very answer
 * asking them to look again. Holding the values in state is what makes "record
 * it anyway" a second tap rather than a second round of typing.
 *
 * ## No `window.confirm`
 *
 * Same rule as the cancel and delete forms: browser dialogs block every
 * subsequent event and cannot be styled. The warning renders in place, above
 * the button that acts on it.
 */

/* --------------------------------------------------------------------------
   Record payment
   -------------------------------------------------------------------------- */

export type PaymentMethodOption = { id: string; name: string };

const EMPTY = (today: string): RecordPaymentValues => ({
  amount: '',
  paidAt: today,
  methodId: '',
  reference: '',
  notes: '',
});

export function RecordPaymentPanel({
  bookingId,
  balanceDue,
  methods,
  today,
}: {
  bookingId: string;
  balanceDue: number;
  methods: readonly PaymentMethodOption[];
  /** Today in Riyadh, `YYYY-MM-DD`. Computed server-side — one clock (§8). */
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<RecordPaymentValues>(() => EMPTY(today));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof RecordPaymentValues>(
    key: K,
    value: RecordPaymentValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    // Any edit invalidates a warning about the previous figures — otherwise
    // "record it anyway" would acknowledge a sentence about an amount that is
    // no longer in the box.
    setWarnings([]);
  }

  function submit(acknowledged: boolean) {
    setFailure(null);
    startTransition(async () => {
      const result: PaymentActionResult = await recordPaymentAction({
        bookingId,
        values,
        acknowledged,
      });

      if (result.ok) {
        setValues(EMPTY(today));
        setErrors({});
        setWarnings([]);
        setOpen(false);
        setMessage(result.message);
        // The money strip, the history and the two status pills are all server
        // state. Refreshing is what makes them agree with what was just saved.
        router.refresh();
        return;
      }

      if (result.kind === 'invalid') {
        setErrors(result.fieldErrors);
        setWarnings([]);
        setFailure(result.message);
        return;
      }

      if (result.kind === 'confirm') {
        setErrors({});
        setWarnings(result.warnings);
        return;
      }

      setWarnings([]);
      setFailure(result.message);
    });
  }

  if (!open) {
    return (
      <div className="px-4 py-4 sm:px-5">
        {message ? (
          <p className="mb-3 text-sm text-verdant" role="status">
            {message}
          </p>
        ) : null}
        <button
          type="button"
          className={BUTTON_PRIMARY}
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
        >
          Record payment
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-hairline px-4 py-5 sm:px-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="payment-amount"
          label="Amount (SAR)"
          hint={
            balanceDue > 0 ? `${formatSAR(balanceDue)} outstanding.` : undefined
          }
          error={errors.amount}
          required
        >
          <input
            id="payment-amount"
            inputMode="decimal"
            className={INPUT}
            value={values.amount as string | number}
            onChange={(event) => set('amount', event.target.value)}
            aria-invalid={Boolean(errors.amount)}
          />
        </Field>

        <Field
          id="payment-paidAt"
          label="Date received"
          hint="When the money arrived, not when it was entered."
          error={errors.paidAt}
          required
        >
          <input
            id="payment-paidAt"
            type="date"
            className={INPUT}
            value={values.paidAt}
            onChange={(event) => set('paidAt', event.target.value)}
            aria-invalid={Boolean(errors.paidAt)}
          />
        </Field>

        <Field id="payment-methodId" label="Method" error={errors.methodId}>
          <select
            id="payment-methodId"
            className={SELECT}
            value={values.methodId ?? ''}
            onChange={(event) => set('methodId', event.target.value)}
          >
            <option value="">Not recorded</option>
            {methods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="payment-reference"
          label="Reference"
          hint="Transfer number, cheque number, receipt."
          error={errors.reference}
        >
          <input
            id="payment-reference"
            className={INPUT}
            value={values.reference ?? ''}
            onChange={(event) => set('reference', event.target.value)}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field id="payment-notes" label="Notes" error={errors.notes}>
            <textarea
              id="payment-notes"
              className={TEXTAREA}
              value={values.notes ?? ''}
              onChange={(event) => set('notes', event.target.value)}
            />
          </Field>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div
          role="alert"
          className="mt-5 rounded-[2px] border border-brass/40 bg-brass/5 px-3.5 py-3 text-sm text-ink"
        >
          <ul className="space-y-1.5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {failure ? (
        <div className="mt-5">
          <FormMessage tone="error">{failure}</FormMessage>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={pending}
          className={BUTTON_PRIMARY}
          onClick={() => submit(warnings.length > 0)}
        >
          {warnings.length > 0 ? 'Record it anyway' : 'Record payment'}
        </button>
        <button
          type="button"
          disabled={pending}
          className={BUTTON_SECONDARY}
          onClick={() => {
            setOpen(false);
            setValues(EMPTY(today));
            setErrors({});
            setWarnings([]);
            setFailure(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Reverse a payment (§9.4) — admin only
   -------------------------------------------------------------------------- */

/**
 * Reversal keeps both rows. The wording here says so, because "reverse" beside
 * a delete-shaped button invites the assumption that the entry disappears — and
 * the whole point is that it does not.
 */
export function ReversePaymentForm({
  paymentId,
  amount,
}: {
  paymentId: string;
  amount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await reversePaymentAction({
        paymentId,
        values: { reverseReason: reason },
      });

      if (result.ok) {
        setOpen(false);
        setReason('');
        router.refresh();
        return;
      }

      setError(
        result.kind === 'invalid'
          ? (result.fieldErrors.reverseReason ?? result.message)
          : result.message,
      );
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="min-h-11 text-xs font-semibold text-error underline underline-offset-4"
        onClick={() => setOpen(true)}
      >
        Reverse
      </button>
    );
  }

  return (
    <div className="mt-3 w-full space-y-3 rounded-[2px] border border-error/30 bg-error/5 p-4">
      <div>
        <Label htmlFor={`reverse-${paymentId}`}>
          Why is {formatSAR(amount)} being reversed?
        </Label>
        <p className="mt-1 text-xs text-muted">
          The payment is not deleted. It stays in the history, struck through,
          with this reason beside it — which is what a refund looks like on
          paper.
        </p>
        <div className="mt-2">
          <textarea
            id={`reverse-${paymentId}`}
            className={TEXTAREA}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>
      </div>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={pending}
          className={BUTTON_DANGER}
          onClick={submit}
        >
          Reverse it
        </button>
        <button
          type="button"
          disabled={pending}
          className={BUTTON_SECONDARY}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
