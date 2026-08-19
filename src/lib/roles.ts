/**
 * The three staff roles of §12, and how they are named to a person.
 *
 * A module with no imports, deliberately. Roles are needed by the Drizzle
 * schema, by the server-side guards, and by client components that render a
 * role selector or a badge — so it cannot depend on `db/schema.ts` (which would
 * pull Drizzle into a browser bundle) and `db/schema.ts` imports *it* instead.
 * One list, one place; the enum on the `user.role` column is built from it.
 */

export const ROLES = ['admin', 'executive', 'viewer'] as const;

export type Role = (typeof ROLES)[number];

/**
 * Admin-panel copy is English-only — `/admin/*` carries no locale prefix (§4) —
 * so these are plain strings rather than message keys. They are centralised
 * anyway because a role appears on the users list, in the invite form and in
 * the invite email, and three spellings of "Executive" is how a system stops
 * looking like one.
 */
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  executive: 'Executive',
  viewer: 'Viewer',
};

/** One line each, for the invite form. */
export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin:
    'Everything, including cancellations, payment reversals, lookup lists, company settings and user management.',
  executive:
    'Day-to-day operations — create, confirm and edit bookings, record payments, generate invoices, manage agencies.',
  viewer: 'Read-only. Dashboard, bookings, schedule and reports.',
};
