import { Pill, type PillTone } from '@/components/admin/ui';
import type { BookingStatus, PaymentStatus } from '@/db/schema';

/**
 * The two status badges, rendered from one place (§9.2).
 *
 * They are two badges and never one. `status` says where the stay has got to;
 * `paymentStatus` says where the money has got to; a booking is routinely
 * *confirmed* and *partially paid* at the same moment, and a single merged
 * badge would have to pick one of those to tell the truth about.
 *
 * Colour is reinforcement, not the signal — the word is the signal (§7). That
 * matters most on `unpaid`, which is the one a person is meant to act on: it
 * takes the strongest tone on the screen so an unpaid arrival stands out in a
 * list (§13.5), while still reading as "unpaid" in monochrome or to a screen
 * reader.
 */

const STATUS_LABEL: Record<BookingStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<BookingStatus, PillTone> = {
  draft: 'neutral',
  confirmed: 'positive',
  checked_in: 'positive',
  // Over rather than wrong: the stay has happened and the booking is waiting to
  // be completed (§9.7), which is a neutral state and not a failure.
  checked_out: 'neutral',
  completed: 'neutral',
  cancelled: 'negative',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Part paid',
  paid: 'Paid',
};

const PAYMENT_TONE: Record<PaymentStatus, PillTone> = {
  unpaid: 'negative',
  partially_paid: 'pending',
  paid: 'positive',
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}

export function PaymentPill({ status }: { status: PaymentStatus }) {
  return <Pill tone={PAYMENT_TONE[status]}>{PAYMENT_LABEL[status]}</Pill>;
}

export function bookingStatusLabel(status: BookingStatus): string {
  return STATUS_LABEL[status];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_LABEL[status];
}
