import type { Metadata } from 'next';

import { PageHeading } from '@/components/admin/ui';
import { requirePageAccess } from '@/lib/auth-guard';

import { AgencyForm } from '../agency-form';

export const metadata: Metadata = { title: 'New agency' };

/**
 * `/admin/agencies/new`.
 *
 * §4's route map lists `/admin/agencies` and `/admin/agencies/[id]` and does
 * not name this one or `[id]/edit`; both are implied by "agencies CRUD" in the
 * Phase 9 brief and are recorded as a Phase 9 ruling in §13. Dedicated routes
 * rather than a modal, because §20 makes the panel a phone product first and a
 * modal containing eight fields on a phone is a full screen with a worse back
 * button.
 */
export default async function NewAgencyPage() {
  await requirePageAccess('manageAgencies');

  return (
    <>
      <PageHeading
        title="New agency"
        description="Only the name is required. Everything else can be filled in later."
      />
      <AgencyForm agency={null} />
    </>
  );
}
