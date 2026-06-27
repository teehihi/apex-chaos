// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_TAM_CHIEN_LOCAL_MODE(){
  if (window.__apexTamChienLocalMode) return;
  window.__apexTamChienLocalMode = true;

  const POOL = ['ICE', 'STRING', 'GALAXY', 'SOCCER', 'NINJA', 'ENGINEER', 'SHOTGUN', 'KATANA', 'FANG'];
  const SIDES = ['blue', 'red'];
  const ROUNDS = [
    { id:'round1', short:'R1', name:'Doi Khang', label:'Round 1 - Doi Khang', damage:{blue:1, red:1} },
    { id:'round2', short:'R2', name:'Toc Chien', label:'Round 2 - Toc Chien', damage:{blue:2, red:2} },
    { id:'round3', short:'R3', name:'Truong Chien', label:'Round 3 - Truong Chien', damage:{blue:1, red:1} }
  ];
  const ROUND_IDS = ROUNDS.map(r => r.id);
  const OPP = { blue:'red', red:'blue' };
  const PHASES = ['BAN_PHASE', 'PICK_1', 'PICK_2', 'PICK_3', 'SWAP_PHASE'];
  const ROUND_PREF = {
    round1:{ ICE:32, GALAXY:33, ENGINEER:33, STRING:27, SOCCER:23, NINJA:22, SHOTGUN:35, KATANA:34, FANG:35 },
    round2:{ NINJA:38, SOCCER:33, GALAXY:32, ENGINEER:28, ICE:27, STRING:22, SHOTGUN:36, KATANA:37, FANG:38 },
    round3:{ GALAXY:39, ENGINEER:39, ICE:33, STRING:32, SOCCER:24, NINJA:28, SHOTGUN:37, KATANA:38, FANG:39 }
  };
  const BASE_VALUE = { ICE:29, STRING:27, GALAXY:33, SOCCER:26, NINJA:29, ENGINEER:32, SHOTGUN:33, KATANA:34, FANG:35 };
  const ROUND_LABEL = Object.fromEntries(ROUNDS.map(r => [r.id, r.label]));

  let session = null;
  let humanDraft = {};
  let activeRoundConfig = null;
  let pendingOpeningTimer = null;

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function ft(name) { return fighterTypeByName(name); }
  function roundInfo(roundId) { return ROUNDS.find(r => r.id === roundId) || ROUNDS[0]; }
  function roundPhase(roundId, suffix) {
    return `ROUND_${String(roundId || '').replace('round', '')}_${suffix}`;
  }
  function logPhase(next) {
    if (!session) return;
    console.info(`[TamChien] phase changed: ${session.status} -> ${next}`);
    session.status = next;
  }
  function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function seeded(seedText) {
    let s = hashSeed(seedText) || 1;
    return () => {
      s = Math.imul(1664525, s) + 1013904223;
      return (s >>> 0) / 4294967296;
    };
  }
  function rng() {
    if (!session) return Math.random();
    session._rng ||= seeded(session.seed || `tam-chien-${Date.now()}`);
    return session._rng();
  }
  function weightedTop(candidates, weights = [0.5, 0.3, 0.2]) {
    const sorted = [...candidates].sort((a, b) => b.score - a.score).slice(0, Math.min(3, candidates.length));
    if (!sorted.length) return null;
    let roll = rng();
    for (let i = 0; i < sorted.length; i += 1) {
      const w = weights[i] ?? (1 / sorted.length);
      if (roll <= w) return sorted[i];
      roll -= w;
    }
    return sorted[sorted.length - 1];
  }
  function hideScreens(extra = []) {
    ['menu-screen','select-screen','tournament-screen','end-screen','solo-screen','trial-screen','tam-chien-screen', ...extra]
      .forEach(id => document.getElementById(id)?.classList.add('hidden'));
  }
  function showTam() {
    hideScreens();
    document.getElementById('tam-chien-screen')?.classList.remove('hidden');
    const hud = document.getElementById('hud');
    if (hud) hud.style.opacity = 0;
    removeRunningBadge();
  }
  function root() { return document.getElementById('tam-chien-root'); }
  function message(text) {
    const el = document.getElementById('tam-message');
    if (el) el.textContent = text || '';
  }
  function validateChampionPool() {
    const missing = POOL.filter(id => !ft(id));
    if (missing.length) {
      const msg = `Tam Chien disabled: missing champion implementation(s): ${missing.join(', ')}`;
      console.error(`[TamChien] ${msg}`);
      return { ok:false, missing, message:msg };
    }
    return { ok:true, missing:[] };
  }
  function emptyPicks() { return { round1:null, round2:null, round3:null }; }
  function createSession() {
    const id = `local-tam-chien-${Date.now()}`;
    return {
      id,
      mode:'TAM_CHIEN_LOCAL',
      status:'BAN_PHASE',
      seed:id,
      sides:{
        blue:{ type:'HUMAN', championPool:[...POOL] },
        red:{ type:'CPU', championPool:[...POOL] }
      },
      bans:{ blue:null, red:null },
      picks:{ blue:emptyPicks(), red:emptyPicks() },
      swaps:{ blue:null, red:null },
      finalLineup:{ blue:emptyPicks(), red:emptyPicks() },
      openingCommands:{ round1:{ blueAngle:null, redAngle:null }, round2:{ blueAngle:null, redAngle:null }, round3:{ blueAngle:null, redAngle:null } },
      roundResults:[],
      score:{ blue:0, red:0 },
      winner:null,
      pendingCpu:{ ban:null, pick:null, swap:null, opening:null },
      cpuDecisionAudit:[]
    };
  }

  function isValidRound(roundId) { return ROUND_IDS.includes(roundId); }
  function banListFor(targetSide) {
    return Object.values(session?.bans || {}).filter(b => b && b.targetSide === targetSide);
  }
  function isBanned(side, championId, roundId) {
    return banListFor(side).some(b => b.championId === championId && b.roundId === roundId);
  }
  function usedChampions(side, picks = session?.picks?.[side]) {
    return Object.values(picks || {}).filter(Boolean);
  }
  function isLegalBan(s, side, championId, roundId) {
    if (!s || !SIDES.includes(side)) return false;
    const targetSide = OPP[side];
    return isValidRound(roundId) && s.sides[targetSide].championPool.includes(championId);
  }
  function isLegalPick(s, side, championId, roundId) {
    if (!s || !SIDES.includes(side) || !isValidRound(roundId)) return false;
    if (!s.sides[side].championPool.includes(championId)) return false;
    if (s.picks[side][roundId]) return false;
    if (Object.values(s.picks[side]).includes(championId)) return false;
    const banned = Object.values(s.bans).some(b => b && b.targetSide === side && b.championId === championId && b.roundId === roundId);
    return !banned;
  }
  function getLegalPicks(s, side) {
    const moves = [];
    for (const championId of s.sides[side].championPool) {
      for (const roundId of ROUND_IDS) {
        if (isLegalPick(s, side, championId, roundId)) moves.push({ side, championId, roundId });
      }
    }
    return moves;
  }
  function lineupAfterSwap(lineup, fromRound, toRound) {
    const next = Object.assign({}, lineup);
    const temp = next[fromRound];
    next[fromRound] = next[toRound];
    next[toRound] = temp;
    return next;
  }
  function isLegalSwap(s, side, fromRound, toRound) {
    if (!s || fromRound === 'none' || !fromRound || !toRound) return true;
    if (!isValidRound(fromRound) || !isValidRound(toRound) || fromRound === toRound) return false;
    const next = lineupAfterSwap(s.picks[side], fromRound, toRound);
    return ROUND_IDS.every(roundId => next[roundId] && !Object.values(s.bans).some(b => b && b.targetSide === side && b.championId === next[roundId] && b.roundId === roundId));
  }
  function getLegalSwaps(s, side) {
    const swaps = [{ side, fromRound:null, toRound:null, label:'No Swap', score:0 }];
    for (let i = 0; i < ROUND_IDS.length; i += 1) {
      for (let j = i + 1; j < ROUND_IDS.length; j += 1) {
        const fromRound = ROUND_IDS[i], toRound = ROUND_IDS[j];
        if (isLegalSwap(s, side, fromRound, toRound)) swaps.push({ side, fromRound, toRound, label:`${roundInfo(fromRound).short} <-> ${roundInfo(toRound).short}`, score:0 });
      }
    }
    return swaps;
  }
  function applyBan(s, ban) {
    if (!isLegalBan(s, ban.by, ban.championId, ban.roundId)) throw new Error('Illegal Tam Chien ban');
    s.bans[ban.by] = ban;
  }
  function applyPick(s, pick) {
    if (!isLegalPick(s, pick.side, pick.championId, pick.roundId)) throw new Error('Illegal Tam Chien pick');
    s.picks[pick.side][pick.roundId] = pick.championId;
  }
  function applySwap(s, swap) {
    if (!swap || !swap.fromRound || !swap.toRound) {
      s.swaps[swap?.side || 'blue'] = { side:swap?.side || 'blue', fromRound:null, toRound:null };
      return;
    }
    if (!isLegalSwap(s, swap.side, swap.fromRound, swap.toRound)) throw new Error('Illegal Tam Chien swap');
    s.picks[swap.side] = lineupAfterSwap(s.picks[swap.side], swap.fromRound, swap.toRound);
    s.swaps[swap.side] = swap;
  }
  function buildFinalLineup(s) {
    for (const side of SIDES) {
      for (const roundId of ROUND_IDS) {
        if (!s.picks[side][roundId]) throw new Error(`Missing final lineup ${side} ${roundId}`);
      }
      s.finalLineup[side] = Object.assign({}, s.picks[side]);
    }
  }
  Object.assign(window, {
    tamChienValidateChampionPool: validateChampionPool,
    tamChienIsLegalBan: (...args) => isLegalBan(session, ...args),
    tamChienIsLegalPick: (...args) => isLegalPick(session, ...args),
    tamChienIsLegalSwap: (...args) => isLegalSwap(session, ...args),
    tamChienGetSession: () => clone(session)
  });

  function scoreChampionRound(championId, roundId, side, s = session) {
    let score = (BASE_VALUE[championId] || 20) + (ROUND_PREF[roundId]?.[championId] || 20);
    const enemyPick = s?.picks?.[OPP[side]]?.[roundId];
    if (enemyPick) {
      if (championId === 'NINJA' && ['GALAXY','SOCCER'].includes(enemyPick)) score += 7;
      if (championId === 'ICE' && ['NINJA','SOCCER'].includes(enemyPick)) score += 6;
      if (championId === 'ENGINEER' && ['STRING','ICE'].includes(enemyPick)) score += 3;
      if (championId === 'SOCCER' && enemyPick === 'ENGINEER') score += 5;
      if (championId === 'STRING' && ['GALAXY','ENGINEER'].includes(enemyPick)) score += 4;
      if (championId === 'KATANA' && ['ENGINEER','GALAXY','SHOTGUN'].includes(enemyPick)) score += 5;
      if (championId === 'GALAXY') score += 3;
    }
    const used = usedChampions(side, s?.picks?.[side]);
    if (!used.includes(championId)) {
      const hasSetup = used.some(x => ['ENGINEER','STRING','ICE'].includes(x));
      const hasBurst = used.some(x => ['NINJA','SOCCER','GALAXY','KATANA'].includes(x));
      if (['ENGINEER','STRING','ICE'].includes(championId) && !hasSetup) score += 4;
      if (['NINJA','SOCCER','GALAXY','KATANA'].includes(championId) && !hasBurst) score += 4;
    }
    score += (rng() - .5) * 8;
    return score;
  }
  function chooseCpuBan(s) {
    const threats = [];
    for (const championId of s.sides.blue.championPool) {
      for (const roundId of ROUND_IDS) {
        let score = scoreChampionRound(championId, roundId, 'blue', s);
        if (championId === 'NINJA' && roundId === 'round2') score += 14;
        if (championId === 'GALAXY' && roundId === 'round3') score += 12;
        if (championId === 'ENGINEER' && (roundId === 'round1' || roundId === 'round3')) score += 10;
        if (championId === 'KATANA' && (roundId === 'round2' || roundId === 'round3')) score += 10;
        threats.push({ by:'red', targetSide:'blue', championId, roundId, score });
      }
    }
    const move = weightedTop(threats, [.52, .31, .17]) || threats[0];
    console.info(`[TamChien] CPU ban selected secretly: ${move.championId} ${move.roundId}`);
    s.cpuDecisionAudit.push({ phase:'BAN_PHASE', decidedBeforeHuman:true, move:clone(move) });
    return { by:'red', targetSide:'blue', championId:move.championId, roundId:move.roundId };
  }
  function chooseCpuPick(s) {
    const candidates = getLegalPicks(s, 'red').map(move => ({
      ...move,
      score: scoreChampionRound(move.championId, move.roundId, 'red', s)
    }));
    const picked = weightedTop(candidates, [.5, .3, .2]) || candidates[0];
    if (!picked) return null;
    console.info(`[TamChien] CPU pick selected secretly: ${picked.championId} ${picked.roundId}`);
    s.cpuDecisionAudit.push({ phase:s.status, decidedBeforeHuman:true, move:clone(picked) });
    return { side:'red', championId:picked.championId, roundId:picked.roundId };
  }
  function scoreLineup(lineup, enemyLineup) {
    return ROUND_IDS.reduce((sum, roundId) => sum + scoreChampionRound(lineup[roundId], roundId, 'red', session) + (lineup[roundId] === enemyLineup[roundId] ? 1 : 0), 0);
  }
  function chooseCpuSwap(s) {
    const legal = getLegalSwaps(s, 'red');
    const noSwapScore = scoreLineup(s.picks.red, s.picks.blue) + 4;
    const scored = legal.map(sw => {
      const line = sw.fromRound ? lineupAfterSwap(s.picks.red, sw.fromRound, sw.toRound) : s.picks.red;
      return { ...sw, score: scoreLineup(line, s.picks.blue) + (sw.fromRound ? 0 : 4) + (rng() - .5) * 5 };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    const weights = best && best.fromRound && best.score - noSwapScore > 8 ? [.7, .2, .1] : [.45, .35, .2];
    const move = weightedTop(scored, weights) || scored[0] || { side:'red', fromRound:null, toRound:null };
    console.info(`[TamChien] CPU swap selected secretly: ${move.fromRound ? `${move.fromRound}<->${move.toRound}` : 'no swap'}`);
    s.cpuDecisionAudit.push({ phase:'SWAP_PHASE', decidedBeforeHuman:true, move:clone(move) });
    return { side:'red', fromRound:move.fromRound || null, toRound:move.toRound || null };
  }
  function chooseCpuOpeningAngle(championId, enemyId) {
    const tendencies = {
      ENGINEER:[180, 210, 150, 315],
      NINJA:[180, 205, 155, 235],
      ICE:[160, 200, 250, 110],
      STRING:[140, 220, 95, 265],
      SOCCER:[160, 200, 135, 225],
      GALAXY:[180, 205, 155, 120],
      KATANA:[175, 205, 145, 235]
    };
    const list = tendencies[championId] || [180, 140, 220];
    let angle = list[Math.floor(rng() * list.length)];
    if (enemyId === 'NINJA' && championId !== 'NINJA') angle += rng() < .5 ? 22 : -22;
    angle += (rng() < .5 ? -1 : 1) * (10 + rng() * 25);
    angle = (angle % 360 + 360) % 360;
    session.cpuDecisionAudit.push({ phase:`${session.status}_OPENING`, decidedBeforeHuman:true, move:{ side:'red', angleDeg:angle } });
    return angle;
  }

  function phaseIndex(status) {
    if (status === 'BAN_PHASE' || status === 'BAN_REVEAL') return 0;
    if (status === 'PICK_1' || status === 'PICK_1_REVEAL') return 1;
    if (status === 'PICK_2' || status === 'PICK_2_REVEAL') return 2;
    if (status === 'PICK_3' || status === 'PICK_3_REVEAL') return 3;
    if (status === 'SWAP_PHASE' || status === 'FINAL_REVEAL') return 4;
    return 5;
  }
  function headerHtml(title, sub = '') {
    const idx = phaseIndex(session?.status);
    const steps = ['Ban', 'Pick 1', 'Pick 2', 'Pick 3', 'Swap'].map((label, i) => `<div class="tam-step ${i === idx ? 'active' : i < idx ? 'done' : ''}">${label}</div>`).join('');
    return `<div class="tam-head">
      <div><h1 class="tam-title">${esc(title)}</h1><p class="tam-sub">${esc(sub || 'Human Blue vs CPU Red - local offline')}</p></div>
      <div class="tam-score"><span class="tam-pill tam-blue">Blue ${session?.score?.blue || 0}</span><span class="tam-pill tam-red">Red ${session?.score?.red || 0}</span></div>
    </div><div class="tam-phasebar">${steps}</div>`;
  }
  function bansHtml() {
    const one = side => {
      const b = session.bans[side];
      return b ? `<div><b class="${side === 'blue' ? 'tam-blue' : 'tam-red'}">${side.toUpperCase()}</b> bans ${esc(b.targetSide)} ${esc(b.championId)} from ${esc(roundInfo(b.roundId).short)}</div>` : `<div>${side.toUpperCase()} ban hidden</div>`;
    };
    return `<div class="tam-log">${one('blue')}${one('red')}</div>`;
  }
  function lineupsHtml(useFinal = false) {
    const src = useFinal ? session.finalLineup : session.picks;
    return `<div class="tam-lineups">${ROUND_IDS.map(roundId => `
      <div class="tam-slot">
        <b>${esc(ROUND_LABEL[roundId])}</b>
        <div><span class="tam-blue">Blue:</span> ${esc(src.blue[roundId] || '-')}</div>
        <div><span class="tam-red">Red:</span> ${esc(src.red[roundId] || '-')}</div>
      </div>`).join('')}</div>`;
  }
  function poolButtons(side, targetSide, selectedChampion) {
    return session.sides[targetSide || side].championPool.map(id => {
      const used = side === 'blue' && !targetSide && usedChampions('blue').includes(id);
      return `<button class="tam-choice ${selectedChampion === id ? 'selected' : ''}" data-champion="${esc(id)}" ${used ? 'disabled' : ''}>${esc(id)}${used ? '<small>Used</small>' : ''}</button>`;
    }).join('');
  }
  function roundButtons(selectedRound, championId, mode) {
    return ROUNDS.map(r => {
      let disabled = false;
      let small = r.name;
      if (mode === 'pick') {
        disabled = !!session.picks.blue[r.id] || (championId && isBanned('blue', championId, r.id));
        if (session.picks.blue[r.id]) small = `Filled: ${session.picks.blue[r.id]}`;
        else if (championId && isBanned('blue', championId, r.id)) small = 'Banned';
      }
      return `<button class="tam-round ${selectedRound === r.id ? 'selected' : ''}" data-round="${r.id}" ${disabled ? 'disabled' : ''}>${r.short}<small>${esc(small)}</small></button>`;
    }).join('');
  }
  function bindChoice(host, key, selector, attr, renderFn) {
    host.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', () => {
        humanDraft[key] = btn.dataset[attr];
        renderFn();
      });
    });
  }

  function renderBan() {
    showTam();
    const host = root();
    if (!host) return;
    host.innerHTML = `${headerHtml('Tam Chien - Mandatory Ban', 'Choose one enemy champion and one exact round. CPU Red has already chosen secretly.')}
      <div class="tam-board">
        <div class="tam-panel">
          <h3>Ban Red Champion From Round</h3>
          <div class="tam-grid">${poolButtons('blue', 'red', humanDraft.championId)}</div>
          <h3 style="margin-top:12px">Round Target</h3>
          <div class="tam-rounds">${roundButtons(humanDraft.roundId, humanDraft.championId, 'ban')}</div>
          <div class="tam-actions"><button class="tam-button primary" id="tam-confirm">Confirm Ban</button><button class="tam-button" id="tam-back">Main Menu</button></div>
          <div id="tam-message" class="tam-message"></div>
        </div>
        <div class="tam-panel"><h3>Current Restrictions</h3>${bansHtml()}<div class="tam-log"><div>CPU action remains hidden until reveal.</div></div></div>
      </div>`;
    bindChoice(host, 'championId', '[data-champion]', 'champion', renderBan);
    bindChoice(host, 'roundId', '[data-round]', 'round', renderBan);
    host.querySelector('#tam-back')?.addEventListener('click', goToMenu);
    host.querySelector('#tam-confirm')?.addEventListener('click', () => {
      const ban = { by:'blue', targetSide:'red', championId:humanDraft.championId, roundId:humanDraft.roundId };
      if (!isLegalBan(session, 'blue', ban.championId, ban.roundId)) return message('Choose a legal champion + round ban.');
      applyBan(session, ban);
      applyBan(session, session.pendingCpu.ban);
      logPhase('BAN_REVEAL');
      renderReveal('Ban Reveal', () => enterPick(1));
    });
  }
  function renderPick(n) {
    showTam();
    const host = root();
    if (!host) return;
    const pick = humanDraft.pick || {};
    host.innerHTML = `${headerHtml(`Tam Chien - Pick ${n}`, 'Choose one unused Blue champion and one empty legal round. CPU Red has already chosen secretly.')}
      <div class="tam-board">
        <div class="tam-panel">
          <h3>Blue Champion Pool</h3>
          <div class="tam-grid">${poolButtons('blue', null, pick.championId)}</div>
          <h3 style="margin-top:12px">Round Slot</h3>
          <div class="tam-rounds">${roundButtons(pick.roundId, pick.championId, 'pick')}</div>
          <div class="tam-actions"><button class="tam-button primary" id="tam-confirm">Confirm Pick</button><button class="tam-button" id="tam-back">Main Menu</button></div>
          <div id="tam-message" class="tam-message"></div>
        </div>
        <div class="tam-panel"><h3>Draft Board</h3>${lineupsHtml(false)}<h3 style="margin-top:12px">Bans</h3>${bansHtml()}</div>
      </div>`;
    host.querySelectorAll('[data-champion]').forEach(btn => btn.addEventListener('click', () => {
      humanDraft.pick = Object.assign({}, humanDraft.pick, { championId:btn.dataset.champion });
      renderPick(n);
    }));
    host.querySelectorAll('[data-round]').forEach(btn => btn.addEventListener('click', () => {
      humanDraft.pick = Object.assign({}, humanDraft.pick, { roundId:btn.dataset.round });
      renderPick(n);
    }));
    host.querySelector('#tam-back')?.addEventListener('click', goToMenu);
    host.querySelector('#tam-confirm')?.addEventListener('click', () => {
      const move = { side:'blue', championId:humanDraft.pick?.championId, roundId:humanDraft.pick?.roundId };
      if (!isLegalPick(session, 'blue', move.championId, move.roundId)) return message('Pick is illegal: check used champions, empty slots, and bans.');
      try {
        applyPick(session, move);
        if (session.pendingCpu.pick) applyPick(session, session.pendingCpu.pick);
      } catch (error) {
        console.error('[TamChien] CPU pick invalid; retrying fallback.', error);
        const fallback = getLegalPicks(session, 'red')[0];
        if (fallback) applyPick(session, fallback);
      }
      logPhase(`PICK_${n}_REVEAL`);
      renderReveal(`Pick ${n} Reveal`, () => n >= 3 ? enterSwap() : enterPick(n + 1));
    });
  }
  function renderSwap() {
    showTam();
    const host = root();
    if (!host) return;
    const selected = humanDraft.swapRounds || [];
    const options = [{ id:'none', label:'No Swap' }, ...ROUND_IDS.map(id => ({ id, label:roundInfo(id).label }))];
    host.innerHTML = `${headerHtml('Tam Chien - Tactical Swap', 'Select two Blue round slots to swap, or choose No Swap. CPU swap has already been chosen secretly.')}
      <div class="tam-board">
        <div class="tam-panel">
          <h3>Blue Lineup</h3>
          <div class="tam-rounds">${options.map(opt => {
            const sel = opt.id === 'none' ? selected[0] === 'none' : selected.includes(opt.id);
            const disabled = opt.id !== 'none' && !session.picks.blue[opt.id];
            return `<button class="tam-round ${sel ? 'selected' : ''}" data-swap="${opt.id}" ${disabled ? 'disabled' : ''}>${esc(opt.id === 'none' ? opt.label : roundInfo(opt.id).short)}<small>${esc(opt.id === 'none' ? 'Keep lineup' : session.picks.blue[opt.id])}</small></button>`;
          }).join('')}</div>
          <div class="tam-actions"><button class="tam-button primary" id="tam-confirm">Lock Swap</button><button class="tam-button" id="tam-back">Main Menu</button></div>
          <div id="tam-message" class="tam-message"></div>
        </div>
        <div class="tam-panel"><h3>Before Swap</h3>${lineupsHtml(false)}<h3 style="margin-top:12px">Bans</h3>${bansHtml()}</div>
      </div>`;
    host.querySelectorAll('[data-swap]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.swap;
      if (id === 'none') humanDraft.swapRounds = ['none'];
      else {
        const cur = (humanDraft.swapRounds || []).filter(x => x !== 'none' && x !== id);
        cur.push(id);
        humanDraft.swapRounds = cur.slice(-2);
      }
      renderSwap();
    }));
    host.querySelector('#tam-back')?.addEventListener('click', goToMenu);
    host.querySelector('#tam-confirm')?.addEventListener('click', () => {
      const rounds = humanDraft.swapRounds || ['none'];
      const move = rounds[0] === 'none' || rounds.length < 2
        ? { side:'blue', fromRound:null, toRound:null }
        : { side:'blue', fromRound:rounds[0], toRound:rounds[1] };
      if (!isLegalSwap(session, 'blue', move.fromRound, move.toRound)) return message('Swap is illegal because it would move a champion into a banned round.');
      try {
        applySwap(session, move);
        applySwap(session, session.pendingCpu.swap);
        buildFinalLineup(session);
      } catch (error) {
        console.error('[TamChien] Swap failed.', error);
        return message(error.message || 'Swap failed.');
      }
      logPhase('FINAL_REVEAL');
      renderFinalReveal();
    });
  }
  function renderReveal(title, nextFn) {
    showTam();
    const host = root();
    if (!host) return;
    host.innerHTML = `${headerHtml(`Tam Chien - ${title}`, 'Both simultaneous decisions are now revealed.')}
      <div class="tam-board">
        <div class="tam-panel"><h3>${esc(title)}</h3>${lineupsHtml(false)}<h3 style="margin-top:12px">Bans</h3>${bansHtml()}</div>
        <div class="tam-panel"><h3>Audit</h3><div class="tam-log"><div>CPU decision was created before Blue submitted this window.</div><div>Mirror picks are allowed across sides.</div></div>
          <div class="tam-actions"><button class="tam-button primary" id="tam-next">Continue</button><button class="tam-button" id="tam-back">Main Menu</button></div></div>
      </div>`;
    host.querySelector('#tam-next')?.addEventListener('click', nextFn);
    host.querySelector('#tam-back')?.addEventListener('click', goToMenu);
  }
  function renderFinalReveal() {
    showTam();
    const host = root();
    if (!host) return;
    host.innerHTML = `${headerHtml('Tam Chien - Final Lineup', 'Draft locked. Rounds will now run as real auto-battle matches.')}
      <div class="tam-board">
        <div class="tam-panel"><h3>Final Matchups</h3>${lineupsHtml(true)}<h3 style="margin-top:12px">Swaps</h3>
          <div class="tam-log"><div>Blue: ${esc(swapLabel(session.swaps.blue))}</div><div>Red: ${esc(swapLabel(session.swaps.red))}</div></div></div>
        <div class="tam-panel"><h3>Bans</h3>${bansHtml()}<div class="tam-actions"><button class="tam-button primary" id="tam-start">Start Round 1 Opening</button><button class="tam-button" id="tam-back">Main Menu</button></div></div>
      </div>`;
    host.querySelector('#tam-start')?.addEventListener('click', () => enterOpening('round1'));
    host.querySelector('#tam-back')?.addEventListener('click', goToMenu);
  }
  function swapLabel(sw) {
    return sw?.fromRound && sw?.toRound ? `${roundInfo(sw.fromRound).short} <-> ${roundInfo(sw.toRound).short}` : 'No Swap';
  }

  function enterPick(n) {
    logPhase(`PICK_${n}`);
    humanDraft = { pick:{} };
    session.pendingCpu.pick = chooseCpuPick(session);
    renderPick(n);
  }
  function enterSwap() {
    logPhase('SWAP_PHASE');
    humanDraft = { swapRounds:['none'] };
    session.pendingCpu.swap = chooseCpuSwap(session);
    renderSwap();
  }
  function angleToVector(angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return { x:Math.cos(rad), y:Math.sin(rad) };
  }
  function enterOpening(roundId) {
    if (roundId === 'round3' && session.score.blue + session.score.red >= 2 && !(session.score.blue === 1 && session.score.red === 1)) return completeBattle();
    const blue = session.finalLineup.blue[roundId], red = session.finalLineup.red[roundId];
    const redAngle = chooseCpuOpeningAngle(red, blue);
    session.pendingCpu.opening = { side:'red', roundId, angleDeg:redAngle, locked:true };
    logPhase(roundPhase(roundId, 'OPENING'));
    renderOpening(roundId);
  }
  function renderOpening(roundId) {
    showTam();
    const host = root();
    if (!host) return;
    const blue = session.finalLineup.blue[roundId], red = session.finalLineup.red[roundId];
    let angle = Number.isFinite(humanDraft.angleDeg) ? humanDraft.angleDeg : 0;
    let locked = !!humanDraft.locked;
    let remaining = 10;
    host.innerHTML = `${headerHtml(`${roundInfo(roundId).label} - Opening Command`, `${blue} vs ${red}`)}
      <div class="tam-panel tam-aim">
        <h3><span id="tam-open-timer">10.0</span>s - Blue opening angle <span id="tam-open-angle">${angle.toFixed(1)}</span> deg</h3>
        <div id="tam-aim-pad" class="tam-aim-pad ${locked ? 'tam-locked' : ''}"><div id="tam-arrow" class="tam-arrow" style="transform: rotate(${angle}deg)"></div></div>
        <div class="tam-actions"><button class="tam-button primary" id="tam-lock">${locked ? 'Unlock' : 'Lock'}</button><button class="tam-button" id="tam-confirm">Start Round</button><button class="tam-button" id="tam-back">Main Menu</button></div>
        <div id="tam-message" class="tam-message">${locked ? 'Angle locked. Click pad or button to unlock.' : 'Move mouse over the ring; click to lock/unlock.'}</div>
      </div>`;
    const pad = host.querySelector('#tam-aim-pad');
    const arrow = host.querySelector('#tam-arrow');
    const angleEl = host.querySelector('#tam-open-angle');
    const timerEl = host.querySelector('#tam-open-timer');
    const setAngle = value => {
      angle = (value % 360 + 360) % 360;
      humanDraft.angleDeg = angle;
      if (arrow) arrow.style.transform = `rotate(${angle}deg)`;
      if (angleEl) angleEl.textContent = angle.toFixed(1);
    };
    const updateFromMouse = event => {
      if (locked || !pad) return;
      const rect = pad.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      setAngle(Math.atan2(y, x) * 180 / Math.PI);
    };
    const toggleLock = () => {
      locked = !locked;
      humanDraft.locked = locked;
      pad?.classList.toggle('tam-locked', locked);
      const btn = host.querySelector('#tam-lock');
      if (btn) btn.textContent = locked ? 'Unlock' : 'Lock';
      message(locked ? 'Angle locked.' : 'Angle unlocked.');
    };
    pad?.addEventListener('mousemove', updateFromMouse);
    pad?.addEventListener('click', event => { updateFromMouse(event); toggleLock(); });
    host.querySelector('#tam-lock')?.addEventListener('click', toggleLock);
    host.querySelector('#tam-back')?.addEventListener('click', goToMenu);
    const submit = () => {
      if (pendingOpeningTimer) clearInterval(pendingOpeningTimer);
      pendingOpeningTimer = null;
      session.openingCommands[roundId] = { blueAngle:angle, redAngle:session.pendingCpu.opening.angleDeg };
      runRound(roundId, angle, session.pendingCpu.opening.angleDeg);
    };
    host.querySelector('#tam-confirm')?.addEventListener('click', submit);
    if (pendingOpeningTimer) clearInterval(pendingOpeningTimer);
    const started = performance.now();
    pendingOpeningTimer = setInterval(() => {
      remaining = Math.max(0, 10 - (performance.now() - started) / 1000);
      if (timerEl) timerEl.textContent = remaining.toFixed(1);
      if (remaining <= 0) submit();
    }, 100);
  }
  function roundHpBonus(roundId) {
    if (roundId !== 'round3') return { blue:0, red:0 };
    const bonus = { blue:0, red:0 };
    for (const side of SIDES) {
      const win = session.roundResults.find(r => r.winner === side);
      bonus[side] = Math.max(0, win ? (side === 'blue' ? win.blueRemainingHp : win.redRemainingHp) : 0);
    }
    return bonus;
  }
  function runRound(roundId, blueAngle, redAngle) {
    const round = roundInfo(roundId);
    const hpBonus = roundHpBonus(roundId);
    const blueId = session.finalLineup.blue[roundId], redId = session.finalLineup.red[roundId];
    activeRoundConfig = {
      roundId,
      blueChampion:blueId,
      redChampion:redId,
      damageMultiplier:Object.assign({}, round.damage),
      hpBonus,
      opening:{ blueAngle, redAngle, durationMs:1000 },
      startedAt:performance.now(),
      enteredRunning:true
    };
    console.info(`[TamChien] ${round.short} ROUND_RUNNING started`, activeRoundConfig);
    hideScreens();
    document.getElementById('hud').style.opacity = 1;
    addRunningBadge(`${round.label}: ${blueId} vs ${redId}`);
    startSpecificMatch(ft(blueId), ft(redId), { countdown:false, tournament:false, tamChienRound:true, tamRoundConfig:activeRoundConfig });
    logPhase(roundPhase(roundId, 'RUNNING'));
  }
  function buildRoundResultFromEngine() {
    const cfg = activeRoundConfig;
    if (!cfg || !cfg.enteredRunning) throw new Error('Tam Chien round result rejected: round never entered RUNNING');
    const blue = fighters[0], red = fighters[1];
    const winnerSide = blue.hp > red.hp ? 'blue' : 'red';
    const loserSide = winnerSide === 'blue' ? 'red' : 'blue';
    const durationMs = Math.max(0, matchClock * 1000);
    if (durationMs < 250) throw new Error('Tam Chien round result rejected: duration too short for a real match-over event');
    console.info(`[TamChien] ${cfg.roundId} match-over received`, { durationMs, winner:winnerSide });
    return {
      roundId:cfg.roundId,
      winner:winnerSide,
      loser:loserSide,
      blueChampion:cfg.blueChampion,
      redChampion:cfg.redChampion,
      blueRemainingHp:Math.max(0, Number(blue.hp || 0)),
      redRemainingHp:Math.max(0, Number(red.hp || 0)),
      durationMs,
      endedBy:'KO',
      damageMultiplier:clone(cfg.damageMultiplier),
      hpBonus:clone(cfg.hpBonus),
      stats:{
        blueDamageDealt:Number(blue.damageDone || 0),
        redDamageDealt:Number(red.damageDone || 0)
      }
    };
  }
  function recordRoundResult(result) {
    session.roundResults.push(result);
    session.score[result.winner] += 1;
    console.info(`[TamChien] ${result.roundId} result recorded`, result);
    activeRoundConfig = null;
    logPhase(roundPhase(result.roundId, 'RESULT'));
    renderRoundResult(result);
  }
  function renderRoundResult(result) {
    showTam();
    const host = root();
    if (!host) return;
    const done = session.score.blue >= 2 || session.score.red >= 2 || result.roundId === 'round3';
    host.innerHTML = `${headerHtml(`${roundInfo(result.roundId).label} Result`, `${result.winner.toUpperCase()} wins after ${(result.durationMs/1000).toFixed(1)}s`)}
      <div class="tam-board">
        <div class="tam-panel"><h3>Round Result</h3><div class="tam-log">
          <div>Winner: <b class="${result.winner === 'blue' ? 'tam-blue' : 'tam-red'}">${result.winner.toUpperCase()}</b></div>
          <div>Blue ${esc(result.blueChampion)} HP: ${result.blueRemainingHp.toFixed(1)}</div>
          <div>Red ${esc(result.redChampion)} HP: ${result.redRemainingHp.toFixed(1)}</div>
          <div>Blue damage: ${result.stats.blueDamageDealt.toFixed(1)} | Red damage: ${result.stats.redDamageDealt.toFixed(1)}</div>
        </div></div>
        <div class="tam-panel"><h3>Next</h3><div class="tam-actions"><button class="tam-button primary" id="tam-next">${done ? 'Show Battle Result' : 'Continue'}</button><button class="tam-button" id="tam-back">Main Menu</button></div></div>
      </div>`;
    host.querySelector('#tam-back')?.addEventListener('click', goToMenu);
    host.querySelector('#tam-next')?.addEventListener('click', () => {
      if (session.score.blue >= 2 || session.score.red >= 2) return completeBattle();
      if (result.roundId === 'round1') return enterOpening('round2');
      if (result.roundId === 'round2') return session.score.blue === 1 && session.score.red === 1 ? enterOpening('round3') : completeBattle();
      completeBattle();
    });
  }
  function completeBattle() {
    session.winner = session.score.blue > session.score.red ? 'blue' : 'red';
    logPhase('BATTLE_COMPLETE');
    showTam();
    const host = root();
    if (!host) return;
    const rows = session.roundResults.map(r => `<div>${esc(roundInfo(r.roundId).short)}: <b class="${r.winner === 'blue' ? 'tam-blue' : 'tam-red'}">${r.winner.toUpperCase()}</b> won (${r.blueChampion} vs ${r.redChampion}) - winner HP ${(r.winner === 'blue' ? r.blueRemainingHp : r.redRemainingHp).toFixed(1)}</div>`).join('');
    const openings = ROUND_IDS.map(id => session.openingCommands[id]?.blueAngle == null ? '' : `<div>${roundInfo(id).short}: Blue ${session.openingCommands[id].blueAngle.toFixed(1)} deg | Red ${session.openingCommands[id].redAngle.toFixed(1)} deg</div>`).join('');
    host.innerHTML = `${headerHtml('Tam Chien Complete', `${session.winner.toUpperCase()} wins ${session.score.blue}-${session.score.red}`)}
      <div class="tam-board">
        <div class="tam-panel"><h3>Per-Round Winners</h3><div class="tam-log">${rows}</div><h3 style="margin-top:12px">Final Lineup</h3>${lineupsHtml(true)}</div>
        <div class="tam-panel"><h3>Match Notes</h3>${bansHtml()}<h3 style="margin-top:12px">Swaps</h3><div class="tam-log"><div>Blue: ${esc(swapLabel(session.swaps.blue))}</div><div>Red: ${esc(swapLabel(session.swaps.red))}</div></div><h3 style="margin-top:12px">Opening Angles</h3><div class="tam-log">${openings}</div>
          <div class="tam-actions"><button class="tam-button primary" id="tam-again">Play Again</button><button class="tam-button" id="tam-menu">Main Menu</button></div></div>
      </div>`;
    host.querySelector('#tam-again')?.addEventListener('click', window.startTamChienMode);
    host.querySelector('#tam-menu')?.addEventListener('click', goToMenu);
  }
  function addRunningBadge(text) {
    removeRunningBadge();
    const badge = document.createElement('div');
    badge.id = 'tam-running-badge';
    badge.className = 'tam-running-badge';
    badge.textContent = text;
    document.getElementById('game-wrapper')?.appendChild(badge);
  }
  function removeRunningBadge() {
    document.getElementById('tam-running-badge')?.remove();
  }

  window.startTamChienMode = function startTamChienMode() {
    const valid = validateChampionPool();
    session = createSession();
    humanDraft = { championId:null, roundId:null };
    if (!valid.ok) {
      showTam();
      const host = root();
      if (host) host.innerHTML = `${headerHtml('Tam Chien Disabled', 'Developer-facing roster validation failed.')}<div class="tam-panel"><h3>Missing Champions</h3><div class="tam-message">${esc(valid.message)}</div><div class="tam-actions"><button class="tam-button" id="tam-back">Main Menu</button></div></div>`;
      host?.querySelector('#tam-back')?.addEventListener('click', goToMenu);
      return;
    }
    session.pendingCpu.ban = chooseCpuBan(session);
    logPhase('BAN_PHASE');
    renderBan();
  };

  const prevStartTamRound = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts = {}) {
    const result = prevStartTamRound(ft1, ft2, opts);
    if (opts?.tamChienRound && opts.tamRoundConfig && fighters[0] && fighters[1]) {
      const cfg = opts.tamRoundConfig;
      try { window.APEX_ENGINEER?.clearMatch?.(); } catch (error) {}
      fighters[0].data.tamSide = 'blue';
      fighters[1].data.tamSide = 'red';
      fighters[0].ownerSide = 'blue';
      fighters[1].ownerSide = 'red';
      fighters[0].data.tamOpening = { vector:angleToVector(cfg.opening.blueAngle), until:1 };
      fighters[1].data.tamOpening = { vector:angleToVector(cfg.opening.redAngle), until:1 };
      for (const [idx, side] of [['0','blue'], ['1','red']]) {
        const f = fighters[Number(idx)];
        const bonus = Math.max(0, cfg.hpBonus?.[side] || 0);
        if (bonus > 0) {
          f.maxHp += bonus;
          f.hp += bonus;
          f.data.tamHpBonus = bonus;
        }
        f.data.tamDamageMultiplier = cfg.damageMultiplier?.[side] || 1;
      }
      autoBattleControlsActive = false;
      autoBattlePaused = false;
      updateAutoBattleControls();
      updateHUD(true);
    }
    return result;
  };

  const prevEndTamRound = endMatch;
  endMatch = function(...args) {
    if (session && activeRoundConfig && gameState === 'PLAYING') {
      let roundResult = null;
      try {
        roundResult = buildRoundResultFromEngine();
      } catch (error) {
        console.error('[TamChien] round result guard failed', error);
      }
      const result = prevEndTamRound.apply(this, args);
      removeRunningBadge();
      window.setTimeout(() => {
        document.getElementById('end-screen')?.classList.add('hidden');
        if (roundResult) recordRoundResult(roundResult);
      }, 760);
      return result;
    }
    return prevEndTamRound.apply(this, args);
  };

  const prevUpdateTamOpening = update;
  update = function(dt) {
    if (activeRoundConfig && gameState === 'PLAYING') {
      for (const f of fighters || []) {
        const opening = f?.data?.tamOpening;
        if (!opening || matchClock >= opening.until) continue;
        f.setDir(opening.vector.x, opening.vector.y);
        f.statuses.abilityDisabled = { timer:.08, max:.08, source:f };
      }
    }
    return prevUpdateTamOpening(dt);
  };

  const prevDamageTam = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source = null, label = '', statusDamage = false) {
    if (activeRoundConfig && amount > 0 && source && source !== this) {
      const ownerSide = source.ownerSide || source.data?.tamSide || source.ownerSide || source.owner?.ownerSide || source.owner?.data?.tamSide;
      if (ownerSide === 'blue' || ownerSide === 'red') {
        const mult = activeRoundConfig.damageMultiplier?.[ownerSide] ?? 1;
        if (mult !== 1) amount *= mult;
      } else if (window.__APEX_TAM_CHIEN_DEBUG_DAMAGE) {
        console.debug('[TamChien] owned damage source missing side', { label, source });
      }
    }
    return prevDamageTam.call(this, amount, source, label, statusDamage);
  };

  const prevMenuTam = goToMenu;
  goToMenu = function(...args) {
    if (pendingOpeningTimer) clearInterval(pendingOpeningTimer);
    pendingOpeningTimer = null;
    session = null;
    activeRoundConfig = null;
    removeRunningBadge();
    document.getElementById('tam-chien-screen')?.classList.add('hidden');
    return prevMenuTam.apply(this, args);
  };

  if (typeof exposeApexGlobal === 'function') exposeApexGlobal('startTamChienMode', window.startTamChienMode);
  Object.assign(window.apexReactBridge || {}, { startTamChienMode:window.startTamChienMode, goToMenu, startSpecificMatch, endMatch });
  Object.assign(window, window.apexReactBridge || {}, { startTamChienMode:window.startTamChienMode, goToMenu, startSpecificMatch, endMatch });
})();
