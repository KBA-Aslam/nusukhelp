'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  BUTTON_PRIMARY,
  Card,
  Field,
  FormMessage,
  INPUT,
  StickyActions,
  TEXTAREA,
} from '@/components/admin/ui';
import type { CompanySettings } from '@/db/queries/company';

import { saveCompanyAction, type CompanyActionState } from './actions';

/**
 * The company details form (§4, §10).
 *
 * One form, grouped into cards, with a single sticky Save at the bottom (§20.3)
 * rather than a save per section — this is a form someone fills once and then
 * corrects a line of, and four independent save buttons would leave three
 * sections silently unsaved.
 *
 * ## What is deliberately absent
 *
 * There is no VAT number field and no VAT rate field. §9.9 and Appendix A: the
 * company is not VAT-registered, the document is "INVOICE" and never "Tax
 * Invoice", and there is no VAT line. An empty box labelled *VAT number* is an
 * invitation to fill one in.
 */

const IDLE: CompanyActionState = { error: null, success: null };

export function CompanyForm({ settings }: { settings: CompanySettings | null }) {
  const [state, formAction] = useActionState(saveCompanyAction, IDLE);

  // `??` throughout rather than `||`, so a legitimately empty string stays
  // empty instead of being replaced by a default.
  const value = (key: keyof CompanySettings): string => {
    const current = settings?.[key];
    return current === null || current === undefined ? '' : String(current);
  };

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}

      <Card
        title="Identity"
        description="What the invoice header says the company is."
      >
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <Field id="legalName" label="Legal name" required>
            <input
              id="legalName"
              name="legalName"
              type="text"
              required
              defaultValue={value('legalName')}
              className={INPUT}
            />
          </Field>

          <Field id="tradingName" label="Trading name">
            <input
              id="tradingName"
              name="tradingName"
              type="text"
              defaultValue={value('tradingName')}
              className={INPUT}
            />
          </Field>

          <Field
            id="crNumber"
            label="Commercial registration number"
            hint="Printed on the invoice. There is no VAT number: the company is not VAT-registered."
          >
            <input
              id="crNumber"
              name="crNumber"
              type="text"
              defaultValue={value('crNumber')}
              aria-describedby="crNumber-hint"
              className={INPUT}
            />
          </Field>

          <Field
            id="numberPrefix"
            label="Booking number prefix"
            hint="The AHR in AHR-2026-00041. Changing it does not renumber existing bookings."
          >
            <input
              id="numberPrefix"
              name="numberPrefix"
              type="text"
              required
              maxLength={6}
              defaultValue={value('numberPrefix')}
              autoCapitalize="characters"
              aria-describedby="numberPrefix-hint"
              className={INPUT}
            />
          </Field>
        </div>
      </Card>

      <Card title="Address">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <Field id="addressLine1" label="Address line 1">
            <input
              id="addressLine1"
              name="addressLine1"
              type="text"
              defaultValue={value('addressLine1')}
              className={INPUT}
            />
          </Field>

          <Field id="addressLine2" label="Address line 2">
            <input
              id="addressLine2"
              name="addressLine2"
              type="text"
              defaultValue={value('addressLine2')}
              className={INPUT}
            />
          </Field>

          <Field id="city" label="City">
            <input
              id="city"
              name="city"
              type="text"
              defaultValue={value('city')}
              className={INPUT}
            />
          </Field>

          <Field id="country" label="Country">
            <input
              id="country"
              name="country"
              type="text"
              defaultValue={value('country')}
              className={INPUT}
            />
          </Field>
        </div>
      </Card>

      <Card title="Contact">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <Field id="phonePrimary" label="Phone">
            <input
              id="phonePrimary"
              name="phonePrimary"
              type="tel"
              defaultValue={value('phonePrimary')}
              className={INPUT}
            />
          </Field>

          <Field id="phoneSecondary" label="Second phone">
            <input
              id="phoneSecondary"
              name="phoneSecondary"
              type="tel"
              defaultValue={value('phoneSecondary')}
              className={INPUT}
            />
          </Field>

          <Field id="whatsapp" label="WhatsApp">
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              defaultValue={value('whatsapp')}
              className={INPUT}
            />
          </Field>

          <Field id="email" label="Email">
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={value('email')}
              className={INPUT}
            />
          </Field>

          <Field id="website" label="Website">
            <input
              id="website"
              name="website"
              type="text"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={value('website')}
              className={INPUT}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Bank details"
        description="Printed on the invoice so an agency can pay against it."
      >
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <Field id="bankName" label="Bank">
            <input
              id="bankName"
              name="bankName"
              type="text"
              defaultValue={value('bankName')}
              className={INPUT}
            />
          </Field>

          <Field id="bankAccountName" label="Account name">
            <input
              id="bankAccountName"
              name="bankAccountName"
              type="text"
              defaultValue={value('bankAccountName')}
              className={INPUT}
            />
          </Field>

          <Field id="bankIban" label="IBAN">
            <input
              id="bankIban"
              name="bankIban"
              type="text"
              autoCapitalize="characters"
              spellCheck={false}
              defaultValue={value('bankIban')}
              className={INPUT}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Invoice footer"
        description="The standing terms and the signature block."
      >
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <Field
            id="defaultTerms"
            label="Default terms & conditions"
            hint="Snapshotted onto a booking when it is confirmed, so later edits here never change a document already issued."
          >
            <textarea
              id="defaultTerms"
              name="defaultTerms"
              rows={8}
              defaultValue={value('defaultTerms')}
              aria-describedby="defaultTerms-hint"
              className={TEXTAREA}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="preparedByLabel" label="Prepared-by label">
              <input
                id="preparedByLabel"
                name="preparedByLabel"
                type="text"
                defaultValue={value('preparedByLabel')}
                className={INPUT}
              />
            </Field>

            <Field id="approvedByName" label="Approved-by name">
              <input
                id="approvedByName"
                name="approvedByName"
                type="text"
                defaultValue={value('approvedByName')}
                className={INPUT}
              />
            </Field>
          </div>
        </div>
      </Card>

      <StickyActions>
        <SaveButton />
        <span className="text-xs text-muted">
          These details print on every invoice.
        </span>
      </StickyActions>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
      {pending ? 'Saving…' : 'Save company details'}
    </button>
  );
}
