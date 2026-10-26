import { ENEMY_MAP, ORIGIN_MAP } from './data.js';
import {
  createOnlineBattle,
  onlineEndTurn as engineEndTurn,
  onlinePlayCard,
} from './online-engine.js';
import { G, getHeroName, saveProfileDebounced, saveProfileNow } from './state.js';

const VALID_MODES = new Set(['pvp', 'coop']);
const PING_INTERVAL = 15000;
const CONNECT_TIMEOUT = 9000;
const ACTION_TIMEOUT = 9000;

const state = {
  status: 'idle',
  pendingAction: '',
  role: null,
  code: '',
  mode: 'pvp',
  enemyId: 'nightmare-dragon',
  host: null,
  guest: null,
  battle: null,
  error: '',
  notice: '',
  noticeSeq: 0,
  latency: null,
  pending: false,
  rematchRequested: false,
  connected: false,
};

let socket = null;
let pingTimer = null;
let connectTimer = null;
let actionTimer = null;
let noticeSeq = 0;
let manualClose = false;

export function getOnline() {
  return state;
}

function announce(text) {
  state.notice = String(text || '');
  state.noticeSeq = ++noticeSeq;
}

function emit(notice = '') {
  if (notice) announce(notice);
  window.dispatchEvent(new CustomEvent('cardrealm:online', { detail: state }));
}

function resetRoom() {
  state.role = null;
  state.code = '';
  state.host = null;
  state.guest = null;
  state.battle = null;
  state.pending = false;
  state.pendingAction = '';
  state.rematchRequested = false;
  clearActionTimer();
}

function stopPing() {
  clearInterval(pingTimer);
  pingTimer = null;
}

function clearConnectTimer() {
  clearTimeout(connectTimer);
  connectTimer = null;
}

function clearActionTimer() {
  clearTimeout(actionTimer);
  actionTimer = null;
}

function startPing() {
  stopPing();
  pingTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping', t: Date.now() }));
    }
  }, PING_INTERVAL);
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn('联机消息发送失败。', error);
    return false;
  }
}

function sendRelay(data) {
  return send({ type: 'relay', data });
}

function normalizeServerUrl(raw) {
  let value = String(raw || '').trim();
  if (!value) throw new Error('请填写联机服务器地址。');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `ws://${value}`;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('服务器地址格式不正确。');
  }
  if (!['ws:', 'wss:'].includes(url.protocol)) {
    throw new Error('联机地址需要以 ws:// 或 wss:// 开头。');
  }
  return url.toString();
}

function onlineName() {
  return (G.profile.online.name || '').trim().slice(0, 16) || getHeroName().slice(0, 16);
}

function chosenOriginId() {
  const onlineOrigin = G.ui.online.originId;
  if (ORIGIN_MAP[onlineOrigin]) return onlineOrigin;
  if (ORIGIN_MAP[G.profile.originId]) return G.profile.originId;
  return 'blade';
}

function chosenEnemyId() {
  return ENEMY_MAP[G.ui.online.enemyId] ? G.ui.online.enemyId : 'nightmare-dragon';
}

function closeSocket() {
  stopPing();
  clearConnectTimer();
  clearActionTimer();
  manualClose = true;
  const ws = socket;
  socket = null;
  state.connected = false;
  if (!ws) return;
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'leave' }));
    ws.close(1000, 'leaving');
  } catch (error) {
    console.warn('关闭联机连接失败。', error);
  }
}

function tieToSocket(ws) {
  socket = ws;
  manualClose = false;
  state.connected = false;
  ws.addEventListener('open', () => {
    if (socket !== ws) return;
    clearConnectTimer();
    state.connected = true;
    const pending = state.pendingPayload;
    if (pending) send({ type: state.pendingAction, ...pending });
  });
  ws.addEventListener('message', (event) => {
    if (socket !== ws || typeof event.data !== 'string') return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message && typeof message === 'object') handleServerMessage(message);
  });
  ws.addEventListener('error', () => {
    if (socket !== ws) return;
    if (state.status === 'connecting') state.error = '无法连接到联机服务器，检查地址与端口。';
  });
  ws.addEventListener('close', () => {
    const stale = socket !== ws;
    const wasManual = manualClose;
    stopPing();
    clearConnectTimer();
    clearActionTimer();
    if (socket === ws) socket = null;
    manualClose = false;
    if (stale && !wasManual) return;
    state.connected = false;
    if (wasManual) return;
    const previous = state.status;
    resetRoom();
    state.latency = null;
    if (previous === 'connecting') {
      state.status = 'idle';
      if (!state.error) state.error = '连接被关闭了。也许服务器还没有运行。';
    } else if (['waiting', 'ready', 'battle'].includes(previous)) {
      state.status = 'idle';
      state.error = '与服务器的连接断开了，房间已结束。';
    }
    emit(state.error);
  });
}

function beginConnect(kind, payload) {
  closeSocket();
  state.pendingPayload = payload;
  state.pendingAction = kind;
  state.status = 'connecting';
  state.role = null;
  state.code = '';
  state.host = null;
  state.guest = null;
  state.battle = null;
  state.error = '';
  state.pending = false;
  state.rematchRequested = false;
  let url;
  try {
    url = normalizeServerUrl(G.profile.online.serverUrl);
  } catch (error) {
    state.status = 'idle';
    state.pendingAction = '';
    state.pendingPayload = null;
    state.error = error.message;
    emit(state.error);
    return;
  }
  G.profile.online.serverUrl = url;
  saveProfileDebounced(400);
  emit();
  let ws;
  try {
    ws = new WebSocket(url);
  } catch (error) {
    state.status = 'idle';
    state.pendingAction = '';
    state.pendingPayload = null;
    state.error = error?.message || '无法建立联机连接。';
    emit(state.error);
    return;
  }
  tieToSocket(ws);
  connectTimer = setTimeout(() => {
    if (socket !== ws || state.status !== 'connecting') return;
    state.error = '连接超时了。确认服务器已启动，并放行 8787 端口。';
    closeSocket();
    resetRoom();
    state.status = 'idle';
    emit(state.error);
  }, CONNECT_TIMEOUT);
}

export function onlineCreate() {
  if (state.status !== 'idle') return;
  const mode = VALID_MODES.has(G.ui.online.mode) ? G.ui.online.mode : 'pvp';
  const name = onlineName();
  const originId = chosenOriginId();
  const enemyId = chosenEnemyId();
  state.mode = mode;
  state.enemyId = enemyId;
  G.profile.online.name = name;
  saveProfileNow();
  beginConnect('create', { mode, originId, name, enemyId });
}

export function onlineJoin() {
  if (state.status !== 'idle') return;
  const code = String(G.ui.online.joinCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    state.error = '请填写 4–8 位房间码。';
    emit(state.error);
    return;
  }
  const name = onlineName();
  const originId = chosenOriginId();
  G.profile.online.name = name;
  saveProfileNow();
  beginConnect('join', { code, originId, name });
}

export function onlineCancelConnect() {
  closeSocket();
  resetRoom();
  state.status = 'idle';
  state.error = '';
  state.pendingPayload = null;
  emit();
}

export function onlineLeave(quiet = false) {
  closeSocket();
  resetRoom();
  state.status = 'idle';
  state.error = '';
  state.pendingPayload = null;
  state.latency = null;
  emit(quiet ? '' : '你合上了这扇双人梦境。');
}

export function onlineStart() {
  if (state.role !== 'host' || !state.guest) return;
  if (state.status === 'battle' && state.battle?.phase === 'active') return;
  const battle = createOnlineBattle({
    mode: state.mode,
    hostInfo: state.host,
    guestInfo: state.guest,
    enemyId: state.enemyId,
  });
  state.battle = battle;
  state.status = 'battle';
  state.pending = false;
  state.rematchRequested = false;
  state.error = '';
  sendRelay({ kind: 'start', battle: snapshotForGuest(battle) });
  emit('梦开始了。');
}

function myTurn() {
  return Boolean(
    state.battle
    && state.battle.phase === 'active'
    && state.battle.turn === state.role,
  );
}

function armActionTimer() {
  clearActionTimer();
  actionTimer = setTimeout(() => {
    if (!state.pending) return;
    state.pending = false;
    emit('房主还没有回应。你可以在下一回合再试一次。');
  }, ACTION_TIMEOUT);
}

function applyGuestAction(data) {
  if (!state.battle || state.battle.phase !== 'active') return;
  let result;
  if (data.kind === 'action-play') {
    result = onlinePlayCard(state.battle, 'guest', String(data.cardUid || ''));
  } else {
    result = engineEndTurn(state.battle, 'guest');
  }
  if (!result.ok) {
    sendRelay({ kind: 'notice', message: result.error || '这个动作无法执行。' });
    return;
  }
  broadcastSnapshot();
  emit();
}

export function onlinePlay(cardUid) {
  if (!state.battle || state.battle.phase !== 'active') return;
  if (!myTurn()) {
    emit('现在不是你的回合。');
    return;
  }
  if (state.pending) return;
  if (state.role === 'host') {
    const result = onlinePlayCard(state.battle, 'host', cardUid);
    if (!result.ok) {
      emit(result.error || '这张牌无法打出。');
      return;
    }
    broadcastSnapshot();
    emit();
    return;
  }
  state.pending = true;
  const sent = sendRelay({ kind: 'action-play', cardUid });
  if (!sent) {
    state.pending = false;
    emit('连接已经断开，无法打出这张牌。');
    return;
  }
  armActionTimer();
  emit();
}

export function onlineEndTurn() {
  if (!state.battle || state.battle.phase !== 'active') return;
  if (!myTurn()) {
    emit('现在不是你的回合。');
    return;
  }
  if (state.pending) return;
  if (state.role === 'host') {
    const result = engineEndTurn(state.battle, 'host');
    if (!result.ok) {
      emit(result.error || '无法结束回合。');
      return;
    }
    broadcastSnapshot();
    emit();
    return;
  }
  state.pending = true;
  const sent = sendRelay({ kind: 'action-end' });
  if (!sent) {
    state.pending = false;
    emit('连接已经断开，无法结束回合。');
    return;
  }
  armActionTimer();
  emit();
}

export function onlineRematch() {
  if (!state.battle || state.battle.phase === 'active') return;
  if (state.role === 'host') {
    onlineStart();
    return;
  }
  if (state.role !== 'guest' || state.rematchRequested) return;
  if (!sendRelay({ kind: 'rematch-request' })) {
    emit('连接已经断开，无法发送再来一局的请求。');
    return;
  }
  state.rematchRequested = true;
  emit('已告诉房主你想再来一局。');
}

function snapshotForGuest(battle) {
  const copy = JSON.parse(JSON.stringify(battle));
  copy.counts = {};
  for (const side of ['host', 'guest']) {
    const player = copy.players[side];
    copy.counts[side] = {
      draw: player.drawPile.length,
      discard: player.discardPile.length,
      exhaust: player.exhaustPile.length,
    };
    player.drawPile = [];
    player.discardPile = [];
    player.exhaustPile = [];
  }
  copy.players.host.hand = copy.players.host.hand.map((_, index) => ({
    uid: `hidden_${index}`,
    defId: 'hidden',
    upgraded: false,
    hidden: true,
  }));
  if (copy.enemy) {
    copy.counts.enemy = { draw: 0, discard: 0, exhaust: 0 };
  }
  return copy;
}

function broadcastSnapshot() {
  if (!state.battle) return;
  sendRelay({ kind: 'snapshot', battle: snapshotForGuest(state.battle) });
}

function handleRelay(data) {
  if (!data || typeof data !== 'object') return;
  if (state.role === 'host') {
    if (data.kind === 'action-play' || data.kind === 'action-end') {
      applyGuestAction(data);
      return;
    }
    if (data.kind === 'rematch-request') {
      if (state.battle?.phase !== 'active') {
        state.rematchRequested = true;
        emit(`${state.guest?.name || '对方'}想再来一局。`);
      }
      return;
    }
    if (data.kind === 'notice') {
      emit(String(data.message || ''));
    }
    return;
  }
  if (state.role === 'guest') {
    if (data.kind === 'start' || data.kind === 'snapshot') {
      if (!data.battle || typeof data.battle !== 'object') return;
      state.battle = data.battle;
      state.status = 'battle';
      state.pending = false;
      clearActionTimer();
      state.error = '';
      if (data.kind === 'start') {
        state.rematchRequested = false;
        emit('梦开始了。');
      } else {
        emit();
      }
      return;
    }
    if (data.kind === 'notice') {
      state.pending = false;
      clearActionTimer();
      emit(String(data.message || '房主动作未能执行。'));
    }
  }
}

function handleServerMessage(message) {
  switch (message.type) {
    case 'room-created':
      clearConnectTimer();
      state.pendingAction = '';
      state.pendingPayload = null;
      state.status = 'waiting';
      state.role = 'host';
      state.code = String(message.code || '').slice(0, 8);
      state.mode = VALID_MODES.has(message.mode) ? message.mode : state.mode;
      state.enemyId = ENEMY_MAP[message.enemyId] ? message.enemyId : state.enemyId;
      state.host = message.you || { name: onlineName(), originId: chosenOriginId() };
      state.guest = null;
      state.battle = null;
      state.error = '';
      startPing();
      emit('房间已建好。把房间码交给另一位执牌者。');
      return;
    case 'room-joined':
      clearConnectTimer();
      state.pendingAction = '';
      state.pendingPayload = null;
      state.status = 'ready';
      state.role = 'guest';
      state.code = String(message.code || '').slice(0, 8);
      state.mode = VALID_MODES.has(message.mode) ? message.mode : state.mode;
      state.enemyId = ENEMY_MAP[message.enemyId] ? message.enemyId : state.enemyId;
      state.host = message.host || null;
      state.guest = message.you || { name: onlineName(), originId: chosenOriginId() };
      state.battle = null;
      state.error = '';
      startPing();
      emit('你已进入房间。等房主翻开第一张牌。');
      return;
    case 'peer-joined':
      state.guest = message.peer || state.guest;
      if (state.role === 'host') state.status = 'ready';
      emit(`${message.peer?.name || '另一位执牌者'} 已经入梦。`);
      return;
    case 'peer-left': {
      const reason = String(message.reason || '对方离开了房间。');
      closeSocket();
      resetRoom();
      state.status = 'idle';
      state.latency = null;
      state.error = reason;
      state.pendingPayload = null;
      emit(reason);
      return;
    }
    case 'relay':
      handleRelay(message.data);
      return;
    case 'left':
      closeSocket();
      resetRoom();
      state.status = 'idle';
      state.pendingPayload = null;
      emit();
      return;
    case 'error': {
      const text = String(message.message || '联机服务拒绝了这次请求。');
      if (state.status === 'connecting') {
        closeSocket();
        resetRoom();
        state.status = 'idle';
        state.pendingPayload = null;
      }
      state.error = text;
      state.pending = false;
      clearActionTimer();
      emit(text);
      return;
    }
    case 'pong':
      if (Number(message.t)) {
        state.latency = Math.max(0, Date.now() - Number(message.t));
      }
      return;
    default:
  }
}
