import { hashSeed } from './utils.js';

/**
 * 梦境变奏：每座岛抽两条，带着走完整段旅程。
 *
 * 设计约束：每条都必须有「收益」和「代价」，且尽量改规则而不是只堆数值。
 * 两条变奏同时生效，让同一座岛在第二次进入时也有不同的解法；
 * 它们不该把某一流派直接判死，所以代价统一走资源、节奏或奖励。
 */
export const DREAM_MUTATIONS = [
  {
    id: 'kindledDream',
    name: '燃梦',
    glyph: '焰',
    color: '#e08a52',
    desc: '敌人的攻击会点燃你（+1 灼烧）；你每回合打出的第一张攻击牌 +3 伤害。',
    mods: { enemyHitBurn: 1, firstAttackBonus: 3 },
  },
  {
    id: 'longNight',
    name: '长夜',
    glyph: '夜',
    color: '#879bd1',
    desc: '每场战斗的第一回合少抽 2 张牌；战斗胜利后额外获得 25 金币。',
    mods: { firstTurnDrawPenalty: 2, victoryGold: 25 },
  },
  {
    id: 'echoDream',
    name: '回响',
    glyph: '响',
    color: '#9e86d4',
    desc: '你每回合打出的第 3 张牌会引出一次回声：抽 1 张牌；敌人生命 +10%。',
    mods: { enemyHpScale: 1.1, echoDrawEvery: 3 },
  },
  {
    id: 'stillDream',
    name: '凝滞',
    glyph: '滞',
    color: '#6fa8a3',
    desc: '你每回合多抽 1 张牌；敌人每 3 个回合获得 1 层力量。',
    mods: { extraDrawPerTurn: 1, enemyStrengthEvery: 3 },
  },
  {
    id: 'duskDream',
    name: '薄暮',
    glyph: '暮',
    color: '#c8995e',
    desc: '战斗开始时获得 6 点格挡与 1 层敏捷；敌人的攻击 +1。',
    mods: { startBlock: 6, startDexterity: 1, enemyBonusDamage: 1 },
  },
  {
    id: 'warmDream',
    name: '余温',
    glyph: '温',
    color: '#d07a62',
    desc: '回合开始时保留最多 5 点格挡；敌人生命 +8%。',
    mods: { retainBlock: 5, enemyHpScale: 1.08 },
  },
  {
    id: 'emptyDream',
    name: '空梦',
    glyph: '空',
    color: '#8fa7c4',
    desc: '回合结束时若手牌不超过 1 张，获得 7 点格挡；敌人生命 +6%。',
    mods: { emptyHandBlock: 7, enemyHpScale: 1.06 },
  },
  {
    id: 'reverseScale',
    name: '逆鳞',
    glyph: '鳞',
    color: '#c9a0dc',
    desc: '首领的真形会提前 10% 生命降临；击败首领额外获得 60 金币。',
    mods: { phase2Early: 0.1, bossGold: 60 },
  },
  {
    id: 'greedyDream',
    name: '贪梦',
    glyph: '贪',
    color: '#d4b06a',
    desc: '战斗胜利额外获得 30 金币；商店价格 +20%。',
    mods: { victoryGold: 30, shopPriceScale: 1.2 },
  },
];

export const DREAM_MUTATION_MAP = Object.fromEntries(
  DREAM_MUTATIONS.map((mutation) => [mutation.id, mutation]),
);

const MULTIPLICATIVE_KEYS = new Set(['enemyHpScale', 'healScale', 'shopPriceScale']);

/** 纯函数 PRNG：不碰全局种子，故不会改变同一颗种子的地图与奖励。 */
function mutationRng(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 同一颗种子 + 同一座岛，永远抽出同样的两条变奏。 */
export function rollDreamMutations(seed, salt = 'adventure', count = 2) {
  const pool = [...DREAM_MUTATIONS];
  const rng = mutationRng(`${seed}:${salt}:dream-mutations`);
  const picked = [];
  const target = Math.max(0, Math.min(Math.floor(count) || 0, pool.length));
  for (let index = 0; index < target; index += 1) {
    const pickIndex = Math.floor(rng() * pool.length);
    const [mutation] = pool.splice(pickIndex, 1);
    picked.push({
      id: mutation.id,
      name: mutation.name,
      glyph: mutation.glyph,
      color: mutation.color,
      desc: mutation.desc,
    });
  }
  return picked;
}

/** 把多条变奏的修正合并成一份；生命/价格系数相乘，其余数值相加。 */
export function mergeMutationMods(mutations = []) {
  const mods = {};
  for (const entry of mutations) {
    const definition = DREAM_MUTATION_MAP[entry?.id] || entry;
    if (!definition?.mods) continue;
    for (const [key, value] of Object.entries(definition.mods)) {
      const number = Number(value);
      if (!Number.isFinite(number)) continue;
      if (MULTIPLICATIVE_KEYS.has(key)) {
        mods[key] = (Number(mods[key]) || 1) * number;
      } else {
        mods[key] = (Number(mods[key]) || 0) + number;
      }
    }
  }
  return mods;
}

/** 存档恢复时只信任 id：名字与文案永远以当前定义为准。 */
export function sanitizeDreamMutations(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of list) {
    const id = typeof entry === 'string' ? entry : entry?.id;
    const definition = DREAM_MUTATION_MAP[id];
    if (!definition || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id: definition.id,
      name: definition.name,
      glyph: definition.glyph,
      color: definition.color,
      desc: definition.desc,
    });
  }
  return result.slice(0, 2);
}
