import { CARD_MAP, ENEMIES, ENEMY_MAP, ITEM_MAP, ORIGIN_MAP, ORIGINS, RELIC_MAP, findAwakening } from './data.js';
import { MUSIC_SLOT_IDS, SFX_SLOT_IDS } from './audio-data.js';
import { MAX_ASCENSION, ascensionLevel, ascensionModifiers } from './ascension.js';
import { dateKey } from './daily.js';
import { mergeMutationMods, sanitizeDreamMutations } from './mutations.js';
import { contractList, mergeContractRules, sanitizeContracts } from './contracts.js';
import { computeResonance, preferredSchoolForOrigin } from './resonance.js';
import { clamp, clone, getRngState, setRngSeed, setRngState } from './utils.js';
import { defaultWorld, sanitizeWorld } from './world-state.js';

const STORAGE_KEY = 'cardrealm.profile.v1';
const RUN_KEY = 'cardrealm.run.v1';
const PROFILE_VERSION = 5;
export const DEFAULT_AVATAR = 'assets/heroes/default.webp';
const LOCAL_RELAY_URL = 'ws://127.0.0.1:8787';
const LOCAL_HOSTS = new Set(['', 'localhost', '127.0.0.1', 'cardrealm.local']);

function defaultOnlineServerUrl() {
  if (typeof location === 'undefined') return LOCAL_RELAY_URL;
  const { protocol, hostname, host } = location;
  if ((protocol !== 'http:' && protocol !== 'https:') || LOCAL_HOSTS.has(hostname)) {
    return LOCAL_RELAY_URL;
  }
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`;
}

function starterDeck(originId = 'blade') {
  return [...(ORIGIN_MAP[originId] || ORIGINS[0]).starter];
}

function sanitizeAudioMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const id = typeof meta.id === 'string' ? meta.id.slice(0, 80) : '';
  if (!id) return null;
  return {
    id,
    name: String(meta.name || '未命名音频').slice(0, 80),
    mime: String(meta.mime || '').slice(0, 80),
    size: Math.max(0, Number(meta.size) || 0),
    duration: Math.max(0, Number(meta.duration) || 0),
  };
}

function sanitizeAudioMap(raw, slotIds) {
  const result = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const slot of slotIds) {
    const meta = sanitizeAudioMeta(raw[slot]);
    if (meta) result[slot] = meta;
  }
  return result;
}

function createDefaultProfile() {
  return {
    version: PROFILE_VERSION,
    name: '无名旅者',
    avatar: null,
    heroAvatars: {},
    originId: 'blade',
    customCards: [],
    enemySkins: {},
    codex: { enemies: [], relics: [] },
    sandboxDeck: starterDeck('blade'),
    world: defaultWorld(),
    audio: {
      sfx: {},
      music: {},
    },
    ai: {
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-image-1',
      lastStyle: 'dark',
    },
    settings: {
      muted: false,
      musicVolume: 0.8,
      sfxVolume: 0.9,
      fontSize: 'normal',
      battleSpeed: 1,
    },
    online: {
      serverUrl: defaultOnlineServerUrl(),
      name: '',
    },
    ascensionUnlocked: 0,
    ascensionBest: 0,
    endlessBest: 0,
    endlessRuns: 0,
    daily: {
      lastDate: '',
      streak: 0,
      bestStreak: 0,
      completions: 0,
      history: [],
    },
    achievements: {
      unlocked: {},
      counters: {},
      totalXp: 0,
    },
    // 梦的碎片：失败也会留下的东西。
    // 它可以解开「更多可能」（卡池里的稀有牌），也可以在梦呓祭坛签下
    // 只属于当前这趟梦的规则契约——不改变下一局的起点。
    shards: 0,
    shardUnlocks: [],
    stats: {
      runs: 0,
      wins: 0,
      enemiesFelled: 0,
    },
  };
}

function sanitizeAchievements(raw) {
  const unlocked = {};
  const counters = {};
  if (raw?.unlocked && typeof raw.unlocked === 'object') {
    for (const [id, at] of Object.entries(raw.unlocked)) {
      if (typeof id !== 'string' || !id || id.length > 60) continue;
      const stamp = Number(at);
      if (Number.isFinite(stamp) && stamp > 0) unlocked[id] = stamp;
    }
  }
  if (raw?.counters && typeof raw.counters === 'object') {
    for (const [key, value] of Object.entries(raw.counters)) {
      if (typeof key !== 'string' || !key || key.length > 40) continue;
      const number = Number(value);
      if (Number.isFinite(number)) counters[key] = Math.max(0, Math.floor(number));
    }
  }
  return {
    unlocked,
    counters,
    totalXp: Math.max(0, Math.floor(Number(raw?.totalXp) || 0)),
  };
}

function sanitizeDaily(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const history = Array.isArray(source.history)
    ? source.history.filter((entry) => typeof entry === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry)).slice(-60)
    : [];
  return {
    lastDate: typeof source.lastDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.lastDate) ? source.lastDate : '',
    streak: Math.max(0, Math.floor(Number(source.streak) || 0)),
    bestStreak: Math.max(0, Math.floor(Number(source.bestStreak) || 0)),
    completions: Math.max(0, Math.floor(Number(source.completions) || 0)),
    history,
  };
}

function sanitizeCodex(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const collect = (list, valid) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.filter((id) => {
      if (typeof id !== 'string' || !valid(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };
  return {
    enemies: collect(source.enemies, (id) => Boolean(ENEMY_MAP[id])),
    relics: collect(source.relics, (id) => Boolean(RELIC_MAP[id])),
  };
}

function sanitizeProfile(raw) {
  const base = createDefaultProfile();
  if (!raw || typeof raw !== 'object') return base;
  const profile = {
    ...base,
    ...raw,
    ai: { ...base.ai, ...(raw.ai || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    online: { ...base.online, ...(raw.online || {}) },
    stats: { ...base.stats, ...(raw.stats || {}) },
  };
  profile.name = String(profile.name || base.name).slice(0, 16);
  profile.shards = Math.max(0, Math.floor(Number(raw.shards) || 0));
  profile.shardUnlocks = Array.isArray(raw.shardUnlocks)
    ? raw.shardUnlocks.filter((id) => typeof id === 'string').slice(0, 12)
    : [];
  if (!ORIGIN_MAP[profile.originId]) {
    profile.originId = 'blade';
  }
  profile.avatar = typeof profile.avatar === 'string' && profile.avatar ? profile.avatar : null;
  profile.heroAvatars = {};
  if (raw.heroAvatars && typeof raw.heroAvatars === 'object') {
    for (const [originId, src] of Object.entries(raw.heroAvatars)) {
      if (ORIGIN_MAP[originId] && typeof src === 'string' && src) {
        profile.heroAvatars[originId] = src;
      }
    }
  }
  if (profile.avatar && !profile.heroAvatars[profile.originId]) {
    profile.heroAvatars[profile.originId] = profile.avatar;
  }
  profile.customCards = Array.isArray(raw.customCards)
    ? raw.customCards.filter((card) => card && typeof card.id === 'string').slice(0, 120)
    : [];
  profile.enemySkins = raw.enemySkins && typeof raw.enemySkins === 'object' ? raw.enemySkins : {};
  for (const enemyId of Object.keys(profile.enemySkins)) {
    if (!ENEMY_MAP[enemyId]) {
      delete profile.enemySkins[enemyId];
      continue;
    }
    const skin = profile.enemySkins[enemyId];
    if (!skin || typeof skin !== 'object' || (!skin.image && !skin.name)) {
      delete profile.enemySkins[enemyId];
    }
  }
  profile.codex = sanitizeCodex(raw.codex);
  if (!Array.isArray(profile.sandboxDeck)) {
    profile.sandboxDeck = starterDeck(profile.originId);
  } else {
    profile.sandboxDeck = profile.sandboxDeck
      .filter((id) => typeof id === 'string' && (CARD_MAP[id] || profile.customCards.some((card) => card.id === id)))
      .slice(0, 40);
  }
  if (profile.ai.provider !== 'openai') {
    profile.ai.provider = 'openai';
  }
  profile.ai.baseUrl = String(profile.ai.baseUrl || base.ai.baseUrl).slice(0, 300);
  profile.ai.apiKey = String(profile.ai.apiKey || '').slice(0, 400);
  profile.ai.model = String(profile.ai.model || base.ai.model).slice(0, 120);
  const storedServer = String(profile.online.serverUrl || '').trim().slice(0, 300);
  profile.online.serverUrl = !storedServer || (storedServer === LOCAL_RELAY_URL && base.online.serverUrl !== LOCAL_RELAY_URL)
    ? base.online.serverUrl
    : storedServer;
  profile.online.name = String(profile.online.name || '').slice(0, 16);
  profile.settings.muted = Boolean(profile.settings.muted);
  profile.settings.musicVolume = Number.isFinite(Number(profile.settings.musicVolume))
    ? clamp(profile.settings.musicVolume, 0, 1)
    : base.settings.musicVolume;
  profile.settings.sfxVolume = Number.isFinite(Number(profile.settings.sfxVolume))
    ? clamp(profile.settings.sfxVolume, 0, 1)
    : base.settings.sfxVolume;
  profile.settings.fontSize = ['small', 'normal', 'large'].includes(profile.settings.fontSize)
    ? profile.settings.fontSize
    : base.settings.fontSize;
  profile.settings.battleSpeed = Number(profile.settings.battleSpeed) >= 2 ? 2 : 1;
  profile.endlessBest = Math.max(0, Math.floor(Number(profile.endlessBest) || 0));
  profile.endlessRuns = Math.max(0, Math.floor(Number(profile.endlessRuns) || 0));
  profile.audio = {
    sfx: sanitizeAudioMap(raw.audio?.sfx, SFX_SLOT_IDS),
    music: sanitizeAudioMap(raw.audio?.music, MUSIC_SLOT_IDS),
  };
  profile.stats.runs = Math.max(0, Number(profile.stats.runs) || 0);
  profile.stats.wins = Math.max(0, Number(profile.stats.wins) || 0);
  profile.stats.enemiesFelled = Math.max(0, Number(profile.stats.enemiesFelled) || 0);
  profile.ascensionUnlocked = Math.round(clamp(Number(profile.ascensionUnlocked) || 0, 0, MAX_ASCENSION));
  profile.ascensionBest = Math.round(clamp(Number(profile.ascensionBest) || 0, 0, profile.ascensionUnlocked));
  profile.daily = sanitizeDaily(raw.daily);
  profile.achievements = sanitizeAchievements(raw.achievements);
  profile.version = PROFILE_VERSION;
  profile.world = sanitizeWorld(raw.world);
  // 旧档只有全局远征次数；把它补进群岛档案，第二段序章才会照常解锁。
  if (!profile.world.stats.runs && profile.stats.runs > 0) {
    profile.world.stats.runs = profile.stats.runs;
  }
  return profile;
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    return sanitizeProfile(JSON.parse(raw));
  } catch (error) {
    console.warn('读取本地档案失败，已使用新档案。', error);
    return createDefaultProfile();
  }
}

export const G = {
  profile: loadProfile(),
  screen: 'menu',
  run: null,
  sandboxBattle: null,
  studioReturn: 'menu',
  ui: {
    modal: null,
    toast: null,
    studioTab: 'hero',
    selectedEnemyId: ENEMIES[0].id,
    originChoice: 'blade',
    ascensionChoice: 0,
    seedInput: '',
    regionChoice: 'corridor',
    worldIsland: 'corridor',
    endingId: null,
    deckFilter: 'all',
    cardDraft: null,
    reward: null,
    battleFx: null,
    battleHint: null,
    confirmAction: null,
    lastScreen: 'menu',
    menuReady: false,
    loadingLabel: '',
    online: {
      mode: 'pvp',
      originId: 'blade',
      enemyId: 'nightmare-dragon',
      joinCode: '',
      error: '',
    },
  },
};

let toastTimer = null;
let saveTimer = null;

export function saveProfileNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(G.profile));
    window.dispatchEvent(new CustomEvent('cardrealm:saved'));
    return true;
  } catch (error) {
    console.warn('保存本地档案失败。', error);
    window.dispatchEvent(new CustomEvent('cardrealm:saveerror', {
      detail: '本地空间不足，图片可能太多。请换用更小的图片。',
    }));
    return false;
  }
}

export function saveProfileDebounced(delay = 260) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProfileNow, delay);
}

export function showToast(message, tone = 'default') {
  clearTimeout(toastTimer);
  G.ui.toast = { message, tone };
  window.dispatchEvent(new CustomEvent('cardrealm:toast'));
  toastTimer = setTimeout(() => {
    G.ui.toast = null;
    window.dispatchEvent(new CustomEvent('cardrealm:toast-expired'));
  }, 2600);
}

export function pushRewardPop(message) {
  if (!message) return;
  if (!Array.isArray(G.ui.rewardPops)) G.ui.rewardPops = [];
  G.ui.rewardPops.push(message);
}

export function getCardDef(id) {
  return CARD_MAP[id] || G.profile.customCards.find((card) => card.id === id) || null;
}

export function getEnemyDef(id) {
  return ENEMY_MAP[id] || ENEMIES[0];
}

export function getEnemySkin(enemyId) {
  const skin = G.profile.enemySkins[enemyId];
  return {
    image: skin?.image || ENEMY_MAP[enemyId]?.image || '',
    name: skin?.name || ENEMY_MAP[enemyId]?.name || '未知存在',
  };
}

export function recordCodexSeen(kind, id) {
  const codex = G.profile?.codex;
  if (!codex || typeof id !== 'string' || !id) return;
  const list = kind === 'enemy' ? codex.enemies : kind === 'relic' ? codex.relics : null;
  if (!list || list.includes(id)) return;
  const known = kind === 'enemy' ? ENEMY_MAP[id] : RELIC_MAP[id];
  if (!known) return;
  list.push(id);
}

export function getHeroAvatar(originId = null) {
  const origin = ORIGIN_MAP[originId || G.profile.originId] || ORIGINS[0];
  return G.profile.heroAvatars?.[origin.id] || origin.portrait || G.profile.avatar || DEFAULT_AVATAR;
}

export function setHeroAvatar(src, originId = null) {
  const origin = ORIGIN_MAP[originId || G.profile.originId] || ORIGINS[0];
  if (!G.profile.heroAvatars || typeof G.profile.heroAvatars !== 'object') G.profile.heroAvatars = {};
  if (src) {
    G.profile.heroAvatars[origin.id] = src;
    G.profile.avatar = src;
  } else {
    delete G.profile.heroAvatars[origin.id];
    if (G.profile.avatar && !Object.values(G.profile.heroAvatars).includes(G.profile.avatar)) {
      G.profile.avatar = null;
    }
  }
  return saveProfileNow();
}

export function getHeroName() {
  return G.profile.name?.trim() || '无名旅者';
}

export function saveProfile() {
  return saveProfileNow();
}

export function updateProfile(mutator) {
  mutator(G.profile);
  return saveProfileNow();
}

export function customCards() {
  return G.profile.customCards;
}

export function saveCustomCard(card) {
  const existingIndex = G.profile.customCards.findIndex((item) => item.id === card.id);
  if (existingIndex >= 0) {
    G.profile.customCards[existingIndex] = clone(card);
  } else {
    G.profile.customCards.unshift(clone(card));
  }
  saveProfileNow();
}

export function removeCustomCard(cardId) {
  G.profile.customCards = G.profile.customCards.filter((card) => card.id !== cardId);
  G.profile.sandboxDeck = G.profile.sandboxDeck.filter((id) => id !== cardId);
  saveProfileNow();
}

export function addCardToSandbox(cardId, silent = false) {
  if (G.profile.sandboxDeck.length >= 30) {
    if (!silent) showToast('试炼牌组最多 30 张。', 'warning');
    return false;
  }
  G.profile.sandboxDeck.push(cardId);
  saveProfileDebounced(120);
  return true;
}

export function removeCardFromSandbox(cardId) {
  const index = G.profile.sandboxDeck.lastIndexOf(cardId);
  if (index >= 0) {
    G.profile.sandboxDeck.splice(index, 1);
    saveProfileDebounced(120);
    return true;
  }
  return false;
}

export function resetSandboxDeck() {
  G.profile.sandboxDeck = starterDeck(G.profile.originId);
  saveProfileNow();
}

export function setScreen(screen) {
  G.ui.lastScreen = G.screen;
  G.screen = screen;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function saveRunNow() {
  try {
    if (!G.run || G.run.status !== 'active') {
      localStorage.removeItem(RUN_KEY);
      return;
    }
    if (!G.run.seed) G.run.seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    G.run.rngState = getRngState();
    const screen = G.screen === 'battle' && G.run.battle ? 'battle' : 'map';
    localStorage.setItem(RUN_KEY, JSON.stringify({ version: 1, screen, run: G.run }));
  } catch (error) {
    console.warn('保存旅程失败。', error);
  }
}

export function restoreRunSave() {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const run = saved?.run;
    const discard = () => {
      localStorage.removeItem(RUN_KEY);
      return null;
    };
    if (!run || run.mode !== 'adventure' || run.status !== 'active') return discard();
    if (!Array.isArray(run.deck) || !Array.isArray(run.map) || !run.map.length) return discard();
    if (!run.originId || !ORIGIN_MAP[run.originId]) return discard();
    run.deck = run.deck.filter((entry) => Boolean(getCardDef(typeof entry === 'string' ? entry : entry?.defId)));
    if (!run.deck.length) return discard();
    if (!Array.isArray(run.items)) run.items = [];
    run.items = run.items.filter((id) => Boolean(ITEM_MAP[id])).slice(0, 10);
    run.parleySuccesses = Math.max(0, Number(run.parleySuccesses) || 0);
    if (!Array.isArray(run.parleyBosses)) run.parleyBosses = [];
    run.originAwakening = Array.isArray(run.originAwakening)
      ? run.originAwakening.filter((id) => Boolean(findAwakening(id)))
      : [];
    run.originAwakeningTier = Math.max(0, Number(run.originAwakeningTier) || 0);
    if (!run.attributes || typeof run.attributes !== 'object') {
      run.attributes = { ...(ORIGIN_MAP[run.originId]?.attributes || {}) };
    }
    if (!Array.isArray(run.interludeSeen)) run.interludeSeen = [];
    if (!Array.isArray(run.interludeFloors)) run.interludeFloors = [];
    if (!run.storyFlags || typeof run.storyFlags !== 'object') run.storyFlags = {};
    run.ascension = Math.round(clamp(Number(run.ascension) || 0, 0, MAX_ASCENSION));
    run.ascensionModifiers = ascensionModifiers(run.ascension);
    run.seed = String(run.seed || run.id || 'restored').slice(0, 80);
    run.dreamMutations = sanitizeDreamMutations(run.dreamMutations);
    run.mutationMods = mergeMutationMods(run.dreamMutations);
    run.contracts = sanitizeContracts(run.contracts);
    run.contractMods = mergeContractRules(run.contracts);
    // 梦痕是跟着远征走的上限削减，旧存档没有这一项时补空数组，
    // 同时把生命夹回上限，避免旧档里被削过的角色读出一个负数或超上限的血条。
    run.scars = Array.isArray(run.scars)
      ? run.scars
        .filter((scar) => scar && typeof scar === 'object')
        .slice(-12)
        .map((scar, index) => ({
          id: String(scar.id || `scar_${index}`).slice(0, 80),
          name: String(scar.name || '借气').slice(0, 20),
          label: String(scar.label || `梦痕 · 生命上限 -${Math.max(0, Number(scar.hpCost) || 0)}`).slice(0, 60),
          hpCost: Math.max(0, Number(scar.hpCost) || 0),
          enemyName: String(scar.enemyName || '梦魇').slice(0, 40),
          enemyId: typeof scar.enemyId === 'string' ? scar.enemyId.slice(0, 60) : null,
          tier: ['normal', 'elite', 'boss', 'merchant'].includes(scar.tier) ? scar.tier : 'normal',
          regionId: typeof scar.regionId === 'string' ? scar.regionId.slice(0, 60) : null,
          regionName: String(scar.regionName || '梦境的裂隙').slice(0, 40),
          turn: Math.max(1, Number(scar.turn) || 1),
          at: Math.max(0, Number(scar.at) || 0),
        }))
      : [];
    const savedMaxHp = Number(run.maxHp);
    run.maxHp = Math.max(
      1,
      Math.round(Number.isFinite(savedMaxHp) ? savedMaxHp : (ORIGIN_MAP[run.originId]?.hp || 1)),
    );
    const savedHp = Number(run.hp);
    run.hp = Number.isFinite(savedHp) ? clamp(savedHp, 0, run.maxHp) : run.maxHp;
    if (run.battle && (!run.battle.player || !run.battle.enemy || !Array.isArray(run.battle.hand))) {
      run.battle = null;
      run.pendingNodeId = null;
    }
    if (run.battle) {
      for (const key of ['hand', 'drawPile', 'discardPile', 'exhaustPile']) {
        if (Array.isArray(run.battle[key])) {
          run.battle[key] = run.battle[key].filter((entry) => entry && getCardDef(entry.defId));
        }
      }
      run.battle.sealedUids = (Array.isArray(run.battle.sealedUids) ? run.battle.sealedUids : [])
        .filter((uid) => run.battle.hand.some((entry) => entry.uid === uid));
      if (!run.battle.sealedUids.length && run.battle.sealedUid
        && run.battle.hand.some((entry) => entry.uid === run.battle.sealedUid)) {
        run.battle.sealedUids = [run.battle.sealedUid];
      }
      run.battle.sealedUid = run.battle.sealedUids[0] || null;
    }
    if (run.battle) {
      run.battle.ascension = run.ascension;
      if (run.battle.enemy) {
        // 恢复存档时把岛屿、无尽、梦层、变奏与飞升的攻击加值全部重算一遍；
        // 旧代码只写了飞升，读档后敌人的 +2 攻击会凭空消失。
        run.battle.enemy.damageBonus =
          (Number(run.modifiers?.enemyBonusDamage) || 0)
          + (Number(run.endlessModifiers?.enemyBonusDamage) || 0)
          + (Number(run.ngPlusMods?.enemyBonusDamage) || 0)
          + (Number(run.mutationMods?.enemyBonusDamage) || 0)
          + (Number(run.contractMods?.enemyBonusDamage) || 0)
          + (Number(run.ascensionModifiers.enemyBonusDamage) || 0);
      }
      // 契约规则以 run 为准重算，保证读档后 UI 与结算不会对不上。
      if (run.battle.rules) {
        let baseHealScale = 1;
        for (const source of [run.modifiers, run.endlessModifiers, run.ngPlusMods]) {
          if (source && source.healScale !== undefined) {
            baseHealScale = Math.max(0, Number(source.healScale) || 1);
          }
        }
        run.battle.rules.healScale = baseHealScale
          * Math.max(0, Number(run.mutationMods?.healScale) || 1)
          * Math.max(0, Number(run.contractMods?.healScale) || 1);
        run.battle.rules.noHeal = Boolean(run.battle.rules.noHeal || run.contractMods?.noHeal);
        // 行囊可能被契约或梦层封住，读档后要能还原到底是谁封的。
        const noItemsSource = run.contractMods?.noItems ? 'contract' : run.ascensionModifiers?.noItems ? 'ascension' : null;
        run.battle.rules.noItems = Boolean(noItemsSource);
        run.battle.rules.noItemsSource = noItemsSource;
      }
      run.battle.contracts = contractList(run.contracts);
      run.battle.resonance = computeResonance(run.deck, preferredSchoolForOrigin(run.originId), getCardDef);
      run.battle.resonanceState = run.battle.resonanceState || {
        bladeUsed: false,
        bladeBoost: 0,
        starUsed: false,
        drawBoostUsed: false,
        chorusUsed: false,
      };
      run.battle.mulliganUsed = Boolean(run.battle.mulliganUsed);
      const savedStand = run.battle.lastStand && typeof run.battle.lastStand === 'object'
        ? run.battle.lastStand
        : {};
      run.battle.lastStand = {
        offered: Boolean(savedStand.offered),
        resolved: Boolean(savedStand.resolved || savedStand.accepted),
        accepted: Boolean(savedStand.accepted),
        costPending: Boolean(savedStand.costPending && savedStand.accepted && !savedStand.costPaid),
        costPaid: Boolean(savedStand.costPaid),
        costWaived: Boolean(savedStand.costWaived),
        turn: Math.max(0, Number(savedStand.turn) || 0),
        hpAtOffer: Math.max(0, Number(savedStand.hpAtOffer) || 0),
        companionId: typeof savedStand.companionId === 'string' ? savedStand.companionId.slice(0, 40) : null,
        companionName: typeof savedStand.companionName === 'string' ? savedStand.companionName.slice(0, 40) : null,
        companionGlyph: typeof savedStand.companionGlyph === 'string' ? savedStand.companionGlyph.slice(0, 4) : null,
        companionColor: typeof savedStand.companionColor === 'string' ? savedStand.companionColor.slice(0, 20) : null,
        line: typeof savedStand.line === 'string' ? savedStand.line.slice(0, 160) : '',
        soundPlayed: Boolean(savedStand.soundPlayed),
        scar: savedStand.scar && typeof savedStand.scar === 'object' ? savedStand.scar : null,
        hpCost: Math.max(0, Number(savedStand.hpCost) || 0),
      };
      // 战斗里的血条上限必须与远征上限一致，否则读档后梦痕会看起来没生效。
      if (run.battle.player) {
        run.battle.player.maxHp = run.maxHp;
        run.battle.player.hp = Math.min(run.battle.player.hp, run.maxHp);
      }
      if (!run.battle.resonanceApplied) {
        if (run.battle.resonance.primary === 'thorn' && run.battle.player.statuses) {
          run.battle.player.statuses.thorns = (Number(run.battle.player.statuses.thorns) || 0) + run.battle.resonance.value;
        }
        run.battle.resonanceApplied = true;
      }
      const enemyDef = ENEMY_MAP[run.battle.enemy?.defId];
      if (enemyDef?.phase2) {
        if (!run.battle.enemy.phase2) {
          run.battle.enemy.phase2 = JSON.parse(JSON.stringify(enemyDef.phase2));
        }
        // 逆鳞的阈值必须从数据重算，不能在已保存的阈值上再减一次。
        const early = Number(run.mutationMods?.phase2Early) || 0;
        if (early > 0) {
          const baseAt = Number(enemyDef.phase2.at) || 0.5;
          run.battle.enemy.phase2.at = Math.max(0.2, baseAt - early);
        }
        run.battle.enemy.phase = Math.max(1, Number(run.battle.enemy.phase) || 1);
        if (run.battle.enemy.phase >= 2 && !run.battle.enemy.phaseTitle) {
          run.battle.enemy.phaseTitle = enemyDef.phase2.title || '二阶段';
        }
        if (!run.battle.enemy.phaseTitle) run.battle.enemy.phaseTitle = null;
      } else {
        run.battle.enemy.phase = 1;
        run.battle.enemy.phaseTitle = null;
        run.battle.enemy.phase2 = null;
      }
      // 梦魇谱系 / 暴走 / 借走的牌都要跟着存档一起活过来。
      run.battle.enemy.lineage = enemyDef?.lineage || null;
      const lineageState = run.battle.enemy.lineageState;
      run.battle.enemy.lineageState = {
        counter: Math.max(0, Number(lineageState?.counter) || 0),
        pendingSeal: Boolean(lineageState?.pendingSeal),
        echo: Math.max(0, Number(lineageState?.echo) || 0),
      };
      run.battle.enemy.stolen = Array.isArray(run.battle.enemy.stolen)
        ? run.battle.enemy.stolen
          .filter((entry) => entry?.uid && getCardDef(entry.defId))
          .slice(0, 10)
          .map((entry) => ({
            uid: String(entry.uid),
            defId: entry.defId,
            upgraded: Boolean(entry.upgraded),
            returnTurn: Math.max(0, Number(entry.returnTurn) || 0),
          }))
        : [];
      run.battle.enemy.surge = enemyDef?.surge ? JSON.parse(JSON.stringify(enemyDef.surge)) : null;
      run.battle.enemy.surged = Boolean(run.battle.enemy.surged);
      run.battle.enemy.surgeTitle = run.battle.enemy.surged
        ? (run.battle.enemy.surgeTitle || enemyDef?.surge?.title || null)
        : null;
      const mechanic = enemyDef?.mechanic;
      if (mechanic) {
        if (!run.battle.enemy.mechanic || run.battle.enemy.mechanic.id !== mechanic.id) {
          run.battle.enemy.mechanic = { id: mechanic.id, value: Number(mechanic.max) || 0 };
        } else {
          run.battle.enemy.mechanic.value = Number(run.battle.enemy.mechanic.value) || 0;
        }
      } else {
        run.battle.enemy.mechanic = null;
      }
      run.battle.sealedUid = run.battle.sealedUid || null;
      run.battle.parley = run.battle.parley || null;
      run.battle.parleySkip = Boolean(run.battle.parleySkip);
      run.battle.parleyFx = run.battle.parleyFx || [];
      if (run.battle.tier === 'merchant') run.battle.noRetreat = true;
      const originDef = ORIGIN_MAP[run.originId];
      if (originDef?.mechanic) {
        const mods = {};
        for (const id of run.originAwakening) {
          const awakening = findAwakening(id);
          if (!awakening?.mods) continue;
          for (const [key, value] of Object.entries(awakening.mods)) {
            mods[key] = (mods[key] || 0) + (Number(value) || 0);
          }
        }
        const previous = run.battle.origin;
        run.battle.origin = {
          id: originDef.mechanic.id,
          name: originDef.mechanic.name,
          glyph: originDef.mechanic.glyph,
          short: originDef.mechanic.short,
          desc: originDef.mechanic.desc,
          value: Math.max(0, Number(previous?.value) || 0),
          max: Math.max(2, (Number(originDef.mechanic.max) || 3) + (Number(mods.thresholdDelta) || 0)),
          mods,
          triggered: Math.max(0, Number(previous?.triggered) || 0),
        };
        if (!run.battle.player.avatar) run.battle.player.avatar = getHeroAvatar(run.originId);
      } else {
        run.battle.origin = null;
      }
    }
    G.run = run;
    G.sandboxBattle = null;
    G.screen = saved.screen === 'battle' && run.battle ? 'battle' : 'map';
    if (Number.isFinite(Number(run.rngState))) setRngState(Number(run.rngState));
    else setRngSeed(run.seed);
    return run;
  } catch (error) {
    console.warn('读取旅程存档失败。', error);
    try {
      localStorage.removeItem(RUN_KEY);
    } catch (innerError) {
      console.warn('清除损坏的旅程存档失败。', innerError);
    }
    return null;
  }
}

export function recordDailyWin(date = dateKey()) {
  const daily = G.profile.daily;
  if (daily.lastDate === date) {
    return { already: true, streak: daily.streak, completions: daily.completions };
  }
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  daily.streak = daily.lastDate === yesterday ? daily.streak + 1 : 1;
  daily.bestStreak = Math.max(daily.bestStreak, daily.streak);
  daily.lastDate = date;
  daily.completions += 1;
  if (!daily.history.includes(date)) daily.history.push(date);
  daily.history = daily.history.slice(-60);
  saveProfileNow();
  return { already: false, streak: daily.streak, completions: daily.completions };
}

export function buildSaveBackup() {
  const profile = JSON.parse(JSON.stringify(G.profile));
  profile.ai.apiKey = '';
  profile.audio = { sfx: {}, music: {} };
  let run = null;
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (raw) run = JSON.parse(raw);
  } catch (error) {
    console.warn('读取旅程存档失败，导出时不包含当前旅程。', error);
  }
  return {
    app: 'cardrealm',
    kind: 'profile-backup',
    version: PROFILE_VERSION,
    exportedAt: new Date().toISOString(),
    note: '不包含 API Key 与自定义音频文件；导入时这两项会保留本机现有的内容。',
    profile,
    run,
  };
}

export function importSaveBackup(raw) {
  let payload = raw;
  if (typeof raw === 'string') payload = JSON.parse(raw);
  if (!payload || payload.app !== 'cardrealm' || payload.kind !== 'profile-backup' || !payload.profile) {
    return { ok: false, message: '这不是牌境的存档文件。' };
  }
  const incoming = sanitizeProfile(payload.profile);
  incoming.audio = {
    sfx: G.profile.audio?.sfx || {},
    music: G.profile.audio?.music || {},
  };
  incoming.ai.apiKey = G.profile.ai.apiKey || '';
  G.profile = incoming;
  G.sandboxBattle = null;
  saveProfileNow();
  try {
    if (payload.run?.run) localStorage.setItem(RUN_KEY, JSON.stringify(payload.run));
    else localStorage.removeItem(RUN_KEY);
  } catch (error) {
    console.warn('写入导入的旅程存档失败。', error);
  }
  return {
    ok: true,
    profile: incoming,
    hasRun: Boolean(payload.run?.run),
    exportedAt: payload.exportedAt || '',
  };
}

export function clearRunSave() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch (error) {
    console.warn('清除旅程存档失败。', error);
  }
}
