// Lightweight realtime rooms for MANUAL LAB.
// Uses VITE_MANUAL_ROOM_WS_URL when provided; otherwise falls back to the local Vite relay.
(function APEX_MANUAL_LAB_ONLINE(){
  if (window.__apexManualLabOnline) return;
  window.__apexManualLabOnline = true;

  const ROOM_ROUTE = '/__manual-lab-room';
  const INPUT_SEND_MS = 33;
  const SNAPSHOT_SEND_MS = 50;
  const state = window.APEX_MANUAL_LAB_ONLINE = {
    socket:null,
    room:null,
    role:null,
    connected:false,
    peers:0,
    lastError:null,
    lastSnapshotAt:0,
    lastPongAt:0,
    heartbeatTimer:0
  };

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
    if (input && code) input.value = code;
  }
  function setRole(role) {
    const el = $('manual-room-role');
    if (el) el.textContent = role ? role.toUpperCase() : 'OFFLINE';
  }
  function updatePanel() {
    setCode(state.room);
    setRole(state.role);
    const start = $('manual-room-start');
    if (start) start.disabled = state.role !== 'host';
    const leave = $('manual-room-leave');
    if (leave) leave.disabled = !state.connected;
  }
  function send(payload) {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return false;
    state.socket.send(JSON.stringify(payload));
    return true;
  }
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
      } else if (msg.type === 'created') {
        state.room = msg.room;
        state.role = 'host';
        state.peers = 1;
        status(`CONTROL ONLINE ${msg.room} CREATED · SEND CODE TO PLAYER 2`, 'ok');
      } else if (msg.type === 'joined') {
        state.room = msg.room;
        state.role = msg.role;
        state.peers = msg.peers || 1;
        status(msg.role === 'guest' ? `JOINED CONTROL ${msg.room} · WAIT HOST START` : `CONTROL ROOM ${msg.room} READY`, 'ok');
      } else if (msg.type === 'peer-joined') {
        state.peers = msg.peers || 2;
        status('PLAYER 2 CONNECTED · HOST CAN START ONLINE', 'ok');
      } else if (msg.type === 'peer-left') {
        state.peers = 1;
        lab()?.applyRemoteInput?.({held:[],pressed:[],moveVector:{x:0,y:0},pointerInside:false});
        status('OTHER PLAYER LEFT');
      } else if (msg.type === 'room-start') {
        const slot = state.role === 'guest' ? 1 : 0;
        prepareOnlineMatchAudio();
        lab()?.startNetworkMatch?.(msg.p1, msg.p2, slot, state.room);
        status(`CONTROL ONLINE STARTED · YOU ARE P${slot + 1}`, 'ok');
      } else if (msg.type === 'input') {
        lab()?.applyRemoteInput?.(msg.input);
      } else if (msg.type === 'snapshot') {
        if (state.role === 'guest') lab()?.applyMatchSnapshot?.(msg.snapshot, {protectLocal:true});
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
    updatePanel();
    status('ROOM CLOSED');
  }
  function prepareOnlineMatchAudio() {
    try { window.apexStopMenuMusic?.(true); } catch {}
    try { window.apexStopBattleAudio?.(); } catch {}
  }
  function startRoomMatch() {
    if (state.role !== 'host') { status('GUEST WAITS FOR HOST START', 'error'); return false; }
    const p1Selected = selectedFighter(1);
    const p2Selected = selectedFighter(2);
    if (!p1Selected || !p2Selected) { status('HOST MUST SELECT BOTH CHAMPIONS', 'error'); return false; }
    const p1 = fighterName(p1Selected);
    const p2 = fighterName(p2Selected);
    if (!p1 || !p2) { status('INVALID CHAMPION SELECTION', 'error'); return false; }
    send({type:'room-start', p1, p2});
    prepareOnlineMatchAudio();
    lab()?.startNetworkMatch?.(p1, p2, 0, state.room);
    status('CONTROL ONLINE STARTED · YOU ARE P1', 'ok');
    return true;
  }

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
      if (state.role === 'guest') return false;
    }
    return previousStartMatch?.apply(this, arguments);
  };
  try { startMatch = window.startMatch; } catch (error) {}
  Object.assign(window.apexReactBridge || {}, { startMatch:window.startMatch });

  let lastInputSent = 0;
  let lastInputHash = '';
  window.addEventListener('apex-manual-lab-input-frame', event => {
    if (!state.room || !state.connected) return;
    const now = performance.now();
    const inputHash = JSON.stringify(event.detail || {});
    if (inputHash !== lastInputHash || now - lastInputSent >= INPUT_SEND_MS) {
      lastInputSent = now;
      lastInputHash = inputHash;
      send({type:'input', input:event.detail});
    }
    if (state.role === 'host' && now - state.lastSnapshotAt >= SNAPSHOT_SEND_MS) {
      state.lastSnapshotAt = now;
      const snapshot = lab()?.getMatchSnapshot?.();
      if (snapshot) send({type:'snapshot', snapshot});
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookUi, {once:true});
  else hookUi();
})();
