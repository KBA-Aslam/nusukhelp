import type { Metadata } from 'next';

import { PageHeading } from '@/components/admin/ui';
import { getCompanySettings } from '@/db/queries/company';
import { requirePageAccess } from '@/lib/auth-guard';

import { CompanyForm } from './company-form';

export const metadata: Metadata = { title: 'Company' };

/**
 * `/admin/settings/company` — the invoice header (§4, §10).
 *
 * Admin only (§12). The row is seeded with placeholders by migration `0004`;
 * §19 open item 4 is the client replacing them with the real legal name, CR
 * number, address and bank details, which they do here rather than in a
 * migration.
 */
export default async function CompanyPage() {
  await requirePageAccess('editCompanySettings');

  const settings = await getCompanySettings();

  return (
    <>
      <PageHeading
        title="Company"
        description="What prints in the header and footer of every invoice."
      />

      <CompanyForm settings={settings} />
    </>
  );
}
