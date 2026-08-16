import type { ReactNode } from 'react';

/**
 * Bidirectional isolation for a run of text.
 *
 * Wrap **every piece of user-visible copy** rendered inside the public locale
 * tree in this. It is a no-op on `/en` and on Arabic text; it is load-bearing
 * for Latin text sitting inside the RTL page.
 *
 * ## The bug it fixes
 *
 * A `<p>` inside `<html dir="rtl">` establishes a bidi paragraph with an RTL
 * base direction. English text inside it forms strong left-to-right runs, but a
 * sentence-final full stop is a *neutral* — and the Unicode Bidirectional
 * Algorithm resolves neutrals at the end of a paragraph to the paragraph's
 * embedding level rather than to the run beside them. The period takes RTL and
 * is placed at the far left, so the line reads:
 *
 *     .complete ground handling across Saudi Arabia
 *
 * `<bdi>` makes the run its own isolated paragraph. `dir="auto"` resolves that
 * paragraph's direction from its first strong character, so English resolves
 * LTR and keeps its punctuation, while Arabic resolves RTL and behaves exactly
 * as it would with no wrapper at all. The surrounding page stays RTL, so
 * alignment and flow remain honest and testable.
 *
 * ## Why not CSS on the existing element
 *
 * `unicode-bidi: isolate` applied to the block itself does nothing — a block
 * already establishes its own bidi paragraph, so there is no outer context to
 * isolate it from. The wrapper must be inline, around the run. `direction: ltr`
 * or `unicode-bidi: plaintext` on the paragraph would fix the punctuation but
 * flip the base direction, left-aligning English copy inside a right-aligned
 * page — which hides the alignment bugs `/ar` exists to surface.
 *
 * ## This is permanent
 *
 * Not a scaffold to remove when the Arabic translation lands (§19 open item 5).
 * Real Arabic copy still embeds Latin islands that always need isolating: the
 * brand names, "B2B", `+966 57 679 9128` — whose leading `+` is a neutral and
 * migrates to the wrong end without this — email addresses, and later booking
 * numbers like `AHR-2026-00041` on the admin side.
 */
export function Bidi({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <bdi dir="auto" className={className}>
      {children}
    </bdi>
  );
}
