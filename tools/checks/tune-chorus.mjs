// 扫描混响数值：找到「双派略强于纯派」的那一档。
//
// 目标不是让混搭碾压，而是让「学会了混搭」比「只走纯派」明显更强：
// 差距太小，玩家没有理由学；差距太大，纯派变成没人碰的陷阱。
process.env.NODE_ENV = 'test';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.document = { addEventListener() {}, querySelector: () => null, body: { appendChild() {} } };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

const data = await import('../../js/data.js');
const eng = await import('../../js/engine.js');
const R = await import('../../js/resonance.js');
const { ORIGINS } = data;
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
  for (let i = 0; i < runs; i += 1) {
    G.profile.sandboxDeck = deckIds.map((id) => ({ defId: id, upgraded: false }));
    const b = eng.startSandboxBattle(enemyId);
    if (b?.error) return -1;
    let t = 0;
    while (b.phase === 'player' && t++ < 50) skilledTurn(b);
    if (b.enemy.hp <= 0) w += 1;
  }
  return Math.round((w / runs) * 100);
}

const ENEMY = process.argv[2] || 'paper-queen';
const RUNS = Number(process.argv[3]) || 60;
const GRID = [
  [2, 3, 4],
  [3, 4, 6],
  [4, 5, 7],
  [4, 6, 8],
  [5, 7, 9],
  [6, 8, 11],
];

console.log(`=== 混响数值扫描 · ${ENEMY} · 每组 ${RUNS} 局 · 熟练打法 ===\n`);
const decks = [];
for (const o of ORIGINS) {
  const school = R.preferredSchoolForOrigin(o.id);
  const others = R.SCHOOL_ORDER.filter((s) => s !== school);
  decks.push({ o, school, pure: [...o.starter, ...pickSchool(school, 6)], others });
}

for (const vals of GRID) {
  R.CHORUS_INFO.values = vals;
  const rows = [];
  for (const { o, school, pure, others } of decks) {
    const p = rate(pure, o.id, ENEMY, RUNS);
    let best = { pct: -1, partner: null };
    for (const partner of others) {
      const deck = [...o.starter, ...pickSchool(school, 2), ...pickSchool(partner, 4)];
      const r = rate(deck, o.id, ENEMY, RUNS);
      if (r > best.pct) best = { pct: r, partner };
    }
    rows.push({ name: o.name, p, d: best.pct, partner: best.partner });
  }
  const avgP = Math.round(rows.reduce((s, r) => s + r.p, 0) / rows.length);
  const avgD = Math.round(rows.reduce((s, r) => s + r.d, 0) / rows.length);
  console.log(`  混响 ${JSON.stringify(vals)}   纯派均值 ${avgP}%   双派均值 ${avgD}%   差 ${avgD - avgP > 0 ? '+' : ''}${avgD - avgP}pp`);
  console.log('    ' + rows.map((r) => `${r.name.slice(0, 2)} ${r.p}/${r.d}${r.d > r.p ? '*' : ''}`).join('  '));
  console.log('');
}
