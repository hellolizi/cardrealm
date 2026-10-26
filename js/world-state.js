import { CARD_MAP, ENEMY_MAP, PARLEY_APPROACHES } from './data.js';
import {
  CHAPTERS,
  ENDINGS,
  ENDING_MAP,
  REGIONS,
  REGION_MAP,
  NPCS,
  NPC_MAP,
  QUESTS,
  QUEST_MAP,
  DIALOGUES,
} from './lore.js';

export const WORLD_VERSION = 1;

export function defaultWorld() {
  const npcs = {};
  for (const npc of NPCS) npcs[npc.id] = { met: false, talks: 0 };
  const regionClears = {};
  for (const region of REGIONS) regionClears[region.id] = 0;
  return {
    version: WORLD_VERSION,
    chapter: 0,
    flags: {},
    stats: { runs: 0, clears: 0, elites: 0, bosses: 0, cardsPlayed: 0, defeats: 0 },
    regionClears,
    clearedRegions: [],
    unlockedRegions: ['corridor'],
    npcs,
    quests: { completed: [] },
    questCards: [],
    trophyCard: null,
    endings: [],
    lastEnding: null,
    lastRegion: 'corridor',
    storySeen: [],
    parleySuccesses: 0,
    parleyStyles: {},
    bossParleys: [],
    dialogues: { seen: [], nodes: {}, flags: {} },
    pendingFinale: false,
  };
}

function safeCount(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function uniqueStrings(list, valid) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.filter((item) => {
    if (typeof item !== 'string' || !valid(item) || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

export function sanitizeWorld(raw) {
  const world = defaultWorld();
  if (!raw || typeof raw !== 'object') return world;
  world.chapter = Math.min(CHAPTERS.length - 1, safeCount(raw.chapter, 0));
  world.version = WORLD_VERSION;

  if (raw.flags && typeof raw.flags === 'object') {
    for (const [key, value] of Object.entries(raw.flags)) {
      if (typeof key === 'string' && value) world.flags[key] = true;
    }
  }

  const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  world.stats.runs = safeCount(stats.runs);
  world.stats.clears = safeCount(stats.clears);
  world.stats.elites = safeCount(stats.elites);
  world.stats.bosses = safeCount(stats.bosses);
  world.stats.cardsPlayed = safeCount(stats.cardsPlayed);
  world.stats.defeats = safeCount(stats.defeats);

  const rawClears = raw.regionClears && typeof raw.regionClears === 'object' ? raw.regionClears : {};
  for (const region of REGIONS) {
    world.regionClears[region.id] = safeCount(rawClears[region.id]);
  }
  world.clearedRegions = uniqueStrings(raw.clearedRegions, (id) => Boolean(REGION_MAP[id]));
  for (const regionId of world.clearedRegions) {
    world.regionClears[regionId] = Math.max(1, world.regionClears[regionId]);
  }
  if (!world.stats.clears) {
    world.stats.clears = Object.values(world.regionClears).reduce((sum, count) => sum + count, 0);
  }

  world.unlockedRegions = uniqueStrings(raw.unlockedRegions, (id) => Boolean(REGION_MAP[id]));
  if (!world.unlockedRegions.includes('corridor')) world.unlockedRegions.unshift('corridor');
  for (const regionId of world.clearedRegions) {
    if (!world.unlockedRegions.includes(regionId)) world.unlockedRegions.push(regionId);
  }

  const rawNpcs = raw.npcs && typeof raw.npcs === 'object' ? raw.npcs : {};
  for (const npc of NPCS) {
    const saved = rawNpcs[npc.id] && typeof rawNpcs[npc.id] === 'object' ? rawNpcs[npc.id] : {};
    world.npcs[npc.id] = { met: Boolean(saved.met), talks: Math.min(999, safeCount(saved.talks)) };
  }

  const rawQuests = raw.quests && typeof raw.quests === 'object' ? raw.quests.completed : null;
  world.quests.completed = uniqueStrings(rawQuests, (id) => Boolean(QUEST_MAP[id]));
  world.questCards = uniqueStrings(raw.questCards, (id) => Boolean(CARD_MAP[id]));
  world.trophyCard = typeof raw.trophyCard === 'string' && world.questCards.includes(raw.trophyCard)
    ? raw.trophyCard
    : null;
  world.endings = uniqueStrings(raw.endings, (id) => Boolean(ENDING_MAP[id]));
  world.lastEnding = typeof raw.lastEnding === 'string' && ENDING_MAP[raw.lastEnding] ? raw.lastEnding : null;
  if (world.lastEnding && !world.endings.includes(world.lastEnding)) world.endings.push(world.lastEnding);
  world.lastRegion = REGION_MAP[raw.lastRegion] ? raw.lastRegion : 'corridor';
  world.storySeen = uniqueStrings(raw.storySeen, (id) => typeof id === 'string');
  world.parleySuccesses = safeCount(raw.parleySuccesses);
  const rawStyles = raw.parleyStyles && typeof raw.parleyStyles === 'object' ? raw.parleyStyles : {};
  for (const approach of PARLEY_APPROACHES) {
    world.parleyStyles[approach.id] = safeCount(rawStyles[approach.id]);
  }
  world.bossParleys = uniqueStrings(raw.bossParleys, (id) => ENEMY_MAP[id]?.tier === 'boss');
  const rawDialogues = raw.dialogues && typeof raw.dialogues === 'object' ? raw.dialogues : {};
  world.dialogues.seen = uniqueStrings(rawDialogues.seen, (id) => typeof id === 'string');
  world.dialogues.nodes = {};
  if (rawDialogues.nodes && typeof rawDialogues.nodes === 'object') {
    for (const [key, value] of Object.entries(rawDialogues.nodes)) {
      if (typeof key === 'string' && value) world.dialogues.nodes[key] = true;
    }
  }
  world.dialogues.flags = {};
  if (rawDialogues.flags && typeof rawDialogues.flags === 'object') {
    for (const [key, value] of Object.entries(rawDialogues.flags)) {
      if (typeof key === 'string' && value) world.dialogues.flags[key] = true;
    }
  }
  world.pendingFinale = Boolean(raw.pendingFinale);
  return world;
}

export function regionClearCount(world, regionId) {
  return world?.regionClears?.[regionId] || 0;
}

export function isRegionUnlocked(world, regionId) {
  return Boolean(world?.unlockedRegions?.includes(regionId));
}

/**
 * 开放世界的解锁判定：看航路，不看次数。
 *
 * 一座岛通航的条件是「有一端的岛被你踏平」，所以折廊一打赢，
 * 雾隐、骨庭、镜潮、潮钟会同时亮起来，你想先去哪座就去哪座。
 * 心岛是唯一的例外：三条支流（灰烬、潮钟、纸月）都得走通。
 */
export function unlockProgress(world, region) {
  const unlock = region?.unlock || {};
  const near = unlock.near ? REGION_MAP[unlock.near] : null;
  const nearCleared = near ? regionClearCount(world, near.id) > 0 : true;
  const requiredRegionIds = unlock.regions || [];
  const missingRegions = requiredRegionIds
    .filter((regionId) => regionClearCount(world, regionId) <= 0)
    .map((regionId) => REGION_MAP[regionId]?.name || regionId);

  // 老存档里可能有 clears 条件，仍然尊重它，但只作为附加门槛。
  const requiredClears = Number(unlock.clears) || 0;
  const currentClears = world?.stats?.clears || 0;
  const clearsMet = currentClears >= requiredClears;

  const met = nearCleared && clearsMet && !missingRegions.length;
  const gateName = near?.name || '';
  return {
    current: missingRegions.length ? requiredRegionIds.length - missingRegions.length : (met ? 1 : 0),
    required: Math.max(1, requiredRegionIds.length || 1),
    missingRegions,
    nearName: gateName,
    nearCleared,
    met,
    text: missingRegions.length
      ? `还需踏平：${missingRegions.join('、')}`
      : nearCleared
        ? '航路已通'
        : `需先踏平${gateName}`,
  };
}

export function refreshWorld(world) {
  const newlyUnlocked = [];
  for (const region of REGIONS) {
    if (isRegionUnlocked(world, region.id)) continue;
    const progress = unlockProgress(world, region);
    if (!progress.met) continue;
    world.unlockedRegions.push(region.id);
    newlyUnlocked.push(region);
  }

  const completedQuests = [];
  for (const quest of QUESTS) {
    if (world.quests.completed.includes(quest.id)) continue;
    if (quest.requires && !world.quests.completed.includes(quest.requires)) continue;
    const progress = questProgress(world, quest);
    if (!progress.done) continue;
    world.quests.completed.push(quest.id);
    if (quest.card && CARD_MAP[quest.card] && !world.questCards.includes(quest.card)) {
      world.questCards.push(quest.card);
    }
    completedQuests.push({ quest, card: CARD_MAP[quest.card] || null });
  }
  return { newlyUnlocked, completedQuests };
}

export function questProgress(world, quest) {
  const objective = quest.objective || {};
  let value = 0;
  if (objective.type === 'clears') value = world.stats.clears || 0;
  else if (objective.type === 'elites') value = world.stats.elites || 0;
  else if (objective.type === 'bosses') value = world.stats.bosses || 0;
  else if (objective.type === 'cardsPlayed') value = world.stats.cardsPlayed || 0;
  else if (objective.type === 'endings') value = world.endings.length || 0;
  else if (objective.type === 'region') value = regionClearCount(world, objective.regionId);
  const target = Math.max(1, safeCount(objective.target, 1));
  return {
    value: Math.min(value, target),
    rawValue: value,
    target,
    done: value >= target,
    label: objective.label || '进度',
  };
}

export function questStatus(world, quest) {
  if (world.quests.completed.includes(quest.id)) return 'completed';
  if (quest.requires && !world.quests.completed.includes(quest.requires)) return 'locked';
  return 'active';
}

export function questsForNpc(world, npcId) {
  return QUESTS.filter((quest) => quest.npc === npcId).map((quest) => ({
    quest,
    status: questStatus(world, quest),
    progress: questProgress(world, quest),
  }));
}

export function npcBond(world, npcId) {
  if (!world?.npcs?.[npcId]?.met) return 0;
  const questsDone = QUESTS.filter(
    (quest) => quest.npc === npcId && world.quests.completed.includes(quest.id),
  ).length;
  return 1 + (questsDone >= 2 ? 1 : 0) + (questsDone >= 4 ? 1 : 0);
}

export function bondLabel(bond) {
  return ['未相识', '初识', '信任', '托付'][Math.max(0, Math.min(3, bond))];
}

export function markNpcTalk(world, npcId) {
  const npcState = world.npcs[npcId];
  if (!npcState) return;
  npcState.met = true;
  npcState.talks = Math.min(999, (npcState.talks || 0) + 1);
}

export function npcTalkLine(world, npc) {
  const state = world.npcs[npc.id];
  if (!state?.met) return npc.first;
  const bond = npcBond(world, npc.id);
  const level = Math.min(bond, npc.dialogues.length - 1);
  const pool = npc.dialogues[level];
  return pool[(state.talks || 0) % pool.length];
}

/* ───────────────── 分支对话的推进与结算 ───────────────── */

function dialogueKey(npcId, nodeId) {
  return `${npcId}:${nodeId}`;
}

/** 这个角色有没有还愿意说的「正经话」（不是寒暄）。 */
export function pendingDialogue(world, npcId) {
  const played = world?.dialogues?.nodes || {};
  for (const [id, dialogue] of Object.entries(DIALOGUES)) {
    if (dialogue.npc !== npcId) continue;
    if (played[dialogueKey(npcId, dialogue.entry)]) continue;
    // 带上真实键名，弹窗拿它去 DIALOGUES 里取节点图。
    return { ...dialogue, id };
  }
  return null;
}

export function dialogueSeenNode(world, npcId, nodeId) {
  return Boolean(world?.dialogues?.nodes?.[dialogueKey(npcId, nodeId)]);
}

export function markDialogueNode(world, npcId, nodeId) {
  if (!world?.dialogues) return;
  const key = dialogueKey(npcId, nodeId);
  world.dialogues.nodes[key] = true;
  if (!world.dialogues.seen.includes(key)) world.dialogues.seen.push(key);
}

/**
 * 结算一个对话节点的效果。
 * 只处理三件在剧情里说得通的事：羁绊、给钱/回血、记一个 flag。
 * 不在这里发卡——发卡走委托，剧情不该变成奖励机。
 */
export function applyDialogueEffect(world, node) {
  const effect = node?.effect;
  if (!effect) return { applied: [] };
  const applied = [];
  if (effect.bond && NPC_MAP[node.npc] && world.npcs[node.npc]) {
    world.npcs[node.npc].met = true;
    world.npcs[node.npc].talks = Math.min(999, (world.npcs[node.npc].talks || 0) + 1);
    applied.push('bond');
  }
  if (effect.flag) {
    world.dialogues.flags[effect.flag] = true;
    applied.push('flag');
  }
  return { applied, reward: effect.reward || null, line: effect.line || '' };
}

export function dialogueFlag(world, flag) {
  return Boolean(world?.dialogues?.flags?.[flag]);
}

/** 某个阵营里已经聊过几句的人。用于世界地图上的「他们记得你」。 */
export function factionRoster(world, factionId) {
  return NPCS.filter((npc) => (npc.faction || 'neutral') === factionId).map((npc) => ({
    npc,
    bond: npcBond(world, npc.id),
    met: Boolean(world.npcs?.[npc.id]?.met),
    hasTalk: Boolean(pendingDialogue(world, npc.id)),
  }));
}

export function questCardCount(world) {
  return (world?.questCards || []).filter((id) => CARD_MAP[id]).length;
}

export function trophyOptions(world) {
  return (world?.questCards || [])
    .map((id) => CARD_MAP[id])
    .filter(Boolean);
}

export function grantQuestCard(world, cardId) {
  if (!world || !CARD_MAP[cardId]) return null;
  if (!Array.isArray(world.questCards)) world.questCards = [];
  if (world.questCards.includes(cardId)) return null;
  world.questCards.push(cardId);
  return CARD_MAP[cardId];
}

export function storyById(id) {
  return typeof id === 'string' ? id : null;
}

export function pickWorldStories(world) {
  const stories = [];
  if (!world.flags.intro) stories.push('intro');
  if (world.flags.intro && !world.flags.introDeep && (world.stats?.runs || 0) >= 1) stories.push('intro-deep');
  if (!world.flags.thirdNight && (world.stats.clears || 0) >= 3) stories.push('third-night');
  if (!world.flags.fifthNight && world.flags.ash && world.flags.tide && world.flags.moon) {
    stories.push('fifth-night');
  }
  if (!world.flags.heartCall && isRegionUnlocked(world, 'heart')) stories.push('heart-call');
  return stories;
}

export function pickDefeatStory(world, info = {}) {
  if (!world) return null;
  const flags = world.flags || {};
  const tier = info.tier || 'normal';
  const region = REGION_MAP[info.regionId];
  const onHeart = Boolean(region?.final);
  if (!flags.defeatFirst) return 'defeat-first';
  if (onHeart && !flags.defeatHeart) return 'defeat-heart';
  if (tier === 'boss' && !flags.defeatBoss) return 'defeat-boss';
  if (tier === 'elite' && !flags.defeatElite) return 'defeat-elite';
  if ((world.stats?.defeats || 0) >= 4 && !flags.defeatMany) return 'defeat-many';
  return null;
}

export function clearedRegionCount(world) {
  return REGIONS.filter((region) => !region.final && regionClearCount(world, region.id) > 0).length;
}

export function missingEndingRegions(world) {
  return REGIONS.filter((region) => !region.final && regionClearCount(world, region.id) <= 0);
}

export function applyStoryEffects(world, story) {
  if (!story) return;
  if (!world.storySeen.includes(story.id)) world.storySeen.push(story.id);
  const effects = story.effects || {};
  if (Number.isFinite(Number(effects.chapter))) {
    world.chapter = Math.max(world.chapter, Number(effects.chapter));
  }
  if (effects.flags && typeof effects.flags === 'object') {
    for (const [key, value] of Object.entries(effects.flags)) {
      if (value) world.flags[key] = true;
    }
  }
}

export function endingMissingParts(ending, world) {
  const missing = [];
  for (const [npcId, required] of Object.entries(ending?.requires || {})) {
    const npc = NPC_MAP[npcId];
    const bond = npcBond(world, npcId);
    if (bond < required) missing.push(`${npc?.name || npcId} 羁绊 ${bond}/${required}`);
  }
  if (ending?.requiresAllRegions) {
    const unvisited = missingEndingRegions(world);
    if (unvisited.length) missing.push(`尚未踏平：${unvisited.map((region) => region.name).join('、')}`);
  }
  if (ending?.requiresEndings) {
    const seen = world.endings.length;
    if (seen < ending.requiresEndings) missing.push(`结局回廊 ${seen}/${ending.requiresEndings}`);
  }
  if (ending?.requiresBossParleys) {
    const parleyed = Array.isArray(world.bossParleys) ? world.bossParleys.length : 0;
    if (parleyed < ending.requiresBossParleys) {
      missing.push(`灵智交涉 ${parleyed}/${ending.requiresBossParleys}（不同岛屿之主）`);
    }
  }
  return missing;
}

export function endingRequirementText(ending, world) {
  return endingMissingParts(ending, world).join(' · ');
}

export function endingAvailable(ending, world) {
  if (!ending) return false;
  return endingMissingParts(ending, world).length === 0;
}

export function endingChoices(world) {
  return ENDINGS.map((ending) => ({
    ending,
    available: endingAvailable(ending, world),
    missing: endingRequirementText(ending, world),
  }));
}

export function resolveWorldEnding(world, endingId) {
  const ending = ENDING_MAP[endingId];
  if (!ending || !endingAvailable(ending, world)) return null;
  if (!world.endings.includes(ending.id)) world.endings.push(ending.id);
  world.lastEnding = ending.id;
  world.chapter = CHAPTERS.length - 1;
  world.flags.endingSeen = true;
  world.pendingFinale = false;
  return ending;
}

export function activeQuestEntries(world) {
  return QUESTS.map((quest) => ({
    quest,
    status: questStatus(world, quest),
    progress: questProgress(world, quest),
  })).filter((entry) => entry.status !== 'locked');
}

export function questGiverName(quest) {
  return NPC_MAP[quest.npc]?.name || '未知';
}

export function regionStatusLabel(world, region) {
  if (!isRegionUnlocked(world, region.id)) return { tone: 'locked', text: '未解锁' };
  const clears = regionClearCount(world, region.id);
  if (clears > 0) return { tone: 'cleared', text: clears > 1 ? `已踏平 ×${clears}` : '已踏平' };
  return { tone: 'open', text: '可探索' };
}
