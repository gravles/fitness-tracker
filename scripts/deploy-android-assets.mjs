/**
 * deploy-android-assets.mjs
 * Copies + resizes source PNGs from assets/ into the correct Android res directories.
 * Run: node scripts/deploy-android-assets.mjs
 *
 * Replaces @capacitor/assets which fails on this machine due to OneDrive module caching.
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, '..');
const ASSETS   = join(ROOT, 'assets');
const RES      = join(ROOT, 'android', 'app', 'src', 'main', 'res');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resize(src, dest, width, height) {
    mkdirSync(dirname(dest), { recursive: true });
    await sharp(src)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .png()
        .toFile(dest);
    console.log(`  ✓  ${dest.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
}

/** Generate a square icon with navy background and the foreground image composited on top */
async function makeRoundIcon(foreground, dest, size) {
    const NAVY = '#0d1b2a';
    // Create a navy background, then composite the foreground scaled to ~80% to leave padding
    const padded = Math.round(size * 0.82);
    const padding = Math.round((size - padded) / 2);

    const fgBuffer = await sharp(foreground)
        .resize(padded, padded, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    mkdirSync(dirname(dest), { recursive: true });
    await sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
        .composite([{ input: fgBuffer, top: padding, left: padding }])
        .png()
        .toFile(dest);
    console.log(`  ✓  ${dest.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
}

// ─── Icon sizes ───────────────────────────────────────────────────────────────
// Legacy launcher icon (ic_launcher.png, ic_launcher_round.png)
const ICON_SIZES = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
};

// Adaptive icon foreground (108dp at each density)
const FOREGROUND_SIZES = {
    'mipmap-mdpi':    108,
    'mipmap-hdpi':    162,
    'mipmap-xhdpi':   216,
    'mipmap-xxhdpi':  324,
    'mipmap-xxxhdpi': 432,
};

// ─── Splash screen sizes ──────────────────────────────────────────────────────
const SPLASH_PORTRAIT = {
    'drawable-port-mdpi':    [320,  480],
    'drawable-port-hdpi':    [480,  800],
    'drawable-port-xhdpi':   [720,  1280],
    'drawable-port-xxhdpi':  [960,  1600],
    'drawable-port-xxxhdpi': [1280, 1920],
};

const SPLASH_LANDSCAPE = {
    'drawable-land-mdpi':    [480,  320],
    'drawable-land-hdpi':    [800,  480],
    'drawable-land-xhdpi':   [1280, 720],
    'drawable-land-xxhdpi':  [1600, 960],
    'drawable-land-xxxhdpi': [1920, 1280],
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const iconSrc      = join(ASSETS, 'icon-only.png');
const fgSrc        = join(ASSETS, 'icon-foreground.png');
const splashSrc    = join(ASSETS, 'splash.png');

console.log('\nDeploying Android icon assets…\n');

// Legacy launcher icons (navy bg + icon)
for (const [dir, size] of Object.entries(ICON_SIZES)) {
    const dest = join(RES, dir);
    await makeRoundIcon(iconSrc, join(dest, 'ic_launcher.png'), size);
    await makeRoundIcon(iconSrc, join(dest, 'ic_launcher_round.png'), size);
}

console.log('\nDeploying adaptive icon foregrounds…\n');

// Adaptive icon foreground (transparent PNG, full bleed)
for (const [dir, size] of Object.entries(FOREGROUND_SIZES)) {
    await resize(fgSrc, join(RES, dir, 'ic_launcher_foreground.png'), size, size);
}

console.log('\nDeploying splash screens…\n');

// Portrait splashes
for (const [dir, [w, h]] of Object.entries(SPLASH_PORTRAIT)) {
    await resize(splashSrc, join(RES, dir, 'splash.png'), w, h);
}

// Landscape splashes
for (const [dir, [w, h]] of Object.entries(SPLASH_LANDSCAPE)) {
    await resize(splashSrc, join(RES, dir, 'splash.png'), w, h);
}

// Main drawable splash (used as fallback / default)
console.log('\nDeploying main drawable splash…\n');
await resize(splashSrc, join(RES, 'drawable', 'splash.png'), 1080, 1920);

console.log('\n✅  All Android assets deployed.\n');
console.log('Next: open in Android Studio → sync Gradle → run on device.\n');
