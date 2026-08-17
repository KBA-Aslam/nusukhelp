/**
 * The public routes that exist, for the sitemap (§17).
 *
 * ## Why this is not derived from the navigation
 *
 * `PRIMARY_NAV` and the footer columns in `lib/site.ts` are the obvious
 * candidates and they are both wrong for this job, in opposite directions.
 * `PRIMARY_NAV` links `/reviews`, which §4 specifies and **Phase 6 builds** —
 * listing an unbuilt route in the sitemap submits a 404 to Google. The footer's
 * Company column carries `/privacy` and `/terms` but its B2B column points four
 * labels at one route, which would put `/b2b` in the sitemap four times.
 *
 * Navigation answers "where should a reader be able to go from here"; a sitemap
 * answers "which documents exist". Those are different questions and they only
 * look like the same list. So this is its own list, and the check that keeps it
 * honest is `npm run build` printing the prerendered routes — a page here with
 * no route is a build-time 404, not a silent one.
 *
 * **`/reviews` is absent deliberately.** Add it in Phase 6, in the same commit
 * that builds the page. See §19.
 */

export type PublicRoute = {
  /** Locale-less path, exactly as §4's route map writes it. */
  readonly path: string;
  /**
   * Sitemap priority. These are relative weights within this one site, not a
   * score: the landing page and the reservation page are what the business
   * wants found, and the two legal drafts are what it does not.
   */
  readonly priority: number;
  readonly changeFrequency: 'monthly' | 'yearly';
};

export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { path: '/', priority: 1, changeFrequency: 'monthly' },
  { path: '/al-haramain-reservation', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/b2b', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.6, changeFrequency: 'yearly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
] as const;
