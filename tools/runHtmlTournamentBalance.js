import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const HTML_PATH = path.join(ROOT, 'apex_chaos_musician_visuals.html');
const REPORT_DIR = path.join(ROOT, 'reports');

function parseArgs(argv) {
  const out = {
    tournaments: 64,
    seconds: 360,
    fps: 20,
    debugFrames: 0,
    retryLimit: 80,
    seed: `html-${Date.now()}`,
    pair: '',
    pairMatches: 1,
    untilAllChampions: false,
    maxBatches: 8
  };
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2] ?? 'true';
    if (key in out) {
      out[key] = typeof out[key] === 'number' ? Number(value) : value === 'true' ? true : value;
    }
  }
  return out;
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoopContext() {
  const fn = () => {};
  const gradient = { addColorStop: fn };
  const ctx = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'measureText') return text => ({ width: String(text ?? '').length * 10 });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return fn;
    },
    set() { return true; }
  });
  const makeCanvas = () => ({
    width: 1000,
    height: 1000,
    style: {},
    getContext: () => ctx,
    addEventListener: fn,
    removeEventListener: fn,
    setAttribute: fn,
    getAttribute: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 })
  });
  const elements = new Map();
  function makeElement(id = '') {
    if (id === 'game-canvas') return makeCanvas();
    return {
      id,
      style: {},
      innerText: '',
      textContent: '',
      innerHTML: '',
      value: '',
      dataset: {},
      appendChild: fn,
      removeChild: fn,
      addEventListener: fn,
      removeEventListener: fn,
      setAttribute: fn,
      getAttribute: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
      classList: {
        add: fn,
        remove: fn,
        toggle: fn,
        contains: () => false
      }
    };
  }
  const document = {
    body: makeElement('body'),
    head: makeElement('head'),
    createElement: tag => tag === 'canvas' ? makeCanvas() : makeElement(tag),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: fn,
    removeEventListener: fn
  };
  class AudioContextMock {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.destination = {};
    }
    resume() { this.state = 'running'; }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return { buffer: null, connect: fn, start: fn, stop: fn }; }
    makeParam(value = 0) {
      return {
        value,
        setValueAtTime: fn,
        linearRampToValueAtTime: fn,
        exponentialRampToValueAtTime: fn,
        cancelScheduledValues: fn
      };
    }
    createBiquadFilter() { return { type: '', frequency: this.makeParam(), Q: this.makeParam(), connect: fn }; }
    createGain() { return { gain: this.makeParam(1), connect: fn }; }
    createOscillator() {
      return {
        type: '',
        frequency: this.makeParam(),
        detune: this.makeParam(),
        connect: fn,
        start: fn,
        stop: fn
      };
    }
  }
  class ImageMock {
    constructor() {
      this.complete = true;
      this.naturalWidth = 1;
      this.naturalHeight = 1;
      this.width = 1;
      this.height = 1;
    }
    set src(value) {
      this._src = value;
      if (typeof this.onload === 'function') setTimeout(() => this.onload(), 0);
    }
    get src() { return this._src; }
    decode() { return Promise.resolve(); }
  }
  const seededMath = Object.create(Math);
  seededMath.random = Math.random;
  const context = {
    console: {
      log() {},
      info() {},
      warn() {},
      error() {}
    },
    Math: seededMath,
    document,
    window: null,
    self: null,
    globalThis: null,
    navigator: { userAgent: 'html-tournament-harness' },
    location: { href: `file://${HTML_PATH.replace(/\\/g, '/')}` },
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: fn,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: fn,
    AudioContext: AudioContextMock,
    webkitAudioContext: AudioContextMock,
    Image: ImageMock,
    Path2D: class Path2D {},
    createImageBitmap: () => Promise.resolve(makeCanvas()),
    devicePixelRatio: 1,
    innerWidth: 1200,
    innerHeight: 900,
    addEventListener: fn,
    removeEventListener: fn
  };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  return context;
}

function extractScripts(html) {
  const scripts = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) scripts.push(match[1]);
  return scripts.join('\n');
}

const runnerSource = `
window.__htmlTournamentRunner = function(opts) {
  const seedBase = opts.seed || 'html';
  const seconds = opts.seconds ?? 360;
  const fps = opts.fps ?? 20;
  const debugFrames = opts.debugFrames ?? 0;
  const retryLimit = opts.retryLimit ?? 80;
  const tournaments = opts.tournaments ?? 64;
  const untilAllChampions = !!opts.untilAllChampions;
  const maxBatches = opts.maxBatches ?? 8;
  const pair = opts.pair || '';
  const pairMatches = Math.max(1, opts.pairMatches || 1);
  const names = FighterTypes.map(f => f.name);
  const champions = Object.fromEntries(names.map(n => [n, 0]));
  const tournamentResults = [];
  const matchResults = [];
  const bracketOrders = [];
  const pairSet = new Set();
  let timeoutWins = 0;
  let deathWins = 0;
  let retryMatches = 0;

  function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function rand() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(items, seed) {
    const arr = items.slice();
    const rand = mulberry32(hashSeed(seed));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function runMatch(leftName, rightName, seed, round, tournamentIndex) {
    const left = FighterTypes.find(f => f.name === leftName);
    const right = FighterTypes.find(f => f.name === rightName);
    for (let attempt = 0; attempt <= retryLimit; attempt++) {
      Math.random = mulberry32(hashSeed(seed + ':attempt:' + attempt));
      startSpecificMatch(left, right, { countdown:false, tournament:false });
      let frames = 0;
      const maxFrames = Math.ceil(seconds * fps * 8);
      while (
        gameState === 'PLAYING' &&
        fighters[0] && fighters[1] &&
        fighters[0].hp > 0 &&
        fighters[1].hp > 0 &&
        matchClock < seconds &&
        frames < maxFrames
      ) {
        hitStop = 0;
        update(1/fps);
        particles.length = 0;
        floatingTexts.length = 0;
        shockwaves.length = 0;
        cameraShake = 0;
        arenaFlash.a = 0;
        frames++;
      }
      const primary = [fighters[0], fighters[1]];
      const dead = primary.filter(f => f && f.hp <= 0);
      const alive = primary.filter(f => f && f.hp > 0).sort((a,b) => b.hp - a.hp);
      const reason = dead.length ? 'death' : 'timeout';
      const winner = dead.length === 1
        ? alive[0]
        : dead.length >= 2
          ? primary.slice().sort((a,b) => (b.hp - a.hp) || ((b.damageDone||0) - (a.damageDone||0)))[0]
          : null;
      if (winner && reason === 'death') {
        deathWins++;
        const loser = primary.find(f => f !== winner);
        const pair = [leftName, rightName].sort().join('::');
        pairSet.add(pair);
        const result = {
          tournament: tournamentIndex,
          round,
          left: leftName,
          right: rightName,
          winner: winner.name,
          loser: loser ? loser.name : null,
          reason,
          attempt,
          duration: Number(matchClock.toFixed(2)),
          winnerHp: Number(winner.hp.toFixed(2)),
          loserHp: loser ? Number(loser.hp.toFixed(2)) : null
        };
        matchResults.push(result);
        retryMatches += attempt;
        return result;
      }
    }
    timeoutWins++;
    throw new Error('Timeout/unresolved after retry limit: ' + leftName + ' vs ' + rightName + ' seed=' + seed);
  }
  function debugPair(leftName, rightName) {
    const left = FighterTypes.find(f => f.name === leftName);
    const right = FighterTypes.find(f => f.name === rightName);
    Math.random = mulberry32(hashSeed(seedBase + ':debug:' + leftName + ':' + rightName));
    startSpecificMatch(left, right, { countdown:false, tournament:false });
    let maxObjects = 0;
    for (let frames = 0; frames < debugFrames && gameState === 'PLAYING'; frames++) {
      hitStop = 0;
      update(1/fps);
      particles.length = 0;
      floatingTexts.length = 0;
      shockwaves.length = 0;
      cameraShake = 0;
      arenaFlash.a = 0;
      maxObjects = Math.max(maxObjects, projectiles.length + particles.length + fighters.length);
    }
    return {
      source: location.href,
      debug: true,
      pair: [leftName, rightName],
      frames: debugFrames,
      fps,
      matchClock,
      gameState,
      fighters: fighters.map(f => ({
        name:f.name,
        hp:f.hp,
        maxHp:f.maxHp,
        x:f.x,
        y:f.y,
        data:Object.fromEntries(Object.entries(f.data||{}).map(([k,v]) => [k, Array.isArray(v) ? { length:v.length, tail:v.slice(-3) } : v])),
        statuses:f.statuses
      })),
      projectiles: projectiles.length,
      particles: particles.length,
      maxObjects
    };
  }
  function runTournament(index) {
    const order = shuffle(names, seedBase + ':tournament:' + index);
    bracketOrders.push(order.join('|'));
    let field = order.slice();
    let round = 1;
    while (field.length > 1) {
      const next = [];
      for (let i = 0; i < field.length; i += 2) {
        const result = runMatch(field[i], field[i + 1], seedBase + ':t' + index + ':r' + round + ':m' + (i / 2) + ':' + field[i] + ':' + field[i + 1], round, index);
        next.push(result.winner);
      }
      field = next;
      round++;
    }
    champions[field[0]]++;
    tournamentResults.push({ tournament:index, champion:field[0], bracket:order });
  }
  if (pair) {
    const parts = pair.split(/[:|,]/).map(s => s.trim()).filter(Boolean);
    if (parts.length !== 2) throw new Error('Pair must look like WOLF:SLIME');
    if (debugFrames > 0) return debugPair(parts[0], parts[1]);
    for (let i=0;i<pairMatches;i++) {
      const left=i%2===0?parts[0]:parts[1];
      const right=i%2===0?parts[1]:parts[0];
      const r=runMatch(left,right,seedBase+':pair:'+i+':'+left+':'+right,'pair',i);
      champions[r.winner]++;
    }
  } else {
  let batch = 0;
  do {
    for (let i = 0; i < tournaments; i++) runTournament(tournamentResults.length + 1);
    batch++;
  } while (untilAllChampions && batch < maxBatches && names.some(n => champions[n] === 0));
  }
  const missingChampions = names.filter(n => champions[n] === 0);
  return {
    source: location.href,
    patch: window.APEX_HTML_TOURNAMENT_SKILL_BALANCE_SYNC || null,
    fighters: names,
    tournaments: tournamentResults.length,
    matches: matchResults.length,
    deathWins,
    timeoutWins,
    retryMatches,
    uniquePairs: pairSet.size,
    uniqueBracketOrders: new Set(bracketOrders).size,
    missingChampions,
    championCounts: champions,
    pass: {
      allWinsByDeath: timeoutWins === 0 && matchResults.every(m => m.reason === 'death'),
      randomizedEveryTournament: new Set(bracketOrders).size === tournamentResults.length,
      allFightersChampionAtLeastOnce: missingChampions.length === 0
    },
    tournamentsDetail: tournamentResults,
    sampleMatches: matchResults.slice(0, 12)
  };
};
`;

function loadHarness() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const scripts = extractScripts(html);
  if (!scripts.includes('ICE VISUAL + RAGE INTEGRATION')) {
    throw new Error('Latest ICE integration marker not found in apex_chaos_musician_visuals.html');
  }
  const context = makeNoopContext();
  vm.createContext(context);
  vm.runInContext(`${scripts}\n${runnerSource}`, context, {
    filename: 'apex_chaos_musician_visuals.html',
    timeout: 30000
  });
  if (typeof context.window.__htmlTournamentRunner !== 'function') {
    throw new Error('HTML tournament runner was not installed');
  }
  return context;
}

function summarizeMarkdown(result, args) {
  const champs = Object.entries(result.championCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const missing = result.missingChampions.length ? result.missingChampions.join(', ') : 'None';
  return [
    '# Latest HTML Tournament Balance',
    '',
    `- Source: ${result.source}`,
    `- Seed: ${args.seed}`,
    `- Tournaments: ${result.tournaments}`,
    `- Matches: ${result.matches}`,
    `- Death wins: ${result.deathWins}`,
    `- Timeout wins: ${result.timeoutWins}`,
    `- Retry matches: ${result.retryMatches}`,
    `- Unique bracket orders: ${result.uniqueBracketOrders}`,
    `- Missing champions: ${missing}`,
    `- Pass all wins by death: ${result.pass.allWinsByDeath}`,
    `- Pass randomized every tournament: ${result.pass.randomizedEveryTournament}`,
    `- Pass all fighters champion at least once: ${result.pass.allFightersChampionAtLeastOnce}`,
    '',
    '## Champion Counts',
    '',
    '| Fighter | Championships |',
    '| --- | ---: |',
    ...champs.map(([name, count]) => `| ${name} | ${count} |`)
  ].join('\n');
}

const args = parseArgs(process.argv.slice(2));
fs.mkdirSync(REPORT_DIR, { recursive: true });
const context = loadHarness();
const result = context.window.__htmlTournamentRunner(args);
if (result.debug) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
const payload = { args, generatedAt: new Date().toISOString(), result };
const jsonPath = path.join(REPORT_DIR, 'latest-html-tournament-balance.json');
const mdPath = path.join(REPORT_DIR, 'latest-html-tournament-balance.md');
fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
fs.writeFileSync(mdPath, summarizeMarkdown(result, args));
console.log(JSON.stringify({
  report: jsonPath,
  markdown: mdPath,
  tournaments: result.tournaments,
  matches: result.matches,
  deathWins: result.deathWins,
  timeoutWins: result.timeoutWins,
  retryMatches: result.retryMatches,
  uniqueBracketOrders: result.uniqueBracketOrders,
  missingChampions: result.missingChampions,
  pass: result.pass,
  championCounts: result.championCounts
}, null, 2));
