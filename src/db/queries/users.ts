import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../index';
import { session, user, type Role } from '../schema';

/**
 * Staff accounts, for `/admin/settings/users` (§12).
 *
 * Read helpers plus the two mutations §12 permits on an existing account:
 * change its role, and deactivate or reactivate it. **There is no delete.** A
 * user is named on every booking they created, every payment they recorded and
 * every review they moderated, and removing the row would either break those
 * references or silently rewrite history. Deactivation is the whole mechanism.
 */

export type StaffAccount = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
};

export async function listStaffAccounts(): Promise<StaffAccount[]> {
  const db = getDb();

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.name));
}

export async function findUserByEmail(
  email: string,
): Promise<{ id: string; isActive: boolean } | null> {
  const db = getDb();

  const [row] = await db
    .select({ id: user.id, isActive: user.isActive })
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .limit(1);

  return row ?? null;
}

/**
 * Just the role and the active flag, for the guard that refuses to leave the
 * panel without an admin. A separate query from `listStaffAccounts` because it
 * is asked at the moment of a change, against one row, and reading the whole
 * list to find one is the habit that turns a settings screen into a table scan.
 */
export async function getAccountState(
  userId: string,
): Promise<{ role: Role; isActive: boolean } | null> {
  const db = getDb();

  const [row] = await db
    .select({ role: user.role, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return row ?? null;
}

/**
 * How many **active** admins there are.
 *
 * The users screen uses this to refuse the two changes that would lock everyone
 * out of the panel — demoting or deactivating the last admin. Nothing could
 * restore one afterwards: there is no public sign-up, only an admin can invite,
 * and the seed script is a developer's tool that needs the database credentials
 * and a deploy.
 */
export async function countActiveAdmins(): Promise<number> {
  const db = getDb();

  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, 'admin'), eq(user.isActive, true)));

  return rows.length;
}

export async function setUserRole(userId: string, role: Role): Promise<void> {
  const db = getDb();

  await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, userId));
}

/**
 * Activate or deactivate an account.
 *
 * Deactivating **also revokes every session that account holds**, which is the
 * difference between the change taking effect now and taking effect whenever
 * the person next happens to sign in. Session rows are the one thing in this
 * database that is deleted outright, and they are not anybody's work — a
 * session row *is* the trust a browser currently holds, so withdrawing that
 * trust means removing it. `getSessionUser` re-checks `isActive` on every
 * request regardless, so this is the fast path rather than the only one.
 */
export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<void> {
  const db = getDb();

  await db
    .update(user)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(user.id, userId));

  if (!isActive) {
    await db.delete(session).where(eq(session.userId, userId));
  }
}
