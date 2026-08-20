/**
 * The invoice fixture, shared by the text-layer tests and the delivery-UI test
 * so that both argue about the same booking.
 */

import type { InvoiceFullData } from '@/lib/pdf/types';

/* --------------------------------------------------------------------------
   Fixture

   Amounts are chosen not to collide with anything the confidential style
   legitimately prints — room counts, guest counts, nights, dates, phone
   numbers — so a hit on one of these digit runs is a leak and nothing else.
   -------------------------------------------------------------------------- */

export const AMOUNTS = {
  pricePerNight: 1750,
  roomSubtotal: 10500,
  serviceUnitPrice: 400,
  serviceTotal: 800,
  roomsSubtotal: 10500,
  servicesSubtotal: 800,
  discountAmount: 300,
  totalValue: 11000,
  amountPaid: 4000,
  balanceDue: 7000,
} as const;

export const IBAN = 'SA03 8000 0000 6080 1016 7519';

/** A 1×1 transparent PNG, so no test depends on fetching the real mark. */
export const MARK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const FULL: InvoiceFullData = {
  style: 'full',
  generatedAt: 1787398200, // 22 Aug 2026, 14:30 in Riyadh
  bookingNumber: 'AHR-2026-00041',

  company: {
    legalName: 'Al Haramain Reservation',
    tradingName: 'Al Haramain Reservation',
    crNumber: 'CR-4650123456',
    addressLine1: 'King Faisal Road',
    addressLine2: null,
    city: 'Madinah Al Munawarah',
    country: 'Saudi Arabia',
    phonePrimary: '+966 57 679 9128',
    phoneSecondary: null,
    whatsapp: '+966 57 679 9128',
    email: 'reservations@nusukhelp.com',
    website: 'nusukhelp.com',
    preparedByLabel: 'Prepared By',
    approvedByName: 'Al Bani',
    bankName: 'Al Rajhi Bank',
    bankAccountName: 'Al Haramain Reservation',
    bankIban: IBAN,
  },

  agencyName: 'Baitul Umrah Travels',
  contactPerson: 'Rukhsana Bibi',
  agencyMobile: '+92 321 4567 812',
  agencyWhatsapp: null,
  agencyEmail: 'bookings@baitulumrah.example',
  agencyCountry: 'Pakistan',
  agencyAddress: 'Lahore',

  guestName: 'Yusuf Adeyemi',
  guestMobile: '+234 802 5566 173',
  guestEmail: 'yusuf@example.com',
  guestCountry: 'Nigeria',

  hotelName: 'Anwar Al Madinah Movenpick',
  hotelCity: 'Madinah',
  hotelCategory: '5 star',
  confirmationNumber: 'CNF-88213',
  brnVrn: 'BRN-77120',
  bookingSource: 'allotment',

  checkInDate: 1787356800,
  checkOutDate: 1787616000,
  totalNights: 3,
  totalRooms: 2,
  totalGuests: 4,

  bookingDate: 1786752000,
  dueDate: 1787270400,

  rooms: [
    {
      roomTypeName: 'Double Deluxe',
      mealPlanCode: 'BB',
      numberOfRooms: 2,
      numberOfGuests: 4,
      nights: 3,
      pricePerNight: AMOUNTS.pricePerNight,
      subtotal: AMOUNTS.roomSubtotal,
    },
  ],

  services: [
    {
      serviceName: 'Ziyarat transport',
      quantity: 2,
      unitPrice: AMOUNTS.serviceUnitPrice,
      total: AMOUNTS.serviceTotal,
    },
  ],

  roomsSubtotal: AMOUNTS.roomsSubtotal,
  servicesSubtotal: AMOUNTS.servicesSubtotal,
  discountAmount: AMOUNTS.discountAmount,
  totalValue: AMOUNTS.totalValue,
  amountPaid: AMOUNTS.amountPaid,
  balanceDue: AMOUNTS.balanceDue,
  paymentStatus: 'partially_paid',

  notes: 'Ground floor rooms if available.',
  terms:
    '1. Payment & Confirmation: Full payment must be received before final confirmation/approval.\n2. Cancellation & Refund: Subject to the applicable hotel/supplier policy.',
};

