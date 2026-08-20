import { NotAuthorisedError } from '@/lib/auth-guard';

/**
 * The pieces every admin server action answers with.
 *
 * They live outside the action modules because a `'use server'` file may only
 * export async functions — a shared helper cannot sit in one — and because the
 * refusal wording below is a security decision that must read the same in every
 * action rather than being retyped per phase.
 */

/**
 * Dotted paths — `rooms.0.pricePerNight` — so a form can mark the exact row and
 * field that failed rather than showing one message at the top.
 */
export type FieldErrors = Record<string, string>;

/** The first message per path; later issues on the same field add nothing. */
export function fieldErrorsFrom(
  issues: readonly { path: PropertyKey[]; message: string }[],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join('.');
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/**
 * One sentence for the person, and the detail in the log.
 *
 * A `NotAuthorisedError` is answered the same way whatever caused it, and a
 * database fault is never described. Telling the caller which of the two it was
 * is telling them the shape of a system they have no business knowing
 * (`lib/auth-guard.ts`).
 */
export function refuseMessage(error: unknown, fallback: string): string {
  if (error instanceof NotAuthorisedError) {
    return 'You do not have permission to do that.';
  }
  console.error(fallback, error);
  return fallback;
}
