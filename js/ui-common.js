import { RARITY_INFO, SCHOOLS, STATUS_INFO, TYPE_INFO } from './data.js';
import { G, getCardDef, getEnemySkin } from './state.js';
import { cardArt, cardIndex } from './card-art.js';
import { keywordText } from './keywords.js';
import { CHORUS_TIER_MINS, resonanceEffectText, resonanceTitle, tierLabel } from './resonance.js';
import {
  esc,
  icon,
  resolveCard,
  safeColor,
} from './utils.js';

const SCHOOL_LATIN = {
  blade: 'BLADE',
  star: 'STAR',
  shadow: 'SHADE',
  ember: 'EMBER',
  thorn: 'THORN',
  dream: 'DREAM',
};

export function imageTag(src, fallback, alt = '', className = '', lazy = true) {
  return `<img class="${className}" src="${esc(src)}" data-fallback="${esc(fallback)}" alt="${esc(alt)}" ${lazy ? 'loading="lazy"' : ''} decoding="async">`;
}

export function cardMarkup(input, options = {}) {
  const card = input?.description !== undefined ? input : resolveCard(input);
  if (!card) return '';
  const tag = options.tag || 'button';
  const tagIsButton = tag === 'button';
  const actionAttrs = options.action
    ? `data-action="${esc(options.action)}" ${options.attrs || ''}`
    : (options.attrs || '');
  const classes = [
    'game-card',
    options.mini ? 'game-card--mini' : '',
    options.className || '',
    options.disabled ? 'is-disabled' : '',
    options.unaffordable ? 'is-unaffordable' : '',
    options.sealed ? 'is-sealed' : '',
    card.custom ? 'game-card--custom' : '',
  ].filter(Boolean).join(' ');
  const type = TYPE_INFO[card.type] || TYPE_INFO.skill;
  const rarity = RARITY_INFO[card.rarity] || RARITY_INFO.custom;
  const flavor = options.showFlavor && card.flavor
    ? `<span class="game-card__flavor">${esc(card.flavor)}</span>`
    : '';
  const badge = options.badge
    ? `<span class="game-card__badge">×${options.badge}</span>`
    : '';
  const exhaust = card.exhaust ? '<span class="game-card__exhaust">消耗</span>' : '';
  const hint = options.hint
    ? `<span class="game-card__hint">${icon('flame', 9)} <span>${esc(options.hint)}</span></span>`
    : '';
  const preview = options.preview
    ? `<span class="game-card__forecast ${options.preview.lethal ? 'is-lethal' : ''}" title="${esc(`按当前状态预计：造成 ${options.preview.hpLoss} 点生命伤害${options.preview.blocked ? `，其中 ${options.preview.blocked} 被格挡` : ''}${options.preview.pierce ? `，另有 ${options.preview.pierce} 点无视格挡` : ''}${options.preview.lethal ? '，足以击败敌人' : ''}`)}">
        ${icon('sword', 10)} <span>预计 ${options.preview.hpLoss}</span>
        ${options.preview.blocked > 0 ? `<small>挡 ${options.preview.blocked}</small>` : ''}
        ${options.preview.lethal ? '<small class="is-lethal">击杀</small>' : ''}
      </span>`
    : '';
  const glyph = card.glyph || [...(card.name || '梦')][0] || '梦';
  const accent = safeColor(card.accent || card.palette || type.color);
  const rarityColor = safeColor(card.rarityColor || rarity.color);
  const school = SCHOOLS[card.school] || SCHOOLS.dream;
  const latin = SCHOOL_LATIN[card.school] || 'DREAM';
  const typeIcon = icon(card.type === 'attack' ? 'sword' : 'shield', 10);
  return `<${tag} ${tagIsButton ? 'type="button"' : ''} class="${classes}" data-card-id="${esc(card.id || '')}" data-upgraded="${card.upgraded ? 'true' : 'false'}" ${tagIsButton ? actionAttrs : ''} data-school="${esc(card.school || 'dream')}" data-school-label="${esc(school.name)}" style="--accent:${accent};--rarity:${rarityColor};--school:${safeColor(school.color)}" title="${esc(`${card.displayName || card.name} · ${card.description}`)}" aria-label="${esc(`${card.displayName || card.name}，${card.cost} 费，${school.name}流派，${card.description.replace(/[。！？!?.]$/, '')}${options.sealed ? '，本回合被雾封' : ''}`)}">
    <span class="game-card__inner">
      ${options.sealed ? `<span class="game-card__sealed" aria-hidden="true"><i>封</i><small>名字被雾借走</small></span>` : ''}
      <span class="game-card__shine" aria-hidden="true"></span>
      <span class="game-card__top">
        <span class="game-card__cost">${Number(card.cost) || 0}</span>
        <span class="game-card__rarity">${esc(rarity.name || '造物')}</span>
        ${badge}
      </span>
      <span class="game-card__art">
        ${cardArt(card)}
        <span class="game-card__art-shade"></span>
        <span class="game-card__school"><b>${esc(school.name)}</b><small>${latin}</small></span>
        <span class="game-card__index">NO.${cardIndex(card)}</span>
        <span class="game-card__seal" aria-hidden="true"><i>${esc(glyph)}</i></span>
      </span>
      <span class="game-card__name-row"><i></i><span class="game-card__name">${esc(card.displayName || card.name)}</span><i></i></span>
      <span class="game-card__type" data-school-label="${esc(school.name)}">${typeIcon}${esc(type.name)}${exhaust}</span>
      <span class="game-card__rule"></span>
      ${hint}
      <span class="game-card__desc">${keywordText(card.description)}</span>
      ${preview}
      ${flavor}
    </span>
  </${tag}>`;
}

export function statusPills(statuses = {}, extraClass = '') {
  return Object.entries(statuses)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([status, amount]) => {
      const info = STATUS_INFO[status];
      if (!info) return '';
      return `<span class="status-pip ${extraClass}" style="--status:${safeColor(info.color)}" title="${esc(`${info.name}：${info.desc}`)}">
        <span class="status-pip__glyph">${esc(info.glyph)}</span><span class="status-pip__value">${amount}</span>
      </span>`;
    })
    .join('');
}

export function resonanceChip(resonance, options = {}) {
  const primary = resonance?.primary;
  const chorus = !primary && resonance?.chorus?.active ? resonance.chorus : null;
  if (!primary && !chorus) return '';
  const color = primary ? resonance.school.color : chorus.color;
  const tag = primary ? resonance.info.tag : chorus.tag;
  const tier = primary ? resonance.tier : chorus.tier;
  const value = primary ? resonance.value : chorus.value;
  const sub = primary ? `${resonance.school.name} ${tierLabel(tier)}` : `万象 ${tierLabel(tier)}`;
  return `<span class="resonance-chip resonance-chip--t${tier} ${options.compact ? 'resonance-chip--compact' : ''}" style="--resonance:${safeColor(color)}" title="${esc(`${resonanceTitle(resonance)} · ${resonanceEffectText(resonance)}`)}">
    <span class="resonance-chip__sigil">${esc(tag[0])}</span>
    <span class="resonance-chip__copy"><strong>${esc(tag)}</strong><small>${esc(sub)}</small></span>
    <b class="resonance-chip__value">${value > 0 ? `+${value}` : value}</b>
  </span>`;
}

export function resonancePanel(resonance, options = {}) {
  const primary = resonance?.primary;
  const school = resonance?.school;
  const info = resonance?.info;
  const chorus = !primary && resonance?.chorus?.active ? resonance.chorus : null;
  const count = resonance?.count || 0;
  const tier = resonance?.tier || 0;
  const next = resonance?.next;
  const lit = Boolean(primary || chorus);
  const accent = primary ? school.color : (chorus ? chorus.color : '#8b7c6c');
  const percent = primary
    ? Math.min(100, (count / Math.max(next || count, 1)) * 100)
    : chorus
      ? Math.min(100, (chorus.min / CHORUS_TIER_MINS[2]) * 100)
      : Math.min(100, (count / 4) * 100);
  const foot = primary
    ? (next ? `再 ${resonance.remaining} 张升至 ${tierLabel(tier + 1)}` : '已达最高共鸣')
    : chorus
      ? (chorus.tier >= 3 ? '已达最高混响' : `再让最少的流派补 ${chorus.remaining} 张，升至 ${tierLabel(chorus.tier + 1)}`)
      : `再 ${Math.max(0, resonance.remaining || 0)} 张点亮共鸣`;
  const schools = (resonance?.ranked || [])
    .map((row) => {
      const hot = row.id === primary || row.id === resonance?.secondary?.id || (chorus && chorus.schools.includes(row.id));
      return `<span class="resonance-school ${hot ? 'is-primary' : ''}" style="--school:${safeColor(row.color)}" title="${esc(`${row.name}：${row.count} 张`)}">
      <i>${esc(row.name[0])}</i><b>${row.count}</b>
    </span>`;
    })
    .join('');
  const heroSigil = primary ? info.tag[0] : (chorus ? chorus.tag[0] : '梦');
  const heroTitle = primary ? `${esc(school.name)} · ${esc(info.tag)}` : (chorus ? '混响 · 万象' : '六种流派仍在沉睡');
  const tierText = primary ? `共鸣 ${tierLabel(tier)}` : (chorus ? `混响 ${tierLabel(chorus.tier)}` : '尚未共鸣');
  const footCount = primary ? `${count} 张同流派` : (chorus ? `${chorus.schools.length} 个流派` : `最高 ${count} 张`);
  return `<section class="resonance-panel ${lit ? 'is-lit' : 'is-dormant'} ${options.className || ''}" style="--resonance:${safeColor(accent)}">
    <div class="resonance-panel__head">
      <span class="resonance-panel__eyebrow">${esc(options.eyebrow || 'SCHOOL RESONANCE · 流派共鸣')}</span>
      <span class="resonance-panel__tier">${tierText}</span>
    </div>
    <div class="resonance-panel__hero">
      <span class="resonance-panel__sigil">${esc(heroSigil)}</span>
      <div class="resonance-panel__copy">
        <strong>${heroTitle}</strong>
        <p>${esc(resonanceEffectText(resonance))}</p>
        ${resonance?.secondary ? `<p class="resonance-panel__secondary">副流派 · ${esc(resonance.secondary.name)}「${esc(resonance.secondary.tag)}」：${esc(resonance.secondary.info.effect.replaceAll('{v}', String(resonance.secondary.value)))}</p>` : ''}
      </div>
    </div>
    <div class="resonance-panel__bar"><span style="width:${percent}%"></span></div>
    <div class="resonance-panel__foot">
      <span>${footCount}</span>
      <small>${foot}</small>
    </div>
    <div class="resonance-schools">${schools}</div>
  </section>`;
}

export function relicChip(relic, options = {}) {
  if (!relic) return '';
  const title = `${relic.name} · 已装备：${relic.desc}${relic.rite ? `（${relic.rite}）` : ''}`;
  return `<span class="relic-chip ${options.compact ? 'relic-chip--compact' : ''} ${options.className || ''}" data-relic-id="${esc(relic.id)}" data-fx="${esc(relic.fx || 'relic')}" style="--relic:${safeColor(relic.color)}" title="${esc(title)}">
    <span class="relic-chip__glyph">${esc(relic.glyph)}</span>
    ${options.compact ? '' : `<span class="relic-chip__name">${esc(relic.name)}</span>`}
    ${options.equipped ? `<span class="relic-chip__equipped">已装备</span>` : ''}
  </span>`;
}

export function intentInfo(move, preview = null) {
  if (!move) return { icon: 'eye', title: '凝望', summary: '正在观察你', detail: '尚未显露意图。' };
  const pieces = [];
  const hits = Math.max(1, Number(move.hits) || 1);
  if (move.damage) {
    if (preview && Number.isFinite(Number(preview.total))) {
      const blockNote = preview.blocked > 0 ? `（格挡 ${preview.blocked}）` : '';
      const hpNote = preview.hpLoss > 0 ? `失去 ${preview.hpLoss}` : '全部挡下';
      pieces.push(`攻击 ${preview.total}${blockNote} · ${hpNote}`);
    } else {
      pieces.push(hits > 1 ? `攻击 ${move.damage}×${hits}` : `攻击 ${move.damage}`);
    }
  }
  if (move.block) pieces.push(`格挡 ${move.block}`);
  if (move.heal) pieces.push(`回复 ${move.heal}`);
  if (move.playerStatus) {
    const info = STATUS_INFO[move.playerStatus.status];
    if (info) pieces.push(`${info.name} ${move.playerStatus.amount}`);
  }
  if (move.selfStatus) {
    const info = STATUS_INFO[move.selfStatus.status];
    if (info) pieces.push(`自身${info.name} ${move.selfStatus.amount}`);
  }
  if (move.stealCard) pieces.push('借走 1 张牌');
  if (move.stealStatus) {
    const info = STATUS_INFO[move.stealStatus.status];
    if (info) pieces.push(`夺取你的${info.name} ${move.stealStatus.amount}`);
  }
  let iconName = 'eye';
  if (move.damage && move.playerStatus) iconName = 'skull';
  else if (move.damage) iconName = 'sword';
  else if (move.selfStatus || move.block) iconName = 'up';
  else if (move.playerStatus) iconName = 'eye';
  const lethal = preview?.lethal ? ' 这一击足以让你倒下。' : '';
  return {
    icon: iconName,
    title: move.name,
    summary: pieces.join(' · ') || '正在酝酿某个举动',
    detail: `${move.intent || ''}${lethal}`,
  };
}

export function groupDeck(entries = []) {
  const groups = new Map();
  for (const entry of entries) {
    const defId = typeof entry === 'string' ? entry : entry.defId;
    const upgraded = Boolean(entry?.upgraded);
    const key = `${defId}${upgraded ? '+' : ''}`;
    const def = getCardDef(defId);
    if (!def) continue;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        defId,
        upgraded,
        count: 0,
        card: resolveCard(def, upgraded),
      });
    }
    groups.get(key).count += 1;
  }
  return [...groups.values()];
}

export function deckCount(entries = []) {
  return entries.length;
}

export function enemyVisual(enemyId) {
  const skin = getEnemySkin(enemyId);
  return {
    ...skin,
    alt: skin.name,
  };
}

export function progressBar(current, max, className = '') {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return `<span class="progress ${className}"><span class="progress__fill" style="width:${percent}%"></span></span>`;
}

export function topbarMuteButton() {
  const muted = Boolean(G.profile?.settings?.muted);
  return `<button type="button" class="icon-button ${muted ? 'is-active' : ''}" data-action="toggle-mute" title="${muted ? '开启音乐与音效' : '关闭音乐与音效'}" aria-label="${muted ? '开启音乐与音效' : '关闭音乐与音效'}">${icon(muted ? 'mute' : 'volume', 18)}</button>`;
}

export function screenBackButton(action, label = '返回') {
  return `<button type="button" class="pagebar__back" data-action="${esc(action)}">${icon('left', 18)}<span>${esc(label)}</span></button>`;
}

export function emptyState(iconName, title, text, actionMarkup = '') {
  return `<div class="empty-state">
    <span class="empty-state__icon">${icon(iconName, 30)}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${actionMarkup}
  </div>`;
}

export function glyphCard(card, extraClass = '') {
  return `<span class="glyph-card ${extraClass}" style="--accent:${safeColor(card?.accent || '#9b78c7')}">
    <span class="glyph-card__glyph">${esc(card?.glyph || '梦')}</span>
    <span class="glyph-card__name">${esc(card?.displayName || card?.name || '未知')}</span>
  </span>`;
}
