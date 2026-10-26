// 首战首领该有多厚？——扫描血量，找「五角色均值 85% 左右」的那一档。
// 玩家到古龙时大约有「起手 10 张 + 路上 3~5 张」，所以这里按 +3 与 +5 两种牌组规模各测一次。
process.env.NODE_ENV = 'test';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.document = { addEventListener() {}, querySelector: () => null, body: { appendChild() {} } };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

const data = await import('../../js/data.js');
const eng = await import('../../js/engine.js');
const R = await import('../../js/resonance.js');
const { ORIGINS, ENEMY_MAP } = data;
const { G } = await import('../../js/state.js');
const { skilledTurn } = await import('./bots.mjs');

function cardScore(c) {
  let s = 0;
  for (const e of c.effects || []) {
    const a = e.amount || 0;
    const h = e.hits || 1;
    if (e.type === 'damage') s += a * h;
    else if (e.type === 'block') s += a * 1.3;
    else if (e.type === 'draw') s += a * 4;
    else if (e.type === 'energy') s += a * 5;
    else if (e.type === 'heal') s += a * 1.1;
    else if (e.type === 'status') s += a * 2;
    else if (e.type === 'loseHp') s -= a * 0.7;
  }
  return s / Math.max(1, c.cost);
}

function pickSchool(school, n) {
  const pool = data.CARDS.filter((c) => c.school === school && !c.originOnly && c.rarity !== 'basic').sort((a, b) => cardScore(b) - cardScore(a));
  const out = [];
  for (let i = 0; i < n; i += 1) { if (!pool.length) break; out.push(pool[i % pool.length].id); }
  return out;
}

function rate(deckIds, originId, enemyId, runs) {
  G.profile.originId = originId;
  let w = 0;
  let tsum = 0;
  for (let i = 0; i < runs; i += 1) {
    G.profile.sandboxDeck = deckIds.map((id) => ({ defId: id, upgraded: false }));
    const b = eng.startSandboxBattle(enemyId);
    if (b?.error) return { pct: -1, turns: 0 };
    let t = 0;
    while (b.phase === 'player' && t++ < 50) skilledTurn(b);
    if (b.enemy.hp <= 0) { w += 1; tsum += t; }
  }
  return { pct: Math.round((w / runs) * 100), turns: w ? Math.round((tsum / w) * 10) / 10 : 0 };
}

const ENEMY_ID = process.argv[2] || 'nightmare-dragon';
const RUNS = Number(process.argv[3]) || 80;
const enemy = ENEMY_MAP[ENEMY_ID];
const baseHp = enemy.hp;
const HPS = [96, 104, 112, 120, 128, 136, 144];

console.log(`=== 首战血量扫描 · ${enemy.name} · 熟练打法 · ${RUNS} 局 ===\n`);
for (const extra of [3, 5]) {
  console.log(`  牌组 = 起手 + ${extra} 张本派牌`);
  for (const hp of HPS) {
    enemy.hp = hp;
    const rows = ORIGINS.map((o) => {
      const deck = [...o.starter, ...pickSchool(R.preferredSchoolForOrigin(o.id), extra)];
      const r = rate(deck, o.id, ENEMY_ID, RUNS);
      return { name: o.name.slice(0, 2), ...r };
    });
    const avg = Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length);
    const turns = (rows.reduce((s, r) => s + r.turns, 0) / rows.length).toFixed(1);
    console.log(`    ${String(hp).padStart(3)} 血  均值 ${String(avg).padStart(3)}%  ${turns} 回合  ` + rows.map((r) => `${r.name} ${r.pct}`).join('  '));
  }
  console.log('');
}
enemy.hp = baseHp;
