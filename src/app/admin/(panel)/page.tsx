import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, PageHeading } from '@/components/admin/ui';
import { requirePageAccess } from '@/lib/auth-guard';
import { roleCan } from '@/lib/permissions';
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/roles';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * The dashboard, as much of it as Phase 8 can honestly build.
 *
 * §13.1 describes it in terms of bookings — value this month, received,
 * outstanding, upcoming check-ins — and there is no `bookings` table until
 * Phase 10. Rather than render five cards of zeroes that look like a working
 * dashboard reporting a dead business, this says plainly what exists and what
 * is coming, and confirms the one thing Phase 8 genuinely establishes: who you
 * are signed in as and what that lets you do.
 *
 * The guard is repeated here even though `(panel)/layout.tsx` already ran one.
 * A layout is not a gate a page can rely on — Next may render them
 * independently, and the cost of asking twice is one indexed lookup.
 */
export default async function AdminDashboardPage() {
  const user = await requirePageAccess();

  return (
    <>
      <PageHeading
        title={`Welcome, ${user.name.split(' ')[0]}`}
        description="Al Haramain Reservation — bookings, payments and invoicing."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Your access">
          <div className="px-4 py-4 sm:px-5">
            <p className="text-sm font-semibold text-ink">
              {ROLE_LABEL[user.role]}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              {ROLE_DESCRIPTION[user.role]}
            </p>
            <p className="mt-3 text-sm text-muted">
              Signed in as {user.email}.
            </p>
          </div>
        </Card>

        <Card title="What is built">
          <div className="px-4 py-4 text-sm text-muted sm:px-5">
            <p>
              Phase 8 establishes sign-in, roles and staff invitations. Bookings
              arrive in Phase 10, payments in Phase 11, and the figures this
              screen is meant to show — booking value, received, outstanding,
              upcoming check-ins — arrive with them in Phase 14.
            </p>
            {roleCan(user.role, 'manageUsers') ? (
              <p className="mt-3">
                <Link
                  href="/admin/settings/users"
                  className="font-semibold text-verdant underline underline-offset-4"
                >
                  Invite the rest of the team
                </Link>
                .
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
