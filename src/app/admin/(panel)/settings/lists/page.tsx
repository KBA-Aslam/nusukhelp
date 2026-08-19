import type { Metadata } from 'next';

import { Card, PageHeading } from '@/components/admin/ui';
import { listHotels, listSimpleLookups } from '@/db/queries/lookups';
import { requirePageAccess } from '@/lib/auth-guard';

import { HotelListEditor, SimpleListEditor } from './lists-client';

export const metadata: Metadata = { title: 'Lists' };

/**
 * `/admin/settings/lists` — the five editable lookup lists (§4, §8).
 *
 * Admin only (§12). The guard here decides what renders; every action behind
 * the controls re-checks the same capability on its own.
 *
 * These lists exist as **tables rather than enums** because the admin has to be
 * able to add an option at runtime — a new hotel, a service the company starts
 * offering — and retrofitting an enum once historical bookings reference its
 * strings is painful. From Phase 10 a booking snapshots the name it used, which
 * is what makes retiring an entry safe.
 */
export default async function ListsPage() {
  await requirePageAccess('manageLists');

  const [lists, hotels] = await Promise.all([
    listSimpleLookups(),
    listHotels(),
  ]);

  return (
    <>
      <PageHeading
        title="Lists"
        description="The options staff choose from when writing a booking. Entries are retired rather than deleted, so a booking that used one still reads correctly."
      />

      <div className="space-y-5">
        <Card
          title="Room types"
          description="Offered on every room row of a booking."
        >
          <SimpleListEditor
            list="room_types"
            rows={lists.room_types}
            nameLabel="Room type"
          />
        </Card>

        <Card
          title="Meal plans"
          description="The code is what appears on the invoice — RO, BB, HB, FB, AI."
        >
          <SimpleListEditor
            list="meal_plans"
            rows={lists.meal_plans}
            withCode
            nameLabel="Meal plan"
          />
        </Card>

        <Card
          title="Services"
          description="Extras charged alongside rooms. The default price is a starting point; a booking stores what was actually charged."
        >
          <SimpleListEditor
            list="service_types"
            rows={lists.service_types}
            withPrice
            nameLabel="Service"
          />
        </Card>

        <Card
          title="Hotels"
          description="Makkah, Madinah and Jeddah are grouped; anything else takes a city name of its own."
        >
          <HotelListEditor rows={hotels} />
        </Card>

        <Card
          title="Payment methods"
          description="Offered when recording a payment against a booking."
        >
          <SimpleListEditor
            list="payment_methods"
            rows={lists.payment_methods}
            nameLabel="Method"
          />
        </Card>
      </div>
    </>
  );
}
