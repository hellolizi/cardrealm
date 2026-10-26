import {
  AI_STYLES,
  ATTRIBUTES,
  CARD_GLYPHS,
  CARD_MAP,
  CARD_PALETTES,
  ENEMIES,
  ENEMY_LINEAGES,
  ENEMY_MAP,
  EVENTS,
  ITEM_MAP,
  ORIGIN_MAP,
  RELICS,
  RELIC_MAP,
  SCHOOLS,
  TYPE_INFO,
} from './data.js';
import {
  achievementCounts,
  achievementGallery,
} from './achievements.js';
import {
  AWAKENING_PRESSURE,
  MIN_DECK_SIZE,
  awakeningOffer,
  parleyOptions,
  parleyProfile,
  runAttributes,
  runAwakenings,
  runResonance,
  restHealAmount,
  stealChance,
} from './engine.js';
import { keywordGlossaryMarkup } from './keywords.js';
import { MAX_CONTRACTS, contractList, contractPrice } from './contracts.js';
import {
  CODEX_NOTES,
  DIALOGUES,
  ENDINGS,
  FACTIONS,
  NPCS,
  NPC_MAP,
  QUESTS,
  QUEST_MAP,
  STORIES,
  dialogueNode,
  factionOf,
  storyLines,
} from './lore.js';
import { G, getCardDef, getEnemySkin, getHeroAvatar, getHeroName } from './state.js';
import { storyArtFor, storyPortraitAt, storyPreloads, storyPropAt, storySceneAt } from './story-art.js';
import { resonanceTitle } from './resonance.js';
import {
  applyDialogueEffect,
  bondLabel,
  endingChoices,
  markDialogueNode,
  npcBond,
  questProgress,
  questStatus,
  questsForNpc,
} from './world-state.js';
import {
  cardMarkup,
  groupDeck,
  imageTag,
  relicChip,
  resonancePanel,
} from './ui-common.js';
import { esc, icon, resolveCard, safeColor } from './utils.js';
import { rgbToHex } from './image-editor.js';
import { cardArt, cardArtSource } from './card-art.js';
import { peekCardArt } from './card-art-store.js';

export const CARD_EFFECT_OPTIONS = [
  { kind: 'damage', label: '造成伤害', amount: 6, group: '进攻' },
  { kind: 'directDamage', label: '无视格挡的伤害', amount: 8, group: '进攻' },
  { kind: 'comboDamage', label: '连斩加成伤害', amount: 6, group: '进攻' },
  { kind: 'execute', label: '处决（残血重击）', amount: 10, group: '进攻' },
  { kind: 'blockDamage', label: '格挡化刃', amount: 20, group: '进攻' },
  { kind: 'block', label: '获得格挡', amount: 5, group: '防守' },
  { kind: 'heal', label: '回复生命', amount: 5, group: '防守' },
  { kind: 'regen', label: '获得回春（自）', amount: 3, group: '防守' },
  { kind: 'draw', label: '抽牌', amount: 1, group: '节奏' },
  { kind: 'drawTo', label: '抽牌至指定手牌', amount: 6, group: '节奏' },
  { kind: 'energy', label: '获得能量', amount: 1, group: '节奏' },
  { kind: 'recollect', label: '从弃牌堆拾回', amount: 1, group: '节奏' },
  { kind: 'vulnerable', label: '施加易伤（敌）', amount: 2, group: '诅咒' },
  { kind: 'weak', label: '施加虚弱（敌）', amount: 2, group: '诅咒' },
  { kind: 'poison', label: '施加中毒（敌）', amount: 4, group: '诅咒' },
  { kind: 'burn', label: '施加灼烧（敌）', amount: 3, group: '诅咒' },
  { kind: 'detonateBurn', label: '引爆灼烧（敌）', amount: 2, group: '诅咒' },
  { kind: 'detonatePoison', label: '引爆中毒（敌）', amount: 1, group: '诅咒' },
  { kind: 'catalyzePoison', label: '中毒层数翻倍（敌）', amount: 0, group: '诅咒' },
  { kind: 'catalyzeBurn', label: '灼烧层数翻倍（敌）', amount: 0, group: '诅咒' },
  { kind: 'toxicBurst', label: '蚀放（按中毒层数）', amount: 3, group: '诅咒' },
  { kind: 'strength', label: '获得力量（自）', amount: 1, group: '强化' },
  { kind: 'dexterity', label: '获得敏捷（自）', amount: 1, group: '强化' },
  { kind: 'thorns', label: '获得荆棘（自）', amount: 3, group: '强化' },
  { kind: 'barrier', label: '获得留壁（自）', amount: 1, group: '强化' },
  { kind: 'loseHp', label: '失去生命（自）', amount: 3, group: '代价' },
  { kind: 'gold', label: '获得金币', amount: 10, group: '收获' },
];

export const EFFECT_OPTION_MAP = Object.fromEntries(CARD_EFFECT_OPTIONS.map((item) => [item.kind, item]));

const STATUS_KINDS = {
  vulnerable: 'enemy',
  weak: 'enemy',
  poison: 'enemy',
  burn: 'enemy',
  strength: 'self',
  dexterity: 'self',
  thorns: 'self',
  regen: 'self',
  barrier: 'self',
};

export function effectKind(effect) {
  if (!effect) return 'damage';
  if (effect.type === 'status') return effect.status;
  if (effect.type === 'detonate') return effect.status === 'poison' ? 'detonatePoison' : 'detonateBurn';
  if (effect.type === 'catalyze') return effect.status === 'burn' ? 'catalyzeBurn' : 'catalyzePoison';
  return effect.type;
}

export function effectHasPayload(effect) {
  if (!effect) return false;
  if (effect.type === 'toxicBurst') return Number(effect.scale) > 0;
  if (effect.type === 'catalyze') return true;
  return Number(effect.amount) > 0;
}

export function makeEffect(kind, amount = null) {
  const option = EFFECT_OPTION_MAP[kind] || CARD_EFFECT_OPTIONS[0];
  const resolvedAmount = amount ?? option.amount;
  if (STATUS_KINDS[kind]) {
    return {
      type: 'status',
      status: kind,
      target: STATUS_KINDS[kind],
      amount: resolvedAmount,
    };
  }
  if (kind === 'damage') {
    return { type: 'damage', amount: resolvedAmount, hits: 1 };
  }
  if (kind === 'comboDamage') {
    return { type: 'comboDamage', amount: resolvedAmount, scale: 3 };
  }
  if (kind === 'toxicBurst') {
    return { type: 'toxicBurst', scale: resolvedAmount };
  }
  if (kind === 'execute') {
    return { type: 'execute', amount: resolvedAmount, threshold: 0.35, multiplier: 3 };
  }
  if (kind === 'detonateBurn' || kind === 'detonatePoison') {
    return { type: 'detonate', status: kind === 'detonatePoison' ? 'poison' : 'burn', amount: resolvedAmount };
  }
  if (kind === 'catalyzePoison' || kind === 'catalyzeBurn') {
    return { type: 'catalyze', status: kind === 'catalyzeBurn' ? 'burn' : 'poison', amount: resolvedAmount };
  }
  return { type: kind, amount: resolvedAmount };
}

export function previewDraft(draft) {
  const effects = (draft.effects || []).filter((effect) => effectHasPayload(effect));
  return resolveCard({
    ...draft,
    name: String(draft.name || '').trim() || '未命名造物',
    cost: Number(draft.cost) || 0,
    type: draft.type || 'attack',
    rarity: 'custom',
    effects: effects.length ? effects : makeEffect('damage', 6),
    flavor: draft.flavor || '',
    custom: true,
  });
}

function modalAnimationClass(m) {
  return G.ui.renderedModalSeq === m.seq ? '' : 'modal--enter';
}

function shell(m, options) {
  const closable = options.closable !== false && !m.data?.busy;
  return `<div class="modal-backdrop ${modalAnimationClass(m)}" data-modal-backdrop>
    <section class="modal ${options.className || ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title-${m.seq}">
      <header class="modal__header">
        <div class="modal__heading">
          ${options.eyebrow ? `<span class="section-eyebrow">${esc(options.eyebrow)}</span>` : ''}
          <h2 id="modal-title-${m.seq}">${esc(options.title)}</h2>
          ${options.subtitle ? `<p>${esc(options.subtitle)}</p>` : ''}
        </div>
        ${closable ? `<button type="button" class="icon-button modal__close" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close', 19)}</button>` : ''}
      </header>
      <div class="modal__body">${options.body}</div>
      ${options.footer ? `<footer class="modal__footer">${options.footer}</footer>` : ''}
    </section>
  </div>`;
}

function guideModal(m) {
  const body = `<div class="guide-grid">
    <section class="guide-block">
      <span class="guide-block__index">01</span>
      <h3>${icon('map', 17)} 梦境的走法</h3>
      <p>从回廊底端出发，每次点击一个发光的节点。每座岛藏着九层梦境，心岛有十层；七座岛与一颗心，路径只会向上，无法回头。</p>
    </section>
    <section class="guide-block">
      <span class="guide-block__index">02</span>
      <h3>${icon('sword', 17)} 战斗要诀</h3>
      <p>每回合有 3 点能量并抽 5 张牌。打出攻击与技能，留意敌人的「下个意图」。格挡在回合开始时清空，敌人身上的易伤与虚弱会在它的回合结束时衰减。</p>
      <p>敌人意图与卡牌上会直接标出<strong>预计伤害</strong>，被格挡消去的部分也会一并写明。点开牌堆可以查看抽牌堆、弃牌堆与消耗堆；卡牌描述中的高亮关键词可以悬停查看，也可以随时翻开关键词手册。</p>
      <p>每场战斗的第一回合、出牌前可以<strong>调度一次起手</strong>；出发前还能填写梦境种子，地图左侧会显示并可复制，同一副种子会重走同一条路。</p>
    </section>
    <section class="guide-block">
      <span class="guide-block__index">03</span>
      <h3>${icon('cards', 17)} 构筑与纪念牌</h3>
      <p>战斗后选择新牌，营火可治疗或强化，行商出售卡牌与遗物。完成岛民的委托，还会得到只属于这段旅程的纪念牌。牌并非越多越好。</p>
      <p>牌组中数量最多的流派达到 4 / 8 / 12 张，且占全部流派牌 40% / 50% / 60% 时，依次觉醒 I / II / III 级共鸣。想混搭也行：两派各 3 张、或三派各 2 张，且没有流派占到 65% 时点亮「混响」。连续打出不同流派会叠加本回合攻击加成（5 / 7 / 9），同流派连打会断链并清空加成，最多 3 层。双派封顶 II 级，三派可到 III 级。两条路线互斥——混响亮起时不再结算单流派共鸣。</p>
      <p>纯流派稳定、下限高，适合先走通一段梦；混搭前期更脆、吃排序与构筑，成型后上限更高。战斗奖励和行商读得懂你的路线：纯流派会递来主派牌，混响则帮你补齐不同支线。</p>
    </section>
    <section class="guide-block">
      <span class="guide-block__index">04</span>
      <h3>${icon('heart', 17)} 群岛与告别</h3>
      <p>和岛上的旧人交谈，听他们讲十二年前那场没下完的雨。羁绊越深，终局时能打开的告别越多；结局回廊会记下每一种，其中一种从未写进目录。</p>
      <p>所有有灵智的梦魇都可以交涉。每场只有一次机会，谈不拢就没有谈和——它会被彻底激怒，攻击更重，但破绽也更大。与不同的岛屿之主谈成，会让群岛记住另一种可能。</p>
    </section>
    <section class="guide-block">
      <span class="guide-block__index">05</span>
      <h3>${icon('drop', 17)} 行囊、药水与行商</h3>
      <p>战斗道具不消耗能量，行囊最多装 10 件，从行商、宝箱与战利品里获得。行商本人也可以袭击：他的货箱越满，这一战就越接近一场灾难。打赢能抢走整只货箱，打输则没有退路。</p>
    </section>
    <section class="guide-block">
      <span class="guide-block__index">06</span>
      <h3>${icon('wand', 17)} 幻境游乐场</h3>
      <p>主菜单的娱乐模式不受主线限制：从牌库自由构筑试炼牌组，挑选任何敌人试刀，并在造物工坊里编写自己的卡牌效果、换上主角或敌人的照片。</p>
    </section>
    <section class="guide-block guide-block--wide">
      <span class="guide-block__index">07</span>
      <h3>${icon('sparkles', 17)} 造物工坊与 AI 生图</h3>
      <p>照片只在本机浏览器中裁切、压缩与保存。AI 生图可以走免费的公共生图服务，也可以填入任意 OpenAI 兼容图片接口。自定义卡牌只出现在娱乐模式，保证冒险模式的平衡。</p>
    </section>
    <section class="guide-block guide-block--wide">
      <span class="guide-block__index">08</span>
      <h3>${icon('crown', 17)} 层级、成就与备份</h3>
      <p>在出发前可以选择<strong>梦境层级</strong>：初始只有「初梦」，每次完成一座岛都会解锁下一层，最高为「心渊」。前五层主要压高敌人的生命与攻势；从第 6 层「棘梦」开始，梦会改写规则——荆棘反伤、每回合少抽牌、封住行囊、削去能量。层级 10「心渊」会把这些梦律同时压下来，但凯旋会被成就回廊记住。</p>
      <p>扉页的<strong>每日梦魇</strong>每天重置，所有人在同一天面对同一副牌与同一个敌人。成就、每日连胜与最高层级都会写入长期档案；存档备份可以把这份档案连同进行中的远征导出成 JSON，带到另一台机器。</p>
    </section>
    <div class="guide-keys">
      <span><kbd>1</kbd>–<kbd>9</kbd> 出牌</span>
      <span><kbd>E</kbd> 结束回合</span>
      <span><kbd>Esc</kbd> 关闭弹窗</span>
    </div>
  </div>`;
  return shell(m, {
    eyebrow: 'HOW TO DREAM',
    title: '玩法指南',
    subtitle: '一副牌，七座岛，五种告别。',
    body,
    className: 'modal--guide',
    footer: '<button type="button" class="button button--primary" data-action="close-modal">我知道了</button>',
  });
}

function confirmModal(m) {
  const data = m.data || {};
  const body = `<div class="confirm-body">
    <span class="confirm-body__icon ${data.tone === 'danger' ? 'is-danger' : ''}">${icon(data.tone === 'danger' ? 'skull' : 'help', 28)}</span>
    <p>${esc(data.message || '确定要这么做吗？')}</p>
  </div>`;
  return shell(m, {
    eyebrow: data.eyebrow || 'ARE YOU SURE',
    title: data.title || '确认',
    body,
    className: 'modal--confirm',
    footer: `<button type="button" class="button button--ghost" data-action="close-modal">再想想</button>
      <button type="button" class="button ${data.tone === 'danger' ? 'button--danger' : 'button--primary'}" data-action="confirm-accept">${esc(data.confirmLabel || '确认')}</button>`,
  });
}

function deckViewModal(m) {
  const run = G.run;
  if (!run) return '';
  const groups = groupDeck(run.deck);
  const resonance = runResonance(run);
  const body = `<div class="deck-modal-top">
      <div class="deck-modal-count"><strong>${run.deck.length}</strong><span>张牌</span></div>
      <p>${groups.filter((group) => group.upgraded).length ? '强化后的牌会带上「+」标记。' : '在营火处可以强化卡牌。'} 卡牌按同名归组显示，牌组中占多数的流派会觉醒共鸣。</p>
    </div>
    ${resonancePanel(resonance, { className: 'deck-modal-resonance', eyebrow: 'DECK RESONANCE · 牌组共鸣' })}
    <div class="deck-modal-grid">
      ${groups.map((group) => `<div class="deck-modal-item">${cardMarkup(group.card, { tag: 'div', mini: true, badge: group.count, className: resonance.primary && group.card.school === resonance.primary ? 'is-resonant' : '' })}</div>`).join('')}
    </div>`;
  return shell(m, {
    eyebrow: 'YOUR DECK',
    title: `牌组 · ${run.deck.length} 张`,
    subtitle: '这些牌会陪你走到梦的尽头。',
    body,
    className: 'modal--deck',
    footer: '<button type="button" class="button button--ghost" data-action="close-modal">收起牌组</button>',
  });
}

function effectOptionsMarkup(selected) {
  const groups = new Map();
  for (const option of CARD_EFFECT_OPTIONS) {
    if (!groups.has(option.group)) groups.set(option.group, []);
    groups.get(option.group).push(option);
  }
  return [...groups.entries()].map(([group, options]) => `<optgroup label="${esc(group)}">
    ${options.map((option) => `<option value="${option.kind}" ${option.kind === selected ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}
  </optgroup>`).join('');
}

function cardEditorModal(m) {
  const draft = m.data.draft;
  const preview = previewDraft(draft);
  const effectsRows = draft.effects.map((effect, index) => {
    const kind = effectKind(effect);
    const valueField = kind === 'toxicBurst'
      ? { label: '倍率', field: 'scale', value: Math.max(1, Number(effect.scale) || 3), min: 1, max: 9 }
      : { label: '数值', field: 'amount', value: Math.max(0, Number(effect.amount) || 0), min: 0, max: 99 };
    const extras = [];
    if (kind === 'damage') {
      extras.push(`<label class="effect-row__hits"><span>次数</span>
        <input type="number" min="1" max="9" value="${Number(effect.hits) || 1}" data-effect-field="hits">
      </label>`);
    }
    if (kind === 'comboDamage') {
      extras.push(`<label class="effect-row__hits"><span>每层</span>
        <input type="number" min="1" max="9" value="${Math.max(1, Number(effect.scale) || 3)}" data-effect-field="scale">
      </label>`);
    }
    if (kind === 'execute') {
      extras.push(`<label class="effect-row__hits"><span>处决线%</span>
        <input type="number" min="5" max="90" value="${Math.round((Number(effect.threshold) || 0.35) * 100)}" data-effect-field="threshold">
      </label>`);
    }
    return `<div class="effect-row" data-effect-index="${index}">
      <span class="effect-row__index">${String(index + 1).padStart(2, '0')}</span>
      <label class="effect-row__kind">
        <span class="visually-hidden">效果类型</span>
        <select data-effect-kind>${effectOptionsMarkup(kind)}</select>
      </label>
      <label class="effect-row__amount">
        <span>${valueField.label}</span>
        <input type="number" min="${valueField.min}" max="${valueField.max}" value="${valueField.value}" data-effect-field="${valueField.field}">
      </label>
      ${extras.join('')}
      <button type="button" class="icon-button effect-row__remove" data-action="remove-effect" data-index="${index}" title="删除这条效果">${icon('trash', 15)}</button>
    </div>`;
  }).join('');

  const body = `<div class="editor-layout">
    <div class="editor-form">
      <section class="editor-section">
        <div class="editor-section__head"><span>01</span><h3>卡牌身份</h3></div>
        <div class="field-grid">
          <label class="field field--wide">
            <span>卡牌名称</span>
            <input type="text" maxlength="12" value="${esc(draft.name)}" data-editor-field="name" placeholder="例如：偷来的月光">
          </label>
          <label class="field">
            <span>能量费用 <em>0 - 3</em></span>
            <input type="number" min="0" max="3" value="${Number(draft.cost) || 0}" data-editor-field="cost">
          </label>
          <div class="field">
            <span>卡牌类型</span>
            <div class="segmented">
              ${Object.entries(TYPE_INFO).map(([type, info]) => `<label class="segmented__option" style="--seg:${safeColor(info.color)}">
                <input type="radio" name="editor-card-type" value="${type}" data-editor-field="type" ${draft.type === type ? 'checked' : ''}>
                <span>${esc(info.name)}</span>
              </label>`).join('')}
            </div>
          </div>
          <div class="field field--wide">
            <span>所属流派 <em>决定牌面气质与工坊标签</em></span>
            <div class="school-picker">
              ${Object.entries(SCHOOLS).map(([schoolId, info]) => `<button type="button" class="school-chip ${draft.school === schoolId ? 'is-selected' : ''}" data-action="set-card-school" data-id="${esc(schoolId)}" style="--school:${safeColor(info.color)}">
                <strong>${esc(info.name)}</strong><small>${esc(info.desc.split('。')[0])}</small>
              </button>`).join('')}
            </div>
          </div>
          <label class="field">
            <span>风味文字 <em>可选</em></span>
            <input type="text" maxlength="34" value="${esc(draft.flavor || '')}" data-editor-field="flavor" placeholder="写一句只有这张牌会记得的话">
          </label>
        </div>
      </section>

      <section class="editor-section">
        <div class="editor-section__head"><span>02</span><h3>牌面封印</h3></div>
        <div class="field">
          <span>字符</span>
          <div class="glyph-picker">
            ${CARD_GLYPHS.map((glyph) => `<button type="button" class="glyph-pick ${draft.glyph === glyph ? 'is-selected' : ''}" data-action="set-card-glyph" data-glyph="${esc(glyph)}">${esc(glyph)}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <span>色调</span>
          <div class="palette-picker">
            ${CARD_PALETTES.map((palette) => `<button type="button" class="palette-pick ${draft.palette === palette.color ? 'is-selected' : ''}" data-action="set-card-palette" data-color="${esc(palette.color)}" style="--swatch:${safeColor(palette.color)}" title="${esc(palette.name)}" aria-label="${esc(palette.name)}"></button>`).join('')}
          </div>
        </div>
      </section>

      <section class="editor-section">
        <div class="editor-section__head">
          <span>03</span><h3>效果链</h3>
          <button type="button" class="text-button editor-add-effect" data-action="add-effect">${icon('plus', 14)} 添加效果</button>
        </div>
        <div class="effect-list">${effectsRows}</div>
        <p class="editor-hint">效果会按从上到下的顺序结算。这里的效果允许打破平衡——娱乐模式本来就是用来做梦的。</p>
      </section>

      <label class="editor-save-hint">
        <span class="live-dot"></span>
        新卡牌会自动加入一份到娱乐牌组；你随时可以在试炼牌组里增减。
      </label>
    </div>

    <aside class="editor-preview">
      <span class="section-eyebrow">LIVE FORGE</span>
      <div class="editor-preview-mount">${cardMarkup(preview, { tag: 'div', showFlavor: true, className: 'game-card--preview' })}</div>
      <div class="editor-preview__notes">
        <span>${icon('sparkles', 14)} 实时预览</span>
        <p>${esc(preview.description)}</p>
      </div>
    </aside>
  </div>`;

  return shell(m, {
    eyebrow: 'CARD FORGE',
    title: m.data.isNew ? '铸造一张新牌' : '修改这张牌',
    subtitle: '写下效果，梦会照着它发生。',
    body,
    className: 'modal--editor',
    footer: `<div class="editor-footer-left">
        ${!m.data.isNew ? `<button type="button" class="text-button text-button--danger" data-action="delete-custom-card" data-id="${esc(draft.id)}">${icon('trash', 14)} 销毁此牌</button>` : '<span>自定义卡牌 · 仅用于娱乐模式</span>'}
      </div>
      <div class="editor-footer-right">
        <button type="button" class="button button--ghost" data-action="close-modal">取消</button>
        <button type="button" class="button button--primary" data-action="save-custom-card">${icon('check', 16)} 保存造物</button>
      </div>`,
  });
}

function generateModal(m) {
  const data = m.data;
  const isEnemy = data.kind === 'enemy';
  const enemy = isEnemy ? ENEMY_MAP[data.enemyId] : null;
  const skin = isEnemy ? getEnemySkin(data.enemyId) : null;
  const title = isEnemy ? `为「${skin.name}」生成新形态` : '生成主角的新形象';
  const currentImage = isEnemy ? skin.image : getHeroAvatar();
  const fallback = isEnemy ? enemy?.image : 'assets/heroes/default.webp';
  const providerLabel = G.profile.ai.provider === 'openai'
    ? `自有接口 · ${esc(G.profile.ai.model || '未填写模型')}`
    : '公共免密钥服务 · Pollinations';
  const body = `<div class="generate-layout">
    <div class="generate-preview">
      <span class="generate-preview__frame">${imageTag(currentImage, fallback, '当前形象', '', false)}</span>
      <span class="generate-preview__label">当前形象</span>
      <p>AI 会根据描述与所选画风生成一张方形形象，自动裁切压缩后保存在本机。</p>
      <div class="generate-provider">
        <span>${icon('sparkles', 14)} 生图服务</span>
        <strong>${providerLabel}</strong>
        <button type="button" class="text-button" data-action="open-ai-settings">调整接口</button>
      </div>
    </div>
    <div class="generate-form">
      <label class="field">
        <span>你希望梦见什么？</span>
        <textarea rows="5" data-gen-prompt maxlength="600" placeholder="描述外观、气质、服饰、光线……">${esc(data.subject)}</textarea>
      </label>
      <div class="field">
        <span>画风</span>
        <div class="style-picker">
          ${AI_STYLES.map((style) => `<button type="button" class="style-chip ${data.style === style.id ? 'is-selected' : ''}" data-action="gen-style" data-id="${style.id}">${esc(style.label)}</button>`).join('')}
        </div>
      </div>
      ${data.error ? `<div class="inline-alert inline-alert--error">${icon('close', 15)} ${esc(data.error)}</div>` : ''}
      <p class="generate-note">${icon('lock', 13)} 本地照片不会上传。仅在 AI 生图时，提示词会发送到你选择的生图服务。</p>
    </div>
  </div>`;
  return shell(m, {
    eyebrow: 'DREAM A NEW FACE',
    title,
    subtitle: '照片或 AI，选一个让梦境记住你的方式。',
    body,
    className: 'modal--generate',
    closable: !data.busy,
    footer: data.busy
      ? `<div class="generation-progress"><span class="spinner"></span><span>正在从梦的背面取回图像，请稍候…</span></div>`
      : `<button type="button" class="button button--ghost" data-action="pick-upload" data-target="${isEnemy ? 'enemy' : 'hero'}" data-enemy-id="${esc(data.enemyId || '')}">${icon('upload', 16)} 改用照片</button>
         <button type="button" class="button button--primary" data-action="run-generation">${icon('sparkles', 16)} 生成并应用</button>`,
  });
}

function eventChoiceDisabled(eventId, choiceId) {
  const run = G.run;
  if (!run) return true;
  if (eventId === 'altar' && choiceId === 'blood' && run.hp <= 8) return true;
  if (eventId === 'gambler' && choiceId === 'wager' && run.gold < 10) return true;
  if (eventId === 'library' && choiceId === 'study' && run.hp <= 6) return true;
  if (eventId === 'spring' && choiceId === 'grab' && run.hp <= 5) return true;
  if (eventId === 'pyre' && choiceId === 'offer' && run.hp <= 7) return true;
  if (eventId === 'stoppedClock' && choiceId === 'turn' && run.hp <= 6) return true;
  if (eventId === 'blankBook' && choiceId === 'write' && run.hp <= 10) return true;
  return false;
}

function eventModal(m) {
  const data = m.data;
  const event = EVENTS.find((entry) => entry.id === data.eventId) || EVENTS[0];
  const result = data.result;
  let body;
  if (result) {
    const card = result.card ? resolveCard(result.card, Boolean(result.upgraded)) : null;
    body = `<div class="event-result">
      <span class="event-result__glyph" style="--event:${safeColor(event.color)}">${esc(event.glyph)}</span>
      <span class="section-eyebrow">THE DREAM ANSWERS</span>
      <h3>${esc(event.name)}</h3>
      <p class="event-result__message ${result.tone === 'danger' ? 'is-danger' : result.tone === 'good' ? 'is-good' : ''}">${esc(result.message)}</p>
      ${card ? `<div class="event-result__card">${cardMarkup(card, { tag: 'div', mini: true, badge: 1 })}</div>` : ''}
      <div class="event-result__run">${icon('heart', 14)} ${G.run?.hp}/${G.run?.maxHp} <span>·</span> ${icon('coin', 14)} ${G.run?.gold}</div>
    </div>`;
  } else {
    body = `<div class="event-scene">
      <span class="event-scene__halo" style="--event:${safeColor(event.color)}"></span>
      <span class="event-scene__glyph" style="--event:${safeColor(event.color)}">${esc(event.glyph)}</span>
      <div class="event-scene__copy">
        <span class="section-eyebrow">A STRANGE ENCOUNTER</span>
        <h3>${esc(event.name)}</h3>
        <p>${esc(event.text)}</p>
      </div>
    </div>
    <div class="event-choices">
      ${event.choices.map((choice, index) => {
        const disabled = eventChoiceDisabled(event.id, choice.id);
        return `<button type="button" class="event-choice event-choice--${esc(choice.tone)}" data-action="event-choice" data-id="${esc(choice.id)}" ${disabled ? 'disabled' : ''}>
          <span class="event-choice__index">${String(index + 1).padStart(2, '0')}</span>
          <span class="event-choice__copy"><strong>${esc(choice.label)}</strong><small>${esc(choice.desc)}</small></span>
          <span class="event-choice__arrow">${icon('right', 17)}</span>
        </button>`;
      }).join('')}
    </div>
    <div class="event-footer-meta">${icon('heart', 14)} ${G.run?.hp}/${G.run?.maxHp} <span>·</span> ${icon('coin', 14)} ${G.run?.gold}</div>`;
  }
  return shell(m, {
    eyebrow: 'A STRANGE ENCOUNTER',
    title: result ? '梦的回声' : '奇遇',
    subtitle: result ? '' : '有些东西在等你先开口。',
    body,
    className: 'modal--event',
    closable: false,
    footer: result
      ? `<button type="button" class="button button--primary" data-action="event-continue">${icon('right', 16)} 继续前进</button>`
      : '',
  });
}

function campModal(m) {
  const run = G.run;
  if (!run) return '';
  const mode = m.data.mode || 'choose';
  if (mode === 'forget') {
    const locked = run.deck.length <= MIN_DECK_SIZE;
    const rows = run.deck.map((entry, index) => {
      const def = getCardDef(entry.defId);
      if (!def) return '';
      const resolved = resolveCard(def, entry.upgraded);
      return `<button type="button" class="camp-card-row" data-action="camp-forget-card" data-index="${index}" ${locked ? 'disabled' : ''}>
        <span class="camp-card-row__glyph" style="--card:${safeColor(resolved.accent)}">${esc(resolved.glyph)}</span>
        <span class="camp-card-row__copy">
          <strong>${esc(resolved.displayName)}</strong>
          <small>${esc(resolved.description)}</small>
        </span>
        <span class="camp-card-row__tag">${locked ? '需保留 6 张' : '抹去'}</span>
      </button>`;
    }).join('');
    return shell(m, {
      eyebrow: 'CAMP · FORGET',
      title: '遗忘一张牌',
      subtitle: `${run.deck.length} 张牌里，只有被记住的那些会来。删去一张，往后每一次抽牌都更接近你真正想要的。`,
      body: `<div class="camp-upgrade-list">${rows || '<p class="muted">你的牌组已经空无一物。</p>'}</div>`,
      className: 'modal--camp',
      closable: false,
      footer: `<button type="button" class="button button--ghost" data-action="camp-back">返回营火</button>
        <button type="button" class="button button--ghost" data-action="node-leave">离开营火</button>`,
    });
  }
  if (mode === 'upgrade') {
    const rows = run.deck.map((entry, index) => {
      const def = getCardDef(entry.defId);
      if (!def) return '';
      const resolved = resolveCard(def, entry.upgraded);
      return `<button type="button" class="camp-card-row ${entry.upgraded ? 'is-upgraded' : ''}" data-action="camp-upgrade" data-index="${index}" ${entry.upgraded ? 'disabled' : ''}>
        <span class="camp-card-row__glyph" style="--card:${safeColor(resolved.accent)}">${esc(resolved.glyph)}</span>
        <span class="camp-card-row__copy">
          <strong>${esc(resolved.displayName)}</strong>
          <small>${esc(resolved.description)}</small>
        </span>
        <span class="camp-card-row__tag">${entry.upgraded ? '已强化' : icon('plus', 14)}</span>
      </button>`;
    }).join('');
    return shell(m, {
      eyebrow: 'CAMP · REFINE',
      title: '磨砺一张牌',
      subtitle: '营火会记住你施加在牌上的每一道意志。',
      body: `<div class="camp-upgrade-list">${rows || '<p class="muted">你的牌组里没有可强化的牌。</p>'}</div>`,
      className: 'modal--camp',
      closable: false,
      footer: `<button type="button" class="button button--ghost" data-action="camp-back">返回营火</button>
        <button type="button" class="button button--ghost" data-action="node-leave">离开营火</button>`,
    });
  }
  const healAmount = Math.min(restHealAmount(run), run.maxHp - run.hp);
  const restLocked = Boolean(run.contractMods?.noRestHeal);
  const restDisabled = restLocked || run.hp >= run.maxHp;
  return shell(m, {
    eyebrow: 'CAMPFIRE',
    title: '营火',
    subtitle: restLocked ? '火还在烧，但它已经不认识你的伤口。' : '火焰很小，但足够照亮下一段路。',
    body: `<div class="camp-scene">
      <div class="campfire" aria-hidden="true"><span class="campfire__flame"></span><span class="campfire__log"></span><span class="campfire__spark campfire__spark--a"></span><span class="campfire__spark campfire__spark--b"></span><span class="campfire__spark campfire__spark--c"></span></div>
      <p>你坐在一簇不会熄灭的火边。火里偶尔传来旧日的说话声，但没有人回答你。</p>
    </div>
    <div class="camp-options">
      <button type="button" class="camp-option ${restLocked ? 'is-locked' : ''}" data-action="camp-rest" ${restDisabled ? 'disabled' : ''}>
        <span class="camp-option__icon">${icon(restLocked ? 'lock' : 'heart', 22)}</span>
        <span><strong>休整</strong><small>${restLocked
          ? '折页契约封住了火光：营火不再回复生命'
          : `回复 ${Math.max(0, healAmount)} 点生命${run.hp >= run.maxHp ? '（生命已满）' : ''}`}</small></span>
      </button>
      <button type="button" class="camp-option" data-action="camp-refine">
        <span class="camp-option__icon">${icon('wand', 22)}</span>
        <span><strong>精炼</strong><small>选择一张牌进行强化</small></span>
      </button>
      <button type="button" class="camp-option" data-action="camp-forget" ${run.deck.length <= MIN_DECK_SIZE ? 'disabled' : ''}>
        <span class="camp-option__icon">${icon('trash', 22)}</span>
        <span><strong>遗忘</strong><small>${run.deck.length <= MIN_DECK_SIZE ? `牌组只剩 ${run.deck.length} 张，不能再薄` : '删去一张牌，让牌组更纯粹'}</small></span>
      </button>
    </div>`,
    className: 'modal--camp',
    closable: false,
    footer: '<button type="button" class="button button--ghost" data-action="node-leave">不休息，继续上路</button>',
  });
}

function shopModal(m) {
  const run = G.run;
  const shop = m.data.shop;
  if (!run || !shop) return '';
  const cards = shop.cards.map((offer, index) => {
    const def = getCardDef(offer.defId);
    if (!def) return '';
    const resolved = resolveCard(def);
    return `<div class="shop-offer ${offer.sold ? 'is-sold' : ''}">
      ${cardMarkup(resolved, { tag: 'div', mini: true, className: 'shop-card' })}
      <button type="button" class="shop-buy" data-action="shop-buy-card" data-index="${index}" ${offer.sold || run.gold < offer.price ? 'disabled' : ''}>
        ${offer.sold ? '已售出' : `${icon('coin', 14)} ${offer.price}`}
      </button>
    </div>`;
  }).join('');
  const relicDef = shop.relic ? RELIC_MAP[shop.relic.defId] : null;
  const relicOffer = shop.relic && relicDef
    ? `<div class="shop-offer shop-offer--relic ${shop.relic.sold ? 'is-sold' : ''}">
        <div class="shop-relic-card" style="--relic:${safeColor(relicDef.color)}">
          <span class="shop-relic-card__glyph">${esc(relicDef.glyph)}</span>
          <span class="shop-relic-card__badge">${shop.relic.sold ? '已装备' : '购得即装备'}</span>
          <span class="shop-relic-card__name">${esc(relicDef.name)}</span>
          <p>${esc(relicDef.desc)}</p>
        </div>
        <button type="button" class="shop-buy" data-action="shop-buy-relic" ${shop.relic.sold || run.gold < shop.relic.price ? 'disabled' : ''}>
          ${shop.relic.sold ? `${icon('check', 14)} 已装备` : `${icon('coin', 14)} ${shop.relic.price}`}
        </button>
      </div>`
    : '';
  const bagCount = Array.isArray(run.items) ? run.items.length : 0;
  const itemOffers = (shop.items || []).map((offer, index) => {
    const item = ITEM_MAP[offer.defId];
    if (!item) return '';
    return `<div class="shop-offer shop-offer--item ${offer.sold ? 'is-sold' : ''}" style="--item:${safeColor(item.color)}">
      <div class="shop-item-card">
        <span class="shop-item-card__glyph">${esc(item.glyph)}</span>
        <span class="shop-item-card__copy"><strong>${esc(item.name)}</strong><p>${esc(item.desc)}</p></span>
      </div>
      <button type="button" class="shop-buy" data-action="shop-buy-item" data-index="${index}" ${offer.sold || run.gold < offer.price || bagCount >= 10 ? 'disabled' : ''}>
        ${offer.sold ? `${icon('check', 14)} 已收好` : `${icon('coin', 14)} ${offer.price}`}
      </button>
    </div>`;
  }).join('');
  const healAmount = Math.min(22, run.maxHp - run.hp);
  const stealOdds = stealChance(run);
  const stealUsed = Boolean(shop.stealUsed);
  return shell(m, {
    eyebrow: 'THE WANDERING MERCHANT',
    title: '梦里行商',
    subtitle: shop.discount ? '幸运币在柜台下闪了一下：今天的价格便宜了两成。' : '只收金币。梦里的钱，在外面可花不掉。',
    body: `<div class="shop-topline">
        <span>${icon('coin', 16)} 你持有 <strong>${run.gold}</strong> 金币</span>
        <span>${icon('heart', 15)} ${run.hp} / ${run.maxHp}</span>
        <span>${icon('drop', 15)} 行囊 ${bagCount}/10</span>
      </div>
      <p class="shop-raid-note">${icon('skull', 13)} 柜台后的那个人也在打量你的刀。你可以掀翻柜台——他会把货箱里所有珍藏都用在你身上，而且这一战没有退路。</p>
      <div class="shop-steal ${stealUsed ? 'is-used' : ''}">
        <div class="shop-steal__copy">
          <span class="section-eyebrow">A QUIET HAND</span>
          <strong>${stealUsed ? '那只手已经试过一次了' : '趁他低头时伸手'}</strong>
          <p>${stealUsed ? '行商把货箱往自己脚边挪了挪，眼睛始终没有离开你。' : '只偷一件道具和一小袋金币。失败会被他扣住手腕，立刻开战，且没有退路。'}</p>
        </div>
        <div class="shop-steal__odds">
          <span class="shop-steal__attr">${icon('sparkles', 13)} 机敏 ${Number(runAttributes(run).guile) || 0}</span>
          <strong>${stealOdds}<small>%</small></strong>
          <button type="button" class="button button--ghost shop-steal__btn" data-action="shop-steal" ${stealUsed ? 'disabled' : ''}>
            ${stealUsed ? '已失手一次' : `${icon('wand', 15)} 偷窃`}
          </button>
        </div>
      </div>
      <div class="shop-layout">
        <div class="shop-cards">
          <span class="shop-section-label">卡牌</span>
          <div class="shop-card-grid">${cards}</div>
        </div>
        <div class="shop-side">
          <span class="shop-section-label">异梦商品</span>
          ${relicOffer}
          <div class="shop-offer shop-offer--heal ${shop.heal.sold ? 'is-sold' : ''}">
            <div class="shop-heal-card">
              <span>${icon('heart', 24)}</span>
              <strong>温热的梦泉</strong>
              <p>回复最多 22 点生命${run.hp >= run.maxHp ? '（当前已满）' : ''}</p>
            </div>
            <button type="button" class="shop-buy" data-action="shop-buy-heal" ${shop.heal.sold || run.gold < shop.heal.price || run.hp >= run.maxHp ? 'disabled' : ''}>
              ${shop.heal.sold ? '已售出' : `${icon('coin', 14)} ${shop.heal.price}`}
            </button>
          </div>
          ${shop.purge ? `<div class="shop-offer shop-offer--purge ${shop.purge.sold ? 'is-sold' : ''}">
            <div class="shop-heal-card">
              <span>${icon('drop', 24)}</span>
              <strong>忘名</strong>
              <p>从牌组里移除一张牌。牌越少，你越常抽到想要的那一张。</p>
            </div>
            <button type="button" class="shop-buy" data-action="open-purge" ${shop.purge.sold || run.gold < shop.purge.price || run.deck.length <= 8 ? 'disabled' : ''}>
              ${shop.purge.sold ? '已忘名' : `${icon('coin', 14)} ${shop.purge.price}`}
            </button>
          </div>` : ''}
          <span class="shop-section-label">旅途道具 <em>不消耗能量</em></span>
          ${itemOffers || '<p class="shop-empty">货箱里只剩下几层雾。</p>'}
        </div>
      </div>`,
    className: 'modal--shop',
    closable: false,
    footer: `<button type="button" class="button button--danger" data-action="attack-merchant" ${bagCount >= 10 ? 'title="行囊已满，战利品会折算成金币"' : ''}>${icon('sword', 16)} 掀翻柜台</button>
      <button type="button" class="button button--ghost" data-action="node-leave">离开行商</button>`,
  });
}

function purgeModal(m) {
  const run = G.run;
  const shop = m.data?.shop;
  if (!run) return '';
  const selectedIndex = Number.isInteger(m.data?.selectedIndex) ? m.data.selectedIndex : -1;
  const selectedEntry = selectedIndex >= 0 ? run.deck[selectedIndex] : null;
  const selectedDef = selectedEntry ? resolveCard(getCardDef(selectedEntry.defId), selectedEntry.upgraded) : null;
  const before = runResonance(run);
  const afterDeck = selectedEntry ? run.deck.filter((_, index) => index !== selectedIndex) : null;
  const after = afterDeck ? runResonance({ ...run, deck: afterDeck }) : null;
  const beforeShare = before?.primary ? Math.round(before.topShare * 100) : null;
  const afterShare = after?.primary ? Math.round(after.topShare * 100) : null;
  const rows = run.deck.map((entry, index) => {
    const def = resolveCard(getCardDef(entry.defId), entry.upgraded);
    return `<button type="button" class="deck-modal-item purge-item ${index === selectedIndex ? 'is-selected' : ''}" data-action="purge-select" data-index="${index}" title="选中后查看共鸣变化" aria-pressed="${index === selectedIndex}">
      ${cardMarkup(def, { tag: 'div', mini: true })}
    </button>`;
  }).join('');
  const preview = selectedDef ? `<div class="purge-preview">
      <span class="purge-preview__eyebrow">忘名之后</span>
      <strong>【${esc(selectedDef.name)}】</strong>
      <span class="purge-preview__deck">牌组 ${run.deck.length} → ${run.deck.length - 1} 张</span>
      <p>${esc(resonanceTitle(before))}${beforeShare != null ? `（主导 ${beforeShare}%）` : ''}<i>→</i>${esc(resonanceTitle(after))}${afterShare != null ? `（主导 ${afterShare}%）` : ''}</p>
    </div>` : `<p class="deck-modal-note purge-hint">先点一张牌，看看忘掉它之后共鸣会变成什么样。</p>`;
  return shell(m, {
    eyebrow: 'LET A NAME GO',
    title: '忘掉哪一张？',
    subtitle: `行商收 ${shop?.purge?.price ?? 0} 金币，替你抹去一张牌的名字。`,
    body: `<p class="deck-modal-note">牌组越薄，关键牌出现得越勤——20 张里抽到某张是 25%，15 张就是 33%。删掉凑数的牌，你主导流派的占比也会跟着升上去。</p>
      <div class="deck-modal-grid">${rows}</div>
      ${preview}`,
    className: 'modal--deck modal--purge',
    footer: `<button type="button" class="button button--ghost" data-action="back-to-shop">再想想</button>
      <button type="button" class="button button--danger" data-action="purge-confirm" ${selectedDef ? '' : 'disabled'}>
        ${selectedDef ? `忘掉【${esc(selectedDef.name)}】 · ${icon('coin', 14)} ${shop?.purge?.price ?? 0}` : '先选一张牌'}
      </button>`,
  });
}

/** 梦的碎片能解开的三张牌。只加「可能」，不加「数值」。 */
export const SHARD_UNLOCKS = [
  { id: 'manifoldEdge', cost: 40 },
  { id: 'dreamConfluence', cost: 60 },
  { id: 'ashLegacy', cost: 80 },
];

function shardsModal(m) {
  const shards = Number(G.profile.shards) || 0;
  const unlocked = new Set(Array.isArray(G.profile.shardUnlocks) ? G.profile.shardUnlocks : []);
  const rows = SHARD_UNLOCKS.map((item) => {
    const card = CARD_MAP[item.id];
    const owned = unlocked.has(item.id);
    const affordable = shards >= item.cost;
    return `<div class="shard-row ${owned ? 'is-owned' : ''}">
      <div class="shard-row__copy">
        <strong>${esc(card?.name || item.id)}</strong>
        <p>${esc(card?.flavor || '梦把它压在很深的地方。')}</p>
      </div>
      <button type="button" class="shop-buy" data-action="unlock-shard" data-id="${esc(item.id)}"
        ${owned || !affordable ? 'disabled' : ''}>
        ${owned ? `${icon('check', 14)} 已解开` : `${icon('sparkles', 14)} ${item.cost} 碎片`}
      </button>
    </div>`;
  }).join('');
  return shell(m, {
    eyebrow: 'SHARDS OF THE DREAM',
    title: `梦的碎片 · ${shards}`,
    subtitle: '每一场没走完的梦，都会在灯塔下留一点灰。它可以扩充卡池，也可以在祭坛上换一条规则。',
    body: `<p class="deck-modal-note">碎片有两个去处：解开被梦压住的稀有牌，永久扩充奖励与商店的卡池；或在地图的<strong>梦呓祭坛</strong>签下契约，让规则只在这一趟梦里改写。契约最多同时生效两份，撕毁不退还碎片。</p>
      <div class="shard-list">${rows}</div>`,
    className: 'modal--deck modal--shards',
    footer: '<button type="button" class="button button--ghost" data-action="close-modal">收起</button>',
  });
}

function contractsModal(m) {
  const run = G.run;
  if (!run) {
    return shell(m, {
      eyebrow: 'THE DREAM BARGAINS',
      title: '梦呓祭坛',
      subtitle: '祭坛只在启程之后醒来。',
      body: '<p class="deck-modal-note">先开始一趟远征，梦才会在岛上为你开价。</p>',
      className: 'modal--contracts',
      footer: '<button type="button" class="button button--ghost" data-action="close-modal">离开祭坛</button>',
    });
  }
  const shards = Number(G.profile.shards) || 0;
  const active = contractList(run.contracts || []);
  const activeIds = new Set(active.map((contract) => contract.id));
  const price = contractPrice(active.length);
  const full = active.length >= MAX_CONTRACTS;
  const offers = Array.isArray(m.data?.offers) ? m.data.offers : [];
  const activeMarkup = active.length
    ? active.map((contract) => `<article class="contract-active-card" style="--contract:${safeColor(contract.color)}">
        <span class="contract-active-card__glyph">${esc(contract.glyph)}</span>
        <div class="contract-active-card__copy">
          <div class="contract-active-card__top"><strong>${esc(contract.name)}</strong><span>生效中</span></div>
          <p class="is-benefit">${esc(contract.benefit)}</p>
          <p class="is-drawback">${esc(contract.drawback)}</p>
        </div>
        <button type="button" class="contract-active-card__break" data-action="break-contract" data-id="${esc(contract.id)}" title="撕毁契约不会退还碎片">撕毁</button>
      </article>`).join('')
    : '<p class="contract-empty">这一趟梦还没有签下任何契约。</p>';
  const offerMarkup = offers.map((contract) => {
    const signed = activeIds.has(contract.id);
    const unaffordable = shards < price;
    const disabled = signed || full || unaffordable;
    const label = signed ? `${icon('check', 14)} 已签下` : full ? '契约已满' : unaffordable ? `还差 ${price - shards} 片` : `${icon('scroll', 14)} 签下 · ${price} 片`;
    return `<article class="contract-offer ${signed ? 'is-signed' : ''}" style="--contract:${safeColor(contract.color)}">
      <div class="contract-offer__head">
        <span class="contract-offer__glyph">${esc(contract.glyph)}</span>
        <div><small>梦呓契约</small><strong>${esc(contract.name)}</strong></div>
      </div>
      <blockquote class="contract-offer__flavor">「${esc(contract.flavor)}」</blockquote>
      <div class="contract-offer__terms">
        <span class="contract-offer__term is-benefit"><b>益</b>${esc(contract.benefit)}</span>
        <span class="contract-offer__term is-drawback"><b>偿</b>${esc(contract.drawback)}</span>
      </div>
      <button type="button" class="contract-offer__sign" data-action="sign-contract" data-id="${esc(contract.id)}" ${disabled ? 'disabled' : ''}>${label}</button>
    </article>`;
  }).join('');
  return shell(m, {
    eyebrow: 'THE DREAM BARGAINS',
    title: '梦呓祭坛',
    subtitle: '梦不白给。它只把一条规则借给你，然后等你付账。',
    body: `<div class="contract-wallet">
      <span class="contract-wallet__shards">${icon('sparkles', 15)} <strong>${shards}</strong> 梦的碎片</span>
      <span>下一份 ${price} 片</span>
      <span>${active.length} / ${MAX_CONTRACTS} 已签</span>
    </div>
    <p class="deck-modal-note">契约只属于这一趟梦，收益与代价同时生效；撕毁会立刻移除规则，但不会退还碎片。卡池解锁与祭坛共用同一份碎片。</p>
    <section class="contract-section">
      <div class="contract-section__head"><span>已经生效</span><small>ACTIVE</small></div>
      <div class="contract-active-list">${activeMarkup}</div>
    </section>
    <section class="contract-section">
      <div class="contract-section__head"><span>梦的报价</span><small>${offers.length ? '三份选一 · 只在这一趟梦里有效' : '祭坛沉默着'}</small></div>
      <div class="contract-offers">${offerMarkup || '<p class="contract-empty">祭坛此刻没有回音。去走一段路，再来听。</p>'}</div>
    </section>`,
    className: 'modal--contracts',
    footer: '<button type="button" class="button button--ghost" data-action="close-modal">离开祭坛</button>',
  });
}


function treasureModal(m) {
  const treasure = m.data.treasure;
  if (!treasure) return '';
  const relic = treasure.relicId ? RELIC_MAP[treasure.relicId] : null;
  const item = treasure.itemId ? ITEM_MAP[treasure.itemId] : null;
  const bagFull = (G.run?.items?.length || 0) >= 10;
  const body = `<div class="treasure-scene">
    <div class="treasure-chest" aria-hidden="true">
      <span class="treasure-chest__lid"></span>
      <span class="treasure-chest__body"></span>
      <span class="treasure-chest__glow"></span>
      <span class="treasure-chest__spark treasure-chest__spark--a"></span>
      <span class="treasure-chest__spark treasure-chest__spark--b"></span>
    </div>
    <p>箱子上的锁早就坏了，像有人特意为你留了一条缝。</p>
    <div class="treasure-loot">
      <div class="treasure-loot__item">${icon('coin', 24)}<strong>${treasure.gold}</strong><span>金币</span></div>
      ${relic ? `<div class="treasure-loot__item">${icon('sparkles', 24)}<strong>${esc(relic.name)}</strong><span>遗物 · 自动装备 · ${esc(relic.desc)}</span></div>` : ''}
      ${item ? `<div class="treasure-loot__item treasure-loot__item--consumable" style="--item:${safeColor(item.color)}"><span class="treasure-loot__glyph">${esc(item.glyph)}</span><strong>${esc(item.name)}</strong><span>旅途道具 · ${bagFull ? '行囊已满，将折算为 18 金币' : esc(item.desc)}</span></div>` : ''}
    </div>
  </div>`;
  return shell(m, {
    eyebrow: 'A SLEEPING TROVE',
    title: '一段无主的梦',
    subtitle: '你可以带走它，或者把它留给下一个迷路的人。',
    body,
    className: 'modal--treasure',
    closable: false,
    footer: `<button type="button" class="button button--ghost" data-action="node-leave">留给下一个人</button>
      <button type="button" class="button button--primary" data-action="treasure-claim">${icon('chest', 16)} 收下这段梦</button>`,
  });
}

function bondPips(bond) {
  return `<span class="bond-pips">${[0, 1, 2].map((index) => `<i class="${index < bond ? 'is-lit' : ''}"></i>`).join('')}</span>`;
}

function parleyModal(m) {
  const battle = G.run?.battle || G.sandboxBattle;
  const profile = battle ? parleyProfile(battle) : null;
  if (!battle || !profile) return '';
  const personality = profile.personality;
  const accent = safeColor(profile.accent || '#b48bc9');
  const tierName = battle.tier === 'boss'
    ? '岛屿之主'
    : battle.tier === 'merchant'
      ? '携宝行商'
      : battle.tier === 'elite'
        ? '镜中精英'
        : '游荡梦魇';
  const result = m.data?.result;
  const bossParleys = G.profile.world?.bossParleys?.length || 0;
  const ledger = battle.tier === 'boss'
    ? `<span class="parley-scene__ledger">${icon('scroll', 12)} 群岛已经记住 ${bossParleys} / 4 位岛屿之主的沉默。谈成更多，终局会多出一种谁也没写过的可能。</span>`
    : '';
  if (result) {
    const success = Boolean(result.success);
    const body = `<div class="parley-result ${success ? 'is-success' : 'is-rage'}" style="--parley:${accent}">
      <span class="parley-result__seal" aria-hidden="true">${esc(success ? '缓' : '怒')}</span>
      <div class="parley-result__roll">
        <strong>${result.roll}</strong><span>/ 100</span><small>成功率 ${result.chance}%</small>
      </div>
      <h3>${esc(success ? '杀意出现了一道缝' : '最后的耐心烧断了')}</h3>
      <p>${esc(result.message || '')}</p>
      <div class="parley-result__detail">${esc(result.detail || '')}</div>
      ${result.cost ? `<div class="parley-result__cost">${icon('coin', 13)} 递出的 ${result.cost} 枚金币没有收回。</div>` : ''}
      <blockquote>${esc(success ? '它没有放下刀，只是刀尖偏了一寸。' : '从现在起，每一刀都会更重；但它也顾不上闪避了。')}</blockquote>
      ${ledger}
    </div>`;
    return shell(m, {
      eyebrow: 'THE WORD THAT LANDED',
      title: success ? '一次迟疑' : '交涉破裂',
      body,
      className: 'modal--parley modal--parley-result',
      footer: `<button type="button" class="button ${success ? 'button--primary' : 'button--danger'}" data-action="close-parley">${icon('sword', 16)} ${success ? '趁它迟疑，出牌' : '接住它的怒火'}</button>`,
    });
  }
  const options = parleyOptions(battle);
  const attrs = runAttributes(G.run);
  const attributeStrip = `<div class="parley-attributes">
    ${Object.entries(ATTRIBUTES).map(([id, info]) => `<span class="parley-attribute" style="--attr:${safeColor(info.color)}" title="${esc(info.desc)}">
      <i>${esc(info.glyph)}</i>
      <span><small>${esc(info.name)}</small><strong>${Number(attrs[id]) || 0}</strong></span>
    </span>`).join('')}
    <span class="parley-attributes__note">每一点属性都会改写语气；成功率由性格、身份与你的属性共同决定。</span>
  </div>`;
  const body = `<div class="parley-scene" style="--parley:${accent}">
    <div class="parley-scene__head">
      <span class="parley-scene__glyph">${esc(battle.enemy.glyph || profile.glyph || '言')}</span>
      <div class="parley-scene__who">
        <span class="section-eyebrow">${esc(tierName)} · 有灵智</span>
        <h3>${esc(battle.enemy.name)}</h3>
        <span class="parley-personality"><b>${esc(personality.name)}</b>${esc(personality.desc)}</span>
      </div>
    </div>
    <p class="parley-scene__premise">它听得懂。但听懂和让步是两回事——这一场没法谈和，最多只能让它迟疑一瞬。选错一句话，它就会立刻扑上来。</p>
    ${attributeStrip}
    <div class="parley-approaches">
      ${options.map((approach) => {
        const favored = personality.weak === approach.id;
        const resisted = personality.resist === approach.id;
        const attr = approach.attribute || { id: 'guile', value: 0, bonus: 0 };
        const attrInfo = ATTRIBUTES[attr.id] || ATTRIBUTES.guile;
        return `<button type="button" class="parley-approach ${favored ? 'is-favored' : ''} ${resisted ? 'is-resisted' : ''}" data-action="parley-approach" data-id="${esc(approach.id)}" ${approach.disabled ? 'disabled' : ''} style="--chance:${approach.chance}">
          <span class="parley-approach__glyph">${esc(approach.glyph)}</span>
          <span class="parley-approach__copy">
            <strong>${esc(approach.name)}${approach.cost ? `<small>${icon('coin', 11)} ${approach.cost}</small>` : ''}</strong>
            <em>${esc(approach.desc)}</em>
            <span class="parley-approach__tags">${favored ? '<i class="is-good">投其所好</i>' : ''}${resisted ? '<i class="is-bad">会被看穿</i>' : ''}<i class="parley-approach__attr" style="--attr:${safeColor(attrInfo.color)}">${esc(attrInfo.glyph)} ${esc(attrInfo.name)} ${attr.value}<b>${attr.bonus >= 0 ? '+' : ''}${attr.bonus}%</b></i></span>
          </span>
          <span class="parley-approach__odds">
            <b>${approach.chance}<small>%</small></b>
            <span class="parley-approach__bar"><i style="width:${approach.chance}%"></i></span>
          </span>
        </button>`;
      }).join('')}
    </div>
    <div class="parley-scene__warning">${icon('flame', 14)} 失败：它立刻进入激怒，攻击提升，但敏捷与闪避下降。成功：它不会停手，只会虚弱一瞬，并给你 10 点格挡。每场战斗只有一次开口的机会。</div>
    ${ledger}
  </div>`;
  return shell(m, {
    eyebrow: 'WORDS BEFORE BLADES',
    title: '试着开口',
    subtitle: '所有有灵智的梦魇都听得懂人话。问题是，它们还愿不愿意听。',
    body,
    className: 'modal--parley',
    footer: `<button type="button" class="button button--ghost" data-action="close-parley">${icon('sword', 15)} 不谈了，直接动手</button>`,
  });
}

function storyModal(m) {
  const story = STORIES[m.data?.storyId];
  if (!story) return '';
  const lines = storyLines(story.id, G.run?.originId || G.profile.originId);
  const index = Math.max(0, Math.min(Number(m.data.index) || 0, lines.length - 1));
  const line = lines[index];
  const previous = index > 0 ? lines[index - 1] : null;
  const last = index >= lines.length - 1;
  const originId = G.run?.originId || G.profile.originId;
  const hero = { heroSrc: getHeroAvatar(originId), heroName: getHeroName() };
  const art = storyArtFor(story.id) || story.art || {};
  const scene = storySceneAt(art, lines, index);
  const previousScene = index > 0 ? storySceneAt(art, lines, index - 1) : null;
  const sceneSteady = Boolean(scene && previousScene && scene.src === previousScene.src);
  const portrait = storyPortraitAt(art, lines, index, hero);
  const previousPortrait = index > 0 ? storyPortraitAt(art, lines, index - 1, hero) : null;
  const portraitSteady = Boolean(portrait && previousPortrait
    && portrait.src === previousPortrait.src && portrait.who === previousPortrait.who);
  const prop = storyPropAt(art, lines, index);
  const preloads = index === 0
    ? storyPreloads(art, lines, hero).filter((src) => src !== scene?.src)
    : [];
  const body = `<div class="story-cinema ${scene ? 'has-art' : ''}" style="--story:${safeColor(story.color)}">
    ${scene ? `<img class="story-cinema__backdrop ${sceneSteady ? 'is-steady' : ''}" src="${esc(scene.src)}" alt="" aria-hidden="true" loading="eager" decoding="async">
      <span class="story-cinema__shade" aria-hidden="true"></span>` : ''}
    ${preloads.length ? `<span class="story-cinema__preload" aria-hidden="true">
      ${preloads.map((src) => `<img src="${esc(src)}" alt="" decoding="async">`).join('')}
    </span>` : ''}
    <span class="story-cinema__glow" aria-hidden="true"></span>
    <span class="story-cinema__seal" aria-hidden="true">${esc(story.glyph)}</span>
    <p class="story-cinema__subtitle">${esc(story.subtitle)}</p>
    ${portrait ? `<div class="story-cinema__presence ${portrait.speaking ? 'is-speaking' : 'is-ambient'} ${portraitSteady ? 'is-steady' : ''} ${portrait.tone ? `is-${esc(portrait.tone)}` : ''}" style="--speaker:${safeColor(portrait.accent || story.color)}" aria-hidden="true">
      <span class="story-cinema__portrait">
        <img src="${esc(portrait.src)}" alt="" loading="eager" decoding="async" style="--focus:${esc(portrait.focus || '50% 45%')}">
      </span>
      <span class="story-cinema__portrait-name">${esc(portrait.label || portrait.who)}</span>
    </div>` : ''}
    <div class="story-cinema__line">
      ${previous ? `<p class="story-cinema__echo">「${esc(previous.text)}」</p>` : ''}
      <span class="story-cinema__who">${esc(line.who)}</span>
      <p class="story-cinema__text">${esc(line.text)}</p>
      ${prop ? `<figure class="story-cinema__prop">
        <img src="${esc(prop.src)}" alt="${esc(prop.alt || prop.label || '')}" loading="eager" decoding="async">
        ${prop.label ? `<figcaption>${esc(prop.label)}</figcaption>` : ''}
      </figure>` : ''}
    </div>
    <div class="story-cinema__progress" aria-label="剧情进度 ${index + 1} / ${lines.length}">
      ${lines.map((_, dot) => `<i class="${dot <= index ? 'is-past' : ''} ${dot === index ? 'is-now' : ''}"></i>`).join('')}
    </div>
  </div>`;
  return shell(m, {
    eyebrow: story.eyebrow,
    title: story.title,
    body,
    className: 'modal--story',
    closable: false,
    footer: `<button type="button" class="text-button text-button--muted" data-action="story-skip">跳过这段回忆</button>
      <button type="button" class="button button--primary" data-action="story-advance">${last ? `${icon('right', 16)} ${esc(m.data.afterLabel || '继续')}` : '继续聆听'}</button>`,
  });
}

function npcModal(m) {
  const npc = NPC_MAP[m.data?.npcId];
  if (!npc) return '';
  const world = G.profile.world;
  const bond = npcBond(world, npc.id);
  const faction = factionOf(npc.id);
  const quests = questsForNpc(world, npc.id).filter((entry) => entry.status !== 'locked');
  const body = `<div class="npc-scene npc-scene--${esc(npc.faction || 'neutral')}" style="--npc:${safeColor(npc.color)};--faction:${safeColor(faction.color)}">
    <div class="npc-scene__portrait">
      <span class="npc-scene__ring" aria-hidden="true"></span>
      <span class="npc-scene__glyph">${esc(npc.glyph)}</span>
      <span class="npc-scene__meta"><small>${esc(npc.title)}</small><strong>${esc(npc.name)}</strong><em>${bondPips(bond)} ${esc(bondLabel(bond))}</em></span>
    </div>
    <span class="npc-scene__faction">${esc(faction.glyph)} ${esc(faction.name)}${npc.band ? ` · ${esc(npc.band)}` : ''}</span>
    <blockquote class="npc-scene__quote">${esc(m.data.line || npc.first)}</blockquote>
    <p class="npc-scene__intro">${esc(npc.intro)}</p>
    ${npc.bondLine && bond >= 2 ? `<p class="npc-scene__bondline">${icon('sparkles', 13)} ${esc(npc.bondLine)}</p>` : ''}
    ${quests.length ? `<div class="npc-scene__quests">
      <span class="npc-scene__quests-title">${icon('scroll', 13)} 他记得的委托</span>
      ${quests.map(({ quest, status, progress }) => {
        const card = CARD_MAP[quest.card];
        return `<div class="npc-quest ${status === 'completed' ? 'is-completed' : ''}">
          <div class="npc-quest__top"><strong>${esc(quest.title)}</strong><span>${status === 'completed' ? '已完成' : `${progress.value}/${progress.target}`}</span></div>
          <p>${esc(quest.desc)}</p>
          <span class="npc-quest__reward">${status === 'completed' ? icon('check', 11) : icon('sparkles', 11)} ${card ? esc(card.name) : '纪念牌'}</span>
        </div>`;
      }).join('')}
    </div>` : ''}
  </div>`;
  const canTalk = Boolean(m.data.dialogueId);
  return shell(m, {
    eyebrow: 'THE OLD ONES ON THE ISLANDS',
    title: npc.name,
    subtitle: faction.desc,
    body,
    className: 'modal--npc',
    footer: `${canTalk
      ? `<button type="button" class="button button--primary" data-action="npc-dialogue">${icon('scroll', 15)} 说点正事</button>`
      : `<button type="button" class="button button--ghost" data-action="npc-next">${icon('scroll', 15)} 再听一句</button>`}
      <button type="button" class="button button--ghost" data-action="close-modal">收起这段话</button>`,
  });
}

/**
 * 分支对话。一个节点一屏：说话人、台词、选项。
 * 选完立刻能看到下一句，中途不关窗，这样才像在跟人说话而不是看文档。
 */
function dialogueModal(m) {
  const npcId = m.data?.npcId;
  const npc = NPC_MAP[npcId];
  const node = dialogueNode(m.data?.dialogueId, m.data?.nodeId);
  if (!npc || !node) return '';
  const world = G.profile.world;
  const faction = FACTIONS[node.faction] || FACTIONS.neutral;
  const bond = npcBond(world, npcId);
  const hasChoices = Boolean(node.choices?.length);
  // 有 next 但没选项的节点是「中转句」：只给人看一句，然后自动往下走，不算聊完。
  const hasNext = Boolean(node.next);
  const isEnd = !hasChoices && !hasNext;
  const isNarrator = node.who === '旁白';
  const body = `<div class="dlg" style="--npc:${safeColor(npc.color)};--faction:${safeColor(faction.color)}">
    <div class="dlg__stage">
      <span class="dlg__halo" aria-hidden="true"></span>
      <span class="dlg__glyph ${isNarrator ? 'is-narrator' : ''}">${esc(isNarrator ? '梦' : npc.glyph)}</span>
      <span class="dlg__chip">${esc(faction.glyph)} ${esc(faction.name)}</span>
      ${bond >= 2 ? `<span class="dlg__bond">${icon('sparkles', 11)} ${esc(bondLabel(bond))}</span>` : ''}
    </div>
    <span class="dlg__who">${esc(node.who)}</span>
    <p class="dlg__line">${esc(node.text)}</p>
    ${node.effect?.line ? `<p class="dlg__after">${esc(node.effect.line)}</p>` : ''}
    ${hasChoices ? `<div class="dlg__choices">
      ${node.choices.map((choice, index) => `<button type="button" class="dlg-choice" data-action="dlg-choice" data-id="${esc(choice.id)}">
        <span class="dlg-choice__index">${String(index + 1).padStart(2, '0')}</span>
        <span class="dlg-choice__label">${esc(choice.label)}</span>
        ${choice.flag ? `<span class="dlg-choice__tag">${icon('sparkles', 10)} 会被记住</span>` : ''}
        ${choice.cost?.gold ? `<span class="dlg-choice__tag is-cost">${icon('coin', 10)} ${choice.cost.gold}</span>` : ''}
        <span class="dlg-choice__arrow">${icon('right', 15)}</span>
      </button>`).join('')}
    </div>` : ''}
  </div>`;
  const footer = isEnd
    ? `<button type="button" class="button button--primary" data-action="dlg-close">${icon('check', 16)} 就这样吧</button>`
    : hasNext
      ? `<button type="button" class="button button--ghost" data-action="dlg-continue">继续听</button>
        <button type="button" class="text-button text-button--muted" data-action="dlg-close">先不聊了</button>`
      : `<button type="button" class="text-button text-button--muted" data-action="dlg-close">先不聊了</button>`;
  return shell(m, {
    eyebrow: `${npc.name.toUpperCase()} · ${node.dialogueTitle || '一段话'}`,
    title: node.dialogueTitle || npc.name,
    subtitle: isNarrator ? '' : npc.title,
    body,
    className: 'modal--dialogue',
    closable: isEnd,
    footer,
  });
}

function questsModal(m) {
  const world = G.profile.world;
  const entries = QUESTS.map((quest) => ({
    quest,
    status: questStatus(world, quest),
    progress: questProgress(world, quest),
  }));
  const groups = [
    ['active', '仍在等待', entries.filter((entry) => entry.status === 'active')],
    ['completed', '已经完成', entries.filter((entry) => entry.status === 'completed')],
    ['locked', '尚未听见', entries.filter((entry) => entry.status === 'locked')],
  ];
  const row = ({ quest, status, progress }) => {
    const npc = NPC_MAP[quest.npc];
    const card = CARD_MAP[quest.card];
    const percent = Math.min(100, (progress.value / progress.target) * 100);
    const requirement = quest.requires ? QUEST_MAP[quest.requires] : null;
    return `<div class="quest-modal-entry quest-modal-entry--${status}" style="--npc:${safeColor(npc?.color || '#b48bc9')}">
      <span class="quest-modal-entry__glyph">${esc(npc?.glyph || '页')}</span>
      <div class="quest-modal-entry__body">
        <div class="quest-modal-entry__top">
          <strong>${esc(quest.title)}</strong>
          <span>${status === 'completed' ? icon('check', 11) : status === 'locked' ? icon('lock', 11) : `${progress.value} / ${progress.target}`}</span>
        </div>
        <small>${esc(npc?.name || '岛民')} · ${esc(progress.label)}</small>
        <p>${status === 'locked' && requirement ? `先完成「${esc(requirement.title)}」才能听见这份委托。` : esc(quest.desc)}</p>
        ${status === 'active' ? `<span class="quest-modal-entry__bar"><i style="width:${percent}%"></i></span>` : ''}
        <span class="quest-modal-entry__reward">${icon('cards', 11)} ${card ? esc(card.name) : '纪念牌'}${status === 'completed' ? ' · 已收入行囊' : ''}</span>
      </div>
    </div>`;
  };
  const body = `<div class="quest-modal-summary">
    <div><strong>${entries.filter((entry) => entry.status === 'completed').length}</strong><span>已完成</span></div>
    <div><strong>${entries.filter((entry) => entry.status === 'active').length}</strong><span>进行中</span></div>
    <div><strong>${world.questCards.length}</strong><span>纪念牌</span></div>
  </div>
  ${groups.map(([id, title, list]) => list.length ? `<section class="quest-modal-group">
    <div class="quest-modal-group__head"><span>${title}</span><small>${id === 'completed' ? 'COMMISSIONED' : id === 'locked' ? 'STILL IN THE FOG' : 'IN PROGRESS'}</small></div>
    ${list.map(row).join('')}
  </section>` : '').join('')}`;
  return shell(m, {
    eyebrow: 'THE COMMISSION BOOK',
    title: '岛民的委托',
    subtitle: '完成委托可以带走一张只属于这段旅程的纪念牌。',
    body,
    className: 'modal--quests',
    footer: '<button type="button" class="button button--primary" data-action="close-modal">合上任务簿</button>',
  });
}

function questRewardModal(m) {
  const quest = QUEST_MAP[m.data?.questId];
  if (!quest) return '';
  const npc = NPC_MAP[quest.npc];
  const card = CARD_MAP[quest.card];
  const body = `<div class="quest-reward-scene" style="--npc:${safeColor(npc?.color || '#b48bc9')}">
    <span class="quest-reward-scene__rays" aria-hidden="true"></span>
    <span class="section-eyebrow">COMMISSION COMPLETE</span>
    <h3>${esc(quest.title)}</h3>
    <p class="quest-reward-scene__giver">${esc(npc?.name || '岛民')} 把一件东西放进了你的牌组。</p>
    ${card ? `<div class="quest-reward-scene__card">${cardMarkup(card, { tag: 'div', showFlavor: true, className: 'quest-reward-card' })}</div>` : ''}
    <blockquote>${esc(quest.rewardText)}</blockquote>
    <span class="quest-reward-scene__next">${icon('sparkles', 13)} 纪念牌已加入本次旅程后的行囊，可在群岛选择随行。</span>
  </div>`;
  return shell(m, {
    eyebrow: 'A CARD REMEMBERS',
    title: '委托完成',
    body,
    className: 'modal--quest-reward',
    closable: false,
    footer: `<button type="button" class="button button--primary button--large" data-action="quest-claim">${icon('cards', 16)} 收下这张纪念牌</button>`,
  });
}

function endingCodexBody(world) {
  const choices = endingChoices(world);
  const unlocked = world.endings.length;
  return `<div class="codex-summary">
    <span class="codex-summary__seal">${icon('crown', 26)}</span>
    <div><strong>${unlocked} / ${ENDINGS.length}</strong><span>结局已被群岛记住</span></div>
    <p>每一种告别，都是你在心的裂口前做过的决定。新的远征可以让你重新选择。</p>
  </div>
  <div class="codex-list">
    ${choices.map(({ ending, available, missing }) => {
      const seen = world.endings.includes(ending.id);
      const concealed = ending.hidden && !seen && !available;
      const hint = concealed
        ? (ending.requiresBossParleys
          ? '需要与四位不同的岛屿之主成功交涉，听见它们没说出口的话。'
          : '需要三份毫无保留的信任、七座岛的脚印，以及一次真正的告别。')
        : (ending.requires || ending.requiresAllRegions || ending.requiresEndings || ending.requiresBossParleys)
          ? (missing ? `还差：${esc(missing)}。` : '你已经具备这个条件。')
          : '尚未抵达这个结局。';
      return `<article class="codex-entry ${seen ? 'is-seen' : 'is-locked'} ${concealed ? 'is-concealed' : ''}" style="--ending:${safeColor(ending.color)}">
        <span class="codex-entry__glyph">${esc(concealed ? '？' : ending.glyph)}</span>
        <div class="codex-entry__body">
          <span class="codex-entry__eyebrow">${esc(concealed ? 'HIDDEN ENDING · ???' : ending.eyebrow)}</span>
          <h3>${esc(concealed ? '？？？' : ending.title)}${seen ? `<span class="codex-entry__seen">${icon('check', 11)} 已见证</span>` : ''}</h3>
          <p class="codex-entry__subtitle">${esc(concealed ? '最后一页的背面，还有一行很小的字。' : ending.subtitle)}</p>
          ${seen ? `<div class="codex-entry__prose">${ending.paragraphs.map((text) => `<p>${esc(text)}</p>`).join('')}</div>
            <blockquote>${esc(ending.quote)}</blockquote>`
            : `<p class="codex-entry__hint">${hint}</p>`}
          <span class="codex-entry__choice">${seen ? '再走一次，仍可作出同样的选择' : available ? '下一次终局时可以选它' : '尚未满足选择条件'}</span>
        </div>
      </article>`;
    }).join('')}
  </div>`;
}

const BESTIARY_TIER_LABEL = { normal: '游荡梦魇', elite: '镜中精英', boss: '梦魇之主', merchant: '携宝行商' };

function bestiaryBody(codex) {
  const seen = new Set(codex?.enemies || []);
  const tiers = ['normal', 'elite', 'boss', 'merchant'];
  return `<div class="codex-summary">
    <span class="codex-summary__seal">${icon('skull', 26)}</span>
    <div><strong>${seen.size} / ${ENEMIES.length}</strong><span>梦魇已被记下</span></div>
    <p>在梦里遇见过的敌人，都会被群岛记进这本册子。没遇见的，只剩下一片雾。</p>
  </div>
  ${tiers.map((tier) => {
    const list = ENEMIES.filter((enemy) => enemy.tier === tier);
    if (!list.length) return '';
    const known = list.filter((enemy) => seen.has(enemy.id)).length;
    return `<section class="bestiary-group">
      <div class="bestiary-group__head"><span>${esc(BESTIARY_TIER_LABEL[tier] || tier)}</span><small>${known}/${list.length}</small></div>
      ${list.map((enemy) => {
        const found = seen.has(enemy.id);
        const note = CODEX_NOTES[enemy.id];
        const lineage = found ? ENEMY_LINEAGES[enemy.lineage] : null;
        const surge = found ? enemy.surge : null;
        return `<article class="bestiary-entry ${found ? 'is-seen' : 'is-locked'}" style="--accent:${safeColor(enemy.accent)}">
          <span class="bestiary-entry__glyph">${esc(found ? enemy.glyph : '？')}</span>
          <div class="bestiary-entry__body">
            <div class="bestiary-entry__top"><strong>${esc(found ? enemy.name : '？？？')}</strong><span>${esc(BESTIARY_TIER_LABEL[enemy.tier] || enemy.tier)}</span></div>
            ${found
              ? `<p class="bestiary-entry__quote">${esc(enemy.quote || '')}</p>
                 <p class="bestiary-entry__lore">${esc(enemy.lore || '')}</p>
                 ${lineage ? `<p class="bestiary-entry__lineage" style="--lineage:${safeColor(lineage.color)}">${icon('eye', 11)} <span><b>谱系 · ${esc(lineage.name)}</b> ${esc(lineage.desc)}</span></p>` : ''}
                 ${surge ? `<p class="bestiary-entry__surge">${icon('flame', 11)} <span><b>暴走 · ${esc(surge.title)}</b> 生命降到一半时，${esc(surge.line)}</span></p>` : ''}
                 ${note ? `<p class="bestiary-entry__note">${icon('scroll', 11)} ${esc(note)}</p>` : ''}`
              : '<p class="bestiary-entry__hint">尚未在梦里遇见。它会先在雾里看着你。</p>'}
          </div>
        </article>`;
      }).join('')}
    </section>`;
  }).join('')}`;
}

function relicCodexBody(codex) {
  const seen = new Set(codex?.relics || []);
  return `<div class="codex-summary">
    <span class="codex-summary__seal">${icon('sparkles', 26)}</span>
    <div><strong>${seen.size} / ${RELICS.length}</strong><span>遗物已经拾得</span></div>
    <p>每一件遗物都来自某个没做完的梦。收集它，等于替谁保管了一段记忆。</p>
  </div>
  <div class="codex-list">
    ${RELICS.map((relic) => {
      const found = seen.has(relic.id);
      return `<article class="bestiary-entry ${found ? 'is-seen' : 'is-locked'}" style="--accent:${safeColor(relic.color)}">
        <span class="bestiary-entry__glyph">${esc(found ? relic.glyph : '？')}</span>
        <div class="bestiary-entry__body">
          <div class="bestiary-entry__top"><strong>${esc(found ? relic.name : '？？？')}</strong><span>遗物</span></div>
          ${found
            ? `<p class="bestiary-entry__lore">${esc(relic.desc)}</p>
               ${relic.flavor ? `<p class="bestiary-entry__note">${icon('scroll', 11)} ${esc(relic.flavor)}</p>` : ''}`
            : '<p class="bestiary-entry__hint">尚未拾得。它也许藏在某座岛的宝箱里，或在行商的柜台后。</p>'}
        </div>
      </article>`;
    }).join('')}
  </div>`;
}

function codexModal(m) {
  const world = G.profile.world;
  const codex = G.profile.codex || { enemies: [], relics: [] };
  const tab = ['endings', 'bestiary', 'relics'].includes(m.data?.tab) ? m.data.tab : 'endings';
  const tabs = `<div class="codex-tabs">
    ${[
      ['endings', '结局回廊', 'crown'],
      ['bestiary', '梦魇图鉴', 'skull'],
      ['relics', '遗物', 'sparkles'],
    ].map(([id, label, glyph]) => `<button type="button" class="codex-tab ${tab === id ? 'is-active' : ''}" data-action="codex-tab" data-tab="${id}">${icon(glyph, 14)}<span>${esc(label)}</span></button>`).join('')}
  </div>`;
  const head = {
    endings: { eyebrow: 'THE HALL OF ENDINGS', title: '结局回廊', subtitle: '群岛记得每一个替你结束的故事。' },
    bestiary: { eyebrow: 'THE BESTIARY OF DREAMS', title: '梦魇图鉴', subtitle: '你遇见过的梦魇，都会被群岛记下。' },
    relics: { eyebrow: 'THE RELIQUARY', title: '遗物册', subtitle: '每一件遗物，都是某个没做完的梦留下的东西。' },
  }[tab];
  const body = tab === 'bestiary' ? bestiaryBody(codex) : tab === 'relics' ? relicCodexBody(codex) : endingCodexBody(world);
  return shell(m, {
    eyebrow: head.eyebrow,
    title: head.title,
    subtitle: head.subtitle,
    body: tabs + body,
    className: 'modal--codex',
    footer: '<button type="button" class="button button--primary" data-action="close-modal">合上回廊</button>',
  });
}

function finaleModal(m) {
  const world = G.profile.world;
  const choices = endingChoices(world);
  const summary = m.data?.summary;
  const body = `<div class="finale-scene">
    <span class="finale-scene__heart" aria-hidden="true">${icon('heart', 30)}</span>
    <span class="section-eyebrow">THE HEART IS OPEN</span>
    <h3>心的裂口里没有敌人，只有一间等你落座的屋子。</h3>
    <p>${summary?.bossName ? `【${esc(summary.bossName)}】停住了最后一下搏动。` : '缄默之心停住了最后一下搏动。'}群岛的梦开始松动。你手里还握着最后一副牌，足够替所有人做一个决定。</p>
    ${summary ? `<div class="finale-scene__stats">
      <span>${icon('heart', 14)} 剩余生命 ${summary.hp}/${summary.maxHp}</span>
      <span>${icon('cards', 14)} ${summary.deckSize} 张牌同行</span>
      <span>${icon('sword', 14)} ${summary.totals?.enemiesFelled || 0} 位梦魇倒下</span>
    </div>` : ''}
    <div class="finale-choices">
      ${choices.map(({ ending, available, missing }) => {
        const seen = world.endings.includes(ending.id);
        const concealed = ending.hidden && !seen && !available;
        return `<button type="button" class="finale-choice ${available ? '' : 'is-locked'} ${ending.hidden ? 'finale-choice--hidden' : ''}" data-action="finale-choice" data-id="${esc(ending.id)}" style="--ending:${safeColor(ending.color)}" ${available ? '' : 'disabled'}>
        <span class="finale-choice__glyph">${available ? esc(ending.glyph) : icon('lock', 17)}</span>
        <span class="finale-choice__copy">
          <small>${esc(concealed ? 'HIDDEN ENDING · ???' : ending.eyebrow)}</small>
          <strong>${esc(concealed ? '？？？' : ending.title)}</strong>
          <em>${esc(concealed ? '最后一页的背面，还有一句没有写完的话。' : available ? ending.choiceDesc : (missing || '尚未满足选择条件'))}</em>
        </span>
        <span class="finale-choice__arrow">${available ? icon('right', 17) : icon('lock', 14)}</span>
      </button>`;
      }).join('')}
    </div>
    <span class="finale-scene__note">${icon('scroll', 12)} 这个选择会被写进结局回廊，也会改变群岛对你的称呼。</span>
  </div>`;
  return shell(m, {
    eyebrow: 'THE LAST CARD',
    title: '替群岛做一个决定',
    body,
    className: 'modal--finale',
    closable: false,
  });
}

function awakeningModal(m) {
  const run = G.run;
  const offer = m.data?.offer || awakeningOffer(run);
  if (!run || !offer) return '';
  const origin = ORIGIN_MAP[run.originId];
  const claimed = runAwakenings(run);
  const tierLabel = offer.tier === 1 ? '初次觉醒' : '二次觉醒';
  // 选完这一条后累计的梦压：让玩家在按下按钮前就知道梦会怎样回应。
  const pressureTier = claimed.length + 1;
  const pressureHp = Math.round(pressureTier * AWAKENING_PRESSURE.bossHpPerTier * 100);
  const pressureDamage = Math.round(pressureTier * AWAKENING_PRESSURE.bossDamagePerTier * 100);
  const pressureStrength = pressureTier * AWAKENING_PRESSURE.bossStrengthPerTier;
  const pressurePhase = Math.round(pressureTier * AWAKENING_PRESSURE.phase2EarlyPerTier * 100);
  const body = `<div class="awakening-scene" style="--origin:${safeColor(origin?.color || '#c2a46d')}">
    <span class="awakening-scene__glow" aria-hidden="true"></span>
    <div class="awakening-scene__crest">
      <span class="awakening-scene__ring" aria-hidden="true"></span>
      <span class="awakening-scene__glyph">${esc(origin?.mechanic?.glyph || origin?.sigil || '道')}</span>
      <span class="awakening-scene__name">${esc(origin?.mechanic?.name || '道途')}</span>
    </div>
    <p class="awakening-scene__premise">${esc(origin?.mechanic?.desc || '你的道途正在梦里继续生长。')}<br>第 ${offer.floor} 层已过，这条路要你亲手选一个方向。</p>
    ${claimed.length ? `<div class="awakening-scene__claimed">${claimed.map((item) => `<span title="${esc(item.desc)}">${esc(item.glyph)} ${esc(item.name)}</span>`).join('')}</div>` : ''}
    <div class="awakening-choices">
      ${offer.options.map((item) => `<button type="button" class="awakening-choice" data-action="choose-awakening" data-id="${esc(item.id)}">
        <span class="awakening-choice__glyph">${esc(item.glyph)}</span>
        <span class="awakening-choice__copy">
          <small>${esc(tierLabel)} · ${esc(item.name)}</small>
          <strong>${esc(item.desc)}</strong>
          <em>「${esc(item.line || '')}」</em>
        </span>
        <span class="awakening-choice__arrow">${icon('right', 16)}</span>
      </button>`).join('')}
    </div>
    <div class="awakening-scene__pressure">
      <span>${icon('flame', 13)} 梦压 · 首领生命 +${pressureHp}% · 攻击 +${pressureDamage}% · 开局力量 +${pressureStrength} · 真形提前 ${pressurePhase}% 生命</span>
      <small>觉醒只改变首领的回应，不改变普通战斗的强度。</small>
    </div>
    <span class="awakening-scene__note">${icon('sparkles', 13)} 觉醒永久生效，二选一，无法反悔。</span>
  </div>`;
  return shell(m, {
    eyebrow: `AWAKENING · ${esc(tierLabel)}`,
    title: '道途觉醒',
    subtitle: '梦会记住你选择成为谁。',
    body,
    className: 'modal--awakening',
    closable: false,
  });
}

const PILE_DEFS = {
  draw: { label: '抽牌堆', iconName: 'cards', key: 'drawPile', note: '顺序藏在雾里，这里只展示内容与数量。' },
  discard: { label: '弃牌堆', iconName: 'rotate', key: 'discardPile', note: '已经打出的牌会先落在这里，抽牌堆见底时重新洗回。' },
  exhaust: { label: '消耗堆', iconName: 'flame', key: 'exhaustPile', note: '带有「消耗」的牌本场战斗不会再回来。' },
};

function pileCards(battle, pileId) {
  const cards = battle?.[PILE_DEFS[pileId]?.key];
  return Array.isArray(cards) ? cards : [];
}

const PILE_SCHOOL_ORDER = Object.keys(SCHOOLS);
const PILE_TYPE_FILTERS = [
  { value: '', label: '全部' },
  { value: 'attack', label: TYPE_INFO.attack.name },
  { value: 'skill', label: TYPE_INFO.skill.name },
];
const PILE_COST_FILTERS = [
  { value: '', label: '任意' },
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3+', label: '3 费以上' },
];

function pileFilterState(m) {
  const data = m?.data || {};
  return {
    q: String(data.q || '').slice(0, 40),
    school: PILE_SCHOOL_ORDER.includes(data.school) ? data.school : '',
    type: data.type === 'attack' || data.type === 'skill' ? data.type : '',
    cost: PILE_COST_FILTERS.some((entry) => entry.value && entry.value === data.cost) ? data.cost : '',
  };
}

function pileIsFiltering(filter) {
  return Boolean(filter.q.trim() || filter.school || filter.type || filter.cost);
}

function pileCardMatches(card, filter) {
  if (filter.school && card.school !== filter.school) return false;
  if (filter.type && card.type !== filter.type) return false;
  if (filter.cost) {
    const cost = Number(card.cost) || 0;
    if (filter.cost === '3+' ? cost < 3 : cost !== Number(filter.cost)) return false;
  }
  const needle = filter.q.trim().toLowerCase();
  if (needle) {
    const haystack = [
      card.displayName,
      card.name,
      card.description,
      SCHOOLS[card.school]?.name,
      TYPE_INFO[card.type]?.name,
    ].filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

function pileChip(label, field, value, active, style = '') {
  return `<button type="button" class="pile-chip ${active ? 'is-active' : ''}" data-action="pile-filter" data-field="${esc(field)}" data-value="${esc(value)}"${style}>${esc(label)}</button>`;
}

function pileFiltersMarkup(filter) {
  const schoolChips = [
    pileChip('全部', 'school', '', !filter.school),
    ...PILE_SCHOOL_ORDER.map((key) => pileChip(SCHOOLS[key].name, 'school', key, filter.school === key, ` style="--chip:${safeColor(SCHOOLS[key].color)}"`)),
  ].join('');
  const typeChips = PILE_TYPE_FILTERS
    .map((entry) => pileChip(entry.label, 'type', entry.value, filter.type === entry.value))
    .join('');
  const costChips = PILE_COST_FILTERS
    .map((entry) => pileChip(entry.label, 'cost', entry.value, filter.cost === entry.value))
    .join('');
  return `<div class="pile-modal__filters">
    <label class="pile-search">
      ${icon('search', 15)}
      <input type="text" data-pile-search value="${esc(filter.q)}" placeholder="搜索牌名、描述或流派…" autocomplete="off" spellcheck="false" maxlength="40" aria-label="搜索牌堆">
    </label>
    <div class="pile-filter-row"><span class="pile-filter-label">流派</span>${schoolChips}</div>
    <div class="pile-filter-row"><span class="pile-filter-label">类型</span>${typeChips}</div>
    <div class="pile-filter-row"><span class="pile-filter-label">费用</span>${costChips}</div>
  </div>`;
}

export function pileResultsMarkup(m) {
  const battle = G.sandboxBattle || G.run?.battle;
  if (!battle) return '';
  const pileId = PILE_DEFS[m?.data?.pile] ? m.data.pile : 'draw';
  const cards = pileCards(battle, pileId);
  const filter = pileFilterState(m);
  const filtering = pileIsFiltering(filter);
  const allGroups = groupDeck(cards);
  const groups = allGroups.filter((group) => pileCardMatches(group.card, filter));
  const matches = groups.reduce((sum, group) => sum + group.count, 0);
  const head = filtering
    ? `<div class="pile-modal__result"><strong>${matches}</strong><span>张符合 · 共 ${cards.length} 张</span><button type="button" class="text-button" data-action="pile-clear">清空筛选</button></div>`
    : '';
  if (groups.length) {
    return `${head}<div class="deck-modal-grid pile-modal__grid">${groups.map((group) => `<div class="deck-modal-item">${cardMarkup(group.card, { tag: 'div', mini: true, badge: group.count })}</div>`).join('')}</div>`;
  }
  if (filtering) {
    return `${head}<div class="pile-modal__empty">${icon('search', 28)}<span>没有符合条件的牌，换个关键词试试。</span></div>`;
  }
  return `<div class="pile-modal__empty">${icon(PILE_DEFS[pileId].iconName, 28)}<span>这里暂时空无一物。</span></div>`;
}

function pileViewModal(m) {
  const battle = G.sandboxBattle || G.run?.battle;
  if (!battle) return '';
  const pileId = PILE_DEFS[m.data?.pile] ? m.data.pile : 'draw';
  const pile = PILE_DEFS[pileId];
  const cards = pileCards(battle, pileId);
  const filter = pileFilterState(m);
  const body = `<div class="pile-modal">
    <div class="pile-modal__head">
      <span class="pile-modal__count"><strong>${cards.length}</strong><small>张牌</small></span>
      <p>${esc(pile.note)}</p>
    </div>
    ${pileFiltersMarkup(filter)}
    <div class="pile-modal__results" data-pile-results>${pileResultsMarkup(m)}</div>
  </div>`;
  return shell(m, {
    eyebrow: 'BATTLE ARCHIVE',
    title: `${pile.label} · ${cards.length} 张`,
    subtitle: '在梦里翻找已经发生与尚未发生的牌。',
    body,
    className: 'modal--deck modal--pile',
    footer: '<button type="button" class="button button--ghost" data-action="close-modal">收起牌堆</button>',
  });
}

function keywordsModal(m) {
  const body = `<div class="keyword-glossary">${keywordGlossaryMarkup()}</div>
    <p class="keyword-glossary__foot">卡牌描述中的高亮词都可以在这里找到解释。悬停卡牌时也会显示完整说明。</p>`;
  return shell(m, {
    eyebrow: 'LEXICON OF DREAMS',
    title: '关键词手册',
    subtitle: '梦有它自己的语法。',
    body,
    className: 'modal--keywords',
    footer: '<button type="button" class="button button--primary" data-action="close-modal">记住了</button>',
  });
}

function achievementsModal(m) {
  const gallery = achievementGallery();
  const counts = achievementCounts();
  const state = G.profile.achievements || {};
  const daily = G.profile.daily || {};
  const groups = [...new Set(gallery.map((entry) => entry.group))];
  const unlocked = gallery.filter((entry) => entry.unlocked).length;
  const body = `<div class="achievement-top">
      <div class="achievement-top__count"><strong>${unlocked}</strong><small>/ ${gallery.length} 已点亮</small></div>
      <div class="achievement-top__meta">
        <span>${icon('crown', 14)} 成就经验 ${Number(state.totalXp) || 0}</span>
        <span>${icon('flame', 14)} 每日连胜 ${Number(daily.bestStreak) || 0} 日</span>
        <span>${icon('sparkles', 14)} 梦境层级 ${Number(G.profile.ascensionBest) || 0}</span>
      </div>
    </div>
    ${groups.map((group) => `<section class="achievement-group">
      <div class="achievement-group__head"><span>${esc(group)}</span><i></i><small>${gallery.filter((entry) => entry.group === group && entry.unlocked).length}/${gallery.filter((entry) => entry.group === group).length}</small></div>
      <div class="achievement-grid">
        ${gallery.filter((entry) => entry.group === group).map((entry) => `<article class="achievement-card ${entry.unlocked ? 'is-unlocked' : ''}" style="--achievement:${safeColor(entry.color)}">
          <span class="achievement-card__glyph">${esc(entry.glyph)}</span>
          <div class="achievement-card__copy">
            <div class="achievement-card__title"><strong>${esc(entry.name)}</strong>${entry.unlocked ? `<em>${icon('check', 11)} 已解锁</em>` : `<em>${entry.value}/${entry.target}</em>`}</div>
            <p>${esc(entry.desc)}</p>
            <span class="achievement-card__bar"><i style="width:${entry.percent}%"></i></span>
            ${entry.unlocked ? `<small>${new Date(entry.unlockedAt).toLocaleDateString('zh-CN')} 点亮</small>` : `<small>${esc(entry.metricLabel)} ${entry.value} / ${entry.target}</small>`}
          </div>
        </article>`).join('')}
      </div>
    </section>`).join('')}`;
  return shell(m, {
    eyebrow: 'HALL OF DREAMS',
    title: `成就回廊 · ${counts.unlocked}/${counts.total}`,
    subtitle: '梦会记住你做过的事，即使你忘了。',
    body,
    className: 'modal--achievements',
    footer: '<button type="button" class="button button--ghost" data-action="close-modal">收起回廊</button>',
  });
}

function saveBackupModal(m) {
  const profile = G.profile;
  const world = profile.world || {};
  const run = G.run;
  const stats = profile.stats || {};
  const body = `<div class="backup-panel">
    <span class="backup-panel__seal">${icon('chest', 30)}</span>
    <h3>把这段梦装进一只箱子</h3>
    <p>备份会写入本地的<strong>档案、解锁、成就、每日记录、自定义卡牌与形象</strong>${run ? '，以及当前进行中的远征' : ''}。换一台电脑时，导入这份 JSON 就能继续。</p>
    <div class="backup-stats">
      <span><small>旅程</small><strong>${Number(stats.runs) || 0}</strong></span>
      <span><small>凯旋</small><strong>${Number(stats.wins) || 0}</strong></span>
      <span><small>结局</small><strong>${(world.endings || []).length}/${ENDINGS.length}</strong></span>
      <span><small>自定义牌</small><strong>${(profile.customCards || []).length}</strong></span>
      <span><small>成就</small><strong>${achievementCounts().unlocked}</strong></span>
    </div>
    <div class="backup-panel__note">
      ${icon('lock', 14)} <span>为了安全与体积，导出文件<strong>不包含 AI API Key，也不包含自定义音频</strong>。音频文件与密钥只留在本机；导入备份时，本机已有的音频与密钥会被保留。</span>
    </div>
    ${run ? `<p class="backup-panel__run">当前有一段进行中的远征，会一并写入备份。</p>` : '<p class="backup-panel__run">当前没有进行中的远征，备份只包含长期档案。</p>'}
    <div class="backup-actions">
      <button type="button" class="button button--primary" data-action="export-save">${icon('copy', 16)} 导出存档备份</button>
      <button type="button" class="button button--ghost" data-action="import-save">${icon('upload', 16)} 导入存档备份</button>
    </div>
  </div>`;
  return shell(m, {
    eyebrow: 'SAVE THE DREAM',
    title: '存档备份',
    subtitle: '梦可以带走，但钥匙和声音留在原处。',
    body,
    className: 'modal--backup',
    footer: '<button type="button" class="button button--ghost" data-action="close-modal">收起</button>',
  });
}

function cardDetailModal(m) {
  const def = getCardDef(m.data.cardId);
  if (!def) return '';
  const base = resolveCard(def);
  const upgraded = resolveCard(def, true);
  const school = SCHOOLS[def.school] || SCHOOLS.dream;
  const type = TYPE_INFO[def.type] || TYPE_INFO.skill;
  const rows = [
    ['费用', String(Number(def.cost) || 0)],
    ['类型', type.name || '技能'],
    ['稀有度', base.rarityName || '普通'],
    ['流派', school.name],
  ];
  if (def.exhaust) rows.push(['消耗', '打出后移出本局']);
  if (def.questOnly) rows.push(['来源', '纪念牌']);
  const changed = base.description !== upgraded.description;
  const body = `<div class="card-detail">
    <div class="card-detail__scene">${cardMarkup(def, { tag: 'div', showFlavor: true })}</div>
    <div class="card-detail__side">
      <div class="card-detail__meta">
        ${rows.map(([k, v]) => `<div class="card-detail__row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}
      </div>
      <div class="card-detail__effects">
        <span class="section-eyebrow">基础效果</span>
        <p>${esc(base.description)}</p>
      </div>
      <div class="card-detail__effects is-upgraded">
        <span class="section-eyebrow">强化后 ＋</span>
        <p>${esc(upgraded.description)}</p>
      </div>
      ${changed ? '' : '<p class="card-detail__note">这张牌没有可强化的属性变化。</p>'}
    </div>
  </div>`;
  return shell(m, {
    eyebrow: 'CARD DETAIL · 卡牌详情',
    title: base.displayName,
    subtitle: '右键任意卡牌即可随时查看它的强化效果与信息。',
    body,
    className: 'modal--card-detail',
  });
}

function cardArtModal(m) {
  const job = G.ui.cardArtJob || null;
  const busy = Boolean(job?.running);
  const schoolFilter = G.ui.cardArtSchool || 'all';
  const cards = Object.values(CARD_MAP);
  const generated = cards.filter((card) => peekCardArt(card.id)).length;
  const builtin = cards.filter((card) => !peekCardArt(card.id) && cardArtSource(card)).length;
  const filtered = schoolFilter === 'all' ? cards : cards.filter((card) => card.school === schoolFilter);
  const ai = G.profile.ai || {};
  const provider = ai.provider === 'openai'
    ? `自有接口 · ${esc(ai.model || '未填写模型')}`
    : '公共免密钥服务 · Pollinations';
  const filters = [
    ['all', '全部', '#b48bc9'],
    ...Object.entries(SCHOOLS).map(([id, school]) => [id, school.name, school.color]),
  ].map(([id, label, color]) => `<button type="button" class="artforge-filter ${schoolFilter === id ? 'is-active' : ''}" data-action="card-art-filter" data-school="${id}" style="--filter:${safeColor(color)}">${esc(label)}</button>`).join('');
  const tiles = filtered.map((def) => {
    const card = resolveCard(def);
    const own = Boolean(peekCardArt(def.id));
    const has = own || Boolean(cardArtSource(card));
    return `<div class="artforge-tile ${has ? 'has-art' : ''}">
      <div class="artforge-tile__art">
        ${cardArt(card)}
        <span class="artforge-tile__badge">${own ? '自绘' : has ? 'AI' : '程序'}</span>
      </div>
      <div class="artforge-tile__meta">
        <strong>${esc(card.displayName)}</strong>
        <small>${esc(SCHOOLS[def.school]?.name || '遗梦')} · ${Number(def.cost) || 0} 费</small>
      </div>
      <div class="artforge-tile__actions">
        <button type="button" class="artforge-btn" data-action="card-art-generate" data-id="${esc(def.id)}" ${busy ? 'disabled' : ''}>${has ? '重绘' : '生成'}</button>
        ${own ? `<button type="button" class="artforge-btn artforge-btn--ghost" data-action="card-art-clear" data-id="${esc(def.id)}" ${busy ? 'disabled' : ''}>清除</button>` : ''}
      </div>
    </div>`;
  }).join('');
  const progress = job ? `<div class="artforge-progress ${job.running ? 'is-running' : ''}">
      <span class="artforge-progress__bar"><i style="width:${job.total ? Math.round((job.done / job.total) * 100) : 0}%"></i></span>
      <span class="artforge-progress__text">${job.running ? `正在生成「${esc(job.current || '')}」` : '本次生成结束'} · ${job.done}/${job.total}${job.failed ? ` · 失败 ${job.failed}` : ''}</span>
      ${job.lastError ? `<span class="artforge-progress__error">${esc(job.lastError)}</span>` : ''}
    </div>` : '';
  const body = `<div class="artforge">
    <div class="artforge-head">
      <div class="artforge-head__copy">
        <span>${icon('sparkles', 15)} 自绘 ${generated} 张 · 内置 AI 卡面 ${builtin} 张</span>
        <small>${provider}。生成的自绘卡面保存在本机并覆盖内置卡面，可以随时清除。</small>
      </div>
      <div class="artforge-head__actions">
        <button type="button" class="button button--primary" data-action="card-art-batch" ${busy || generated >= cards.length ? 'disabled' : ''}>${icon('wand', 15)} 生成全部未生成</button>
        <button type="button" class="button button--ghost" data-action="card-art-batch" data-force="1" ${busy ? 'disabled' : ''}>${icon('rotate', 15)} 全部重绘</button>
      </div>
    </div>
    ${progress}
    <div class="artforge-filters">${filters}</div>
    <div class="artforge-grid">${tiles}</div>
  </div>`;
  return shell(m, {
    eyebrow: 'CARD ART ATELIER',
    title: 'AI 卡面工坊',
    subtitle: '为任意一张牌生成自绘插图，覆盖内置卡面；清除后立刻回到内置版本。',
    body,
    className: 'modal--artforge',
    footer: '<button type="button" class="button button--ghost" data-action="close-modal">收起工坊</button>',
  });
}

export function renderModal() {
  const m = G.ui.modal;
  if (!m) return '';
  switch (m.type) {
    case 'awakening':
      return awakeningModal(m);
    case 'guide':
      return guideModal(m);
    case 'confirm':
      return confirmModal(m);
    case 'deck-view':
      return deckViewModal(m);
    case 'card-editor':
      return cardEditorModal(m);
    case 'image-editor':
      return imageEditorModal(m);
    case 'generate':
      return generateModal(m);
    case 'event':
      return eventModal(m);
    case 'camp':
      return campModal(m);
    case 'shop':
      return shopModal(m);
    case 'treasure':
      return treasureModal(m);
    case 'story':
      return storyModal(m);
    case 'purge':
      return purgeModal(m);
    case 'shards':
      return shardsModal(m);
    case 'contracts':
      return contractsModal(m);
    case 'npc':
      return npcModal(m);
    case 'dialogue':
      return dialogueModal(m);
    case 'quests':
      return questsModal(m);
    case 'parley':
      return parleyModal(m);
    case 'quest-reward':
      return questRewardModal(m);
    case 'codex':
      return codexModal(m);
    case 'pile-view':
      return pileViewModal(m);
    case 'keywords':
      return keywordsModal(m);
    case 'achievements':
      return achievementsModal(m);
    case 'save-backup':
      return saveBackupModal(m);
    case 'finale':
      return finaleModal(m);
    case 'card-detail':
      return cardDetailModal(m);
    case 'card-art':
      return cardArtModal(m);
    default:
      return '';
  }
}

function imageEditorModal(m) {
  const { source, settings, busy, error, picking } = m.data;
  const color = rgbToHex(settings.bg);
  const frameLabel = source.animated ? `动图 · ${source.totalFrames || source.frames.length} 帧` : '静态图片';
  const body = `<div class="image-editor">
    <div class="image-editor__left">
      <div class="image-editor__stage ${picking ? 'is-picking' : ''}" data-image-stage>
        <canvas class="image-editor__canvas" width="640" height="640" data-image-preview></canvas>
        <div class="image-editor__crop" data-image-crop>
          <span class="image-editor__crop-grid" aria-hidden="true"></span>
          <i class="image-editor__handle image-editor__handle--nw" data-crop-handle="nw"></i>
          <i class="image-editor__handle image-editor__handle--ne" data-crop-handle="ne"></i>
          <i class="image-editor__handle image-editor__handle--sw" data-crop-handle="sw"></i>
          <i class="image-editor__handle image-editor__handle--se" data-crop-handle="se"></i>
        </div>
      </div>
      <div class="image-editor__meta">
        <span class="image-editor__badge ${source.animated ? 'is-animated' : ''}">${icon(source.animated ? 'sparkles' : 'image', 12)} ${esc(frameLabel)}</span>
        <span>${source.width} × ${source.height}</span>
        <span>输出 620 × 620 方形头像</span>
      </div>
      <p class="image-editor__hint" data-image-hint>${picking ? '点击画面，吸取想移除的背景色。' : '拖动选框裁剪，拖动四角缩放；也能在画面空白处重新框选。'}</p>
    </div>
    <aside class="image-editor__controls">
      <section class="image-editor__panel">
        <span class="section-eyebrow">MATTE · 背景</span>
        <label class="image-editor__switch">
          <input type="checkbox" data-image-toggle="removeBg" ${settings.removeBg ? 'checked' : ''}>
          <span class="image-editor__switch-track"><i></i></span>
          <span class="image-editor__switch-copy"><strong>移除背景</strong><small>自动抹去大片留白与纯色背景</small></span>
        </label>
        <div class="image-editor__bgrow">
          <span class="image-editor__swatch" data-image-swatch style="--swatch:${color}" title="${color}"></span>
          <code data-image-hex>${color}</code>
          <button type="button" class="text-button ${picking ? 'is-active' : ''}" data-action="image-pick-color">${icon('drop', 13)} ${picking ? '正在取色' : '点选背景色'}</button>
        </div>
        <label class="image-editor__range">
          <span>容差 <em data-image-value="tolerance">${settings.tolerance}</em></span>
          <input type="range" min="0" max="100" value="${settings.tolerance}" data-image-range="tolerance">
        </label>
        <label class="image-editor__range">
          <span>边缘柔和 <em data-image-value="feather">${settings.feather}</em></span>
          <input type="range" min="0" max="60" value="${settings.feather}" data-image-range="feather">
        </label>
      </section>
      <section class="image-editor__panel">
        <span class="section-eyebrow">FRAMING · 构图</span>
        <div class="image-editor__actions">
          <button type="button" class="button button--ghost" data-action="image-auto-fit">${icon('sparkles', 14)} 自动贴合主体</button>
          <button type="button" class="button button--ghost" data-action="image-reset-crop">${icon('rotate', 14)} 重置选框</button>
        </div>
        <p class="image-editor__tip">${source.animated
          ? '动图的每一帧都会应用同样的裁剪与抠图，并尽量保留帧数与节奏。'
          : '背景移除会保留发丝与半透明边缘；如果边缘被吃掉，调低容差或提高柔和。'}</p>
      </section>
      ${error ? `<p class="image-editor__error">${icon('skull', 14)} ${esc(error)}</p>` : ''}
    </aside>
  </div>`;
  return shell(m, {
    eyebrow: 'IMAGE RITUAL',
    title: m.data.kind === 'enemy' ? '雕刻梦魇的形态' : '雕刻你的形象',
    subtitle: '裁掉多余的空白，让角色真正站进梦里。',
    body,
    className: 'modal--image-editor',
    footer: `<div class="editor-footer-left"><span>${icon('lock', 13)} 图片只在本机裁切与保存</span></div>
      <div class="editor-footer-right">
        <button type="button" class="button button--ghost" data-action="close-modal" ${busy ? 'disabled' : ''}>取消</button>
        <button type="button" class="button button--primary" data-action="image-apply" ${busy ? 'disabled' : ''}>${busy ? '正在逐帧雕刻…' : `${icon('check', 16)} 应用形象`}</button>
      </div>`,
  });
}

export function defaultGenerationSubject(kind, enemyId) {
  if (kind === 'enemy') {
    const enemy = ENEMY_MAP[enemyId] || ENEMY_MAP.mossling;
    return `${enemy.name}。${enemy.lore}`;
  }
  return '一位行走在梦境边缘的卡牌旅者，深色长袍，旧金纹样，手中漂浮着几张发光的塔罗牌';
}

export function newCardDraft(id) {
  return {
    id,
    name: '',
    cost: 1,
    type: 'attack',
    rarity: 'custom',
    glyph: CARD_GLYPHS[Math.floor(Math.random() * CARD_GLYPHS.length)],
    palette: CARD_PALETTES[Math.floor(Math.random() * CARD_PALETTES.length)].color,
    school: 'dream',
    flavor: '',
    effects: [makeEffect('damage', 6)],
    custom: true,
  };
}

export function cardDraftFromDef(card) {
  return {
    ...card,
    school: card.school || 'dream',
    effects: card.effects.map((effect) => ({ ...effect })),
  };
}
