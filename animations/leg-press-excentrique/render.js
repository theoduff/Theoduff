// Rend anim.html image par image (fond transparent) -> frames/f_0000.png ...
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const FPS = 30, DUR = 10, out = process.argv[2] || __dirname + '/frames';
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  await p.goto('file://' + __dirname + '/anim.html');
  await p.evaluate(() => document.fonts.ready);
  for (let i = 0; i < FPS * DUR; i++) {
    await p.evaluate(t => render(t), i / FPS);
    await p.screenshot({ path: `${out}/f_${String(i).padStart(4, '0')}.png`, omitBackground: true });
  }
  await b.close();
})();
