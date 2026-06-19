const { chromium } = require('C:/Users/LE QUOC KHANH/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');

const url = process.argv[2] || 'http://127.0.0.1:5173/';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const messages = [];
  const errors = [];
  const httpErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    messages.push({ type: msg.type(), text });
    if (msg.type() === 'error') errors.push(text);
  });
  page.on('pageerror', err => errors.push(err.stack || err.message));
  page.on('response', response => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.apexStringChampionPatch === 'ready', null, { timeout: 35000 });
  await page.waitForSelector('#loading-screen', { state: 'detached', timeout: 15000 }).catch(() => null);

  const roster = await page.evaluate(() => ({
    count: FighterTypes.length,
    names: FighterTypes.map(f => f.name),
    hasString: FighterTypes.some(f => f.name === 'STRING'),
    hasSpider: FighterTypes.some(f => /spider/i.test(f.name))
  }));

  const setup = await page.evaluate(() => {
    const s = FighterTypes.find(f => f.name === 'STRING');
    const n = FighterTypes.find(f => f.name === 'NINJA');
    startSpecificMatch(s, n, { countdown: false, tournament: false });
    const string = fighters.find(f => f.name === 'STRING');
    const ninja = fighters.find(f => f.name === 'NINJA');
    string.x = string.radius;
    string.y = 500;
    string.setDir(-1, 0);
    string.type.onWallBounce(string, 'left');
    string.type.onWallBounce(string, 'top');
    string.data.stringWallCreateCd = 0;
    string.type.onWallBounce(string, 'bottom');
    ninja.x = 40;
    ninja.y = 500;
    string.type.onCollide(string, ninja);
    return {
      fighters: fighters.map(f => f.name),
      wallThreads: projectiles.filter(p => p.type === 'string_wall_thread').length,
      bodyThreads: ninja.data.stringBodyThreads || 0,
      speedMult: string.speedMult()
    };
  });

  await page.waitForTimeout(700);
  const afterThreadBreak = await page.evaluate(() => {
    const string = fighters.find(f => f.name === 'STRING');
    const ninja = fighters.find(f => f.name === 'NINJA');
    return {
      liveWallThreads: projectiles.filter(p => p.type === 'string_wall_thread').length,
      cutCount: string.data.stringThreadCount || 0,
      bodyThreads: ninja.data.stringBodyThreads || 0,
      enemySpeedMult: ninja.speedMult()
    };
  });

  const skillOne = await page.evaluate(async () => {
    const string = fighters.find(f => f.name === 'STRING');
    const ninja = fighters.find(f => f.name === 'NINJA');
    string.data.stringThreadCount = 1;
    string.data.stringCycleTimer = .02;
    string.data.stringState = 'idle';
    const hpBefore = ninja.hp;
    await new Promise(resolve => setTimeout(resolve, 700));
    return {
      hpBefore,
      hpAfter: ninja.hp,
      state: string.data.stringState,
      stats: string.data.stringSkillStats,
      bodyThreads: ninja.data.stringBodyThreads || 0
    };
  });

  const skillFive = await page.evaluate(async () => {
    const string = fighters.find(f => f.name === 'STRING');
    const ninja = fighters.find(f => f.name === 'NINJA');
    ninja.hp = 100;
    ninja.x = string.x + 130;
    ninja.y = string.y;
    ninja.data.stringBodyThreads = 5;
    string.data.stringBodyHitCd = 99;
    string.data.stringThreadCount = 5;
    string.data.stringCycleTimer = .02;
    string.data.stringState = 'idle';
    await new Promise(resolve => setTimeout(resolve, 8500));
    return {
      state: string.data.stringState,
      bodyThreads: ninja.data.stringBodyThreads || 0,
      birdCages: projectiles.filter(p => p.type === 'string_bird_cage').length,
      stats: string.data.stringSkillStats,
      hpAfter: ninja.hp
    };
  });

  await page.screenshot({ path: 'reports/string-runtime-smoke.png', fullPage: false });
  await browser.close();

  const filteredErrors = errors.filter(text => !/favicon|Failed to load resource: the server responded with a status of 404/i.test(text));
  const filteredHttpErrors = httpErrors.filter(text => !/favicon/i.test(text));
  const result = { url, roster, setup, afterThreadBreak, skillOne, skillFive, httpErrors: filteredHttpErrors, errors: filteredErrors, errorCount: filteredErrors.length + filteredHttpErrors.length };
  console.log(JSON.stringify(result, null, 2));
  if (result.errorCount) process.exitCode = 1;
})().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
