import { ROLES, type Role } from '@/lib/roles';

/**
 * The §12 permission table, transcribed once.
 *
 * Everything that asks "may this person do that?" — a server action's guard, a
 * layout's redirect, whether a button renders — reads from this map. Written
 * out per call site instead, the three would drift, and the way they drift is
 * that the UI hides a control the action still happily performs.
 *
 * **Hiding a control is not a permission.** Every entry here is enforced in the
 * server action that does the work (§12, *Enforcement*); the UI consults the
 * same map so that a viewer is not offered a button that will refuse them.
 *
 * Most of these capabilities have nothing to enforce yet — bookings land in
 * Phase 10, payments in Phase 11. The table is transcribed in full anyway,
 * because the alternative is discovering in Phase 11 that "reverse payments" was
 * written as executive-and-above in one action and admin-only in another.
 */
export const CAPABILITIES = {
  /* Read — everyone who can sign in at all. */
  viewPanel: ['admin', 'executive', 'viewer'],

  /* Booking lifecycle. */
  createBookings: ['admin', 'executive'],
  confirmBookings: ['admin', 'executive'],
  editBookings: ['admin', 'executive'],
  markCompleted: ['admin', 'executive'],
  cancelBookings: ['admin'],

  /* Money. Recording a payment is routine; reversing one is not, and §9.4
     keeps both the original and the reversal visible afterwards. */
  recordPayments: ['admin', 'executive'],
  reversePayments: ['admin'],

  /* Documents — both invoice styles (§10). */
  generatePdf: ['admin', 'executive'],

  /* Working data. */
  manageAgencies: ['admin', 'executive'],
  createReminders: ['admin', 'executive'],
  moderateReviews: ['admin', 'executive'],

  /* Administration. */
  manageLists: ['admin'],
  manageUsers: ['admin'],
  editCompanySettings: ['admin'],
  viewAuditLog: ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function roleCan(role: Role, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}

/** The roles an invite may grant, in the order the form offers them. */
export const ASSIGNABLE_ROLES: readonly Role[] = ROLES;
