import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

/**
 * Per-request i18n configuration.
 *
 * `timeZone` is pinned to Asia/Riyadh for every locale. The company operates in
 * Saudi Arabia and every date on the site — and later every check-in date on an
 * invoice — is a Saudi date. Letting it default to the server's zone would put
 * a Worker in another region a day out at the edges of the day.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    timeZone: 'Asia/Riyadh',
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
