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
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-qa-soccer-update-'));
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
        ready = await evaluate(`Boolean(window.APEX_SOCCER && window.startSpecificMatch && window.apexFighterTypes?.find(x=>x.name==='SOCCER'))`);
      } catch {}
      if (ready) break;
      await wait(250);
    }
    if (!ready) throw new Error('SOCCER runtime did not become ready');

    await evaluate(`(() => {
      const types=window.apexFighterTypes;
      startSpecificMatch(types.find(x=>x.name==='SOCCER'),types.find(x=>x.name==='ICE'),{p1Hp:1000,p2Hp:1000});
      cancelAnimationFrame(reqId);
      window.__qaSoccerTick=(dt)=>{lastTime+=dt*1000;return window.APEX_SOCCER.preUpdate(dt);};
      return true;
    })()`);
    await wait(500);

    const animation = await evaluate(`(() => {
      const s=window.APEX_SOCCER,c=s.constants,f=fighters.find(x=>x.name==='SOCCER'),d=f.data;
      d.soccerCurrentMoveFrame=0;d.soccerMoveFrameAccumulator=0;
      d.soccerPossessionActive=true;d.soccerGoalDriveActive=false;d.soccerPenaltyCinematicActive=false;
      d.soccerBall.state='SOCCER_POSSESSION';f.statuses={};f.data.positionLocked=false;f.setDir(1,0);
      __qaSoccerTick(.24);const before=d.soccerCurrentMoveFrame;
      __qaSoccerTick(.02);const after=d.soccerCurrentMoveFrame;
      return {count:c.MOVE_FRAME_COUNT,fps:c.MOVE_FPS,before,after,
        sources:s.moveFrames.map(x=>x.src.split('?')[0].split('/').pop()),poolSizes:Object.fromEntries(Object.entries(s.audioPools).map(([k,v])=>[k,v.length]))};
    })()`);

    const shootLane = await evaluate(`(() => {
      const s=window.APEX_SOCCER,f=fighters.find(x=>x.name==='SOCCER'),e=fighters.find(x=>x!==f),d=f.data,b=d.soccerBall;
      const reset=()=>{f.statuses={};e.statuses={};f.data.positionLocked=false;d.soccerGoalDriveActive=false;d.soccerShotResolving=false;
        d.soccerPossessionActive=true;d.soccerPossessionCooldown=0;d.soccerPossessionTimer=10;d.soccerGoalDriveAlignmentHoldTimer=0;
        d.soccerKickReleased=false;d.soccerCurrentKickType=null;d.soccerCarryActive=false;d.soccerLastGoalDriveGeometry=null;
        Object.assign(b,{state:'SOCCER_POSSESSION',vx:0,vy:0,speed:0,skillShot:null,damageArmed:false,goalDriveSpent:false,
          hasLeftOwnerRadius:false,ownerContactActive:false,opponentContactActive:false,sameTargetHitCooldown:{},freeFlightTime:0});
        f.setDir(0,-1);};
      reset();f.x=500;f.y=760;e.x=760;e.y=500;__qaSoccerTick(.09);
      const fallbackActivation={active:d.soccerGoalDriveActive,valid:d.soccerGoalDriveAlignmentValid,xAtTop:d.soccerXAtTop};
      reset();f.x=500;f.y=760;e.x=500;e.y=450;__qaSoccerTick(.09);
      e.x=900;e.y=450;__qaSoccerTick(.14);
      const fallbackRelease={mode:d.soccerLastShootAimMode,target:{...d.soccerCurrentGoalTargetPoint},vx:b.vx,vy:b.vy,state:b.state};
      reset();f.x=500;f.y=760;e.x=500;e.y=450;__qaSoccerTick(.09);
      e.x=550;e.y=450;__qaSoccerTick(.14);
      const opponentRelease={mode:d.soccerLastShootAimMode,target:{...d.soccerCurrentGoalTargetPoint},vx:b.vx,vy:b.vy,state:b.state};
      reset();f.x=500;f.y=240;e.x=500;e.y=550;f.setDir(0,1);__qaSoccerTick(.09);
      e.x=550;e.y=550;__qaSoccerTick(.14);
      const bottomRelease={mode:d.soccerLastShootAimMode,target:{...d.soccerCurrentGoalTargetPoint},vx:b.vx,vy:b.vy,state:b.state};
      reset();f.x=500;f.y=760;e.x=500;e.y=450;d.soccerPossessionTimer=.01;__qaSoccerTick(.02);
      const timeoutShoot={active:d.soccerGoalDriveActive,kickType:d.soccerCurrentKickType,state:b.state,transition:d.soccerLastStateTransition};
      reset();f.x=500;f.y=760;e.x=500;e.y=450;e.hp=1000;__qaSoccerTick(.09);__qaSoccerTick(.14);
      const carryHpBefore=e.hp;
      for(let i=0;i<12;i+=1)__qaSoccerTick(.016);
      const topCarry={active:d.soccerCarryActive,transition:d.soccerLastStateTransition,skillShot:b.skillShot,hpBefore:carryHpBefore,hp:e.hp};
      for(let i=0;i<40;i+=1)__qaSoccerTick(.016);
      const topImpact={active:d.soccerCarryActive,transition:d.soccerLastStateTransition,hp:e.hp};
      return {bounds:{width:s.constants.GOAL_WIDTH_RATIO,targetY:s.constants.GOAL_TARGET_Y_RATIO},fallbackActivation,fallbackRelease,opponentRelease,bottomRelease,timeoutShoot,topCarry,topImpact};
    })()`);

    const cooldownKick = await evaluate(`(() => {
      const f=fighters.find(x=>x.name==='SOCCER'),e=fighters.find(x=>x!==f),d=f.data,b=d.soccerBall;
      f.statuses={};e.statuses={};f.x=300;f.y=500;e.x=720;e.y=500;f.setDir(1,0);f.data.positionLocked=false;
      d.soccerPossessionActive=false;d.soccerPossessionCooldown=4;d.soccerGoalDriveActive=false;d.soccerPenaltyCinematicActive=false;
      d.soccerChaseDownActive=false;d.soccerCarryActive=false;d.soccerLastCooldownKickAt=-99;d.soccerCooldownKickTimer=0;
      const catchNow=()=>{Object.assign(b,{state:'SOCCER_FREE_BALL',x:f.x+f.radius+b.radius,y:f.y,vx:0,vy:0,speed:0,
        freeFlightTime:5.2,hasLeftOwnerRadius:true,ownerContactActive:false,opponentContactActive:false,sameTargetHitCooldown:{},skillShot:null,trail:[]});__qaSoccerTick(.001);};
      catchNow();
      const windup={state:b.state,kickType:d.soccerCurrentKickType,frame:d.soccerCurrentKickFrame,locked:f.data.positionLocked,
        forward:{x:d.soccerVisualForwardX,y:d.soccerVisualForwardY},transition:d.soccerLastStateTransition};
      __qaSoccerTick(.14);const first={timer:d.soccerCooldownKickTimer,transition:d.soccerLastStateTransition,skillShot:b.skillShot,state:b.state,frame:d.soccerCurrentKickFrame};
      __qaSoccerTick(.49);catchNow();const second={timer:d.soccerCooldownKickTimer,transition:d.soccerLastStateTransition,skillShot:b.skillShot,state:b.state};
      __qaSoccerTick(.52);catchNow();const thirdWindup={state:b.state,kickType:d.soccerCurrentKickType,frame:d.soccerCurrentKickFrame};
      __qaSoccerTick(.14);const third={timer:d.soccerCooldownKickTimer,transition:d.soccerLastStateTransition,skillShot:b.skillShot,state:b.state};
      return {windup,first,second,thirdWindup,third};
    })()`);

    const freeBall = await evaluate(`(() => {
      const s=window.APEX_SOCCER,c=s.constants,f=fighters.find(x=>x.name==='SOCCER'),e=fighters.find(x=>x!==f),d=f.data,b=d.soccerBall;
      const setup=(age,x,vx)=>{f.statuses={};e.statuses={};f.x=500;f.y=500;e.x=900;e.y=900;f.data.positionLocked=false;
        d.soccerPossessionActive=false;d.soccerPossessionCooldown=0;d.soccerCooldownKickTimer=0;d.soccerGoalDriveActive=false;d.soccerPenaltyCinematicActive=false;d.soccerChaseDownActive=false;d.soccerCarryActive=false;
        Object.assign(b,{state:'SOCCER_FREE_BALL',x,y:500,vx,vy:0,speed:Math.abs(vx),freeFlightTime:age,hasLeftOwnerRadius:true,
          ownerContactActive:false,opponentContactActive:false,sameTargetHitCooldown:{},skillShot:null,trail:[]});};
      setup(4.7,360,1800);__qaSoccerTick(.1);const noCatch={possession:d.soccerPossessionActive,vx:b.vx,age:b.freeFlightTime};
      setup(5.1,360,1800);__qaSoccerTick(.1);const passiveCatch={possession:d.soccerPossessionActive,state:b.state};
      setup(0,300,900);const speed0=b.speed;for(let i=0;i<240;i++)__qaSoccerTick(1/60);const constant={start:speed0,end:b.speed,delta:Math.abs(speed0-b.speed)};
      setup(9.99,700,1100);__qaSoccerTick(.02);const intercept={active:d.soccerChaseDownActive,target:d.soccerChaseTarget,dir:d.soccerChaseDirection,
        finite:[d.soccerChaseTarget?.x,d.soccerChaseTarget?.y,d.soccerChaseDirection?.x,d.soccerChaseDirection?.y].every(Number.isFinite)};
      return {noCatch,passiveCatch,constant,intercept};
    })()`);

    const penalty = await evaluate(`(() => {
      const s=window.APEX_SOCCER,f=fighters.find(x=>x.name==='SOCCER'),e=fighters.find(x=>x!==f),d=f.data,b=d.soccerBall;
      f.statuses={};e.statuses={};f.maxHp=f.hp=1000;e.maxHp=e.hp=1000;f.x=500;f.y=100;e.x=820;e.y=700;
      d.soccerPossessionActive=true;d.soccerHomeResistanceActive=false;d.soccerPenaltyUsedThisPossession=false;d.soccerShotResolving=false;d.soccerPenaltyCinematicActive=false;
      d.soccerPenaltyCheckFreezeActive=false;b.state='SOCCER_POSSESSION';
      f.takeDamage(7,e,'qa-penalty-foul');__qaSoccerTick(1.01);
      const fixed={...d.soccerPenaltyOpponentSpot};let maxDrift=0,midFlight=null,releaseSpeed=0;
      for(let i=0;i<40;i++){__qaSoccerTick(.1);if(d.soccerPenaltyReleased&&!releaseSpeed)releaseSpeed=b.speed;if(i===35)midFlight={y:b.y,time:d.soccerPenaltySkillTime};maxDrift=Math.max(maxDrift,Math.hypot(e.x-fixed.x,e.y-fixed.y));}
      return {foul:d.soccerPenaltyFoulDamage,rawDamage:d.soccerPenaltyResolvedDamage,damage:1000-e.hp,maxDrift,
        spotY:d.soccerPenaltySpot.y,contact:s.constants.PENALTY_CONTACT_TIME,impact:s.constants.PENALTY_GOAL_IMPACT_TIME,
        releaseSpeed,midFlight,slowDuration:s.constants.PENALTY_CONTACT_SLOW_DURATION,slowScale:s.constants.PENALTY_CONTACT_SLOW_SCALE,
        expected:30+2*d.soccerPenaltyFoulDamage};
    })()`);

    const healthTrail = await evaluate(`(async()=>{
      const f=fighters[0],fill=document.getElementById('p1-hp'),trail=document.getElementById('p1-hp-loss');
      f.maxHp=100;f.hp=100;fill.dataset.hpPct='100';trail.style.opacity='0';trail.style.width='0';updateHUD();
      f.hp=72;f.data.lastHpLossImpact={at:performance.now(),amount:28,ratio:.28,hp:72};updateHUD(true);
      const immediate={left:trail.style.left,width:trail.style.width,opacity:trail.style.opacity,fill:fill.style.width,transition:trail.style.transition};
      await new Promise(r=>setTimeout(r,1150));
      return {immediate,faded:getComputedStyle(trail).opacity};
    })()`);

    const pass = animation.count===2 && animation.fps===4 && animation.before===0 && animation.after===1
      && animation.sources.join(',')==='frame_065.png,frame_066.png'
      && Object.values(animation.poolSizes).every(x=>x>=1&&x<=8) && animation.poolSizes.hit>=5
      && shootLane.bounds.width===.25 && shootLane.bounds.targetY===.055
      && !shootLane.fallbackActivation.active && !shootLane.fallbackActivation.valid
      && shootLane.fallbackRelease.mode==='goal_fallback' && Math.abs(shootLane.fallbackRelease.target.x-500)<.01
      && shootLane.fallbackRelease.vy<0 && Math.abs(shootLane.fallbackRelease.vx)<1
      && shootLane.opponentRelease.mode==='opponent_line' && shootLane.opponentRelease.target.x>600
      && shootLane.bottomRelease.mode==='opponent_line' && shootLane.bottomRelease.target.goalSide==='bottom' && shootLane.bottomRelease.vy>0
      && shootLane.timeoutShoot.active && shootLane.timeoutShoot.kickType==='shoot' && shootLane.timeoutShoot.state==='SOCCER_POSSESSION'
      && shootLane.topCarry.active && shootLane.topCarry.skillShot==='soccer_shoot' && shootLane.topCarry.hp===shootLane.topCarry.hpBefore
      && !shootLane.topImpact.active && shootLane.topImpact.hp < shootLane.topCarry.hpBefore - 15
      && cooldownKick.windup.state==='SOCCER_POSSESSION' && cooldownKick.windup.kickType==='one_touch'
      && cooldownKick.windup.frame===0 && cooldownKick.windup.locked && cooldownKick.windup.forward.x>.99
      && cooldownKick.first.skillShot==='soccer_cooldown_kick' && cooldownKick.first.state==='SOCCER_FREE_BALL' && cooldownKick.first.timer>.99
      && cooldownKick.second.transition.includes('CLEAR KICK') && cooldownKick.second.timer>0 && cooldownKick.second.state==='SOCCER_FREE_BALL'
      && cooldownKick.thirdWindup.state==='SOCCER_POSSESSION' && cooldownKick.thirdWindup.kickType==='one_touch'
      && cooldownKick.third.skillShot==='soccer_cooldown_kick' && cooldownKick.third.state==='SOCCER_FREE_BALL' && cooldownKick.third.timer>.99
      && !freeBall.noCatch.possession && freeBall.passiveCatch.possession
      && freeBall.constant.delta<.01 && freeBall.intercept.active && freeBall.intercept.finite
      && penalty.foul>0 && Math.abs(penalty.rawDamage-penalty.expected)<.01 && penalty.damage>0 && penalty.maxDrift<.01
      && penalty.spotY===400 && penalty.contact===3.5 && penalty.impact===4 && penalty.releaseSpeed>3200
      && penalty.midFlight && penalty.midFlight.y<280 && penalty.slowDuration===.11 && penalty.slowScale===.08
      && healthTrail.immediate.left==='72%' && healthTrail.immediate.width==='28%'
      && healthTrail.immediate.opacity==='1' && healthTrail.immediate.transition.includes('3.1s')
      && Number(healthTrail.faded)<1 && Number(healthTrail.faded)>.7
      && errors.length===0;
    console.log(JSON.stringify({pass,animation,shootLane,cooldownKick,freeBall,penalty,healthTrail,errors},null,2));
    if(!pass)process.exitCode=1;
    ws.close();
  } finally {
    child.kill();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((error)=>{console.error(error.stack||String(error));process.exit(1);});
