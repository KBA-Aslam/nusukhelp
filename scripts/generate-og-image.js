/**
 * Generates the Open Graph card — `public/og/nusuk-help.png`, 1200×630 (§17).
 *
 *     node scripts/generate-og-image.js
 *
 * **A one-off, not a build step.** The card is a committed static asset, so
 * nothing at request time renders it and the Worker never pays for it. The
 * alternative — `next/og` at request time — pulls a WASM renderer into a
 * Worker with an 8ms free-plan CPU budget (§2), for an image whose content
 * changes only when the brand does.
 *
 * The script is committed because the card cannot be re-derived from the repo
 * without it: the composition (crop anchor, veil opacity, mark size, type
 * metrics) is the artefact, and a redraw of the logo or a new photograph should
 * re-run this rather than start from a blank canvas.
 *
 * ## The card is deliberately locale-neutral in everything but one line
 *
 * The mark and the "NUSUK HELP" wordmark are Latin islands in both locales —
 * the site's own header sets them the same way on `/ar` (see `bidi.tsx`). The
 * descriptor line underneath is English, which is consistent with the rest of
 * `/ar` today: §19 open item 5 leaves the Arabic catalogue holding English
 * placeholder values. An Arabic card is a second run of this script with the
 * translated line, once that drop lands.
 */
const fs = require('node:fs');
const path = require('node:path');

const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const W = 1200;
const H = 630;

/** §7 palette. */
const INK = '#0C2923';
const GILT = '#D4B467';

async function main() {
  // The photograph, cover-cropped from the portrait source and anchored to the
  // top — the same reasoning as the hero panel in `hero.tsx`: the umbrella
  // fans are the strongest band and the marble foreground is what can be lost.
  const photo = await sharp(path.join(ROOT, 'docs/source-images/hero-madinah.png'))
    .resize(W, H, { fit: 'cover', position: 'top' })
    .toBuffer();

  // The ink veil. 0.7 rather than the hero's 0.6: type sits over the image
  // here, which it never does in the hero, so this one is carrying contrast.
  const veil = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 12, g: 41, b: 35, alpha: 0.7 },
    },
  })
    .png()
    .toBuffer();

  const mark = await sharp(path.join(ROOT, 'public/logos/nusuk-help-logo-light.png'))
    .resize({ height: 210 })
    .toBuffer();
  const markMeta = await sharp(mark).metadata();

  // Set in the host's system faces, not in Marcellus and IBM Plex: neither is
  // installed where this runs, and the alternative is embedding a font pipeline
  // for two lines of type rendered once. The wordmark is tracked bold sans and
  // the descriptor is a serif, which is the site's own pairing.
  const type = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <text x="${W / 2}" y="470" text-anchor="middle"
            font-family="Segoe UI, IBM Plex Sans, Arial, sans-serif"
            font-size="52" font-weight="700" letter-spacing="11"
            fill="#FFFFFF">NUSUK HELP</text>
      <rect x="${W / 2 - 60}" y="512" width="120" height="2" fill="${GILT}"/>
      <text x="${W / 2}" y="566" text-anchor="middle"
            font-family="Georgia, serif" font-size="25" letter-spacing="1"
            fill="${GILT}">Hajj &amp; Umrah ground handling across Saudi Arabia</text>
    </svg>`);

  const outDir = path.join(ROOT, 'public/og');
  const outFile = path.join(outDir, 'nusuk-help.png');
  fs.mkdirSync(outDir, { recursive: true });

  await sharp({ create: { width: W, height: H, channels: 4, background: INK } })
    .composite([
      { input: photo, top: 0, left: 0 },
      { input: veil, top: 0, left: 0 },
      { input: mark, top: 130, left: Math.round((W - markMeta.width) / 2) },
      { input: type, top: 0, left: 0 },
    ])
    // Palette PNG: 171 KB against 843 KB truecolour, with the wordmark and the
    // mark's edges left crisp. JPEG came in at 75 KB but softened both, and the
    // card is fetched by preview crawlers rather than by page visitors — these
    // bytes are on nobody's critical path.
    .png({ palette: true, quality: 85, effort: 10 })
    .toFile(outFile);

  console.log(
    `wrote public/og/nusuk-help.png — ${W}×${H}, ${fs.statSync(outFile).size} bytes`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
