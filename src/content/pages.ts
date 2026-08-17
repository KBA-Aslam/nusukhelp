/**
 * Structure for the Phase 5 detail pages that is not already carried by
 * `services.ts` or `reservation.ts` (§4: `/b2b`, `/about`, `/contact`).
 *
 * The rule from `services.ts` holds throughout: ids and order live here, copy
 * lives in the message catalogue. Anything these pages share with the landing
 * page — the six services, the six B2B pillars, the four coverage areas, the
 * two contact audiences — is **imported and reused, not restated**, so a
 * renamed service or a reworded pillar changes in one place. The lists below
 * are only what has no home yet.
 */

/* --------------------------------------------------------------------------
   How a partnership works — `/b2b`

   Four steps, in order. They describe the process the company already runs
   (§1: bookings are arranged by staff, not through an availability engine),
   which is why step 2 promises options rather than instant confirmation.

   Message keys — `b2b.process.steps.<id>.title | body`.
   -------------------------------------------------------------------------- */

export type B2bStepId = 'brief' | 'options' | 'confirm' | 'operate';

export type B2bStep = { readonly id: B2bStepId };

export const B2B_STEPS: readonly B2bStep[] = [
  { id: 'brief' },
  { id: 'options' },
  { id: 'confirm' },
  { id: 'operate' },
] as const;

/* --------------------------------------------------------------------------
   Company facts — `/about`

   A short definition list under the mission. Every entry is a fact stated in §1
   — the Madinah base, the two divisions, the coverage, the second desk behind
   the +880 number — and nothing here is a claim about quality or outcome, which
   Appendix A keeps out of the copy.

   Message keys — `about.facts.<id>.label | value`.
   -------------------------------------------------------------------------- */

export type AboutFactId = 'base' | 'structure' | 'coverage' | 'desks';

export type AboutFact = { readonly id: AboutFactId };

export const ABOUT_FACTS: readonly AboutFact[] = [
  { id: 'base' },
  { id: 'structure' },
  { id: 'coverage' },
  { id: 'desks' },
] as const;
