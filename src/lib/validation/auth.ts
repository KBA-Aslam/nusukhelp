import { z } from 'zod';

import { ROLES } from '@/lib/roles';

/**
 * The password length policy (§12 sets no minimum, so this does).
 *
 * Twelve characters, and nothing else imposed. Length is the property that
 * actually resists an offline attack on a stolen hash, and composition rules
 * mostly produce `Passw0rd!` — shorter, more guessable and harder to remember
 * than a passphrase. Better Auth hashes with scrypt (§15).
 *
 * These live here rather than in `lib/auth.ts` and are imported *by* it, not
 * the other way round: this module is imported by the login and accept-invite
 * forms, which are client components, and `lib/auth.ts` pulls in Better Auth,
 * the Drizzle adapter and the Cloudflare context. A constant is not worth
 * putting any of that in a browser bundle.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * The admin authentication schemas — shared client and server, **server
 * authoritative** (Appendix B, §15).
 *
 * Same arrangement as the public forms: one schema each, imported by the form
 * for the error a person sees before submitting and by the server action for
 * the decision that counts. A server action is directly invocable with any
 * argument list, so the client copy is a courtesy and the server copy is the
 * rule (§12).
 */

/* --------------------------------------------------------------------------
   Sign in
   -------------------------------------------------------------------------- */

/**
 * Note what is *not* validated: the password.
 *
 * A minimum length on the sign-in form would tell someone typing a nine-
 * character guess that it cannot be the right password, which is a free bit of
 * information about an account they do not own. It also breaks the day the
 * policy tightens and existing passwords are shorter than the new floor. The
 * length rule belongs on the form where a password is *created*, and that is
 * `acceptInviteSchema` below.
 */
export const signInSchema = z.object({
  email: z.email().max(160),
  password: z.string().min(1, 'Enter your password.').max(MAX_PASSWORD_LENGTH),
});

export type SignInValues = z.infer<typeof signInSchema>;

/* --------------------------------------------------------------------------
   Invite
   -------------------------------------------------------------------------- */

export const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(80),
  email: z.email('Enter a valid email address.').max(160),
  role: z.enum(ROLES),
});

export type InviteValues = z.infer<typeof inviteSchema>;

/* --------------------------------------------------------------------------
   Accept invite
   -------------------------------------------------------------------------- */

/**
 * Length, and nothing else.
 *
 * Twelve characters with no composition rules, for the reason set out in
 * `lib/auth.ts`: length is what resists an offline attack on a stolen scrypt
 * hash, and "one uppercase, one digit, one symbol" mostly produces `Passw0rd!`
 * — shorter, more guessable, and harder to remember than a passphrase.
 *
 * The confirmation field is checked with `refine` so the error attaches to the
 * second input, where the person's attention is, rather than to the form.
 */
export const acceptInviteSchema = z
  .object({
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      )
      .max(MAX_PASSWORD_LENGTH),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  });

export type AcceptInviteValues = z.infer<typeof acceptInviteSchema>;
