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
