/**
 * generate-assets.mjs
 * Generates icon and splash screen source PNGs from SVG using sharp.
 * Run: node scripts/generate-assets.mjs
 */

import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const ASSETS    = join(ROOT, 'assets');

if (!existsSync(ASSETS)) mkdirSync(ASSETS, { recursive: true });

// ─── Colours ────────────────────────────────────────────────────────────────
const NAVY        = '#0d1b2a';
const GOLD_LIGHT  = '#e8d080';
const GOLD        = '#c9a84c';
const GOLD_DARK   = '#b8922a';

// ─── Lucide heart path (24×24 viewBox) ──────────────────────────────────────
const HEART = `M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z`;

// ─── Icon SVG (1024×1024) ────────────────────────────────────────────────────
// Heart centred at 512,512.  scale=30 → translate(152, 124)
// ECG line clipped to heart interior.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="hg" x1="0.3" y1="0" x2="0.7" y2="1">
      <stop offset="0%"   stop-color="${GOLD_LIGHT}"/>
      <stop offset="100%" stop-color="${GOLD_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="40%">
      <stop offset="0%"   stop-color="${GOLD}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="hc">
      <path transform="translate(152,124) scale(30)" d="${HEART}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="${NAVY}"/>

  <!-- Subtle warm glow -->
  <rect width="1024" height="1024" fill="url(#glow)"/>

  <!-- Heart -->
  <path transform="translate(152,124) scale(30)" d="${HEART}" fill="url(#hg)"/>

  <!-- ECG / heartbeat line, clipped to heart shape -->
  <g clip-path="url(#hc)">
    <polyline
      points="190,527 335,527 370,397 408,658 443,453 476,527 835,527"
      stroke="${NAVY}" stroke-width="28" fill="none"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// ─── Splash SVG (2732×2732) ──────────────────────────────────────────────────
// Same heart, scale=100, centred in 2732×2732.
// ECG line proportionally scaled.
const S  = 100;                              // scale
const TX = 2732 / 2 - 12   * S;             // translate X  (1366 - 1200 = 166)
const TY = 2732 / 2 - 12.92 * S;            // translate Y  (1366 - 1292 = 74)
const CX = 2732 / 2;                        // canvas centre X
const EY = CX + 50;                         // ECG line Y (slightly below centre)

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <linearGradient id="hg" x1="0.3" y1="0" x2="0.7" y2="1">
      <stop offset="0%"   stop-color="${GOLD_LIGHT}"/>
      <stop offset="100%" stop-color="${GOLD_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="30%">
      <stop offset="0%"   stop-color="${GOLD}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="hc">
      <path transform="translate(${TX},${TY}) scale(${S})" d="${HEART}"/>
    </clipPath>
  </defs>

  <rect width="2732" height="2732" fill="${NAVY}"/>
  <rect width="2732" height="2732" fill="url(#glow)"/>

  <path transform="translate(${TX},${TY}) scale(${S})" d="${HEART}" fill="url(#hg)"/>

  <g clip-path="url(#hc)">
    <polyline
      points="${CX-630},${EY} ${CX-118},${EY} ${CX-50},${EY-430} ${CX+27},${EY+438} ${CX+90},${EY-247} ${CX+147},${EY} ${CX+630},${EY}"
      stroke="${NAVY}" stroke-width="93" fill="none"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// ─── Render ──────────────────────────────────────────────────────────────────
async function render(svg, outPath, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓  ${outPath.replace(ROOT, '.')}  (${size}×${size})`);
}

console.log('\nGenerating source assets…\n');

await render(iconSvg,   join(ASSETS, 'icon-only.png'),       1024);
await render(iconSvg,   join(ASSETS, 'icon-foreground.png'), 1024);
await render(splashSvg, join(ASSETS, 'splash.png'),          2732);
await render(splashSvg, join(ASSETS, 'splash-dark.png'),     2732);

// Solid navy background for Android adaptive icon
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${NAVY}"/></svg>`;
await render(bgSvg, join(ASSETS, 'icon-background.png'), 1024);

console.log('\nDone. Run  npm run cap:assets  to generate all platform sizes.\n');
