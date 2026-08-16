import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

/**
 * Landing page — Phase 3 placeholder.
 *
 * Phase 4 replaces this body with the nine sections in §5, built off
 * `content/services.ts`. What ships here is only enough copy to prove the shell
 * works: the header, the footer, the type stack and the RTL flip all have
 * something to sit around.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Required in every page of a statically rendered locale tree, not just the
  // layout — without it the page opts into dynamic rendering on first use of a
  // translation, and the whole route falls out of the static build.
  setRequestLocale(locale);

  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations('home');

  return (
    <div className="mx-auto max-w-[90rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
        {t('eyebrow')}
      </p>
      <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.15] text-ink sm:text-5xl lg:text-6xl">
        {t('title')}
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate sm:text-lg">
        {t('body')}
      </p>
    </div>
  );
}
