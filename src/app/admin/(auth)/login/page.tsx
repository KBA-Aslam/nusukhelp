import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth-guard';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * `/admin/login` (§4).
 *
 * Someone who already has a live session is sent on rather than shown the form
 * — a signed-in person landing on a login screen has no way to tell whether
 * they are signed in, and the usual next move is to sign in again.
 *
 * There is no "forgot password" link and no sign-up link, because there is
 * neither flow: recovery is an admin re-inviting from `/admin/settings/users`,
 * and registration does not exist at all (§12).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  if (await getSessionUser()) {
    redirect('/admin');
  }

  return (
    <>
      <h1 className="font-display text-xl text-ink">Sign in</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">
        Staff access to the reservation system.
      </p>

      {/* Validated server-side in the action before it is used as a
          destination — see `safeNextPath`. Passing it through untouched here is
          fine precisely because nothing downstream trusts it. */}
      <LoginForm next={typeof next === 'string' ? next : '/admin'} />
    </>
  );
}
