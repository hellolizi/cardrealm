import { hashSeed } from './utils.js';

/**
 * 梦呓契约：用梦的碎片签下的规则型遗物。
 *
 * 与普通遗物不同，契约不堆数值，而是改写一两条战斗/地图规则；
 * 每一份都必须同时给出收益与代价，让玩家按自己的牌组选择。
 * 契约只属于当前这趟梦，不会改变下一局的起点。
 */
export const DREAM_CONTRACTS = [
  {
    id: 'paperCrown',
    name: '纸冠',
    glyph: '冠',
    color: '#c9b6d8',
    benefit: '每回合多抽 1 张牌。',
    drawback: '每回合最多打出 4 张牌。',
    desc: '每回合多抽 1 张牌；每回合最多打出 4 张牌。',
    flavor: '纸做的冠冕很轻，轻到你必须把每一句话都说得很准。',
    rules: { contractDraw: 1, cardPlayLimit: 4 },
  },
  {
    id: 'borrowedFlame',
    name: '借火',
    glyph: '借',
    color: '#e08a52',
    benefit: '每回合获得 1 点额外能量。',
    drawback: '每回合结束时失去 2 点生命。',
    desc: '每回合获得 1 点额外能量；每回合结束时失去 2 点生命。',
    flavor: '火是从别人梦里借来的。它照亮你，也记得该向谁收账。',
    rules: { contractEnergy: 1, endTurnHpLoss: 2 },
  },
  {
    id: 'silentVow',
    name: '缄口',
    glyph: '缄',
    color: '#879bd1',
    benefit: '每回合获得 1 点额外能量。',
    drawback: '你无法使用旅途道具。',
    desc: '每回合获得 1 点额外能量；你无法使用旅途道具。',
    flavor: '你答应过不向瓶子里的人求助。梦听见了。',
    rules: { contractEnergy: 1, noItems: true },
  },
  {
    id: 'thornOath',
    name: '荆棘誓约',
    glyph: '棘',
    color: '#a88968',
    benefit: '战斗开始时获得 4 层荆棘。',
    drawback: '战斗与营火中的治疗减半。',
    desc: '战斗开始时获得 4 层荆棘；战斗与营火中的治疗减半。',
    flavor: '玫瑰把根扎进你的影子，从此每次愈合都要先穿过刺。',
    rules: { startThorns: 4, healScale: 0.5 },
  },
  {
    id: 'foldedPage',
    name: '折页',
    glyph: '折',
    color: '#c8995e',
    benefit: '每回合第一张牌的费用 -1。',
    drawback: '营火不再回复生命。',
    desc: '每回合第一张牌的费用 -1；营火不再回复生命。',
    flavor: '你把最前面的一页折了起来。火照着它，却怎么也照不暖。',
    rules: { firstCardDiscount: 1, noRestHeal: true },
  },
  {
    id: 'gamblersDream',
    name: '赌梦',
    glyph: '赌',
    color: '#d4b06a',
    benefit: '每场战斗胜利额外获得 45 金币。',
    drawback: '商店价格 +30%。',
    desc: '每场战斗胜利额外获得 45 金币；商店价格 +30%。',
    flavor: '梦说：先赢的人，得替后来的人付账。',
    rules: { victoryGold: 45, shopPriceScale: 1.3 },
  },
  {
    id: 'lingeringEcho',
    name: '残响',
    glyph: '响',
    color: '#9e86d4',
    benefit: '每回合第一次受到伤害时，抽 1 张牌。',
    drawback: '敌人的攻击 +1。',
    desc: '每回合第一次受到伤害时，抽 1 张牌；敌人的攻击 +1。',
    flavor: '疼会留下回声。你听见的每一下，都是梦在替你数牌。',
    rules: { firstHitDraw: 1, enemyBonusDamage: 1 },
  },
  {
    id: 'stonesleep',
    name: '石眠',
    glyph: '眠',
    color: '#9a9a94',
    benefit: '战斗开始时获得 12 点格挡。',
    drawback: '战斗中的治疗全部失效。',
    desc: '战斗开始时获得 12 点格挡；战斗中的治疗全部失效。',
    flavor: '睡着的人不会流血，也不会愈合。',
    rules: { startBlock: 12, noHeal: true },
  },
];

export const CONTRACT_MAP = Object.fromEntries(
  DREAM_CONTRACTS.map((contract) => [contract.id, contract]),
);

export const MAX_CONTRACTS = 2;

const MULTIPLICATIVE_KEYS = new Set(['healScale', 'shopPriceScale']);
const MIN_KEYS = new Set(['cardPlayLimit']);
const BOOLEAN_KEYS = new Set(['noItems', 'noRestHeal', 'noHeal']);

/** 第一份 12 碎片，第二份 20。碎片不退还，撕毁也要想清楚。 */
export function contractPrice(activeCount = 0) {
  return 12 + Math.max(0, Math.min(MAX_CONTRACTS, Math.floor(Number(activeCount) || 0))) * 8;
}

/** 纯函数 PRNG：岩石/契约报价不碰全局种子，地图与奖励保持可复现。 */
function contractRng(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function contractDisplay(id) {
  const contract = CONTRACT_MAP[id];
  if (!contract) return null;
  return {
    id: contract.id,
    name: contract.name,
    glyph: contract.glyph,
    color: contract.color,
    benefit: contract.benefit,
    drawback: contract.drawback,
    desc: contract.desc,
    flavor: contract.flavor,
  };
}

/** 同一颗种子 + 同一座岛，永远给出同样的三份报价。 */
export function rollContractOffers(seed, salt = 'adventure', count = 3) {
  const pool = [...DREAM_CONTRACTS];
  const rng = contractRng(`${seed}:${salt}:dream-contracts`);
  const picked = [];
  const target = Math.max(0, Math.min(Math.floor(count) || 0, pool.length));
  for (let index = 0; index < target; index += 1) {
    const pickIndex = Math.floor(rng() * pool.length);
    const [contract] = pool.splice(pickIndex, 1);
    picked.push(contractDisplay(contract.id));
  }
  return picked;
}

/** 存档恢复时只信任 id：名称、文案与规则永远以当前定义为准。 */
export function sanitizeContracts(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of list) {
    const id = typeof entry === 'string' ? entry : entry?.id;
    if (!CONTRACT_MAP[id] || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result.slice(0, MAX_CONTRACTS);
}

/** 多份契约的规则合并：治疗/价格系数相乘，牌数上限取最低，其余相加。 */
export function mergeContractRules(contracts = []) {
  const rules = {};
  for (const entry of contracts) {
    const definition = CONTRACT_MAP[typeof entry === 'string' ? entry : entry?.id];
    if (!definition?.rules) continue;
    for (const [key, value] of Object.entries(definition.rules)) {
      if (BOOLEAN_KEYS.has(key)) {
        rules[key] = Boolean(rules[key]) || Boolean(value);
        continue;
      }
      const number = Number(value);
      if (!Number.isFinite(number)) continue;
      if (MULTIPLICATIVE_KEYS.has(key)) {
        rules[key] = (Number(rules[key]) || 1) * number;
      } else if (MIN_KEYS.has(key)) {
        const current = Number(rules[key]);
        rules[key] = current > 0 ? Math.min(current, number) : number;
      } else {
        rules[key] = (Number(rules[key]) || 0) + number;
      }
    }
  }
  return rules;
}

export function contractList(ids = []) {
  return ids.map(contractDisplay).filter(Boolean);
}
