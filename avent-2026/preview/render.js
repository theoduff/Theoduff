// Rendu des aperçus PNG :  node avent-2026/preview/render.js [dossier_sortie]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const out = process.argv[2] || path.join(__dirname, 'png');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2400, height: 2200 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'preview.html'));
  await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
  await page.waitForTimeout(500);
  for (const svg of await page.$$('svg')) {
    const id = await svg.getAttribute('id');
    await svg.screenshot({ path: path.join(out, id + '.png') });
    console.log('OK', id);
  }
  await browser.close();
})();
