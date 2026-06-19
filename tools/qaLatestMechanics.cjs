const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9300 + Math.floor(Math.random() * 1000);
const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function requestJson(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-qa-latest-'));
  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--user-data-dir=${profileDir}`, `--remote-debugging-port=${port}`, 'about:blank',
  ], { stdio: 'ignore' });

  try {
    for (let i = 0; i < 80; i += 1) {
      try { await requestJson('/json/version'); break; } catch { await wait(100); }
    }
    const created = await requestJson(`/json/new?${encodeURIComponent(targetUrl)}`, 'PUT');
    const ws = new WebSocket(created.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const errors = [];
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const callId = ++id;
      pending.set(callId, { resolve, reject });
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
    ws.addEventListener('message', (message) => {
      const data = JSON.parse(message.data);
      if (data.id && pending.has(data.id)) {
        const entry = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) entry.reject(new Error(JSON.stringify(data.error)));
        else entry.resolve(data.result);
      } else if (data.method === 'Runtime.exceptionThrown') {
        errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
      }
    });
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
    await send('Runtime.enable');
    await send('Page.navigate', { url: targetUrl });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };

    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try {
        ready = await evaluate(`Boolean(window.startSpecificMatch && window.APEX_SOCCER && window.apexFighterTypes?.find(x=>x.name==='GALAXY'))`);
      } catch {}
      if (ready) break;
      await wait(250);
    }
    if (!ready) throw new Error('runtime did not become ready');

    const ice = await evaluate(`(() => {
      const types=window.apexFighterTypes;
      startSpecificMatch(types.find(x=>x.name==='ICE'),types.find(x=>x.name==='NINJA'),{p1Hp:500,p2Hp:500});
      cancelAnimationFrame(reqId);
      gameState='QA';
      projectiles.length=0;
      const owner=fighters[0], target=fighters[1];
      target.hp=500; target.maxHp=500;
      target.applyStatus('freeze',1.2,{source:owner,dartTotal:16});
      const hp0=target.hp;
      for(let i=0;i<9;i+=1){ target.updateStatuses(.1); updateProjectiles(.1); }
      const staged=projectiles.filter(p=>p.type==='ice_dart');
      const hpMid=target.hp;
      const radii=staged.map(p=>Math.hypot(p.x-target.x,p.y-target.y));
      const minSpacing=Math.min(...staged.flatMap((p,i)=>staged.slice(i+1).map(q=>Math.hypot(p.x-q.x,p.y-q.y))));
      let launched=false;
      for(let i=0;i<6;i+=1){ target.updateStatuses(.05); updateProjectiles(.05); launched ||= projectiles.some(p=>p.type==='ice_dart'&&p.phase==='launch'); }
      for(let i=0;i<8;i+=1){ target.updateStatuses(.05); updateProjectiles(.05); }
      return {count:staged.length,hp0,hpMid,hpAfter:target.hp,launched,
        radiusMin:Math.min(...radii),radiusMax:Math.max(...radii),
        minSpacing};
    })()`);

    const galaxy = await evaluate(`(() => {
      const types=window.apexFighterTypes;
      startSpecificMatch(types.find(x=>x.name==='GALAXY'),types.find(x=>x.name==='NINJA'),{p1Hp:500,p2Hp:500});
      cancelAnimationFrame(reqId);
      gameState='QA';
      const g=fighters[0], e=fighters[1];
      const hp0=g.hp;
      g.data.galaxyDivine={timer:7,hits:3,worldFreeze:.42,phase:'pre',punchAt:1.2,punched:false,dir:{x:1,y:0},contact:{x:e.x,y:e.y}};
      g.takeDamage(120,e,'qa-divine');
      if(g.takeStandardDamage) g.takeStandardDamage(120,e,'qa-divine-standard');
      const hpDivine=g.hp;
      g.data.galaxyDivine=null;
      g.data.galaxyImpact={phase:'charge',timer:1.2,hits:9};
      g.takeDamage(120,e,'qa-impact');
      if(g.takeStandardDamage) g.takeStandardDamage(120,e,'qa-impact-standard');
      const hpImpact=g.hp;
      startSpecificMatch(types.find(x=>x.name==='GALAXY'),types.find(x=>x.name==='SOCCER'),{p1Hp:500,p2Hp:500});
      cancelAnimationFrame(reqId);
      gameState='PLAYING';
      const gf=fighters[0], sf=fighters[1], ball=sf.data.soccerBall;
      sf.x=820; sf.y=260; sf.setDir(1,0);
      Object.assign(ball,{state:'SOCCER_FREE_BALL',x:760,y:260,vx:1200,vy:0,speed:1200,freeFlightTime:2,hasLeftOwnerRadius:true});
      const start=performance.now()/1000;
      gf.data.galaxyDivine={timer:8,elapsed:0,startedAt:start,punchDueAt:start+7,endDueAt:start+8.15,worldFreeze:8.15,hits:2,phase:'pre',punched:false,dir:{x:1,y:0},vertex:{x:gf.x+80,y:gf.y}};
      const before={x:sf.x,y:sf.y,bx:ball.x,by:ball.y,freeze:gf.data.galaxyDivine.worldFreeze};
      update(.5);
      const freezeHeld=sf.x===before.x && sf.y===before.y && ball.x===before.bx && ball.y===before.by && gf.data.galaxyDivine.worldFreeze<before.freeze;
      gameState='QA';
      return {hp0,hpDivine,hpImpact,freezeHeld};
    })()`);

    const soccer = await evaluate(`(() => {
      gameState='MENU';
      const types=window.apexFighterTypes;
      startSpecificMatch(types.find(x=>x.name==='SOCCER'),types.find(x=>x.name==='NINJA'),{p1Hp:500,p2Hp:500});
      cancelAnimationFrame(reqId);
      const s=window.APEX_SOCCER;
      window.__qaSoccerTick=(dt)=>{lastTime+=dt*1000;return s.preUpdate(dt);};
      const f=fighters.find(x=>x.name==='SOCCER'), e=fighters.find(x=>x!==f);
      f.data.soccerBall ||= {state:'SOCCER_POSSESSION',x:f.x,y:f.y,vx:0,vy:0,speed:0,radius:33,visualScale:.48,
        collisionRadius:33,ownerId:f.id,lastReleaseTime:-99,freeFlightTime:0,hasLeftOwnerRadius:false,
        sameTargetHitCooldown:{},skillShot:null,damageArmed:false,goalDriveSpent:false,lastWallSoundAt:-99,
        ownerContactActive:false,opponentContactActive:false,lastSoccerTouchKind:null,trail:[]};
      const b=f.data.soccerBall;
      gameState='QA';
      f.x=430; f.y=500; e.x=520; e.y=500; e.hp=500; e.maxHp=500;
      Object.assign(b,{state:'SOCCER_FREE_BALL',x:e.x-e.radius-b.radius-1,y:e.y,vx:900,vy:0,speed:900,freeFlightTime:1,
        hasLeftOwnerRadius:true,ownerContactActive:false,opponentContactActive:false,sameTargetHitCooldown:{},skillShot:null,damageArmed:false,trail:[]});
      s.qaNormalBallHit(f,e,b,900/s.constants.BALL_MAX_SPEED);
      const passiveHp=e.hp;
      Object.assign(b,{state:'SOCCER_FREE_BALL',x:e.x-e.radius-b.radius-1,y:e.y,vx:900,vy:0,speed:900,freeFlightTime:1,
        hasLeftOwnerRadius:true,ownerContactActive:false,opponentContactActive:false,sameTargetHitCooldown:{},skillShot:'qa_kick',damageArmed:true,lastSoccerTouchKind:'kick',trail:[]});
      s.qaNormalBallHit(f,e,b,900/s.constants.BALL_MAX_SPEED);
      const armedHp=e.hp, armedAfter=b.damageArmed;
      s.qaNormalBallHit(f,e,b,900/s.constants.BALL_MAX_SPEED);
      const secondHp=e.hp;
      Object.assign(b,{state:'SOCCER_FREE_BALL',x:e.x-e.radius-b.radius-1,y:e.y,vx:900,vy:0,speed:900,freeFlightTime:1,
        hasLeftOwnerRadius:true,ownerContactActive:false,opponentContactActive:false,sameTargetHitCooldown:{},skillShot:null,damageArmed:true,lastSoccerTouchKind:'wall',trail:[]});
      s.qaNormalBallHit(f,e,b,900/s.constants.BALL_MAX_SPEED);
      return {passiveHp,armedHp,armedAfter,secondHp,wallAfterHp:e.hp};
    })()`);

    const replayLayout = await evaluate(`(() => {
      const source = fetch('/apexEngine.js').then(r=>r.text());
      return source.then(text => ({
        sideBySide:text.includes('drawRecordPanel(rctx, 18, 884, 332, 372') && text.includes('drawRecordPanel(rctx, 370, 884, 332, 372'),
        panelCache:text.includes('readRecordRows()'),
        hpVisual:text.includes('hpVisual:[{pct:1,trail:1')
      }));
    })()`);

    const hpSettings = await evaluate(`(() => {
      const types=window.apexFighterTypes;
      const p1=document.getElementById('p1-hp-setting');
      const p2=document.getElementById('p2-hp-setting');
      if (p1) p1.value='1000';
      if (p2) p2.value='1350';
      startSpecificMatch(types.find(x=>x.name==='SOCCER'),types.find(x=>x.name==='ICE'),{countdown:false,tournament:false});
      cancelAnimationFrame(reqId);
      return {p1:fighters[0].maxHp,p2:fighters[1].maxHp,p2Hp:fighters[1].hp};
    })()`);

    const pass = ice.count >= 5 && ice.count <= 8 && ice.hpMid === ice.hp0 && ice.hpAfter < ice.hpMid
      && ice.launched && ice.radiusMin > 180 && ice.radiusMax < 260 && ice.minSpacing > 25
      && galaxy.hpDivine === galaxy.hp0 && galaxy.hpImpact === galaxy.hp0 && galaxy.freezeHeld
      && soccer.passiveHp === 500 && soccer.armedHp < soccer.passiveHp && soccer.armedAfter === false && soccer.secondHp === soccer.armedHp && soccer.wallAfterHp === soccer.secondHp
      && replayLayout.sideBySide && replayLayout.panelCache && replayLayout.hpVisual
      && hpSettings.p1 === 1000 && hpSettings.p2 === 1350 && hpSettings.p2Hp === 1350
      && errors.length === 0;

    console.log(JSON.stringify({ pass, ice, galaxy, soccer, replayLayout, hpSettings, errors }, null, 2));
    if (!pass) process.exitCode = 1;
    ws.close();
  } finally {
    child.kill();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
