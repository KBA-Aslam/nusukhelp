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
import { getAgencyTotals, listBookings } from '@/db/queries/bookings';
import { PaymentPill, StatusPill } from '@/components/admin/booking-status';
import { BUTTON_PRIMARY } from '@/components/admin/ui';
import { requirePageAccess } from '@/lib/auth-guard';
import { formatDate, formatSAR } from '@/lib/format';
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
 * and a **+ New booking** button. Phase 9 shipped the contact details with a
 * placeholder where the figures go, because every one of them reads the
 * `bookings` table. **Phase 10 fills it in**, and the button appears with it —
 * `/admin/bookings/new?agency=<id>` now exists, so it is a live link rather
 * than the dead one Phase 9 declined to render.
 *
 * The figures exclude drafts and cancelled bookings, exactly as the dashboard's
 * three money figures do (§13.2, §9.8). They have to use the same exclusions or
 * an agency's total will not reconcile with the report's, and the first person
 * to notice will be the one who trusts neither afterwards.
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

  const [totals, recent] = await Promise.all([
    getAgencyTotals(id),
    listBookings({ agencyId: id, limit: 8 }),
  ]);

  const canManage = roleCan(user.role, 'manageAgencies');
  const canCreateBookings = roleCan(user.role, 'createBookings');

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
          <div className="flex flex-wrap gap-2.5">
            {canManage ? (
              <Link
                href={`/admin/agencies/${agency.id}/edit`}
                className={BUTTON_SECONDARY}
              >
                Edit
              </Link>
            ) : null}
            {canCreateBookings && !agency.isArchived ? (
              // §13.3 — step 1 pre-filled, form opens on step 2.
              <Link
                href={`/admin/bookings/new?agency=${agency.id}`}
                className={BUTTON_PRIMARY}
              >
                + New booking
              </Link>
            ) : null}
          </div>
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
          title="Totals"
          description="Drafts and cancelled bookings are excluded, as everywhere else."
        >
          <dl className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3">
            <Figure label="Bookings" value={String(totals.bookingCount)} />
            <Figure label="Rooms" value={String(totals.totalRooms)} />
            <Figure label="Guests" value={String(totals.totalGuests)} />
            <Figure label="Booking value" value={formatSAR(totals.totalValue)} />
            <Figure label="Received" value={formatSAR(totals.received)} />
            <Figure label="Outstanding" value={formatSAR(totals.outstanding)} />
          </dl>
        </Card>

        <Card title="Recent bookings">
          {recent.length === 0 ? (
            <EmptyState>No bookings for this agency yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-hairline">
              {recent.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-mist/50 sm:px-5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">
                        {booking.bookingNumber ?? 'Draft'}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[booking.guestName, booking.hotelName]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-ink">
                        {formatSAR(booking.totalValue)}
                      </span>
                      <StatusPill status={booking.status} />
                      <PaymentPill status={booking.paymentStatus} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
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

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3.5 sm:px-5">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-lg text-ink">{value}</dd>
    </div>
  );
}
