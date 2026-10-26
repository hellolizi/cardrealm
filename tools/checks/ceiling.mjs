// 长牌组上限：纯流派 III、纯派 + 副派、混响 II 在同等 22 张牌下的表现。
// 折廊整局只能拿到 3 张左右的牌，这里刻意把牌组拉到中后期规模，比较「练成之后」。
process.env.NODE_ENV = 'test';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.document = { addEventListener() {}, querySelector: () => null, body: { appendChild() {} } };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

const data = await import('../../js/data.js');
const eng = await import('../../js/engine.js');
const R = await import('../../js/resonance.js');
const { CARD_MAP, ORIGINS } = data;
const { G } = await import('../../js/state.js');

function botTurn(battle) {
  let guard = 0;
  while (guard++ < 26) {
    const intent = eng.getIntent ? eng.getIntent(battle) : null;
    const incoming = intent?.totalDamage || intent?.damage || 0;
    const gap = Math.max(0, incoming - battle.player.block);
    const danger = gap >= battle.player.hp * 0.3 || gap >= 11;
    const playable = battle.hand.filter((c) => { const d = CARD_MAP[c.defId]; return d && d.cost <= battle.player.energy; });
    if (!playable.length) break;
    let pick = null;
    if (danger) {
      pick = playable
        .filter((c) => (CARD_MAP[c.defId]?.effects || []).some((e) => e.type === 'block'))
        .sort((a, b) => {
          const v = (x) => (CARD_MAP[x.defId].effects || []).reduce((s, e) => s + (e.type === 'block' ? (e.amount || 0) : 0), 0) / Math.max(1, CARD_MAP[x.defId].cost);
          return v(b) - v(a);
        })[0];
    }
    if (!pick) {
      const lastSchool = battle.resonanceState?.lastSchool || null;
      const chorusActive = Boolean(battle.resonance?.chorus?.active);
      pick = playable.map((c) => {
        const d = CARD_MAP[c.defId];
        const dmg = (d.effects || []).reduce((s, e) => s + (e.type === 'damage' ? (e.amount || 0) * (e.hits || 1) : 0), 0);
        const blk = (d.effects || []).reduce((s, e) => s + (e.type === 'block' ? (e.amount || 0) : 0), 0);
        const draw = (d.effects || []).reduce((s, e) => s + (e.type === 'draw' ? (e.amount || 0) : 0), 0);
        let r = (dmg + blk * 0.6 + draw * 2.5) / Math.max(1, d.cost);
        if (chorusActive && d.school && lastSchool) {
          r = d.school === lastSchool ? r * 0.35 : r * 1.6 + 4;
        }
        return { c, r };
      }).sort((a, b) => b.r - a.r).map((x) => x.c).find(Boolean);
    }
    if (!pick) pick = playable[0];
    if (!eng.playCard(battle, pick.uid).ok) break;
    if (battle.phase !== 'player') break;
  }
  if (battle.phase === 'player') eng.endTurn(battle);
}

function rate(deckIds, originId, enemyId, runs) {
  G.profile.originId = originId;
  let wins = 0;
  let turns = 0;
  let kind = '';
  for (let i = 0; i < runs; i += 1) {
    G.profile.sandboxDeck = deckIds.map((id) => ({ defId: id, upgraded: false }));
    const battle = eng.startSandboxBattle(enemyId);
    if (battle?.error) return { pct: -1, turns: 0, kind: 'ERR' };
    if (battle.resonance?.chorus?.active) kind = `chorus ${battle.resonance.chorus.tier}`;
    else if (battle.resonance?.primary) kind = `${battle.resonance.primary} ${battle.resonance.tier}${battle.resonance.secondary ? `+${battle.resonance.secondary.id} ${battle.resonance.secondary.tier}` : ''}`;
    else kind = 'none';
    let t = 0;
    while (battle.phase === 'player' && t++ < 60) botTurn(battle);
    if (battle.enemy.hp <= 0) { wins += 1; turns += t; }
  }
  return { pct: Math.round((wins / runs) * 100), turns: wins ? Math.round((turns / wins) * 10) / 10 : 0, kind };
}

function cardScore(card) {
  let score = 0;
  for (const effect of card.effects || []) {
    const amount = effect.amount || 0;
    if (effect.type === 'damage') score += amount * (effect.hits || 1);
    else if (effect.type === 'block') score += amount * 1.3;
    else if (effect.type === 'draw') score += amount * 4;
    else if (effect.type === 'energy') score += amount * 5;
    else if (effect.type === 'heal') score += amount * 1.1;
    else if (effect.type === 'status') score += amount * 2;
    else if (effect.type === 'loseHp') score -= amount * 0.7;
  }
  return score / Math.max(1, card.cost);
}

function pickSchool(school, count) {
  const pool = data.CARDS
    .filter((card) => card.school === school && !card.originOnly && card.rarity !== 'basic')
    .sort((a, b) => cardScore(b) - cardScore(a));
  const out = [];
  for (let i = 0; i < count && pool.length; i += 1) out.push(pool[i % pool.length].id);
  return out;
}

const enemyId = process.argv[2] || 'paper-queen';
const runs = Number(process.argv[3]) || 200;
console.log(`=== 长牌组上限 · 22 张 · 对手 ${enemyId} · ${runs} 局 ===\n`);
console.log('  ' + '角色'.padEnd(8) + '纯流派 III'.padEnd(24) + '纯派 + 副派'.padEnd(24) + '混响 II'.padEnd(24) + '最强');
for (const origin of ORIGINS) {
  const school = R.preferredSchoolForOrigin(origin.id);
  const others = R.SCHOOL_ORDER.filter((s) => s !== school).slice(0, 3);

  const pure = [...origin.starter, ...pickSchool(school, 12)];
  // 12 张主派后再补 5 张支线：主派保持 III，同时点亮副派 I。
  const hybrid = [...origin.starter, ...pickSchool(school, 7), ...pickSchool(others[0], 5)];
  // 三条支线各 4 张：混响 II，靠排序换伤害。
  const chorus = [...origin.starter];
  for (const s of others) chorus.push(...pickSchool(s, 4));

  const a = rate(pure, origin.id, enemyId, runs);
  const b = rate(hybrid, origin.id, enemyId, runs);
  const c = rate(chorus, origin.id, enemyId, runs);
  const best = Math.max(a.pct, b.pct, c.pct);
  const tag = best === a.pct ? `纯 +${a.pct - Math.max(b.pct, c.pct)}` : best === b.pct ? `双派 +${b.pct - Math.max(a.pct, c.pct)}` : `混响 +${c.pct - Math.max(a.pct, b.pct)}`;
  console.log(
    '  ' + origin.name.padEnd(6)
    + `${a.pct}% ${a.kind}`.padEnd(26)
    + `${b.pct}% ${b.kind}`.padEnd(26)
    + `${c.pct}% ${c.kind}`.padEnd(26)
    + tag,
  );
}
