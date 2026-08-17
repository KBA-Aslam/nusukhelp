/**
 * The landing page's enumerable sections, as data (§5).
 *
 *   4. Services grid ......... seven cards, card 07 distinct
 *   5. Why choose us ......... six points
 *   6. Coverage .............. four areas
 *   7. B2B highlight ......... six pillars
 *
 * Structure lives here; **copy does not**. Every user-visible string is reached
 * through a message key, exactly as `src/lib/site.ts` reaches nav labels
 * through `labelKey` — otherwise `/ar` renders English and §19 open item 5
 * becomes a hunt through components instead of a values-only diff in
 * `ar.json`. The key trees each list expects are documented above it.
 *
 * Order is array order. Components map, they do not re-sort.
 */

/* --------------------------------------------------------------------------
   Icons — restored in Phase 4b (§7, texture amendment).

   The field was dropped in Phase 4 because nothing rendered it and the
   prototypes draw no icons. It is back because the glyphs now exist and render:
   a set drawn for this project in `components/ui/brand-icons.tsx`, sharing the
   ogee curve and the square-Kufic right angles rather than importing a generic
   icon library.

   The `id` *is* the glyph name — `BrandIconName` is built from `ServiceId` plus
   the why-choose-us and coverage ids, so a new entry without a matching glyph
   is a compile error rather than a blank square on the page. That is why there
   is no separate `icon` string to keep in sync.

   The brass hairline stays above each card; the icon sits with it and does not
   replace it.

   `headOffice` stays dropped — still nothing renders it.
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   Services — §5 item 4

   Six reservation services plus B2B. The six each own an anchored section on
   `/al-haramain-reservation` (§4); the anchors are the same six already linked
   from the footer in `site.ts`, and the two lists must not drift.

   Card 07 is B2B. It is the one card that leaves the reservation page — §5
   gives it "distinct treatment", which the desktop prototype draws as a
   full-width band below the grid rather than a seventh tile. That is a layout
   difference, so it is carried as `emphasis`, not as a separate array: it is
   still one of seven services and belongs in one list for counting, mapping,
   and structured data (§17).

   Message keys — `services.*`:

     eyebrow, heading, intro, readMore
     items.<id>.title
     items.<id>.summary

   `<id>` is the `id` field below, camelCase to match §Appendix B's key rule.
   -------------------------------------------------------------------------- */

export type ServiceId =
  | 'hotels'
  | 'transport'
  | 'rail'
  | 'ziyarat'
  | 'permits'
  | 'groundHandling'
  | 'b2b';

export type Service = {
  /** Message key segment under `services.items.*`. Also the React list key. */
  readonly id: ServiceId;
  /**
   * Section id on `/al-haramain-reservation`, kebab-case per §4. `null` for
   * B2B, which has its own route rather than a section.
   */
  readonly anchor: string | null;
  /** Locale-less — the `Link` from `@/i18n/navigation` adds the prefix. */
  readonly href: string;
  /**
   * `card` — one tile in the grid.
   * `feature` — the full-width band the prototype gives card 07.
   */
  readonly emphasis: 'card' | 'feature';
};

export const SERVICES: readonly Service[] = [
  {
    id: 'hotels',
    anchor: 'hotels',
    href: '/al-haramain-reservation#hotels',
    emphasis: 'card',
  },
  {
    id: 'transport',
    anchor: 'transport',
    href: '/al-haramain-reservation#transport',
    emphasis: 'card',
  },
  {
    id: 'rail',
    anchor: 'rail',
    href: '/al-haramain-reservation#rail',
    emphasis: 'card',
  },
  {
    id: 'ziyarat',
    anchor: 'ziyarat',
    href: '/al-haramain-reservation#ziyarat',
    emphasis: 'card',
  },
  {
    id: 'permits',
    anchor: 'permits',
    href: '/al-haramain-reservation#permits',
    emphasis: 'card',
  },
  {
    id: 'groundHandling',
    anchor: 'ground-handling',
    href: '/al-haramain-reservation#ground-handling',
    emphasis: 'card',
  },
  {
    id: 'b2b',
    anchor: null,
    href: '/b2b',
    emphasis: 'feature',
  },
] as const;

/**
 * The six that `/al-haramain-reservation` renders as anchored sections
 * (Phase 5). Narrowed so that page cannot accidentally render a section for
 * B2B, and so `anchor` is a `string` there rather than `string | null`.
 */
export const RESERVATION_SERVICES: readonly (Service & {
  readonly anchor: string;
})[] = SERVICES.filter(
  (service): service is Service & { anchor: string } => service.anchor !== null,
);

/* --------------------------------------------------------------------------
   Why choose us — §5 item 5

   Six points. The prototype heads this section "Why agencies choose us": the
   points are the B2B differentiators, which is why local presence and a
   dedicated agent are in the list.

   Message keys — `whyChooseUs.*`:

     eyebrow, heading
     points.<id>.title
     points.<id>.body
   -------------------------------------------------------------------------- */

export type WhyChooseUsId =
  | 'reliableService'
  | 'competitiveRates'
  | 'fastResponse'
  | 'localExpertise'
  | 'professionalCoordination'
  | 'b2bSupport';

export type WhyChooseUsPoint = { readonly id: WhyChooseUsId };

export const WHY_CHOOSE_US: readonly WhyChooseUsPoint[] = [
  { id: 'reliableService' },
  { id: 'competitiveRates' },
  { id: 'fastResponse' },
  { id: 'localExpertise' },
  { id: 'professionalCoordination' },
  { id: 'b2bSupport' },
] as const;

/* --------------------------------------------------------------------------
   B2B highlight — §5 item 7

   Six pillars and a *Become our partner* CTA.

   **This section has no prototype.** `02-landing-desktop.svg` draws eight
   bands, not nine: it folds the B2B highlight into service card 07 (the ink
   band under the services grid) and gives the six-point section the
   agency-facing heading "Why agencies choose us". §5 asks for both, so this
   section is built to the spec and its copy is new — see the Phase 4 note
   added to §5. It needs a copy review before go-live.

   The pillars are deliberately operational rather than promissory: Appendix A
   forbids absolute promises about availability, pricing or outcomes, so none
   of them claims a rate, a guarantee, or privileged access.

   `confidentialInvoicing` is the confidential invoice style in §10 — an
   invoice with the amounts absent, so an agency can hand its own client a
   document without exposing the B2B rate. It is a real capability of the
   system and the most concrete differentiator on the list.

   Message keys — `b2bHighlight.*`:

     eyebrow, heading, body, cta
     pillars.<id>.title
     pillars.<id>.body
   -------------------------------------------------------------------------- */

export type B2bPillarId =
  | 'wholesaleRates'
  | 'groupReservations'
  | 'groundHandling'
  | 'localRepresentation'
  | 'dedicatedAgent'
  | 'confidentialInvoicing';

export type B2bPillar = { readonly id: B2bPillarId };

/* --------------------------------------------------------------------------
   Contact audiences — §5 item 9

   The contact section splits by audience: pilgrims to the WhatsApp
   consultation, agencies to the B2B enquiry. The two cards were hard-coded
   until Phase 4c; they are a list here so their ids can key glyphs the same way
   every other card on the page does.

   Message keys — `contact.<id>.title | body | cta`.
   -------------------------------------------------------------------------- */

export type ContactAudienceId = 'pilgrims' | 'agencies';

export type ContactAudience = {
  readonly id: ContactAudienceId;
  /** Locale-less route, or `null` for the WhatsApp deep link built at render. */
  readonly href: string | null;
};

export const CONTACT_AUDIENCES: readonly ContactAudience[] = [
  { id: 'pilgrims', href: null },
  { id: 'agencies', href: '/b2b' },
] as const;

export const B2B_PILLARS: readonly B2bPillar[] = [
  { id: 'wholesaleRates' },
  { id: 'groupReservations' },
  { id: 'groundHandling' },
  { id: 'localRepresentation' },
  { id: 'dedicatedAgent' },
  { id: 'confidentialInvoicing' },
] as const;

/* --------------------------------------------------------------------------
   Coverage — §5 item 6

   Four areas. The section exists to make the Saudi-side presence concrete —
   §5 calls it the core B2B differentiator — so Madinah carries the head-office
   flag rather than leaving that fact to prose an Arabic translator could drop.

   `elsewhere` is deliberately not a city: it is the "anywhere else in the
   Kingdom" tile, which is why the type carries no geography beyond the
   head-office flag.

   Message keys — `coverage.*`:

     eyebrow, heading
     areas.<id>.name
     areas.<id>.detail
   -------------------------------------------------------------------------- */

export type CoverageAreaId = 'makkah' | 'madinah' | 'jeddah' | 'elsewhere';

export type CoverageArea = {
  readonly id: CoverageAreaId;
  /** §1 — the company operates from Madinah. Exactly one area is the base. */
  readonly headOffice: boolean;
};

export const COVERAGE_AREAS: readonly CoverageArea[] = [
  { id: 'makkah', headOffice: false },
  { id: 'madinah', headOffice: true },
  { id: 'jeddah', headOffice: false },
  { id: 'elsewhere', headOffice: false },
] as const;
