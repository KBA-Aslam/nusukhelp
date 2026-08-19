import { and, asc, eq, like, or, type SQL } from 'drizzle-orm';

import { nowSeconds } from '@/lib/time';

import { getDb } from '../index';
import { agencies } from '../schema';

/**
 * Agencies — the repeat B2B clients (§8, §13.8).
 *
 * ## Archived, never deleted
 *
 * §13.8 makes an agency profile a history: total bookings, total value, total
 * received, outstanding. Deleting the row would either orphan or rewrite that,
 * so `isArchived` takes an agency out of the pickers and the default list while
 * leaving every booking it ever placed intact and readable. This is the same
 * instinct as `isActive` on the lookup lists and `isActive` on a staff account
 * — nothing staff typed is destroyed by a click.
 */

export type Agency = {
  id: string;
  agencyName: string;
  contactPerson: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  country: string | null;
  address: string | null;
  notes: string | null;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
};

const COLUMNS = {
  id: agencies.id,
  agencyName: agencies.agencyName,
  contactPerson: agencies.contactPerson,
  mobile: agencies.mobile,
  whatsapp: agencies.whatsapp,
  email: agencies.email,
  country: agencies.country,
  address: agencies.address,
  notes: agencies.notes,
  isArchived: agencies.isArchived,
  createdAt: agencies.createdAt,
  updatedAt: agencies.updatedAt,
} as const;

/**
 * The agency list, optionally filtered by a search term (§13.6).
 *
 * Searches the two columns §8 indexes — `agency_name` and `contact_person` —
 * plus mobile and email, because "who was that Jeddah number" is how staff
 * actually look an agency up. `LIKE '%term%'` cannot use the indexes for a
 * leading wildcard, which is fine at this scale: an agency list is hundreds of
 * rows, not millions, and the alternative (FTS5) is a table and a trigger to
 * maintain for a screen that answers in a single-digit number of milliseconds.
 * Revisit if the list ever reaches five figures.
 *
 * Archived agencies are excluded unless asked for, so the common case — picking
 * an agency for a new booking — never offers one that has been retired.
 */
export async function listAgencies(options: {
  search?: string;
  includeArchived?: boolean;
} = {}): Promise<Agency[]> {
  const db = getDb();

  const filters: SQL[] = [];

  if (!options.includeArchived) {
    filters.push(eq(agencies.isArchived, false));
  }

  const term = options.search?.trim();
  if (term) {
    // `%` and `_` are LIKE wildcards; a search for "50%" should mean "50%".
    const escaped = term.replace(/[\\%_]/g, (char) => `\\${char}`);
    const pattern = `%${escaped}%`;

    const match = or(
      like(agencies.agencyName, pattern),
      like(agencies.contactPerson, pattern),
      like(agencies.mobile, pattern),
      like(agencies.email, pattern),
    );

    if (match) filters.push(match);
  }

  const query = db.select(COLUMNS).from(agencies);

  return (filters.length > 0 ? query.where(and(...filters)) : query).orderBy(
    asc(agencies.agencyName),
  );
}

export async function getAgency(id: string): Promise<Agency | null> {
  const db = getDb();

  const [row] = await db
    .select(COLUMNS)
    .from(agencies)
    .where(eq(agencies.id, id))
    .limit(1);

  return row ?? null;
}

export type AgencyInput = {
  agencyName: string;
  contactPerson: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  country: string | null;
  address: string | null;
  notes: string | null;
};

/** Returns the new id, so the caller can send the user to the profile. */
export async function createAgency(input: AgencyInput): Promise<string> {
  const db = getDb();

  const id = crypto.randomUUID();
  const now = nowSeconds();

  await db.insert(agencies).values({ id, ...input, createdAt: now, updatedAt: now });

  return id;
}

export async function updateAgency(
  id: string,
  input: AgencyInput,
): Promise<void> {
  const db = getDb();

  await db
    .update(agencies)
    .set({ ...input, updatedAt: nowSeconds() })
    .where(eq(agencies.id, id));
}

export async function setAgencyArchived(
  id: string,
  isArchived: boolean,
): Promise<void> {
  const db = getDb();

  await db
    .update(agencies)
    .set({ isArchived, updatedAt: nowSeconds() })
    .where(eq(agencies.id, id));
}
