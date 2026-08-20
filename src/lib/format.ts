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
 * `formatSAR()` is here too, and it landed in Phase 9 with the first screen
 * that shows an amount — the default price on a service type. There is nothing
 * to format on the public site.
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

/**
 * Money (§8, Appendix B — *every money value through `formatSAR()`, never raw
 * interpolation*).
 *
 * The argument is a whole number of Saudi Riyals, because that is what every
 * money column stores: `integer`, no minor units, no decimals, SAR only. The
 * stored value equals the displayed value — `1500` renders as `SAR 1,500` —
 * which is the property §8 chose integers for. Nothing here divides by a
 * hundred, and nothing should ever start.
 *
 * `Intl.NumberFormat` in `decimal` style with the currency written out, rather
 * than `style: 'currency'`. The currency style renders `SAR 1,500.00` in `en`
 * and `1٬500.00 ر.س.‏` in `ar`, and both are wrong here: the trailing `.00` is
 * noise on a value that cannot have fractions, and an invoice that says
 * `ر.س.` in one locale and `SAR` in another is two different documents. The
 * label is fixed because the currency is (§8 — SAR only).
 *
 * Digits are pinned to Latin for the same reason `formatDate` pins them (§6),
 * so an amount reads identically on `/en`, on `/ar`, and on the PDF.
 */
export function formatSAR(riyals: number): string {
  const amount = new Intl.NumberFormat('en-u-nu-latn', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(riyals);

  return `SAR ${amount}`;
}

/**
 * The invoice header's *"Statement as of 22 Aug 2026, 14:30"* (§10).
 *
 * Required, not decorative. Nothing about an invoice is stored: the same
 * booking number produces a different — and always current — document every
 * time it is downloaded, so a client holding two copies of `AHR-2026-00041`
 * showing different figures has nothing else to tell them apart.
 *
 * Short month and a 24-hour clock, in `Asia/Riyadh` and Latin digits like every
 * other formatted value here. The zone is the point: a Worker or a phone in
 * another region must not stamp a Saudi document with its own local time.
 */
export function formatStatementTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-GB-u-nu-latn', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
