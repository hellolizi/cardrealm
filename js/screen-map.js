import { NODE_META, ORIGIN_MAP, ORIGINS, RELIC_MAP } from './data.js';
import { MAX_CONTRACTS, contractList, contractPrice } from './contracts.js';
import { getAvailableNodes, runResonance } from './engine.js';
import { REGION_MAP, REGIONS } from './lore.js';
import { G, getHeroAvatar, getHeroName } from './state.js';
import {
  imageTag,
  progressBar,
  relicChip,
  resonancePanel,
  topbarMuteButton,
} from './ui-common.js';
import { esc, icon, safeColor } from './utils.js';

const COLUMNS = { 0: 20, 1: 50, 2: 80 };

function nodePosition(node, layerCount = 7) {
  if (node?.pos) return node.pos;
  const depth = Math.max(1, layerCount - 1);
  return {
    x: node.type === 'boss' ? 50 : COLUMNS[node.col] || 50,
    y: 90 - (node.layer / depth) * 80,
  };
}

function nodeMarkup(run, node, availableIds, layerCount, options = {}) {
  const meta = NODE_META[node.type];
  const fogged = Boolean(options.fogged);
  const isAvailable = availableIds.has(node.id);
  const isCompleted = run.completed.includes(node.id);
  const isCurrent = run.currentNodeId === node.id;
  const classes = [
    'map-node',
    `map-node--${node.type}`,
    isAvailable ? 'is-available' : '',
    isCompleted ? 'is-completed' : '',
    isCurrent ? 'is-current' : '',
    fogged ? 'is-fogged' : '',
    !isAvailable && !isCompleted ? 'is-locked' : '',
  ].filter(Boolean).join(' ');
  const { x, y } = nodePosition(node, layerCount);
  const detail = fogged
    ? '雾里看不清楚，走近了才知道。'
    : isCompleted
      ? '这段梦境已经走过'
      : isAvailable
        ? `${meta.desc} 点击进入。`
        : '尚未与你的路径相连';
  return `<button type="button" class="${classes}" data-action="map-node" data-id="${esc(node.id)}" style="left:${x}%;top:${y}%;--node:${safeColor(meta.color)}" title="${esc(`${meta.name}：${detail}`)}" aria-label="${esc(`${meta.name}，${detail}`)}" ${fogged ? 'aria-disabled="true" tabindex="-1"' : ''}>
    <span class="map-node__halo"></span>
    <span class="map-node__disc">
      ${fogged ? icon('eye', 18) : isCompleted ? icon('check', 20) : icon(meta.icon, node.type === 'boss' ? 28 : 21)}
      ${isCurrent ? '<span class="map-node__you">你</span>' : ''}
    </span>
    <span class="map-node__label">${fogged ? '？' : esc(meta.name)}</span>
    ${isAvailable && !fogged ? '<span class="map-node__pulse"></span>' : ''}
  </button>`;
}

function routesMarkup(run, availableIds, layerCount) {
  const paths = [];
  const seen = new Set();
  const byId = new Map(run.map.flat().map((node) => [node.id, node]));
  for (const layer of run.map) {
    for (const node of layer) {
      const from = nodePosition(node, layerCount);
      for (const targetId of node.next) {
        const target = byId.get(targetId);
        if (!target) continue;
        // 环形/钟面会互相指回，同一根线只画一次
        const key = node.id < target.id ? `${node.id}|${target.id}` : `${target.id}|${node.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const to = nodePosition(target, layerCount);
        const walked = run.completed.includes(node.id) && run.completed.includes(target.id);
        const open = node.id === run.currentNodeId && availableIds.has(target.id);
        const straight = Math.abs(from.y - to.y) < 3 || Math.abs(from.y - to.y) > 60;
        const d = straight
          ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
          : `M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2}, ${to.x} ${(from.y + to.y) / 2}, ${to.x} ${to.y}`;
        paths.push(`<path class="map-route ${walked ? 'is-walked' : ''} ${open ? 'is-open' : ''}" d="${d}" vector-effect="non-scaling-stroke"/>`);
      }
    }
  }
  return paths.join('');
}

export function renderMap() {
  const run = G.run;
  if (!run) return '';
  const origin = ORIGIN_MAP[run.originId] || ORIGINS[0];
  const region = REGION_MAP[run.regionId] || REGIONS[0];
  const layers = run.map.length || 6;
  const available = getAvailableNodes(run);
  const availableIds = new Set(available.map((node) => node.id));
  const shape = region.shape || 'climb';
  // 雾隐岛：只让相邻一层可见，其余全是雾
  const visibleLayers = new Set([0, layers - 1]);
  for (const layer of run.map) {
    for (const node of layer) {
      if (availableIds.has(node.id) || run.completed.includes(node.id)) visibleLayers.add(node.layer);
    }
  }
  const foggedIds = new Set();
  if (shape === 'fog') {
    for (const layer of run.map) {
      for (const node of layer) {
        if (node.type === 'boss') continue;
        if (!visibleLayers.has(node.layer) && !availableIds.has(node.id)) foggedIds.add(node.id);
      }
    }
  }
  const relicMarkup = run.relics.length
    ? run.relics.map((relicId) => relicChip(RELIC_MAP[relicId], { compact: false })).join('')
    : '<span class="run-rail__empty">尚未拾得遗物</span>';
  const allNodes = run.map.flat();
  const bossNode = allNodes.find((node) => node.type === 'boss');
  const availableNames = available.map((node) => (foggedIds.has(node.id) ? '一片雾' : NODE_META[node.type].name)).join(' / ');
  const resonance = runResonance(run);
  const boardModifier = shape === 'ring' || shape === 'clock' ? 'is-loop' : '';
  const mutations = Array.isArray(run.dreamMutations) ? run.dreamMutations : [];
  const contracts = contractList(run.contracts || []);
  const shards = Number(G.profile.shards) || 0;
  const nextContractPrice = contractPrice(contracts.length);
  const contractsFull = contracts.length >= MAX_CONTRACTS;
  const contractMarkup = contracts.length
    ? contracts.map((contract) => `<span class="contract-chip" style="--contract:${safeColor(contract.color)}" title="${esc(`${contract.name}：${contract.desc}`)}"><b>${esc(contract.glyph)}</b>${esc(contract.name)}</span>`).join('')
    : '<span class="run-rail__empty">尚未与梦立约</span>';
  const scars = Array.isArray(run.scars) ? run.scars : [];
  const scarTotal = scars.reduce((sum, scar) => sum + (Number(scar.hpCost) || 0), 0);
  const scarMarkup = scars.length
    ? `<div class="run-rail__scars">
        <span class="run-rail__section-label">梦痕 · 生命上限 -${scarTotal}</span>
        <div class="scar-list">
          ${scars.slice(-4).map((scar) => {
            const place = scar.regionName || '梦境的裂隙';
            const turn = Math.max(1, Number(scar.turn) || 1);
            const enemy = scar.enemyName || '梦魇';
            return `<span class="scar-chip" title="${esc(`借气：在${place}第 ${turn} 回合对抗${enemy}时向梦借气，生命上限 -${scar.hpCost || 5}。`)}"><b>${icon('heart', 11)}-${scar.hpCost || 5}</b><span>${esc(place)} · 第 ${turn} 回合</span></span>`;
          }).join('')}
          ${scars.length > 4 ? `<span class="scar-chip scar-chip--more" title="${esc(`另有 ${scars.length - 4} 道梦痕已刻在更早的梦里。`)}">+${scars.length - 4}</span>` : ''}
        </div>
      </div>`
    : '';
  const altarButtonLabel = contractsFull
    ? '查看契约'
    : shards >= nextContractPrice
      ? '走上祭坛'
      : `${nextContractPrice} 碎片起誓`;

  return `<div class="screen map-screen">
    <div class="page-glow page-glow--map" aria-hidden="true"></div>
    <header class="pagebar pagebar--map">
      <button type="button" class="pagebar__back" data-action="map-abandon">${icon('left', 18)}<span>离开梦境</span></button>
      <div class="pagebar__title"><span>${esc(region.episode)} · ${esc(region.name)}</span><strong>梦境地图</strong></div>
      <div class="pagebar__actions">
        <span class="header-resource">${icon('coin', 16)} <strong>${run.gold}</strong></span>
        <span class="header-resource header-resource--hp">${icon('heart', 16)} <strong>${run.hp}</strong><small>/${run.maxHp}</small></span>
        ${topbarMuteButton()}
      </div>
    </header>

    <main class="map-layout">
      <aside class="run-rail">
        <div class="run-rail__hero">
          <span class="run-rail__portrait" style="--origin-color:${safeColor(origin.color)}">
            ${imageTag(getHeroAvatar(), 'assets/heroes/default.webp', getHeroName(), '', false)}
            <span class="run-rail__sigil">${esc(origin.sigil)}</span>
          </span>
          <div class="run-rail__name"><small>${esc(origin.name)}</small><strong>${esc(getHeroName())}</strong></div>
        </div>
        <div class="run-rail__vitals">
          <div class="run-rail__vital-label"><span>生命</span><strong>${run.hp} <small>/ ${run.maxHp}</small></strong></div>
          ${progressBar(run.hp, run.maxHp)}
        </div>
        <div class="run-rail__stats">
          <div><span>金币</span><strong>${run.gold}</strong></div>
          <div><span>牌组</span><strong>${run.deck.length}</strong></div>
          <div><span>已行</span><strong>${run.completed.length}</strong></div>
        </div>
        ${scarMarkup}
        <button type="button" class="run-seed" data-action="copy-seed" title="复制这次远征的种子">
          ${icon('dice', 14)}
          <span><small>梦境种子</small><strong>${esc(run.seed)}</strong></span>
          ${icon('copy', 13)}
        </button>
        <button type="button" class="run-rail__deck" data-action="view-run-deck">
          ${icon('cards', 18)}
          <span><strong>查看牌组</strong><small>共 ${run.deck.length} 张</small></span>
          ${icon('right', 16)}
        </button>
        ${resonancePanel(resonance, { className: 'run-rail__resonance', eyebrow: '流派共鸣' })}
        <div class="run-rail__relics">
          <span class="run-rail__section-label">遗物</span>
          <div class="relic-list">${relicMarkup}</div>
        </div>
        <div class="run-rail__contracts">
          <span class="run-rail__section-label">梦呓契约</span>
          <div class="contract-list">${contractMarkup}</div>
        </div>
        ${scarMarkup}
        <div class="run-rail__abandon">
          <button type="button" class="run-rail__sail" data-action="map-sail-home">
            ${icon('map', 15)}
            <span><strong>收帆回港</strong><small>带走已得的牌与金币，这座岛不算踏平</small></span>
          </button>
          <button type="button" class="text-button text-button--muted" data-action="map-abandon">${icon('close', 14)} 放弃这次旅程</button>
        </div>
      </aside>

      <section class="map-panel">
        <div class="map-panel__head">
          <div>
            <span class="section-eyebrow">${esc(region.name)} · ${esc(region.epithet)}</span>
            <h1>${esc(region.name)}${run.endless ? ` · 第 ${Number(run.depth) || 1} 层` : ''}，选择下一段梦</h1>
            ${run.endless ? `<div class="map-endless-chips">
              <span class="map-endless-chips__layer">${icon('flame', 12)} 已平 ${Number(run.endlessCleared) || 0} 层</span>
              ${(run.endlessAffixes || []).map((affix) => `<span class="map-endless-chips__affix" title="${esc(affix.desc)}">${esc(affix.name)}</span>`).join('')}
            </div>` : ''}
            <p>${available.length ? `前方可见：${esc(availableNames)}。每条路径都不会回头。` : '回廊尽头，似乎有什么正在醒来。'}</p>
          </div>
          <div class="map-progress">
            <span>梦境深度</span>
            <strong>${String(run.completed.length).padStart(2, '0')}<small>/${String(layers).padStart(2, '0')}</small></strong>
          </div>
        </div>
        <div class="map-boon">
          <span class="map-boon__sigil">${esc(region.sigil)}</span>
          <span class="map-boon__copy"><small>岛屿馈赠 · ${esc(region.boonName)}</small>${esc(region.boon)}</span>
        </div>
        ${mutations.length ? `<div class="map-mutations">
          <div class="map-mutations__head">
            <span class="map-mutations__tag">${icon('sparkles', 13)} 梦境变奏</span>
            <small>这一岛，梦换了一种说法 · 收益与代价同时生效</small>
          </div>
          <div class="map-mutations__list">
            ${mutations.map((mutation) => `<article class="mutation-card" style="--mutation:${safeColor(mutation.color)}">
              <span class="mutation-card__glyph">${esc(mutation.glyph)}</span>
              <div class="mutation-card__copy"><strong>${esc(mutation.name)}</strong><p>${esc(mutation.desc)}</p></div>
            </article>`).join('')}
          </div>
        </div>` : ''}
        <div class="map-altar ${contracts.length ? 'has-contracts' : ''} ${contractsFull ? 'is-full' : ''}" style="${contracts[0] ? `--contract:${safeColor(contracts[0].color)}` : ''}">
          <span class="map-altar__sigil">${icon('scroll', 19)}</span>
          <div class="map-altar__copy">
            <small>梦呓祭坛 · <b>${shards}</b> 梦的碎片</small>
            <strong>${contracts.length ? contracts.map((contract) => esc(contract.name)).join(' · ') : '梦在等你开价'}</strong>
            <p>${contractsFull
              ? '两份契约已经写满这一趟梦。撕毁不退还碎片，但祭坛仍会听你再说一次。'
              : contracts.length
                ? `再签一份要 ${nextContractPrice} 片。契约只在这一趟梦里生效，收益与代价同时落下。`
                : `花 ${nextContractPrice} 片签下一条规则。最多两份，碎片不退还，契约只在这一趟梦里生效。`}</p>
          </div>
          <button type="button" class="button button--ghost map-altar__button" data-action="open-contracts">${icon('scroll', 14)} ${altarButtonLabel}</button>
        </div>
        ${region.shapeName ? `<div class="map-shape">
          <span class="map-shape__tag">${icon('map', 13)} ${esc(region.shapeName)}</span>
          <p>${esc(region.shapeRule || '')}</p>
          ${region.memory ? `<p class="map-shape__memory">第 ${region.order} 层 · 这是<strong>${esc(region.memory.who)}</strong>记住的那一夜：${esc(region.memory.line)}</p>` : ''}
        </div>` : ''}
        <div class="map-board ${boardModifier}" style="--map-layers:${layers}">
          <span class="map-board__moon" aria-hidden="true"></span>
          <span class="map-board__fog map-board__fog--one" aria-hidden="true"></span>
          <span class="map-board__fog map-board__fog--two" aria-hidden="true"></span>
          <svg class="map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            ${routesMarkup(run, availableIds, layers)}
          </svg>
          ${allNodes.map((node) => nodeMarkup(run, node, availableIds, layers, { fogged: foggedIds.has(node.id) })).join('')}
          ${shape === 'climb' || shape === 'fog' || shape === 'page' ? '<div class="map-board__start">扉页</div>' : ''}
          <div class="map-board__boss-label" style="left:${(bossNode?.pos?.x ?? 50)}%;top:${(bossNode?.pos?.y ?? 10) - 6}%">${icon('crown', 14)} 梦魇之巅</div>
        </div>
        <div class="map-legend">
          <span><i class="legend-dot legend-dot--battle"></i>战斗</span>
          <span><i class="legend-dot legend-dot--elite"></i>精英</span>
          <span><i class="legend-dot legend-dot--event"></i>奇遇</span>
          <span><i class="legend-dot legend-dot--camp"></i>营火</span>
          <span><i class="legend-dot legend-dot--shop"></i>行商</span>
          <span><i class="legend-dot legend-dot--treasure"></i>宝藏</span>
          <span class="map-legend__tip">${icon('arrowUp', 14)} ${['ring', 'clock'].includes(shape) ? '可以往前走，也可以回头' : '点击发光的节点前进'}</span>
        </div>
      </section>
    </main>
  </div>`;
}
