import type { BookingWithLines } from '@/db/queries/bookings';
import type { CompanySettings } from '@/db/queries/company';

import type { InvoiceSource } from './types';

/**
 * A booking and the company row, as the full invoice sees them (§10).
 *
 * Nothing is computed here except `balanceDue`, which is the subtraction the
 * booking screen already does — every other figure is a column
 * `recalculateBooking` wrote (§9.6). That is what makes the PDF a *view* of the
 * booking rather than a second opinion about it: if this file started summing
 * rooms, a document and the screen that produced it could disagree.
 *
 * `vatAmount` is not carried at all. It is structurally zero (§9.9), neither
 * style renders it, and a zero VAT line on a document titled INVOICE is exactly
 * the impression Appendix A forbids.
 *
 * ## Why this can return null
 *
 * A draft has no booking number (§9.1), and a document identified by nothing is
 * worse than no document. Rather than invent a placeholder, the builder answers
 * `null` and the screen says why the control is not there.
 */
export function toInvoiceSource(
  booking: BookingWithLines,
  company: CompanySettings | null,
): InvoiceSource | null {
  if (!booking.bookingNumber) return null;
  if (!company) return null;

  return {
    style: 'full',
    bookingNumber: booking.bookingNumber,

    company: {
      legalName: company.legalName,
      tradingName: company.tradingName,
      crNumber: company.crNumber,
      addressLine1: company.addressLine1,
      addressLine2: company.addressLine2,
      city: company.city,
      country: company.country,
      phonePrimary: company.phonePrimary,
      phoneSecondary: company.phoneSecondary,
      whatsapp: company.whatsapp,
      email: company.email,
      website: company.website,
      preparedByLabel: company.preparedByLabel,
      approvedByName: company.approvedByName,
      bankName: company.bankName,
      bankAccountName: company.bankAccountName,
      bankIban: company.bankIban,
    },

    agencyName: booking.agencyName,
    contactPerson: booking.contactPerson,
    agencyMobile: booking.agencyMobile,
    agencyWhatsapp: booking.agencyWhatsapp,
    agencyEmail: booking.agencyEmail,
    agencyCountry: booking.agencyCountry,
    agencyAddress: booking.agencyAddress,

    guestName: booking.guestName,
    guestMobile: booking.guestMobile,
    guestEmail: booking.guestEmail,
    guestCountry: booking.guestCountry,

    hotelName: booking.hotelName,
    hotelCity: booking.hotelCity,
    hotelCategory: booking.hotelCategory,
    confirmationNumber: booking.confirmationNumber,
    brnVrn: booking.brnVrn,
    bookingSource: booking.bookingSource,

    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    totalNights: booking.totalNights,
    totalRooms: booking.totalRooms,
    totalGuests: booking.totalGuests,

    bookingDate: booking.bookingDate,
    dueDate: booking.dueDate,

    rooms: booking.rooms.map((room) => ({
      roomTypeName: room.roomTypeName,
      mealPlanCode: room.mealPlanCode,
      numberOfRooms: room.numberOfRooms,
      numberOfGuests: room.numberOfGuests,
      nights: room.nights,
      pricePerNight: room.pricePerNight,
      subtotal: room.subtotal,
    })),

    services: booking.services.map((service) => ({
      serviceName: service.serviceName,
      quantity: service.quantity,
      unitPrice: service.unitPrice,
      total: service.total,
    })),

    roomsSubtotal: booking.roomsSubtotal,
    servicesSubtotal: booking.servicesSubtotal,
    discountAmount: booking.discountAmount,
    totalValue: booking.totalValue,
    amountPaid: booking.amountPaid,
    balanceDue: booking.totalValue - booking.amountPaid,
    paymentStatus: booking.paymentStatus,

    notes: booking.notes,
    // Snapshotted at confirmation (§9.5, §11); the company default is the
    // fallback for a booking confirmed before anything was snapshotted.
    terms: booking.terms ?? company.defaultTerms,
  };
}

/**
 * `AHR-2026-00041.pdf` and `AHR-2026-00041-confidential.pdf` (§10).
 *
 * No amounts in the filename — a file manager, a share sheet preview and a
 * WhatsApp thread all show it before anyone opens the document.
 */
export function invoiceFileName(
  bookingNumber: string,
  style: 'full' | 'confidential',
): string {
  return style === 'confidential'
    ? `${bookingNumber}-confidential.pdf`
    : `${bookingNumber}.pdf`;
}
