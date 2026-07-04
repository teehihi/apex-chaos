// Lightweight realtime rooms for MANUAL LAB.
// Uses VITE_MANUAL_ROOM_WS_URL when provided; otherwise falls back to the local Vite relay.
(function APEX_MANUAL_LAB_ONLINE(){
  if (window.__apexManualLabOnline) return;
  window.__apexManualLabOnline = true;

  const ROOM_ROUTE = '/__manual-lab-room';
  const INPUT_SEND_MS = 33;
  const SNAPSHOT_SEND_MS = 50;
  const PLAYER_STATE_SEND_MS = 40;
  const state = window.APEX_MANUAL_LAB_ONLINE = {
    socket:null,
    room:null,
    role:null,
    connected:false,
    peers:0,
    lastError:null,
    lastSnapshotAt:0,
    lastPlayerStateAt:0,
    lastPongAt:0,
    heartbeatTimer:0,
    selectedFighters:{P1:null,P2:null},
    lockedFighters:{P1:null,P2:null},
    championLocked:false,
    matchStarting:false
  };
  Object.assign(state,{
    roomCreatorId:null,authorityOwnerId:null,localPlayerId:null,remotePlayerId:null,
    localPlayerSlot:null,remotePlayerSlot:null,isAuthorityRuntime:false,networkSync:null
  });

  const $ = id => document.getElementById(id);
  const lab = () => window.APEX_MANUAL_LAB;
  const fighterName = ft => ft?.name || null;
  function sanitizeRoomCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }
  function selectedFighter(slot) {
    const key = slot === 1 ? 'p1Selection' : 'p2Selection';
    if (window[key]) return window[key];
    try {
      // p1Selection/p2Selection are var globals in the engine script; reading
      // them directly covers browsers that do not mirror them onto window in
      // all script/module combinations.
      return slot === 1 ? p1Selection : p2Selection;
    } catch (error) {
      return null;
    }
  }
  function status(text, kind='') {
    const el = $('manual-room-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('invalid', kind === 'error');
    el.classList.toggle('valid', kind === 'ok');
  }
  function setCode(code) {
    const el = $('manual-room-code');
    if (el) el.textContent = code || '----';
    const input = $('manual-room-input');
    if (input) input.value = code || '';
  }
  function setRole(role) {
    const el = $('manual-room-role');
    if (el) el.textContent = role ? role.toUpperCase() : 'OFFLINE';
  }
  function updatePanel() {
    setCode(state.room);
    setRole(state.role);
    const start = $('manual-room-start');
    if (start) start.disabled = !state.isAuthorityRuntime || state.peers < 2;
    const select = $('manual-room-select');
    if (select) select.disabled = !state.room || !state.role;
    const leave = $('manual-room-leave');
    if (leave) leave.disabled = !state.connected;
  }
  function send(payload) {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return false;
    state.socket.send(JSON.stringify(payload));
    return true;
  }
  function applySessionIdentity(message={}) {
    for (const key of ['roomCreatorId','authorityOwnerId','localPlayerId','remotePlayerId','localPlayerSlot','remotePlayerSlot','roomRole']) {
      if (message[key] !== undefined) state[key]=message[key];
    }
    state.isAuthorityRuntime=!!state.localPlayerId&&state.localPlayerId===state.authorityOwnerId;
  }
  function slotIndex(slot){return slot==='P2'?1:0;}
  function playerIdForSlot(slot){
    if(state.localPlayerSlot===slot)return state.localPlayerId;
    if(state.remotePlayerSlot===slot)return state.remotePlayerId;
    return null;
  }
  function createNetworkAdapter(){
    return {
      getLocalPlayerState(){const value=lab()?.getLocalFighterState?.();return value?{...value,position:value.position||{x:value.x,y:value.y},facingDirection:value.facingDirection||value.dir}:null;},
      getRemotePlayerState(){return lab()?.getPlayerNetworkState?.(slotIndex(state.remotePlayerSlot));},
      setLocalPlayerTransform(value,mode){return lab()?.setLocalPlayerTransform?.(value,mode);},
      offsetLocalPlayer(delta,mode){return lab()?.offsetLocalPlayer?.(delta,mode);},
      setRemotePlayerTransform(value,mode){return lab()?.setRemotePlayerTransform?.(value,mode);},
      applyAuthorityInput(packet){
        if(packet?.playerId===state.localPlayerId)return;
        lab()?.applyRemoteInput?.({seq:packet.sequence,held:packet.held,pressed:packet.pressed,aimPoint:packet.aimPoint,pointerInside:packet.pointerInside,moveVector:{x:packet.moveX,y:packet.moveY}});
      },
      validateAuthorityState(){/* Existing APEX CONTROL collision/combat loop remains the authority simulation adapter. */},
      captureAuthoritySnapshot(){
        const raw=lab()?.getMatchSnapshot?.()||{};
        const players=['P1','P2'].map(slot=>{
          const value=lab()?.getPlayerNetworkState?.(slotIndex(slot));
          return value?{...value,playerId:playerIdForSlot(slot),playerSlot:slot}:null;
        }).filter(Boolean);
        return {raw,players,roundState:raw.match?.state||null,timer:raw.match?.timeLeft??raw.t??null,winner:raw.match?.winner||null,importantEvents:[]};
      },
      applyAuthorityMatchState(snapshot){
        lab()?.applyMatchSnapshot?.(snapshot.raw||snapshot,{protectLocal:true,applyTransforms:false});
        lab()?.applyAuthorityPlayerStates?.(snapshot.players||[]);
      }
    };
  }
  function startNetworkRuntime(){
    const Runtime=window.APEX_REALTIME_MULTIPLAYER?.NetworkTransformSync;
    if(!Runtime||!state.localPlayerId||!state.authorityOwnerId)return false;
    state.networkSync?.stop?.();
    state.networkSync=new Runtime(createNetworkAdapter(),{
      sendInput:packet=>send({type:'input-v2',packet}),
      sendSnapshot:snapshot=>send({type:'snapshot-v2',snapshot})
    });
    state.networkSync.configureSession({
      localPlayerId:state.localPlayerId,remotePlayerId:state.remotePlayerId,
      localPlayerSlot:state.localPlayerSlot,remotePlayerSlot:state.remotePlayerSlot,
      roomCreatorId:state.roomCreatorId,authorityOwnerId:state.authorityOwnerId,
      isAuthorityRuntime:state.isAuthorityRuntime
    });
    state.networkSync.start();
    return true;
  }
  function stopNetworkRuntime(){state.networkSync?.stop?.();state.networkSync=null;}
  function startHeartbeat() {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = setInterval(() => {
      if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;
      send({type:'ping', t:performance.now()});
    }, 2500);
  }
  function stopHeartbeat() {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = 0;
  }
  function roomWebSocketUrl() {
    const configured = String(window.APEX_MANUAL_ROOM_WS_URL || '').trim();
    if (configured) return configured;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}${ROOM_ROUTE}`;
  }
  function connect() {
    if (state.socket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(state.socket.readyState)) return state.socket;
    const url = roomWebSocketUrl();
    const external = String(window.APEX_MANUAL_ROOM_WS_URL || '').trim();
    const socket = state.socket = new WebSocket(url);
    socket.addEventListener('open', () => {
      state.connected = true;
      state.lastError = null;
      state.lastPongAt = performance.now();
      startHeartbeat();
      status(external ? 'CONNECTED TO ONLINE ROOM RELAY' : 'CONNECTED TO LOCAL ROOM RELAY', 'ok');
      updatePanel();
    });
    socket.addEventListener('close', () => {
      state.connected = false;
      state.peers = 0;
      stopHeartbeat();
      status('ROOM DISCONNECTED');
      updatePanel();
    });
    socket.addEventListener('error', () => {
      state.lastError = 'ROOM RELAY ERROR';
      status(external ? 'ROOM RELAY ERROR - CHECK VITE_MANUAL_ROOM_WS_URL' : 'ROOM RELAY ERROR - RUN VIA VITE DEV SERVER', 'error');
    });
    socket.addEventListener('message', event => {
      let msg = null;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'pong') {
        state.lastPongAt = performance.now();
        state.networkSync?.setPing?.(performance.now()-Number(msg.t||performance.now()));
      } else if (msg.type === 'created') {
        applySessionIdentity(msg);
        state.room = msg.room;
        state.role = 'host';
        state.peers = 1;
        state.lockedFighters = {P1:null,P2:null};
        state.selectedFighters = {P1:null,P2:null};
        state.championLocked = false;
        state.matchStarting = false;
        stopNetworkRuntime();
        status(`CONTROL ONLINE ${msg.room} CREATED · SEND CODE TO PLAYER 2`, 'ok');
      } else if (msg.type === 'joined') {
        applySessionIdentity(msg);
        state.room = msg.room;
        state.role = msg.role;
        state.peers = msg.peers || 1;
        state.lockedFighters = {P1:null,P2:null};
        state.selectedFighters = {P1:null,P2:null};
        state.championLocked = false;
        state.matchStarting = false;
        status(msg.role === 'guest' ? `JOINED CONTROL ${msg.room} · WAIT HOST START` : `CONTROL ROOM ${msg.room} READY`, 'ok');
        if (state.peers >= 2) window.openManualOnlineChampionSelect?.();
      } else if (msg.type === 'peer-joined') {
        applySessionIdentity(msg);
        state.peers = msg.peers || 2;
        status('PLAYER 2 CONNECTED · SELECTING CHAMPIONS', 'ok');
        window.openManualOnlineChampionSelect?.();
      } else if (msg.type === 'peer-left') {
        state.peers = 1;
        lab()?.applyRemoteInput?.({held:[],pressed:[],moveVector:{x:0,y:0},pointerInside:false});
        status('OTHER PLAYER LEFT');
      } else if (msg.type === 'room-start') {
        const slot = slotIndex(state.localPlayerSlot);
        prepareOnlineMatchAudio();
        lab()?.startNetworkMatch?.(msg.p1, msg.p2, slot, state.room);
        startNetworkRuntime();
        status(`CONTROL ONLINE STARTED · YOU ARE P${slot + 1}`, 'ok');
      } else if (msg.type === 'fighter-select') {
        const playerSlot = msg.fromPlayerSlot || (msg.from === 'guest' ? 'P2' : 'P1');
        state.selectedFighters ||= {P1:null,P2:null};
        state.selectedFighters[playerSlot] = msg.fighter || null;
        window.apexApplyOnlineFighterSelection?.(playerSlot, msg.fighter);
      } else if (msg.type === 'fighter-lock') {
        const playerSlot = msg.fromPlayerSlot || (msg.from === 'guest' ? 'P2' : 'P1');
        state.lockedFighters[playerSlot] = msg.fighter || null;
        window.apexApplyOnlineFighterSelection?.(playerSlot, msg.fighter);
        maybeStartLockedMatch();
      } else if (msg.type === 'room-destroyed') {
        const localClosed = msg.by === state.role;
        const destroyedBy = localClosed ? 'YOU CLOSED THE ROOM' : 'OTHER PLAYER CLOSED THE ROOM';
        status(destroyedBy, 'error');
        stopNetworkRuntime();
        state.room = null;
        state.role = null;
        state.connected = false;
        state.peers = 0;
        state.lockedFighters = {P1:null,P2:null};
        state.selectedFighters = {P1:null,P2:null};
        state.championLocked = false;
        state.matchStarting = false;
        document.body.classList.remove('manual-online-select');
        updatePanel();
        try { state.socket?.close(); } catch {}
        window.goToMenu?.();
        showRoomNotice(
          localClosed ? 'ROOM CLOSED' : 'OPPONENT LEFT THE BATTLE',
          localClosed
            ? 'The online battle room has been closed for both players.'
            : 'Your opponent left the match. The online room has been closed.'
        );
      } else if (msg.type === 'input') {
        lab()?.applyRemoteInput?.(msg.input);
      } else if (msg.type === 'input-v2') {
        state.networkSync?.receiveInput?.(msg.packet);
      } else if (msg.type === 'player-state') {
        if (state.isAuthorityRuntime && msg.fromPlayerId !== state.localPlayerId) lab()?.applyRemoteFighterState?.(msg.state);
      } else if (msg.type === 'snapshot') {
        if (!state.isAuthorityRuntime) lab()?.applyMatchSnapshot?.(msg.snapshot, {protectLocal:true});
      } else if (msg.type === 'snapshot-v2') {
        state.networkSync?.receiveSnapshot?.(msg.snapshot);
      } else if (msg.type === 'error') {
        state.lastError = msg.reason || 'ROOM ERROR';
        status(state.lastError, 'error');
      }
      updatePanel();
    });
    return socket;
  }
  function createRoom() {
    const socket = connect();
    if (socket.readyState === WebSocket.OPEN) send({type:'create', mode:'manual'});
    else socket.addEventListener('open', () => send({type:'create', mode:'manual'}), {once:true});
  }
  function joinRoom() {
    const code = sanitizeRoomCode($('manual-room-input')?.value);
    if (!code) { status('ENTER ROOM CODE', 'error'); return; }
    const socket = connect();
    const payload = {type:'join', room:code, mode:'manual'};
    if (socket.readyState === WebSocket.OPEN) send(payload);
    else socket.addEventListener('open', () => send(payload), {once:true});
  }
  function leaveRoom() {
    send({type:'leave'});
    try { state.socket?.close(); } catch {}
    stopHeartbeat();
    state.room = null;
    state.role = null;
    state.connected = false;
    state.peers = 0;
    state.lockedFighters = {P1:null,P2:null};
    state.selectedFighters = {P1:null,P2:null};
    state.championLocked = false;
    state.matchStarting = false;
    stopNetworkRuntime();
    document.body.classList.remove('manual-online-select');
    updatePanel();
    status('ROOM CLOSED');
  }
  function prepareOnlineMatchAudio() {
    try { window.apexStopMenuMusic?.(true); } catch {}
    try { window.apexStopBattleAudio?.(); } catch {}
  }
  function startRoomMatch() {
    if (!state.isAuthorityRuntime) { status('WAITING FOR AUTHORITY RUNTIME', 'error'); return false; }
    const p1Selected = selectedFighter(1);
    const p2Selected = selectedFighter(2);
    if (!p1Selected || !p2Selected) { status('HOST MUST SELECT BOTH CHAMPIONS', 'error'); return false; }
    const p1 = fighterName(p1Selected);
    const p2 = fighterName(p2Selected);
    if (!p1 || !p2) { status('INVALID CHAMPION SELECTION', 'error'); return false; }
    send({type:'room-start', p1, p2});
    prepareOnlineMatchAudio();
    const localSlot=slotIndex(state.localPlayerSlot);
    lab()?.startNetworkMatch?.(p1, p2, localSlot, state.room);
    startNetworkRuntime();
    status(`CONTROL ONLINE STARTED · YOU ARE ${state.localPlayerSlot}`, 'ok');
    return true;
  }

  function maybeStartLockedMatch() {
    const p1Fighter = state.lockedFighters.P1;
    const p2Fighter = state.lockedFighters.P2;
    if (!state.isAuthorityRuntime || state.matchStarting || !p1Fighter || !p2Fighter) return false;
    state.matchStarting = true;
    send({type:'room-start', p1:p1Fighter, p2:p2Fighter});
    prepareOnlineMatchAudio();
    lab()?.startNetworkMatch?.(p1Fighter, p2Fighter, slotIndex(state.localPlayerSlot), state.room);
    startNetworkRuntime();
    return true;
  }

  function lockChampion() {
    if (!state.room || !state.role || state.peers < 2 || state.championLocked) return false;
    const slot = state.localPlayerSlot === 'P2' ? 2 : 1;
    const fighter = fighterName(selectedFighter(slot));
    if (!fighter) { status('SELECT A CHAMPION FIRST', 'error'); return false; }
    state.championLocked = true;
    state.lockedFighters[state.localPlayerSlot] = fighter;
    send({type:'fighter-lock', fighter});
    const title = document.getElementById('select-title');
    if (title) title.textContent = `${fighter} READY · WAITING FOR RIVAL`;
    const button = $('start-btn');
    if (button) {
      button.disabled = true;
      const label = button.querySelector('span');
      if (label) label.textContent = 'READY ✓';
    }
    window.apexSyncOnlineReadyState?.();
    maybeStartLockedMatch();
    return true;
  }
  window.lockManualRoomChampion = lockChampion;
  state.selectChampion = function selectChampion(fighter) {
    if (!state.room || !state.role || state.peers < 2 || state.championLocked) return false;
    state.selectedFighters ||= {P1:null,P2:null};
    state.selectedFighters[state.localPlayerSlot] = fighter;
    send({type:'fighter-select', fighter});
    return true;
  };

  function destroyActiveRoom() {
    if (!state.room) return false;
    send({type:'destroy-room'});
    window.setTimeout(() => {
      if (!state.room) return;
      const socket = state.socket;
      stopNetworkRuntime();
      state.room = null;
      state.role = null;
      updatePanel();
      try { socket?.close(); } catch {}
      window.goToMenu?.();
    }, 450);
    return true;
  }

  function dialogElements() {
    return {
      root:$('manual-room-dialog'),
      title:$('manual-room-dialog-title'),
      message:$('manual-room-dialog-message'),
      confirmActions:$('manual-room-dialog-confirm-actions'),
      noticeActions:$('manual-room-dialog-notice-actions')
    };
  }
  function showRoomDestroyConfirm() {
    if (!state.room || !lab()?.active) return false;
    const dialog = dialogElements();
    if (!dialog.root) return false;
    dialog.title.textContent = 'CLOSE BATTLE ROOM?';
    dialog.message.textContent = 'Leaving now will end the match and close the room for both players.';
    dialog.confirmActions?.classList.remove('hidden');
    dialog.noticeActions?.classList.add('hidden');
    dialog.root.classList.remove('hidden');
    return true;
  }
  function showRoomNotice(title, message) {
    const dialog = dialogElements();
    if (!dialog.root) return;
    dialog.title.textContent = title;
    dialog.message.textContent = message;
    dialog.confirmActions?.classList.add('hidden');
    dialog.noticeActions?.classList.remove('hidden');
    dialog.root.classList.remove('hidden');
  }
  function hideRoomDialog() {
    $('manual-room-dialog')?.classList.add('hidden');
  }
  window.cancelManualRoomDestroy = hideRoomDialog;
  window.confirmManualRoomDestroy = function confirmManualRoomDestroy() {
    hideRoomDialog();
    return destroyActiveRoom();
  };
  window.acknowledgeManualRoomNotice = hideRoomDialog;

  function hookUi() {
    if (state.uiHooked) return;
    state.uiHooked = true;
    document.addEventListener('click', async event => {
      const target = event.target?.closest?.('#manual-room-create,#manual-room-join,#manual-room-leave,#manual-room-start,#manual-room-copy');
      if (!target) return;
      event.preventDefault();
      if (target.id === 'manual-room-create') createRoom();
      else if (target.id === 'manual-room-join') joinRoom();
      else if (target.id === 'manual-room-leave') leaveRoom();
      else if (target.id === 'manual-room-start') startRoomMatch();
      else if (target.id === 'manual-room-copy') {
        if (!state.room) return;
        try { await navigator.clipboard?.writeText(state.room); status('ROOM CODE COPIED', 'ok'); } catch { status('COPY FAILED'); }
      }
    });
    updatePanel();
  }

  const previousStartMatch = window.startMatch;
  window.startMatch = function manualOnlineStartMatch() {
    if (state.room && state.role) {
      if (startRoomMatch()) return true;
      if (!state.isAuthorityRuntime) return false;
    }
    return previousStartMatch?.apply(this, arguments);
  };
  try { startMatch = window.startMatch; } catch (error) {}
  Object.assign(window.apexReactBridge || {}, { startMatch:window.startMatch });

  const previousExitAutoBattle = window.exitAutoBattle;
  window.exitAutoBattle = function manualOnlineExit() {
    if (state.room && lab()?.active) return showRoomDestroyConfirm();
    return previousExitAutoBattle?.apply(this, arguments);
  };
  try { exitAutoBattle = window.exitAutoBattle; } catch (error) {}
  Object.assign(window.apexReactBridge || {}, { exitAutoBattle:window.exitAutoBattle });

  let lastInputSent = 0;
  let lastInputHash = '';
  window.addEventListener('apex-manual-lab-input-frame', event => {
    if (!state.room || !state.connected) return;
    if (state.networkSync) {
      state.networkSync.captureLocalInput(event.detail);
      state.networkSync.renderFrame(performance.now());
      return;
    }
    const now = performance.now();
    const inputHash = JSON.stringify(event.detail || {});
    if (inputHash !== lastInputHash || now - lastInputSent >= INPUT_SEND_MS) {
      lastInputSent = now;
      lastInputHash = inputHash;
      send({type:'input', input:event.detail});
    }
    if (!state.isAuthorityRuntime && now - state.lastPlayerStateAt >= PLAYER_STATE_SEND_MS) {
      state.lastPlayerStateAt = now;
      const playerState = lab()?.getLocalFighterState?.();
      if (playerState) send({type:'player-state', state:playerState});
    }
    if (state.isAuthorityRuntime && now - state.lastSnapshotAt >= SNAPSHOT_SEND_MS) {
      state.lastSnapshotAt = now;
      const snapshot = lab()?.getMatchSnapshot?.();
      if (snapshot) send({type:'snapshot', snapshot});
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookUi, {once:true});
  else hookUi();
})();
