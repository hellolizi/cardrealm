// 「越纯越强」实测 v2：每派都取自己最强的牌，控制费用曲线，只改流派分布。
process.env.NODE_ENV = 'test';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.document = { addEventListener() {}, querySelector: () => null, body: { appendChild() {} } };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

const data = await import('../../js/data.js');
const eng = await import('../../js/engine.js');
const { CARD_MAP } = data;
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
      pick = playable.map((c) => {
        const d = CARD_MAP[c.defId];
        const dmg = (d.effects || []).reduce((s, e) => s + (e.type === 'damage' ? (e.amount || 0) * (e.hits || 1) : 0), 0);
        const blk = (d.effects || []).reduce((s, e) => s + (e.type === 'block' ? (e.amount || 0) : 0), 0);
        return { c, r: (dmg + blk * 0.6) / Math.max(1, d.cost) };
      }).sort((a, b) => b.r - a.r).map((x) => x.c).find(Boolean);
    }
    if (!pick) pick = playable[0];
    const r = eng.playCard(battle, pick.uid);
    if (!r.ok) break;
    if (battle.phase !== 'player') break;
  }
  if (battle.phase === 'player') eng.endTurn(battle);
}

function rate(deckIds, originId, enemyId, { mute = false, runs = 400 } = {}) {
  G.profile.originId = originId;
  let w = 0;
  let tsum = 0;
  let kind = 'none';
  for (let i = 0; i < runs; i += 1) {
    G.profile.sandboxDeck = deckIds.map((id) => ({ defId: id, upgraded: false }));
    const b = eng.startSandboxBattle(enemyId);
    if (b?.error) return { pct: -1, turns: 0, kind: 'ERR:' + b.error };
    if (b.resonance?.chorus?.active) kind = 'chorus';
    else if (b.resonance?.primary) kind = 'pure-' + b.resonance.primary;
    if (mute) {
      b.resonance = {
        ...b.resonance,
        primary: null, secondary: null, value: 0, info: null, school: null, tier: 0,
        chorus: { ...(b.resonance?.chorus || {}), active: false, value: 0, tier: 0 },
      };
    }
    let t = 0;
    while (b.phase === 'player' && t++ < 50) botTurn(b);
    if (b.enemy.hp <= 0) { w += 1; tsum += t; }
  }
  return { pct: Math.round((w / runs) * 100), turns: w ? Math.round((tsum / w) * 10) / 10 : 0, kind };
}

const BONE = [...Array(6).fill('strike'), ...Array(6).fill('defend')];

// 每派 4 张「本派最强」的 1 费牌（按效果效率排）
// blade: crossGuard(5伤+7格) ironTempo? 2费 → 用 flurry(3x3) twinFang(5x2)
const BLADE4 = ['crossGuard', 'flurry', 'twinFang', 'crossGuard'];
const SHADOW4 = ['venomWard', 'ashPage', 'tornPage', 'fracture'];
const THORN4 = ['thornRiposte', 'mirrorEdge', 'mirrorParry', 'nightWatch'];
const EMBER4 = ['bloodWard', 'lampWard', 'lastFlame', 'martyr'];
const DREAM4 = ['inkEcho', 'moonScript', 'tideSigil', 'deepSlumber'];

const PURE = [...BONE, ...BLADE4, ...BLADE4, ...BLADE4];
const MIX3 = [...BONE, ...BLADE4, ...SHADOW4, ...THORN4];
const MIX3B = [...BONE, ...BLADE4, ...EMBER4, ...DREAM4];
const MIX2 = [...BONE, ...BLADE4, ...BLADE4, ...SHADOW4, ...SHADOW4];

const ENEMY = process.argv[2] || 'mirror-sovereign';
const RUNS = Number(process.argv[3]) || 400;

console.log(`=== 「越纯越强」实测 v2 · 对手 ${ENEMY} · ${RUNS} 局 ===`);
console.log('（每派都取自己最强的 1 费牌，控制质量；同牌组测开/关共鸣）\n');
console.log('  ' + '牌组'.padEnd(22) + '开共鸣'.padEnd(9) + '关共鸣'.padEnd(9) + '共鸣贡献'.padEnd(11) + '判定');
for (const c of [
  { name: '纯剑 12 张', deck: PURE },
  { name: '剑/影/棘 4+4+4', deck: MIX3 },
  { name: '剑/烬/梦 4+4+4', deck: MIX3B },
  { name: '剑/影 6+6', deck: MIX2 },
]) {
  const on = rate(c.deck, 'blade', ENEMY, { runs: RUNS });
  const off = rate(c.deck, 'blade', ENEMY, { runs: RUNS, mute: true });
  const gap = on.pct - off.pct;
  console.log(
    '  ' + c.name.padEnd(20) + String(on.pct + '%').padEnd(9) + String(off.pct + '%').padEnd(9)
    + ((gap > 0 ? '+' : '') + gap + 'pp').padEnd(11) + on.kind,
  );
}