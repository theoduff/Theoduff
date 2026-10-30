// Renders timeline.html frame by frame to transparent PNGs, then encodes ProRes 4444 + alpha.
// Usage: node render.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

(async () => {
  const dir = __dirname;
  const frames = path.join(dir, 'frames');
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames);

  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(dir, 'timeline.html'));
  await page.evaluate(() => window.ready);
  const { FPS, DURATION } = await page.evaluate(() => window.META);
  const total = Math.round(FPS * DURATION);

  for (let i = 0; i < total; i++) {
    const url = await page.evaluate(n => window.renderFrame(n), i);
    fs.writeFileSync(path.join(frames, `f_${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();

  const out = path.join(dir, 'antonelli_timeline_alpha.mov');
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i "${frames}/f_%04d.png" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 -vendor apl0 "${out}"`);
  // preview on a dark background (no alpha) for quick viewing
  execSync(`ffmpeg -y -loglevel error -f lavfi -i color=c=0x15171c:s=1920x1080:r=${FPS} -framerate ${FPS} -i "${frames}/f_%04d.png" -filter_complex "[0][1]overlay=shortest=1,format=yuv420p" -c:v libx264 -crf 16 "${path.join(dir, 'preview.mp4')}"`);
  console.log('done', total, 'frames');
})();
