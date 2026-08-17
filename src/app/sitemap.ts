import type { MetadataRoute } from 'next';

import { localeHtmlLang, routing } from '@/i18n/routing';
import { localeUrl } from '@/lib/metadata';
import { PUBLIC_ROUTES } from '@/lib/public-routes';

/**
 * `sitemap.xml` — both locales (§17).
 *
 * Every route appears once per locale, and each entry carries the `alternates`
 * block Next renders as `xhtml:link rel="alternate" hreflang="…"`. That is the
 * same set of alternates each page emits in its `<head>` (see
 * `lib/metadata.ts`), and Google wants the two to agree — a page claiming an
 * Arabic alternate that the sitemap does not is a conflict it resolves by
 * ignoring both.
 *
 * `x-default` is included here for the same reason it is included in the head:
 * an unprefixed request lands on `/en` (`localeDetection` is off, §6), so the
 * English page is the honest default rather than a language selector.
 *
 * ## No `lastModified`
 *
 * Deliberate. The honest value is the last edit to a page's copy, and nothing
 * in this repo tracks that per route — a build timestamp would tell Google
 * every page changed every deploy, which is how a site teaches a crawler to
 * stop believing its own sitemap. Omitted is better than fabricated.
 *
 * The file is outside `[locale]` because it is one document for the whole site,
 * not a per-locale page — which is also why the middleware matcher, which
 * excludes anything with a file extension, leaves it alone.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.flatMap((locale) =>
    PUBLIC_ROUTES.map((route) => ({
      url: localeUrl(locale, route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          ...Object.fromEntries(
            routing.locales.map((other) => [
              localeHtmlLang[other],
              localeUrl(other, route.path),
            ]),
          ),
          'x-default': localeUrl(routing.defaultLocale, route.path),
        },
      },
    })),
  );
}
