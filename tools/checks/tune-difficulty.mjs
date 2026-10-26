// 扫描敌人强度：把首领伤害乘一个系数，看纯派胜率落到哪。
// 目标不是「很难」，是「有压力但不劝退」：
//   第一场首领 ≥85%（Steam 两小时退款窗口，必须能过）
//   中期首领 60~75%
//   终章 45~55%
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

const ENEMY_ID = process.argv[2] || 'paper-queen';
const RUNS = Number(process.argv[3]) || 50;
const SCALES = [1.0, 1.15, 1.3, 1.45, 1.6, 1.8];

const enemy = ENEMY_MAP[ENEMY_ID];
if (!enemy) throw new Error('没有这个敌人：' + ENEMY_ID);
const original = JSON.parse(JSON.stringify({
  moves: enemy.moves.map((m) => m.damage || 0),
  phase2: enemy.phase2 ? enemy.phase2.moves.map((m) => m.damage || 0) : null,
}));

const decks = [];
for (const o of ORIGINS) {
  const school = R.preferredSchoolForOrigin(o.id);
  decks.push({ o, pure: [...o.starter, ...pickSchool(school, 6)] });
}

console.log(`=== 强度扫描 · ${enemy.name}（${enemy.hp} 血）· 纯流派 · 熟练打法 · ${RUNS} 局 ===\n`);
for (const scale of SCALES) {
  enemy.moves.forEach((m, i) => { if (original.moves[i]) m.damage = Math.round(original.moves[i] * scale); });
  if (enemy.phase2) enemy.phase2.moves.forEach((m, i) => { if (original.phase2[i]) m.damage = Math.round(original.phase2[i] * scale); });
  const rows = decks.map(({ o, pure }) => ({ name: o.name.slice(0, 2), ...rate(pure, o.id, ENEMY_ID, RUNS) }));
  const avg = Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length);
  const turns = (rows.reduce((s, r) => s + r.turns, 0) / rows.length).toFixed(1);
  console.log(`  ×${scale.toFixed(2)}  均值 ${String(avg).padStart(3)}%  ${turns} 回合  ` + rows.map((r) => `${r.name} ${r.pct}`).join('  '));
}
