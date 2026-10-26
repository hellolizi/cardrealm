// 「学会了」和「没学会」到底差多少？——同一副牌，两种打法。
//
// 这是「这个游戏值不值得一直玩」的核心指标：
//   如果两者胜率差不多，说明规则没有可学的东西，玩家没必要变强；
//   如果混搭的「学会了」明显高于纯流派的「学会了」，
//   而混搭的「没学会」低于纯流派，那条学习曲线就成立了：
//   先学会站稳，再学会取舍，最后靠混搭拿到纯流派够不到的上限。
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
const { naiveTurn, skilledTurn } = await import('./bots.mjs');

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
  const pool = data.CARDS
    .filter((c) => c.school === school && !c.originOnly && c.rarity !== 'basic')
    .sort((a, b) => cardScore(b) - cardScore(a));
  const out = [];
  for (let i = 0; i < n; i += 1) {
    if (!pool.length) break;
    out.push(pool[i % pool.length].id);
  }
  return out;
}

function rate(deckIds, originId, enemyId, brain, runs) {
  G.profile.originId = originId;
  let w = 0;
  let tsum = 0;
  for (let i = 0; i < runs; i += 1) {
    G.profile.sandboxDeck = deckIds.map((id) => ({ defId: id, upgraded: false }));
    const b = eng.startSandboxBattle(enemyId);
    if (b?.error) return { pct: -1, turns: 0 };
    let t = 0;
    while (b.phase === 'player' && t++ < 50) brain(b);
    if (b.enemy.hp <= 0) { w += 1; tsum += t; }
  }
  return { pct: Math.round((w / runs) * 100), turns: w ? Math.round((tsum / w) * 10) / 10 : 0 };
}

const ENEMY = process.argv[2] || 'paper-queen';
const RUNS = Number(process.argv[3]) || 200;

console.log(`=== 学习曲线 · 同一副牌的两种打法 · 对手 ${ENEMY} · ${RUNS} 局 ===\n`);
console.log('  ' + '角色'.padEnd(8) + '路线'.padEnd(6) + '没学会'.padEnd(12) + '学会了'.padEnd(12) + '学习回报');
for (const o of ORIGINS) {
  const school = R.preferredSchoolForOrigin(o.id);
  const others = R.SCHOOL_ORDER.filter((s) => s !== school);
  const pure = [...o.starter, ...pickSchool(school, 6)];
  const dual = [...o.starter, ...pickSchool(school, 2), ...pickSchool(others[0], 4)];

  for (const [label, deck] of [['纯流派', pure], ['双派', dual]]) {
    const a = rate(deck, o.id, ENEMY, naiveTurn, RUNS);
    const b = rate(deck, o.id, ENEMY, skilledTurn, RUNS);
    const gain = b.pct - a.pct;
    console.log(
      '  ' + o.name.padEnd(6) + label.padEnd(6)
      + `${a.pct}%`.padEnd(14) + `${b.pct}%`.padEnd(14)
      + (gain > 0 ? `+${gain}pp` : gain < 0 ? `${gain}pp` : '0'),
    );
  }
}
