import { AI_STYLES, ATTRIBUTES, CARDS, CARD_MAP, ENEMIES, ENEMY_MAP, ORIGINS, ORIGIN_MAP } from './data.js';
import { AUDIO_LIMITS, MUSIC_SLOTS, SFX_GROUPS, SFX_SLOTS } from './audio-data.js';
import { formatBytes, formatDuration } from './audio-store.js';
import { G, getEnemySkin, getHeroAvatar, getHeroName } from './state.js';
import {
  cardMarkup,
  emptyState,
  imageTag,
  topbarMuteButton,
} from './ui-common.js';
import { esc, icon, safeColor } from './utils.js';

const TIER_LABEL = { normal: '游荡梦魇', elite: '镜中精英', boss: '梦魇之主' };

function tabButton(tab, label, iconName, count = null) {
  const active = G.ui.studioTab === tab;
  return `<button type="button" class="studio-tab ${active ? 'is-active' : ''}" data-action="studio-tab" data-tab="${tab}" aria-pressed="${active}">
    <span class="studio-tab__icon">${icon(iconName, 18)}</span>
    <span class="studio-tab__copy"><strong>${esc(label)}</strong>${count !== null ? `<small>${count}</small>` : ''}</span>
  </button>`;
}

function heroTab() {
  const origin = ORIGIN_MAP[G.profile.originId] || ORIGINS[0];
  const stats = G.profile.stats;
  const custom = Boolean(G.profile.heroAvatars?.[origin.id]);
  const mechanic = origin.mechanic;
  const exclusive = CARDS.filter((card) => card.originOnly === origin.id);
  return `<div class="studio-hero">
    <section class="hero-studio-card">
      <span class="section-eyebrow">THE CARDBEARER</span>
      <div class="hero-studio-portrait" style="--origin-color:${safeColor(origin.color)}">
        <span class="hero-studio-portrait__halo"></span>
        <span class="hero-studio-portrait__corner hero-studio-portrait__corner--tl"></span>
        <span class="hero-studio-portrait__corner hero-studio-portrait__corner--br"></span>
        ${imageTag(getHeroAvatar(origin.id), custom ? origin.portrait : 'assets/heroes/default.webp', getHeroName(), 'hero-studio-portrait__image', false)}
        <span class="hero-studio-portrait__sigil">${esc(origin.sigil)}</span>
      </div>
      <div class="hero-studio-card__actions">
        <button type="button" class="button button--ghost" data-action="upload-hero">${icon('upload', 16)} 上传照片</button>
        <button type="button" class="button button--primary" data-action="open-generate" data-kind="hero">${icon('sparkles', 16)} AI 生成</button>
      </div>
      ${custom ? `<button type="button" class="text-button text-button--muted" data-action="reset-hero">${icon('rotate', 13)} 恢复${esc(origin.name)}的默认立绘</button>` : ''}
      <p class="studio-note">${icon('lock', 13)} 每个起源都有独立形象；照片只在本机裁切、压缩并保存，不会上传到任何服务器。</p>

      ${mechanic ? `<div class="hero-mechanic-card" style="--origin-color:${safeColor(origin.color)}">
        <span class="hero-mechanic-card__glyph">${esc(mechanic.glyph)}</span>
        <div class="hero-mechanic-card__copy">
          <small>专属机制 · ${esc(mechanic.name)}</small>
          <strong>${esc(mechanic.short)}</strong>
          <p>${esc(mechanic.desc)}</p>
        </div>
      </div>` : ''}
      <div class="hero-attribute-row">
        ${Object.entries(origin.attributes || {}).map(([id, value]) => {
          const info = ATTRIBUTES[id];
          if (!info) return '';
          return `<span class="hero-attribute" style="--attr:${safeColor(info.color)}" title="${esc(info.desc)}">
            <i>${esc(info.glyph)}</i><strong>${value}</strong><small>${esc(info.name)}</small>
          </span>`;
        }).join('')}
      </div>
    </section>

    <section class="studio-form-panel">
      <div class="studio-panel-heading">
        <span class="section-eyebrow">IDENTITY</span>
        <h1>执牌者的名字</h1>
        <p>${esc(origin.quote)}</p>
      </div>
      <label class="field field--hero-name">
        <span>名字 <em>最多 16 个字符</em></span>
        <input type="text" maxlength="16" value="${esc(getHeroName())}" data-hero-name placeholder="无名旅者">
      </label>
      <div class="studio-section">
        <div class="studio-section__title"><span>01</span><h3>起源</h3></div>
        <div class="studio-origin-grid">
          ${ORIGINS.map((item) => `<button type="button" class="studio-origin ${item.id === origin.id ? 'is-selected' : ''}" data-action="studio-origin" data-id="${esc(item.id)}" style="--origin:${safeColor(item.color)}">
            <span class="studio-origin__sigil">${esc(item.sigil)}</span>
            <span class="studio-origin__copy">
              <strong>${esc(item.name)}</strong>
              <small>${esc(item.passiveName)}</small>
              <em>${esc(item.mechanic?.short || item.passive)}</em>
            </span>
            <span class="studio-origin__check">${item.id === origin.id ? icon('check', 14) : ''}</span>
          </button>`).join('')}
        </div>
        <p class="studio-hint">更换起源会同时改变初始牌组、被动、战斗机制与专属卡池。每条道途的后期成长方式完全不同。</p>
      </div>
      <div class="studio-section">
        <div class="studio-section__title"><span>02</span><h3>道途与专属牌</h3></div>
        <p class="studio-origin-look">${icon('eye', 13)} ${esc(origin.look)}</p>
        <div class="origin-exclusive-row">
          ${exclusive.map((card) => `<span class="origin-exclusive" title="${esc(card.flavor || '')}">
            <i>${esc(card.glyph)}</i><strong>${esc(card.name)}</strong><small>${esc(card.rarity === 'rare' ? '稀有' : '罕见')}</small>
          </span>`).join('')}
        </div>
        <p class="studio-hint">这些牌只会出现在${esc(origin.name)}的奖励与商店中。第 3、6 层结束时还会迎来道途觉醒，二选一永久强化专属机制。</p>
      </div>
      <div class="studio-section">
        <div class="studio-section__title"><span>03</span><h3>旅者记录</h3></div>
        <div class="studio-stats">
          <div><span>生命</span><strong>${origin.hp}</strong><small>${esc(origin.epithet)}</small></div>
          <div><span>旅程</span><strong>${stats.runs}</strong><small>踏入睡境的次数</small></div>
          <div><span>凯旋</span><strong>${stats.wins}</strong><small>杀死古龙的次数</small></div>
          <div><span>击败</span><strong>${stats.enemiesFelled}</strong><small>散去的梦魇</small></div>
        </div>
      </div>
    </section>
  </div>`;
}

function enemyTab() {
  const selectedId = ENEMY_MAP[G.ui.selectedEnemyId] ? G.ui.selectedEnemyId : ENEMIES[0].id;
  const enemy = ENEMY_MAP[selectedId];
  const skin = getEnemySkin(enemy.id);
  const custom = G.profile.enemySkins[enemy.id] || {};
  const customized = Boolean(custom.image || custom.name);
  return `<div class="studio-enemies">
    <aside class="enemy-roster">
      <div class="enemy-roster__head">
        <span class="section-eyebrow">NIGHTMARE ROSTER</span>
        <h2>梦魇名册</h2>
      </div>
      <div class="enemy-roster__list">
        ${ENEMIES.map((item) => {
          const itemSkin = getEnemySkin(item.id);
          const itemCustom = G.profile.enemySkins[item.id];
          return `<button type="button" class="enemy-roster__item ${item.id === enemy.id ? 'is-active' : ''}" data-action="select-enemy" data-id="${esc(item.id)}" style="--enemy-color:${safeColor(item.accent)}">
            <span class="enemy-roster__thumb">${imageTag(itemSkin.image, item.image, itemSkin.name)}${itemCustom?.image ? '<i class="enemy-roster__dot"></i>' : ''}</span>
            <span class="enemy-roster__copy"><strong>${esc(itemSkin.name)}</strong><small>${esc(TIER_LABEL[item.tier])} · ${item.hp} 生命</small></span>
            <span class="enemy-roster__arrow">${icon('right', 15)}</span>
          </button>`;
        }).join('')}
      </div>
      <p class="studio-note studio-note--roster">${icon('eye', 13)} 改写后的形态会立即出现在主线战斗与试炼中。</p>
    </aside>

    <section class="enemy-stage" style="--enemy-color:${safeColor(enemy.accent)}">
      <div class="enemy-stage__art">
        <span class="enemy-stage__halo"></span>
        ${imageTag(skin.image, enemy.image, skin.name, 'enemy-stage__image', false)}
        <span class="enemy-stage__tier">${esc(TIER_LABEL[enemy.tier])}</span>
        ${customized ? `<span class="enemy-stage__custom">${icon('sparkles', 12)} 已改写</span>` : ''}
      </div>
      <div class="enemy-stage__form">
        <span class="section-eyebrow">THE FACE OF THE NIGHTMARE</span>
        <label class="field field--enemy-name">
          <span>它在梦里的名字</span>
          <input type="text" maxlength="14" value="${esc(skin.name)}" data-enemy-name data-id="${esc(enemy.id)}" placeholder="${esc(enemy.name)}">
        </label>
        <div class="enemy-stage__meta">
          <span>${icon('heart', 13)} ${enemy.hp} 生命</span>
          <span>${icon('skull', 13)} ${esc(TIER_LABEL[enemy.tier])}</span>
          <span>${icon('cards', 13)} ${enemy.moves.length} 种行动</span>
        </div>
        <p class="enemy-stage__quote">${esc(enemy.quote)}</p>
        <p class="enemy-stage__lore">${esc(enemy.lore)}</p>
        <div class="enemy-stage__moves">
          ${enemy.moves.map((move, index) => `<div class="enemy-move">
            <span>${String(index + 1).padStart(2, '0')}</span>
            <strong>${esc(move.name)}</strong>
            <small>${esc(move.intent || '未知的举动')}</small>
          </div>`).join('')}
        </div>
        <div class="enemy-stage__actions">
          <button type="button" class="button button--ghost" data-action="upload-enemy" data-enemy-id="${esc(enemy.id)}">${icon('upload', 16)} 上传照片</button>
          <button type="button" class="button button--primary" data-action="open-generate" data-kind="enemy" data-enemy-id="${esc(enemy.id)}">${icon('sparkles', 16)} AI 生成形态</button>
          ${customized ? `<button type="button" class="text-button text-button--muted" data-action="reset-enemy-skin" data-id="${esc(enemy.id)}">${icon('rotate', 13)} 恢复默认</button>` : ''}
        </div>
        <p class="studio-note">${icon('lock', 13)} 上传的照片和 AI 图像只存在本机浏览器中。</p>
      </div>
    </section>
  </div>`;
}

function cardsTab() {
  const cards = G.profile.customCards;
  const inspiration = CARDS.filter((card) => card.rarity === 'rare').slice(0, 4);
  return `<div class="studio-cards">
    <div class="studio-panel-heading studio-panel-heading--row">
      <div>
        <span class="section-eyebrow">CARD FORGE</span>
        <h1>我的造物</h1>
        <p>效果链会被完整保留到试炼中。大胆一点，梦境不会报警。</p>
      </div>
      <button type="button" class="button button--primary" data-action="new-custom-card">${icon('plus', 16)} 铸造新牌</button>
    </div>
    <div class="studio-card-meta">
      <span>${icon('cards', 14)} 已铸造 <strong>${cards.length}</strong> 张</span>
      <span>${icon('sparkles', 14)} 试炼牌组中 <strong>${G.profile.sandboxDeck.filter((id) => cards.some((card) => card.id === id)).length}</strong> 张造物</span>
      <button type="button" class="text-button" data-action="open-sandbox">${icon('right', 13)} 前往试炼场</button>
    </div>
    ${cards.length
      ? `<div class="studio-card-grid">
          ${cards.map((card) => `<div class="studio-card-wrap">
            ${cardMarkup(card, {
              action: 'edit-custom-card',
              attrs: `data-id="${esc(card.id)}"`,
              showFlavor: true,
              className: 'studio-card',
            })}
            <span class="studio-card-wrap__edit">${icon('edit', 13)} 编辑 / 销毁</span>
          </div>`).join('')}
        </div>`
      : `<div class="studio-empty">${emptyState(
          'wand',
          '锻造台还是冷的',
          '写一张只属于你的牌。伤害、格挡、抽牌、能量、中毒、力量……效果按顺序结算。',
          `<button type="button" class="button button--primary" data-action="new-custom-card">${icon('plus', 16)} 铸造第一张牌</button>`,
        )}</div>`}
    <section class="inspiration">
      <div class="inspiration__head">
        <span class="section-eyebrow">INSPIRATION WALL</span>
        <h2>灵感墙</h2>
      </div>
      <div class="inspiration__cards">
        ${inspiration.map((card) => cardMarkup(card, { tag: 'div', mini: true })).join('')}
        ${['fracture', 'venomMist', 'bloodPact', 'mirrorEdge'].map((id) => CARD_MAP[id]).filter(Boolean).slice(0, 4).map((card) => cardMarkup(card, { tag: 'div', mini: true })).join('')}
      </div>
    </section>
  </div>`;
}

function aiTab() {
  const ai = G.profile.ai;
  const configured = Boolean(String(ai.baseUrl || '').trim());
  const providerCards = [
    {
      id: 'openai',
      name: '自有接口',
      english: 'OpenAI Compatible',
      desc: '接入任意兼容 /images/generations 的生图 API，使用你自己的模型与密钥。',
      badge: '需要配置',
    },
  ];
  return `<div class="studio-ai">
    <section class="ai-config">
      <div class="studio-panel-heading">
        <span class="section-eyebrow">IMAGE SUMMONING</span>
        <h1>AI 生图接口</h1>
        <p>游戏不提供公共生图服务。填入你自己的 OpenAI 兼容接口才能生成新形象；密钥只保存在本机浏览器，不会写入日志，也不会随存档导出。</p>
      </div>
      <div class="ai-provider-grid">
        ${providerCards.map((provider) => `<button type="button" class="ai-provider ${ai.provider === provider.id ? 'is-selected' : ''}" data-action="set-ai-provider" data-id="${provider.id}">
          <span class="ai-provider__top">
            <span class="ai-provider__icon">${icon('lock', 20)}</span>
            <span class="ai-provider__badge">${provider.badge}</span>
            <span class="ai-provider__check">${ai.provider === provider.id ? icon('check', 14) : ''}</span>
          </span>
          <strong>${provider.name}</strong>
          <em>${provider.english}</em>
          <p>${provider.desc}</p>
        </button>`).join('')}
      </div>
      <div class="ai-fields">
        ${configured ? '' : '<p class="ai-fields__hint">还没填接口地址。填好下面三项才能生成，内置卡面与立绘不受影响。</p>'}
        <label class="field">
          <span>接口地址 <em>Base URL</em></span>
          <input type="text" value="${esc(ai.baseUrl)}" data-ai-field="baseUrl" placeholder="https://api.openai.com/v1" spellcheck="false">
          <small>可填写以 /v1 结尾的地址，或完整的 /images/generations 地址。</small>
        </label>
        <label class="field">
          <span>模型</span>
          <input type="text" value="${esc(ai.model)}" data-ai-field="model" placeholder="gpt-image-1" spellcheck="false">
        </label>
        <label class="field field--wide">
          <span>API Key <em>只存本机</em></span>
          <span class="secret-field">
            <input type="password" value="${esc(ai.apiKey)}" data-ai-field="apiKey" placeholder="sk-..." autocomplete="off" spellcheck="false">
            ${ai.apiKey ? `<button type="button" class="text-button text-button--muted" data-action="clear-api-key">清除</button>` : ''}
          </span>
          <small>生图时会以 Bearer 方式发送到你填写的接口，不会发送到其他地方。</small>
        </label>
      </div>
      <div class="ai-actions">
        <button type="button" class="button button--primary" data-action="open-generate" data-kind="hero">${icon('sparkles', 16)} 生成主角形象</button>
        <button type="button" class="button button--ghost" data-action="open-studio" data-tab="enemies">${icon('image', 16)} 为敌人换形</button>
        <button type="button" class="button button--ghost" data-action="open-card-art">${icon('cards', 16)} 卡面工坊（${CARD_MAP ? Object.keys(CARD_MAP).length : 0} 张）</button>
      </div>
    </section>

    <aside class="ai-side">
      <div class="ai-side__preview">
        <span class="section-eyebrow">LAST DREAM</span>
        <div class="ai-side__frame" style="--origin-color:${safeColor((ORIGIN_MAP[G.profile.originId] || ORIGINS[0]).color)}">
          ${imageTag(getHeroAvatar(), 'assets/heroes/default.webp', getHeroName(), '', false)}
          <span class="ai-side__sparkle">${icon('sparkles', 18)}</span>
        </div>
        <strong>${esc(getHeroName())}</strong>
        <span>${esc((ORIGIN_MAP[G.profile.originId] || ORIGINS[0]).name)}</span>
      </div>
      <div class="ai-side__styles">
        <span class="section-eyebrow">STYLE MEMORY</span>
        <h3>最近使用的画风</h3>
        <div class="ai-style-memory">
          ${AI_STYLES.map((style) => `<button type="button" class="style-chip ${G.profile.ai.lastStyle === style.id ? 'is-selected' : ''}" data-action="open-generate" data-kind="hero" data-style="${style.id}">${esc(style.label)}</button>`).join('')}
        </div>
        <p>选择画风会直接打开主角生成窗口。</p>
      </div>
      <div class="ai-side__privacy">
        ${icon('lock', 18)}
        <div>
          <strong>本地优先</strong>
          <p>档案、图片与密钥保存在浏览器 LocalStorage。清理浏览器数据会让造物一起消失。</p>
        </div>
      </div>
    </aside>
  </div>`;
}

function audioMetaLine(meta) {
  if (!meta) return '';
  return `${meta.name} · ${formatDuration(meta.duration)} · ${formatBytes(meta.size)}`;
}

function sfxSlotMarkup(slot) {
  const meta = G.profile.audio?.sfx?.[slot.id];
  return `<article class="audio-slot ${meta ? 'is-custom' : ''}" style="--slot-accent:${meta ? '#c7a66a' : '#6e645c'}">
    <span class="audio-slot__icon">${icon(slot.icon, 17)}</span>
    <div class="audio-slot__copy">
      <strong>${esc(slot.label)}</strong>
      <small title="${esc(meta ? audioMetaLine(meta) : slot.desc)}">${esc(meta ? audioMetaLine(meta) : slot.desc)}</small>
    </div>
    <div class="audio-slot__actions">
      ${meta ? `<span class="audio-slot__badge">自定义</span>` : ''}
      <button type="button" class="audio-icon-button" data-action="preview-sfx" data-slot="${esc(slot.id)}" title="试听这个音效" aria-label="试听 ${esc(slot.label)}">${icon('play', 13)}</button>
      <button type="button" class="text-button text-button--muted audio-slot__upload" data-action="upload-audio" data-kind="sfx" data-slot="${esc(slot.id)}" title="上传音频替换">${icon('upload', 13)} ${meta ? '替换' : '上传'}</button>
      ${meta ? `<button type="button" class="audio-icon-button audio-icon-button--muted" data-action="reset-audio" data-kind="sfx" data-slot="${esc(slot.id)}" title="还原为内置音效" aria-label="还原 ${esc(slot.label)}">${icon('rotate', 13)}</button>` : ''}
    </div>
  </article>`;
}

function musicSlotMarkup(slot) {
  const meta = G.profile.audio?.music?.[slot.id];
  return `<article class="audio-track ${meta ? 'is-custom' : ''}">
    <div class="audio-track__head">
      <span class="audio-track__icon">${icon(slot.icon, 18)}</span>
      <div class="audio-track__title">
        <strong>${esc(slot.label)}</strong>
        <small>${esc(slot.scene)}</small>
      </div>
      ${meta ? `<span class="audio-track__badge">${icon('check', 11)} 自定义</span>` : '<span class="audio-track__badge audio-track__badge--builtin">内置</span>'}
    </div>
    <p class="audio-track__desc">${esc(slot.desc)}</p>
    <div class="audio-track__file">${meta
      ? `${icon('volume', 12)} <span title="${esc(meta.name)}">${esc(meta.name)}</span> <em>${formatDuration(meta.duration)} · ${formatBytes(meta.size)}</em>`
      : `${icon('waveform', 12)} <span>正在使用程序化梦境音乐</span>`}</div>
    <div class="audio-track__actions">
      ${meta ? `<button type="button" class="text-button" data-action="preview-music" data-slot="${esc(slot.id)}">${icon('play', 13)} 试听</button><span class="dot-separator"></span>` : ''}
      <button type="button" class="text-button text-button--accent" data-action="upload-audio" data-kind="music" data-slot="${esc(slot.id)}">${icon('upload', 13)} ${meta ? '替换音乐' : '上传音乐'}</button>
      ${meta ? `<span class="dot-separator"></span><button type="button" class="text-button text-button--muted" data-action="reset-audio" data-kind="music" data-slot="${esc(slot.id)}">${icon('rotate', 12)} 还原</button>` : ''}
    </div>
  </article>`;
}

function audioTab() {
  const settings = G.profile.settings;
  const customSfx = Object.keys(G.profile.audio?.sfx || {}).length;
  const customMusic = Object.keys(G.profile.audio?.music || {}).length;
  const musicPercent = Math.round((settings.musicVolume ?? 0.8) * 100);
  const sfxPercent = Math.round((settings.sfxVolume ?? 0.9) * 100);
  return `<div class="studio-audio">
    <section class="audio-hero">
      <div class="studio-panel-heading audio-hero__heading">
        <span class="section-eyebrow">SOUND FORGE</span>
        <h1>音之工坊</h1>
        <p>把梦里的内置声音换成你自己的录音、采样或歌。挥击、命中、灼烧、中毒、荆棘、减益、能量与十段场景音乐都能逐项替换。</p>
      </div>
      <div class="audio-mix">
        <div class="audio-mix__head">
          <span class="section-eyebrow">MIXER</span>
          <span class="audio-mix__status">${icon('lock', 12)} 只保存在本机</span>
        </div>
        <label class="audio-volume">
          <span class="audio-volume__head"><span>${icon('volume', 14)} 背景音乐</span><output data-audio-volume-output="music">${musicPercent}%</output></span>
          <input type="range" min="0" max="100" step="1" value="${musicPercent}" data-audio-volume="music" aria-label="背景音乐音量">
        </label>
        <label class="audio-volume">
          <span class="audio-volume__head"><span>${icon('sword', 14)} 打击与音效</span><output data-audio-volume-output="sfx">${sfxPercent}%</output></span>
          <input type="range" min="0" max="100" step="1" value="${sfxPercent}" data-audio-volume="sfx" aria-label="音效音量">
        </label>
        <div class="audio-mix__foot">
          <span>${customSfx} 个音效 · ${customMusic} 首梦歌已改写</span>
          <button type="button" class="text-button ${settings.muted ? 'text-button--accent' : 'text-button--muted'}" data-action="toggle-mute">${icon(settings.muted ? 'volume' : 'mute', 13)} ${settings.muted ? '当前静音 · 开启声音' : '全局静音'}</button>
        </div>
      </div>
    </section>

    <section class="audio-section">
      <div class="audio-section__head">
        <div>
          <span class="section-eyebrow">IMPACT & RITUAL</span>
          <h2>战斗与手感的声音</h2>
          <p>每个动作都有独立的槽位。上传后立即生效，音量由上面的音效滑杆统一控制。</p>
        </div>
        <span class="audio-section__limit">${icon('hourglass', 12)} ${AUDIO_LIMITS.sfx.label}</span>
      </div>
      ${SFX_GROUPS.map((group) => `<div class="audio-group">
        <div class="audio-group__title"><span>${esc(group)}</span><i></i><small>${SFX_SLOTS.filter((slot) => slot.group === group).length} 个槽位</small></div>
        <div class="audio-slot-grid">${SFX_SLOTS.filter((slot) => slot.group === group).map(sfxSlotMarkup).join('')}</div>
      </div>`).join('')}
      <p class="audio-tip">${icon('help', 13)} 临时录音或采样请控制在 20 秒以内；点击「试听」会立即播放当前槽位，内置音效也可以先试听再决定是否替换。</p>
    </section>

    <section class="audio-section">
      <div class="audio-section__head">
        <div>
          <span class="section-eyebrow">SCENE BALLADS</span>
          <h2>场景背景音乐</h2>
          <p>为每个场景放一首属于自己的歌。进入场景时自动循环、无缝淡入，离开时淡出；未上传的场景继续使用程序化音乐。</p>
        </div>
        <span class="audio-section__limit">${icon('hourglass', 12)} ${AUDIO_LIMITS.music.label}</span>
      </div>
      <div class="audio-track-grid">${MUSIC_SLOTS.map(musicSlotMarkup).join('')}</div>
      <p class="audio-tip">${icon('volume', 13)} 试听自定义音乐时会暂时让当前场景音乐退到雾后，结束后自动回来。上传的音乐只会写入本机 IndexedDB，不会离开这台设备。</p>
    </section>

    <section class="audio-danger">
      <div>
        <span class="section-eyebrow">CLEAR THE SOUND</span>
        <strong>把梦的声音全部归还给内置版本</strong>
        <p>清除所有上传的音效与背景音乐，并把音量恢复到 80% / 90%。这个动作无法撤回。</p>
      </div>
      <button type="button" class="button button--danger button--small" data-action="reset-audio-all">${icon('rotate', 14)} 全部还原</button>
    </section>
  </div>`;
}

function displayTab() {
  const fontSize = G.profile.settings.fontSize || 'normal';
  const battleSpeed = Number(G.profile.settings.battleSpeed) >= 2 ? 2 : 1;
  const fullscreen = Boolean(document.fullscreenElement);
  const options = [
    { id: 'small', label: '小', hint: '90%' },
    { id: 'normal', label: '标准', hint: '100%' },
    { id: 'large', label: '大', hint: '112%' },
  ];
  return `<div class="studio-display">
    <section class="audio-hero">
      <div class="studio-panel-heading audio-hero__heading">
        <span class="section-eyebrow">DISPLAY</span>
        <h1>显示与全屏</h1>
        <p>调整全局界面字号，或让牌境占满整块屏幕。设置只保存在本机，不会离开这台设备。</p>
      </div>
      <div class="audio-mix">
        <div class="audio-mix__head">
          <span class="section-eyebrow">FONT SIZE</span>
          <span class="audio-mix__status">${icon('typography', 12)} 界面字号</span>
        </div>
        <div class="display-options">
          ${options.map((option) => `<button type="button" class="display-option ${fontSize === option.id ? 'is-active' : ''}" data-action="set-font-size" data-size="${option.id}" aria-pressed="${fontSize === option.id}">
            <strong>${esc(option.label)}</strong><small>${esc(option.hint)}</small>
          </button>`).join('')}
        </div>
        <div class="audio-mix__foot">
          <span>字号会同时作用于界面与战斗大屏</span>
          <button type="button" class="text-button ${fullscreen ? 'text-button--accent' : ''}" data-action="toggle-fullscreen">${icon(fullscreen ? 'minimize' : 'maximize', 13)} ${fullscreen ? '退出全屏' : '进入全屏'}</button>
        </div>
      </div>
      <div class="audio-mix">
        <div class="audio-mix__head">
          <span class="section-eyebrow">BATTLE SPEED</span>
          <span class="audio-mix__status">${icon('flame', 12)} 战斗演出</span>
        </div>
        <div class="display-options">
          <button type="button" class="display-option ${battleSpeed === 1 ? 'is-active' : ''}" data-action="set-battle-speed" data-speed="1" aria-pressed="${battleSpeed === 1}">
            <strong>1 倍速</strong><small>完整演出与停顿</small>
          </button>
          <button type="button" class="display-option ${battleSpeed === 2 ? 'is-active' : ''}" data-action="set-battle-speed" data-speed="2" aria-pressed="${battleSpeed === 2}">
            <strong>2 倍速</strong><small>动画与停顿减半</small>
          </button>
        </div>
        <div class="audio-mix__foot">
          <span>只加快演出，不改变任何数值与判定</span>
        </div>
      </div>
    </section>
    <section class="audio-section">
      <div class="audio-section__head">
        <div>
          <span class="section-eyebrow">SHORTCUT</span>
          <h2>操作提示</h2>
          <p>右键任意卡牌可以查看它的强化效果与详细信息；战斗中点开牌堆可以查看抽牌堆、弃牌堆与消耗堆。</p>
        </div>
      </div>
    </section>
  </div>`;
}

export function renderStudio() {
  const tab = G.ui.studioTab || 'hero';
  const titles = {
    hero: '自定义主角',
    enemies: '梦境面孔',
    cards: '卡牌铸造',
    ai: 'AI 生图',
    audio: '音之工坊',
    display: '显示设置',
  };
  return `<div class="screen studio-screen">
    <div class="page-glow" aria-hidden="true"></div>
    <header class="pagebar">
      <button type="button" class="pagebar__back" data-action="studio-back">${icon('left', 18)}<span>返回</span></button>
      <div class="pagebar__title"><span>造物工坊</span><strong>${esc(titles[tab] || '自定义')}</strong></div>
      <div class="pagebar__actions">
        ${topbarMuteButton()}
        <button type="button" class="button button--ghost button--small" data-action="open-guide">${icon('help', 15)} 指南</button>
      </div>
    </header>
    <main class="studio-layout">
      <nav class="studio-tabs" aria-label="工坊分页">
        ${tabButton('hero', '主角', 'user')}
        ${tabButton('enemies', '敌人形态', 'image', ENEMIES.length)}
        ${tabButton('cards', '我的造物', 'wand', G.profile.customCards.length)}
        ${tabButton('ai', 'AI 生图', 'sparkles')}
        ${tabButton('audio', '音之工坊', 'volume', Object.keys(G.profile.audio?.sfx || {}).length + Object.keys(G.profile.audio?.music || {}).length || null)}
        ${tabButton('display', '显示', 'eye')}
        <span class="studio-tabs__line"></span>
        <p class="studio-tabs__note">所有自定义内容都保存在本机。音频使用独立的本地仓库，不占用档案空间。</p>
      </nav>
      <section class="studio-main">${tab === 'enemies' ? enemyTab() : tab === 'cards' ? cardsTab() : tab === 'ai' ? aiTab() : tab === 'audio' ? audioTab() : tab === 'display' ? displayTab() : heroTab()}</section>
    </main>
  </div>`;
}
