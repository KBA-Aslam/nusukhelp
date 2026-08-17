import type { ReactNode } from 'react';

import { Bidi } from '@/components/ui/bidi';
import { CONTAINER } from '@/components/ui/section';

/**
 * The band that closes a detail page (§4).
 *
 * Every one of the Phase 5 pages ends by asking for the same thing — a message
 * — so they end with the same band rather than three inventions of it. It is a
 * `<Section tone="ink">` in everything but name; it is its own component only
 * because the centred, narrow measure is what makes a closing ask read as an
 * ask rather than as one more section of content.
 *
 * The affiliation disclaimer is **not** repeated here. It already renders in
 * the footer immediately below, and §7 asks for it sitewide and in the
 * consultation block, not after every CTA — printing it twice within one screen
 * would train a reader to stop seeing it.
 */
export function ClosingCta({
  eyebrow,
  heading,
  body,
  actions,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  actions: ReactNode;
}) {
  return (
    <section className="bg-ink" aria-labelledby="closing-heading">
      <div className={`${CONTAINER} py-14 lg:py-20`}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-gilt uppercase">
            <Bidi>{eyebrow}</Bidi>
          </p>

          <h2
            id="closing-heading"
            className="mt-5 font-display text-[1.75rem] leading-[1.2] text-white sm:text-[2.25rem]"
          >
            <Bidi>{heading}</Bidi>
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-onink">
            <Bidi>{body}</Bidi>
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            {actions}
          </div>
        </div>
      </div>
    </section>
  );
}
