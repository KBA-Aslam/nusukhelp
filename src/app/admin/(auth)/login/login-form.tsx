'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  BUTTON_PRIMARY,
  FormMessage,
  INPUT,
  Label,
} from '@/components/admin/ui';

import { signInAction, type SignInState } from './actions';

/**
 * The sign-in form.
 *
 * A plain `<form action={...}>` bound to the server action, not a fetch. That
 * gives a form which submits without JavaScript, which is what makes the panel
 * reachable on a phone with a flaky connection before hydration finishes — and
 * it is why §12's "every server action re-checks" phrasing is the right one:
 * this posts straight to the action.
 *
 * No client-side validation beyond the browser's own `required` and
 * `type="email"`. The public forms use React Hook Form and Zod because they are
 * long and a person can waste real effort on them; a login form has two fields
 * and exactly one meaningful error, which the server already returns in the
 * single generic wording §15 requires. Re-checking the address format here
 * would only produce a second, differently worded rejection.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<SignInState, FormData>(
    signInAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <FormMessage tone="error">{state.error}</FormMessage>
      ) : null}

      <div>
        <Label htmlFor="email">Email</Label>
        <div className="mt-2">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            // §20.3 — the right keyboard on a phone. `type="email"` gives the
            // one with `@` and `.` on the primary layer.
            inputMode="email"
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <div className="mt-2">
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={INPUT}
          />
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

/**
 * Separate component because `useFormStatus` reports the status of the form it
 * is rendered *inside*; called in the parent it would always read `false`.
 *
 * Disabling on submit is the point: a double-tapped sign-in on a slow
 * connection otherwise spends two of the five attempts §12 allows.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={`${BUTTON_PRIMARY} w-full`}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}
