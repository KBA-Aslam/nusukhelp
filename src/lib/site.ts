/**
 * Company constants and the navigation map.
 *
 * Everything a component would otherwise hard-code about the company lives
 * here, in one place, because most of it is still a placeholder. §19 open items
 * 3 and 4 — the WhatsApp business number and the full legal details — are
 * client deliverables that block go-live, not the build. When they land, they
 * land here and nowhere else.
 *
 * Note the split: the *company* legal details that print on an invoice belong
 * in the `company_settings` table (§8), editable by an admin without a deploy.
 * What is here is only what the public marketing site needs at build time.
 */

/* --------------------------------------------------------------------------
   Contact
   -------------------------------------------------------------------------- */

/**
 * PLACEHOLDER — §19 open item 3.
 *
 * The Saudi office number from §1, standing in for the dedicated WhatsApp
 * Business number until the client supplies one. Single constant, per the
 * spec's placeholder rule: swapping it is a one-line change.
 */
export const WHATSAPP_NUMBER = '966576799128';

/** Display form of the same number. */
export const PHONE_DISPLAY = '+966 57 679 9128';
export const PHONE_HREF = 'tel:+966576799128';

/** Secondary line from §1 — Bangladesh desk. */
export const PHONE_ALT_DISPLAY = '+880 1690 029832';

export const EMAIL = 'Nusukhelp@outlook.com';
export const EMAIL_HREF = 'mailto:Nusukhelp@outlook.com';

export const SITE_URL = 'https://nusukhelp.com';

/**
 * Builds a WhatsApp deep link with a pre-filled message (§14.3 — WhatsApp is
 * the primary contact action in this market; the enquiry form is the fallback
 * and the record).
 *
 * Callers pass the message already localised. Keeping the copy out of here
 * means the pre-fill is translated alongside everything else rather than
 * becoming a second, English-only surface.
 */
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/* --------------------------------------------------------------------------
   Navigation

   `href` values are locale-less — the `Link` from `@/i18n/navigation` prefixes
   them. `labelKey` indexes into the `nav.*` and `footer.*` message namespaces
   so no English string is stranded in a component.
   -------------------------------------------------------------------------- */

export type NavItem = {
  href: string;
  labelKey: string;
};

/** Header navigation, in the order the prototype sets it. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/', labelKey: 'home' },
  { href: '/about', labelKey: 'about' },
  { href: '/al-haramain-reservation', labelKey: 'reservation' },
  { href: '/b2b', labelKey: 'b2b' },
  { href: '/reviews', labelKey: 'reviews' },
  { href: '/contact', labelKey: 'contact' },
] as const;

/**
 * Footer columns.
 *
 * The Services column points at the six anchors on
 * `/al-haramain-reservation` (§4). They are the section ids that page is built
 * with in Phase 5, so these links are correct in advance rather than
 * placeholders to revisit.
 */
export const FOOTER_SERVICES: readonly NavItem[] = [
  { href: '/al-haramain-reservation#hotels', labelKey: 'hotels' },
  { href: '/al-haramain-reservation#transport', labelKey: 'transport' },
  { href: '/al-haramain-reservation#rail', labelKey: 'rail' },
  { href: '/al-haramain-reservation#ziyarat', labelKey: 'ziyarat' },
  { href: '/al-haramain-reservation#permits', labelKey: 'permits' },
  {
    href: '/al-haramain-reservation#ground-handling',
    labelKey: 'groundHandling',
  },
] as const;

export const FOOTER_B2B: readonly NavItem[] = [
  { href: '/b2b', labelKey: 'agencySupport' },
  { href: '/b2b', labelKey: 'groupReservations' },
  { href: '/b2b', labelKey: 'wholesaleRates' },
  { href: '/b2b', labelKey: 'groundHandling' },
] as const;

export const FOOTER_COMPANY: readonly NavItem[] = [
  { href: '/about', labelKey: 'about' },
  { href: '/contact', labelKey: 'contact' },
  { href: '/reviews', labelKey: 'reviews' },
  { href: '/privacy', labelKey: 'privacy' },
  { href: '/terms', labelKey: 'terms' },
] as const;

/* --------------------------------------------------------------------------
   Brand marks

   §7 makes logo placement enforced, not advisory. Naming the files by their
   permitted surface is a small guard against reaching for the wrong one:
   the division mark never appears in the public site header.
   -------------------------------------------------------------------------- */

export const LOGO = {
  /** Parent mark, transparent — for the sand page ground. Header. */
  nusukOnLight: '/logos/nusuk-help-logo.png',
  /** Parent mark, cream — for the ink bands. Footer. */
  nusukOnDark: '/logos/nusuk-help-logo-light.png',
  /** Division mark, gold cutout — footer division line only, on this site. */
  ahrOnDark: '/logos/ahr-logo-gold.png',
  /** Division mark on its green tile — reservation page body, admin, invoice. */
  ahrTile: '/logos/ahr-logo-tile.png',
} as const;
