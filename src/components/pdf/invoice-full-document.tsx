import { Document, Image, Page, Text, View } from '@react-pdf/renderer';

import { formatSAR, formatStatementTimestamp } from '@/lib/format';
import { amountInWords } from '@/lib/pdf/amount-in-words';
import type { InvoiceFullData } from '@/lib/pdf/types';
import { fromSeconds } from '@/lib/time';

import {
  DECLARATION,
  FOOTER_NOTE,
  bookingSourceLabel,
  invoiceDate,
  orDash,
  paymentStatusLabel,
  styles,
  termsLines,
} from './invoice-theme';

/**
 * Style 1 — the full invoice (§10). Every amount, including B2B rates.
 *
 * ## Why this file duplicates most of `invoice-confidential-document.tsx`
 *
 * Because §10 requires it, and the requirement is the point. One component with
 * a `showPrices` flag — or one that receives the priced object and skips the
 * price fields — leaks: the data reaches the component either way, so a
 * refactor, a text layer or a serialisation can surface it, and the guard is
 * always one careless line from being removed. Two documents over two types
 * means the confidential file has no rate to render even if someone tries: the
 * field is not on its props.
 *
 * The duplication is the layout, which is stable. The thing that must never
 * drift — what may leave the building — is duplicated nowhere: it is stated
 * once, in `lib/pdf/types.ts`, and enforced by the compiler.
 *
 * ## Nothing here computes money
 *
 * Every figure is a column `recalculateBooking` wrote (§9.6), formatted through
 * `formatSAR` (§8). The one derivation is `amountInWords`, which spells out a
 * total that is already on the page rather than carrying a second copy of it.
 */
export function InvoiceFullDocument({
  data,
  markSrc,
}: {
  data: InvoiceFullData;
  /** The Al Haramain mark. A path in the browser, a data URI in tests. */
  markSrc: string;
}) {
  const c = data.company;
  const terms = termsLines(data.terms);
  const hasBank = Boolean(c.bankName ?? c.bankAccountName ?? c.bankIban);

  return (
    <Document
      title={data.bookingNumber}
      author={c.legalName}
      subject="Invoice"
      creator={c.legalName}
      producer={c.legalName}
    >
      <Page size="A4" style={styles.page}>
        {/* --- Header (§10 layout) -------------------------------------- */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
                takes no alt; a PDF has no accessibility tree here. */}
            <Image src={markSrc} style={styles.mark} />
            <View>
              <Text style={styles.companyName}>
                {orDash(c.tradingName ?? c.legalName)}
              </Text>
              {c.tradingName && c.tradingName !== c.legalName ? (
                <Text style={styles.companyMeta}>{c.legalName}</Text>
              ) : null}
              <Text style={styles.companyMeta}>
                {[c.addressLine1, c.addressLine2, c.city, c.country]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
              <Text style={styles.companyMeta}>
                {[c.phonePrimary, c.phoneSecondary, c.whatsapp]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={styles.companyMeta}>
                {[c.email, c.website].filter(Boolean).join(' · ')}
              </Text>
              {c.crNumber ? (
                <Text style={styles.companyMeta}>CR {c.crNumber}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>INVOICE</Text>
            <Text style={styles.docNumber}>{data.bookingNumber}</Text>
            {/* Required by §10: nothing is stored, so this line is the only
                way to tell two downloads of one booking apart. */}
            <Text style={styles.docStamp}>
              Statement as of{' '}
              {formatStatementTimestamp(fromSeconds(data.generatedAt))}
            </Text>
          </View>
        </View>

        <View style={styles.rule} />

        {/* --- Parties --------------------------------------------------- */}
        <View style={[styles.columns, styles.block]}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>BILL TO</Text>
            <Text style={styles.strong}>{data.agencyName}</Text>
            <Pair label="Contact" value={orDash(data.contactPerson)} />
            <Pair
              label="Phone"
              value={orDash(
                [data.agencyMobile, data.agencyWhatsapp]
                  .filter(Boolean)
                  .join(' · '),
              )}
            />
            <Pair label="Email" value={orDash(data.agencyEmail)} />
            <Pair label="Country" value={orDash(data.agencyCountry)} />
            <Pair label="Address" value={orDash(data.agencyAddress)} />

            <Text style={[styles.sectionTitle, { marginTop: 7 }]}>GUEST</Text>
            <Pair label="Name" value={orDash(data.guestName)} />
            <Pair label="Phone" value={orDash(data.guestMobile)} />
            <Pair label="Email" value={orDash(data.guestEmail)} />
            <Pair label="Country" value={orDash(data.guestCountry)} />
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>BOOKING</Text>
            <Text style={styles.strong}>{orDash(data.hotelName)}</Text>
            <Pair
              label="City"
              value={orDash(
                [data.hotelCity, data.hotelCategory].filter(Boolean).join(' · '),
              )}
            />
            <Pair label="Confirmation" value={orDash(data.confirmationNumber)} />
            <Pair label="BRN / VRN" value={orDash(data.brnVrn)} />
            <Pair label="Source" value={bookingSourceLabel(data.bookingSource)} />
            <Pair label="Check-in" value={invoiceDate(data.checkInDate)} />
            <Pair label="Check-out" value={invoiceDate(data.checkOutDate)} />
            <Pair
              label="Nights"
              value={`${data.totalNights} · ${data.totalRooms} rooms · ${data.totalGuests} guests`}
            />
            <Pair label="Booked on" value={invoiceDate(data.bookingDate)} />
            <Pair label="Payment due" value={invoiceDate(data.dueDate)} />
          </View>
        </View>

        {/* --- Rooms ----------------------------------------------------- */}
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>ROOMS</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, { flex: 3 }]}>ROOM TYPE</Text>
            <Text style={[styles.tableHeadCell, { flex: 1 }]}>MEAL</Text>
            <Text style={[styles.tableHeadCell, styles.center, { flex: 0.8 }]}>
              ROOMS
            </Text>
            <Text style={[styles.tableHeadCell, styles.center, { flex: 0.8 }]}>
              GUESTS
            </Text>
            <Text style={[styles.tableHeadCell, styles.center, { flex: 0.8 }]}>
              NIGHTS
            </Text>
            <Text style={[styles.tableHeadCell, styles.right, { flex: 1.5 }]}>
              RATE / NIGHT
            </Text>
            <Text style={[styles.tableHeadCell, styles.right, { flex: 1.5 }]}>
              SUBTOTAL
            </Text>
          </View>

          {data.rooms.map((room, index) => (
            <View key={index} style={styles.tableRow} wrap={false}>
              <Text style={{ flex: 3 }}>{room.roomTypeName}</Text>
              <Text style={{ flex: 1 }}>{orDash(room.mealPlanCode)}</Text>
              <Text style={[styles.center, { flex: 0.8 }]}>
                {room.numberOfRooms}
              </Text>
              <Text style={[styles.center, { flex: 0.8 }]}>
                {room.numberOfGuests}
              </Text>
              <Text style={[styles.center, { flex: 0.8 }]}>{room.nights}</Text>
              <Text style={[styles.right, { flex: 1.5 }]}>
                {formatSAR(room.pricePerNight)}
              </Text>
              <Text style={[styles.right, { flex: 1.5 }]}>
                {formatSAR(room.subtotal)}
              </Text>
            </View>
          ))}
        </View>

        {/* --- Services -------------------------------------------------- */}
        {data.services.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>EXTRA SERVICES</Text>
            <View style={styles.tableHead}>
              <Text style={[styles.tableHeadCell, { flex: 4 }]}>SERVICE</Text>
              <Text style={[styles.tableHeadCell, styles.center, { flex: 1 }]}>
                QTY
              </Text>
              <Text style={[styles.tableHeadCell, styles.right, { flex: 1.5 }]}>
                UNIT PRICE
              </Text>
              <Text style={[styles.tableHeadCell, styles.right, { flex: 1.5 }]}>
                TOTAL
              </Text>
            </View>

            {data.services.map((service, index) => (
              <View key={index} style={styles.tableRow} wrap={false}>
                <Text style={{ flex: 4 }}>{service.serviceName}</Text>
                <Text style={[styles.center, { flex: 1 }]}>
                  {service.quantity}
                </Text>
                <Text style={[styles.right, { flex: 1.5 }]}>
                  {formatSAR(service.unitPrice)}
                </Text>
                <Text style={[styles.right, { flex: 1.5 }]}>
                  {formatSAR(service.total)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* --- Totals ---------------------------------------------------- */}
        <View style={[styles.totalsWrap, styles.block]} wrap={false}>
          <View style={styles.totals}>
            <TotalRow label="Rooms subtotal" value={formatSAR(data.roomsSubtotal)} />
            <TotalRow
              label="Services subtotal"
              value={formatSAR(data.servicesSubtotal)}
            />
            <TotalRow
              label="Discount"
              value={`− ${formatSAR(data.discountAmount)}`}
            />

            <View style={styles.totalsGrand}>
              <Text style={styles.totalsGrandText}>TOTAL VALUE</Text>
              <Text style={styles.totalsGrandText}>
                {formatSAR(data.totalValue)}
              </Text>
            </View>

            <TotalRow label="Amount paid" value={formatSAR(data.amountPaid)} />
            <TotalRow
              label="Balance due"
              value={formatSAR(data.balanceDue)}
              strong
            />
            <TotalRow
              label="Payment status"
              value={paymentStatusLabel(data.paymentStatus)}
            />

            <Text style={styles.words}>
              {amountInWords(data.totalValue)}
            </Text>
          </View>
        </View>

        {/* --- Notes and bank ------------------------------------------- */}
        {data.notes ? (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>NOTES &amp; SPECIAL REQUESTS</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        {hasBank ? (
          <View style={styles.block} wrap={false}>
            <Text style={styles.sectionTitle}>BANK DETAILS</Text>
            <View style={styles.panel}>
              {c.bankName ? <Text>{c.bankName}</Text> : null}
              {c.bankAccountName ? (
                <Text>Account name: {c.bankAccountName}</Text>
              ) : null}
              {c.bankIban ? <Text>IBAN: {c.bankIban}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* --- Terms and declaration (§11, both styles in full) ---------- */}
        {terms.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>TERMS &amp; CONDITIONS</Text>
            {terms.map((line, index) => (
              <Text key={index} style={styles.termsItem}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.block} wrap={false}>
          <Text style={styles.sectionTitle}>DECLARATION</Text>
          <Text style={styles.declaration}>{DECLARATION}</Text>
        </View>

        {/* --- Signatures ------------------------------------------------ */}
        <View style={styles.signatures} wrap={false}>
          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              {orDash(c.preparedByLabel ?? 'Prepared By')}
            </Text>
          </View>
          <View style={styles.signature}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              Approved By{c.approvedByName ? `: ${c.approvedByName}` : ''}
            </Text>
          </View>
        </View>

        {/* Fixed, so the disclaimer is on every page of a long booking.
            No page numbers: a dynamic `render` child made react-pdf drop this
            whole block from the output, silently — see §10, Phase 12 rulings. */}
        <View style={styles.footer} fixed>
          <Text>{FOOTER_NOTE}</Text>
        </View>
      </Page>
    </Document>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pair}>
      <Text style={styles.pairLabel}>{label}</Text>
      <Text style={styles.pairValue}>{value}</Text>
    </View>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.totalsRow}>
      <Text style={strong ? styles.strong : styles.muted}>{label}</Text>
      <Text style={strong ? styles.strong : undefined}>{value}</Text>
    </View>
  );
}
