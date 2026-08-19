import type { Metadata } from 'next';
import Link from 'next/link';

import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Card,
  EmptyState,
  INPUT,
  PageHeading,
  Pill,
} from '@/components/admin/ui';
import { listAgencies } from '@/db/queries/agencies';
import { requirePageAccess } from '@/lib/auth-guard';
import { roleCan } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Agencies' };

/**
 * `/admin/agencies` — list, search, filter (§4, §13.6).
 *
 * ## Who can see this
 *
 * `viewPanel`, so every signed-in role reaches it; `manageAgencies` gates the
 * buttons *and* the actions behind them (§12). §12's table names only "Manage
 * agencies", leaving read access unstated — recorded as a Phase 9 ruling in §13.
 * The reading taken: a viewer can already see bookings, and every booking
 * carries the agency's name and contact details, so hiding the agency list from
 * them would conceal nothing while making the panel inconsistent.
 *
 * ## Search is a plain GET
 *
 * The form submits to this same URL with `?q=`, so a search is a real
 * navigation: it can be bookmarked, shared, and reached with the browser's back
 * button. A client-side filter would need the whole list in the browser, and a
 * server action would give a result with no address.
 */
export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const user = await requirePageAccess();
  const { q, archived } = await searchParams;

  const search = typeof q === 'string' ? q : '';
  const includeArchived = archived === '1';
  const canManage = roleCan(user.role, 'manageAgencies');

  const agencies = await listAgencies({ search, includeArchived });

  return (
    <>
      <PageHeading
        title="Agencies"
        description="Travel agencies that place bookings. Archived agencies keep their history and stay out of the pickers."
        action={
          canManage ? (
            <Link href="/admin/agencies/new" className={BUTTON_PRIMARY}>
              New agency
            </Link>
          ) : undefined
        }
      />

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="q"
            className="block text-[0.8125rem] font-semibold text-ink"
          >
            Search
          </label>
          <div className="mt-2">
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={search}
              placeholder="Name, contact, mobile or email"
              className={INPUT}
            />
          </div>
        </div>

        {/* Carried through the search so a filtered view survives a new query.
            A checkbox that reset itself on every search would be worse than
            not having one. */}
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={includeArchived}
            className="size-4 accent-verdant"
          />
          Include archived
        </label>

        <button type="submit" className={BUTTON_SECONDARY}>
          Search
        </button>

        {search || includeArchived ? (
          <Link href="/admin/agencies" className={BUTTON_SECONDARY}>
            Clear
          </Link>
        ) : null}
      </form>

      <Card
        title={`${agencies.length} ${agencies.length === 1 ? 'agency' : 'agencies'}`}
      >
        {agencies.length === 0 ? (
          <EmptyState>
            {search
              ? `Nothing matches “${search}”.`
              : 'No agencies yet. Create one when the first booking comes in.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-hairline">
            {agencies.map((agency) => (
              <li key={agency.id}>
                {/* The whole row is the link, and it is 44px tall (§20.3).
                    A small "view" link at the end of a row is the classic
                    unusable-on-touch target. */}
                <Link
                  href={`/admin/agencies/${agency.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-mist/50 sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      <span className="truncate">{agency.agencyName}</span>
                      {agency.isArchived ? (
                        <Pill tone="neutral">Archived</Pill>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {[
                        agency.contactPerson,
                        agency.mobile,
                        agency.country,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No contact details yet'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
