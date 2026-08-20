/**
 * The Al Haramain mark used on both invoice styles (§7, *Logo placement*).
 *
 * In its own module, with no `@react-pdf/renderer` import, because the booking
 * detail screen needs this constant and must **not** pull the PDF library into
 * its bundle. `components/pdf/invoice-theme.ts` calls `StyleSheet.create` at
 * module scope, so importing the constant from there put all 634 kB of
 * react-pdf into the page's initial JavaScript and defeated the point of
 * loading the documents dynamically. One import of one string is enough to do
 * that, which is why it lives here on its own.
 *
 * A same-origin path rather than an embedded data URI: the file is 250 KB, and
 * inlining it would put that in the bundle of a panel used on hotel wifi. The
 * tests pass their own source, so no test depends on a fetch.
 */
export const AHR_MARK_SRC = '/logos/ahr-logo-tile.png';
