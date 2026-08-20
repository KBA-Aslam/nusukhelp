import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PaymentPill, StatusPill } from '@/components/admin/booking-status';
import {
  BUTTON_SECONDARY,
  Card,
  EmptyState,
  PageHeading,
  Pill,
} from '@/components/admin/ui';
import {
  AUDIT_DATE_FIELDS,
  AUDIT_FIELD_LABELS,
  AUDIT_MONEY_FIELDS,
  listAuditForEntity,
  type AuditEntry,
} from '@/db/queries/audit';
import { getBooking } from '@/db/queries/bookings';
import { listSimpleLookups } from '@/db/queries/lookups';
import { listPayments, type Payment } from '@/db/queries/payments';
import { requirePageAccess } from '@/lib/auth-guard';
import { formatDate, formatSAR } from '@/lib/format';
import { roleCan } from '@/lib/permissions';
import { fromSeconds, secondsToDateString, todayInRiyadh } from '@/lib/time';

import {
  CancelBookingForm,
  DeleteDraftForm,
  MarkCompletedButton,
} from './booking-actions';
import { PaymentsSection, ReversePaymentForm } from './payment-forms';

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
 * Recording a payment moves them, and so does editing the booking — both go
 * through `recalculateBooking` and this page reads the result. Nothing here
 * adds a payment to a total in the browser.
 *
 * ## What is deliberately absent
 *
 * **Download PDF** (Phase 12) is not rendered, rather than rendered disabled.
 * Phase 9 set that precedent for the agency profile's **+ New booking** button
 * and the sidebar follows it too: a dead control in front of staff is worse
 * than one that appears when it works. The section says what is coming, so the
 * screen reads as unfinished rather than broken.
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

  // Three independent reads on a screen that is often opened over hotel wifi.
  const [timeline, payments, lookups] = await Promise.all([
    listAuditForEntity('booking', id),
    listPayments(id),
    listSimpleLookups(),
  ]);

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
  // §9.4 — a draft has no agreed value to pay against, and a cancelled booking
  // takes a reversal rather than a new instalment. The server action refuses
  // both independently; this only decides what to offer.
  const canRecordPayment =
    roleCan(user.role, 'recordPayments') &&
    booking.status !== 'draft' &&
    booking.status !== 'cancelled';
  const canReversePayment = roleCan(user.role, 'reversePayments');

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

        {/* --- Payment history (§13.4, §9.4) ------------------------------ */}
        <Card
          title="Payments"
          description={
            payments.length > 0
              ? 'Instalments in the order the money arrived. Reversals stay in place.'
              : undefined
          }
        >
          {/* The history is server-rendered; `PaymentsSection` wraps it only so
              that recording and reversing share one line saying what just
              happened. Two components moving the same figures must not each
              keep their own answer. */}
          <PaymentsSection
            bookingId={id}
            balanceDue={balanceDue}
            canRecord={canRecordPayment}
            methods={lookups.payment_methods
              .filter((method) => method.isActive)
              .map((method) => ({ id: method.id, name: method.name }))}
            today={secondsToDateString(todayInRiyadh())}
          >
            {payments.length === 0 ? (
              <EmptyState>
                {booking.status === 'draft'
                  ? 'A draft takes no payments. Confirm it first.'
                  : 'Nothing received yet.'}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-hairline">
                {payments.map((payment) => (
                  <li key={payment.id} className="px-4 py-3.5 text-sm sm:px-5">
                    <PaymentRow
                      payment={payment}
                      canReverse={canReversePayment && !payment.isReversed}
                    />
                  </li>
                ))}
              </ul>
            )}
          </PaymentsSection>
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

/**
 * One instalment (§13.4).
 *
 * A reversed payment is struck through and stays exactly where it was, in date
 * order, with its reason underneath. It is not moved to the bottom, greyed into
 * illegibility, or hidden behind a toggle: the history is what a refund looks
 * like on paper, and both halves of it have to be readable side by side.
 */
function PaymentRow({
  payment,
  canReverse,
}: {
  payment: Payment;
  canReverse: boolean;
}) {
  const detail = [
    formatDate(fromSeconds(payment.paidAt), 'en'),
    payment.methodName,
    payment.reference,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <span>
          <span
            className={
              payment.isReversed
                ? 'font-semibold text-muted line-through'
                : 'font-semibold text-ink'
            }
          >
            {formatSAR(payment.amount)}
          </span>
          {payment.isReversed ? (
            <span className="ms-2 align-middle">
              <Pill tone="neutral">Reversed</Pill>
            </span>
          ) : null}
          <span className="block text-xs text-muted">{detail}</span>
        </span>

        {canReverse ? (
          <ReversePaymentForm paymentId={payment.id} amount={payment.amount} />
        ) : null}
      </div>

      {payment.notes ? (
        <p className="mt-1.5 text-xs text-muted">{payment.notes}</p>
      ) : null}

      <p className="mt-1.5 text-xs text-muted">
        Recorded by {payment.recordedByName ?? 'a removed account'}
      </p>

      {payment.isReversed ? (
        <p className="mt-1.5 text-xs text-error">
          Reversed{payment.reversedByName ? ` by ${payment.reversedByName}` : ''}
          {payment.reversedAt
            ? ` on ${formatDate(fromSeconds(payment.reversedAt), 'en')}`
            : ''}
          {payment.reverseReason ? ` — ${payment.reverseReason}` : ''}
        </p>
      ) : null}
    </>
  );
}

const ACTION_LABEL: Record<string, string> = {
  'booking.created': 'Created',
  'booking.updated': 'Edited',
  'booking.confirmed': 'Confirmed',
  'booking.completed': 'Completed',
  'booking.cancelled': 'Cancelled',
  'booking.draft_deleted': 'Draft deleted',
  'payment.recorded': 'Payment recorded',
  'payment.reversed': 'Payment reversed',
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
              {AUDIT_FIELD_LABELS[field] ?? field}:{' '}
              <span className="line-through">{format(field, before[field])}</span> →{' '}
              <span className="text-ink">{format(field, after[field])}</span>
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

/**
 * A timeline value in the form the rest of the panel would show it.
 *
 * Money through `formatSAR` and dates through `formatDate`, never interpolated
 * raw (§8) — `amountPaid: 0 → 5000` is the same information as
 * `Paid: SAR 0 → SAR 5,000` only to someone who already knows the schema, and
 * this line exists precisely for the person who does not.
 */
function format(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';

  if (AUDIT_MONEY_FIELDS.has(field) && typeof value === 'number') {
    return formatSAR(value);
  }

  if (AUDIT_DATE_FIELDS.has(field) && typeof value === 'number') {
    return formatDate(fromSeconds(value), 'en');
  }

  if (typeof value === 'string') return value.replace(/_/g, ' ');

  return String(value);
}
