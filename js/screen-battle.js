import { ENEMY_MAP, ITEM_MAP, ORIGINS, ORIGIN_MAP, RELIC_MAP, SCHOOLS, findAwakening } from './data.js';
import {
  currentEnemyMove,
  getBattleCard,
  isCardSealed,
  lineageInfo,
  mechanicInfo,
  parleyProfile,
  previewCardDamage,
  previewEnemyAttack,
  surgeInfo,
} from './engine.js';
import { REGION_MAP } from './lore.js';
import { ascensionLevel } from './ascension.js';
import { CHORUS_INFO } from './resonance.js';
import { portraitArt } from './live-art.js';
import { isPhaseArtRevealed } from './phase-art.js';
import { bossGaugeMarkup } from './boss-gauge.js';
import { G, getCardDef, getHeroName } from './state.js';
import {
  cardMarkup,
  imageTag,
  intentInfo,
  progressBar,
  relicChip,
  resonanceChip,
  statusPills,
  topbarMuteButton,
} from './ui-common.js';
import {
  esc,
  icon,
  resolveCard,
  safeColor,
} from './utils.js';

const TIER_LABEL = { normal: '游荡梦魇', elite: '镜中精英', boss: '梦魇之主', merchant: '携宝行商' };
const PHASE_FX_KINDS = new Set(['ember', 'shard', 'ash', 'paper', 'dawn']);

function phaseCardFxMarkup(phase2) {
  const kind = PHASE_FX_KINDS.has(phase2?.fx) ? phase2.fx : 'ember';
  const particles = Array.from({ length: 26 }, (_, index) => {
    const x = 5 + ((index * 37) % 90);
    const y = kind === 'ash'
      ? 6 + ((index * 61) % 68)
      : kind === 'shard'
        ? 8 + ((index * 61) % 80)
        : 20 + ((index * 61) % 74);
    const size = kind === 'shard'
      ? 5 + (index % 3) * 2
      : kind === 'paper'
        ? 3.4 + (index % 3) * 1.3
        : 2.4 + (index % 4) * 0.7;
    const delay = -(((index * 29) % 148) / 10);
    const duration = kind === 'shard'
      ? 8 + ((index * 13) % 6)
      : kind === 'ember'
        ? 5.4 + ((index * 13) % 5)
        : kind === 'ash'
          ? 6.2 + ((index * 13) % 4)
          : kind === 'paper'
            ? 6 + ((index * 13) % 4)
            : 5 + ((index * 13) % 4);
    const drift = (index % 2 ? -1 : 1) * (10 + ((index * 17) % 30));
    const opacity = 0.55 + ((index * 19) % 38) / 100;
    const rotate = (index * 47) % 360;
    return `<i style="--x:${x}%;--y:${y}%;--s:${size.toFixed(1)}px;--delay:${delay}s;--dur:${duration}s;--dx:${drift}px;--o:${opacity.toFixed(2)};--rot:${rotate}deg"></i>`;
  }).join('');
  return `<span class="phase-card-fx phase-card-fx--${kind}" aria-hidden="true">${particles}</span>`;
}

function mechanicHintFor(battle, card) {
  const origin = battle.origin;
  if (!origin || !Number(origin.max)) return '';
  const value = Number(origin.value) || 0;
  const max = Number(origin.max) || 0;
  let step = 0;
  if (origin.id === 'combo') step = card.type === 'attack' ? 1 : 0;
  else if (origin.id === 'starTrack') step = card.type === 'skill' ? 1 : 0;
  else if (origin.id === 'laugh') step = 1;
  else if (origin.id === 'bloom') step = (card.effects || []).reduce((n, effect) => n + (effect.status === 'poison' ? Number(effect.amount) || 0 : 0), 0);
  else if (origin.id === 'heat') step = (card.effects || []).reduce((n, effect) => n + (effect.status === 'burn' ? Number(effect.amount) || 0 : 0), 0);
  if (!step) return '';
  const need = max - value;
  const unit = (origin.id === 'bloom' || origin.id === 'heat') ? '点' : '张';
  if (step >= need) return `打出即触发「${origin.name}」`;
  return `再 ${need - step} ${unit}触发「${origin.name}」`;
}

function renderHand(battle) {
  if (!battle.hand.length) {
    return `<div class="hand-empty">${icon('cards', 24)}<span>手中无牌，结束回合以继续。</span></div>`;
  }
  const playLimit = Math.max(0, Number(battle.rules?.cardPlayLimit) || 0);
  const playsUsed = Number(battle.rules?.cardsPlayedThisTurn) || 0;
  const limitReached = playLimit > 0 && playsUsed >= playLimit;
  const tideDiscount = Math.max(0, Number(battle.rules?.tideDiscount) || 0);
  const pageDiscount = battle.rules?.firstCardDiscountUsed
    ? 0
    : Math.max(0, Number(battle.rules?.firstCardDiscount) || 0);
  return battle.hand.map((instance, index) => {
    const card = getBattleCard(instance, battle);
    if (!card) return '';
    const sealed = isCardSealed(battle, instance.uid);
    // 每座岛的「卡牌规则」都要能在牌面上看出来，
    // 否则玩家只觉得「我伤害怎么变低了」，而不是「它在针对我」。
    const silenced = Boolean(battle.rules?.silenceSchool) && card.school === battle.rules.silenceSchool;
    const burning = Boolean(battle.rules?.burnPlayed) && card.type === 'attack' && battle.rules.burnTurn !== battle.turn;
    const dross = card.type === 'status';
    const preview = !sealed && battle.phase === 'player' ? previewCardDamage(battle, instance) : null;
    const discount = tideDiscount + pageDiscount;
    const displayCard = discount > 0 ? { ...card, cost: Math.max(0, card.cost - discount) } : card;
    const hint = limitReached
      ? `纸冠已合拢 · 本回合最多 ${playLimit} 张`
      : pageDiscount > 0
        ? `折页：本张费用 -${pageDiscount}`
        : mechanicHintFor(battle, card);
    return cardMarkup(displayCard, {
      action: sealed ? null : 'play-card',
      attrs: `data-uid="${esc(instance.uid)}" data-hand-index="${index}"`,
      unaffordable: !sealed && !limitReached && displayCard.cost > battle.player.energy,
      disabled: sealed || limitReached,
      sealed,
      preview,
      hint: !sealed && battle.phase === 'player' ? hint : '',
      className: `hand-card game-card--hand ${sealed ? 'is-sealed' : ''} ${silenced ? 'is-silenced' : ''} ${burning ? 'is-burning' : ''} ${dross ? 'is-dross' : ''} ${limitReached ? 'is-limit-locked' : ''}`,
    });
  }).join('');
}

function renderItemBag(battle) {
  if (battle.mode !== 'adventure') return '';
  const items = G.run?.items || [];
  const groups = [];
  const seen = new Map();
  for (const id of items) {
    const item = ITEM_MAP[id];
    if (!item) continue;
    if (!seen.has(id)) {
      const entry = { item, count: 0 };
      seen.set(id, entry);
      groups.push(entry);
    }
    seen.get(id).count += 1;
  }
  const muted = Boolean(battle.rules?.noItems);
  const mutedByDream = battle.rules?.noItemsSource === 'ascension';
  const mutedLabel = mutedByDream ? '梦层封住了行囊' : '缄口契约封住了行囊';
  const disabled = battle.phase !== 'player' || muted;
  return `<div class="dock-bag ${groups.length ? '' : 'is-empty'} ${muted ? 'is-muted' : ''}">
    <span class="dock-bag__label">${icon(muted ? 'lock' : 'drop', 13)}<span>行囊</span><small>${items.length}/10</small></span>
    <div class="dock-bag__slots">
      ${groups.length ? groups.map(({ item, count }) => `<button type="button" class="item-slot" data-action="use-item" data-item="${esc(item.id)}" style="--item:${safeColor(item.color)}" title="${esc(muted ? `${mutedLabel}，这一场无法使用旅途道具` : `${item.name} ×${count} · ${item.desc}`)}" aria-label="${esc(`使用${item.name}：${item.desc}`)}" ${disabled ? 'disabled' : ''}>
        <span class="item-slot__glyph">${esc(item.glyph)}</span>
        <span class="item-slot__name">${esc(item.name)}</span>
        ${count > 1 ? `<span class="item-slot__count">×${count}</span>` : ''}
      </button>`).join('') : '<span class="dock-bag__empty">行囊空空。行商与宝箱里也许有好东西。</span>'}
    </div>
    <span class="dock-bag__hint">${muted ? mutedLabel : '点击使用 · 不消耗能量'}</span>
  </div>`;
}

function renderMutationChips(battle) {
  const mutations = Array.isArray(battle.mutations) ? battle.mutations : [];
  if (!mutations.length) return '';
  return `<span class="battle-mutations">${mutations.map((mutation) => `<span class="battle-mutations__chip" style="--mutation:${safeColor(mutation.color)}" title="${esc(`${mutation.name}：${mutation.desc}`)}"><b>${esc(mutation.glyph)}</b>${esc(mutation.name)}</span>`).join('')}</span>`;
}

function renderContractChips(battle) {
  const contracts = Array.isArray(battle.contracts) ? battle.contracts : [];
  if (!contracts.length) return '';
  return `<span class="battle-contracts" aria-label="梦呓契约">${contracts.map((contract) => `<span class="battle-contracts__chip" style="--contract:${safeColor(contract.color)}" title="${esc(`${contract.name}：${contract.desc}`)}"><b>${esc(contract.glyph)}</b>${esc(contract.name)}</span>`).join('')}</span>`;
}

function renderAscensionChips(battle) {
  const level = Number(battle.ascension) || 0;
  if (level <= 0) return '';
  const entry = ascensionLevel(level);
  return `<span class="battle-ascension" aria-label="梦境层级">
    <span class="battle-ascension__chip" style="--ascension:${safeColor(entry.color)}" title="${esc(`梦境层级 ${entry.level}「${entry.name}」：${entry.detail}`)}"><b>层</b>${entry.level} · ${esc(entry.name)}</span>
    ${entry.trial ? `<span class="battle-ascension__trial" style="--ascension:${safeColor(entry.color)}" title="${esc(`梦律【${entry.trial}】：${entry.trialDesc}`)}"><b>${esc(entry.trialGlyph)}</b>${esc(entry.trial)}</span>` : ''}
  </span>`;
}

function renderLog(battle) {
  const logs = battle.log.slice(-3).reverse();
  if (!logs.length) return '<span class="battle-log__empty">梦还没开始说话。</span>';
  return logs.map((entry, index) => `<div class="battle-log__line battle-log__line--${esc(entry.type)} ${index === 0 ? 'is-latest' : ''}">
    <span class="battle-log__mark"></span><span>${esc(entry.text)}</span>
  </div>`).join('');
}

function stageParticles() {
  return Array.from({ length: 18 }, (_, index) => {
    const left = (index * 37 + 11) % 100;
    const top = (index * 53 + 23) % 100;
    const size = 1 + (index % 4);
    return `<i style="--left:${left}%;--top:${top}%;--size:${size}px;--delay:${(index % 9) * 0.9}s;--dur:${9 + (index % 7) * 2.2}s"></i>`;
  }).join('');
}

function phaseEmbers() {
  return Array.from({ length: 24 }, (_, index) => {
    const left = (index * 37 + 9) % 100;
    const size = 2 + (index % 3) * 1.6;
    return `<i style="--left:${left}%;--size:${size}px;--delay:${(index % 12) * 0.62}s;--dur:${6.5 + (index % 6) * 1.4}s;--drift:${((index % 5) - 2) * 18}px"></i>`;
  }).join('');
}

function renderIntent(battle) {
  const preview = previewEnemyAttack(battle);
  const intent = intentInfo(currentEnemyMove(battle), preview);
  return `<div class="intent-card stage-intent ${preview?.lethal ? 'is-lethal' : ''}" title="${esc(intent.detail)}">
    <span class="intent-card__icon">${icon(intent.icon, 21)}</span>
    <span class="intent-card__copy">
      <small>下个意图</small>
      <strong>${esc(intent.title)}</strong>
      <span>${esc(intent.summary)}</span>
    </span>
  </div>`;
}

function renderEnemyActor(battle) {
  const enemyDef = ENEMY_MAP[battle.enemy.defId];
  const defaultImage = enemyDef?.image || battle.enemy.image;
  const tier = battle.tier || enemyDef?.tier || 'normal';
  const tierClass = ['normal', 'elite', 'boss', 'merchant'].includes(tier) ? tier : 'normal';
  const phase = Number(battle.enemy.phase) || 1;
  const phase2 = battle.enemy.phase2;
  const phaseTitle = battle.enemy.phaseTitle || phase2?.title;
  const phaseTwo = phase >= 2 && Boolean(phase2);
  const phaseAwake = phaseTwo && isPhaseArtRevealed(battle);
  const gauge = bossGaugeMarkup(battle);
  const phaseImage = phaseAwake && phase2?.image ? phase2.image : battle.enemy.image;
  const mech = mechanicInfo(battle);
  const lineage = lineageInfo(battle);
  const surge = surgeInfo(battle);
  const lineagePercent = lineage?.meter && lineage.meter.max > 0
    ? Math.max(0, Math.min(100, (lineage.meter.value / lineage.meter.max) * 100))
    : 0;
  const phaseStyle = phaseAwake
    ? `--phase-color:${safeColor(phase2?.color || '#e0945d')}`
    : surge?.active
      ? `--phase-color:${safeColor(battle.enemy.accent || '#d06a60')}`
      : '';
  const quote = phaseAwake && phase2?.line ? phase2.line : enemyDef?.quote;
  const rage = battle.parley?.outcome === 'rage';
  const parleySuccess = battle.parley?.outcome === 'success';
  const meter = mech?.meter;
  const meterPercent = meter && meter.max > 0 ? Math.max(0, Math.min(100, (meter.value / meter.max) * 100)) : 0;
  const boss = tierClass === 'boss';
  const presenceSrc = boss ? (phaseImage || defaultImage || '') : '';
  return `<div class="stage-actor stage-actor--enemy stage-actor--tier-${tierClass} ${phaseAwake ? 'is-phase-two' : ''} ${phaseAwake ? 'is-phase-two-awake' : ''} ${surge?.active ? 'is-surging' : ''} ${rage ? 'is-enraged' : ''} ${mech ? 'has-mechanic' : ''} ${lineage ? 'has-lineage' : ''}" data-figure="enemy" data-float-target="enemy" style="${phaseStyle}">
    ${presenceSrc ? `<span class="boss-presence" aria-hidden="true"><img src="${esc(presenceSrc)}" alt="" decoding="async"></span>` : ''}
    <span class="actor-aura actor-aura--enemy"></span>
    ${phaseAwake ? '<span class="actor-phase-aura" aria-hidden="true"></span>' : ''}
    <span class="actor-runes actor-runes--enemy" aria-hidden="true"></span>
    <figure class="actor-portal actor-portal--enemy ${phaseAwake ? 'actor-portal--phase-two' : ''}">
      <span class="actor-portal__halo"></span>
      ${phaseAwake ? '<span class="actor-portal__phase-ring" aria-hidden="true"></span>' : ''}
      <span class="actor-portal__frame">
        ${portraitArt(phaseImage, battle.enemy.name, defaultImage)}
        <span class="actor-portal__veil"></span>
        <span class="actor-portal__sheen"></span>
        ${phaseAwake ? '<span class="actor-portal__glare" aria-hidden="true"></span>' : ''}
        ${phaseAwake ? phaseCardFxMarkup(phase2) : ''}
        ${phaseAwake ? '<span class="actor-portal__phase-veil"></span>' : ''}
        ${rage ? '<span class="actor-portal__rage-veil"></span>' : ''}
        ${phaseAwake ? '<span class="actor-portal__phase-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : ''}
        ${phaseAwake ? `<span class="actor-portal__phase-seal">${esc(phaseTitle || '真形')}</span>` : ''}
      </span>
      <span class="actor-portal__sigil">${esc(battle.enemy.glyph || '魇')}</span>
      <span class="actor-portal__base"></span>
    </figure>
    <span class="actor-groundshadow"></span>
    <div class="actor-plate actor-plate--enemy ${boss ? 'actor-plate--boss' : ''}">
      <div class="actor-plate__eyebrow">
        <span class="${boss ? 'actor-plate__tier' : ''}">${boss ? icon('crown', 12) : ''}${esc(TIER_LABEL[tier] || '梦魇')}</span>
        <span class="actor-plate__marks">
          ${boss ? '<span class="actor-boss-tag">BOSS</span>' : ''}
          ${phaseAwake ? `<span class="actor-phase-chip" title="旧梦已经裂开，它露出了真形">${icon('flame', 11)} ${esc(phaseTitle || '真形')}</span>` : ''}
          ${surge?.active ? `<span class="actor-surge-chip" title="梦魇规则暴走：${esc(surge.line || surge.title)}">${icon('flame', 11)} ${esc(surge.title)}</span>` : ''}
          ${rage ? `<span class="actor-rage-chip" title="交涉破裂：攻击提升，破绽变大">${icon('flame', 11)} 激怒</span>` : ''}
          ${parleySuccess ? `<span class="actor-parley-chip" title="它没有退让，但杀意出现了一道缝">${icon('users', 11)} 迟疑</span>` : ''}
          ${battle.enemy.block > 0 ? `<span class="combat-block combat-block--enemy" title="格挡">${icon('shield', 13)} ${battle.enemy.block}</span>` : ''}
        </span>
      </div>
      <div class="actor-name-line">
        <h1>${esc(battle.enemy.name)}</h1>
        ${gauge ? '' : `<span class="actor-hp-label">${icon('heart', 13)} <strong>${battle.enemy.hp}</strong><small> / ${battle.enemy.maxHp}</small></span>`}
      </div>
      ${gauge || `<span class="progress progress--enemy actor-progress ${phaseAwake ? 'is-phase-two' : ''}">
        <span class="progress__fill" style="width:${battle.enemy.maxHp > 0 ? Math.max(0, Math.min(100, (battle.enemy.hp / battle.enemy.maxHp) * 100)) : 0}%"></span>
      </span>`}
      <div class="actor-status-row">${statusPills(battle.enemy.statuses)}</div>
      ${mech ? `<div class="mechanic-chip" style="--mechanic:${safeColor(battle.enemy.accent || '#c0955b')}" title="${esc(`${mech.name}：${mech.desc}`)}">
        <span class="mechanic-chip__glyph">${esc(mech.glyph)}</span>
        <span class="mechanic-chip__copy"><strong>${esc(mech.name)}</strong><small>${esc(mech.detail)}</small></span>
        ${meter ? `<span class="mechanic-chip__meter" aria-hidden="true"><i style="width:${meterPercent}%"></i></span>` : ''}
      </div>` : ''}
      ${lineage ? `<div class="mechanic-chip lineage-chip" style="--mechanic:${safeColor(lineage.color || battle.enemy.accent || '#c0955b')}" title="${esc(`${lineage.name}：${lineage.desc}`)}">
        <span class="mechanic-chip__glyph">${esc(lineage.glyph)}</span>
        <span class="mechanic-chip__copy"><strong>${esc(lineage.name)} · 谱系</strong><small>${esc(lineage.detail)}</small></span>
        ${lineage.meter ? `<span class="mechanic-chip__meter" aria-hidden="true"><i style="width:${lineagePercent}%"></i></span>` : ''}
      </div>` : ''}
      ${counterRulesMarkup(battle)}
      <p class="actor-quote">${esc(quote || '')}</p>
    </div>
  </div>`;
}

/**
 * 反制规则条。
 *
 * 开打前后期首领才会亮起来，因为这三条规则只在二阶段出现。
 * 必须显示：规则一旦变了，玩家要立刻知道自己该换打法，
 * 而不是打到第十回合才发现「怎么血回不上来」。
 */
function counterRulesMarkup(battle) {
  const rules = battle?.rules || {};
  const chips = [];
  if (rules.noHeal) chips.push({ key: 'noheal', glyph: '断', name: '禁疗', desc: '本场战斗无法回复生命。' });
  if (rules.reflectPct > 0) chips.push({ key: 'reflect', glyph: '震', name: `反震 ${Math.round(rules.reflectPct * 100)}%`, desc: '你的直接攻击会按此比例弹回自己；毒与灼烧不受反震。' });
  if (rules.echoBreak) chips.push({ key: 'break', glyph: '剪', name: '拆牌', desc: '每个回合开始时，它弃掉你手中费用最高的一张牌。' });
  if (rules.burnPlayed) chips.push({ key: 'burn', glyph: '焚', name: '焚牌', desc: '每个你的回合，打出的第一张攻击牌会被炉火吞掉；速杀才能少损失牌。' });
  if (rules.silenceSchool) chips.push({ key: 'silence', glyph: '缄', name: '缄默', desc: '它学会了你的主导流派：该派攻击伤害 -30%，共鸣降至 I 档。' });
  if (!chips.length) return '';
  return `<div class="counter-rules" aria-label="当前战斗的反制规则">
    <span class="counter-rules__label">${icon('flame', 11)} 反制</span>
    ${chips.map((chip) => `<span class="counter-chip counter-chip--${chip.key}" title="${esc(chip.desc)}"><i>${esc(chip.glyph)}</i>${esc(chip.name)}</span>`).join('')}
  </div>`;
}

function originMechanicDetail(battle) {
  const origin = battle.origin;
  if (!origin) return '';
  if (origin.id === 'combo') return `本回合攻击 ${origin.value}/${origin.max} · 触发：力量 +1`;
  if (origin.id === 'starTrack') return `技能牌 ${origin.value}/${origin.max} · 触发：能量 +1、敏捷 +1`;
  if (origin.id === 'bloom') return `蚀印 ${origin.value}/${origin.max} · 引爆：中毒 ×${2 + (Number(origin.mods?.burstMultiplier) || 0)}`;
  if (origin.id === 'heat') return `焚心 ${origin.value}/${origin.max} · 触发：力量 +2、能量 +1`;
  return `${origin.value}/${origin.max}`;
}

function renderOriginChip(battle) {
  const origin = battle.origin;
  if (!origin) return '';
  const awakenings = (G.run?.originAwakening || []).map((id) => findAwakening(id)).filter(Boolean);
  const tip = [`${origin.name}：${origin.desc}`, ...awakenings.map((item) => `觉醒·${item.name}：${item.desc}`)].join('\n');
  const pips = Array.from({ length: origin.max }, (_, index) => (
    `<i class="${index < origin.value ? 'is-lit' : ''}"></i>`
  )).join('');
  return `<div class="origin-chip" style="--origin-color:${safeColor(battle.player.accent || '#c2a46d')}" title="${esc(tip)}">
    <span class="origin-chip__glyph">${esc(origin.glyph)}</span>
    <span class="origin-chip__copy">
      <span class="origin-chip__head"><strong>${esc(origin.name)}</strong>${awakenings.length ? `<em>觉醒 ${awakenings.length}</em>` : ''}</span>
      <small>${esc(originMechanicDetail(battle))}</small>
    </span>
    <span class="origin-chip__pips" aria-label="机制进度 ${origin.value}/${origin.max}">${pips}</span>
  </div>`;
}

function scarSummary(scars) {
  return scars.map((scar) => `${scar.regionName || '梦'} · 第 ${scar.turn || 1} 回合 · 生命上限 -${scar.hpCost || 5}`).join('\n');
}

function renderScarRow(battle) {
  if (battle.mode !== 'adventure') return '';
  const scars = Array.isArray(G.run?.scars) ? G.run.scars : [];
  const pending = Boolean(battle.lastStand?.costPending);
  if (!scars.length && !pending) return '';
  return `<div class="actor-scar-row">
    ${pending ? `<span class="actor-scar actor-scar--debt" title="你已经向梦借了一口气，胜利或撤退时生命上限 -5">${icon('heart', 12)} 借气待偿</span>` : ''}
    ${scars.length ? `<span class="actor-scar" title="${esc(scarSummary(scars))}">${icon('heart', 12)} 梦痕 ×${scars.length}</span>` : ''}
  </div>`;
}

function renderHeroActor(battle) {
  const origin = ORIGIN_MAP[G.run?.originId || G.profile.originId] || ORIGINS[0];
  return `<div class="stage-actor stage-actor--hero ${battle.origin ? 'has-origin' : ''}" data-figure="player" data-float-target="player">
    <span class="actor-aura actor-aura--hero"></span>
    <span class="actor-runes actor-runes--hero" aria-hidden="true"></span>
    <figure class="actor-portal actor-portal--hero">
      <span class="actor-portal__halo"></span>
      <span class="actor-portal__frame">
        ${portraitArt(battle.player.avatar, battle.player.name, 'assets/heroes/default.webp')}
        <span class="actor-portal__veil"></span>
        <span class="actor-portal__sheen"></span>
      </span>
      <span class="actor-portal__sigil">${esc(origin.sigil)}</span>
      <span class="actor-portal__base"></span>
    </figure>
    <span class="actor-groundshadow"></span>
    <div class="actor-plate actor-plate--hero">
      <div class="actor-plate__eyebrow">
        <span>执牌者 · ${esc(battle.player.title)}</span>
        ${battle.player.block > 0 ? `<span class="combat-block combat-block--player" title="格挡">${icon('shield', 13)} ${battle.player.block}</span>` : ''}
      </div>
      <div class="actor-name-line">
        <h2>${esc(battle.player.name)}</h2>
        <span class="actor-hp-label">${icon('heart', 13)} ${battle.player.hp}<small> / ${battle.player.maxHp}</small></span>
      </div>
      ${progressBar(battle.player.hp, battle.player.maxHp, 'actor-progress')}
      <div class="actor-status-row">${statusPills(battle.player.statuses)}</div>
      ${renderScarRow(battle)}
      ${(battle.origin || battle.resonance?.primary || battle.resonance?.chorus?.active) ? `<div class="actor-build-row">
        ${renderOriginChip(battle)}
        ${battle.resonance?.primary || battle.resonance?.chorus?.active ? `<div class="actor-resonance">${resonanceChip(battle.resonance)}</div>` : ''}
      </div>` : ''}
    </div>
  </div>`;
}

function renderCenter(battle) {
  return `<div class="stage-center" aria-hidden="true">
    <span class="stage-center__thread"></span>
    <span class="stage-center__glyph">梦</span>
    <span class="stage-center__ring"></span>
    <div class="stage-turn">
      <small>TURN</small>
      <strong>${String(battle.turn).padStart(2, '0')}</strong>
    </div>
  </div>`;
}

function renderDock(battle) {
  const canParley = battle.phase === 'player'
    && !battle.parley
    && battle.mode !== 'online'
    && Boolean(parleyProfile(battle));
  const canMulligan = battle.phase === 'player'
    && battle.mode !== 'online'
    && battle.turn === 1
    && !battle.mulliganUsed
    && (battle.stats?.cardsPlayed || 0) === 0
    && battle.hand.length > 0;
  const playLimit = Math.max(0, Number(battle.rules?.cardPlayLimit) || 0);
  const limitReached = playLimit > 0 && (Number(battle.rules?.cardsPlayedThisTurn) || 0) >= playLimit;
  const turnDiscount = Math.max(0, Number(battle.rules?.tideDiscount) || 0)
    + (battle.rules?.firstCardDiscountUsed ? 0 : Math.max(0, Number(battle.rules?.firstCardDiscount) || 0));
  const hasPlayable = battle.phase === 'player' && !limitReached && battle.hand.some((instance) => {
    if (battle.sealedUid && instance.uid === battle.sealedUid) return false;
    const card = getBattleCard(instance, battle);
    return card && Math.max(0, card.cost - turnDiscount) <= battle.player.energy;
  });
  const suggestEnd = battle.phase === 'player' && !hasPlayable;
  return `<div class="battle-dock ${battle.mode === 'adventure' ? 'battle-dock--bag' : ''}">
    ${renderItemBag(battle)}
    <div class="dock-energy">
      <div class="energy-orb" title="本回合可用能量">
        <span class="energy-orb__value">${battle.player.energy}</span>
        <span class="energy-orb__max">/ ${battle.player.maxEnergy}</span>
        <span class="energy-orb__label">能量</span>
      </div>
      <div class="pile-counts">
        <button type="button" class="pile-count" data-action="view-pile" data-pile="draw" title="查看抽牌堆（不显示顺序）">${icon('cards', 14)} <strong>${battle.drawPile.length}</strong><small>抽牌</small></button>
        <button type="button" class="pile-count" data-action="view-pile" data-pile="discard" title="查看弃牌堆">${icon('rotate', 14)} <strong>${battle.discardPile.length}</strong><small>弃牌</small></button>
        <button type="button" class="pile-count" data-action="view-pile" data-pile="exhaust" title="查看消耗堆">${icon('flame', 14)} <strong>${battle.exhaustPile.length}</strong><small>消耗</small></button>
      </div>
    </div>
    <div class="dock-hand">
      <div class="hand-scroll">
        <div class="hand">${renderHand(battle)}</div>
      </div>
    </div>
    <div class="dock-side">
      ${canMulligan ? `<button type="button" class="mulligan-button" data-action="mulligan-hand" title="每场战斗一次：把起手牌洗回抽牌堆，重新摸同样数量">${icon('rotate', 13)} 起手调度</button>` : ''}
      ${canParley ? `<button type="button" class="parley-button" data-action="open-parley" title="试着和这个有灵智的存在谈一谈">${icon('users', 13)} 交涉</button>` : ''}
      <button type="button" class="speed-toggle ${(Number(G.profile.settings?.battleSpeed) >= 2) ? 'is-fast' : ''}" data-action="toggle-battle-speed" title="切换战斗演出速度：1x / 2x" aria-label="切换战斗演出速度">
        ${icon('flame', 12)}<strong>${(Number(G.profile.settings?.battleSpeed) >= 2) ? 2 : 1}x</strong>
      </button>
      <span class="turn-counter">回合 <strong>${battle.turn}</strong></span>
      <button type="button" class="end-turn ${suggestEnd ? 'is-suggested' : ''}" data-action="end-turn">
        <span>结束回合<small>E</small></span>
        ${icon('right', 20)}
      </button>
      <span class="dock-hint">${suggestEnd
        ? `${icon('sparkles', 13)} ${limitReached ? '纸冠已合拢，结束回合吧' : '没有能打出的牌，结束回合吧'}`
        : `${icon('help', 13)} <kbd>1</kbd>–<kbd>9</kbd> 出牌 · 点击牌堆查看 · <kbd>E</kbd> 结束`}</span>
    </div>
  </div>`;
}

function rewardItemChip(rewards) {
  if (rewards?.item) {
    const item = rewards.item;
    return `<span class="reward-item-chip" style="--item:${safeColor(item.color)}" title="${esc(item.desc)}">
      <span class="reward-item-chip__glyph">${esc(item.glyph)}</span>
      <span class="reward-item-chip__copy"><strong>${esc(item.name)}</strong><small>${esc(item.desc)}</small></span>
    </span>`;
  }
  if (rewards?.itemLost) {
    return `<span class="reward-item-chip reward-item-chip--lost">${icon('drop', 14)} 行囊已满，战利品折算 ${rewards.itemGold} 金币</span>`;
  }
  return '';
}

function rewardScarChip(battle) {
  const entry = battle.rewards?.lastStand;
  const scar = entry?.scar;
  if (!scar) return '';
  return `<span class="reward-scar" title="${esc(`${scar.regionName || '梦'} · 第 ${scar.turn || 1} 回合向梦借气`)}">${icon('heart', 16)} 梦痕 · 生命上限 -${scar.hpCost || 5}</span>`;
}

function renderAdventureVictory(battle) {
  const rewards = battle.rewards;
  if (!rewards) return '';
  const region = REGION_MAP[G.run?.regionId];
  const isFinal = Boolean(region?.final);
  if (rewards.merchant) {
    const lootRelic = rewards.relic;
    return `<div class="battle-overlay battle-overlay--victory">
      <div class="result-panel result-panel--victory result-panel--merchant">
        <button type="button" class="result-close" data-action="skip-reward" title="收下货物并离开">${icon('close', 18)}</button>
        <span class="result-emblem">${icon('coin', 34)}</span>
        <span class="result-eyebrow">THE MERCHANT FALLS</span>
        <h2>货袋换了主人</h2>
        <p class="result-lead">${esc(ENEMY_MAP[battle.enemy.defId]?.lore || '行商把最后一件道具塞回袖口，叹了口气。')}</p>
        <div class="reward-loot">
          <span class="reward-gold">${icon('coin', 18)} +${rewards.gold} 金币${rewards.purseBonus ? `<small>含贪婪钱袋 +${rewards.purseBonus}</small>` : ''}${rewards.mutationGold ? `<small>含梦境变奏 +${rewards.mutationGold}</small>` : ''}</span>
          ${rewards.afterBattleHeal ? `<span class="reward-heal">${icon('heart', 16)} 血契书回复 ${rewards.afterBattleHeal}</span>` : ''}
          ${lootRelic ? `<span class="reward-relic-chip">${relicChip(lootRelic, { compact: true })} <span class="reward-relic-chip__copy"><strong>${esc(lootRelic.name)}</strong><small>已自动装备 · ${esc(lootRelic.desc)}</small></span></span>` : ''}
          ${rewardItemChip(rewards)}
          ${rewardScarChip(battle)}
        </div>
        <div class="result-stats">
          <span>${icon('sword', 15)} 造成 ${battle.stats.damageDealt} 伤害</span>
          <span>${icon('cards', 15)} 打出 ${battle.stats.cardsPlayed} 张牌</span>
          <span>${icon('heart', 15)} 剩余 ${battle.player.hp} / ${battle.player.maxHp} 生命</span>
        </div>
        ${lootRelic ? `<p class="result-footnote">行商的遗物与货物已经自动收入行囊。</p>` : ''}
        <button type="button" class="button button--primary button--large" data-action="skip-reward">${icon('right', 17)} 收下货物，继续上路</button>
      </div>
    </div>`;
  }
  if (rewards.boss) {
    const enemyLore = ENEMY_MAP[battle.enemy.defId]?.lore || '';
    return `<div class="battle-overlay battle-overlay--victory">
      <div class="result-panel result-panel--victory result-panel--boss">
        <span class="result-emblem">${icon(isFinal ? 'heart' : 'crown', 34)}</span>
        <span class="result-eyebrow">${isFinal ? 'THE HEART FALLS SILENT' : 'THE ISLAND LORD FALLS'}</span>
        <h2>${isFinal ? '心之梦止' : '岛屿之主倒下'}</h2>
        <p class="result-lead">${esc(enemyLore || '最后一层梦魇在你面前散开，岛的边缘终于有了黎明的颜色。')}</p>
        <div class="reward-loot">
          <span class="reward-gold">${icon('coin', 18)} +${rewards.gold} 金币${rewards.purseBonus ? `<small>含贪婪钱袋 +${rewards.purseBonus}</small>` : ''}${rewards.mutationGold ? `<small>含梦境变奏 +${rewards.mutationGold}</small>` : ''}</span>
          ${rewardItemChip(rewards)}
          ${rewardScarChip(battle)}
        </div>
        <div class="result-stats">
          <span>${icon('sword', 15)} 造成 ${battle.stats.damageDealt} 伤害</span>
          <span>${icon('cards', 15)} 打出 ${battle.stats.cardsPlayed} 张牌</span>
          <span>${icon('heart', 15)} 剩余 ${battle.player.hp} / ${battle.player.maxHp} 生命</span>
        </div>
        <button type="button" class="button button--primary button--large" data-action="finish-adventure">${icon(isFinal ? 'sparkles' : 'right', 17)} ${isFinal ? '走向心的尽头' : (G.run?.endless ? `沉入第 ${(Number(G.run.depth) || 1) + 1} 层` : '结束这段梦')}</button>
      </div>
    </div>`;
  }
  const biasSchool = rewards.schoolBias ? SCHOOLS[rewards.schoolBias] : null;
  const splashSchool = rewards.splashBias ? SCHOOLS[rewards.splashBias] : null;
  const splashAltSchool = rewards.splashBiasAlt ? SCHOOLS[rewards.splashBiasAlt] : null;
  const chorusBias = Array.isArray(rewards.chorusBias) ? rewards.chorusBias : [];
  const breadthBias = Boolean(rewards.breadthBias);
  const cards = (rewards.cards || [])
    .map((cardId) => getCardDef(cardId))
    .filter(Boolean)
    .map((card) => cardMarkup(card, {
      action: 'choose-reward',
      attrs: `data-id="${esc(card.id)}"`,
      showFlavor: true,
      className: `reward-card${((biasSchool && card.school === rewards.schoolBias) || (splashSchool && card.school === rewards.splashBias) || (splashAltSchool && card.school === rewards.splashBiasAlt) || chorusBias.includes(card.school)) ? ' reward-card--resonant' : ''}${card.id === rewards.hookCardId ? ' reward-card--hook' : ''}`,
    }))
    .join('');
  const relic = rewards.relic;
  return `<div class="battle-overlay battle-overlay--victory">
    <div class="result-panel result-panel--victory result-panel--reward">
      <button type="button" class="result-close" data-action="skip-reward" title="不选择卡牌，直接离开">${icon('close', 18)}</button>
      <span class="result-eyebrow">BATTLE WON</span>
      <h2>${battle.tier === 'elite' ? '强敌伏诛' : '梦魇退散'}</h2>
      <p class="result-lead">${battle.tier === 'elite' ? '精英的残响留在了你的牌里。' : '雾散开一条缝，前方还有更深的路。'}</p>
      <div class="reward-loot">
        <span class="reward-gold">${icon('coin', 18)} +${rewards.gold} 金币${rewards.purseBonus ? `<small>含贪婪钱袋 +${rewards.purseBonus}</small>` : ''}${rewards.mutationGold ? `<small>含梦境变奏 +${rewards.mutationGold}</small>` : ''}</span>
        ${rewards.afterBattleHeal ? `<span class="reward-heal">${icon('heart', 16)} 血契书回复 ${rewards.afterBattleHeal}</span>` : ''}
        ${relic ? `<span class="reward-relic-chip">${relicChip(relic, { compact: true })} <span class="reward-relic-chip__copy"><strong>${esc(relic.name)}</strong><small>已自动装备 · ${esc(relic.desc)}</small></span></span>` : ''}
        ${rewardItemChip(rewards)}
        ${rewardScarChip(battle)}
        ${rewards.fallbackGold ? `<span class="reward-relic-chip">遗物已收集齐，额外 +${rewards.fallbackGold} 金币</span>` : ''}
      </div>
      <div class="reward-choice-heading"><span>选择一张牌加入牌组</span><button type="button" class="text-button" data-action="skip-reward">跳过</button></div>
      ${rewards.hookCardId ? `<div class="reward-resonance-hint reward-resonance-hint--hook">${icon('flame', 14)} <span>起手联动</span><small>第一场胜利固定给你一张接得上起源机制的牌</small></div>` : ''}
      ${biasSchool && !breadthBias ? `<div class="reward-resonance-hint" style="--resonance:${safeColor(biasSchool.color)}">${icon('sparkles', 14)} <span>共鸣倾向 · ${esc(biasSchool.name)}${splashSchool ? ` + ${esc(splashSchool.name)}${splashAltSchool ? ` + ${esc(splashAltSchool.name)}` : ''}` : ''}</span><small>${splashSchool ? (splashAltSchool ? '一张主派牌 + 两张不同支线，纯走或铺宽都由你' : '一张主派牌 + 一张支线牌，帮你把支线补到 2 张') : '两张同流派牌回应了你的共鸣'}</small></div>` : ''}
      ${chorusBias.length ? `<div class="reward-resonance-hint" style="--resonance:${safeColor(CHORUS_INFO.color)}">${icon('sparkles', 14)} <span>混响倾向 · 多派补给</span><small>${breadthBias ? '两张不同支线的牌，帮你把两个流派各补到 2 张' : '两张低张数流派的牌，帮你稳住混响'}</small></div>` : ''}
      <div class="reward-cards">${cards}</div>
      <p class="result-footnote">点击卡牌收入牌组 · 金币与遗物已自动获得</p>
    </div>
  </div>`;
}

function renderDailyVictory(battle) {
  const daily = battle.daily || {};
  const streak = Number(battle.dailyResult?.streak) || 0;
  const completions = Number(battle.dailyResult?.completions) || 0;
  const unlocked = battle.unlockedAchievements || [];
  const backLabel = G.run ? '回到远征' : '回到扉页';
  return `<div class="battle-overlay battle-overlay--victory">
    <div class="result-panel result-panel--victory result-panel--daily">
      <span class="result-emblem">${icon('crown', 34)}</span>
      <span class="result-eyebrow">DAILY NIGHTMARE CLEARED</span>
      <h2>今日之梦已破</h2>
      <p class="result-lead">${esc(daily.label || '每日梦魇')} · ${esc(daily.bossName || battle.enemy.name)} 在固定牌序里倒下。明日的种子会抽出另一场梦。</p>
      <div class="result-stats">
        <span>${icon('flame', 15)} 层级 ${Number(battle.ascension) || 0}</span>
        <span>${icon('sparkles', 15)} 连胜 ${streak} 日</span>
        <span>${icon('cards', 15)} ${completions} 次完成</span>
      </div>
      <div class="result-stats">
        <span>${icon('sword', 15)} ${battle.stats.damageDealt} 伤害</span>
        <span>${icon('heart', 15)} 剩余 ${battle.player.hp} 生命</span>
        <span>${icon('rotate', 15)} ${battle.turn} 回合</span>
      </div>
      ${unlocked.length ? `<div class="result-achievements">${unlocked.map((entry) => `<span>${icon('crown', 13)} ${esc(entry.name)}</span>`).join('')}</div>` : ''}
      <div class="result-actions">
        <button type="button" class="button button--primary" data-action="sandbox-retry">${icon('rotate', 16)} 再战今日</button>
        <button type="button" class="button button--ghost" data-action="daily-return">${icon('home', 16)} ${backLabel}</button>
      </div>
    </div>
  </div>`;
}

function renderSandboxVictory(battle) {
  return `<div class="battle-overlay battle-overlay--victory">
    <div class="result-panel result-panel--victory">
      <span class="result-emblem">${icon('sparkles', 34)}</span>
      <span class="result-eyebrow">TRIAL CLEARED</span>
      <h2>试炼完成</h2>
      <p class="result-lead">${esc(battle.enemy.name)} 化成了一场可以带走的经验。这里没有真正的死亡，只有下一场想象。</p>
      <div class="result-stats">
        <span>${icon('sword', 15)} ${battle.stats.damageDealt} 伤害</span>
        <span>${icon('cards', 15)} ${battle.stats.cardsPlayed} 张牌</span>
        <span>${icon('rotate', 15)} ${battle.turn} 回合</span>
      </div>
      <div class="result-actions">
        <button type="button" class="button button--primary" data-action="sandbox-retry">${icon('rotate', 16)} 再战一次</button>
        <button type="button" class="button button--ghost" data-action="sandbox-return">${icon('cards', 16)} 返回试炼场</button>
      </div>
    </div>
  </div>`;
}

function renderLastStand(battle) {
  const stand = battle.lastStand || {};
  const quoted = stand.line || '还差一口气。梦愿意借给你。';
  return `<div class="battle-overlay battle-overlay--last-stand" role="dialog" aria-modal="true" aria-labelledby="last-stand-title">
    <div class="last-stand-panel">
      <span class="last-stand-emblem" style="--stand-color:${safeColor(stand.companionColor || battle.player.accent || '#c06653')}">
        ${icon('heart', 36)}
        <i aria-hidden="true"></i>
      </span>
      <span class="result-eyebrow">ONE BREATH LEFT · 绝境</span>
      <h2 id="last-stand-title">梦在等你开口</h2>
      <p class="last-stand-lead">生命只剩 ${battle.player.hp} / ${battle.player.maxHp}。${esc(stand.companionName || '梦')} 的声音从很近的地方传来。</p>
      <blockquote class="last-stand-quote">
        <p>“${esc(quoted)}”</p>
        <cite>— ${esc(stand.companionName || battle.player.title)}${stand.companionId ? '' : '（执牌者）'}</cite>
      </blockquote>
      <div class="last-stand-boon">
        <span>${icon('shield', 15)} <b>+8</b> 格挡</span>
        <span>${icon('cards', 15)} 抽 <b>2</b> 张牌</span>
        <span>${icon('bolt', 15)} <b>+2</b> 能量</span>
      </div>
      <p class="last-stand-cost">${icon('heart', 14)} 胜利或撤退时，生命上限 <b>-5</b>，留下一道「梦痕」。战败不会留下。</p>
      <div class="result-actions">
        <button type="button" class="button button--primary" data-action="last-stand-accept">${icon('flame', 16)} 向梦借一口气</button>
        <button type="button" class="button button--ghost" data-action="last-stand-decline">${icon('shield', 16)} 绝不向梦低头</button>
      </div>
      <p class="last-stand-footnote">这场梦只问一次。拒绝没有任何代价。</p>
    </div>
  </div>`;
}

function renderDefeatRecap(battle) {
  const recap = battle.defeatRecap;
  if (!recap || battle.mode !== 'adventure') return '';
  const standText = recap.usedLastStand
    ? (recap.costWaived ? '你向梦借过一口气，梦没有收走代价。' : '你向梦借过一口气。')
    : recap.declinedLastStand
      ? '你没有向梦低头。'
      : '梦没有给你开口的机会。';
  const scars = Array.isArray(recap.scars) ? recap.scars : [];
  return `<div class="defeat-recap">
    <div class="defeat-recap__companion" style="--companion:${safeColor(recap.companionColor || '#c1a263')}">
      <span class="defeat-recap__glyph">${esc(recap.companionGlyph || '梦')}</span>
      <div>
        <strong>${esc(recap.companionName || '梦')}</strong>
        <p>“${esc(recap.line || '梦把你留在了这一页。')}”</p>
      </div>
    </div>
    <div class="defeat-recap__facts">
      <span>${icon('map', 13)} ${esc(recap.regionName || '梦境的裂隙')} · 第 ${recap.turn || 1} 回合</span>
      <span>${icon('heart', 13)} ${standText}</span>
      <span>${icon('skull', 13)} ${esc(recap.enemyName || battle.enemy.name)}</span>
      ${scars.length ? `<span class="defeat-recap__scars" title="${esc(scarSummary(scars))}">${icon('flame', 13)} 梦痕 ×${scars.length}</span>` : ''}
    </div>
    ${recap.elegyAvailable && !battle.defeatElegyShown ? `<button type="button" class="defeat-recap__elegy" data-action="defeat-elegy">
      ${icon('scroll', 15)}
      <span><strong>听梦说完</strong><small>这一页背面还写着一行小字</small></span>
      ${icon('right', 14)}
    </button>` : ''}
  </div>`;
}

function renderDefeat(battle) {
  const isSandbox = battle.mode === 'sandbox';
  const isDaily = battle.mode === 'daily';
  const backLabel = G.run ? '回到远征' : '回到扉页';
  return `<div class="battle-overlay battle-overlay--defeat">
    <div class="result-panel result-panel--defeat">
      <span class="result-emblem">${icon('skull', 34)}</span>
      <span class="result-eyebrow">THE DREAM SWALLOWS YOU</span>
      <h2>${isSandbox ? '试炼中止' : isDaily ? '今日梦断' : '梦醒之前'}</h2>
      <p class="result-lead">${isSandbox
        ? '没有关系。梦里的失败只是一张还没翻开的牌。'
        : isDaily
          ? '今日的种子停在半途。你可以再试一次，但梦不会为你换一副牌。'
          : '你的名字被留在了这层梦里。下一次，带上不同的牌组再来。'}</p>
      ${renderDefeatRecap(battle)}
      <div class="result-stats">
        <span>${icon('sword', 15)} ${battle.stats.damageDealt} 伤害</span>
        <span>${icon('cards', 15)} ${battle.stats.cardsPlayed} 张牌</span>
        <span>${icon('rotate', 15)} ${battle.turn} 回合</span>
      </div>
      <div class="result-actions">
        ${isSandbox
          ? `<button type="button" class="button button--primary" data-action="sandbox-retry">${icon('rotate', 16)} 重新开始</button>
             <button type="button" class="button button--ghost" data-action="sandbox-return">${icon('cards', 16)} 返回试炼场</button>`
          : isDaily
            ? `<button type="button" class="button button--primary" data-action="sandbox-retry">${icon('rotate', 16)} 再试今日</button>
               <button type="button" class="button button--ghost" data-action="daily-return">${icon('home', 16)} ${backLabel}</button>`
            : `<button type="button" class="button button--primary" data-action="restart-battle">${icon('rotate', 16)} 重打这一场</button>
               <button type="button" class="button button--ghost" data-action="retry-adventure">${icon('rotate', 16)} 新的远征</button>
               <button type="button" class="button button--ghost" data-action="defeat-world">${icon('map', 16)} 回到群岛</button>`}
      </div>
    </div>
  </div>`;
}

function renderOverlay(battle) {
  if (battle.phase === 'player' && battle.lastStand?.offered && !battle.lastStand.resolved) {
    return renderLastStand(battle);
  }
  if (battle.phase === 'victory') {
    if (battle.mode === 'sandbox') return renderSandboxVictory(battle);
    if (battle.mode === 'daily') return renderDailyVictory(battle);
    return renderAdventureVictory(battle);
  }
  if (battle.phase === 'defeat') return renderDefeat(battle);
  return '';
}

export function renderBattle(battle) {
  if (!battle) return '';
  const origin = ORIGIN_MAP[G.run?.originId || G.profile.originId] || ORIGINS[0];
  const enemyDef = ENEMY_MAP[battle.enemy.defId];
  const fallback = enemyDef?.image || battle.enemy.image;
  const relics = battle.mode === 'adventure'
    ? battle.relics.map((id) => relicChip(RELIC_MAP[id], { compact: true })).join('')
    : '';
  const region = REGION_MAP[G.run?.regionId];
  const phase = Number(battle.enemy.phase) || 1;
  const phaseTitle = battle.enemy.phaseTitle || battle.enemy.phase2?.title;
  const phaseAwake = phase >= 2 && Boolean(battle.enemy.phase2) && isPhaseArtRevealed(battle);
  const location = battle.mode === 'sandbox'
    ? '无梦的试炼场'
    : battle.mode === 'daily'
      ? (battle.daily?.label || '每日梦魇')
      : `${region?.episode || '梦境'} · ${region?.name || '折叠回廊'}`;
  const modeLabel = battle.mode === 'sandbox'
    ? '幻境试炼'
    : battle.mode === 'daily'
      ? `层级 ${Number(battle.ascension) || 0}`
      : battle.tier === 'merchant'
        ? '行商之战'
        : battle.tier === 'elite'
          ? '精英遭遇'
          : battle.tier === 'boss'
            ? '梦魇决战'
            : '梦境遭遇';
  const tier = battle.tier || enemyDef?.tier || 'normal';
  const lastStandOpen = battle.phase === 'player' && battle.lastStand?.offered && !battle.lastStand.resolved;
  return `<div class="screen battle-screen battle-screen--stage ${tier === 'boss' ? 'battle-screen--boss' : ''} ${phaseAwake ? 'is-phase-two' : ''} ${lastStandOpen ? 'is-last-stand' : ''}" style="--enemy-color:${safeColor(battle.enemy.accent)};${phaseAwake ? `--phase-color:${safeColor(battle.enemy.phase2?.color || '#e0945d')}` : ''}">
    <div class="battle-world" aria-hidden="true">
      <div class="world-sky">
        ${imageTag('assets/stage/dream-hall.webp', fallback, '', 'world-sky__image', false)}
        <span class="world-sky__tint"></span>
        <span class="world-sky__enemy-glow"></span>
        <span class="world-sky__rays"></span>
        <span class="world-mist world-mist--far"></span>
        <span class="world-mist world-mist--near"></span>
        <span class="world-particles">${stageParticles()}</span>
      </div>
      <div class="world-floor">
        <span class="world-floor__grid"></span>
        <span class="world-floor__glow"></span>
      </div>
      <span class="world-vignette"></span>
      ${phaseAwake ? `<span class="world-embers" aria-hidden="true">${phaseEmbers()}</span>` : ''}
      <span class="world-grain"></span>
    </div>

    <header class="battle-header battle-header--stage">
      <button type="button" class="pagebar__back ${battle.noRetreat ? 'is-locked' : ''}" data-action="battle-exit" ${battle.noRetreat ? 'title="这一战没有退路" aria-disabled="true"' : ''}>${icon(battle.noRetreat ? 'lock' : 'left', 18)}<span>${battle.mode === 'sandbox' ? '离场' : battle.noRetreat ? '无路可退' : '撤退'}</span></button>
      <div class="battle-header__title">
        <span>${esc(location)} · ${esc(modeLabel)}</span>
        <strong>${esc(battle.enemy.name)}${phaseAwake ? `<em class="battle-phase-flag">${icon('flame', 11)} ${esc(phaseTitle || '真形')}</em>` : ''}</strong>
        ${renderMutationChips(battle)}
        ${renderContractChips(battle)}
        ${renderAscensionChips(battle)}
      </div>
      <div class="battle-header__right">
        <div class="header-relics" title="${battle.mode === 'adventure' ? '遗物已自动装备，开战时苏醒' : ''}">${relics || `<span class="header-relics__empty">${battle.mode === 'sandbox' ? '试炼无遗物' : '暂无遗物'}</span>`}</div>
        ${battle.mode === 'adventure' ? `<span class="header-resource">${icon('coin', 15)} <strong>${G.run?.gold ?? 0}</strong></span>` : ''}
        ${topbarMuteButton()}
        ${battle.noRetreat ? '' : `<button type="button" class="icon-button" data-action="restart-battle" title="重新开始这一场对战">${icon('rotate', 18)}</button>`}
        <button type="button" class="icon-button" data-action="open-guide" title="玩法指南">${icon('help', 18)}</button>
      </div>
    </header>

    <main class="battle-main battle-main--stage">
      <section class="battle-stage" data-stage>
        <div class="stage-log-panel">
          <span class="stage-log__title">${icon('scroll', 13)} 梦的回声</span>
          <div class="stage-log">${renderLog(battle)}</div>
        </div>
        <div class="stage-intent-slot">${renderIntent(battle)}</div>
        ${renderHeroActor(battle)}
        ${renderCenter(battle)}
        ${renderEnemyActor(battle)}
        <div class="battle-fx-layer" data-fx-layer aria-hidden="true"></div>
      </section>
      ${renderDock(battle)}
    </main>
    ${renderOverlay(battle)}
    <div class="battle-trial-mark">${battle.mode === 'sandbox'
      ? 'SANDBOX · 这里没有真正的失败'
      : battle.mode === 'daily'
        ? `DAILY · ${esc(battle.daily?.originName || '')} · 种子已定`
        : `${esc(origin.name)} · ${esc(getHeroName())}`}</div>
  </div>`;
}
