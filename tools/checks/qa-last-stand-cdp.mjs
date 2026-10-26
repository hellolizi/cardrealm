import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/86152/Desktop/card';
const OUT = path.join(ROOT, 'docs/qa');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const USER_DIR = 'C:/Users/86152/AppData/Local/Temp/cardrealm-qa-edge';
const BASE = `http://127.0.0.1:4173`;
mkdirSync(OUT, { recursive: true });
rmSync(USER_DIR, { recursive: true, force: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const consoleErrors = [];
const failedResources = [];
const proc = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--mute-audio',
  '--window-size=1280,720',
  `--user-data-dir=${USER_DIR}`,
  'about:blank',
], { stdio: 'ignore' });

let ws;
let nextId = 1;
const pending = new Map();

async function waitJson(url, tries = 100) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`CDP not ready: ${url}`);
}

function send(method, params = {}, sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function failText(r) {
  const detail = r?.exceptionDetails;
  if (!detail) return `CDP error ${r?.error?.code || ''}: ${r?.error?.message || ''}`;
  return detail.exception?.description || detail.text || 'evaluation failed';
}

async function main() {
  const info = await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || 'exception');
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      consoleErrors.push((msg.params.args || []).map((arg) => arg.value ?? arg.description ?? '').join(' '));
      return;
    }
    if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
      const text = msg.params.entry.text || 'log error';
      if (!text.includes('Failed to load resource')) consoleErrors.push(text);
      return;
    }
    if (msg.method === 'Network.responseReceived' && msg.params?.response?.status >= 400) {
      if (!msg.params.response.url.endsWith('/favicon.ico')) {
        failedResources.push({ status: msg.params.response.status, url: msg.params.response.url });
      }
      return;
    }
    if (!msg.id || !pending.has(msg.id)) return;
    const entry = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(`${msg.error.message} (${msg.error.code})`));
    else entry.resolve(msg.result);
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const cmd = (method, params) => send(method, params, sessionId);

  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Log.enable');
  await cmd('Network.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  async function evalJs(expression) {
    const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(failText(r));
    return r.result?.value;
  }

  async function shot(name) {
    const r = await cmd('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
    console.log(`saved docs/qa/${name}`);
  }

  async function click(action, wait = 600) {
    const ok = await evalJs(`(() => { const el = document.querySelector('[data-action="${action}"]'); if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`missing action ${action}`);
    await sleep(wait);
  }

  async function gotoQa() {
    await cmd('Page.navigate', { url: `${BASE}/tools/checks/qa-last-stand.html` });
    await sleep(3200);
    await click('continue-run', 900);
    const ready = await evalJs(`Boolean(document.querySelector('.last-stand-panel'))`);
    if (!ready) throw new Error('last stand overlay did not render');
  }

  const report = {};

  // 1) 1280×720 绝境弹窗
  await gotoQa();
  report.blockedInput = await evalJs(`(async () => {
    const { G } = await import('/js/state.js');
    const battle = G.run.battle;
    const before = battle.stats.cardsPlayed;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    return { before, after: battle.stats.cardsPlayed, overlay: Boolean(document.querySelector('.last-stand-panel')) };
  })()`);
  report.desktop = await evalJs(`(() => {
    const panel = document.querySelector('.last-stand-panel');
    const rect = panel.getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      panel: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), bottom: Math.round(rect.bottom) },
      panelScroll: [panel.scrollHeight, panel.clientHeight],
      overflowX: document.documentElement.scrollWidth > innerWidth,
      overflowY: document.documentElement.scrollHeight > innerHeight,
      font: getComputedStyle(document.documentElement).fontSize,
    };
  })()`);
  await shot('v2-last-stand-1280.png');

  // 2) 接受后的欠债提示
  await click('last-stand-accept', 900);
  report.debtChip = await evalJs(`document.querySelector('.actor-scar--debt')?.textContent.trim() || null`);
  await shot('v2-last-stand-debt-1280.png');

  // 3) 胜利奖励里的梦痕
  const played = await evalJs(`(async () => {
    const E = await import('/js/engine.js');
    const { G } = await import('/js/state.js');
    const battle = G.run.battle;
    battle.player.energy = 10;
    battle.enemy.hp = 1;
    battle.enemy.block = 0;
    battle.enemy.statuses.thorns = 0;
    const card = battle.hand.find((entry) => E.getBattleCard(entry, battle)?.type === 'attack' && !E.isCardSealed(battle, entry.uid));
    if (!card) return 'no attack in hand';
    document.querySelector('[data-action="play-card"][data-uid="' + card.uid + '"]')?.click();
    return card.defId;
  })()`);
  await sleep(1200);
  report.victory = await evalJs(`(() => ({
    phase: (window.__qaBattle = null, document.querySelector('.battle-overlay--victory') ? 'victory' : 'other'),
    rewardScar: document.querySelector('.reward-scar')?.textContent.trim() || null,
    hpLine: [...document.querySelectorAll('.result-stats span')].map((el) => el.textContent.trim()).find((text) => text.includes('生命')) || null,
  }))()`);
  report.playedCard = played;
  await shot('v2-last-stand-victory-1280.png');

  // 4) 地图上的梦痕
  await click('skip-reward', 900);
  report.mapScar = await evalJs(`(() => ({
    chip: document.querySelector('.run-rail__scars .scar-chip')?.textContent.trim() || null,
    label: document.querySelector('.run-rail__scars .run-rail__section-label')?.textContent.trim() || null,
    screen: Boolean(document.querySelector('.map-screen')),
  }))()`);
  await shot('v2-last-stand-map-1280.png');

  // 5) 拒绝后失败：梦醒结算（先重新种一局）
  await gotoQa();
  await click('last-stand-decline', 800);
  await evalJs(`(async () => {
    const E = await import('/js/engine.js');
    const { G } = await import('/js/state.js');
    const battle = G.run.battle;
    const card = battle.hand.find((entry) => E.getBattleCard(entry, battle)?.type === 'attack' && !E.isCardSealed(battle, entry.uid));
    if (!card) throw new Error('no attack');
    battle.player.hp = 1;
    battle.player.block = 0;
    battle.enemy.hp = 999;
    battle.enemy.statuses.thorns = 99;
    document.querySelector('[data-action="play-card"][data-uid="' + card.uid + '"]')?.click();
    await new Promise((r) => setTimeout(r, 100));
  })()`);
  await sleep(1200);
  report.declineDefeat = await evalJs(`(() => ({
    recap: document.querySelector('.defeat-recap__facts')?.textContent.replace(/\\s+/g, ' ').trim() || null,
    companion: document.querySelector('.defeat-recap__companion p')?.textContent.trim() || null,
    elegyButton: document.querySelector('[data-action="defeat-elegy"]')?.textContent.replace(/\\s+/g, ' ').trim() || null,
    phase: document.querySelector('.battle-overlay--defeat') ? 'defeat' : 'other',
    covered: Boolean(document.querySelector('.modal--story')),
  }))()`);
  await shot('v2-defeat-declined-1280.png');
  await click('defeat-elegy', 900);
  report.elegy = await evalJs(`(() => ({
    story: document.querySelector('.modal--story h2')?.textContent.trim() || document.body.innerText.slice(0, 120),
    recapBehind: Boolean(document.querySelector('.battle-overlay--defeat')),
  }))()`);
  await shot('v2-defeat-elegy-1280.png');

  // 6) 借气后战败：代价豁免的梦醒结算
  await gotoQa();
  await click('last-stand-accept', 800);
  await evalJs(`(async () => {
    const E = await import('/js/engine.js');
    const { G } = await import('/js/state.js');
    const battle = G.run.battle;
    const card = battle.hand.find((entry) => E.getBattleCard(entry, battle)?.type === 'attack' && !E.isCardSealed(battle, entry.uid));
    if (!card) throw new Error('no attack');
    battle.player.hp = 1;
    battle.player.block = 0;
    battle.enemy.hp = 999;
    battle.enemy.statuses.thorns = 99;
    document.querySelector('[data-action="play-card"][data-uid="' + card.uid + '"]')?.click();
    await new Promise((r) => setTimeout(r, 100));
  })()`);
  await sleep(1200);
  report.borrowedDefeat = await evalJs(`(() => ({
    recap: document.querySelector('.defeat-recap__facts')?.textContent.replace(/\\s+/g, ' ').trim() || null,
    companion: document.querySelector('.defeat-recap__companion p')?.textContent.trim() || null,
  }))()`);
  await shot('v2-defeat-borrowed-1280.png');

  // 7) 最大字号：弹窗必须能完整滚动，不出现横向溢出
  await evalJs(`(() => {
    const key = 'cardrealm.profile.v1';
    const profile = JSON.parse(localStorage.getItem(key) || '{}');
    profile.settings = profile.settings || {};
    profile.settings.fontSize = 'large';
    localStorage.setItem(key, JSON.stringify(profile));
    return profile.settings.fontSize;
  })()`);
  await gotoQa();
  report.large = await evalJs(`(() => {
    const panel = document.querySelector('.last-stand-panel');
    const rect = panel.getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      panel: { y: Math.round(rect.y), bottom: Math.round(rect.bottom), w: Math.round(rect.width), h: Math.round(rect.height) },
      panelScroll: [panel.scrollHeight, panel.clientHeight],
      overflowX: document.documentElement.scrollWidth > innerWidth,
      overflowY: document.documentElement.scrollHeight > innerHeight,
      font: getComputedStyle(document.documentElement).fontSize,
    };
  })()`);
  await shot('v2-last-stand-large-font-1280.png');

  // 8) 接受后刷新：债务与生命上限状态必须恢复
  await click('last-stand-accept', 900);
  await cmd('Page.reload', { ignoreCache: false });
  await sleep(3000);
  await click('continue-run', 900);
  report.reloaded = await evalJs(`(() => ({
    overlay: Boolean(document.querySelector('.last-stand-panel')),
    debt: document.querySelector('.actor-scar--debt')?.textContent.trim() || null,
    hp: document.querySelector('.actor-hp-label')?.textContent.replace(/\\s+/g, ' ').trim() || null,
  }))()`);
  await shot('v2-last-stand-reloaded-1280.png');

  // restore font size for any later manual run
  await evalJs(`(() => {
    const key = 'cardrealm.profile.v1';
    const profile = JSON.parse(localStorage.getItem(key) || '{}');
    profile.settings = profile.settings || {};
    profile.settings.fontSize = 'normal';
    localStorage.setItem(key, JSON.stringify(profile));
  })()`);

  report.consoleErrors = consoleErrors;
  report.failedResources = failedResources;
  console.log(JSON.stringify(report, null, 2));
}

try {
  await main();
} finally {
  try { ws?.close(); } catch {}
  proc.kill('SIGKILL');
}