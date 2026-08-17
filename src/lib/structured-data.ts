import type { ReviewSummary } from '@/db/queries/reviews';
import { localeUrl } from '@/lib/metadata';
import { EMAIL, LOGO, PHONE_ALT_DISPLAY, PHONE_DISPLAY, SITE_URL } from '@/lib/site';

/**
 * JSON-LD builders (§17).
 *
 * §17 asks for three things and no more: `TravelAgency` on the landing page,
 * `Service` on the reservation sections, and `AggregateRating` on reviews —
 * published only, and with no email addresses anywhere near it.
 *
 * ## Two rules this file is written against
 *
 * **Appendix A applies to structured data.** Search engines quote it, so a
 * claim made here is a claim made to a reader. Nothing in these objects
 * describes the company as official, authorised, approved, or connected to
 * Nusuk or the Ministry of Hajj and Umrah, and nothing about permit work
 * implies an outcome. `TravelAgency` is a description of what the business is,
 * not a credential.
 *
 * **Nothing is invented to satisfy a schema.** Google's rich-result docs list
 * properties that "improve" a `LocalBusiness` — `address`, `priceRange`,
 * `openingHours` — and every one of them is a §19 open item here: the legal
 * name, CR number and full address are placeholders the client has not yet
 * supplied (item 4), and this company quotes per booking, so a price band would
 * be fiction. A missing property costs a rich-result enhancement. A wrong one
 * is a false statement about a business, published in a machine-readable form
 * that is harder to retract than a line of copy. They land when item 4 does.
 *
 * ## The organisation node is referenced, not repeated
 *
 * Every page that emits anything emits it against the same `@id`
 * (`https://nusukhelp.com/#organization`), so a crawler reading the landing
 * page and the reservation page sees one business with services attached,
 * rather than two descriptions it has to reconcile.
 */

/** The stable node id for the company, referenced from every other node. */
const ORGANISATION_ID = `${SITE_URL}/#organization`;

/** JSON-LD is untyped by nature; this is as much shape as it is worth having. */
export type JsonLdObject = Record<string, unknown>;

/**
 * `TravelAgency` — the landing page (§17).
 *
 * `name`, `description` and the phone numbers come from the same constants and
 * message keys the visible page uses, so the structured description and the
 * human one cannot drift apart.
 *
 * `aggregateRating` is attached **only** when at least one review is published.
 * An `AggregateRating` with a zero `reviewCount` is invalid, and one built from
 * pending or hidden reviews would publish moderation state the site does not
 * show.
 */
export function travelAgencySchema({
  locale,
  name,
  description,
  areaServed,
  reviews,
}: {
  locale: string;
  name: string;
  description: string;
  /** Localised area names — the four §5 item 6 coverage areas. */
  areaServed: readonly string[];
  reviews: ReviewSummary | null;
}): JsonLdObject {
  const node: JsonLdObject = {
    '@type': 'TravelAgency',
    '@id': ORGANISATION_ID,
    name,
    description,
    url: localeUrl(locale, '/'),
    logo: `${SITE_URL}${LOGO.nusukOnLight.src}`,
    image: `${SITE_URL}/og/nusuk-help.png`,
    // Both published lines. `telephone` takes the Saudi office number, which is
    // also what the WhatsApp CTAs deep-link to.
    telephone: PHONE_DISPLAY,
    email: EMAIL,
    contactPoint: [PHONE_DISPLAY, PHONE_ALT_DISPLAY].map((telephone) => ({
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone,
      availableLanguage: ['en', 'ar'],
    })),
    areaServed: [
      { '@type': 'Country', name: 'Saudi Arabia' },
      ...areaServed.map((area) => ({ '@type': 'Place', name: area })),
    ],
    knowsLanguage: ['en', 'ar'],
  };

  if (reviews && reviews.count > 0) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviews.average,
      reviewCount: reviews.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return node;
}

/**
 * One `Service` node per anchored section on `/al-haramain-reservation` (§17).
 *
 * `url` is the section's own anchor, so a result that surfaces "Hotel
 * reservations" lands the reader on that section rather than at the top of a
 * six-service page — which is the mitigation §4 names for deliberately putting
 * six search intents on one URL.
 *
 * `provider` is a reference to the organisation node, not a copy of it.
 */
export function serviceSchema({
  locale,
  path,
  anchor,
  name,
  description,
}: {
  locale: string;
  path: string;
  anchor: string;
  name: string;
  description: string;
}): JsonLdObject {
  return {
    '@type': 'Service',
    '@id': `${localeUrl(locale, path)}#${anchor}-service`,
    name,
    description,
    // No `serviceType`. Schema.org wants a category there and the only
    // truthful value available is the service's own name, which `name` already
    // carries — a duplicated field says nothing and a categorised one would be
    // invented.
    url: `${localeUrl(locale, path)}#${anchor}`,
    provider: { '@id': ORGANISATION_ID },
    areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
  };
}

/**
 * The organisation as a **reference**: identity only, no description, no
 * contact details.
 *
 * A page whose nodes say `provider: { @id }` has to put that id in its own
 * graph or the reference dangles, but it must not restate the whole business —
 * two full descriptions of one company under one id is exactly the drift the
 * shared `@id` exists to prevent. The landing page owns the full node; every
 * other page points at it.
 */
export function organisationReference({
  locale,
  name,
}: {
  locale: string;
  name: string;
}): JsonLdObject {
  return {
    '@type': 'TravelAgency',
    '@id': ORGANISATION_ID,
    name,
    url: localeUrl(locale, '/'),
  };
}

/**
 * Wraps nodes in the document a page actually emits.
 *
 * A `@graph` rather than one script per node: the reservation page has seven
 * nodes and they reference each other, and a single graph is what lets a
 * crawler resolve `provider: { @id }` without having to stitch separate
 * scripts together.
 */
export function jsonLdDocument(nodes: readonly JsonLdObject[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}
