import { IBM_Plex_Sans_Arabic } from 'next/font/google';

/**
 * IBM Plex Sans Arabic — `/ar` only (§6).
 *
 * This sits in its own module, apart from the Latin faces, so the reason it is
 * configured differently stays attached to it.
 *
 * What keeps it off `/en` is that the `.variable` class is applied to `<html>`
 * only when the locale is `ar`. A browser does not fetch a `@font-face` source
 * until some rendered text actually matches the family, so on `/en` nothing
 * resolves to it and the woff2 is never requested. The `@font-face` block
 * itself does ship in the shared stylesheet on both locales — about a kilobyte
 * of CSS, no bytes of font.
 *
 * `preload: false` is the guard around that. Next cannot see the conditional —
 * it only sees the font referenced from the shared locale layout — so it is
 * free to emit a `<link rel="preload">` for the woff2 into every public page,
 * which would fetch on `/en` exactly the file the arrangement above avoids.
 * This build happens not to emit one for any of the three faces, because all of
 * them are consumed as CSS variables rather than applied class names, but that
 * is an implementation detail of the font loader and not something to depend
 * on. Turning preload off states the requirement instead of inheriting it.
 *
 * The cost is that `/ar` starts the font fetch at layout rather than during the
 * preload scan. That is the correct trade: `display: 'swap'` means Arabic text
 * is readable immediately in the fallback, and the alternative charges every
 * English page for a font it will never draw a glyph from.
 */
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-plex-arabic',
});
