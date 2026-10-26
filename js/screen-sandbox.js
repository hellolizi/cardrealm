import { CARDS, ENEMIES, ORIGIN_MAP, ORIGINS } from './data.js';
import { G, getEnemySkin, getHeroAvatar, getHeroName } from './state.js';
import {
  cardMarkup,
  emptyState,
  groupDeck,
  imageTag,
  progressBar,
  topbarMuteButton,
} from './ui-common.js';
import { esc, icon, safeColor } from './utils.js';

const TIER_LABEL = { normal: '游荡梦魇', elite: '镜中精英', boss: '梦魇之主' };
const TIER_INDEX = { normal: '01', elite: '02', boss: '03' };

function deckGroups() {
  return groupDeck(G.profile.sandboxDeck);
}

function deckGlyphStrip(limit = 10) {
  const groups = deckGroups().slice(0, limit);
  if (!groups.length) return '<span class="sandbox-deck__empty">牌组还是空的</span>';
  return groups.map((group) => `<span class="sandbox-glyph" style="--card:${safeColor(group.card.accent)}" title="${esc(`${group.card.displayName} ×${group.count}`)}">${esc(group.card.glyph)}</span>`).join('');
}

function renderDeckSummary() {
  const origin = ORIGIN_MAP[G.profile.originId] || ORIGINS[0];
  const groups = deckGroups();
  const total = G.profile.sandboxDeck.length;
  const cardsToMin = Math.max(0, 8 - total);
  return `<aside class="sandbox-deck">
    <span class="sandbox-deck__eyebrow">TRIAL DECK</span>
    <div class="sandbox-deck__head">
      <span class="sandbox-deck__sigil" style="--origin:${safeColor(origin.color)}">${esc(origin.sigil)}</span>
      <div>
        <strong>试炼牌组</strong>
        <small>${esc(origin.name)} · ${total} / 30 张</small>
      </div>
    </div>
    <div class="sandbox-deck__glyphs">${deckGlyphStrip(12)}</div>
    <div class="sandbox-deck__stats">
      <span><small>种类</small><strong>${groups.length}</strong></span>
      <span><small>造物</small><strong>${groups.filter((group) => group.card.custom).length}</strong></span>
      <span><small>需求</small><strong>${total >= 8 ? '就绪' : `差 ${cardsToMin}`}</strong></span>
    </div>
    <div class="sandbox-deck__health">
      <span>生命 · ${origin.hp}</span>
      ${progressBar(origin.hp, origin.hp, 'progress--gold')}
      <small>${esc(origin.passive)}</small>
    </div>
    <div class="sandbox-deck__actions">
      <button type="button" class="button button--primary" data-action="open-deckbuilder">${icon('cards', 16)} 构筑试炼牌组</button>
      <button type="button" class="text-button" data-action="deck-reset">${icon('rotate', 14)} 重置为初始牌组</button>
    </div>
  </aside>`;
}

function renderEnemyCard(enemy) {
  const skin = getEnemySkin(enemy.id);
  const customized = Boolean(G.profile.enemySkins[enemy.id]?.image || G.profile.enemySkins[enemy.id]?.name);
  return `<article class="trial-enemy trial-enemy--${esc(enemy.tier)}" style="--enemy-color:${safeColor(enemy.accent)}">
    <div class="trial-enemy__art">
      ${imageTag(skin.image, enemy.image, skin.name, 'trial-enemy__image')}
      <span class="trial-enemy__veil"></span>
      <span class="trial-enemy__tier">${esc(TIER_LABEL[enemy.tier] || '梦魇')}</span>
      <span class="trial-enemy__index">${TIER_INDEX[enemy.tier] || '00'}</span>
      ${customized ? `<span class="trial-enemy__custom">${icon('camera', 12)} 自定义形态</span>` : ''}
      <span class="trial-enemy__hp">${icon('heart', 13)} ${enemy.hp}</span>
    </div>
    <div class="trial-enemy__body">
      <div class="trial-enemy__title">
        <div><h3>${esc(skin.name)}</h3><small>${esc(enemy.name)}</small></div>
        <span class="trial-enemy__glyph">${esc(enemy.glyph)}</span>
      </div>
      <p class="trial-enemy__lore">${esc(enemy.lore)}</p>
      <div class="trial-enemy__moves">
        ${enemy.moves.slice(0, 3).map((move) => `<span>${esc(move.name)}</span>`).join('')}
      </div>
      <div class="trial-enemy__actions">
        <button type="button" class="button button--primary" data-action="start-sandbox-battle" data-id="${esc(enemy.id)}">${icon('play', 14)} 开始试炼</button>
        <button type="button" class="icon-button" data-action="open-generate" data-kind="enemy" data-enemy-id="${esc(enemy.id)}" title="用 AI 生成新形态">${icon('sparkles', 17)}</button>
        <button type="button" class="icon-button" data-action="upload-enemy" data-enemy-id="${esc(enemy.id)}" title="上传照片作为形态">${icon('upload', 17)}</button>
      </div>
    </div>
  </article>`;
}

export function renderSandbox() {
  const origin = ORIGIN_MAP[G.profile.originId] || ORIGINS[0];
  const cards = G.profile.customCards;
  return `<div class="screen sandbox-screen">
    <div class="page-glow" aria-hidden="true"></div>
    <header class="pagebar">
      <button type="button" class="pagebar__back" data-action="sandbox-back">${icon('left', 18)}<span>扉页</span></button>
      <div class="pagebar__title"><span>幻境游乐场</span><strong>无梦的试炼场</strong></div>
      <div class="pagebar__actions">
        ${topbarMuteButton()}
        <button type="button" class="text-button" data-action="open-studio" data-tab="enemies">${icon('image', 15)} 敌人形态</button>
        <button type="button" class="text-button text-button--accent" data-action="open-studio" data-tab="cards">${icon('wand', 15)} 造物工坊</button>
      </div>
    </header>

    <main class="sandbox-layout">
      <section class="sandbox-hero">
        <div class="sandbox-hero__portrait" style="--origin-color:${safeColor(origin.color)}">
          <span class="sandbox-hero__halo"></span>
          <span class="sandbox-hero__frame"></span>
          ${imageTag(getHeroAvatar(), 'assets/heroes/default.webp', getHeroName(), 'sandbox-hero__image', false)}
          <span class="sandbox-hero__sigil">${esc(origin.sigil)}</span>
          <button type="button" class="sandbox-hero__edit" data-action="open-studio" data-tab="hero" title="自定义主角">${icon('camera', 15)}</button>
        </div>
        <div class="sandbox-hero__copy">
          <span class="section-eyebrow">THE ATELIER OF DREAMS</span>
          <h1>把梦拆开，<br><em>再拼一次。</em></h1>
          <p>这里没有真正的失败。自由构筑牌组，挑选任意梦魇试刀，用照片或 AI 改写他们的面孔——娱乐模式允许你打破一切平衡。</p>
          <div class="sandbox-hero__meta">
            <div><span>执牌者</span><strong>${esc(getHeroName())}</strong></div>
            <span class="stat-divider"></span>
            <div><span>造物</span><strong>${cards.length}</strong></div>
            <span class="stat-divider"></span>
            <div><span>改写形态</span><strong>${Object.keys(G.profile.enemySkins).length}</strong></div>
          </div>
          <div class="sandbox-hero__actions">
            <button type="button" class="button button--primary" data-action="open-deckbuilder">${icon('cards', 16)} 构筑试炼牌组</button>
            <button type="button" class="button button--ghost" data-action="new-custom-card">${icon('plus', 16)} 铸造一张新牌</button>
            <button type="button" class="button button--ghost" data-action="open-studio" data-tab="hero">${icon('user', 16)} 自定义主角</button>
          </div>
        </div>
        ${renderDeckSummary()}
      </section>

      <section class="sandbox-section">
        <div class="sandbox-section__head">
          <div>
            <span class="section-eyebrow">CHOOSE A NIGHTMARE</span>
            <h2>选择试炼之敌</h2>
            <p>点击开始试炼会立刻进入战斗。你也可以先为它换一张脸。</p>
          </div>
          <button type="button" class="text-button" data-action="open-studio" data-tab="enemies">${icon('image', 15)} 管理所有形态</button>
        </div>
        <div class="enemy-gallery">
          ${ENEMIES.map((enemy) => renderEnemyCard(enemy)).join('')}
        </div>
      </section>

      <section class="sandbox-section sandbox-section--creations">
        <div class="sandbox-section__head">
          <div>
            <span class="section-eyebrow">YOUR OWN CREATIONS</span>
            <h2>我的造物</h2>
            <p>自定义卡牌只在幻境试炼中生效。它们不会被带进主线冒险。</p>
          </div>
          <button type="button" class="button button--ghost" data-action="new-custom-card">${icon('plus', 15)} 铸造新牌</button>
        </div>
        ${cards.length
          ? `<div class="creation-grid">
              ${cards.map((card) => cardMarkup(card, {
                action: 'edit-custom-card',
                attrs: `data-id="${esc(card.id)}"`,
                showFlavor: true,
                className: 'creation-card',
              })).join('')}
              <button type="button" class="creation-new" data-action="new-custom-card">
                <span>${icon('plus', 26)}</span>
                <strong>再来一张</strong>
                <small>写下新的效果链</small>
              </button>
            </div>`
          : emptyState(
            'wand',
            '还没有自己的造物',
            '写下一张只属于你的牌：任意组合伤害、格挡、抽牌、中毒与更多效果。',
            `<button type="button" class="button button--primary" data-action="new-custom-card">${icon('plus', 16)} 铸造第一张牌</button>`,
          )}
      </section>
    </main>
  </div>`;
}

function filterPool(cards) {
  const filter = G.ui.deckFilter || 'all';
  if (filter === 'attack' || filter === 'skill') {
    return cards.filter((card) => card.type === filter);
  }
  if (filter === 'custom') return cards.filter((card) => card.custom);
  return cards;
}

function poolMarkup() {
  const allCards = [...G.profile.customCards, ...CARDS];
  const filtered = filterPool(allCards);
  const counts = new Map();
  for (const id of G.profile.sandboxDeck) counts.set(id, (counts.get(id) || 0) + 1);
  const filters = [
    { id: 'all', label: '全部', count: allCards.length },
    { id: 'attack', label: '攻击', count: allCards.filter((card) => card.type === 'attack').length },
    { id: 'skill', label: '技能', count: allCards.filter((card) => card.type === 'skill').length },
    { id: 'custom', label: '造物', count: G.profile.customCards.length },
  ];
  return `<div class="deck-pool__toolbar">
      <div class="filter-chips">
        ${filters.map((filter) => `<button type="button" class="filter-chip ${G.ui.deckFilter === filter.id ? 'is-active' : ''}" data-action="deck-filter" data-filter="${filter.id}">
          ${esc(filter.label)}<small>${filter.count}</small>
        </button>`).join('')}
      </div>
      <span class="deck-pool__hint">${icon('plus', 13)} 点击卡牌加入牌组</span>
    </div>
    <div class="deck-pool__grid">
      ${filtered.length
        ? filtered.map((card) => `<div class="pool-card ${counts.has(card.id) ? 'is-in-deck' : ''}">
            ${cardMarkup(card, {
              action: 'deck-add',
              attrs: `data-id="${esc(card.id)}"`,
              className: 'pool-card__card',
            })}
            <span class="pool-card__owned">${counts.has(card.id) ? `牌组中 ×${counts.get(card.id)}` : '点击加入'}</span>
          </div>`).join('')
        : emptyState('cards', '这里没有卡牌', '换一个筛选条件试试看。')}
    </div>`;
}

function deckPanelMarkup() {
  const groups = deckGroups();
  const total = G.profile.sandboxDeck.length;
  const ready = total >= 8;
  return `<aside class="deck-builder-panel">
    <div class="deck-builder-panel__head">
      <div>
        <span class="section-eyebrow">TRIAL DECK</span>
        <h2>试炼牌组</h2>
      </div>
      <div class="deck-builder-count"><strong>${String(total).padStart(2, '0')}</strong><small>/ 30</small></div>
    </div>
    <div class="deck-builder-progress">${progressBar(total, 30, 'progress--gold')}</div>
    <p class="deck-builder-panel__status ${ready ? 'is-ready' : 'is-warning'}">
      ${ready ? `${icon('check', 14)} 牌组已就绪，可以开始试炼。` : `${icon('help', 14)} 至少需要 8 张牌，还差 ${8 - total} 张。`}
    </p>
    <div class="deck-builder-list">
      ${groups.length
        ? groups.map((group) => `<div class="deck-builder-item">
            ${cardMarkup(group.card, { tag: 'div', mini: true, badge: group.count })}
            <div class="deck-builder-item__actions">
              <button type="button" class="icon-button" data-action="deck-add" data-id="${esc(group.defId)}" title="再加一张">${icon('plus', 14)}</button>
              <button type="button" class="icon-button" data-action="deck-remove" data-id="${esc(group.defId)}" title="移除一张">${icon('minus', 14)}</button>
            </div>
          </div>`).join('')
        : '<div class="deck-builder-empty">牌组为空。从右侧牌库中挑选卡牌。</div>'}
    </div>
    <div class="deck-builder-panel__foot">
      <button type="button" class="text-button" data-action="deck-reset">${icon('rotate', 14)} 重置为初始牌组</button>
      <button type="button" class="button button--ghost" data-action="deckbuilder-back">${icon('right', 15)} 返回试炼场</button>
    </div>
  </aside>`;
}

export function renderDeckbuilder() {
  const origin = ORIGIN_MAP[G.profile.originId] || ORIGINS[0];
  return `<div class="screen deckbuilder-screen">
    <div class="page-glow" aria-hidden="true"></div>
    <header class="pagebar">
      <button type="button" class="pagebar__back" data-action="deckbuilder-back">${icon('left', 18)}<span>试炼场</span></button>
      <div class="pagebar__title"><span>幻境游乐场</span><strong>构筑试炼牌组</strong></div>
      <div class="pagebar__actions">
        <span class="header-resource">${icon('cards', 15)} <strong>${G.profile.sandboxDeck.length}</strong><small> / 30</small></span>
        ${topbarMuteButton()}
        <button type="button" class="text-button text-button--accent" data-action="new-custom-card">${icon('plus', 15)} 铸造新牌</button>
      </div>
    </header>
    <main class="deckbuilder-layout">
      ${deckPanelMarkup()}
      <section class="deck-pool">
        <div class="deck-pool__head">
          <div>
            <span class="section-eyebrow">THE CARD ARCHIVE</span>
            <h1>牌库</h1>
            <p>${esc(origin.name)}的试炼由你重新定义。最多 30 张，至少 8 张。</p>
          </div>
          <span class="deck-pool__origin" style="--origin:${safeColor(origin.color)}">${esc(origin.sigil)} ${esc(origin.name)}</span>
        </div>
        ${poolMarkup()}
      </section>
    </main>
  </div>`;
}
