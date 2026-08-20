import { Document, Image, Page, Text, View } from '@react-pdf/renderer';

import { formatStatementTimestamp } from '@/lib/format';
import type { InvoiceConfidentialData } from '@/lib/pdf/types';
import { fromSeconds } from '@/lib/time';

import {
  DECLARATION,
  FOOTER_NOTE,
  bookingSourceLabel,
  invoiceDate,
  orDash,
  styles,
  termsLines,
} from './invoice-theme';

/**
 * Style 2 — the confidential invoice (§10). **Zero monetary values.**
 *
 * This is the document that goes to an end client who must not see the
 * agency's B2B rates, and it doubles as the booking confirmation.
 *
 * ## There is nothing to hide here, which is the design
 *
 * This component has no price field to skip, no flag to check and no branch to
 * get wrong: its props are `InvoiceConfidentialData`, and that type has no rate,
 * no subtotal, no total, no paid figure, no balance, no payment status, no
 * amount in words and no bank details — absent, not optional. Writing
 * `data.totalValue` in this file does not render an amount by mistake; it fails
 * to compile. The only way to obtain the object it receives is `toConfidential`,
 * which builds it from an explicit allow-list.
 *
 * That is why the file is a near-copy of `invoice-full-document.tsx` rather
 * than a shared component with a switch. §10 is categorical about it, and the
 * duplication buys a guarantee no amount of care in one shared file could.
 *
 * Verified in `tests/invoice-pdf.test.tsx` by reading the rendered PDF's **text
 * layer** — what a recipient can select, copy and search — not by looking at
 * the render. That test is also proven to fail when a price is put back in.
 */
export function InvoiceConfidentialDocument({
  data,
  markSrc,
}: {
  data: InvoiceConfidentialData;
  /** The Al Haramain mark. A path in the browser, a data URI in tests. */
  markSrc: string;
}) {
  const c = data.company;
  const terms = termsLines(data.terms);

  return (
    <Document
      title={data.bookingNumber}
      author={c.legalName}
      subject="Booking confirmation"
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
          </View>
        </View>

        {/* --- Rooms: counts and meal plans, no rate columns ------------- */}
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>ROOMS</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, { flex: 4 }]}>ROOM TYPE</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.4 }]}>MEAL</Text>
            <Text style={[styles.tableHeadCell, styles.center, { flex: 1 }]}>
              ROOMS
            </Text>
            <Text style={[styles.tableHeadCell, styles.center, { flex: 1 }]}>
              GUESTS
            </Text>
            <Text style={[styles.tableHeadCell, styles.center, { flex: 1 }]}>
              NIGHTS
            </Text>
          </View>

          {data.rooms.map((room, index) => (
            <View key={index} style={styles.tableRow} wrap={false}>
              <Text style={{ flex: 4 }}>{room.roomTypeName}</Text>
              <Text style={{ flex: 1.4 }}>{orDash(room.mealPlanCode)}</Text>
              <Text style={[styles.center, { flex: 1 }]}>
                {room.numberOfRooms}
              </Text>
              <Text style={[styles.center, { flex: 1 }]}>
                {room.numberOfGuests}
              </Text>
              <Text style={[styles.center, { flex: 1 }]}>{room.nights}</Text>
            </View>
          ))}
        </View>

        {/* --- Services: names and quantities ---------------------------- */}
        {data.services.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>EXTRA SERVICES</Text>
            <View style={styles.tableHead}>
              <Text style={[styles.tableHeadCell, { flex: 5 }]}>SERVICE</Text>
              <Text style={[styles.tableHeadCell, styles.center, { flex: 1 }]}>
                QTY
              </Text>
            </View>

            {data.services.map((service, index) => (
              <View key={index} style={styles.tableRow} wrap={false}>
                <Text style={{ flex: 5 }}>{service.serviceName}</Text>
                <Text style={[styles.center, { flex: 1 }]}>
                  {service.quantity}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* No totals block, no bank details: there is no field to print. */}

        {data.notes ? (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>NOTES &amp; SPECIAL REQUESTS</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        {/* --- Terms and declaration (§11, in full on both styles) ------- */}
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
