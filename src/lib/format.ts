/**
 * Display formatting (Appendix B).
 *
 * Two rules from the spec live here rather than at each call site, because both
 * are the kind that gets silently forgotten once and then stays wrong:
 *
 *  - **Every date is a Saudi date.** §6 and `i18n/request.ts` pin the site to
 *    `Asia/Riyadh`; a Worker running in another region would otherwise render a
 *    date a day out at the edges of the day.
 *  - **Western Arabic numerals in both locales** (§6). `Intl` defaults `ar` to
 *    Arabic-Indic digits (`١٧`), so the numbering system is pinned explicitly
 *    through the `-u-nu-latn` locale extension. Month and weekday names still
 *    localise — it is the digits that are fixed, not the language.
 *
 * `formatSAR()` for money (§Appendix B) belongs here too and lands with the
 * first screen that shows an amount, in Release 2. There is nothing to format
 * on the public site.
 */

export const TIME_ZONE = 'Asia/Riyadh';

/**
 * A date, long form: *17 August 2026*.
 *
 * `date` is an ISO `YYYY-MM-DD` string or a `Date`. A bare date string parses
 * as UTC midnight, which is 03:00 in Riyadh — the same calendar day, which is
 * the whole point of pinning the zone.
 */
export function formatDate(date: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}
