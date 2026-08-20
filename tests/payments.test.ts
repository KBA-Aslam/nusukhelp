import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/lib/roles';

import { createTestD1, type TestD1 } from './helpers/d1';

/**
 * The Phase 11 money sequence, end to end (§9.2, §9.4, §9.6).
 *
 * ## Why this test exists
 *
 * Phase 11 shipped with both halves of §9.2's *"the derivation runs on both
 * sides"* broken, in two different ways, and neither `tsc`, `eslint` nor
 * `next build` had anything to say about either:
 *
 * - **the numerator** — reversing a payment left `amountPaid` untouched,
 *   because the `SUM` filtered on a boolean column with an integer literal;
 * - **the denominator** — editing a booking below what had been paid raised no
 *   overpayment warning, because the guard ran against figures that had already
 *   been overwritten.
 *
 * Both were live behaviour against a database, and the only thing that could
 * have caught them before the client did is a test that runs the real actions
 * against a real D1 and reads the stored values back.
 *
 * ## What it runs against
 *
 * The real query modules, the real server actions, the real migrations, and
 * Miniflare's D1 — the same `workerd` and the same SQLite as production. Three
 * things are mocked, all of them outside the database: the Cloudflare context,
 * the session, and Next's cache invalidation.
 *
 * ## The sequence
 *
 * It is the client's own live test against `AHR-2026-00001`, in order and with
 * the same figures: a 1,675 booking, 500 in, a 2,000 overpayment that must warn
 * without being written, 1,175 to settle, the 500 reversed, and finally the
 * booking edited down to 500 while 1,175 sits against it. Every step asserts
 * the **stored** `amountPaid` and `paymentStatus`, not the return value —
 * a figure that is right in a response and wrong in the row is the exact
 * failure this project keeps having.
 */

const TEST_USER_ID = 'test-user-admin';
const TOTAL_VALUE = 1_675;

const ctx = vi.hoisted(() => ({
  db: null as unknown,
  role: 'admin' as Role,
}));

vi.mock('@/db/index', () => ({
  getDb: () => ctx.db,
  getDbForRender: async () => ctx.db,
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

/**
 * The real permission table, with a settable role — so the guards are tested
 * rather than bypassed. `requireCapability` is what every action calls first,
 * and §12 is explicit that hiding a control is not a permission.
 */
vi.mock('@/lib/auth-guard', async () => {
  const { roleCan } = await import('@/lib/permissions');

  class NotAuthorisedError extends Error {
    constructor(message = 'Not authorised') {
      super(message);
      this.name = 'NotAuthorisedError';
    }
  }

  const currentUser = () => ({
    id: 'test-user-admin',
    name: 'Test Admin',
    email: 'test@example.com',
    role: ctx.role,
  });

  return {
    NotAuthorisedError,
    requireCapability: async (capability: Parameters<typeof roleCan>[1]) => {
      if (!roleCan(ctx.role, capability)) throw new NotAuthorisedError();
      return currentUser();
    },
    requirePageAccess: async () => currentUser(),
    getSessionUser: async () => currentUser(),
  };
});

/* Imported after the mocks, which vitest hoists above them. */
const { bookings, payments, paymentMethods, user } = await import('@/db/schema');
const { confirmBooking, createDraft, getBooking, cancelBooking } = await import(
  '@/db/queries/bookings'
);
const { listPayments } = await import('@/db/queries/payments');
const { bookingConfirmSchema } = await import('@/lib/validation/booking');
const { recordPaymentAction, reversePaymentAction } = await import(
  '@/app/admin/(panel)/bookings/[id]/payment-actions'
);
const { saveBookingAction } = await import(
  '@/app/admin/(panel)/bookings/actions'
);

let harness: TestD1;
let bookingId: string;
let methodId: string;

const bookingValues = (pricePerNight: number) => ({
  agencyName: 'Test Agency',
  hotelName: 'Test Hotel',
  checkInDate: '2026-09-01',
  checkOutDate: '2026-09-02',
  rooms: [
    {
      roomTypeName: 'Double',
      numberOfRooms: 1,
      numberOfGuests: 2,
      pricePerNight,
    },
  ],
});

/** The stored row, never the action's return value. */
async function stored() {
  const booking = await getBooking(bookingId);
  if (!booking) throw new Error('booking vanished');
  return booking;
}

beforeAll(async () => {
  harness = await createTestD1();
  ctx.db = harness.db;
  ctx.role = 'admin';

  const now = new Date();
  await harness.db.insert(user).values({
    id: TEST_USER_ID,
    name: 'Test Admin',
    email: 'test@example.com',
    role: 'admin',
    createdAt: now,
    updatedAt: now,
  });

  const [method] = await harness.db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .limit(1);
  methodId = method?.id ?? '';

  const parsed = bookingConfirmSchema.parse(bookingValues(TOTAL_VALUE));
  bookingId = await createDraft(parsed, TEST_USER_ID);
  await confirmBooking(bookingId, TEST_USER_ID, { prefix: 'AHR', terms: null });
});

afterAll(async () => {
  await harness?.dispose();
});

describe('the booking starts where the client started', () => {
  it('is confirmed, unpaid, and worth 1,675', async () => {
    const booking = await stored();
    expect(booking.status).toBe('confirmed');
    expect(booking.bookingNumber).toMatch(/^AHR-\d{4}-\d{5}$/);
    expect(booking.totalValue).toBe(TOTAL_VALUE);
    expect(booking.amountPaid).toBe(0);
    expect(booking.paymentStatus).toBe('unpaid');
  });
});

describe('recording payments moves the numerator (§9.4)', () => {
  it('500 leaves the booking partially paid', async () => {
    const result = await recordPaymentAction({
      bookingId,
      values: {
        amount: 500,
        paidAt: '2026-08-15',
        methodId,
        reference: 'TRF-1',
        notes: '',
      },
    });

    expect(result.ok).toBe(true);

    const booking = await stored();
    expect(booking.amountPaid).toBe(500);
    expect(booking.paymentStatus).toBe('partially_paid');
  });

  it('2,000 warns about the overpayment and writes nothing', async () => {
    const result = await recordPaymentAction({
      bookingId,
      values: {
        amount: 2_000,
        paidAt: '2026-08-16',
        methodId,
        reference: 'TRF-2',
        notes: '',
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('confirm');
    if (result.kind !== 'confirm') return;
    expect(result.warnings.join(' ')).toMatch(/more than the balance due/i);

    // The half that matters: a warning must not be a partial save.
    const booking = await stored();
    expect(booking.amountPaid).toBe(500);
    expect(await listPayments(bookingId)).toHaveLength(1);
  });

  it('1,175 settles it in full', async () => {
    const result = await recordPaymentAction({
      bookingId,
      values: {
        amount: 1_175,
        paidAt: '2026-08-17',
        methodId,
        reference: 'TRF-3',
        notes: '',
      },
    });

    expect(result.ok).toBe(true);

    const booking = await stored();
    expect(booking.amountPaid).toBe(TOTAL_VALUE);
    expect(booking.paymentStatus).toBe('paid');
  });
});

describe('reversing a payment moves the numerator back (§9.4) — failure 4', () => {
  it('is refused for an executive, who may record but not reverse (§12)', async () => {
    ctx.role = 'executive';
    const [first] = await listPayments(bookingId);

    const result = await reversePaymentAction({
      paymentId: first.id,
      values: { reverseReason: 'Not allowed to do this' },
    });

    ctx.role = 'admin';

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/permission/i);

    const booking = await stored();
    expect(booking.amountPaid).toBe(TOTAL_VALUE);
  });

  it('drops amountPaid to 1,175 and returns the status to partially_paid', async () => {
    const [first] = await listPayments(bookingId);
    expect(first.amount).toBe(500);

    const result = await reversePaymentAction({
      paymentId: first.id,
      values: { reverseReason: 'Sent in error, refunded to the agency' },
    });

    expect(result.ok).toBe(true);

    // The row is marked, and the row stays (§9.4 — nothing is deleted).
    const history = await listPayments(bookingId);
    expect(history).toHaveLength(2);
    expect(history[0].isReversed).toBe(true);
    expect(history[0].reverseReason).toMatch(/refunded/i);

    // The derivation followed it. This is the assertion the live test failed.
    const booking = await stored();
    expect(booking.amountPaid).toBe(1_175);
    expect(booking.paymentStatus).toBe('partially_paid');
  });

  it('reverses idempotently — a second attempt changes nothing', async () => {
    const [first] = await listPayments(bookingId);

    const result = await reversePaymentAction({
      paymentId: first.id,
      values: { reverseReason: 'A second tap on a slow connection' },
    });

    expect(result.ok).toBe(true);

    const history = await listPayments(bookingId);
    expect(history[0].reverseReason).toMatch(/refunded/i);

    const booking = await stored();
    expect(booking.amountPaid).toBe(1_175);
  });
});

describe('editing a booking moves the denominator (§9.2, §9.3) — failure 5', () => {
  it('warns when the new value falls below what has been paid, and saves nothing', async () => {
    const result = await saveBookingAction({
      id: bookingId,
      values: bookingValues(500),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('confirm');
    if (result.kind !== 'confirm') return;
    expect(result.warnings.join(' ')).toMatch(/exceeds the new booking value/i);
    expect(result.warnings.join(' ')).toMatch(/refund/i);

    // A warning is not a save. The figures the person was shown must still be
    // the figures in the row.
    const booking = await stored();
    expect(booking.totalValue).toBe(TOTAL_VALUE);
    expect(booking.amountPaid).toBe(1_175);
    expect(booking.paymentStatus).toBe('partially_paid');
  });

  it('saves once acknowledged, and recalculates the status from the new value', async () => {
    const result = await saveBookingAction({
      id: bookingId,
      values: bookingValues(500),
      acknowledged: true,
    });

    expect(result.ok).toBe(true);

    const booking = await stored();
    expect(booking.totalValue).toBe(500);
    expect(booking.amountPaid).toBe(1_175);
    // §9.2's other direction: nothing in `payments` moved, and the booking is
    // now overpaid — which reads as `paid`, per the §9.6 ladder.
    expect(booking.paymentStatus).toBe('paid');
  });

  it('recovers when the value goes back up', async () => {
    const result = await saveBookingAction({
      id: bookingId,
      values: bookingValues(TOTAL_VALUE),
      acknowledged: true,
    });

    expect(result.ok).toBe(true);

    const booking = await stored();
    expect(booking.totalValue).toBe(TOTAL_VALUE);
    expect(booking.amountPaid).toBe(1_175);
    expect(booking.paymentStatus).toBe('partially_paid');
  });
});

describe('the §9.4 status rules are enforced in the action', () => {
  it('refuses a payment against a draft', async () => {
    const parsed = bookingConfirmSchema.parse(bookingValues(1_000));
    const draftId = await createDraft(parsed, TEST_USER_ID);

    const result = await recordPaymentAction({
      bookingId: draftId,
      values: {
        amount: 100,
        paidAt: '2026-08-18',
        methodId: '',
        reference: '',
        notes: '',
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.message).toMatch(/confirm the booking/i);

    expect(await listPayments(draftId)).toHaveLength(0);
  });

  it('refuses a payment against a cancelled booking, and says to reverse instead', async () => {
    const parsed = bookingConfirmSchema.parse(bookingValues(1_000));
    const id = await createDraft(parsed, TEST_USER_ID);
    await confirmBooking(id, TEST_USER_ID, { prefix: 'AHR', terms: null });
    await cancelBooking(id, 'Agency withdrew', TEST_USER_ID);

    const result = await recordPaymentAction({
      bookingId: id,
      values: {
        amount: 100,
        paidAt: '2026-08-18',
        methodId: '',
        reference: '',
        notes: '',
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.message).toMatch(/reversing the original payment/i);
  });
});

describe('the stored columns and the payments table agree', () => {
  it('amountPaid equals the sum of the payments that are not reversed', async () => {
    const rows = await harness.db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId));

    const live = rows
      .filter((row) => !row.isReversed)
      .reduce((sum, row) => sum + row.amount, 0);

    const [booking] = await harness.db
      .select({ amountPaid: bookings.amountPaid })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    expect(booking.amountPaid).toBe(live);
  });
});
