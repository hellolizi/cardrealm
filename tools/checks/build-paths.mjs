// 用五个角色的真实起始牌组，对比「只拿本流派的牌」与「混搭着拿」两条构筑路线。
// 这比人造牌组更贴近玩家实际会遇到的决策。
process.env.NODE_ENV = 'test';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.document = { addEventListener() {}, querySelector: () => null, body: { appendChild() {} } };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

const data = await import('../../js/data.js');
const eng = await import('../../js/engine.js');
const R = await import('../../js/resonance.js');
const { CARD_MAP, ORIGINS, ORIGIN_MAP } = data;
const { G } = await import('../../js/state.js');
const { skilledTurn } = await import('./bots.mjs');

function rate(deckIds, originId, enemyId, runs = 300) {
  G.profile.originId = originId;
  let w = 0;
  let tsum = 0;
  let kind = '';
  for (let i = 0; i < runs; i += 1) {
    G.profile.sandboxDeck = deckIds.map((id) => ({ defId: id, upgraded: false }));
    const b = eng.startSandboxBattle(enemyId);
    if (b?.error) return { pct: -1, turns: 0, kind: 'ERR' };
    if (b.resonance?.chorus?.active) kind = `chorus ${b.resonance.chorus.tier}`;
    else if (b.resonance?.primary) kind = `${b.resonance.primary} ${b.resonance.tier}`;
    else kind = 'none';
    let t = 0;
    while (b.phase === 'player' && t++ < 50) skilledTurn(b);
    if (b.enemy.hp <= 0) { w += 1; tsum += t; }
  }
  return { pct: Math.round((w / runs) * 100), turns: w ? Math.round((tsum / w) * 10) / 10 : 0, kind };
}

/** 按「效果效率」给牌打分，用来模拟玩家会挑哪些牌。 */
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

/** 从卡池里挑 n 张某流派的「最好的」牌（非专属、非基础）。 */
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

const ENEMY = process.argv[2] || 'paper-queen';
const RUNS = Number(process.argv[3]) || 250;
// 环境变量 DAMAGE_SCALE：把首领伤害整体乘一个系数，用来验证
// 「难度提上去以后，混搭是不是真的能救回弱势角色」。
const SCALE = Number(process.env.DAMAGE_SCALE) || 1;
if (SCALE !== 1) {
  const enemy = data.ENEMY_MAP[ENEMY];
  if (enemy) {
    for (const move of enemy.moves) if (move.damage) move.damage = Math.round(move.damage * SCALE);
    for (const move of enemy.phase2?.moves || []) if (move.damage) move.damage = Math.round(move.damage * SCALE);
  }
}

console.log(`=== 三条构筑路线 · 五角色起始牌组 · 对手 ${ENEMY} · ${RUNS} 局 ===\n`);
console.log('  ' + '角色'.padEnd(8) + '派'.padEnd(7) + '纯流派'.padEnd(18) + '双派'.padEnd(18) + '混响'.padEnd(18) + '最强');
for (const o of ORIGINS) {
  const school = R.preferredSchoolForOrigin(o.id);
  // 三条路线都用「起始 10 张 + 6 张」的同等卡数，只比较构筑方向。
  // 起始牌组本身已经有 4~5 张本派牌，所以下面补的 6 张要按「补完后的占比」来配，
  // 否则测出来的不是玩家的构筑，是「本派被稀释」的残废牌组。
  const pure = [...o.starter, ...pickSchool(school, 6)];
  const others = R.SCHOOL_ORDER.filter((s) => s !== school);
  // 双派：第二派不能按顺序硬配——剑客配星幕（防御派）当然打不动。
  // 玩家会试几种搭配，留下最合手的那个。这里遍历所有第二派，取胜率最高的。
  let b = { pct: -1, turns: 0, kind: 'none', partner: null };
  for (const partner of others) {
    const deck = [...o.starter, ...pickSchool(school, 2), ...pickSchool(partner, 4)];
    const r = rate(deck, o.id, ENEMY, RUNS);
    if (r.pct > b.pct) b = { ...r, partner };
  }
  // 三派：同样取最好的两条支线组合。
  let c = { pct: -1, turns: 0, kind: 'none', partners: null };
  for (let i = 0; i < others.length; i += 1) {
    for (let j = i + 1; j < others.length; j += 1) {
      const deck = [...o.starter, ...pickSchool(others[i], 2), ...pickSchool(others[j], 2)];
      const r = rate(deck, o.id, ENEMY, RUNS);
      if (r.pct > c.pct) c = { ...r, partners: [others[i], others[j]] };
    }
  }
  const a = rate(pure, o.id, ENEMY, RUNS);
  const tagB = b.partner ? `+${b.partner}` : '';
  const tagC = c.partners ? `+${c.partners.join('+')}` : '';
  const best = Math.max(a.pct, b.pct, c.pct);
  const tag = best === a.pct ? `纯 +${a.pct - Math.max(b.pct, c.pct)}` : best === b.pct ? `双派 +${b.pct - Math.max(a.pct, c.pct)}` : `混响 +${c.pct - Math.max(a.pct, b.pct)}`;
  console.log(
    '  ' + o.name.padEnd(6) + String(school).padEnd(7)
    + `${a.pct}% ${a.kind}`.padEnd(20)
    + `${b.pct}% ${tagB}`.padEnd(20)
    + `${c.pct}% ${tagC}`.padEnd(24)
    + tag,
  );
}