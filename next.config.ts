import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  eslint: {
    // Lint is run explicitly via `npm run lint`; keep builds focused on compiling.
    ignoreDuringBuilds: false,
  },
};

export default withNextIntl(nextConfig);

// Gives `next dev` access to the Cloudflare bindings declared in wrangler.jsonc
// (DB, NEXT_INC_CACHE_KV, BACKUPS) through getCloudflareContext().
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
void initOpenNextCloudflareForDev();
