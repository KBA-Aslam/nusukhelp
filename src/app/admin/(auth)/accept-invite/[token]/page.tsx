import type { Metadata } from 'next';
import Link from 'next/link';

import { findLiveInviteByHash } from '@/db/queries/invites';
import { hashInviteToken } from '@/lib/invites';
import { ROLE_LABEL } from '@/lib/roles';
import { nowSeconds } from '@/lib/time';

import { AcceptInviteForm } from './accept-invite-form';

export const metadata: Metadata = { title: 'Accept invitation' };

/**
 * `/admin/accept-invite/[token]` — step 5 of §12.
 *
 * The URL segment is the plaintext token. It is hashed here and the **hash** is
 * what queries the table (§15); the plaintext is never written anywhere, and it
 * reaches the form again only as a hidden field so the submission can be
 * matched to the same row.
 *
 * ## One message for every way a link can fail
 *
 * Expired, already used, revoked, never existed, garbled by a mail client that
 * wrapped the line — all produce the sentence below. Distinguishing them would
 * turn the page into an oracle: "this invitation has expired" confirms that the
 * token was real, which is a useful thing to learn if you are trying tokens.
 * The person holding a genuinely dead link needs to do the same thing in every
 * case — ask for another one — so the specific reason would not help them
 * either.
 */
export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await findLiveInviteByHash(
    await hashInviteToken(token),
    nowSeconds(),
  );

  if (!invite) {
    return (
      <>
        <h1 className="font-display text-xl text-ink">
          This invitation link is not valid
        </h1>
        <p className="mt-3 text-sm text-muted">
          It may have expired, been used already, or been withdrawn.
          Invitations are valid for seven days. Ask an administrator to send you
          a new one.
        </p>
        <p className="mt-5 text-sm">
          <Link
            href="/admin/login"
            className="font-semibold text-verdant underline underline-offset-4"
          >
            Go to sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-xl text-ink">
        Welcome, {invite.name.split(' ')[0]}
      </h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">
        You have been invited to the Al Haramain Reservation admin panel as{' '}
        <span className="font-semibold text-ink">
          {ROLE_LABEL[invite.role]}
        </span>
        . Choose a password to activate your account.
      </p>

      <AcceptInviteForm token={token} email={invite.email} />
    </>
  );
}
