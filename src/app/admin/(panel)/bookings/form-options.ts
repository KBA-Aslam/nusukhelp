import 'server-only';

import { listAgencies } from '@/db/queries/agencies';
import { listHotels, listSimpleLookups } from '@/db/queries/lookups';

import type { BookingFormOptions } from './booking-form';

/**
 * Everything the booking form's pickers need, loaded once per screen.
 *
 * **Only what is live.** Archived agencies and retired lookup entries are
 * filtered out here, because Phase 9 chose deactivation over deletion precisely
 * so that a room type could stop being *offered* without disappearing from the
 * bookings that already used it (§13, Phase 9 ruling 4). This function is the
 * "stop being offered" half of that bargain; the booking's own snapshot is the
 * other half.
 *
 * The four queries run in parallel — they have nothing to do with each other,
 * and a phone on a hotel's wifi is the connection this screen is opened over.
 */
export async function loadBookingFormOptions(): Promise<BookingFormOptions> {
  const [agencies, hotels, lookups] = await Promise.all([
    listAgencies(),
    listHotels(),
    listSimpleLookups(),
  ]);

  return {
    agencies: agencies.map((agency) => ({
      id: agency.id,
      agencyName: agency.agencyName,
      contactPerson: agency.contactPerson,
      mobile: agency.mobile,
      whatsapp: agency.whatsapp,
      email: agency.email,
      country: agency.country,
      address: agency.address,
    })),
    hotels: hotels
      .filter((hotel) => hotel.isActive)
      .map((hotel) => ({
        id: hotel.id,
        name: hotel.name,
        city: hotel.city,
        cityOther: hotel.cityOther,
        category: hotel.category,
      })),
    roomTypes: lookups.room_types
      .filter((row) => row.isActive)
      .map((row) => ({ id: row.id, name: row.name })),
    mealPlans: lookups.meal_plans
      .filter((row) => row.isActive)
      .map((row) => ({ id: row.id, code: row.code ?? '', name: row.name })),
    serviceTypes: lookups.service_types
      .filter((row) => row.isActive)
      .map((row) => ({
        id: row.id,
        name: row.name,
        defaultPrice: row.defaultPrice,
      })),
  };
}
