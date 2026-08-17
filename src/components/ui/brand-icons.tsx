/**
 * The brand icon set — drawn for this project, not imported.
 *
 * §7, texture amendment. Twenty-four monoline glyphs on a 28-unit grid, sharing
 * the two shapes the design language already owns:
 *
 *  - the **ogee curve** from the Nusuk Help dome — the hotel arch, the Madinah
 *    dome, and the map pin, which is simply the arch turned point-down;
 *  - the **square-Kufic right angle** from the Al Haramain mark — the stepped
 *    route, the interlocking B2B brackets, the Kaaba's belt, the permit seal.
 *
 * Rules that keep them a set rather than twenty-four drawings:
 *
 *  - One stroke weight throughout (1.4 at 28 units, ≈1.4px at the 28px render
 *    size). No fills, no two-tone, no rounded caps — the brand is angular.
 *  - `currentColor`, so a glyph takes brass on light grounds and gilt on dark
 *    from its parent's text colour, and never carries a colour of its own.
 *  - Decorative in every current use: each sits beside a text label that
 *    already carries the meaning, so all of them are `aria-hidden`. If one is
 *    ever used alone, it needs a label at the call site.
 *
 * They are texture beneath the ogee arch, not a second signature — small,
 * quiet, and consistent.
 */

import type {
  B2bPillarId,
  ContactAudienceId,
  CoverageAreaId,
  ServiceId,
  WhyChooseUsId,
} from '@/content/services';

const STROKE = 1.4;

/**
 * The ogee arch scaled into the icon grid, point up. Shared by the hotel glyph
 * and (mirrored) by the map pin, so the set's two arch-derived glyphs are
 * provably the same curve rather than two similar ones.
 */
function ogeePath(x: number, y: number, w: number, h: number): string {
  const px = (n: number) => (x + (n / 100) * w).toFixed(2);
  const py = (n: number) => (y + (n / 132.15) * h).toFixed(2);
  return (
    `M${px(0)},${py(132.15)} L${px(0)},${py(76.65)} ` +
    `C${px(-6.82)},${py(55.5)} ${px(-2.27)},${py(31.72)} ${px(15.91)},${py(18.5)} ` +
    `C${px(31.82)},${py(9.25)} ${px(45.45)},${py(4.63)} ${px(50)},${py(0)} ` +
    `C${px(54.55)},${py(4.63)} ${px(68.18)},${py(9.25)} ${px(84.09)},${py(18.5)} ` +
    `C${px(102.27)},${py(31.72)} ${px(106.82)},${py(55.5)} ${px(100)},${py(76.65)} ` +
    `L${px(100)},${py(132.15)}`
  );
}

/**
 * Every id that owns a glyph, derived from the content types rather than
 * restated. `GLYPHS` below is a total `Record` over this union, so adding an
 * entry to `SERVICES`, `WHY_CHOOSE_US` or `COVERAGE_AREAS` without drawing its
 * glyph fails the build instead of rendering an empty square.
 *
 * This is why there is no `icon: 'hotel'` string on the content entries: the
 * id *is* the glyph name, so the two cannot drift and there is nothing to keep
 * in sync. If a glyph ever needs to be shared by two entries, that is the
 * moment to add the field.
 */
export type BrandIconName =
  | ServiceId
  | WhyChooseUsId
  | CoverageAreaId
  | B2bPillarId
  | ContactAudienceId;

/*
 * `groundHandling` is a member of both `ServiceId` and `B2bPillarId`. That is
 * the union collapsing two ids that mean the same thing onto one glyph, which
 * is correct — the service and the pillar describe the same capability.
 */

/** Every glyph's geometry, as children of a shared 0 0 28 28 viewBox. */
const GLYPHS: Record<BrandIconName, React.ReactNode> = {
  /* ---- Services ---------------------------------------------------------- */

  // Crescent over an ogee doorway.
  hotels: (
    <>
      <path d={ogeePath(7, 10, 14, 15)} />
      <path d="M4,25 H24" />
      <path d="M15.6,2.2 A3,3 0 1 0 15.6,8.2 A2.3,2.3 0 1 1 15.6,2.2 Z" />
    </>
  ),

  // Coach, side elevation. Square wheels would be unreadable; these are the
  // only circles in the set and they are the smallest shapes in it.
  transport: (
    <>
      <path d="M3,19 V10 H16 L20,14 H25 V19" />
      <path d="M3,14 H16" />
      <path d="M8,10 V14" />
      <circle cx="8" cy="21" r="2" />
      <circle cx="20" cy="21" r="2" />
      <path d="M6,21 H10 M18,21 H22" fill="none" />
    </>
  ),

  // High-speed nose, on a rail.
  rail: (
    <>
      <path d="M4,19 V11 H18 L24,15 V19 Z" />
      <path d="M4,15 H18" />
      <path d="M2,23 H26" />
      <path d="M8,19 V23 M20,19 V23" />
    </>
  ),

  // Minaret beside a dome — the ziyarat silhouette.
  ziyarat: (
    <>
      <path d="M6,25 V9 H10 V25" />
      <path d="M6,12 H10" />
      <path d="M8,9 V6" />
      <path d={ogeePath(14, 11, 10, 11)} />
      <path d="M13,25 H25" />
      <path d="M19,11 V8" />
    </>
  ),

  // A page with a square-Kufic seal. Assistance and guidance — never a stamp
  // of approval; the seal is deliberately abstract (Appendix A).
  permits: (
    <>
      <path d="M6,3 H18 L22,7 V25 H6 Z" />
      <path d="M18,3 V7 H22" />
      <path d="M9,12 H15 M9,16 H17" />
      <path d="M11,20 H17 V26 H11 Z M13,22 H15 V24 H13 Z" />
    </>
  ),

  // Stepped route between two Kufic squares — arrival to departure.
  groundHandling: (
    <>
      <path d="M3,5 H8 V10 H3 Z" />
      <path d="M20,18 H25 V23 H20 Z" />
      <path d="M5.5,10 V16 H14 V22 H20" />
      <path d="M14,16 H22.5 V18" />
    </>
  ),

  // Two interlocking square-Kufic brackets — the partnership mark.
  b2b: (
    <>
      <path d="M4,9 H14 V19" />
      <path d="M24,19 H14 V9" />
      <path d="M4,9 V5 M24,19 V23" />
    </>
  ),

  /* ---- Why choose us ----------------------------------------------------- */

  reliableService: (
    <>
      <path d="M14,3 L23,6.5 V14 C23,19.5 18.5,23.5 14,25 C9.5,23.5 5,19.5 5,14 V6.5 Z" />
      <path d="M10,14 L13,17 L18.5,11" />
    </>
  ),

  competitiveRates: (
    <>
      <path d="M4,15.5 L15.5,4 H24 V12.5 L12.5,24 Z" />
      <path d="M18,8 H21 V11 H18 Z" />
    </>
  ),

  fastResponse: (
    <>
      <circle cx="14" cy="14" r="10" />
      <path d="M14,8 V14 L18.5,16.5" />
    </>
  ),

  // The ogee arch inverted — the pin is the signature curve, point down.
  localExpertise: (
    <>
      <path
        d={ogeePath(7, 4, 14, 17)}
        transform="rotate(180 14 12.5)"
      />
      <path d="M11.5,10 H16.5 V15 H11.5 Z" />
    </>
  ),

  professionalCoordination: (
    <>
      <path d="M6,5 H22 V25 H6 Z" />
      <path d="M11,3 H17 V7 H11 Z" />
      <path d="M10,13 L12.5,15.5 L18,10" />
      <path d="M10,20 H18" />
    </>
  ),

  b2bSupport: (
    <>
      <path d="M5,17 V13 C5,8 9,4.5 14,4.5 C19,4.5 23,8 23,13 V17" />
      <path d="M3,16 H7 V23 H3 Z" />
      <path d="M21,16 H25 V23 H21 Z" />
    </>
  ),

  /* ---- Coverage ---------------------------------------------------------- */

  // Kaaba: the cube with its belt, squarely frontal, as in the AHR mark.
  makkah: (
    <>
      <path d="M6,8 H22 V25 H6 Z" />
      <path d="M6,13 H22" />
      <path d="M6,8 L9,5 H25 L22,8" />
      <path d="M25,5 V22 L22,25" />
      <path d="M13,18 H15 V25 H13 Z" />
    </>
  ),

  // The dome on its drum, with a finial — the ogee again.
  madinah: (
    <>
      <path d={ogeePath(8, 8, 12, 11)} />
      <path d="M6,19 H22 V25 H6 Z" />
      <path d="M14,8 V4" />
      <path d="M12,25 V21 H16 V25" />
    </>
  ),

  // Gateway city: the aircraft, reduced to a chevron and a fuselage.
  jeddah: (
    <>
      <path d="M14,3 V21" />
      <path d="M4,15 L14,9 L24,15" />
      <path d="M9.5,25 L14,21 L18.5,25" />
    </>
  ),

  // Compass rose on the Kufic diagonal — anywhere else in the Kingdom.
  elsewhere: (
    <>
      <path d="M14,3 L25,14 L14,25 L3,14 Z" />
      <path d="M9.5,18.5 L18.5,9.5" />
      <path d="M12,12 H16 V16 H12 Z" />
    </>
  ),

  /* ---- B2B pillars ------------------------------------------------------- */

  // A tag with a second outline behind it — one rate, many rooms.
  wholesaleRates: (
    <>
      <path d="M3,16 L13,6 H20 V13 L10,23 Z" />
      <path d="M16,4 H23 V11" />
      <path d="M15.5,9.5 H18.5 V12.5 H15.5 Z" />
    </>
  ),

  // Three arch-topped niches in a row — a block of rooms held together.
  groupReservations: (
    <>
      <path d={ogeePath(3, 9, 7, 9)} />
      <path d={ogeePath(10.5, 6, 7, 12)} />
      <path d={ogeePath(18, 9, 7, 9)} />
      <path d="M2,24 H26" />
    </>
  ),

  // An office on the ground: a block with an ogee door.
  localRepresentation: (
    <>
      <path d="M5,25 V7 H23 V25" />
      <path d="M2,25 H26" />
      <path d={ogeePath(11, 15, 6, 10)} />
      <path d="M8,11 H11 M8,15 H11 M17,11 H20 M17,15 H20" />
    </>
  ),

  // One named contact — a single figure, shoulders drawn on the ogee curve.
  dedicatedAgent: (
    <>
      <circle cx="14" cy="9" r="4" />
      <path d="M5,25 C5,18 9,15 14,15 C19,15 23,18 23,25" />
    </>
  ),

  // The confidential invoice (§10): a document whose amount line is empty.
  confidentialInvoicing: (
    <>
      <path d="M6,3 H22 V25 H6 Z" />
      <path d="M9,9 H15 M9,13 H19" />
      <path d="M9,18 H19 V22 H9 Z" />
      <path d="M12,20 H16" />
    </>
  ),

  /* ---- Contact audiences ------------------------------------------------- */

  // A traveller beneath the arch.
  pilgrims: (
    <>
      <path d={ogeePath(4, 3, 20, 22)} />
      <circle cx="14" cy="12" r="2.6" />
      <path d="M9.5,25 C9.5,20.5 11.5,18.5 14,18.5 C16.5,18.5 18.5,20.5 18.5,25" />
    </>
  ),

  // The agency: a case with a Kufic clasp.
  agencies: (
    <>
      <path d="M3,9 H25 V23 H3 Z" />
      <path d="M10,9 V5 H18 V9" />
      <path d="M12,14 H16 V18 H12 Z" />
      <path d="M3,14 H12 M16,14 H25" />
    </>
  ),
};

/**
 * Renders a brand glyph. Decorative by default — see the module note.
 *
 * `size` is a Tailwind class rather than a number so the icon scales with the
 * surface it sits on (28px on cards, 24px inside the compact feature band).
 */
export function BrandIcon({
  name,
  className = 'h-7 w-7',
}: {
  name: BrandIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      vectorEffect="non-scaling-stroke"
      className={className}
    >
      {GLYPHS[name]}
    </svg>
  );
}
