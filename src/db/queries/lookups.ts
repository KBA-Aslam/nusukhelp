import { asc, eq } from 'drizzle-orm';

import { nowSeconds } from '@/lib/time';

import { getDb } from '../index';
import {
  hotels,
  mealPlans,
  paymentMethods,
  roomTypes,
  serviceTypes,
  type HOTEL_CATEGORIES,
  type HOTEL_CITIES,
} from '../schema';

/**
 * The five editable lookup lists (§8, *Lookup tables, not enums*).
 *
 * ## Nothing here deletes
 *
 * Every list has `isActive` and no `delete`. From Phase 10 a booking snapshots
 * the room type name, meal plan code and hotel name it used, so a row that is
 * deactivated stops being offered on new bookings while every booking that
 * already referenced it keeps reading correctly — and the foreign keys from
 * `booking_rooms` stay intact. Deleting a room type to tidy the list would be
 * deleting a piece of a booking's history.
 *
 * ## Two shapes, deliberately
 *
 * Four of the lists are a name, a sort order and a flag; hotels are none of
 * those things — they have a city, a category, no sort order, and they are the
 * only list that grows in the ordinary course of business. They get their own
 * functions rather than being forced through a shared abstraction that would
 * have to carry a nullable field for every difference.
 */

/* --------------------------------------------------------------------------
   The four simple lists
   -------------------------------------------------------------------------- */

/**
 * The list identifiers as they travel through a form.
 *
 * A closed set, and every server action resolves an incoming value against it
 * before touching anything. That is what keeps a table name arriving from a
 * request body from being a table name in a query: it is an enum lookup, not
 * an interpolation.
 */
export const SIMPLE_LISTS = [
  'room_types',
  'meal_plans',
  'service_types',
  'payment_methods',
] as const;

export type SimpleList = (typeof SIMPLE_LISTS)[number];

export function isSimpleList(value: unknown): value is SimpleList {
  return (
    typeof value === 'string' && (SIMPLE_LISTS as readonly string[]).includes(value)
  );
}

/**
 * One row shape for all four, with the two optional columns nullable.
 *
 * `code` belongs only to meal plans and `defaultPrice` only to service types.
 * Rendering them as one type means the list screen has one component instead of
 * four that drift apart; the form for each list decides which fields to show.
 */
export type LookupRow = {
  id: string;
  name: string;
  code: string | null;
  defaultPrice: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type LookupLists = Record<SimpleList, LookupRow[]>;

export async function listSimpleLookups(): Promise<LookupLists> {
  const db = getDb();

  const [rooms, meals, services, methods] = await Promise.all([
    db
      .select({
        id: roomTypes.id,
        name: roomTypes.name,
        sortOrder: roomTypes.sortOrder,
        isActive: roomTypes.isActive,
      })
      .from(roomTypes)
      .orderBy(asc(roomTypes.sortOrder), asc(roomTypes.name)),
    db
      .select({
        id: mealPlans.id,
        name: mealPlans.name,
        code: mealPlans.code,
        sortOrder: mealPlans.sortOrder,
        isActive: mealPlans.isActive,
      })
      .from(mealPlans)
      .orderBy(asc(mealPlans.sortOrder), asc(mealPlans.name)),
    db
      .select({
        id: serviceTypes.id,
        name: serviceTypes.name,
        defaultPrice: serviceTypes.defaultPrice,
        sortOrder: serviceTypes.sortOrder,
        isActive: serviceTypes.isActive,
      })
      .from(serviceTypes)
      .orderBy(asc(serviceTypes.sortOrder), asc(serviceTypes.name)),
    db
      .select({
        id: paymentMethods.id,
        name: paymentMethods.name,
        sortOrder: paymentMethods.sortOrder,
        isActive: paymentMethods.isActive,
      })
      .from(paymentMethods)
      .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name)),
  ]);

  const fill = (rows: Array<Partial<LookupRow> & { id: string; name: string; sortOrder: number; isActive: boolean }>): LookupRow[] =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code ?? null,
      defaultPrice: row.defaultPrice ?? null,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    }));

  return {
    room_types: fill(rooms),
    meal_plans: fill(meals),
    service_types: fill(services),
    payment_methods: fill(methods),
  };
}

export type LookupInput = {
  name: string;
  code?: string | null;
  defaultPrice?: number | null;
  sortOrder: number;
};

/**
 * Creates a row in one of the four simple lists.
 *
 * A `switch` rather than a table looked up in a map. Drizzle's insert types are
 * per-table, so a map would need the column set widened to their union and each
 * branch narrowed again inside — more code, and the type checking that makes
 * this safe would be doing less work. Four short cases stay honest.
 */
export async function createLookup(
  list: SimpleList,
  input: LookupInput,
): Promise<void> {
  const db = getDb();
  const id = crypto.randomUUID();

  switch (list) {
    case 'room_types':
      await db
        .insert(roomTypes)
        .values({ id, name: input.name, sortOrder: input.sortOrder });
      return;
    case 'meal_plans':
      await db.insert(mealPlans).values({
        id,
        name: input.name,
        code: input.code ?? '',
        sortOrder: input.sortOrder,
      });
      return;
    case 'service_types':
      await db.insert(serviceTypes).values({
        id,
        name: input.name,
        defaultPrice: input.defaultPrice ?? null,
        sortOrder: input.sortOrder,
      });
      return;
    case 'payment_methods':
      await db
        .insert(paymentMethods)
        .values({ id, name: input.name, sortOrder: input.sortOrder });
      return;
  }
}

export async function updateLookup(
  list: SimpleList,
  id: string,
  input: LookupInput,
): Promise<void> {
  const db = getDb();

  switch (list) {
    case 'room_types':
      await db
        .update(roomTypes)
        .set({ name: input.name, sortOrder: input.sortOrder })
        .where(eq(roomTypes.id, id));
      return;
    case 'meal_plans':
      await db
        .update(mealPlans)
        .set({
          name: input.name,
          code: input.code ?? '',
          sortOrder: input.sortOrder,
        })
        .where(eq(mealPlans.id, id));
      return;
    case 'service_types':
      await db
        .update(serviceTypes)
        .set({
          name: input.name,
          defaultPrice: input.defaultPrice ?? null,
          sortOrder: input.sortOrder,
        })
        .where(eq(serviceTypes.id, id));
      return;
    case 'payment_methods':
      await db
        .update(paymentMethods)
        .set({ name: input.name, sortOrder: input.sortOrder })
        .where(eq(paymentMethods.id, id));
      return;
  }
}

export async function setLookupActive(
  list: SimpleList,
  id: string,
  isActive: boolean,
): Promise<void> {
  const db = getDb();

  switch (list) {
    case 'room_types':
      await db.update(roomTypes).set({ isActive }).where(eq(roomTypes.id, id));
      return;
    case 'meal_plans':
      await db.update(mealPlans).set({ isActive }).where(eq(mealPlans.id, id));
      return;
    case 'service_types':
      await db
        .update(serviceTypes)
        .set({ isActive })
        .where(eq(serviceTypes.id, id));
      return;
    case 'payment_methods':
      await db
        .update(paymentMethods)
        .set({ isActive })
        .where(eq(paymentMethods.id, id));
      return;
  }
}

/* --------------------------------------------------------------------------
   Hotels
   -------------------------------------------------------------------------- */

export type HotelCity = (typeof HOTEL_CITIES)[number];
export type HotelCategory = (typeof HOTEL_CATEGORIES)[number];

export type HotelRow = {
  id: string;
  name: string;
  city: HotelCity;
  cityOther: string | null;
  category: HotelCategory | null;
  isActive: boolean;
};

/**
 * Ordered by city then name, which is how the booking form offers them — a
 * Makkah booking wants the Makkah hotels together. `sortOrder` is absent from
 * this table in §8 for the same reason: the list is long enough that a
 * hand-maintained order would not survive the client adding to it.
 */
export async function listHotels(): Promise<HotelRow[]> {
  const db = getDb();

  return db
    .select({
      id: hotels.id,
      name: hotels.name,
      city: hotels.city,
      cityOther: hotels.cityOther,
      category: hotels.category,
      isActive: hotels.isActive,
    })
    .from(hotels)
    .orderBy(asc(hotels.city), asc(hotels.name));
}

export type HotelInput = {
  name: string;
  city: HotelCity;
  cityOther: string | null;
  category: HotelCategory | null;
};

export async function createHotel(input: HotelInput): Promise<void> {
  const db = getDb();

  await db.insert(hotels).values({
    id: crypto.randomUUID(),
    ...input,
    // Only meaningful when the city is `other`; storing it otherwise would
    // leave a stale name behind if the city were later corrected.
    cityOther: input.city === 'other' ? input.cityOther : null,
    createdAt: nowSeconds(),
  });
}

export async function updateHotel(
  id: string,
  input: HotelInput,
): Promise<void> {
  const db = getDb();

  await db
    .update(hotels)
    .set({
      ...input,
      cityOther: input.city === 'other' ? input.cityOther : null,
    })
    .where(eq(hotels.id, id));
}

export async function setHotelActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  const db = getDb();
  await db.update(hotels).set({ isActive }).where(eq(hotels.id, id));
}
