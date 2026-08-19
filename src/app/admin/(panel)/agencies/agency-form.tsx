'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Card,
  Field,
  FormMessage,
  INPUT,
  StickyActions,
  TEXTAREA,
} from '@/components/admin/ui';
import type { Agency } from '@/db/queries/agencies';

import {
  createAgencyAction,
  setAgencyArchivedAction,
  updateAgencyAction,
  type AgencyActionState,
} from './actions';

/**
 * The agency form, used for both creating and editing.
 *
 * One component rather than two: the fields, the validation and the layout are
 * identical, and the only difference is which action the form posts to and
 * whether an `id` travels with it. Two copies would drift the moment a field
 * was added to one.
 *
 * **Only the name is required.** An agency is often created mid-call with
 * nothing else to hand, and a form that will not save until every box is filled
 * is a form staff work around by typing rubbish into it.
 */

const IDLE: AgencyActionState = { error: null, success: null };

export function AgencyForm({ agency }: { agency: Agency | null }) {
  const [state, formAction] = useActionState(
    agency ? updateAgencyAction : createAgencyAction,
    IDLE,
  );

  const value = (key: keyof Agency): string => {
    const current = agency?.[key];
    return current === null || current === undefined ? '' : String(current);
  };

  return (
    <form action={formAction} className="space-y-5">
      {agency ? <input type="hidden" name="id" value={agency.id} /> : null}

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <Card title="Agency">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <Field id="agencyName" label="Agency name" required>
            <input
              id="agencyName"
              name="agencyName"
              type="text"
              required
              autoFocus={!agency}
              defaultValue={value('agencyName')}
              className={INPUT}
            />
          </Field>

          <Field id="contactPerson" label="Contact person">
            <input
              id="contactPerson"
              name="contactPerson"
              type="text"
              defaultValue={value('contactPerson')}
              className={INPUT}
            />
          </Field>

          {/* §20.3 — `type="tel"` on phone fields, `type="email"` on email.
              The wrong keyboard means slower entry and more mistakes. */}
          <Field id="mobile" label="Mobile">
            <input
              id="mobile"
              name="mobile"
              type="tel"
              defaultValue={value('mobile')}
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
              autoCorrect="off"
              spellCheck={false}
              defaultValue={value('email')}
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

      <Card title="Details">
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <Field id="address" label="Address">
            <textarea
              id="address"
              name="address"
              rows={3}
              defaultValue={value('address')}
              className={TEXTAREA}
            />
          </Field>

          <Field
            id="notes"
            label="Notes"
            hint="Internal — never printed on an invoice or shown to the agency."
          >
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={value('notes')}
              aria-describedby="notes-hint"
              className={TEXTAREA}
            />
          </Field>
        </div>
      </Card>

      <StickyActions>
        <SaveButton isEdit={Boolean(agency)} />
        <Link
          href={agency ? `/admin/agencies/${agency.id}` : '/admin/agencies'}
          className={BUTTON_SECONDARY}
        >
          Cancel
        </Link>
      </StickyActions>
    </form>
  );
}

function SaveButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create agency'}
    </button>
  );
}

/**
 * Archive / restore, on the profile.
 *
 * Deliberately outside the main form: it is a different decision from editing a
 * field, and a person who has just changed a phone number should not be one
 * mis-tap from retiring the agency.
 */
export function ArchiveToggle({
  id,
  isArchived,
}: {
  id: string;
  isArchived: boolean;
}) {
  const [state, formAction] = useActionState(setAgencyArchivedAction, IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="isArchived"
        value={isArchived ? 'false' : 'true'}
      />

      <ArchiveButton isArchived={isArchived} />

      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function ArchiveButton({ isArchived }: { isArchived: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={isArchived ? BUTTON_SECONDARY : BUTTON_DANGER}
    >
      {pending ? 'Saving…' : isArchived ? 'Restore agency' : 'Archive agency'}
    </button>
  );
}
