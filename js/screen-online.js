import { ENEMIES, ENEMY_MAP, ORIGINS, ORIGIN_MAP } from './data.js';
import { currentEnemyMove } from './online-engine.js';
import { getOnline } from './online-client.js';
import { G, getCardDef, getHeroName } from './state.js';
import { isPhaseArtRevealed } from './phase-art.js';
import { bossGaugeMarkup } from './boss-gauge.js';
import {
  cardMarkup,
  imageTag,
  intentInfo,
  progressBar,
  resonanceChip,
  statusPills,
  topbarMuteButton,
} from './ui-common.js';
import { esc, icon, resolveCard, safeColor } from './utils.js';

const MODE_INFO = {
  pvp: {
    name: '镜像决斗',
    en: 'MIRROR DUEL',
    icon: 'sword',
    desc: '两人各自为战。把对手的生命打到零，站在梦的中央。',
    rule: '先手为房主 · 各自携带起源初始牌组 · 不留遗物与金币',
  },
  coop: {
    name: '共梦之战',
    en: 'SHARED NIGHTMARE',
    icon: 'users',
    desc: '两人轮流行动，共同迎战被梦境放大的梦魇。',
    rule: '梦魇生命翻倍 · 先手为房主 · 先倒下的人仍可看着同伴继续',
  },
};

function lobbyMode() {
  return MODE_INFO[G.ui.online.mode] ? G.ui.online.mode : 'pvp';
}

function lobbyOrigin() {
  return ORIGIN_MAP[G.ui.online.originId] || ORIGIN_MAP[G.profile.originId] || ORIGINS[0];
}

function lobbyEnemy() {
  return ENEMY_MAP[G.ui.online.enemyId] || ENEMY_MAP['nightmare-dragon'] || ENEMIES[0];
}

function onlineName() {
  return (G.profile.online.name || '').trim() || getHeroName();
}

function formatLatency(on) {
  if (!on.connected) return '未连接';
  if (on.latency == null) return '已连接';
  return `${on.latency} ms`;
}

function modeLabel(mode) {
  return MODE_INFO[mode]?.name || MODE_INFO.pvp.name;
}

function modeMarkup(mode) {
  const info = MODE_INFO[mode];
  const selected = lobbyMode() === mode;
  return `<button type="button" class="online-mode ${selected ? 'is-selected' : ''}" data-action="online-mode" data-id="${mode}" aria-pressed="${selected}">
    <span class="online-mode__wash"></span>
    <span class="online-mode__top">
      <span class="online-mode__icon">${icon(info.icon, 20)}</span>
      <span class="online-mode__check">${selected ? icon('check', 14) : ''}</span>
    </span>
    <span class="online-mode__en">${info.en}</span>
    <strong>${info.name}</strong>
    <span class="online-mode__desc">${info.desc}</span>
    <span class="online-mode__rule">${icon('eye', 12)} ${info.rule}</span>
  </button>`;
}

function originMarkup(origin) {
  const selected = lobbyOrigin().id === origin.id;
  return `<button type="button" class="online-origin ${selected ? 'is-selected' : ''}" data-action="online-origin" data-id="${esc(origin.id)}" style="--origin:${safeColor(origin.color)}" aria-pressed="${selected}">
    <span class="online-origin__sigil">${esc(origin.sigil)}</span>
    <span class="online-origin__copy">
      <strong>${esc(origin.name)}</strong>
      <small>${origin.hp} 生命 · ${esc(origin.passiveName)}</small>
    </span>
    <span class="online-origin__check">${selected ? icon('check', 13) : ''}</span>
  </button>`;
}

function renderConnecting(on) {
  if (on.status !== 'connecting') return '';
  const joining = on.pendingAction === 'join';
  return `<div class="online-connecting" role="status" aria-live="polite">
    <div class="online-connecting__panel">
      <span class="online-orbit"><i></i><i></i><i></i></span>
      <span class="section-eyebrow">${joining ? 'KNOCKING ON THE DREAM' : 'OPENING THE DREAM'}</span>
      <h2>${joining ? '正在寻找那扇门…' : '正在铺开两个人的梦…'}</h2>
      <p>${esc(G.profile.online.serverUrl)}</p>
      <button type="button" class="button button--ghost" data-action="online-cancel">${icon('close', 15)} 取消连接</button>
    </div>
  </div>`;
}

function renderLobby(on) {
  const mode = lobbyMode();
  const origin = lobbyOrigin();
  const enemy = lobbyEnemy();
  const busy = on.status === 'connecting';
  return `<div class="screen online-screen online-screen--lobby">
    <div class="page-glow" aria-hidden="true"></div>
    <div class="online-aurora" aria-hidden="true"><i></i><i></i><i></i></div>
    <header class="pagebar">
      <button type="button" class="pagebar__back" data-action="online-back">${icon('left', 18)}<span>扉页</span></button>
      <div class="pagebar__title"><span>DREAM LINK · 联机梦境</span><strong>两个人，一场梦</strong></div>
      <div class="pagebar__actions">
        ${topbarMuteButton()}
        <button type="button" class="icon-button" data-action="open-guide" title="玩法指南">${icon('help', 18)}</button>
      </div>
    </header>

    <main class="online-lobby">
      <section class="online-hero">
        <span class="section-eyebrow">TWO DREAMERS · ONE NIGHT</span>
        <h1>把同一场梦，<br><em>分成两半。</em></h1>
        <p class="online-hero__lead">一位执牌者成为房主，另一位循着房间码入梦。服务器只负责把你们的声音递给彼此，梦的规则由房主的牌桌裁定。</p>
        <div class="online-hero__marks">
          <div><span>01</span><strong>房间码</strong><small>五枚字符，一扇门</small></div>
          <div><span>02</span><strong>房主裁定</strong><small>所有出牌由房主结算</small></div>
          <div><span>03</span><strong>实时同步</strong><small>每一张牌都会抵达</small></div>
        </div>
        <div class="online-hero__bearer" style="--origin:${safeColor(origin.color)}">
          <span class="online-hero__sigil">${esc(origin.sigil)}</span>
          <span><small>将以</small><strong>${esc(origin.name)}</strong><em>入梦 · ${esc(getHeroName())}</em></span>
        </div>
        <div class="online-hero__note">
          ${icon('link', 14)}
          <span>联机使用起源初始牌组；自定义卡牌、遗物与形象只在单机梦境中生效。</span>
        </div>
      </section>

      <section class="online-setup">
        ${on.error ? `<div class="online-banner online-banner--error">${icon('wifiOff', 16)}<span>${esc(on.error)}</span></div>` : ''}
        <div class="online-step">
          <div class="online-step__head"><span>01 · 梦境模式</span><small>MODE</small></div>
          <div class="online-mode-grid">${modeMarkup('pvp')}${modeMarkup('coop')}</div>
        </div>

        <div class="online-step">
          <div class="online-step__head"><span>02 · 你的起源</span><small>ORIGIN</small></div>
          <div class="online-origin-grid">${ORIGINS.map(originMarkup).join('')}</div>
        </div>

        ${mode === 'coop' ? `<div class="online-step online-step--enemy">
          <div class="online-step__head"><span>03 · 共梦之敌</span><small>NIGHTMARE</small></div>
          <div class="online-enemy">
            <div class="online-enemy__art" style="--enemy:${safeColor(enemy.accent)}">
              ${imageTag(enemy.image, enemy.image, enemy.name, 'online-enemy__image')}
              <span class="online-enemy__veil"></span>
              <span class="online-enemy__glyph">${esc(enemy.glyph)}</span>
            </div>
            <div class="online-enemy__copy">
              <div class="online-enemy__title"><strong>${esc(enemy.name)}</strong><span>${icon('heart', 13)} ${enemy.hp * 2} · 双人梦魇</span></div>
              <p>${esc(enemy.lore)}</p>
              <div class="online-enemy__moves">${enemy.moves.slice(0, 3).map((move) => `<span>${esc(move.name)}</span>`).join('')}</div>
            </div>
            <label class="field online-enemy__select">
              <span>选择梦魇</span>
              <select data-online-field="enemy">
                ${ENEMIES.map((item) => `<option value="${esc(item.id)}" ${item.id === enemy.id ? 'selected' : ''}>${esc(item.name)} · ${item.tier === 'boss' ? '梦魇之主' : item.tier === 'elite' ? '镜中精英' : '游荡梦魇'}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>` : ''}

        <div class="online-step">
          <div class="online-step__head"><span>${mode === 'coop' ? '04' : '03'} · 入梦方式</span><small>CONNECT</small></div>
          <div class="online-fields">
            <label class="field">
              <span>联机称呼</span>
              <input type="text" maxlength="16" autocomplete="nickname" data-online-field="name" value="${esc(onlineName())}" placeholder="留空则使用执牌者名字">
            </label>
            <label class="field">
              <span>服务器地址</span>
              <input type="text" maxlength="300" spellcheck="false" autocomplete="off" data-online-field="server" value="${esc(G.profile.online.serverUrl)}" placeholder="wss://域名/ws">
            </label>
          </div>
          <div class="online-entry">
            <button type="button" class="button button--primary button--large online-entry__create" data-action="online-create" ${busy ? 'disabled' : ''}>
              ${icon('sparkles', 17)} 创建房间<small>成为房主</small>
            </button>
            <div class="online-join">
              <span class="online-join__label">已有房间码</span>
              <input type="text" class="online-join__input" maxlength="8" spellcheck="false" autocomplete="off" data-online-field="joinCode" value="${esc(G.ui.online.joinCode || '')}" placeholder="ABCDE" aria-label="房间码">
              <button type="button" class="button online-join__button" data-action="online-join" ${busy ? 'disabled' : ''}>${icon('right', 16)} 加入</button>
            </div>
          </div>
          <p class="online-fields__hint">${icon('wifi', 13)} 两个人需要连接同一个服务器。网页版会自动使用同域 <code>/ws</code>；桌面版默认连接 <code>ws://127.0.0.1:8787</code>，也可以填写自己的 <code>wss://域名/ws</code>。</p>
        </div>
      </section>
    </main>
    ${renderConnecting(on)}
  </div>`;
}

function roomPlayer(info, label, side) {
  const origin = ORIGIN_MAP[info?.originId] || ORIGINS[0];
  return `<div class="online-room-player online-room-player--${side}" style="--origin:${safeColor(origin.color)}">
    <span class="online-room-player__ring"></span>
    <span class="online-room-player__sigil">${esc(origin.sigil)}</span>
    <div class="online-room-player__copy">
      <small>${esc(label)}</small>
      <strong>${esc(info?.name || '无名旅者')}</strong>
      <span>${esc(origin.name)} · ${origin.hp} 生命</span>
    </div>
    <span class="online-room-player__status">${icon('check', 13)} 已入梦</span>
  </div>`;
}

function renderRoom(on) {
  const mode = MODE_INFO[on.mode] || MODE_INFO.pvp;
  const isHost = on.role === 'host';
  const ready = Boolean(on.guest);
  const enemy = ENEMY_MAP[on.enemyId] || ENEMY_MAP['nightmare-dragon'] || ENEMIES[0];
  return `<div class="screen online-screen online-screen--room">
    <div class="page-glow" aria-hidden="true"></div>
    <div class="online-aurora" aria-hidden="true"><i></i><i></i><i></i></div>
    <header class="pagebar">
      <button type="button" class="pagebar__back" data-action="online-leave">${icon('left', 18)}<span>联机大厅</span></button>
      <div class="pagebar__title"><span>${mode.en} · ${isHost ? '房主' : '客人'}</span><strong>${mode.name}</strong></div>
      <div class="pagebar__actions">
        <span class="online-signal ${on.connected ? 'is-live' : ''}"><i></i>${formatLatency(on)}</span>
        ${topbarMuteButton()}
        <button type="button" class="icon-button" data-action="open-guide" title="玩法指南">${icon('help', 18)}</button>
      </div>
    </header>

    <main class="online-room">
      <section class="online-room__main">
        <div class="online-ticket">
          <span class="online-ticket__eyebrow">ROOM CODE · 房间码</span>
          <div class="online-code" aria-label="房间码 ${esc(on.code)}">
            ${[...on.code].map((char, index) => `<span style="--i:${index}">${esc(char)}</span>`).join('')}
          </div>
          <button type="button" class="text-button online-ticket__copy" data-action="online-copy-code">${icon('copy', 14)} 复制房间码</button>
          <p>把这串字符交给另一位执牌者。房间会在任何一人离开时关闭。</p>
          <span class="online-ticket__server">${icon('wifi', 13)} ${esc(G.profile.online.serverUrl || '')}</span>
        </div>

        <div class="online-room__versus">
          ${roomPlayer(on.host, '房主 · 先手', 'host')}
          <div class="online-room__thread" aria-hidden="true">
            <span></span>
            <strong>${ready ? '梦已相连' : '等待回声'}</strong>
            <i></i>
          </div>
          ${ready
            ? roomPlayer(on.guest, '客人 · 后手', 'guest')
            : `<div class="online-room-player online-room-player--empty">
                <span class="online-room-player__ring"></span>
                <span class="online-room-player__sigil">${icon('hourglass', 26)}</span>
                <div class="online-room-player__copy">
                  <small>等待另一位执牌者</small>
                  <strong>尚未入梦</strong>
                  <span>把房间码发给对方</span>
                </div>
                <span class="online-room-player__status online-room-player__status--waiting"><i></i> 空位</span>
              </div>`}
        </div>

        <div class="online-room__actions">
          ${isHost
            ? `<button type="button" class="button button--primary button--large" data-action="online-start" ${ready ? '' : 'disabled'}>
                ${icon('play', 17)} ${ready ? '翻开这场梦' : '等待另一位执牌者'}
              </button>`
            : `<button type="button" class="button button--large" disabled>${icon('hourglass', 17)} 等待房主开始</button>`}
          <button type="button" class="text-button text-button--danger" data-action="online-leave">${icon('left', 14)} 离开房间</button>
        </div>
        <p class="online-room__hint">${icon('eye', 13)} ${isHost ? '你掌握梦的裁定权。对方出牌后会由你的客户端结算并发回结果。' : '房主会同步每一次结算。战斗中的出牌与结束回合会有短暂往返。'}</p>
      </section>

      <aside class="online-room__side">
        <div class="online-room__side-block">
          <span class="section-eyebrow">THE RULES</span>
          <h2>${mode.name}</h2>
          <p>${mode.desc}</p>
          <span class="online-room__rule">${mode.rule}</span>
        </div>
        ${on.mode === 'coop' ? `<div class="online-room__enemy">
          <span class="online-room__enemy-art">${imageTag(enemy.image, enemy.image, enemy.name, '', false)}</span>
          <div><small>共梦之敌</small><strong>${esc(enemy.name)}</strong><span>${enemy.hp * 2} 生命 · ${esc(enemy.quote || '')}</span></div>
        </div>` : ''}
        <div class="online-room__side-block online-room__side-block--quiet">
          <span class="online-room__side-label">${icon('wifi', 13)} 连接状态</span>
          <div class="online-room__stats">
            <span><small>延迟</small><strong>${formatLatency(on)}</strong></span>
            <span><small>身份</small><strong>${isHost ? '房主' : '客人'}</strong></span>
          </div>
          <p>如果对方掉线，房间会结束。返回大厅后可以重新创建房间。</p>
        </div>
      </aside>
    </main>
  </div>`;
}

function pileCount(battle, side, pile) {
  const recorded = battle.counts?.[side]?.[pile];
  if (Number.isFinite(recorded)) return recorded;
  return battle.players[side]?.[`${pile}Pile`]?.length || 0;
}

function handBacks(count) {
  const shown = Math.max(0, Math.min(Number(count) || 0, 7));
  return `<span class="online-handbacks" title="对方手牌 ${count} 张">
    <span class="online-handbacks__stack">${Array.from({ length: shown }, (_, index) => `<i style="--i:${index}"></i>`).join('')}</span>
    <span class="online-handbacks__count">${count} 张手牌</span>
  </span>`;
}

function duelPanel(player, options = {}) {
  const origin = ORIGIN_MAP[player.originId] || ORIGINS[0];
  const isSelf = Boolean(options.isSelf);
  const isTurn = Boolean(options.isTurn);
  return `<section class="online-duel ${isSelf ? 'online-duel--self' : 'online-duel--foe'} ${isTurn ? 'is-turn' : ''} ${player.alive ? '' : 'is-fallen'}" style="--player:${safeColor(player.color)}">
    <span class="online-duel__halo"></span>
    <div class="online-duel__head">
      <span class="online-duel__sigil">${esc(player.sigil || origin.sigil)}</span>
      <div class="online-duel__identity">
        <small>${isSelf ? '你' : '对手'} · ${esc(player.title || origin.name)}</small>
        <strong>${esc(player.name)}</strong>
        <em>${esc(origin.epithet)}</em>
      </div>
      <span class="online-duel__hp">${icon('heart', 15)} <strong>${player.hp}</strong><small> / ${player.maxHp}</small></span>
    </div>
    ${progressBar(player.hp, player.maxHp, isSelf ? 'online-hp' : 'progress--enemy online-hp')}
    <div class="online-duel__combat">
      <span class="online-block ${player.block > 0 ? 'is-live' : ''}">${icon('shield', 13)} ${player.block || 0}</span>
      <span class="online-statuses">${statusPills(player.statuses) || `<span class="online-statuses__empty">没有状态</span>`}</span>
      ${player.resonance?.primary ? `<span class="online-resonance">${resonanceChip(player.resonance, { compact: true })}</span>` : ''}
      ${isSelf ? '' : `<span class="online-duel__handcount">${icon('cards', 13)} ${player.hand.length} 手牌</span>`}
    </div>
    ${isSelf ? '' : handBacks(player.hand.length)}
    ${player.alive ? '' : `<span class="online-fallen">已倒下</span>`}
  </section>`;
}

function partyPanel(player, side, battle, role) {
  const origin = ORIGIN_MAP[player.originId] || ORIGINS[0];
  const isSelf = side === role;
  const isTurn = battle.turn === side && battle.phase === 'active';
  return `<div class="online-party-card ${isSelf ? 'is-self' : ''} ${isTurn ? 'is-turn' : ''} ${player.alive ? '' : 'is-fallen'}" style="--player:${safeColor(player.color)}">
    <span class="online-party-card__sigil">${esc(player.sigil || origin.sigil)}</span>
    <div class="online-party-card__copy">
      <small>${isSelf ? '你' : '同伴'} · ${esc(player.title || origin.name)}</small>
      <strong>${esc(player.name)}</strong>
      ${progressBar(player.hp, player.maxHp, 'online-hp')}
      <div class="online-party-card__meta">
        <span>${icon('heart', 12)} ${player.hp}/${player.maxHp}</span>
        <span>${icon('shield', 12)} ${player.block || 0}</span>
        <span class="online-party-card__statuses">${statusPills(player.statuses)}</span>
      </div>
      ${player.resonance?.primary ? `<div class="online-party-card__resonance">${resonanceChip(player.resonance, { compact: true })}</div>` : ''}
    </div>
    ${isTurn ? '<span class="online-party-card__turn">行动中</span>' : ''}
  </div>`;
}

function enemyPanel(battle) {
  const enemy = battle.enemy;
  const intent = intentInfo(currentEnemyMove(battle));
  const phase = Number(enemy.phase) || 1;
  const phase2 = enemy.phase2;
  const phaseTitle = enemy.phaseTitle || phase2?.title;
  const phaseTwo = phase >= 2 && Boolean(phase2);
  const phaseAwake = phaseTwo && isPhaseArtRevealed(battle);
  const gauge = bossGaugeMarkup(battle, { className: 'boss-gauge--online' });
  const phaseImage = phaseAwake && phase2?.image ? phase2.image : enemy.image;
  const phaseStyle = phaseAwake ? `--phase-color:${safeColor(phase2?.color || '#e0945d')}` : '';
  return `<section class="online-nightmare ${phaseAwake ? 'is-phase-two' : ''} ${phaseAwake ? 'is-phase-two-awake' : ''}" style="--enemy:${safeColor(enemy.accent)};${phaseStyle}">
    <div class="online-nightmare__art">
      ${imageTag(phaseImage, ENEMY_MAP[enemy.defId]?.image || phaseImage, enemy.name, 'online-nightmare__image', false)}
      <span class="online-nightmare__veil"></span>
      <span class="online-nightmare__glyph">${esc(enemy.glyph)}</span>
      <span class="online-nightmare__stamp">双人梦魇</span>
      ${phaseAwake ? `<span class="online-nightmare__phase">${icon('flame', 11)} 真形 · ${esc(phaseTitle || '苏醒')}</span>` : ''}
    </div>
    <div class="online-nightmare__body">
      <span class="section-eyebrow">SHARED NIGHTMARE · 共同之敌</span>
      <div class="online-nightmare__title">
        <h2>${esc(enemy.name)}</h2>
        ${gauge ? '' : `<span class="online-duel__hp">${icon('heart', 15)} <strong>${enemy.hp}</strong><small> / ${enemy.maxHp}</small></span>`}
      </div>
      ${gauge || `<span class="progress progress--enemy online-hp ${phaseAwake ? 'is-phase-two' : ''}">
        <span class="progress__fill" style="width:${enemy.maxHp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0}%"></span>
      </span>`}
      <div class="online-nightmare__combat">
        <span class="online-block ${enemy.block > 0 ? 'is-live' : ''}">${icon('shield', 13)} ${enemy.block || 0}</span>
        <span class="online-statuses">${statusPills(enemy.statuses) || '<span class="online-statuses__empty">没有状态</span>'}</span>
      </div>
      <div class="online-intent" title="${esc(intent.detail)}">
        <span class="online-intent__icon">${icon(intent.icon, 20)}</span>
        <span><small>下个意图</small><strong>${esc(intent.title)}</strong><em>${esc(intent.summary)}</em></span>
      </div>
    </div>
  </section>`;
}

function turnCopy(on) {
  const battle = on.battle;
  if (!battle) return { title: '等待梦境', note: '' };
  if (battle.phase !== 'active') return { title: '梦已落幕', note: '看看这段梦留下了什么。' };
  if (on.pending) return { title: '房主正在结算…', note: '你的出牌已经送往梦的另一端。' };
  if (battle.turn === on.role) {
    return {
      title: '轮到你了',
      note: battle.mode === 'coop' ? '与同伴轮流行动，打出牌或结束回合。' : '打出任意数量的牌，然后结束回合。',
    };
  }
  const other = battle.players[battle.turn];
  return {
    title: `等待 ${other?.name || '对方'}`,
    note: battle.mode === 'coop' ? '梦魇会在同伴结束回合后行动。' : '对方正在选择自己的下一张牌。',
  };
}

function renderLog(battle) {
  const logs = battle.log.slice(-8).reverse();
  if (!logs.length) return '<p class="online-log__empty">梦还没有开口。</p>';
  return logs.map((entry, index) => `<div class="online-log__line online-log__line--${esc(entry.type)} ${index === 0 ? 'is-latest' : ''}">
    <span class="online-log__mark"></span><span>${esc(entry.text)}</span>
  </div>`).join('');
}

function renderHand(on) {
  const battle = on.battle;
  const me = battle.players[on.role];
  if (!me?.hand.length) {
    return `<div class="hand-empty">${icon('cards', 24)}<span>手中无牌。结束回合，等待下一次抽牌。</span></div>`;
  }
  const active = battle.phase === 'active' && battle.turn === on.role && !on.pending;
  return me.hand.map((instance, index) => {
    const base = getCardDef(instance.defId);
    const card = base ? resolveCard(base, instance.upgraded) : null;
    if (!card) return '';
    const unaffordable = card.cost > me.energy;
    return cardMarkup(card, {
      action: 'online-play',
      attrs: `data-uid="${esc(instance.uid)}" data-hand-index="${index}" ${active && !unaffordable ? '' : 'disabled'}`,
      unaffordable,
      disabled: !active || unaffordable,
      className: 'hand-card online-hand-card',
    });
  }).join('');
}

function renderResult(on) {
  const battle = on.battle;
  if (!battle || battle.phase === 'active') return '';
  const isHost = on.role === 'host';
  const winner = battle.winner;
  let victory = false;
  let title = '';
  let eyebrow = '';
  let lead = '';
  let emblem = 'crown';
  let tone = 'victory';
  if (battle.mode === 'coop') {
    victory = winner === 'players';
    tone = victory ? 'victory' : 'defeat';
    title = victory ? '共梦成功' : '梦魇吞没了梦';
    eyebrow = victory ? 'THE NIGHTMARE FALLS' : 'THE DREAM SWALLOWS YOU';
    emblem = victory ? 'sparkles' : 'skull';
    lead = victory
      ? `你与${isHost ? battle.players.guest.name : battle.players.host.name}一起走到了梦的尽头。两个人的名字都被这座岛记住了。`
      : '最后一位执牌者也倒下了。梦魇仍在，但房间还在，你们可以再试一次。';
  } else if (winner === 'draw') {
    tone = 'defeat';
    title = '同时醒来';
    eyebrow = 'NO ONE STANDS';
    emblem = 'hourglass';
    lead = '两道身影同时倒下。梦境没有给出胜者，只留下一张被撕成两半的牌。';
  } else {
    victory = winner === on.role;
    tone = victory ? 'victory' : 'defeat';
    const winnerName = battle.players[winner]?.name || '对方';
    title = victory ? '你站在梦的中央' : '梦选择了对方';
    eyebrow = victory ? 'THE MIRROR BENDS TO YOU' : 'THE MIRROR LOOKS AWAY';
    emblem = victory ? 'crown' : 'skull';
    lead = victory
      ? `你比${battle.players[winner === 'host' ? 'guest' : 'host']?.name || '对手'}更早一步醒来。梦境把最后一束光留在了你的牌上。`
      : `${winnerName}比你先一步醒来。牌面已经合上，但同一副梦还可以再洗一次。`;
  }
  const hostStats = battle.players.host;
  const guestStats = battle.players.guest;
  const rematchLabel = isHost ? '再来一局' : (on.rematchRequested ? '已发出请求' : '请求再来一局');
  return `<div class="battle-overlay battle-overlay--${tone} online-result-overlay">
    <div class="result-panel ${tone === 'defeat' ? 'result-panel--defeat' : ''} online-result">
      <span class="result-emblem">${icon(emblem, 34)}</span>
      <span class="result-eyebrow">${eyebrow}</span>
      <h2>${title}</h2>
      <p class="result-lead">${esc(lead)}</p>
      <div class="result-stats">
        <span>${icon('heart', 15)} ${hostStats.name} ${hostStats.hp}/${hostStats.maxHp}</span>
        <span>${icon('heart', 15)} ${guestStats.name} ${guestStats.hp}/${guestStats.maxHp}</span>
        <span>${icon('rotate', 15)} ${Math.max(1, battle.round)} 回合</span>
        <span>${icon('cards', 15)} ${hostStats.cardsPlayed + guestStats.cardsPlayed} 张牌</span>
      </div>
      <div class="result-actions">
        <button type="button" class="button button--primary" data-action="online-rematch" ${!isHost && on.rematchRequested ? 'disabled' : ''}>${icon('rotate', 16)} ${rematchLabel}</button>
        <button type="button" class="button button--ghost" data-action="online-leave">${icon('home', 16)} 返回联机大厅</button>
      </div>
      ${on.rematchRequested && isHost ? `<p class="online-result__note">${icon('users', 13)} ${esc(on.guest?.name || '对方')} 正在等你再开一局。</p>` : ''}
      ${on.rematchRequested && !isHost ? `<p class="online-result__note">${icon('hourglass', 13)} 已告诉房主你想再来一局。</p>` : ''}
      <p class="result-footnote">房间 ${esc(on.code)} · ${modeLabel(battle.mode)} · 房主裁定</p>
    </div>
  </div>`;
}

function renderBattle(on) {
  const battle = on.battle;
  const me = battle.players[on.role] || battle.players.host;
  const otherSide = on.role === 'host' ? 'guest' : 'host';
  const other = battle.players[otherSide];
  const myTurn = battle.phase === 'active' && battle.turn === on.role && !on.pending;
  const copy = turnCopy(on);
  const mode = MODE_INFO[battle.mode] || MODE_INFO.pvp;
  return `<div class="screen online-screen online-screen--battle" style="--online-accent:${safeColor(me.color)}">
    <div class="page-glow" aria-hidden="true"></div>
    <header class="pagebar online-battle-bar">
      <button type="button" class="pagebar__back" data-action="online-exit">${icon('left', 18)}<span>离开</span></button>
      <div class="pagebar__title"><span>${mode.en} · 房间 ${esc(on.code)}</span><strong>${mode.name}</strong></div>
      <div class="pagebar__actions">
        <span class="online-signal ${on.connected ? 'is-live' : ''}"><i></i>${on.pending ? '结算中' : formatLatency(on)}</span>
        ${topbarMuteButton()}
        <button type="button" class="icon-button" data-action="open-guide" title="玩法指南">${icon('help', 18)}</button>
      </div>
    </header>

    <main class="online-battle">
      <section class="online-battle__arena">
        <div class="online-battle__foe">
          ${battle.mode === 'coop' ? enemyPanel(battle) : duelPanel(other, { isSelf: false, isTurn: battle.turn === otherSide && battle.phase === 'active' })}
        </div>
        <div class="online-turnline ${myTurn ? 'is-mine' : ''} ${on.pending ? 'is-pending' : ''}">
          <span class="online-turnline__thread" aria-hidden="true"></span>
          <span class="online-turnline__round"><small>ROUND</small><strong>${Math.max(1, battle.round)}</strong></span>
          <span class="online-turnline__copy">
            <strong>${esc(copy.title)}</strong>
            <em>${esc(copy.note)}</em>
          </span>
          ${on.pending ? '<span class="online-turnline__pulse"><i></i><i></i><i></i></span>' : ''}
        </div>
        ${battle.mode === 'coop'
          ? `<div class="online-party">${partyPanel(battle.players.host, 'host', battle, on.role)}${partyPanel(battle.players.guest, 'guest', battle, on.role)}</div>`
          : `<div class="online-battle__self">${duelPanel(me, { isSelf: true, isTurn: myTurn })}</div>`}
      </section>

      <aside class="online-battle__aside">
        <div class="online-room-chip">
          <span>${icon('link', 13)} 房间 <strong>${esc(on.code)}</strong></span>
          <span class="online-signal ${on.connected ? 'is-live' : ''}"><i></i>${on.connected ? '同步中' : '已断开'}</span>
        </div>
        <div class="online-log">
          <span class="online-log__title">${icon('scroll', 13)} 梦的回声</span>
          <div class="online-log__lines">${renderLog(battle)}</div>
        </div>
        <button type="button" class="text-button text-button--danger online-battle__leave" data-action="online-exit">${icon('left', 14)} 离开这场梦</button>
        <p class="online-battle__footnote">房主客户端裁定每一次出牌<br>${esc(G.profile.online.serverUrl || '')}</p>
      </aside>

      <section class="online-handbar">
        <div class="online-handbar__energy">
          <div class="energy-orb" title="本回合可用能量">
            <span class="energy-orb__value">${me.energy}</span>
            <span class="energy-orb__max">/ ${me.maxEnergy}</span>
            <span class="energy-orb__label">能量</span>
          </div>
          <div class="pile-counts">
            <span title="抽牌堆">${icon('cards', 14)} <strong>${pileCount(battle, on.role, 'draw')}</strong><small>抽牌</small></span>
            <span title="弃牌堆">${icon('rotate', 14)} <strong>${pileCount(battle, on.role, 'discard')}</strong><small>弃牌</small></span>
            <span title="消耗堆">${icon('flame', 14)} <strong>${pileCount(battle, on.role, 'exhaust')}</strong><small>消耗</small></span>
          </div>
        </div>
        <div class="online-handbar__hand">
          <div class="hand-scroll">
            <div class="hand">${renderHand(on)}</div>
          </div>
        </div>
        <div class="online-handbar__side">
          <span class="online-handbar__turn">${myTurn ? '你的回合' : esc(copy.title)}</span>
          <button type="button" class="end-turn" data-action="online-end" ${myTurn ? '' : 'disabled'}>
            <span>${on.pending ? '结算中' : '结束回合'}<small>E</small></span>
            ${icon('right', 20)}
          </button>
          <span class="online-handbar__hint">${icon('help', 12)} <kbd>1</kbd>–<kbd>9</kbd> 出牌 · <kbd>E</kbd> 结束</span>
        </div>
      </section>
    </main>
    ${renderResult(on)}
  </div>`;
}

export function renderOnline() {
  const on = getOnline();
  if (on.status === 'waiting' || on.status === 'ready') return renderRoom(on);
  if (on.status === 'battle' && on.battle) return renderBattle(on);
  return renderLobby(on);
}
