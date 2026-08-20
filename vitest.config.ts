import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * The test runner exists for one job: the derived money figures (§9.6).
 *
 * `amountPaid` and `paymentStatus` move for two unrelated reasons — a payment
 * changes the numerator, a booking edit changes the denominator (§9.2) — and
 * both halves are only ever exercised together on a real booking. Phase 11
 * shipped with each half broken in a different way, and neither `tsc`, `eslint`
 * nor `next build` could have caught either, because both were live behaviour
 * against a database.
 *
 * So the tests run the real query modules and the real server actions against a
 * real D1, provided by Miniflare — the same SQLite engine the Worker runs on,
 * not a stub and not an in-memory imitation with different semantics. What is
 * mocked is only what sits outside the transaction: the Cloudflare context, the
 * session, and Next's cache invalidation.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  // `tsconfig.json` sets `jsx: preserve` because Next compiles the app itself.
  // The test runner has no Next in front of it, so it does the transform.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup/dom.ts'],
    // Miniflare starts a workerd process per suite; the default 5s is not
    // enough for that plus six migrations on a cold run.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
