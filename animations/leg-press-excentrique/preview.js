const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2]; const times = process.argv.slice(3).map(Number);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  p.on('console', m => console.log('console', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + __dirname + '/anim.html?preview=1'); await p.evaluate(() => document.fonts.ready);
  for (const t of times) { await p.evaluate(t => render(t), t); await p.screenshot({ path: `${out}/prev_${t}.png` }); }
  await b.close();
})();
