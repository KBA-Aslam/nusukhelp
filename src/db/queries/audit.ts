import { and, desc, eq } from 'drizzle-orm';

import { nowSeconds } from '@/lib/time';

import { getDb } from '../index';
import { auditLog, user } from '../schema';

/**
 * The audit trail (§13.10).
 *
 * ## Why the before/after values, and not just the fact of a change
 *
 * Because the invoice is not stored. A system that archives its documents can
 * answer "what did we send them in August?" by opening the August PDF; this one
 * re-renders from current state, so once a booking is edited the previous
 * figures exist **nowhere else in the database**. §13.10 is explicit: the audit
 * log is the only record of what a client was previously shown, and an entry
 * saying "booking edited" without the numbers would leave that question
 * permanently unanswerable.
 *
 * That is also why the log is written by the action rather than by a trigger:
 * it records the *intent* — confirmed, cancelled with a reason, completed — not
 * merely that some columns changed.
 */

/** The verbs. A closed list, so the timeline can render each one deliberately. */
export const AUDIT_ACTIONS = [
  'booking.created',
  'booking.updated',
  'booking.confirmed',
  'booking.completed',
  'booking.cancelled',
  'booking.draft_deleted',
  // Phases 11 and 12 add their own: payment.recorded, payment.reversed,
  // pdf.generated. Listed there, not pre-empted here.
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditChanges = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Anything that is neither, such as the reason given for a cancellation. */
  detail?: Record<string, unknown>;
};

export async function logAudit(entry: {
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: AuditChanges;
}): Promise<void> {
  const db = getDb();

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    changes: entry.changes ? JSON.stringify(entry.changes) : null,
    createdAt: nowSeconds(),
  });
}

/**
 * The fields worth diffing on a booking edit, and their labels.
 *
 * A whitelist rather than every column, for two reasons. The derived columns
 * (`totalValue`, `amountPaid`, `paymentStatus`, the counts) are recomputed on
 * every save and would fill the timeline with entries that are consequences
 * rather than decisions — except `totalValue`, which is kept precisely because
 * it is the figure the client was shown. And `updatedAt` changes every time by
 * definition, which is not information.
 */
export const AUDITED_BOOKING_FIELDS = {
  agencyName: 'Agency',
  contactPerson: 'Contact person',
  guestName: 'Guest',
  guestMobile: 'Guest mobile',
  hotelName: 'Hotel',
  hotelCity: 'City',
  confirmationNumber: 'Confirmation number',
  brnVrn: 'BRN / VRN',
  checkInDate: 'Check-in',
  checkOutDate: 'Check-out',
  dueDate: 'Due date',
  discountAmount: 'Discount',
  totalValue: 'Total value',
  totalRooms: 'Rooms',
  totalGuests: 'Guests',
  totalNights: 'Nights',
  notes: 'Notes',
  status: 'Status',
} as const;

type AuditedField = keyof typeof AUDITED_BOOKING_FIELDS;

/**
 * Reduce two snapshots to the fields that actually moved.
 *
 * Both sides of every changed field are kept — §13.10 wants the value that was
 * superseded, not a list of field names. Fields that did not change are dropped,
 * so an edit that touched one price does not write a wall of identical values
 * that hides the one thing that happened.
 */
export function diffBooking(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditChanges | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  let changed = false;

  for (const field of Object.keys(AUDITED_BOOKING_FIELDS) as AuditedField[]) {
    if (before[field] === after[field]) continue;
    changedBefore[field] = before[field] ?? null;
    changedAfter[field] = after[field] ?? null;
    changed = true;
  }

  return changed ? { before: changedBefore, after: changedAfter } : null;
}

export type AuditEntry = {
  id: string;
  action: string;
  changes: AuditChanges | null;
  createdAt: number;
  actorName: string | null;
};

/**
 * One entity's history, newest first — the timeline on the booking detail
 * screen (§13.4, §13.10).
 *
 * The actor is joined rather than snapshotted: a staff member's *name* is not
 * what the entry is about, and showing the current one is right if someone
 * corrects a typo in their own name. The reference is `set null` on delete, so
 * a removed account leaves the entry readable with no actor rather than taking
 * the history with it.
 */
export async function listAuditForEntity(
  entityType: string,
  entityId: string,
  limit = 100,
): Promise<AuditEntry[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      changes: auditLog.changes,
      createdAt: auditLog.createdAt,
      actorName: user.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .where(
      and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    createdAt: row.createdAt,
    actorName: row.actorName ?? null,
    changes: parseChanges(row.changes),
  }));
}

/**
 * A malformed `changes` blob must not take down the screen it appears on. The
 * timeline is the record of last resort; rendering the rest of it without one
 * unreadable entry is better than a 500 on the booking detail page.
 */
function parseChanges(raw: string | null): AuditChanges | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuditChanges;
  } catch {
    return null;
  }
}
