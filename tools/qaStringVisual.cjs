const { chromium } = require('C:/Users/LE QUOC KHANH/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');

const url = process.argv[2] || 'http://127.0.0.1:5173/';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', err => errors.push(err.stack || err.message));
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !/favicon|Failed to load resource/i.test(text)) errors.push(text);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.apexStringChampionPatch === 'ready', null, { timeout: 35000 });
  await page.waitForSelector('#loading-screen', { state: 'detached', timeout: 15000 }).catch(() => null);
  await page.evaluate(() => {
    document.getElementById('menu-screen')?.classList.add('hidden');
    const sType = FighterTypes.find(f => f.name === 'STRING');
    const nType = FighterTypes.find(f => f.name === 'NINJA');
    startSpecificMatch(sType, nType, { countdown: false, tournament: false });
    const s = fighters.find(f => f.name === 'STRING');
    const n = fighters.find(f => f.name === 'NINJA');
    s.x = 840; s.y = 620; s.setDir(-1, -0.2);
    n.x = 330; n.y = 430;
    s.type.onWallBounce(s, 'right');
    s.data.stringWallCreateCd = 0;
    s.type.onWallBounce(s, 'bottom');
    s.data.stringWallCreateCd = 0;
    s.type.onWallBounce(s, 'top');
    s.data.stringBodyHitCd = 0;
    s.type.onCollide(s, n);
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'reports/string-visual-check.png', fullPage: false });
  await browser.close();
  console.log(JSON.stringify({ screenshot: 'reports/string-visual-check.png', errors, errorCount: errors.length }, null, 2));
  if (errors.length) process.exitCode = 1;
})();
