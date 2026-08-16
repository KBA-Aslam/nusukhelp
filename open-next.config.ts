import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache';

// Public pages are statically generated and cache-served from Cloudflare's edge.
// On-demand revalidation (e.g. approving a review, §13.11) needs somewhere to
// write the regenerated page, which is the NEXT_INC_CACHE_KV namespace.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
