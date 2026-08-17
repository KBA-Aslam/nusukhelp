/**
 * The square-Kufic lattice — the second permitted texture (§7, Phase 4b).
 *
 * Derived from the Al Haramain mark, not from stock arabesque: the mark sets
 * الحرمين as square Kufic on a grid, all strokes at one weight and every turn a
 * right angle. The tile repeats that vocabulary — an interlocking meander that
 * carries across tile edges, a square frame, a square centre — and nothing else.
 * No curves, no diagonals, no floral forms.
 *
 * ## Permitted surfaces
 *
 * Behind the free-consultation block (gilt on pine) and behind the coverage
 * section (brass on sand). A third, **temporary** surface was added by
 * decision: gilt at 0.14 inside the hero arch mask, so the empty photography
 * placeholder reads as intentional rather than unfinished. It comes out when
 * the photograph lands (§19 item 6). Anywhere else still needs a decision, not
 * a commit.
 *
 * No text sits over any of the three, which is what the measurements below
 * forced.
 *
 * ## Contrast — measured, and it changed the design
 *
 * Every text colour that could sit over these grounds was measured against the
 * ground *as the pattern leaves it* (pattern ink composited over the base at
 * the tile's opacity — the worst case, directly on a stroke):
 *
 * | Text | Ground | Clean | Over pattern @ 0.06 |
 * |---|---|---|---|
 * | `--ink` heading | sand | 14.47 | 13.75 |
 * | `--slate` body | sand | 7.33 | 6.96 |
 * | **`--brass-ink` eyebrow** | **sand** | **4.68** | **4.44 — fails AA** |
 * | white heading | pine | 12.47 | 11.26 |
 * | `--gilt` eyebrow | pine | 6.25 | 5.64 |
 * | `--onink` body | pine | 7.24 | 6.54 |
 *
 * One row fails. `--brass-ink` on sand is 4.68:1 — it clears the 4.5:1 AA
 * threshold by 0.18, and *any* pattern under it spends more than that. Lowering
 * the opacity until it passes would leave the pattern invisible and the margin
 * inside rounding error.
 *
 * So the pattern does not go under text. On the coverage band the heading block
 * carries its own opaque `bg-sand`, and the cards are opaque white; the lattice
 * shows in the space around them. On the consultation band the panel is opaque
 * `--panel-deep`. Every string on both sections therefore sits on a clean,
 * unpatterned ground, and the table above is the evidence, not a reassurance.
 *
 * If a future section wants text directly over the lattice, it needs a darker
 * eyebrow token — a decision for §7, not a local override.
 */

const TILE = 48;

/**
 * The meander crosses tile boundaries at the edge midpoints: the first path
 * leaves at (24,0) and (0,24), the second arrives at (24,48) and (48,24). That
 * is what makes the repeat continuous rather than a grid of separate stamps.
 */
const TILE_PATHS = [
  'M0,24 H24 V0',
  'M24,48 V24 H48',
  'M14,14 H34 V34 H14 Z',
  'M22,22 H26 V26 H22 Z',
];

export function KuficPattern({
  id,
  ink,
  opacity,
  className = '',
}: {
  /** Unique per page — the SVG pattern is referenced by id. */
  id: string;
  /** A CSS colour. Gilt on the pine band, brass on the sand band. */
  ink: string;
  opacity: number;
  className?: string;
}) {
  const patternId = `kufic-${id}`;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <defs>
        <pattern
          id={patternId}
          width={TILE}
          height={TILE}
          patternUnits="userSpaceOnUse"
        >
          <g
            fill="none"
            stroke={ink}
            strokeWidth={1}
            strokeOpacity={opacity}
            strokeLinecap="butt"
            strokeLinejoin="miter"
          >
            {TILE_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
