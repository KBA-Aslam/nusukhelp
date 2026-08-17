import { avg, count, desc, eq } from 'drizzle-orm';

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

/**
 * The published reviews as an aggregate, for `AggregateRating` (§17).
 *
 * A **separate query, not a reduction over the rows** the landing band renders:
 * that list is capped at three and the rating a search result quotes has to be
 * over every published review, not over the newest three. Reducing the page's
 * array would have produced a plausible-looking number that was quietly wrong.
 *
 * Nothing here can leak an address — the select names two aggregates and no
 * columns — which is the same guarantee `PublicReview` gives structurally.
 * §14.1: an email is never rendered publicly, "not in HTML, not in JSON, not in
 * structured data".
 *
 * `null` when nothing is published, so the caller omits `aggregateRating`
 * rather than emitting one with a zero count, which is invalid.
 */
export type ReviewSummary = {
  count: number;
  /** Mean rating, rounded to one decimal place. */
  average: number;
};

export async function getPublishedReviewSummary(): Promise<ReviewSummary | null> {
  const db = await getDbForRender();
  if (!db) return null;

  const [row] = await db
    .select({ total: count(), average: avg(reviews.rating) })
    .from(reviews)
    .where(eq(reviews.status, 'published'));

  if (!row || row.total === 0) return null;

  // D1 returns SQLite's AVG as a string through Drizzle's `avg`.
  const average = Number(row.average ?? 0);
  if (!Number.isFinite(average) || average <= 0) return null;

  return { count: row.total, average: Math.round(average * 10) / 10 };
}
