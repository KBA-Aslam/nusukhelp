import type { ReactNode } from 'react';

import { useTranslations } from 'next-intl';

import { Bidi } from '@/components/ui/bidi';
import { CONTAINER } from '@/components/ui/section';
import type { LegalSection } from '@/content/legal';
import { LEGAL_UPDATED } from '@/content/legal';
import { formatDate } from '@/lib/format';
import { EMAIL, PHONE_DISPLAY } from '@/lib/site';

/**
 * Values every section body and bullet is rendered with.
 *
 * Both documents end by telling the reader where to write, and neither hard-
 * codes the address into its copy: §19 items 3 and 4 will replace the company's
 * contact details, and a legal page that still quotes the old number after that
 * is a worse failure than a stale marketing line. next-intl ignores values a
 * message does not use, so passing them everywhere costs nothing.
 */
const CONTACT_VALUES = { email: EMAIL, phone: PHONE_DISPLAY } as const;

/**
 * `/privacy` and `/terms` — one renderer, two documents (§4).
 *
 * Legal text is the one place on this site where the reader is scanning for a
 * clause rather than being sold to, so the treatment is deliberately plain:
 * a single measured column, numbered headings they can cite back at us, and no
 * ornament at all — no arch, no lattice, no icons. Everything the rest of the
 * site does to hold attention would be noise here.
 *
 * The section numbers are rendered from the array index, not written into the
 * copy. A translator reordering or a section landing in the middle would
 * otherwise leave the numbering stale in one language and not the other.
 */
export function LegalArticle({
  namespace,
  locale,
  sections,
  appendix,
}: {
  /** `privacy` or `terms` — the message namespace holding the copy. */
  namespace: string;
  locale: string;
  sections: readonly LegalSection[];
  /**
   * Extra content rendered after a named section's body.
   *
   * One caller uses it: `/terms` renders the affiliation disclaimer inside its
   * independence section from `footer.disclaimer`, the same string the footer
   * and the consultation block read. It is passed in rather than restated as a
   * `terms.*` key so the legally reviewed wording (§19 item 1) can never be
   * updated in one place and missed in the other.
   */
  appendix?: Readonly<Record<string, ReactNode>>;
}) {
  const t = useTranslations(namespace);
  const tLegal = useTranslations('legal');

  return (
    <div className={`${CONTAINER} py-14 lg:py-20`}>
      <article className="max-w-3xl">
        <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
          <Bidi>{t('eyebrow')}</Bidi>
        </p>

        <h1 className="mt-5 font-display text-[1.875rem] leading-[1.15] text-ink sm:text-[2.5rem]">
          <Bidi>{t('title')}</Bidi>
        </h1>

        <p className="mt-5 text-sm text-muted">
          <Bidi>
            {tLegal('lastUpdated', {
              date: formatDate(LEGAL_UPDATED, locale),
            })}
          </Bidi>
        </p>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate">
          <Bidi>{t('lead')}</Bidi>
        </p>

        <hr className="mt-10 border-0 border-t border-hairline" />

        <ol className="mt-10 space-y-10">
          {sections.map((section, index) => (
            <li key={section.id}>
              <h2 className="font-display text-xl text-ink sm:text-[1.375rem]">
                {/* The number is decoration for a screen reader — the heading
                    text carries the meaning, and "1." read aloud before every
                    title is noise. */}
                <span aria-hidden="true" className="me-3 text-brass-ink">
                  {index + 1}.
                </span>
                <Bidi>{t(`sections.${section.id}.title`)}</Bidi>
              </h2>

              <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate">
                <Bidi>
                  {t(`sections.${section.id}.body`, CONTACT_VALUES)}
                </Bidi>
              </p>

              {section.bullets ? (
                <ul className="mt-4 space-y-2 text-[0.9375rem] leading-relaxed text-slate">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2.5">
                      <span aria-hidden="true" className="text-brass">
                        —
                      </span>
                      <Bidi>
                        {t(
                          `sections.${section.id}.bullets.${bullet}`,
                          CONTACT_VALUES,
                        )}
                      </Bidi>
                    </li>
                  ))}
                </ul>
              ) : null}

              {appendix?.[section.id] ? (
                <div className="mt-4 border-s-2 border-brass ps-5 text-[0.9375rem] leading-relaxed text-slate">
                  {appendix[section.id]}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}
