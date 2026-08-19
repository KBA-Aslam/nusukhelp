import type { Metadata } from 'next';
import Link from 'next/link';

import { PaymentPill, StatusPill } from '@/components/admin/booking-status';
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Card,
  EmptyState,
  INPUT,
  PageHeading,
  Pill,
  SELECT,
} from '@/components/admin/ui';
import {
  countDraftBookings,
  listBookings,
  type BookingSummary,
} from '@/db/queries/bookings';
import { listAgencies } from '@/db/queries/agencies';
import { requirePageAccess } from '@/lib/auth-guard';
import { formatDate, formatSAR } from '@/lib/format';
import { roleCan } from '@/lib/permissions';
import {
  BOOKING_STATUSES,
  HOTEL_CITIES,
  PAYMENT_STATUSES,
  type BookingStatus,
  type PaymentStatus,
} from '@/db/schema';
import {
  dateStringToSeconds,
  fromSeconds,
  nowSeconds,
  SECONDS_PER_DAY,
} from '@/lib/time';

export const metadata: Metadata = { title: 'Bookings' };

/**
 * `/admin/bookings` — the list, its search and its filters (§13.6).
 *
 * ## Drafts are a filter, not a second list
 *
 * §9.10 keeps drafts out of every ordinary view and §13.6 gives them a filter
 * of their own. Both are `?status=draft` here: one query, one screen, and no
 * chance of the two diverging on what counts as a draft. Those untouched for 30
 * days are marked **stale** so a person can see what is worth deleting.
 *
 * **Nothing on this page deletes anything on a schedule.** The stale badge is
 * an invitation to a human, not a countdown — silently removing someone's
 * half-finished work is worse than leaving clutter in a list (§9.10).
 *
 * ## Why the draft count is on the default view
 *
 * Because hiding a draft and losing it are the same experience. The first time
 * this screen was used on a phone, a draft autosaved correctly, the browser was
 * closed, and the person came back to a list that said nothing about it — the
 * row was on the server the whole time and reported as lost, which is the
 * failure §9.10 exists to prevent, arriving through the interface instead of
 * through a purge. Excluding drafts from the list is still right; leaving them
 * unmentioned was not.
 *
 * ## The filters are a GET
 *
 * Every filter is a query parameter and the form is a plain `method="get"`, so
 * a filtered view is a real URL: bookmarkable, shareable, and reachable with
 * the back button. Same reasoning as the agency list.
 */

const STALE_AFTER_DAYS = 30;

const STATUS_LABEL: Record<BookingStatus, string> = {
  draft: 'Drafts',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Part paid',
  paid: 'Paid',
};

const CITY_LABEL: Record<string, string> = {
  makkah: 'Makkah',
  madinah: 'Madinah',
  jeddah: 'Jeddah',
  other: 'Other',
};

type Search = {
  q?: string;
  status?: string;
  payment?: string;
  city?: string;
  agency?: string;
  dateField?: string;
  from?: string;
  to?: string;
};

function asStatus(value?: string): BookingStatus | undefined {
  return (BOOKING_STATUSES as readonly string[]).includes(value ?? '')
    ? (value as BookingStatus)
    : undefined;
}

function asPaymentStatus(value?: string): PaymentStatus | undefined {
  return (PAYMENT_STATUSES as readonly string[]).includes(value ?? '')
    ? (value as PaymentStatus)
    : undefined;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requirePageAccess();
  const params = await searchParams;

  const status = asStatus(params.status);
  const dateField =
    params.dateField === 'checkIn' || params.dateField === 'checkOut'
      ? params.dateField
      : 'booking';

  const [rows, agencies, draftCount] = await Promise.all([
    listBookings({
      search: params.q,
      status,
      paymentStatus: asPaymentStatus(params.payment),
      city: (HOTEL_CITIES as readonly string[]).includes(params.city ?? '')
        ? params.city
        : undefined,
      agencyId: params.agency || undefined,
      dateField,
      from: dateStringToSeconds(params.from),
      to: dateStringToSeconds(params.to),
    }),
    listAgencies(),
    countDraftBookings(),
  ]);

  const canCreate = roleCan(user.role, 'createBookings');
  const staleBefore = nowSeconds() - STALE_AFTER_DAYS * SECONDS_PER_DAY;
  const showingDrafts = status === 'draft';

  return (
    <>
      <PageHeading
        title="Bookings"
        description={
          showingDrafts
            ? 'Unfinished bookings. Nothing here is deleted automatically — review and remove them yourself.'
            : 'Every confirmed stay. Drafts are under their own filter.'
        }
        action={
          canCreate ? (
            <Link href="/admin/bookings/new" className={BUTTON_PRIMARY}>
              New booking
            </Link>
          ) : undefined
        }
      />

      {/* One tap to the unfinished work, on the screen people actually land on
          — the Status select below reaches the same view, but nobody opens a
          select to look for something they do not know is there. */}
      {!showingDrafts && draftCount > 0 ? (
        <Link
          href="/admin/bookings?status=draft"
          className="mb-5 flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-[2px] border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink"
        >
          <span>
            <strong>
              {draftCount} unfinished {draftCount === 1 ? 'draft' : 'drafts'}
            </strong>{' '}
            saved and waiting to be finished.
          </span>
          <span className="font-semibold text-brass-ink">Resume →</span>
        </Link>
      ) : null}

      <form method="get" className="mb-5 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="q" className="block text-[0.8125rem] font-semibold text-ink">
              Search
            </label>
            <div className="mt-2">
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={params.q ?? ''}
                placeholder="Number, agency, guest, hotel, confirmation, BRN or phone"
                className={INPUT}
              />
            </div>
          </div>
          <button type="submit" className={BUTTON_SECONDARY}>
            Search
          </button>
          <Link href="/admin/bookings" className={BUTTON_SECONDARY}>
            Clear
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select name="status" label="Status" value={params.status} placeholder="Live bookings">
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select name="payment" label="Payment" value={params.payment} placeholder="Any">
            {Object.entries(PAYMENT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select name="city" label="City" value={params.city} placeholder="Any">
            {HOTEL_CITIES.map((city) => (
              <option key={city} value={city}>
                {CITY_LABEL[city]}
              </option>
            ))}
          </Select>

          <Select name="agency" label="Agency" value={params.agency} placeholder="Any">
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.agencyName}
              </option>
            ))}
          </Select>

          <Select name="dateField" label="Date range on" value={params.dateField} placeholder="Booking date">
            <option value="checkIn">Check-in</option>
            <option value="checkOut">Check-out</option>
          </Select>

          <div>
            <label htmlFor="from" className="block text-[0.8125rem] font-semibold text-ink">
              From
            </label>
            <div className="mt-2">
              <input id="from" name="from" type="date" defaultValue={params.from ?? ''} className={INPUT} />
            </div>
          </div>

          <div>
            <label htmlFor="to" className="block text-[0.8125rem] font-semibold text-ink">
              To
            </label>
            <div className="mt-2">
              <input id="to" name="to" type="date" defaultValue={params.to ?? ''} className={INPUT} />
            </div>
          </div>

          <div className="flex items-end">
            <button type="submit" className={`${BUTTON_SECONDARY} w-full`}>
              Apply filters
            </button>
          </div>
        </div>
      </form>

      <Card title={`${rows.length} ${rows.length === 1 ? 'booking' : 'bookings'}`}>
        {rows.length === 0 ? (
          <EmptyState>
            {params.q
              ? `Nothing matches “${params.q}”.`
              : showingDrafts
                ? 'No unfinished drafts.'
                : 'No bookings yet.'}
          </EmptyState>
        ) : (
          <>
            {/* Cards below `md`, table above (§20.3). A ten-column table is
                unusable at 360 px, and horizontal scroll on a primary list is
                a last resort, never the default. */}
            <ul className="divide-y divide-hairline md:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <BookingCard row={row} stale={showingDrafts && row.updatedAt < staleBefore} />
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-start text-xs tracking-wide text-muted uppercase">
                    <Th>Booking</Th>
                    <Th>Agency / guest</Th>
                    <Th>Hotel</Th>
                    <Th>Dates</Th>
                    <Th align="end">Value</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-mist/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/bookings/${row.id}`}
                          className="font-semibold text-ink hover:text-verdant"
                        >
                          {row.bookingNumber ?? 'Draft'}
                        </Link>
                        {showingDrafts && row.updatedAt < staleBefore ? (
                          <span className="ms-2">
                            <Pill tone="pending">Stale</Pill>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-ink">{row.agencyName}</span>
                        <span className="block text-xs text-muted">
                          {row.guestName ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {row.hotelName ?? '—'}
                        <span className="block text-xs text-muted">
                          {row.hotelCity ? CITY_LABEL[row.hotelCity] : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink">
                        <Dates row={row} />
                      </td>
                      <td className="px-4 py-3 text-end text-ink">
                        {formatSAR(row.totalValue)}
                        <span className="block text-xs text-muted">
                          paid {formatSAR(row.amountPaid)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-1.5">
                          <StatusPill status={row.status} />
                          <PaymentPill status={row.paymentStatus} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function BookingCard({ row, stale }: { row: BookingSummary; stale: boolean }) {
  return (
    <Link
      href={`/admin/bookings/${row.id}`}
      className="block px-4 py-3.5 transition-colors hover:bg-mist/50"
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{row.bookingNumber ?? 'Draft'}</span>
        <span className="font-display text-ink">{formatSAR(row.totalValue)}</span>
      </span>

      <span className="mt-0.5 block truncate text-sm text-ink">{row.agencyName}</span>
      <span className="block truncate text-xs text-muted">
        {[row.guestName, row.hotelName].filter(Boolean).join(' · ') || '—'}
      </span>
      <span className="mt-1 block text-xs text-muted">
        <Dates row={row} />
      </span>

      <span className="mt-2 flex flex-wrap gap-1.5">
        <StatusPill status={row.status} />
        <PaymentPill status={row.paymentStatus} />
        {stale ? <Pill tone="pending">Stale</Pill> : null}
      </span>
    </Link>
  );
}

function Dates({ row }: { row: BookingSummary }) {
  if (!row.checkInDate || !row.checkOutDate) return <>—</>;
  return (
    <>
      {formatDate(fromSeconds(row.checkInDate), 'en')} →{' '}
      {formatDate(fromSeconds(row.checkOutDate), 'en')}
    </>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: 'end';
}) {
  return (
    <th className={`px-4 py-2.5 font-semibold ${align === 'end' ? 'text-end' : 'text-start'}`}>
      {children}
    </th>
  );
}

function Select({
  name,
  label,
  value,
  placeholder,
  children,
}: {
  name: string;
  label: string;
  value?: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-[0.8125rem] font-semibold text-ink">
        {label}
      </label>
      <div className="mt-2">
        <select id={name} name={name} defaultValue={value ?? ''} className={SELECT}>
          <option value="">{placeholder}</option>
          {children}
        </select>
      </div>
    </div>
  );
}
