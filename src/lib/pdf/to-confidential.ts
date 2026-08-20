import type { InvoiceConfidentialData, InvoiceFullData } from './types';

/**
 * The only way an `InvoiceConfidentialData` is ever built (§10).
 *
 * Every field is named. Nothing is spread, nothing is deleted, nothing is
 * copied wholesale and then trimmed: `delete` leaves the value recoverable
 * through serialisation, and a spread carries fields nobody listed — including
 * fields that did not exist when this function was written. Adding a money
 * column to `bookings` therefore cannot reach the confidential document,
 * because reaching it would mean someone typing that field into this file by
 * hand, under a name that says what it is.
 *
 * The literal `style` tags are what make this function unavoidable rather than
 * merely recommended: `InvoiceFullData` is not assignable to
 * `InvoiceConfidentialData`, so there is no passthrough shortcut to write.
 *
 * `tests/invoice-pdf.test.tsx` renders the result and reads the PDF's **text
 * layer** back, which is the only check that sees what a recipient can select,
 * copy and search.
 */
export function toConfidential(b: InvoiceFullData): InvoiceConfidentialData {
  return {
    style: 'confidential',

    generatedAt: b.generatedAt,
    bookingNumber: b.bookingNumber,

    company: {
      legalName: b.company.legalName,
      tradingName: b.company.tradingName,
      crNumber: b.company.crNumber,
      addressLine1: b.company.addressLine1,
      addressLine2: b.company.addressLine2,
      city: b.company.city,
      country: b.company.country,
      phonePrimary: b.company.phonePrimary,
      phoneSecondary: b.company.phoneSecondary,
      whatsapp: b.company.whatsapp,
      email: b.company.email,
      website: b.company.website,
      preparedByLabel: b.company.preparedByLabel,
      approvedByName: b.company.approvedByName,
    },

    agencyName: b.agencyName,
    contactPerson: b.contactPerson,
    agencyMobile: b.agencyMobile,
    agencyWhatsapp: b.agencyWhatsapp,
    agencyEmail: b.agencyEmail,
    agencyCountry: b.agencyCountry,
    agencyAddress: b.agencyAddress,

    guestName: b.guestName,
    guestMobile: b.guestMobile,
    guestEmail: b.guestEmail,
    guestCountry: b.guestCountry,

    hotelName: b.hotelName,
    hotelCity: b.hotelCity,
    hotelCategory: b.hotelCategory,
    confirmationNumber: b.confirmationNumber,
    brnVrn: b.brnVrn,
    bookingSource: b.bookingSource,

    checkInDate: b.checkInDate,
    checkOutDate: b.checkOutDate,
    totalNights: b.totalNights,
    totalRooms: b.totalRooms,
    totalGuests: b.totalGuests,

    bookingDate: b.bookingDate,

    rooms: b.rooms.map((r) => ({
      roomTypeName: r.roomTypeName,
      mealPlanCode: r.mealPlanCode,
      numberOfRooms: r.numberOfRooms,
      numberOfGuests: r.numberOfGuests,
      nights: r.nights,
    })),

    services: b.services.map((s) => ({
      serviceName: s.serviceName,
      quantity: s.quantity,
    })),

    notes: b.notes,
    terms: b.terms,
  };
}
