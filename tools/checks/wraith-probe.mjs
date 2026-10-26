// 单角色路线探针：打印每场战斗前的生命、牌组与 BOSS 战结果。
process.env.NODE_ENV = 'test';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.document = { addEventListener() {}, querySelector: () => null, body: { appendChild() {} } };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

const data = await import('../../js/data.js');
const eng = await import('../../js/engine.js');
const R = await import('../../js/resonance.js');
const { CARD_MAP, ORIGIN_MAP } = data;
const { G } = await import('../../js/state.js');

function cardDamage(def) {
  return (def.effects || []).reduce((sum, e) => {
    if (e.type === 'damage') return sum + (Number(e.amount) || 0) * Math.max(1, Number(e.hits) || 1);
    if (['execute', 'directDamage', 'blockDamage'].includes(e.type)) return sum + (Number(e.amount) || 0);
    if (e.type === 'status') {
      const amount = Number(e.amount) || 0;
      if (e.status === 'poison') return sum + amount * 2.6;
      if (e.status === 'burn') return sum + amount * 2.2;
      if (e.status === 'vulnerable' || e.status === 'weak') return sum + amount * 1.5;
      return sum + amount * 1.2;
    }
    return sum;
  }, 0);
}

function botTurn(battle) {
  let guard = 0;
  while (guard++ < 28 && battle.phase === 'player') {
    const intent = eng.getIntent(battle);
    const incoming = intent?.totalDamage || 0;
    const gap = Math.max(0, incoming - battle.player.block);
    const danger = gap >= battle.player.hp * 0.28 || gap >= 12;
    const playable = battle.hand.filter((c) => {
      const def = CARD_MAP[c.defId];
      return def && def.cost <= battle.player.energy;
    });
    if (!playable.length) break;
    let pick = null;
    if (danger) {
      pick = playable
        .filter((c) => (CARD_MAP[c.defId]?.effects || []).some((e) => e.type === 'block'))
        .sort((a, b) => {
          const value = (x) => (CARD_MAP[x.defId].effects || []).reduce((s, e) => s + (e.type === 'block' ? (Number(e.amount) || 0) : 0), 0) / Math.max(1, CARD_MAP[x.defId].cost);
          return value(b) - value(a);
        })[0];
    }
    if (!pick) {
      const lastSchool = battle.resonanceState?.lastSchool || null;
      const chorusActive = Boolean(battle.resonance?.chorus?.active);
      pick = playable
        .map((c) => {
          const def = CARD_MAP[c.defId];
          const block = (def.effects || []).reduce((s, e) => s + (e.type === 'block' ? (Number(e.amount) || 0) : 0), 0);
          let score = (cardDamage(def) + block * 0.55) / Math.max(1, def.cost);
          if (chorusActive && def.school && lastSchool) score *= def.school === lastSchool ? 0.7 : 1.3;
          return { c, score };
        })
        .sort((a, b) => b.score - a.score)[0]?.c;
    }
    if (!pick) pick = playable[0];
    if (!eng.playCard(battle, pick.uid).ok) break;
  }
  if (battle.phase === 'player') eng.endTurn(battle);
}

function schoolScore(card, primary) {
  if (!card || card.id === 'strike' || card.id === 'defend') return 0;
  let score = 0;
  for (const e of card.effects || []) {
    const amount = Number(e.amount) || 0;
    if (e.type === 'damage') score += amount * Math.max(1, Number(e.hits) || 1);
    else if (e.type === 'block') score += amount * 1.15;
    else if (e.type === 'draw') score += amount * 3;
    else if (e.type === 'energy') score += amount * 4;
    else if (e.type === 'heal') score += amount * 1.1;
    else if (e.type === 'status') score += amount * (e.status === 'poison' ? 2.6 : e.status === 'burn' ? 2.2 : 1.8);
  }
  score /= Math.max(1, card.cost);
  if (primary && card.school === primary) score *= 1.35;
  return score;
}

function chooseNode(run) {
  const nodes = eng.getAvailableNodes(run).filter((node) => node.type !== 'shop');
  const available = nodes.length ? nodes : eng.getAvailableNodes(run);
  const boss = available.find((node) => node.type === 'boss');
  const hpRatio = run.hp / run.maxHp;
  if (boss) return hpRatio > 0.45 || available.length === 1 ? boss : available.find((n) => n.type === 'camp') || boss;
  const camp = available.find((node) => node.type === 'camp');
  if (camp && hpRatio < 0.55) return camp;
  const elite = available.find((node) => node.type === 'elite');
  if (elite && hpRatio > 0.72) return elite;
  return available.find((n) => n.type === 'battle') || available.find((n) => n.type === 'treasure') || available[0];
}

const runs = Number(process.argv[2]) || 8;
const origin = ORIGIN_MAP[process.argv[3] || 'wraith'];
const primary = R.preferredSchoolForOrigin(origin.id);
for (let i = 0; i < runs; i += 1) {
  const run = eng.startAdventure(origin.id, 'corridor', { ascension: 0 });
  const log = [];
  let guard = 0;
  while (guard++ < 40) {
    const node = chooseNode(run);
    if (!node) break;
    if (node.type === 'camp') {
      const healed = eng.restHeal(run);
      log.push(`营火 ${run.hp - healed}->${run.hp}`);
      eng.completeNode(run, node.id);
      continue;
    }
    if (node.type === 'treasure') {
      eng.createTreasure(run);
      eng.completeNode(run, node.id);
      continue;
    }
    if (node.type === 'event' || node.type === 'shop') {
      eng.completeNode(run, node.id);
      continue;
    }
    if (!['battle', 'elite', 'boss'].includes(node.type)) {
      eng.completeNode(run, node.id);
      continue;
    }
    eng.beginNode(run, node.id);
    const battle = eng.startAdventureBattle(node);
    if (!battle) { log.push(`${node.type} 无法开始`); break; }
    const hpBefore = run.hp;
    const deck = run.deck.length;
    let turns = 0;
    while (battle.phase === 'player' && turns < 60) { turns += 1; botTurn(battle); }
    log.push(`${node.type} 前HP ${hpBefore}/${run.maxHp} 牌${deck} -> ${battle.phase === 'victory' ? '胜' : '败'} ${turns}回合 余HP ${run.hp} 敌HP ${battle.enemy.hp}`);
    if (node.type === 'boss') {
      log.push(`  BOSS LOG:\n    ${battle.log.map((entry) => `T${entry.turn} ${entry.text}`).join('\n    ')}`);
    }
    if (battle.phase !== 'victory') break;
    const cards = battle.rewards?.cards || [];
    const ranked = cards.map((id) => ({ id, score: schoolScore(CARD_MAP[id], primary) })).sort((a, b) => b.score - a.score);
    eng.claimBattleReward(ranked[0]?.id || null);
    if (cards.length) log.push(`  选牌 ${ranked[0]?.id}`);
    if (node.type === 'boss') { eng.finishAdventure(); break; }
  }
  const counts = R.countDeckSchools(run.deck || []);
  console.log(`--- 第 ${i + 1} 局 最终HP ${run.hp}/${run.maxHp} 牌组 ${run.deck.length} 共鸣 ${JSON.stringify({ primary: run.resonance?.primary, chorus: run.resonance?.chorus?.active })} 流派 ${JSON.stringify(counts)}`);
  console.log('  ' + log.join('\n  '));
}
