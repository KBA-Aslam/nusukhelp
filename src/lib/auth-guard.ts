import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import type { Role } from '@/db/schema';
import { getAuth, type AuthUser } from '@/lib/auth';
import { roleCan, type Capability } from '@/lib/permissions';

/**
 * The second of §12's two enforcement layers, and the one that actually
 * enforces.
 *
 * `middleware.ts` is the first layer: it keeps a signed-out visitor from ever
 * seeing an admin URL. It is **not** a security boundary, for two reasons. It
 * inspects the session cookie without validating it against the database, so a
 * stale or forged cookie gets past it; and a server action is a POST to the
 * page's own URL that a caller can invoke directly with any arguments they
 * like, so no action may assume any middleware ran before it.
 *
 * Hence: *every server action independently re-checks session and role* (§12,
 * §15). That is what this module is for, and there are exactly two entry
 * points, distinguished by what they do when the answer is no:
 *
 * - `requirePageAccess` — for layouts and pages. Redirects, because a person
 *   who followed a link deserves a login screen rather than a stack trace.
 * - `requireCapability` — for server actions. Throws, because an action that
 *   is not permitted must not continue, and there is no navigation to perform.
 *
 * `import 'server-only'` at the top is the compile-time half of the same idea:
 * a client component that imports this file fails the build instead of shipping
 * a role check into a bundle where the user can edit it.
 */

/**
 * The signed-in user, or `null`.
 *
 * Returns `null` for a deactivated account as well as an absent one. §12 has no
 * separate "suspended" state to communicate — a deactivated user is simply no
 * longer signed in, and their sessions are revoked at the moment of
 * deactivation (`db/queries/users.ts`) so this is a second line rather than the
 * only one.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const auth = await getAuth();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const { id, name, email, role, isActive } = session.user as {
    id: string;
    name: string;
    email: string;
    role?: Role | null;
    isActive?: boolean | null;
  };

  // A user row with no role should not exist — the column is NOT NULL with a
  // default — but the narrowest role is the right thing to assume if one ever
  // does, rather than letting `undefined` fall through a capability check.
  if (!isActive) return null;

  return { id, name, email, role: role ?? 'viewer', isActive: true };
}

/**
 * Guard for an admin **page or layout**.
 *
 * Redirects to the login screen when there is no session, carrying the path the
 * visitor was trying to reach so they land there after signing in rather than
 * on the dashboard. When the session exists but the role is wrong, it redirects
 * to the dashboard instead: they are signed in, so a login screen would be
 * confusing, and the panel is not going to explain which roles it has.
 */
export async function requirePageAccess(
  capability: Capability = 'viewPanel',
): Promise<AuthUser> {
  const user = await getSessionUser();

  if (!user) {
    const path = (await headers()).get('x-admin-path');
    redirect(
      path ? `/admin/login?next=${encodeURIComponent(path)}` : '/admin/login',
    );
  }

  if (!roleCan(user.role, capability)) {
    redirect('/admin');
  }

  return user;
}

/**
 * Thrown by `requireCapability`. A distinct type so an action can tell an
 * authorisation failure from a database fault and answer accordingly — without
 * telling the caller which of the two it was.
 */
export class NotAuthorisedError extends Error {
  constructor(message = 'Not authorised.') {
    super(message);
    this.name = 'NotAuthorisedError';
  }
}

/**
 * Guard for a **server action**. Throws `NotAuthorisedError` unless there is a
 * live session whose role holds the capability.
 *
 * Call this as the first statement of every mutating action, before reading the
 * arguments and before touching the database. Validating the input first and
 * checking permission afterwards leaks the shape of the system to someone who
 * has no business knowing it — and one early `return` away from performing the
 * write.
 */
export async function requireCapability(
  capability: Capability,
): Promise<AuthUser> {
  const user = await getSessionUser();

  if (!user || !roleCan(user.role, capability)) {
    throw new NotAuthorisedError();
  }

  return user;
}
