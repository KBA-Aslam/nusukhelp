import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeading } from '@/components/admin/ui';
import { getAgency } from '@/db/queries/agencies';
import { requirePageAccess } from '@/lib/auth-guard';

import { AgencyForm } from '../../agency-form';

export const metadata: Metadata = { title: 'Edit agency' };

/** `/admin/agencies/[id]/edit` — see the note in `../new/page.tsx`. */
export default async function EditAgencyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess('manageAgencies');

  const { id } = await params;
  const agency = await getAgency(id);
  if (!agency) notFound();

  return (
    <>
      <PageHeading title={`Edit ${agency.agencyName}`} />
      <AgencyForm agency={agency} />
    </>
  );
}
