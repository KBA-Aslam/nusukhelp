'use server';

import { revalidatePath } from 'next/cache';

import {
  createHotel,
  createLookup,
  isSimpleList,
  setHotelActive,
  setLookupActive,
  updateHotel,
  updateLookup,
} from '@/db/queries/lookups';
import { NotAuthorisedError, requireCapability } from '@/lib/auth-guard';
import { hotelSchema, lookupSchema } from '@/lib/validation/admin';

/**
 * `/admin/settings/lists` — the five editable lookup lists (§4, §8).
 *
 * **Admin only** (§12 — *Manage lookup lists*), re-checked here in every action
 * and not merely in the page that rendered the form. A server action is a POST
 * that anyone can make with any arguments; the layout decided what to draw.
 *
 * ## The list name arrives from the form, and that is safe
 *
 * Each action takes a `list` field and resolves it through `isSimpleList`
 * before doing anything. That turns an arbitrary string into one of four
 * literal values, and the query layer switches on those literals to reach a
 * Drizzle table — so what reaches the database is a table chosen from a closed
 * set at compile time, never a name interpolated from a request. Anything else
 * is rejected before the capability check has even finished paying off.
 *
 * ## Nothing here deletes
 *
 * `setActive` is the only way a row leaves a picker. From Phase 10 a booking
 * snapshots the names it used and the foreign keys point back here, so deleting
 * a room type would be deleting part of a booking's history (§8, and the
 * standing rule that staff-entered data is retired, never destroyed).
 */

const PATH = '/admin/settings/lists';

export type ListsActionState = {
  error: string | null;
  success: string | null;
};

function refuse(error: unknown, fallback: string): ListsActionState {
  if (error instanceof NotAuthorisedError) {
    return { error: 'You do not have permission to do that.', success: null };
  }
  console.error(fallback, error);
  return { error: fallback, success: null };
}

/** `''` from an untouched number input means "no price", not zero. */
function price(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/* --------------------------------------------------------------------------
   The four simple lists
   -------------------------------------------------------------------------- */

export async function saveLookupAction(
  _previous: ListsActionState,
  formData: FormData,
): Promise<ListsActionState> {
  try {
    await requireCapability('manageLists');

    const list = formData.get('list');
    if (!isSimpleList(list)) {
      return { error: 'That list does not exist.', success: null };
    }

    const parsed = lookupSchema.safeParse({
      name: formData.get('name'),
      code: formData.get('code') ?? '',
      defaultPrice: formData.get('defaultPrice') ?? '',
      sortOrder: formData.get('sortOrder') ?? 0,
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Check the details.',
        success: null,
      };
    }

    const input = {
      name: parsed.data.name,
      code: parsed.data.code || null,
      defaultPrice: price(formData.get('defaultPrice')),
      sortOrder: parsed.data.sortOrder,
    };

    // An `id` means edit; its absence means create. One action rather than two,
    // because the validation and the permission check are identical and the
    // only difference is the verb.
    const id = formData.get('id');

    if (typeof id === 'string' && id) {
      await updateLookup(list, id, input);
    } else {
      await createLookup(list, input);
    }

    revalidatePath(PATH);
    return {
      error: null,
      success: id ? `Updated ${input.name}.` : `Added ${input.name}.`,
    };
  } catch (error) {
    return refuse(error, 'That change could not be saved.');
  }
}

export async function setLookupActiveAction(
  _previous: ListsActionState,
  formData: FormData,
): Promise<ListsActionState> {
  try {
    await requireCapability('manageLists');

    const list = formData.get('list');
    const id = formData.get('id');

    if (!isSimpleList(list) || typeof id !== 'string' || !id) {
      return { error: 'That entry could not be found.', success: null };
    }

    const isActive = formData.get('isActive') === 'true';
    await setLookupActive(list, id, isActive);

    revalidatePath(PATH);
    return {
      error: null,
      success: isActive ? 'Entry restored.' : 'Entry retired.',
    };
  } catch (error) {
    return refuse(error, 'That change could not be saved.');
  }
}

/* --------------------------------------------------------------------------
   Hotels
   -------------------------------------------------------------------------- */

export async function saveHotelAction(
  _previous: ListsActionState,
  formData: FormData,
): Promise<ListsActionState> {
  try {
    await requireCapability('manageLists');

    const parsed = hotelSchema.safeParse({
      name: formData.get('name'),
      city: formData.get('city'),
      cityOther: formData.get('cityOther') ?? '',
      category: formData.get('category') ?? '',
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Check the details.',
        success: null,
      };
    }

    const input = {
      name: parsed.data.name,
      city: parsed.data.city,
      cityOther: parsed.data.cityOther || null,
      category: parsed.data.category || null,
    };

    const id = formData.get('id');

    if (typeof id === 'string' && id) {
      await updateHotel(id, input);
    } else {
      await createHotel(input);
    }

    revalidatePath(PATH);
    return {
      error: null,
      success: id ? `Updated ${input.name}.` : `Added ${input.name}.`,
    };
  } catch (error) {
    return refuse(error, 'That hotel could not be saved.');
  }
}

export async function setHotelActiveAction(
  _previous: ListsActionState,
  formData: FormData,
): Promise<ListsActionState> {
  try {
    await requireCapability('manageLists');

    const id = formData.get('id');
    if (typeof id !== 'string' || !id) {
      return { error: 'That hotel could not be found.', success: null };
    }

    const isActive = formData.get('isActive') === 'true';
    await setHotelActive(id, isActive);

    revalidatePath(PATH);
    return {
      error: null,
      success: isActive ? 'Hotel restored.' : 'Hotel retired.',
    };
  } catch (error) {
    return refuse(error, 'That change could not be saved.');
  }
}
