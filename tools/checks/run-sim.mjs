// 整局模拟：从折廊起点走到首领，统计五角色的实战胜率与路线选择。
process.env.NODE_ENV = 'test';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.document = { addEventListener() {}, querySelector: () => null, body: { appendChild() {} } };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

const data = await import('../../js/data.js');
const eng = await import('../../js/engine.js');
const R = await import('../../js/resonance.js');
const L = await import('../../js/lore.js');
const U = await import('../../js/utils.js');
const { CARD_MAP, ITEM_MAP, ORIGIN_MAP, ORIGINS } = data;
const { G } = await import('../../js/state.js');
const simRegion = process.env.SIM_REGION || 'corridor';
if (simRegion !== 'corridor') {
  G.profile.world.unlockedRegions = L.REGIONS.map((region) => region.id);
}

const simHpScale = Number(process.env.SIM_HP_SCALE) || 1;
const simPowerScale = Number(process.env.SIM_POWER_SCALE) || 1;
if (Number(process.env.SIM_BASE_HP_SCALE)) eng.OPENING_DIFFICULTY.enemyHpScale = Number(process.env.SIM_BASE_HP_SCALE);
if (Number(process.env.SIM_BASE_DAMAGE_SCALE)) eng.OPENING_DIFFICULTY.enemyDamageScale = Number(process.env.SIM_BASE_DAMAGE_SCALE);
if (simHpScale !== 1 || simPowerScale !== 1) {
  for (const enemy of Object.values(data.ENEMY_MAP)) {
    enemy.hp = Math.max(1, Math.round(enemy.hp * simHpScale));
    enemy.powerScale = Math.max(0.1, (Number(enemy.powerScale) || 1) * simPowerScale);
  }
}
if (Number(process.env.SIM_ARCANIST_HP)) data.ORIGIN_MAP.arcanist.hp = Number(process.env.SIM_ARCANIST_HP);
if (Number(process.env.SIM_ARCANIST_DEX)) data.ORIGIN_MAP.arcanist.startStatuses.dexterity = Number(process.env.SIM_ARCANIST_DEX);
if (Number(process.env.SIM_ARCANIST_ENERGY)) data.ORIGIN_MAP.arcanist.resources.energy = Number(process.env.SIM_ARCANIST_ENERGY);
if (Number(process.env.SIM_BLADE_STRENGTH)) data.ORIGIN_MAP.blade.startStatuses.strength = Number(process.env.SIM_BLADE_STRENGTH);
if (Number(process.env.SIM_BLADE_HP)) data.ORIGIN_MAP.blade.hp = Number(process.env.SIM_BLADE_HP);
if (Number(process.env.SIM_WRAITH_POISON)) data.ORIGIN_MAP.wraith.startPoison = Number(process.env.SIM_WRAITH_POISON);
if (Number(process.env.SIM_WRAITH_HP)) data.ORIGIN_MAP.wraith.hp = Number(process.env.SIM_WRAITH_HP);
if (Number(process.env.SIM_FROG_DRAW)) {
  const effect = CARD_MAP.stuffedCheeks.effects.find((entry) => entry.type === 'draw');
  if (effect) effect.amount = Number(process.env.SIM_FROG_DRAW);
}
if (Number(process.env.SIM_FROG_HP)) data.ORIGIN_MAP.milkfrog.hp = Number(process.env.SIM_FROG_HP);
if (Number(process.env.SIM_FROG_FLOP_BLOCK)) {
  const effect = CARD_MAP.bellyFlop.effects.find((entry) => entry.type === 'block');
  if (effect) effect.amount = Number(process.env.SIM_FROG_FLOP_BLOCK);
}

for (const [key, constant] of [['block', 'LAST_STAND_BLOCK'], ['draw', 'LAST_STAND_DRAW'], ['energy', 'LAST_STAND_ENERGY'], ['scarHp', 'LAST_STAND_COST']]) {
  const value = Number(process.env[constant]);
  if (Number.isFinite(value) && value >= 0) eng.LAST_STAND[key] = value;
}

for (const [key, constant] of [
  ['bossDamagePerTier', 'SIM_PRESSURE_DAMAGE'],
  ['bossHpPerTier', 'SIM_PRESSURE_HP'],
  ['bossStrengthPerTier', 'SIM_PRESSURE_STRENGTH'],
  ['phase2EarlyPerTier', 'SIM_PRESSURE_PHASE'],
  ['minPhase2At', 'SIM_PRESSURE_MIN_PHASE'],
]) {
  const value = Number(process.env[constant]);
  if (Number.isFinite(value) && value >= 0) eng.AWAKENING_PRESSURE[key] = value;
}

const USE_EVENTS = process.env.SIM_EVENTS !== '0';
const USE_ITEMS = process.env.SIM_ITEMS !== '0';
const USE_PARLEY = process.env.SIM_PARLEY !== '0';
const SMART_CAMP = process.env.SIM_CAMP !== '0';
const SMART_SHOP = process.env.SIM_SHOP !== '0';
const SKIP_REWARDS = process.env.SIM_SKIP_REWARDS !== '0';
const AWAKENING_MODE = process.env.SIM_AWAKENING || 'smart';

const AWAKENING_PREFERENCE = {
  blade: ['bladeTempo', 'bladeDawn', 'bladeMight', 'bladeUnsheathed'],
  arcanist: ['arcSwift', 'arcLoop', 'arcVeil', 'arcFall'],
  wraith: ['wraithSpread', 'wraithAbyss', 'wraithDeep', 'wraithGarden'],
  pyre: ['pyreFlare', 'pyrePyre', 'pyreHaste', 'pyreFuneral'],
  milkfrog: ['laughBlade', 'laughAbyss', 'laughWheeze', 'laughCollapse'],
};

const stats = { items: 0, parleys: 0, parleyWins: 0, upgrades: 0, purges: 0, relics: 0, events: 0 };

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

function hasItem(itemId) {
  return Array.isArray(G.run?.items) && G.run.items.includes(itemId);
}

function itemAmount(itemId, type) {
  const item = ITEM_MAP[itemId];
  return (item?.effects || []).reduce((sum, e) => sum + (e.type === type ? Number(e.amount) || 0 : 0), 0);
}

function useItemOnce(battle, itemId) {
  if (!hasItem(itemId) || battle.phase !== 'player') return false;
  const result = eng.useItem(battle, itemId);
  if (result.ok) stats.items += 1;
  return Boolean(result.ok);
}

/**
 * 会用药的玩家：残血先喝药，致命一击前补格挡，精英/首领开局先上长线收益。
 * 普通战斗只处理回血和格挡，把输出道具留给硬仗。
 */
function maybeUseItems(battle) {
  if (!USE_ITEMS || battle.rules?.noItems || !Array.isArray(G.run?.items)) return;
  const hpRatio = battle.player.hp / Math.max(1, battle.player.maxHp);
  const hard = battle.tier === 'boss' || battle.tier === 'elite';
  const preview = eng.previewEnemyAttack(battle);
  const incoming = preview?.total || 0;
  const gap = Math.max(0, incoming - battle.player.block);
  const missing = battle.player.maxHp - battle.player.hp;
  const enemyHp = battle.enemy.hp;
  const debuffs = Object.entries(battle.player.statuses || {})
    .filter(([key, value]) => ['weak', 'vulnerable', 'poison', 'burn'].includes(key) && Number(value) > 0)
    .reduce((sum, [, value]) => sum + Number(value), 0);

  const heals = ['phoenixTear', 'moonPotion', 'merchantElixir', 'dewPotion'].filter(hasItem);
  for (const itemId of heals) {
    if (hpRatio >= 0.62) break;
    const heal = itemAmount(itemId, 'heal');
    if (heal >= 20 || hpRatio < 0.42 || missing >= heal * 0.7) {
      if (useItemOnce(battle, itemId)) return maybeUseItems(battle);
    }
  }

  if (debuffs >= 5 && hasItem('clarityDraught')) {
    if (useItemOnce(battle, 'clarityDraught')) return maybeUseItems(battle);
  }

  if (hard && battle.turn <= 2) {
    if (hasItem('furyTonic') && battle.player.hp > 18) {
      if (useItemOnce(battle, 'furyTonic')) return maybeUseItems(battle);
    }
    if (hasItem('windTonic')) {
      if (useItemOnce(battle, 'windTonic')) return maybeUseItems(battle);
    }
    if (hasItem('thornPhial') && enemyHp > 60) {
      if (useItemOnce(battle, 'thornPhial')) return maybeUseItems(battle);
    }
    if (hasItem('venomFlask') && enemyHp > 45) {
      if (useItemOnce(battle, 'venomFlask')) return maybeUseItems(battle);
    }
    if (hasItem('emberFlask') && enemyHp > 45) {
      if (useItemOnce(battle, 'emberFlask')) return maybeUseItems(battle);
    }
  }

  if (gap >= Math.max(10, battle.player.hp * 0.3)) {
    for (const itemId of ['ironTonic', 'smokeBomb', 'merchantElixir']) {
      if (!hasItem(itemId)) continue;
      if (useItemOnce(battle, itemId)) return maybeUseItems(battle);
    }
  }

  const damage = ['thunderStone'].filter(hasItem)
    .map((itemId) => ({ itemId, amount: itemAmount(itemId, 'damage') }))
    .find((entry) => entry.amount > 0);
  if (damage && (enemyHp <= damage.amount + 2 || (hard && battle.turn >= 2))) {
    if (useItemOnce(battle, damage.itemId)) return;
  }

  if (hard && battle.player.energy <= 1 && battle.player.hp > 16 && hasItem('emberWine')) {
    if (useItemOnce(battle, 'emberWine')) return;
  }
}

/** 只在成功率够高时交涉；失败会白送敌人力量，所以宁可不赌。 */
function maybeParley(battle) {
  if (!USE_PARLEY || battle.turn !== 1) return;
  if (battle.parley || (battle.stats?.cardsPlayed || 0) > 0) return;
  const options = eng.parleyOptions(battle).filter((option) => !option.disabled);
  if (!options.length) return;
  const threshold = battle.tier === 'boss' ? 62 : battle.tier === 'elite' ? 58 : 55;
  const best = options.sort((a, b) => b.chance - a.chance)[0];
  if (!best || best.chance < threshold) return;
  stats.parleys += 1;
  const result = eng.resolveParley(battle, best.id);
  if (result.success) stats.parleyWins += 1;
}

function botTurn(battle) {
  if (process.env.LAST_STAND !== '0' && battle.lastStand?.offered && !battle.lastStand.resolved) {
    eng.resolveLastStand(battle, process.env.LAST_STAND !== 'decline');
  }
  maybeParley(battle);
  maybeUseItems(battle);
  let guard = 0;
  while (guard++ < 28 && battle.phase === 'player') {
    const preview = eng.previewEnemyAttack(battle);
    const incoming = preview?.total || 0;
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
          const effects = def.effects || [];
          const block = effects.reduce((s, e) => s + (e.type === 'block' ? (Number(e.amount) || 0) : 0), 0);
          const draw = effects.reduce((s, e) => s + (e.type === 'draw' ? (Number(e.amount) || 0) : 0), 0);
          const energy = effects.reduce((s, e) => s + (e.type === 'energy' ? (Number(e.amount) || 0) : 0), 0);
          const heal = effects.reduce((s, e) => s + (e.type === 'heal' ? (Number(e.amount) || 0) : 0), 0);
          let score = (cardDamage(def) + block * 0.55 + draw * 2.4 + energy * 3 + heal * 0.8) / Math.max(1, def.cost);
          if (chorusActive && def.school && lastSchool) {
            // 熟练玩家会为了不断链，宁可先打一张低伤害的别派牌。
            score = def.school === lastSchool ? score * 0.35 : score * 1.6 + 4;
          }
          return { c, score };
        })
        .sort((a, b) => b.score - a.score)[0]?.c;
    }
    if (!pick) pick = playable[0];
    if (!eng.playCard(battle, pick.uid).ok) break;
  }
  if (battle.phase === 'player') eng.endTurn(battle);
}

function battleOnce(run, node) {
  const battle = eng.startAdventureBattle(node);
  if (!battle) return null;
  let turns = 0;
  while (battle.phase === 'player' && turns < 60) {
    turns += 1;
    botTurn(battle);
  }
  return { battle, turns };
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

function scoreRewardCard(def, counts, primary, strategy, desired) {
  let score = schoolScore(def, strategy === 'pure' ? primary : null);
  if (!def?.school) return score;
  if (strategy === 'hybrid') {
    const have = counts[def.school] || 0;
    if (def.school === primary) score *= 0.85;
    else score *= have < 4 ? 2.4 : 1.1;
  } else if (strategy === 'chorus') {
    const have = counts[def.school] || 0;
    if (def.school === primary) score *= 0.7;
    else {
      score *= have === 0 ? 2.5 : have < 2 ? 1.8 : have < 4 ? 1.4 : 1.05;
      if (desired && def.school === desired) score *= 1.8;
    }
  }
  return score;
}

function chorusTarget(counts, primary) {
  const started = R.SCHOOL_ORDER
    .filter((school) => school !== primary && (counts[school] || 0) > 0)
    .sort((a, b) => counts[b] - counts[a]);
  if (!started.length) return null;
  if (started.length === 1) {
    if ((counts[started[0]] || 0) < 2) return started[0];
    return R.SCHOOL_ORDER.find((school) => school !== primary && school !== started[0]) || null;
  }
  const open = started.filter((school) => (counts[school] || 0) < 4);
  if (open.length >= 2) return [...open].sort((a, b) => counts[a] - counts[b])[0];
  return null;
}

function pickReward(run, battle, primary, strategy = 'pure') {
  const cards = battle.rewards?.cards || [];
  if (!cards.length) return null;
  const counts = R.countDeckSchools(run.deck || []);
  const splashPool = R.SCHOOL_ORDER.filter((school) => school !== primary);
  let desired = null;
  if (strategy === 'hybrid') {
    desired = [...splashPool].sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0] || null;
  } else if (strategy === 'chorus') {
    desired = chorusTarget(counts, primary);
  }
  const ranked = cards
    .map((id) => ({ id, score: scoreRewardCard(CARD_MAP[id], counts, primary, strategy, desired) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0] || null;
  // 熟练玩家不会为了「有牌可拿」把牌组塞到 20 张；低价值奖励直接跳过。
  if (!best) return null;
  if (SKIP_REWARDS && run.deck.length >= 14 && best.score < 9) return null;
  return best.id;
}

function pickUpgradeIndex(run, primary, strategy) {
  let best = null;
  run.deck.forEach((entry, index) => {
    const base = CARD_MAP[entry.defId];
    if (!base || entry.upgraded) return;
    const upgraded = U.resolveCard(base, true);
    const before = schoolScore(base, strategy === 'pure' ? primary : null);
    const after = schoolScore(upgraded, strategy === 'pure' ? primary : null);
    let value = (after - before) * Math.max(1, base.cost);
    if (base.id === 'strike' || base.id === 'defend') value *= 0.35;
    if (!best || value > best.value) best = { index, value };
  });
  return best?.index ?? null;
}

function pickPurgeIndex(run, primary, strategy) {
  const counts = R.countDeckSchools(run.deck || []);
  let best = null;
  run.deck.forEach((entry, index) => {
    const def = CARD_MAP[entry.defId];
    if (!def) return;
    let score = scoreRewardCard(def, counts, primary, strategy, null);
    if (entry.upgraded) score *= 1.5;
    if (def.id === 'strike' || def.id === 'defend') score -= 4;
    if (!best || score < best.score) best = { index, score };
  });
  return best?.index ?? null;
}

function pickShopCard(run, shop, primary, strategy) {
  const counts = R.countDeckSchools(run.deck || []);
  const desired = strategy === 'chorus'
    ? chorusTarget(counts, primary)
    : strategy === 'hybrid'
      ? [...R.SCHOOL_ORDER].filter((s) => s !== primary).sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0]
      : null;
  let best = null;
  (shop.cards || []).forEach((offer, index) => {
    if (offer.sold || offer.price > run.gold) return;
    const score = scoreRewardCard(CARD_MAP[offer.defId], counts, primary, strategy, desired);
    if (!best || score > best.score) best = { index, score };
  });
  return best?.index ?? null;
}

function shopVisit(run, shop, primary, strategy) {
  if (!SMART_SHOP) {
    for (let buys = 0; buys < 2; buys += 1) {
      const index = pickShopCard(run, shop, primary, strategy);
      if (index === null || index === undefined) break;
      if (!eng.buyShopCard(run, shop, index).ok) break;
    }
    return;
  }
  const hpRatio = run.hp / Math.max(1, run.maxHp);
  if (hpRatio < 0.55 && shop.heal && !shop.heal.sold && run.gold >= shop.heal.price) {
    eng.buyShopHeal(run, shop);
  }
  if (shop.relic && !shop.relic.sold && run.gold >= shop.relic.price + 25) {
    if (eng.buyShopRelic(run, shop).ok) stats.relics += 1;
  }
  const itemSlots = 10 - (run.items?.length || 0);
  if (itemSlots > 2) {
    const rankedItems = (shop.items || [])
      .map((offer, index) => ({ offer, index, def: ITEM_MAP[offer.defId] }))
      .filter(({ offer, def }) => !offer.sold && def && offer.price <= run.gold - 20)
      .sort((a, b) => {
        const value = (entry) => (entry.def.rarity === 'rare' ? 3 : entry.def.rarity === 'uncommon' ? 2 : 1);
        return value(b) - value(a);
      });
    const buy = rankedItems[0];
    if (buy) eng.buyShopItem(run, shop, buy.index);
  }
  for (let buys = 0; buys < 2; buys += 1) {
    const index = pickShopCard(run, shop, primary, strategy);
    if (index === null || index === undefined) break;
    if (!eng.buyShopCard(run, shop, index).ok) break;
  }
  if (shop.purge && !shop.purge.sold && run.deck.length > 13 && run.gold >= shop.purge.price) {
    const index = pickPurgeIndex(run, primary, strategy);
    if (index !== null && eng.buyShopPurge(run, shop, index).ok) stats.purges += 1;
  }
}

function visitCamp(run, primary, strategy) {
  const hpRatio = run.hp / Math.max(1, run.maxHp);
  if (!SMART_CAMP || hpRatio < 0.55) {
    eng.restHeal(run);
    return;
  }
  const index = pickUpgradeIndex(run, primary, strategy);
  if (index === null) { eng.restHeal(run); return; }
  if (eng.upgradeDeckCard(run, index)) stats.upgrades += 1;
}

function visitEvent(run) {
  if (!USE_EVENTS) return;
  const event = eng.pickEventForRegion(run.regionId, run.eventsSeen || []);
  if (!event) return;
  if (!Array.isArray(run.eventsSeen)) run.eventsSeen = [];
  if (!run.eventsSeen.includes(event.id)) run.eventsSeen.push(event.id);
  const hpRatio = run.hp / Math.max(1, run.maxHp);
  let choice = null;
  if (hpRatio < 0.55) {
    choice = event.choices.find((entry) => entry.desc.includes('回复'));
  } else if (event.id === 'gambler') {
    choice = event.choices.find((entry) => entry.id === 'leave');
  } else {
    choice = event.choices.find((entry) => entry.id !== 'leave');
  }
  if (!choice) choice = event.choices.find((entry) => entry.id === 'leave') || event.choices[0];
  const result = eng.resolveEventChoice(run, event.id, choice.id);
  if (!result.ok) {
    const fallback = event.choices.find((entry) => entry.id === 'leave');
    if (fallback) eng.resolveEventChoice(run, event.id, fallback.id);
  } else {
    stats.events += 1;
  }
}

function mapProgress(run) {
  const region = L.REGION_MAP[run.regionId];
  const looping = region?.shape === 'ring' || region?.shape === 'clock';
  const nonBoss = run.map.flat().filter((node) => node.type !== 'boss');
  const cleared = nonBoss.filter((node) => run.completed.includes(node.id)).length;
  return { looping, nonBoss, cleared, total: nonBoss.length };
}

function shortestSteps(run, startId, targetIds) {
  const byId = new Map(run.map.flat().map((node) => [node.id, node]));
  const targets = new Set(targetIds);
  let frontier = [startId];
  const seen = new Set(frontier);
  let distance = 0;
  while (frontier.length && distance < 40) {
    if (frontier.some((id) => targets.has(id))) return distance;
    const next = [];
    for (const id of frontier) {
      for (const nextId of byId.get(id)?.next || []) {
        if (seen.has(nextId)) continue;
        seen.add(nextId);
        next.push(nextId);
      }
    }
    frontier = next;
    distance += 1;
  }
  return 999;
}

function chooseNode(run) {
  const available = eng.getAvailableNodes(run);
  const boss = available.find((node) => node.type === 'boss');
  const bossNode = run.map.flat().find((node) => node.type === 'boss');
  const hpRatio = run.hp / Math.max(1, run.maxHp);
  const progress = mapProgress(run);
  const remaining = progress.nonBoss.filter((node) => !run.completed.includes(node.id));
  if (boss) {
    if (!progress.looping) return boss;
    // 环形/钟面：先把一圈走完，再推王座的门。旧 bot 从第一格直接进首领，
    // 用 10 张起手牌打后段 Boss，才得出骨庭 0% 这种失真的数字。
    if (!remaining.length) return boss;
    if (run.floor >= progress.total) return boss;
    if (hpRatio < 0.2 && available.some((node) => node.type === 'camp' && !run.completed.includes(node.id))) {
      return available.find((node) => node.type === 'camp' && !run.completed.includes(node.id));
    }
  }
  const open = available.filter((node) => !run.completed.includes(node.id));
  if (!open.length) {
    // 钟面的王座只出现在后半圈：走完所有格子后，可能要沿已走过的刻度
    // 往王座靠。已完成的节点只通行、不重复结算。
    const targetIds = remaining.length ? remaining.map((node) => node.id) : [bossNode?.id].filter(Boolean);
    const step = [...available]
      .filter((node) => node.type !== 'boss')
      .sort((a, b) => shortestSteps(run, a.id, targetIds) - shortestSteps(run, b.id, targetIds))[0];
    if (step) return step;
  }
  const pool = open.length ? open : available.filter((node) => node.type !== 'boss');
  const camp = pool.find((node) => node.type === 'camp');
  if (camp && (hpRatio < 0.58 || (hpRatio > 0.75 && run.deck.some((entry) => !entry.upgraded)))) return camp;
  const elite = pool.find((node) => node.type === 'elite');
  if (elite && hpRatio > 0.74) return elite;
  const shop = pool.find((node) => node.type === 'shop');
  if (shop && (run.gold || 0) >= 55) return shop;
  const normal = pool.find((node) => node.type === 'battle');
  if (normal) return normal;
  const treasure = pool.find((node) => node.type === 'treasure');
  if (treasure) return treasure;
  const event = pool.find((node) => node.type === 'event');
  if (event) return event;
  if (boss) return boss;
  return pool[0] || available[0];
}

function pickAwakening(run, offer) {
  if (AWAKENING_MODE === 'first') return offer.options[0]?.id;
  const prefs = AWAKENING_PREFERENCE[run.originId] || [];
  const rank = (id) => {
    const index = prefs.indexOf(id);
    return index < 0 ? 99 : index;
  };
  return [...offer.options].sort((a, b) => rank(a.id) - rank(b.id))[0]?.id;
}

function simulate(originId, runs, ascension, strategy = 'pure') {
  const origin = ORIGIN_MAP[originId];
  const primary = R.preferredSchoolForOrigin(origin.id);
  let wins = 0;
  let deaths = 0;
  let floors = 0;
  let deckSizes = 0;
  let bossFights = 0;
  let bossTurns = 0;
  let chorusRuns = 0;
  let secondaryRuns = 0;
  let bossChorusRuns = 0;
  let bossChorusWins = 0;
  let bossSecondaryRuns = 0;
  let bossSecondaryWins = 0;
  const deathSpots = {};
  for (let i = 0; i < runs; i += 1) {
    const run = eng.startAdventure(origin.id, simRegion, { ascension });
    let guard = 0;
    let lost = false;
    while (guard++ < 40) {
      const node = chooseNode(run);
      if (!node) break;
      if (process.env.SIM_ROUTE_DEBUG) {
        console.log('route', origin.name, 'floor', run.floor, 'hp', `${run.hp}/${run.maxHp}`,
          'node', node.id, node.type, 'layer', node.layer, 'current', run.currentNodeId,
          'cleared', run.completed.length, 'loop', Boolean(mapProgress(run).looping));
      }
      if (mapProgress(run).looping && run.completed.includes(node.id) && node.type !== 'boss') {
        run.currentNodeId = node.id;
        run.pendingNodeId = null;
        continue;
      }
      if (node.type === 'camp') {
        eng.beginNode(run, node.id);
        visitCamp(run, primary, strategy);
        eng.completeNode(run, node.id);
        continue;
      }
      if (node.type === 'treasure') {
        const treasure = eng.createTreasure(run);
        eng.claimTreasure(run, treasure);
        eng.completeNode(run, node.id);
        continue;
      }
      if (node.type === 'event') {
        visitEvent(run);
        eng.completeNode(run, node.id);
        continue;
      }
      if (node.type === 'shop') {
        const shop = eng.createShop(run);
        shopVisit(run, shop, primary, strategy);
        eng.completeNode(run, node.id);
        continue;
      }
      if (!['battle', 'elite', 'boss'].includes(node.type)) {
        eng.completeNode(run, node.id);
        continue;
      }
      eng.beginNode(run, node.id);
      const preBoss = node.type === 'boss' ? eng.runResonance(run) : null;
      if (preBoss?.chorus?.active) bossChorusRuns += 1;
      if (preBoss?.secondary) bossSecondaryRuns += 1;
      const result = battleOnce(run, node);
      if (process.env.SIM_DEBUG) {
        console.log('debug', origin.name, node.type, result?.battle?.enemy?.name || 'none',
          'turns', result?.turns || 0,
          'hp', result?.battle ? `${result.battle.player.hp}/${result.battle.player.maxHp}` : '0',
          'deck', run.deck.length,
          'cards', run.deck.map((card) => card.defId).join(','),
          'res', JSON.stringify(eng.runResonance(run)),
          'mut', run.dreamMutations.map((m) => m.id).join(','));
      }
      if (!result) { lost = true; deathSpots[node.type] = (deathSpots[node.type] || 0) + 1; break; }
      if (result.battle.phase !== 'victory') { lost = true; deathSpots[node.type] = (deathSpots[node.type] || 0) + 1; break; }
      if (node.type === 'boss') {
        bossFights += 1;
        bossTurns += result.turns;
        if (preBoss?.chorus?.active) bossChorusWins += 1;
        if (preBoss?.secondary) bossSecondaryWins += 1;
      }
      const cardId = pickReward(run, result.battle, primary, strategy);
      eng.claimBattleReward(cardId);
      if (process.env.SIM_NO_AWAKENING !== '1') {
        const awakening = eng.awakeningOffer(run);
        if (awakening) {
          const awakeningId = pickAwakening(run, awakening);
          if (awakeningId) eng.chooseAwakening(run, awakeningId);
        }
      }
      if (node.type === 'boss') {
        const finalResonance = eng.runResonance(run);
        if (process.env.CHORUS_DEBUG && strategy === 'chorus') {
          console.log('debug', origin.name, JSON.stringify(finalResonance.counts), 'top', finalResonance.topShare?.toFixed(2), 'chorus', finalResonance.chorus.active, finalResonance.chorus.tier, 'deck', run.deck.map((c) => c.defId).join(','));
        }
        if (finalResonance?.chorus?.active) chorusRuns += 1;
        if (finalResonance?.secondary) secondaryRuns += 1;
        eng.finishAdventure();
        wins += 1;
        break;
      }
    }
    if (lost) deaths += 1;
    floors += run.floor || 0;
    deckSizes += run.deck?.length || 0;
  }
  return {
    origin: origin.name,
    wins,
    deaths,
    winRate: Math.round((wins / runs) * 100),
    floors: Math.round((floors / runs) * 10) / 10,
    deck: Math.round((deckSizes / runs) * 10) / 10,
    bossTurns: bossFights ? Math.round((bossTurns / bossFights) * 10) / 10 : 0,
    chorusRuns,
    secondaryRuns,
    bossChorusRuns,
    bossChorusWins,
    bossSecondaryRuns,
    bossSecondaryWins,
    deathSpots,
  };
}

const runs = Number(process.argv[2]) || 200;
const ascension = Number(process.argv[3]) || 0;
const STRATEGIES = new Set(['pure', 'hybrid', 'chorus']);
const strategy = STRATEGIES.has(process.argv[4]) ? process.argv[4] : 'pure';
const strategyName = { pure: '纯流派', hybrid: '双派', chorus: '混响' }[strategy];
const onlyOrigin = (process.env.ORIGIN || '').trim();
const regionName = L.REGION_MAP[simRegion]?.name || simRegion;
console.log(`=== ${regionName}整局模拟 · 层级 ${ascension} · ${strategyName}策略 · 每角色 ${runs} 局 ===`);
console.log(`  bot: 道具 ${USE_ITEMS ? '开' : '关'} · 交涉 ${USE_PARLEY ? '开' : '关'} · 营火 ${SMART_CAMP ? '升级/休整' : '仅休整'} · 事件 ${USE_EVENTS ? '开' : '关'} · 觉醒 ${AWAKENING_MODE === 'first' ? '首选项' : '流派优选'}`);
const before = { ...stats };
for (const origin of ORIGINS) {
  if (onlyOrigin && origin.id !== onlyOrigin) continue;
  const result = simulate(origin.id, runs, ascension, strategy);
  const used = {
    items: stats.items - before.items,
    parleys: stats.parleys - before.parleys,
    parleyWins: stats.parleyWins - before.parleyWins,
    upgrades: stats.upgrades - before.upgrades,
    purges: stats.purges - before.purges,
    relics: stats.relics - before.relics,
    events: stats.events - before.events,
  };
  before.items = stats.items; before.parleys = stats.parleys; before.parleyWins = stats.parleyWins;
  before.upgrades = stats.upgrades; before.purges = stats.purges; before.relics = stats.relics; before.events = stats.events;
  console.log(`  ${result.origin.padEnd(6)} 胜率 ${String(result.winRate + '%').padEnd(5)} 平均层数 ${String(result.floors).padEnd(5)} 牌组 ${String(result.deck).padEnd(5)} 首领回合 ${result.bossTurns} 混响 ${result.chorusRuns}/${result.bossChorusRuns}胜${result.bossChorusWins} 副派 ${result.secondaryRuns}/${result.bossSecondaryRuns}胜${result.bossSecondaryWins} 阵亡点 ${JSON.stringify(result.deathSpots)}`);
  console.log(`         道具 ${used.items} · 交涉 ${used.parleys}(${used.parleyWins}成) · 升级 ${used.upgrades} · 删牌 ${used.purges} · 遗物 ${used.relics} · 事件 ${used.events}`);
}
