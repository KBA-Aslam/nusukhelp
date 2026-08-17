import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

/**
 * The Drizzle handle for the request-scoped D1 binding.
 *
 * Call this inside a request (Server Component, Server Action, route handler) —
 * the Cloudflare context is not available at module scope. Query functions live
 * in `src/db/queries/`; no component talks to Drizzle directly.
 */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;

/**
 * The same handle, for code that also runs while a static page is being
 * generated — the public site (§2, *rendering model*).
 *
 * Two differences from `getDb`, both forced by the build:
 *
 * 1. **Async.** During `next build` the Cloudflare context has to be started on
 *    demand; the synchronous accessor throws outright. `{ async: true }` is the
 *    supported way in, and it is a no-op at request time.
 * 2. **Nullable.** `next build` reaches D1 through Wrangler's local proxy, so a
 *    page prerendered on a machine with no local database still has to build.
 *    Returning `null` lets the caller render its empty state instead of failing
 *    the build; in the Worker the binding is always present.
 *
 * Do not reach for this in admin code. Admin pages and server actions run in a
 * request with real bindings, and there a missing database is a fault worth
 * throwing on — use `getDb`.
 */
export async function getDbForRender(): Promise<Db | null> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env?.DB) return null;
  return drizzle(env.DB, { schema });
}
