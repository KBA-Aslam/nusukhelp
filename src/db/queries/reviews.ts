import { desc, eq } from 'drizzle-orm';

import { getDbForRender } from '../index';
import { reviews } from '../schema';

/**
 * Published reviews, for the public site.
 *
 * ## Email never leaves the database
 *
 * §14.1: a reviewer's email is "never rendered publicly — not in HTML, not in
 * JSON, not in structured data". So this module works the way the confidential
 * invoice does (§10): the public type has **no email field at all**, and the
 * select names its columns explicitly rather than returning the row and
 * trusting every future component not to print one. `PublicReview` is what
 * crosses into the component tree, and it is a compile error for it to carry an
 * address.
 *
 * ## Only `published`
 *
 * `pending`, `hidden` and `spam` are all excluded by the status filter. A
 * review appears here after an admin approves it in Phase 15 and that approval
 * revalidates the static page — never before.
 */
export type PublicReview = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  country: string | null;
  createdAt: number;
};

export async function getPublishedReviews(
  limit: number,
): Promise<PublicReview[]> {
  const db = await getDbForRender();

  // No binding — see `getDbForRender`. An empty list is the correct render:
  // the section shows its "nothing published yet" state.
  if (!db) return [];

  return db
    .select({
      id: reviews.id,
      name: reviews.name,
      rating: reviews.rating,
      comment: reviews.comment,
      country: reviews.country,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(eq(reviews.status, 'published'))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}
