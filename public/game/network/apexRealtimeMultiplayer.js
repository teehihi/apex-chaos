// Role-neutral realtime networking for APEX CONTROL.
// Room Creator is a lobby role. P1/P2 are gameplay slots. Neither implies authority.
// The Authority Runtime is the only source of truth for match state and can later move
// from a peer-hosted browser to a dedicated server without changing client controllers.
(function APEX_REALTIME_MULTIPLAYER_RUNTIME(){
  if (window.APEX_REALTIME_MULTIPLAYER) return;

  const CONFIG = Object.freeze({
    networkHz:30,
    snapshotHz:25,
    interpolationDelayMs:100,
    maxExtrapolationMs:100,
    smallErrorThreshold:5,
    mediumErrorThreshold:30,
    snapThreshold:150,
    remoteSnapThreshold:200,
    correctionSpeed:10,
    maxInputHistory:240,
    maxSnapshotBuffer:90
  });
  const IDLE_VELOCITY_EPSILON=8;
  const IDLE_POSITION_EPSILON=.5;
  const now = () => performance.now();
  const lerp = (a,b,t) => a + (b-a)*t;
  const cloneVector = value => ({x:Number(value?.x)||0,y:Number(value?.y)||0});
  const distance = (a,b) => Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0));

  class NetworkTickManager {
    constructor(hz=CONFIG.networkHz) {
      this.hz=hz; this.intervalMs=1000/hz; this.tick=0; this.timer=0; this.listeners=new Set();
      this.nextAt=0;
    }
    add(listener){ this.listeners.add(listener); return () => this.listeners.delete(listener); }
    start(){
      if (this.timer) return;
      this.nextAt=now()+this.intervalMs;
      const step=()=>{
        const current=now();
        if (current+1>=this.nextAt) {
          this.tick++;
          const dt=this.intervalMs/1000;
          for (const listener of this.listeners) listener(this.tick,dt,current);
          this.nextAt += this.intervalMs;
          if (current-this.nextAt>this.intervalMs*3) this.nextAt=current+this.intervalMs;
        }
        this.timer=window.setTimeout(step,Math.max(1,Math.min(this.intervalMs/2,this.nextAt-now())));
      };
      step();
    }
    stop(){ clearTimeout(this.timer); this.timer=0; }
  }

  class PlayerInputPacket {
    constructor(fields={}) { Object.assign(this,fields); }
    static fromInput(input, context) {
      const held=new Set(input?.held||[]), pressed=new Set(input?.pressed||[]);
      return new PlayerInputPacket({
        playerId:context.localPlayerId,
        playerSlot:context.localPlayerSlot,
        tick:context.tick,
        sequence:context.sequence,
        moveX:Number(input?.moveVector?.x)||0,
        moveY:Number(input?.moveVector?.y)||0,
        actions:{
          attack:held.has('PRIMARY')||pressed.has('PRIMARY'),
          skill:held.has('ABILITY_1')||held.has('ABILITY_2')||pressed.has('ABILITY_1')||pressed.has('ABILITY_2'),
          dash:pressed.has('ABILITY_1'), interact:pressed.has('CORE'),
          defend:held.has('SECONDARY')||pressed.has('SECONDARY'),
          primary:held.has('PRIMARY'), secondary:held.has('SECONDARY'),
          ability1:held.has('ABILITY_1'), ability2:held.has('ABILITY_2'),
          core:held.has('CORE'), apex:held.has('APEX')
        },
        held:[...(input?.held||[])], pressed:[...(input?.pressed||[])],
        aimPoint:input?.aimPoint ? cloneVector(input.aimPoint) : null,
        pointerInside:input?.pointerInside!==false,
        localPredictedPosition:cloneVector(context.localState?.position),
        localVelocity:cloneVector(context.localState?.velocity),
        facingDirection:cloneVector(context.localState?.facingDirection),
        clientTimestamp:now()
      });
    }
  }

  class PlayerInputHistory {
    constructor(limit=CONFIG.maxInputHistory){ this.limit=limit; this.items=[]; }
    push(packet){ this.items.push(packet); if(this.items.length>this.limit)this.items.splice(0,this.items.length-this.limit); }
    acknowledge(sequence){ this.items=this.items.filter(item=>item.sequence>sequence); }
    after(sequence){ return this.items.filter(item=>item.sequence>sequence); }
    clear(){ this.items.length=0; }
  }

  class PlayerStateSnapshot { constructor(fields={}){ Object.assign(this,fields); } }
  class MatchStateSnapshot { constructor(fields={}){ Object.assign(this,fields); } }

  class SnapshotBuffer {
    constructor(limit=CONFIG.maxSnapshotBuffer){ this.limit=limit; this.items=[]; }
    push(snapshot,receivedAt=now()){
      if(!snapshot)return;
      this.items.push({...snapshot,receivedAt});
      this.items.sort((a,b)=>(a.snapshotTick||0)-(b.snapshotTick||0));
      if(this.items.length>this.limit)this.items.splice(0,this.items.length-this.limit);
    }
    sample(renderAt){
      if(!this.items.length)return null;
      while(this.items.length>2&&this.items[1].receivedAt<renderAt)this.items.shift();
      const a=this.items[0], b=this.items[1];
      if(b&&a.receivedAt<=renderAt&&renderAt<=b.receivedAt){
        const t=Math.max(0,Math.min(1,(renderAt-a.receivedAt)/Math.max(1,b.receivedAt-a.receivedAt)));
        const idle=Math.hypot(a.velocity?.x||0,a.velocity?.y||0)<IDLE_VELOCITY_EPSILON&&Math.hypot(b.velocity?.x||0,b.velocity?.y||0)<IDLE_VELOCITY_EPSILON&&distance(a.position,b.position)<IDLE_POSITION_EPSILON;
        return {...b,position:idle?cloneVector(b.position):{x:lerp(a.position.x,b.position.x,t),y:lerp(a.position.y,b.position.y,t)},velocity:idle?{x:0,y:0}:cloneVector(b.velocity),facingDirection:idle?cloneVector(b.facingDirection):{x:lerp(a.facingDirection.x,b.facingDirection.x,t),y:lerp(a.facingDirection.y,b.facingDirection.y,t)},interpolationAlpha:t,extrapolated:false};
      }
      const latest=this.items[this.items.length-1];
      const extraMs=Math.min(CONFIG.maxExtrapolationMs,Math.max(0,renderAt-latest.receivedAt));
      const idle=Math.hypot(latest.velocity?.x||0,latest.velocity?.y||0)<IDLE_VELOCITY_EPSILON;
      return {...latest,position:idle?cloneVector(latest.position):{x:latest.position.x+(latest.velocity?.x||0)*extraMs/1000,y:latest.position.y+(latest.velocity?.y||0)*extraMs/1000},velocity:idle?{x:0,y:0}:cloneVector(latest.velocity),extrapolated:!idle&&extraMs>0};
    }
    get size(){return this.items.length;}
    clear(){this.items.length=0;}
  }

  class ServerReconciliationController {
    static correctionMode(predicted,authoritative){
      const error=distance(predicted,authoritative);
      if(error>=CONFIG.snapThreshold)return {mode:'snap',error};
      if(error>=CONFIG.mediumErrorThreshold)return {mode:'replay',error};
      if(error>=CONFIG.smallErrorThreshold)return {mode:'smooth',error};
      return {mode:'none',error};
    }
  }

  class ClientPredictionController {
    constructor(adapter){this.adapter=adapter;this.history=new PlayerInputHistory();this.pendingCorrection={x:0,y:0};this.lastError=0;this.correctionMode='none';this.lastAcknowledgedSequence=0;}
    record(packet){
      this.history.push(packet);
      if(Math.hypot(packet?.moveX||0,packet?.moveY||0)>.01){
        this.pendingCorrection={x:0,y:0};
        this.correctionMode='prediction';
      }
    }
    reconcile(snapshot,ackSequence){
      if(!snapshot)return;
      // A snapshot without an acknowledgement has not simulated this client's
      // input yet. Correcting against it would drag the local fighter toward an
      // old spawn point and look like autonomous movement.
      if(!Number.isFinite(ackSequence)||ackSequence<=this.lastAcknowledgedSequence)return;
      const local=this.adapter.getLocalPlayerState?.();
      if(!local)return;
      const result=ServerReconciliationController.correctionMode(local.position,snapshot.position);
      const acknowledged=this.history.items.find(packet=>packet.sequence===ackSequence);
      const newest=this.history.items[this.history.items.length-1];
      const authorityStillMoving=Math.hypot(acknowledged?.moveX||0,acknowledged?.moveY||0)>.01;
      const clientStillMoving=Math.hypot(newest?.moveX||0,newest?.moveY||0)>.01;
      this.lastError=result.error;this.lastAcknowledgedSequence=ackSequence||0;
      this.history.acknowledge(this.lastAcknowledgedSequence);
      const pending=this.history.after(this.lastAcknowledgedSequence);
      // Do not reconcile against an in-flight movement snapshot. It represents
      // where authority was a few ticks ago and pulling toward it causes rubber
      // banding as soon as the player releases WASD.
      if(result.mode!=='snap'&&(authorityStillMoving||clientStillMoving)){
        this.pendingCorrection={x:0,y:0};this.correctionMode='prediction';return;
      }
      if(result.mode==='snap'){
        this.adapter.setLocalPlayerTransform?.(snapshot,'snap');
        this.pendingCorrection={x:0,y:0};this.correctionMode='snap';
      }else if(result.mode==='replay'){
        // The old implementation added a positional "replay offset" without
        // re-simulating collision, which was not real input replay. Once both
        // sides acknowledge idle, converge smoothly to authority instead.
        this.pendingCorrection={x:snapshot.position.x-local.position.x,y:snapshot.position.y-local.position.y};
        this.correctionMode='smooth';
      }else if(result.mode==='smooth'){
        this.pendingCorrection={x:snapshot.position.x-local.position.x,y:snapshot.position.y-local.position.y};
        this.correctionMode='smooth';
      }else{
        this.pendingCorrection={x:0,y:0};this.correctionMode='none';
      }
    }
    update(dt){
      const amount=Math.min(1,CONFIG.correctionSpeed*dt);
      const step={x:this.pendingCorrection.x*amount,y:this.pendingCorrection.y*amount};
      if(Math.hypot(step.x,step.y)>.01)this.adapter.offsetLocalPlayer?.(step,'smooth');
      this.pendingCorrection.x-=step.x;this.pendingCorrection.y-=step.y;
      if(Math.hypot(this.pendingCorrection.x,this.pendingCorrection.y)<.1){this.pendingCorrection={x:0,y:0};if(this.correctionMode==='smooth')this.correctionMode='none';}
    }
  }

  class RemoteInterpolationController {
    constructor(adapter){this.adapter=adapter;this.buffer=new SnapshotBuffer();this.correctionMode='none';}
    push(snapshot,receivedAt){this.buffer.push(snapshot,receivedAt);}
    update(renderNow){
      const sampled=this.buffer.sample(renderNow-CONFIG.interpolationDelayMs);if(!sampled)return;
      const current=this.adapter.getRemotePlayerState?.();
      const error=current?distance(current.position,sampled.position):0;
      this.correctionMode=error>=CONFIG.remoteSnapThreshold?'snap':sampled.extrapolated?'extrapolate':'interpolate';
      const idle=Math.hypot(sampled.velocity?.x||0,sampled.velocity?.y||0)<IDLE_VELOCITY_EPSILON;
      if(current&&idle&&error<IDLE_POSITION_EPSILON)return;
      this.adapter.setRemotePlayerTransform?.(sampled,this.correctionMode);
    }
  }

  class AuthoritySimulationController {
    constructor(adapter){this.adapter=adapter;this.pendingInputs=new Map();this.lastProcessedInputSequenceByPlayer={};this.serverTick=0;}
    submitInput(packet){
      if(!packet?.playerId)return;
      const previous=this.pendingInputs.get(packet.playerId);
      if(!previous||packet.sequence>previous.sequence)this.pendingInputs.set(packet.playerId,packet);
    }
    simulateTick(tick,dt){
      this.serverTick=tick;
      for(const [playerId,packet] of this.pendingInputs){
        this.adapter.applyAuthorityInput?.(packet,dt);
        this.lastProcessedInputSequenceByPlayer[playerId]=packet.sequence;
      }
      this.pendingInputs.clear();
      this.adapter.validateAuthorityState?.(dt);
    }
    createSnapshot(){
      const raw=this.adapter.captureAuthoritySnapshot?.()||{};
      return new MatchStateSnapshot({...raw,snapshotTick:this.serverTick,serverTick:this.serverTick,serverTime:now(),lastProcessedInputSequenceByPlayer:{...this.lastProcessedInputSequenceByPlayer}});
    }
  }
  class LocalAuthorityRuntime extends AuthoritySimulationController {}

  class NetworkTransformSync {
    constructor(adapter,transport){
      this.adapter=adapter;this.transport=transport;this.session={};this.inputSequence=0;this.latestInput=null;this.localTick=0;this.serverTick=0;
      this.inputTick=new NetworkTickManager(CONFIG.networkHz);this.snapshotTick=new NetworkTickManager(CONFIG.snapshotHz);
      this.prediction=new ClientPredictionController(adapter);this.remoteInterpolation=new RemoteInterpolationController(adapter);this.authority=null;
      this.debug={ping:0,inputSendRate:0,snapshotReceiveRate:0,lastInputWindowAt:now(),inputWindowCount:0,snapshotWindowCount:0};
      this.lastReceivedSnapshotTick=-1;
      this.inputTick.add((tick,dt,time)=>this.fixedInputTick(tick,dt,time));
      this.snapshotTick.add(()=>this.fixedSnapshotTick());
    }
    configureSession(session){
      this.session={...session};
      this.session.isAuthorityRuntime=!!session.localPlayerId&&session.localPlayerId===session.authorityOwnerId;
      this.authority=this.session.isAuthorityRuntime?new LocalAuthorityRuntime(this.adapter):null;
      this.updateOverlay();
    }
    start(){this.inputTick.start();this.snapshotTick.start();}
    stop(){
      this.inputTick.stop();this.snapshotTick.stop();this.prediction.history.clear();this.remoteInterpolation.buffer.clear();
      this.latestInput=null;this.authority=null;this.session={};this.lastReceivedSnapshotTick=-1;
      window.APEX_MULTIPLAYER_DEBUG?.hide?.();
    }
    captureLocalInput(input){
      const pressed=new Set([...(this.latestInput?.pressed||[]),...(input?.pressed||[])]);
      this.latestInput={...input,held:[...(input?.held||[])],pressed:[...pressed]};
    }
    fixedInputTick(tick,dt){
      this.localTick=tick;if(!this.session.localPlayerId)return;
      if(this.latestInput){
        const packet=PlayerInputPacket.fromInput(this.latestInput,{localPlayerId:this.session.localPlayerId,localPlayerSlot:this.session.localPlayerSlot,tick,sequence:++this.inputSequence,localState:this.adapter.getLocalPlayerState?.()});
        this.latestInput={...this.latestInput,pressed:[]};
        this.prediction.record(packet);this.debug.inputWindowCount++;
        if(this.session.isAuthorityRuntime)this.authority?.submitInput(packet);else this.transport.sendInput?.(packet);
      }
      // Authority simulation must advance even while its own player is idle.
      // Otherwise queued P2 inputs are never processed until P1 presses a key.
      if(this.session.isAuthorityRuntime)this.authority?.simulateTick(tick,dt);
      this.refreshRates();this.updateOverlay();
    }
    renderFrame(renderNow=now()){
      const dt=Math.min(.05,Math.max(0,(renderNow-(this.lastRenderAt||renderNow))/1000));
      this.lastRenderAt=renderNow;this.prediction.update(dt);this.remoteInterpolation.update(renderNow);
    }
    fixedSnapshotTick(){if(!this.session.isAuthorityRuntime||!this.authority)return;const snapshot=this.authority.createSnapshot();this.transport.sendSnapshot?.(snapshot);this.processSnapshot(snapshot,true);}
    receiveInput(packet){if(this.session.isAuthorityRuntime)this.authority?.submitInput(packet);}
    simulateAuthorityTick(tick,dt){if(this.session.isAuthorityRuntime)this.authority?.simulateTick(tick,dt);}
    receiveSnapshot(snapshot){if(this.session.isAuthorityRuntime)return;this.debug.snapshotWindowCount++;this.processSnapshot(snapshot,false);}
    processSnapshot(snapshot,isLocalAuthority){
      if(!snapshot)return;
      const incomingTick=Number(snapshot.serverTick??snapshot.snapshotTick);
      if(!isLocalAuthority&&Number.isFinite(incomingTick)&&incomingTick<=this.lastReceivedSnapshotTick)return;
      if(!isLocalAuthority&&Number.isFinite(incomingTick))this.lastReceivedSnapshotTick=incomingTick;
      this.serverTick=Number.isFinite(incomingTick)?incomingTick:this.serverTick;
      const local=snapshot.players?.find(player=>player.playerId===this.session.localPlayerId||player.playerSlot===this.session.localPlayerSlot);
      const remote=snapshot.players?.find(player=>player.playerId===this.session.remotePlayerId||player.playerSlot===this.session.remotePlayerSlot);
      if(local){const ack=snapshot.lastProcessedInputSequenceByPlayer?.[this.session.localPlayerId]||0;if(!isLocalAuthority)this.prediction.reconcile(local,ack);}
      if(remote&&!isLocalAuthority)this.remoteInterpolation.push(remote,now());
      this.adapter.applyAuthorityMatchState?.(snapshot);
    }
    refreshRates(){const elapsed=now()-this.debug.lastInputWindowAt;if(elapsed<1000)return;this.debug.inputSendRate=Math.round(this.debug.inputWindowCount*1000/elapsed);this.debug.snapshotReceiveRate=Math.round(this.debug.snapshotWindowCount*1000/elapsed);this.debug.inputWindowCount=0;this.debug.snapshotWindowCount=0;this.debug.lastInputWindowAt=now();}
    setPing(ms){this.debug.ping=Math.max(0,Math.round(ms||0));}
    updateOverlay(){window.APEX_MULTIPLAYER_DEBUG?.update?.(this.getDebugState());}
    getDebugState(){return {...this.session,localTick:this.localTick,serverTick:this.serverTick,ping:this.debug.ping,lastSentInputSequence:this.inputSequence,lastAcknowledgedInputSequence:this.prediction.lastAcknowledgedSequence,snapshotBufferSize:this.remoteInterpolation.buffer.size,localPositionError:this.prediction.lastError,remoteInterpolationDelay:CONFIG.interpolationDelayMs,correctionMode:this.prediction.correctionMode,remoteCorrectionMode:this.remoteInterpolation.correctionMode,packetSendRate:this.debug.inputSendRate,snapshotReceiveRate:this.debug.snapshotReceiveRate};}
  }

  class MatchStateReplicator {}
  class MultiplayerDebugOverlay {
    update(state={}){
      const root=document.getElementById('multiplayer-debug-overlay'),content=document.getElementById('multiplayer-debug-content');
      if(!root||!content)return;
      root.classList.remove('hidden');
      const lines=[
        `localPlayerId: ${state.localPlayerId||'-'} (${state.localPlayerSlot||'-'})`,
        `remotePlayerId: ${state.remotePlayerId||'-'} (${state.remotePlayerSlot||'-'})`,
        `roomCreatorId: ${state.roomCreatorId||'-'}`,
        `authorityOwnerId: ${state.authorityOwnerId||'-'}`,
        `isAuthorityRuntime: ${state.isAuthorityRuntime?'YES':'NO'}`,
        `tick local/server: ${state.localTick||0} / ${state.serverTick||0}`,
        `ping: ${state.ping||0}ms`,
        `input seq sent/ack: ${state.lastSentInputSequence||0} / ${state.lastAcknowledgedInputSequence||0}`,
        `snapshot buffer: ${state.snapshotBufferSize||0}`,
        `local error: ${(state.localPositionError||0).toFixed(2)}`,
        `local correction: ${state.correctionMode||'none'}`,
        `remote mode: ${state.remoteCorrectionMode||'none'}`,
        `interpolation delay: ${state.remoteInterpolationDelay||0}ms`,
        `packet/s snapshot/s: ${state.packetSendRate||0} / ${state.snapshotReceiveRate||0}`
      ];
      content.textContent=lines.join('\n');
    }
    hide(){document.getElementById('multiplayer-debug-overlay')?.classList.add('hidden');}
  }
  window.APEX_MULTIPLAYER_DEBUG=new MultiplayerDebugOverlay();
  window.APEX_REALTIME_MULTIPLAYER={CONFIG,NetworkTickManager,PlayerInputPacket,PlayerInputHistory,PlayerStateSnapshot,MatchStateSnapshot,SnapshotBuffer,AuthoritySimulationController,LocalAuthorityRuntime,ClientPredictionController,ServerReconciliationController,RemoteInterpolationController,NetworkTransformSync,MatchStateReplicator,MultiplayerDebugOverlay};
  window.apexRealtimeMultiplayer=true;
})();
