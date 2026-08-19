import type { Metadata } from 'next';

import { PageHeading } from '@/components/admin/ui';
import { getAgency } from '@/db/queries/agencies';
import { requirePageAccess } from '@/lib/auth-guard';

import { BookingForm, EMPTY_BOOKING } from '../booking-form';
import { loadBookingFormOptions } from '../form-options';

export const metadata: Metadata = { title: 'New booking' };

/**
 * `/admin/bookings/new` — the stepped creation form (§13.3).
 *
 * `?agency=<id>` is the **+ New booking** button on an agency profile: step 1
 * arrives pre-filled and the form opens on step 2, exactly as §13.3 describes.
 * The details are copied into the booking rather than read through the link,
 * because a booking's agency details are a snapshot (§9.5) — this is the same
 * copy the form's own agency picker makes, so the two paths produce identical
 * rows.
 */
export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ agency?: string }>;
}) {
  await requirePageAccess('createBookings');

  const { agency: agencyId } = await searchParams;
  const [options, agency] = await Promise.all([
    loadBookingFormOptions(),
    agencyId ? getAgency(agencyId) : Promise.resolve(null),
  ]);

  const initial = agency
    ? {
        ...EMPTY_BOOKING,
        agencyId: agency.id,
        agencyName: agency.agencyName,
        contactPerson: agency.contactPerson ?? '',
        agencyMobile: agency.mobile ?? '',
        agencyWhatsapp: agency.whatsapp ?? '',
        agencyEmail: agency.email ?? '',
        agencyCountry: agency.country ?? '',
        agencyAddress: agency.address ?? '',
      }
    : EMPTY_BOOKING;

  return (
    <>
      <PageHeading
        title="New booking"
        description="Saved as you go. Nothing is numbered until you confirm."
      />

      <BookingForm
        bookingId={null}
        initial={initial}
        options={options}
        mode="create"
        startStep={agency ? 1 : 0}
      />
    </>
  );
}
