import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PageHeading } from '@/components/admin/ui';
import { getBooking } from '@/db/queries/bookings';
import { requirePageAccess } from '@/lib/auth-guard';
import { secondsToDateString } from '@/lib/time';

import { BookingForm, type BookingFormValues } from '../../booking-form';
import { loadBookingFormOptions } from '../../form-options';

export const metadata: Metadata = { title: 'Edit booking' };

/**
 * `/admin/bookings/[id]/edit` — the same form, pre-filled (§9.3, §13.3).
 *
 * **Bookings stay editable after confirmation.** Hotels change, dates shift,
 * room counts move; that is operational reality and the system accommodates it.
 * What the edit path adds is the §9.3 guards, and they live in
 * `saveBookingAction` rather than here — a page can be bypassed, an action
 * cannot.
 *
 * A cancelled booking is refused outright, here *and* in the action: it is a
 * historical record with its payments intact, and editing it would rewrite what
 * was cancelled.
 *
 * ## A draft opens in `create` mode, not `edit`
 *
 * Because resuming a draft is not editing a booking. The form has to keep
 * autosaving on every step change (§9.10) and has to end in **Confirm**, which
 * is what allocates the number — `edit` mode does neither, since a confirmed
 * booking must go through `saveBookingAction` and the §9.3 guards. Same route,
 * same component, and the booking's own status decides which of the two it is.
 */
export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess('editBookings');
  const { id } = await params;

  const [booking, options] = await Promise.all([
    getBooking(id),
    loadBookingFormOptions(),
  ]);

  if (!booking) notFound();
  if (booking.status === 'cancelled') redirect(`/admin/bookings/${id}`);

  const initial: BookingFormValues = {
    agencyId: booking.agencyId ?? '',
    agencyName: booking.agencyName,
    contactPerson: booking.contactPerson ?? '',
    agencyMobile: booking.agencyMobile ?? '',
    agencyWhatsapp: booking.agencyWhatsapp ?? '',
    agencyEmail: booking.agencyEmail ?? '',
    agencyCountry: booking.agencyCountry ?? '',
    agencyAddress: booking.agencyAddress ?? '',

    guestName: booking.guestName ?? '',
    guestMobile: booking.guestMobile ?? '',
    guestEmail: booking.guestEmail ?? '',
    guestCountry: booking.guestCountry ?? '',

    hotelId: booking.hotelId ?? '',
    hotelName: booking.hotelName ?? '',
    hotelCity: booking.hotelCity ?? '',
    hotelCategory: booking.hotelCategory ?? '',
    confirmationNumber: booking.confirmationNumber ?? '',
    brnVrn: booking.brnVrn ?? '',
    bookingSource: booking.bookingSource ?? '',

    checkInDate: secondsToDateString(booking.checkInDate),
    checkOutDate: secondsToDateString(booking.checkOutDate),

    rooms: booking.rooms.map((room) => ({
      roomTypeId: room.roomTypeId ?? '',
      roomTypeName: room.roomTypeName,
      mealPlanId: room.mealPlanId ?? '',
      mealPlanCode: room.mealPlanCode ?? '',
      numberOfRooms: String(room.numberOfRooms),
      numberOfGuests: String(room.numberOfGuests),
      pricePerNight: String(room.pricePerNight),
    })),
    services: booking.services.map((service) => ({
      serviceTypeId: service.serviceTypeId ?? '',
      serviceName: service.serviceName,
      quantity: String(service.quantity),
      unitPrice: String(service.unitPrice),
    })),

    discountAmount: String(booking.discountAmount),
    dueDate: secondsToDateString(booking.dueDate),
    notes: booking.notes ?? '',
  };

  const isDraft = booking.status === 'draft';

  return (
    <>
      <PageHeading
        title={isDraft ? 'Resume draft' : `Edit ${booking.bookingNumber}`}
        description={
          isDraft
            ? 'Picks up where you left off. It takes a number when you confirm it.'
            : 'Changing the value changes what the invoice says next time it is downloaded — the document is not stored.'
        }
      />

      <BookingForm
        bookingId={id}
        initial={initial}
        options={options}
        mode={isDraft ? 'create' : 'edit'}
      />
    </>
  );
}
