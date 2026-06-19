import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = 'http://127.0.0.1:5173/';
const files = [
  'assets/puppet_v1/normalized/puppet_main_static.png',
  'assets/puppet_v1/normalized/straw_monster_static.png',
  'assets/puppet_v1/normalized/puppet_dissolve_16.png',
  'assets/puppet_v1/normalized/puppet_rage_static.png',
  'assets/puppet_v1/normalized/straw_monster_attack_16.png',
  'assets/puppet_v1/normalized/effigy_wall_4.png',
  'assets/puppet_v1/normalized/transfer_link_16.png'
];

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});
const page = await browser.newPage();
await page.goto(root + 'apex_chaos_musician_visuals.html', { waitUntil: 'load' });

for (const file of files) {
  const dataUrl = await page.evaluate(async ({ url }) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    img.src = url + '?alpha=' + Date.now();
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = image.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      if (a > 0 && (max < 18 || (max < 42 && chroma < 10))) {
        px[i + 3] = 0;
      } else if (a > 0 && max < 64 && chroma < 12) {
        px[i + 3] = Math.min(a, Math.round(((max - 42) / 22) * a));
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }, { url: root + file.replaceAll('\\', '/') });
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(file, buffer);
  console.log(`${file} ${buffer.length}`);
}

await browser.close();
