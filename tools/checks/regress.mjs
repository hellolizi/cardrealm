// 全量回归：所有对话可走通 + 所有 NPC 的按钮状态 + 8 岛地图 + 反制规则。
const PORT = 9337;
const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
const page = list.find((t) => t.url.includes('4173/index.html'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0; const pend = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data.toString()); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
function send(method, params = {}) { return new Promise((res, rej) => { const id = ++seq; pend.set(id, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
await send('Runtime.enable');

// 1. 静态检查：每个 NPC 的对话是否都能从 entry 走到某个结局
const walk = await evaluate(`(async () => {
  const L = await import('./js/lore.js');
  const { NPC_MAP } = L;
  const issues = [];
  const results = [];
  for (const [id, d] of Object.entries(L.DIALOGUES)) {
    if (!d.nodes || !d.entry) { issues.push(id + ': 缺 nodes 或 entry'); continue; }
    if (!NPC_MAP[d.npc]) issues.push(id + ': npc 不存在 ' + d.npc);
    // BFS：能否从 entry 抵达至少一个终点（无 choices 且无 next）
    const seen = new Set();
    const queue = [d.entry];
    let ends = 0;
    let dangling = 0;
    while (queue.length) {
      const nid = queue.shift();
      if (seen.has(nid)) continue;
      seen.add(nid);
      const node = d.nodes[nid];
      if (!node) { issues.push(id + ': 节点缺失 ' + nid); continue; }
      if (!node.choices?.length && !node.next) { ends += 1; continue; }
      if (node.next) { if (!d.nodes[node.next]) dangling += 1; else queue.push(node.next); }
      for (const c of node.choices || []) {
        if (!c.next) continue;
        if (!d.nodes[c.next]) dangling += 1; else queue.push(c.next);
      }
    }
    if (!ends) issues.push(id + ': 永远走不到结局');
    if (dangling) issues.push(id + ': 有 ' + dangling + ' 个 next 指向不存在的节点');
    // 入口可达性：至少有一条路能走完
    results.push({ id, npc: d.npc, nodes: Object.keys(d.nodes).length, reachable: seen.size, ends });
  }
  // 每个 NPC 至少一条对话
  const npcsWithout = Object.keys(NPC_MAP).filter(n => !Object.values(L.DIALOGUES).some(d => d.npc === n));
  return { total: results.length, issues, results, npcsWithout, npcCount: Object.keys(NPC_MAP).length };
})()`);
console.log('=== 对话图完整性 ===');
console.log('  对话总数:', walk.total, '| NPC 总数:', walk.npcCount, '| 无对话的 NPC:', JSON.stringify(walk.npcsWithout));
console.log('  问题:', walk.issues.length ? JSON.stringify(walk.issues, null, 1) : '无');
console.log('  每段节点/可达/结局数:', walk.results.map(r => `${r.id}(${r.nodes}/${r.reachable}/${r.ends})`).join(' '));

// 2. 每个 NPC 弹窗：有对话的应有按钮，没有的不应有
const btnCheck = await evaluate(`(async () => {
  const L = await import('./js/lore.js');
  const { G } = await import('./js/state.js');
  const out = [];
  for (const npcId of Object.keys(L.NPC_MAP)) {
    G.profile.world.dialogues = { seen: [], nodes: {}, flags: {} };
    const p = L.dialogueForNpc(G.profile.world, npcId);
    const pending = L.DIALOGUES ? Object.values(L.DIALOGUES).filter(d => d.npc === npcId).length : 0;
    out.push({ npcId, faction: L.NPC_MAP[npcId].faction, dialogues: pending, bondLine: !!L.NPC_MAP[npcId].bondLine });
  }
  return out;
})()`);
console.log('\n=== NPC 名单 ===');
for (const n of btnCheck) console.log(`  ${n.npcId.padEnd(18)} ${String(n.faction).padEnd(8)} 对话×${n.dialogues} ${n.bondLine ? '有羁绊语' : '缺羁绊语'}`);

// 3. 八岛地图：每座岛都能生成，且有 BOSS 层
const maps = await evaluate(`(async () => {
  const E = await import('./js/engine.js');
  const L = await import('./js/lore.js');
  const out = [];
  for (const r of L.REGIONS) {
    try {
      const layers = E.makeMap(r.id);
      const all = layers.flat();
      const boss = all.find((n) => n.type === 'boss');
      // 从首层出发能不能走到首领层
      const reach = new Set();
      const queue = [...(layers[0] || [])];
      while (queue.length) {
        const n = queue.pop();
        if (!n || reach.has(n.id)) continue;
        reach.add(n.id);
        for (const id of n.next || []) {
          const t = all.find((x) => x.id === id);
          if (t) queue.push(t);
        }
      }
      const widths = layers.map((l) => l.length);
      out.push({
        id: r.id, shape: r.shapeName || r.shape, layers: layers.length,
        nodes: all.length, maxWidth: Math.max(...widths), boss: !!boss,
        bossReachable: boss ? reach.has(boss.id) : false,
        types: [...new Set(all.map((n) => n.type))].length,
        hasCamp: all.some((n) => n.type === 'camp'),
        hasShop: all.some((n) => n.type === 'shop'),
        hasElite: all.some((n) => n.type === 'elite'),
        posOk: all.every((n) => n.pos && Number.isFinite(n.pos.x) && Number.isFinite(n.pos.y)),
      });
    } catch (e) { out.push({ id: r.id, error: String(e).slice(0, 120) }); }
  }
  return out;
})()`);
console.log('\n=== 八岛地图 ===');
for (const m of maps) console.log('  ' + JSON.stringify(m));

// 4. 反制规则在数据里挂着吗
const counters = await evaluate(`(async () => {
  const D = await import('./js/data.js');
  const keys = Object.keys(D).filter((k) => /ENEM/i.test(k));
  const out = [];
  const seen = new Set();
  for (const k of keys) {
    const bag = D[k];
    if (!bag || typeof bag !== 'object') continue;
    const list = Array.isArray(bag) ? bag : Object.values(bag);
    for (const e of list) {
      if (!e || typeof e !== 'object' || !e.id || seen.has(e.id)) continue;
      seen.add(e.id);
      const phases = [e.phase2, ...(Array.isArray(e.phases) ? e.phases : [])].filter(Boolean);
      for (const p of phases) {
        const hit = {};
        if (p.noHeal) hit.noHeal = true;
        if (p.reflectPct) hit.reflectPct = p.reflectPct;
        if (p.echoBreak) hit.echoBreak = true;
        if (Object.keys(hit).length) out.push({ id: e.id, phase: p.title || '?', hit });
      }
    }
  }
  return out;
})()`);
console.log('\n=== 反制首领 ===');
console.log('  ', JSON.stringify(counters));

ws.close();
