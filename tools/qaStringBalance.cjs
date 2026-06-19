const { chromium } = require('C:/Users/LE QUOC KHANH/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');

const url = process.argv[2] || 'http://127.0.0.1:5173/';
const rounds = Number(process.argv[3] || 30);
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', err => errors.push(err.stack || err.message));
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 404/i.test(text)) errors.push(text);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.apexStringChampionPatch === 'ready', null, { timeout: 35000 });
  await page.waitForSelector('#loading-screen', { state: 'detached', timeout: 15000 }).catch(() => null);

  const result = await page.evaluate((rounds) => {
    const stringType = FighterTypes.find(f => f.name === 'STRING');
    const ninjaType = FighterTypes.find(f => f.name === 'NINJA');
    const out = {
      rounds,
      stringWins: 0,
      ninjaWins: 0,
      draws: 0,
      durations: [],
      damage: [],
      bodyAtEnd: [],
      activeWallAvg: [],
      casts: { shot: 0, overheat: 0, five: 0, bird: 0 },
      fiveDurations: [],
      errors: []
    };
    for (let r = 0; r < rounds; r++) {
      startSpecificMatch(stringType, ninjaType, { countdown: false, tournament: false });
      const s = fighters.find(f => f.name === 'STRING');
      const n = fighters.find(f => f.name === 'NINJA');
      let wallSamples = 0;
      let wallTotal = 0;
      let lastFive = 0;
      for (let step = 0; step < 60 * 150 && gameState === 'PLAYING'; step++) {
        update(1 / 60);
        if (step % 30 === 0) {
          wallSamples++;
          wallTotal += projectiles.filter(p => p.type === 'string_wall_thread' && p.owner === s && p.life > 0).length;
        }
        if ((s.data.stringSkillStats?.five || 0) > lastFive) {
          lastFive = s.data.stringSkillStats.five || 0;
          out.fiveDurations.push(s.data.stringCurrentCastCount || 0);
        }
      }
      if (s.hp > 0 && n.hp <= 0) out.stringWins++;
      else if (n.hp > 0 && s.hp <= 0) out.ninjaWins++;
      else if (s.hp > n.hp) out.stringWins++;
      else if (n.hp > s.hp) out.ninjaWins++;
      else out.draws++;
      out.durations.push(matchClock || 0);
      out.damage.push(s.damageDone || 0);
      out.bodyAtEnd.push(n.data.stringBodyThreads || 0);
      out.activeWallAvg.push(wallSamples ? wallTotal / wallSamples : 0);
      out.casts.shot += s.data.stringSkillStats?.shot || 0;
      out.casts.overheat += s.data.stringSkillStats?.overheat || 0;
      out.casts.five += s.data.stringSkillStats?.five || 0;
      out.casts.bird += s.data.stringSkillStats?.bird || 0;
      goToMenu();
    }
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      rounds: out.rounds,
      stringWins: out.stringWins,
      ninjaWins: out.ninjaWins,
      draws: out.draws,
      stringWinRate: out.stringWins / Math.max(1, rounds),
      avgDuration: avg(out.durations),
      avgStringDamage: avg(out.damage),
      avgBodyThreadsEnd: avg(out.bodyAtEnd),
      avgActiveWallThreads: avg(out.activeWallAvg),
      casts: out.casts,
      fiveAverageDuration: avg(out.fiveDurations),
      fiveSamples: out.fiveDurations.length
    };
  }, rounds);

  await browser.close();
  console.log(JSON.stringify({ url, ...result, errors, errorCount: errors.length }, null, 2));
  if (errors.length) process.exitCode = 1;
})();
