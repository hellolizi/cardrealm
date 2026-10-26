/* 逐句渲染全部剧情（含奶蛙蛙追加段），校验场景 / 道具 / 立绘的解析与加载。 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9337;
const USER_DIR = 'C:/Users/86152/AppData/Local/Temp/cardrealm-qa-story-art-edge';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8765';
rmSync(USER_DIR, { recursive: true, force: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const res = await fetch(BASE, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(String(res.status));
} catch (err) {
  console.error(`本地服务不可用：${BASE}（${err.message}）`);
  process.exit(2);
}

const consoleErrors = [];
const failedResources = [];
const proc = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
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
      const r = await fetch(url);
      if (r.ok) return r.json();
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
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || 'exception');
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      consoleErrors.push((msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
      return;
    }
    if (msg.method === 'Network.responseReceived' && msg.params?.response?.status >= 400) {
      if (!msg.params.response.url.endsWith('/favicon.ico')) failedResources.push({ status: msg.params.response.status, url: msg.params.response.url });
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
  await cmd('Page.navigate', { url: `${BASE}/` });
  await sleep(2500);

  const expression = `(async () => {
    const state = await import('/js/state.js');
    const modals = await import('/js/modals.js');
    const lore = await import('/js/lore.js');
    const art = await import('/js/story-art.js');
    const G = state.G;
    G.run = null;
    G.profile.originId = 'milkfrog';
    const root = document.getElementById('modal-root');
    const calm = document.createElement('style');
    calm.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    document.head.appendChild(calm);
    document.body.classList.add('has-modal');
    const waitImg = (img) => new Promise((resolve) => {
      const done = () => { (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(resolve); };
      if (img.complete) done();
      else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
    });
    const report = { stories: 0, lines: 0, props: 0, portraits: 0, scenes: 0, sources: new Set(), broken: [], mismatch: [] };
    for (const [id, story] of Object.entries(lore.STORIES)) {
      const a = art.storyArtFor(id);
      const lines = lore.storyLines(id, 'milkfrog');
      report.stories += 1;
      for (let i = 0; i < lines.length; i += 1) {
        G.ui.modal = { type: 'story', data: { storyId: id, index: i } };
        root.innerHTML = modals.renderModal();
        const cinema = root.querySelector('.story-cinema');
        const bd = cinema?.querySelector('.story-cinema__backdrop');
        const propEl = cinema?.querySelector('.story-cinema__prop img');
        const capEl = cinema?.querySelector('.story-cinema__prop figcaption');
        const portraitEl = cinema?.querySelector('.story-cinema__portrait img');
        await Promise.all([...cinema.querySelectorAll('img')].map(waitImg));
        report.lines += 1;
        const scene = art.storySceneAt(a, lines, i);
        if (!bd) report.mismatch.push([id, i, 'no backdrop', scene?.src]);
        else {
          const src = bd.getAttribute('src');
          report.scenes += 1;
          if (!scene || !src.endsWith(scene.src)) report.mismatch.push([id, i, 'scene', src, scene?.src]);
          if (bd.naturalWidth === 0) report.broken.push([id, i, src]);
          report.sources.add(src);
        }
        const prop = art.storyPropAt(a, lines, i);
        if (prop) {
          report.props += 1;
          if (!propEl) report.mismatch.push([id, i, 'prop missing', prop.src]);
          else {
            const src = propEl.getAttribute('src');
            if (!src.endsWith(prop.src)) report.mismatch.push([id, i, 'prop', src, prop.src]);
            if ((capEl?.textContent || '').trim() !== prop.label) report.mismatch.push([id, i, 'caption', (capEl?.textContent || '').trim(), prop.label]);
            if (propEl.naturalWidth === 0) report.broken.push([id, i, src]);
            report.sources.add(src);
          }
        } else if (propEl) {
          report.mismatch.push([id, i, 'unexpected prop', propEl.getAttribute('src')]);
        }
        const cast = art.storyPortraitAt(a, lines, i, { heroSrc: '/__hero__.webp', heroName: '你' });
        if (cast) {
          report.portraits += 1;
          if (!portraitEl) report.mismatch.push([id, i, 'portrait missing', cast.who, cast.src]);
          else {
            const src = portraitEl.getAttribute('src');
            if (portraitEl.naturalWidth === 0) report.broken.push([id, i, src]);
            if (cast.who !== '你' && !src.endsWith(cast.src)) report.mismatch.push([id, i, 'portrait', src, cast.src]);
            if (cast.who !== '你') report.sources.add(src);
          }
        }
      }
    }
    return { ...report, sources: [...report.sources].sort() };
  })()`;
  const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'evaluation failed');
  const report = r.result.value;
  await sleep(600);

  console.log(`故事 ${report.stories} 段 · 逐句检查 ${report.lines} 句 · 场景 ${report.scenes} · 道具 ${report.props} · 立绘 ${report.portraits}`);
  console.log(`唯一图片 ${report.sources.length} 张`);
  console.log(`破图 ${report.broken.length} · 映射不符 ${report.mismatch.length} · 资源错误 ${failedResources.length} · 控制台错误 ${consoleErrors.length}`);
  for (const item of report.broken.slice(0, 20)) console.log('BROKEN', item.join(' | '));
  for (const item of report.mismatch.slice(0, 20)) console.log('MISMATCH', item.join(' | '));
  for (const item of failedResources.slice(0, 20)) console.log('HTTP', item.status, item.url);
  for (const item of consoleErrors.slice(0, 20)) console.log('CONSOLE', item);
  const ok = !report.broken.length && !report.mismatch.length && !failedResources.length && !consoleErrors.length;
  console.log(ok ? '✅ 剧情美术逐句校验通过' : '❌ 剧情美术逐句校验失败');
  process.exitCode = ok ? 0 : 1;
}

try {
  await main();
} finally {
  try { ws?.close(); } catch {}
  proc.kill();
  await sleep(300);
  try { rmSync(USER_DIR, { recursive: true, force: true }); } catch {}
}
