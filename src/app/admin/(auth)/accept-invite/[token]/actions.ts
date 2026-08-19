'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createLocalAccountIssuer } from 'better-auth/db';

import { findLiveInviteByHash, markInviteAccepted } from '@/db/queries/invites';
import { findUserByEmail } from '@/db/queries/users';
import { getAuth } from '@/lib/auth';
import { hashInviteToken } from '@/lib/invites';
import { acceptInviteSchema } from '@/lib/validation/auth';
import { nowSeconds } from '@/lib/time';

/**
 * Accepting an invitation — steps 5 and 6 of §12.
 *
 * ## Why this does not call sign-up
 *
 * `emailAndPassword.disableSignUp` is `true`, which closes Better Auth's
 * sign-up path to everyone — including this action. That is the point: with it
 * open, the invitation would be a UI convention rather than an access model.
 * So the account is written through Better Auth's own internal adapter: the
 * same calls its sign-up route makes, minus the route.
 *
 * Using the library's internals rather than inserting rows directly matters for
 * one specific reason: the password. `ctx.password.hash` is Better Auth's
 * scrypt with Better Auth's parameters, so what is stored is exactly what its
 * sign-in verifier expects to read (§15). Hand-rolling that is how an account
 * gets created that can never sign in.
 *
 * ## The invite is claimed before the account is created
 *
 * `markInviteAccepted` updates conditionally on the invite still being open and
 * reports whether it changed a row. Two submissions arriving together — a
 * double-tapped button on a slow phone — both pass the read that came before,
 * and only one of them wins the update. The loser stops there. In the other
 * order, the account would be created twice and the second attempt would fail
 * on the unique email index, after the first had already succeeded, leaving a
 * confusing error on a screen where everything had in fact worked.
 */

export type AcceptInviteState = { error: string | null };

export async function acceptInviteAction(
  _previous: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = formData.get('token');
  if (typeof token !== 'string' || token.length === 0) {
    return { error: 'This invitation link is not valid.' };
  }

  const parsed = acceptInviteSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? 'Check the password and try again.',
    };
  }

  // Re-checked here and not merely on the page that rendered the form. The page
  // established that the link was live when it was loaded; this action is a
  // POST that can be made without ever loading it, and the invite may have been
  // revoked or expired in between (§12, *Enforcement*).
  const now = nowSeconds();
  const invite = await findLiveInviteByHash(await hashInviteToken(token), now);

  if (!invite) {
    return {
      error:
        'This invitation link is no longer valid. Ask an administrator to send a new one.',
    };
  }

  // Belt and braces against an invite issued to an address that acquired an
  // account by some other route in the meantime. The unique index on
  // `user.email` would catch it; this catches it with a sentence a person can
  // act on rather than a five hundred.
  if (await findUserByEmail(invite.email)) {
    return {
      error:
        'An account already exists for this email address. Sign in instead.',
    };
  }

  if (!(await markInviteAccepted(invite.id, now))) {
    return { error: 'This invitation has already been used.' };
  }

  const auth = await getAuth();
  const ctx = await auth.$context;

  const created = await ctx.internalAdapter.createUser(
    {
      email: invite.email,
      name: invite.name,
      // The role comes from the invite an admin created, never from the form.
      // Both additional fields are `input: false` in `lib/auth.ts` as well, so
      // a crafted request body cannot reach them either.
      role: invite.role,
      isActive: true,
      // No verification email is ever sent (§12 has no such step), and the
      // address is already proven: the invitation arrived at it. Leaving this
      // false would be a claim that a check is pending when none is coming.
      emailVerified: true,
    },
    // Provisioning origin, for Better Auth's own hooks. This account is created
    // with a password, which is what `email-password` denotes.
    { method: 'email-password' },
  );

  if (!created) {
    return { error: 'The account could not be created. Please try again.' };
  }

  await ctx.internalAdapter.createAccount({
    userId: created.id,
    providerId: 'credential',
    issuer: createLocalAccountIssuer('credential'),
    accountId: created.id,
    password: await ctx.password.hash(parsed.data.password),
  });

  /**
   * Sign them straight in.
   *
   * They have just proved they hold the invitation and chosen the password, so
   * asking for it again on the next screen is a step that tests nothing. This
   * goes through the normal sign-in endpoint rather than minting a session by
   * hand, so the session row, the cookie and its attributes are whatever
   * `lib/auth.ts` configured and not a second implementation of the same thing.
   */
  try {
    await auth.api.signInEmail({
      body: { email: invite.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    // The account exists and the password is set, so this is a working account
    // either way. Send them to the login screen to finish by hand.
    console.error('auto sign-in after invite acceptance failed', error);
    redirect('/admin/login');
  }

  redirect('/admin');
}
