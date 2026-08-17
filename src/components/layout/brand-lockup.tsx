import Image from 'next/image';

import { Bidi } from '@/components/ui/bidi';
import { Link } from '@/i18n/navigation';
import { LOGO } from '@/lib/site';

type Tone = 'light' | 'dark';

type Props = {
  /** `light` = on the sand page ground (header). `dark` = on ink (footer). */
  tone: Tone;
  /** Accessible name for the link or, when unlinked, the image. */
  label: string;
  eyebrow?: string;
  /** Wraps the lockup in a link to the locale home. Off in the footer. */
  href?: string;
};

/**
 * The Nusuk Help lockup: mark, wordmark, optional eyebrow.
 *
 * Parent mark only. §7 makes logo placement enforced rather than advisory, and
 * the division mark never appears in the site header — so this component has no
 * prop that could produce one. Reaching for Al Haramain means reaching for a
 * different component, which is the point.
 *
 * The marks are raster (§7, asset note): PNG inside the supplied SVG wrappers,
 * cleaned to transparency. They are rendered well below native size — ~1770px
 * wide artwork drawn at 40–54px — so they stay crisp on 2x and 3x screens.
 * `unoptimized` keeps them out of the image pipeline entirely, which is not yet
 * configured for Workers; at this size the optimiser has nothing to win.
 *
 * ## Retuned in Phase 4c, when the English wordmark left the artwork
 *
 * The mark used to carry "NUSUK HELP" inside the image, under the dome. With
 * that text gone the dome fills the whole box, so at an unchanged box height it
 * renders visibly larger and crowds the Latin wordmark set beside it. Two
 * adjustments, both optical rather than arbitrary:
 *
 *  - the box is a little shorter, so the *dome* stays about the size it was
 *    when it shared the box with a line of type;
 *  - the gap widens, because the mark's own type no longer sits between the
 *    dome and the wordmark to do that spacing.
 *
 * The intrinsic dimensions come from `LOGO` — they changed with the redraw
 * (1770×1847, not 1835×2059) and a stale pair reserves the wrong space and
 * shifts the header as the image decodes.
 */
export function BrandLockup({ tone, label, eyebrow, href }: Props) {
  const onDark = tone === 'dark';
  const mark = onDark ? LOGO.nusukOnDark : LOGO.nusukOnLight;

  const inner = (
    <>
      <Image
        src={mark.src}
        alt=""
        width={mark.width}
        height={mark.height}
        priority={!onDark}
        unoptimized
        className={onDark ? 'h-[3.4rem] w-auto' : 'h-10 w-auto sm:h-12'}
      />
      <span className="flex flex-col justify-center">
        <span
          className={[
            'font-sans font-bold tracking-[0.15em]',
            onDark ? 'text-[0.9375rem] text-white' : 'text-xs sm:text-[0.9375rem]',
            onDark ? '' : 'text-ink',
          ].join(' ')}
        >
          {/* The wordmark stays Latin in both locales — it is the mark, not
              copy — so it is a permanent LTR island on `/ar`. */}
          <Bidi>NUSUK HELP</Bidi>
        </span>
        {eyebrow ? (
          <span
            className={[
              'mt-0.5 font-sans tracking-[0.11em]',
              onDark
                ? 'text-[0.8125rem] text-onink-muted'
                : 'text-[0.5625rem] text-brass-ink sm:text-[0.65625rem]',
            ].join(' ')}
          >
            <Bidi>{eyebrow}</Bidi>
          </span>
        ) : null}
      </span>
    </>
  );

  if (!href) {
    /*
     * No `aria-label` on this branch. A plain `<div>` maps to the `generic`
     * role, which ARIA does not allow to be labelled — support is inconsistent
     * and, where it works, the label duplicates the "NUSUK HELP" wordmark that
     * is already rendered as text inside. The unlinked lockup is the footer's,
     * and the footer already names the company in its own landmark label.
     *
     * The linked branch below keeps its label: that one is a link, the label is
     * its accessible name ("Nusuk Help — home"), and a link needs one.
     */
    return <div className="flex items-center gap-4">{inner}</div>;
  }

  return (
    <Link
      href={href}
      aria-label={label}
      // min-h-11 keeps the linked lockup on the 44px tap-target floor (§20).
      // The shorter mark after the Phase 4c redraw left it at 40px.
      className="flex min-h-11 items-center gap-4 rounded-[2px]"
    >
      {inner}
    </Link>
  );
}
