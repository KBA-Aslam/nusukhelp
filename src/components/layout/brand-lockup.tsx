import Image from 'next/image';

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
 * cleaned to transparency. They are rendered well below native size — 1835px
 * wide artwork drawn at 40–54px — so they stay crisp on 2x and 3x screens.
 * `unoptimized` keeps them out of the image pipeline entirely, which is not yet
 * configured for Workers; at this size the optimiser has nothing to win.
 */
export function BrandLockup({ tone, label, eyebrow, href }: Props) {
  const onDark = tone === 'dark';

  const inner = (
    <>
      <Image
        src={onDark ? LOGO.nusukOnDark : LOGO.nusukOnLight}
        alt=""
        width={1835}
        height={2059}
        priority={!onDark}
        unoptimized
        className={onDark ? 'h-[3.9rem] w-auto' : 'h-11 w-auto sm:h-[3.4rem]'}
      />
      <span className="flex flex-col justify-center">
        <span
          className={[
            'font-sans font-bold tracking-[0.15em]',
            onDark ? 'text-[0.9375rem] text-white' : 'text-xs sm:text-[0.9375rem]',
            onDark ? '' : 'text-ink',
          ].join(' ')}
        >
          NUSUK HELP
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
            {eyebrow}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!href) {
    return (
      <div className="flex items-center gap-3" aria-label={label}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="flex items-center gap-3 rounded-[2px]"
    >
      {inner}
    </Link>
  );
}
