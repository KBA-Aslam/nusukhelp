import { StyleSheet } from '@react-pdf/renderer';

import type { BookingSource, PaymentStatus } from '@/db/schema';
import { formatDate } from '@/lib/format';
import { fromSeconds } from '@/lib/time';

/**
 * The shared skin of both invoice styles — palette, measurements, static copy.
 *
 * **Styles and fixed copy only. No booking data passes through this file, and
 * no component lives in it.** §10 forbids a shared document component with a
 * price flag; two documents sharing a stylesheet is a different thing, because
 * a stylesheet cannot leak a rate. The moment something here starts taking an
 * invoice object it belongs in one of the two documents instead — in both, if
 * both need it.
 *
 * ## Fonts
 *
 * The built-in Helvetica, not the brand faces. Marcellus and IBM Plex Sans
 * would have to be fetched and embedded at generation time, and a font fetch
 * that fails on hotel wifi either loses the download or substitutes silently.
 * The identity here is carried by the mark, the palette and the layout.
 * Embedding the brand faces is a small, self-contained follow-up if the client
 * wants it — recorded as an open item in §19.
 */

export const PALETTE = {
  ink: '#0C2923',
  pine: '#0B3B31',
  verdant: '#14614C',
  brass: '#B08E4F',
  mist: '#E7EFEA',
  sand: '#FAF7F1',
  slate: '#47554F',
  hairline: '#D6DEDA',
  white: '#FFFFFF',
} as const;

/** §11, unchanged wording. Fixed copy, identical on both styles. */
export const DECLARATION =
  'By accepting this invoice, the agency/client acknowledges and agrees to the above Terms & Conditions and all applicable hotel, supplier, and reservation policies.';

/** §9.9 — approved copy. The document is titled INVOICE; this is the fact. */
export const FOOTER_NOTE =
  'Not a tax invoice. The company is not VAT-registered.';

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially paid',
  paid: 'Paid',
};

export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABEL[status];
}

const BOOKING_SOURCE_LABEL: Record<BookingSource, string> = {
  direct: 'Direct',
  allotment: 'Allotment',
  custom: 'Custom',
};

export function bookingSourceLabel(source: BookingSource | null): string {
  return source ? BOOKING_SOURCE_LABEL[source] : '—';
}

/** A stay date, or an em dash. Dates go through `formatDate` (Appendix B). */
export function invoiceDate(seconds: number | null): string {
  return seconds ? formatDate(fromSeconds(seconds), 'en') : '—';
}

/** An optional field, never an empty cell. */
export function orDash(value: string | null | undefined): string {
  return value && value.trim() !== '' ? value : '—';
}

/**
 * The terms as lines (§11).
 *
 * Stored as one text column, snapshotted at confirmation and editable in
 * company settings, so the shape is whatever an admin typed. Blank lines are
 * dropped; everything else is printed in full, in order, on both styles.
 */
export function termsLines(terms: string | null): string[] {
  if (!terms) return [];
  return terms
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 52,
    paddingHorizontal: 34,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    lineHeight: 1.45,
    color: PALETTE.ink,
    backgroundColor: PALETTE.white,
  },

  /* --- Header ---------------------------------------------------------- */
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', gap: 10, maxWidth: '62%' },
  mark: { width: 42, height: 42 },
  companyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    letterSpacing: 1.1,
    color: PALETTE.pine,
  },
  companyMeta: { color: PALETTE.slate, fontSize: 7.5 },
  headerRight: { alignItems: 'flex-end' },
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 17,
    letterSpacing: 3,
    color: PALETTE.brass,
  },
  docNumber: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginTop: 3,
    color: PALETTE.ink,
  },
  docStamp: { fontSize: 7.5, color: PALETTE.slate, marginTop: 2 },

  rule: {
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.brass,
    marginTop: 10,
    marginBottom: 10,
  },

  /* --- Section furniture ------------------------------------------------ */
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: PALETTE.verdant,
    marginBottom: 4,
  },
  block: { marginBottom: 11 },
  columns: { flexDirection: 'row', gap: 18 },
  column: { flex: 1 },

  /* A label/value pair inside a party block. */
  pair: { flexDirection: 'row', marginBottom: 1 },
  pairLabel: { width: 62, color: PALETTE.slate },
  pairValue: { flex: 1 },
  strong: { fontFamily: 'Helvetica-Bold' },

  /* --- Tables ----------------------------------------------------------- */
  tableHead: {
    flexDirection: 'row',
    backgroundColor: PALETTE.mist,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  tableHeadCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.6,
    color: PALETTE.pine,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4.5,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.hairline,
  },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
  muted: { color: PALETTE.slate },

  /* --- Totals ----------------------------------------------------------- */
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end' },
  totals: { width: '58%' },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.hairline,
  },
  totalsGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.pine,
    color: PALETTE.white,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 3,
  },
  totalsGrandText: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  words: {
    marginTop: 5,
    fontSize: 7.5,
    color: PALETTE.slate,
  },

  /* --- Panels ----------------------------------------------------------- */
  panel: {
    borderWidth: 0.5,
    borderColor: PALETTE.hairline,
    backgroundColor: PALETTE.sand,
    padding: 7,
  },
  termsItem: { marginBottom: 2, fontSize: 7.5 },
  declaration: { fontSize: 7.5, color: PALETTE.slate },

  /* --- Signatures and footer -------------------------------------------- */
  signatures: { flexDirection: 'row', gap: 24, marginTop: 14 },
  signature: { flex: 1 },
  signatureLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.ink,
    height: 22,
  },
  signatureLabel: { marginTop: 3, fontSize: 7.5, color: PALETTE.slate },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 34,
    right: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.hairline,
    paddingTop: 5,
    fontSize: 7,
    color: PALETTE.slate,
  },
});
