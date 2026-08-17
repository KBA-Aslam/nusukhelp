import type { ReactNode } from 'react';

import { Bidi } from '@/components/ui/bidi';

/**
 * The landing page's band system.
 *
 * §5 is a stack of full-width bands, and the prototype alternates their grounds
 * — sand, sand, pine, sand, mist, sand, pine, ink, sand — so no two adjacent
 * sections read as one. `tone` is the only knob: it fixes the ground, the
 * heading colour, the body colour and, importantly, the eyebrow colour.
 *
 * **Eyebrow colour is not a free choice.** §7 requires `--brass-ink` for
 * eyebrows because plain `--brass` is 2.9:1 on sand and fails AA. That
 * correction is about brass *on light*: on the ink and pine bands the same
 * value would be 1.9:1 — worse than the bug it fixes — so dark bands take
 * `--gilt`, which §7 measures at 7.8:1 on ink and explicitly exempts. Both are
 * encoded here so no section has to decide.
 */

export type Tone = 'sand' | 'mist' | 'ink' | 'pine';

const GROUND: Record<Tone, string> = {
  sand: 'bg-sand',
  mist: 'bg-mist',
  ink: 'bg-ink',
  pine: 'bg-pine',
};

const EYEBROW: Record<Tone, string> = {
  sand: 'text-brass-ink',
  mist: 'text-brass-ink',
  ink: 'text-gilt',
  pine: 'text-gilt',
};

const HEADING: Record<Tone, string> = {
  sand: 'text-ink',
  mist: 'text-ink',
  ink: 'text-white',
  pine: 'text-white',
};

const BODY: Record<Tone, string> = {
  sand: 'text-slate',
  mist: 'text-slate',
  ink: 'text-onink',
  pine: 'text-onink',
};

export const toneClasses = { GROUND, EYEBROW, HEADING, BODY };

/** Shared page gutter — matches the header and footer so bands align. */
export const CONTAINER = 'mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12';

export function Section({
  tone,
  id,
  labelledBy,
  children,
  className = '',
}: {
  tone: Tone;
  id?: string;
  labelledBy?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`${GROUND[tone]} ${className}`}
    >
      <div className={`${CONTAINER} py-14 lg:py-20`}>{children}</div>
    </section>
  );
}

/**
 * Eyebrow + display heading + optional intro, with an optional end-aligned
 * action (the reviews band puts *Leave a review* on the heading row).
 *
 * The eyebrow is uppercased in CSS rather than in the message value: Arabic has
 * no case, so `text-transform` is inert on `/ar` while an upper-cased English
 * string in the catalogue would have to be re-cased by a translator.
 */
export function SectionHeading({
  tone,
  id,
  eyebrow,
  heading,
  intro,
  action,
}: {
  tone: Tone;
  id: string;
  eyebrow: string;
  heading: ReactNode;
  intro?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
      <div className="max-w-2xl">
        <p
          className={`font-sans text-[0.6875rem] font-semibold tracking-[0.24em] uppercase ${EYEBROW[tone]}`}
        >
          <Bidi>{eyebrow}</Bidi>
        </p>
        <h2
          id={id}
          className={`mt-4 font-display text-[1.75rem] leading-[1.2] sm:text-[2.125rem] ${HEADING[tone]}`}
        >
          <Bidi>{heading}</Bidi>
        </h2>
        {intro ? (
          <p className={`mt-4 text-base leading-relaxed ${BODY[tone]}`}>
            <Bidi>{intro}</Bidi>
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * The short brass rule that leads every card and point on this page.
 *
 * This is the page's answer to §5's "icon-led": the prototype draws no icons,
 * it draws a 58px hairline across the top-start corner of each card and a 34px
 * rule above each why-choose-us point. Decorative, so it is never the only
 * thing distinguishing one item from another.
 */
export function LeadRule({
  tone,
  width = 'w-14',
}: {
  tone: Tone;
  width?: string;
}) {
  const colour = tone === 'ink' || tone === 'pine' ? 'bg-gilt' : 'bg-brass';
  return <span aria-hidden="true" className={`block h-px ${width} ${colour}`} />;
}
