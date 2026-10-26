import { ENDINGS, REGIONS } from './lore.js';
import { G, pushRewardPop, saveProfileNow } from './state.js';
import { grantQuestCard } from './world-state.js';

export const ACHIEVEMENTS = [
  {
    id: 'first-wake', name: '初次醒来', group: '旅程', glyph: '梦', color: '#c2a46d',
    desc: '完成第一次梦魇之战，带着胜利回到群岛。',
    target: 1, metric: 'wins', metricLabel: '胜利',
  },
  {
    id: 'hundred-cards', name: '百牌成诗', group: '旅程', glyph: '牌', color: '#b08bb8',
    desc: '在梦境群岛中累计打出 100 张卡牌。',
    target: 100, metric: 'cardsPlayed', metricLabel: '打出',
  },
  {
    id: 'ten-nightmares', name: '十魇', group: '旅程', glyph: '魇', color: '#9d7a78',
    desc: '累计击败 10 个梦魇。',
    target: 10, metric: 'enemiesFelled', metricLabel: '击败',
  },
  {
    id: 'lord-falls', name: '岛屿之主', group: '远征', glyph: '冠', color: '#d0a65c',
    desc: '击败任意一座岛的梦魇之主。',
    target: 1, metric: 'bosses', metricLabel: '岛主',
    reward: 'islandCrown',
  },
  {
    id: 'island-cleared', name: '踏平一岛', group: '远征', glyph: '岛', color: '#7fa9a4',
    desc: '完成一次完整的岛屿远征。',
    target: 1, metric: 'clears', metricLabel: '远征',
  },
  {
    id: 'all-islands', name: '七海足迹', group: '远征', glyph: '图', color: '#8fb8c4',
    desc: '踏平梦境群岛中的每一座岛。',
    target: REGIONS.length, metric: 'regions', metricLabel: '岛屿',
    reward: 'sevenCompass',
  },
  {
    id: 'first-farewell', name: '第一种告别', group: '故事', glyph: '别', color: '#c98b9b',
    desc: '抵达并记住第一种结局。',
    target: 1, metric: 'endings', metricLabel: '结局',
  },
  {
    id: 'all-farewells', name: '所有告别', group: '故事', glyph: '尽', color: '#d6a08f',
    desc: '见证结局回廊里的每一种告别。',
    target: ENDINGS.length, metric: 'endings', metricLabel: '结局',
    reward: 'farewellKey',
  },
  {
    id: 'first-word', name: '第一句话', group: '故事', glyph: '言', color: '#8fa2a6',
    desc: '第一次在交涉中让对方产生迟疑。',
    target: 1, metric: 'parleys', metricLabel: '交涉',
  },
  {
    id: 'silver-tongue', name: '五次对谈', group: '故事', glyph: '谈', color: '#a9b58f',
    desc: '累计完成 5 次成功交涉。',
    target: 5, metric: 'parleys', metricLabel: '交涉',
  },
  {
    id: 'pickpocket', name: '指尖的铜铃', group: '行商', glyph: '偷', color: '#c6a877',
    desc: '从行商的货箱里偷走第一件东西。',
    target: 1, metric: 'steals', metricLabel: '偷窃',
  },
  {
    id: 'merchant-owner', name: '货袋换主', group: '行商', glyph: '商', color: '#d0b267',
    desc: '在行商之战中击败万货行商。',
    target: 1, metric: 'merchantsFelled', metricLabel: '行商',
  },
  {
    id: 'relic-chorus', name: '五器同鸣', group: '构筑', glyph: '器', color: '#c2a46d',
    desc: '在同一次远征中同时携带 5 件遗物。',
    target: 5, metric: 'maxRelics', metricLabel: '遗物',
    reward: 'relicChorus',
  },
  {
    id: 'deeper-dream', name: '向下做梦', group: '梦境层级', glyph: '层', color: '#7f95b3',
    desc: '在梦境层级 1 或更高难度完成一座岛。',
    target: 1, metric: 'ascensionBest', metricLabel: '最高层级',
  },
  {
    id: 'heart-nightmare', name: '心魇之上', group: '梦境层级', glyph: '渊', color: '#c26058',
    desc: '在梦境层级 5「心魇」完成一座岛。',
    target: 5, metric: 'ascensionBest', metricLabel: '最高层级',
  },
  {
    id: 'drowned-dreamer', name: '溺梦者', group: '梦境层级', glyph: '溺', color: '#7296a8',
    desc: '在梦境层级 7「溺梦」完成一座岛。',
    target: 7, metric: 'ascensionBest', metricLabel: '最高层级',
  },
  {
    id: 'abyss-return', name: '心渊回望', group: '梦境层级', glyph: '心', color: '#c94848',
    desc: '在梦境层级 10「心渊」完成一座岛。',
    target: 10, metric: 'ascensionBest', metricLabel: '最高层级',
  },
  {
    id: 'daily-first', name: '今日之梦', group: '每日挑战', glyph: '日', color: '#d7bb76',
    desc: '完成第一次每日梦魇。',
    target: 1, metric: 'dailyCompletions', metricLabel: '完成',
  },
  {
    id: 'daily-streak', name: '三日不醒', group: '每日挑战', glyph: '连', color: '#e0a080',
    desc: '在每日梦魇中达成 3 日连胜。',
    target: 3, metric: 'dailyStreak', metricLabel: '连胜',
  },
  {
    id: 'flawless-lord', name: '无伤之主', group: '远征', glyph: '净', color: '#9fc3b4',
    desc: '不受到任何伤害便击败一位岛屿之主。',
    target: 1, metric: 'flawlessBosses', metricLabel: '无伤',
  },
  {
    id: 'three-thousand-hates', name: '消我泱泱三千恨', group: '彩蛋', glyph: '恨', color: '#dcb04a',
    desc: '带着奶蛙蛙上阵，在战斗里累计狂笑 30 次。',
    target: 30, metric: 'laughs', metricLabel: '狂笑',
  },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((entry) => [entry.id, entry]));

// 纪念牌属于远征模式的物品，只有在远征相关的结算节点才发放。
// 每日挑战 / 试炼 / 在线等独立模式即使触发了成就，也不会得到跨模式的物品。
const REWARD_TRIGGERS = new Set(['adventure', 'ending', 'battle', 'parley', 'steal', 'relic']);

function bucket() {
  if (!G.profile.achievements || typeof G.profile.achievements !== 'object') {
    G.profile.achievements = {};
  }
  const state = G.profile.achievements;
  if (!state.unlocked || typeof state.unlocked !== 'object') state.unlocked = {};
  if (!state.counters || typeof state.counters !== 'object') state.counters = {};
  if (typeof state.totalXp !== 'number') state.totalXp = 0;
  return state;
}

export function achievementState() {
  return bucket();
}

export function achievementCounts() {
  const state = bucket();
  const unlocked = ACHIEVEMENTS.filter((entry) => state.unlocked[entry.id]).length;
  return { unlocked, total: ACHIEVEMENTS.length };
}

function countersSnapshot() {
  const state = bucket();
  if (G.run?.relics && Array.isArray(G.run.relics)) {
    state.counters.maxRelics = Math.max(Number(state.counters.maxRelics) || 0, G.run.relics.length);
  }
  return state.counters;
}

export function achievementMetrics() {
  const world = G.profile.world;
  const daily = G.profile.daily || {};
  const counters = countersSnapshot();
  return {
    wins: Number(G.profile.stats?.wins) || 0,
    cardsPlayed: Number(world?.stats?.cardsPlayed) || 0,
    enemiesFelled: Number(G.profile.stats?.enemiesFelled) || 0,
    bosses: Number(world?.stats?.bosses) || 0,
    clears: Number(world?.stats?.clears) || 0,
    regions: Array.isArray(world?.clearedRegions) ? world.clearedRegions.length : 0,
    endings: Array.isArray(world?.endings) ? world.endings.length : 0,
    parleys: Number(world?.parleySuccesses) || 0,
    steals: Number(counters.steals) || 0,
    merchantsFelled: Number(counters.merchantsFelled) || 0,
    maxRelics: Number(counters.maxRelics) || 0,
    ascensionBest: Number(G.profile.ascensionBest) || 0,
    dailyCompletions: Number(daily.completions) || 0,
    dailyStreak: Number(daily.bestStreak) || 0,
    flawlessBosses: Number(counters.flawlessBosses) || 0,
    laughs: Number(counters.laughs) || 0,
  };
}

export function achievementGallery() {
  const state = bucket();
  const metrics = achievementMetrics();
  return ACHIEVEMENTS.map((entry) => {
    const value = Math.min(entry.target, Number(metrics[entry.metric]) || 0);
    return {
      ...entry,
      unlocked: Boolean(state.unlocked[entry.id]),
      unlockedAt: Number(state.unlocked[entry.id]) || null,
      value,
      percent: entry.target > 0 ? Math.min(100, (value / entry.target) * 100) : 100,
    };
  });
}

export function evaluateAchievements(trigger = 'check') {
  const state = bucket();
  const metrics = achievementMetrics();
  const newly = [];
  for (const entry of ACHIEVEMENTS) {
    if (state.unlocked[entry.id]) continue;
    if ((Number(metrics[entry.metric]) || 0) < entry.target) continue;
    state.unlocked[entry.id] = Date.now();
    state.totalXp = (Number(state.totalXp) || 0) + 10 + entry.target;
    if (entry.reward && REWARD_TRIGGERS.has(trigger)) {
      const card = grantQuestCard(G.profile.world, entry.reward);
      if (card) pushRewardPop(card.name);
    }
    newly.push(entry);
  }
  if (newly.length) {
    state.lastTrigger = trigger;
    G.ui.achievementPops = [
      ...(Array.isArray(G.ui.achievementPops) ? G.ui.achievementPops : []),
      ...newly.map((entry) => entry.name),
    ];
    saveProfileNow();
  }
  return newly;
}

function bumpCounter(key, amount = 1) {
  const state = bucket();
  state.counters[key] = Math.max(0, (Number(state.counters[key]) || 0) + amount);
  return state.counters[key];
}

export function recordBattleOutcome(battle) {
  if (!battle || battle.phase !== 'victory' || battle.achievementRecorded) return [];
  battle.achievementRecorded = true;
  const state = bucket();
  let changed = false;
  // 每一场胜利都留下一点梦的碎片。
  // 碎片可以解锁卡池，也可以在祭坛签下契约——只加「可能」与「选择」，不白送数值。
  const shardGain = battle.tier === 'boss' ? 8 : battle.tier === 'elite' ? 3 : battle.tier === 'merchant' ? 4 : 1;
  G.profile.shards = Math.max(0, Number(G.profile.shards) || 0) + shardGain;
  if (battle.mode !== 'sandbox') changed = true;
  if (battle.tier === 'boss' && (Number(battle.stats?.damageTaken) || 0) === 0) {
    state.counters.flawlessBosses = (Number(state.counters.flawlessBosses) || 0) + 1;
    changed = true;
  }
  if (battle.tier === 'merchant') {
    state.counters.merchantsFelled = (Number(state.counters.merchantsFelled) || 0) + 1;
    changed = true;
  }
  if (Array.isArray(battle.relics) && battle.relics.length) {
    const current = Number(state.counters.maxRelics) || 0;
    if (battle.relics.length > current) {
      state.counters.maxRelics = battle.relics.length;
      changed = true;
    }
  }
  if (changed) saveProfileNow();
  return evaluateAchievements('battle');
}

export function recordStealSuccess() {
  bumpCounter('steals');
  saveProfileNow();
  return evaluateAchievements('steal');
}

/** 奶蛙蛙的狂笑：既用于成就，也用于「消我泱泱三千恨」的累计。 */
export function recordLaugh() {
  bumpCounter('laughs');
  saveProfileNow();
  return evaluateAchievements('laugh');
}

export function recordRunRelicCount(count) {
  const state = bucket();
  if (count <= (Number(state.counters.maxRelics) || 0)) return [];
  state.counters.maxRelics = count;
  saveProfileNow();
  return evaluateAchievements('relic');
}
