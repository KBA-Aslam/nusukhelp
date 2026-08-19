'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import {
  createInvite,
  revokeInvite,
  revokeInvitesForEmail,
} from '@/db/queries/invites';
import {
  countActiveAdmins,
  findUserByEmail,
  getAccountState,
  setUserActive,
  setUserRole,
} from '@/db/queries/users';
import { NotAuthorisedError, requireCapability } from '@/lib/auth-guard';
import { sendInviteEmail } from '@/lib/email';
import {
  generateInviteToken,
  hashInviteToken,
  INVITE_TTL_SECONDS,
  inviteUrl,
} from '@/lib/invites';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { SITE_URL } from '@/lib/site';
import { inviteSchema } from '@/lib/validation/auth';
import { nowSeconds } from '@/lib/time';

/**
 * `/admin/settings/users` — invite staff, deactivate accounts (§4, §12).
 *
 * **Every action here opens with `requireCapability('manageUsers')`**, which is
 * §12's second enforcement layer and the one that counts. The middleware only
 * looked at a cookie; the layout only decided what to render. A server action is
 * a POST to the page's own URL that anyone can make with any arguments, so each
 * of these re-derives the session and the role from the database before it does
 * anything at all — before reading the arguments, and certainly before writing.
 *
 * They also each protect the same invariant: **the panel must never be left
 * without an active admin.** Nothing could undo it. There is no public sign-up,
 * only an admin can invite, and the seed script needs database credentials and
 * a deploy. So demoting or deactivating the last one is refused.
 */

const PATH = '/admin/settings/users';

/**
 * A file marked `'use server'` may export nothing but async functions, so the
 * idle value of this state lives in `users-client.tsx` beside the components
 * that pass it to `useActionState`. The type is fine here — types are erased.
 */
export type UsersActionState = {
  error: string | null;
  success: string | null;
};

/**
 * Turns a thrown error into the message a person sees.
 *
 * `NotAuthorisedError` gets a flat refusal with no detail. Everything else gets
 * a generic sentence and goes to `wrangler tail`: a database error rendered
 * verbatim into a page is how table names and column names end up on a screen.
 */
function toMessage(error: unknown, fallback: string): UsersActionState {
  if (error instanceof NotAuthorisedError) {
    return { error: 'You do not have permission to do that.', success: null };
  }
  console.error(fallback, error);
  return { error: fallback, success: null };
}

/* --------------------------------------------------------------------------
   Invite
   -------------------------------------------------------------------------- */

export async function inviteUserAction(
  _previous: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  try {
    const admin = await requireCapability('manageUsers');

    const parsed = inviteSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Check the details and try again.',
        success: null,
      };
    }

    const email = parsed.data.email.toLowerCase();

    const existing = await findUserByEmail(email);
    if (existing) {
      // Unlike the sign-in form, this one may say so. The caller is an
      // authenticated admin looking at a list that already shows them every
      // account, so there is nothing here they could not read on the same page
      // — and "the invitation was sent" for an address that will never receive
      // one is a worse answer.
      return {
        error: existing.isActive
          ? 'That email address already has an account.'
          : 'That email address has a deactivated account. Reactivate it instead of inviting again.',
        success: null,
      };
    }

    const now = nowSeconds();
    const token = generateInviteToken();
    const origin = await requestOrigin();

    /**
     * Send first, then write the row.
     *
     * The plaintext token exists in exactly one durable place — the email — and
     * the row holds only its hash. If the send fails after the row is written,
     * the result is an invitation nobody can accept and an admin who was told
     * it went out. Sending first means a failure produces no row and an honest
     * error, and the worst case is the reverse: a delivered email whose row was
     * never written, whose link simply does not resolve. That fails safe.
     */
    await sendInviteEmail({
      to: email,
      name: parsed.data.name,
      roleLabel: ROLE_LABEL[parsed.data.role],
      invitedByName: admin.name,
      url: inviteUrl(origin, token),
      expiresInDays: INVITE_TTL_SECONDS / 86400,
    });

    // Any earlier outstanding invitation for this address stops working now.
    // Otherwise re-inviting someone whose first link went astray would leave
    // both live, and the stray one would keep working for its remaining days.
    await revokeInvitesForEmail(email, now);

    await createInvite({
      id: crypto.randomUUID(),
      email,
      name: parsed.data.name,
      role: parsed.data.role,
      tokenHash: await hashInviteToken(token),
      invitedBy: admin.id,
      expiresAt: now + INVITE_TTL_SECONDS,
      createdAt: now,
    });

    revalidatePath(PATH);
    return { error: null, success: `Invitation sent to ${email}.` };
  } catch (error) {
    return toMessage(error, 'The invitation could not be sent.');
  }
}

export async function revokeInviteAction(
  _previous: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  try {
    await requireCapability('manageUsers');

    const id = formData.get('inviteId');
    if (typeof id !== 'string' || !id) {
      return { error: 'That invitation could not be found.', success: null };
    }

    await revokeInvite(id, nowSeconds());

    revalidatePath(PATH);
    return { error: null, success: 'Invitation withdrawn.' };
  } catch (error) {
    return toMessage(error, 'The invitation could not be withdrawn.');
  }
}

/* --------------------------------------------------------------------------
   Existing accounts
   -------------------------------------------------------------------------- */

export async function setRoleAction(
  _previous: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  try {
    const admin = await requireCapability('manageUsers');

    const userId = formData.get('userId');
    const role = formData.get('role');

    if (typeof userId !== 'string' || !userId) {
      return { error: 'That account could not be found.', success: null };
    }
    if (!isRole(role)) {
      return { error: 'That is not a valid role.', success: null };
    }

    // Demoting yourself out of `admin` when you are the only one left removes
    // the last person who could put it back.
    if (role !== 'admin' && (await wouldStrandThePanel(userId))) {
      return {
        error:
          'This is the only active admin. Promote someone else to admin first.',
        success: null,
      };
    }

    await setUserRole(userId, role);

    revalidatePath(PATH);
    return {
      error: null,
      success:
        userId === admin.id
          ? `Your role is now ${ROLE_LABEL[role]}.`
          : `Role updated to ${ROLE_LABEL[role]}.`,
    };
  } catch (error) {
    return toMessage(error, 'The role could not be changed.');
  }
}

export async function setActiveAction(
  _previous: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  try {
    const admin = await requireCapability('manageUsers');

    const userId = formData.get('userId');
    const isActive = formData.get('isActive') === 'true';

    if (typeof userId !== 'string' || !userId) {
      return { error: 'That account could not be found.', success: null };
    }

    if (!isActive) {
      if (userId === admin.id) {
        // Not a lockout risk so much as an obvious mistake — one tap and you
        // are signed out of the panel you were administering.
        return {
          error: 'You cannot deactivate your own account.',
          success: null,
        };
      }
      if (await wouldStrandThePanel(userId)) {
        return {
          error:
            'This is the only active admin. Promote someone else to admin first.',
          success: null,
        };
      }
    }

    await setUserActive(userId, isActive);

    revalidatePath(PATH);
    return {
      error: null,
      success: isActive ? 'Account reactivated.' : 'Account deactivated.',
    };
  } catch (error) {
    return toMessage(error, 'The account could not be updated.');
  }
}

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'executive' || value === 'viewer';
}

/**
 * Would removing this account's admin powers leave nobody holding them?
 *
 * Counts *active* admins, so it is also true when the only other admin is
 * already deactivated. Cheap — a handful of rows — and asked at the moment of
 * the change rather than cached, because the answer moves.
 */
async function wouldStrandThePanel(userId: string): Promise<boolean> {
  const target = await getAccountState(userId);

  if (!target || target.role !== 'admin' || !target.isActive) return false;

  return (await countActiveAdmins()) <= 1;
}

/**
 * The origin the invite link is built on.
 *
 * Taken from the request rather than from a constant, so that a link generated
 * from `www.nusukhelp.com` points back at `www.nusukhelp.com` and one generated
 * in local development points at localhost. `SITE_URL` would be right in
 * production and wrong everywhere an invite is ever tested.
 *
 * Both host headers come from Cloudflare in front of this Worker, which is what
 * makes them safe to build a link on here; the fallback is the canonical site.
 */
async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();

  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'https';

  if (!host) return SITE_URL;

  return `${proto}://${host}`;
}
