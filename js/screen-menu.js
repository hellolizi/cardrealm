import { CARD_MAP, ORIGINS, ORIGIN_MAP } from './data.js';
import { achievementCounts } from './achievements.js';
import { ASCENSION_LEVELS, MAX_ASCENSION, ascensionLevel } from './ascension.js';
import { dailyInfo } from './daily.js';
import { ENDINGS, ENDING_MAP, REGION_MAP, REGIONS } from './lore.js';
import { G, getHeroAvatar, getHeroName } from './state.js';
import {
  cardMarkup,
  deckCount,
  groupDeck,
  imageTag,
  topbarMuteButton,
} from './ui-common.js';
import { esc, icon, safeColor } from './utils.js';

function profileStats() {
  return G.profile.stats || { runs: 0, wins: 0 };
}

function starterGlyphs(origin) {
  const uniqueIds = [...new Set(origin.starter)];
  return uniqueIds
    .slice(0, 5)
    .map((id) => {
      const card = CARD_MAP[id];
      return card
        ? `<span class="starter-glyph" title="${esc(card.name)}">${esc(card.glyph)}</span>`
        : '';
    })
    .join('');
}

export function renderMenu() {
  const origin = ORIGIN_MAP[G.profile.originId] || ORIGINS[0];
  const stats = profileStats();
  const heroName = getHeroName();
  const world = G.profile.world;
  const cleared = world.clearedRegions.length;
  const endings = world.endings.length;
  const expeditionNote = world.stats.clears
    ? `${world.stats.clears} 次远征 · ${cleared}/${REGIONS.length} 座岛已踏平`
    : '七座岛与一颗心，在雾里等你';
  const daily = dailyInfo();
  const dailyDone = G.profile.daily?.lastDate === daily.key;
  const achievementTally = achievementCounts();
  const run = G.run;
  const resumeNote = run
    ? `${REGION_MAP[run.regionId]?.name || '梦境群岛'} · 第 ${Number(run.floor) || 0} 层${run.battle ? ' · 战斗中' : ''}`
    : '';
  return `<div class="screen menu-screen">
    <div class="menu-backdrop" aria-hidden="true">
      ${imageTag('assets/realm-bg.webp', 'assets/realm-bg.webp', '', 'menu-backdrop__image', false)}
      <span class="menu-backdrop__veil"></span>
      <span class="menu-backdrop__fog"></span>
    </div>
    <header class="menu-topbar">
      <div class="brand">
        <span class="brand__mark">${icon('cards', 22)}</span>
        <span class="brand__text">牌境<small>THE CARD REALM</small></span>
      </div>
      <nav class="menu-topbar__actions">
        <button type="button" class="text-button" data-action="open-achievements">${icon('crown', 16)} 成就 ${achievementTally.unlocked}/${achievementTally.total}</button>
        <button type="button" class="text-button" data-action="open-guide">${icon('help', 16)} 玩法指南</button>
        ${topbarMuteButton()}
        <button type="button" class="text-button text-button--accent" data-action="open-studio" data-tab="hero">${icon('wand', 16)} 造物工坊</button>
      </nav>
    </header>

    <main class="menu-layout">
      <section class="menu-copy">
        <div class="menu-eyebrow"><span></span> 一副会呼吸的牌 <span></span></div>
        <h1 class="menu-title" aria-label="牌境">
          <span class="menu-title__char">牌</span>
          <span class="menu-title__char menu-title__char--accent">境</span>
        </h1>
        <div class="menu-title-en">THE CARD REALM</div>
        <p class="menu-lead">十二年前，白鹭号在凌晨三点十七分沉没。<br>有人把九个孩子一个个递上岸，自己没上来。<br>七座岛，一颗心，一场不肯醒的梦。</p>
        <div class="menu-actions">
          ${run ? `<button type="button" class="menu-action menu-action--primary menu-action--resume" data-action="continue-run">
            <span class="menu-action__sigil">${icon('play', 22)}</span>
            <span class="menu-action__copy"><strong>继续游戏</strong><small>${esc(resumeNote)}</small></span>
            <span class="menu-action__arrow">${icon('right', 20)}</span>
          </button>` : ''}
          <button type="button" class="menu-action menu-action--primary" data-action="open-world">
            <span class="menu-action__sigil">${icon('map', 22)}</span>
            <span class="menu-action__copy"><strong>进入梦境群岛</strong><small>${esc(expeditionNote)}</small></span>
            <span class="menu-action__arrow">${icon('right', 20)}</span>
          </button>
          <button type="button" class="menu-action menu-action--secondary" data-action="open-sandbox">
            <span class="menu-action__sigil">${icon('sparkles', 22)}</span>
            <span class="menu-action__copy"><strong>幻境游乐场</strong><small>自定义卡牌 · 敌人 · 试炼</small></span>
            <span class="menu-action__arrow">${icon('right', 20)}</span>
          </button>
          <button type="button" class="menu-action menu-action--secondary" data-action="open-endless">
            <span class="menu-action__sigil">${icon('flame', 22)}</span>
            <span class="menu-action__copy"><strong>无尽回廊</strong><small>${Number(G.profile.endlessBest) > 0 ? `最远第 ${Number(G.profile.endlessBest)} 层 · 独立于主线` : '独立于主线 · 一层一层往下沉'}</small></span>
            <span class="menu-action__arrow">${icon('right', 20)}</span>
          </button>
          <button type="button" class="menu-action menu-action--online" data-action="open-online">
            <span class="menu-action__sigil">${icon('users', 22)}</span>
            <span class="menu-action__copy"><strong>联机梦境</strong><small>镜像决斗 · 共梦之战 · 两个人一场梦</small></span>
            <span class="menu-action__arrow">${icon('right', 20)}</span>
          </button>
          <button type="button" class="menu-daily ${dailyDone ? 'is-done' : ''}" data-action="start-daily" title="${esc(`${daily.label} · ${daily.originName} · ${daily.bossName} · ${daily.deckSize} 张固定牌组 · 层级 ${daily.ascension}`)}">
            <span class="menu-daily__sigil">${dailyDone ? icon('check', 18) : '日'}</span>
            <span class="menu-daily__copy">
              <strong>今日梦魇${dailyDone ? ' · 已完成' : ''}</strong>
              <small>${esc(daily.originName)} · ${esc(daily.bossName)} · 层级 ${daily.ascension} · ${esc(daily.variant?.name || '静水')}</small>
            </span>
            <span class="menu-daily__meta">
              <b>${G.profile.daily?.streak || 0}</b><small>日连胜</small>
            </span>
            <span class="menu-daily__arrow">${icon('right', 18)}</span>
          </button>
          <div class="menu-actions__foot">
            <button type="button" class="text-button" data-action="open-studio" data-tab="cards">${icon('wand', 15)} 打造一张自己的牌</button>
            <span class="dot-separator"></span>
            <button type="button" class="text-button" data-action="open-studio" data-tab="hero">${icon('user', 15)} 自定义主角</button>
            <span class="dot-separator"></span>
            <button type="button" class="text-button" data-action="open-studio" data-tab="audio">${icon('waveform', 15)} 自定义声音</button>
            <span class="dot-separator"></span>
            <button type="button" class="text-button" data-action="open-codex">${icon('scroll', 15)} 结局图鉴 ${endings}/${ENDINGS.length}</button>
            <button type="button" class="text-button" data-action="open-achievements">${icon('crown', 15)} 成就回廊 ${achievementTally.unlocked}/${achievementTally.total}</button>
            <button type="button" class="text-button" data-action="open-shards">${icon('sparkles', 15)} 梦的碎片 ${Number(G.profile.shards) || 0}</button>
            <button type="button" class="text-button" data-action="open-save-backup">${icon('chest', 15)} 存档备份</button>
            <button type="button" class="text-button" data-action="open-keywords">${icon('help', 15)} 关键词手册</button>
          </div>
        </div>
        <div class="menu-note">
          <span class="live-dot"></span>
          梦境群岛 · 自动存档于本地 · 每张纪念牌都记得一个人
        </div>
      </section>

      <aside class="profile-panel">
        <span class="profile-panel__corner profile-panel__corner--tl"></span>
        <span class="profile-panel__corner profile-panel__corner--br"></span>
        <div class="profile-panel__eyebrow">YOUR CARDBEARER</div>
        <div class="profile-portrait" style="--origin-color:${safeColor(origin.color)}">
          <span class="profile-portrait__halo"></span>
          ${imageTag(getHeroAvatar(origin.id), 'assets/heroes/default.webp', heroName, 'profile-portrait__image', false)}
          <span class="profile-portrait__sigil">${esc(origin.sigil)}</span>
        </div>
        <div class="profile-panel__identity">
          <span class="profile-panel__label">执牌者</span>
          <h2>${esc(heroName)}</h2>
          <p><span style="color:${safeColor(origin.color)}">${esc(origin.name)}</span> · ${esc(origin.epithet)}</p>
        </div>
        <div class="profile-panel__stats">
          <div><span>旅程</span><strong>${stats.runs}</strong></div>
          <span class="stat-divider"></span>
          <div><span>凯旋</span><strong>${stats.wins}</strong></div>
          <span class="stat-divider"></span>
          <div><span>击败</span><strong>${stats.enemiesFelled || 0}</strong></div>
        </div>
        <button type="button" class="profile-panel__edit" data-action="open-studio" data-tab="hero">
          ${icon('camera', 15)} 更换形象 / 珍藏记录
        </button>
        <div class="floating-hand" aria-hidden="true">
          <span class="floating-card floating-card--one"><small>梦</small><strong>未命名的牌</strong><em>造物</em></span>
          <span class="floating-card floating-card--two"><small>斩</small><strong>斩击</strong><em>攻击</em></span>
          <span class="floating-card floating-card--three"><small>影</small><strong>影袭</strong><em>攻击</em></span>
        </div>
      </aside>
    </main>

    <footer class="menu-footer">
      <span>牌境 · v2.1.5</span>
      <span>每一次入梦，都是一副新的牌。</span>
    </footer>
  </div>`;
}

function originCard(origin, selected) {
  const uniqueCards = [...new Set(origin.starter)].map((id) => CARD_MAP[id]).filter(Boolean);
  const custom = Boolean(G.profile.heroAvatars?.[origin.id]);
  return `<button type="button" class="origin-card ${selected ? 'is-selected' : ''}" data-action="select-origin" data-id="${esc(origin.id)}" style="--origin:${safeColor(origin.color)}" aria-pressed="${selected}">
    <span class="origin-card__wash"></span>
    <span class="origin-card__portrait">
      ${imageTag(getHeroAvatar(origin.id), custom ? origin.portrait : 'assets/heroes/default.webp', origin.name, 'origin-card__portrait-image', false)}
      <span class="origin-card__portrait-sigil">${esc(origin.sigil)}</span>
    </span>
    <span class="origin-card__top">
      <span class="origin-card__sigil">${esc(origin.sigil)}</span>
      <span class="origin-card__check">${selected ? icon('check', 16) : ''}</span>
    </span>
    <span class="origin-card__index">ORIGIN ${String(ORIGINS.findIndex((item) => item.id === origin.id) + 1).padStart(2, '0')}</span>
    <span class="origin-card__name">${esc(origin.name)}</span>
    <span class="origin-card__epithet">${esc(origin.epithet)}</span>
    <span class="origin-card__quote">${esc(origin.quote)}</span>
    <span class="origin-card__divider"></span>
    ${origin.mechanic ? `<span class="origin-card__mechanic"><i>${esc(origin.mechanic.glyph)}</i><span><small>专属机制 · ${esc(origin.mechanic.name)}</small>${esc(origin.mechanic.short)}</span></span>` : ''}
    <span class="origin-card__passive"><small>${esc(origin.passiveName)}</small>${esc(origin.passive)}</span>
    <span class="origin-card__meta">
      <span>${icon('heart', 14)} 生命 <strong>${origin.hp}</strong></span>
      <span>${icon('cards', 14)} 牌组 <strong>${origin.starter.length}</strong></span>
    </span>
    <span class="origin-card__deck">
      <span class="origin-card__deck-label">初识之牌</span>
      <span class="starter-glyph-row">${starterGlyphs(origin)}</span>
    </span>
  </button>`;
}

export function renderOrigins() {
  const selected = ORIGIN_MAP[G.ui.originChoice] || ORIGIN_MAP[G.profile.originId] || ORIGINS[0];
  const hasEnding = Array.isArray(G.profile.world?.endings) && G.profile.world.endings.length > 0;
  const region = REGION_MAP[G.ui.regionChoice]
    || REGION_MAP[G.profile.world.lastRegion]
    || REGIONS[0];
  const ascensionUnlocked = Math.max(0, Math.min(MAX_ASCENSION, Number(G.profile.ascensionUnlocked) || 0));
  const ascensionPick = Math.max(0, Math.min(ascensionUnlocked, Number(G.ui.ascensionChoice) || 0));
  const ascension = ascensionLevel(ascensionPick);
  return `<div class="screen sub-screen origins-screen">
    <div class="page-glow" aria-hidden="true"></div>
    <header class="pagebar">
      <button type="button" class="pagebar__back" data-action="back-world">${icon('left', 18)}<span>梦境群岛</span></button>
      <div class="pagebar__title"><span>${esc(region.episode)} · ${esc(region.name)}</span><strong>选择你的梦</strong></div>
      <div class="pagebar__actions">
        ${topbarMuteButton()}
        <button type="button" class="text-button" data-action="open-studio" data-tab="hero">${icon('user', 15)} 编辑执牌者</button>
      </div>
    </header>
    <main class="origins-layout">
      <div class="origins-heading">
        <div>
          <span class="section-eyebrow">CHOOSE YOUR ORIGIN · ${esc(region.name)}</span>
          <h1>你将带走哪一片<br><em>自己</em>？</h1>
          <p class="origins-narrative">梦记不清你的脸。它只记得你身上的五样东西：握过剑的手、看过星的眼睛、在水里像影子一样轻的脚步、被灯烫过的掌心、最后一刻笑出来的声音。<strong>你只能带走一片。</strong>带走两片，你会想起全部；而想起全部的人，醒不过来。</p>
          ${G.ui.endlessPick ? `<p class="origins-endless">${icon('flame', 12)} 无尽回廊 · 清空一座岛就沉下一层，不写剧情，只考验构筑</p>` : ''}
          ${hasEnding && !G.ui.endlessPick ? `<button type="button" class="origin-ngplus ${G.ui.ngPlus ? 'is-on' : ''}" data-action="toggle-ng-plus" aria-pressed="${G.ui.ngPlus ? 'true' : 'false'}">
            ${icon('rotate', 13)} 二周目 · ${G.ui.ngPlus ? '开（敌人 +15% 生命 / +1 攻击）' : '关'}
          </button>` : ''}
        </div>
        <div class="origins-bearer">
          <span class="origins-bearer__portrait">${imageTag(getHeroAvatar(selected.id), selected.portrait || 'assets/heroes/default.webp', getHeroName(), '', false)}</span>
          <span class="origins-bearer__text"><small>当前执牌者 · ${esc(selected.name)}</small><strong>${esc(getHeroName())}</strong><span>每个起源都有独立形象、专属机制与专属卡</span></span>
        </div>
      </div>
      <div class="origin-region" style="--region-color:${safeColor(region.color)}">
        <span class="origin-region__sigil">${esc(region.sigil)}</span>
        <div class="origin-region__copy">
          <small>目的地 · ${esc(region.name)}「${esc(region.epithet)}」</small>
          <strong>${esc(region.boonName)}</strong>
          <p>${esc(region.boon)}</p>
        </div>
        <span class="origin-region__order">${esc(region.episode)}</span>
      </div>
      <section class="ascension-panel" style="--ascension:${safeColor(ascension.color)}">
        <div class="ascension-panel__head">
          <span class="section-eyebrow">DREAM DEPTH · 梦境层级</span>
          <strong>这一次，梦要压得多低？</strong>
          <small>完成一座岛解锁下一层。前五层压高梦魇；从第 6 层「棘梦」起，梦会开始改写抽牌、行囊、能量与价格。</small>
        </div>
        <div class="ascension-track" role="group" aria-label="梦境层级">
          ${ASCENSION_LEVELS.map((entry) => {
            const locked = entry.level > ascensionUnlocked;
            return `<button type="button" class="ascension-pip ${entry.level === ascensionPick ? 'is-active' : ''} ${locked ? 'is-locked' : ''}" data-action="select-ascension" data-level="${entry.level}" style="--pip:${safeColor(entry.color)}" title="${esc(locked ? `完成层级 ${entry.level - 1} 后解锁：${entry.detail}` : `${entry.name}：${entry.desc}`)}" aria-pressed="${entry.level === ascensionPick}">
              <b>${entry.level}</b>
              <span>${esc(entry.name)}</span>
              ${locked ? icon('lock', 11) : entry.level === ascensionPick ? icon('check', 11) : ''}
            </button>`;
          }).join('')}
        </div>
        <div class="ascension-detail">
          <span class="ascension-detail__seal">${ascension.level === 0 ? '梦' : String(ascension.level)}</span>
          <div class="ascension-detail__copy">
            <strong>${esc(ascension.name)} <small>${esc(ascension.subtitle)}</small></strong>
            <p>${esc(ascension.desc)}</p>
            <em>${esc(ascension.detail)}</em>
            ${ascension.trial ? `<span class="ascension-detail__trial"><b>${esc(ascension.trialGlyph)}</b><span><small>梦律 · ${esc(ascension.trial)}</small>${esc(ascension.trialDesc)}</span></span>` : ''}
            ${ascension.tags.length ? `<div class="ascension-detail__tags">${ascension.tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}
            ${ascension.reward && CARD_MAP[ascension.reward] ? `<span class="ascension-detail__reward">${icon('cards', 12)} 首通卡牌 · ${esc(CARD_MAP[ascension.reward].name)}</span>` : ''}
          </div>
          <span class="ascension-detail__best">已解锁至 ${ascensionUnlocked}/${MAX_ASCENSION}<small>最高完成 ${Number(G.profile.ascensionBest) || 0} 层</small></span>
        </div>
      </section>
      <section class="seed-panel">
        <div class="seed-panel__head">
          <span class="section-eyebrow">DREAM SEED · 梦境种子</span>
          <div class="seed-panel__field">
            ${icon('dice', 14)}
            <input type="text" data-run-seed maxlength="40" spellcheck="false" autocomplete="off" placeholder="留空则随机生成" value="${esc(G.ui.seedInput || '')}" aria-label="梦境种子" />
            <button type="button" class="seed-panel__dice" data-action="random-seed" title="换一个随机种子">${icon('rotate', 14)}</button>
          </div>
        </div>
        <small>填入相同的种子，会重走同一张地图、同一批奖励与同一个敌人顺序。</small>
      </section>
      <div class="origin-grid">
        ${ORIGINS.map((origin) => originCard(origin, origin.id === selected.id)).join('')}
      </div>
      <div class="origin-confirm">
        <div class="origin-confirm__copy">
          <span class="section-eyebrow">THE FIRST SHUFFLE</span>
          <h2>${esc(selected.name)}</h2>
          <p class="origin-confirm__depth" style="--ascension:${safeColor(ascension.color)}">${icon('flame', 13)} 梦境层级 ${ascension.level} · ${esc(ascension.name)}<small>${esc(ascension.detail)}</small></p>
          <p>${esc(selected.deckNote)}</p>
          ${selected.mechanic ? `<p class="origin-confirm__mechanic"><i>${esc(selected.mechanic.glyph)}</i><span><strong>${esc(selected.mechanic.name)}</strong> · ${esc(selected.mechanic.desc)}</span></p>` : ''}
        </div>
        <div class="origin-confirm__deck">
          ${groupDeck(selected.starter).slice(0, 5).map((group) => `<span class="origin-confirm__deck-item">${esc(group.card.name)} <small>×${group.count}</small></span>`).join('')}
        </div>
        <button type="button" class="button button--primary button--large" data-action="start-adventure">
          <span>从「${esc(region.name)}」启程</span>${icon('right', 18)}
        </button>
      </div>
    </main>
  </div>`;
}

export function renderEnding() {
  const world = G.profile.world;
  const ending = ENDING_MAP[G.ui.endingId] || ENDING_MAP[world.lastEnding] || ENDINGS[0];
  const run = G.run;
  const origin = ORIGIN_MAP[run?.originId || G.profile.originId] || ORIGINS[0];
  const totalCards = run ? deckCount(run.deck) : 0;
  const stats = run
    ? [
        ['击败梦魇', run.totals.enemiesFelled, `带走 ${totalCards} 张牌的记忆`],
        ['打出卡牌', run.totals.cardsPlayed, '每一张都替你说话'],
        ['造成伤害', run.totals.damageDealt, '梦也会疼'],
        ['剩余生命', run.hp, `${run.maxHp} 点中的最后坚持`],
        ['金币', run.gold, '梦里的货币带不走'],
      ]
    : [
        ['完成远征', world.stats.clears, `${world.clearedRegions.length}/${REGIONS.length} 座岛屿踏平`],
        ['击败梦魇', world.stats.bosses, '岛屿之主也算在内'],
        ['打出卡牌', world.stats.cardsPlayed, '牌记得每一次选择'],
        ['收录结局', `${world.endings.length}/${ENDINGS.length}`, '还有别的梦没有写完'],
      ];
  return `<div class="screen ending-screen" style="--ending-color:${safeColor(ending.color)}">
    <div class="ending-backdrop">
      ${imageTag('assets/realm-bg.webp', 'assets/realm-bg.webp', '', 'ending-backdrop__image', false)}
      <span class="ending-backdrop__veil"></span>
      <span class="ending-stars"></span>
    </div>
    <div class="ending-content ending-content--codex">
      <span class="ending-eyebrow">${esc(ending.eyebrow)}</span>
      <div class="ending-emblem">
        <span class="ending-emblem__ring"></span>
        <span class="ending-emblem__glyph">${esc(ending.glyph)}</span>
      </div>
      <h1>${esc(ending.title)}</h1>
      <p class="ending-subtitle">${esc(ending.subtitle)}</p>
      <div class="ending-prose">
        ${ending.paragraphs.map((line, index) => `<p style="--line-index:${index}">${esc(line)}</p>`).join('')}
      </div>
      <p class="ending-quote">${esc(ending.quote)}</p>
      <div class="ending-stats">
        ${stats.map(([label, value, note]) => `<div class="ending-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`).join('')}
      </div>
      <div class="ending-bearer">
        <span class="ending-bearer__portrait" style="--origin-color:${safeColor(origin.color)}">${imageTag(getHeroAvatar(), 'assets/heroes/default.webp', getHeroName(), '', false)}</span>
        <span><small>${esc(origin.name)}</small><strong>${esc(getHeroName())}</strong><em>第 ${G.profile.stats.wins} 次凯旋</em></span>
      </div>
      <div class="ending-actions">
        <button type="button" class="button button--primary button--large" data-action="ending-world">${icon('map', 17)} 回到梦境群岛</button>
        <button type="button" class="button button--ghost button--large" data-action="ending-again">${icon('rotate', 17)} 再入一梦</button>
        <button type="button" class="button button--ghost button--large" data-action="ending-menu">${icon('home', 17)} 回到扉页</button>
      </div>
      <button type="button" class="text-button ending-codex-link" data-action="open-codex">${icon('scroll', 15)} 翻看结局图鉴 · ${world.endings.length}/${ENDINGS.length}</button>
      <span class="ending-footnote">有些梦会被遗忘，但牌会记得你。</span>
    </div>
  </div>`;
}
