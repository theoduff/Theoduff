/*
 * Génère les 8 PSD calques SANS Photoshop (ag-psd + Chromium).
 *
 *   cd avent-2026/psd-generator && npm install && node generate.js
 *
 * Sortie : avent-2026/sorties/psd/*.psd (+ aperçus JPG dans sorties/apercus)
 * Textes, couleurs et positions viennent de photoshop/config/avent2026.config.jsx.
 */
const { chromium } = require('playwright');
const { writePsdBuffer } = require('ag-psd');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'sorties', 'psd');

function pixelData(p) {
  return { width: p.width, height: p.height, data: new Uint8ClampedArray(Buffer.from(p.b64, 'base64')) };
}

function toAgLayer(L) {
  const out = { name: L.name, opacity: L.opacity, blendMode: 'normal' };
  if (L.clipping) out.clipping = true;
  if (L.pixels) {
    out.left = L.pixels.left; out.top = L.pixels.top;
    out.right = L.pixels.left + L.pixels.width; out.bottom = L.pixels.top + L.pixels.height;
    out.imageData = pixelData(L.pixels);
  }
  for (const k of ['vectorFill', 'vectorMask', 'vectorStroke', 'text']) if (L[k]) out[k] = L[k];
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto('file://' + path.join(__dirname, 'layers.html'));
  await page.waitForSelector('body[data-ready="1"]', { state: 'attached', timeout: 30000 });

  for (const fmt of ['feed', 'story']) {
    for (let wk = 0; wk < 4; wk++) {
      const v = await page.evaluate(([f, w]) => window.renderVisual(f, w), [fmt, wk]);
      const children = v.tree.map(g => ({ name: g.name, opened: true, children: g.children.map(toAgLayer) }));
      const psd = { width: v.width, height: v.height, children, imageData: pixelData(v.composite) };
      const buf = writePsdBuffer(psd);
      fs.writeFileSync(path.join(OUT, v.name + '.psd'), buf);
      console.log('OK', v.name, (buf.length / 1e6).toFixed(1) + ' Mo');
    }
  }
  await browser.close();
})();
