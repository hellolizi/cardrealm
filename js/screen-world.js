import { CARD_MAP, ENEMIES, ENEMY_MAP, RELICS } from './data.js';
import { CHAPTERS, ENDINGS, NPCS, REGION_MAP, REGIONS, SEA_ROUTES, seaNeighbours } from './lore.js';
import { G } from './state.js';
import {
  activeQuestEntries,
  bondLabel,
  endingChoices,
  isRegionUnlocked,
  npcBond,
  questsForNpc,
  questProgress,
  regionClearCount,
  regionStatusLabel,
  trophyOptions,
  unlockProgress,
} from './world-state.js';
import { imageTag, progressBar, topbarMuteButton } from './ui-common.js';
import { esc, icon, safeColor } from './utils.js';

/**
 * 航路渲染：一条线分三种状态。
 *   已走通（两端都踏平）—— 亮金线
 *   已通航（一端踏平）—— 淡金虚线
 *   还在雾里 —— 极淡的暗线，能看见但走不了
 * 这是开放世界最核心的可读性：玩家一眼就知道自己下一步能去哪。
 */
function routeState(world, route) {
  const fromCleared = regionClearCount(world, route.from) > 0;
  const toCleared = regionClearCount(world, route.to) > 0;
  const fromOpen = isRegionUnlocked(world, route.from);
  const toOpen = isRegionUnlocked(world, route.to);
  if (fromCleared && toCleared) return 'walked';
  if ((fromOpen && fromCleared) || (toOpen && toCleared)) return 'open';
  return 'fogged';
}

function routeMarkup(world) {
  return SEA_ROUTES.map((route) => {
    const from = REGION_MAP[route.from];
    const to = REGION_MAP[route.to];
    if (!from || !to) return '';
    const state = routeState(world, route);
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 6;
    return `<path class="world-route is-${state}" d="M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}" vector-effect="non-scaling-stroke"/>`;
  }).join('');
}

function islandMarker(region) {
  const world = G.profile.world;
  const unlocked = isRegionUnlocked(world, region.id);
  const status = regionStatusLabel(world, region);
  const clears = regionClearCount(world, region.id);
  const unlock = unlockProgress(world, region);
  const selected = G.ui.worldIsland === region.id;
  const classes = [
    'island-marker',
    `island-marker--${status.tone}`,
    selected ? 'is-selected' : '',
    unlocked ? 'is-unlocked' : 'is-locked',
    region.final ? 'is-final' : '',
  ].filter(Boolean).join(' ');
  const meta = unlocked
    ? (clears > 0 ? `已踏平 ×${clears}` : region.episode)
    : (unlock.missingRegions.length
      ? `仍需踏平：${unlock.missingRegions.join('、')}`
      : unlock.nearName
        ? `需先踏平${unlock.nearName}`
        : '航路未通');
  return `<button type="button" class="${classes}" data-action="world-select" data-id="${esc(region.id)}" style="left:${region.x}%;top:${region.y}%;--island:${safeColor(region.color)}" aria-label="${esc(`${region.name}，${status.text}。${region.epithet}`)}" aria-pressed="${selected}">
    <span class="island-marker__orbit" aria-hidden="true"></span>
    <span class="island-marker__disc">
      <span class="island-marker__sigil">${unlocked ? esc(region.sigil) : icon('lock', 16)}</span>
      ${status.tone === 'cleared' ? `<span class="island-marker__check">${icon('check', 10)}</span>` : ''}
      ${region.final && unlocked ? `<span class="island-marker__crown">${icon('crown', 11)}</span>` : ''}
      ${selected ? '<span class="island-marker__you">你在这</span>' : ''}
    </span>
    <span class="island-marker__name">${esc(region.name)}</span>
    <span class="island-marker__meta">${esc(meta)}</span>
    ${unlocked ? '<span class="island-marker__pulse" aria-hidden="true"></span>' : ''}
  </button>`;
}

function regionDetail(region) {
  const world = G.profile.world;
  const unlocked = isRegionUnlocked(world, region.id);
  const status = regionStatusLabel(world, region);
  const clears = regionClearCount(world, region.id);
  const boss = ENEMY_MAP[region.bossId];
  const unlock = unlockProgress(world, region);
  return `<article class="island-detail" style="--island:${safeColor(region.color)}">
    <div class="island-detail__eyebrow">
      <span>${esc(region.episode)} · ${esc(region.epithet)}</span>
      <span class="island-status island-status--${status.tone}">${esc(status.text)}</span>
    </div>
    <h2>${esc(region.name)}</h2>
    <p class="island-detail__desc">${esc(region.desc)}</p>
    <div class="island-detail__facts">
      <div><small>岛屿之主</small><strong>${esc(boss?.name || '未知梦魇')}</strong></div>
      <div><small>远征记录</small><strong>${clears} 次踏平</strong></div>
    </div>
    <div class="island-boon">
      <span class="island-boon__label">${icon('sparkles', 13)} ${esc(region.boonName)}</span>
      <p>${esc(region.boon)}</p>
    </div>
    ${unlocked
      ? `<div class="island-routes">
          <span class="island-routes__label">${icon('link', 12)} 从这里能去</span>
          <span class="island-routes__list">${seaNeighbours(region.id)
            .map((id) => REGION_MAP[id])
            .filter(Boolean)
            .map((next) => {
              const open = isRegionUnlocked(world, next.id);
              return `<button type="button" class="island-route ${open ? 'is-open' : ''}" data-action="world-select" data-id="${esc(next.id)}" style="--island:${safeColor(next.color)}">${open ? esc(next.sigil) : icon('lock', 10)} ${esc(next.name)}</button>`;
            }).join('')}</span>
        </div>
        <button type="button" class="button button--primary button--large world-launch" data-action="region-start" data-id="${esc(region.id)}">
          <span>${region.final ? '走向心之尽头' : '启程前往'} · ${esc(region.name)}</span>${icon('right', 18)}
        </button>`
      : `<div class="island-locked">
          <span class="island-locked__icon">${icon('lock', 18)}</span>
          <div>
            <strong>这座岛还在雾里</strong>
            <p>${esc(region.requirement)}</p>
            ${unlock.missingRegions.length
              ? `<small>还差 ${unlock.missingRegions.length} 座：${esc(unlock.missingRegions.join('、'))}</small>`
              : unlock.nearName
                ? `<small>先去踏平 ${esc(unlock.nearName)}，航路就会亮起来。</small>`
                : ''}
          </div>
        </div>`}
  </article>`;
}

function trophySection(world) {
  const cards = trophyOptions(world);
  if (!cards.length) {
    return `<section class="world-trophies">
      <div class="world-section-head"><span>随行纪念牌</span><small>QUEST CARDS</small></div>
      <p class="world-trophies__empty">${icon('scroll', 14)} 完成岛民的委托，就能带走一张只属于这段旅程的牌。</p>
    </section>`;
  }
  return `<section class="world-trophies">
    <div class="world-section-head"><span>随行纪念牌</span><small>带一张上路</small></div>
    <div class="trophy-row">
      <button type="button" class="trophy-chip ${!world.trophyCard ? 'is-selected' : ''}" data-action="world-trophy" data-id="">
        <span class="trophy-chip__glyph">无</span>
        <span class="trophy-chip__copy"><strong>轻装上路</strong><small>不带纪念牌</small></span>
        ${!world.trophyCard ? icon('check', 14) : ''}
      </button>
      ${cards.map((card) => `<button type="button" class="trophy-chip ${world.trophyCard === card.id ? 'is-selected' : ''}" data-action="world-trophy" data-id="${esc(card.id)}" title="${esc(`${card.name}：${card.description || card.flavor || ''}`)}">
        <span class="trophy-chip__glyph" style="--card:${safeColor(card.accent || '#b48bc9')}">${esc(card.glyph)}</span>
        <span class="trophy-chip__copy"><strong>${esc(card.name)}</strong><small>任务纪念牌</small></span>
        ${world.trophyCard === card.id ? icon('check', 14) : ''}
      </button>`).join('')}
    </div>
    <p class="world-trophies__note">纪念牌会在每段远征的起始牌组中多出现一次。</p>
  </section>`;
}

function questEntry(entry) {
  const { quest, progress } = entry;
  const npc = NPCS.find((item) => item.id === quest.npc);
  const card = CARD_MAP[quest.card];
  const percent = Math.min(100, (progress.value / progress.target) * 100);
  return `<div class="world-quest" style="--npc:${safeColor(npc?.color || '#b48bc9')}">
    <span class="world-quest__sigil">${esc(npc?.glyph || '页')}</span>
    <div class="world-quest__body">
      <div class="world-quest__top"><strong>${esc(quest.title)}</strong><span>${progress.value}/${progress.target}</span></div>
      <p>${esc(quest.desc)}</p>
      <span class="world-quest__bar"><i style="width:${percent}%"></i></span>
      ${card ? `<span class="world-quest__reward">${icon('cards', 12)} ${esc(card.name)}</span>` : ''}
    </div>
  </div>`;
}

function questSection(world) {
  const entries = activeQuestEntries(world).filter((entry) => entry.status === 'active');
  return `<section class="world-quests">
    <div class="world-section-head">
      <span>任务簿</span>
      <button type="button" class="text-button" data-action="open-quests">${icon('scroll', 13)} 全部 ${entries.length + world.quests.completed.length}</button>
    </div>
    ${entries.length
      ? entries.slice(0, 3).map(questEntry).join('')
      : `<p class="world-quests__empty">${icon('check', 14)} 手头的委托都完成了。去和岛上的旧人聊聊天吧。</p>`}
  </section>`;
}

function bondPips(bond) {
  return `<span class="bond-pips">${[0, 1, 2].map((index) => `<i class="${index < bond ? 'is-lit' : ''}"></i>`).join('')}</span>`;
}

function npcDock(world) {
  return NPCS.map((npc) => {
    const bond = npcBond(world, npc.id);
    const quests = questsForNpc(world, npc.id);
    const active = quests.filter((entry) => entry.status === 'active').length;
    const completed = quests.filter((entry) => entry.status === 'completed').length;
    return `<button type="button" class="npc-card" data-action="talk-npc" data-id="${esc(npc.id)}" style="--npc:${safeColor(npc.color)}" aria-label="${esc(`与${npc.name}交谈`)}">
      <span class="npc-card__frame">
        <span class="npc-card__glyph">${esc(npc.glyph)}</span>
        <span class="npc-card__ring" aria-hidden="true"></span>
      </span>
      <span class="npc-card__copy">
        <small>${esc(npc.title)}</small>
        <strong>${esc(npc.name)}</strong>
        <span class="npc-card__bond">${bondPips(bond)}<em>${esc(bondLabel(bond))}</em></span>
      </span>
      <span class="npc-card__side">
        ${active ? `<span class="npc-card__quest">${icon('scroll', 12)} 委托</span>` : ''}
        ${completed ? `<span class="npc-card__done">${icon('check', 11)} ${completed}</span>` : ''}
        <span class="npc-card__talk">${icon('right', 14)}</span>
      </span>
    </button>`;
  }).join('');
}

function codexSection(world) {
  const choices = endingChoices(world);
  const unlocked = world.endings.length;
  const codex = G.profile.codex || { enemies: [], relics: [] };
  const collected = (codex.enemies || []).length + (codex.relics || []).length;
  const total = ENEMIES.length + RELICS.length;
  return `<button type="button" class="world-codex" data-action="open-codex">
    <span class="world-codex__seal">${icon('crown', 19)}</span>
    <span class="world-codex__copy"><small>岛的记忆 · 图鉴 ${collected}/${total}</small><strong>结局 ${unlocked} / ${ENDINGS.length}</strong></span>
    <span class="codex-pips">${choices.map((choice) => `<i class="${choice.ending && world.endings.includes(choice.ending.id) ? 'is-unlocked' : ''}"></i>`).join('')}</span>
    <span class="world-codex__arrow">${icon('right', 15)}</span>
  </button>`;
}

export function renderWorld() {
  const world = G.profile.world;
  const selected = REGION_MAP[G.ui.worldIsland] || REGION_MAP[world.lastRegion] || REGIONS[0];
  const chapter = CHAPTERS[Math.min(world.chapter, CHAPTERS.length - 1)] || CHAPTERS[0];
  const finalUnlocked = isRegionUnlocked(world, 'heart');
  return `<div class="screen world-screen">
    <div class="world-backdrop" aria-hidden="true">
      ${imageTag('assets/world/archipelago.webp', 'assets/realm-bg.webp', '', 'world-backdrop__image', false)}
      <span class="world-backdrop__veil"></span>
      <span class="world-backdrop__glow"></span>
      <span class="world-backdrop__motes"></span>
    </div>
    <header class="pagebar world-topbar">
      <button type="button" class="pagebar__back" data-action="world-menu">${icon('home', 17)}<span>扉页</span></button>
      <div class="pagebar__title"><span>梦境群岛 · 第 ${chapter.id + 1} 章</span><strong>${esc(chapter.title)}</strong></div>
      <div class="pagebar__actions">
        <span class="world-save">${icon('check', 12)} 自动存档</span>
        <button type="button" class="text-button" data-action="open-quests">${icon('scroll', 15)} 任务簿</button>
        <button type="button" class="text-button" data-action="open-codex">${icon('crown', 15)} 结局 ${world.endings.length}/${ENDINGS.length}</button>
        ${topbarMuteButton()}
        <button type="button" class="icon-button" data-action="open-guide" title="玩法指南">${icon('help', 18)}</button>
      </div>
    </header>

    <main class="world-layout">
      <section class="world-map-panel">
        <div class="world-map-frame">
        <div class="world-map">
          ${imageTag('assets/world/archipelago.webp', 'assets/realm-bg.webp', '梦境群岛', 'world-map__image', false)}
          <span class="world-map__veil"></span>
          <span class="world-map__fog world-map__fog--one"></span>
          <span class="world-map__fog world-map__fog--two"></span>
          <span class="world-map__moon"></span>
          <svg class="world-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${routeMarkup(world)}</svg>
          <div class="world-islands">${REGIONS.map(islandMarker).join('')}</div>
          <div class="world-map__caption">
            <span class="section-eyebrow">THE DREAM ARCHIPELAGO · CHAPTER ${String(chapter.id + 1).padStart(2, '0')}</span>
            <h1>${esc(chapter.title)}</h1>
            <p>${esc(chapter.line)}</p>
          </div>
          <div class="world-map__legend">
            <span><i class="world-dot world-dot--open"></i>可探索</span>
            <span><i class="world-dot world-dot--cleared"></i>已踏平</span>
            <span><i class="world-dot world-dot--locked"></i>仍在雾中</span>
            <span class="world-map__routes-legend"><i></i>亮线＝航路已通</span>
            ${finalUnlocked ? `<span class="world-map__warning">${icon('crown', 12)} 心的裂口已经打开</span>` : ''}
          </div>
          <span class="world-compass" aria-hidden="true"><i>北</i></span>
        </div>
        </div>
        <span class="world-map-hint">${icon('link', 11)} 左右拖动查看整片群岛</span>
      </section>

      <aside class="world-side">
        <div class="world-side__scroll">
          ${regionDetail(selected)}
          ${trophySection(world)}
          ${questSection(world)}
          ${codexSection(world)}
        </div>
      </aside>
    </main>

    <footer class="world-dock">
      <div class="world-dock__head">
        <span>岛上的旧人</span>
        <small>羁绊越深，最终抉择时能带走的东西越多</small>
      </div>
      <div class="world-npcs">${npcDock(world)}</div>
      <span class="world-dock__foot">本地档案 · 每次选择自动保存 · 群岛会记得你走过的路</span>
    </footer>
  </div>`;
}
