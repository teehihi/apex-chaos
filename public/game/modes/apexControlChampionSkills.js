(function APEX_CONTROL_CHAMPION_SKILLS(){
  if (window.__apexControlChampionSkillsV2) return;
  window.__apexControlChampionSkillsV2 = true;

  const supported = Object.freeze(['SHOTGUN','KATANA','ENGINEER','GALAXY','ICE','NINJA','SOCCER','STRING','FANG']);
  const actionForKey = Object.freeze({ LMB:'PRIMARY', RMB:'SECONDARY', Q:'ABILITY_1', E:'ABILITY_2', R:'APEX' });
  const keys = Object.freeze(['LMB','RMB','Q','E','R']);
  const S = (key, name, cd, detail) => Object.freeze({ key, name, cd, detail });
  const kit = Object.freeze({
    SHOTGUN:[
      S('LMB','Scatter Shot',.64,'Aim cone pellet shot. Uses real shotgun rays and shell heat.'),
      S('RMB','Hook Breach',5.5,'Targeted hook at 700-820 range, then pump breach shot.'),
      S('Q','Counter Blast',7,'Close anti-dive blast, reloads shells and knocks back.'),
      S('E','Cooling Reload',4.5,'Dump heat and refill shells without firing.'),
      S('R','Double Barrel',10,'Two tight aim shots in quick succession.')
    ],
    KATANA:[
      S('LMB','Adaptive Slash',2,'Original manual Katana attack selector.'),
      S('RMB','Collision Execution',5,'Original manual execution slash.'),
      S('Q','Dash / Refresh',5,'Original manual dash and refresh window.'),
      S('E','Clone Evade',7,'Original manual clone swap evade.'),
      S('R','Lunar Rewrite',10,'Original manual Pink Moon clone rewrite.')
    ],
    ENGINEER:[
      S('LMB','Build / Fire',0,'Place selected blueprint; War Machine fires laser.'),
      S('RMB','Magnet Pulse',0,'Pull scrap and loose objects to Engineer.'),
      S('Q','Previous Blueprint',0,'Cycle turret / repair / factory.'),
      S('E','Mine',5,'Place a mine at a valid aim point.'),
      S('R','War Machine',10,'Summon, merge with, or exit War Machine.')
    ],
    GALAXY:[
      S('LMB','Planet Throw',1.05,'Throw an orbit planet along aim; explodes through Galaxy runtime.'),
      S('RMB','Pressure Walk',7,'Mark a visible target for wall-pressure punishment.'),
      S('Q','Bluehole',14,'Dash to a visible target and hold them in Bluehole.'),
      S('E','Galaxy Divine',16,'Safe blink to a visible target and start Divine punch.'),
      S('R','Galaxy Impact',24,'Move to center and trigger Impact split field.')
    ],
    ICE:[
      S('LMB','Ice Dart',.72,'Fast homing shard against the aimed visible target.'),
      S('RMB','Ice Lane',5,'Create a full lane in the aim direction.'),
      S('Q','Flash Freeze',7,'Freeze the aimed visible target and stage ice darts.'),
      S('E','Ice Age',13,'Start the original Ice Age cast and arena freeze.'),
      S('R','Absolute Ice Age',22,'Rage Ice Age with instant freeze pressure.')
    ],
    NINJA:[
      S('LMB','Shuriken',.45,'Straight shuriken along aim using Ninja projectile runtime.'),
      S('RMB','Flying Thunder Kunai',5,'Throw a bouncing kunai; hit/timeout enables teleport.'),
      S('Q','Body Flicker',4,'Safe blink to aim point and cleanse control.'),
      S('E','Rasengan Strike',8,'Teleport behind a visible target and strike.'),
      S('R','Shadow Storm',12,'Fan shuriken burst plus short immunity.')
    ],
    SOCCER:[
      S('LMB','Dribble Kick',.55,'Low-power ball touch in aim direction.'),
      S('RMB','Shoot',4,'Power shot through the Soccer ball runtime.'),
      S('Q','Recover Possession',6,'Recover / reset ball possession if allowed.'),
      S('E','Chase Down',9,'Start Soccer chase intercept instead of teleport snapping.'),
      S('R','Penalty',18,'Trigger the original penalty cinematic on a valid target.')
    ],
    STRING:[
      S('LMB','Stringshot',.65,'Straight string line; damages only a visible aimed target.'),
      S('RMB','Overheat Whip',4.5,'Wide hot whip with push on a visible aimed target.'),
      S('Q','Web Lock',7,'Bind the visible target with body-thread VFX.'),
      S('E','Five-Color String',10,'Five slash sequence on a visible target.'),
      S('R','God Threads',18,'God-thread pierce and parasite on a visible target.')
    ],
    FANG:[
      S('LMB','Collision Bite',.55,'Short targeted bite pounce for close fights.'),
      S('RMB','Hunting Pounce',5,'Long pounce with wall rebound logic.'),
      S('Q','Blood Hunt',4,'Toggle hunt stance and speed pressure.'),
      S('E','Lunar-Solar Howl',10,'Original howl windup to summon Moon/Sun clones.'),
      S('R','Three-Wolf Pounce',12,'Clone-backed hunting pounce; needs clones.')
    ]
  });

  function manual(f) {
    return !!(f?.data?.manualController?.active && f.data.manualController.mode === 'MANUAL_LAB');
  }
  function live(x) {
    return !!(x && x.hp > 0 && !x.dead && !x.data?.galaxyRemoved);
  }
  function stateFor(f) {
    f.data ||= {};
    const s = f.data.apexControlSkills || (f.data.apexControlSkills = { cd:{}, last:'READY', failed:false });
    s.cd ||= {};
    return s;
  }
  function setLast(f, text, failed=false) {
    const s = stateFor(f);
    s.last = text || 'READY';
    s.failed = !!failed;
  }
  function tickCooldowns(f, dt) {
    const s = stateFor(f);
    for (const key of Object.keys(s.cd)) s.cd[key] = Math.max(0, (s.cd[key] || 0) - dt);
    if (f?.name === 'STRING') {
      const d = f.data;
      if (d.stringStateTimer > 0) {
        d.stringStateTimer = Math.max(0, d.stringStateTimer - dt);
        if (d.stringStateTimer <= 0 && !['five','god'].includes(d.stringState)) d.stringState = 'idle';
      }
      if (d.stringFiveDuration > 0 && d.stringState === 'five') {
        d.stringFiveDuration = Math.max(0, d.stringFiveDuration - dt);
        if (d.stringFiveDuration <= 0) d.stringState = 'idle';
      }
    }
  }
  function useSkill(f, key, cd, label, fn) {
    const s = stateFor(f);
    const left = s.cd[key] || 0;
    if (left > 0) {
      setLast(f, `${key} ${left.toFixed(1)}s`, true);
      return false;
    }
    const result = fn();
    if (result === true || result?.ok) {
      s.cd[key] = cd;
      setLast(f, label || key, false);
      return true;
    }
    const reason = typeof result === 'string' ? result : result?.reason;
    setLast(f, reason || `${key} failed`, true);
    return false;
  }
  function consumeKey(c, key) {
    return !!c?.consume?.(actionForKey[key]);
  }
  function aimPoint(f, c, dir=null, range=760) {
    const p = c?.getAimPoint?.();
    if (p && c?.hasAimPoint?.() && Number.isFinite(p.x) && Number.isFinite(p.y)) return {x:p.x,y:p.y};
    const n = dir || aimDir(f, c, null);
    return {x:f.x + n.x * range, y:f.y + n.y * range};
  }
  function aimDir(f, c, fallbackTarget=null) {
    const p = c?.getAimPoint?.();
    if (p && c?.hasAimPoint?.() && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      const n = norm(p.x - f.x, p.y - f.y);
      if (n.x || n.y) return n;
    }
    if (fallbackTarget && Number.isFinite(fallbackTarget.x) && Number.isFinite(fallbackTarget.y)) {
      const n = norm(fallbackTarget.x - f.x, fallbackTarget.y - f.y);
      if (n.x || n.y) return n;
    }
    return norm(f.dir?.x || 1, f.dir?.y || 0);
  }
  function face(f, dir) {
    if (!dir || (!dir.x && !dir.y)) return;
    f.setDir?.(dir.x, dir.y);
    if (f.name === 'SOCCER') window.APEX_SOCCER?.manualApi?.setForward?.(f, dir.x, dir.y);
  }
  function wallApi() {
    return window.APEX_CONTROL_BATTLE_WALLS || null;
  }
  function lineClear(a, b, padding=16) {
    const api = wallApi();
    if (!api?.active?.() || !api.hasLineOfSight) return true;
    return !!api.hasLineOfSight(a, b, padding);
  }
  function blockedAt(point, radius=0) {
    const api = wallApi();
    return !!(api?.active?.() && api.isBlocked?.(point.x, point.y, radius));
  }
  function safePointFrom(f, point, radius=f?.radius || 60) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const p = { x:clamp(point.x, radius, GAME_SIZE - radius), y:clamp(point.y, radius, GAME_SIZE - radius) };
    if (blockedAt(p, radius)) return null;
    if (!lineClear(f, p, Math.min(42, radius * .45))) return null;
    return p;
  }
  function rayEnd(f, dir) {
    if (typeof pointOnRayToEdge === 'function') return pointOnRayToEdge(f.x, f.y, dir.x, dir.y);
    const tx = dir.x > 0 ? (GAME_SIZE - f.x) / dir.x : dir.x < 0 ? -f.x / dir.x : Infinity;
    const ty = dir.y > 0 ? (GAME_SIZE - f.y) / dir.y : dir.y < 0 ? -f.y / dir.y : Infinity;
    const t = Math.max(0, Math.min(tx, ty, 1800));
    return {x:f.x + dir.x * t, y:f.y + dir.y * t};
  }
  function aimProxy(f, dir, range=900) {
    return { x:f.x + dir.x * range, y:f.y + dir.y * range, radius:1, hp:1, data:{}, name:'AIM_PROXY' };
  }
  function normalizeMoveVector(c) {
    const m = c?.getMoveVector?.() || {x:0,y:0};
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return {x:0,y:0};
    const len = Math.hypot(m.x, m.y);
    return len > 0 ? {x:m.x/len, y:m.y/len} : {x:0,y:0};
  }
  function majorActionLocked(f) {
    const d = f?.data || {};
    if (d.galaxyRemoved || d.soccerPenaltyCinematicActive || d.soccerChaseDownActive) return true;
    if (['BLUEHOLE','DIVINE','IMPACT'].includes(d.galaxyState)) return true;
    const s = d.shotgun;
    if (s?.hookSequence || s?.counterMotion || d.shotgunKnockback) return true;
    const fang = d.fang;
    if (fang?.action || fang?.state === 'HOWL_48') return true;
    const katana = d.katana, manual = katana?.manual;
    if (katana?.action || manual?.qDash || manual?.rewrite || manual?.rCharge) return true;
    return false;
  }
  function rememberManualIntent(f, c, dir) {
    if (!f) return;
    f.data ||= {};
    const move = normalizeMoveVector(c);
    const aim = dir && (dir.x || dir.y) ? dir : aimDir(f, c, null);
    f.data.apexControlManualMove = move;
    f.data.apexControlManualAimDir = {x:aim.x || 1, y:aim.y || 0};
    f.data.apexControlManualBaseLock = true;
    f.data.apexControlManualActionLock = majorActionLocked(f);
    // Fighter.update() moves along f.dir after type.update(). In Control, f.dir is
    // now reserved for visual/aim direction; manual WASD movement is applied by
    // manualLab.js after the base update, so the base step must stay suppressed.
    f.data.positionLocked = true;
  }
  function sameSide(a, b) {
    if (!a || !b) return false;
    const ta = a.teamId ?? a.owner?.teamId ?? a.owner?.id ?? a.id;
    const tb = b.teamId ?? b.owner?.teamId ?? b.owner?.id ?? b.id;
    return ta === tb;
  }
  function candidatesFor(f) {
    const out = [];
    const list = fighters || [];
    const fIndex = list.indexOf(f);
    const duel = fIndex === 0 ? list[1] : fIndex === 1 ? list[0] : null;
    if (live(duel)) out.push(duel);
    for (const q of list) {
      if (!live(q) || q === f || q === duel) continue;
      if (sameSide(f, q) && !q.data?.apexControlBoss) continue;
      out.push(q);
    }
    return out;
  }
  function targetInAim(f, c, opts={}) {
    const range = opts.range ?? 760;
    const cone = opts.cone ?? .42;
    const minRange = opts.minRange ?? 0;
    const requireLos = opts.los !== false;
    const dir = aimDir(f, c, opts.fallback);
    let best = null;
    for (const q of candidatesFor(f)) {
      const dx = q.x - f.x, dy = q.y - f.y;
      const along = dx * dir.x + dy * dir.y;
      if (along < minRange || along > range) continue;
      const lateral = Math.abs(dx * dir.y - dy * dir.x);
      const allowed = (q.radius || 70) + (opts.width ?? 34) + along * Math.tan(cone);
      if (lateral > allowed) continue;
      if (requireLos && !lineClear(f, q, Math.min(42, (q.radius || 70) * .35))) continue;
      const score = lateral * 2 + along * .08 + (q.data?.apexControlBoss ? 80 : 0);
      if (!best || score < best.score) best = {target:q, score, dir};
    }
    return best?.target || null;
  }
  function nearestVisibleTarget(f, range=760) {
    return candidatesFor(f)
      .filter(q => dist(f.x,f.y,q.x,q.y) <= range && lineClear(f, q, Math.min(42, (q.radius || 70) * .35)))
      .sort((a,b) => dist(f.x,f.y,a.x,a.y) - dist(f.x,f.y,b.x,b.y))[0] || null;
  }
  function note(f, text, color=f?.color || '#fff') {
    if (!f || !window.FloatingText) return;
    floatingTexts.push(new FloatingText(f.x, f.y - (f.radius || 70) - 86, text, color));
  }
  function burst(target, owner, amount, label, color, radius=120, statusDamage=false) {
    if (!live(target)) return false;
    target.takeDamage(amount, owner, label, statusDamage);
    spawnShockwave?.(target.x, target.y, color || owner.color, radius);
    emitParticles?.(target.x, target.y, color || owner.color, 16, 320, 4.5, .38, 'square');
    return true;
  }
  function pushCustom(p) {
    p.apexCustom = true;
    p.life ??= Infinity;
    p.customLife ??= 2;
    p.maxCustomLife ??= p.customLife;
    projectiles.push(p);
    return p;
  }
  function cleanseControl(f, seconds=.9) {
    f.data.ninjaImmuneUntil = Math.max(f.data.ninjaImmuneUntil || 0, matchClock + seconds);
    for (const k of ['slow','push','burn','poison','freeze','bleed','stun','weak','brittle','scent','abilityDisabled','silenceCurse','hexBurn','rapidPunch','disease','paintRed','paintBlue','paintYellow','innerTrauma','mathGraphContact','mathFormulaContact']) {
      if (f.statuses) delete f.statuses[k];
    }
  }

  function primeShotgunManual(f, e, dt, old) {
    const s = f.data.shotgun;
    if (!s) return;
    const gate = s.nextShotReadyTime;
    s.nextShotReadyTime = Infinity;
    old?.(f, e, dt);
    if (s.nextShotReadyTime === Infinity) s.nextShotReadyTime = gate;
  }
  function shotgun(f, e, dt, c, old) {
    primeShotgunManual(f, e, dt, old);
    const api = window.APEX_SHOTGUN;
    const s = f.data.shotgun;
    if (!api || !s) return;
    const dir = aimDir(f, c, e);
    face(f, dir);
    if (consumeKey(c,'LMB')) useSkill(f,'LMB',.64,'SCATTER SHOT',() => {
      const t = targetInAim(f, c, {range:900,cone:.42,width:55,fallback:e,los:true}) || aimProxy(f, dir, 900);
      const ok = api.fireCycle(f, t, 'manual-primary', false, 1);
      return ok || 'NO SHELL / JAM';
    });
    if (consumeKey(c,'RMB')) useSkill(f,'RMB',5.5,'HOOK BREACH',() => {
      const t = targetInAim(f, c, {range:840,minRange:620,cone:.18,width:20,fallback:e});
      if (!t || !api.validHookPath?.(f,t)) return 'HOOK NEEDS 700-820 TARGET';
      s.hookBreachCharge = Math.max(1, s.hookBreachCharge || 0);
      return api.fireCycle(f, t, 'normal', false, .92) || 'NO SHELL / JAM';
    });
    if (consumeKey(c,'Q')) useSkill(f,'Q',7,'COUNTER BLAST',() => {
      const t = targetInAim(f, c, {range:220,cone:.9,width:90,fallback:e}) || nearestVisibleTarget(f, 190);
      if (!t) return 'COUNTER NEEDS CLOSE TARGET';
      s.counterBlastCharge = Math.max(1, s.counterBlastCharge || 0);
      api.counterBlast(f, t, 'manual-counter');
      return true;
    });
    if (consumeKey(c,'E')) useSkill(f,'E',4.5,'COOLING RELOAD',() => {
      api.startCooling(f);
      return true;
    });
    if (consumeKey(c,'R')) useSkill(f,'R',10,'DOUBLE BARREL',() => {
      if ((s.shells || 0) < 2) return 'NEED 2 SHELLS';
      const t = targetInAim(f, c, {range:980,cone:.26,width:36,fallback:e,los:true}) || aimProxy(f, dir, 980);
      const ok = api.fireCycle(f, t, 'manual-double', false, .72);
      if (!ok) return 'DOUBLE BARREL FAILED';
      s.pendingSecond = {at:matchClock + .14, dir:{...dir}, sourceKind:'manual-double'};
      return true;
    });
  }

  function fang(f, e, dt, c, old) {
    const api = window.APEX_FANG;
    const d = api?.fangData?.(f);
    if (!d) return;
    const hunt = d.huntActive;
    d.huntReadyAt = Infinity;
    old?.(f, null, dt);
    d.huntActive = hunt || d.huntActive;
    const dir = aimDir(f, c, e);
    d.visualDir = dir;
    face(f, dir);
    if (consumeKey(c,'LMB')) useSkill(f,'LMB',.55,'COLLISION BITE',() => {
      const t = targetInAim(f, c, {range:390,cone:.38,width:44,fallback:e});
      if (!t) return 'BITE NEEDS TARGET';
      return api.beginPounce(f, t, 'collision', dir) || 'FANG BUSY';
    });
    if (consumeKey(c,'RMB')) useSkill(f,'RMB',5,'HUNTING POUNCE',() => {
      const t = targetInAim(f, c, {range:860,cone:.30,width:54,fallback:e});
      if (!t) return 'POUNCE NEEDS VISIBLE TARGET';
      return api.beginPounce(f, t, 'hunting', dir) || 'FANG BUSY';
    });
    if (consumeKey(c,'Q')) useSkill(f,'Q',4,d.huntActive ? 'HUNT END' : 'BLOOD HUNT',() => {
      d.huntActive = !d.huntActive;
      d.state = d.huntActive ? 'HUNT_LOOP' : 'NORMAL_LOOP';
      d.clip = d.huntActive ? 'hunt' : 'normal';
      d.frame = d.huntActive ? 9 : 1;
      d.frameElapsed = 0;
      return true;
    });
    if (consumeKey(c,'E')) useSkill(f,'E',10,'LUNAR-SOLAR HOWL',() => {
      if (d.action) d.pendingHowl = true;
      d.pendingPostStack = Math.max(d.pendingPostStack || 0, 2);
      d.pendingHowl = true;
      d.howlStopped = false;
      d.state = 'HOWL_48';
      d.clip = 'howl';
      d.frame = 1;
      d.frameElapsed = 0;
      d.visualDir = dir;
      return true;
    });
    if (consumeKey(c,'R')) useSkill(f,'R',12,'THREE-WOLF POUNCE',() => {
      const liveClones = (d.clones || []).filter(x => !x.dead && x.hp > 0 && x.life > 0);
      if (liveClones.length < 2) return 'NEED MOON + SUN';
      const t = targetInAim(f, c, {range:920,cone:.34,width:64,fallback:e});
      if (!t) return 'WOLF POUNCE NEEDS TARGET';
      d.pendingPostStack = Math.max(d.pendingPostStack || 0, 2);
      return api.beginPounce(f, t, 'hunting', dir) || 'FANG BUSY';
    });
  }

  function galaxy(f, e, dt, c, old) {
    const d = f.data;
    const oldThrow = d.galaxyThrowCd, oldPressure = d.galaxyPressureCd;
    d.galaxyThrowCd = Infinity;
    d.galaxyPressureCd = Infinity;
    old?.(f, e, dt);
    if (d.galaxyThrowCd === Infinity) d.galaxyThrowCd = oldThrow;
    if (d.galaxyPressureCd === Infinity) d.galaxyPressureCd = oldPressure;
    const dir = aimDir(f, c, e);
    face(f, dir);
    d.galaxyFaceAngle = Math.atan2(dir.y, dir.x);
    if (consumeKey(c,'LMB')) useSkill(f,'LMB',1.05,'PLANET THROW',() => {
      d.galaxyPlanetOrder ||= Array.from({length:Math.max(1,d.galaxyStacks || 5)}, (_, i) => i);
      if (!d.galaxyPlanetOrder.length) return 'PLANETS RELOADING';
      const idx = d.galaxyPlanetOrder.shift();
      d.galaxyStacks = d.galaxyPlanetOrder.length;
      d.galaxyVisibleStacks = d.galaxyStacks;
      if (d.galaxyStacks <= 0) { d.galaxyReloading = true; d.galaxyReloadFill = 0; d.galaxyNextReloadIndex = 0; }
      projectiles.push({type:'galaxy_planet',owner:f,x:f.x+dir.x*(f.radius+38),y:f.y+dir.y*(f.radius+8),vx:dir.x*1278,vy:dir.y*1278,radius:30,life:4.2,maxLife:4.2,planetIndex:clamp(idx ?? 0,0,4),exploded:false,hitIds:{}});
      d.galaxyThrowPhase = 'release';
      d.galaxyThrowTimer = .16;
      d.galaxyThrownIndex = idx ?? 0;
      return true;
    });
    if (consumeKey(c,'RMB')) useSkill(f,'RMB',7,'PRESSURE WALK',() => {
      const t = targetInAim(f, c, {range:880,cone:.36,width:60,fallback:e});
      if (!t) return 'PRESSURE NEEDS TARGET';
      d.galaxyPressureWindow = 3;
      d.galaxyWallHits = 0;
      d.galaxyPressureArmed = false;
      t.data.galaxyPressure = {ownerId:f.id,timer:3,vx:dir.x*1480,vy:dir.y*1480,lastWall:null,lastHitAt:-99};
      return true;
    });
    if (consumeKey(c,'Q')) useSkill(f,'Q',14,'BLUEHOLE',() => {
      const t = targetInAim(f, c, {range:820,cone:.44,width:70,fallback:e}) || nearestVisibleTarget(f, 620);
      if (!t) return 'BLUEHOLE NEEDS TARGET';
      d.galaxyBluehole = {timer:5,healTick:1,total:Math.max(8,(f.maxHp-f.hp)*.12),crater:{x:t.x,y:t.y},targetId:t.id,slammed:false};
      d.galaxyState = 'BLUEHOLE';
      return true;
    });
    if (consumeKey(c,'E')) useSkill(f,'E',16,'GALAXY DIVINE',() => {
      const t = targetInAim(f, c, {range:780,cone:.48,width:70,fallback:e}) || nearestVisibleTarget(f, 520);
      if (!t) return 'DIVINE NEEDS TARGET';
      const gap = (f.radius || 75) + (t.radius || 75) + 18;
      const landing = safePointFrom(f, {x:t.x - dir.x * gap, y:t.y - dir.y * gap}, f.radius || 75);
      if (!landing) return 'DIVINE PATH BLOCKED';
      const before = {x:f.x,y:f.y};
      f.x = landing.x; f.y = landing.y;
      window.APEX_GALAXY?.refinedTrails?.push?.({type:'galaxy_teleport_zigzag',x1:before.x,y1:before.y,x2:f.x,y2:f.y,life:1.35,maxLife:1.35,amp:24,segments:5});
      d.galaxyDivine = {timer:7,hits:3,phase:'pre',punchAt:1.2,punched:false,worldFreeze:7.2,dir:{...dir},contact:{x:t.x,y:t.y},targetId:t.id};
      d.galaxyState = 'DIVINE';
      return true;
    });
    if (consumeKey(c,'R')) useSkill(f,'R',24,'GALAXY IMPACT',() => {
      const center = {x:GAME_SIZE/2,y:GAME_SIZE/2};
      if (!blockedAt(center, f.radius || 75)) { f.x = center.x; f.y = center.y; }
      d.galaxyImpact = {timer:5,elapsed:0,startedAt:performance.now()/1000,hits:9,phase:'charge',punched:false};
      d.galaxyState = 'IMPACT';
      if (window.APEX_GALAXY) window.APEX_GALAXY.impact = {owner:f,timer:5,maxTimer:5,startedAt:performance.now()/1000};
      return true;
    });
  }

  function ice(f, e, dt, c) {
    const dir = aimDir(f, c, e);
    face(f, dir);
    if (consumeKey(c,'LMB')) useSkill(f,'LMB',.72,'ICE DART',() => {
      const t = targetInAim(f, c, {range:920,cone:.32,width:44,fallback:e});
      if (!t) return 'DART NEEDS TARGET';
      projectiles.push({type:'ice_dart',owner:f,targetId:t.id,phase:'launch',x:f.x+dir.x*70,y:f.y+dir.y*70,vx:dir.x*1350,vy:dir.y*1350,radius:12,damage:3.5,flightTime:.55,life:1.3,maxLife:1.3,visualIceStart:matchClock,visualIceSpawnX:f.x,visualIceSpawnY:f.y});
      return true;
    });
    if (consumeKey(c,'RMB')) useSkill(f,'RMB',5,'ICE LANE',() => {
      const end = rayEnd(f, dir);
      projectiles.push({type:'ice_lane',owner:f,x1:f.x,y1:f.y,x2:end.x,y2:end.y,halfWidth:170,life:4.4,maxLife:4.4,enemyInside:0,dmgTick:0});
      return true;
    });
    if (consumeKey(c,'Q')) useSkill(f,'Q',7,'FLASH FREEZE',() => {
      const t = targetInAim(f, c, {range:760,cone:.46,width:72,fallback:e}) || nearestVisibleTarget(f, 460);
      if (!t) return 'FREEZE NEEDS TARGET';
      t.applyStatus('freeze',1.55,{source:f,dartTotal:14});
      t.applyStatus('frostMark',6,{source:f});
      return true;
    });
    if (consumeKey(c,'E')) useSkill(f,'E',13,'ICE AGE',() => {
      if (window.startIceAgeWindup && !f.data.iceAgeWindup) {
        window.startIceAgeWindup(f);
        return true;
      }
      projectiles.push({type:'ice_age_field',owner:f,life:5.8,maxLife:5.8,enemyInside:0,dmgTick:0,freezeTriggered:false});
      return true;
    });
    if (consumeKey(c,'R')) useSkill(f,'R',22,'ABSOLUTE ICE AGE',() => {
      f.isRage = true;
      const t = targetInAim(f, c, {range:900,cone:.7,width:90,fallback:e}) || nearestVisibleTarget(f, 700);
      if (t) t.applyStatus('freeze',2,{source:f,dartTotal:22});
      window.triggerIceVisualEvent?.('iceAge',{ownerId:f.id,duration:1.3});
      triggerFlash?.(125,225,255,.22);
      projectiles.push({type:'ice_age_field',owner:f,life:9,maxLife:9,enemyInside:0,dmgTick:0,freezeTriggered:false});
      return true;
    });
  }

  function ninja(f, e, dt, c) {
    const dir = aimDir(f, c, e);
    face(f, dir);
    const target = targetInAim(f, c, {range:980,cone:.28,width:45,fallback:e});
    if (consumeKey(c,'LMB')) useSkill(f,'LMB',.45,'SHURIKEN',() => {
      pushCustom({type:'ninja_shuriken',owner:f,targetId:target?.id,x:f.x+dir.x*70,y:f.y+dir.y*70,vx:dir.x*2130,vy:dir.y*2130,radius:12,dmg:1.8,customLife:1.75,maxCustomLife:1.75,straight:true});
      window.playNinjaShurikenAudio?.('throw');
      return true;
    });
    if (consumeKey(c,'RMB')) useSkill(f,'RMB',5,'FLYING THUNDER KUNAI',() => {
      pushCustom({type:'ninja_kunai',owner:f,targetId:target?.id,x:f.x+dir.x*70,y:f.y+dir.y*70,vx:dir.x*1220,vy:dir.y*1220,radius:16,triggered:false,bounces:0,customLife:5,maxCustomLife:5});
      window.playNinjaKunaiAudio?.('throw');
      return true;
    });
    if (consumeKey(c,'Q')) useSkill(f,'Q',4,'BODY FLICKER',() => {
      const p = safePointFrom(f, aimPoint(f, c, dir, 420), f.radius || 75);
      if (!p) return 'BLINK PATH BLOCKED';
      const before = {x:f.x,y:f.y};
      f.x = p.x; f.y = p.y;
      cleanseControl(f, 1.2);
      window.playNinjaTeleportAudio?.(f, false);
      spawnShockwave?.(before.x,before.y,'#79d8ff',90);
      spawnShockwave?.(f.x,f.y,'#79d8ff',115);
      return true;
    });
    if (consumeKey(c,'E')) useSkill(f,'E',8,'RASENGAN STRIKE',() => {
      const t = targetInAim(f, c, {range:760,cone:.42,width:60,fallback:e}) || nearestVisibleTarget(f, 520);
      if (!t) return 'RASENGAN NEEDS TARGET';
      const gap = (f.radius || 75) + (t.radius || 75) + 1;
      const p = safePointFrom(f, {x:t.x - dir.x*gap, y:t.y - dir.y*gap}, f.radius || 75);
      if (!p) return 'STRIKE PATH BLOCKED';
      f.x = p.x; f.y = p.y;
      cleanseControl(f, 1.3);
      pushCustom({type:'ninja_strike',owner:f,targetId:t.id,x:f.x,y:f.y,hit:false,customLife:.92,maxCustomLife:.92});
      t.applyStatus('stun',.95,{source:f});
      window.playNinjaTeleportAudio?.(f, true);
      return true;
    });
    if (consumeKey(c,'R')) useSkill(f,'R',12,'SHADOW STORM',() => {
      f.isRage = true;
      for (const offset of [-.55,-.28,0,.28,.55]) {
        const a = Math.atan2(dir.y,dir.x) + offset;
        pushCustom({type:'ninja_shuriken',owner:f,targetId:target?.id,x:f.x+Math.cos(a)*70,y:f.y+Math.sin(a)*70,vx:Math.cos(a)*2130,vy:Math.sin(a)*2130,radius:12,dmg:2.2,customLife:1.75,maxCustomLife:1.75,straight:true});
      }
      cleanseControl(f, 2.65);
      window.playNinjaShurikenAudio?.('throw');
      return true;
    });
  }

  function ensureSoccerPossession(f) {
    const d = f.data;
    if (d.soccerBall && d.soccerPossessionActive) return true;
    if (window.APEX_SOCCER?.enterPossession?.(f, 'manual_recover')) return true;
    if (d.soccerBall) {
      Object.assign(d.soccerBall,{state:'SOCCER_POSSESSION',x:f.x,y:f.y,vx:0,vy:0,speed:0});
      d.soccerPossessionActive = true;
      d.soccerState = 'SOCCER_POSSESSION';
      d.soccerFieldOverlayActive = true;
      return true;
    }
    return false;
  }
  function soccerKick(f, dir, speed, skillShot=null) {
    const api = window.APEX_SOCCER?.manualApi;
    if (!ensureSoccerPossession(f)) return false;
    api?.setForward?.(f, dir.x, dir.y);
    if (api?.releaseBall) {
      api.releaseBall(f, dir, speed, skillShot ? 'manual_shoot' : 'manual_dribble', skillShot);
    } else {
      const b = f.data.soccerBall;
      Object.assign(b,{state:'SOCCER_FREE_BALL',x:f.x+dir.x*(f.radius+18),y:f.y+dir.y*(f.radius+18),vx:dir.x*speed,vy:dir.y*speed,speed,skillShot,damageArmed:!!skillShot,lastSoccerTouchKind:'kick',trail:[]});
      f.data.soccerPossessionActive = false;
      f.data.soccerState = 'SOCCER_FREE_BALL';
    }
    f.data.soccerCurrentKickType = skillShot ? 'shoot' : 'dribble';
    f.data.soccerKickAnimTime = 0;
    return true;
  }
  function soccer(f, e, dt, c) {
    const dir = aimDir(f, c, e);
    face(f, dir);
    if (consumeKey(c,'LMB')) useSkill(f,'LMB',.55,'DRIBBLE KICK',() => soccerKick(f, dir, 760, null) || 'NO BALL');
    if (consumeKey(c,'RMB')) useSkill(f,'RMB',4,'SHOOT',() => soccerKick(f, dir, 1250, 'soccer_shoot') || 'NO BALL');
    if (consumeKey(c,'Q')) useSkill(f,'Q',6,'RECOVER POSSESSION',() => ensureSoccerPossession(f) || 'RECOVER ON COOLDOWN');
    if (consumeKey(c,'E')) useSkill(f,'E',9,'CHASE DOWN',() => {
      if (!f.data.soccerBall) return 'NO BALL';
      window.APEX_SOCCER?.manualApi?.startChase?.(f);
      return !!f.data.soccerChaseDownActive || 'CHASE FAILED';
    });
    if (consumeKey(c,'R')) useSkill(f,'R',18,'PENALTY',() => {
      const t = targetInAim(f, c, {range:680,cone:.5,width:80,fallback:e}) || nearestVisibleTarget(f, 420);
      if (!t) return 'PENALTY NEEDS TARGET';
      if (!ensureSoccerPossession(f)) return 'NO BALL';
      window.APEX_SOCCER?.manualApi?.beginPenalty?.(f, t);
      return !!f.data.soccerPenaltyCinematicActive || (burst(t,f,30,'soccer-penalty','#ffd27a',240), true);
    });
  }

  function stringer(f, e, dt, c) {
    const dir = aimDir(f, c, e);
    face(f, dir);
    f.data.stringState ||= 'idle';
    const lineEnd = (range=1400) => ({x:f.x + dir.x * range, y:f.y + dir.y * range});
    if (consumeKey(c,'LMB')) useSkill(f,'LMB',.65,'STRINGSHOT',() => {
      const t = targetInAim(f, c, {range:980,cone:.2,width:30,fallback:e});
      const end = lineEnd(1400);
      projectiles.push({type:'string_shot_line',owner:f,target:t,x1:f.x,y1:f.y,x2:end.x,y2:end.y,length:1400,life:.46,maxLife:.46,dot:0,phase:rand(0,TAU)});
      f.data.stringState = 'stringshot'; f.data.stringStateTimer = .24;
      if (t) burst(t,f,7,'stringshot','#ffffff',85);
      return true;
    });
    if (consumeKey(c,'RMB')) useSkill(f,'RMB',4.5,'OVERHEAT WHIP',() => {
      const t = targetInAim(f, c, {range:1040,cone:.32,width:74,fallback:e});
      const end = lineEnd(1660);
      projectiles.push({type:'string_overheat_whip',owner:f,target:t,x1:f.x,y1:f.y,x2:end.x,y2:end.y,cx:f.x+dir.x*460-dir.y*150,cy:f.y+dir.y*460+dir.x*150,damage:13,life:.86,maxLife:.86,phase:rand(0,TAU),swingSide:Math.random()<.5?-1:1});
      f.data.stringState = 'overheat'; f.data.stringStateTimer = 1.05;
      if (t) { t.applyStatus('push',.22,{x:dir.x,y:dir.y,strength:720}); burst(t,f,13,'overheat-string','#ff7b2e',115); }
      return true;
    });
    if (consumeKey(c,'Q')) useSkill(f,'Q',7,'WEB LOCK',() => {
      const t = targetInAim(f, c, {range:820,cone:.36,width:70,fallback:e}) || nearestVisibleTarget(f, 520);
      if (!t) return 'WEB NEEDS TARGET';
      t.applyStatus('stringWebLock',2.2,{source:f,stringBodyLock:true});
      projectiles.push({type:'string_body_pulse',owner:f,target:t,life:2.2,maxLife:2.2,mode:'web-lock',phase:rand(0,TAU)});
      f.data.stringState = 'parasite'; f.data.stringStateTimer = .8;
      return true;
    });
    if (consumeKey(c,'E')) useSkill(f,'E',10,'FIVE-COLOR STRING',() => {
      const t = targetInAim(f, c, {range:760,cone:.44,width:80,fallback:e}) || nearestVisibleTarget(f, 500);
      if (!t) return 'FIVE NEEDS TARGET';
      for (let i=0;i<5;i++) projectiles.push({type:'string_five_slash',owner:f,target:t,angle:Math.atan2(dir.y,dir.x)+(i-2)*.16,life:.24+i*.05,maxLife:.44});
      f.data.stringState = 'five'; f.data.stringFiveDuration = 1.3; f.data.stringStateTimer = 1.3;
      burst(t,f,18,'five-color-string','#ffb7e4',180);
      return true;
    });
    if (consumeKey(c,'R')) useSkill(f,'R',18,'GOD THREADS',() => {
      const t = targetInAim(f, c, {range:900,cone:.42,width:90,fallback:e}) || nearestVisibleTarget(f, 620);
      if (!t) return 'GOD NEEDS TARGET';
      f.isRage = true;
      f.data.stringState = 'god'; f.data.stringStateTimer = 2.2; f.data.stringGodElapsed = 0;
      projectiles.push({type:'string_god_thread',owner:f,target:t,x:f.x,y:f.y,life:5,maxLife:5,delay:0,damage:20,points:[{x:f.x,y:f.y},{x:t.x,y:t.y}]});
      t.applyStatus('stringParasite',5,{source:f});
      burst(t,f,24,'god-threads','#d9ccff',260);
      triggerFlash?.(60,20,90,.16);
      return true;
    });
  }

  const handlers = { SHOTGUN:shotgun, FANG:fang, GALAXY:galaxy, ICE:ice, NINJA:ninja, SOCCER:soccer, STRING:stringer };

  function moveAim(f, c, fallback) {
    const dir = aimDir(f, c, fallback);
    face(f, dir);
    rememberManualIntent(f, c, dir);
  }
  function finishManualMovement(f, c) {
    rememberManualIntent(f, c, aimDir(f, c, null));
  }

  for (const name of Object.keys(handlers)) {
    const type = (window.FighterTypes || window.apexFighterTypes || []).find(t => t?.name === name);
    if (!type || type.__apexControlSkillsV2) continue;
    const old = type.update;
    type.update = function(f, e, dt) {
      if (!manual(f)) return old?.(f, e, dt);
      const c = f.data.manualController;
      tickCooldowns(f, dt);
      const fallback = targetInAim(f, c, {range:900,cone:.55,width:70,fallback:e,los:true}) || (live(e) && lineClear(f,e,24) ? e : null);
      moveAim(f, c, fallback);
      const result = handlers[name](f, fallback, dt, c, old);
      finishManualMovement(f, c);
      return result;
    };
    type.__apexControlSkillsV2 = true;
  }

  window.APEX_CONTROL_SKILLS = {
    supported:new Set(supported),
    kit,
    keys,
    mappingFor:name => kit[name] || [],
    hudState(f) {
      const s = stateFor(f);
      const skills = kit[f?.name] || [];
      return {
        last:s.last || 'READY',
        failed:!!s.failed,
        skills:skills.map(x => ({...x, remaining:s.cd[x.key] || 0})),
        line:skills.map(x => `${x.key} ${x.name}${(s.cd[x.key] || 0) > 0 ? ` ${(s.cd[x.key] || 0).toFixed(1)}s` : ''}`).join(' · ')
      };
    }
  };
})();
