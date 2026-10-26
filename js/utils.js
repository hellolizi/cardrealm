import { describeEffects, RARITY_INFO, SCHOOLS, TYPE_INFO } from './data.js';

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function safeColor(value, fallback = '#c2a46d') {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(value || '')) ? value : fallback;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

let rngState = 0;
let seeded = false;

export function hashSeed(value) {
  let hash = 2166136261 >>> 0;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function setRngSeed(seed) {
  rngState = hashSeed(seed);
  seeded = true;
}

export function getRngState() {
  return seeded ? rngState >>> 0 : null;
}

export function setRngState(state) {
  const value = Number(state);
  if (!Number.isFinite(value)) return;
  rngState = value >>> 0;
  seeded = true;
}

export function clearRngSeed() {
  seeded = false;
  rngState = 0;
}

export function rand() {
  if (!seeded) return Math.random();
  rngState = (rngState + 0x6D2B79F5) >>> 0;
  let value = rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function pick(array) {
  return array[Math.floor(rand() * array.length)];
}

export function pickMany(array, count) {
  return shuffle(array).slice(0, count);
}

export function randomInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function weightedPick(items, weightKey = 'weight') {
  const total = items.reduce((sum, item) => sum + item[weightKey], 0);
  let roll = rand() * total;
  for (const item of items) {
    roll -= item[weightKey];
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export const ICON_PATHS = {
  sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>',
  heart: '<path d="M19 14c1.5-1.5 2-3.4 2-5a4.5 4.5 0 0 0-9-1 4.5 4.5 0 0 0-9 1c0 1.6.5 3.5 2 5l7 7Z"/>',
  bolt: '<path d="M4 14a1 1 0 0 1-.8-1.6l9-11A1 1 0 0 1 14 2v7h5a1 1 0 0 1 .8 1.6l-9 11A1 1 0 0 1 9 21v-7Z"/>',
  cards: '<rect width="10" height="14" x="4" y="6" rx="2"/><path d="M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="m9 10 2-2 2 2-2 2Z"/>',
  eye: '<path d="M2.1 12.3a1 1 0 0 1 0-.6 10.8 10.8 0 0 1 19.8 0 1 1 0 0 1 0 .6 10.8 10.8 0 0 1-19.8 0"/><circle cx="12" cy="12" r="3"/>',
  skull: '<path d="m12.5 17-.5-1-.5 1a1 1 0 0 0 1 0"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.6-1.4l.2-.8A8 8 0 1 0 6 15l.2.8A2 2 0 0 0 8 17.5V21a1 1 0 0 0 1 1Z"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>',
  up: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.4-4.6 1.6-6.1A7 7 0 0 1 20 14a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3.5.5.8 1 1.5 1.5 4Z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5 1.3 2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5"/>',
  chest: '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 11h18"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M12 11v3"/>',
  crown: '<path d="M2 18h20l-1.5-9-5 3L12 5 8.5 12l-5-3Z"/><path d="M5 22h14"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  waveform: '<path d="M2 12h2"/><path d="M6 8v8"/><path d="M10 5v14"/><path d="M14 9v6"/><path d="M18 7v10"/><path d="M22 11v2"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 9v11h5v-7h4v7h5V9"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  wand: '<path d="m21 3-9 9"/><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.5 6.5 19 8"/><path d="M3 21l9-9"/><path d="m12.5 8.5 3 3"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22"/><path d="M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>',
  scroll: '<path d="M8 3h10a2 2 0 0 1 2 2v13a3 3 0 0 0 3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 0-2-2h2Z"/><path d="M9 7h7"/><path d="M9 11h7"/><path d="M9 15h5"/>',
  dice: '<rect width="18" height="18" x="3" y="3" rx="3"/><circle cx="8" cy="8" r=".8" fill="currentColor"/><circle cx="16" cy="16" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>',
  wifiOff: '<path d="M12 20h.01"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M5 12.55a11 11 0 0 1 4.5-2.6"/><path d="M16.5 9.5c1.8.4 3.4 1.4 4.6 2.6"/><path d="m2 2 20 20"/><path d="M1.42 9a16 16 0 0 1 5-2.9"/><path d="M14 5.6a16 16 0 0 1 8.58 3.4"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  drop: '<path d="M12 2.7 6.7 8a7.5 7.5 0 1 0 10.6 0L12 2.7Z"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/>',
  typography: '<path d="M4 7V6h16v1"/><path d="M12 6v14"/><path d="M9 20h6"/>',
};

export function icon(name, size = 18, className = '') {
  const path = ICON_PATHS[name] || ICON_PATHS.sparkles;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function cardAccent(card) {
  if (card.palette) {
    const found = card.palette;
    return safeColor(found);
  }
  const school = SCHOOLS[card.school];
  if (school) return safeColor(school.color);
  return TYPE_INFO[card.type]?.color || '#c2a46d';
}

export function getCardUpgrade(effects = []) {
  return effects.map((effect) => {
    const upgraded = { ...effect };
    if (effect.type === 'damage') {
      const hits = Math.max(1, Number(effect.hits) || 1);
      upgraded.amount = (Number(effect.amount) || 0) + (hits > 1 ? 1 : 3);
    } else if (effect.type === 'block') {
      upgraded.amount = (Number(effect.amount) || 0) + 3;
    } else if (effect.type === 'heal') {
      upgraded.amount = (Number(effect.amount) || 0) + 2;
    } else if (effect.type === 'energy') {
      upgraded.amount = (Number(effect.amount) || 0) + 2;
    } else if (effect.type === 'status') {
      upgraded.amount = (Number(effect.amount) || 0) + 1;
    } else if (['directDamage', 'detonate', 'catalyze', 'comboDamage'].includes(effect.type)) {
      upgraded.amount = (Number(effect.amount) || 0) + (effect.type === 'detonate' ? 1 : 3);
    } else if (effect.type === 'blockDamage') {
      upgraded.amount = (Number(effect.amount) || 0) + 5;
    } else if (effect.type === 'execute') {
      upgraded.amount = (Number(effect.amount) || 0) + 3;
    } else if (effect.type === 'recollect') {
      upgraded.amount = (Number(effect.amount) || 0) + 1;
    } else if (effect.type === 'toxicBurst') {
      upgraded.scale = (Number(effect.scale) || 3) + 1;
    } else if (effect.type === 'drawTo') {
      upgraded.amount = (Number(effect.amount) || 0) + 1;
    }
    return upgraded;
  });
}

const SCALING_SOURCES = {
  schools: '每有一种流派',
  exhaust: '消耗堆每有一张牌',
  hand: '每有一张手牌',
  statuses: '自身每有一种状态',
};

export function cardScalingText(scaling) {
  if (!scaling?.source || !SCALING_SOURCES[scaling.source]) return '';
  const cap = Number(scaling.cap) ? `，上限 +${scaling.cap}` : '';
  return `（${SCALING_SOURCES[scaling.source]} +${Number(scaling.scale) || 1}${cap}）`;
}

export function resolveCard(card, upgraded = false) {
  if (!card) return null;
  if (!upgraded) {
    return {
      ...card,
      upgraded: false,
      displayName: card.name,
      description: `${describeEffects(card.effects)}${cardScalingText(card.scaling)}`,
      rarityName: RARITY_INFO[card.rarity]?.name || '普通',
      rarityColor: RARITY_INFO[card.rarity]?.color || RARITY_INFO.common.color,
      accent: cardAccent(card),
    };
  }
  const effects = Array.isArray(card.upgradeEffects) ? card.upgradeEffects.map((effect) => ({ ...effect })) : getCardUpgrade(card.effects);
  return {
    ...card,
    effects,
    upgraded: true,
    displayName: `${card.name}+`,
    description: `${describeEffects(effects)}${cardScalingText(card.scaling)}`,
    rarityName: RARITY_INFO[card.rarity]?.name || '普通',
    rarityColor: RARITY_INFO[card.rarity]?.color || RARITY_INFO.common.color,
    accent: cardAccent(card),
  };
}

export function hueFromString(text = '') {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export async function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片载入失败'));
    image.src = src;
  });
}

export async function imageToSquareDataUrl(source, size = 560, quality = 0.84) {
  const image = typeof source === 'string'
    ? await loadImageElement(source)
    : await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => loadImageElement(String(reader.result)).then(resolve).catch(reject);
      reader.onerror = () => reject(new Error('无法读取图片'));
      reader.readAsDataURL(source);
    });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(size / sourceWidth, size / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(image, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);
  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

export function localImageSrc(path) {
  return new URL(path, document.baseURI).href;
}

export async function imageToCardDataUrl(source, width = 512, height = 364, quality = 0.84) {
  const image = typeof source === 'string'
    ? await loadImageElement(source)
    : await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => loadImageElement(String(reader.result)).then(resolve).catch(reject);
      reader.onerror = () => reject(new Error('无法读取图片'));
      reader.readAsDataURL(source);
    });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

export function formatHp(current, max) {
  return `${Math.max(0, Math.ceil(current))} / ${Math.ceil(max)}`;
}

export function seededRoll(chance, seed = rand()) {
  return seed < chance;
}
