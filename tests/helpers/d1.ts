import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';

import * as schema from '@/db/schema';

/**
 * A real D1, migrated, for one test suite.
 *
 * `getPlatformProxy` is Wrangler's own way into the local bindings — it reads
 * `wrangler.jsonc` and hands back the same `env.DB` the Worker sees, backed by
 * the same `workerd` and the same SQLite that Cloudflare runs. A query that
 * behaves one way here behaves that way in production, which matters more than
 * it sounds for this project: both Phase 11 defects were things only the
 * database could have told us. One was a `WHERE` clause that matched nothing,
 * and neither type checking nor the build has an opinion about those.
 *
 * **Persistence goes to a fresh temporary directory**, never to `.wrangler`.
 * Tests that share a database with `npm run dev` would either read someone's
 * half-finished draft or write test bookings into the local panel, and the
 * project's own rule is that staff-entered data is not disturbed by machinery.
 *
 * The schema comes from the **migrations**, not from `drizzle-kit push`, so the
 * tables under test are the tables that were actually deployed.
 */
export type TestD1 = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  raw: D1Database;
  dispose: () => Promise<void>;
};

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'drizzle/migrations');

export async function createTestD1(): Promise<TestD1> {
  const persistPath = await mkdtemp(path.join(tmpdir(), 'nusukhelp-test-'));

  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    persist: { path: persistPath },
  });

  const raw = proxy.env.DB;
  await applyMigrations(raw);

  return {
    db: drizzle(raw, { schema }),
    raw,
    dispose: async () => {
      await proxy.dispose();
      await rm(persistPath, { recursive: true, force: true });
    },
  };
}

/**
 * Apply every migration in order.
 *
 * Split on drizzle's `--> statement-breakpoint` marker rather than on `;`,
 * which appears inside the seed data's string literals (`0004_seed_lookups`)
 * and would cut a statement in half.
 */
async function applyMigrations(d1: D1Database): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      try {
        await d1.prepare(statement).run();
      } catch (error) {
        throw new Error(
          `${file}: ${(error as Error).message}\n${statement.slice(0, 200)}`,
        );
      }
    }
  }
}
