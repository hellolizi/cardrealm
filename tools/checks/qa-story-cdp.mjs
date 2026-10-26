import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/86152/Desktop/card';
const OUT = path.join(ROOT, 'docs/qa');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9334;
const USER_DIR = 'C:/Users/86152/AppData/Local/Temp/cardrealm-qa-story-edge';
const BASE = 'http://127.0.0.1:4173';
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
  '--window-size=1280,900',
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
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  async function evalJs(expression) {
    const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'evaluation failed');
    return r.result?.value;
  }

  async function shot(name) {
    const r = await cmd('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
    console.log(`saved docs/qa/${name}`);
  }

  async function click(action, wait = 500) {
    const ok = await evalJs(`(() => { const el = document.querySelector('[data-action="${action}"]'); if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`missing action ${action}`);
    await sleep(wait);
  }

  async function openStory() {
    await cmd('Page.navigate', { url: `${BASE}/` });
    await sleep(2500);
    await click('open-world', 900);
    const open = await evalJs(`Boolean(document.querySelector('.modal--story .story-cinema'))`);
    if (!open) {
      const text = await evalJs(`document.body.innerText.slice(0, 500)`);
      throw new Error(`story modal did not open: ${text}`);
    }
  }

  function layout() {
    return `(() => {
      const cinema = document.querySelector('.story-cinema');
      const rect = cinema.getBoundingClientRect();
      const art = document.querySelector('.story-cinema__backdrop');
      const portrait = document.querySelector('.story-cinema__portrait');
      const prop = document.querySelector('.story-cinema__prop');
      const text = document.querySelector('.story-cinema__text');
      const body = document.querySelector('.modal__body');
      return {
        viewport: [innerWidth, innerHeight],
        cinema: { w: Math.round(rect.width), h: Math.round(rect.height), bottom: Math.round(rect.bottom) },
        hasArt: cinema.classList.contains('has-art'),
        art: art ? { src: art.getAttribute('src'), w: art.naturalWidth, h: art.naturalHeight } : null,
        portrait: portrait ? { w: Math.round(portrait.getBoundingClientRect().width), img: portrait.querySelector('img')?.getAttribute('src') } : null,
        prop: prop ? { w: Math.round(prop.getBoundingClientRect().width), img: prop.querySelector('img')?.getAttribute('src'), caption: prop.querySelector('figcaption')?.textContent.trim() } : null,
        text: text ? { w: Math.round(text.getBoundingClientRect().width), text: text.textContent.trim().slice(0, 40) } : null,
        modalBody: body ? { sh: body.scrollHeight, ch: body.clientHeight } : null,
        overflowX: document.documentElement.scrollWidth > innerWidth,
        overflowY: document.documentElement.scrollHeight > innerHeight,
      };
    })()`;
  }

  const report = {};
  await openStory();
  report.line0 = await evalJs(layout());
  await shot('v2-story-1280-line0.png');

  await click('story-advance', 500);
  report.line1Ticket = await evalJs(layout());
  await shot('v2-story-1280-ticket.png');

  await click('story-advance', 500);
  report.line2Portrait = await evalJs(layout());
  await shot('v2-story-1280-portrait.png');

  await click('story-advance', 500);
  await click('story-advance', 500);
  report.line4Shipwreck = await evalJs(layout());
  await shot('v2-story-1280-shipwreck.png');

  await evalJs(`(async () => {
    const st = await import('/js/state.js');
    const w = st.G.profile.world;
    w.flags.intro = true;
    w.flags.introDeep = false;
    w.stats.runs = Math.max(1, Number(w.stats.runs) || 0);
    w.storySeen = (w.storySeen || []).filter((id) => id !== 'intro-deep');
    st.saveProfileNow();
  })()`);
  await openStory();
  for (let i = 0; i < 9; i += 1) await click('story-advance', 400);
  report.introDeepFerry = await evalJs(layout());
  await shot('v2-story-1280-intro-deep-ferry.png');
  await click('story-advance', 400);
  report.introDeepInk = await evalJs(layout());
  await shot('v2-story-1280-intro-deep-ink.png');

  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evalJs(`(async () => {
    const st = await import('/js/state.js');
    const w = st.G.profile.world;
    w.flags.intro = false;
    w.flags.introDeep = false;
    w.flags.departure = false;
    w.storySeen = (w.storySeen || []).filter((id) => !['intro', 'intro-deep', 'departure'].includes(id));
    st.saveProfileNow();
  })()`);
  await openStory();
  report.mobileLine0 = await evalJs(layout());
  await shot('v2-story-390-line0.png');
  await click('story-advance', 500);
  report.mobileTicket = await evalJs(layout());
  await shot('v2-story-390-ticket.png');

  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: `${BASE}/` });
  await sleep(2200);
  await evalJs(`(async () => {
    const st = await import('/js/state.js');
    st.G.run = null;
    try { localStorage.removeItem('cardrealm.run.v1'); } catch {}
    st.G.profile.world.storySeen = (st.G.profile.world.storySeen || []).filter((id) => id !== 'departure');
    st.saveProfileNow();
  })()`);
  await click('open-world', 900);
  await click('region-start', 900);
  await click('start-adventure', 1200);
  report.departure = await evalJs(layout());
  await shot('v2-story-1280-departure.png');
  await click('story-advance', 500);
  report.departureIsland = await evalJs(layout());
  await shot('v2-story-1280-departure-island.png');

  report.consoleErrors = consoleErrors;
  report.failedResources = failedResources;
  console.log(JSON.stringify(report, null, 2));
  proc.kill();
}

main().catch((err) => {
  console.error(err.stack || err.message);
  proc.kill();
  process.exit(1);
});