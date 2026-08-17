/**
 * `/al-haramain-reservation` — the six anchored sections, as data (§4).
 *
 * §4 gives the page six anchors — `#hotels`, `#transport`, `#rail`, `#ziyarat`,
 * `#permits`, `#ground-handling` — and the anchors themselves already live on
 * `RESERVATION_SERVICES` in `services.ts`, where the landing cards and the
 * footer column also read them. They are **not** repeated here. What this file
 * adds is the one thing the summary cards do not carry: how many points each
 * section makes, and what each point is called.
 *
 * Structure here, copy in `en.json`, exactly as `services.ts` sets it out.
 *
 * Message keys — `reservation.sections.<serviceId>.*`:
 *
 *   lead
 *   points.<pointId>
 *   note            — only where `note` is true; see below
 *
 * The section's heading is **not** a key here: it is `services.items.<id>.title`,
 * the same string the landing card and the footer link use. One name per
 * service, everywhere it appears.
 */

import { RESERVATION_SERVICES, type ServiceId } from '@/content/services';

export type ReservationSection = {
  readonly id: ServiceId;
  /** Section id on the page, kebab-case per §4. */
  readonly anchor: string;
  /** Key segments under `reservation.sections.<id>.points.*`, in order. */
  readonly points: readonly string[];
  /**
   * Renders `reservation.sections.<id>.note` as a set-apart block below the
   * points.
   *
   * Exactly one section has one, and it is not decoration: Appendix A requires
   * permit work to be presented strictly as assistance, guidance and
   * coordination, with no implication that a permit can be obtained outside
   * official channels, that approval is guaranteed, or that this company has
   * privileged access to any official system. The note states all three
   * negatives in the reader's own words rather than leaving them to be
   * inferred from what the copy carefully does not say.
   *
   * A flag rather than free-form content because the page must not be able to
   * render a permits section *without* it.
   */
  readonly note: boolean;
};

const POINTS: Record<ServiceId, readonly string[]> = {
  hotels: ['grades', 'blocks', 'meals', 'distance', 'availability'],
  transport: ['airport', 'intercity', 'fleet', 'ziyaratRuns', 'drivers'],
  rail: [
    'routes',
    'groupTickets',
    'stationTransfers',
    'timings',
    // Appendix A — the fares and the timetable are the operator's, not ours,
    // and the copy says so rather than implying we set either.
    'operator',
  ],
  ziyarat: ['madinahSites', 'makkahSites', 'guides', 'halfOrFullDay'],
  permits: ['whichPermits', 'documents', 'application', 'timing', 'outcome'],
  groundHandling: [
    'meetAndAssist',
    'checkIn',
    'movement',
    'namedCoordinator',
    'reachable',
    'reporting',
  ],
  // `/b2b` is a route, not a section on this page — `RESERVATION_SERVICES`
  // already excludes it, so this entry is never read. It exists because the
  // record is total over `ServiceId`, which is what makes a new service without
  // a points list a compile error instead of an empty section.
  b2b: [],
};

/**
 * The six sections in page order — derived from `RESERVATION_SERVICES` so the
 * order, the anchors and the set itself cannot drift from the landing cards and
 * the footer column. Only `points` and `note` originate here.
 */
export const RESERVATION_SECTIONS: readonly ReservationSection[] =
  RESERVATION_SERVICES.map((service) => ({
    id: service.id,
    anchor: service.anchor,
    points: POINTS[service.id],
    note: service.id === 'permits',
  }));
