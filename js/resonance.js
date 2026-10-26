import { CARD_MAP, SCHOOLS } from './data.js';

export const SCHOOL_ORDER = ['blade', 'star', 'shadow', 'ember', 'thorn', 'dream'];

/**
 * 共鸣门槛统计的是「有流派的牌」，不含 strike/defend 这类基础骨架。
 * 因此比旧版（含骨架）低：旧版 5/10/15 → 现在 4/8/12。
 */
export const RESONANCE_MIN = 4;

/**
 * 纯流派不再只看张数，还要求「主导流派占全部流派牌的比例」。
 * 12/12/12 的平衡牌组主导占比只有 33%，吃不到任何单流派高阶共鸣，
 * 只能走混响——两条路线从此互斥，而不是同时结算。
 */
export const RESONANCE_SHARE_TIERS = [0.4, 0.5, 0.6];

export const RESONANCE_TIERS = [
  { min: 12, tier: 3, label: 'III' },
  { min: 8, tier: 2, label: 'II' },
  { min: 4, tier: 1, label: 'I' },
];

export const RESONANCE_INFO = {
  blade: {
    tag: '剑鸣',
    values: [1, 2, 3],
    effect: '每回合第一张攻击牌使你本回合的攻击伤害 +{v}。',
  },
  star: {
    tag: '星幕',
    values: [3, 5, 7],
    effect: '每回合第一张技能牌额外获得 {v} 点格挡。',
  },
  shadow: {
    tag: '蚀骨',
    values: [1, 2, 3],
    effect: '你施加中毒时，额外施加 {v} 层。',
  },
  ember: {
    tag: '余烬',
    values: [1, 2, 3],
    effect: '你施加灼烧时，额外施加 {v} 层。',
  },
  thorn: {
    tag: '棘甲',
    values: [2, 4, 6],
    effect: '战斗开始时获得 {v} 层荆棘。',
  },
  dream: {
    tag: '遗梦',
    values: [1, 2, 3],
    effect: '每回合第一次抽牌时额外抽 {v} 张。',
  },
};

export const CHORUS_MIN_SCHOOLS = 2;
export const CHORUS_MIN_PER_SCHOOL = 2;
/**
 * 混响是「广度」路线：没有任何一个流派占到流派牌的 65%。
 * 否则 8 剑 + 2 毒 + 2 星这种「主派带两张挂件」的牌组会被强行判成混搭，
 * 反而把它们已经点亮的单流派共鸣压掉——那不是玩家想要的构筑。
 */
export const CHORUS_MAX_TOP_SHARE = 0.65;
export const CHORUS_TIER_MINS = [2, 4, 6];
/** 双派要各 ≥3 张才算数：两派各 2 张太容易在起手里白捡，会把纯派构筑误判成混搭。 */
export const CHORUS_DUAL_MIN_PER_SCHOOL = 3;

export const CHORUS_INFO = {
  tag: '混响',
  values: [5, 7, 9],
  effect: '连续打出不同流派的牌时，本回合攻击 +{v}；同流派连打会断链并清空加成，最多叠 3 层。',
  color: '#c9a06a',
};
const ORIGIN_SCHOOL = {
  blade: 'blade',
  arcanist: 'star',
  wraith: 'shadow',
  pyre: 'ember',
  milkfrog: 'dream',
};

export function preferredSchoolForOrigin(originId) {
  if (ORIGIN_SCHOOL[originId]) return ORIGIN_SCHOOL[originId];
  return SCHOOLS[originId] ? originId : null;
}

function cardOf(entry, lookup) {
  const id = typeof entry === 'string' ? entry : entry?.defId;
  if (!id) return null;
  return lookup ? lookup(id) : CARD_MAP[id];
}

/**
 * 哪些牌不计入流派统计。
 *
 * 只排除「人人都有、且不属于任何角色」的通用骨架：斩击 / 护势。
 * 它们被强制贴上了 blade/star 标签，如果算进去，任何牌组的底噪都会变成
 * 「6 剑 6 星」——破晓剑客开局 10 张就有 6 张剑，直接白送一层共鸣；
 * 而想混搭的人永远要跟这 6+6 抢主导权。共鸣应该奖励构筑，不是奖励起手。
 *
 * 注意：不能按 rarity==='basic' 一刀切。奶蛙蛙的「捧腹」「齁」也是 basic，
 * 但它们是它的角色专属牌，是构筑的一部分，必须计入。
 */
const NEUTRAL_STAPLES = new Set(['strike', 'defend']);

function countsForSchool(card) {
  return chainSchoolOf(card);
}

/**
 * 这张牌在「混响链」里算哪个流派。
 *
 * 与统计口径保持一致：斩击 / 护势是中立的，既不参与起链，也不会打断链。
 * 否则纯流派牌组里的斩击会被当成剑派牌，混搭玩家一打基础牌就断链，
 * 而这两张牌人人都有、且不属于任何角色。
 */
export function chainSchoolOf(card) {
  if (!card) return null;
  if (NEUTRAL_STAPLES.has(card.id)) return null;
  return card.school || null;
}

export function countDeckSchools(entries = [], lookup = null) {
  const counts = Object.fromEntries(SCHOOL_ORDER.map((school) => [school, 0]));
  for (const entry of entries) {
    const school = countsForSchool(cardOf(entry, lookup));
    if (school && Object.hasOwn(counts, school)) counts[school] += 1;
  }
  return counts;
}

function pureTierFor(count, share) {
  if (count >= 12 && share >= RESONANCE_SHARE_TIERS[2]) return 3;
  if (count >= 8 && share >= RESONANCE_SHARE_TIERS[1]) return 2;
  if (count >= RESONANCE_MIN && share >= RESONANCE_SHARE_TIERS[0]) return 1;
  return 0;
}

/** 再补多少张同流派牌，才能让占比达到 share。 */
function cardsNeededForShare(count, total, share) {
  if (total > 0 && count / total >= share) return 0;
  return Math.max(0, Math.ceil((share * total - count) / (1 - share) - 1e-9));
}

function nextPureGoal(count, total, tier) {
  if (tier >= 3) return null;
  const targetTier = tier + 1;
  const targetCount = RESONANCE_TIERS.find((entry) => entry.tier === targetTier)?.min || RESONANCE_MIN;
  const targetShare = RESONANCE_SHARE_TIERS[targetTier - 1];
  return {
    next: targetCount,
    targetTier,
    remaining: Math.max(targetCount - count, cardsNeededForShare(count, total, targetShare), 0),
  };
}

export function computeResonance(entries = [], preferredSchool = null, lookup = null) {
  const counts = countDeckSchools(entries, lookup);
  const ranked = SCHOOL_ORDER.map((id) => ({
    id,
    name: SCHOOLS[id].name,
    color: SCHOOLS[id].color,
    count: counts[id],
  })).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.id === preferredSchool) return -1;
    if (b.id === preferredSchool) return 1;
    return SCHOOL_ORDER.indexOf(a.id) - SCHOOL_ORDER.indexOf(b.id);
  });

  const top = ranked[0];
  const topCount = top?.count || 0;
  const total = Object.values(counts).reduce((sum, amount) => sum + amount, 0);
  const topShare = total > 0 ? topCount / total : 0;

  // 混响：两派各 ≥3 张，或三派各 ≥2 张；且没有流派占到流派牌的 65%。
  //
  // 双派为什么必须算：那是玩家最自然的混搭——「毒配剑」「火配星」，
  // 不需要先背下六个流派才敢动牌组。旧规则只认三派，等于把入门那道门
  // 直接焊死了，玩家只能要么全纯、要么一步跳到三派。
  // 三派的天花板更高（能到 III 档），双派封顶 II 档——先学会走，再学跑。
  const spread = SCHOOL_ORDER.filter((id) => counts[id] >= CHORUS_MIN_PER_SCHOOL);
  const dualSpread = SCHOOL_ORDER.filter((id) => counts[id] >= CHORUS_DUAL_MIN_PER_SCHOOL);
  const chorusActive = (spread.length >= 3 || dualSpread.length >= 2) && topShare < CHORUS_MAX_TOP_SHARE;

  // 纯流派：张数 + 占比双重门槛。主导流派占比不够，就算堆到 12 张也只能拿低档。
  const pureTier = pureTierFor(topCount, topShare);
  const pureSchool = pureTier > 0 ? top.id : null;
  const primary = chorusActive ? null : pureSchool;
  const rawTier = pureTier;
  const tier = primary ? pureTier : 0;
  const info = primary ? RESONANCE_INFO[primary] : null;
  const value = info ? info.values[tier - 1] : 0;
  const pureGoal = chorusActive ? null : nextPureGoal(topCount, total, tier);
  const next = pureGoal ? pureGoal.next : null;
  const remaining = pureGoal ? pureGoal.remaining : 0;

  const second = ranked[1];
  const secondaryActive = Boolean(
    primary
    && !chorusActive
    && second
    && second.count >= RESONANCE_MIN
    && second.count / Math.max(1, total) >= 0.25,
  );
  const secondaryTier = secondaryActive ? (second.count >= 8 ? 2 : 1) : 0;
  const secondaryInfo = secondaryActive ? RESONANCE_INFO[second.id] : null;
  const secondary = secondaryActive ? {
    id: second.id,
    name: second.name,
    color: second.color,
    count: second.count,
    tier: secondaryTier,
    value: Math.max(1, secondaryInfo.values[secondaryTier - 1]),
    info: secondaryInfo,
    tag: secondaryInfo.tag,
  } : null;

  // 混响档位看「参与混响的流派里最少的那一派」有多少张；双派封顶 II 档。
  const chorusBase = chorusActive ? Math.min(...spread.map((id) => counts[id])) : 0;
  const chorusMaxTier = spread.length >= 3 ? 3 : 2;
  let chorusTier = 0;
  if (chorusActive) {
    chorusTier = chorusBase >= CHORUS_TIER_MINS[2] ? 3 : chorusBase >= CHORUS_TIER_MINS[1] ? 2 : 1;
    chorusTier = Math.min(chorusTier, chorusMaxTier);
  }
  const chorusNext = chorusActive && chorusTier < chorusMaxTier ? CHORUS_TIER_MINS[chorusTier] : null;
  const chorus = {
    active: chorusActive,
    tier: chorusTier,
    value: chorusActive ? CHORUS_INFO.values[chorusTier - 1] : 0,
    schools: spread,
    allSchools: spread,
    min: chorusBase,
    next: chorusNext,
    remaining: chorusNext ? Math.max(0, chorusNext - chorusBase) : 0,
    info: CHORUS_INFO,
    color: CHORUS_INFO.color,
    tag: CHORUS_INFO.tag,
  };

  return {
    primary,
    tier,
    rawTier,
    pureTier,
    pureSchool,
    count: top?.count || 0,
    topShare,
    value,
    info,
    school: primary ? SCHOOLS[primary] : null,
    counts,
    ranked,
    total,
    next,
    remaining,
    preferred: preferredSchool,
    secondary,
    chorus,
  };
}

/** 主/副流派加成合并：某流派可能是主，也可能是副（副流派按半档结算）。 */
export function resonanceBonusFor(resonance, school) {
  let value = 0;
  if (resonance?.primary === school) value += Number(resonance.value) || 0;
  if (resonance?.secondary?.id === school) value += Number(resonance.secondary.value) || 0;
  return value;
}

export function tierLabel(tier) {
  return RESONANCE_TIERS.find((entry) => entry.tier === tier)?.label || '';
}

const RESONANCE_RULE_TEXT = `主导流派达到 ${RESONANCE_MIN} 张且占流派牌 ${Math.round(RESONANCE_SHARE_TIERS[0] * 100)}% 时觉醒 I 阶；占比越高，II / III 阶的门槛越高。或走混响：两派各 ${CHORUS_DUAL_MIN_PER_SCHOOL} 张、或三派各 ${CHORUS_MIN_PER_SCHOOL} 张，且没有流派占到 ${Math.round(CHORUS_MAX_TOP_SHARE * 100)}%——混响与单流派共鸣互斥，双派封顶 II 阶，三派可到 III 阶。`;

export function resonanceEffectText(resonance) {
  if (!resonance) return RESONANCE_RULE_TEXT;
  if (resonance.primary && resonance.info) {
    const bits = [resonance.info.effect.replaceAll('{v}', String(resonance.value))];
    if (resonance.secondary?.info) {
      bits.push(`副 ${resonance.secondary.name}：${resonance.secondary.info.effect.replaceAll('{v}', String(resonance.secondary.value))}`);
    }
    return bits.join('　');
  }
  if (resonance.chorus?.active) {
    return `混响：${resonance.chorus.info.effect.replaceAll('{v}', String(resonance.chorus.value))}`;
  }
  return RESONANCE_RULE_TEXT;
}

export function resonanceTitle(resonance) {
  if (resonance?.primary) return `${resonance.school.name}共鸣 ${tierLabel(resonance.tier)}`;
  if (resonance?.chorus?.active) return `混响共鸣 ${tierLabel(resonance.chorus.tier)}`;
  return '尚未共鸣';
}
