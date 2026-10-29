import { CARD_MAP, ENEMIES, ENEMY_MAP, ORIGIN_MAP, RELIC_MAP, SCHOOLS, STATUS_INFO } from './data.js';
import { audio } from './audio.js';
import { MUSIC_SLOT_IDS, MUSIC_SLOT_MAP, SFX_SLOT_IDS, SFX_SLOT_MAP } from './audio-data.js';
import { MAX_ASCENSION, ascensionLevel } from './ascension.js';
import { contractList } from './contracts.js';
import {
  audioFileError,
  clearAudioFiles,
  deleteAudioFile,
  durationError,
  ensureStorageRoom,
  loadAudioFile,
  readAudioDuration,
  saveAudioFile,
} from './audio-store.js';
import {
  abandonRun,
  awakeningOffer,
  beginNode,
  buyShopCard,
  buyShopPurge,
  buyShopHeal,
  buyShopItem,
  buyShopRelic,
  breakDreamContract,
  claimBattleReward,
  claimTreasure,
  chooseAwakening,
  completeNode,
  contractOffersForRun,
  createShop,
  createTreasure,
  endTurn,
  finishAdventure,
  finishRunAndLeave,
  leaveBattleEarly,
  sailHomeEarly,
  leaveEndingToWorld,
  parleyProfile,
  pickEventForRegion,
  playCard,
  resolveParley,
  restHeal,
  retrySandboxBattle,
  resolveFinalEnding,
  startAdventure,
  startAdventureBattle,
  startDailyBattle,
  startMerchantBattle,
  startEndless,
  startSandboxBattle,
  mulliganOpeningHand,
  stealFromMerchant,
  upgradeDeckCard,
  forgetDeckCard,
  useItem,
  resolveEventChoice,
  resolveLastStand,
  restartBattle,
  signDreamContract,
} from './engine.js';
import {
  composePortraitPrompt,
  generateCardArtWithConfig,
  generatePortraitWithConfig,
} from './images.js';
import {
  deleteCardArt,
  loadCardArt,
  peekCardArt,
  saveCardArt,
} from './card-art-store.js';
import {
  composePortrait,
  computeContentBounds,
  decodePortraitSource,
  drawEditorPreview,
  estimateBackground,
  rgbToHex,
  sampleBackground,
} from './image-editor.js';
import {
  addCardToSandbox,
  buildSaveBackup,
  G,
  getCardDef,
  importSaveBackup,
  removeCardFromSandbox,
  removeCustomCard,
  resetSandboxDeck,
  restoreRunSave,
  saveCustomCard,
  saveProfileDebounced,
  saveProfileNow,
  saveRunNow,
  setHeroAvatar,
  setScreen,
  showToast,
} from './state.js';
import { renderEnding, renderMenu, renderOrigins } from './screen-menu.js';
import { renderMap } from './screen-map.js';
import { renderBattle } from './screen-battle.js';
import { initLiveArt } from './live-art.js';
import { renderDeckbuilder, renderSandbox } from './screen-sandbox.js';
import { renderStudio } from './screen-studio.js';
import { renderWorld } from './screen-world.js';
import { renderOnline } from './screen-online.js';
import { markPhaseArtRevealed } from './phase-art.js';
import { bossPhasePools } from './boss-gauge.js';
import {
  getOnline,
  onlineCancelConnect,
  onlineCreate,
  onlineEndTurn,
  onlineJoin,
  onlineLeave,
  onlinePlay,
  onlineRematch,
  onlineStart,
} from './online-client.js';
import { DIALOGUES, NPC_MAP, QUEST_MAP, REGION_MAP, STORIES, dialogueNext, storyLines } from './lore.js';
import {
  applyDialogueEffect,
  applyStoryEffects,
  isRegionUnlocked,
  markDialogueNode,
  markNpcTalk,
  npcTalkLine,
  pendingDialogue,
  pickWorldStories,
  refreshWorld,
  trophyOptions,
} from './world-state.js';
import {
  cardDraftFromDef,
  defaultGenerationSubject,
  effectHasPayload,
  makeEffect,
  newCardDraft,
  pileResultsMarkup,
  previewDraft,
  renderModal,
  SHARD_UNLOCKS,
} from './modals.js';
import { cardMarkup } from './ui-common.js';
import { clamp, esc, icon, qs, resolveCard, safeColor, uid } from './utils.js';

const appRoot = qs('#app');
const modalRoot = qs('#modal-root');
const toastRoot = qs('#toast-root');
const fileInput = qs('#portrait-file');
const audioInput = qs('#audio-file');
const saveInput = qs('#save-file');
let modalSeq = 0;
let pendingUpload = null;
let pendingAudioUpload = null;
let modalQueue = [];

const TOAST_ICONS = { success: 'check', warning: 'help', danger: 'skull', default: 'sparkles' };
const STATUS_SFX = {
  poison: 'poison',
  burn: 'burn',
  thorns: 'thorns',
  weak: 'debuff',
  vulnerable: 'debuff',
  strength: 'buff',
  dexterity: 'buff',
};

function currentBattle() {
  return G.sandboxBattle || G.run?.battle || null;
}

const presentedRelicBattles = new Set();
const presentedPhaseBattles = new Set();
const presentedSurgeBattles = new Set();
const presentedRelicGains = new Set();
const presentedParleyBattles = new Set();
let phaseCinemaUntil = 0;

function battlePresentationKey(battle) {
  return `${battle.mode || 'battle'}:${battle.startedAt || 0}:${battle.enemy?.defId || 'none'}`;
}

function relicRiteMarkup(relic, index = 0) {
  const glyph = relic.glyph || '器';
  return `<span class="rite-item" data-fx="${esc(relic.fx || 'relic')}" style="--relic:${safeColor(relic.color)};--i:${index}">
    <span class="rite-item__halo" aria-hidden="true"></span>
    <span class="rite-item__ring" aria-hidden="true"></span>
    <span class="rite-item__sparks" aria-hidden="true">${Array.from({ length: 5 }, (_, spark) => `<i style="--s:${spark}"></i>`).join('')}</span>
    <span class="rite-item__glyph">${esc(glyph)}</span>
    <span class="rite-item__copy">
      <strong>${esc(relic.name)}</strong>
      <small>${esc(relic.rite || relic.desc)}</small>
    </span>
  </span>`;
}

function presentRelicAwakening(battle) {
  const screen = qs('.battle-screen');
  if (!screen || !battle?.relics?.length) return;
  const relics = battle.relics.map((id) => RELIC_MAP[id]).filter(Boolean);
  if (!relics.length) return;
  const banner = document.createElement('div');
  banner.className = 'relic-awakening';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `<div class="relic-awakening__head">
      <span>RELIC AWAKENING</span>
      <strong>${relics.length} 件遗物已装备</strong>
      <small>它们在开战的一刻苏醒，各自回应你的梦</small>
    </div>
    <div class="relic-awakening__grid">${relics.map((relic, index) => relicRiteMarkup(relic, index)).join('')}</div>`;
  screen.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('is-lit'));
  const chips = [...screen.querySelectorAll('.header-relics [data-relic-id]')];
  chips.forEach((chip, index) => {
    chip.style.setProperty('--awake-delay', `${index * 90}ms`);
    chip.classList.add('is-awake');
  });
  audio.relic();
  const life = 2600 + relics.length * 180;
  setTimeout(() => banner.classList.add('is-leaving'), life);
  setTimeout(() => banner.remove(), life + 700);
}

function presentRelicGain(relic) {
  if (!relic) return;
  const node = document.createElement('div');
  node.className = 'relic-gain-layer';
  node.innerHTML = `<div class="relic-gain" data-fx="${esc(relic.fx || 'relic')}" style="--relic:${safeColor(relic.color)}">
    <span class="relic-gain__sigil">${esc(relic.glyph || '器')}</span>
    <span class="relic-gain__copy">
      <small>RELIC EQUIPPED · 已自动装备</small>
      <strong>${esc(relic.name)}</strong>
      <p>${esc(relic.desc)}</p>
      ${relic.rite ? `<em>${esc(relic.rite)}</em>` : ''}
    </span>
  </div>`;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-lit'));
  audio.relic();
  setTimeout(() => node.classList.add('is-out'), 2900);
  setTimeout(() => node.remove(), 3550);
}

export function presentBossPhase(battle, detail = {}) {
  if (!battle?.enemy?.phase2) return;
  const key = `${battlePresentationKey(battle)}:phase2`;
  if (presentedPhaseBattles.has(key)) return;
  let screen = qs('.battle-screen') || qs('.online-screen');
  if (!screen) return;
  presentedPhaseBattles.add(key);
  const phase2 = battle.enemy.phase2;
  const title = detail.title || battle.enemy.phaseTitle || phase2.title || '梦魇真形';
  const line = detail.line || phase2.line || '梦魇撕开了自己的旧皮。';
  const accent = safeColor(battle.enemy.accent || '#c86b58');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (phase2.image) {
    const preload = new Image();
    preload.decoding = 'async';
    preload.src = phase2.image;
  }
  let hpFill = null;
  let hpNumber = null;
  let hpFinal = 0;
  let hpWidth = '50%';
  let hpFrame = 0;
  let collapseAnimation = null;

  const countTo = (node, from, to, duration) => {
    const started = performance.now();
    const step = (now) => {
      if (!node?.isConnected) return;
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 2.4);
      node.textContent = String(Math.round(from + (to - from) * eased));
      if (progress < 1) hpFrame = requestAnimationFrame(step);
    };
    hpFrame = requestAnimationFrame(step);
  };

  const armFalseDeath = (scope) => {
    const speed = battleSpeed();
    const gauge = scope.querySelector('[data-boss-gauge]');
    hpFill = gauge
      ? gauge.querySelector('.boss-gauge__stage--one .boss-gauge__fill')
      : scope.querySelector('.actor-plate--enemy .progress__fill')
        || scope.querySelector('.online-hp .progress__fill');
    hpNumber = gauge
      ? gauge.querySelector('.boss-gauge__stage--one [data-boss-hp]')
      : scope.querySelector('.actor-plate--enemy .actor-hp-label strong')
        || scope.querySelector('.online-duel__hp strong');
    hpFinal = gauge ? 0 : Math.max(0, Math.round(Number(battle.enemy.hp) || 0));
    hpWidth = hpFill?.style.width || '100%';
    if (parseFloat(hpWidth) <= 0.5) hpWidth = '100%';
    if (hpFill?.animate) {
      collapseAnimation = hpFill.animate([
        { width: hpWidth, offset: 0 },
        { width: '0%', offset: 0.62 },
        { width: '0%', offset: 1 },
      ], { duration: Math.round(1050 / speed), easing: 'cubic-bezier(.3,.7,.2,1)' });
    }
    if (!hpNumber) return;
    const from = Math.max(0, Math.round(Number(hpNumber.textContent) || 0));
    countTo(hpNumber, from, hpFinal, Math.round(650 / speed));
  };

  const relightHp = () => {
    cancelAnimationFrame(hpFrame);
    screen = qs('.battle-screen') || qs('.online-screen') || screen;
    const gauge = screen.querySelector('[data-boss-gauge]');
    if (gauge) {
      gauge.classList.add('is-open', 'is-igniting');
      setTimeout(() => gauge.classList.remove('is-igniting'), Math.round(1700 / battleSpeed()));
      const stageOne = gauge.querySelector('.boss-gauge__stage--one');
      stageOne?.classList.add('is-broken');
      const stageOneValue = stageOne?.querySelector('[data-boss-hp]');
      if (stageOneValue) stageOneValue.textContent = '0';
      stageOne?.querySelector('.boss-gauge__track')?.setAttribute('aria-valuenow', '0');
      const stageTwo = gauge.querySelector('.boss-gauge__stage--two');
      const fill = stageTwo?.querySelector('.boss-gauge__fill');
      const number = stageTwo?.querySelector('[data-boss-hp]');
      const pools = bossPhasePools(battle.enemy);
      const max = pools?.phase2.max ?? Math.max(1, Math.round(Number(battle.enemy.maxHp) || 1));
      const final = Math.max(0, Math.min(max, Math.round(Number(pools?.phase2.hp ?? battle.enemy.hp) || 0)));
      const pct = max > 0 ? (final / max) * 100 : 0;
      if (number?.isConnected) {
        number.textContent = '0';
        countTo(number, 0, final, Math.round(760 / battleSpeed()));
      }
      const track = stageTwo?.querySelector('.boss-gauge__track');
      track?.setAttribute('aria-valuenow', String(final));
      if (!fill?.isConnected) return;
      fill.style.width = '0%';
      if (fill.animate) {
        fill.animate([
          { width: '0%' },
          { width: `${pct}%` },
        ], {
          duration: Math.round(720 / battleSpeed()),
          delay: Math.round(120 / battleSpeed()),
          easing: 'cubic-bezier(.16,.82,.24,1)',
          fill: 'forwards',
        });
      } else {
        fill.style.width = `${pct}%`;
      }
      return;
    }
    if (hpNumber?.isConnected) hpNumber.textContent = String(hpFinal);
    if (!hpFill?.isConnected) return;
    collapseAnimation?.cancel();
    if (hpFill.animate) {
      hpFill.animate([
        { width: '0%' },
        { width: hpWidth },
      ], { duration: Math.round(560 / battleSpeed()), easing: 'cubic-bezier(.16,.82,.24,1)' });
    } else {
      hpFill.style.width = hpWidth;
    }
  };

  const applyPhaseArt = () => {
    screen = qs('.battle-screen') || qs('.online-screen') || screen;
    markPhaseArtRevealed(battle);
    if (!screen.isConnected) return;
    screen.querySelector('.stage-actor--enemy')?.classList.add('is-phase-two', 'is-phase-two-awake');
    screen.querySelector('.online-nightmare')?.classList.add('is-phase-two', 'is-phase-two-awake');
    screen.classList.add('is-phase-two');
    relightHp();
    if (!phase2.image) return;
    screen.querySelectorAll('.actor-portal--enemy .live-art__base, .actor-portal--enemy .live-art__bloom').forEach((img) => {
      if (img.getAttribute('src') !== phase2.image) img.src = phase2.image;
    });
    const presence = screen.querySelector('.boss-presence img');
    if (presence && presence.getAttribute('src') !== phase2.image) presence.src = phase2.image;
    const onlineImage = screen.querySelector('.online-nightmare__image');
    if (onlineImage && onlineImage.getAttribute('src') !== phase2.image) {
      onlineImage.src = phase2.image;
      onlineImage.dataset.fallback = phase2.image;
    }
  };

  const playPhaseFlip = () => {
    const speed = battleSpeed();
    const ms = (value) => Math.round(value / speed);
    const frame = screen.querySelector('.actor-portal--enemy .actor-portal__frame');
    const onlineArt = screen.querySelector('.online-nightmare__art');
    const card = frame || onlineArt;
    if (!card?.animate) {
      applyPhaseArt();
      return;
    }
    const actor = screen.querySelector('.stage-actor--enemy');
    actor?.classList.add('is-phase-flipping');
    card.animate([
      { transform: 'perspective(1000px) rotateY(0deg) scale(1)', filter: 'brightness(1)', offset: 0 },
      { transform: 'perspective(1000px) rotateY(-82deg) scale(.99)', filter: 'brightness(2.2)', offset: 0.42 },
      { transform: 'perspective(1000px) rotateY(7deg) scale(1.025)', filter: 'brightness(1.18)', offset: 0.68 },
      { transform: 'perspective(1000px) rotateY(0deg) scale(1)', filter: 'brightness(1)', offset: 1 },
    ], { duration: ms(900), easing: 'cubic-bezier(.22,.75,.2,1)' });
    const flash = document.createElement('span');
    flash.className = 'phase-flip-flash';
    flash.setAttribute('aria-hidden', 'true');
    (frame?.closest('.actor-portal') || onlineArt).appendChild(flash);
    setTimeout(() => flash.remove(), ms(900));
    setTimeout(() => actor?.classList.remove('is-phase-flipping'), ms(1050));
    setTimeout(applyPhaseArt, ms(360));
  };

  const reveal = () => {
    const speed = battleSpeed();
    const ms = (value) => Math.round(value / speed);
    screen = qs('.battle-screen') || qs('.online-screen') || screen;
    screen.classList.remove('is-boss-rupture');
    if (!screen.isConnected) return;
    phaseCinemaUntil = performance.now() + ms(2600);
    if (reduced) applyPhaseArt();
    else playPhaseFlip();
    const ignite = () => {
      const layer = getFxLayer();
      const target = qs('[data-float-target="enemy"]');
      if (layer && target) {
        const point = fxPoint(target, layer);
        if (point) {
          appendFx(layer, 'fx-boss-phase', point,
            `<span class="fx-boss-phase__ring"></span><span class="fx-boss-phase__ring fx-boss-phase__ring--two"></span><span class="fx-boss-phase__sigil">${esc(battle.enemy.glyph || '魇')}</span>`,
            ms(1700), { '--fx-color': accent, '--fx-size': `${Math.max(260, point.w * 2.2)}px` });
          sparkBurst(layer, point, accent, 22, 230);
        }
      }
      const banner = document.createElement('div');
      banner.className = 'boss-phase';
      banner.setAttribute('role', 'status');
      banner.style.setProperty('--phase', accent);
      banner.innerHTML = `<span class="boss-phase__flash" aria-hidden="true"></span>
        <span class="boss-phase__thread" aria-hidden="true"></span>
        <span class="boss-phase__sigil" aria-hidden="true">${esc(battle.enemy.glyph || '魇')}</span>
        <div class="boss-phase__copy">
          <span class="boss-phase__eyebrow">${icon('flame', 13)} PHASE II · 真形苏醒</span>
          <strong class="boss-phase__title">${esc(title)}</strong>
          <p>${esc(line)}</p>
        </div>`;
      screen.appendChild(banner);
      requestAnimationFrame(() => banner.classList.add('is-lit'));
      screen.classList.add('is-boss-awakening');
      shakeStage(true);
      audio.phase();
      setTimeout(() => screen.classList.remove('is-boss-awakening'), ms(1600));
      setTimeout(() => banner.classList.add('is-leaving'), ms(2000));
      setTimeout(() => banner.remove(), ms(2700));
    };
    if (reduced) ignite();
    else setTimeout(ignite, ms(360));
  };

  if (reduced) {
    reveal();
    return;
  }

  const revealDelay = Math.round(1050 / battleSpeed());
  phaseCinemaUntil = performance.now() + revealDelay;
  screen.classList.add('is-boss-rupture');
  const guard = document.createElement('div');
  guard.className = 'boss-rupture-guard';
  guard.setAttribute('aria-hidden', 'true');
  screen.appendChild(guard);
  if (typeof audio.hush === 'function') audio.hush(1.3);
  if (typeof audio.phaseOmen === 'function') audio.phaseOmen();
  armFalseDeath(screen);
  setTimeout(() => {
    guard.remove();
    reveal();
  }, revealDelay);
}

function presentBossSurge(battle, detail = {}) {
  if (!battle?.enemy?.surged) return;
  const key = `${battlePresentationKey(battle)}:surge`;
  if (presentedSurgeBattles.has(key)) return;
  const screen = qs('.battle-screen') || qs('.online-screen');
  if (!screen) return;
  presentedSurgeBattles.add(key);
  const surge = battle.enemy.surge || {};
  const title = detail.title || battle.enemy.surgeTitle || surge.title || '梦魇暴走';
  const line = detail.line || surge.line || '它的梦魇规则翻到了背面。';
  const accent = safeColor(battle.enemy.accent || '#d06a60');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (typeof audio.hush === 'function') audio.hush(0.8);
  const node = document.createElement('div');
  node.className = 'surge-cinema';
  node.style.setProperty('--surge', accent);
  node.innerHTML = `<div class="surge-cinema__glyph" aria-hidden="true">${esc(battle.enemy.glyph || '魇')}</div>
    <div class="surge-cinema__copy">
      <small>DREAM SURGE · 梦魇暴走</small>
      <strong>${esc(title)}</strong>
      <p>${esc(line)}</p>
      <em>规则变了，但意图仍然可读。</em>
    </div>`;
  screen.appendChild(node);
  screen.querySelector('.stage-actor--enemy')?.classList.add('is-surging');
  requestAnimationFrame(() => node.classList.add('is-lit'));
  phaseCinemaUntil = performance.now() + (reduced ? 450 : 1100);
  const life = reduced ? 1000 : 2400;
  setTimeout(() => node.classList.add('is-leaving'), life);
  setTimeout(() => node.remove(), life + 650);
}

function maybePresentBattle() {
  let battle = null;
  if (G.screen === 'battle') battle = currentBattle();
  else if (G.screen === 'online') {
    const online = getOnline();
    if (online.status === 'battle') battle = online.battle;
  }
  if (!battle) return;
  const key = battlePresentationKey(battle);
  const active = battle.phase === 'player' || battle.phase === 'active';
  if (active && battle.lastStand?.offered && !battle.lastStand.resolved && !battle.lastStand.soundPlayed) {
    battle.lastStand.soundPlayed = true;
    audio.hush(2.6);
    requestAnimationFrame(() => audio.lastStand());
  }
  if (!presentedRelicBattles.has(key)) {
    presentedRelicBattles.add(key);
    if (active && battle.mode === 'adventure' && battle.relics?.length) {
      requestAnimationFrame(() => presentRelicAwakening(battle));
    }
  }
  if (active && battle.enemy?.phase2 && (Number(battle.enemy.phase) || 1) >= 2) {
    presentBossPhase(battle);
  }
  if (active && battle.mode === 'adventure' && battle.tier === 'boss' && !battle.parley
    && !(battle.lastStand?.offered && !battle.lastStand.resolved)
    && parleyProfile(battle)) {
    const parleyKey = `${key}:parley`;
    if (!presentedParleyBattles.has(parleyKey)) {
      presentedParleyBattles.add(parleyKey);
      requestAnimationFrame(() => {
        const live = currentBattle();
        if (!live || live !== battle || live.phase !== 'player' || live.parley) {
          return;
        }
        if (G.ui.modal) {
          presentedParleyBattles.delete(parleyKey);
          return;
        }
        openModal('parley', {});
      });
    }
  }
  const rewardRelic = battle.rewards?.relic;
  if (rewardRelic) {
    const gainKey = `${key}:${rewardRelic.id}`;
    if (!presentedRelicGains.has(gainKey)) {
      presentedRelicGains.add(gainKey);
      requestAnimationFrame(() => presentRelicGain(rewardRelic));
    }
  }
}

function renderScreen() {
  switch (G.screen) {
    case 'world':
      return renderWorld();
    case 'origins':
      return renderOrigins();
    case 'map':
      return renderMap();
    case 'battle':
      return renderBattle(currentBattle());
    case 'sandbox':
      return renderSandbox();
    case 'deckbuilder':
      return renderDeckbuilder();
    case 'studio':
      return renderStudio();
    case 'online':
      return renderOnline();
    case 'ending':
      return renderEnding();
    case 'menu':
    default:
      return renderMenu();
  }
}

function renderToast() {
  const toast = G.ui.toast;
  if (!toast) {
    toastRoot.innerHTML = '';
    return;
  }
  const tone = Object.prototype.hasOwnProperty.call(TOAST_ICONS, toast.tone) ? toast.tone : 'default';
  toastRoot.innerHTML = `<div class="toast toast--${tone}">
    <span class="toast__icon">${icon(TOAST_ICONS[tone], 16)}</span>
    <span class="toast__message">${esc(toast.message)}</span>
  </div>`;
}

function renderModalRoot() {
  const m = G.ui.modal;
  modalRoot.innerHTML = m ? renderModal() : '';
  if (m) G.ui.renderedModalSeq = m.seq;
  if (m?.type === 'image-editor') requestAnimationFrame(() => setupImageEditor());
  document.body.classList.toggle('has-modal', Boolean(m));
}

function bossMusicScene(battle) {
  if (!battle?.enemy) return null;
  const def = ENEMY_MAP[battle.enemy.defId];
  const isBoss = battle.tier === 'boss'
    || battle.enemy.tier === 'boss'
    || def?.tier === 'boss'
    || battle.tier === 'merchant'
    || def?.tier === 'merchant';
  if (!isBoss) return null;
  return (Number(battle.enemy.phase) || 1) >= 2 ? 'bossPhase2' : 'boss';
}

function musicSceneFor() {
  if (G.screen === 'battle') {
    const battle = currentBattle();
    if (battle && (battle.phase === 'victory' || battle.phase === 'defeat')) return 'result';
    return bossMusicScene(battle) || 'battle';
  }
  if (G.screen === 'online') {
    const online = getOnline();
    if (online.status === 'battle' && online.battle) {
      if (online.battle.phase !== 'active') return 'result';
      if (online.battle.mode === 'coop') {
        return bossMusicScene(online.battle) || 'onlineBattle';
      }
      return 'onlineBattle';
    }
    return 'online';
  }
  if (G.screen === 'world' || G.screen === 'map') return 'world';
  if (G.screen === 'sandbox' || G.screen === 'deckbuilder' || G.screen === 'studio') return 'studio';
  if (G.screen === 'ending') return 'ending';
  return 'menu';
}

function flushAchievementPops() {
  const pops = G.ui.achievementPops;
  if (!Array.isArray(pops) || !pops.length) return;
  G.ui.achievementPops = [];
  const names = pops.slice(0, 2).join('、');
  showToast(pops.length > 2 ? `成就点亮 · ${names} 等 ${pops.length} 项` : `成就点亮 · ${names}`, 'success');
}

function flushRewardPops() {
  const pops = G.ui.rewardPops;
  if (!Array.isArray(pops) || !pops.length) return;
  G.ui.rewardPops = [];
  showToast(`新的纪念牌收入行囊 · ${pops.join('、')}`, 'success');
}

function render() {
  appRoot.innerHTML = renderScreen();
  document.body.dataset.screen = G.screen;
  audio.setScene(musicSceneFor());
  renderModalRoot();
  renderToast();
  maybePresentBattle();
  flushAchievementPops();
  flushRewardPops();
}

function openModal(type, data = {}) {
  G.ui.modal = { type, data, seq: ++modalSeq };
  G.ui.renderedModalSeq = null;
  render();
  focusModal();
}

function refreshModal() {
  if (!G.ui.modal) return;
  modalRoot.innerHTML = renderModal();
  G.ui.renderedModalSeq = G.ui.modal.seq;
  if (G.ui.modal.type === 'image-editor') requestAnimationFrame(() => setupImageEditor());
}

function focusModal() {
  const m = G.ui.modal;
  if (!m) return;
  let selector = null;
  if (m.type === 'card-editor') selector = '[data-editor-field="name"]';
  if (m.type === 'generate' && !m.data?.busy) selector = '[data-gen-prompt]';
  if (!selector) return;
  requestAnimationFrame(() => {
    const field = qs(selector, modalRoot);
    if (field) {
      field.focus({ preventScroll: true });
      field.select?.();
    }
  });
}

function closeModal(force = false) {
  const m = G.ui.modal;
  if (!m) return;
  if (!force && m.data?.busy) return;
  G.ui.modal = null;
  G.ui.confirmAction = null;
  render();
}

function attemptCloseModal() {
  const m = G.ui.modal;
  if (!m || m.data?.busy) return;
  if (!['guide', 'confirm', 'deck-view', 'card-detail', 'card-editor', 'image-editor', 'generate', 'npc', 'quests', 'codex', 'parley', 'pile-view', 'keywords', 'achievements', 'save-backup', 'card-art', 'contracts'].includes(m.type)) return;
  closeModal(true);
}

function queueModal(type, data = {}) {
  modalQueue.push({ type, data });
}

function advanceModalQueue() {
  const next = modalQueue.shift();
  if (!next) {
    render();
    return;
  }
  openModal(next.type, next.data);
}

function closeModalIntoQueue() {
  G.ui.modal = null;
  G.ui.confirmAction = null;
  advanceModalQueue();
}

function markStorySeen(storyId) {
  const story = STORIES[storyId];
  if (!story) return;
  if (!G.profile.world.storySeen.includes(storyId)) {
    applyStoryEffects(G.profile.world, story);
  }
  saveProfileNow();
}

function enterWorld() {
  // 已经在播剧情/弹窗时不要重新进入：下面的 modalQueue = [] 会把
  // 刚排好的序章清空——玩家看到的是「直接落到地图」，一句台词都没读到。
  if (G.ui.modal) return;
  const world = G.profile.world;
  const regionId = REGION_MAP[world.lastRegion] ? world.lastRegion : 'corridor';
  G.ui.worldIsland = regionId;
  G.ui.regionChoice = regionId;
  setScreen('world');
  const { newlyUnlocked, completedQuests } = refreshWorld(world);
  saveProfileNow();
  modalQueue = [];
  const storyIds = pickWorldStories(world);
  for (const storyId of storyIds) markStorySeen(storyId);
  for (const storyId of storyIds) queueModal('story', { storyId });
  if (world.pendingFinale) queueModal('finale', {});
  for (const entry of completedQuests) queueModal('quest-reward', { questId: entry.quest.id });
  render();
  if (newlyUnlocked.length) {
    showToast(`新的航路从雾里浮出：${newlyUnlocked.map((region) => region.name).join('、')}。`, 'success');
  }
  for (const entry of completedQuests) {
    const card = entry.card;
    if (card) showToast(`委托完成，纪念牌【${card.name}】已收入行囊。`, 'success');
  }
  // 直接开第一段剧情，剩下的排队。
  // 走「队列 + 延后」会在同一次点击里被第二次 enterWorld 把队列清空，
  // 玩家落到地图上、一句序章都没读到——这里改成先落地弹窗，再排后续。
  if (storyIds.length) {
    openModal('story', { storyId: storyIds[0] });
    for (let i = 1; i < storyIds.length; i += 1) queueModal('story', { storyId: storyIds[i] });
  } else if (world.pendingFinale || completedQuests.length) {
    setTimeout(advanceModalQueue, 0);
  }
}

function openNpcTalk(npcId) {
  const npc = NPC_MAP[npcId];
  if (!npc) return;
  const world = G.profile.world;
  const line = npcTalkLine(world, npc.id);
  markNpcTalk(world, npc.id);
  saveProfileNow();
  // 有「正经话」要说的人，先递上一句寒暄，再由玩家决定要不要聊下去。
  const pending = pendingDialogue(world, npc.id);
  if (G.ui.modal?.type === 'npc' && G.ui.modal.data?.npcId === npc.id) {
    G.ui.modal.data.line = line;
    G.ui.modal.data.dialogueId = pending?.title || null;
    G.ui.modal.seq = ++modalSeq;
    refreshModal();
    return;
  }
  openModal('npc', { npcId: npc.id, line, dialogueId: pending?.title || null });
}

function openDialogue(npcId) {
  const npc = NPC_MAP[npcId];
  if (!npc) return;
  const world = G.profile.world;
  const pending = pendingDialogue(world, npc.id);
  if (!pending) return;
  // 不在这里记「已聊过」——半路关窗的人应该还能再问一次。记在 dlg-close 走完时。
  openModal('dialogue', { npcId: npc.id, dialogueId: pending.id, nodeId: pending.entry, title: pending.title });
}

function openConfirm(options, onAccept) {
  G.ui.confirmAction = typeof onAccept === 'function' ? onAccept : null;
  openModal('confirm', options);
}

function exportSaveBackup() {
  try {
    const payload = buildSaveBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cardrealm-backup-${payload.exportedAt.slice(0, 10)}.json`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('存档备份已导出为 JSON。', 'success');
    audio.coin();
  } catch (error) {
    console.error(error);
    showToast('导出失败，请检查本地存储空间。', 'danger');
  }
}

async function handleSaveFile(file) {
  if (!file) return;
  if (file.size > 24 * 1024 * 1024) {
    showToast('这份备份太大了，牌境无法安全读取。', 'warning');
    return;
  }
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (error) {
    console.warn(error);
    showToast('备份文件无法解析，可能已经损坏。', 'danger');
    return;
  }
  if (!payload || payload.app !== 'cardrealm' || payload.kind !== 'profile-backup' || !payload.profile) {
    showToast('这不是牌境的存档备份文件。', 'danger');
    return;
  }
  const exported = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString('zh-CN') : '未知时间';
  const wins = Number(payload.profile?.stats?.wins) || 0;
  const hasRun = Boolean(payload.run?.run);
  openConfirm({
    eyebrow: 'IMPORT THE DREAM',
    title: '导入存档备份？',
    message: `这份备份来自 ${exported}，记录 ${wins} 次凯旋${hasRun ? '，并包含一段未完成的远征' : ''}。导入会覆盖当前档案${G.run ? '与进行中的远征' : ''}；本机的自定义音频与 API Key 会保留。`,
    tone: 'danger',
    confirmLabel: '导入并覆盖',
  }, () => {
    const result = importSaveBackup(payload);
    if (!result.ok) {
      showToast(result.message || '导入失败。', 'danger');
      return;
    }
    G.sandboxBattle = null;
    const restored = restoreRunSave();
    if (!restored) {
      G.run = null;
      G.ui.reward = null;
      G.ui.endingId = null;
      setScreen('menu');
    }
    render();
    showToast(restored ? '存档已导入，进行中的远征也回来了。' : '存档已导入。', 'success');
  });
}

function openGenerateModal(kind = 'hero', enemyId = null, style = null) {
  const safeKind = kind === 'enemy' ? 'enemy' : 'hero';
  const safeEnemyId = safeKind === 'enemy' ? (ENEMY_MAP[enemyId] ? enemyId : ENEMIES[0].id) : null;
  openModal('generate', {
    kind: safeKind,
    enemyId: safeEnemyId,
    subject: defaultGenerationSubject(safeKind, safeEnemyId),
    style: style || G.profile.ai.lastStyle || 'dark',
    busy: false,
    error: '',
  });
}

function openCardEditor(cardId = null) {
  if (cardId) {
    const card = getCardDef(cardId);
    if (!card || !card.custom) {
      showToast('没有找到这张造物。', 'warning');
      return;
    }
    openModal('card-editor', { draft: cardDraftFromDef(card), isNew: false });
    return;
  }
  openModal('card-editor', { draft: newCardDraft(uid('card')), isNew: true });
}

function sanitizeEffect(effect) {
  if (!effect || typeof effect !== 'object') return null;
  const amount = Math.round(clamp(effect.amount, 0, 99));
  switch (effect.type) {
    case 'damage':
      return { type: 'damage', amount, hits: Math.round(clamp(effect.hits || 1, 1, 9)) };
    case 'block':
    case 'heal':
    case 'draw':
    case 'energy':
    case 'loseHp':
    case 'gold':
    case 'blockDamage':
    case 'directDamage':
      return { type: effect.type, amount };
    case 'comboDamage':
      return { type: 'comboDamage', amount, scale: Math.round(clamp(effect.scale || 3, 1, 9)) };
    case 'execute':
      return {
        type: 'execute',
        amount,
        threshold: Math.round(clamp(effect.threshold || 0.35, 0.05, 0.9) * 100) / 100,
        multiplier: Math.round(clamp(effect.multiplier || 3, 1, 6)),
      };
    case 'recollect':
      return { type: 'recollect', amount: Math.round(clamp(effect.amount || 1, 1, 5)) };
    case 'drawTo':
      return { type: 'drawTo', amount: Math.round(clamp(effect.amount || 6, 1, 9)) };
    case 'detonate':
      return {
        type: 'detonate',
        status: effect.status === 'poison' ? 'poison' : 'burn',
        amount: Math.round(clamp(effect.amount || 1, 1, 20)),
      };
    case 'catalyze':
      return {
        type: 'catalyze',
        status: effect.status === 'burn' ? 'burn' : 'poison',
        amount: Math.round(clamp(effect.amount, 0, 20)),
      };
    case 'toxicBurst':
      return { type: 'toxicBurst', scale: Math.round(clamp(effect.scale || 3, 1, 9)) };
    case 'status':
      if (!STATUS_INFO[effect.status]) return null;
      return {
        type: 'status',
        status: effect.status,
        target: effect.target === 'enemy' ? 'enemy' : 'self',
        amount,
      };
    default:
      return null;
  }
}

function saveDraftCard() {
  const m = G.ui.modal;
  if (!m || m.type !== 'card-editor') return;
  const draft = m.data.draft;
  const name = String(draft.name || '').trim();
  if (!name) {
    showToast('先给你的造物起一个名字。', 'warning');
    qs('[data-editor-field="name"]', modalRoot)?.focus();
    return;
  }
  const effects = (draft.effects || []).map(sanitizeEffect).filter((effect) => effect && effectHasPayload(effect));
  if (!effects.length) {
    showToast('至少需要一条真正会生效的效果。', 'warning');
    return;
  }
  const card = {
    id: draft.id,
    name: name.slice(0, 12),
    cost: Math.round(clamp(draft.cost, 0, 3)),
    type: draft.type === 'skill' ? 'skill' : 'attack',
    rarity: 'custom',
    glyph: String(draft.glyph || '梦').slice(0, 1),
    palette: draft.palette || '#9b78c7',
    school: SCHOOLS[draft.school] ? draft.school : 'dream',
    flavor: String(draft.flavor || '').trim().slice(0, 34),
    effects,
    custom: true,
  };
  saveCustomCard(card);
  if (m.data.isNew) addCardToSandbox(card.id, true);
  saveProfileNow();
  closeModal(true);
  showToast(m.data.isNew ? `【${card.name}】已被梦记住。` : `【${card.name}】已改写。`, 'success');
  audio.buff();
  render();
}

function deleteDraftCard() {
  const m = G.ui.modal;
  if (!m || m.type !== 'card-editor') return;
  const draft = m.data.draft;
  openConfirm({
    eyebrow: 'DESTROY THE CREATION',
    title: '销毁这张造物？',
    message: `「${draft.name || '未命名造物'}」会从工坊与试炼牌组中彻底消失。这个动作无法撤回。`,
    tone: 'danger',
    confirmLabel: '销毁此牌',
  }, () => {
    removeCustomCard(draft.id);
    showToast('造物已化为灰烬。', 'warning');
    render();
  });
}

function startUpload(kind, enemyId = null) {
  if (!fileInput) return;
  pendingUpload = { kind, enemyId: ENEMY_MAP[enemyId] ? enemyId : ENEMIES[0].id };
  fileInput.value = '';
  fileInput.click();
}

function openImageEditor(source, kind, enemyId) {
  const frame = source.frames[0];
  const background = estimateBackground(frame);
  const settings = {
    crop: { x: 0, y: 0, w: 1, h: 1 },
    removeBg: background.transparency < 0.6,
    transparency: background.transparency,
    transparentBorder: background.transparency >= 0.6,
    bg: background.color,
    tolerance: 34,
    feather: 12,
  };
  settings.crop = computeContentBounds(frame, settings);
  openModal('image-editor', { kind, enemyId, source, settings, picking: false, busy: false, error: '' });
}

async function handlePortraitFile(file) {
  if (!file || !pendingUpload) return;
  const { kind, enemyId } = pendingUpload;
  pendingUpload = null;
  try {
    showToast(file.type === 'image/gif' ? '正在拆解动图的每一帧…' : '正在读取图片…', 'default');
    const source = await decodePortraitSource(file);
    openImageEditor(source, kind, enemyId);
  } catch (error) {
    showToast(error?.message || '无法读取这张图片。', 'danger');
  } finally {
    fileInput.value = '';
  }
}

function updateImageCropOverlay() {
  const m = G.ui.modal;
  const geometry = m?.data?._geometry;
  const cropEl = qs('[data-image-crop]', modalRoot);
  if (!m || m.type !== 'image-editor' || !geometry || !cropEl) return;
  const crop = m.data.settings.crop;
  const left = (geometry.offsetX + crop.x * geometry.drawWidth) / geometry.size;
  const top = (geometry.offsetY + crop.y * geometry.drawHeight) / geometry.size;
  const width = (crop.w * geometry.drawWidth) / geometry.size;
  const height = (crop.h * geometry.drawHeight) / geometry.size;
  cropEl.style.left = `${left * 100}%`;
  cropEl.style.top = `${top * 100}%`;
  cropEl.style.width = `${width * 100}%`;
  cropEl.style.height = `${height * 100}%`;
}

function paintImageEditor() {
  const m = G.ui.modal;
  if (!m || m.type !== 'image-editor') return;
  const canvas = qs('[data-image-preview]', modalRoot);
  if (!canvas) return;
  canvas.width = 640;
  canvas.height = 640;
  m.data._geometry = drawEditorPreview(canvas, m.data.source.frames[0], m.data.settings);
  updateImageCropOverlay();
}

function syncImageEditorControls() {
  const m = G.ui.modal;
  if (!m || m.type !== 'image-editor') return;
  const { settings, picking } = m.data;
  const color = rgbToHex(settings.bg);
  const swatch = qs('[data-image-swatch]', modalRoot);
  if (swatch) {
    swatch.style.setProperty('--swatch', color);
    swatch.title = color;
  }
  const hex = qs('[data-image-hex]', modalRoot);
  if (hex) hex.textContent = color;
  const toggle = qs('[data-image-toggle="removeBg"]', modalRoot);
  if (toggle) toggle.checked = settings.removeBg;
  const tolerance = qs('[data-image-value="tolerance"]', modalRoot);
  if (tolerance) tolerance.textContent = String(settings.tolerance);
  const feather = qs('[data-image-value="feather"]', modalRoot);
  if (feather) feather.textContent = String(settings.feather);
  qs('[data-image-stage]', modalRoot)?.classList.toggle('is-picking', Boolean(picking));
  const hint = qs('[data-image-hint]', modalRoot);
  if (hint) hint.textContent = picking ? '点击画面，吸取想移除的背景色。' : '拖动选框裁剪，拖动四角缩放；也能在画面空白处重新框选。';
  const pick = qs('[data-action="image-pick-color"]', modalRoot);
  if (pick) {
    pick.classList.toggle('is-active', Boolean(picking));
    pick.innerHTML = `${icon('drop', 13)} ${picking ? '正在取色' : '点选背景色'}`;
  }
}

function setupImageEditor() {
  const m = G.ui.modal;
  if (!m || m.type !== 'image-editor') return;
  const stage = qs('[data-image-stage]', modalRoot);
  if (!stage || stage.dataset.ready === '1') return;
  stage.dataset.ready = '1';
  paintImageEditor();
  syncImageEditorControls();

  const pointFor = (event) => {
    const geometry = m.data._geometry;
    const rect = stage.getBoundingClientRect();
    if (!geometry || !rect.width || !rect.height) return null;
    const px = ((event.clientX - rect.left) / rect.width) * geometry.size;
    const py = ((event.clientY - rect.top) / rect.height) * geometry.size;
    const nx = (px - geometry.offsetX) / geometry.drawWidth;
    const ny = (py - geometry.offsetY) / geometry.drawHeight;
    return { x: nx, y: ny, inImage: nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1 };
  };

  let drag = null;
  stage.addEventListener('pointerdown', (event) => {
    if (m.data.busy) return;
    const point = pointFor(event);
    if (!point?.inImage) return;
    if (m.data.picking) {
      m.data.settings.bg = sampleBackground(m.data.source.frames[0], point.x, point.y);
      m.data.settings.removeBg = true;
      m.data.picking = false;
      syncImageEditorControls();
      paintImageEditor();
      showToast('背景色已从画面里取走。', 'default');
      return;
    }
    const handle = event.target.closest('[data-crop-handle]')?.dataset.cropHandle;
    const box = event.target.closest('[data-image-crop]');
    drag = {
      mode: handle || (box ? 'move' : 'new'),
      startX: point.x,
      startY: point.y,
      crop: { ...m.data.settings.crop },
    };
    stage.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag || m.data.busy) return;
    const point = pointFor(event);
    if (!point) return;
    const nx = clamp(point.x, 0, 1);
    const ny = clamp(point.y, 0, 1);
    const start = drag.crop;
    const min = 0.06;
    let { x, y, w, h } = start;
    if (drag.mode === 'move') {
      x = clamp(start.x + (nx - drag.startX), 0, 1 - start.w);
      y = clamp(start.y + (ny - drag.startY), 0, 1 - start.h);
    } else if (drag.mode === 'new') {
      const anchorX = clamp(drag.startX, 0, 1);
      const anchorY = clamp(drag.startY, 0, 1);
      x = Math.min(anchorX, nx);
      y = Math.min(anchorY, ny);
      w = Math.max(min, Math.abs(nx - anchorX));
      h = Math.max(min, Math.abs(ny - anchorY));
      if (x + w > 1) w = 1 - x;
      if (y + h > 1) h = 1 - y;
    } else {
      const right = start.x + start.w;
      const bottom = start.y + start.h;
      if (drag.mode.includes('w')) {
        x = clamp(nx, 0, right - min);
        w = right - x;
      }
      if (drag.mode.includes('e')) {
        w = clamp(nx, start.x + min, 1) - start.x;
      }
      if (drag.mode.includes('n')) {
        y = clamp(ny, 0, bottom - min);
        h = bottom - y;
      }
      if (drag.mode.includes('s')) {
        h = clamp(ny, start.y + min, 1) - start.y;
      }
    }
    m.data.settings.crop = { x, y, w, h };
    updateImageCropOverlay();
    event.preventDefault();
  });
  const endDrag = (event) => {
    if (!drag) return;
    drag = null;
    if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
}

async function applyImageEditor() {
  const m = G.ui.modal;
  if (!m || m.type !== 'image-editor' || m.data.busy) return;
  m.data.busy = true;
  m.data.error = '';
  refreshModal();
  const { kind, enemyId, settings, source } = m.data;
  const previousSkins = { ...G.profile.enemySkins };
  const previousAvatars = G.profile.heroAvatars ? { ...G.profile.heroAvatars } : null;
  const previousAvatar = G.profile.avatar;
  try {
    const result = await composePortrait(source, settings);
    if (kind === 'enemy') {
      G.profile.enemySkins[enemyId] = { ...(G.profile.enemySkins[enemyId] || {}), image: result.dataUrl };
    } else {
      setHeroAvatar(result.dataUrl);
    }
    if (!saveProfileNow()) {
      G.profile.enemySkins = previousSkins;
      if (previousAvatars) G.profile.heroAvatars = previousAvatars;
      else delete G.profile.heroAvatars;
      G.profile.avatar = previousAvatar;
      m.data.busy = false;
      m.data.error = '本地空间不足，图片没有保存。请换用更小的图片。';
      refreshModal();
      return;
    }
    m.data.busy = false;
    closeModal(true);
    showToast(kind === 'enemy'
      ? `梦魇的新形态已被记住${result.animated ? `，${result.frames} 帧动画会继续呼吸` : ''}。`
      : `你的新形象已被记住${result.animated ? `，${result.frames} 帧动画会继续呼吸` : ''}。`, 'success');
    audio.buff();
    render();
  } catch (error) {
    m.data.busy = false;
    m.data.error = error?.message || '无法处理这张图片。';
    refreshModal();
    showToast(m.data.error, 'danger');
  }
}

function audioBucket(kind) {
  return kind === 'music' ? G.profile.audio.music : G.profile.audio.sfx;
}

function startAudioUpload(kind, slot) {
  if (!audioInput) return;
  const valid = kind === 'music' ? MUSIC_SLOT_MAP[slot] : SFX_SLOT_MAP[slot];
  if (!valid) return;
  pendingAudioUpload = { kind, slot };
  audioInput.value = '';
  audioInput.click();
}

async function handleAudioFile(file) {
  if (!file || !pendingAudioUpload) return;
  const { kind, slot } = pendingAudioUpload;
  pendingAudioUpload = null;
  const slotInfo = kind === 'music' ? MUSIC_SLOT_MAP[slot] : SFX_SLOT_MAP[slot];
  if (!slotInfo) {
    if (audioInput) audioInput.value = '';
    return;
  }
  const validationError = audioFileError(file, kind);
  if (validationError) {
    if (audioInput) audioInput.value = '';
    showToast(validationError, 'warning');
    return;
  }
  const duration = await readAudioDuration(file);
  const durationProblem = await durationError(file, kind, duration);
  if (durationProblem) {
    if (audioInput) audioInput.value = '';
    showToast(durationProblem, 'warning');
    return;
  }
  try {
    await ensureStorageRoom(file.size);
    const record = await saveAudioFile(file, {
      kind,
      slot,
      name: file.name,
      mime: file.type,
      duration,
    });
    const bucket = audioBucket(kind);
    const previous = bucket[slot];
    bucket[slot] = {
      id: record.id,
      name: record.name,
      mime: record.mime,
      size: record.size,
      duration: record.duration,
    };
    const saved = saveProfileNow();
    audio.stopPreview();
    if (kind === 'music') {
      audio.setCustomMusic(slot, URL.createObjectURL(record.blob));
    } else {
      audio.setCustomSfx(slot, record.blob);
    }
    if (previous?.id && previous.id !== record.id) {
      deleteAudioFile(previous.id).catch((error) => console.warn('清理旧音频失败。', error));
    }
    showToast(
      saved
        ? `「${slotInfo.label}」已换上你带来的声音。`
        : '声音已就绪，但档案保存失败，重启后可能丢失。',
      saved ? 'success' : 'warning',
    );
    audio.buff();
    render();
  } catch (error) {
    console.warn('保存自定义音频失败。', error);
    showToast(error?.message || '无法保存这段音频。', 'danger');
  } finally {
    if (audioInput) audioInput.value = '';
  }
}

function resetAudioSlot(kind, slot) {
  const bucket = audioBucket(kind);
  const meta = bucket[slot];
  if (!meta) return;
  delete bucket[slot];
  saveProfileNow();
  if (kind === 'music') audio.setCustomMusic(slot, null);
  else audio.setCustomSfx(slot, null);
  deleteAudioFile(meta.id).catch((error) => console.warn('删除旧音频失败。', error));
  showToast('这一段声音已归还给内置版本。', 'default');
  render();
}

async function previewCustomMusic(slot) {
  const meta = G.profile.audio.music[slot];
  if (!meta) return;
  const record = await loadAudioFile(meta.id).catch(() => null);
  if (!record) {
    delete G.profile.audio.music[slot];
    audio.setCustomMusic(slot, null);
    saveProfileDebounced(400);
    showToast('这段音乐的文件已丢失，已还原为内置音乐。', 'warning');
    render();
    return;
  }
  const url = URL.createObjectURL(record.blob);
  if (audio.previewMusic(url, 12)) {
    setTimeout(() => URL.revokeObjectURL(url), 14000);
    showToast(`正在试听「${MUSIC_SLOT_MAP[slot]?.label || '场景'}」的背景音乐。`, 'default');
  } else {
    URL.revokeObjectURL(url);
    showToast('当前无法播放音频，请检查系统声音或稍后再试。', 'warning');
  }
}

function resetAllCustomAudio() {
  G.profile.audio = { sfx: {}, music: {} };
  G.profile.settings.musicVolume = 0.8;
  G.profile.settings.sfxVolume = 0.9;
  saveProfileNow();
  audio.stopPreview();
  for (const slot of SFX_SLOT_IDS) audio.setCustomSfx(slot, null);
  for (const slot of MUSIC_SLOT_IDS) audio.setCustomMusic(slot, null);
  audio.setVolumes({ music: 0.8, sfx: 0.9 });
  clearAudioFiles().catch((error) => console.warn('清理音频仓库失败。', error));
  showToast('所有梦声已归还给内置版本。', 'success');
  render();
}

async function restoreCustomAudio() {
  const tasks = [];
  let pruned = 0;
  for (const [slot, meta] of Object.entries(G.profile.audio.sfx)) {
    if (!SFX_SLOT_MAP[slot]) {
      delete G.profile.audio.sfx[slot];
      pruned += 1;
      continue;
    }
    tasks.push((async () => {
      const record = await loadAudioFile(meta.id).catch(() => null);
      if (G.profile.audio.sfx[slot]?.id !== meta.id) return;
      if (!record) {
        delete G.profile.audio.sfx[slot];
        pruned += 1;
        return;
      }
      audio.setCustomSfx(slot, record.blob);
    })());
  }
  for (const [slot, meta] of Object.entries(G.profile.audio.music)) {
    if (!MUSIC_SLOT_MAP[slot]) {
      delete G.profile.audio.music[slot];
      pruned += 1;
      continue;
    }
    tasks.push((async () => {
      const record = await loadAudioFile(meta.id).catch(() => null);
      if (G.profile.audio.music[slot]?.id !== meta.id) return;
      if (!record) {
        delete G.profile.audio.music[slot];
        pruned += 1;
        return;
      }
      const url = URL.createObjectURL(record.blob);
      audio.setCustomMusic(slot, url);
    })());
  }
  await Promise.all(tasks);
  if (pruned) {
    console.warn(`已清理 ${pruned} 个丢失的自定义音频槽位。`);
    saveProfileDebounced(500);
  }
}

function handleAudioVolume(target) {
  const which = target.dataset.audioVolume;
  if (which !== 'music' && which !== 'sfx') return;
  const value = clamp(Number(target.value) / 100, 0, 1);
  G.profile.settings[which === 'music' ? 'musicVolume' : 'sfxVolume'] = value;
  audio.setVolumes({
    music: G.profile.settings.musicVolume,
    sfx: G.profile.settings.sfxVolume,
  });
  const output = qs(`[data-audio-volume-output="${which}"]`);
  if (output) output.textContent = `${Math.round(value * 100)}%`;
  saveProfileDebounced(300);
}

async function runGeneration() {
  const m = G.ui.modal;
  if (!m || m.type !== 'generate' || m.data.busy) return;
  if (!String(G.profile.ai.baseUrl || '').trim()) {
    showToast('先在「AI 生图」里填写自己的接口地址与密钥。', 'warning');
    return;
  }
  const promptField = qs('[data-gen-prompt]', modalRoot);
  const subject = String(promptField?.value || m.data.subject || '').trim();
  if (!subject) {
    showToast('先描述一下你希望梦见什么。', 'warning');
    promptField?.focus();
    return;
  }
  m.data.subject = subject.slice(0, 600);
  m.data.busy = true;
  m.data.error = '';
  G.profile.ai.lastStyle = m.data.style;
  saveProfileDebounced(400);
  refreshModal();
  const enemyLore = m.data.kind === 'enemy' ? (ENEMY_MAP[m.data.enemyId]?.lore || '') : '';
  const prompt = composePortraitPrompt(m.data.kind, m.data.subject, m.data.style, enemyLore);
  try {
    const dataUrl = await generatePortraitWithConfig({
      prompt,
      config: { ...G.profile.ai },
    });
    if (!G.ui.modal || G.ui.modal.type !== 'generate') return;
    if (m.data.kind === 'enemy') {
      G.profile.enemySkins[m.data.enemyId] = {
        ...(G.profile.enemySkins[m.data.enemyId] || {}),
        image: dataUrl,
      };
    } else {
      setHeroAvatar(dataUrl);
    }
    const saved = saveProfileNow();
    closeModal(true);
    showToast(saved ? '梦记住了这张新面孔。' : '图像已生成，但本地空间不足未能保存。', saved ? 'success' : 'warning');
    audio.buff();
    render();
  } catch (error) {
    const message = error?.message || '生成失败，请稍后重试。';
    if (G.ui.modal?.type === 'generate') {
      m.data.busy = false;
      m.data.error = message;
      refreshModal();
    }
    showToast(message, 'danger');
  }
}

function getFxLayer() {
  return qs('[data-fx-layer]');
}

function fxPoint(target, layer) {
  if (!target || !layer) return null;
  const anchor = target.querySelector('.actor-portal__frame') || target;
  const box = anchor.getBoundingClientRect();
  const frame = layer.getBoundingClientRect();
  if (!box.width || !frame.width) return null;
  return {
    x: box.left - frame.left + box.width / 2,
    y: box.top - frame.top + box.height / 2,
    w: box.width,
    h: box.height,
  };
}

function appendFx(layer, className, point, html, life = 800, vars = {}) {
  const node = document.createElement('span');
  node.className = className;
  node.style.left = `${point.x}px`;
  node.style.top = `${point.y}px`;
  for (const [key, value] of Object.entries(vars)) node.style.setProperty(key, value);
  node.innerHTML = html;
  layer.appendChild(node);
  setTimeout(() => node.remove(), life);
  return node;
}

function sparkBurst(layer, point, color, count = 9, spread = 120) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.7;
    const distance = spread * (0.45 + Math.random() * 0.75);
    const spark = document.createElement('i');
    spark.className = 'fx-spark';
    spark.style.left = `${point.x}px`;
    spark.style.top = `${point.y}px`;
    spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    spark.style.setProperty('--size', `${2 + Math.random() * 3.5}px`);
    spark.style.setProperty('--fx-color', color);
    spark.style.animationDelay = `${Math.random() * 90}ms`;
    layer.appendChild(spark);
    setTimeout(() => spark.remove(), 1000);
  }
}

/**
 * 震屏分四档，按「这一下有多疼」选，不是有伤害就抖。
 *
 * 反馈必须有动态范围：什么都抖，就等于什么都不抖。
 * 参考的分级是 1~3px 轻、5~10px 重；这里再切一刀，
 * 因为本作的伤害跨度从 2 点（星屑）到 40+ 点（万烛同灭）。
 */
const SHAKE_TIERS = {
  micro: { ms: 200 },
  light: { ms: 280 },
  hard: { ms: 430 },
  heavy: { ms: 560 },
};

function shakeTierFor(hpLoss, isPlayer = false) {
  // 玩家挨打自带额外权重：同一伤害，打在自己身上更"重"。
  const v = hpLoss + (isPlayer ? 4 : 0);
  if (v >= 28) return 'heavy';
  if (v >= 14) return 'hard';
  if (v >= 6) return 'light';
  return 'micro';
}

function shakeStage(level = 'light') {
  // 兼容旧的布尔调用：true = 最重档，false = 轻档。
  if (level === true) level = 'heavy';
  else if (level === false) level = 'light';
  const tier = SHAKE_TIERS[level] ? level : 'light';
  const stage = qs('.battle-screen--stage');
  if (!stage) return;
  stage.classList.remove('fx-shake--micro', 'fx-shake--light', 'fx-shake--hard', 'fx-shake--heavy');
  void stage.offsetWidth;
  stage.classList.add(`fx-shake--${tier}`);
  setTimeout(() => stage.classList.remove(`fx-shake--${tier}`), SHAKE_TIERS[tier].ms);
}

/**
 * 命中定格（hit stop）。
 *
 * 只在硬档以上触发：3~5 帧的"僵住"是让重击有重量的最便宜手段，
 * 但它同时也是最容易被滥用的——轻击也停，出牌节奏就会变得黏腻。
 * 这里不冻结渲染，而是给舞台一个极短的定格位移 + 微缩放，
 * 观感接近真暂停，又不会打乱正在跑的转阶段动画。
 */
function hitStop(target, tier) {
  if (!target) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (tier !== 'hard' && tier !== 'heavy') return;
  const node = target.classList?.contains('stage-actor') ? target : target.closest?.('.stage-actor') || target;
  node.classList.remove('is-impact');
  void node.offsetWidth;
  node.classList.add('is-impact', `is-impact--${tier}`);
  setTimeout(() => node.classList.remove('is-impact', `is-impact--${tier}`), tier === 'heavy' ? 420 : 300);
}

function flashHurt(layer) {
  const node = document.createElement('span');
  node.className = 'fx-hurt-vignette';
  layer.appendChild(node);
  setTimeout(() => node.remove(), 620);
}

function castCardFx(card, layer) {
  if (!card) return;
  const school = SCHOOLS[card.school] || SCHOOLS.dream;
  const node = document.createElement('span');
  node.className = 'fx-card-cast';
  node.style.setProperty('--fx-color', school.color);
  node.innerHTML = `<span class="fx-card-cast__sigil">${esc(card.glyph || '梦')}</span>
    <span class="fx-card-cast__copy"><small>${esc(school.name)}</small><strong>${esc(card.displayName || card.name)}</strong></span>`;
  layer.appendChild(node);
  setTimeout(() => node.remove(), 980);
}

function damageFx(layer, point, item, color) {
  const hpLoss = Math.max(0, Number(item.hpLoss) || 0);
  const isPlayer = item.target === 'player';
  const tier = shakeTierFor(hpLoss, isPlayer);
  const heavy = tier === 'heavy';
  const hard = tier === 'hard' || heavy;
  const angle = `${(Math.random() * 50 - 25).toFixed(1)}deg`;
  const size = Math.max(120, Math.min(340, point.w * 1.55));
  appendFx(layer, `fx-burst fx-burst--damage${heavy ? ' fx-burst--heavy' : ''}`, point,
    `<span class="fx-slash fx-slash--one"></span><span class="fx-slash fx-slash--two"></span><span class="fx-impact-ring"></span><span class="fx-impact-core"></span>${hard ? '<span class="fx-impact-spike"></span>' : ''}`,
    820, {
      '--fx-color': color,
      '--fx-angle': angle,
      '--fx-size': `${size}px`,
    });
  sparkBurst(layer, point, color, heavy ? 20 : hard ? 14 : 9, heavy ? 210 : hard ? 170 : 120);
  shakeStage(tier);
  hitStop(qs(`[data-float-target="${isPlayer ? 'player' : 'enemy'}"]`), tier);
  if (isPlayer) flashHurt(layer);
}

function blockFx(layer, point) {
  appendFx(layer, 'fx-shield', point,
    '<span class="fx-shield__ring"></span><span class="fx-shield__hex"></span><span class="fx-shield__glyph">守</span>',
    900, { '--fx-color': '#8fcac4', '--fx-size': `${Math.max(110, point.w * 1.2)}px` });
  sparkBurst(layer, point, '#8fcac4', 6, 80);
}

function healFx(layer, point) {
  appendFx(layer, 'fx-heal', point,
    Array.from({ length: 8 }, (_, index) => `<i style="--i:${index}"></i>`).join(''),
    1200, { '--fx-color': '#a9d69b', '--fx-size': `${Math.max(90, point.w * 0.9)}px` });
}

function statusFx(layer, point, item) {
  const info = STATUS_INFO[item.status];
  if (!info) return;
  const color = info.color || '#b48bc9';
  appendFx(layer, 'fx-status', point,
    `<span class="fx-status__ring"></span><span class="fx-status__glyph">${esc(info.glyph)}</span>`,
    900, { '--fx-color': color });
  sparkBurst(layer, point, color, 7, 90);
}

function burnFx(layer, point) {
  appendFx(layer, 'fx-burn', { x: point.x, y: point.y + point.h * 0.24 },
    Array.from({ length: 6 }, (_, index) => `<i class="fx-flame" style="--i:${index}"></i>`).join(''),
    1300, { '--fx-color': '#e08a52', '--fx-size': `${Math.max(80, point.w * 0.8)}px` });
  sparkBurst(layer, { x: point.x, y: point.y + point.h * 0.12 }, '#e9a468', 10, 100);
}

function thornFx(layer, point) {
  appendFx(layer, 'fx-thorns', point,
    Array.from({ length: 8 }, (_, index) => `<i style="--i:${index}"></i>`).join(''),
    850, { '--fx-color': '#c0a77e', '--fx-size': `${Math.max(90, point.w * 1.05)}px` });
}

function poisonFx(layer, point) {
  appendFx(layer, 'fx-poison', { x: point.x, y: point.y + point.h * 0.18 },
    Array.from({ length: 7 }, (_, index) => `<i style="--i:${index}"></i>`).join(''),
    1250, { '--fx-color': '#8fbf67', '--fx-size': `${Math.max(80, point.w * 0.8)}px` });
}

function resonanceFx(layer, point, item) {
  const chorus = Boolean(item.chorus);
  const school = SCHOOLS[item.school] || SCHOOLS.dream;
  const color = chorus ? '#c9a06a' : (school?.color || '#d8b56c');
  const glyph = chorus ? '混' : (school?.name?.[0] || '梦');
  appendFx(layer, 'fx-resonance', point,
    `<span class="fx-resonance__ring"></span><span class="fx-resonance__ring fx-resonance__ring--two"></span><span class="fx-resonance__glyph">${esc(glyph)}</span>`,
    1100, { '--fx-color': color, '--fx-size': `${Math.max(100, point.w * 1.15)}px` });
  sparkBurst(layer, point, color, 12, 130);
}

function smallMotesFx(layer, point, color) {
  sparkBurst(layer, point, color, 5, 60);
}

const STRIKE_IMPACT_DELAY = 180;

function battleSpeed() {
  return Number(G.profile.settings?.battleSpeed) >= 2 ? 2 : 1;
}

/** 把战斗演出整体提速：CSS 动画/过渡统一改 playbackRate，JS 里的停顿按倍率缩短。 */
function applyBattleSpeed(next = battleSpeed()) {
  const speed = Number(next) >= 2 ? 2 : 1;
  if (G.profile.settings) G.profile.settings.battleSpeed = speed;
  document.documentElement.dataset.battleSpeed = String(speed);
  if (typeof document.getAnimations === 'function') {
    for (const anim of document.getAnimations({ subtree: true })) {
      if (!inBattleScene(anim.effect?.target)) continue;
      try { anim.playbackRate = speed; } catch {}
    }
  }
  const label = document.querySelector('.speed-toggle strong');
  if (label) label.textContent = `${speed}x`;
  const toggle = document.querySelector('.speed-toggle');
  if (toggle) toggle.classList.toggle('is-fast', speed > 1);
}

function inBattleScene(node) {
  return node instanceof Element && Boolean(node.closest('.battle-screen, .fx-layer'));
}

// 新冒出来的动画也跟上当前倍率（只作用于战斗画面，菜单和弹窗保持原速）
for (const type of ['animationstart', 'transitionrun']) {
  document.addEventListener(type, (event) => {
    const speed = battleSpeed();
    if (speed === 1) return;
    const target = event.target;
    if (!inBattleScene(target) || !target.getAnimations) return;
    for (const anim of target.getAnimations()) {
      try { anim.playbackRate = speed; } catch {}
    }
  }, true);
}

function strikeActor(side) {
  const actor = qs(`[data-figure="${side === 'enemy' ? 'enemy' : 'player'}"]`);
  if (!actor) return false;
  const className = side === 'enemy' ? 'is-striking-left' : 'is-striking-right';
  actor.classList.remove('is-striking-left', 'is-striking-right');
  void actor.offsetWidth;
  actor.classList.add(className);
  setTimeout(() => actor.classList.remove(className), 560);
  return true;
}

function strikeSideFor(fx) {
  if (fx.some((item) => item?.kind === 'damage' && item.target === 'player')) return 'enemy';
  if (fx.some((item) => item?.kind === 'damage' && item.target === 'enemy')) return 'player';
  return null;
}

function applyBattleFx(fx = [], context = {}) {
  if (!fx.length) return;
  const layer = getFxLayer();
  if (layer && context.card) castCardFx(context.card, layer);
  const striker = context.attacker || strikeSideFor(fx);
  if (striker && strikeActor(striker)) {
    if (striker === 'player') audio.attack();
    else audio.enemyAttack();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => applyBattleFxItems(fx, context), reduced ? 0 : STRIKE_IMPACT_DELAY / battleSpeed());
    return;
  }
  applyBattleFxItems(fx, context);
}

function applyBattleFxItems(fx = [], context = {}) {
  const layer = getFxLayer();
  if (!layer) return;
  const cardColor = context.card ? (SCHOOLS[context.card.school]?.color || '#d2af74') : null;
  const sounds = new Set();
  // 这一批特效里最重的一下。用来决定要不要追加一记重击音，
  // 以及伤害数字要长到多大——反馈强度应该跟伤害成正比，而不是每下都一样响。
  let maxDealt = 0;
  fx.forEach((item, index) => {
    if (!item || !item.kind) return;
    if (item.kind === 'phase') {
      const battle = currentBattle();
      if (battle) presentBossPhase(battle, item);
      return;
    }
    if (item.kind === 'surge') {
      const battle = currentBattle();
      if (battle) presentBossSurge(battle, item);
      return;
    }
    if (item.kind === 'origin') {
      const battle = currentBattle();
      const target = qs('[data-float-target="player"]');
      if (target) {
        const float = document.createElement('span');
        float.className = 'battle-float battle-float--origin';
        float.textContent = `${item.name}！`;
        target.appendChild(float);
        setTimeout(() => float.remove(), 1400);
        if (layer) {
          const point = fxPoint(target, layer);
          if (point) {
            const burst = document.createElement('span');
            burst.className = 'origin-burst';
            burst.textContent = item.name;
            burst.style.left = `${point.x}px`;
            burst.style.top = `${point.y - 46}px`;
            burst.style.setProperty('--origin', battle?.player?.accent || '#d8b878');
            layer.appendChild(burst);
            setTimeout(() => burst.remove(), 1500);
          }
        }
      }
      sounds.add('buff');
      return;
    }
    const target = qs(`[data-float-target="${esc(item.target)}"]`);
    const rawAmount = Number(item.amount) || 0;
    const hpLoss = Number(item.hpLoss);
    const tracksHp = item.kind === 'damage' || item.kind === 'thorns';
    const dealt = tracksHp && Number.isFinite(hpLoss) ? Math.max(0, hpLoss) : rawAmount;
    const fullyBlocked = tracksHp && rawAmount > 0 && dealt <= 0;
    const isHit = dealt > 0;
    let label = '';
    if (item.kind === 'damage' || item.kind === 'poison' || item.kind === 'loseHp' || item.kind === 'burn' || item.kind === 'thorns') {
      label = dealt > 0 ? `-${dealt}` : (fullyBlocked ? '格挡' : '');
    } else if (item.kind === 'block') label = `+${item.amount} 格挡`;
    else if (item.kind === 'heal') label = `+${item.amount}`;
    else if (item.kind === 'draw') label = `抽 ${item.amount}`;
    else if (item.kind === 'energy') label = `+${item.amount} 能量`;
    else if (item.kind === 'gold') label = `+${item.amount} 金币`;
    else if (item.kind === 'status') label = `${STATUS_INFO[item.status]?.name || '状态'} ${item.amount}`;
    else if (item.kind === 'resonance') label = item.name || `${SCHOOLS[item.school]?.name || ''}共鸣 +${item.amount}`;
    if (!label || (rawAmount <= 0 && !fullyBlocked)) return;

    if (layer && target) {
      const point = fxPoint(target, layer);
      if (point) {
        if (item.kind === 'damage') {
          if (fullyBlocked) {
            blockFx(layer, point);
            shakeStage(false);
          } else {
            const color = item.target === 'player' ? '#d06a60' : (cardColor || '#e3c184');
            damageFx(layer, point, { target: item.target, hpLoss: dealt }, color);
          }
        } else if (item.kind === 'burn') {
          burnFx(layer, point);
        } else if (item.kind === 'thorns') {
          thornFx(layer, point);
        } else if (item.kind === 'poison') {
          poisonFx(layer, point);
        } else if (item.kind === 'block') {
          blockFx(layer, point);
        } else if (item.kind === 'heal') {
          healFx(layer, point);
        } else if (item.kind === 'status') {
          statusFx(layer, point, item);
        } else if (item.kind === 'loseHp') {
          damageFx(layer, point, { target: item.target, hpLoss: dealt }, '#c56d68');
        } else if (item.kind === 'resonance') {
          resonanceFx(layer, point, item);
        } else if (['draw', 'energy', 'gold'].includes(item.kind)) {
          smallMotesFx(layer, point, item.kind === 'gold' ? '#efd18a' : '#d8c38f');
        }
      }
    }

    if (target) {
      const float = document.createElement('span');
      // 伤害数字跟着伤害量一起长大：20 点以上加粗放大，32 点以上再上一档。
      // 数字如果每次都一样大，玩家就得读它才知道疼不疼；
      // 让它一眼就能读出量级，反馈才不需要翻译。
      const dmgTier = (item.kind === 'damage' || item.kind === 'loseHp') && dealt > 0
        ? (dealt >= 32 ? ' is-massive' : dealt >= 20 ? ' is-heavy' : '')
        : '';
      float.className = `battle-float battle-float--${fullyBlocked ? 'blocked' : item.kind}${dmgTier}`;
      float.textContent = label;
      float.style.setProperty('--float-index', index);
      target.appendChild(float);
      if (isHit && ['damage', 'poison', 'loseHp', 'burn', 'thorns'].includes(item.kind)) {
        target.classList.add('is-hit');
        setTimeout(() => target.classList.remove('is-hit'), 460);
      }
      setTimeout(() => float.remove(), 1100);
    }

    if (item.kind === 'damage' && !fullyBlocked) maxDealt = Math.max(maxDealt, dealt);
    if (item.kind === 'damage') sounds.add(fullyBlocked ? 'block' : (item.target === 'player' ? 'hurt' : 'hit'));
    else if (item.kind === 'block') sounds.add('block');
    else if (item.kind === 'heal') sounds.add('heal');
    else if (item.kind === 'draw') sounds.add('draw');
    else if (item.kind === 'energy') sounds.add('energy');
    else if (item.kind === 'gold') sounds.add('coin');
    else if (item.kind === 'status') sounds.add(STATUS_SFX[item.status] || 'buff');
    else if (item.kind === 'burn') sounds.add(item.target === 'player' ? 'hurt' : 'burn');
    else if (item.kind === 'thorns') sounds.add('thorns');
    else if (item.kind === 'poison') sounds.add('poison');
    else if (item.kind === 'loseHp') sounds.add(item.target === 'player' ? 'hurt' : 'hit');
    else if (item.kind === 'resonance') sounds.add('buff');
  });
  for (const sound of sounds) {
    if (typeof audio[sound] === 'function') audio[sound]();
  }
  // 重击额外叠一记低频，晚半拍进来——两次瞬态错开，
  // 耳朵读到的才是「砸下去」而不是「响了一下」。
  if (maxDealt >= 26 && typeof audio.hitHeavy === 'function') {
    setTimeout(() => audio.hitHeavy(), 40);
  }
}

function afterBattleAction(battle) {
  if (!battle) return;
  if (battle.phase === 'victory') setTimeout(() => audio.victory(), 280);
  if (battle.phase === 'defeat') {
    setTimeout(() => audio.defeat(), 280);
  }
}

function queueDefeatElegy(battle) {
  if (!battle || battle.mode !== 'adventure' || !G.run || battle.defeatElegyShown) return false;
  const storyId = battle.defeatRecap?.elegyId;
  if (!storyId) return false;
  battle.defeatElegyShown = true;
  modalQueue = [];
  markStorySeen(storyId);
  queueModal('story', { storyId, afterLabel: '回到梦的边缘' });
  advanceModalQueue();
  return true;
}

function playBattleCard(cardUid) {
  if (performance.now() < phaseCinemaUntil) return;
  const battle = currentBattle();
  if (!battle || battle.phase !== 'player') return;
  if (battle.lastStand?.offered && !battle.lastStand.resolved) return;
  const result = playCard(battle, cardUid);
  if (!result.ok) {
    showToast(result.error || '这张牌无法打出。', 'warning');
    return;
  }
  audio.card();
  render();
  requestAnimationFrame(() => applyBattleFx(result.fx, { card: result.card }));
  afterBattleAction(battle);
  saveRunNow();
}

function finishTurn() {
  if (performance.now() < phaseCinemaUntil) return;
  const battle = currentBattle();
  if (!battle || battle.phase !== 'player') return;
  if (battle.lastStand?.offered && !battle.lastStand.resolved) return;
  const result = endTurn(battle);
  if (!result.ok) return;
  render();
  requestAnimationFrame(() => applyBattleFx(result.fx));
  afterBattleAction(battle);
  saveRunNow();
}

function maybeOfferAwakening() {
  if (!G.run || G.screen !== 'map') return false;
  if (G.ui.modal?.type === 'awakening') return true;
  const offer = awakeningOffer(G.run);
  if (!offer) return false;
  openModal('awakening', { offer });
  return true;
}

function leaveNode() {
  const m = G.ui.modal;
  const data = m?.data || {};
  if (G.run && data.nodeId) completeNode(G.run, data.nodeId);
  G.ui.modal = null;
  G.ui.confirmAction = null;
  saveRunNow();
  if (maybeOfferAwakening()) return;
  render();
}

function enterNode(nodeId) {
  if (!G.run) return;
  if (maybeOfferAwakening()) return;
  const node = beginNode(G.run, nodeId);
  if (!node) {
    showToast('这条路径还没有与你的梦境相连。', 'warning');
    return;
  }
  // 环形/钟面允许回头，但走过的格子只负责通行：重复进店、重复开箱、
  // 重复打同一场普通战斗都会把梦变成提款机。已经结算过的节点不再触发内容。
  const shape = REGION_MAP[G.run.regionId]?.shape;
  if ((shape === 'ring' || shape === 'clock') && G.run.completed.includes(node.id)) {
    G.run.currentNodeId = node.id;
    G.run.pendingNodeId = null;
    saveRunNow();
    render();
    return;
  }
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    startAdventureBattle(node);
    saveRunNow();
    render();
    return;
  }
  if (node.type === 'event') {
    if (!Array.isArray(G.run.eventsSeen)) G.run.eventsSeen = [];
    const event = pickEventForRegion(G.run.regionId, G.run.eventsSeen);
    if (!event) {
      completeNode(G.run, node.id);
      showToast('这一页梦境没有留下任何东西。', 'default');
      render();
      return;
    }
    if (!G.run.eventsSeen.includes(event.id)) G.run.eventsSeen.push(event.id);
    openModal('event', { eventId: event.id, nodeId: node.id, result: null });
    return;
  }
  if (node.type === 'camp') {
    openModal('camp', { nodeId: node.id, mode: 'choose' });
    return;
  }
  if (node.type === 'shop') {
    openModal('shop', { nodeId: node.id, shop: createShop(G.run) });
    return;
  }
  if (node.type === 'treasure') {
    openModal('treasure', { nodeId: node.id, treasure: createTreasure(G.run) });
  }
}

function refreshEditorPreview() {
  const m = G.ui.modal;
  if (!m || m.type !== 'card-editor') return;
  const card = previewDraft(m.data.draft);
  const mount = qs('.editor-preview-mount', modalRoot);
  if (mount) {
    mount.innerHTML = cardMarkup(card, { tag: 'div', showFlavor: true, className: 'game-card--preview' });
  }
  const note = qs('.editor-preview__notes p', modalRoot);
  if (note) note.textContent = card.description;
}

function handleEditorField(target) {
  const m = G.ui.modal;
  if (!m || m.type !== 'card-editor') return;
  const field = target.dataset.editorField;
  const draft = m.data.draft;
  if (field === 'name') draft.name = target.value.slice(0, 12);
  else if (field === 'flavor') draft.flavor = target.value.slice(0, 34);
  else if (field === 'cost') {
    const value = Number(target.value);
    draft.cost = Number.isFinite(value) ? Math.max(0, Math.min(3, value)) : 0;
    if (Number(target.value) > 3) target.value = '3';
  } else if (field === 'type') {
    if (target.value === 'attack' || target.value === 'skill') draft.type = target.value;
  }
  refreshEditorPreview();
}

function handleEffectField(target) {
  const m = G.ui.modal;
  if (!m || m.type !== 'card-editor') return;
  const row = target.closest('[data-effect-index]');
  if (!row) return;
  const index = Number(row.dataset.effectIndex);
  const effect = m.data.draft.effects[index];
  if (!effect) return;
  const field = target.dataset.effectField;
  if (field === 'amount') {
    const value = Math.round(clamp(target.value, 0, 99));
    effect.amount = value;
    if (Number(target.value) > 99) target.value = '99';
    if (Number(target.value) < 0) target.value = '0';
  }
  if (field === 'hits') {
    const value = Math.round(clamp(target.value, 1, 9));
    effect.hits = value;
    if (Number(target.value) > 9) target.value = '9';
    if (Number(target.value) < 1) target.value = '1';
  }
  if (field === 'scale') {
    const value = Math.round(clamp(target.value, 1, 9));
    effect.scale = value;
    if (Number(target.value) > 9) target.value = '9';
    if (Number(target.value) < 1) target.value = '1';
  }
  if (field === 'threshold') {
    const value = Math.round(clamp(target.value, 5, 90));
    effect.threshold = value / 100;
    if (Number(target.value) > 90) target.value = '90';
    if (Number(target.value) < 5) target.value = '5';
  }
  refreshEditorPreview();
}

function handleEffectKind(target) {
  const m = G.ui.modal;
  if (!m || m.type !== 'card-editor') return;
  const row = target.closest('[data-effect-index]');
  if (!row) return;
  const index = Number(row.dataset.effectIndex);
  const effect = m.data.draft.effects[index];
  if (!effect) return;
  const amount = Number(effect.amount) || null;
  m.data.draft.effects[index] = makeEffect(target.value, amount);
  refreshModal();
  refreshEditorPreview();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // WebView 或非安全上下文可能没有剪贴板权限，退回旧式复制。
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

function handleOnlineField(target) {
  const field = target.dataset.onlineField;
  if (field === 'name') {
    G.profile.online.name = target.value.slice(0, 16);
    saveProfileDebounced(400);
    return;
  }
  if (field === 'server') {
    G.profile.online.serverUrl = target.value.slice(0, 300);
    saveProfileDebounced(500);
    return;
  }
  if (field === 'joinCode') {
    const cleaned = target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (target.value !== cleaned) target.value = cleaned;
    G.ui.online.joinCode = cleaned;
  }
}

function handleInput(target) {
  if (target.matches('[data-run-seed]')) {
    G.ui.seedInput = target.value.slice(0, 40);
    return;
  }
  if (target.matches('[data-pile-search]')) {
    const m = G.ui.modal;
    if (m?.type !== 'pile-view') return;
    m.data.q = target.value.slice(0, 40);
    const results = qs('[data-pile-results]', modalRoot);
    if (results) results.innerHTML = pileResultsMarkup(m);
    return;
  }
  if (target.matches('[data-online-field]')) {
    handleOnlineField(target);
    return;
  }
  if (target.matches('[data-editor-field]')) {
    handleEditorField(target);
    return;
  }
  if (target.matches('[data-effect-field]')) {
    handleEffectField(target);
    return;
  }
  if (target.matches('[data-gen-prompt]')) {
    const m = G.ui.modal;
    if (m?.type === 'generate') m.data.subject = target.value.slice(0, 600);
    return;
  }
  if (target.matches('[data-audio-volume]')) {
    handleAudioVolume(target);
    return;
  }
  if (target.matches('[data-image-range]')) {
    const m = G.ui.modal;
    if (m?.type !== 'image-editor' || m.data.busy) return;
    const field = target.dataset.imageRange === 'feather' ? 'feather' : 'tolerance';
    m.data.settings[field] = Math.round(Number(target.value) || 0);
    const label = qs(`[data-image-value="${field}"]`, modalRoot);
    if (label) label.textContent = String(m.data.settings[field]);
    paintImageEditor();
    return;
  }
  if (target.matches('[data-ai-field]')) {
    const field = target.dataset.aiField;
    if (['baseUrl', 'apiKey', 'model'].includes(field)) {
      G.profile.ai[field] = target.value.slice(0, field === 'apiKey' ? 400 : 300);
      saveProfileDebounced();
    }
    return;
  }
  if (target.matches('[data-hero-name]')) {
    G.profile.name = target.value.slice(0, 16);
    saveProfileDebounced();
    return;
  }
  if (target.matches('[data-enemy-name]')) {
    const enemyId = target.dataset.id;
    if (!ENEMY_MAP[enemyId]) return;
    const name = target.value.trim().slice(0, 14);
    const existing = G.profile.enemySkins[enemyId] || {};
    G.profile.enemySkins[enemyId] = { ...existing, name: name || undefined };
    saveProfileDebounced();
  }
}

function handleChange(target) {
  if (target.matches('[data-online-field="enemy"]')) {
    if (ENEMY_MAP[target.value]) G.ui.online.enemyId = target.value;
    render();
    return;
  }
  if (target.matches('[data-online-field="name"]') || target.matches('[data-online-field="server"]')) {
    handleOnlineField(target);
    saveProfileNow();
    return;
  }
  if (target.matches('[data-effect-kind]')) {
    handleEffectKind(target);
    return;
  }
  if (target.matches('[data-image-toggle]')) {
    const m = G.ui.modal;
    if (m?.type !== 'image-editor' || m.data.busy) return;
    m.data.settings.removeBg = target.checked;
    paintImageEditor();
    return;
  }
  if (target.matches('[data-hero-name]')) {
    G.profile.name = target.value.trim().slice(0, 16) || '无名旅者';
    saveProfileNow();
    return;
  }
  if (target.matches('[data-enemy-name]')) {
    const enemyId = target.dataset.id;
    if (!ENEMY_MAP[enemyId]) return;
    const name = target.value.trim().slice(0, 14);
    const existing = G.profile.enemySkins[enemyId] || {};
    if (name) G.profile.enemySkins[enemyId] = { ...existing, name };
    else {
      const { name: ignored, ...rest } = existing;
      if (rest.image) G.profile.enemySkins[enemyId] = rest;
      else delete G.profile.enemySkins[enemyId];
    }
    saveProfileNow();
    return;
  }
  if (target.matches('[data-audio-volume]')) {
    saveProfileNow();
    return;
  }
  if (target.matches('[data-ai-field]')) {
    saveProfileNow();
  }
}

function updateCardArtProgress(job) {
  const bar = document.querySelector('.artforge-progress__bar i');
  const text = document.querySelector('.artforge-progress__text');
  if (!bar || !text) return;
  const done = job.done + job.failed;
  bar.style.width = `${job.total ? Math.round((done / job.total) * 100) : 0}%`;
  text.textContent = `正在生成「${job.current}」 · ${done}/${job.total}${job.failed ? ` · 失败 ${job.failed}` : ''}`;
}

async function runCardArtJob({ only = null, force = false } = {}) {
  if (!String(G.profile.ai.baseUrl || '').trim()) {
    showToast('先在「AI 生图」里填写自己的接口地址与密钥。', 'warning');
    return;
  }
  const all = Object.values(CARD_MAP);
  const list = only
    ? all.filter((card) => card.id === only)
    : all.filter((card) => force || !peekCardArt(card.id));
  if (!list.length) {
    showToast('所有卡面都已生成，没有需要重绘的牌。', 'default');
    return;
  }
  const job = { running: true, total: list.length, done: 0, failed: 0, current: '', lastError: '' };
  G.ui.cardArtJob = job;
  refreshModal();
  for (const def of list) {
    job.current = def.name;
    updateCardArtProgress(job);
    try {
      const dataUrl = await generateCardArtWithConfig({ card: resolveCard(def), config: G.profile.ai || {} });
      if (!dataUrl) throw new Error('生成结果为空。');
      await saveCardArt(def.id, dataUrl);
      job.done += 1;
    } catch (error) {
      job.failed += 1;
      job.lastError = error?.message || '生成失败。';
    }
  }
  job.running = false;
  job.current = '';
  refreshModal();
  render();
  showToast(
    job.failed ? `生成结束：成功 ${job.done} 张，失败 ${job.failed} 张。` : `已生成 ${job.done} 张卡面。`,
    job.failed ? 'warning' : 'success',
  );
}

async function handleAction(action, el) {
  switch (action) {
    case 'close-modal':
      attemptCloseModal();
      return;
    case 'confirm-accept': {
      const fn = G.ui.confirmAction;
      G.ui.modal = null;
      G.ui.confirmAction = null;
      if (typeof fn === 'function') await fn();
      render();
      return;
    }
    case 'continue-run': {
      if (!G.run) {
        showToast('没有可以继续的旅程。', 'warning');
        render();
        return;
      }
      G.screen = G.run.battle ? 'battle' : 'map';
      render();
      return;
    }
    case 'open-guide':
      openModal('guide');
      return;
    case 'toggle-mute': {
      G.profile.settings.muted = !G.profile.settings.muted;
      audio.setMuted(G.profile.settings.muted);
      saveProfileNow();
      showToast(G.profile.settings.muted ? '声音沉入了梦里。' : '梦重新有了声音。', 'default');
      render();
      return;
    }
    case 'set-font-size': {
      const size = ['small', 'normal', 'large'].includes(el.dataset.size) ? el.dataset.size : 'normal';
      G.profile.settings.fontSize = size;
      applyFontSetting();
      saveProfileNow();
      showToast(`界面字号已切换为${size === 'small' ? '小' : size === 'large' ? '大' : '标准'}。`, 'default');
      render();
      return;
    }
    case 'toggle-fullscreen': {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (error) {
        showToast('这台设备不允许切换全屏。', 'warning');
      }
      saveProfileNow();
      return;
    }
    case 'open-origins':
      G.ui.endlessPick = false;
      G.ui.originChoice = G.profile.originId;
      setScreen('origins');
      render();
      return;
    case 'toggle-ng-plus':
      G.ui.ngPlus = !G.ui.ngPlus;
      render();
      showToast(G.ui.ngPlus ? '二周目已开启：敌人 +15% 生命、+1 攻击。' : '已关闭二周目。', 'default');
      return;
    case 'open-endless':
      G.ui.endlessPick = true;
      G.ui.originChoice = G.profile.originId;
      setScreen('origins');
      render();
      showToast('无尽回廊：每清空一座岛就往下沉一层，直到梦把你留下。', 'default');
      return;
    case 'open-world':
      enterWorld();
      return;
    case 'world-menu':
      setScreen('menu');
      render();
      return;
    case 'back-world':
      G.ui.worldIsland = G.profile.world.lastRegion;
      setScreen('world');
      render();
      return;
    case 'back-menu':
    case 'sandbox-back':
      setScreen('menu');
      render();
      return;
    case 'world-select':
      if (REGION_MAP[el.dataset.id]) {
        G.ui.worldIsland = el.dataset.id;
        render();
      }
      return;
    case 'world-trophy': {
      const world = G.profile.world;
      const cardId = el.dataset.id || '';
      if (!cardId) world.trophyCard = null;
      else if (trophyOptions(world).some((card) => card.id === cardId)) world.trophyCard = cardId;
      saveProfileNow();
      showToast(world.trophyCard ? '纪念牌已被放进下一次远征的牌组。' : '下一次远征将轻装上路。', 'default');
      render();
      return;
    }
    case 'region-start': {
      const region = REGION_MAP[el.dataset.id];
      if (!region) return;
      if (!isRegionUnlocked(G.profile.world, region.id)) {
        showToast('这座岛还在雾里。先完成更多远征。', 'warning');
        return;
      }
      G.ui.regionChoice = region.id;
      G.ui.originChoice = G.profile.originId;
      G.ui.worldIsland = region.id;
      G.ui.endlessPick = false;
      setScreen('origins');
      render();
      return;
    }
    case 'talk-npc':
      openNpcTalk(el.dataset.id);
      return;
    case 'npc-next':
      if (G.ui.modal?.type === 'npc') openNpcTalk(G.ui.modal.data.npcId);
      return;
    case 'npc-dialogue':
      if (G.ui.modal?.type === 'npc') openDialogue(G.ui.modal.data.npcId);
      return;
    case 'dlg-choice': {
      const m = G.ui.modal;
      if (m?.type !== 'dialogue') return;
      const step = dialogueNext(m.data.dialogueId, m.data.nodeId, el.dataset.id);
      if (!step) return;
      const world = G.profile.world;
      // 先把当前节点的效果结掉，再走进下一句。
      const currentNode = DIALOGUES[m.data.dialogueId]?.nodes?.[m.data.nodeId];
      if (currentNode) {
        const result = applyDialogueEffect(world, { ...currentNode, npc: m.data.npcId });
        if (result.reward?.gold) {
          G.profile.gold = (G.profile.gold || 0) + result.reward.gold;
        }
        if (result.reward?.heal && G.run) {
          G.run.hp = Math.min(G.run.maxHp, G.run.hp + result.reward.heal);
          saveRunNow();
        }
      }
      if (step.choice.flag) world.dialogues.flags[step.choice.flag] = true;
      if (!step.nodeId) {
        m.data.ended = true;
        m.seq = ++modalSeq;
        saveProfileNow();
        refreshModal();
        return;
      }
      markDialogueNode(world, m.data.npcId, step.nodeId);
      m.data.nodeId = step.nodeId;
      m.data.ended = false;
      m.seq = ++modalSeq;
      saveProfileNow();
      refreshModal();
      audio.click();
      return;
    }
    case 'dlg-continue': {
      const m = G.ui.modal;
      if (m?.type !== 'dialogue') return;
      const node = DIALOGUES[m.data.dialogueId]?.nodes?.[m.data.nodeId];
      if (!node?.next) return;
      const world = G.profile.world;
      if (node.effect) {
        const result = applyDialogueEffect(world, { ...node, npc: m.data.npcId });
        if (result.reward?.gold) G.profile.gold = (G.profile.gold || 0) + result.reward.gold;
        if (result.reward?.heal && G.run) {
          G.run.hp = Math.min(G.run.maxHp, G.run.hp + result.reward.heal);
          saveRunNow();
        }
      }
      m.data.nodeId = node.next;
      m.data.ended = !DIALOGUES[m.data.dialogueId]?.nodes?.[node.next]?.choices?.length
        && !DIALOGUES[m.data.dialogueId]?.nodes?.[node.next]?.next;
      m.seq = ++modalSeq;
      saveProfileNow();
      refreshModal();
      audio.click();
      return;
    }
    case 'dlg-close': {
      const m = G.ui.modal;
      if (m?.type === 'dialogue') {
        // 只关窗不算聊过：没走到尽头的人，下次还能接着开口。
        const last = DIALOGUES[m.data?.dialogueId]?.nodes?.[m.data?.nodeId];
        const reachedEnd = Boolean(m.data?.ended) || (!last?.choices?.length && !last?.next);
        if (reachedEnd) {
          const world = G.profile.world;
          // 用「入口节点」做记号，pendingDialogue 查的就是这个键。
          const entry = DIALOGUES[m.data.dialogueId]?.entry;
          if (entry) markDialogueNode(world, m.data.npcId, entry);
        }
        saveProfileNow();
        closeModalIntoQueue();
      }
      return;
    }
    case 'open-quests':
      openModal('quests');
      return;
    case 'open-codex':
      openModal('codex');
      return;
    case 'codex-tab': {
      const m = G.ui.modal;
      if (m?.type !== 'codex') return;
      const tab = el.dataset.tab;
      if (!['endings', 'bestiary', 'relics'].includes(tab)) return;
      m.data = { ...(m.data || {}), tab };
      m.seq = ++modalSeq;
      refreshModal();
      return;
    }
    case 'open-keywords':
      openModal('keywords');
      return;
    case 'open-achievements':
      openModal('achievements');
      return;
    case 'open-save-backup':
      openModal('save-backup');
      return;
    case 'view-pile': {
      const battle = currentBattle();
      if (!battle) return;
      openModal('pile-view', { pile: el.dataset.pile || 'draw' });
      return;
    }
    case 'pile-filter': {
      const m = G.ui.modal;
      if (m?.type !== 'pile-view') return;
      const field = el.dataset.field;
      if (!['school', 'type', 'cost'].includes(field)) return;
      const value = el.dataset.value || '';
      m.data[field] = m.data[field] === value ? '' : value;
      refreshModal();
      return;
    }
    case 'pile-clear': {
      const m = G.ui.modal;
      if (m?.type !== 'pile-view') return;
      m.data.q = '';
      m.data.school = '';
      m.data.type = '';
      m.data.cost = '';
      refreshModal();
      return;
    }
    case 'select-ascension': {
      const level = Math.max(0, Math.min(MAX_ASCENSION, Math.floor(Number(el.dataset.level) || 0)));
      if (level > (Number(G.profile.ascensionUnlocked) || 0)) {
        showToast(`完成层级 ${level - 1} 的远征后解锁「${ascensionLevel(level).name}」。`, 'warning');
        return;
      }
      G.ui.ascensionChoice = level;
      render();
      return;
    }
    case 'start-daily': {
      const battle = startDailyBattle();
      if (!battle) {
        showToast('今日的梦没有翻开，请稍后再试。', 'danger');
        return;
      }
      audio.buff();
      render();
      return;
    }
    case 'daily-return':
      G.sandboxBattle = null;
      G.ui.modal = null;
      if (G.run?.battle) setScreen('battle');
      else if (G.run) setScreen('map');
      else setScreen('menu');
      render();
      return;
    case 'export-save':
      exportSaveBackup();
      return;
    case 'import-save':
      saveInput?.click();
      return;
    case 'select-origin':
      G.ui.originChoice = el.dataset.id || 'blade';
      render();
      return;
    case 'random-seed':
      G.ui.seedInput = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      render();
      return;
    case 'copy-seed': {
      const seed = G.run?.seed;
      if (!seed) return;
      const copied = await copyText(seed);
      showToast(copied ? `种子已复制：${seed}` : `本次种子：${seed}`, copied ? 'success' : 'default');
      return;
    }
    case 'start-adventure': {
      const begin = () => {
        const seed = String(G.ui.seedInput || '').trim().slice(0, 40);
        if (G.ui.endlessPick) {
          startEndless(G.ui.originChoice || G.profile.originId);
          G.ui.endlessPick = false;
        } else {
          startAdventure(G.ui.originChoice || G.profile.originId, G.ui.regionChoice, {
            ascension: G.ui.ascensionChoice,
            seed: seed || undefined,
          });
        }
        saveRunNow();
        audio.buff();
        render();
        if (G.ui.ngPlus && G.run && !G.run.endless) {
          G.run.ngPlus = true;
          G.run.ngPlusMods = { enemyHpScale: 1.15, enemyBonusDamage: 1 };
          saveRunNow();
          if (!G.profile.world.storySeen.includes('ng-plus')) {
            markStorySeen('ng-plus');
            openModal('story', { storyId: 'ng-plus' });
          } else {
            showToast('二周目：敌人更硬，路更熟。', 'default');
          }
        } else if (!G.ui.endlessPick && G.run && !G.profile.world.storySeen.includes('departure')) {
          markStorySeen('departure');
          openModal('story', { storyId: 'departure' });
        }
      };
      if (G.run && G.run.status === 'active') {
        openConfirm({
          eyebrow: 'ABANDON THE CURRENT DREAM',
          title: '要放弃当前旅程吗？',
          message: '开始新的远征会覆盖正在进行的那段梦，当前进度无法找回。',
          confirmLabel: '放弃并开始新远征',
          tone: 'danger',
        }, begin);
        return;
      }
      begin();
      return;
    }
    case 'story-advance': {
      const m = G.ui.modal;
      const story = m?.type === 'story' ? STORIES[m.data.storyId] : null;
      if (!story) return;
      const lines = storyLines(story.id, G.run?.originId || G.profile.originId);
      if ((m.data.index || 0) < lines.length - 1) {
        m.data.index = (m.data.index || 0) + 1;
        m.seq = ++modalSeq;
        refreshModal();
        return;
      }
      closeModalIntoQueue();
      return;
    }
    case 'story-skip':
      if (G.ui.modal?.type === 'story') closeModalIntoQueue();
      return;
    case 'quest-claim': {
      const questId = G.ui.modal?.data?.questId;
      const quest = QUEST_MAP[questId];
      closeModalIntoQueue();
      if (quest) showToast('纪念牌已被群岛记住。', 'success');
      audio.coin();
      return;
    }
    case 'finale-choice': {
      const ending = resolveFinalEnding(el.dataset.id);
      if (!ending) {
        showToast('你与岛上的人还没有走到能选择这一步的地方。', 'warning');
        return;
      }
      audio.victory();
      render();
      return;
    }
    case 'ending-world':
      leaveEndingToWorld();
      saveRunNow();
      enterWorld();
      return;
    case 'ending-again':
      startAdventure(G.profile.originId, G.profile.world.lastRegion);
      saveRunNow();
      render();
      return;
    case 'ending-menu':
      finishRunAndLeave();
      saveRunNow();
      render();
      return;
    case 'open-sandbox':
      setScreen('sandbox');
      render();
      return;
    case 'open-online':
      if (document.querySelector('meta[name="cardrealm-online"]')?.content === 'off') return;
      setScreen('online');
      render();
      return;
    case 'online-back':
      setScreen('menu');
      render();
      return;
    case 'online-mode':
      G.ui.online.mode = el.dataset.id === 'coop' ? 'coop' : 'pvp';
      render();
      return;
    case 'online-origin':
      if (ORIGIN_MAP[el.dataset.id]) {
        G.ui.online.originId = el.dataset.id;
        render();
      }
      return;
    case 'online-create':
      onlineCreate();
      render();
      return;
    case 'online-join':
      onlineJoin();
      render();
      return;
    case 'online-cancel':
      onlineCancelConnect();
      render();
      return;
    case 'online-leave':
      onlineLeave();
      render();
      return;
    case 'online-start':
      onlineStart();
      render();
      return;
    case 'online-play':
      onlinePlay(el.dataset.uid);
      return;
    case 'online-end':
      onlineEndTurn();
      return;
    case 'online-rematch':
      onlineRematch();
      render();
      return;
    case 'online-copy-code': {
      const code = getOnline().code;
      if (!code) return;
      const copied = await copyText(code);
      showToast(copied ? '房间码已复制。' : `房间码：${code}`, copied ? 'success' : 'default');
      return;
    }
    case 'online-exit': {
      const on = getOnline();
      if (on.status !== 'battle') {
        onlineLeave();
        render();
        return;
      }
      openConfirm({
        eyebrow: 'LEAVE THE DREAM',
        title: '要离开这场双人梦境吗？',
        message: '离开后房间会结束，对方会收到你已离开的消息。这一局不会被记录。',
        tone: 'danger',
        confirmLabel: '离开房间',
      }, () => {
        onlineLeave();
        render();
      });
      return;
    }
    case 'open-deckbuilder':
      G.ui.deckFilter = 'all';
      setScreen('deckbuilder');
      render();
      return;
    case 'deckbuilder-back':
      setScreen('sandbox');
      render();
      return;
    case 'deck-filter':
      G.ui.deckFilter = el.dataset.filter || 'all';
      render();
      return;
    case 'deck-add': {
      if (addCardToSandbox(el.dataset.id)) {
        audio.draw();
        render();
      }
      return;
    }
    case 'deck-remove':
      if (removeCardFromSandbox(el.dataset.id)) render();
      return;
    case 'deck-reset':
      openConfirm({
        eyebrow: 'RESET THE TRIAL DECK',
        title: '重置试炼牌组？',
        message: '牌组会恢复为当前起源的初始十张牌。你铸造的卡牌不会消失。',
        confirmLabel: '重置牌组',
      }, () => {
        resetSandboxDeck();
        showToast('试炼牌组已恢复如初。', 'success');
        render();
      });
      return;
    case 'start-sandbox-battle': {
      const enemyId = el.dataset.id;
      G.ui.selectedEnemyId = ENEMY_MAP[enemyId] ? enemyId : ENEMIES[0].id;
      const result = startSandboxBattle(G.ui.selectedEnemyId);
      if (result?.error) {
        showToast(result.error, 'warning');
        return;
      }
      audio.buff();
      render();
      return;
    }
    case 'open-studio': {
      if (G.screen !== 'studio') G.studioReturn = G.screen;
      G.ui.studioTab = el.dataset.tab || 'hero';
      if (ENEMY_MAP[el.dataset.enemyId]) G.ui.selectedEnemyId = el.dataset.enemyId;
      setScreen('studio');
      render();
      return;
    }
    case 'studio-back':
      setScreen(G.studioReturn || 'menu');
      render();
      return;
    case 'studio-tab':
      G.ui.studioTab = el.dataset.tab || 'hero';
      render();
      return;
    case 'upload-audio':
      startAudioUpload(el.dataset.kind === 'music' ? 'music' : 'sfx', el.dataset.slot);
      return;
    case 'preview-sfx':
      audio.previewSfx(el.dataset.slot);
      return;
    case 'preview-music':
      await previewCustomMusic(el.dataset.slot);
      return;
    case 'reset-audio':
      resetAudioSlot(el.dataset.kind === 'music' ? 'music' : 'sfx', el.dataset.slot);
      return;
    case 'reset-audio-all':
      openConfirm({
        eyebrow: 'SILENCE THE CUSTOM DREAM',
        title: '归还所有自定义梦声？',
        message: '所有上传的音效与背景音乐都会从本机删除，音量恢复到 80% / 90%。内置声音不会受影响。这个动作无法撤回。',
        tone: 'danger',
        confirmLabel: '全部还原',
      }, () => {
        resetAllCustomAudio();
      });
      return;
    case 'select-enemy':
      if (ENEMY_MAP[el.dataset.id]) G.ui.selectedEnemyId = el.dataset.id;
      render();
      return;
    case 'studio-origin': {
      const originId = el.dataset.id;
      if (!originId) return;
      G.profile.originId = originId;
      saveProfileNow();
      showToast('新的起源已被写入梦境。', 'success');
      render();
      return;
    }
    case 'reset-hero':
      setHeroAvatar(null);
      showToast('你恢复成了最初的模样。', 'default');
      render();
      return;
    case 'reset-enemy-skin': {
      const enemyId = el.dataset.id;
      if (G.profile.enemySkins[enemyId]) {
        delete G.profile.enemySkins[enemyId];
        saveProfileNow();
        showToast('梦魇恢复成了原本的形态。', 'default');
      }
      render();
      return;
    }
    case 'upload-hero':
      startUpload('hero');
      return;
    case 'upload-enemy':
      startUpload('enemy', el.dataset.enemyId);
      return;
    case 'open-feedback':
      openModal('feedback', {});
      return;
    case 'set-ai-provider':
      G.profile.ai.provider = 'openai';
      saveProfileNow();
      render();
      return;
    case 'clear-api-key':
      G.profile.ai.apiKey = '';
      saveProfileNow();
      showToast('API Key 已从本机档案中清除。', 'default');
      render();
      return;
    case 'open-ai-settings':
      if (G.ui.modal?.data?.busy) return;
      G.studioReturn = G.screen;
      G.ui.studioTab = 'ai';
      G.ui.modal = null;
      G.ui.confirmAction = null;
      setScreen('studio');
      render();
      return;
    case 'new-custom-card':
      openCardEditor(null);
      return;
    case 'edit-custom-card':
      openCardEditor(el.dataset.id);
      return;
    case 'set-card-glyph': {
      const m = G.ui.modal;
      if (m?.type !== 'card-editor') return;
      m.data.draft.glyph = el.dataset.glyph || '梦';
      refreshModal();
      return;
    }
    case 'set-card-palette': {
      const m = G.ui.modal;
      if (m?.type !== 'card-editor') return;
      m.data.draft.palette = el.dataset.color;
      refreshModal();
      return;
    }
    case 'set-card-school': {
      const m = G.ui.modal;
      if (m?.type !== 'card-editor' || !SCHOOLS[el.dataset.id]) return;
      m.data.draft.school = el.dataset.id;
      m.seq = ++modalSeq;
      refreshModal();
      return;
    }
    case 'add-effect': {
      const m = G.ui.modal;
      if (m?.type !== 'card-editor') return;
      if (m.data.draft.effects.length >= 6) {
        showToast('一张牌最多容纳 6 条效果。再多，梦会记不住。', 'warning');
        return;
      }
      m.data.draft.effects.push(makeEffect('damage', 6));
      refreshModal();
      return;
    }
    case 'remove-effect': {
      const m = G.ui.modal;
      if (m?.type !== 'card-editor') return;
      m.data.draft.effects.splice(Number(el.dataset.index), 1);
      refreshModal();
      return;
    }
    case 'save-custom-card':
      saveDraftCard();
      return;
    case 'delete-custom-card':
      deleteDraftCard();
      return;
    case 'open-generate': {
      if (el.dataset.kind === 'enemy') {
        const enemyId = el.dataset.enemyId || G.ui.selectedEnemyId;
        openGenerateModal('enemy', enemyId, el.dataset.style || null);
      } else {
        openGenerateModal('hero', null, el.dataset.style || null);
      }
      return;
    }
    case 'gen-style': {
      const m = G.ui.modal;
      if (m?.type !== 'generate') return;
      const prompt = qs('[data-gen-prompt]', modalRoot);
      if (prompt) m.data.subject = prompt.value.slice(0, 600);
      m.data.style = el.dataset.id || 'dark';
      G.profile.ai.lastStyle = m.data.style;
      saveProfileDebounced(400);
      refreshModal();
      return;
    }
    case 'run-generation':
      await runGeneration();
      return;
    case 'pick-upload':
      closeModal(true);
      startUpload(el.dataset.target === 'enemy' ? 'enemy' : 'hero', el.dataset.enemyId);
      return;
    case 'image-apply':
      await applyImageEditor();
      return;
    case 'image-auto-fit': {
      const m = G.ui.modal;
      if (!m || m.type !== 'image-editor' || m.data.busy) return;
      m.data.settings.crop = computeContentBounds(m.data.source.frames[0], m.data.settings);
      paintImageEditor();
      showToast('选框已贴合画面主体。', 'default');
      return;
    }
    case 'image-reset-crop': {
      const m = G.ui.modal;
      if (!m || m.type !== 'image-editor' || m.data.busy) return;
      m.data.settings.crop = { x: 0, y: 0, w: 1, h: 1 };
      paintImageEditor();
      return;
    }
    case 'image-pick-color': {
      const m = G.ui.modal;
      if (!m || m.type !== 'image-editor' || m.data.busy) return;
      m.data.picking = !m.data.picking;
      syncImageEditorControls();
      return;
    }
    case 'mulligan-hand': {
      const battle = currentBattle();
      if (!battle) return;
      const result = mulliganOpeningHand(battle);
      if (!result.ok) {
        showToast(result.message, 'warning');
        return;
      }
      audio.draw();
      showToast(`重新调度了 ${result.count} 张起手牌。`, 'success');
      render();
      saveRunNow();
      return;
    }
    case 'play-card':
      playBattleCard(el.dataset.uid);
      return;
    case 'use-item': {
      const battle = currentBattle();
      if (!battle) return;
      const result = useItem(battle, el.dataset.item);
      if (!result.ok) {
        showToast(result.error || '这件道具现在用不了。', 'warning');
        return;
      }
      if (result.item.effects?.some((effect) => effect.type === 'heal' || effect.type === 'maxHp')) audio.heal();
      else audio.buff();
      showToast(`你使用了【${result.item.name}】。`, 'success');
      render();
      requestAnimationFrame(() => applyBattleFx(result.fx));
      afterBattleAction(battle);
      saveRunNow();
      return;
    }
    case 'open-parley': {
      const battle = currentBattle();
      if (!battle || battle.parley || !parleyProfile(battle)) return;
      openModal('parley', {});
      return;
    }
    case 'parley-approach': {
      const battle = currentBattle();
      const m = G.ui.modal;
      if (!battle || m?.type !== 'parley' || m.data?.result) return;
      const result = resolveParley(battle, el.dataset.id);
      if (!result.ok) {
        showToast(result.message || '对方没有回应。', 'warning');
        return;
      }
      m.data.result = result;
      m.seq = ++modalSeq;
      saveRunNow();
      if (result.success) audio.buff();
      else {
        audio.debuff();
        setTimeout(() => audio.phase(), 180);
      }
      refreshModal();
      requestAnimationFrame(() => applyBattleFx(battle.parleyFx || []));
      return;
    }
    case 'close-parley':
      G.ui.modal = null;
      G.ui.confirmAction = null;
      saveRunNow();
      render();
      return;
    case 'end-turn':
      finishTurn();
      return;
    case 'battle-exit': {
      const battle = currentBattle();
      if (!battle) return;
      if (battle.noRetreat) {
        showToast('行商把门从外面锁上了。这一战没有退路。', 'danger');
        return;
      }
      if (battle.mode === 'sandbox') {
        G.sandboxBattle = null;
        G.ui.modal = null;
        setScreen('sandbox');
        render();
        return;
      }
      const owesBreath = Boolean(battle.lastStand?.costPending);
      openConfirm({
        eyebrow: 'LEAVE THE DREAM',
        title: '要离开这场梦吗？',
        message: owesBreath
          ? '你向梦借过一口气。撤退会保留当前生命，但生命上限 -5 会立刻刻成一道梦痕；这段梦境不会算作完成。'
          : '撤退会保留当前生命，但这段梦境不会算作完成。你仍可以继续走向下一层。',
        confirmLabel: owesBreath ? '带着梦痕撤退' : '从梦中撤退',
      }, () => {
        leaveBattleEarly();
        saveRunNow();
        showToast('你从梦境中撤退了。', 'warning');
        render();
      });
      return;
    }
    case 'last-stand-accept':
    case 'last-stand-decline': {
      const battle = currentBattle();
      if (!battle) return;
      const accept = action === 'last-stand-accept';
      const result = resolveLastStand(battle, accept);
      if (!result.ok) {
        showToast(result.message || '梦没有再问第二次。', 'warning');
        return;
      }
      audio.buff();
      showToast(
        accept ? '你向梦借了一口气。代价会在梦结束时找上门。' : '你没有低头。梦退开半步，重新看着你。',
        accept ? 'warning' : 'default',
      );
      render();
      requestAnimationFrame(() => applyBattleFx(result.fx || []));
      saveRunNow();
      return;
    }
    case 'defeat-elegy': {
      const battle = currentBattle();
      if (!battle || battle.phase !== 'defeat') return;
      if (!queueDefeatElegy(battle)) {
        showToast('这一页已经写完了。', 'default');
      }
      return;
    }
    case 'restart-battle': {
      const battle = currentBattle();
      if (!battle) return;
      if (!battle.setup) {
        showToast('这一场无法重新开始。', 'warning');
        return;
      }
      if (battle.noRetreat) {
        showToast('这一战没有退路，不能重来。', 'danger');
        return;
      }
      if (battle.lastStand?.costPending) {
        showToast('你已经向梦借了一口气。这笔债要等这场梦结束才能算。', 'danger');
        return;
      }
      openConfirm({
        eyebrow: 'RESTART THE BATTLE',
        title: '要重新开始这一场吗？',
        message: '手牌与生命都会回到这一战开始时的样子，敌人也重新来过。',
        confirmLabel: '重新开始',
      }, () => {
        const fresh = restartBattle();
        if (!fresh) {
          showToast('重新开始失败了。', 'warning');
          return;
        }
        audio.buff();
        showToast('这一场梦重新开始了。', 'default');
        render();
      });
      return;
    }
    case 'choose-reward': {
      const cardId = el.dataset.id;
      const result = claimBattleReward(cardId);
      if (!result.ok) return;
      saveRunNow();
      const card = getCardDef(cardId);
      showToast(card ? `【${card.name}】加入了牌组。` : '战利品已收好。', 'success');
      audio.coin();
      render();
      maybeOfferAwakening();
      return;
    }
    case 'skip-reward': {
      const merchantFight = currentBattle()?.tier === 'merchant';
      const result = claimBattleReward(null);
      if (!result.ok) return;
      saveRunNow();
      showToast(merchantFight ? '你从柜台后走出，货箱已经见底。' : '你没有选择卡牌，但前路仍在前方。', merchantFight ? 'success' : 'default');
      render();
      maybeOfferAwakening();
      return;
    }
    case 'finish-adventure': {
      const summary = finishAdventure();
      if (!summary) return;
      saveRunNow();
      if (summary.endless) {
        audio.victory();
        render();
        const affixText = (summary.affixes || []).map((item) => item.name).join('、');
        showToast(`第 ${summary.cleared} 层已平 · 沉入第 ${summary.depth} 层「${summary.regionName}」· 生命 +${summary.heal}${affixText ? ` · 词缀：${affixText}` : ''}`, 'success');
        return;
      }
      const world = G.profile.world;
      G.ui.worldIsland = summary.regionId;
      G.ui.regionChoice = summary.regionId;
      audio.victory();
      if (summary.final) {
        G.ui.endingId = null;
        saveProfileNow();
        render();
        openModal('finale', { summary });
        return;
      }
      const { newlyUnlocked, completedQuests } = refreshWorld(world);
      modalQueue = [];
      if (summary.storyId) {
        markStorySeen(summary.storyId);
        queueModal('story', { storyId: summary.storyId });
      }
      for (const storyId of summary.parleyStoryIds || []) {
        if (world.storySeen.includes(storyId)) continue;
        markStorySeen(storyId);
        queueModal('story', { storyId });
      }
      if (summary.parleyUnlockedEnding) {
        showToast('交涉的记忆汇成了新的选择：隐藏结局「说出口的岸」已解锁。', 'success');
      }
      const extraStories = pickWorldStories(world);
      for (const storyId of extraStories) markStorySeen(storyId);
      for (const storyId of extraStories) queueModal('story', { storyId });
      for (const entry of completedQuests) queueModal('quest-reward', { questId: entry.quest.id });
      saveProfileNow();
      render();
      if (newlyUnlocked.length) {
        showToast(`新的航路从雾里浮出：${newlyUnlocked.map((region) => region.name).join('、')}。`, 'success');
      }
      for (const entry of completedQuests) {
        if (entry.card) showToast(`委托完成，纪念牌【${entry.card.name}】已收入行囊。`, 'success');
      }
      if (summary.storyId || extraStories.length || completedQuests.length) advanceModalQueue();
      return;
    }
    case 'sandbox-retry': {
      const battle = retrySandboxBattle();
      if (!battle) {
        showToast('试炼牌组似乎出了点问题。', 'warning');
        return;
      }
      audio.buff();
      render();
      return;
    }
    case 'sandbox-return':
      G.sandboxBattle = null;
      G.ui.modal = null;
      setScreen('sandbox');
      render();
      return;
    case 'retry-adventure':
      startAdventure(G.profile.originId, G.ui.regionChoice || G.profile.world.lastRegion);
      saveRunNow();
      render();
      return;
    case 'defeat-world':
      abandonRun();
      saveRunNow();
      enterWorld();
      showToast('你从梦的边缘醒来。群岛还在等你。', 'default');
      return;
    case 'defeat-menu':
      finishRunAndLeave();
      saveRunNow();
      render();
      return;
    case 'view-run-deck':
      openModal('deck-view');
      return;
    case 'map-node':
      enterNode(el.dataset.id);
      return;
    case 'map-sail-home':
      openConfirm({
        eyebrow: 'SAIL HOME',
        title: '收帆回港？',
        message: '你把这趟拿到的牌、遗物与金币带回海图，但这座岛不算踏平，下次进岛要重新走地图。',
        tone: 'default',
        confirmLabel: '收帆',
      }, () => {
        const summary = sailHomeEarly();
        saveProfileNow();
        render();
        if (summary) {
          showToast(`你带着 ${summary.gold} 金币与 ${summary.deckSize} 张牌回到海上。${summary.regionName}仍在雾里。`, 'success');
        }
      });
      return;
    case 'map-abandon':
      openConfirm({
        eyebrow: 'ABANDON THE RUN',
        title: '放弃这次旅程？',
        message: '当前牌组、遗物与金币都会消散在回廊里。统计与自定义内容不会丢失。',
        tone: 'danger',
        confirmLabel: '离开梦境',
      }, () => {
        abandonRun();
        saveRunNow();
        showToast('你合上了这段梦。', 'default');
        render();
      });
      return;
    case 'event-choice': {
      const m = G.ui.modal;
      if (m?.type !== 'event' || !G.run) return;
      const result = resolveEventChoice(G.run, m.data.eventId, el.dataset.id);
      if (!result.ok) {
        showToast(result.message, 'warning');
        return;
      }
      // 结算即完成节点，避免「拿到奖励后退出重进」再次进入同一奇遇。
      if (m.data.nodeId) completeNode(G.run, m.data.nodeId);
      m.data.result = result;
      saveRunNow();
      refreshModal();
      return;
    }
    case 'choose-awakening': {
      if (!G.run) return;
      const result = chooseAwakening(G.run, el.dataset.id);
      if (!result.ok) {
        showToast(result.message || '这条道途暂时无法回应你。', 'warning');
        return;
      }
      G.ui.modal = null;
      saveRunNow();
      showToast(`道途觉醒：【${result.awakening.name}】。${result.awakening.desc}`, 'success');
      audio.buff();
      render();
      return;
    }
    case 'event-continue':
      leaveNode();
      render();
      return;
    case 'camp-rest': {
      if (G.run?.contractMods?.noRestHeal) {
        showToast('折页契约封住了火光——营火不再回复生命。', 'warning');
        return;
      }
      const healed = restHeal(G.run);
      leaveNode();
      showToast(healed > 0 ? `休整后回复了 ${healed} 点生命。` : '生命已满，但火光仍让你安心。', 'success');
      audio.heal();
      render();
      return;
    }
    case 'camp-refine': {
      const m = G.ui.modal;
      if (m?.type !== 'camp') return;
      m.data.mode = 'upgrade';
      refreshModal();
      return;
    }
    case 'camp-forget': {
      const m = G.ui.modal;
      if (m?.type !== 'camp') return;
      m.data.mode = 'forget';
      refreshModal();
      return;
    }
    case 'camp-forget-card': {
      const result = forgetDeckCard(G.run, Number(el.dataset.index));
      if (!result) {
        showToast('牌组不能再薄了——至少要为这场梦留下 6 张牌。', 'warning');
        return;
      }
      leaveNode();
      showToast(`【${result.name}】被你留在火里，不再跟着你走。`, 'success');
      audio.buff();
      render();
      return;
    }
    case 'camp-back': {
      const m = G.ui.modal;
      if (m?.type !== 'camp') return;
      m.data.mode = 'choose';
      refreshModal();
      return;
    }
    case 'camp-upgrade': {
      const result = upgradeDeckCard(G.run, Number(el.dataset.index));
      if (!result) {
        showToast('这张牌已经无法再强化。', 'warning');
        return;
      }
      leaveNode();
      showToast(`【${result.name}】被营火磨砺得更加锋利。`, 'success');
      audio.buff();
      render();
      return;
    }
    case 'node-leave':
      leaveNode();
      render();
      return;
    case 'shop-buy-card': {
      const m = G.ui.modal;
      if (m?.type !== 'shop' || !G.run) return;
      const result = buyShopCard(G.run, m.data.shop, Number(el.dataset.index));
      if (!result.ok) {
        showToast(result.message, 'warning');
        return;
      }
      showToast(`【${result.card?.name || '卡牌'}】已加入牌组。`, 'success');
      saveRunNow();
      audio.coin();
      refreshModal();
      return;
    }
    case 'open-purge': {
      const m = G.ui.modal;
      if (m?.type !== 'shop' || !G.run) return;
      openModal('purge', { shop: m.data.shop });
      return;
    }
    case 'open-shards': {
      openModal('shards', {});
      return;
    }
    case 'open-contracts': {
      if (!G.run) {
        showToast('先启程，祭坛才会听见你的脚步。', 'warning');
        return;
      }
      openModal('contracts', { offers: contractOffersForRun(G.run) });
      return;
    }
    case 'sign-contract': {
      const m = G.ui.modal;
      if (m?.type !== 'contracts' || !G.run) return;
      const result = signDreamContract(G.run, el.dataset.id);
      if (!result.ok) {
        showToast(result.message, 'warning');
        return;
      }
      audio.buff();
      showToast(`与梦立约：【${result.contract.name}】。${result.contract.benefit}代价：${result.contract.drawback}`, 'success');
      m.seq = ++modalSeq;
      render();
      return;
    }
    case 'break-contract': {
      const m = G.ui.modal;
      if (m?.type !== 'contracts' || !G.run) return;
      const id = el.dataset.id;
      const contract = contractList(G.run.contracts || []).find((entry) => entry.id === id);
      if (!contract) return;
      const offers = m.data?.offers || contractOffersForRun(G.run);
      openConfirm({
        eyebrow: 'TEAR THE PAGE',
        title: `撕毁【${contract.name}】？`,
        message: '规则会立刻失效，代价也随之消失；但签下时付的碎片不会退还。祭坛不会为反复无常的人降价。',
        confirmLabel: '撕毁契约',
        tone: 'danger',
      }, () => {
        const result = breakDreamContract(G.run, id);
        if (!result.ok) {
          showToast(result.message, 'warning');
          return;
        }
        audio.phase();
        showToast(`契约【${result.contract.name}】被撕毁，碎片留在了祭坛上。`, 'warning');
        openModal('contracts', { offers });
      });
      return;
    }
    case 'unlock-shard': {
      const id = el.dataset.id;
      const item = SHARD_UNLOCKS.find((entry) => entry.id === id);
      if (!item) return;
      const owned = Array.isArray(G.profile.shardUnlocks) ? G.profile.shardUnlocks : [];
      if (owned.includes(id)) return;
      const shards = Number(G.profile.shards) || 0;
      if (shards < item.cost) {
        showToast('碎片不够。再去走一段没走完的梦。', 'warning');
        return;
      }
      G.profile.shards = shards - item.cost;
      G.profile.shardUnlocks = [...owned, id];
      saveProfileNow();
      audio.coin();
      showToast(`梦的碎片散开了：【${CARD_MAP[id]?.name || id}】已进入卡池。`, 'success');
      refreshModal();
      return;
    }
    case 'back-to-shop': {
      const m = G.ui.modal;
      if (m?.type !== 'purge') return;
      openModal('shop', { shop: m.data.shop });
      return;
    }
    case 'purge-select': {
      const m = G.ui.modal;
      if (m?.type !== 'purge' || !G.run) return;
      const index = Number(el.dataset.index);
      if (!Number.isInteger(index) || !G.run.deck[index]) return;
      m.data.selectedIndex = m.data.selectedIndex === index ? null : index;
      refreshModal();
      return;
    }
    case 'purge-confirm': {
      const m = G.ui.modal;
      if (m?.type !== 'purge' || !G.run) return;
      const index = Number.isInteger(m.data?.selectedIndex) ? m.data.selectedIndex : -1;
      if (index < 0) {
        showToast('先选中一张要忘掉的牌。', 'warning');
        return;
      }
      const result = buyShopPurge(G.run, m.data.shop, index);
      if (!result.ok) {
        showToast(result.message, 'warning');
        return;
      }
      showToast(`你忘掉了【${result.card?.name || '一张牌'}】。牌组还剩 ${G.run.deck.length} 张。`, 'success');
      saveRunNow();
      audio.coin();
      openModal('shop', { shop: m.data.shop });
      return;
    }
    case 'shop-buy-relic': {
      const m = G.ui.modal;
      if (m?.type !== 'shop' || !G.run) return;
      const result = buyShopRelic(G.run, m.data.shop);
      if (!result.ok) {
        showToast(result.message, 'warning');
        return;
      }
      showToast(`遗物【${result.relic.name}】已装备：${result.relic.desc}`, 'success');
      saveRunNow();
      audio.coin();
      presentRelicGain(result.relic);
      refreshModal();
      return;
    }
    case 'shop-buy-heal': {
      const m = G.ui.modal;
      if (m?.type !== 'shop' || !G.run) return;
      const result = buyShopHeal(G.run, m.data.shop);
      if (!result.ok) {
        showToast(result.message, 'warning');
        return;
      }
      showToast(`梦泉回复了 ${result.healed} 点生命。`, 'success');
      saveRunNow();
      audio.heal();
      refreshModal();
      return;
    }
    case 'shop-buy-item': {
      const m = G.ui.modal;
      if (m?.type !== 'shop' || !G.run) return;
      const result = buyShopItem(G.run, m.data.shop, Number(el.dataset.index));
      if (!result.ok) {
        showToast(result.message, 'warning');
        return;
      }
      showToast(`【${result.item.name}】已放进行囊：${result.item.desc}`, 'success');
      saveRunNow();
      audio.coin();
      refreshModal();
      return;
    }
    case 'attack-merchant': {
      const m = G.ui.modal;
      if (m?.type !== 'shop' || !G.run) return;
      const nodeId = m.data.nodeId;
      openConfirm({
        eyebrow: 'THE MERCHANT DRAWS FIRST',
        title: '要掀翻柜台吗？',
        message: '他会把货箱里所有珍藏都用在你身上：药膏、雷石、火漆与毒针，越接近倒下，用得越多。这一战没有退路；赢了，整只货箱都是你的。',
        confirmLabel: '掀翻柜台',
        tone: 'danger',
      }, () => {
        const battle = startMerchantBattle(nodeId);
        if (!battle) {
          showToast('行商连同柜台一起消失在雾里。', 'warning');
          return;
        }
        saveRunNow();
        audio.phase();
        render();
      });
      return;
    }
    case 'shop-steal': {
      const m = G.ui.modal;
      if (m?.type !== 'shop' || !G.run) return;
      const result = stealFromMerchant(G.run, m.data.shop);
      if (!result.ok) {
        showToast(result.message || '柜台已经消失在雾里。', 'warning');
        return;
      }
      if (result.success) {
        saveRunNow();
        audio.coin();
        showToast(`${result.message}${result.detail ? ` ${result.detail}` : ''}`, 'success');
        m.seq = ++modalSeq;
        refreshModal();
        return;
      }
      saveRunNow();
      audio.phase();
      showToast(result.message, 'danger');
      render();
      return;
    }
    case 'treasure-claim': {
      const m = G.ui.modal;
      if (m?.type !== 'treasure' || !G.run) return;
      const result = claimTreasure(G.run, m.data.treasure);
      if (!result) return;
      leaveNode();
      const loot = [`${result.gold} 金币`];
      if (result.relic) loot.push(`遗物【${result.relic.name}】`);
      if (result.item) loot.push(`道具【${result.item.name}】`);
      if (result.itemLost) loot.push(`行囊已满，道具折算 ${result.itemGold} 金币`);
      showToast(`拾得 ${loot.join('、')}。`, 'success');
      audio.coin();
      if (result.item) audio.heal();
      if (result.relic) presentRelicGain(result.relic);
      render();
      return;
    }
    case 'toggle-battle-speed': {
      const next = battleSpeed() === 2 ? 1 : 2;
      applyBattleSpeed(next);
      saveProfileNow();
      showToast(next === 2 ? '战斗演出 ×2：动画与停顿都会加快。' : '战斗演出恢复 1 倍速。', 'default');
      return;
    }
    case 'set-battle-speed': {
      const next = Number(el.dataset.speed) >= 2 ? 2 : 1;
      applyBattleSpeed(next);
      saveProfileNow();
      render();
      return;
    }
    case 'open-card-art':
      openModal('card-art');
      return;
    case 'card-art-filter':
      G.ui.cardArtSchool = el.dataset.school || 'all';
      refreshModal();
      return;
    case 'card-art-clear': {
      if (G.ui.cardArtJob?.running) {
        showToast('还在生成，等这一轮结束再清除。', 'warning');
        return;
      }
      const id = el.dataset.id;
      if (!id) return;
      await deleteCardArt(id);
      refreshModal();
      render();
      showToast('这张牌的 AI 卡面已清除，回到程序绘制。', 'default');
      return;
    }
    case 'card-art-generate':
    case 'card-art-batch': {
      if (G.ui.cardArtJob?.running) {
        showToast('还在生成，请稍候。', 'warning');
        return;
      }
      runCardArtJob({
        only: action === 'card-art-generate' ? el.dataset.id : null,
        force: el.dataset.force === '1',
      });
      return;
    }
    default:
      break;
  }
}

let stageParallaxFrame = 0;
let phaseTiltFrame = 0;
let phaseTiltPoint = null;
let phaseTiltActor = null;

function clearPhaseCardTilt() {
  phaseTiltPoint = null;
  if (!phaseTiltActor) return;
  phaseTiltActor.classList.remove('is-tilting');
  phaseTiltActor = null;
}

function applyPhaseCardTilt(event) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const portal = event.target instanceof Element ? event.target.closest('.actor-portal--enemy') : null;
  const actor = portal?.closest('.stage-actor--enemy');
  if (!portal || !actor?.classList.contains('is-phase-two-awake') || document.body.classList.contains('has-modal')) {
    clearPhaseCardTilt();
    return;
  }
  if (phaseTiltActor && phaseTiltActor !== actor) phaseTiltActor.classList.remove('is-tilting');
  phaseTiltActor = actor;
  const rect = portal.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
  const y = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
  phaseTiltPoint = { actor, x, y };
  if (phaseTiltFrame) return;
  phaseTiltFrame = requestAnimationFrame(() => {
    phaseTiltFrame = 0;
    const point = phaseTiltPoint;
    if (!point?.actor.isConnected) return;
    const target = point.actor;
    target.classList.add('is-tilting');
    target.style.setProperty('--tilt-x', `${(-point.y * 5.5).toFixed(2)}deg`);
    target.style.setProperty('--tilt-y', `${(point.x * 6.5).toFixed(2)}deg`);
    target.style.setProperty('--art-x', `${(point.x * -7).toFixed(2)}px`);
    target.style.setProperty('--art-y', `${(point.y * -5).toFixed(2)}px`);
    target.style.setProperty('--fx-x', `${(point.x * 4.5).toFixed(2)}px`);
    target.style.setProperty('--fx-y', `${(point.y * 3.5).toFixed(2)}px`);
    target.style.setProperty('--glare-x', `${((point.x + 1) * 50).toFixed(1)}%`);
    target.style.setProperty('--glare-y', `${((point.y + 1) * 50).toFixed(1)}%`);
  });
}

function applyStageParallax(event) {
  const stage = event.target instanceof Element ? event.target.closest('.battle-screen--stage') : null;
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
  const y = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
  if (stageParallaxFrame) return;
  stageParallaxFrame = requestAnimationFrame(() => {
    stageParallaxFrame = 0;
    const liveStage = qs('.battle-screen--stage');
    if (!liveStage) return;
    liveStage.style.setProperty('--par-x', x.toFixed(3));
    liveStage.style.setProperty('--par-y', y.toFixed(3));
  });
}

document.addEventListener('fullscreenchange', () => {
  if (G.screen === 'studio') render();
});

document.addEventListener('contextmenu', (event) => {
  const target = event.target instanceof Element ? event.target.closest('.game-card') : null;
  if (!target || target.classList.contains('is-sealed')) return;
  let cardId = target.dataset.cardId || '';
  if (!cardId && target.dataset.uid) {
    const battle = currentBattle();
    const instance = battle?.hand?.find((entry) => entry.uid === target.dataset.uid);
    cardId = instance?.defId || '';
  }
  if (!cardId) return;
  event.preventDefault();
  audio.click();
  openModal('card-detail', { cardId });
  render();
});

document.addEventListener('pointermove', (event) => {
  applyStageParallax(event);
  applyPhaseCardTilt(event);
}, { passive: true });
window.addEventListener('blur', clearPhaseCardTilt);

document.addEventListener('click', (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) {
    const backdrop = event.target.closest('[data-modal-backdrop]');
    if (backdrop && event.target === backdrop) attemptCloseModal();
    return;
  }
  if (actionEl.disabled) return;
  audio.click();
  handleAction(actionEl.dataset.action, actionEl)
    .catch((error) => {
      console.error(error);
      showToast('梦境刚才抖了一下，请再试一次。', 'danger');
    })
    .finally(() => {
      saveRunNow();
    });
});

document.addEventListener('input', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    handleInput(event.target);
  }
});

document.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
    handleChange(event.target);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (G.ui.modal) {
      event.preventDefault();
      attemptCloseModal();
    }
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (G.ui.modal) return;
  if (performance.now() < phaseCinemaUntil) return;
  const tag = document.activeElement?.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
  if (G.screen === 'online') {
    const on = getOnline();
    const canAct = on.status === 'battle'
      && on.battle?.phase === 'active'
      && on.battle.turn === on.role
      && !on.pending;
    if (!canAct) return;
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      onlineEndTurn();
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      const card = on.battle.players[on.role]?.hand[Number(event.key) - 1];
      if (card) {
        event.preventDefault();
        onlinePlay(card.uid);
      }
    }
    return;
  }
  if (event.key === 'e' || event.key === 'E') {
    if (G.screen === 'battle') {
      event.preventDefault();
      finishTurn();
    }
    return;
  }
  if (G.screen === 'battle' && /^[1-9]$/.test(event.key)) {
    const battle = currentBattle();
    if (!battle || battle.phase !== 'player') return;
    const card = battle.hand[Number(event.key) - 1];
    if (!card) return;
    event.preventDefault();
    playBattleCard(card.uid);
  }
});

fileInput?.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) handlePortraitFile(file);
});

audioInput?.addEventListener('change', () => {
  const file = audioInput.files?.[0];
  if (file) {
    handleAudioFile(file).catch((error) => {
      console.error(error);
      showToast('声音没能留在这台机器上，请再试一次。', 'danger');
    });
  }
});

saveInput?.addEventListener('change', () => {
  const file = saveInput.files?.[0];
  if (saveInput) saveInput.value = '';
  if (file) {
    handleSaveFile(file).catch((error) => {
      console.error(error);
      showToast('备份没能读进这段梦。', 'danger');
    });
  }
});

document.addEventListener('error', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) return;
  const fallback = target.dataset.fallback;
  if (fallback && !target.dataset.fallbackApplied) {
    target.dataset.fallbackApplied = '1';
    target.src = fallback;
    return;
  }
  target.classList.add('is-broken');
}, true);

let lastOnlineNoticeSeq = 0;
window.addEventListener('cardrealm:online', (event) => {
  const on = event.detail;
  if (on?.notice && on.noticeSeq > lastOnlineNoticeSeq) {
    lastOnlineNoticeSeq = on.noticeSeq;
    showToast(on.notice, on.status === 'idle' && on.error ? 'warning' : 'default');
  }
  if (G.screen === 'online') render();
});
window.addEventListener('cardrealm:toast', renderToast);
window.addEventListener('cardrealm:toast-expired', renderToast);
window.addEventListener('beforeunload', saveRunNow);
window.addEventListener('cardrealm:saveerror', (event) => {
  showToast(event.detail || '本地空间不足，保存失败。', 'danger');
});

function dismissBoot() {
  const boot = qs('#boot');
  if (!boot) return;
  boot.classList.add('is-hidden');
  setTimeout(() => boot.remove(), 700);
}

function applyFontSetting() {
  const size = G.profile.settings.fontSize || 'normal';
  const root = document.documentElement;
  const isShell = Boolean(window.chrome?.webview?.postMessage);
  root.classList.toggle('is-desktop-shell', isShell);
  if (size === 'normal') delete root.dataset.font;
  else root.dataset.font = size;
  if (isShell) {
    const scale = size === 'small' ? 0.9 : size === 'large' ? 1.12 : 1;
    window.chrome.webview.postMessage(`set-zoom:${scale}`);
  }
}

audio.setVolumes({
  music: G.profile.settings.musicVolume,
  sfx: G.profile.settings.sfxVolume,
});
audio.setMuted(Boolean(G.profile.settings.muted));
applyFontSetting();
G.ui.originChoice = G.profile.originId;
if (!G.ui.selectedEnemyId || !ENEMY_MAP[G.ui.selectedEnemyId]) G.ui.selectedEnemyId = ENEMIES[0].id;
const resumedRun = restoreRunSave();
if (resumedRun) {
  G.ui.regionChoice = resumedRun.regionId || 'corridor';
  G.ui.worldIsland = resumedRun.regionId || 'corridor';
  G.ui.originChoice = resumedRun.originId || G.profile.originId;
  // 读档后先停在扉页，玩家点「继续游戏」再回到对局，方便查看图鉴/成就等。
  G.screen = 'menu';
}
initLiveArt();
applyBattleSpeed();
render();
loadCardArt().then(() => render()).catch(() => {});
restoreCustomAudio().catch((error) => console.warn('恢复自定义音频失败。', error));
requestAnimationFrame(() => requestAnimationFrame(dismissBoot));
if (resumedRun) {
  setTimeout(() => showToast('上次的旅程已就绪，点「继续游戏」回到梦里。', 'success'), 900);
}
