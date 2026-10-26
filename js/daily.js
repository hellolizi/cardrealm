import {
  CARDS,
  CARD_MAP,
  ENEMIES,
  NON_REWARDABLE,
  ORIGINS,
} from './data.js';
import { ascensionLevel } from './ascension.js';
import { preferredSchoolForOrigin } from './resonance.js';
import { hashSeed } from './utils.js';

const DAILY_ASCENSION = 2;

// 每日轮换的额外规则：让同一天的所有玩家面对同一套变异。
const DAILY_VARIANTS = [
  { id: 'calm', name: '静水', desc: '今日无额外规则', mods: {} },
  { id: 'earlyFang', name: '早牙', desc: '敌人开局 +1 力量', mods: { enemyStartStrength: 1 } },
  { id: 'thickHide', name: '厚皮', desc: '敌人生命 +15%', mods: { enemyHpScale: 1.15 } },
  { id: 'thornBed', name: '棘床', desc: '敌人开局 1 层荆棘', mods: { enemyStartThorns: 1 } },
  { id: 'heavyAir', name: '沉雾', desc: '敌人攻击 +1', mods: { enemyBonusDamage: 1 } },
  { id: 'stoneGuard', name: '石卫', desc: '敌人开局 10 点格挡', mods: { enemyStartBlock: 10 } },
];

function localRoll(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith(list, roll) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(roll() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailyInfo(date = new Date()) {
  const key = dateKey(date);
  const seed = hashSeed(`cardrealm:daily:${key}`);
  const roll = localRoll(seed);
  const bossPool = ENEMIES.filter((enemy) => enemy.tier === 'boss' && enemy.id !== 'hollow-heart');
  const origin = ORIGINS[hashSeed(`daily-origin:${key}`) % ORIGINS.length];
  const enemy = bossPool[hashSeed(`daily-enemy:${key}`) % bossPool.length];
  const school = preferredSchoolForOrigin(origin.id);
  const exclusiveIds = CARDS
    .filter((card) => card.originOnly === origin.id)
    .map((card) => card.id)
    .sort();
  const schoolPool = shuffleWith(
    CARDS
      .filter((card) => card.school === school
        && !NON_REWARDABLE.has(card.id)
        && !card.questOnly
        && !card.originOnly)
      .map((card) => card.id)
      .sort(),
    roll,
  );
  const picks = [];
  for (const id of shuffleWith(exclusiveIds, roll)) {
    if (picks.length >= 2) break;
    picks.push(id);
  }
  for (const id of schoolPool) {
    if (picks.length >= 10) break;
    if (!picks.includes(id)) picks.push(id);
  }
  while (picks.length < 10) {
    const fallback = shuffleWith(
      CARDS.filter((card) => !card.originOnly && !card.questOnly && !NON_REWARDABLE.has(card.id)).map((card) => card.id),
      roll,
    );
    const next = fallback.find((id) => !picks.includes(id));
    if (!next) break;
    picks.push(next);
  }
  const entries = [
    ...origin.starter.map((defId) => ({ defId, upgraded: false })),
    ...picks.map((defId) => ({ defId, upgraded: false })),
  ];
  const upgradeTargets = shuffleWith(
    entries.map((_, index) => index).filter((index) => index >= origin.starter.length),
    roll,
  ).slice(0, 3);
  for (const index of upgradeTargets) entries[index].upgraded = true;
  const ascension = ascensionLevel(DAILY_ASCENSION);
  const variant = DAILY_VARIANTS[hashSeed(`daily-variant:${key}`) % DAILY_VARIANTS.length];
  return {
    key,
    seed,
    variant,
    modifiers: { ...variant.mods },
    origin,
    enemy,
    school,
    entries,
    ascension: ascension.level,
    ascensionInfo: ascension,
    deckSize: entries.length,
    label: `每日梦魇 · ${key}`,
    bossName: enemy.name,
    originName: origin.name,
    cardNames: entries.map((entry) => CARD_MAP[entry.defId]?.name).filter(Boolean),
  };
}

export function dailyModifiers() {
  return ascensionLevel(DAILY_ASCENSION);
}
