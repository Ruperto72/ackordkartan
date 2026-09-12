// Draws the app icon and writes every file the app declares — the two SVGs
// index.html references and the six PNGs the manifest, Apple and the
// favicon fallback need. Same tool as music-studio's icons.js: `node
// icons.js`, no dependencies beyond cdp.js (copied from there).
//
// The mark is a two-string cutaway from the app's own halsdiagram: one
// string left open, one string fretted (one filled dot) — the exact
// contrast Ackordkartan is built to find (open strings ringing next to
// fretted notes, not just barré shapes).
'use strict';
const fs = require('fs');
const path = require('path');
const { findBrowser, launchChrome, openPage } = require('./cdp.js');

const OUT_DIR = path.join(__dirname, 'icons');

// ---- The mark: defined once, here. ----
const INK = '#16302A';    // --ink, and the manifest's background/theme color
const STRING = '#F2F3F0'; // --paper, used for the nut and the open string
const BRASS = '#D9A94A';  // --brass (dark-theme value — reads well on --ink)

// Nut + two strings + one fretted dot. Bounding box x:22-78, y:24-84 —
// centre (50,54), used below to scale around for the maskable framing.
const MOTIF = `
  <rect x="22" y="24" width="56" height="8" rx="4" fill="${STRING}"/>
  <rect x="35" y="24" width="6" height="60" rx="3" fill="${STRING}"/>
  <rect x="59" y="24" width="6" height="60" rx="3" fill="${STRING}"/>
  <circle cx="62" cy="58" r="14" fill="${BRASS}"/>
`.trim();
const MOTIF_CENTER = { x: 50, y: 54 };

// A framing is a background shape plus a motif scale, and nothing else.
//
// `maskable`'s 0.85 is derived, not chosen: a launcher may crop everything
// outside a centred circle of 80% diameter (radius 40 units here), and the
// motif's bounding box (22,24)-(78,84) has half-diagonal 41.0 from its own
// centre (50,54) — just over 40. At 0.85 it's 34.9, safely inside.
//
// `bleed` exists because Safari composites a transparent apple-touch-icon
// against black or white and applies its own squircle, so supplying our own
// rounded corners risks a seam against an unknown backdrop.
const FRAMINGS = {
  rounded:  { rx: 22, scale: 1 },
  bleed:    { rx: 0,  scale: 1 },
  maskable: { rx: 0,  scale: 0.85 },
};

function markup(framingName) {
  const f = FRAMINGS[framingName];
  if (!f) throw new Error(`unknown framing: ${framingName}`);
  const motif = f.scale === 1
    ? MOTIF
    : `<g transform="translate(${MOTIF_CENTER.x},${MOTIF_CENTER.y}) scale(${f.scale}) translate(${-MOTIF_CENTER.x},${-MOTIF_CENTER.y})">${MOTIF}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="Ackordkartan">
  <rect width="100" height="100"${f.rx ? ` rx="${f.rx}"` : ''} fill="${INK}"/>
  ${motif}
</svg>
`;
}

const OUTPUTS = [
  { file: 'icon.svg',              framing: 'rounded'  },
  { file: 'icon-maskable.svg',     framing: 'maskable' },
  { file: 'icon-192.png',          framing: 'rounded',  size: 192 },
  { file: 'icon-512.png',          framing: 'rounded',  size: 512 },
  { file: 'favicon-32.png',        framing: 'rounded',  size: 32  },
  { file: 'apple-touch-icon.png',  framing: 'bleed',    size: 180 },
  { file: 'icon-maskable-192.png', framing: 'maskable', size: 192 },
  { file: 'icon-maskable-512.png', framing: 'maskable', size: 512 },
];

// The SVG fills the viewport exactly, so a screenshot at NxN *is* the icon at
// NxN with no resampling.
function pageFor(framingName) {
  const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>
${markup(framingName)}`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error('No Chromium-family browser found. Set CHROME_PATH=/path/to/chrome.');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const out of OUTPUTS.filter((o) => !o.size)) {
    fs.writeFileSync(path.join(OUT_DIR, out.file), markup(out.framing));
    console.log(`  ${out.file.padEnd(24)} ${out.framing}`);
  }

  const launched = await launchChrome(browser, { profilePrefix: 'icons-' });
  let cdp;
  try {
    cdp = await openPage(launched.httpBase);
    // Without this the page paints opaque white behind the SVG, and the
    // rounded framing's corners — which are supposed to be transparent —
    // come out white on every home screen that does not use a dark theme.
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

    for (const out of OUTPUTS.filter((o) => o.size)) {
      const n = out.size;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: n, height: n, deviceScaleFactor: 1, mobile: false,
      });
      await cdp.send('Page.navigate', { url: pageFor(out.framing) });
      await new Promise((r) => setTimeout(r, 150)); // let the SVG paint
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: false,
        clip: { x: 0, y: 0, width: n, height: n, scale: 1 },
      });
      const abs = path.join(OUT_DIR, out.file);
      fs.writeFileSync(abs, Buffer.from(data, 'base64'));
      const kb = (fs.statSync(abs).size / 1024).toFixed(1);
      console.log(`  ${out.file.padEnd(24)} ${out.framing.padEnd(9)} ${n}x${n}  ${kb.padStart(5)} kB`);
    }
    console.log(`\nWrote ${OUTPUTS.length} files to icons/.`);
  } finally {
    if (cdp) cdp.close();
    await launched.cleanup();
  }
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { MOTIF, INK, STRING, BRASS, FRAMINGS, markup, OUTPUTS };
