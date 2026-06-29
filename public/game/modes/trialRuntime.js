// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_TRIAL_MODE_PATCH(){
  if (window.apexTrialModePatch === 'ready') return;
  const SAITAMA_ASSET = '/assets/saitama/saitama-boss.webp';
  const saitamaImage = new Image();
  saitamaImage.src = SAITAMA_ASSET;
  const trialState = {
    active: false,
    selectedType: null,
    bossMaxHp: 1000,
    bossHpLabel: '1000',
    startedAt: 0,
    endedReason: ''
  };
  window.apexTrialState = trialState;

  function fmtTrial(n) {
    if (!Number.isFinite(n)) return 'INF';
    if (Math.abs(n) >= 1000000) return n.toExponential(2);
    return n.toFixed(Math.abs(n) >= 100 ? 0 : 1);
  }

  function parseTrialBossHp() {
    const raw = String(document.getElementById('trial-boss-hp')?.value || '1000').trim().toLowerCase();
    if (!raw || raw === '∞' || raw === 'inf' || raw === 'infinity' || raw === 'vo cuc' || raw === 'vô cực') {
      return { value: Number.MAX_SAFE_INTEGER, label: 'INF' };
    }
    const cleaned = raw.replace(/,/g, '');
    const value = Math.max(1, Number(cleaned));
    if (!Number.isFinite(value)) return { value: 1000, label: '1000' };
    return { value, label: value >= Number.MAX_SAFE_INTEGER ? 'INF' : fmtTrial(value) };
  }

  const SAITAMA_TYPE = {
    name: 'SAITAMA',
    color: '#f4e7b8',
    desc: 'Trial boss: non-lethal normal punch every 10s',
    speed: 360,
    startDx: -1,
    startDy: 0.34,
    noRage: true,
    init: f => {
      f.data.punchCd = 10;
      f.data.trialBoss = true;
    },
    update: (f, e, dt) => {
      if (!trialState.active || !e || e.hp <= 0) return;
      f.data.punchCd = (f.data.punchCd ?? 10) - dt;
      if (f.data.punchCd > 0) return;
      f.data.punchCd += 10;
      const amount = Math.min(10, Math.max(0, e.hp - 1));
      playFighterSound(f, 'skill');
      spawnShockwave(e.x, e.y, '#f4e7b8', 120);
      if (amount > 0) {
        e.hp = Math.max(1, e.hp - amount);
        e.damageTaken = (e.damageTaken || 0) + amount;
        e.standardDamageTaken = (e.standardDamageTaken || 0) + amount;
        f.damageDone = (f.damageDone || 0) + amount;
        f.standardDamageDone = (f.standardDamageDone || 0) + amount;
        f.hitsLanded = (f.hitsLanded || 0) + 1;
        f.maxHit = Math.max(f.maxHit || 0, amount);
        f.damageLabels['saitama-nonlethal-punch'] = (f.damageLabels['saitama-nonlethal-punch'] || 0) + amount;
        f.standardDamageLabels ||= {};
        f.standardDamageLabels['saitama-nonlethal-punch'] = (f.standardDamageLabels['saitama-nonlethal-punch'] || 0) + amount;
        emitParticles(e.x, e.y, '#f4e7b8', 12, 210, 4, .3, 'square');
        if (e.hp < 1) e.hp = 1;
      }
      updateHUD();
    },
    draw: (ctx, f) => {
      const r = f.radius * 1.35;
      if (saitamaImage.complete && saitamaImage.naturalWidth > 0) {
        const ratio = saitamaImage.naturalHeight / saitamaImage.naturalWidth;
        const w = r * 2.35;
        const h = w * ratio;
        ctx.save();
        ctx.rotate(-Math.atan2(f.dir.y, f.dir.x));
        ctx.shadowColor = 'rgba(0,0,0,.62)';
        ctx.shadowBlur = 16;
        ctx.drawImage(saitamaImage, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        drawSketchBlob(ctx, f.radius, '#f4e7b8', 11);
        ctx.fillStyle = '#111';
        ctx.font = '900 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('OK', 0, 6);
      }
    }
  };

  function hideTrialUi() {
    document.getElementById('trial-screen')?.classList.add('hidden');
    const hud = document.getElementById('trial-hud');
    if (hud) hud.style.display = 'none';
  }

  function hideTrialHudOnly() {
    const hud = document.getElementById('trial-hud');
    if (hud) hud.style.display = 'none';
  }

  function renderTrialRoster() {
    const host = document.getElementById('trial-roster');
    const title = document.getElementById('trial-title');
    if (!host) return;
    host.innerHTML = '';
    trialState.selectedType = null;
    document.getElementById('trial-start-btn')?.classList.add('hidden');
    if (title) title.textContent = 'SELECT TEST FIGHTER';
    FighterTypes.forEach(ft => {
      const card = document.createElement('div');
      card.className = 'solo-card';
      card.dataset.name = ft.name;
      card.style.borderColor = ft.color || '#5f584b';
      card.innerHTML = `<div class="f-icon" style="color:${ft.color || '#fff'}">${fighterGlyph(ft.name)}</div><div class="f-name" style="color:${ft.color || '#fff'}">${ft.name}</div><span class="f-desc">${ft.desc || ''}</span>`;
      card.onclick = () => {
        trialState.selectedType = ft;
        host.querySelectorAll('.solo-card').forEach(node => node.classList.toggle('selected-p1', node === card));
        document.getElementById('trial-start-btn')?.classList.remove('hidden');
        if (title) title.textContent = `${ft.name} VS SAITAMA`;
      };
      host.appendChild(card);
    });
  }

  function goToTrialSelect() {
    if (typeof stopBattleAudio === 'function') stopBattleAudio();
    ['menu-screen','select-screen','tournament-screen','end-screen','solo-screen'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('trial-screen')?.classList.remove('hidden');
    document.getElementById('hud').style.opacity = 0;
    const soloHud = document.getElementById('solo-hud');
    if (soloHud) soloHud.style.display = 'none';
    hideTrialHudOnly();
    trialState.active = false;
    gameState = 'TRIAL_SELECT';
    renderTrialRoster();
  }

  function startTrialMode() {
    const ft = trialState.selectedType;
    if (!ft) return;
    const hp = parseTrialBossHp();
    trialState.active = true;
    trialState.bossMaxHp = hp.value;
    trialState.bossHpLabel = hp.label;
    trialState.startedAt = performance.now();
    trialState.endedReason = '';
    startSpecificMatch(ft, SAITAMA_TYPE, { countdown:false, tournament:false, trial:true });
    const boss = fighters[1];
    if (boss) {
      boss.maxHp = hp.value;
      boss.hp = hp.value;
      boss.data.trialInfiniteHp = hp.label === 'INF';
      boss.data.configuredHpLabel = hp.label;
      boss.radius = 82;
      boss.baseRadius = 82;
    }
    document.getElementById('trial-screen')?.classList.add('hidden');
    const hud = document.getElementById('trial-hud');
    if (hud) hud.style.display = 'flex';
    updateHUD();
    updateTrialHud();
  }

  function sourceRows(f) {
    const labels = Object.entries(f?.damageLabels || {}).sort((a,b)=>b[1]-a[1]).slice(0, 8);
    if (!labels.length) return '<div>No damage source recorded</div>';
    return labels.map(([k,v]) => `<div><span>${k}</span><b>${fmtTrial(v)}</b></div>`).join('');
  }

  function statLine(label, value) {
    return `<div class="stat-line"><span>${label}</span><b>${value}</b></div>`;
  }

  function buildTrialPostMatchStats(hero, boss, reason) {
    const duration = Math.max(0.1, matchClock || ((performance.now() - trialState.startedAt) / 1000));
    const dps = (hero.damageDone || 0) / duration;
    const takenPerMinute = (hero.damageTaken || 0) / duration * 60;
    const bossRemaining = boss.data?.trialInfiniteHp ? 'INF' : `${fmtTrial(Math.max(0, boss.hp))} / ${fmtTrial(boss.maxHp)}`;
    return `
      <div class="stats-headline">DAU THU COMPLETE: ${hero.name} tested against SAITAMA</div>
      <div class="battle-tags">
        <span class="battle-tag">${duration.toFixed(1)}s test</span>
        <span class="battle-tag">${reason}</span>
        <span class="battle-tag">Boss HP ${trialState.bossHpLabel}</span>
        <span class="battle-tag">DPS ${dps.toFixed(2)}</span>
      </div>
      <div class="stats-grid">
        <div class="stat-card" style="border-color:${hero.color}88">
          <h3 style="color:${hero.color}"><span>${hero.name}</span><span>TESTED</span></h3>
          ${statLine('Final HP', `${fmtTrial(hero.hp)} / ${fmtTrial(hero.maxHp)}`)}
          ${statLine('Damage dealt', fmtTrial(hero.damageDone || 0))}
          ${statLine('DPS', dps.toFixed(2))}
          ${statLine('Damage taken', fmtTrial(hero.damageTaken || 0))}
          ${statLine('Taken per minute', takenPerMinute.toFixed(1))}
          ${statLine('Healing', fmtTrial(hero.healingDone || 0))}
          ${statLine('Hits / biggest', `${hero.hitsLanded || 0} / ${fmtTrial(hero.maxHit || 0)}`)}
          ${statLine('DOT/status damage', fmtTrial(hero.dotDamage || 0))}
          ${statLine('Skill pulses', hero.skillsUsed || 0)}
          ${statLine('Rage', hero.isRage ? 'Activated' : 'Not activated')}
          ${statLine('Standard damage', fmtTrial(hero.standardDamageDone || 0))}
          ${statLine('Normal damage', fmtTrial(hero.normalDamageDone || 0))}
        </div>
        <div class="stat-card" style="border-color:#f4e7b888">
          <h3 style="color:#f4e7b8"><span>SAITAMA</span><span>BOSS</span></h3>
          ${statLine('Boss HP left', bossRemaining)}
          ${statLine('Damage taken', fmtTrial(boss.damageTaken || 0))}
          ${statLine('Punch damage dealt', fmtTrial(boss.damageDone || 0))}
          ${statLine('Punch count', boss.hitsLanded || 0)}
          ${statLine('Rule', '10 damage / 10s, non-lethal')}
        </div>
      </div>
      <div class="timeline trial-source-list"><h4>${hero.name} DAMAGE SOURCES</h4>${sourceRows(hero)}</div>`;
  }

  function finishTrial(reason = 'manual stop') {
    if (gameState !== 'PLAYING' && gameState !== 'END') return;
    const hero = fighters[0];
    const boss = fighters[1];
    if (!hero || !boss) return;
    gameState = 'END';
    trialState.active = false;
    trialState.endedReason = reason;
    playFighterSound(hero, 'skill');
    if (typeof fadeBattleAudio === 'function') fadeBattleAudio(.95, false);
    document.getElementById('winner-text').innerText = `${hero.name} TEST COMPLETE`;
    document.getElementById('winner-text').style.color = hero.color;
    document.getElementById('stats-panel').innerHTML = buildTrialPostMatchStats(hero, boss, reason);
    document.getElementById('tournament-return-btn')?.classList.add('hidden');
    document.getElementById('challenge-retry-btn')?.classList.add('hidden');
    hideTrialHudOnly();
    setTimeout(() => {
      document.getElementById('end-screen').classList.remove('hidden');
      document.getElementById('hud').style.opacity = 0;
    }, 250);
  }

  function endTrialMode() {
    finishTrial('manual stop');
  }

  function updateTrialHud() {
    if (!trialState.active) return;
    const hero = fighters[0];
    const boss = fighters[1];
    const elapsed = Math.max(0, matchClock || ((performance.now() - trialState.startedAt) / 1000));
    const clock = document.getElementById('trial-clock');
    const bossReadout = document.getElementById('trial-boss-hp-readout');
    if (clock) clock.textContent = `${elapsed.toFixed(1)}s`;
    if (bossReadout && boss) bossReadout.textContent = `SAITAMA HP ${boss.data?.trialInfiniteHp ? 'INF' : `${fmtTrial(Math.max(0, boss.hp))} / ${fmtTrial(boss.maxHp)}`}`;
    if (hero && hero.hp <= 0) hero.hp = 1;
  }

  const baseEndMatch = endMatch;
  endMatch = function(){
    if (trialState.active) {
      const boss = fighters[1];
      finishTrial(boss && boss.hp <= 0 ? 'boss defeated' : 'test stopped');
      return;
    }
    return baseEndMatch();
  };

  const baseUpdateTrial = update;
  update = function(dt){
    baseUpdateTrial(dt);
    updateTrialHud();
  };

  const baseUpdateHudTrial = updateHUD;
  updateHUD = function(){
    baseUpdateHudTrial();
    const boss = fighters[1];
    if (trialState.active && boss && boss.name === 'SAITAMA' && boss.data?.trialInfiniteHp) {
      const bar = document.getElementById('p2-hp');
      if (bar) bar.style.width = '100%';
      const hpText = document.getElementById('p2-hp-text');
      if (hpText) hpText.textContent = 'INF';
    }
  };

  const oldMenu = goToMenu;
  goToMenu = function(){ trialState.active = false; hideTrialUi(); return oldMenu(); };
  const oldSelect = goToSelect;
  goToSelect = function(){ trialState.active = false; hideTrialUi(); return oldSelect(); };
  const oldTournament = goToTournament;
  goToTournament = function(){ trialState.active = false; hideTrialUi(); return oldTournament(); };
  const oldSoloSelect = window.goToSoloSelect;
  if (typeof oldSoloSelect === 'function') {
    window.goToSoloSelect = function(){ trialState.active = false; hideTrialUi(); return oldSoloSelect(); };
  }

  window.goToTrialSelect = goToTrialSelect;
  window.startTrialMode = startTrialMode;
  window.endTrialMode = endTrialMode;
  Object.assign(window.apexReactBridge || {}, { goToTrialSelect, startTrialMode, endTrialMode });
  window.apexTrialModePatch = 'ready';
})();

(function(){
  if (window.__apexAutoBattleSettingsPatch) return;
  window.__apexAutoBattleSettingsPatch = true;
  const prevTakeDamageAutoBattleSettings = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source = null, label = '', statusDamage = false) {
    if (source && source !== this && source.data && Number.isFinite(source.data.autoBattleDamageMult)) {
      amount *= clamp(source.data.autoBattleDamageMult, 1, 10);
    }
    return prevTakeDamageAutoBattleSettings.call(this, amount, source, label, statusDamage);
  };
  Object.assign(window, { toggleAutoBattlePause, restartAutoBattle, exitAutoBattle });
})();
