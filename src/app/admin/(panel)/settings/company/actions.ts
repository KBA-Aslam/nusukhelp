'use server';

import { revalidatePath } from 'next/cache';

import { saveCompanySettings } from '@/db/queries/company';
import { NotAuthorisedError, requireCapability } from '@/lib/auth-guard';
import { companySchema } from '@/lib/validation/admin';

/**
 * `/admin/settings/company` — the details that print on an invoice (§4, §10).
 *
 * Admin only (§12 — *Edit company settings*), re-checked here rather than
 * assumed from the page that drew the form.
 */

export type CompanyActionState = {
  error: string | null;
  success: string | null;
};

export async function saveCompanyAction(
  _previous: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  try {
    await requireCapability('editCompanySettings');

    // Every field is a string or absent, and the schema does the collapsing of
    // `''` to `null`. Reading them by name rather than `Object.fromEntries` so
    // that a stray field added to the form cannot reach the database.
    const parsed = companySchema.safeParse({
      legalName: formData.get('legalName') ?? '',
      tradingName: formData.get('tradingName') ?? '',
      crNumber: formData.get('crNumber') ?? '',
      addressLine1: formData.get('addressLine1') ?? '',
      addressLine2: formData.get('addressLine2') ?? '',
      city: formData.get('city') ?? '',
      country: formData.get('country') ?? '',
      phonePrimary: formData.get('phonePrimary') ?? '',
      phoneSecondary: formData.get('phoneSecondary') ?? '',
      whatsapp: formData.get('whatsapp') ?? '',
      email: formData.get('email') ?? '',
      website: formData.get('website') ?? '',
      bankName: formData.get('bankName') ?? '',
      bankAccountName: formData.get('bankAccountName') ?? '',
      bankIban: formData.get('bankIban') ?? '',
      numberPrefix: formData.get('numberPrefix') ?? '',
      defaultTerms: formData.get('defaultTerms') ?? '',
      preparedByLabel: formData.get('preparedByLabel') ?? '',
      approvedByName: formData.get('approvedByName') ?? '',
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Check the details.',
        success: null,
      };
    }

    await saveCompanySettings(parsed.data);

    revalidatePath('/admin/settings/company');
    return { error: null, success: 'Company details saved.' };
  } catch (error) {
    if (error instanceof NotAuthorisedError) {
      return { error: 'You do not have permission to do that.', success: null };
    }
    console.error('company settings could not be saved', error);
    return { error: 'The details could not be saved.', success: null };
  }
}
