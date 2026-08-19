import { eq } from 'drizzle-orm';

import { nowSeconds } from '@/lib/time';

import { getDb } from '../index';
import { companySettings } from '../schema';

/**
 * The single `company_settings` row (§4, §8).
 *
 * This is what prints in the invoice header (§10) and what §9.1's booking
 * numbers take their prefix from. There is exactly one row, `id = 1`, seeded by
 * migration `0004` with placeholders — §19 open item 4 is the client supplying
 * the real legal name, CR number, address and bank details, and they enter them
 * on `/admin/settings/company` rather than in a migration.
 *
 * ## No VAT fields, and that is a compliance decision
 *
 * §9.9 and Appendix A: the company is not VAT-registered, the document is
 * "INVOICE" and never "Tax Invoice", and there is no VAT number and no VAT
 * line. So there is nothing here to hold one. `bookings.vatAmount` exists at
 * `0` to make a future registration a smaller migration (§10), but nothing in
 * this table invites someone to fill in a registration number the company does
 * not have.
 */

export type CompanySettings = {
  legalName: string;
  tradingName: string | null;
  crNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string | null;
  phonePrimary: string | null;
  phoneSecondary: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankIban: string | null;
  numberPrefix: string;
  defaultTerms: string | null;
  preparedByLabel: string | null;
  approvedByName: string | null;
  updatedAt: number;
};

const COLUMNS = {
  legalName: companySettings.legalName,
  tradingName: companySettings.tradingName,
  crNumber: companySettings.crNumber,
  addressLine1: companySettings.addressLine1,
  addressLine2: companySettings.addressLine2,
  city: companySettings.city,
  country: companySettings.country,
  phonePrimary: companySettings.phonePrimary,
  phoneSecondary: companySettings.phoneSecondary,
  whatsapp: companySettings.whatsapp,
  email: companySettings.email,
  website: companySettings.website,
  bankName: companySettings.bankName,
  bankAccountName: companySettings.bankAccountName,
  bankIban: companySettings.bankIban,
  numberPrefix: companySettings.numberPrefix,
  defaultTerms: companySettings.defaultTerms,
  preparedByLabel: companySettings.preparedByLabel,
  approvedByName: companySettings.approvedByName,
  updatedAt: companySettings.updatedAt,
} as const;

/** The row, or `null` if the seed has not been applied to this database. */
export async function getCompanySettings(): Promise<CompanySettings | null> {
  const db = getDb();

  const [row] = await db
    .select(COLUMNS)
    .from(companySettings)
    .where(eq(companySettings.id, 1))
    .limit(1);

  return row ?? null;
}

export type CompanySettingsInput = Omit<CompanySettings, 'updatedAt'>;

/**
 * Writes the row, creating it if the seed never ran.
 *
 * `onConflictDoUpdate` on the primary key rather than a read-then-branch: the
 * row either exists or it does not, and asking first is a second round trip
 * that can still be wrong by the time the write happens.
 */
export async function saveCompanySettings(
  input: CompanySettingsInput,
): Promise<void> {
  const db = getDb();
  const updatedAt = nowSeconds();

  await db
    .insert(companySettings)
    .values({ id: 1, ...input, updatedAt })
    .onConflictDoUpdate({
      target: companySettings.id,
      set: { ...input, updatedAt },
    });
}
