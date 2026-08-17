import type { MetadataRoute } from 'next';

/**
 * Web app manifest, served at `/manifest.webmanifest` and linked automatically
 * by the metadata API.
 *
 * The icons are the Nusuk Help **symbol only** — the dome and its calligraphy,
 * with no wordmark. At 16px a wordmark is a smudge, and the artwork no longer
 * carries one anyway since the Phase 4c redraw.
 *
 * `background_color` is `--sand`, not white: the splash screen and the icon
 * tile should read as the same warm off-white the page ground uses, and pure
 * white against `--sand` is visibly cold. `theme_color` is `--ink`, matching the
 * header band the browser chrome sits above.
 *
 * Two 512s on purpose. The `maskable` one carries a wider safe-zone margin,
 * because Android crops maskable icons to whatever shape the launcher wants —
 * a circle on most devices — and the dome's finial is the first thing to lose.
 * The `any` icons stay transparent so they sit on the host surface's own
 * background; only the maskable and Apple icons are filled, since neither
 * supports transparency usefully.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nusuk Help',
    short_name: 'Nusuk Help',
    description:
      'Hajj and Umrah guidance, permit assistance, ziyarat, hotels, transport and complete ground handling across Saudi Arabia.',
    start_url: '/en',
    display: 'standalone',
    background_color: '#FAF7F1',
    theme_color: '#0C2923',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
