'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  createAgency,
  setAgencyArchived,
  updateAgency,
} from '@/db/queries/agencies';
import { NotAuthorisedError, requireCapability } from '@/lib/auth-guard';
import { agencySchema } from '@/lib/validation/admin';

/**
 * Agency mutations (§4, §13.8).
 *
 * `manageAgencies` — admin and executive, never viewer (§12). Re-checked in
 * every action; the list and profile pages need only `viewPanel`, so a viewer
 * can read an agency and cannot change one, and the difference is enforced here
 * rather than by which buttons happen to render.
 */

export type AgencyActionState = {
  error: string | null;
  success: string | null;
};

function refuse(error: unknown, fallback: string): AgencyActionState {
  if (error instanceof NotAuthorisedError) {
    return { error: 'You do not have permission to do that.', success: null };
  }
  console.error(fallback, error);
  return { error: fallback, success: null };
}

function read(formData: FormData) {
  return agencySchema.safeParse({
    agencyName: formData.get('agencyName') ?? '',
    contactPerson: formData.get('contactPerson') ?? '',
    mobile: formData.get('mobile') ?? '',
    whatsapp: formData.get('whatsapp') ?? '',
    email: formData.get('email') ?? '',
    country: formData.get('country') ?? '',
    address: formData.get('address') ?? '',
    notes: formData.get('notes') ?? '',
  });
}

/**
 * Create, then go straight to the new profile.
 *
 * The redirect is outside the `try`: `redirect` works by throwing, and catching
 * it here would report a failure on an agency that was in fact created — and
 * invite the person to create it again.
 */
export async function createAgencyAction(
  _previous: AgencyActionState,
  formData: FormData,
): Promise<AgencyActionState> {
  let id: string;

  try {
    await requireCapability('manageAgencies');

    const parsed = read(formData);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Check the details.',
        success: null,
      };
    }

    id = await createAgency(parsed.data);
    revalidatePath('/admin/agencies');
  } catch (error) {
    return refuse(error, 'The agency could not be created.');
  }

  redirect(`/admin/agencies/${id}`);
}

export async function updateAgencyAction(
  _previous: AgencyActionState,
  formData: FormData,
): Promise<AgencyActionState> {
  let id: string;

  try {
    await requireCapability('manageAgencies');

    const value = formData.get('id');
    if (typeof value !== 'string' || !value) {
      return { error: 'That agency could not be found.', success: null };
    }
    id = value;

    const parsed = read(formData);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Check the details.',
        success: null,
      };
    }

    await updateAgency(id, parsed.data);
    revalidatePath('/admin/agencies');
    revalidatePath(`/admin/agencies/${id}`);
  } catch (error) {
    return refuse(error, 'The changes could not be saved.');
  }

  redirect(`/admin/agencies/${id}`);
}

/**
 * Archive or restore.
 *
 * **Not a delete**, and the wording on the button says so. §13.8 makes the
 * profile a history — total bookings, total value, outstanding — and from
 * Phase 10 every booking carries this agency's id. Archiving takes it out of
 * the pickers and the default list; the past stays readable.
 */
export async function setAgencyArchivedAction(
  _previous: AgencyActionState,
  formData: FormData,
): Promise<AgencyActionState> {
  try {
    await requireCapability('manageAgencies');

    const id = formData.get('id');
    if (typeof id !== 'string' || !id) {
      return { error: 'That agency could not be found.', success: null };
    }

    const isArchived = formData.get('isArchived') === 'true';
    await setAgencyArchived(id, isArchived);

    revalidatePath('/admin/agencies');
    revalidatePath(`/admin/agencies/${id}`);

    return {
      error: null,
      success: isArchived ? 'Agency archived.' : 'Agency restored.',
    };
  } catch (error) {
    return refuse(error, 'That change could not be saved.');
  }
}
