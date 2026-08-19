'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAuth } from '@/lib/auth';

/**
 * Sign out (§12).
 *
 * No permission check, deliberately — ending your own session is the one admin
 * action that needs none, and a signed-out caller invoking it directly gets
 * exactly what they asked for. Better Auth deletes the session row; the
 * `nextCookies` plugin clears the cookie on the way out (see `lib/auth.ts`).
 *
 * The redirect is unconditional rather than inside the `try`: if the session
 * row is already gone the cookie should still be cleared and the person should
 * still land on the login screen, and an error page saying "could not sign out"
 * would be both alarming and untrue.
 */
export async function signOutAction(): Promise<void> {
  const auth = await getAuth();

  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    console.error('sign out failed', error);
  }

  redirect('/admin/login');
}
