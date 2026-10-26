import {
  AWAKENING_FLOORS,
  CARDS,
  CARD_MAP,
  ELITE_ENEMIES,
  ENEMY_LINEAGES,
  ENEMY_MAP,
  EVENTS,
  ITEM_MAP,
  ITEMS,
  MERCHANT_ITEM_MAP,
  MERCHANT_ITEMS,
  NON_REWARDABLE,
  NORMAL_ENEMIES,
  ORIGIN_AWAKENINGS,
  ORIGIN_MAP,
  PARLEY_APPROACHES,
  PERSONALITIES,
  RELIC_MAP,
  RELICS,
  SCHOOLS,
  STATUS_INFO,
  awakeningsFor,
  describeEffects,
  findAwakening,
} from './data.js';
import { FINAL_REGION_ID, NPCS, REGIONS, REGION_MAP } from './lore.js';
import { ascensionLevel, ascensionModifiers, ascensionUnlockAfter, MAX_ASCENSION } from './ascension.js';
import { mergeMutationMods, rollDreamMutations } from './mutations.js';
import { CONTRACT_MAP, MAX_CONTRACTS, contractDisplay, contractList, contractPrice, mergeContractRules, rollContractOffers } from './contracts.js';
import { dailyInfo } from './daily.js';
import {
  evaluateAchievements,
  recordBattleOutcome,
  recordLaugh,
  recordRunRelicCount,
  recordStealSuccess,
} from './achievements.js';
import {
  G,
  getCardDef,
  getEnemySkin,
  getHeroAvatar,
  getHeroName,
  pushRewardPop,
  recordCodexSeen,
  recordDailyWin,
  saveProfileNow,
  saveRunNow,
} from './state.js';
import {
  computeResonance,
  chainSchoolOf,
  preferredSchoolForOrigin,
  resonanceBonusFor,
  resonanceEffectText,
  SCHOOL_ORDER,
  tierLabel,
} from './resonance.js';
import { grantQuestCard, npcBond, pickDefeatStory, resolveWorldEnding } from './world-state.js';
import {
  clamp,
  clearRngSeed,
  pick,
  rand,
  randomInt,
  resolveCard,
  setRngSeed,
  cardScalingText,
  shuffle,
  uid,
} from './utils.js';

const REWARD_POOL = CARDS.filter((card) => !NON_REWARDABLE.has(card.id) && !card.questOnly);
const MAX_ITEMS = 10;

/**
 * 绝境反扑：一场战斗只问一次，不是免费复活。
 * 借来的格挡/抽牌/能量能救下这一回合，但生命上限会在梦结束时被剪掉一截；
 * 代价跟着整趟远征走，所以「要不要借」本身就是一个构筑决策。
 */
export const LAST_STAND = {
  hpRatio: 0.25,
  block: 8,
  draw: 2,
  energy: 2,
  scarHp: 5,
  maxScars: 12,
};

/**
 * 开场岛难度：折廊是第一段路，不能让一套起手两回合就带走普通敌人。
 * 只作用于折廊；其余岛屿保留自己的深度缩放，避免后段被二次加码。
 * 沙盒保留原始数值，无尽由 endlessScaling 自己负责。
 */
export const OPENING_DIFFICULTY = {
  enemyHpScale: 1.35,
  enemyDamageScale: 1.1,
};

/**
 * 梦压：你越接近自己的真名，梦就越认真地回应你。
 * 每条道途觉醒都会让首领活得更久、打得更重、真形更早浮出水面。
 * 它只压在首领身上，不碰普通战斗，也不改变岛屿本身的深度缩放；
 * 目的是让觉醒后的爆发仍然需要格挡、虚弱和回合规划去兑现。
 */
export const AWAKENING_PRESSURE = {
  bossDamagePerTier: 0.12,
  bossHpPerTier: 0.12,
  bossStrengthPerTier: 1,
  phase2EarlyPerTier: 0.05,
  minPhase2At: 0.32,
};
const ITEM_RARITY_WEIGHT = { common: 0.56, uncommon: 0.32, rare: 0.12 };
const MERCHANT_BAG_SIZE = 14;

function addLog(battle, text, type = 'info') {
  battle.log.push({ text, type, turn: battle.turn });
  if (battle.log.length > 36) battle.log.shift();
}

function relicSum(relics, effect) {
  return (relics || []).reduce((sum, id) => {
    const relic = RELIC_MAP[typeof id === 'string' ? id : id?.id];
    return relic?.effect === effect ? sum + (Number(relic.value) || 0) : sum;
  }, 0);
}

export function runAwakeningMods(run = G.run) {
  const mods = {};
  const list = Array.isArray(run?.originAwakening) ? run.originAwakening : [];
  for (const id of list) {
    const awakening = findAwakening(id);
    if (!awakening?.mods) continue;
    for (const [key, value] of Object.entries(awakening.mods)) {
      mods[key] = (mods[key] || 0) + (Number(value) || 0);
    }
  }
  return mods;
}

export function runAwakenings(run = G.run) {
  const list = Array.isArray(run?.originAwakening) ? run.originAwakening : [];
  return list.map((id) => findAwakening(id)).filter(Boolean);
}

function makeOriginState(origin, run, mods = {}) {
  const mechanic = origin?.mechanic;
  if (!mechanic) return null;
  const baseMax = Math.max(2, Number(mechanic.max) || 3);
  const max = Math.max(2, baseMax + (Number(mods.thresholdDelta) || 0));
  return {
    id: mechanic.id,
    name: mechanic.name,
    glyph: mechanic.glyph,
    short: mechanic.short,
    desc: mechanic.desc,
    value: 0,
    max,
    mods,
    triggered: 0,
  };
}

export function awakeningOffer(run = G.run) {
  if (!run || run.mode !== 'adventure') return null;
  const originId = run.originId || 'blade';
  const claimed = Math.max(0, Number(run.originAwakeningTier) || 0);
  const nextTier = claimed + 1;
  if (nextTier > AWAKENING_FLOORS.length) return null;
  if ((Number(run.floor) || 0) < AWAKENING_FLOORS[nextTier - 1]) return null;
  const options = awakeningsFor(originId, nextTier);
  if (!options.length) return null;
  return { tier: nextTier, floor: AWAKENING_FLOORS[nextTier - 1], options, originId };
}

export function chooseAwakening(run, awakeningId) {
  const offer = awakeningOffer(run);
  if (!offer) return { ok: false, message: '现在还不是觉醒的时候。' };
  const awakening = offer.options.find((item) => item.id === awakeningId);
  if (!awakening) return { ok: false, message: '这条道途不通往那个方向。' };
  if (!Array.isArray(run.originAwakening)) run.originAwakening = [];
  if (!run.originAwakening.includes(awakening.id)) run.originAwakening.push(awakening.id);
  run.originAwakeningTier = offer.tier;
  return { ok: true, awakening, tier: offer.tier };
}

function grantOriginTrigger(battle, fx) {
  const origin = battle.origin;
  if (!origin) return;
  const mods = origin.mods || {};
  const lines = [];
  origin.triggered = (Number(origin.triggered) || 0) + 1;
  while (origin.value >= origin.max) origin.value -= origin.max;
  if (origin.id === 'combo') {
    addStatus(battle.player, 'strength', 1);
    // 连斩是「用攻势换喘息」：每一次连斩顺势架住一下。
    // 没有这点格挡，剑客在后期首领面前就是一门玻璃炮——
    // 实测纯数值难度下，他是唯一一个会从 70% 直接掉到 20% 的角色。
    battle.player.block += 4;
    fx.push({ target: 'player', kind: 'block', amount: 4 });
    fx.push({ target: 'player', kind: 'status', status: 'strength', amount: 1 });
    lines.push('力量 +1、格挡 +4');
  } else if (origin.id === 'starTrack') {
    battle.player.energy = Math.min(10, battle.player.energy + 1);
    addStatus(battle.player, 'dexterity', 1);
    // 星轨也要能进攻，但不能滚雪球：
    // 试过「每次 +2 力量」，两回合就把术士从 27% 顶到 100%——
    // 星轨每回合能触发两次，永久力量等于指数增长。
    // 改成固定 3 点无视格挡的星屑，收益稳定、不随回合放大。
    const chip = 5 + (Number(mods.starChip) || 0);
    const before = battle.enemy.hp;
    battle.enemy.hp = Math.max(0, before - chip);
    const lost = before - battle.enemy.hp;
    battle.stats.damageDealt += lost;
    fx.push({ target: 'player', kind: 'energy', amount: 1 });
    fx.push({ target: 'player', kind: 'status', status: 'dexterity', amount: 1 });
    fx.push({ target: 'enemy', kind: 'damage', amount: chip, hpLoss: lost, ignoreBlock: true });
    lines.push(`能量 +1、敏捷 +1、星屑 ${chip} 点`);
    if (battle.enemy.hp <= 0) { winBattle(battle); return; }
  } else if (origin.id === 'bloom') {
    const poison = battle.enemy.statuses.poison || 0;
    const multiplier = Math.max(1.6, 1.6 + (Number(mods.burstMultiplier) || 0));
    const damage = Math.round(poison * multiplier);
    if (damage > 0) {
      const before = battle.enemy.hp;
      battle.enemy.hp = Math.max(0, battle.enemy.hp - damage);
      const loss = before - battle.enemy.hp;
      battle.stats.damageDealt += loss;
      fx.push({ target: 'enemy', kind: 'damage', amount: damage, hpLoss: loss, ignoreBlock: true });
    }
    // 引爆会把中毒一并烧尽，只留下 1 层余毒——否则「毒层×2」会在每次
    // 施加中毒时连锁引爆，一张大毒牌就能打出三四次成倍伤害。
    battle.enemy.statuses.poison = 0;
    origin.value = 0;
    const extra = 1 + (Number(mods.burstPoison) || 0);
    addStatus(battle.enemy, 'poison', extra);
    fx.push({ target: 'enemy', kind: 'status', status: 'poison', amount: extra });
    lines.push(`引爆中毒 ×${multiplier}${damage > 0 ? `（${damage} 点）` : ''}，清空余毒并再施加 ${extra} 层`);
  } else if (origin.id === 'heat') {
    addStatus(battle.player, 'strength', 2);
    fx.push({ target: 'player', kind: 'status', status: 'strength', amount: 2 });
    lines.push('力量 +2');
  } else if (origin.id === 'laugh') {
    const drawn = drawCards(battle, 1 + (Number(mods.laughDraw) || 0), false);
    if (drawn > 0) {
      fx.push({ target: 'player', kind: 'draw', amount: drawn });
      lines.push(`抽 ${drawn} 张牌`);
    }
    const damage = 3 + (Number(mods.laughDamage) || 0);
    const before = battle.enemy.hp;
    battle.enemy.hp = Math.max(0, before - damage);
    const lost = before - battle.enemy.hp;
    battle.stats.damageDealt += lost;
    fx.push({ target: 'enemy', kind: 'damage', amount: damage, hpLoss: lost, ignoreBlock: true });
    battle.player.block += 3;
    fx.push({ target: 'player', kind: 'block', amount: 3 });
    lines.push(`狂笑 ${damage} 点（无视格挡）、格挡 +3`);
    recordLaugh();
  }
  const draw = Number(mods.triggerDraw) || 0;
  if (draw > 0) {
    const drawn = drawCards(battle, draw, false);
    if (drawn > 0) {
      fx.push({ target: 'player', kind: 'draw', amount: drawn });
      lines.push(`抽 ${drawn} 张牌`);
    }
  }
  const block = Number(mods.triggerBlock) || 0;
  if (block > 0) {
    battle.player.block += block;
    fx.push({ target: 'player', kind: 'block', amount: block });
    lines.push(`格挡 +${block}`);
  }
  const energy = Number(mods.triggerEnergy) || 0;
  if (energy > 0) {
    battle.player.energy = Math.min(10, battle.player.energy + energy);
    fx.push({ target: 'player', kind: 'energy', amount: energy });
    lines.push(`能量 +${energy}`);
  }
  const strength = Number(mods.triggerStrength) || 0;
  if (strength > 0) {
    addStatus(battle.player, 'strength', strength);
    fx.push({ target: 'player', kind: 'status', status: 'strength', amount: strength });
    lines.push(`力量 +${strength}`);
  }
  const dexterity = Number(mods.triggerDex) || 0;
  if (dexterity > 0) {
    addStatus(battle.player, 'dexterity', dexterity);
    fx.push({ target: 'player', kind: 'status', status: 'dexterity', amount: dexterity });
    lines.push(`敏捷 +${dexterity}`);
  }
  const heal = Number(mods.triggerHeal) || 0;
  if (heal > 0) {
    const before = battle.player.hp;
    battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + heal);
    const healed = battle.player.hp - before;
    if (healed > 0) {
      fx.push({ target: 'player', kind: 'heal', amount: healed });
      lines.push(`回复 ${healed} 生命`);
    }
  }
  const burn = Number(mods.triggerBurn) || 0;
  if (burn > 0) {
    addStatus(battle.enemy, 'burn', burn);
    fx.push({ target: 'enemy', kind: 'status', status: 'burn', amount: burn });
    lines.push(`${battle.enemy.name} +${burn} 层灼烧`);
  }
  const vulnerable = Number(mods.triggerVulnerable) || 0;
  if (vulnerable > 0) {
    addStatus(battle.enemy, 'vulnerable', vulnerable);
    fx.push({ target: 'enemy', kind: 'status', status: 'vulnerable', amount: vulnerable });
    lines.push(`${battle.enemy.name} +${vulnerable} 层易伤`);
  }
  addLog(battle, `${origin.name}达成：${lines.join('；') || '道途向前推进了一格'}。`, 'mechanic');
  fx.push({
    target: 'player',
    kind: 'origin',
    origin: origin.id,
    name: origin.name,
    glyph: origin.glyph,
    triggered: origin.triggered,
  });
  if (battle.enemy.hp <= 0) {
    winBattle(battle);
  } else {
    maybeEnterBossPhase(battle, fx);
  }
}

function addOriginProgress(battle, amount, fx, kind = null) {
  const origin = battle.origin;
  if (!origin || amount <= 0) return;
  if (kind && origin.id !== kind) return;
  if (battle.phase !== 'player' && battle.phase !== 'enemy') return;
  origin.value = (Number(origin.value) || 0) + amount;
  if (battle.phase === 'player') flushOriginTriggers(battle, fx);
}

function flushOriginTriggers(battle, fx) {
  const origin = battle.origin;
  if (!origin || battle.phase !== 'player') return;
  let guard = 0;
  while (origin.value >= origin.max && guard < 4) {
    guard += 1;
    grantOriginTrigger(battle, fx);
    if (battle.phase !== 'player' || battle.enemy.hp <= 0) break;
  }
}

const MAP_NODE_TYPES = ['battle', 'elite', 'event', 'camp', 'shop', 'treasure'];
const MAP_LAYER_WIDTH = 3;
const BASE_LAYOUT = { battle: 4, elite: 1, event: 2, camp: 1, shop: 1, treasure: 1 };

function regionLayout(regionId) {
  const weights = { ...BASE_LAYOUT, ...(REGION_MAP[regionId]?.layout || {}) };
  let total = 0;
  for (const type of MAP_NODE_TYPES) {
    const value = Number(weights[type]);
    weights[type] = Number.isFinite(value) && value > 0 ? value : 0;
    total += weights[type];
  }
  if (!total) weights.battle = 1;
  return weights;
}

function rollNodeType(weights) {
  let total = 0;
  for (const type of MAP_NODE_TYPES) total += weights[type];
  let roll = rand() * total;
  for (const type of MAP_NODE_TYPES) {
    roll -= weights[type];
    if (roll < 0) return type;
  }
  return 'battle';
}

/**
 * 每种地形摆位置的方式都不一样。返回 {x, y}（百分比），screen-map 直接用。
 * 这里只负责「画在哪」，连通性由各自的 build 函数决定。
 */
function shapePosition(shape, node, layer, width, layerCount) {
  const span = Math.max(1, layerCount - 1);
  const t = layer / span;                       // 0 → 1，从入口到首领
  const lane = width <= 1 ? 0.5 : node.col / (width - 1);
  switch (shape) {
    case 'climb':
      // 窄廊：一路偏折，像折起来的纸
      return { x: 50 + Math.sin(layer * 1.15) * 20, y: 90 - t * 80 };
    case 'fog':
      return { x: 22 + lane * 56, y: 90 - t * 80 };
    case 'ring': {
      // 环形：绕王座一圈，最后一层回到中间
      if (layer === layerCount - 1) return { x: 50, y: 50 };
      const angle = -Math.PI / 2 + (layer / Math.max(1, layerCount - 2)) * Math.PI * 2;
      const radius = 30;
      return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius * 0.86 };
    }
    case 'mirror': {
      // 左右镜像：三列时必须对称（0.5 走中间，两侧成对）
      const mirrored = width === 3 ? [26, 50, 74][node.col] : 22 + lane * 56;
      return { x: mirrored, y: 90 - t * 80 };
    }
    case 'burn':
      return { x: 50 + Math.sin(layer * 0.8) * 26, y: 90 - t * 80 };
    case 'clock': {
      // 钟面：12 个刻度绕一圈，三点十七分的位置稍偏
      const ticks = Math.max(8, layerCount - 1);
      const angle = -Math.PI / 2 + (layer / ticks) * Math.PI * 2;
      return { x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 32 };
    }
    case 'page':
      return { x: 24 + lane * 52, y: 90 - t * 80 };
    case 'heart':
      // 三条支流从下方左右中涌向中心
      return { x: 50 + Math.sin(t * Math.PI * 0.9) * (node.col - (width - 1) / 2) * 26, y: 90 - t * 78 };
    default:
      return { x: 20 + lane * 60, y: 90 - t * 80 };
  }
}

function buildClimb(layers, weights) {
  // 折廊：整座岛只有一条道，连岔路都没有
  for (let layer = 0; layer < layers.length; layer += 1) {
    layers[layer].push({ id: `n-${layer}-0`, layer, col: 0, type: rollNodeType(weights), next: [] });
  }
  return linksByProximity(layers);
}

function buildFog(layers, weights) {
  for (let layer = 0; layer < layers.length; layer += 1) {
    const width = layer === 0 ? 1 : MAP_LAYER_WIDTH;
    for (let col = 0; col < width; col += 1) {
      layers[layer].push({ id: `n-${layer}-${col}`, layer, col, type: rollNodeType(weights), next: [] });
    }
  }
  return linksByProximity(layers);
}

function buildMirror(layers, weights) {
  for (let layer = 0; layer < layers.length; layer += 1) {
    if (layer === 0) {
      layers[layer].push({ id: `n-${layer}-0`, layer, col: 1, type: 'battle', next: [] });
      continue;
    }
    // 中间一个 + 左右镜像一对（同类型）
    const midType = rollNodeType(weights);
    layers[layer].push({ id: `n-${layer}-1`, layer, col: 1, type: midType, next: [] });
    const pairType = rollNodeType(weights);
    layers[layer].push({ id: `n-${layer}-0`, layer, col: 0, type: pairType, next: [] });
    layers[layer].push({ id: `n-${layer}-2`, layer, col: 2, type: pairType, next: [] });
  }
  return linksByProximity(layers);
}

function buildPage(layers, weights) {
  // 一页三层，每页之间只有一格接通（翻页的「书脊」）
  for (let layer = 0; layer < layers.length; layer += 1) {
    for (let col = 0; col < MAP_LAYER_WIDTH; col += 1) {
      layers[layer].push({ id: `n-${layer}-${col}`, layer, col, type: rollNodeType(weights), next: [] });
    }
  }
  return linksByProximity(layers);
}

function buildHeart(layers, weights) {
  // 三条支流：左/中/右各一路，互不相通，最后一起汇进中心
  for (let layer = 0; layer < layers.length; layer += 1) {
    for (let col = 0; col < MAP_LAYER_WIDTH; col += 1) {
      layers[layer].push({ id: `n-${layer}-${col}`, layer, col, type: rollNodeType(weights), next: [] });
    }
  }
  // 每条支流只连自己那一路，不横向串门
  for (let i = 0; i < layers.length - 1; i += 1) {
    for (const node of layers[i]) {
      const target = layers[i + 1].find((t) => t.col === node.col) || layers[i + 1][1];
      node.next.push(target.id);
    }
  }
  return layers;
}

function linksByProximity(layers) {
  for (let i = 0; i < layers.length - 1; i += 1) {
    const next = layers[i + 1];
    for (const node of layers[i]) {
      if (next.length === 1) { node.next.push(next[0].id); continue; }
      const options = next.filter((t) => Math.abs(t.col - node.col) <= 1).map((t) => t.id);
      node.next.push(...(options.length ? options : [next[0].id]));
    }
  }
  return layers;
}

function ensureNodeType(layers, type) {
  if (layers.some((layer) => layer.some((node) => node.type === type))) return;
  // 首领层不能被改型：曾经在没有普通战斗节点的地图上，
  // 兜底池把 Boss 改成营地/商店，整局直接失去出口。
  const pool = layers.flat().filter((node) => node.layer > 0 && node.type === 'battle');
  const fallback = layers.flat().filter((node) => node.layer > 0 && node.type !== 'boss');
  const target = pool.length ? pick(pool) : (fallback.length ? pick(fallback) : null);
  if (target) target.type = type;
}

export function makeMap(regionId = null) {
  const region = REGION_MAP[regionId];
  const shape = region?.shape || 'climb';
  const weights = regionLayout(regionId);
  const layerCount = shape === 'heart'
    ? randomInt(7, 8)
    : shape === 'climb'
      ? randomInt(6, 7)
      : shape === 'burn'
        ? randomInt(6, 7)
        : randomInt(6, 8);
  const layers = Array.from({ length: layerCount }, () => []);

  if (shape === 'ring' || shape === 'clock') {
    // 环形地形：先铺一圈，再把中心放成首领
    for (let layer = 0; layer < layerCount; layer += 1) {
      layers[layer].push({ id: `n-${layer}-0`, layer, col: 0, type: rollNodeType(weights), next: [] });
    }
  } else if (shape === 'mirror') {
    buildMirror(layers, weights);
  } else if (shape === 'page') {
    buildPage(layers, weights);
  } else if (shape === 'fog') {
    buildFog(layers, weights);
  } else if (shape === 'burn') {
    // 单向：每层只有一格，没有选择
    for (let layer = 0; layer < layerCount; layer += 1) {
      layers[layer].push({ id: `n-${layer}-0`, layer, col: 0, type: rollNodeType(weights), next: [] });
    }
  } else if (shape === 'heart') {
    buildHeart(layers, weights);
  } else {
    buildClimb(layers, weights);
  }

  // 首领层永远只有一格
  const bossLayer = layers.length;
  layers.push([{ id: `n-${bossLayer}-0`, layer: bossLayer, col: shape === 'ring' || shape === 'clock' ? 0 : 1, type: 'boss', next: [] }]);

  // ---- 连通 ----
  if (shape === 'ring') {
    // 环：每格接上前后两格（首尾相接），且每一格都能直接推门进王座
    const ring = layers.slice(0, bossLayer);
    ring.forEach((layerNodes, index) => {
      const node = layerNodes[0];
      const prev = ring[(index - 1 + ring.length) % ring.length][0];
      const next = ring[(index + 1) % ring.length][0];
      node.next.push(next.id, prev.id, layers[bossLayer][0].id);
    });
  } else if (shape === 'clock') {
    // 钟面：顺时针 / 逆时针都能走，绕满一圈才敲钟
    const ring = layers.slice(0, bossLayer);
    ring.forEach((layerNodes, index) => {
      const node = layerNodes[0];
      const next = ring[(index + 1) % ring.length][0];
      const prev = ring[(index - 1 + ring.length) % ring.length][0];
      node.next.push(next.id, prev.id);
      // 走过半圈以上才允许直接敲钟（三点十七分的门）
      if (index >= Math.floor(ring.length * 0.6)) node.next.push(layers[bossLayer][0].id);
    });
  } else if (shape === 'heart') {
    // 三条支流各自汇进中心
    for (const node of layers[bossLayer - 1]) node.next.push(layers[bossLayer][0].id);
  } else {
    linksByProximity(layers);
  }

  // 保底：每局至少能休整、购物、遇精英
  ensureNodeType(layers, 'camp');
  ensureNodeType(layers, 'shop');
  ensureNodeType(layers, 'elite');

  // 把位置信息挂上去，渲染层不用再猜
  const widthOf = (layer) => Math.max(...layer.map((n) => n.col)) + 1 || 1;
  layers.forEach((layerNodes, layer) => {
    const singleLane = shape === 'ring' || shape === 'clock' || shape === 'burn' || shape === 'climb';
    const width = singleLane ? 1 : widthOf(layerNodes);
    for (const node of layerNodes) {
      node.pos = shapePosition(shape, node, layer, width, layers.length);
      node.shape = shape;
    }
  });

  return layers;
}

export function getNode(run, nodeId) {
  return run?.map?.flat().find((node) => node.id === nodeId) || null;
}

export function getAvailableNodes(run) {
  if (!run) return [];
  if (!run.currentNodeId) return run.map[0] || [];
  const current = getNode(run, run.currentNodeId);
  if (!current) return [];
  const region = REGION_MAP[run.regionId];
  const looping = region?.shape === 'ring' || region?.shape === 'clock';
  return current.next
    .map((id) => getNode(run, id))
    .filter(Boolean)
    // 环形/钟面允许重访旧节点（绕圈），其他地形走过就不再回头
    .filter((node) => looping || !run.completed.includes(node.id));
}

export function beginNode(run, nodeId) {
  const available = getAvailableNodes(run);
  if (!available.some((node) => node.id === nodeId)) return null;
  const node = getNode(run, nodeId);
  if (!node) return null;
  run.pendingNodeId = nodeId;
  return node;
}

export function completeNode(run, nodeId) {
  if (!run || !nodeId) return;
  if (!run.completed.includes(nodeId)) {
    run.completed.push(nodeId);
    run.currentNodeId = nodeId;
    run.pendingNodeId = null;
    run.floor = (run.floor || 0) + 1;
  }
}

const ENDLESS_REGIONS = REGIONS.filter((region) => region.clearStory);

const ENDLESS_AFFIXES = [
  { id: 'ironDream', name: '铁梦', desc: '敌人生命额外 +20%', mods: { enemyHpScale: 1.2 } },
  { id: 'sharpClaw', name: '厉爪', desc: '敌人攻击 +2', mods: { enemyBonusDamage: 2 } },
  { id: 'firstCry', name: '先声', desc: '敌人开局 +1 力量', mods: { enemyStartStrength: 1 } },
  { id: 'stoneSkin', name: '石肤', desc: '敌人开局 12 点格挡', mods: { enemyStartBlock: 12 } },
  { id: 'thornHide', name: '棘皮', desc: '敌人开局 +1 层荆棘', mods: { enemyStartThorns: 1 } },
];

/** 无尽模式：层数越高，敌人越硬、词缀越多。 */
export function endlessScaling(depth = 1) {
  const level = Math.max(1, Math.floor(Number(depth) || 1));
  const mods = {
    enemyHpScale: 1 + 0.16 * (level - 1),
    enemyBonusDamage: Math.floor((level - 1) / 2),
  };
  const affixes = [];
  const count = Math.min(3, Math.floor((level - 1) / 2));
  const pool = [...ENDLESS_AFFIXES];
  for (let i = 0; i < count && pool.length; i += 1) {
    const index = (level * 7 + i * 13) % pool.length;
    const [affix] = pool.splice(index, 1);
    affixes.push(affix);
    Object.assign(mods, affix.mods);
  }
  return { level, mods, affixes };
}

function applyEndlessDepth(run) {
  const region = ENDLESS_REGIONS[(run.depth - 1) % ENDLESS_REGIONS.length];
  const { mods, affixes } = endlessScaling(run.depth);
  run.regionId = region.id;
  run.regionName = region.name;
  run.bossId = region.bossId;
  run.map = makeMap(region.id);
  run.currentNodeId = null;
  run.pendingNodeId = null;
  run.completed = [];
  run.floor = 0;
  run.endlessModifiers = mods;
  run.endlessAffixes = affixes.map((entry) => ({ id: entry.id, name: entry.name, desc: entry.desc }));
  // 每沉一层，梦就换一种说法：同一套牌面对的是新的两条变奏。
  run.dreamMutations = rollDreamMutations(run.seed, `endless-${run.depth}`);
  run.mutationMods = mergeMutationMods(run.dreamMutations);
  return run;
}

/** 独立于主线的无尽回廊：不写剧情、不动群岛进度。 */
export function startEndless(originId) {
  const origin = ORIGIN_MAP[originId] || ORIGIN_MAP.blade;
  const firstRegion = ENDLESS_REGIONS[0] || REGIONS[0];
  const run = startAdventure(origin.id, firstRegion.id, { ascension: 0 });
  run.endless = true;
  run.depth = 1;
  run.endlessCleared = 0;
  run.gold = 40;
  G.profile.endlessRuns = (Number(G.profile.endlessRuns) || 0) + 1;
  applyEndlessDepth(run);
  saveRunNow();
  return run;
}

export function endlessInfo() {
  return {
    best: Number(G.profile.endlessBest) || 0,
    runs: Number(G.profile.endlessRuns) || 0,
  };
}

export function startAdventure(originId, regionId = null, options = {}) {
  const origin = ORIGIN_MAP[originId] || ORIGIN_MAP.blade;
  const world = G.profile.world;
  const requested = REGION_MAP[regionId] || REGION_MAP[G.ui.regionChoice] || REGION_MAP[world.lastRegion] || REGIONS[0];
  const region = world.unlockedRegions.includes(requested.id) ? requested : REGIONS[0];
  const ascension = clamp(
    Math.floor(Number(options.ascension ?? G.ui.ascensionChoice) || 0),
    0,
    Number(G.profile.ascensionUnlocked) || 0,
  );
  const seed = String(options.seed || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  setRngSeed(seed);
  const dreamMutations = rollDreamMutations(seed, `region-${region.id}`);
  G.profile.originId = origin.id;
  G.profile.stats.runs += 1;
  world.stats = world.stats || {};
  world.stats.runs = (Number(world.stats.runs) || 0) + 1;
  world.lastRegion = region.id;
  G.ui.regionChoice = region.id;
  const deck = origin.starter.map((defId) => ({ defId, upgraded: false }));
  const trophy = world.trophyCard && CARD_MAP[world.trophyCard] ? world.trophyCard : null;
  if (trophy) deck.push({ defId: trophy, upgraded: false });
  saveProfileNow();
  G.run = {
    id: uid('run'),
    seed,
    mode: 'adventure',
    originId: origin.id,
    regionId: region.id,
    regionName: region.name,
    bossId: region.bossId,
    ascension,
    ascensionModifiers: ascensionModifiers(ascension),
    modifiers: { ...(region.modifiers || {}) },
    dreamMutations,
    mutationMods: mergeMutationMods(dreamMutations),
    contracts: [],
    contractMods: {},
    scars: [],
    heroName: getHeroName(),
    heroAvatar: getHeroAvatar(origin.id),
    attributes: { ...(origin.attributes || {}) },
    interludeSeen: [],
    interludeFloors: [],
    storyFlags: {},
    originAwakening: [],
    originAwakeningTier: 0,
    maxHp: origin.hp,
    hp: origin.hp,
    gold: 60,
    deck,
    items: ['dewPotion', 'thunderStone'],
    trophyCard: trophy,
    relics: [],
    eventsSeen: [],
    map: makeMap(region.id),
    currentNodeId: null,
    pendingNodeId: null,
    completed: [],
    floor: 0,
    startedAt: Date.now(),
    status: 'active',
    battle: null,
    totals: { cardsPlayed: 0, damageDealt: 0, enemiesFelled: 0 },
  };
  G.sandboxBattle = null;
  G.ui.modal = null;
  G.ui.reward = null;
  G.screen = 'map';
  return G.run;
}

/** 当前这趟梦能看见的三份契约；同一岛屿/层数永远给出同样的报价。 */
export function contractOffersForRun(run = G.run) {
  if (!run) return [];
  const salt = run.endless ? `endless-${Number(run.depth) || 1}` : `region-${run.regionId}`;
  return rollContractOffers(run.seed, salt, 3);
}

/** 用梦的碎片签下一份契约。契约只影响当前这趟梦。 */
export function signDreamContract(run, contractId) {
  if (!run) return { ok: false, message: '现在没有正在进行的梦。' };
  const contract = CONTRACT_MAP[contractId];
  if (!contract) return { ok: false, message: '这份契约已经散在雾里。' };
  const active = Array.isArray(run.contracts) ? run.contracts : [];
  if (active.includes(contractId)) return { ok: false, message: '这份契约已经签过了。' };
  if (active.length >= MAX_CONTRACTS) {
    return { ok: false, message: `一趟梦只能容下 ${MAX_CONTRACTS} 份契约。先撕毁一份，再签新的。` };
  }
  const price = contractPrice(active.length);
  const shards = Number(G.profile.shards) || 0;
  if (shards < price) return { ok: false, message: `碎片不够：这份契约要 ${price} 片，你只有 ${shards} 片。` };
  G.profile.shards = shards - price;
  run.contracts = [...active, contractId];
  run.contractMods = mergeContractRules(run.contracts);
  saveProfileNow();
  saveRunNow();
  return { ok: true, contract: contractDisplay(contractId), price };
}

/** 撕毁契约：规则立刻失效，碎片不退还。 */
export function breakDreamContract(run, contractId) {
  if (!run) return { ok: false, message: '现在没有正在进行的梦。' };
  const active = Array.isArray(run.contracts) ? run.contracts : [];
  if (!active.includes(contractId)) return { ok: false, message: '你没有签过这份契约。' };
  const contract = contractDisplay(contractId);
  run.contracts = active.filter((id) => id !== contractId);
  run.contractMods = mergeContractRules(run.contracts);
  saveRunNow();
  return { ok: true, contract };
}

function rewardPoolFor(originId) {
  const unlocked = new Set(Array.isArray(G.profile?.shardUnlocks) ? G.profile.shardUnlocks : []);
  return REWARD_POOL.filter((card) => {
    if (card.originOnly && card.originOnly !== originId) return false;
    // 被梦锁住的稀有牌：用碎片解开心结之后，它们才会出现在奖励与商店里。
    if (card.shardLock && !unlocked.has(card.id)) return false;
    return true;
  });
}

/**
 * 奖励倾向：纯流派给两张主派牌；牌组里一旦出现支线，就改成「主派一张 + 支线一张」。
 * 这样纯流派不会被硬塞杂牌，而混搭玩家能靠奖励把支线补到 4 张，真正点亮副共鸣或混响。
 * 混响亮起后，优先补参与混响、张数最少的两派，把三条支线拉平。
 */
function rewardSchoolOptions(resonance) {
  const counts = resonance?.counts || {};
  if (resonance?.chorus?.active) {
    const schools = [...resonance.chorus.schools]
      .sort((a, b) => (Number(counts[a]) || 0) - (Number(counts[b]) || 0))
      .slice(0, 2);
    return { guaranteeSchools: schools };
  }
  if (resonance?.primary) {
    const primary = resonance.primary;
    const started = SCHOOL_ORDER
      .filter((school) => school !== primary && (Number(counts[school]) || 0) > 0)
      .sort((a, b) => (Number(counts[b]) || 0) - (Number(counts[a]) || 0));
    // 玩家已经在两条支线上各放了一张：奖励改为同时递上这两派，
    // 让「铺三条支线」在折廊这种短牌组里也能真正走完。
    if (started.length >= 2 && (Number(counts[started[1]]) || 0) < 2 && (Number(resonance.topShare) || 1) < 0.65) {
      return { guaranteeSchools: [started[0], started[1]] };
    }
    const splash = [...started]
      .sort((a, b) => {
        const countA = Number(counts[a]) || 0;
        const countB = Number(counts[b]) || 0;
        const leaningA = countA >= 2 ? 0 : 1;
        const leaningB = countB >= 2 ? 0 : 1;
        if (leaningA !== leaningB) return leaningA - leaningB;
        return countA - countB;
      })[0];
    if (!splash) {
      return { guaranteeSchools: [primary, primary], crossSchool: true, excludeSchool: primary };
    }
    const alt = SCHOOL_ORDER
      .filter((school) => school !== primary && school !== splash && (Number(counts[school]) || 0) < 4)
      .sort((a, b) => (Number(counts[a]) || 0) - (Number(counts[b]) || 0))[0];
    return {
      guaranteeSchools: alt ? [primary, splash, alt] : [primary, splash],
      splashAlt: alt || null,
    };
  }
  return {};
}

function pickCardRewards(count = 3, forcedRarity = null, options = {}) {
  const originId = options.originId !== undefined ? options.originId : (G.run?.originId || null);
  const pool = rewardPoolFor(originId);
  const exclusives = pool.filter((card) => card.originOnly);
  const picked = [];
  const guaranteeSchools = Array.isArray(options.guaranteeSchools)
    ? options.guaranteeSchools.filter(Boolean)
    : [];
  for (const school of guaranteeSchools.slice(0, count)) {
    if (picked.length >= count) break;
    let candidates = pool.filter((card) => card.school === school && !picked.includes(card.id) && !card.originOnly);
    if (!candidates.length) continue;
    if (forcedRarity) {
      const rated = candidates.filter((card) => card.rarity === forcedRarity);
      if (rated.length) candidates = rated;
    }
    picked.push(pick(candidates).id);
  }
  if (exclusives.length && picked.length < count && !forcedRarity && rand() < 0.4) {
    picked.push(pick(exclusives).id);
  }

  let crossFilled = false;
  for (let index = picked.length; index < count; index += 1) {
    let rarity = forcedRarity;
    if (!rarity) {
      const roll = rand();
      rarity = roll < 0.62 ? 'common' : roll < 0.9 ? 'uncommon' : 'rare';
    }
    let candidates = pool.filter((card) => card.rarity === rarity && !picked.includes(card.id) && !card.originOnly);
    if (!candidates.length) {
      candidates = pool.filter((card) => !picked.includes(card.id));
    }
    if (options.crossSchool && !crossFilled && candidates.length) {
      const cross = candidates.filter((card) => card.school && card.school !== options.excludeSchool);
      if (cross.length) candidates = cross;
      crossFilled = true;
    }
    if (!candidates.length) break;
    picked.push(pick(candidates).id);
  }
  return picked;
}

const HOOK_RULES = {
  blade: (card) => card.type === 'attack',
  arcanist: (card) => card.type === 'skill',
  wraith: (card) => (card.effects || []).some((effect) => effect.status === 'poison'),
  pyre: (card) => (card.effects || []).some((effect) => effect.status === 'burn'),
  milkfrog: (card) => Number(card.cost) === 0 || (card.effects || []).some((effect) => effect.type === 'draw'),
};

/** 第一场胜利必给的一张「接得上起手」的牌。 */
function pickHookCard(run) {
  const rule = HOOK_RULES[run?.originId];
  if (!rule) return null;
  const pool = rewardPoolFor(run.originId).filter((card) => card.rarity !== 'basic' && rule(card));
  if (!pool.length) return null;
  const fresh = pool.filter((card) => !run.deck.some((entry) => entry.defId === card.id));
  return pick(fresh.length ? fresh : pool).id;
}

export function randomRewardCard(forcedRarity = null) {
  return pickCardRewards(1, forcedRarity)[0] || null;
}

export function pickRelicId(run) {
  const available = RELICS.filter((relic) => !run.relics.includes(relic.id));
  return available.length ? pick(available).id : null;
}

export function acquireRelic(run, relicId) {
  if (!run || !relicId || run.relics.includes(relicId)) return null;
  const relic = RELIC_MAP[relicId];
  if (!relic) return null;
  run.relics.push(relicId);
  recordCodexSeen('relic', relicId);
  if (relic.effect === 'maxHp') {
    run.maxHp += relic.value;
    run.hp = Math.min(run.maxHp, run.hp + relic.value);
  }
  run.unlockedAchievements = recordRunRelicCount(run.relics.length);
  return relic;
}

function normalizeDeckEntries(entries) {
  return entries.map((entry) => ({
    defId: entry.defId || entry,
    upgraded: Boolean(entry.upgraded),
  }));
}

export function runResonance(run) {
  if (!run) return null;
  return computeResonance(normalizeDeckEntries(run.deck || []), preferredSchoolForOrigin(run.originId), getCardDef);
}

export function inventoryCount(run) {
  return Array.isArray(run?.items) ? run.items.length : 0;
}

export function isInventoryFull(run) {
  return inventoryCount(run) >= MAX_ITEMS;
}

export function addItemToRun(run, itemId, count = 1) {
  if (!run || !ITEM_MAP[itemId]) return 0;
  if (!Array.isArray(run.items)) run.items = [];
  let added = 0;
  for (let index = 0; index < count; index += 1) {
    if (run.items.length >= MAX_ITEMS) break;
    run.items.push(itemId);
    added += 1;
  }
  return added;
}

export function removeItemFromRun(run, itemId) {
  if (!run || !Array.isArray(run.items)) return false;
  const index = run.items.lastIndexOf(itemId);
  if (index < 0) return false;
  run.items.splice(index, 1);
  return true;
}

export function pickItemId(rarity = null) {
  let pool = ITEMS;
  if (rarity) {
    pool = ITEMS.filter((item) => item.rarity === rarity);
  }
  if (!pool.length) pool = ITEMS;
  let targetRarity = rarity;
  if (!targetRarity) {
    const roll = rand();
    targetRarity = roll < ITEM_RARITY_WEIGHT.common ? 'common' : roll < ITEM_RARITY_WEIGHT.common + ITEM_RARITY_WEIGHT.uncommon ? 'uncommon' : 'rare';
  }
  const rarityPool = pool.filter((item) => item.rarity === targetRarity);
  return pick(rarityPool.length ? rarityPool : pool).id;
}

export function randomItem(rarity = null) {
  const id = pickItemId(rarity);
  return ITEM_MAP[id] || null;
}

const PARLEY_ATTRIBUTE = {
  reason: 'insight',
  empathy: 'empathy',
  threat: 'presence',
  bribe: 'guile',
};

export function runAttributes(run = G.run) {
  const origin = ORIGIN_MAP[run?.originId || G.profile.originId] || ORIGIN_MAP.blade;
  return { ...(origin.attributes || {}), ...(run?.attributes || {}) };
}

export function attributeGain(approachId, run = G.run) {
  const attrId = PARLEY_ATTRIBUTE[approachId];
  const value = Number(runAttributes(run)[attrId]) || 0;
  return { id: attrId, value, bonus: Math.round((value - 3) * 4) };
}

export function parleyTierPenalty(tier) {
  if (tier === 'merchant') return 22;
  if (tier === 'boss') return 18;
  if (tier === 'elite') return 8;
  return 0;
}

function parleyOriginBonus(approachId) {
  const origin = G.run?.originId || G.profile.originId;
  if (origin === 'arcanist' && approachId === 'reason') return 8;
  if (origin === 'wraith' && approachId === 'threat') return 7;
  if (origin === 'blade' && approachId === 'threat') return 5;
  if (origin === 'pyre' && approachId === 'empathy') return 7;
  return 0;
}

export function stealChance(run = G.run) {
  const guile = Number(runAttributes(run).guile) || 0;
  return Math.round(clamp(6 + guile * 3, 6, 30));
}

export function stealFromMerchant(run, shop) {
  if (!run || !shop) return { ok: false, message: '柜台已经消失在雾里。' };
  if (shop.stealUsed) return { ok: false, message: '那只手已经试过一次了。' };
  shop.stealUsed = true;
  const chance = stealChance(run);
  const roll = randomInt(1, 100);
  if (roll <= chance) {
    const offers = (shop.items || []).filter((offer) => !offer.sold);
    let item = null;
    let overflowGold = 0;
    if (offers.length) {
      const offer = pick(offers);
      offer.sold = true;
      item = ITEM_MAP[offer.defId] || null;
      if (item && !addItemToRun(run, offer.defId)) {
        overflowGold = 18;
        run.gold += overflowGold;
      }
    }
    const gold = randomInt(16, 32);
    run.gold += gold;
    run.totals.steals = (Number(run.totals.steals) || 0) + 1;
    run.unlockedAchievements = recordStealSuccess();
    return {
      ok: true,
      success: true,
      chance,
      roll,
      item,
      gold,
      overflowGold,
      message: item
        ? `你的指尖从货箱里衔走了【${item.name}】和 ${gold} 枚金币。行商仍在打盹。`
        : `你从钱匣里摸走了 ${gold} 枚金币。行商翻了个身，没有睁眼。`,
      detail: overflowGold ? '行囊已满，那件道具化成了 18 枚金币。' : '',
    };
  }
  const battle = startMerchantBattle(shop.nodeId || run.pendingNodeId);
  if (battle) {
    addStatus(battle.enemy, 'strength', 2);
    addStatus(battle.enemy, 'vulnerable', 1);
    battle.merchantAlert = true;
    addLog(battle, '你的手还没离开钱匣，行商已经扣住了你的手腕。', 'parley');
    addLog(battle, '他被激怒了：获得 2 层力量，也因为暴怒露出 1 层易伤。', 'debuff');
  }
  return {
    ok: true,
    success: false,
    chance,
    roll,
    battle,
    message: '铜铃在你指下响了一声。行商抬起头，笑容像一把刚开刃的刀。',
    detail: '偷窃失败：他获得了 2 层力量与 1 层易伤，这一战没有退路。',
  };
}

export function parleyProfile(battle) {
  const def = ENEMY_MAP[battle?.enemy?.defId];
  if (!def?.sapient) return null;
  const personality = PERSONALITIES[def.personality] || PERSONALITIES.stoic;
  return {
    def,
    personality,
    tier: battle.tier || def.tier,
    title: def.name,
    glyph: def.glyph,
    accent: def.accent,
  };
}

export function parleyOptions(battle) {
  if (!battle || battle.parley) return [];
  const profile = parleyProfile(battle);
  if (!profile) return [];
  const run = battle.mode === 'adventure' ? G.run : null;
  const tierPenalty = parleyTierPenalty(profile.tier);
  return PARLEY_APPROACHES.map((approach) => {
    let chance = approach.base + (Number(profile.personality.modifier) || 0) - tierPenalty;
    if (profile.personality.weak === approach.id) chance += 24;
    if (profile.personality.resist === approach.id) chance -= 24;
    chance += parleyOriginBonus(approach.id);
    const attribute = attributeGain(approach.id, run || G.run);
    chance += attribute.bonus;
    chance = Math.round(clamp(chance, 5, 92));
    const cost = Number(approach.cost) || 0;
    const disabled = cost > 0 && (!run || run.gold < cost);
    return {
      ...approach,
      chance,
      attribute,
      disabled,
      disabledReason: disabled ? '金币不足 20。' : '',
    };
  });
}

export function resolveParley(battle, approachId) {
  if (!battle || battle.parley) return { ok: false, message: '这次交涉已经结束。' };
  const profile = parleyProfile(battle);
  const options = parleyOptions(battle);
  const approach = options.find((option) => option.id === approachId);
  if (!profile || !approach) return { ok: false, message: '对方没有回应。' };
  if (approach.disabled) return { ok: false, message: approach.disabledReason || '现在无法这样做。' };
  const run = battle.mode === 'adventure' ? G.run : null;
  if (approach.cost) {
    if (!run || run.gold < approach.cost) return { ok: false, message: '金币不足。' };
    run.gold -= approach.cost;
  }
  const roll = randomInt(1, 100);
  const success = roll <= approach.chance;
  const tier = battle.tier || profile.def.tier;
  const isBoss = tier === 'boss' || tier === 'merchant';
  const fx = [];
  const personalityName = profile.personality.name;
  if (success) {
    const weak = isBoss ? 1 : 2;
    addStatus(battle.enemy, 'weak', weak);
    battle.player.block += 10;
    if (!isBoss) battle.parleySkip = true;
    battle.parley = {
      outcome: 'success', approach: approach.id, approachName: approach.name,
      chance: approach.chance, roll, cost: approach.cost || 0, personality: personalityName,
    };
    addLog(battle, `你没有说服${profile.def.name}放下刀，但${approach.name}让它迟疑了一瞬。`, 'parley');
    addLog(battle, `${battle.enemy.name} 获得 ${weak} 层虚弱，你获得 10 点格挡${isBoss ? '' : '，它还会失去下一次行动'}。`, 'parley');
    if (run) {
      run.parleySuccesses = (Number(run.parleySuccesses) || 0) + 1;
      const world = G.profile.world;
      world.parleySuccesses = (Number(world.parleySuccesses) || 0) + 1;
      if (!world.parleyStyles || typeof world.parleyStyles !== 'object') world.parleyStyles = {};
      world.parleyStyles[approach.id] = (Number(world.parleyStyles[approach.id]) || 0) + 1;
      if (profile.def.tier === 'boss') {
        if (!Array.isArray(run.parleyBosses)) run.parleyBosses = [];
        if (!run.parleyBosses.includes(profile.def.id)) run.parleyBosses.push(profile.def.id);
        if (!Array.isArray(world.bossParleys)) world.bossParleys = [];
        if (!world.bossParleys.includes(profile.def.id)) {
          world.bossParleys.push(profile.def.id);
          if (world.bossParleys.length === 4) run.parleyUnlockedEnding = true;
          addLog(battle, '你记住了它没说出口的那半句话。群岛会替你记住。', 'parley');
        }
      }
      saveProfileNow();
      battle.unlockedAchievements = evaluateAchievements('parley');
    }
    fx.push({ target: 'enemy', kind: 'status', status: 'weak', amount: weak });
    fx.push({ target: 'player', kind: 'block', amount: 10 });
    battle.parleyFx = fx;
    return {
      ok: true, success: true, chance: approach.chance, roll, cost: approach.cost || 0,
      personality: personalityName,
      message: `${approach.name}奏效了。${profile.def.name}没有退让，但它的杀意出现了一道缝。`,
      detail: `${battle.enemy.name} 虚弱 ${weak}${isBoss ? '' : '，下一次行动被打断'}，你获得 10 点格挡。`,
    };
  }
  const strength = isBoss ? 3 : 2;
  addStatus(battle.enemy, 'strength', strength);
  addStatus(battle.enemy, 'vulnerable', 2);
  battle.parley = {
    outcome: 'rage', approach: approach.id, approachName: approach.name,
    chance: approach.chance, roll, cost: approach.cost || 0, personality: personalityName,
  };
  addLog(battle, `交涉破裂。${profile.def.name}被彻底激怒了。`, 'parley');
  addLog(battle, `${battle.enemy.name} 获得 ${strength} 层力量，但敏捷与闪避下降，获得 2 层易伤。`, 'parley');
  fx.push({ target: 'enemy', kind: 'status', status: 'strength', amount: strength });
  fx.push({ target: 'enemy', kind: 'status', status: 'vulnerable', amount: 2 });
  battle.parleyFx = fx;
  return {
    ok: true, success: false, chance: approach.chance, roll, cost: approach.cost || 0,
    personality: personalityName,
    message: `${approach.name}没有奏效。${profile.def.name}的怒火先一步烧断了最后一点耐心。`,
    detail: `${battle.enemy.name} 获得 ${strength} 层力量与 2 层易伤：攻击更重，但更容易被命中。`,
  };
}

const MECHANIC_START = {
  dragonScorch: 0,
  mistSeal: 0,
  boneCandles: 3,
  mirrorReplica: 0,
  ashFurnace: 0,
  tideRhythm: 1,
  paperCut: 0,
  heartPulse: 0,
  merchantBag: MERCHANT_BAG_SIZE,
};

// 镜潮之主的记忆阈值与回敬伤害必须由同一处算，
// 否则图鉴、机制条和真实结算会各说各话。
const mirrorThreshold = (battle) => Math.max(12, Math.round((Number(battle?.player?.maxHp) || 1) * 0.35));
const mirrorReplicaDamage = (battle) => Math.max(5, Math.round((Number(battle?.player?.maxHp) || 1) * 0.05));

function makeMechanicState(enemyDef) {
  if (!enemyDef?.mechanic) return null;
  return {
    id: enemyDef.mechanic.id,
    value: MECHANIC_START[enemyDef.mechanic.id] ?? 0,
  };
}

export function mechanicInfo(battle) {
  const def = ENEMY_MAP[battle?.enemy?.defId];
  const mech = def?.mechanic;
  if (!mech || !battle?.enemy) return null;
  const state = battle.enemy.mechanic || makeMechanicState(def);
  const value = Number(state?.value) || 0;
  const phase2 = (Number(battle.enemy.phase) || 1) >= 2;
  let detail = mech.desc;
  let meter = null;
  switch (mech.id) {
    case 'dragonScorch':
      detail = `它的攻击会留下 ${phase2 ? 2 : 1} 层灼烧，灼烧在你的回合结束时发作。`;
      break;
    case 'mistSeal': {
      const sealedCards = (Array.isArray(battle.sealedUids) && battle.sealedUids.length
        ? battle.sealedUids
        : (battle.sealedUid ? [battle.sealedUid] : []))
        .map((uid) => battle.hand?.find((card) => card.uid === uid))
        .filter(Boolean);
      const sealedNames = sealedCards
        .map((card) => resolveCard(getCardDef(card.defId), card.upgraded)?.name)
        .filter(Boolean);
      const sealMax = battle.enemy.surged ? Math.max(1, Number(battle.enemy.surge?.sealCount) || 2) : 1;
      detail = sealedNames.length
        ? `「${sealedNames.join('」「')}」的名字被雾借走，本回合无法打出。`
        : mech.desc;
      meter = { value: sealedNames.length, max: sealMax };
      break;
    }
    case 'boneCandles':
      detail = battle.enemy.surged
        ? `还剩 ${value} 根蜡烛；暴走中每回合熄灭 ${Math.max(1, Number(battle.enemy.surge?.candleStep) || 2)} 根，燃尽时万烛同灭。`
        : `还剩 ${value} 根蜡烛；燃尽时万烛同灭。`;
      meter = { value, max: mech.max };
      break;
    case 'mirrorReplica': {
      const threshold = mirrorThreshold(battle);
      const replica = mirrorReplicaDamage(battle);
      detail = `镜面已记下 ${value}/${threshold} 点伤害（毒与灼烧也算）；记满时复写 ${replica} 点无视格挡的伤害。`;
      meter = { value: Math.min(value, threshold), max: threshold };
      break;
    }
    case 'ashFurnace':
      detail = `炉温 ${value}/${mech.max}；每个你伤到它的回合 +1，满时它吞噬一个名字，回复 9 点生命并获得 1 层力量。${phase2 ? '真形每回合还会焚掉你打出的第一张攻击牌。' : ''}`;
      meter = { value, max: mech.max };
      break;
    case 'tideRhythm':
      detail = value === 1
        ? '涨潮：它这一回合的伤害 +35%，回合末还会叠护甲与力量——这时候该防。'
        : '退潮：它这一回合的伤害 -20%，并且不会叠甲；你获得 1 点额外能量——这是你的输出窗口。';
      if (battle.enemy.surged && Number(battle.enemy.surge?.surgeWeak) > 0) {
        detail += ` 风暴潮：涨潮的攻击还会附加 ${battle.enemy.surge.surgeWeak} 层虚弱。`;
      }
      meter = { value: value === 1 ? 1 : 0, max: 1 };
      break;
    case 'paperCut':
      detail = `已从你手里剪去 ${value} 张牌${phase2 ? '；真形每回合会剪去两张' : ''}。`;
      meter = { value: Math.min(value, mech.max), max: mech.max };
      break;
    case 'heartPulse': {
      const beats = Number(battle.enemy.beatCount) || 0;
      detail = beats >= 4
        ? `心搏已停（${beats}/4 次），它再也回不到从前。`
        : `每 ${mech.max} 个敌方回合心搏一次：回复 ${phase2 ? 6 : 4} 点生命，一场最多 4 次（${beats}/4，${value % mech.max}/${mech.max}）。`;
      meter = { value: beats >= 4 ? 0 : value % mech.max, max: mech.max };
      break;
    }
    case 'merchantBag':
      detail = `货袋里还剩 ${value} 件道具；生命越低，他一次取用越多。`;
      meter = { value, max: mech.max || MERCHANT_BAG_SIZE };
      break;
    default:
      break;
  }
  return { ...mech, value, detail, meter, phase2 };
}

// ── 梦魇谱系 ────────────────────────────────────────────────
// 谱系是「族」的规则，独立于首领机制存在：
// 普通敌人和精英也能有一条自己的动词，而不是只当一袋数值。

function enemyLineageDef(battle) {
  const id = ENEMY_MAP[battle?.enemy?.defId]?.lineage;
  return id ? (ENEMY_LINEAGES[id] || null) : null;
}

function ensureLineageState(battle) {
  if (!battle?.enemy) return null;
  if (!battle.enemy.lineageState || typeof battle.enemy.lineageState !== 'object') {
    battle.enemy.lineageState = {};
  }
  const state = battle.enemy.lineageState;
  state.counter = Math.max(0, Number(state.counter) || 0);
  state.pendingSeal = Boolean(state.pendingSeal);
  state.echo = Math.max(0, Number(state.echo) || 0);
  return state;
}

export function lineageInfo(battle) {
  const def = enemyLineageDef(battle);
  if (!def || !battle?.enemy) return null;
  const enemy = battle.enemy;
  const state = ensureLineageState(battle);
  let detail = def.desc;
  let meter = null;
  switch (def.id) {
    case 'rotFeast': {
      const dot = (Number(enemy.statuses?.poison) || 0) + (Number(enemy.statuses?.burn) || 0);
      detail = `中毒 + 灼烧 ${dot}/${def.dotThreshold}：达到 ${def.dotThreshold} 层时，它每回合吞下 ${def.dotConsume} 层并回复 ${def.heal} 点生命。`;
      meter = { value: Math.min(dot, def.dotThreshold), max: def.dotThreshold };
      break;
    }
    case 'phalanx': {
      const thorns = Number(enemy.statuses?.thorns) || 0;
      detail = `荆棘 ${thorns}/${def.thornsCap}；它每次获得格挡都会再长出 1 层。`;
      meter = { value: thorns, max: def.thornsCap };
      break;
    }
    case 'borrowedName': {
      const wait = state.pendingSeal ? 0 : Math.max(1, def.sealEvery - state.counter);
      const stolen = Array.isArray(enemy.stolen) ? enemy.stolen.length : 0;
      detail = state.pendingSeal
        ? '它已经记住了你的一张牌，下个回合开始时会封住它。'
        : `再过 ${wait} 个敌方回合，它会封住你的一张手牌。`;
      if (stolen > 0) detail += ` 它手里还扣着你 ${stolen} 张牌，倒计时结束才会归还。`;
      meter = { value: def.sealEvery - wait, max: def.sealEvery };
      break;
    }
    case 'darkLitany': {
      const wait = Math.max(1, def.echoEvery - (state.counter % def.echoEvery));
      detail = `再过 ${wait} 个敌方回合，它会把你身上的 1 层虚弱或易伤念回给你。`;
      meter = { value: def.echoEvery - wait, max: def.echoEvery };
      break;
    }
    case 'thornCrown': {
      const thorns = Number(enemy.statuses?.thorns) || 0;
      detail = `荆棘 ${thorns}/${def.thornsCap}；你每打出一张攻击牌，它再长出 1 层。汲取会吞掉 ${def.healThornsCost} 层换取额外 ${def.healBonus} 点治疗。`;
      meter = { value: thorns, max: def.thornsCap };
      break;
    }
    case 'mirrorEcho': {
      const echo = Number(state.echo) || 0;
      detail = `镜影 ${echo}/${def.echoEvery}；满层时立刻回击 ${def.echoDamage} 点（可格挡）。`;
      meter = { value: echo, max: def.echoEvery };
      break;
    }
    default:
      break;
  }
  return { ...def, detail, meter };
}

export function surgeInfo(battle) {
  const enemy = battle?.enemy;
  if (!enemy?.surge) return null;
  return {
    ...enemy.surge,
    active: Boolean(enemy.surged),
    title: enemy.surgeTitle || enemy.surge.title || '梦魇暴走',
  };
}

export function isCardSealed(battle, uid) {
  if (!battle || !uid) return false;
  if (Array.isArray(battle.sealedUids) && battle.sealedUids.includes(uid)) return true;
  return Boolean(battle.sealedUid && battle.sealedUid === uid);
}

function setSealedUids(battle, uids) {
  if (!battle) return [];
  const list = [...new Set((uids || []).filter((uid) => battle.hand?.some((card) => card.uid === uid)))];
  battle.sealedUids = list;
  battle.sealedUid = list[0] || null;
  return list;
}

function sealHandCards(battle, fx, options = {}) {
  if (!battle?.enemy) return 0;
  const count = Math.max(1, Number(options.count) || 1);
  const pool = battle.hand.filter((card) => !isCardSealed(battle, card.uid));
  const chosen = [];
  for (let index = 0; index < count && pool.length; index += 1) {
    const picked = pick(pool);
    pool.splice(pool.indexOf(picked), 1);
    chosen.push(picked);
  }
  if (!chosen.length) return 0;
  setSealedUids(battle, [...(battle.sealedUids || []), ...chosen.map((card) => card.uid)]);
  for (const instance of chosen) {
    const card = resolveCard(getCardDef(instance.defId), instance.upgraded);
    addLog(battle, `借名之雾覆上【${card?.name || '一张牌'}】，它本回合无法被打出。`, 'mechanic');
  }
  fx?.push({ target: 'player', kind: 'seal', amount: chosen.length });
  const block = Math.max(0, Number(options.blockPerSeal) || 0) * chosen.length;
  if (block > 0) {
    battle.enemy.block += block;
    fx?.push({ target: 'enemy', kind: 'block', amount: block });
    addLog(battle, `每一层借来的名字都化成护甲：${battle.enemy.name} 获得 ${block} 点格挡。`, 'mechanic');
  }
  return chosen.length;
}

function returnStolenCards(battle) {
  const stolen = Array.isArray(battle.enemy?.stolen) ? battle.enemy.stolen : [];
  if (!stolen.length) return 0;
  const due = stolen.filter((entry) => battle.turn >= (Number(entry.returnTurn) || 0));
  if (!due.length) return 0;
  battle.enemy.stolen = stolen.filter((entry) => battle.turn < (Number(entry.returnTurn) || 0));
  for (const entry of due) {
    battle.discardPile.push({ uid: entry.uid, defId: entry.defId, upgraded: Boolean(entry.upgraded) });
    const card = resolveCard(getCardDef(entry.defId), entry.upgraded);
    addLog(battle, `雾松开手，【${card?.name || '一张牌'}】回到了你的弃牌堆。`, 'mechanic');
  }
  return due.length;
}

function applyLineageTurnStart(battle, fx) {
  const def = enemyLineageDef(battle);
  if (!def) return;
  const state = ensureLineageState(battle);
  returnStolenCards(battle);
  if (def.id === 'borrowedName' && state.pendingSeal) {
    state.pendingSeal = false;
    const sealed = sealHandCards(battle, fx, { count: 1 });
    if (sealed > 0) addLog(battle, '它把你刚才随口念过的那个名字还了回来——只是名字已经不在牌上了。', 'mechanic');
  }
}

function applyLineageTurnEnd(battle, fx) {
  const def = enemyLineageDef(battle);
  if (!def) return;
  const enemy = battle.enemy;
  const state = ensureLineageState(battle);
  state.counter += 1;
  if (def.id === 'rotFeast') {
    const total = (Number(enemy.statuses.poison) || 0) + (Number(enemy.statuses.burn) || 0);
    if (total >= def.dotThreshold) {
      let remaining = Math.min(def.dotConsume, total);
      for (const status of ['burn', 'poison']) {
        if (remaining <= 0) break;
        const taken = Math.min(remaining, Number(enemy.statuses[status]) || 0);
        if (taken > 0) {
          enemy.statuses[status] = (Number(enemy.statuses[status]) || 0) - taken;
          remaining -= taken;
        }
      }
      const before = enemy.hp;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + def.heal);
      const healed = enemy.hp - before;
      addLog(battle, `腐殖吞下毒与火：${enemy.name} 回复 ${healed} 点生命，持续伤害减少 ${def.dotConsume} 层。`, 'mechanic');
      if (healed > 0) fx.push({ target: 'enemy', kind: 'heal', amount: healed });
      fx.push({ target: 'enemy', kind: 'lineage', lineage: def.id, value: 1 });
    }
  }
  if (def.id === 'borrowedName' && state.counter >= def.sealEvery) {
    state.counter = 0;
    state.pendingSeal = true;
    addLog(battle, `${enemy.name} 把你的一个名字折进了雾里——下个回合，它会封住一张牌。`, 'mechanic');
    fx.push({ target: 'player', kind: 'lineage', lineage: def.id, value: 1 });
  }
  if (def.id === 'darkLitany' && state.counter >= def.echoEvery) {
    state.counter = 0;
    const weak = Number(enemy.statuses.weak) || 0;
    const vulnerable = Number(enemy.statuses.vulnerable) || 0;
    const status = vulnerable > weak ? 'vulnerable' : weak > 0 ? 'weak' : null;
    if (status && (Number(enemy.statuses[status]) || 0) > 0) {
      addStatus(enemy, status, -1);
      addStatus(battle.player, status, 1);
      addLog(battle, `反祷：它把 1 层${STATUS_INFO[status]?.name || ''}原样念回给你。`, 'debuff');
      fx.push({ target: 'player', kind: 'status', status, amount: 1 });
    } else {
      addLog(battle, `${enemy.name} 张了张嘴——你身上没有可念的诅咒。`, 'mechanic');
    }
  }
}

function applyLineageCardPlay(battle, card, fx) {
  const def = enemyLineageDef(battle);
  if (!def || card?.type !== 'attack' || battle.enemy.hp <= 0) return;
  const enemy = battle.enemy;
  if (def.thornsPerAttack) {
    const current = Number(enemy.statuses.thorns) || 0;
    const gain = Math.min(def.thornsPerAttack, Math.max(0, def.thornsCap - current));
    if (gain > 0) {
      addStatus(enemy, 'thorns', gain);
      fx.push({ target: 'enemy', kind: 'status', status: 'thorns', amount: gain });
      if (current + gain >= def.thornsCap) addLog(battle, `棘冠长满了（${def.thornsCap} 层）——它的反击不会再增加。`, 'mechanic');
      else addLog(battle, `你的攻击让棘冠又长出一层（${current + gain}/${def.thornsCap}）。`, 'mechanic');
    }
  }
  if (def.echoDamage) {
    const state = ensureLineageState(battle);
    state.echo = (Number(state.echo) || 0) + 1;
    if (state.echo >= def.echoEvery) {
      state.echo = 0;
      const raw = calcAttackPerHit(def.echoDamage, enemy, battle.player);
      const result = hitEntity(battle.player, raw);
      battle.stats.damageTaken += result.hpLoss;
      addLog(battle, `镜影回击！${enemy.name} 复写了你的第三刀，造成 ${raw} 点伤害${result.blocked ? `（格挡抵消 ${result.blocked}）` : ''}。`, 'mechanic');
      fx.push({ target: 'player', kind: 'damage', amount: raw, hpLoss: result.hpLoss });
      if (battle.player.hp <= 0) {
        defeatBattle(battle);
        return;
      }
    } else {
      addLog(battle, `镜影映下第 ${state.echo} 刀（${state.echo}/${def.echoEvery}）。`, 'mechanic');
    }
  }
}

function addStatus(entity, status, amount) {
  const current = entity.statuses[status] || 0;
  entity.statuses[status] = Math.max(0, current + amount);
}

function calcAttackPerHit(base, attacker, defender, opts = null) {
  // skipStrength：调用方已经把力量算进 base 了，这里不要再加一遍。
  // 多段招必须走这条路——否则 4 段的招式会吃 4 次力量，
  // 玩家看到的是一招 75 点，而不是「这只首领有点凶」。
  const strength = opts?.skipStrength ? 0 : (attacker.statuses.strength || 0);
  let amount = Math.max(0, Number(base) + strength);
  if ((attacker.statuses.weak || 0) > 0) amount = Math.floor(amount * 0.75);
  if ((defender.statuses.vulnerable || 0) > 0) amount = Math.floor(amount * 1.5);
  return Math.max(0, amount);
}

function hitEntity(target, rawAmount) {
  const blocked = Math.min(target.block, rawAmount);
  target.block -= blocked;
  const hpLoss = Math.max(0, rawAmount - blocked);
  target.hp = Math.max(0, target.hp - hpLoss);
  return { blocked, hpLoss, raw: rawAmount };
}

/**
 * 抽牌分两种，规则也不同：
 *
 *   回合开始的那次自动抽牌 —— 最多 5 张。这是「节奏」，
 *     抽太多会让人一上来就面对七八张牌，算不过来。
 *   卡牌效果带来的抽牌    —— 不设 5 张限制，手牌堆到 20 张为止。
 *     这是「构筑回报」：你带了抽牌引擎，就该真的抽到东西。
 *
 * 早期版本把两者混成一个「手牌上限 10」，结果技能抽牌也被卡住，
 * 狂笑、遗梦、塞满嘴这些牌全部失效——那不是限制节奏，是把构筑砍了。
 */
export const HAND_LIMIT = 20;
export const TURN_DRAW_LIMIT = 5;

function drawCards(battle, count, announce = true) {
  let drawCount = count;
  let resonanceExtra = 0;
  const dreamBonus = resonanceBonusFor(battle.resonance, 'dream');
  if (dreamBonus > 0 && battle.resonanceState && !battle.resonanceState.drawBoostUsed) {
    battle.resonanceState.drawBoostUsed = true;
    resonanceExtra = dreamBonus;
    drawCount += resonanceExtra;
  }
  let drawn = 0;
  for (let index = 0; index < drawCount; index += 1) {
    if (battle.hand.length >= HAND_LIMIT) {
      break;
    }
    if (!battle.drawPile.length) {
      if (!battle.discardPile.length) break;
      battle.drawPile = shuffle(battle.discardPile);
      battle.discardPile = [];
      addLog(battle, '弃牌堆重新洗入抽牌堆。', 'system');
    }
    const card = battle.drawPile.pop();
    if (!card) break;
    battle.hand.push(card);
    drawn += 1;
  }
  if (drawn > 0 && announce) {
    addLog(battle, `抽了 ${drawn} 张牌。`, 'draw');
  }
  if (resonanceExtra > 0) {
    const extraDrawn = Math.max(0, drawn - count);
    if (extraDrawn > 0) addLog(battle, `遗梦共鸣在第一次抽牌时多展开了 ${extraDrawn} 张牌。`, 'buff');
  }
  if (battle.hand.length >= 10) {
    addLog(battle, '手牌已满，无法继续抽牌。', 'system');
  }
  return drawn;
}

function playerPoisonTick(battle, fx = []) {
  const poison = battle.player.statuses.poison || 0;
  if (poison <= 0) return 0;
  battle.player.hp = Math.max(0, battle.player.hp - poison);
  battle.player.statuses.poison = poison - 1;
  addLog(battle, `你体内的毒素发作，失去 ${poison} 点生命。`, 'poison');
  if (battle.player.hp > 0) addOriginProgress(battle, 1, fx, 'heat');
  if (battle.player.hp <= 0) {
    defeatBattle(battle);
  }
  return poison;
}

function playerBurnTick(battle, fx = []) {
  const burn = battle.player.statuses.burn || 0;
  if (burn <= 0) return 0;
  battle.player.hp = Math.max(0, battle.player.hp - burn);
  battle.player.statuses.burn = Math.floor(burn / 2);
  addLog(battle, `你身上的灼烧发作，失去 ${burn} 点生命，火势减半。`, 'burn');
  if (battle.player.hp > 0) addOriginProgress(battle, 1, fx, 'heat');
  if (battle.player.hp <= 0) {
    defeatBattle(battle);
  }
  return burn;
}

/**
 * 后期反制之一：禁疗。
 *
 * 有些首领会在二阶段把「治疗」这条线掐掉。这不是加血，是改规则：
 * 你的恢复牌、回血遗物、战后治疗全部打折。玩家必须换一套活法，
 * 而不是把同一套牌打得更久。
 */
function healPlayer(battle, amount, fx = [], source = 'heal') {
  const raw = Math.max(0, Number(amount) || 0);
  if (!raw) return 0;
  const scale = Math.max(0, Number(battle?.rules?.healScale));
  const allow = battle?.rules?.noHeal ? 0 : (Number.isFinite(scale) ? scale : 1);
  const before = battle.player.hp;
  battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + Math.round(raw * allow));
  const healed = battle.player.hp - before;
  if (allow === 0) {
    addLog(battle, '伤口不肯合上——这片梦境禁止愈合。', 'mechanic');
  } else if (healed > 0) {
    addLog(battle, `回复 ${healed} 点生命。`, source);
  }
  if (healed > 0) fx.push({ target: 'player', kind: 'heal', amount: healed });
  return healed;
}

function playerRegenTick(battle, fx = []) {
  const regen = battle.player.statuses.regen || 0;
  if (regen <= 0) return 0;
  const before = battle.player.hp;
  battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + regen);
  battle.player.statuses.regen = regen - 1;
  const healed = battle.player.hp - before;
  addLog(battle, `回春发作，回复 ${healed} 点生命。`, 'heal');
  if (healed > 0) fx.push({ target: 'player', kind: 'heal', amount: healed });
  return regen;
}

function enemyPoisonTick(battle, fx = null) {
  const poison = battle.enemy.statuses.poison || 0;
  if (poison <= 0) return 0;
  battle.enemy.hp = Math.max(0, battle.enemy.hp - poison);
  battle.enemy.statuses.poison = poison - 1;
  addLog(battle, `${battle.enemy.name} 的毒素发作，失去 ${poison} 点生命。`, 'poison');
  if (battle.enemy.hp <= 0) {
    winBattle(battle);
  } else {
    recordMirrorDamage(battle, poison, fx);
    if (battle.phase !== 'defeat') maybeEnterBossPhase(battle, fx);
  }
  return poison;
}

function enemyBurnTick(battle, fx = null) {
  const burn = battle.enemy.statuses.burn || 0;
  if (burn <= 0) return 0;
  battle.enemy.hp = Math.max(0, battle.enemy.hp - burn);
  battle.stats.damageDealt += burn;
  battle.enemy.statuses.burn = Math.floor(burn / 2);
  addLog(battle, `${battle.enemy.name} 被灼烧吞去 ${burn} 点生命，火势减半。`, 'burn');
  if (battle.enemy.hp <= 0) {
    winBattle(battle);
  } else {
    recordMirrorDamage(battle, burn, fx);
    if (battle.phase !== 'defeat') maybeEnterBossPhase(battle, fx);
  }
  return burn;
}

function decayDurations(entity) {
  for (const status of ['vulnerable', 'weak']) {
    if (entity.statuses[status] > 0) entity.statuses[status] -= 1;
  }
}

function applyTurnStartMechanic(battle, fx) {
  if (battle.phase !== 'player') return;
  applyLineageTurnStart(battle, fx);
  const mech = battle.enemy?.mechanic;
  if (!mech) return;
  if (mech.id === 'tideRhythm') {
    const highTide = battle.turn % 2 === 1;
    mech.value = highTide ? 1 : 0;
    // 潮钟的规则是「什么时候打」，但方向必须是压力，不是福利。
    //
    // 旧版涨潮给玩家降价 + 抽牌，等于首领在帮你出牌——160 血 + 2.0 系数
    // 都压不动，五角色全是 100%。潮水的意义应该是：
    //   涨潮 —— 海把它托高，它这一段更疼，你必须防；
    //   退潮 —— 它退回水下，伤害变软，但会补护甲，这是你的输出窗口。
    // 于是同一副牌在两种潮位下是两套打法，而玩家必须学会看潮。
    battle.rules.tideHigh = highTide;
    battle.rules.tideDiscount = 0;
    if (highTide) {
      addLog(battle, '涨潮了：海把它托了起来——这一回合它的每一击都更重。', 'mechanic');
      fx.push({ target: 'enemy', kind: 'mechanic', mechanic: 'tideRhythm', value: 1 });
    } else {
      battle.player.energy = Math.min(10, battle.player.energy + 1);
      addLog(battle, '退潮了：它退回水下，出手会软下来——这是你的窗口。', 'mechanic');
      fx.push({ target: 'player', kind: 'energy', amount: 1 });
    }
  }
  if (mech.id === 'mistSeal') {
    // 借名之雾随机封一张。试过「封最贵」与「在重牌里挑」，两者都会让
    // 只有一两张核心牌的构筑（术士、奶蛙蛙）直接归零——
    // 借名之雾该打乱节奏，不该让某个角色这局没法玩。
    // 暴走后封两张，但每张都只封这一回合，且会给出可读的护甲收益。
    const surge = battle.enemy.surged ? battle.enemy.surge : null;
    sealHandCards(battle, fx, {
      count: Math.max(1, Number(surge?.sealCount) || 1),
      blockPerSeal: Math.max(0, Number(surge?.sealBlock) || 0),
    });
  }
  if (mech.id === 'boneCandles') {
    const surge = battle.enemy.surged ? battle.enemy.surge : null;
    const step = Math.max(1, Number(surge?.candleStep) || 1);
    mech.value = Math.max(0, (Number(mech.value) || 0) - step);
    if (mech.value === 0) {
      mech.value = Number(mech.max) || 3;
      // 万烛同灭是规则惩罚，不是一次攻击——它必须无视格挡。
      // 实测可格挡的版本无论怎么调数值都是 100%：玩家每回合叠 20+ 格挡，
      // 「掉血」永远发生在格挡之后。只有跳过格挡，蜡烛才真的在倒计时。
      const damage = Math.max(10, Math.round(battle.player.maxHp * 0.25));
      battle.player.hp = Math.max(0, battle.player.hp - damage);
      const result = { raw: damage, hpLoss: damage, blocked: 0 };
      battle.stats.damageTaken += result.hpLoss;
      const strengthGain = Math.max(1, Number(surge?.candleStrength) || 2);
      addStatus(battle.enemy, 'strength', strengthGain);
      addLog(battle, `所有蜡烛同时熄灭——万烛同灭！你失去 ${result.hpLoss} 点生命（格挡无用），它却更亮了。`, 'mechanic');
      fx.push({ target: 'player', kind: 'damage', amount: result.raw, hpLoss: result.hpLoss, ignoreBlock: true });
      fx.push({ target: 'enemy', kind: 'status', status: 'strength', amount: strengthGain });
      if (battle.player.hp <= 0) defeatBattle(battle);
    } else {
      addLog(battle, `蜡烛熄灭了 ${step} 根，还剩 ${mech.value} 根。`, 'mechanic');
      fx.push({ target: 'enemy', kind: 'mechanic', mechanic: 'boneCandles', value: mech.value });
    }
  }
}

/**
 * 绝境时先开口的同行者：羁绊最高的一位，没有就由起源自己说话。
 * 这条选择不是随机的——玩家在群岛里认真聊过的人，会在最糟的时刻出现。
 */
export function lastStandCompanion() {
  const world = G.profile?.world;
  let best = null;
  for (const id of ['ember', 'ferry', 'ink']) {
    const npc = NPCS.find((entry) => entry.id === id);
    if (!npc) continue;
    const bond = npcBond(world, id);
    if (bond <= 0) continue;
    if (!best || bond > best.bond) best = { npc, bond };
  }
  return best;
}

function lastStandState(battle) {
  if (!battle.lastStand || typeof battle.lastStand !== 'object') {
    battle.lastStand = {
      offered: false,
      resolved: false,
      accepted: false,
      costPending: false,
      costPaid: false,
      costWaived: false,
      turn: 0,
      hpAtOffer: 0,
      companionId: null,
      companionName: null,
      companionGlyph: null,
      companionColor: null,
      line: '',
      soundPlayed: false,
      scar: null,
    };
  }
  return battle.lastStand;
}

function maybeOfferLastStand(battle) {
  if (!battle || battle.mode !== 'adventure' || !G.run) return false;
  if (battle.phase !== 'player' || battle.player.hp <= 0) return false;
  if (battle.player.maxHp <= LAST_STAND.scarHp) return false;
  const state = lastStandState(battle);
  if (state.offered || state.resolved) return false;
  if (battle.player.hp > Math.ceil(battle.player.maxHp * LAST_STAND.hpRatio)) return false;
  const companion = lastStandCompanion();
  const origin = ORIGIN_MAP[G.run.originId] || ORIGIN_MAP.blade;
  state.offered = true;
  state.turn = battle.turn;
  state.hpAtOffer = battle.player.hp;
  state.companionId = companion?.npc.id || null;
  state.companionName = companion?.npc.name || origin.name;
  state.companionGlyph = companion?.npc.glyph || origin.sigil;
  state.companionColor = companion?.npc.color || origin.color;
  state.line = companion?.npc.lastStandLine || origin.lastStandLine || '还差一口气。梦愿意借给你。';
  addLog(battle, `生命只剩 ${battle.player.hp} 点——梦俯下身，等你开口。`, 'mechanic');
  return true;
}

export function resolveLastStand(battle, accept) {
  const state = battle?.lastStand;
  if (!state?.offered || state.resolved) return { ok: false, message: '梦没有再问第二次。' };
  if (battle.phase !== 'player') return { ok: false, message: '此刻已经来不及回答。' };
  state.resolved = true;
  state.accepted = Boolean(accept);
  state.costPending = Boolean(accept);
  if (!accept) {
    addLog(battle, '你把这口气咽了回去。梦退开半步，重新看着你。', 'system');
    return { ok: true, accepted: false, fx: [] };
  }
  const fx = [];
  battle.player.block += LAST_STAND.block;
  addLog(battle, `你向梦借了一口气：获得 ${LAST_STAND.block} 点格挡。`, 'block');
  fx.push({ target: 'player', kind: 'block', amount: LAST_STAND.block });
  const drawn = drawCards(battle, LAST_STAND.draw, false);
  if (drawn > 0) {
    addLog(battle, `梦替你翻开了 ${drawn} 张牌。`, 'draw');
    fx.push({ target: 'player', kind: 'draw', amount: drawn });
  }
  battle.player.energy = Math.min(10, battle.player.energy + LAST_STAND.energy);
  addLog(battle, `借来的 ${LAST_STAND.energy} 点能量在掌心里发烫。代价会在梦结束时找上门。`, 'energy');
  fx.push({ target: 'player', kind: 'energy', amount: LAST_STAND.energy });
  return { ok: true, accepted: true, fx };
}

function applyLastStandCost(battle) {
  const state = battle?.lastStand;
  if (!state?.costPending || state.costPaid || !G.run) return null;
  state.costPending = false;
  state.costPaid = true;
  const origin = ORIGIN_MAP[G.run.originId] || ORIGIN_MAP.blade;
  const maxBefore = Math.max(1, Number(G.run.maxHp) || origin.hp || 1);
  const cost = Math.min(LAST_STAND.scarHp, Math.max(0, maxBefore - 1));
  if (cost <= 0) return null;
  G.run.maxHp = Math.max(1, maxBefore - cost);
  if (battle.player) {
    battle.player.maxHp = G.run.maxHp;
    battle.player.hp = Math.min(battle.player.hp, G.run.maxHp);
  }
  if (Number(G.run.hp) > G.run.maxHp) G.run.hp = G.run.maxHp;
  const scar = {
    id: uid('scar'),
    name: '借气',
    label: `梦痕 · 生命上限 -${cost}`,
    hpCost: cost,
    enemyName: battle.enemy?.name || '梦魇',
    enemyId: battle.enemy?.defId || null,
    tier: battle.tier || 'normal',
    regionId: G.run.regionId || null,
    regionName: REGION_MAP[G.run.regionId]?.name || '梦境的裂隙',
    turn: Math.max(1, Number(battle.turn) || 1),
    at: Date.now(),
  };
  if (!Array.isArray(G.run.scars)) G.run.scars = [];
  G.run.scars.push(scar);
  G.run.scars = G.run.scars.slice(-LAST_STAND.maxScars);
  state.scar = scar;
  state.hpCost = cost;
  addLog(battle, `梦收走了 ${cost} 点生命上限。一道梦痕留在了你身上。`, 'mechanic');
  return scar;
}

function beginPlayerTurn(battle, initial = false, fx = []) {
  if (battle.phase !== 'player') return;
  battle.turn += 1;
  battle.player.energy = battle.player.maxEnergy;
  battle.sealedUids = [];
  battle.sealedUid = null;
  if (battle.rules) {
    battle.rules.echoCount = 0;
    battle.rules.firstAttackArmed = false;
    battle.rules.cardsPlayedThisTurn = 0;
    battle.rules.firstCardDiscountUsed = false;
  }
  battle.resonanceState = {
    bladeUsed: false,
    bladeBoost: 0,
    starUsed: false,
    drawBoostUsed: false,
    chorusUsed: false,
    // 混响跨流派连打：上一张的流派、本回合走过的流派、层数、累计攻击加成。
    // 攻击加成是本回合的（格挡已经落袋，不在这里重置）。
    lastSchool: null,
    chorusSchools: [],
    chorusStacks: 0,
    chorusAtk: 0,
    chorusBlk: 0,
  };
  if (!initial) {
    const barrier = battle.player.statuses.barrier || 0;
    if (barrier > 0) {
      battle.player.statuses.barrier = barrier - 1;
      addLog(battle, `留壁仍在，${battle.player.block} 点格挡被保留下来。`, 'block');
    } else {
      // 余温：上回合没烧完的护甲，还能替你挡一小会儿。
      const retain = Math.max(0, Number(battle.rules?.retainBlock) || 0);
      const kept = Math.min(battle.player.block || 0, retain);
      battle.player.block = kept;
      if (kept > 0) addLog(battle, `余温未散，${kept} 点格挡留到了这一回合。`, 'block');
    }
    if (battle.origin?.id === 'combo' && battle.origin.value > 0) {
      battle.origin.value = 0;
      addLog(battle, '连斩数在晨光里归零，等待下一次起手。', 'mechanic');
    }
    playerPoisonTick(battle, fx);
    if (battle.phase !== 'player') return;
    playerRegenTick(battle, fx);
    if (battle.phase !== 'player') return;
    flushOriginTriggers(battle, fx);
    if (battle.phase !== 'player') return;
  }
  // 拆引擎的持续压力：每回合少抽两张。少抽的是「你还能再来一次」这件事。
  const echoPenalty = battle.rules?.echoBreak ? 2 : 0;
  const mutationDraw = Math.max(0, Number(battle.rules?.extraDrawPerTurn) || 0);
  const contractDraw = Math.max(0, Number(battle.rules?.contractDraw) || 0);
  const firstTurnPenalty = initial ? Math.max(0, Number(battle.rules?.firstTurnDrawPenalty) || 0) : 0;
  const drawCount = Math.max(
    1,
    (battle.player.baseDraw || 5) + relicSum(battle.relics, 'draw') + mutationDraw + contractDraw - echoPenalty - firstTurnPenalty,
  );
  drawCards(battle, drawCount);
  // 凝滞：梦把时间拉长，敌人却在这段时间里慢慢变强。
  const strengthEvery = Math.max(0, Number(battle.rules?.enemyStrengthEvery) || 0);
  if (!initial && strengthEvery > 0 && battle.turn % strengthEvery === 0 && battle.enemy.hp > 0) {
    addStatus(battle.enemy, 'strength', 1);
    addLog(battle, `凝滞的梦又绕了一圈：${battle.enemy.name} 获得 1 层力量。`, 'mechanic');
    fx.push({ target: 'enemy', kind: 'status', status: 'strength', amount: 1 });
  }
  // 拆引擎：抽完牌之后，它当着你的面拿走最贵的那张，而且是永久拿走。
  // 丢弃没用——下一回合就摸回来了。要让它「被消耗」，玩家才会真的疼，
  // 也才会开始想「我是不是该把手牌打得更便宜一点」。
  // 上限 3 张，避免长局被削成空手。
  if (battle.rules?.echoBreak && battle.hand.length > 2) {
    const used = Number(battle.rules.echoBreakUsed) || 0;
    if (used < 3) {
      // 优先剪「引擎牌」——抽牌/回能/0 费的循环件，剪掉它们才是真的拆引擎；
      // 手上没有引擎牌时，退回去剪最贵的那张。
      const engineScore = (card) => {
        const def = getCardDef(card.defId);
        const resolved = resolveCard(def, card.upgraded);
        if (!resolved) return -1;
        let score = 0;
        if (resolved.draw) score += 12 + resolved.draw * 2;
        if (resolved.energy) score += 10 + resolved.energy * 2;
        if (resolved.cost === 0) score += 6;
        if (resolved.cost !== undefined && resolved.cost !== null && resolved.cost >= 3) score += 3;
        return score;
      };
      let victim = null;
      let best = -1;
      for (const card of battle.hand) {
        const score = engineScore(card);
        if (score > best) { best = score; victim = card; }
      }
      if (victim) {
        const def = getCardDef(victim.defId);
        const card = resolveCard(def, victim.upgraded);
        battle.hand = battle.hand.filter((item) => item.uid !== victim.uid);
        battle.exhaustPile.push(victim);
        battle.rules.echoBreakUsed = used + 1;
        addLog(battle, `它剪掉了【${card?.displayName || '一张牌'}】——这张牌本场不会再回来。`, 'mechanic');
        fx.push({ target: 'player', kind: 'seal', amount: 1 });
      }
    }
  }
  applyTurnStartMechanic(battle, fx);
  if (battle.phase !== 'player') return;
  if (!initial) addLog(battle, `第 ${battle.turn} 回合开始。`, 'system');
  maybeOfferLastStand(battle);
}

/**
 * 岛屿深度：普通/精英也要跟着岛序走。
 *
 * 旧版只有 Boss 配了 powerScale，第八座岛的杂兵和第一座岛一样软，
 * 后期地图的「战斗」节点成了纯奖励关。这里按 region.order 给普通/精英
 * 同时加生命与伤害；Boss 用自己的 powerScale，无尽模式由 endlessScaling
 * 负责，都不叠加这一层。
 */
function enemyDepthScale(region, tier, run) {
  if (!region || run?.endless) return 1;
  const order = Math.max(1, Number(region.order) || 1);
  const tierBonus = tier === 'elite' ? 0.06 : 0;
  return 1 + (order - 1) * 0.05 + tierBonus;
}

function createBattle({ mode, originId, entries, enemyId, tier, ascension = null, daily = null }) {
  const origin = ORIGIN_MAP[originId] || ORIGIN_MAP.blade;
  const enemyDef = ENEMY_MAP[enemyId] || ENEMY_MAP.mossling;
  recordCodexSeen('enemy', enemyDef.id);
  const skin = getEnemySkin(enemyDef.id);
  const isAdventure = mode === 'adventure' && G.run;
  const region = isAdventure ? REGION_MAP[G.run.regionId] : null;
  const modifiers = isAdventure
    ? { ...(region?.modifiers || G.run.modifiers || {}), ...(G.run.endlessModifiers || {}), ...(G.run.ngPlusMods || {}) }
    : { ...(daily?.modifiers || {}) };
  // 梦境变奏必须叠在岛屿修正之上，而不是被 region.modifiers 盖掉：
  // 生命与治疗系数相乘，其余数值相加。
  const dreamMutations = isAdventure ? (G.run.dreamMutations || []) : [];
  const mutationMods = isAdventure ? (G.run.mutationMods || mergeMutationMods(dreamMutations)) : {};
  for (const [key, value] of Object.entries(mutationMods)) {
    const number = Number(value);
    if (!Number.isFinite(number)) continue;
    if (key === 'enemyHpScale' || key === 'healScale' || key === 'shopPriceScale') {
      modifiers[key] = (Number(modifiers[key]) || 1) * number;
    } else {
      modifiers[key] = (Number(modifiers[key]) || 0) + number;
    }
  }
  // 梦呓契约同样叠在岛屿修正之上：它是玩家主动签下的规则，不该被岛屿覆盖。
  // 布尔项留在 contractMods 里给 rules 用，数值项并进 modifiers 统一结算。
  const contractIds = isAdventure ? (G.run.contracts || []) : [];
  const contractMods = isAdventure ? (G.run.contractMods || mergeContractRules(contractIds)) : {};
  for (const [key, value] of Object.entries(contractMods)) {
    if (typeof value === 'boolean') continue;
    const number = Number(value);
    if (!Number.isFinite(number)) continue;
    if (key === 'healScale' || key === 'shopPriceScale') {
      modifiers[key] = (Number(modifiers[key]) || 1) * number;
    } else {
      modifiers[key] = (Number(modifiers[key]) || 0) + number;
    }
  }
  const contracts = contractList(contractIds);
  const ascensionValue = clamp(
    Math.floor(Number(ascension ?? (isAdventure ? G.run.ascension : 0)) || 0),
    0,
    MAX_ASCENSION,
  );
  const ascensionMods = ascensionModifiers(ascensionValue);
  const relics = isAdventure ? [...G.run.relics] : [];
  const normalize = normalizeDeckEntries(entries);
  const resonance = computeResonance(normalize, preferredSchoolForOrigin(origin.id), getCardDef);
  const resonanceThorns = resonanceBonusFor(resonance, 'thorn');
  const playerMaxHp = isAdventure ? G.run.maxHp : origin.hp;
  const playerHp = isAdventure ? Math.min(G.run.hp, playerMaxHp) : playerMaxHp;
  const bonusEnergy = relicSum(relics, 'maxEnergy') + (Number(contractMods.contractEnergy) || 0);
  const ascensionEnergyPenalty = Math.max(0, Number(ascensionMods.energyPenalty) || 0);
  // 五个角色不共享同一套资源骨架：能量与起手抽牌都由各自定义决定。
  const res = origin.resources || { energy: 3, draw: 5 };
  const baseEnergy = Math.max(1, (Number(res.energy) || 3) + bonusEnergy - ascensionEnergyPenalty);
  // 每回合最多抓 5 张。抽得多不等于打得出——手牌堆成一片时，
  // 玩家反而看不清、算不动，最后只是把牌弃掉。奶蛙蛙/行者原本 7/6 张，
  // 现在靠「狂笑」「蚀放」这些机制去补，不再靠一次抓一把。
  const drawPenalty = Math.max(0, Number(ascensionMods.drawPenalty) || 0);
  const baseDraw = Math.max(1, Math.min(TURN_DRAW_LIMIT, Math.max(1, Number(res.draw) || 5)) - drawPenalty);
  const startPoison = (origin.startPoison || 0) + relicSum(relics, 'startPoison') + (Number(modifiers.startPoison) || 0);
  const startBurn = (origin.startBurn || 0) + relicSum(relics, 'startBurn') + (Number(modifiers.startBurn) || 0);
  const startStrength = relicSum(relics, 'startStrength') + (Number(modifiers.startStrength) || 0);
  const startDexterity = relicSum(relics, 'startDexterity') + (Number(modifiers.startDexterity) || 0);
  const startThorns = relicSum(relics, 'startThorns') + (Number(modifiers.startThorns) || 0);
  const startEnemyWeak = relicSum(relics, 'startEnemyWeak') + (Number(modifiers.startEnemyWeak) || 0) + (Number(origin.startEnemyWeak) || 0);
  const startEnemyVulnerable = relicSum(relics, 'startEnemyVulnerable') + (Number(modifiers.startEnemyVulnerable) || 0);
  const enemyHpScale = (Number(modifiers.enemyHpScale) || 1) * ascensionMods.enemyHpScale;
  const bossTier = (tier || enemyDef.tier) === 'boss';
  const awakeningCount = isAdventure && Array.isArray(G.run?.originAwakening)
    ? G.run.originAwakening.length
    : 0;
  // 梦压只压在首领身上：普通战斗仍然按岛屿深度走，不该被觉醒二次加码。
  const awakeningDamageScale = bossTier
    ? 1 + awakeningCount * AWAKENING_PRESSURE.bossDamagePerTier
    : 1;
  const awakeningHpScale = bossTier
    ? 1 + awakeningCount * AWAKENING_PRESSURE.bossHpPerTier
    : 1;
  const depthScale = isAdventure && (tier || enemyDef.tier) !== 'boss'
    ? enemyDepthScale(region, tier || enemyDef.tier, G.run)
    : 1;
  // 折廊是开场岛：给普通/精英更多回合数，让意图、谱系与绝境来得及发生。
  const openingIsland = mode === 'adventure'
    && !G.run?.endless
    && (Number(region?.order) || 0) === 1;
  const baseHpScale = openingIsland ? OPENING_DIFFICULTY.enemyHpScale : 1;
  const baseDamageScale = openingIsland ? OPENING_DIFFICULTY.enemyDamageScale : 1;
  const enemyMaxHp = Math.max(1, Math.round(enemyDef.hp * baseHpScale * enemyHpScale * depthScale * awakeningHpScale));
  const enemyDamageBonus = (Number(modifiers.enemyBonusDamage) || 0) + ascensionMods.enemyBonusDamage;
  const noItemsSource = contractMods.noItems ? 'contract' : ascensionMods.noItems ? 'ascension' : null;
  const rules = {
    debuffScale: Math.max(1, Number(modifiers.debuffScale) || 1),
    healScale: Math.max(0, Number(modifiers.healScale) || 1),
    noHeal: Boolean(contractMods.noHeal),
    reflectPct: 0,
    echoBreak: false,
    // 梦境变奏的规则钩子：没有抽到对应变奏时全部为 0。
    enemyHitBurn: Math.max(0, Number(modifiers.enemyHitBurn) || 0),
    firstAttackBonus: Math.max(0, Number(modifiers.firstAttackBonus) || 0),
    firstTurnDrawPenalty: Math.max(0, Number(modifiers.firstTurnDrawPenalty) || 0),
    echoDrawEvery: Math.max(0, Number(modifiers.echoDrawEvery) || 0),
    extraDrawPerTurn: Math.max(0, Number(modifiers.extraDrawPerTurn) || 0),
    enemyStrengthEvery: Math.max(0, Number(modifiers.enemyStrengthEvery) || 0),
    retainBlock: Math.max(0, Number(modifiers.retainBlock) || 0),
    emptyHandBlock: Math.max(0, Number(modifiers.emptyHandBlock) || 0),
    // 梦呓契约的规则钩子。
    contractDraw: Math.max(0, Number(contractMods.contractDraw) || 0),
    cardPlayLimit: Math.max(0, Number(contractMods.cardPlayLimit) || 0),
    endTurnHpLoss: Math.max(0, Number(contractMods.endTurnHpLoss) || 0),
    noItems: Boolean(noItemsSource),
    noItemsSource,
    firstCardDiscount: Math.max(0, Number(contractMods.firstCardDiscount) || 0),
    firstHitDraw: Math.max(0, Number(contractMods.firstHitDraw) || 0),
    cardsPlayedThisTurn: 0,
    firstCardDiscountUsed: false,
    firstHitDrawTurn: 0,
  };
  const battle = {
    mode,
    tier: tier || enemyDef.tier,
    regionId: region?.id || null,
    rules,
    mutations: dreamMutations.map((mutation) => ({ ...mutation })),
    contracts: contracts.map((contract) => ({ ...contract })),
    ascension: ascensionValue,
    daily: daily ? { ...daily } : null,
    location: isAdventure ? (region?.name || '梦境的裂隙') : (mode === 'daily' ? '今日的梦境边陲' : '无梦的试炼场'),
    enemy: {
      defId: enemyDef.id,
      name: skin.name,
      baseName: enemyDef.name,
      image: skin.image,
      glyph: enemyDef.glyph,
      accent: enemyDef.accent,
      tier: enemyDef.tier,
      lore: enemyDef.lore,
      // 岛屿深度系数：必须在构造战斗对象时显式带过来。
      // 它是逐个字段拷贝的，漏一行就等于整座岛的难度旋钮没接上电源。
      // Boss 用数据里的 powerScale；普通/精英吃岛屿深度，伤害跟着一起长。
      powerScale: (Number(enemyDef.powerScale) || 1) * baseDamageScale * ((tier || enemyDef.tier) === 'boss' ? awakeningDamageScale : depthScale),
      hp: enemyMaxHp,
      maxHp: enemyMaxHp,
      block: 0,
      damageBonus: enemyDamageBonus,
      statuses: {},
      moves: enemyDef.moves.map((move) => ({ ...move })),
      pattern: [...enemyDef.pattern],
      moveIndex: 0,
      phase: 1,
      phaseTitle: null,
      phase2: enemyDef.phase2 ? JSON.parse(JSON.stringify(enemyDef.phase2)) : null,
      surge: enemyDef.surge ? JSON.parse(JSON.stringify(enemyDef.surge)) : null,
      surged: false,
      surgeTitle: null,
      lineage: enemyDef.lineage || null,
      lineageState: { counter: 0, pendingSeal: false, echo: 0 },
      stolen: [],
      mechanic: makeMechanicState(enemyDef),
    },
    player: {
      name: getHeroName(),
      title: origin.name,
      avatar: getHeroAvatar(origin.id),
      accent: origin.color,
      hp: playerHp,
      maxHp: playerMaxHp,
      block: 0,
      energy: baseEnergy,
      maxEnergy: baseEnergy,
      baseDraw,
      lifeAsEnergy: Number(res.lifeAsEnergy) || 0,
      statuses: {},
    },
    origin: makeOriginState(origin, isAdventure ? G.run : null, isAdventure ? runAwakeningMods(G.run) : {}),
    relics,
    resonance,
    resonanceApplied: true,
    resonanceState: {
      bladeUsed: false,
      bladeBoost: 0,
      starUsed: false,
      drawBoostUsed: false,
      chorusUsed: false,
      lastSchool: null,
      chorusSchools: [],
      chorusStacks: 0,
      chorusAtk: 0,
      chorusBlk: 0,
    },
    drawPile: shuffle(normalize.map((entry) => ({
      uid: uid('battlecard'),
      defId: entry.defId,
      upgraded: entry.upgraded,
    }))),
    hand: [],
    discardPile: [],
    exhaustPile: [],
    turn: 0,
    phase: 'player',
    mulliganUsed: false,
    lastStand: {
      offered: false,
      resolved: false,
      accepted: false,
      costPending: false,
      costPaid: false,
      costWaived: false,
      turn: 0,
      hpAtOffer: 0,
      companionId: null,
      companionName: null,
      companionGlyph: null,
      companionColor: null,
      line: '',
      soundPlayed: false,
      scar: null,
    },
    sealedUid: null,
    sealedUids: [],
    parley: null,
    parleySkip: false,
    parleyFx: [],
    log: [],
    logId: 0,
    rngSeed: Date.now(),
    stats: { cardsPlayed: 0, damageDealt: 0, damageTaken: 0 },
    rewards: null,
    totalsSynced: false,
    startedAt: Date.now(),
  };

  // 记录开局参数，供「重新开始对战」还原同一场战斗。
  battle.setup = {
    mode,
    originId: origin.id,
    enemyId: enemyDef.id,
    tier: battle.tier,
    ascension: ascensionValue,
    daily: daily ? { ...daily } : null,
    entries: normalize.map((entry) => ({ ...entry })),
    startHp: playerHp,
    startMaxHp: playerMaxHp,
    nodeId: null,
  };

  const phase2Early = Number(modifiers.phase2Early) || 0;
  const awakeningPhase2Early = battle.tier === 'boss'
    ? awakeningCount * AWAKENING_PRESSURE.phase2EarlyPerTier
    : 0;
  if (battle.tier === 'boss' && battle.enemy.phase2 && (phase2Early > 0 || awakeningPhase2Early > 0)) {
    const at = Number(battle.enemy.phase2.at) || 0.5;
    battle.enemy.phase2.at = Math.max(
      AWAKENING_PRESSURE.minPhase2At,
      at - phase2Early - awakeningPhase2Early,
    );
  }

  for (const [status, amount] of Object.entries(origin.startStatuses || {})) {
    battle.player.statuses[status] = amount;
  }
  if (startStrength) addStatus(battle.player, 'strength', startStrength);
  if (startDexterity) addStatus(battle.player, 'dexterity', startDexterity);
  if (startThorns + resonanceThorns) addStatus(battle.player, 'thorns', startThorns + resonanceThorns);
  if (startPoison > 0) {
    addStatus(battle.enemy, 'poison', startPoison);
  }
  if (startBurn > 0) {
    addStatus(battle.enemy, 'burn', startBurn);
  }
  if (startEnemyWeak) {
    addStatus(battle.enemy, 'weak', startEnemyWeak);
  }
  if (startEnemyVulnerable) {
    addStatus(battle.enemy, 'vulnerable', startEnemyVulnerable);
  }
  const awakeningStrength = bossTier ? awakeningCount * AWAKENING_PRESSURE.bossStrengthPerTier : 0;
  const enemyStartStrength = (Number(modifiers.enemyStartStrength) || 0)
    + (Number(ascensionMods.enemyStartStrength) || 0)
    + awakeningStrength;
  if (enemyStartStrength > 0) {
    addStatus(battle.enemy, 'strength', enemyStartStrength);
  }
  const enemyStartBlock = (Number(modifiers.enemyStartBlock) || 0) + (Number(ascensionMods.enemyStartBlock) || 0);
  if (enemyStartBlock > 0) {
    battle.enemy.block = Math.max(battle.enemy.block, enemyStartBlock);
  }
  const enemyStartThorns = (Number(modifiers.enemyStartThorns) || 0) + (Number(ascensionMods.enemyStartThorns) || 0);
  if (enemyStartThorns > 0) {
    addStatus(battle.enemy, 'thorns', enemyStartThorns);
  }
  const lineageDef = battle.enemy.lineage ? ENEMY_LINEAGES[battle.enemy.lineage] : null;
  if (lineageDef?.startThorns) {
    addStatus(battle.enemy, 'thorns', lineageDef.startThorns);
  }
  addLog(battle, `你在${isAdventure ? `${region?.name || '梦的深处'}` : (mode === 'daily' ? '今日的梦境边陲' : '无梦的试炼场')}遭遇了【${skin.name}】。`, 'encounter');
  if (lineageDef) {
    addLog(battle, `它的血脉在梦里显形——【${lineageDef.name}】：${lineageDef.short}。`, 'system');
  }
  if (battle.mutations.length) {
    addLog(battle, `梦境变奏：${battle.mutations.map((mutation) => `【${mutation.name}】`).join('、')}。`, 'system');
  }
  if (battle.contracts.length) {
    addLog(battle, `梦呓契约：${battle.contracts.map((contract) => `【${contract.name}】`).join('、')}。`, 'system');
  }
  if (bossTier && awakeningCount > 0) {
    addLog(
      battle,
      `梦压：你已唤醒 ${awakeningCount} 条真名，${skin.name} 也回应得更完整——生命 +${Math.round((awakeningHpScale - 1) * 100)}%、攻击 +${Math.round((awakeningDamageScale - 1) * 100)}%、开局力量 +${awakeningStrength}。`,
      'system',
    );
  }
  if (ascensionValue > 0) {
    const entry = ascensionLevel(ascensionValue);
    const ruleBits = Array.isArray(entry.tags) && entry.tags.length
      ? entry.tags
      : [
        `敌人生命 +${Math.round((entry.enemyHpScale - 1) * 100)}%`,
        enemyDamageBonus ? `攻击 +${enemyDamageBonus}` : '',
      ].filter(Boolean);
    addLog(battle, `梦境层级 ${ascensionValue}「${entry.name}」正在压低光：${ruleBits.join('、')}。`, 'system');
    if (entry.trial) addLog(battle, `梦律【${entry.trial}】：${entry.trialDesc}`, 'system');
  }
  if (resonance.primary) {
    addLog(battle, `${resonance.school.name}共鸣 ${tierLabel(resonance.tier)} 被点亮：${resonance.info.effect.replaceAll('{v}', String(resonance.value))}`, 'buff');
    if (resonance.secondary) {
      addLog(battle, `副流派 ${resonance.secondary.name} 也在回应：${resonance.secondary.info.effect.replaceAll('{v}', String(resonance.secondary.value))}`, 'buff');
    }
  } else if (resonance.chorus?.active) {
    addLog(battle, `混响共鸣 ${tierLabel(resonance.chorus.tier)} 被点亮：${resonanceEffectText(resonance)}`, 'buff');
  }
  if (startPoison > 0) addLog(battle, `${skin.name} 染上了 ${startPoison} 层中毒。`, 'poison');
  if (startBurn > 0) addLog(battle, `${skin.name} 染上了 ${startBurn} 层灼烧。`, 'burn');
  if (startEnemyWeak) addLog(battle, `开局的力量先一步缠住了它，${skin.name} 获得 ${startEnemyWeak} 层虚弱。`, 'debuff');
  if (startEnemyVulnerable) addLog(battle, `${skin.name} 露出了一瞬破绽，获得 ${startEnemyVulnerable} 层易伤。`, 'debuff');
  beginPlayerTurn(battle, true);
  if (modifiers.extraDraw) {
    const extra = drawCards(battle, modifiers.extraDraw, false);
    if (extra > 0) addLog(battle, `开局的先机替你多翻开了 ${extra} 张牌。`, 'draw');
  }
  const startBlock = relicSum(relics, 'startBlock') + (Number(modifiers.startBlock) || 0);
  if (startBlock) {
    battle.player.block += startBlock;
    addLog(battle, `开战时的护佑落在你身上，获得 ${startBlock} 点格挡。`, 'block');
  }
  if (battle.player.statuses.strength) {
    addLog(battle, `你获得了 ${battle.player.statuses.strength} 层力量。`, 'buff');
  }
  if (battle.player.statuses.dexterity) {
    addLog(battle, `你获得了 ${battle.player.statuses.dexterity} 层敏捷。`, 'buff');
  }
  if (battle.player.statuses.thorns) {
    addLog(battle, `你获得了 ${battle.player.statuses.thorns} 层荆棘。`, 'buff');
  }
  return battle;
}

export function getIntent(battle) {
  if (!battle || !battle.enemy) return null;
  const { moves, pattern, moveIndex } = battle.enemy;
  return moves[pattern[moveIndex % pattern.length]] || moves[0];
}

export function startAdventureBattle(node) {
  if (!G.run || !node) return null;
  const tier = node.type === 'elite' ? 'elite' : node.type === 'boss' ? 'boss' : 'normal';
  const region = REGION_MAP[G.run.regionId];
  let enemyId;
  if (tier === 'boss') {
    enemyId = ENEMY_MAP[G.run.bossId] ? G.run.bossId : (region?.bossId || 'nightmare-dragon');
  } else if (tier === 'elite') {
    const pool = (region?.elites || ELITE_ENEMIES).filter((id) => ENEMY_MAP[id]);
    enemyId = pool.length ? pick(pool) : pick(ELITE_ENEMIES);
  } else {
    const pool = (region?.normals || NORMAL_ENEMIES).filter((id) => ENEMY_MAP[id]);
    enemyId = pool.length ? pick(pool) : pick(NORMAL_ENEMIES);
  }
  const battle = createBattle({
    mode: 'adventure',
    originId: G.run.originId,
    entries: G.run.deck,
    enemyId,
    tier,
  });
  battle.nodeId = node.id;
  if (battle.setup) battle.setup.nodeId = node.id;
  G.run.battle = battle;
  G.run.pendingNodeId = node.id;
  G.ui.reward = null;
  G.ui.modal = null;
  G.screen = 'battle';
  return battle;
}

export function mulliganOpeningHand(battle = null) {
  const target = battle || G.run?.battle || G.sandboxBattle;
  if (!target) return { ok: false, message: '现在没有可以重新调度的战斗。' };
  if (target.mode === 'online') return { ok: false, message: '联机对战中不能调度起手。' };
  if (target.phase !== 'player' || target.turn !== 1) return { ok: false, message: '只能在第一回合、出牌前调度。' };
  if (target.mulliganUsed) return { ok: false, message: '这场战斗已经调度过起手了。' };
  if ((target.stats?.cardsPlayed || 0) > 0) return { ok: false, message: '已经出过牌，不能再调度起手。' };
  const count = target.hand.length;
  if (!count) return { ok: false, message: '手里没有可以换掉的牌。' };
  const sealedBefore = Array.isArray(target.sealedUids) && target.sealedUids.length
    ? [...target.sealedUids]
    : (target.sealedUid ? [target.sealedUid] : []);
  target.drawPile.push(...target.hand);
  target.hand = [];
  target.sealedUids = [];
  target.sealedUid = null;
  target.drawPile = shuffle(target.drawPile);
  drawCards(target, count, false);
  target.mulliganUsed = true;
  if (sealedBefore.length) {
    const kept = sealedBefore.filter((uid) => target.hand.some((card) => card.uid === uid));
    while (kept.length < sealedBefore.length) {
      const candidates = target.hand.filter((card) => !kept.includes(card.uid));
      if (!candidates.length) break;
      kept.push(pick(candidates).uid);
    }
    setSealedUids(target, kept);
  }
  addLog(target, `你把 ${count} 张起手牌洗回梦底，重新摸了一遍。`, 'draw');
  return { ok: true, count };
}

export function restartBattle() {
  const current = G.run?.battle || G.sandboxBattle;
  const setup = current?.setup;
  if (!setup) return null;
  const fresh = createBattle({
    mode: setup.mode,
    originId: setup.originId,
    entries: setup.entries.map((entry) => ({ ...entry })),
    enemyId: setup.enemyId,
    tier: setup.tier,
    ascension: setup.ascension,
    daily: setup.daily,
  });
  if (!fresh) return null;
  fresh.setup = setup;
  fresh.player.maxHp = setup.startMaxHp;
  fresh.player.hp = Math.min(setup.startMaxHp, setup.startHp);
  if (setup.mode === 'adventure' && G.run) {
    fresh.nodeId = setup.nodeId || current.nodeId || null;
    G.run.battle = fresh;
    G.run.hp = fresh.player.hp;
    G.run.pendingNodeId = fresh.nodeId;
    if (G.run.status === 'lost') G.run.status = 'active';
  } else {
    G.sandboxBattle = fresh;
  }
  G.ui.reward = null;
  G.ui.modal = null;
  G.ui.confirmAction = null;
  G.screen = 'battle';
  saveRunNow();
  return fresh;
}

export function startMerchantBattle(nodeId = null) {
  if (!G.run) return null;
  if (!ENEMY_MAP['dream-merchant']) return null;
  const battle = createBattle({
    mode: 'adventure',
    originId: G.run.originId,
    entries: G.run.deck,
    enemyId: 'dream-merchant',
    tier: 'merchant',
  });
  battle.nodeId = nodeId || G.run.pendingNodeId || null;
  battle.noRetreat = true;
  G.run.battle = battle;
  if (battle.nodeId) G.run.pendingNodeId = battle.nodeId;
  G.ui.reward = null;
  G.ui.modal = null;
  G.screen = 'battle';
  saveProfileNow();
  return battle;
}

export function startDailyBattle(date = new Date()) {
  const info = dailyInfo(date);
  setRngSeed(info.seed);
  const battle = createBattle({
    mode: 'daily',
    originId: info.origin.id,
    entries: info.entries,
    enemyId: info.enemy.id,
    tier: 'boss',
    ascension: info.ascension,
    daily: {
      key: info.key,
      label: info.label,
      bossName: info.bossName,
      originName: info.originName,
      school: info.school,
      deckSize: info.deckSize,
      modifiers: { ...(info.modifiers || {}) },
      variant: info.variant ? { id: info.variant.id, name: info.variant.name, desc: info.variant.desc } : null,
    },
  });
  if (!battle) return null;
  battle.noRetreat = true;
  G.sandboxBattle = battle;
  G.ui.reward = null;
  G.ui.modal = null;
  G.screen = 'battle';
  return battle;
}

export function startSandboxBattle(enemyId) {
  clearRngSeed();
  const enemy = ENEMY_MAP[enemyId] || ENEMY_MAP.mossling;
  const deckIds = [...G.profile.sandboxDeck];
  if (deckIds.length < 8) {
    return { error: '试炼牌组至少需要 8 张牌。' };
  }
  const battle = createBattle({
    mode: 'sandbox',
    originId: G.profile.originId,
    entries: deckIds,
    enemyId: enemy.id,
    tier: enemy.tier,
  });
  if (!battle) return { error: '无法开启试炼。' };
  G.sandboxBattle = battle;
  G.ui.reward = null;
  G.ui.modal = null;
  G.screen = 'battle';
  return battle;
}

export function retrySandboxBattle() {
  const current = G.sandboxBattle;
  if (!current) return null;
  if (current.mode === 'daily') return startDailyBattle();
  return startSandboxBattle(current.enemy.defId);
}

function syncTotals(battle) {
  if (!battle || battle.totalsSynced) return;
  battle.totalsSynced = true;
  if (G.run && battle.mode === 'adventure') {
    G.run.totals.cardsPlayed += battle.stats.cardsPlayed;
    G.run.totals.damageDealt += battle.stats.damageDealt;
    const world = G.profile.world;
    world.stats.cardsPlayed += battle.stats.cardsPlayed;
    if (battle.phase === 'victory') {
      G.run.totals.enemiesFelled += 1;
      G.profile.stats.enemiesFelled += 1;
      if (battle.tier === 'elite') world.stats.elites += 1;
    }
    saveProfileNow();
  }
}

function buildBattleRewards(battle) {
  if (battle.mode !== 'adventure' || !G.run) return null;
  const run = G.run;
  const tier = battle.tier || 'normal';
  let baseGold = 0;
  if (tier === 'normal') baseGold = randomInt(18, 28);
  else if (tier === 'elite') baseGold = randomInt(34, 46);
  else if (tier === 'merchant') baseGold = randomInt(80, 96);
  else baseGold = 50;
  const purseBonus = relicSum(run.relics, 'goldBonus');
  const goldScale = Number(run.ascensionModifiers?.goldScale) || 1;
  // 梦境变奏与梦呓契约的金币在缩放之后再加：它们买的不是「更多战利品」，
  // 而是这一局的规则。
  const mutationGold = (Number(run.mutationMods?.victoryGold) || 0)
    + (tier === 'boss' ? (Number(run.mutationMods?.bossGold) || 0) : 0);
  const contractGold = Number(run.contractMods?.victoryGold) || 0;
  const gold = Math.max(0, Math.round((baseGold + purseBonus) * goldScale)) + mutationGold + contractGold;
  run.gold += gold;

  let relic = null;
  if (tier === 'elite' || tier === 'merchant') {
    const relicId = pickRelicId(run);
    if (relicId) relic = acquireRelic(run, relicId);
    else run.gold += 30;
  }
  // 荆棘誓约的「治疗减半」也要管到战后回血，否则它只疼一半。
  const healScale = Math.max(0, Number(run.modifiers?.healScale) || 1)
    * Math.max(0, Number(run.mutationMods?.healScale) || 1)
    * Math.max(0, Number(run.contractMods?.healScale) || 1);
  const afterBattleHeal = Math.round(relicSum(run.relics, 'healAfterBattle') * healScale);
  if (afterBattleHeal > 0) {
    run.hp = Math.min(run.maxHp, run.hp + afterBattleHeal);
    battle.player.hp = Math.min(battle.player.hp + afterBattleHeal, battle.player.maxHp);
  }
  let itemId = null;
  if (tier === 'merchant' || tier === 'boss') itemId = pickItemId('rare');
  else if (tier === 'elite' || rand() < 0.28) itemId = pickItemId();
  const itemAdded = itemId ? addItemToRun(run, itemId) : 0;
  let itemGold = 0;
  if (itemId && itemAdded === 0) {
    itemGold = 18;
    run.gold += itemGold;
  }
  const resonance = runResonance(run);
  const rewardOptions = rewardSchoolOptions(resonance);
  const breadthBias = Boolean(
    rewardOptions.guaranteeSchools?.length === 2
    && rewardOptions.guaranteeSchools[0] !== resonance?.primary,
  );
  const splashBias = !breadthBias && resonance?.primary && rewardOptions.guaranteeSchools?.[1] !== resonance.primary
    ? rewardOptions.guaranteeSchools[1]
    : null;
  const splashBiasAlt = splashBias && rewardOptions.splashAlt ? rewardOptions.splashAlt : null;
  let cards = tier === 'boss' || tier === 'merchant' ? [] : pickCardRewards(3, null, rewardOptions);
  let hookCardId = null;
  if (!run.hookOffered && tier === 'normal' && cards.length) {
    const hook = pickHookCard(run);
    if (hook) {
      hookCardId = hook;
      cards = [hook, ...cards.filter((id) => id !== hook)];
    }
    run.hookOffered = true;
  }
  battle.rewards = {
    tier,
    gold,
    purseBonus,
    mutationGold,
    contractGold,
    afterBattleHeal,
    relic,
    item: itemId && itemAdded ? ITEM_MAP[itemId] : null,
    itemId: itemId && itemAdded ? itemId : null,
    itemLost: Boolean(itemId && !itemAdded),
    itemGold,
    cards,
    hookCardId,
    boss: tier === 'boss',
    merchant: tier === 'merchant',
    schoolBias: resonance?.primary || null,
    splashBias,
    splashBiasAlt,
    breadthBias,
    chorusBias: resonance?.chorus?.active
      ? resonance.chorus.schools
      : breadthBias
        ? rewardOptions.guaranteeSchools
        : null,
    fallbackGold: tier === 'elite' && !relic ? 30 : 0,
  };
  return battle.rewards;
}

function winBattle(battle) {
  if (!battle || battle.phase === 'victory' || battle.phase === 'defeat') return;
  battle.phase = 'victory';
  battle.player.hp = Math.max(0, battle.player.hp);
  addLog(battle, `${battle.enemy.name} 消散在梦境边缘。`, 'victory');
  if (battle.mode === 'adventure' && G.run) {
    const scar = applyLastStandCost(battle);
    G.run.hp = battle.player.hp;
    buildBattleRewards(battle);
    if (scar && battle.rewards) battle.rewards.lastStand = { scar, hpCost: scar.hpCost };
  }
  syncTotals(battle);
  if (battle.mode === 'daily') {
    battle.dailyResult = recordDailyWin(battle.daily?.key);
    battle.unlockedAchievements = evaluateAchievements('daily');
  } else if (battle.mode !== 'sandbox') {
    battle.unlockedAchievements = recordBattleOutcome(battle);
  }
}

function defeatBattle(battle) {
  if (!battle || battle.phase === 'victory' || battle.phase === 'defeat') return;
  battle.phase = 'defeat';
  battle.player.hp = 0;
  addLog(battle, '你的梦在这里终止了。', 'defeat');
  // 输了也留一点碎片：这一趟没走完，但它不该什么都不剩。
  // 碎片能扩卡池，也能在祭坛上换这趟梦的规则；两者都不是白给的加成。
  // 「失败有意义」和「失败也能变强」是两件事。
  if (battle.mode === 'adventure') {
    const fought = Math.max(1, Math.round((Number(battle.turn) || 1) / 3));
    G.profile.shards = Math.max(0, Number(G.profile.shards) || 0) + fought;
    saveProfileNow();
  }
  if (battle.mode === 'adventure' && G.run) {
    const stand = battle.lastStand;
    if (stand?.costPending) {
      stand.costPending = false;
      stand.costWaived = true;
    }
    const origin = ORIGIN_MAP[G.run.originId] || ORIGIN_MAP.blade;
    const companion = lastStandCompanion();
    battle.defeatRecap = {
      regionName: REGION_MAP[G.run.regionId]?.name || '梦境的裂隙',
      turn: Math.max(1, Number(battle.turn) || 1),
      enemyName: battle.enemy?.name || '梦魇',
      tier: battle.tier || 'normal',
      usedLastStand: Boolean(stand?.accepted),
      declinedLastStand: Boolean(stand?.offered && !stand.accepted),
      costWaived: Boolean(stand?.costWaived),
      companionName: companion?.npc.name || origin.name,
      companionGlyph: companion?.npc.glyph || origin.sigil,
      companionColor: companion?.npc.color || origin.color,
      companionBond: companion?.bond || 0,
      line: companion?.npc.defeatLine || origin.defeatLine || '梦把你留在了这一页。',
      scars: Array.isArray(G.run.scars) ? G.run.scars.slice(-4) : [],
      elegyId: null,
      elegyAvailable: false,
    };
    const world = G.profile?.world;
    if (world) {
      world.stats.defeats = (Number(world.stats.defeats) || 0) + 1;
      const elegyId = pickDefeatStory(world, {
        tier: battle.tier || battle.enemy?.tier,
        regionId: G.run.regionId,
      });
      battle.defeatRecap.elegyId = elegyId || null;
      battle.defeatRecap.elegyAvailable = Boolean(elegyId);
      saveProfileNow();
    }
    G.run.hp = 0;
    G.run.status = 'lost';
    if (G.run.endless) {
      G.profile.endlessBest = Math.max(Number(G.profile.endlessBest) || 0, Number(G.run.endlessCleared) || 0);
      saveProfileNow();
    }
  }
  syncTotals(battle);
}

/**
 * 往玩家手里塞梦蚀牌。
 * 优先塞进手牌（立刻占位），手牌满了才塞进弃牌堆（下一轮洗回来）。
 * 这是 boss「卡牌层面」的压力：它不直接打你，它让你的牌组变脏。
 */
function injectStatusCards(battle, cardId, count, fx = null) {
  const def = getCardDef(cardId);
  if (!def) return 0;
  let added = 0;
  for (let i = 0; i < count; i += 1) {
    const instance = { defId: cardId, upgraded: false, uid: uid('battlecard') };
    if (battle.hand.length < HAND_LIMIT) battle.hand.push(instance);
    else battle.discardPile.push(instance);
    added += 1;
  }
  if (added > 0) {
    addLog(battle, `${battle.enemy.name} 把 ${added} 张【${def.name}】塞进你的手里——它打不出去。`, 'mechanic');
    fx?.push({ target: 'player', kind: 'status', amount: added });
  }
  return added;
}

function maybeEnterBossSurge(battle, fx = null) {
  const enemy = battle?.enemy;
  const surge = enemy?.surge;
  if (!battle || !enemy || !surge || enemy.surged || enemy.hp <= 0) return null;
  const threshold = Math.max(1, Math.ceil(enemy.maxHp * (Number(surge.at) || 0.5)));
  if (enemy.hp > threshold) return null;
  enemy.surged = true;
  enemy.surgeTitle = surge.title || '梦魇暴走';
  if (surge.inject?.cardId) {
    injectStatusCards(battle, surge.inject.cardId, Number(surge.inject.count) || 1, fx);
  }
  if (surge.sealCount) {
    addLog(battle, `借名之雾不再只借一个名字：下个回合起会封住 ${surge.sealCount} 张手牌。`, 'phase');
  }
  if (surge.candleStep) {
    addLog(battle, `蜡烛开始成对熄灭：每个你的回合熄灭 ${surge.candleStep} 根。`, 'phase');
  }
  if (surge.surgeWeak) {
    addLog(battle, `涨潮的每一击会顺便把 ${surge.surgeWeak} 层虚弱按进你的伤口。`, 'phase');
  }
  addLog(battle, surge.line || `${enemy.name} 的梦魇规则暴走了。`, 'phase');
  addLog(battle, `${enemy.name} 进入梦魇暴走——【${enemy.surgeTitle}】。`, 'phase');
  const surgeFx = {
    target: 'enemy',
    kind: 'surge',
    title: enemy.surgeTitle,
    line: surge.line || '',
    accent: enemy.accent,
  };
  fx?.push(surgeFx);
  return surgeFx;
}

function maybeEnterBossPhase(battle, fx = null) {
  const enemy = battle?.enemy;
  if (!battle || !enemy) return null;
  maybeEnterBossSurge(battle, fx);
  const phase2 = enemy.phase2;
  if (!phase2) return null;
  if ((Number(enemy.phase) || 1) >= 2 || enemy.hp <= 0) return null;
  const threshold = Math.max(1, Math.ceil(enemy.maxHp * (Number(phase2.at) || 0.5)));
  if (enemy.hp > threshold) return null;

  enemy.phase = 2;
  enemy.phaseTitle = phase2.title || '二阶段';
  enemy.block = 0;
  if (phase2.cleanse) {
    for (const status of ['poison', 'burn', 'weak', 'vulnerable']) {
      delete enemy.statuses[status];
    }
  }
  enemy.moves = phase2.moves.map((move) => ({ ...move }));
  enemy.pattern = [...phase2.pattern];
  enemy.moveIndex = 0;

  // 后期反制：二阶段直接改规则，而不是把血量调厚。
  //   禁疗 —— 恢复牌失效，逼你换一套活法
  //   反弹 —— 每次攻击都要自付一部分伤害，纯输出流会反噬自己
  //   拆引擎 —— 每回合弃掉你手里最贵的一张牌，专门打断连招
  if (phase2.noHeal) {
    battle.rules.noHeal = true;
    addLog(battle, '这里的伤口不会愈合——本场战斗无法回复生命。', 'phase');
  }
  if (phase2.reflectPct) {
    battle.rules.reflectPct = Math.max(0, Number(phase2.reflectPct) || 0);
    addLog(battle, `反震：你每次直接攻击它，都要自付 ${Math.round(battle.rules.reflectPct * 100)}% 的伤害。毒与灼烧不在此列。`, 'phase');
  }
  if (phase2.echoBreak) {
    battle.rules.echoBreak = true;
    addLog(battle, '它开始拆你的手牌——每个回合你都要丢一张。', 'phase');
  }
  if (phase2.burnPlayed) {
    battle.rules.burnPlayed = true;
    // 只焚「每回合第一张攻击牌」。
    // 旧规则把每一次攻击都烧掉：高频攻击流派（尤其剑客）打到二阶段
    // 会亲眼看着自己的牌组被抽空，这不是「怕快」，是直接没收牌组。
    // 现在慢才疼——杀得越久，被吞掉的攻击牌越多；速杀只损失几张。
    battle.rules.burnTurn = battle.turn;
    addLog(battle, '炉火舔上你的手：从下个回合起，你每回合打出的第一张攻击牌会被烧掉，不会回到弃牌堆。', 'phase');
  }
  // 二阶段的「卡牌层面」压力：往你手里塞打不出去的梦蚀页。
  // 它不会直接扣血，但会稀释你的抽牌——牌组越薄，被污染得越狠。
  if (phase2.inject?.cardId) {
    injectStatusCards(battle, phase2.inject.cardId, Number(phase2.inject.count) || 1, fx);
  }
  // 「它学会了你的流派」：只有当某一派占了你流派牌的 70% 以上时才会生效。
  // 这是纯流派真正的天花板——不是数值不够，是这条路被看穿了。
  // 混搭玩家（主导派 <65%）压根不会触发，这正是「学会混搭」的回报：
  // 它不只是多一点攻击加成，而是让终章对你少一条规则。
  if (phase2.silenceTopSchool) {
    const resonance = battle.resonance;
    const topShare = Number(resonance?.topShare) || 0;
    if (resonance?.primary && topShare >= 0.7) {
      const name = resonance.school?.name || resonance.primary;
      // 封共鸣，但只降到 I 档，不是关掉。
      // 完全关掉对抽牌流是毁灭性的（奶蛙蛙纯派直接 2%）：
      // 它的一套循环都挂在「遗梦多抽」上，抽牌一停，狂笑也触发不了。
      // 降到 I 档才是「被看穿」的手感：还打得动，但明显不如原来顺。
      const info = resonance.info;
      const lowest = Array.isArray(info?.values) ? Number(info.values[0]) || 1 : 1;
      battle.rules.silenceSchool = resonance.primary;
      battle.resonance = {
        ...resonance,
        tier: 1,
        value: lowest,
        rawTier: resonance.tier,
        silenced: resonance.primary,
      };
      addLog(battle, `它学会了你的【${name}】——这一派的共鸣在它面前失效了。`, 'phase');
      fx?.push({ target: 'enemy', kind: 'resonance', name: '缄默', amount: 0 });
    } else {
      addLog(battle, '它想学会你的路数，但你没有一条主导的路——它抓了个空。', 'phase');
      fx?.push({ target: 'enemy', kind: 'resonance', name: '缄默落空', amount: 0 });
    }
  }
  addLog(battle, `${phase2.line || `${enemy.name} 撕开了旧梦。`}`, 'phase');
  addLog(battle, `${enemy.name} 露出了真形——【${enemy.phaseTitle}】。`, 'phase');
  if (phase2.cleanse) addLog(battle, '旧日的毒、灼烧与诅咒被新形态一并焚尽。', 'phase');
  if (phase2.block) {
    enemy.block += Number(phase2.block) || 0;
    fx?.push({ target: 'enemy', kind: 'block', amount: enemy.block });
    addLog(battle, `${enemy.name} 展开 ${enemy.block} 点新的格挡。`, 'block');
  }
  if (phase2.selfStatus) {
    addStatus(enemy, phase2.selfStatus.status, phase2.selfStatus.amount);
    fx?.push({
      target: 'enemy',
      kind: 'status',
      status: phase2.selfStatus.status,
      amount: phase2.selfStatus.amount,
    });
    addLog(
      battle,
      `${enemy.name} 获得 ${phase2.selfStatus.amount} 层${STATUS_INFO[phase2.selfStatus.status]?.name || ''}。`,
      'enemyBuff',
    );
  }
  if (phase2.heal) {
    const before = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + Number(phase2.heal));
    if (enemy.hp > before) {
      fx?.push({ target: 'enemy', kind: 'heal', amount: enemy.hp - before });
    }
  }

  const phaseFx = {
    target: 'enemy',
    kind: 'phase',
    title: enemy.phaseTitle,
    line: phase2.line || '',
    accent: enemy.accent,
    block: Number(phase2.block) || 0,
  };
  fx?.push(phaseFx);
  return phaseFx;
}

export function attackEnemy(battle, base, hits = 1) {
  let totalRaw = 0;
  let totalBlocked = 0;
  let totalLoss = 0;
  const hitCount = Math.max(1, Number(hits) || 1);
  const bladeBonus = battle.resonanceState?.bladeBoost || 0;
  const chorusBonus = battle.resonanceState?.chorusAtk || 0;
  // 燃梦：每回合第一张攻击牌吃到加成。按「牌」而不是按「段」，
  // 多段牌每段都吃到会把这个变奏变成剑客的专属红利。
  const mutationBonus = battle.rules?.firstAttackArmed
    ? Math.max(0, Number(battle.rules.firstAttackBonus) || 0)
    : 0;
  if (mutationBonus > 0) battle.rules.firstAttackArmed = false;
  for (let index = 0; index < hitCount; index += 1) {
    if (battle.enemy.hp <= 0) break;
    // 剑鸣与混响都按段结算：剑派的价值本来就在多段，
    // 如果混响只认第一段，混搭对剑客就是纯亏——他会发现自己一混就没伤害。
    // 数值由 resonance.js 控制（混响单层 2~4），不靠段数限制来压。
    const bonus = bladeBonus + chorusBonus + (index === 0 ? mutationBonus : 0);
    const raw = calcAttackPerHit(base + bonus, battle.player, battle.enemy);
    const result = hitEntity(battle.enemy, raw);
    totalRaw += result.raw;
    totalBlocked += result.blocked;
    totalLoss += result.hpLoss;
    if (result.hpLoss > 0) battle.stats.damageDealt += result.hpLoss;
  }
  const blockText = totalBlocked > 0 ? `（护甲抵消 ${totalBlocked}）` : '';
  const mutationText = mutationBonus > 0 ? `（燃梦 +${mutationBonus}）` : '';
  addLog(battle, `你造成 ${totalRaw} 点伤害${blockText}${mutationText}。`, 'damage');
  const fx = [{ target: 'enemy', kind: 'damage', amount: totalRaw, hpLoss: totalLoss }];
  // 反震：伤害不是免费的。纯攻流在这里第一次会疼。
  const reflectPct = Number(battle.rules?.reflectPct) || 0;
  if (reflectPct > 0 && totalLoss > 0) {
    // 低于 1 点就不弹。原来用 Math.max(1, ...)，等于「每次挥刀至少自损 1 点」——
    // 2 点伤害的小牌被弹回 1 点，高频低伤流派（术士的星屑、灵火）被悄悄判死：
    // 实测术士对镜潮的纯派胜率是 0%。反震该惩罚「重击」，不是惩罚「出牌次数」。
    const back = Math.round(totalLoss * reflectPct);
    if (back > 0) {
      const recoil = hitEntity(battle.player, back);
      battle.stats.damageTaken += recoil.hpLoss;
      addLog(battle, `反震弹回 ${back} 点——你打得多重，就疼得多重。`, 'mechanic');
      fx.push({ target: 'player', kind: 'damage', amount: back, hpLoss: recoil.hpLoss });
      if (battle.player.hp <= 0) {
        defeatBattle(battle);
        return { fx, raw: totalRaw, blocked: totalBlocked, hpLoss: totalLoss };
      }
    }
  }
  // 敌人的荆棘：A6+ 与「列阵 / 棘冠」都靠这一条真正生效。
  // 一次攻击牌只弹一次，且只弹固定层数——否则多段攻击会被重复收税。
  const enemyThorns = Math.max(0, Number(battle.enemy.statuses.thorns) || 0);
  if (enemyThorns > 0 && totalRaw > 0 && battle.enemy.hp > 0) {
    const recoil = hitEntity(battle.player, enemyThorns);
    battle.stats.damageTaken += recoil.hpLoss;
    addLog(battle, `${battle.enemy.name} 的荆棘反伤 ${enemyThorns} 点${recoil.blocked ? `（格挡抵消 ${recoil.blocked}）` : ''}。`, 'thorns');
    fx.push({ target: 'player', kind: 'thorns', amount: enemyThorns, hpLoss: recoil.hpLoss });
    if (battle.player.hp <= 0) {
      defeatBattle(battle);
      return { fx, raw: totalRaw, blocked: totalBlocked, hpLoss: totalLoss };
    }
  }
  if (battle.enemy.hp <= 0) winBattle(battle);
  else maybeEnterBossPhase(battle, fx);
  return {
    fx,
    raw: totalRaw,
    blocked: totalBlocked,
    hpLoss: totalLoss,
  };
}

const ENEMY_PRESSURE_CAP = 6;

/**
 * 梦蚀：战斗中后期的渐进压力。
 * 旧版：第 4 回合起每 2 回合 +1，上限 +4——首领血量提高以后，
 * 战斗自然会拖到第 10 回合以后，旧曲线等于后半程没有压力。
 *
 * 现在：第 3 回合起，每 2 回合 +1，上限 +6。
 * 开局两回合仍然安全，但拖到第 13 回合后每击都要额外吃 6 点。
 */
function enemyPressure(battle) {
  const turn = Number(battle?.turn) || 1;
  if (turn < 3) return 0;
  return Math.min(6, Math.floor((turn - 1) / 2));
}

/**
 * 梦蚀只在「每次挥击」上生效一次，不乘 hits。
 * 多段招每段都很低，若按段加成会变成 7×4 → 13×4，惩罚被放大 4 倍。
 */
function pressurePerHit(battle, rawDamage) {
  const base = Math.max(1, Number(rawDamage) || 0);
  return Math.min(base, enemyPressure(battle));
}

/**
 * 敌人这一招会打出多少——**预览与结算的唯一来源**。
 *
 * 以前这条公式有两份：previewEnemyAttack 用 move.damage + damageBonus，
 * 实际结算却还要乘 powerScale、乘潮汐系数，而力量只加第一段。
 * 结果潮钟涨潮的「停钟一击」意图写 17、实际打 39——玩家按意图留格挡，
 * 然后被两倍的伤害打脸。这不是数值问题，是同一件事算了两遍。
 *
 * 现在只有这一处。谁想知道「这一招有多疼」，都必须走这里。
 */
export function enemyMoveProfile(battle, move) {
  if (!battle || !move) return null;
  const hits = Math.max(1, Number(move.hits) || 1);
  // powerScale 是「这座岛有多深」的旋钮：只缩放招式基础伤害，不缩放力量。
  const powerScale = Math.max(0.5, Number(battle.enemy.powerScale) || 1);
  // 潮汐：涨潮它被海托高，退潮它退回水下。只有挂了规则的战斗才缩放。
  const tideHigh = battle.rules?.tideHigh;
  const tideScale = tideHigh === true ? 1.35 : tideHigh === false ? 0.8 : 1;
  const perHit = Math.round((Number(move.damage) || 0) * powerScale * tideScale);
  // 力量、岛层加成、梦蚀都只在第一段结算一次。
  // 按段加成会让 4 段招吃 4 倍力量，实测直接把剑客打到 30%。
  const flat = (Number(battle.enemy.damageBonus) || 0)
    + enemyPressure(battle)
    + (Number(battle.enemy.statuses?.strength) || 0);

  const segments = [];
  for (let index = 0; index < hits; index += 1) {
    segments.push(calcAttackPerHit(perHit + (index === 0 ? flat : 0), battle.enemy, battle.player, { skipStrength: true }));
  }
  const total = segments.reduce((sum, value) => sum + value, 0);
  return { move, hits, perHit, flat, segments, total, first: segments[0] || 0 };
}

function enemyAttackPlayer(battle, move, fx) {
  const profile = enemyMoveProfile(battle, move);
  if (!profile) return true;
  const { segments, total } = profile;
  const pressure = enemyPressure(battle);
  let totalRaw = 0;
  let totalBlocked = 0;
  let totalLoss = 0;
  for (const raw of segments) {
    if (battle.player.hp <= 0) break;
    const result = hitEntity(battle.player, raw);
    totalRaw += result.raw;
    totalBlocked += result.blocked;
    totalLoss += result.hpLoss;
    battle.stats.damageTaken += result.hpLoss;
  }
  addLog(
    battle,
    `${battle.enemy.name} 造成 ${totalRaw} 点伤害${totalBlocked ? `（格挡抵消 ${totalBlocked}）` : ''}${pressure ? `（梦蚀 +${pressure}）` : ''}。`,
    'enemyDamage',
  );
  fx.push({ target: 'player', kind: 'damage', amount: totalRaw, hpLoss: totalLoss });
  if (battle.player.hp > 0 && totalLoss > 0) addOriginProgress(battle, 1, fx, 'heat');
  if (battle.player.hp <= 0) {
    defeatBattle(battle);
    return false;
  }
  // 风暴潮：涨潮时它每一击都会把虚弱按进伤口。
  const surgeWeak = battle.enemy.surged
    ? Math.max(0, Number(battle.enemy.surge?.surgeWeak) || 0)
    : 0;
  if (surgeWeak > 0 && battle.rules?.tideHigh && totalRaw > 0 && battle.enemy.hp > 0) {
    addStatus(battle.player, 'weak', surgeWeak);
    fx.push({ target: 'player', kind: 'status', status: 'weak', amount: surgeWeak });
    addLog(battle, `风暴潮灌进伤口：你获得 ${surgeWeak} 层虚弱。`, 'debuff');
  }
  // 燃梦：只要它真的挥出了这一击，火星就会留在你身上——哪怕被格挡也一样。
  const mutationBurn = Math.max(0, Number(battle.rules?.enemyHitBurn) || 0);
  if (mutationBurn > 0 && totalRaw > 0 && battle.enemy.hp > 0) {
    addStatus(battle.player, 'burn', mutationBurn);
    fx.push({ target: 'player', kind: 'status', status: 'burn', amount: mutationBurn });
    addLog(battle, `燃梦的火星落进衣领：你获得 ${mutationBurn} 层灼烧。`, 'burn');
  }
  // 残响：每回合第一次真的掉血时，疼会替你翻一张牌。
  const echoDraw = Math.max(0, Number(battle.rules?.firstHitDraw) || 0);
  if (echoDraw > 0 && totalLoss > 0 && battle.enemy.hp > 0 && battle.rules.firstHitDrawTurn !== battle.turn) {
    battle.rules.firstHitDrawTurn = battle.turn;
    const drawn = drawCards(battle, echoDraw, false);
    if (drawn > 0) {
      addLog(battle, `残响从伤口里折返：你抽到 ${drawn} 张牌。`, 'draw');
      fx.push({ target: 'player', kind: 'draw', amount: drawn });
    }
  }
  const thorns = battle.player.statuses.thorns || 0;
  if (thorns > 0 && totalRaw > 0 && battle.enemy.hp > 0) {
    const reflected = hitEntity(battle.enemy, thorns);
    battle.stats.damageDealt += reflected.hpLoss;
    addLog(battle, `荆棘反伤 ${thorns} 点${reflected.blocked ? `（被护甲抵消 ${reflected.blocked}）` : ''}。`, 'thorns');
    fx.push({ target: 'enemy', kind: 'thorns', amount: thorns, hpLoss: reflected.hpLoss });
    if (battle.enemy.hp <= 0) {
      winBattle(battle);
      return false;
    }
    recordMirrorDamage(battle, reflected.hpLoss, fx);
    if (battle.phase === 'defeat') return false;
    maybeEnterBossPhase(battle, fx);
  }
  const mech = battle.enemy.mechanic;
  if (mech?.id === 'dragonScorch' && totalRaw > 0 && battle.enemy.hp > 0) {
    const burn = (Number(battle.enemy.phase) || 1) >= 2 ? 2 : 1;
    addStatus(battle.player, 'burn', burn);
    fx.push({ target: 'player', kind: 'status', status: 'burn', amount: burn });
    addLog(battle, `龙焰缠上你，获得 ${burn} 层灼烧。`, 'burn');
  }
  return true;
}

function applyEnemyMove(battle, move) {
  const fx = [];
  const lineage = enemyLineageDef(battle);
  battle.enemy.block = 0;
  addLog(battle, `${battle.enemy.name} 使用【${move.name}】。`, 'enemyAction');
  if (move.block) {
    battle.enemy.block += move.block;
    fx.push({ target: 'enemy', kind: 'block', amount: move.block });
    addLog(battle, `${battle.enemy.name} 获得 ${move.block} 点格挡。`, 'block');
    if (lineage?.thornsPerBlock) {
      const current = Number(battle.enemy.statuses.thorns) || 0;
      const gain = Math.min(lineage.thornsPerBlock, Math.max(0, lineage.thornsCap - current));
      if (gain > 0) {
        addStatus(battle.enemy, 'thorns', gain);
        fx.push({ target: 'enemy', kind: 'status', status: 'thorns', amount: gain });
        addLog(battle, `列阵把格挡变成荆棘：${battle.enemy.name} 长到 ${current + gain} 层。`, 'mechanic');
      }
    }
  }
  if (move.selfStatus) {
    addStatus(battle.enemy, move.selfStatus.status, move.selfStatus.amount);
    fx.push({ target: 'enemy', kind: 'status', status: move.selfStatus.status, amount: move.selfStatus.amount });
    addLog(
      battle,
      `${battle.enemy.name} 获得 ${move.selfStatus.amount} 层${STATUS_INFO[move.selfStatus.status]?.name || ''}。`,
      'enemyBuff',
    );
  }
  if (move.stealStatus) {
    const status = move.stealStatus.status;
    const wanted = Math.max(0, Number(move.stealStatus.amount) || 0);
    const available = Math.min(wanted, Number(battle.player.statuses[status]) || 0);
    if (available > 0) {
      addStatus(battle.player, status, -available);
      addStatus(battle.enemy, status, available);
      fx.push({ target: 'enemy', kind: 'status', status, amount: available });
      addLog(battle, `${battle.enemy.name} 从你身上夺走 ${available} 层${STATUS_INFO[status]?.name || ''}，据为己有。`, 'mechanic');
    } else {
      addLog(battle, `${battle.enemy.name} 想夺走你的${STATUS_INFO[status]?.name || '力量'}，却什么都没抓到。`, 'mechanic');
    }
  }
  if (move.heal) {
    let heal = Number(move.heal) || 0;
    if (lineage?.healThornsCost) {
      const current = Number(battle.enemy.statuses.thorns) || 0;
      if (current >= lineage.healThornsCost) {
        battle.enemy.statuses.thorns = current - lineage.healThornsCost;
        heal += lineage.healBonus;
        addLog(battle, `玫瑰汲取吞下 ${lineage.healThornsCost} 层荆棘，额外回复 ${lineage.healBonus} 点生命。`, 'mechanic');
      }
    }
    const before = battle.enemy.hp;
    battle.enemy.hp = Math.min(battle.enemy.maxHp, battle.enemy.hp + heal);
    const healed = battle.enemy.hp - before;
    fx.push({ target: 'enemy', kind: 'heal', amount: healed });
    addLog(battle, `${battle.enemy.name} 回复 ${healed} 点生命。`, 'enemyHeal');
  }
  if (move.damage) {
    const alive = enemyAttackPlayer(battle, move, fx);
    if (!alive) return fx;
  }
  if (move.playerStatus) {
    addStatus(battle.player, move.playerStatus.status, move.playerStatus.amount);
    fx.push({ target: 'player', kind: 'status', status: move.playerStatus.status, amount: move.playerStatus.amount });
    addLog(
      battle,
      `你被施加了 ${move.playerStatus.amount} 层${STATUS_INFO[move.playerStatus.status]?.name || ''}。`,
      'debuff',
    );
  }
  if (move.stealCard) {
    const pool = [...battle.drawPile, ...battle.discardPile].filter((card) => {
      const def = resolveCard(getCardDef(card.defId), card.upgraded);
      return def && def.type !== 'status';
    });
    if (pool.length) {
      pool.sort((left, right) => {
        const a = resolveCard(getCardDef(left.defId), left.upgraded);
        const b = resolveCard(getCardDef(right.defId), right.upgraded);
        return (Number(b?.cost) || 0) - (Number(a?.cost) || 0);
      });
      const victim = pool[0];
      battle.drawPile = battle.drawPile.filter((card) => card !== victim);
      battle.discardPile = battle.discardPile.filter((card) => card !== victim);
      const def = resolveCard(getCardDef(victim.defId), victim.upgraded);
      battle.enemy.stolen = [...(battle.enemy.stolen || []), {
        uid: victim.uid,
        defId: victim.defId,
        upgraded: Boolean(victim.upgraded),
        returnTurn: battle.turn + 2,
      }];
      addLog(battle, `${battle.enemy.name} 借走了【${def?.name || '一张牌'}】——2 个回合后才会归还。`, 'mechanic');
      fx.push({ target: 'player', kind: 'seal', amount: 1 });
    } else {
      addLog(battle, `${battle.enemy.name} 伸手去摸你的牌，却只抓到一把雾。`, 'mechanic');
    }
  }
  return fx;
}

function applyMerchantItem(battle, item, fx) {
  if (!item) return;
  const enemy = battle.enemy;
  const player = battle.player;
  addLog(battle, `${enemy.name} 从货袋里取出了【${item.name}】。`, 'enemyAction');
  switch (item.kind) {
    case 'heal': {
      const before = enemy.hp;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + (Number(item.amount) || 0));
      const healed = enemy.hp - before;
      if (healed > 0) fx.push({ target: 'enemy', kind: 'heal', amount: healed });
      addLog(battle, `${enemy.name} 回复 ${healed} 点生命。`, 'enemyHeal');
      break;
    }
    case 'block': {
      const block = Number(item.amount) || 0;
      enemy.block += block;
      fx.push({ target: 'enemy', kind: 'block', amount: block });
      addLog(battle, `${enemy.name} 获得 ${block} 点格挡。`, 'block');
      break;
    }
    case 'strength': {
      const amount = Number(item.amount) || 0;
      addStatus(enemy, 'strength', amount);
      fx.push({ target: 'enemy', kind: 'status', status: 'strength', amount });
      addLog(battle, `${enemy.name} 获得 ${amount} 层力量。`, 'enemyBuff');
      break;
    }
    case 'poison': {
      const amount = Number(item.amount) || 0;
      addStatus(player, 'poison', amount);
      fx.push({ target: 'player', kind: 'status', status: 'poison', amount });
      addLog(battle, `你被灌入了 ${amount} 层中毒。`, 'debuff');
      break;
    }
    case 'burn': {
      const amount = Number(item.amount) || 0;
      addStatus(player, 'burn', amount);
      fx.push({ target: 'player', kind: 'status', status: 'burn', amount });
      addLog(battle, `你被泼上了 ${amount} 层灼烧。`, 'debuff');
      break;
    }
    case 'damage': {
      const raw = calcAttackPerHit((Number(item.amount) || 0) + (Number(enemy.damageBonus) || 0), enemy, player);
      const result = hitEntity(player, raw);
      battle.stats.damageTaken += result.hpLoss;
      fx.push({ target: 'player', kind: 'damage', amount: result.raw, hpLoss: result.hpLoss });
      addLog(battle, `雷鸣石砸出 ${result.raw} 点伤害${result.blocked ? `（格挡抵消 ${result.blocked}）` : ''}。`, 'enemyDamage');
      if (player.hp <= 0) defeatBattle(battle);
      break;
    }
    case 'cleanse': {
      for (const status of ['poison', 'burn', 'weak', 'vulnerable']) delete enemy.statuses[status];
      addLog(battle, `${enemy.name} 喝下净心露，清除了自身所有负面状态。`, 'enemyBuff');
      break;
    }
    case 'weaken': {
      const block = Number(item.block) || 0;
      const amount = Number(item.amount) || 0;
      enemy.block += block;
      addStatus(player, 'weak', amount);
      fx.push({ target: 'enemy', kind: 'block', amount: block });
      fx.push({ target: 'player', kind: 'status', status: 'weak', amount });
      addLog(battle, `${enemy.name} 借着烟雾获得 ${block} 点格挡，你获得 ${amount} 层虚弱。`, 'debuff');
      break;
    }
    case 'blood': {
      const before = enemy.hp;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + (Number(item.amount) || 0));
      const healed = enemy.hp - before;
      const strength = Number(item.strength) || 0;
      addStatus(enemy, 'strength', strength);
      fx.push({ target: 'enemy', kind: 'heal', amount: healed });
      fx.push({ target: 'enemy', kind: 'status', status: 'strength', amount: strength });
      addLog(battle, `${enemy.name} 回复 ${healed} 点生命，获得 ${strength} 层力量。`, 'enemyBuff');
      break;
    }
    case 'elixir': {
      const before = enemy.hp;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + (Number(item.amount) || 0));
      const healed = enemy.hp - before;
      const block = Number(item.block) || 0;
      enemy.block += block;
      fx.push({ target: 'enemy', kind: 'heal', amount: healed });
      fx.push({ target: 'enemy', kind: 'block', amount: block });
      addLog(battle, `${enemy.name} 灌下万象灵药，回复 ${healed} 点生命并获得 ${block} 点格挡。`, 'enemyHeal');
      break;
    }
    case 'escape': {
      const block = Number(item.amount) || 0;
      const weak = Number(item.weaken) || 0;
      enemy.block += block;
      addStatus(player, 'weak', weak);
      fx.push({ target: 'enemy', kind: 'block', amount: block });
      fx.push({ target: 'player', kind: 'status', status: 'weak', amount: weak });
      addLog(battle, `${enemy.name} 撒出逃命烟，获得 ${block} 点格挡，你获得 ${weak} 层虚弱。`, 'debuff');
      break;
    }
    default:
      break;
  }
}

function merchantUseItems(battle, fx) {
  const mech = battle.enemy.mechanic;
  if (!mech) return;
  const ratio = battle.enemy.maxHp > 0 ? battle.enemy.hp / battle.enemy.maxHp : 0;
  const uses = ratio <= 0.25 ? 3 : ratio <= 0.5 ? 2 : 1;
  let used = 0;
  for (let index = 0; index < uses; index += 1) {
    if ((Number(mech.value) || 0) <= 0) break;
    if (battle.phase !== 'enemy') break;
    const item = pick(MERCHANT_ITEMS);
    mech.value = Math.max(0, (Number(mech.value) || 0) - 1);
    used += 1;
    applyMerchantItem(battle, item, fx);
    if (battle.player.hp <= 0) break;
  }
  if (used > 0) {
    addLog(battle, `${battle.enemy.name} 的货袋还剩 ${mech.value} 件道具。`, 'mechanic');
    fx.push({ target: 'enemy', kind: 'mechanic', mechanic: 'merchantBag', value: mech.value });
  } else if ((Number(mech.value) || 0) <= 0) {
    addLog(battle, `${battle.enemy.name} 拍了拍空货袋，脸色变了一瞬。`, 'mechanic');
  }
}

function enemyTurnEndMechanics(battle, fx) {
  if (battle.phase !== 'enemy') return;
  applyLineageTurnEnd(battle, fx);
  if (battle.phase !== 'enemy') return;
  const mech = battle.enemy?.mechanic;
  if (!mech) return;
  const phase2 = (Number(battle.enemy.phase) || 1) >= 2;
  if (mech.id === 'heartPulse') {
    mech.value = (Number(mech.value) || 0) + 1;
    // 设计约束：玩家每回合输出约 15~18 点（3 能量 × 6 点/能量）。
    // 回血一旦接近这个数，玩家就永远打不死它 —— 那不是「难」，是「无敌」。
    // 所以整体回血总额设上限（最多 5 次搏动），且二阶段每次只回 5 点。
    const interval = 2;
    const totalBeats = Number(battle.enemy.beatCount) || 0;
    if (mech.value >= interval && totalBeats < 4) {
      mech.value = 0;
      battle.enemy.beatCount = totalBeats + 1;
      // 心岛逼你打出「爆发窗口」：它每两回合回一次，回得比你的平均输出少一点，
      // 但足够抵消那些「每回合稳定小输出」的构筑。原来 3/4 点回血等于没有。
      const heal = phase2 ? 6 : 4;
      const before = battle.enemy.hp;
      battle.enemy.hp = Math.min(battle.enemy.maxHp, battle.enemy.hp + heal);
      fx.push({ target: 'enemy', kind: 'heal', amount: battle.enemy.hp - before });
      addLog(battle, `心搏响起：${battle.enemy.name} 回复 ${battle.enemy.hp - before} 点生命。`, 'mechanic');
    } else if (mech.value >= interval) {
      mech.value = 0;
      addLog(battle, `${battle.enemy.name} 的心跳变弱了，再也回不到从前。`, 'mechanic');
    }
  }
  if (mech.id === 'paperCut') {
    // 剪稿从「弃牌堆」改到「手牌」。
    // 剪弃牌堆的牌下回合本来就要洗回来，玩家当场毫无感觉——
    // 剪手牌才是「她正在删掉你这一回合的计划」，而且优先剪最贵的那张。
    // 上限仍然是 3 张：无限剪会让牌越少→输出越低→打得越久→剪得越多，
    // 那是不可逆的死循环。
    const cap = 3;
    const total = Number(battle.enemy.cutTotal) || 0;
    if (total >= cap) {
      addLog(battle, `${battle.enemy.name} 的剪刀钝了——这一场她剪不动更多了。`, 'mechanic');
    } else if (battle.hand.length > 2) {
      const sorted = [...battle.hand].sort((a, b) => {
        const ca = CARD_MAP[a.defId]?.cost ?? 0;
        const cb = CARD_MAP[b.defId]?.cost ?? 0;
        if (cb !== ca) return cb - ca;
        return (CARD_MAP[b.defId]?.effects || []).length - (CARD_MAP[a.defId]?.effects || []).length;
      });
      const cuts = Math.min(phase2 ? 2 : 1, cap - total, battle.hand.length - 2);
      let cut = 0;
      for (let index = 0; index < cuts; index += 1) {
        const victim = sorted[index];
        if (!victim) break;
        battle.hand = battle.hand.filter((item) => item.uid !== victim.uid);
        battle.exhaustPile.push(victim);
        cut += 1;
      }
      if (cut > 0) {
        battle.enemy.cutTotal = total + cut;
        mech.value = (Number(mech.value) || 0) + cut;
        fx.push({ target: 'player', kind: 'cut', amount: cut });
        addLog(battle, `剪稿：${battle.enemy.name} 从你手里剪走了 ${cut} 张牌，她挑的是最贵的那些。`, 'mechanic');
      }
    }
  }
  if (mech.id === 'tideRhythm' && (Number(mech.value) || 0) === 1) {
    // 涨潮：护甲 + 涨潮叠 1 层力量，让「等潮退」不是无脑最优
    const block = phase2 ? 10 : 7;
    battle.enemy.block += block;
    addStatus(battle.enemy, 'strength', 1);
    fx.push({ target: 'enemy', kind: 'block', amount: block });
    fx.push({ target: 'enemy', kind: 'status', status: 'strength', amount: 1 });
    addLog(battle, `涨潮托起它的护甲：${battle.enemy.name} 获得 ${block} 点格挡与 1 层力量。`, 'mechanic');
  }
  if (mech.id === 'merchantBag') {
    merchantUseItems(battle, fx);
  }
}

/**
 * 镜海复写：把「你造成的伤害」记进镜面。
 *
 * 旧实现只记攻击牌的直接伤害，于是毒、灼烧、狂笑、星屑、荆棘全都白打——
 * 暮影行者对镜潮之主 100% 胜率，而直伤流被反震与复写双重抽税，只剩四成。
 * 「每一点伤害」就该是每一点：不管刀砍的还是毒渗的，镜子都记得。
 */
function recordMirrorDamage(battle, dealt, fx = null) {
  const mech = battle.enemy?.mechanic;
  if (!mech || mech.id !== 'mirrorReplica') return;
  if (battle.phase === 'victory' || battle.phase === 'defeat' || battle.enemy.hp <= 0) return;
  const amount = Math.max(0, Number(dealt) || 0);
  if (amount <= 0) return;
  mech.value = (Number(mech.value) || 0) + amount;
  const threshold = mirrorThreshold(battle);
  if (mech.value < threshold) return;
  mech.value = 0;
  const damage = mirrorReplicaDamage(battle);
  battle.player.hp = Math.max(0, battle.player.hp - damage);
  battle.stats.damageTaken += damage;
  addLog(battle, `镜海复写：镜中的你也挥出了那一刀，你失去 ${damage} 点生命（格挡无用）。`, 'mechanic');
  fx?.push({ target: 'player', kind: 'damage', amount: damage, hpLoss: damage, ignoreBlock: true });
  if (battle.player.hp <= 0) defeatBattle(battle);
}

function applyCardPlayMechanic(battle, card, fx, context = null) {
  if (battle.phase !== 'player') return;
  applyLineageCardPlay(battle, card, fx);
  if (battle.phase !== 'player') return;
  const mech = battle.enemy?.mechanic;
  if (!mech) return;
  if (mech.id === 'mirrorReplica') {
    recordMirrorDamage(battle, context?.dealt, fx);
  }
  if (mech.id === 'ashFurnace') {
    // 炉温按「回合」计，不按「打出的牌数」计。
    // 旧版每张伤害牌 +1，等于惩罚高频低伤流派（术士的星屑、灵火）——
    // 它们砍得轻、砍得多，炉子却和重击流一样快地吃饱，这是误伤。
    // 现在只有「这个回合你确实伤到了它」才 +1，一场拖得越久，它吞的名字越多。
    // 这正是它该怕的东西：不是狠，是快。
    const dealtDirect = (card.effects || []).some((e) => e.type === 'damage');
    if (!dealtDirect) return;
    if (battle.rules?.ashHeatTurn === battle.turn) return;
    battle.rules.ashHeatTurn = battle.turn;
    mech.value = (Number(mech.value) || 0) + 1;
    if (mech.value >= 5) {
      mech.value = 0;
      const before = battle.enemy.hp;
      // 焚名炉惩罚「慢」：它每吞下一个名字就回一截血。
      // 原来 5 点回血对 128 血的它毫无意义，玩家可以慢慢磨——
      // 现在回 9 点并叠力量，拖得越久越难收尾，逼你算好节奏。
      battle.enemy.hp = Math.min(battle.enemy.maxHp, battle.enemy.hp + 9);
      addStatus(battle.enemy, 'strength', 1);
      fx.push({ target: 'enemy', kind: 'heal', amount: battle.enemy.hp - before });
      fx.push({ target: 'enemy', kind: 'status', status: 'strength', amount: 1 });
      addLog(battle, `焚名炉吞下一个名字：${battle.enemy.name} 回复 ${battle.enemy.hp - before} 点生命并获得 1 层力量。`, 'mechanic');
    } else {
      addLog(battle, `炉温升到 ${mech.value}/5。`, 'mechanic');
      fx.push({ target: 'enemy', kind: 'mechanic', mechanic: 'ashFurnace', value: mech.value });
    }
  }
}

export function endTurn(battle) {
  if (!battle || battle.phase !== 'player') return { ok: false, fx: [] };
  const fx = [];
  // 梦蚀牌在弃牌之前结算：留在手里的焦页会烫你。
  // 这一步必须发生在抬走手牌之前，否则「留在手里才有代价」就不成立了。
  let drossLoss = 0;
  for (const card of battle.hand) {
    const def = getCardDef(card.defId);
    if (def?.endTurnHpLoss) drossLoss += Number(def.endTurnHpLoss) || 0;
  }
  if (drossLoss > 0) {
    battle.player.hp = Math.max(0, battle.player.hp - drossLoss);
    battle.stats.damageTaken += drossLoss;
    addLog(battle, `手里的梦蚀页烫伤了你：失去 ${drossLoss} 点生命。`, 'mechanic');
    fx.push({ target: 'player', kind: 'damage', amount: drossLoss, hpLoss: drossLoss, ignoreBlock: true });
    if (battle.player.hp <= 0) {
      defeatBattle(battle);
      return { ok: true, fx };
    }
  }
  // 借火：这一回合借来的能量，要在梦合拢前还一点利息。
  const contractLoss = Math.max(0, Number(battle.rules?.endTurnHpLoss) || 0);
  if (contractLoss > 0 && battle.phase === 'player') {
    battle.player.hp = Math.max(0, battle.player.hp - contractLoss);
    battle.stats.damageTaken += contractLoss;
    addLog(battle, `借来的火熄了一寸：你失去 ${contractLoss} 点生命。`, 'mechanic');
    fx.push({ target: 'player', kind: 'damage', amount: contractLoss, hpLoss: contractLoss, ignoreBlock: true });
    if (battle.player.hp <= 0) {
      defeatBattle(battle);
      return { ok: true, fx };
    }
  }
  // 空梦：把手牌打空的人，梦会替他把门掩上。
  const emptyHandBlock = Math.max(0, Number(battle.rules?.emptyHandBlock) || 0);
  if (emptyHandBlock > 0 && battle.phase === 'player' && battle.hand.length <= 1) {
    battle.player.block += emptyHandBlock;
    addLog(battle, `空梦合拢：你几乎空着手结束回合，获得 ${emptyHandBlock} 点格挡。`, 'block');
    fx.push({ target: 'player', kind: 'block', amount: emptyHandBlock });
  }
  battle.discardPile.push(...battle.hand);
  battle.hand = [];
  battle.sealedUids = [];
  battle.sealedUid = null;
  decayDurations(battle.player);
  const playerBurn = playerBurnTick(battle, fx);
  if (playerBurn > 0) fx.push({ target: 'player', kind: 'burn', amount: playerBurn });
  if (battle.phase !== 'player') return { ok: true, fx };
  battle.phase = 'enemy';
  addLog(battle, '你结束了回合。', 'system');
  if (battle.enemy.statuses.poison > 0) {
    const poisonDamage = enemyPoisonTick(battle, fx);
    if (poisonDamage > 0) {
      fx.push({ target: 'enemy', kind: 'poison', amount: poisonDamage });
    }
    if (battle.phase === 'victory' || battle.phase === 'defeat') {
      return { ok: true, fx };
    }
  }
  const phaseAfterPoison = Number(battle.enemy.phase) || 1;
  const shiftSkipped = Boolean(battle.parleySkip);
  if (shiftSkipped) {
    battle.parleySkip = false;
    addLog(battle, `${battle.enemy.name} 还在消化刚才的交涉，失去了这次行动。`, 'parley');
  }
  const move = getIntent(battle);
  if (move && !shiftSkipped) {
    const moveEffects = applyEnemyMove(battle, move);
    fx.push(...moveEffects);
  }
  if (battle.phase !== 'enemy') {
    return { ok: true, fx };
  }
  const burnDamage = enemyBurnTick(battle, fx);
  if (burnDamage > 0) {
    fx.push({ target: 'enemy', kind: 'burn', amount: burnDamage });
  }
  if (battle.phase !== 'enemy') {
    return { ok: true, fx };
  }
  enemyTurnEndMechanics(battle, fx);
  if (battle.phase !== 'enemy') {
    return { ok: true, fx };
  }
  decayDurations(battle.enemy);
  if ((Number(battle.enemy.phase) || 1) === phaseAfterPoison) {
    battle.enemy.moveIndex = (battle.enemy.moveIndex + 1) % battle.enemy.pattern.length;
  }
  battle.phase = 'player';
  beginPlayerTurn(battle, false, fx);
  return { ok: true, fx };
}

function applyCardStatus(battle, effect, fx) {
  const target = effect.target === 'enemy' ? battle.enemy : battle.player;
  const status = effect.status;
  const amount = Math.max(0, Number(effect.amount) || 0);
  if (!status || amount <= 0) return;
  const resonance = battle.resonance;
  const statusResonance = { poison: resonanceBonusFor(resonance, 'shadow'), burn: resonanceBonusFor(resonance, 'ember') };
  const resonanceBonus = statusResonance[status] || 0;
  const ruleScale = effect.target === 'enemy' && (status === 'poison' || status === 'burn')
    ? Math.max(1, Number(battle.rules?.debuffScale) || 1)
    : 1;
  const ruleNote = ruleScale > 1 ? `（岛屿规则 ×${ruleScale}）` : '';
  const applied = ruleScale > 1
    ? Math.max(1, Math.round((amount + resonanceBonus) * ruleScale))
    : amount + resonanceBonus;
  if (status === 'strength' || status === 'dexterity') {
    addStatus(target, status, applied);
    addLog(
      battle,
      effect.target === 'enemy'
        ? `${battle.enemy.name} 获得 ${applied} 层${STATUS_INFO[status]?.name || ''}。`
        : `你获得 ${applied} 层${STATUS_INFO[status]?.name || ''}。`,
      'buff',
    );
  } else {
    addStatus(target, status, applied);
    addLog(
      battle,
      effect.target === 'enemy'
        ? `你使 ${battle.enemy.name} 获得 ${applied} 层${STATUS_INFO[status]?.name || ''}${resonanceBonus ? `（共鸣 +${resonanceBonus}）` : ''}${ruleNote}。`
        : `你获得了 ${applied} 层${STATUS_INFO[status]?.name || ''}${resonanceBonus ? `（共鸣 +${resonanceBonus}）` : ''}。`,
      status === 'poison' ? 'poison' : 'debuff',
    );
  }
  fx.push({ target: effect.target === 'enemy' ? 'enemy' : 'player', kind: 'status', status, amount: applied });
  if (resonanceBonus) {
    fx.push({ target: 'player', kind: 'resonance', school: resonance.primary, amount: resonanceBonus });
  }
  if (effect.target === 'enemy' && status === 'poison') addOriginProgress(battle, applied, fx, 'bloom');
  if (effect.target === 'enemy' && status === 'burn') addOriginProgress(battle, applied, fx, 'heat');
}

export function playCard(battle, cardUid) {
  if (!battle || battle.phase !== 'player') return { ok: false, error: '现在不是你的回合。', fx: [] };
  const handIndex = battle.hand.findIndex((card) => card.uid === cardUid);
  if (handIndex < 0) return { ok: false, error: '这张牌不在手中。', fx: [] };
  const instance = battle.hand[handIndex];
  const baseDef = getCardDef(instance.defId);
  if (!baseDef) return { ok: false, error: '这张牌已经迷失在梦境里。', fx: [] };
  if (isCardSealed(battle, instance.uid)) {
    return { ok: false, error: '它的名字被雾借走了，本回合无法打出。', fx: [] };
  }
  if (baseDef.unplayable) {
    return { ok: false, error: '这张牌被梦浸透了，打不出去——它只会占着你的手。', fx: [] };
  }
  const cardLimit = Math.max(0, Number(battle.rules?.cardPlayLimit) || 0);
  if (cardLimit > 0 && (Number(battle.rules?.cardsPlayedThisTurn) || 0) >= cardLimit) {
    return { ok: false, error: `纸冠已经合拢：这一回合最多打出 ${cardLimit} 张牌。`, fx: [] };
  }
  const card = resolveCard(baseDef, instance.upgraded);
  // 潮钟涨潮：这一回合所有牌便宜 1 点。
  const tideDiscount = Math.max(0, Number(battle.rules?.tideDiscount) || 0);
  // 折页：每回合第一张牌再便宜 1 点，只有真的付了费才消耗。
  const pageDiscount = battle.rules?.firstCardDiscountUsed
    ? 0
    : Math.max(0, Number(battle.rules?.firstCardDiscount) || 0);
  const effectiveCost = Math.max(0, card.cost - tideDiscount - pageDiscount);
  if (effectiveCost > battle.player.energy) {
    // 烬誓者的底牌：烧自己的血换能量。只能补上缺口，不能透支。
    const short = effectiveCost - battle.player.energy;
    const lifeCost = (battle.player.lifeAsEnergy || 0) * short;
    if (!lifeCost || battle.player.hp <= lifeCost) {
      return { ok: false, error: '能量不足。', fx: [] };
    }
    battle.player.hp -= lifeCost;
    battle.player.energy += short;
    addLog(battle, `你把 ${lifeCost} 点生命投进火里，换回 ${short} 点能量。`, 'mechanic');
    if (battle.player.hp <= 0) {
      defeatBattle(battle);
      return { ok: true, error: '血烧尽了。', fx: [{ target: 'player', kind: 'damage', amount: lifeCost, hpLoss: lifeCost }] };
    }
  }
  battle.player.energy -= effectiveCost;
  if (pageDiscount > 0) battle.rules.firstCardDiscountUsed = true;
  battle.hand.splice(handIndex, 1);
  battle.stats.cardsPlayed += 1;
  battle.rules.cardsPlayedThisTurn = (Number(battle.rules.cardsPlayedThisTurn) || 0) + 1;
  if (cardLimit > 0 && battle.rules.cardsPlayedThisTurn === cardLimit) {
    addLog(battle, `纸冠合拢：本回合的出牌数已满（${cardLimit} 张）。`, 'mechanic');
  }
  const fx = [];
  addLog(battle, `你打出了【${card.displayName}】。`, 'cardPlay');

  const resonance = battle.resonance;
  const resonanceState = battle.resonanceState || {
    bladeUsed: false,
    bladeBoost: 0,
    starUsed: false,
    drawBoostUsed: false,
  };
  battle.resonanceState = resonanceState;
  const bladeResonance = resonanceBonusFor(resonance, 'blade');
  if (bladeResonance > 0 && card.type === 'attack' && !resonanceState.bladeUsed) {
    resonanceState.bladeUsed = true;
    resonanceState.bladeBoost = bladeResonance;
    addLog(battle, `剑鸣共鸣响起，本回合每次攻击伤害 +${bladeResonance}。`, 'buff');
    fx.push({ target: 'player', kind: 'resonance', school: 'blade', amount: bladeResonance });
  }
  const starResonance = resonanceBonusFor(resonance, 'star');
  if (starResonance > 0 && card.type === 'skill' && !resonanceState.starUsed) {
    resonanceState.starUsed = true;
    battle.player.block += starResonance;
    addLog(battle, `星幕共鸣展开，额外获得 ${starResonance} 点格挡。`, 'block');
    fx.push({ target: 'player', kind: 'resonance', school: 'star', amount: starResonance });
    fx.push({ target: 'player', kind: 'block', amount: starResonance });
  }

  // ── 混响：跨流派连打 ──
  // 第一张只起链；之后每换一个流派叠 1 层，凑齐 3 个不同流派时额外 +1 层，最多 3 层。
  // 同派连打会断链并清空本回合的混响攻击加成——混搭的强度来自排序，不是白送的数值。
  // 中立的斩击 / 护势不参与起链，也不会打断链。
  if (resonance?.chorus?.active) {
    const chorusValue = resonance.chorus.value;
    const lastSchool = resonanceState.lastSchool || null;
    const thisSchool = chainSchoolOf(card);
    const chain = Array.isArray(resonanceState.chorusSchools) ? resonanceState.chorusSchools : [];
    // 斩击 / 护势不参与：它们谁都能带，不该决定一条混搭链的走向。
    if (!thisSchool) {
      // 什么都不做——既不叠层，也不断链。
    } else if (lastSchool && thisSchool === lastSchool) {
      const hadBonus = (resonanceState.chorusAtk || 0) > 0;
      resonanceState.chorusStacks = 0;
      resonanceState.chorusAtk = 0;
      resonanceState.chorusSchools = [thisSchool];
      if (hadBonus) {
        addLog(battle, `同派续打，混响断链——本回合的攻击加成清空了。`, 'system');
        fx.push({ target: 'player', kind: 'resonance', chorus: true, broken: true, name: '混响断链', amount: 0, stacks: 0 });
      }
    } else {
      const nextChain = lastSchool ? [...new Set([...chain, thisSchool])] : [thisSchool];
      const prev = Number(resonanceState.chorusStacks) || 0;
      const gainStacks = lastSchool ? (nextChain.length >= 3 ? 2 : 1) : 0;
      const stacks = Math.min(3, prev + gainStacks);
      resonanceState.lastSchool = thisSchool;
      resonanceState.chorusSchools = nextChain;
      if (stacks > prev) {
        resonanceState.chorusStacks = stacks;
        const gain = chorusValue * (stacks - prev);
        resonanceState.chorusAtk = (resonanceState.chorusAtk || 0) + gain;
        const flavor = nextChain.length >= 3 ? '三派交汇' : `${SCHOOLS[lastSchool]?.name || '上一派'}转${SCHOOLS[thisSchool]?.name || '这一派'}`;
        addLog(battle, `混响叠到第 ${stacks} 层（${flavor}）：本回合攻击加成累计 +${resonanceState.chorusAtk}。`, 'buff');
        fx.push({ target: 'player', kind: 'resonance', chorus: true, name: '混响', amount: gain, stacks });
      }
    }
  }

  // 这一张牌实际造成了多少伤害。镜海复写按「重量」累积而不是按张数——
  // 一张 2 点的小牌和一刀 40 点，在镜子里不该是同一件事。
  const dealtBefore = Number(battle.stats.damageDealt) || 0;

  if (battle.rules && card.type === 'attack' && battle.rules.attackCardTurn !== battle.turn) {
    battle.rules.attackCardTurn = battle.turn;
    battle.rules.firstAttackArmed = (Number(battle.rules.firstAttackBonus) || 0) > 0;
  }

  for (const effect of card.effects) {
    if (battle.phase !== 'player') break;
    const amount = Math.max(0, Number(effect.amount) || 0);
    switch (effect.type) {
      case 'damage': {
        // 「缄默」：被首领学会的那个流派，攻击伤害 -30%。
        // 这是纯流派的天花板——不是你的牌不够强，是这条路被看穿了。
        let hitAmount = amount;
        if (battle.rules?.silenceSchool && card.school === battle.rules.silenceSchool) {
          hitAmount = Math.max(1, Math.round(hitAmount * 0.7));
        }
        const result = attackEnemy(battle, hitAmount, effect.hits || 1);
        fx.push(...result.fx);
        break;
      }
      case 'block': {
        const gained = amount + (battle.player.statuses.dexterity || 0);
        battle.player.block += gained;
        addLog(battle, `获得 ${gained} 点格挡。`, 'block');
        fx.push({ target: 'player', kind: 'block', amount: gained });
        break;
      }
      case 'heal': {
        healPlayer(battle, amount, fx);
        break;
      }
      case 'draw': {
        const drawn = drawCards(battle, amount);
        fx.push({ target: 'player', kind: 'draw', amount: drawn });
        break;
      }
      case 'energy': {
        battle.player.energy = Math.min(10, battle.player.energy + amount);
        addLog(battle, `获得 ${amount} 点能量。`, 'energy');
        fx.push({ target: 'player', kind: 'energy', amount });
        break;
      }
      case 'status': {
        applyCardStatus(battle, effect, fx);
        break;
      }
      case 'loseHp': {
        battle.player.hp = Math.max(0, battle.player.hp - amount);
        battle.stats.damageTaken += amount;
        addLog(battle, `失去 ${amount} 点生命。`, 'loseHp');
        fx.push({ target: 'player', kind: 'loseHp', amount });
        if (battle.player.hp > 0) addOriginProgress(battle, 1, fx, 'heat');
        if (battle.player.hp <= 0) defeatBattle(battle);
        break;
      }
      case 'detonate': {
        const status = effect.status === 'poison' ? 'poison' : 'burn';
        const stacks = battle.enemy.statuses[status] || 0;
        if (stacks <= 0) {
          addLog(battle, `${battle.enemy.name} 身上没有${STATUS_INFO[status]?.name || ''}，引爆落空了。`, 'system');
          break;
        }
        const perStack = Math.max(1, amount);
        const detonateDamage = stacks * perStack;
        const detonateResult = hitEntity(battle.enemy, detonateDamage);
        battle.stats.damageDealt += detonateResult.hpLoss;
        delete battle.enemy.statuses[status];
        addLog(battle, `你引爆了 ${stacks} 层${STATUS_INFO[status]?.name || ''}，造成 ${detonateResult.raw} 点伤害${detonateResult.blocked ? `（护甲抵消 ${detonateResult.blocked}）` : ''}。`, 'damage');
        fx.push({ target: 'enemy', kind: 'damage', amount: detonateResult.raw, hpLoss: detonateResult.hpLoss });
        fx.push({ target: 'enemy', kind: 'status', status, amount: -stacks });
        if (battle.enemy.hp <= 0) winBattle(battle);
        else maybeEnterBossPhase(battle, fx);
        break;
      }
      case 'catalyze': {
        const status = effect.status === 'poison' ? 'poison' : 'burn';
        let added = 0;
        if (amount > 0) {
          addStatus(battle.enemy, status, amount);
          fx.push({ target: 'enemy', kind: 'status', status, amount });
          added += amount;
        }
        const current = battle.enemy.statuses[status] || 0;
        if (current > 0) {
          addStatus(battle.enemy, status, current);
          fx.push({ target: 'enemy', kind: 'status', status, amount: current });
          added += current;
          addLog(battle, `${battle.enemy.name} 的${STATUS_INFO[status]?.name || ''}翻倍为 ${current * 2} 层。`, status === 'poison' ? 'poison' : 'burn');
        } else {
          addLog(battle, `${battle.enemy.name} 身上没有${STATUS_INFO[status]?.name || ''}可以分裂。`, 'system');
        }
        if (status === 'poison') addOriginProgress(battle, added, fx, 'bloom');
        else addOriginProgress(battle, added, fx, 'heat');
        break;
      }
      case 'directDamage': {
        const before = battle.enemy.hp;
        battle.enemy.hp = Math.max(0, battle.enemy.hp - amount);
        const loss = before - battle.enemy.hp;
        battle.stats.damageDealt += loss;
        addLog(battle, `你造成 ${amount} 点无视格挡的伤害。`, 'damage');
        fx.push({ target: 'enemy', kind: 'damage', amount, hpLoss: loss, ignoreBlock: true });
        if (battle.enemy.hp <= 0) winBattle(battle);
        else maybeEnterBossPhase(battle, fx);
        break;
      }
      case 'comboDamage': {
        const combo = battle.origin?.id === 'combo' ? (Number(battle.origin.value) || 0) : 0;
        const scale = Math.max(1, Number(effect.scale) || 4);
        const total = amount + combo * scale;
        addLog(battle, `破晓式亮起：${combo} 层连斩让这一击变成 ${total} 点。`, 'damage');
        const result = attackEnemy(battle, total, 1);
        fx.push(...result.fx);
        break;
      }
      case 'toxicBurst': {
        const poison = battle.enemy.statuses.poison || 0;
        const scale = Math.max(1, Number(effect.scale) || 3);
        const burstDamage = poison * scale;
        if (burstDamage <= 0) {
          addLog(battle, '敌人身上的毒还太薄，蚀放没有回响。', 'system');
          break;
        }
        const before = battle.enemy.hp;
        battle.enemy.hp = Math.max(0, battle.enemy.hp - burstDamage);
        const loss = before - battle.enemy.hp;
        battle.stats.damageDealt += loss;
        addLog(battle, `蚀放撕开伤口：${poison} 层中毒 ×${scale} = ${burstDamage} 点无视格挡的伤害。`, 'damage');
        fx.push({ target: 'enemy', kind: 'damage', amount: burstDamage, hpLoss: loss, ignoreBlock: true });
        if (battle.enemy.hp <= 0) winBattle(battle);
        else maybeEnterBossPhase(battle, fx);
        break;
      }
      case 'drawTo': {
        const need = Math.max(0, amount - battle.hand.length);
        const drawn = need > 0 ? drawCards(battle, need) : 0;
        addLog(battle, drawn > 0 ? `抽牌直到手牌 ${battle.hand.length} 张。` : '手牌已经够多了。', 'draw');
        fx.push({ target: 'player', kind: 'draw', amount: drawn });
        break;
      }
      case 'blockDamage': {
        const cap = Math.max(1, amount || 99);
        const base = Math.min(cap, Math.max(0, battle.player.block || 0));
        if (base <= 0) {
          addLog(battle, '你身上没有格挡可以还回去。', 'system');
          break;
        }
        battle.player.block -= base;
        addLog(battle, `你把 ${base} 点格挡化作锋刃掷出。`, 'damage');
        const blockResult = attackEnemy(battle, base, 1);
        fx.push(...blockResult.fx);
        break;
      }
      case 'execute': {
        const threshold = Math.max(0.05, Math.min(0.9, Number(effect.threshold) || 0.35));
        const multiplier = Math.max(1, Number(effect.multiplier) || 3);
        const ratio = battle.enemy.maxHp > 0 ? battle.enemy.hp / battle.enemy.maxHp : 0;
        const executed = ratio <= threshold;
        const total = executed ? Math.round(amount * multiplier) : amount;
        addLog(battle, executed
          ? `${battle.enemy.name} 已是残烛，你补上了 ${total} 点伤害。`
          : `你递出 ${total} 点伤害，还差一点就能斩尽。`, 'damage');
        const executeResult = attackEnemy(battle, total, 1);
        fx.push(...executeResult.fx);
        break;
      }
      case 'recollect': {
        if (!battle.discardPile.length) {
          addLog(battle, '弃牌堆里没有可以拾回的东西。', 'system');
          break;
        }
        const room = Math.max(0, HAND_LIMIT - battle.hand.length);
        const take = Math.min(amount, battle.discardPile.length, room);
        if (take <= 0) {
          addLog(battle, '手牌已经满了，拾不回来。', 'system');
          break;
        }
        const recovered = [];
        for (let index = 0; index < take; index += 1) {
          const pickIndex = Math.floor(rand() * battle.discardPile.length);
          recovered.push(battle.discardPile.splice(pickIndex, 1)[0]);
        }
        battle.hand.push(...recovered);
        addLog(battle, `你从弃牌堆的雾里拾回 ${recovered.length} 张牌。`, 'draw');
        fx.push({ target: 'player', kind: 'draw', amount: recovered.length });
        break;
      }
      case 'gold': {
        if (battle.mode === 'adventure' && G.run) {
          G.run.gold += amount;
          addLog(battle, `拾得 ${amount} 金币。`, 'gold');
        } else {
          battle.stats.goldFound = (battle.stats.goldFound || 0) + amount;
          addLog(battle, `拾得 ${amount} 枚梦中金币。`, 'gold');
        }
        fx.push({ target: 'player', kind: 'gold', amount });
        break;
      }
      default:
        break;
    }
  }

  // 灰烬二阶段：每回合第一张攻击牌被炉火烧掉，不进弃牌堆。
  // 速杀只会损失几张；拖得越久，牌组越薄——这才是「它怕快」。
  const burnReady = Boolean(battle.rules?.burnPlayed)
    && card.type === 'attack'
    && battle.rules.burnTurn !== battle.turn;
  const burned = burnReady;
  if (burnReady) battle.rules.burnTurn = battle.turn;
  if (card.exhaust || burned) battle.exhaustPile.push(instance);
  else battle.discardPile.push(instance);
  if (burned) {
    addLog(battle, `【${card.displayName || card.name}】被炉火吞掉了，这一场不会再回来。`, 'mechanic');
    fx.push({ target: 'player', kind: 'burn', amount: 1 });
  }

  if (battle.phase === 'player') {
    if (card.type === 'attack') addOriginProgress(battle, 1, fx, 'combo');
    if (card.type === 'skill') addOriginProgress(battle, 1, fx, 'starTrack');
    addOriginProgress(battle, 1, fx, 'laugh');
  }
  // 放在流派触发之后取差值：星屑、狂笑这类「出牌后触发」的伤害
  // 也发生在这一段里，提前取差值就会把它们漏出镜面。
  applyCardPlayMechanic(battle, card, fx, { dealt: (Number(battle.stats.damageDealt) || 0) - dealtBefore });
  if (battle.phase !== 'player') return { ok: true, card, fx };

  // 燃梦的加成只属于「第一张攻击牌」；牌结算完就熄灭，
  // 避免后续的道具攻击捡到这次加成。
  if (battle.rules) battle.rules.firstAttackArmed = false;

  const echoEvery = Math.max(0, Number(battle.rules?.echoDrawEvery) || 0);
  if (echoEvery > 0 && battle.phase === 'player') {
    battle.rules.echoCount = (Number(battle.rules.echoCount) || 0) + 1;
    if (battle.rules.echoCount % echoEvery === 0) {
      const drawn = drawCards(battle, 1, false);
      if (drawn > 0) {
        addLog(battle, `回响：第 ${battle.rules.echoCount} 张牌在梦里折返，你抽到 1 张牌。`, 'draw');
        fx.push({ target: 'player', kind: 'draw', amount: drawn });
      }
    }
  }

  if (battle.enemy.hp <= 0 && battle.phase === 'player') {
    winBattle(battle);
  }

  return { ok: true, card, fx };
}

export function useItem(battle, itemId) {
  if (!battle || battle.phase !== 'player') return { ok: false, error: '现在不是使用道具的时候。', fx: [] };
  if (battle.mode !== 'adventure' || !G.run) return { ok: false, error: '幻境试炼中无法取用旅途道具。', fx: [] };
  if (battle.rules?.noItems) {
    const message = battle.rules.noItemsSource === 'ascension'
      ? '梦层封住了行囊——这一场你只能靠牌。'
      : '缄口契约封住了行囊——这一场你只能靠牌。';
    return { ok: false, error: message, fx: [] };
  }
  const run = G.run;
  const item = ITEM_MAP[itemId];
  if (!item) return { ok: false, error: '没有这件道具。', fx: [] };
  if (!Array.isArray(run.items) || !run.items.includes(itemId)) {
    return { ok: false, error: '行囊里没有这件道具。', fx: [] };
  }
  run.items.splice(run.items.indexOf(itemId), 1);
  const fx = [];
  addLog(battle, `你使用了【${item.name}】。`, 'item');
  for (const effect of item.effects || []) {
    if (battle.phase !== 'player') break;
    const amount = Math.max(0, Number(effect.amount) || 0);
    switch (effect.type) {
      case 'heal': {
        healPlayer(battle, amount, fx);
        break;
      }
      case 'block': {
        const gained = amount + (battle.player.statuses.dexterity || 0);
        battle.player.block += gained;
        addLog(battle, `获得 ${gained} 点格挡。`, 'block');
        fx.push({ target: 'player', kind: 'block', amount: gained });
        break;
      }
      case 'damage': {
        const result = attackEnemy(battle, amount, effect.hits || 1);
        fx.push(...result.fx);
        break;
      }
      case 'draw': {
        const drawn = drawCards(battle, amount);
        fx.push({ target: 'player', kind: 'draw', amount: drawn });
        break;
      }
      case 'energy': {
        battle.player.energy = Math.min(10, battle.player.energy + amount);
        addLog(battle, `获得 ${amount} 点能量。`, 'energy');
        fx.push({ target: 'player', kind: 'energy', amount });
        break;
      }
      case 'status': {
        const toEnemy = effect.target === 'enemy';
        const target = toEnemy ? battle.enemy : battle.player;
        addStatus(target, effect.status, amount);
        fx.push({
          target: toEnemy ? 'enemy' : 'player',
          kind: 'status',
          status: effect.status,
          amount,
        });
        addLog(
          battle,
          toEnemy
            ? `${battle.enemy.name} 获得 ${amount} 层${STATUS_INFO[effect.status]?.name || ''}。`
            : `你获得 ${amount} 层${STATUS_INFO[effect.status]?.name || ''}。`,
          toEnemy ? 'debuff' : 'buff',
        );
        if (toEnemy && effect.status === 'poison') addOriginProgress(battle, amount, fx, 'bloom');
        if (toEnemy && effect.status === 'burn') addOriginProgress(battle, amount, fx, 'heat');
        break;
      }
      case 'cleanse': {
        const removed = [];
        for (const status of ['poison', 'burn', 'weak', 'vulnerable']) {
          if ((battle.player.statuses[status] || 0) > 0) {
            delete battle.player.statuses[status];
            removed.push(STATUS_INFO[status]?.name || status);
          }
        }
        addLog(battle, removed.length ? `负面状态被洗净：${removed.join('、')}。` : '负面状态早已退去，药液只是让心静了下来。', 'cleanse');
        fx.push({ target: 'player', kind: 'cleanse' });
        break;
      }
      case 'loseHp': {
        battle.player.hp = Math.max(0, battle.player.hp - amount);
        battle.stats.damageTaken += amount;
        addLog(battle, `失去 ${amount} 点生命。`, 'loseHp');
        fx.push({ target: 'player', kind: 'loseHp', amount });
        if (battle.player.hp > 0) addOriginProgress(battle, 1, fx, 'heat');
        if (battle.player.hp <= 0) defeatBattle(battle);
        break;
      }
      case 'maxHp': {
        run.maxHp += amount;
        battle.player.maxHp += amount;
        battle.player.hp = Math.min(battle.player.maxHp, battle.player.hp + amount);
        run.hp = battle.player.hp;
        addLog(battle, `最大生命 +${amount}。`, 'heal');
        fx.push({ target: 'player', kind: 'heal', amount });
        break;
      }
      default:
        break;
    }
  }
  if (battle.enemy.hp <= 0 && battle.phase === 'player') winBattle(battle);
  saveProfileNow();
  return { ok: true, item, fx };
}

export function claimBattleReward(cardId = null) {
  const run = G.run;
  const battle = run?.battle;
  if (!run || !battle || battle.phase !== 'victory') return { ok: false };
  if (cardId && battle.rewards?.cards.includes(cardId)) {
    run.deck.push({ defId: cardId, upgraded: false });
  }
  const nodeId = run.pendingNodeId;
  if (nodeId) completeNode(run, nodeId);
  run.battle = null;
  G.ui.reward = null;
  G.screen = 'map';
  return { ok: true, cardId };
}

const RIFT_STORY_IDS = [
  'parley-rift-reason',
  'parley-rift-empathy',
  'parley-rift-threat',
  'parley-rift-bribe',
];

function riftStoryFor(world) {
  if ((Number(world?.parleySuccesses) || 0) < 3) return null;
  if (RIFT_STORY_IDS.some((id) => world.storySeen.includes(id))) return null;
  const styles = world.parleyStyles || {};
  let dominant = 'reason';
  let best = 0;
  for (const approach of PARLEY_APPROACHES) {
    const count = Number(styles[approach.id]) || 0;
    if (count > best) {
      best = count;
      dominant = approach.id;
    }
  }
  return `parley-rift-${dominant}`;
}

export function finishAdventure() {
  if (!G.run) return null;
  const run = G.run;
  if (run.endless) return finishEndless(run);
  const world = G.profile.world;
  const region = REGION_MAP[run.regionId] || REGIONS[0];
  const firstClear = (world.regionClears[region.id] || 0) === 0;
  const ascension = clamp(Math.floor(Number(run.ascension) || 0), 0, MAX_ASCENSION);
  run.status = 'won';
  G.profile.stats.wins += 1;
  world.stats.clears += 1;
  world.stats.bosses += 1;
  world.regionClears[region.id] = (world.regionClears[region.id] || 0) + 1;
  if (!world.clearedRegions.includes(region.id)) world.clearedRegions.push(region.id);
  world.lastRegion = region.id;
  G.ui.regionChoice = region.id;
  G.profile.ascensionBest = Math.max(Number(G.profile.ascensionBest) || 0, ascension);
  G.profile.ascensionUnlocked = ascensionUnlockAfter(ascension, Number(G.profile.ascensionUnlocked) || 0);
  const trophyId = ascensionLevel(ascension).reward;
  const trophyCard = trophyId ? grantQuestCard(world, trophyId) : null;
  const ascensionReward = trophyCard ? { level: ascension, cardId: trophyCard.id, name: trophyCard.name } : null;
  if (trophyCard) pushRewardPop(trophyCard.name);
  const isFinal = Boolean(region.final || region.id === FINAL_REGION_ID);
  if (isFinal) world.pendingFinale = true;
  const storyId = firstClear && region.clearStory && !world.storySeen.includes(region.clearStory)
    ? region.clearStory
    : null;
  const parleyStoryIds = [];
  if (Array.isArray(run.parleyBosses) && run.parleyBosses.length) {
    if (!world.storySeen.includes('parley-echo')) parleyStoryIds.push('parley-echo');
    if ((world.bossParleys?.length || 0) >= 4 && !world.storySeen.includes('parley-chorus')) {
      parleyStoryIds.push('parley-chorus');
    }
  }
  const riftStory = riftStoryFor(world);
  if (riftStory && !parleyStoryIds.includes(riftStory)) parleyStoryIds.push(riftStory);
  const summary = {
    regionId: region.id,
    regionName: region.name,
    final: isFinal,
    firstClear,
    ascensionReward,
    storyId,
    parleyStoryIds,
    parleyBosses: [...(run.parleyBosses || [])],
    parleySuccesses: Number(run.parleySuccesses) || 0,
    parleyUnlockedEnding: Boolean(run.parleyUnlockedEnding),
    bossName: run.battle?.enemy?.name || '',
    hp: run.hp,
    maxHp: run.maxHp,
    gold: run.gold,
    deckSize: run.deck.length,
    ascension,
    ascensionUnlocked: Number(G.profile.ascensionUnlocked) || 0,
    totals: { ...run.totals },
  };
  summary.unlockedAchievements = evaluateAchievements('adventure');
  G.run.battle = null;
  G.ui.modal = null;
  G.ui.reward = null;
  G.screen = 'world';
  if (!isFinal) G.run = null;
  saveProfileNow();
  return summary;
}

function finishEndless(run) {
  run.endlessCleared = (Number(run.endlessCleared) || 0) + 1;
  G.profile.endlessClearedTotal = (Number(G.profile.endlessClearedTotal) || 0) + 1;
  G.profile.endlessBest = Math.max(Number(G.profile.endlessBest) || 0, run.endlessCleared);
  const cleared = run.endlessCleared;
  const heal = Math.round(run.maxHp * 0.3);
  run.hp = Math.min(run.maxHp, run.hp + heal);
  run.gold += 30;
  run.depth = cleared + 1;
  applyEndlessDepth(run);
  run.battle = null;
  G.ui.modal = null;
  G.ui.reward = null;
  G.screen = 'map';
  evaluateAchievements('adventure');
  saveProfileNow();
  saveRunNow();
  return {
    endless: true,
    cleared,
    depth: run.depth,
    best: G.profile.endlessBest,
    heal,
    regionName: run.regionName,
    affixes: run.endlessAffixes,
    hp: run.hp,
    maxHp: run.maxHp,
    gold: run.gold,
  };
}

export function resolveFinalEnding(endingId) {
  const ending = resolveWorldEnding(G.profile.world, endingId);
  if (!ending) return null;
  evaluateAchievements('ending');
  saveProfileNow();
  G.ui.endingId = ending.id;
  G.ui.modal = null;
  G.ui.reward = null;
  G.screen = 'ending';
  return ending;
}

export function leaveEndingToWorld() {
  G.run = null;
  G.sandboxBattle = null;
  G.ui.modal = null;
  G.ui.reward = null;
  G.screen = 'world';
}

export function finishRunAndLeave() {
  G.run = null;
  G.sandboxBattle = null;
  G.ui.modal = null;
  G.ui.reward = null;
  G.screen = 'menu';
}

export function abandonRun() {
  if (G.run) G.run.status = 'abandoned';
  G.run = null;
  G.sandboxBattle = null;
  G.ui.modal = null;
  G.ui.reward = null;
  G.screen = 'world';
}

/**
 * 中途撤退——开放世界能成立的关键。
 *
 * 以前只有「打到首领」和「全部丢掉」两个结局，等于逼玩家一次坐到底。
 * 现在可以在任意节点收帆回港：已经拿到的牌、遗物、金币都留下，
 * 只是这座岛不算踏平。于是「走到一半，觉得牌组不对，先回去换一套」
 * 这种真正的开放世界决策才成立。
 *
 * 代价只有一条：进度不保留，下次进岛要重新走地图。这比丢光所有东西温和得多，
 * 又比「随时存档重进」更有分量。
 */
export function sailHomeEarly() {
  const run = G.run;
  if (!run) return null;
  const region = REGION_MAP[run.regionId];
  const summary = {
    regionId: run.regionId,
    regionName: region?.name || '不知名的岛',
    hp: run.hp,
    maxHp: run.maxHp,
    gold: run.gold,
    deckSize: run.deck.length,
    relics: [...run.relics],
    depth: run.completed.length,
    cleared: false,
  };
  // 把能带走的东西写进玩家档案：金币折成「盘缠」，卡牌进收藏。
  const profile = G.profile;
  if (profile) {
    profile.expedition = {
      lastRegionId: run.regionId,
      carriedGold: run.gold,
      carriedRelics: [...run.relics],
      carriedDeck: run.deck.map((entry) => ({ ...entry })),
      sailed: (profile.expedition?.sailed || 0) + 1,
    };
  }
  G.run = null;
  G.sandboxBattle = null;
  G.ui.modal = null;
  G.ui.reward = null;
  G.screen = 'world';
  return summary;
}

export function leaveBattleEarly() {
  if (G.run?.battle && G.run.mode === 'adventure') {
    // 借来的呼吸不能靠撤退赖掉：离开战斗同样结算梦痕。
    applyLastStandCost(G.run.battle);
    G.run.hp = G.run.battle.player.hp;
    G.run.battle = null;
    G.run.pendingNodeId = null;
  }
  G.sandboxBattle = null;
  G.ui.modal = null;
  G.ui.reward = null;
  G.screen = G.run ? 'map' : 'sandbox';
}

export function upgradeDeckCard(run, deckIndex) {
  const entry = run?.deck?.[deckIndex];
  if (!entry) return null;
  const def = getCardDef(entry.defId);
  if (!def || entry.upgraded) return null;
  entry.upgraded = true;
  return def;
}

export const MIN_DECK_SIZE = 6;

export function forgetDeckCard(run, deckIndex) {
  const entry = run?.deck?.[deckIndex];
  if (!entry) return null;
  if (run.deck.length <= MIN_DECK_SIZE) return null;
  const def = getCardDef(entry.defId);
  run.deck.splice(deckIndex, 1);
  return def || { name: '一段忘却的梦' };
}

export function randomUpgrade(run) {
  const candidates = run.deck
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !entry.upgraded && getCardDef(entry.defId));
  if (!candidates.length) return null;
  const choice = pick(candidates);
  choice.entry.upgraded = true;
  return { card: getCardDef(choice.entry.defId), index: choice.index };
}

export function restHealAmount(run) {
  // 折页契约封住了营火的温度：再坐多久也不会回血。
  if (run?.contractMods?.noRestHeal) return 0;
  const restScale = Number(run.ascensionModifiers?.restScale) || 1;
  const ruleScale = Math.max(0, Number(run.modifiers?.healScale) || 1)
    * Math.max(0, Number(run.mutationMods?.healScale) || 1)
    * Math.max(0, Number(run.contractMods?.healScale) || 1);
  return Math.max(1, Math.ceil(run.maxHp * 0.22 * restScale * ruleScale));
}

export function restHeal(run) {
  const amount = restHealAmount(run);
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + amount);
  return run.hp - before;
}

export function gainRandomCard(run, rarity = null) {
  const cardId = randomRewardCard(rarity);
  if (!cardId) return null;
  run.deck.push({ defId: cardId, upgraded: false });
  return getCardDef(cardId);
}

export function resolveEventChoice(run, eventId, choiceId) {
  const event = EVENTS.find((item) => item.id === eventId);
  if (!event) return { ok: false, message: '这个梦已经散去了。' };
  if (eventId === 'altar') {
    if (choiceId === 'blood') {
      if (run.hp <= 8) return { ok: false, message: '你的生命不足以完成这次献祭。' };
      run.hp = Math.max(1, run.hp - 8);
      const card = gainRandomCard(run, 'rare');
      return {
        ok: true,
        message: `暗红的刻痕吞下你的血。你获得了稀有卡牌【${card?.name || '未知'}】。`,
        tone: 'danger',
        outcome: 'blood',
        card,
      };
    }
    if (choiceId === 'pray') {
      const amount = Math.ceil(run.maxHp * 0.25);
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + amount);
      return {
        ok: true,
        message: `祭坛深处传来一声叹息。你回复了 ${run.hp - before} 点生命。`,
        tone: 'good',
        outcome: 'pray',
      };
    }
    return { ok: true, message: '你没有惊动这座祭坛，雾很快合拢。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'gambler') {
    if (choiceId === 'wager') {
      if (run.gold < 10) return { ok: false, message: '你的金币还不够下注。' };
      const wager = Math.floor(run.gold / 2);
      const win = rand() < 0.5;
      if (win) {
        run.gold += wager;
        return {
          ok: true,
          message: `金币在空中翻了个面。你赢了 ${wager} 金币。无脸人鼓了鼓掌。`,
          tone: 'good',
          outcome: 'win',
        };
      }
      run.gold -= wager;
      return {
        ok: true,
        message: `金币落地时，两张脸都在笑。你失去了 ${wager} 金币。`,
        tone: 'danger',
        outcome: 'lose',
      };
    }
    return { ok: true, message: '你把金币握得更紧了。无脸人没有挽留。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'library') {
    if (choiceId === 'study') {
      if (run.hp <= 6) return { ok: false, message: '你的记忆已经不够抵押了。' };
      run.hp = Math.max(1, run.hp - 6);
      const result = randomUpgrade(run);
      if (result) {
        return {
          ok: true,
          message: `一段记忆被抽走。你的【${result.card.name}】被永久强化。`,
          tone: 'danger',
          outcome: 'study',
          card: result.card,
        };
      }
      const card = gainRandomCard(run);
      return {
        ok: true,
        message: `无牌可磨，书页替你折出了一张新牌【${card?.name || '未知'}】。`,
        tone: 'danger',
        outcome: 'study',
        card,
      };
    }
    if (choiceId === 'mend') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 12);
      return { ok: true, message: `书页间落下一缕暖光。你回复了 ${run.hp - before} 点生命。`, tone: 'good', outcome: 'mend' };
    }
    return { ok: true, message: '你合上了书。它在你身后轻轻翻了一页。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'spring') {
    if (choiceId === 'drink') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp + 2, run.hp + 18);
      run.maxHp += 2;
      run.hp = Math.min(run.maxHp, run.hp + 2);
      return {
        ok: true,
        message: `泉水冷得像一口星光。你回复了 ${run.hp - before} 点生命，最大生命 +2。`,
        tone: 'good',
        outcome: 'drink',
      };
    }
    if (choiceId === 'grab') {
      if (run.hp <= 5) return { ok: false, message: '你太虚弱了，无法靠近那些尖刺。' };
      run.hp = Math.max(1, run.hp - 5);
      run.gold += 45;
      return { ok: true, message: '荆棘划开你的手。那道光是一枚旧金币，你获得了 45 金币。', tone: 'danger', outcome: 'grab' };
    }
    return { ok: true, message: '你没有触碰泉水。倒影里的你先一步离开了。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'pyre') {
    if (choiceId === 'offer') {
      if (run.hp <= 7) return { ok: false, message: '你的生命已经太薄，火会直接烧穿它。' };
      run.hp = Math.max(1, run.hp - 7);
      const card = gainRandomCard(run, 'rare');
      return {
        ok: true,
        message: `火焰从你掌心衔走一小片名字。你获得了稀有卡牌【${card?.name || '未知'}】。`,
        tone: 'danger',
        outcome: 'offer',
        card,
      };
    }
    if (choiceId === 'warm') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 16);
      return {
        ok: true,
        message: `炉火没有问你的名字。你回复了 ${run.hp - before} 点生命。`,
        tone: 'good',
        outcome: 'warm',
      };
    }
    return { ok: true, message: '你没有看炉膛里的名字。它们在火里轻轻翻了个身。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'stoppedClock') {
    if (choiceId === 'turn') {
      if (run.hp <= 6) return { ok: false, message: '你没有力气去拨动那根指针。' };
      run.hp = Math.max(1, run.hp - 6);
      run.gold += 65;
      return {
        ok: true,
        message: '指针退回一格，潮水吐出一只泡得发胀的旧钱袋。你获得 65 金币。',
        tone: 'danger',
        outcome: 'turn',
      };
    }
    if (choiceId === 'listen') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 20);
      return {
        ok: true,
        message: `钟摆贴着你的背，像一颗终于肯慢下来的心。你回复了 ${run.hp - before} 点生命。`,
        tone: 'good',
        outcome: 'listen',
      };
    }
    return { ok: true, message: '你离开了钟楼。身后的钟仍然停在三点十七分。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'blankBook') {
    if (choiceId === 'write') {
      if (run.hp <= 10) return { ok: false, message: '写下一个结局需要比这更多的血。' };
      run.hp = Math.max(1, run.hp - 10);
      const cardId = randomRewardCard('rare');
      if (!cardId) return { ok: false, message: '书页没有认出你的笔迹。' };
      run.deck.push({ defId: cardId, upgraded: true });
      const card = getCardDef(cardId);
      return {
        ok: true,
        message: `你写下的句子渗进纸里。你获得了一张已强化的稀有卡牌【${card?.name || '未知'}+】。`,
        tone: 'danger',
        outcome: 'write',
        card,
        upgraded: true,
      };
    }
    if (choiceId === 'erase') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 14);
      return {
        ok: true,
        message: `一句谎话从页边褪色。你回复了 ${run.hp - before} 点生命。`,
        tone: 'good',
        outcome: 'erase',
      };
    }
    return { ok: true, message: '你合上了无字之书。它没有挽留，只在封底留下一声很轻的叹。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'porch') {
    if (choiceId === 'knock') {
      if (run.hp <= 7) return { ok: false, message: '门后的手太凉了，你现在的血不够敲三下。' };
      run.hp = Math.max(1, run.hp - 7);
      const card = gainRandomCard(run);
      return {
        ok: true,
        message: `三下敲完，门缝里递出一张牌【${card?.name || '未知'}】。它没有问你要去哪里。`,
        tone: 'danger',
        outcome: 'knock',
        card,
      };
    }
    if (choiceId === 'sit') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 12);
      return { ok: true, message: `门阶比看上去暖。你回复了 ${run.hp - before} 点生命。`, tone: 'good', outcome: 'sit' };
    }
    return { ok: true, message: '你把手收回来。门后面的那只手，也慢慢放下了。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'nameLender') {
    if (choiceId === 'lend') {
      if (run.hp <= 6) return { ok: false, message: '你的血太薄，借出去的名字会连着命一起被拿走。' };
      run.hp = Math.max(1, run.hp - 6);
      run.gold += 50;
      return {
        ok: true,
        message: '他把你的名字含在嘴里，从舌根摸出 50 金币放在你手心。「现在我能被叫住了。」',
        tone: 'danger',
        outcome: 'lend',
      };
    }
    if (choiceId === 'answer') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 15);
      return { ok: true, message: `你报出了自己的名字。雾退开一圈。你回复了 ${run.hp - before} 点生命。`, tone: 'good', outcome: 'answer' };
    }
    return { ok: true, message: '你没有出声。他在雾里站了很久，最后连轮廓也散了。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'boneScale') {
    if (choiceId === 'weigh') {
      if (run.hp <= 9) return { ok: false, message: '天平要的分量，你现在付不出来。' };
      run.hp = Math.max(1, run.hp - 9);
      const card = gainRandomCard(run, 'rare');
      return {
        ok: true,
        message: `天平沉下去又弹回来，托盘里换出稀有卡牌【${card?.name || '未知'}】。两副白骨同时收回了手。`,
        tone: 'danger',
        outcome: 'weigh',
        card,
      };
    }
    if (choiceId === 'feed') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 14);
      return { ok: true, message: `它们没吃，只把你的伤称了称就还回来。你回复了 ${run.hp - before} 点生命。`, tone: 'good', outcome: 'feed' };
    }
    return { ok: true, message: '你没有走上天平。它在你身后慢慢停了摆。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'mirrorDouble') {
    if (choiceId === 'swap') {
      if (run.hp <= 6) return { ok: false, message: '镜面要一刀的位置，你现在的血不够抵。' };
      run.hp = Math.max(1, run.hp - 6);
      const result = randomUpgrade(run);
      if (result) {
        return {
          ok: true,
          message: `镜里的你替你磨了一次刀。你的【${result.card.name}】被永久强化。`,
          tone: 'danger',
          outcome: 'swap',
          card: result.card,
        };
      }
      const card = gainRandomCard(run);
      return {
        ok: true,
        message: `镜面里没有可以打磨的东西，倒是弹出一张牌【${card?.name || '未知'}】。`,
        tone: 'danger',
        outcome: 'swap',
        card,
      };
    }
    if (choiceId === 'touch') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 13);
      return { ok: true, message: `镜面凉了一瞬，随后把温度还给你。你回复了 ${run.hp - before} 点生命。`, tone: 'good', outcome: 'touch' };
    }
    return { ok: true, message: '你往后退了一步。镜里的你退了半步，像是在替你留余地。', tone: 'quiet', outcome: 'leave' };
  }
  if (eventId === 'heartCore') {
    if (choiceId === 'open') {
      if (run.hp <= 10) return { ok: false, message: '剖开它需要更多的血，而你现在连站稳都勉强。' };
      run.hp = Math.max(1, run.hp - 10);
      const card = gainRandomCard(run, 'rare');
      run.maxHp += 2;
      run.hp = Math.min(run.maxHp, run.hp + 2);
      return {
        ok: true,
        message: `核心被剖开的一瞬，你听见自己的名字回响了一次。你获得了稀有卡牌【${card?.name || '未知'}】，最大生命 +2。`,
        tone: 'danger',
        outcome: 'open',
        card,
      };
    }
    if (choiceId === 'listen') {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 20);
      run.maxHp += 1;
      run.hp = Math.min(run.maxHp, run.hp + 1);
      return {
        ok: true,
        message: `它的心跳替你数了一段呼吸。你回复了 ${run.hp - before} 点生命，最大生命 +1。`,
        tone: 'good',
        outcome: 'listen',
      };
    }
    return { ok: true, message: '你先把手放下了。它还在跳，像是在等你回来。', tone: 'quiet', outcome: 'leave' };
  }
  return { ok: false, message: '什么也没有发生。' };
}

export function pickEventForRegion(regionId, seenIds = []) {
  const eligible = EVENTS.filter((event) => !event.regions?.length || event.regions.includes(regionId));
  const unseen = eligible.filter((event) => !seenIds.includes(event.id));
  return pick(unseen.length ? unseen : eligible);
}

export function getEvent(eventId) {
  return EVENTS.find((event) => event.id === eventId) || EVENTS[0];
}

export function shopPrice(run, base) {
  const discount = relicSum(run.relics, 'discount');
  const mutationScale = Math.max(0.1, Number(run.mutationMods?.shopPriceScale) || 1);
  const contractScale = Math.max(0.1, Number(run.contractMods?.shopPriceScale) || 1);
  const ascensionScale = Math.max(0.1, Number(run.ascensionModifiers?.shopPriceScale) || 1);
  return Math.max(1, Math.round(base * (discount > 0 ? discount : 1) * mutationScale * contractScale * ascensionScale));
}

function cardBasePrice(card) {
  if (!card) return 45;
  if (card.rarity === 'rare') return 95;
  if (card.rarity === 'uncommon') return 68;
  return 45;
}

export function createShop(run) {
  const resonance = runResonance(run);
  const offers = pickCardRewards(3, null, rewardSchoolOptions(resonance)).map((defId) => {
    const def = CARD_MAP[defId];
    return {
      defId,
      price: shopPrice(run, cardBasePrice(def)),
      sold: false,
    };
  });
  const relicId = pickRelicId(run);
  const itemOffers = [];
  const usedItems = new Set();
  while (itemOffers.length < 3 && usedItems.size < ITEMS.length) {
    const defId = pickItemId();
    if (!defId || usedItems.has(defId)) continue;
    usedItems.add(defId);
    const item = ITEM_MAP[defId];
    itemOffers.push({ defId, price: shopPrice(run, item.price), sold: false });
  }
  return {
    cards: offers,
    items: itemOffers,
    relic: relicId ? { defId: relicId, price: shopPrice(run, 130), sold: false } : null,
    heal: {
      price: shopPrice(run, 28),
      amount: Math.min(22, Math.max(0, run.maxHp - run.hp)),
      sold: false,
    },
    // 忘名：删掉牌组里的一张牌，价格随本局删牌次数递增。
    // 「删牌比加牌更有价值」是这个品类最反直觉、也最重要的一条——
    // 20 张牌组里抽到关键牌是 25%，删到 15 张就是 33%。
    // 它同时服务于共鸣：删掉凑数的牌，主导流派的占比才升得上去。
    purge: {
      price: shopPrice(run, 75 + 40 * (Number(run.purgeCount) || 0)),
      sold: false,
    },
    discount: relicSum(run.relics, 'discount') > 0,
  };
}

/** 忘名：从牌组里移除一张牌。 */
export function buyShopPurge(run, shop, deckIndex) {
  const offer = shop?.purge;
  if (!offer || offer.sold) return { ok: false, message: '这一次的忘名已经用过了。' };
  const entry = run?.deck?.[deckIndex];
  if (!entry) return { ok: false, message: '牌组里没有这一张。' };
  if (run.deck.length <= 8) return { ok: false, message: '牌组已经很薄了，再删就走不动路。' };
  if (run.gold < offer.price) return { ok: false, message: '金币不够。' };
  const def = CARD_MAP[entry.defId];
  run.gold -= offer.price;
  run.deck.splice(deckIndex, 1);
  run.purgeCount = (Number(run.purgeCount) || 0) + 1;
  offer.sold = true;
  return { ok: true, card: def };
}

export function buyShopCard(run, shop, index) {
  const offer = shop?.cards?.[index];
  if (!offer || offer.sold) return { ok: false, message: '这件货物已经卖出。' };
  if (run.gold < offer.price) return { ok: false, message: '金币不够。' };
  run.gold -= offer.price;
  run.deck.push({ defId: offer.defId, upgraded: false });
  offer.sold = true;
  return { ok: true, card: getCardDef(offer.defId) };
}

export function buyShopItem(run, shop, index) {
  const offer = shop?.items?.[index];
  if (!offer || offer.sold) return { ok: false, message: '这件道具已经卖出。' };
  if (isInventoryFull(run)) return { ok: false, message: `行囊已经装满 ${MAX_ITEMS} 件道具。` };
  if (run.gold < offer.price) return { ok: false, message: '金币不够。' };
  const item = ITEM_MAP[offer.defId];
  if (!item) return { ok: false, message: '货架上只剩下一层雾。' };
  run.gold -= offer.price;
  addItemToRun(run, offer.defId);
  offer.sold = true;
  return { ok: true, item };
}

export function buyShopRelic(run, shop) {
  const offer = shop?.relic;
  if (!offer || offer.sold) return { ok: false, message: '遗物已经易主。' };
  if (run.gold < offer.price) return { ok: false, message: '金币不够。' };
  const relic = acquireRelic(run, offer.defId);
  if (!relic) return { ok: false, message: '遗物在触碰前化为灰烬。' };
  run.gold -= offer.price;
  offer.sold = true;
  return { ok: true, relic };
}

export function buyShopHeal(run, shop) {
  const offer = shop?.heal;
  if (!offer || offer.sold) return { ok: false, message: '泉水的祝福已经用尽。' };
  if (run.hp >= run.maxHp) return { ok: false, message: '你的生命已经圆满。' };
  if (run.gold < offer.price) return { ok: false, message: '金币不够。' };
  run.gold -= offer.price;
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + 22);
  offer.amount = run.hp - before;
  offer.sold = true;
  return { ok: true, healed: run.hp - before };
}

export function createTreasure(run) {
  const relicId = pickRelicId(run);
  return {
    gold: randomInt(24, 40),
    relicId,
    itemId: pickItemId(),
    claimed: false,
  };
}

export function claimTreasure(run, treasure) {
  if (!run || !treasure || treasure.claimed) return null;
  treasure.claimed = true;
  run.gold += treasure.gold;
  let relic = null;
  if (treasure.relicId) relic = acquireRelic(run, treasure.relicId);
  let item = null;
  let itemLost = false;
  let itemGold = 0;
  if (treasure.itemId) {
    const added = addItemToRun(run, treasure.itemId);
    if (added) item = ITEM_MAP[treasure.itemId];
    else {
      itemLost = true;
      itemGold = 18;
      run.gold += itemGold;
    }
  }
  return { gold: treasure.gold, relic, item, itemLost, itemGold };
}

/** 条件牌：按当前战况给伤害 / 格挡加值。 */
function scalingCount(battle, source) {
  if (!battle) return 0;
  if (source === 'schools') {
    const counts = battle.resonance?.counts || {};
    return Object.values(counts).filter((count) => Number(count) > 0).length;
  }
  if (source === 'exhaust') return battle.exhaustPile?.length || 0;
  if (source === 'hand') return battle.hand?.length || 0;
  if (source === 'statuses') {
    return Object.values(battle.player?.statuses || {}).filter((value) => Number(value) > 0).length;
  }
  return 0;
}

function scalingBonus(battle, scaling) {
  if (!scaling?.source) return 0;
  const scale = Math.max(1, Number(scaling.scale) || 1);
  const cap = Number(scaling.cap) || 99;
  return Math.min(cap, scalingCount(battle, scaling.source) * scale);
}

export function getBattleCard(instance, battle) {
  const def = getCardDef(instance.defId);
  const card = resolveCard(def, instance.upgraded);
  if (!card?.scaling || !battle) return card;
  const bonus = scalingBonus(battle, card.scaling);
  if (!bonus) return card;
  const effects = (card.effects || []).map((effect) => (
    effect.type === 'damage' || effect.type === 'block'
      ? { ...effect, amount: (Number(effect.amount) || 0) + bonus }
      : effect
  ));
  return { ...card, effects, description: `${describeEffects(effects)}${cardScalingText(card.scaling)}` };
}

export function battleDeckComposition(battle) {
  const all = [...battle.drawPile, ...battle.hand, ...battle.discardPile, ...battle.exhaustPile];
  const counts = new Map();
  for (const card of all) {
    const key = `${card.defId}${card.upgraded ? '+' : ''}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count }));
}

export function currentEnemyMove(battle) {
  return getIntent(battle);
}

export function previewEnemyAttack(battle) {
  const move = getIntent(battle);
  if (!battle || !move || !move.damage) return null;
  // 直接调用结算用的同一个函数。预览与结算只要走两条路，
  // 就一定会有一天对不上——而玩家是按预览留格挡的。
  const profile = enemyMoveProfile(battle, move);
  if (!profile) return null;
  const total = profile.total;
  const blocked = Math.min(battle.player.block, total);
  const hpLoss = Math.max(0, total - blocked);
  return {
    move,
    hits: profile.hits,
    perHit: profile.segments[0] ?? profile.perHit,
    total,
    blocked,
    hpLoss,
    lethal: hpLoss >= battle.player.hp,
    // 重段数：多段招在界面要能看出「4 段」
    segments: profile.segments,
  };
}

export function previewCardDamage(battle, instance) {
  if (!battle || !instance) return null;
  const card = getBattleCard(instance, battle);
  if (!card?.effects?.length) return null;
  const bladeBonus = battle.resonance?.primary === 'blade' && card.type === 'attack'
    ? Number(battle.resonance.value) || 0
    : 0;
  // 燃梦的预览与结算必须同源：这是玩家按牌面决定留不留格挡的依据。
  let mutationBonus = card.type === 'attack' && battle.rules?.attackCardTurn !== battle.turn
    ? Math.max(0, Number(battle.rules?.firstAttackBonus) || 0)
    : 0;
  const takeMutationBonus = () => {
    const value = mutationBonus;
    mutationBonus = 0;
    return value;
  };
  let attackRaw = 0;
  let flatRaw = 0;
  let pierce = 0;
  let hits = 0;
  let hasDamage = false;
  let conditional = false;
  for (const effect of card.effects) {
    const amount = Math.max(0, Number(effect.amount) || 0);
    switch (effect.type) {
      case 'damage': {
        const count = Math.max(1, Number(effect.hits) || 1);
        const firstBonus = bladeBonus + takeMutationBonus();
        attackRaw += calcAttackPerHit(amount + firstBonus, battle.player, battle.enemy);
        if (count > 1) attackRaw += calcAttackPerHit(amount + bladeBonus, battle.player, battle.enemy) * (count - 1);
        hits += count;
        hasDamage = true;
        break;
      }
      case 'comboDamage': {
        const combo = battle.origin?.id === 'combo' ? (Number(battle.origin.value) || 0) : 0;
        const scale = Math.max(1, Number(effect.scale) || 4);
        attackRaw += calcAttackPerHit(amount + combo * scale + bladeBonus + takeMutationBonus(), battle.player, battle.enemy);
        hits += 1;
        hasDamage = true;
        break;
      }
      case 'blockDamage': {
        const cap = Math.max(1, amount || 99);
        const base = Math.min(cap, Math.max(0, battle.player.block || 0));
        attackRaw += base > 0
          ? calcAttackPerHit(base + bladeBonus + takeMutationBonus(), battle.player, battle.enemy)
          : 0;
        conditional = base <= 0;
        hits += 1;
        hasDamage = true;
        break;
      }
      case 'execute': {
        const threshold = Math.max(0.05, Math.min(0.9, Number(effect.threshold) || 0.35));
        const multiplier = Math.max(1, Number(effect.multiplier) || 3);
        const ratio = battle.enemy.maxHp > 0 ? battle.enemy.hp / battle.enemy.maxHp : 0;
        const total = ratio <= threshold ? Math.round(amount * multiplier) : amount;
        attackRaw += calcAttackPerHit(total + bladeBonus + takeMutationBonus(), battle.player, battle.enemy);
        hits += 1;
        hasDamage = true;
        break;
      }
      case 'directDamage':
        pierce += amount;
        hasDamage = true;
        break;
      case 'toxicBurst': {
        const poison = battle.enemy.statuses.poison || 0;
        const scale = Math.max(1, Number(effect.scale) || 3);
        if (poison > 0) pierce += poison * scale;
        else conditional = true;
        hasDamage = true;
        break;
      }
      case 'detonate': {
        const status = effect.status === 'poison' ? 'poison' : 'burn';
        const stacks = battle.enemy.statuses[status] || 0;
        if (stacks > 0) flatRaw += stacks * Math.max(1, amount);
        else conditional = true;
        hasDamage = true;
        break;
      }
      default:
        break;
    }
  }
  if (!hasDamage) return null;
  const blockable = attackRaw + flatRaw;
  const blocked = Math.min(battle.enemy.block || 0, blockable);
  const hpLoss = Math.min(battle.enemy.hp, Math.max(0, blockable - blocked) + pierce);
  return {
    card,
    attackRaw,
    flatRaw,
    pierce,
    hits,
    blocked,
    hpLoss,
    total: blockable + pierce,
    lethal: hpLoss >= battle.enemy.hp,
    conditional,
  };
}

export function getRelicDef(relicId) {
  return RELIC_MAP[relicId] || null;
}

export function relicOwned(run, relicId) {
  return Boolean(run?.relics.includes(relicId));
}

export function clampNumber(value, min, max) {
  return clamp(value, min, max);
}
