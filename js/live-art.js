import { esc } from './utils.js';

/**
 * 活画层：把一张 AI 静图包成「会呼吸的立绘」。
 * 纯 CSS 负责动势，这里只负责：
 *  1. 生成分层结构（底图 / 光晕 / 浮尘 / 扫光 / 内描边，可选视频）
 *  2. 让视频只在可见时播放，避免整屏同时解码
 */

const MOTE_COUNT = 5;

function seedOf(text) {
  let hash = 2166136261;
  const source = String(text || '');
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rngFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function moteMarkup(seed) {
  const rng = rngFrom(seedOf(seed));
  let markup = '';
  for (let i = 0; i < MOTE_COUNT; i += 1) {
    const x = (6 + rng() * 88).toFixed(1);
    const size = (1.8 + rng() * 3.2).toFixed(1);
    const duration = (8 + rng() * 7);
    const delay = (-rng() * duration).toFixed(1);
    const drift = ((rng() - 0.5) * 46).toFixed(0);
    const peak = (0.26 + rng() * 0.42).toFixed(2);
    markup += `<i style="--x:${x}%;--s:${size}px;--dur:${duration.toFixed(1)}s;--delay:${delay}s;--drift:${drift}px;--peak:${peak}"></i>`;
  }
  return markup;
}

function videoType(src) {
  if (/\.webm(\?|$)/i.test(src)) return 'video/webm';
  if (/\.mov(\?|$)/i.test(src)) return 'video/quicktime';
  return 'video/mp4';
}

/**
 * @param {string} src 静图地址（AI 图或用户上传图）
 * @param {object} [options]
 * @param {string} [options.className] 追加到根节点的类名
 * @param {string} [options.alt]
 * @param {boolean} [options.upgraded] 是否为强化态
 * @param {string} [options.video] 可选动态循环视频地址
 * @param {string} [options.seed] 浮尘随机种子
 * @param {'card'|'portrait'|'hero'} [options.variant]
 * @param {number} [options.motes]
 */
export function liveArt(src, options = {}) {
  if (!src) return '';
  const {
    className = '',
    alt = '',
    upgraded = false,
    video = '',
    seed = src,
    variant = 'card',
    motes = MOTE_COUNT,
  } = options;
  const classes = [
    'live-art',
    variant !== 'card' ? `live-art--${variant}` : '',
    upgraded ? 'is-upgraded' : '',
    video ? 'has-video' : '',
    className,
  ].filter(Boolean).join(' ');
  const safeSrc = esc(src);
  const videoMarkup = video
    ? `<video class="live-art__video" data-live-video muted loop playsinline preload="none" poster="${safeSrc}" aria-hidden="true"><source src="${esc(video)}" type="${videoType(video)}"></video>`
    : '';
  const moteList = motes > 0 ? moteMarkup(seed) : '';
  return `<span class="${classes}" data-live-art="${variant}">
      <img class="live-art__base" src="${safeSrc}" alt="${esc(alt)}" draggable="false" decoding="async" loading="lazy">
      <img class="live-art__bloom" src="${safeSrc}" alt="" aria-hidden="true" draggable="false" decoding="async" loading="lazy">
      ${videoMarkup}
      ${moteList ? `<span class="live-art__motes" aria-hidden="true">${moteList}</span>` : ''}
      <span class="live-art__sweep" aria-hidden="true"></span>
      <span class="live-art__rim" aria-hidden="true"></span>
    </span>`;
}

/** 战斗立绘 / 详情大图：纵向构图的活画层 */
export function portraitArt(src, alt = '', fallback = '') {
  const source = src || fallback;
  if (!source) return '';
  return liveArt(source, {
    className: 'actor-portal__image',
    variant: 'portrait',
    alt,
    seed: source,
  });
}

let started = false;
const watched = new WeakSet();
let observer = null;

function playAll() {
  document.querySelectorAll('[data-live-video]').forEach((video) => {
    if (observer) observer.observe(video);
  });
}

/**
 * 全局只初始化一次：视频进出视野时自动播放 / 暂停。
 * @param {Document|HTMLElement} [root]
 */
export function initLiveArt(root = document) {
  if (started) {
    playAll();
    return;
  }
  started = true;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target;
      if (entry.isIntersecting && !reduce?.matches && !document.hidden) {
        video.play?.().catch(() => {});
      } else {
        video.pause?.();
      }
    }
  }, { threshold: 0.35 });

  const scan = (node) => {
    if (!(node instanceof Element)) return;
    const found = [];
    if (node.matches('[data-live-video]')) found.push(node);
    node.querySelectorAll?.('[data-live-video]').forEach((item) => found.push(item));
    for (const video of found) {
      if (watched.has(video)) continue;
      watched.add(video);
      observer.observe(video);
    }
  };

  scan(root === document ? document.body : root);
  const mutation = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) scan(node);
      }
    }
  });
  mutation.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.querySelectorAll('[data-live-video]').forEach((video) => video.pause?.());
    } else {
      playAll();
    }
  });

  // 用户切到「减少动效」时停掉所有视频
  reduce?.addEventListener?.('change', () => {
    if (reduce.matches) document.querySelectorAll('[data-live-video]').forEach((video) => video.pause?.());
    else playAll();
  });
}
