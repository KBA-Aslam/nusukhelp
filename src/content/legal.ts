/**
 * `/privacy` and `/terms` — section structure (§4, *Legal*).
 *
 * Both pages are the same shape: a numbered stack of sections, each a title, a
 * body, and optionally a bulleted list. The ids are here, the wording is in the
 * message catalogue, and `legal-article.tsx` renders either one.
 *
 * Message keys — `privacy.sections.<id>.*` and `terms.sections.<id>.*`:
 *
 *   title
 *   body
 *   bullets.<bulletId>   — only for the ids listed in `bullets` below
 *
 * ## Two deliberate omissions
 *
 * **The booking terms in §11 are not reproduced on `/terms`.** They are
 * snapshotted onto each booking at confirmation and are editable in company
 * settings, so a hard-coded copy on the public site would drift from the
 * authoritative text the moment an admin edited it — and the drifted copy would
 * be the one a customer read before booking. `/terms` instead states that the
 * booking terms are issued with the confirmation and the invoice, and what they
 * cover. One text, one place.
 *
 * **Neither page has been through legal review.** They are drafted against
 * Appendix A and what the site actually does, and they are tracked as §19 open
 * item 12 — go-live, not build.
 */

export type LegalSection = {
  readonly id: string;
  /** Key segments under `…sections.<id>.bullets.*`, in order. */
  readonly bullets?: readonly string[];
};

/**
 * The date both documents carry as *last updated*. ISO, rendered through
 * `formatDate()` so `/ar` gets Arabic month names and Western digits (§6).
 *
 * One constant for both pages: they were written together and, being the same
 * company's statement of the same practices, should not be able to claim
 * different revision dates. Bump it when either page's wording changes.
 */
export const LEGAL_UPDATED = '2026-08-17';

/* --------------------------------------------------------------------------
   Privacy

   Scoped to the public site. The admin panel (Release 2) handles staff and
   booking data under the company's own internal arrangements and is not
   described to the public here.

   `collect` and `use` carry the disclosure that matters most: an approved
   review publishes a name and a country, and **never an email** — §14.1 makes
   that a property of the query type, and this is where the reader is told.
   -------------------------------------------------------------------------- */

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  { id: 'scope' },
  { id: 'collect', bullets: ['reviews', 'enquiries', 'messages', 'technical'] },
  { id: 'use', bullets: ['reply', 'publish', 'protect', 'records'] },
  { id: 'legalBasis' },
  { id: 'sharing', bullets: ['hosting', 'email', 'never'] },
  { id: 'cookies' },
  { id: 'retention' },
  { id: 'rights', bullets: ['access', 'correct', 'remove', 'withdraw'] },
  { id: 'security' },
  { id: 'children' },
  { id: 'changes' },
  { id: 'contactUs' },
] as const;

/* --------------------------------------------------------------------------
   Terms

   `permits` and `independence` are the two compliance sections. They restate,
   in the binding document rather than in marketing copy, what Appendix A
   requires the site to say everywhere: permit work is assistance and guidance
   through official channels, and the company is not affiliated with Nusuk or
   the Ministry of Hajj and Umrah. `independence` renders the same
   `footer.disclaimer` string the footer and the consultation block do, so the
   legally reviewed wording (§19 item 1) cannot be updated in one place and
   missed here.
   -------------------------------------------------------------------------- */

export const TERMS_SECTIONS: readonly LegalSection[] = [
  { id: 'who' },
  { id: 'services' },
  { id: 'permits' },
  { id: 'independence' },
  { id: 'information' },
  { id: 'bookingTerms', bullets: ['payment', 'cancellation', 'hotel', 'liability'] },
  { id: 'reviews' },
  { id: 'content' },
  { id: 'liability' },
  { id: 'law' },
  { id: 'changes' },
  { id: 'contactUs' },
] as const;
