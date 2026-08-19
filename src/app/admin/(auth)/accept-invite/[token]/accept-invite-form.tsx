'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  BUTTON_PRIMARY,
  FormMessage,
  INPUT,
  Label,
} from '@/components/admin/ui';
import { MIN_PASSWORD_LENGTH } from '@/lib/validation/auth';

import { acceptInviteAction, type AcceptInviteState } from './actions';

/**
 * Set a password and activate the account.
 *
 * The email address is shown but not editable, and is not a form field at all —
 * it comes from the invite row the token resolved to, server-side. Letting the
 * invitee type their own address would make the invitation a coupon for an
 * account of any name, which is the one thing the token is there to prevent.
 *
 * `autoComplete="new-password"` on both boxes so a password manager offers to
 * generate and store one rather than autofilling something existing.
 */
export function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction] = useActionState<AcceptInviteState, FormData>(
    acceptInviteAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <FormMessage tone="error">{state.error}</FormMessage>
      ) : null}

      <div>
        <Label htmlFor="email">Email</Label>
        <div className="mt-2">
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            // `readOnly` rather than `disabled`: a disabled input is skipped by
            // the tab order and by most screen readers, and this is information
            // the person needs to be able to reach and check.
            className={`${INPUT} bg-mist text-muted`}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="password">Choose a password</Label>
        <p id="password-hint" className="mt-1 text-xs text-muted">
          At least {MIN_PASSWORD_LENGTH} characters. A short phrase you will
          remember beats a short jumble you will not.
        </p>
        <div className="mt-2">
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            aria-describedby="password-hint"
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <div className="mt-2">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className={INPUT}
          />
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${BUTTON_PRIMARY} w-full`}
    >
      {pending ? 'Activating…' : 'Activate account'}
    </button>
  );
}
