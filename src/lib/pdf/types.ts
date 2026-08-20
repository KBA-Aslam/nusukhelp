import type { BookingSource, PaymentStatus } from '@/db/schema';

/**
 * The two invoice shapes (§10).
 *
 * ## Why there are two types rather than one type and a flag
 *
 * The confidential style exists to protect an agency's B2B rates from the end
 * client. A single shape with a `showPrices` boolean, or a full object whose
 * price fields the component skips, both leak: the data still reaches the
 * component, so a later refactor, a text layer or a serialisation can surface
 * it, and it is one careless line from breaking. So the confidential type has
 * **no price fields at all** — absent, not optional — and the confidential
 * document accepts nothing else. Referencing a rate in that component is a
 * compile error rather than a review question.
 *
 * ## `style` is a lock, not a label
 *
 * TypeScript is structural. Without the literal tag `InvoiceFullData` would be
 * assignable to `InvoiceConfidentialData` — it has every field the confidential
 * shape has, and more — so `const toConfidential = (b) => b` would compile
 * clean and hand the confidential document the whole priced object. The two
 * literal tags make the types mutually unassignable, which closes that hole and
 * leaves `toConfidential` below as the only way to obtain the confidential
 * shape. The tag also gives the screen the word it labels the download with.
 *
 * ## The shared fields are written out twice, deliberately
 *
 * Deriving one from the other (`InvoiceFullData = InvoiceConfidentialData &
 * Money`) would remove the duplication and cost more than it saves: the
 * confidential type would then grow silently every time the full invoice gained
 * a field, and edits to *this* type are precisely the ones that must be rare
 * and scrutinised. It is meant to be read top to bottom as a complete inventory
 * of what may leave the building. This is a deliberate exception to the
 * project's derive-rather-than-duplicate habit, ruled on in §10 — please do not
 * "tidy" it away.
 */

/* --------------------------------------------------------------------------
   Line items
   -------------------------------------------------------------------------- */

export type BookingRoomFull = {
  roomTypeName: string;
  mealPlanCode: string | null;
  numberOfRooms: number;
  numberOfGuests: number;
  nights: number;
  pricePerNight: number;
  subtotal: number;
};

export type BookingRoomConfidential = {
  roomTypeName: string;
  mealPlanCode: string | null;
  numberOfRooms: number;
  numberOfGuests: number;
  nights: number;
  // no pricePerNight, no subtotal — the fields do not exist on this type
};

export type BookingServiceFull = {
  serviceName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type BookingServiceConfidential = {
  serviceName: string;
  quantity: number;
  // no unitPrice, no total
};

/* --------------------------------------------------------------------------
   Company header

   Split for the same reason as the line items: bank details are money, and §10
   hides them entirely on the confidential style. One shared company object
   would have re-opened the hole one level down.
   -------------------------------------------------------------------------- */

export type InvoiceCompanyFull = {
  legalName: string;
  tradingName: string | null;
  crNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string | null;
  phonePrimary: string | null;
  phoneSecondary: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  preparedByLabel: string | null;
  approvedByName: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankIban: string | null;
};

export type InvoiceCompanyConfidential = {
  legalName: string;
  tradingName: string | null;
  crNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string | null;
  phonePrimary: string | null;
  phoneSecondary: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  preparedByLabel: string | null;
  approvedByName: string | null;
  // no bankName, no bankAccountName, no bankIban
};

/* --------------------------------------------------------------------------
   Documents
   -------------------------------------------------------------------------- */

export type InvoiceFullData = {
  /** The lock described at the top of this file. */
  readonly style: 'full';

  /** Unix seconds, stamped when the person taps Generate — see §10. */
  generatedAt: number;
  /** Never null: a draft has no number (§9.1) and produces no document. */
  bookingNumber: string;

  company: InvoiceCompanyFull;

  agencyName: string;
  contactPerson: string | null;
  agencyMobile: string | null;
  agencyWhatsapp: string | null;
  agencyEmail: string | null;
  agencyCountry: string | null;
  agencyAddress: string | null;

  guestName: string | null;
  guestMobile: string | null;
  guestEmail: string | null;
  guestCountry: string | null;

  hotelName: string | null;
  hotelCity: string | null;
  hotelCategory: string | null;
  confirmationNumber: string | null;
  brnVrn: string | null;
  bookingSource: BookingSource | null;

  checkInDate: number | null;
  checkOutDate: number | null;
  totalNights: number;
  totalRooms: number;
  totalGuests: number;

  bookingDate: number;
  dueDate: number | null;

  rooms: BookingRoomFull[];
  services: BookingServiceFull[];

  roomsSubtotal: number;
  servicesSubtotal: number;
  discountAmount: number;
  totalValue: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;

  notes: string | null;
  terms: string | null;
};

export type InvoiceConfidentialData = {
  readonly style: 'confidential';

  generatedAt: number;
  bookingNumber: string;

  company: InvoiceCompanyConfidential;

  agencyName: string;
  contactPerson: string | null;
  agencyMobile: string | null;
  agencyWhatsapp: string | null;
  agencyEmail: string | null;
  agencyCountry: string | null;
  agencyAddress: string | null;

  guestName: string | null;
  guestMobile: string | null;
  guestEmail: string | null;
  guestCountry: string | null;

  hotelName: string | null;
  hotelCity: string | null;
  hotelCategory: string | null;
  confirmationNumber: string | null;
  brnVrn: string | null;
  bookingSource: BookingSource | null;

  checkInDate: number | null;
  checkOutDate: number | null;
  totalNights: number;
  totalRooms: number;
  totalGuests: number;

  bookingDate: number;

  rooms: BookingRoomConfidential[];
  services: BookingServiceConfidential[];

  notes: string | null;
  terms: string | null;

  // Absent, not optional, from here down:
  //   roomsSubtotal · servicesSubtotal · discountAmount · totalValue
  //   amountPaid · balanceDue · paymentStatus · dueDate
  //   the company's bank details · any amount in words
};

/**
 * What the server hands the browser: everything except the timestamp.
 *
 * `generatedAt` is stamped in the click handler, not at page render, because
 * the header line — *"Statement as of 22 Aug 2026, 14:30"* — is the only way a
 * client holding two downloads of the same booking number can tell which is
 * current (§10). A screen opened at 14:30 and tapped at 15:10 must say 15:10.
 */
export type InvoiceSource = Omit<InvoiceFullData, 'generatedAt'>;
