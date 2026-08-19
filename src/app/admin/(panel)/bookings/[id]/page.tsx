import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PaymentPill, StatusPill } from '@/components/admin/booking-status';
import {
  BUTTON_SECONDARY,
  Card,
  EmptyState,
  PageHeading,
} from '@/components/admin/ui';
import { listAuditForEntity, type AuditEntry } from '@/db/queries/audit';
import { getBooking } from '@/db/queries/bookings';
import { requirePageAccess } from '@/lib/auth-guard';
import { formatDate, formatSAR } from '@/lib/format';
import { roleCan } from '@/lib/permissions';
import { fromSeconds } from '@/lib/time';

import {
  CancelBookingForm,
  DeleteDraftForm,
  MarkCompletedButton,
} from './booking-actions';

export const metadata: Metadata = { title: 'Booking' };

/**
 * `/admin/bookings/[id]` — the main working screen (§13.4).
 *
 * ## The money strip is derived, always
 *
 * Total, paid and due come from columns `recalculateBooking` wrote; nothing on
 * this page computes them. That is what makes the figures here, the figures on
 * the list, and the figures on the invoice PDF the same figures — there is one
 * booking and one derivation, and the PDF is a view of this state rather than a
 * stored document (§8, §10).
 *
 * ## What is deliberately absent
 *
 * **Record payment** (Phase 11) and **Download PDF** (Phase 12) are not
 * rendered, rather than rendered disabled. Phase 9 set that precedent for the
 * agency profile's **+ New booking** button and the sidebar follows it too: a
 * dead control in front of staff is worse than one that appears when it works.
 * Each section says what is coming, so the screen reads as unfinished rather
 * than broken.
 */
export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess();
  const { id } = await params;

  const booking = await getBooking(id);
  if (!booking) notFound();

  const timeline = await listAuditForEntity('booking', id);

  const canEdit =
    roleCan(user.role, 'editBookings') && booking.status !== 'cancelled';
  const canComplete =
    roleCan(user.role, 'markCompleted') &&
    booking.status !== 'cancelled' &&
    booking.status !== 'draft' &&
    booking.status !== 'completed';
  const canCancel =
    roleCan(user.role, 'cancelBookings') &&
    booking.status !== 'cancelled' &&
    booking.status !== 'draft';
  const canDeleteDraft =
    roleCan(user.role, 'createBookings') && booking.status === 'draft';

  const balanceDue = booking.totalValue - booking.amountPaid;

  return (
    <>
      <PageHeading
        title={booking.bookingNumber ?? 'Draft booking'}
        description={
          booking.status === 'draft'
            ? 'Unfinished. It takes a number when it is confirmed.'
            : undefined
        }
        action={
          canEdit ? (
            // "Resume" on a draft, because that is what it does — the form
            // reopens with autosave running and ends in Confirm. "Edit" reads
            // like a change to something finished.
            <Link href={`/admin/bookings/${id}/edit`} className={BUTTON_SECONDARY}>
              {booking.status === 'draft' ? 'Resume' : 'Edit'}
            </Link>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <StatusPill status={booking.status} />
        <PaymentPill status={booking.paymentStatus} />
      </div>

      {booking.status === 'cancelled' ? (
        <div
          role="note"
          className="mb-5 rounded-[2px] border border-error/30 bg-error/5 px-4 py-3 text-sm text-ink"
        >
          <strong>Cancelled.</strong> {booking.cancelReason ?? 'No reason recorded.'}
        </div>
      ) : null}

      {/* --- Money strip (§13.4) — prominent and always visible ---------- */}
      <div className="mb-5 grid gap-px overflow-hidden rounded-[2px] border border-hairline bg-hairline sm:grid-cols-3">
        <Money label="Total value" value={booking.totalValue} />
        <Money label="Paid" value={booking.amountPaid} />
        <Money label="Balance due" value={balanceDue} emphasis={balanceDue > 0} />
      </div>

      <div className="space-y-5">
        <Card title="Booking">
          <dl className="divide-y divide-hairline text-sm">
            <Row label="Agency" value={booking.agencyName} />
            <Row label="Contact" value={booking.contactPerson} />
            <Row
              label="Agency phone"
              value={[booking.agencyMobile, booking.agencyWhatsapp]
                .filter(Boolean)
                .join(' · ')}
            />
            <Row label="Guest" value={booking.guestName} />
            <Row label="Guest phone" value={booking.guestMobile} />
            <Row label="Hotel" value={booking.hotelName} />
            <Row label="Confirmation" value={booking.confirmationNumber} />
            <Row label="BRN / VRN" value={booking.brnVrn} />
            <Row
              label="Stay"
              value={
                booking.checkInDate && booking.checkOutDate
                  ? `${formatDate(fromSeconds(booking.checkInDate), 'en')} → ${formatDate(
                      fromSeconds(booking.checkOutDate),
                      'en',
                    )} · ${booking.totalNights} ${
                      booking.totalNights === 1 ? 'night' : 'nights'
                    }`
                  : null
              }
            />
            <Row
              label="Rooms and guests"
              value={`${booking.totalRooms} rooms · ${booking.totalGuests} guests`}
            />
            <Row
              label="Booked on"
              value={formatDate(fromSeconds(booking.bookingDate), 'en')}
            />
            <Row
              label="Payment due"
              value={
                booking.dueDate ? formatDate(fromSeconds(booking.dueDate), 'en') : null
              }
            />
            <Row label="Notes" value={booking.notes} />
          </dl>
        </Card>

        <Card title="Rooms">
          {booking.rooms.length === 0 ? (
            <EmptyState>No rooms on this booking.</EmptyState>
          ) : (
            <ul className="divide-y divide-hairline">
              {booking.rooms.map((room) => (
                <li
                  key={room.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm sm:px-5"
                >
                  <span>
                    <span className="font-semibold text-ink">{room.roomTypeName}</span>
                    {room.mealPlanCode ? (
                      <span className="ms-2 text-muted">{room.mealPlanCode}</span>
                    ) : null}
                    <span className="block text-xs text-muted">
                      {room.numberOfRooms} × {room.nights}{' '}
                      {room.nights === 1 ? 'night' : 'nights'} ×{' '}
                      {formatSAR(room.pricePerNight)} · {room.numberOfGuests} guests
                    </span>
                  </span>
                  <span className="text-ink">{formatSAR(room.subtotal)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {booking.services.length > 0 ? (
          <Card title="Extra services">
            <ul className="divide-y divide-hairline">
              {booking.services.map((service) => (
                <li
                  key={service.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm sm:px-5"
                >
                  <span>
                    <span className="font-semibold text-ink">{service.serviceName}</span>
                    <span className="block text-xs text-muted">
                      {service.quantity} × {formatSAR(service.unitPrice)}
                    </span>
                  </span>
                  <span className="text-ink">{formatSAR(service.total)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card title="Totals">
          <dl className="divide-y divide-hairline text-sm">
            <Row label="Rooms" value={formatSAR(booking.roomsSubtotal)} />
            <Row label="Services" value={formatSAR(booking.servicesSubtotal)} />
            <Row label="Discount" value={`− ${formatSAR(booking.discountAmount)}`} />
            <Row label="Total value" value={formatSAR(booking.totalValue)} />
            <Row label="Paid" value={formatSAR(booking.amountPaid)} />
            <Row label="Balance due" value={formatSAR(balanceDue)} />
          </dl>
        </Card>

        {/* Payments land in Phase 11 and the two PDF styles in Phase 12. Named
            rather than mocked up, so nobody waits for a button that is not
            there yet. */}
        <Card
          title="Payments"
          description="Recording instalments arrives with the payments phase."
        >
          <EmptyState>
            The booking already carries what has been paid — {formatSAR(booking.amountPaid)} —
            and the status beside it recalculates whenever that changes or the
            booking is edited.
          </EmptyState>
        </Card>

        <Card title="History">
          {timeline.length === 0 ? (
            <EmptyState>Nothing recorded yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-hairline">
              {timeline.map((entry) => (
                <li key={entry.id} className="px-4 py-3 text-sm sm:px-5">
                  <TimelineEntry entry={entry} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* --- Actions ---------------------------------------------------- */}
        {canComplete || canCancel || canDeleteDraft ? (
          <div className="flex flex-wrap items-start gap-2.5">
            {canComplete ? <MarkCompletedButton id={id} /> : null}
            {canCancel ? <CancelBookingForm id={id} /> : null}
            {canDeleteDraft ? <DeleteDraftForm id={id} /> : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

/* --------------------------------------------------------------------------
   Pieces
   -------------------------------------------------------------------------- */

function Money({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-white px-4 py-3.5 sm:px-5">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p
        className={`mt-1 font-display text-xl ${emphasis ? 'text-brass-ink' : 'text-ink'}`}
      >
        {formatSAR(value)}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3 sm:px-5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value || '—'}</dd>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  'booking.created': 'Created',
  'booking.updated': 'Edited',
  'booking.confirmed': 'Confirmed',
  'booking.completed': 'Completed',
  'booking.cancelled': 'Cancelled',
  'booking.draft_deleted': 'Draft deleted',
};

/**
 * One entry, with its before and after values spelled out (§13.10).
 *
 * The values are what matter here, not the fact of the edit: the invoice is
 * re-rendered from current state, so this line is the only surviving record of
 * what the client was shown before someone changed it.
 */
function TimelineEntry({ entry }: { entry: AuditEntry }) {
  const before = entry.changes?.before ?? {};
  const after = entry.changes?.after ?? {};
  const fields = Object.keys(after);

  return (
    <>
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">
          {ACTION_LABEL[entry.action] ?? entry.action}
        </span>
        <span className="text-xs text-muted">
          {formatDate(fromSeconds(entry.createdAt), 'en')}
          {entry.actorName ? ` · ${entry.actorName}` : ''}
        </span>
      </span>

      {fields.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
          {fields.map((field) => (
            <li key={field}>
              {field}: <span className="line-through">{format(before[field])}</span> →{' '}
              <span className="text-ink">{format(after[field])}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {entry.changes?.detail?.reason ? (
        <p className="mt-1.5 text-xs text-muted">
          {String(entry.changes.detail.reason)}
        </p>
      ) : null}
    </>
  );
}

function format(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
