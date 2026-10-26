process.env.NODE_ENV = 'test';
const store = new Map();
globalThis.localStorage = { getItem:(k)=>store.get(k)??null, setItem:(k,v)=>store.set(k,String(v)), removeItem:(k)=>store.delete(k), clear:()=>store.clear() };
globalThis.document = { addEventListener(){}, querySelector:()=>null, body:{ appendChild(){} } };
globalThis.window = { addEventListener(){}, dispatchEvent(){}, location:{href:''}, matchMedia:()=>({matches:false,addEventListener(){}}) };
globalThis.CustomEvent = class { constructor(t,o){ this.type=t; Object.assign(this,o); } };
const data = await import('../../js/data.js');
const eng = await import('../../js/engine.js');
const { ORIGINS, ORIGIN_MAP, CARD_MAP, ENEMY_MAP } = data;
const { G } = await import('../../js/state.js');
const { skilledTurn } = await import('./bots.mjs');

const enemyId = process.argv[2] || 'nightmare-dragon';
const enemyName = ENEMY_MAP[enemyId]?.name || enemyId;

function rate(originId, runs=500) {
  const o = ORIGIN_MAP[originId];
  G.profile.originId = originId;
  let w=0, tsum=0;
  for (let i=0;i<runs;i++){
    G.profile.sandboxDeck = o.starter.map(id=>({defId:id,upgraded:false}));
    const b = eng.startSandboxBattle(enemyId);
    if (b?.error) return {pct:-1};
    let t=0; while(b.phase==='player' && t++<40) skilledTurn(b);
    if (b.enemy.hp<=0){ w++; tsum+=t; }
  }
  return { pct: Math.round(w/runs*100), turns: w? Math.round(tsum/w*10)/10 : 0 };
}

// 不覆盖，直接用 data.js 里的真实配置
for (const o of ORIGINS) console.log('  [配置]', o.name, JSON.stringify(o.resources), '阈值', o.mechanic.max);
console.log('');

console.log(`=== ${enemyName} · 500 局 ===`);
for (const o of ORIGINS) {
  const r = rate(o.id);
  const flag = r.pct >= 85 ? 'OK' : '*** 偏低 ***';
  console.log(`  ${o.name.padEnd(6)} ${r.pct}%  ${r.turns}回合  ${flag}`);
}
