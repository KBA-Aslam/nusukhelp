import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  BUTTON_SECONDARY,
  Card,
  EmptyState,
  PageHeading,
  Pill,
} from '@/components/admin/ui';
import { getAgency } from '@/db/queries/agencies';
import { requirePageAccess } from '@/lib/auth-guard';
import { formatDate } from '@/lib/format';
import { roleCan } from '@/lib/permissions';
import { fromSeconds } from '@/lib/time';

import { ArchiveToggle } from '../agency-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const agency = await getAgency(id);

  return { title: agency?.agencyName ?? 'Agency' };
}

/**
 * `/admin/agencies/[id]` — the agency profile (§4, §13.8).
 *
 * §13.8 asks for contact details plus total bookings, total rooms, total
 * guests, total booking value, total received, outstanding, recent bookings,
 * and a **+ New booking** button. **Everything in that second list depends on
 * the `bookings` table, which arrives in Phase 10**, so this screen ships with
 * the contact details and an honest placeholder where the figures go.
 *
 * The **+ New booking** button is likewise absent rather than disabled: it
 * would point at `/admin/bookings/new`, which does not exist, and a dead link
 * in front of staff on the day the panel opens is worse than a button that
 * appears when it works. Same reasoning as the sidebar listing only the routes
 * that exist.
 */
export default async function AgencyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess();
  const { id } = await params;

  const agency = await getAgency(id);
  if (!agency) notFound();

  const canManage = roleCan(user.role, 'manageAgencies');

  const details: Array<[string, string | null]> = [
    ['Contact person', agency.contactPerson],
    ['Mobile', agency.mobile],
    ['WhatsApp', agency.whatsapp],
    ['Email', agency.email],
    ['Country', agency.country],
    ['Address', agency.address],
  ];

  return (
    <>
      <PageHeading
        title={agency.agencyName}
        description={`Added ${formatDate(fromSeconds(agency.createdAt), 'en')}`}
        action={
          canManage ? (
            <Link
              href={`/admin/agencies/${agency.id}/edit`}
              className={BUTTON_SECONDARY}
            >
              Edit
            </Link>
          ) : undefined
        }
      />

      {agency.isArchived ? (
        <div className="mb-5">
          <Pill tone="neutral">Archived</Pill>
          <p className="mt-2 text-sm text-muted">
            This agency is out of the pickers and the default list. Its history
            is untouched.
          </p>
        </div>
      ) : null}

      <div className="space-y-5">
        <Card title="Contact">
          <dl className="divide-y divide-hairline">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
              >
                <dt className="w-40 shrink-0 text-xs font-semibold tracking-wide text-muted uppercase">
                  {label}
                </dt>
                <dd className="min-w-0 flex-1 text-sm break-words text-ink">
                  {value ?? <span className="text-muted">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {agency.notes ? (
          <Card
            title="Notes"
            description="Internal. Never printed on an invoice."
          >
            <p className="px-4 py-4 text-sm whitespace-pre-line text-ink sm:px-5">
              {agency.notes}
            </p>
          </Card>
        ) : null}

        <Card
          title="Bookings"
          description="Totals, financial history and recent bookings (§13.8)."
        >
          <EmptyState>
            Bookings arrive in Phase 10. This is where an agency&rsquo;s totals,
            what has been received, what is outstanding, and its recent bookings
            will appear.
          </EmptyState>
        </Card>

        {canManage ? (
          <Card
            title="Archive"
            description="Archiving removes the agency from the pickers and the default list. Nothing is deleted, and its bookings are unaffected."
          >
            <div className="px-4 py-4 sm:px-5">
              <ArchiveToggle id={agency.id} isArchived={agency.isArchived} />
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
