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

import { RESERVATION_SERVICES } from '@/content/services';

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
 * The Services column is **derived** from `RESERVATION_SERVICES`, not written
 * out again. It previously repeated the six anchors on
 * `/al-haramain-reservation` (§4) as literals, which would have gone stale the
 * first time a service was renamed — and a footer link that 404s is a worse
 * outcome than a footer whose order is not independently controllable. If the
 * footer ever needs its own order, add an explicit order field to the content
 * entries then; nothing needs it now.
 *
 * `labelKey` doubles as the service id, so `footer.services.*` and
 * `services.items.*` stay keyed alike.
 */
export const FOOTER_SERVICES: readonly NavItem[] = RESERVATION_SERVICES.map(
  (service) => ({ href: service.href, labelKey: service.id }),
);

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

/**
 * The marks, with their **intrinsic** pixel dimensions.
 *
 * The sizes live here because `next/image` needs the real aspect ratio to
 * reserve space, and getting it wrong shifts the layout as the image loads.
 * They were hard-coded in the component until the artwork was redrawn without
 * the English wordmark and every number went stale at once — measured from the
 * files now, in one place, so a future redraw is a one-line change here rather
 * than a hunt through components.
 */
export const LOGO = {
  /** Parent mark, transparent — for the sand page ground. Header. */
  nusukOnLight: {
    src: '/logos/nusuk-help-logo.png',
    width: 1770,
    height: 1847,
  },
  /** Parent mark, cream — for the ink bands. Footer. */
  nusukOnDark: {
    src: '/logos/nusuk-help-logo-light.png',
    width: 1763,
    height: 1867,
  },
  /** Division mark, gold cutout — footer division line only, on this site. */
  ahrOnDark: {
    src: '/logos/ahr-logo-gold.png',
    width: 336,
    height: 391,
  },
  /** Division mark on its green tile — reservation page body, admin, invoice. */
  ahrTile: {
    src: '/logos/ahr-logo-tile.png',
    width: 469,
    height: 463,
  },
} as const;
