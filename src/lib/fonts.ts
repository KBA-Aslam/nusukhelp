import { IBM_Plex_Sans, Marcellus } from 'next/font/google';

/**
 * The two Latin faces, loaded on every public route (§7).
 *
 * Marcellus is display only — headings, never body or UI. IBM Plex Sans carries
 * everything else. Plex was chosen specifically because IBM Plex Sans Arabic is
 * its sibling, so `/en` and `/ar` share one superfamily rather than pairing two
 * unrelated designs.
 *
 * The Arabic face lives in `fonts-arabic.ts` and is deliberately not imported
 * here — see the comment in that file for why.
 */

export const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400', // Marcellus ships a single weight.
  display: 'swap',
  variable: '--font-marcellus',
});

export const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-sans',
});
