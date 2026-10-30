// Renders timeline.html frame by frame to transparent PNGs, then encodes ProRes 4444 + alpha.
// Usage: node render.js [mexique_reel.html] [suffix]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

(async () => {
  const dir = __dirname;
  const html = process.argv[2] || 'mexique_reel.html';
  const suffix = process.argv[3] || '';
  const name = 'antonelli_mexique_titre' + suffix;
  const frames = path.join(dir, 'frames' + suffix);
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames);

  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1920 } });
  await page.goto('file://' + path.join(dir, html));
  await page.evaluate(() => window.ready);
  const { FPS, DURATION, W, H } = await page.evaluate(() => window.META);
  const total = Math.round(FPS * DURATION);

  for (let i = 0; i < total; i++) {
    const url = await page.evaluate(n => window.renderFrame(n), i);
    fs.writeFileSync(path.join(frames, `f_${String(i).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();

  const out = path.join(dir, `${name}_alpha.mov`);
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i "${frames}/f_%04d.png" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 -vendor apl0 "${out}"`);
  // QuickTime Animation (RGBA, lossless): most reliable alpha import in Premiere
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i "${frames}/f_%04d.png" -c:v qtrle -pix_fmt argb "${path.join(dir, `${name}_alpha_animation.mov`)}"`);
  // preview on a dark background (no alpha) for quick viewing
  execSync(`ffmpeg -y -loglevel error -f lavfi -i color=c=0x15171c:s=${W}x${H}:r=${FPS} -framerate ${FPS} -i "${frames}/f_%04d.png" -filter_complex "[0][1]overlay=shortest=1,format=yuv420p" -c:v libx264 -crf 16 "${path.join(dir, `preview${suffix}.mp4`)}"`);
  // PNG-in-MOV + zipped PNG sequence (alpha import that always works in Premiere)
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i "${frames}/f_%04d.png" -c:v png -pix_fmt rgba "${path.join(dir, `${name}_alpha_png.mov`)}"`);
  execSync(`rm -f "${name}_PNG_sequence.zip" && zip -qr "${name}_PNG_sequence.zip" "${path.basename(frames)}"`, { cwd: dir });
  console.log('done', total, 'frames');
})();
