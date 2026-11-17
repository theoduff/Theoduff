/*
 * Génère les PSD calques du planning du 23 au 30 novembre 2026.
 *   cd novembre-2026/generator && npm install && node generate.js
 * Sortie : novembre-2026/sorties/psd/*.psd et sorties/apercus/*.jpg
 */
const { chromium } = require('playwright');
const { writePsdBuffer } = require('ag-psd');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'sorties');
const pix = p => ({ width: p.width, height: p.height, data: new Uint8ClampedArray(Buffer.from(p.b64, 'base64')) });

function toAg(L) {
  const o = { name: L.name, opacity: L.opacity, hidden: L.hidden, blendMode: 'normal' };
  if (L.pixels) {
    Object.assign(o, { left: L.pixels.left, top: L.pixels.top, right: L.pixels.left + L.pixels.width, bottom: L.pixels.top + L.pixels.height, imageData: pix(L.pixels) });
  }
  for (const k of ['vectorFill', 'vectorMask', 'vectorStroke', 'text']) if (L[k]) o[k] = L[k];
  return o;
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'psd'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'apercus'), { recursive: true });
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto('file://' + path.join(__dirname, 'render.html'));
  await page.waitForSelector('body[data-ready="1"]', { state: 'attached', timeout: 30000 });
  const names = await page.evaluate(() => window.listVisuals());
  for (let i = 0; i < names.length; i++) {
    const v = await page.evaluate(i => window.renderOne(i), i);
    const children = v.tree.map(g => ({ name: g.name, opened: true, hidden: g.hidden, children: g.children.map(toAg) }));
    fs.writeFileSync(path.join(OUT, 'psd', v.name + '.psd'), writePsdBuffer({ width: v.width, height: v.height, children, imageData: pix(v.composite) }));
    fs.writeFileSync(path.join(OUT, 'apercus', v.name + '.jpg'), Buffer.from(v.jpg.split(',')[1], 'base64'));
    console.log('OK', v.name);
  }
  await browser.close();
})();
