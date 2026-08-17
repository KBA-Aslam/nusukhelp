/**
 * The ogee arch — the site's one signature device (§7).
 *
 * Traced from the dome in the Nusuk Help mark; the geometry below is the exact
 * path out of `prototype/02-landing-desktop.svg`, normalised so it can be drawn
 * at any size.
 *
 * **Placement is closed, not open.** §7: the arch masks the hero panel and
 * outlines the two-division cards — *and appears nowhere else*. Everything
 * around it stays flat: hairline rules, 2px radius, no shadows. Two extra uses
 * in the prototypes were deliberately not built (a filled arch as the coverage
 * card icon, and a repeating arch arcade behind the consultation band); see the
 * Phase 4 note in §7 of the spec. If a third surface ever wants an arch, that is
 * a conversation about the design language, not a component change.
 *
 * The arch is symmetric about its vertical axis, so it needs no RTL mirroring.
 */

/**
 * The hero panel arch in `objectBoundingBox` units — fractions of the masked
 * element's own box, which is why `HERO_PANEL_ASPECT` below is not optional.
 *
 * The prototype's hero panel is a 430 × 500 rectangle carrying an arch that
 * spans 378.4 of its 430 width. That 26px of slack on each side is deliberate:
 * the ogee's shoulders bulge outward past the springing line, and a box drawn
 * tight to the arch would clip them flat, since an element's background only
 * paints inside its border box no matter how far the clip region extends. The
 * path below is normalised to the *padded* box, so every coordinate lands
 * inside 0–1 and the shoulders survive.
 */
const ARCH_CLIP_PATH =
  'M0.06,1 L0.06,0.58 C0,0.42 0.04,0.24 0.20,0.14 ' +
  'C0.34,0.07 0.46,0.035 0.50,0 ' +
  'C0.54,0.035 0.66,0.07 0.80,0.14 ' +
  'C0.96,0.24 1,0.42 0.94,0.58 L0.94,1 Z';

/** The aspect ratio the clip path was normalised against. */
export const HERO_PANEL_ASPECT = 'aspect-[430/500]';

/**
 * The same padded arch in a 100 × 116.28 viewBox, stroked over the masked
 * panel with `preserveAspectRatio="none"` so it lands exactly on the clip edge.
 */
const ARCH_PANEL_OUTLINE_PATH =
  'M6,116.28 L6,67.44 C0,48.84 4,27.91 20,16.28 ' +
  'C34,8.14 46,4.07 50,0 ' +
  'C54,4.07 66,8.14 80,16.28 ' +
  'C96,27.91 100,48.84 94,67.44 L94,116.28 Z';

/**
 * The arch drawn tight, for the two-division cards, where it is a small
 * standalone ornament rather than a mask edge. Height is 132.15 because the
 * source arch is 378.4 × 500; the viewBox starts at −4 so the shoulders and the
 * stroke's outer edge are not clipped.
 */
const ARCH_OUTLINE_PATH =
  'M0,132.15 L0,76.65 C-6.82,55.5 -2.27,31.72 15.91,18.5 ' +
  'C31.82,9.25 45.45,4.63 50,0 ' +
  'C54.55,4.63 68.18,9.25 84.09,18.5 ' +
  'C102.27,31.72 106.82,55.5 100,76.65 L100,132.15 Z';

const CLIP_ID = 'ogee-arch-clip';

/**
 * The clip path definition. Render **once** per page, anywhere — `OgeeArchMask`
 * below references it by id. It draws nothing itself.
 */
export function OgeeArchClipDefs() {
  return (
    <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
      <defs>
        <clipPath id={CLIP_ID} clipPathUnits="objectBoundingBox">
          <path d={ARCH_CLIP_PATH} />
        </clipPath>
      </defs>
    </svg>
  );
}

/**
 * Masks its children to the arch. Used for the hero panel only.
 *
 * Requires `OgeeArchClipDefs` somewhere in the same document, and an element
 * kept at `HERO_PANEL_ASPECT`.
 */
export function OgeeArchMask({
  children,
  className,
}: {
  /** Optional: with photography still open (§19 item 6) the panel is an
      empty colour block, and the mask is the only thing shaping it. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} style={{ clipPath: `url(#${CLIP_ID})` }}>
      {children}
    </div>
  );
}

/**
 * The hairline that traces the masked hero panel's edge, in gilt.
 * Stretches with the panel, so it must sit on a box of the same aspect.
 */
export function OgeeArchPanelOutline({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 116.28"
      preserveAspectRatio="none"
      fill="none"
      className={className}
    >
      <path
        d={ARCH_PANEL_OUTLINE_PATH}
        stroke="var(--color-gilt)"
        strokeWidth={1.4}
        opacity={0.65}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * The arch as a hairline outline. Used on the two-division cards only.
 *
 * Decorative — `aria-hidden`, and it must never be the only thing carrying a
 * meaning.
 */
export function OgeeArchOutline({
  className,
  stroke,
  strokeWidth = 1.2,
  opacity = 0.55,
}: {
  className?: string;
  /** Brass on the light card, gilt on the ink card — as the prototype sets it. */
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="-4 -1 108 134"
      fill="none"
      className={className}
    >
      <path
        d={ARCH_OUTLINE_PATH}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Square-Kufic corner brackets, taken from the Al Haramain mark (§7) — "a
 * whisper, not a second signature". The prototype puts them on the two-division
 * cards at low opacity, one per corner.
 *
 * Not the arch, so the arch's placement rule does not apply; but the same
 * restraint does. Absolutely positioned by the caller.
 */
export function KuficCorners({ stroke }: { stroke: string }) {
  return (
    <span aria-hidden="true">
      {(
        [
          ['start-3 top-3', 'M1,13 L1,1 L13,1'],
          ['end-3 top-3', 'M1,1 L13,1 L13,13'],
          ['end-3 bottom-3', 'M13,1 L13,13 L1,13'],
          ['start-3 bottom-3', 'M13,13 L1,13 L1,1'],
        ] as const
      ).map(([position, d]) => (
        <svg
          key={position}
          viewBox="0 0 14 14"
          fill="none"
          // The bracket glyph is directional, so it mirrors with its position
          // on `/ar` (§6) — otherwise a top-left bracket lands top-right.
          className={`pointer-events-none absolute h-3.5 w-3.5 rtl:-scale-x-100 ${position}`}
        >
          <path d={d} stroke={stroke} strokeWidth={1.4} opacity={0.45} />
        </svg>
      ))}
    </span>
  );
}
