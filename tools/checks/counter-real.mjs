process.env.NODE_ENV = 'test';
const store = new Map();
globalThis.localStorage = { getItem:(k)=>store.get(k)??null, setItem:(k,v)=>store.set(k,String(v)), removeItem:(k)=>store.delete(k), clear:()=>store.clear() };
globalThis.document = { addEventListener(){}, querySelector:()=>null, body:{ appendChild(){} } };
globalThis.window = { addEventListener(){}, dispatchEvent(){}, location:{href:''}, matchMedia:()=>({matches:false,addEventListener(){}}) };
globalThis.CustomEvent = class { constructor(t,o){ this.type=t; Object.assign(this,o); } };
const data = await import('../../js/data.js');
const eng = await import('../../js/engine.js');
const { CARD_MAP, ENEMY_MAP, CARDS } = data;
const { G } = await import('../../js/state.js');

function botTurn(battle) {
  let guard = 0;
  while (guard++ < 24) {
    const intent = eng.getIntent ? eng.getIntent(battle) : null;
    const incoming = intent?.totalDamage || intent?.damage || 0;
    const gap = Math.max(0, incoming - battle.player.block);
    const danger = gap >= battle.player.hp * 0.32 || gap >= 12;
    const playable = battle.hand.filter((c) => { const d = CARD_MAP[c.defId]; return d && d.cost <= battle.player.energy; });
    if (!playable.length) break;
    let pick = null;
    if (danger) pick = playable.find((c) => (CARD_MAP[c.defId]?.effects||[]).some(e=>e.type==='block'));
    if (!pick) pick = playable.map(c=>{ const d=CARD_MAP[c.defId]; const dmg=(d.effects||[]).reduce((s,e)=>s+(e.type==='damage'?(e.amount||0)*(e.hits||1):0),0); return {c, r: dmg/Math.max(1,d.cost)}; }).sort((a,b)=>b.r-a.r).map(x=>x.c).find(Boolean);
    if (!pick) pick = playable[0];
    const r = eng.playCard(battle, pick.uid);
    if (!r.ok) break;
    if (battle.phase !== 'player') break;
  }
  if (battle.phase === 'player') eng.endTurn(battle);
}

// 治疗流牌组：大量回血牌 + 中等输出
const HEAL_IDS = CARDS.filter(c=>(c.effects||[]).some(e=>e.type==='heal')).map(c=>c.id);
const ATK_IDS = CARDS.filter(c=>(c.effects||[]).some(e=>e.type==='damage') && (c.cost||0)<=2).map(c=>c.id).slice(0,14);
const BLOCK_IDS = CARDS.filter(c=>(c.effects||[]).some(e=>e.type==='block') && (c.cost||0)<=2).map(c=>c.id).slice(0,8);
const healDeck = [...HEAL_IDS, ...HEAL_IDS, ...ATK_IDS, ...BLOCK_IDS].map(id=>({defId:id,upgraded:false}));

function fight(enemyId, deck, runs=120) {
  G.profile.originId = 'blade';
  G.profile.sandboxDeck = deck;
  let w=0, tsum=0, hpLeft=0;
  for (let i=0;i<runs;i++){
    const b = eng.startSandboxBattle(enemyId);
    if (b?.error) return {pct:-1};
    let t=0; while(b.phase==='player' && t++<40) botTurn(b);
    if (b.enemy.hp<=0){ w++; tsum+=t; hpLeft+=b.player.hp; }
  }
  return { pct: Math.round(w/runs*100), turns: w?Math.round(tsum/w*10)/10:0, hp: w?Math.round(hpLeft/w):0 };
}

console.log('=== 治疗流牌组 vs 焚名圣者（禁疗反制）===');
const e = ENEMY_MAP['ash-saint'];
const on = fight('ash-saint', healDeck);
const saved = { noHeal: e.phase2.noHeal };
delete e.phase2.noHeal;
const off = fight('ash-saint', healDeck);
e.phase2.noHeal = saved.noHeal;
console.log(`  有禁疗 ${on.pct}% (${on.turns}回合, 剩余${on.hp}血)`);
console.log(`  无禁疗 ${off.pct}% (${off.turns}回合, 剩余${off.hp}血)`);
console.log(`  → 禁疗影响: 胜率 ${off.pct-on.pct} 个百分点，剩余血量差 ${off.hp-on.hp}`);

console.log('\n=== 连招牌组 vs 剪月皇后（拆牌反制）===');
const comboDeck = [...ATK_IDS, ...ATK_IDS, ...BLOCK_IDS].map(id=>({defId:id,upgraded:false}));
const q = ENEMY_MAP['paper-queen'];
const qon = fight('paper-queen', comboDeck);
const savedQ = { echoBreak: q.phase2.echoBreak };
delete q.phase2.echoBreak;
const qoff = fight('paper-queen', comboDeck);
q.phase2.echoBreak = savedQ.echoBreak;
console.log(`  有拆牌 ${qon.pct}% (${qon.turns}回合)`);
console.log(`  无拆牌 ${qoff.pct}% (${qoff.turns}回合)`);
console.log(`  → 拆牌影响: ${qoff.pct-qon.pct} 个百分点`);

console.log('\n=== 纯攻牌组 vs 镜潮之主（反震反制）===');
// 纯攻：只堆伤害，不防守。反震的靶子正是这种打法。
const burstDeck = [...ATK_IDS, ...ATK_IDS, ...ATK_IDS].map((id) => ({ defId: id, upgraded: false }));
const m2 = ENEMY_MAP['mirror-sovereign'];
if (!m2?.phase2) console.log('  跳过：镜潮之主没有二阶段');
else {
  const mon = fight('mirror-sovereign', burstDeck);
  const savedM = { reflectPct: m2.phase2.reflectPct };
  delete m2.phase2.reflectPct;
  const moff = fight('mirror-sovereign', burstDeck);
  m2.phase2.reflectPct = savedM.reflectPct;
  console.log(`  有反震 ${mon.pct}% (${mon.turns}回合, 剩余${mon.hp}血)`);
  console.log(`  无反震 ${moff.pct}% (${moff.turns}回合, 剩余${moff.hp}血)`);
  console.log(`  → 反震影响: ${moff.pct-mon.pct} 个百分点，剩余血量差 ${moff.hp-mon.hp}`);
}
