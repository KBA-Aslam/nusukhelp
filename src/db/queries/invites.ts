import { and, desc, eq, isNull } from 'drizzle-orm';

import { getDb } from '../index';
import { adminInvites, user, type Role } from '../schema';

/**
 * Staff invitations (§12).
 *
 * Nothing in this module ever sees a plaintext token. Callers hash first
 * (`lib/invites.ts`) and pass the digest; `findLiveInviteByHash` looks a row up
 * by digest. Keeping it that way means an accidental `console.log` in here
 * cannot put a working invite link in the Worker log.
 */

export type InviteRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  expiresAt: number;
  acceptedAt: number | null;
  revokedAt: number | null;
  createdAt: number;
  invitedByName: string | null;
};

export type InviteState = 'pending' | 'accepted' | 'revoked' | 'expired';

/**
 * Which of the four states an invite is in, computed rather than stored.
 *
 * A stored status would need a job to move rows from `pending` to `expired` at
 * the seven-day mark, and a row's state would then be a claim that had to be
 * kept true. `expiresAt` is the fact; the state is a reading of it.
 */
export function inviteState(invite: InviteRow, nowSeconds: number): InviteState {
  if (invite.acceptedAt) return 'accepted';
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt <= nowSeconds) return 'expired';
  return 'pending';
}

export async function listInvites(): Promise<InviteRow[]> {
  const db = getDb();

  return db
    .select({
      id: adminInvites.id,
      email: adminInvites.email,
      name: adminInvites.name,
      role: adminInvites.role,
      expiresAt: adminInvites.expiresAt,
      acceptedAt: adminInvites.acceptedAt,
      revokedAt: adminInvites.revokedAt,
      createdAt: adminInvites.createdAt,
      invitedByName: user.name,
    })
    .from(adminInvites)
    .leftJoin(user, eq(adminInvites.invitedBy, user.id))
    .orderBy(desc(adminInvites.createdAt));
}

export async function createInvite(invite: {
  id: string;
  email: string;
  name: string;
  role: Role;
  tokenHash: string;
  invitedBy: string;
  expiresAt: number;
  createdAt: number;
}): Promise<void> {
  const db = getDb();
  await db.insert(adminInvites).values(invite);
}

/**
 * Revokes every outstanding invite for an address.
 *
 * Called before a fresh invite is issued to the same person, so that the link
 * in the old email stops working the moment the new one is sent. Without it,
 * re-inviting someone whose first link went astray would leave both live, and
 * the stray one would keep working for the rest of its seven days.
 */
export async function revokeInvitesForEmail(
  email: string,
  nowSeconds: number,
): Promise<void> {
  const db = getDb();

  await db
    .update(adminInvites)
    .set({ revokedAt: nowSeconds })
    .where(
      and(
        eq(adminInvites.email, email.toLowerCase()),
        isNull(adminInvites.acceptedAt),
        isNull(adminInvites.revokedAt),
      ),
    );
}

export async function revokeInvite(
  id: string,
  nowSeconds: number,
): Promise<void> {
  const db = getDb();

  await db
    .update(adminInvites)
    .set({ revokedAt: nowSeconds })
    .where(
      and(
        eq(adminInvites.id, id),
        isNull(adminInvites.acceptedAt),
        isNull(adminInvites.revokedAt),
      ),
    );
}

/**
 * The invite a token names, if it is still usable.
 *
 * "Usable" is checked here rather than by the caller — not accepted, not
 * revoked, not expired — so that no code path can look a token up and then
 * forget one of the three conditions. A token that fails any of them is
 * indistinguishable from one that never existed, which is also what the
 * accept-invite page tells the visitor (§15, *Auth errors: generic*).
 */
export async function findLiveInviteByHash(
  tokenHash: string,
  nowSeconds: number,
): Promise<{
  id: string;
  email: string;
  name: string;
  role: Role;
} | null> {
  const db = getDb();

  const [row] = await db
    .select({
      id: adminInvites.id,
      email: adminInvites.email,
      name: adminInvites.name,
      role: adminInvites.role,
      expiresAt: adminInvites.expiresAt,
      acceptedAt: adminInvites.acceptedAt,
      revokedAt: adminInvites.revokedAt,
    })
    .from(adminInvites)
    .where(eq(adminInvites.tokenHash, tokenHash))
    .limit(1);

  if (!row) return null;
  if (row.acceptedAt || row.revokedAt) return null;
  if (row.expiresAt <= nowSeconds) return null;

  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

/**
 * Marks an invite accepted, and reports whether it was still open.
 *
 * The `isNull(acceptedAt)` in the WHERE clause is the guard, not the read that
 * preceded it: two submissions of the accept form arriving together would both
 * pass a prior check, and only one of them updates a row here. The caller
 * creates the account only if this returns `true`, so a double submit produces
 * one user rather than two — or, worse than two users, one user and one
 * unique-constraint error page after the account already existed.
 */
export async function markInviteAccepted(
  id: string,
  nowSeconds: number,
): Promise<boolean> {
  const db = getDb();

  const result = await db
    .update(adminInvites)
    .set({ acceptedAt: nowSeconds })
    .where(and(eq(adminInvites.id, id), isNull(adminInvites.acceptedAt)))
    .run();

  return (result.meta?.changes ?? 0) > 0;
}
