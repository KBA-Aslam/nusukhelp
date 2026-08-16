import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

/**
 * Locale-scoped 404.
 *
 * It renders inside the locale layout, so it keeps the header, the footer and
 * the affiliation disclaimer. Until Phases 4 and 5 fill in the rest of the
 * route map, this is what the header's nav links resolve to — which is the
 * intended state of a shell phase, not a broken link.
 */
export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <div className="mx-auto max-w-[90rem] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
      <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
        {t('eyebrow')}
      </p>
      <h1 className="mt-5 font-display text-3xl text-ink sm:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-4 max-w-xl text-base text-slate">{t('body')}</p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center rounded-[2px] border border-brass px-6 text-sm font-medium text-pine transition-colors hover:bg-mist"
      >
        {t('backHome')}
      </Link>
    </div>
  );
}
