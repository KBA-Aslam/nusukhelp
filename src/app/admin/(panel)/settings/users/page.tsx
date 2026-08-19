import type { Metadata } from 'next';

import { Card, EmptyState, PageHeading, Pill } from '@/components/admin/ui';
import { inviteState, listInvites, type InviteState } from '@/db/queries/invites';
import { listStaffAccounts } from '@/db/queries/users';
import { requirePageAccess } from '@/lib/auth-guard';
import { formatDate } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';

import {
  ActiveForm,
  InviteForm,
  RevokeInviteButton,
  RoleForm,
} from './users-client';

export const metadata: Metadata = { title: 'Users' };

/**
 * `/admin/settings/users` — invite staff, deactivate accounts (§4, §12).
 *
 * Admin only, and the guard here is the *rendering* decision; the actions
 * behind every control on the page each re-check the same capability
 * independently (§12, *Enforcement*).
 *
 * ## Cards, not a table
 *
 * §20.3 turns tables into cards below `md`, and neither list here is wide
 * enough to be worth building twice. An account is a name, an address, a role
 * and two buttons; that is a card at every width, and it saves the panel a
 * table implementation that would then need a card fallback anyway.
 */
export default async function UsersPage() {
  const current = await requirePageAccess('manageUsers');

  const [accounts, invites] = await Promise.all([
    listStaffAccounts(),
    listInvites(),
  ]);

  const now = Math.floor(Date.now() / 1000);

  return (
    <>
      <PageHeading
        title="Users"
        description="Staff accounts and invitations. There is no public sign-up — an account exists only because someone here invited it."
      />

      <div className="space-y-5">
        <Card
          title="Invite someone"
          description="They receive a link that is valid for seven days and can be used once."
        >
          <InviteForm />
        </Card>

        <Card title={`Accounts (${accounts.length})`}>
          <ul className="divide-y divide-hairline">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    <span className="truncate">{account.name}</span>
                    {account.id === current.id ? (
                      <span className="text-xs font-normal text-muted">
                        (you)
                      </span>
                    ) : null}
                    {account.isActive ? (
                      <Pill tone="positive">{ROLE_LABEL[account.role]}</Pill>
                    ) : (
                      <Pill tone="neutral">Deactivated</Pill>
                    )}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted">
                    {account.email}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Added {formatDate(account.createdAt, 'en')}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <RoleForm userId={account.id} role={account.role} />
                  {/* Deactivating yourself is refused by the action; not
                      offering the button is the same answer given earlier. */}
                  {account.id === current.id ? null : (
                    <ActiveForm
                      userId={account.id}
                      isActive={account.isActive}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Invitations"
          description="Every invitation ever sent, including the ones that were used or withdrawn."
        >
          {invites.length === 0 ? (
            <EmptyState>No invitations have been sent yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-hairline">
              {invites.map((invite) => {
                const state = inviteState(invite, now);

                return (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        <span className="truncate">{invite.name}</span>
                        <Pill tone={INVITE_TONE[state]}>{state}</Pill>
                      </p>
                      <p className="mt-1 truncate text-sm text-muted">
                        {invite.email} · {ROLE_LABEL[invite.role]}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {inviteDetail(invite, state)}
                      </p>
                    </div>

                    {state === 'pending' ? (
                      <RevokeInviteButton inviteId={invite.id} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

const INVITE_TONE = {
  pending: 'pending',
  accepted: 'positive',
  revoked: 'neutral',
  expired: 'neutral',
} as const;

function inviteDetail(
  invite: {
    createdAt: number;
    expiresAt: number;
    acceptedAt: number | null;
    invitedByName: string | null;
  },
  state: InviteState,
): string {
  const by = invite.invitedByName ? ` by ${invite.invitedByName}` : '';

  if (state === 'accepted' && invite.acceptedAt) {
    return `Accepted ${formatDate(new Date(invite.acceptedAt * 1000), 'en')} · sent${by}`;
  }
  if (state === 'pending') {
    return `Expires ${formatDate(new Date(invite.expiresAt * 1000), 'en')} · sent${by}`;
  }
  return `Sent ${formatDate(new Date(invite.createdAt * 1000), 'en')}${by}`;
}
