import type { ReactNode } from 'react';

import Image from 'next/image';

import { Bidi } from '@/components/ui/bidi';
import { CONTAINER } from '@/components/ui/section';

/**
 * The opening band of every Phase 5 detail page (§4).
 *
 * One component rather than six near-identical headers, because the thing that
 * varies between them is content — eyebrow, `<h1>`, lead, actions — and the
 * thing that must not vary is the type scale and the ink ground that tells a
 * reader they have arrived somewhere new. The landing page keeps its own `Hero`:
 * it carries the photograph and the arch mask, which is a different component,
 * not a variant of this one.
 *
 * `mark` is the escape hatch for exactly one page. §7 makes logo placement
 * enforced: the Al Haramain mark may appear on the public site in the footer
 * division line and in the body of `/al-haramain-reservation` — nowhere else,
 * and never in the header. So it is passed in by that page rather than derived
 * from a route, which would invite a second caller.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  mark,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  actions?: ReactNode;
  mark?: { src: string; width: number; height: number; alt: string };
}) {
  return (
    <section className="bg-ink" aria-labelledby="page-title">
      <div className={`${CONTAINER} py-14 lg:py-20`}>
        <div className="max-w-3xl">
          {mark ? (
            /* The tile's own ground is within a shade of `--ink`, so it seats
               into the band rather than sitting on it as a sticker. The gilt
               hairline is what gives it an edge — the same rule weight the rest
               of the site uses, per §7's "everything stays flat". */
            <Image
              src={mark.src}
              alt={mark.alt}
              width={mark.width}
              height={mark.height}
              unoptimized
              priority
              className="mb-9 h-24 w-auto rounded-[2px] border border-gilt/30 sm:h-28"
            />
          ) : null}

          <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-gilt uppercase">
            <Bidi>{eyebrow}</Bidi>
          </p>

          <h1
            id="page-title"
            className="mt-6 font-display text-[2rem] leading-[1.14] text-white sm:text-[2.75rem] lg:text-[3.25rem]"
          >
            <Bidi>{title}</Bidi>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-onink lg:text-[1.0625rem]">
            <Bidi>{lead}</Bidi>
          </p>

          {actions ? (
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
