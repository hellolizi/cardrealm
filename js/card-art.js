import { safeColor } from './utils.js';
import { peekCardArt } from './card-art-store.js';
import { CARD_ART } from './card-art-manifest.js';
import { liveArt } from './live-art.js';

let artSeq = 0;

function hashText(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rngFrom(seed) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function toRgb(hex) {
  const clean = safeColor(hex, '#8d84a0').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.slice(0, 6);
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgba(hex, alpha = 1) {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mix(hex, target, weight) {
  const a = toRgb(hex);
  const b = toRgb(target);
  const t = Math.max(0, Math.min(1, weight));
  return `#${a.map((channel, index) => Math.round(channel + (b[index] - channel) * t).toString(16).padStart(2, '0')).join('')}`;
}

function darken(hex, weight) {
  return mix(hex, '#05040a', weight);
}

function tint(hex, weight) {
  return mix(hex, '#fff4dd', weight);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function motes(rng, count, color, alpha = 0.5, area = { x: [0, 180], y: [0, 128] }) {
  let out = '';
  for (let index = 0; index < count; index += 1) {
    const x = area.x[0] + rng() * (area.x[1] - area.x[0]);
    const y = area.y[0] + rng() * (area.y[1] - area.y[0]);
    const radius = 0.4 + rng() * 1.1;
    out += `<circle cx="${round(x)}" cy="${round(y)}" r="${round(radius)}" fill="${color}" opacity="${round(alpha * (0.35 + rng() * 0.65))}"/>`;
  }
  return out;
}

function starfield(rng, count, color) {
  return motes(rng, count, color, 0.8, { x: [-4, 184], y: [2, 84] });
}

function sparkle(x, y, size, color, opacity = 0.8) {
  return `<path d="M${x} ${y - size} L${x + size * 0.26} ${y - size * 0.26} L${x + size} ${y} L${x + size * 0.26} ${y + size * 0.26} L${x} ${y + size} L${x - size * 0.26} ${y + size * 0.26} L${x - size} ${y} L${x - size * 0.26} ${y - size * 0.26} Z" fill="${color}" opacity="${opacity}"/>`;
}

function ridge(rng, baseY, amplitude, step = 26) {
  let path = `M-20 132 L-20 ${round(baseY)}`;
  let x = -20;
  while (x < 200) {
    const width = step * (0.6 + rng() * 0.9);
    const peak = amplitude * (0.35 + rng() * 0.85);
    path += ` L${round(x + width * 0.42)} ${round(baseY - peak)} L${round(x + width)} ${round(baseY - peak * 0.22)}`;
    x += width;
  }
  path += ' L200 132 Z';
  return path;
}

function skyDefs(uid, accent, options = {}) {
  const top = options.top || darken(accent, 0.9);
  const bottom = options.bottom || darken(accent, 0.72);
  const glow = options.glow || accent;
  return `<defs>
    <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0.12" y2="1">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="0.58" stop-color="${darken(glow, 0.62)}"/>
      <stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
    <radialGradient id="${uid}-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.5"/>
      <stop offset="0.55" stop-color="${glow}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${uid}-mist" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${tint(accent, 0.2)}" stop-opacity="0"/>
      <stop offset="0.65" stop-color="${tint(accent, 0.32)}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${tint(accent, 0.42)}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="${uid}-vignette" cx="0.5" cy="0.42" r="0.78">
      <stop offset="0.5" stop-color="#05040a" stop-opacity="0"/>
      <stop offset="1" stop-color="#05040a" stop-opacity="0.62"/>
    </radialGradient>
  </defs>
  <rect width="180" height="128" fill="url(#${uid}-sky)"/>`;
}

function closeScene(uid) {
  return `<rect width="180" height="128" fill="url(#${uid}-vignette)"/>`;
}

function bladeScene(rng, accent, uid) {
  const pale = tint(accent, 0.55);
  const sunX = 44 + rng() * 92;
  const sunY = 32 + rng() * 14;
  const sunR = 17 + rng() * 7;
  const swordX = 82 + (rng() - 0.5) * 22;
  const swordY = 92 + rng() * 6;
  const angle = -34 + rng() * 16;
  const slashes = [
    { x: 6 + rng() * 10, y: 114 - rng() * 10, ox: 156, oy: 24 + rng() * 16, w: 1.5, a: 0.6 },
    { x: 20 + rng() * 12, y: 122 - rng() * 8, ox: 172, oy: 40 + rng() * 16, w: 0.8, a: 0.42 },
  ];
  const petals = [];
  for (let index = 0; index < 7; index += 1) {
    const x = 24 + rng() * 132;
    const y = 44 + rng() * 70;
    petals.push(`<ellipse cx="${round(x)}" cy="${round(y)}" rx="${round(1.6 + rng() * 1.6)}" ry="${round(0.8 + rng() * 0.7)}" fill="${rgba(pale, 0.28 + rng() * 0.3)}" transform="rotate(${round(-40 + rng() * 80)} ${round(x)} ${round(y)})"/>`);
  }
  return `${skyDefs(uid, accent, { top: '#160b0d', bottom: '#241014' })}
    <rect width="180" height="128" fill="url(#${uid}-glow)" opacity="0.55"/>
    ${starfield(rng, 9, pale)}
    <circle cx="${round(sunX)}" cy="${round(sunY)}" r="${round(sunR * 2.6)}" fill="url(#${uid}-glow)"/>
    <circle cx="${round(sunX)}" cy="${round(sunY)}" r="${round(sunR)}" fill="${rgba(pale, 0.5)}"/>
    <circle cx="${round(sunX)}" cy="${round(sunY)}" r="${round(sunR)}" fill="none" stroke="${rgba(tint(accent, 0.7), 0.35)}" stroke-width="0.6"/>
    <path d="${ridge(rng, 96, 16)}" fill="${darken(accent, 0.78)}" opacity="0.85"/>
    <path d="${ridge(rng, 114, 12)}" fill="${darken(accent, 0.9)}"/>
    <g transform="translate(${round(swordX)} ${round(swordY)}) rotate(${round(angle)}) scale(1.16)">
      <path d="M0 6 L0 -57 Q0 -63 -2 -67" fill="none" stroke="${rgba(pale, 0.18)}" stroke-width="12" stroke-linecap="round"/>
      <path d="M-3.4 4 L-3.4 -53 Q-2.8 -61 0 -69 L3.2 -54 L3.2 4 Z" fill="${darken(accent, 0.92)}" stroke="${rgba(pale, 0.62)}" stroke-width="0.8"/>
      <path d="M1.1 1 L0.9 -56" stroke="${rgba('#fff7e6', 0.72)}" stroke-width="0.6"/>
      <path d="M-3.4 -16 L3.2 -15 M-3.4 -34 L3.2 -33" stroke="${rgba(pale, 0.2)}" stroke-width="0.4"/>
      <rect x="-7.2" y="4" width="14.4" height="3.2" rx="1.6" fill="${rgba(pale, 0.68)}"/>
      <rect x="-2.3" y="7.2" width="4.6" height="16" rx="1.8" fill="${darken(accent, 0.74)}" stroke="${rgba(pale, 0.4)}" stroke-width="0.5"/>
      <path d="M-2.3 11.4h4.6M-2.3 14.6h4.6M-2.3 17.8h4.6" stroke="${rgba(pale, 0.45)}" stroke-width="0.5"/>
      <circle cx="0" cy="25.6" r="2.2" fill="none" stroke="${rgba(pale, 0.45)}" stroke-width="0.6"/>
    </g>
    <g fill="none" stroke-linecap="round">
      <path d="M${round(slashes[0].x)} ${round(slashes[0].y)} Q68 24 ${round(slashes[0].ox)} ${round(slashes[0].oy)}" stroke="${rgba(tint(accent, 0.62), slashes[0].a)}" stroke-width="${slashes[0].w}"/>
      <path d="M${round(slashes[1].x)} ${round(slashes[1].y)} Q78 32 ${round(slashes[1].ox)} ${round(slashes[1].oy)}" stroke="${rgba(accent, slashes[1].a + 0.16)}" stroke-width="${slashes[1].w}"/>
    </g>
    ${petals.join('')}
    ${closeScene(uid)}`;
}

function starScene(rng, accent, uid) {
  const pale = tint(accent, 0.62);
  const moonX = 120 + rng() * 26;
  const moonY = 28 + rng() * 12;
  const moonR = 12 + rng() * 5;
  const points = [];
  const count = 5 + Math.floor(rng() * 2);
  for (let index = 0; index < count; index += 1) {
    points.push({
      x: 22 + rng() * 128,
      y: 16 + rng() * 58,
      r: 0.8 + rng() * 1.2,
    });
  }
  const lines = points.map((point, index) => {
    const next = points[index + 1];
    return next ? `<path d="M${round(point.x)} ${round(point.y)} L${round(next.x)} ${round(next.y)}" stroke="${rgba(pale, 0.24)}" stroke-width="0.5"/>` : '';
  }).join('');
  const stars = points.map((point) => `<circle cx="${round(point.x)}" cy="${round(point.y)}" r="${round(point.r)}" fill="${pale}"/>
    <circle cx="${round(point.x)}" cy="${round(point.y)}" r="${round(point.r * 3.2)}" fill="url(#${uid}-glow)" opacity="0.7"/>`).join('');
  const ringTilt = -10 - rng() * 14;
  return `${skyDefs(uid, accent, { top: '#0a0e1e', bottom: '#141a32', glow: pale })}
    ${starfield(rng, 22, pale)}
    <g transform="rotate(${round(ringTilt)} 90 72)">
      <ellipse cx="90" cy="72" rx="62" ry="22" fill="none" stroke="${rgba(pale, 0.18)}" stroke-width="0.6" stroke-dasharray="2 4"/>
      <ellipse cx="90" cy="72" rx="45" ry="15" fill="none" stroke="${rgba(pale, 0.24)}" stroke-width="0.5"/>
      <circle cx="34" cy="65" r="2.2" fill="${rgba(pale, 0.7)}"/>
      <circle cx="147" cy="79" r="1.6" fill="${rgba(pale, 0.55)}"/>
    </g>
    <g>
      <mask id="${uid}-moonmask">
        <circle cx="${round(moonX)}" cy="${round(moonY)}" r="${round(moonR)}" fill="white"/>
        <circle cx="${round(moonX - moonR * 0.45)}" cy="${round(moonY + moonR * 0.2)}" r="${round(moonR * 0.92)}" fill="black"/>
      </mask>
      <circle cx="${round(moonX)}" cy="${round(moonY)}" r="${round(moonR * 2.2)}" fill="url(#${uid}-glow)"/>
      <circle cx="${round(moonX)}" cy="${round(moonY)}" r="${round(moonR)}" fill="${rgba(pale, 0.7)}" mask="url(#${uid}-moonmask)"/>
    </g>
    ${lines}
    ${stars}
    <path d="${ridge(rng, 120, 8, 34)}" fill="${darken(accent, 0.86)}" opacity="0.9"/>
    <g fill="${darken(accent, 0.93)}" stroke="${rgba(pale, 0.3)}" stroke-width="0.5">
      <path d="M88 128 V74 L91 68 L92 58 L94 54 L96 58 L97 68 L100 74 V128 Z"/>
      <path d="M78 128 V96 L82 92 V84 M106 128 V98 L102 94 V86" fill="none"/>
    </g>
    <circle cx="94" cy="80" r="1.2" fill="${rgba(pale, 0.65)}"/>
    ${sparkle(round(58 + rng() * 20), round(34 + rng() * 12), 3, pale, 0.7)}
    ${closeScene(uid)}`;
}

function shadowScene(rng, accent, uid) {
  const pale = tint(accent, 0.5);
  const maskX = 88 + (rng() - 0.5) * 30;
  const maskY = 56 + (rng() - 0.5) * 10;
  const maskTilt = -10 + rng() * 20;
  const mist = [
    { y: 96, a: 0.5 },
    { y: 108, a: 0.7 },
    { y: 120, a: 0.9 },
  ].map((layer) => `<path d="M-20 ${layer.y + 8} Q30 ${layer.y - 6} 70 ${layer.y + 2} T160 ${layer.y - 4} T200 ${layer.y + 2} L200 132 L-20 132 Z" fill="${rgba(tint(accent, 0.38), layer.a * 0.2)}"/>`).join('');
  const branch = (direction) => {
    const flip = direction === 'left' ? 1 : -1;
    const origin = direction === 'left' ? 0 : 180;
    return `<g transform="translate(${origin} 0) scale(${flip} 1)" fill="none" stroke="${darken(accent, 0.94)}" stroke-linecap="round">
      <path d="M-6 0 Q14 22 10 46 Q8 66 20 82" stroke-width="4.5"/>
      <path d="M10 46 Q26 40 34 28" stroke-width="2.2"/>
      <path d="M9 58 Q24 54 30 62" stroke-width="1.6"/>
      <path d="M20 82 Q34 80 42 88" stroke-width="1.8"/>
      <path d="M32 30 Q40 24 44 16" stroke-width="1.2"/>
    </g>`;
  };
  const hooded = rng() > 0.62;
  const figure = hooded
    ? `<g transform="translate(${round(maskX)} ${round(maskY + 12)})">
        <path d="M-22 48 C-20 32 -12 24 0 24 C12 24 20 32 22 48 L17 54 L-17 54 Z" fill="${darken(accent, 0.95)}" opacity="0.92"/>
        <path d="M0 29 C-16 22 -21 2 -12 -14 C-7 -23 7 -23 12 -14 C21 2 16 22 0 29 Z" fill="${darken(accent, 0.93)}" stroke="${rgba(pale, 0.32)}" stroke-width="0.7"/>
        <path d="M0 8 C-7 8 -10 13 -9 19 C-6 25 6 25 9 19 C10 13 7 8 0 8 Z" fill="#07060a"/>
        <circle cx="-3.6" cy="15.4" r="1.3" fill="${rgba(pale, 0.92)}"/>
        <circle cx="3.6" cy="15.4" r="1.3" fill="${rgba(pale, 0.92)}"/>
        <circle cx="-3.6" cy="15.4" r="3.8" fill="url(#${uid}-glow)" opacity="0.9"/>
        <circle cx="3.6" cy="15.4" r="3.8" fill="url(#${uid}-glow)" opacity="0.9"/>
        <path d="M-11 -14 C-4 -21 4 -21 11 -14" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="0.55"/>
        <path d="M-8 30 C-5 37 -5 43 -7 49 M8 30 C5 37 5 43 7 49 M-14 34 L-16 48 M14 34 L16 48" fill="none" stroke="${rgba(pale, 0.16)}" stroke-width="0.6"/>
        <path d="M-17 54 L-21 58 M-8 54 L-10 58 M8 54 L6 58 M17 54 L21 58" stroke="${darken(accent, 0.95)}" stroke-width="1.2"/>
      </g>`
    : `<g transform="translate(${round(maskX)} ${round(maskY)}) rotate(${round(maskTilt)})">
        <circle r="31" fill="none" stroke="${rgba(pale, 0.28)}" stroke-width="0.6" stroke-dasharray="1.5 4.5"/>
        <circle r="39" fill="none" stroke="${rgba(pale, 0.15)}" stroke-width="0.5"/>
        <path d="M-13 -22 C-4 -28 4 -28 13 -22 C17 -10 15 4 8 14 L0 27 L-8 14 C-15 4 -17 -10 -13 -22 Z" fill="${rgba(tint(pale, 0.52), 0.85)}" stroke="${darken(accent, 0.82)}" stroke-width="0.9"/>
        <path d="M-11 -4 C-11 4 -8 10 -4 14 M11 -4 C11 4 8 10 4 14" fill="none" stroke="${rgba(darken(accent, 0.78), 0.5)}" stroke-width="0.7"/>
        <path d="M-13 -22 C-4 -28 4 -28 13 -22" fill="none" stroke="${rgba(tint(pale, 0.7), 0.75)}" stroke-width="0.55"/>
        <path d="M-13 -18 C-19 -27 -22 -31 -27 -34 M13 -18 C19 -27 22 -31 27 -34" fill="none" stroke="${rgba(tint(pale, 0.4), 0.45)}" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M-11 -5.4 L-4 -8.4 L-1.8 -4 L-8 -2.6 Z" fill="${darken(accent, 0.97)}"/>
        <path d="M11 -5.4 L4 -8.4 L1.8 -4 L8 -2.6 Z" fill="${darken(accent, 0.97)}"/>
        <circle cx="-6" cy="-5.2" r="1.4" fill="${rgba(pale, 0.95)}"/>
        <circle cx="6" cy="-5.2" r="1.4" fill="${rgba(pale, 0.95)}"/>
        <circle cx="-6" cy="-5.2" r="4.2" fill="url(#${uid}-glow)"/>
        <circle cx="6" cy="-5.2" r="4.2" fill="url(#${uid}-glow)"/>
        <path d="M0 -17 L3.4 -13.4 L0 -9.8 L-3.4 -13.4 Z" fill="${rgba(pale, 0.6)}"/>
        <path d="M0 -17 L3.4 -13.4 L0 -9.8 L-3.4 -13.4 Z" fill="none" stroke="${rgba(pale, 0.8)}" stroke-width="0.4"/>
        <path d="M0 1.4 L-1.5 10.6 L1.8 9" fill="none" stroke="${darken(accent, 0.9)}" stroke-width="0.9"/>
        <path d="M0 13 L0 19.4 M-4.8 21 L0 17.6 L4.8 21 M-3 14.8 L0 16.4 L3 14.8" fill="none" stroke="${rgba(pale, 0.34)}" stroke-width="0.6"/>
        <path d="M-16 -12 L-12 -9.4 M14 -8 L17 -10 M-13 8 L-9.6 10.6 M12 12 L15.4 9.4" stroke="${rgba(darken(accent, 0.86), 0.9)}" stroke-width="0.7"/>
        <path d="M4.6 -3 C5.2 4 4.8 8.6 3.2 13" fill="none" stroke="${rgba(darken(accent, 0.88), 1)}" stroke-width="0.5"/>
        <path d="M-2 27 C-5 35 -3 41 -7 48 M2 27 C5 35 3 41 7 48" fill="none" stroke="${rgba(tint(accent, 0.3), 0.3)}" stroke-width="0.8" stroke-linecap="round"/>
      </g>`;
  return `${skyDefs(uid, accent, { top: '#0a0d0a', bottom: '#111710', glow: pale })}
    <rect width="180" height="128" fill="url(#${uid}-glow)" opacity="0.4"/>
    ${starfield(rng, 8, pale)}
    ${branch('left')}
    ${branch('right')}
    ${motes(rng, 14, pale, 0.3, { x: [40, 150], y: [70, 118] })}
    ${figure}
    ${mist}
    <g fill="none" stroke="${rgba(tint(accent, 0.3), 0.16)}" stroke-width="0.5">
      <path d="M130 8 Q126 26 132 42 M36 10 Q40 24 34 38"/>
    </g>
    <circle cx="${round(34 + rng() * 20)}" cy="${round(20 + rng() * 10)}" r="7" fill="${rgba(tint(accent, 0.4), 0.18)}"/>
    ${closeScene(uid)}`;
}

function emberScene(rng, accent, uid) {
  const pale = tint(accent, 0.55);
  const emberX = 62 + rng() * 56;
  const emberY = 33 + rng() * 10;
  const fireX = 78 + (rng() - 0.5) * 24;
  const tongues = [];
  for (let index = 0; index < 5; index += 1) {
    const x = fireX - 24 + index * 12 + (rng() - 0.5) * 5;
    const height = 24 + rng() * 42;
    const width = 3.4 + rng() * 3;
    const sway = (rng() - 0.5) * 16;
    const baseY = 105;
    const tipY = baseY - height;
    const d = `M${round(x - width)} ${baseY} C${round(x - width * 1.7)} ${round(baseY - height * 0.32)} ${round(x - width * 0.5 + sway * 0.4)} ${round(baseY - height * 0.6)} ${round(x + sway)} ${round(tipY)} C${round(x + width * 0.9 + sway * 0.3)} ${round(baseY - height * 0.54)} ${round(x + width * 1.6)} ${round(baseY - height * 0.26)} ${round(x + width)} ${baseY} Z`;
    tongues.push(`<path d="${d}" fill="url(#${uid}-flameOuter)" opacity="${round(0.5 + rng() * 0.35)}"/>`);
  }
  const cores = [];
  for (let index = 0; index < 3; index += 1) {
    const x = fireX - 13 + index * 12 + (rng() - 0.5) * 5;
    const height = 13 + rng() * 17;
    const width = 2.4 + rng() * 1.8;
    const sway = (rng() - 0.5) * 5;
    cores.push(`<path d="M${round(x - width)} 104 C${round(x - width * 1.3)} ${round(104 - height * 0.46)} ${round(x - 0.4 + sway * 0.4)} ${round(104 - height * 0.78)} ${round(x + sway)} ${round(104 - height)} C${round(x + width * 0.8)} ${round(104 - height * 0.5)} ${round(x + width * 1.2)} ${round(104 - height * 0.24)} ${round(x + width)} 104 Z" fill="url(#${uid}-flame)" opacity="${round(0.7 + rng() * 0.3)}"/>`);
  }
  const sparks = [];
  for (let index = 0; index < 16; index += 1) {
    const x = fireX - 34 + rng() * 70;
    const y = 22 + rng() * 62;
    const radius = 0.5 + rng() * 1.2;
    sparks.push(`<circle cx="${round(x)}" cy="${round(y)}" r="${round(radius)}" fill="${pale}" opacity="${round(0.25 + rng() * 0.65)}"/>`);
  }
  return `${skyDefs(uid, accent, { top: '#170a07', bottom: '#241009', glow: pale })}
    <defs>
      <linearGradient id="${uid}-flame" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="${pale}" stop-opacity="0.95"/>
        <stop offset="0.45" stop-color="${pale}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${uid}-flameOuter" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="${mix(accent, '#7d2c18', 0.42)}" stop-opacity="0.92"/>
        <stop offset="0.55" stop-color="${accent}" stop-opacity="0.6"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="180" height="128" fill="url(#${uid}-glow)" opacity="0.5"/>
    ${starfield(rng, 9, pale)}
    <circle cx="${round(emberX)}" cy="${round(emberY)}" r="${round(26 + rng() * 8)}" fill="url(#${uid}-glow)"/>
    <circle cx="${round(emberX)}" cy="${round(emberY)}" r="${round(10 + rng() * 4)}" fill="${rgba(mix(accent, '#772b1b', 0.4), 0.7)}"/>
    <circle cx="${round(emberX)}" cy="${round(emberY)}" r="${round(10 + rng() * 4)}" fill="none" stroke="${rgba(pale, 0.22)}" stroke-width="0.6"/>
    <path d="M${round(emberX - 12)} ${round(emberY + 1)} q6 -3 12 0 t12 -1" fill="none" stroke="${rgba(pale, 0.16)}" stroke-width="0.5"/>
    <path d="${ridge(rng, 108, 12)}" fill="${darken(accent, 0.92)}"/>
    <g transform="translate(${round(fireX)} 104)">
      <rect x="-25" y="-2.4" width="50" height="4.6" rx="2.3" fill="${darken(accent, 0.95)}" transform="rotate(-7)"/>
      <rect x="-23" y="-1.4" width="46" height="3.8" rx="1.9" fill="${mix(accent, '#33200f', 0.55)}" transform="rotate(9)"/>
      <circle cx="-11" cy="-4" r="1.1" fill="${rgba(pale, 0.5)}"/>
      <circle cx="7" cy="-3.4" r="0.8" fill="${rgba(pale, 0.4)}"/>
    </g>
    ${tongues.join('')}
    ${cores.join('')}
    <path d="M${round(fireX - 26)} 107 Q${round(fireX)} 100 ${round(fireX + 26)} 107" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.4" stroke-linecap="round"/>
    <ellipse cx="${round(fireX)}" cy="106" rx="40" ry="7" fill="url(#${uid}-glow)"/>
    <g fill="none" stroke="${rgba(tint(accent, 0.3), 0.2)}" stroke-width="0.7" stroke-linecap="round">
      <path d="M${round(fireX - 16)} 62 q-10 -14 2 -24 q10 -8 4 -18"/>
      <path d="M${round(fireX + 14)} 54 q12 -12 3 -22 q-7 -8 2 -16"/>
    </g>
    ${sparks.join('')}
    <path d="M20 118 Q46 108 70 114 T124 110 T164 116" fill="none" stroke="${rgba(pale, 0.22)}" stroke-width="0.7"/>
    ${closeScene(uid)}`;
}

function thornScene(rng, accent, uid) {
  const pale = tint(accent, 0.5);
  const bloomX = 116 + (rng() - 0.5) * 34;
  const bloomY = 64 + (rng() - 0.5) * 16;
  const stem = `M${round(bloomX)} ${round(bloomY + 8)} C${round(bloomX - 8)} 88 ${round(bloomX + 10)} 102 64 120`;
  const thornPoints = [
    [bloomX - 13, bloomY + 28, 34], [bloomX - 27, bloomY + 44, -28], [94, 96, 18], [76, 108, -32], [56, 114, 30],
  ];
  const thorns = thornPoints.map(([x, y, angle]) => `<path d="M${x} ${y} l6 -2 l-1 5 Z" fill="${mix(accent, '#1d1710', 0.35)}" transform="rotate(${angle} ${x} ${y})"/>`).join('');
  const petals = [];
  for (let index = 0; index < 7; index += 1) {
    const angle = (360 / 7) * index + rng() * 8;
    petals.push(`<ellipse cx="${round(bloomX)}" cy="${round(bloomY - 7)}" rx="4.4" ry="8.4" fill="${rgba(tint(accent, 0.32), 0.75)}" stroke="${rgba(darken(accent, 0.5), 0.6)}" stroke-width="0.4" transform="rotate(${round(angle)} ${round(bloomX)} ${round(bloomY)})"/>`);
  }
  return `${skyDefs(uid, accent, { top: '#100e09', bottom: '#1c1710', glow: pale })}
    ${starfield(rng, 10, pale)}
    <circle cx="42" cy="28" r="10" fill="${rgba(pale, 0.42)}"/>
    <circle cx="42" cy="28" r="17" fill="url(#${uid}-glow)"/>
    <g fill="${darken(accent, 0.94)}">
      <path d="M-4 128 V58 L2 50 V36 L5 30 L8 36 V50 L15 58 V128 Z"/>
      <path d="M22 128 V74 L26 68 V52 L31 58 V70 L36 76 V128 Z"/>
      <path d="M152 128 V62 L156 54 V44 L160 40 L164 44 V54 L170 62 V128 Z"/>
      <path d="M138 128 V84 L142 78 V64 L147 70 V80 L152 86 V128 Z" opacity="0.8"/>
    </g>
    <path d="${ridge(rng, 112, 10)}" fill="${darken(accent, 0.9)}"/>
    <g fill="none" stroke="${mix(accent, '#1d1710', 0.3)}" stroke-linecap="round">
      <path d="${stem}" stroke-width="2.6"/>
      <path d="M30 128 C28 104 54 94 60 80 C64 68 84 72 90 88 C96 104 78 112 70 100" stroke-width="1.9"/>
      <path d="M0 90 Q24 78 34 62 M180 96 Q154 88 148 72" stroke-width="1.5"/>
      <path d="M96 128 C104 114 126 108 140 96" stroke-width="1.2" opacity="0.8"/>
    </g>
    ${thorns}
    <g>
      ${petals.join('')}
      <circle cx="${round(bloomX)}" cy="${round(bloomY)}" r="3.6" fill="${tint(accent, 0.7)}"/>
      <circle cx="${round(bloomX)}" cy="${round(bloomY)}" r="6" fill="url(#${uid}-glow)"/>
    </g>
    ${motes(rng, 10, pale, 0.35, { x: [20, 160], y: [30, 96] })}
    ${closeScene(uid)}`;
}

function dreamScene(rng, accent, uid) {
  const pale = tint(accent, 0.62);
  const doorX = 88 + (rng() - 0.5) * 30;
  const doorY = 52 + (rng() - 0.5) * 10;
  const tilt = -4 + rng() * 8;
  const shards = [];
  for (let index = 0; index < 5; index += 1) {
    const x = 20 + rng() * 140;
    const y = 20 + rng() * 60;
    const height = 8 + rng() * 16;
    shards.push(`<path d="M${round(x)} ${round(y - height)} L${round(x + 3.4)} ${round(y)} L${round(x)} ${round(y + height * 0.4)} L${round(x - 2.4)} ${round(y)} Z" fill="${rgba(pale, 0.18 + rng() * 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="0.4" transform="rotate(${round(-24 + rng() * 48)} ${round(x)} ${round(y)})"/>`);
  }
  const pages = [];
  for (let index = 0; index < 4; index += 1) {
    const x = 20 + rng() * 140;
    const y = 34 + rng() * 56;
    const angle = -18 + rng() * 36;
    pages.push(`<g transform="rotate(${round(angle)} ${round(x)} ${round(y)})">
      <path d="M${round(x)} ${round(y)} l8 -2 l5 3 l-8 2 Z" fill="${rgba(tint(accent, 0.45), 0.5)}"/>
      <path d="M${round(x)} ${round(y)} l5 1" stroke="${rgba(darken(accent, 0.6), 0.5)}" stroke-width="0.3"/>
    </g>`);
  }
  return `${skyDefs(uid, accent, { top: '#0e0a18', bottom: '#191026', glow: pale })}
    ${starfield(rng, 20, pale)}
    <circle cx="${round(128 + rng() * 24)}" cy="${round(24 + rng() * 10)}" r="${round(9 + rng() * 4)}" fill="${rgba(pale, 0.4)}"/>
    <circle cx="${round(30 + rng() * 22)}" cy="${round(18 + rng() * 8)}" r="${round(5 + rng() * 3)}" fill="${rgba(pale, 0.22)}"/>
    <g fill="none" stroke="${rgba(pale, 0.2)}" stroke-width="0.5">
      <ellipse cx="90" cy="112" rx="66" ry="8"/>
      <ellipse cx="90" cy="118" rx="48" ry="5.4"/>
      <ellipse cx="90" cy="123" rx="78" ry="6"/>
    </g>
    ${shards.join('')}
    ${pages.join('')}
    <g transform="translate(${round(doorX)} ${round(doorY)}) rotate(${round(tilt)})">
      <path d="M-17 34 V-14 C-17 -32 17 -32 17 -14 V34 Z" fill="${darken(accent, 0.92)}" stroke="${rgba(pale, 0.4)}" stroke-width="0.8"/>
      <path d="M-11 30 V-12 C-11 -24 11 -24 11 -12 V30 Z" fill="url(#${uid}-door)"/>
      <path d="M0 31 V-22" stroke="${rgba('#fff6e4', 0.72)}" stroke-width="1.4"/>
      <path d="M-17 34 H17" stroke="${rgba(pale, 0.5)}" stroke-width="1.2"/>
      <circle cx="0" cy="-10" r="16" fill="url(#${uid}-glow)"/>
      <path d="M-24 38 Q0 44 24 38" fill="none" stroke="${rgba(pale, 0.2)}" stroke-width="0.6"/>
    </g>
    <defs>
      <linearGradient id="${uid}-door" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${pale}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0.06"/>
      </linearGradient>
    </defs>
    <path d="${ridge(rng, 126, 6, 42)}" fill="${darken(accent, 0.94)}"/>
    ${sparkle(round(46 + rng() * 20), round(40 + rng() * 14), 3.4, pale, 0.65)}
    ${closeScene(uid)}`;
}

const SCENES = {
  blade: bladeScene,
  star: starScene,
  shadow: shadowScene,
  ember: emberScene,
  thorn: thornScene,
  dream: dreamScene,
};

function cardMotifs(card, rng, accent, uid) {
  const id = card?.id || '';
  const effects = card?.effects || [];
  const type = card?.type || '';
  const pale = tint(accent, 0.6);
  
  const hasDamage = effects.some(e => e.type === 'damage' || e.type === 'directDamage');
  const hasBlock = effects.some(e => e.type === 'block');
  const hasPoison = effects.some(e => e.type === 'status' && e.status === 'poison');
  const hasBurn = effects.some(e => e.type === 'status' && e.status === 'burn');
  const hasHeal = effects.some(e => e.type === 'heal');
  const hasDraw = effects.some(e => e.type === 'draw' || e.type === 'drawTo');
  const hasStrength = effects.some(e => e.type === 'status' && e.status === 'strength');
  const hasThorns = effects.some(e => e.type === 'status' && e.status === 'thorns');
  const hasVulnerable = effects.some(e => e.type === 'status' && e.status === 'vulnerable');
  const hasWeak = effects.some(e => e.type === 'status' && e.status === 'weak');
  
  let motifs = '';
  
  if (id === 'strike') {
    motifs += `<path d="M90 20 L90 108" stroke="${rgba(pale, 0.4)}" stroke-width="2" stroke-linecap="round"/>`;
    motifs += `<path d="M85 25 L90 20 L95 25" stroke="${rgba(pale, 0.5)}" stroke-width="1.5" fill="none"/>`;
  } else if (id === 'defend') {
    motifs += `<circle cx="90" cy="64" r="28" fill="none" stroke="${rgba(pale, 0.35)}" stroke-width="2"/>`;
    motifs += `<circle cx="90" cy="64" r="22" fill="none" stroke="${rgba(pale, 0.25)}" stroke-width="1.5"/>`;
  } else if (id === 'sunder') {
    motifs += `<path d="M40 30 L140 98" stroke="${rgba(pale, 0.5)}" stroke-width="3" stroke-linecap="round"/>`;
    motifs += `<path d="M50 25 L150 93" stroke="${rgba(accent, 0.3)}" stroke-width="2"/>`;
  } else if (id === 'spark') {
    motifs += sparkle(90, 64, 8, pale, 0.7);
    motifs += sparkle(70, 50, 4, pale, 0.5);
    motifs += sparkle(110, 78, 4, pale, 0.5);
  } else if (id === 'ward') {
    motifs += `<rect x="60" y="40" width="60" height="48" rx="4" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2.5"/>`;
    motifs += `<rect x="65" y="45" width="50" height="38" rx="2" fill="${rgba(pale, 0.15)}"/>`;
  } else if (id === 'echo') {
    motifs += `<circle cx="90" cy="64" r="20" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    motifs += `<circle cx="90" cy="64" r="30" fill="none" stroke="${rgba(pale, 0.2)}" stroke-width="1" stroke-dasharray="2 4"/>`;
    motifs += sparkle(90, 64, 5, pale, 0.6);
  } else if (id === 'nova') {
    motifs += `<circle cx="90" cy="50" r="18" fill="${rgba(pale, 0.5)}"/>`;
    motifs += `<circle cx="90" cy="50" r="28" fill="url(#${uid}-glow)" opacity="0.6"/>`;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const x1 = 90 + Math.cos(angle) * 20;
      const y1 = 50 + Math.sin(angle) * 20;
      const x2 = 90 + Math.cos(angle) * 40;
      const y2 = 50 + Math.sin(angle) * 40;
      motifs += `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
    }
  } else if (id === 'dodge') {
    motifs += `<path d="M60 80 Q90 40 120 80" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2" stroke-dasharray="4 4"/>`;
    motifs += `<circle cx="90" cy="60" r="12" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
  } else if (id === 'envenom') {
    motifs += `<path d="M90 30 L90 98" stroke="${rgba(mix(accent, '#4a6b3a', 0.5), 0.5)}" stroke-width="2"/>`;
    motifs += `<circle cx="90" cy="95" r="6" fill="${rgba(mix(accent, '#4a6b3a', 0.5), 0.6)}"/>`;
    motifs += `<path d="M85 35 L90 30 L95 35" stroke="${rgba(pale, 0.4)}" stroke-width="1.5" fill="none"/>`;
  } else if (id === 'flurry') {
    for (let i = 0; i < 3; i++) {
      const x = 70 + i * 20;
      const y = 50 + (i % 2) * 20;
      motifs += `<path d="M${x} ${y} L${x+10} ${y-15} L${x+20} ${y}" stroke="${rgba(pale, 0.4)}" stroke-width="1.5" fill="none"/>`;
    }
  } else if (id === 'twinFang') {
    motifs += `<path d="M75 40 L75 88" stroke="${rgba(pale, 0.45)}" stroke-width="2"/>`;
    motifs += `<path d="M105 40 L105 88" stroke="${rgba(pale, 0.45)}" stroke-width="2"/>`;
    motifs += `<path d="M70 45 L75 40 L80 45" stroke="${rgba(pale, 0.5)}" stroke-width="1.5" fill="none"/>`;
    motifs += `<path d="M100 45 L105 40 L110 45" stroke="${rgba(pale, 0.5)}" stroke-width="1.5" fill="none"/>`;
  } else if (id === 'ironWall') {
    motifs += `<rect x="50" y="45" width="80" height="40" rx="3" fill="${rgba(pale, 0.25)}" stroke="${rgba(pale, 0.4)}" stroke-width="2.5"/>`;
    motifs += `<line x1="70" y1="45" x2="70" y2="85" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<line x1="90" y1="45" x2="90" y2="85" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<line x1="110" y1="45" x2="110" y2="85" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
  } else if (id === 'warCry') {
    motifs += `<path d="M70 70 Q90 40 110 70" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2"/>`;
    motifs += `<path d="M65 75 Q90 35 115 75" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<path d="M60 80 Q90 30 120 80" fill="none" stroke="${rgba(pale, 0.2)}" stroke-width="1"/>`;
  } else if (id === 'quicksilver') {
    motifs += `<path d="M60 80 Q75 50 90 64 T120 48" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2" stroke-dasharray="3 3"/>`;
    motifs += `<circle cx="90" cy="64" r="8" fill="${rgba(pale, 0.3)}"/>`;
  } else if (id === 'poisonDagger') {
    motifs += `<path d="M90 35 L90 95" stroke="${rgba(mix(accent, '#4a6b3a', 0.5), 0.5)}" stroke-width="2.5"/>`;
    motifs += `<path d="M85 40 L90 35 L95 40" stroke="${rgba(pale, 0.4)}" stroke-width="1.5" fill="none"/>`;
    motifs += `<circle cx="90" cy="92" r="4" fill="${rgba(mix(accent, '#4a6b3a', 0.5), 0.6)}"/>`;
  } else if (id === 'weaken') {
    motifs += `<circle cx="90" cy="64" r="24" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="2" stroke-dasharray="4 4"/>`;
    motifs += `<path d="M75 64 L105 64" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
    motifs += `<path d="M90 49 L90 79" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
  } else if (id === 'fracture') {
    motifs += `<path d="M70 50 L90 64 L110 50" stroke="${rgba(pale, 0.5)}" stroke-width="2" fill="none"/>`;
    motifs += `<path d="M75 70 L90 64 L105 70" stroke="${rgba(pale, 0.4)}" stroke-width="1.5" fill="none"/>`;
    motifs += `<circle cx="90" cy="64" r="3" fill="${rgba(pale, 0.6)}"/>`;
  } else if (id === 'drain') {
    motifs += `<circle cx="90" cy="50" r="14" fill="${rgba(mix(accent, '#8b3a3a', 0.4), 0.5)}"/>`;
    motifs += `<path d="M90 64 L90 90" stroke="${rgba(pale, 0.4)}" stroke-width="2" stroke-dasharray="3 3"/>`;
    motifs += `<circle cx="90" cy="50" r="20" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
  } else if (id === 'overload') {
    motifs += `<circle cx="90" cy="64" r="26" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const x = 90 + Math.cos(angle) * 26;
      const y = 64 + Math.sin(angle) * 26;
      motifs += `<circle cx="${round(x)}" cy="${round(y)}" r="3" fill="${rgba(pale, 0.5)}"/>`;
    }
  } else if (id === 'earthguard') {
    motifs += `<rect x="60" y="50" width="60" height="35" rx="4" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="2.5"/>`;
    motifs += `<path d="M50 85 L130 85" stroke="${rgba(pale, 0.3)}" stroke-width="2"/>`;
  } else if (id === 'heartWall') {
    motifs += `<path d="M90 45 C80 35 65 40 65 55 C65 70 90 85 90 85 C90 85 115 70 115 55 C115 40 100 35 90 45 Z" fill="${rgba(mix(accent, '#c98b9b', 0.4), 0.4)}" stroke="${rgba(pale, 0.5)}" stroke-width="2"/>`;
  } else if (id === 'bloodPact') {
    motifs += `<path d="M75 50 L105 50 L105 80 L75 80 Z" fill="none" stroke="${rgba(mix(accent, '#8b3a3a', 0.5), 0.5)}" stroke-width="2"/>`;
    motifs += `<path d="M80 55 L100 75 M100 55 L80 75" stroke="${rgba(mix(accent, '#8b3a3a', 0.6), 0.6)}" stroke-width="1.5"/>`;
    motifs += `<circle cx="90" cy="65" r="8" fill="${rgba(mix(accent, '#8b3a3a', 0.5), 0.4)}"/>`;
  } else if (id === 'heavyBlow') {
    motifs += `<path d="M70 40 L110 40 L115 90 L65 90 Z" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.5)}" stroke-width="2.5"/>`;
    motifs += `<line x1="90" y1="40" x2="90" y2="90" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
  } else if (id === 'venomMist') {
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 15;
      const y = 50 + (i % 2) * 20;
      motifs += `<circle cx="${x}" cy="${y}" r="${8 + i * 2}" fill="${rgba(mix(accent, '#4a6b3a', 0.4), 0.15 + i * 0.05)}"/>`;
    }
  } else if (id === 'sharpen') {
    motifs += `<path d="M80 80 L90 40 L100 80" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2"/>`;
    motifs += `<line x1="75" y1="85" x2="105" y2="85" stroke="${rgba(pale, 0.4)}" stroke-width="2.5"/>`;
  } else if (id === 'gildedEdge') {
    motifs += `<path d="M90 35 L90 95" stroke="${rgba(mix(accent, '#c29d62', 0.6), 0.6)}" stroke-width="3"/>`;
    motifs += `<path d="M85 40 L90 35 L95 40" stroke="${rgba(mix(accent, '#c29d62', 0.7), 0.7)}" stroke-width="2" fill="none"/>`;
    motifs += sparkle(90, 65, 6, mix(accent, '#c29d62', 0.6), 0.5);
  } else if (id === 'mend') {
    motifs += `<circle cx="90" cy="64" r="20" fill="${rgba(mix(accent, '#8fb37a', 0.4), 0.3)}"/>`;
    motifs += `<path d="M85 64 L90 59 L95 64 L90 69 Z" fill="${rgba(mix(accent, '#8fb37a', 0.5), 0.5)}"/>`;
    motifs += `<line x1="90" y1="54" x2="90" y2="74" stroke="${rgba(mix(accent, '#8fb37a', 0.6), 0.6)}" stroke-width="1.5"/>`;
    motifs += `<line x1="80" y1="64" x2="100" y2="64" stroke="${rgba(mix(accent, '#8fb37a', 0.6), 0.6)}" stroke-width="1.5"/>`;
  } else if (id === 'benediction') {
    motifs += `<circle cx="90" cy="50" r="16" fill="url(#${uid}-glow)" opacity="0.6"/>`;
    motifs += `<path d="M90 66 L90 90" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    motifs += sparkle(90, 50, 8, pale, 0.5);
  } else if (id === 'surge') {
    motifs += `<path d="M70 80 Q90 50 110 80" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2.5"/>`;
    motifs += `<circle cx="90" cy="65" r="10" fill="${rgba(pale, 0.3)}"/>`;
    motifs += sparkle(90, 65, 5, pale, 0.6);
  } else if (id === 'perfectGuard') {
    motifs += `<circle cx="90" cy="64" r="28" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="3"/>`;
    motifs += `<circle cx="90" cy="64" r="22" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="2"/>`;
    motifs += `<circle cx="90" cy="64" r="16" fill="${rgba(pale, 0.15)}"/>`;
  } else if (id === 'mirrorEdge') {
    motifs += `<rect x="70" y="44" width="40" height="40" rx="2" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    motifs += `<line x1="90" y1="44" x2="90" y2="84" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<path d="M75 50 L85 60 L75 70" stroke="${rgba(pale, 0.5)}" stroke-width="1.5" fill="none"/>`;
  } else if (id === 'finalGambit') {
    motifs += `<path d="M90 40 L90 90" stroke="${rgba(pale, 0.5)}" stroke-width="2.5"/>`;
    motifs += `<path d="M80 50 L90 40 L100 50" stroke="${rgba(pale, 0.6)}" stroke-width="2" fill="none"/>`;
    motifs += `<circle cx="90" cy="90" r="6" fill="${rgba(pale, 0.4)}"/>`;
  } else if (id === 'soulRend') {
    motifs += `<path d="M70 40 L110 88" stroke="${rgba(mix(accent, '#8b3a3a', 0.5), 0.6)}" stroke-width="3"/>`;
    motifs += `<path d="M110 40 L70 88" stroke="${rgba(mix(accent, '#8b3a3a', 0.5), 0.6)}" stroke-width="3"/>`;
    motifs += `<circle cx="90" cy="64" r="12" fill="${rgba(mix(accent, '#8b3a3a', 0.4), 0.5)}"/>`;
    motifs += sparkle(90, 64, 8, pale, 0.6);
  } else if (id === 'cinderLash') {
    motifs += `<path d="M60 80 Q75 60 90 70 T120 50" fill="none" stroke="${rgba(mix(accent, '#d08a5a', 0.6), 0.5)}" stroke-width="2.5"/>`;
    motifs += `<circle cx="120" cy="50" r="5" fill="${rgba(pale, 0.5)}"/>`;
  } else if (id === 'kindling') {
    motifs += `<path d="M85 80 Q90 60 95 80" fill="${rgba(pale, 0.4)}"/>`;
    motifs += `<path d="M80 85 Q90 55 100 85" fill="${rgba(pale, 0.3)}"/>`;
    motifs += `<circle cx="90" cy="70" r="8" fill="url(#${uid}-glow)" opacity="0.5"/>`;
  } else if (id === 'wildfire') {
    for (let i = 0; i < 7; i++) {
      const x = 50 + i * 15;
      const y = 60 + Math.sin(i) * 15;
      motifs += `<path d="M${x} ${y+10} Q${x} ${y} ${x+5} ${y-5} Q${x+10} ${y} ${x+10} ${y+10}" fill="${rgba(pale, 0.2 + i * 0.05)}"/>`;
    }
  } else if (id === 'pyreBloom') {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const x = 90 + Math.cos(angle) * 18;
      const y = 64 + Math.sin(angle) * 18;
      motifs += `<ellipse cx="${round(x)}" cy="${round(y)}" rx="6" ry="10" fill="${rgba(pale, 0.3)}" transform="rotate(${round(angle * 180 / Math.PI)} ${round(x)} ${round(y)})"/>`;
    }
    motifs += `<circle cx="90" cy="64" r="8" fill="${rgba(pale, 0.5)}"/>`;
  } else if (id === 'martyr') {
    motifs += `<path d="M90 40 L90 90" stroke="${rgba(mix(accent, '#8b3a3a', 0.5), 0.5)}" stroke-width="2"/>`;
    motifs += `<path d="M75 55 L105 55" stroke="${rgba(mix(accent, '#8b3a3a', 0.5), 0.5)}" stroke-width="2"/>`;
    motifs += `<circle cx="90" cy="64" r="14" fill="url(#${uid}-glow)" opacity="0.4"/>`;
  } else if (id === 'emberHeart') {
    motifs += `<path d="M90 50 C82 42 70 46 70 58 C70 70 90 82 90 82 C90 82 110 70 110 58 C110 46 98 42 90 50 Z" fill="${rgba(mix(accent, '#d08a5a', 0.5), 0.5)}" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
  } else if (id === 'thornMail') {
    motifs += `<rect x="65" y="48" width="50" height="36" rx="3" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    for (let i = 0; i < 5; i++) {
      const x = 70 + i * 10;
      motifs += `<path d="M${x} 48 L${x+2} 42 L${x+4} 48" fill="${rgba(pale, 0.5)}"/>`;
      motifs += `<path d="M${x} 84 L${x+2} 90 L${x+4} 84" fill="${rgba(pale, 0.5)}"/>`;
    }
  } else if (id === 'brambleLash') {
    motifs += `<path d="M60 80 Q75 65 90 70 T120 60" fill="none" stroke="${rgba(mix(accent, '#7b9a62', 0.5), 0.5)}" stroke-width="2.5"/>`;
    for (let i = 0; i < 4; i++) {
      const x = 70 + i * 15;
      const y = 75 - i * 5;
      motifs += `<path d="M${x} ${y} L${x+3} ${y-5} L${x+6} ${y}" fill="${rgba(pale, 0.4)}"/>`;
    }
  } else if (id === 'briarCrown') {
    motifs += `<circle cx="90" cy="64" r="22" fill="none" stroke="${rgba(mix(accent, '#7b9a62', 0.5), 0.5)}" stroke-width="2.5"/>`;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const x = 90 + Math.cos(angle) * 22;
      const y = 64 + Math.sin(angle) * 22;
      motifs += `<path d="M${round(x)} ${round(y)} L${round(x + Math.cos(angle) * 6)} ${round(y + Math.sin(angle) * 6)}" stroke="${rgba(pale, 0.5)}" stroke-width="1.5"/>`;
    }
  } else if (id === 'lastStand') {
    motifs += `<path d="M75 85 L90 45 L105 85" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2.5"/>`;
    motifs += `<line x1="70" y1="85" x2="110" y2="85" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
  } else if (id === 'starfall') {
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 15;
      const y = 40 + (i % 2) * 20;
      motifs += sparkle(x, y, 4, pale, 0.5);
    }
  } else if (id === 'ashBurst') {
    motifs += `<circle cx="90" cy="64" r="18" fill="${rgba(pale, 0.3)}"/>`;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const x1 = 90 + Math.cos(angle) * 18;
      const y1 = 64 + Math.sin(angle) * 18;
      const x2 = 90 + Math.cos(angle) * 30;
      const y2 = 64 + Math.sin(angle) * 30;
      motifs += `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    }
  } else if (id === 'blight') {
    motifs += `<circle cx="90" cy="64" r="20" fill="${rgba(mix(accent, '#4a6b3a', 0.4), 0.3)}"/>`;
    motifs += `<circle cx="90" cy="64" r="14" fill="${rgba(mix(accent, '#4a6b3a', 0.5), 0.4)}"/>`;
    motifs += `<circle cx="90" cy="64" r="8" fill="${rgba(mix(accent, '#4a6b3a', 0.6), 0.5)}"/>`;
  } else if (id === 'nightWatch') {
    motifs += `<rect x="70" y="45" width="40" height="40" rx="3" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="2.5"/>`;
    motifs += `<circle cx="90" cy="55" r="6" fill="${rgba(pale, 0.5)}"/>`;
  } else if (id === 'dreamDredge') {
    motifs += `<path d="M60 80 Q90 50 120 80" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    motifs += `<path d="M65 75 Q90 55 115 75" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<circle cx="90" cy="68" r="8" fill="${rgba(pale, 0.3)}"/>`;
  } else if (id === 'pierce') {
    motifs += `<path d="M90 35 L90 95" stroke="${rgba(pale, 0.6)}" stroke-width="3"/>`;
    motifs += `<path d="M85 40 L90 35 L95 40" stroke="${rgba(pale, 0.7)}" stroke-width="2" fill="none"/>`;
    motifs += `<circle cx="90" cy="64" r="4" fill="${rgba(pale, 0.5)}"/>`;
  } else if (id === 'springTide') {
    motifs += `<path d="M50 80 Q70 60 90 70 T130 60" fill="none" stroke="${rgba(mix(accent, '#8fb37a', 0.4), 0.4)}" stroke-width="2.5"/>`;
    motifs += `<circle cx="90" cy="70" r="10" fill="${rgba(mix(accent, '#8fb37a', 0.3), 0.3)}"/>`;
  } else if (id === 'brambleWall') {
    motifs += `<rect x="55" y="45" width="70" height="40" rx="3" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="2.5"/>`;
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * 12;
      motifs += `<path d="M${x} 45 L${x+2} 38 L${x+4} 45" fill="${rgba(pale, 0.5)}"/>`;
    }
  } else if (id === 'behead') {
    motifs += `<path d="M70 50 L110 50 L110 70 L70 70 Z" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    motifs += `<path d="M90 50 L90 35" stroke="${rgba(pale, 0.6)}" stroke-width="3"/>`;
    motifs += `<circle cx="90" cy="32" r="5" fill="${rgba(mix(accent, '#8b3a3a', 0.5), 0.5)}"/>`;
  } else if (id === 'reclaim') {
    motifs += `<circle cx="90" cy="64" r="20" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="2" stroke-dasharray="4 4"/>`;
    motifs += `<path d="M80 64 L90 54 L100 64 L90 74 Z" fill="${rgba(pale, 0.3)}"/>`;
  } else if (id === 'returnBlade') {
    motifs += `<path d="M70 80 Q90 50 110 80" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2.5"/>`;
    motifs += `<path d="M110 80 L105 75 M110 80 L115 75" stroke="${rgba(pale, 0.6)}" stroke-width="2"/>`;
  } else if (id === 'dawnForm') {
    motifs += `<circle cx="90" cy="50" r="16" fill="${rgba(pale, 0.3)}"/>`;
    for (let i = 0; i < 3; i++) {
      const x = 75 + i * 15;
      motifs += `<path d="M${x} 70 L${x} 90" stroke="${rgba(pale, 0.5)}" stroke-width="2"/>`;
    }
  } else if (id === 'starWeave') {
    motifs += `<circle cx="75" cy="55" r="4" fill="${rgba(pale, 0.5)}"/>`;
    motifs += `<circle cx="105" cy="55" r="4" fill="${rgba(pale, 0.5)}"/>`;
    motifs += `<circle cx="90" cy="75" r="4" fill="${rgba(pale, 0.5)}"/>`;
    motifs += `<path d="M75 55 L105 55 L90 75 Z" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
  } else if (id === 'grandOrrery') {
    motifs += `<circle cx="90" cy="64" r="28" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<circle cx="90" cy="64" r="20" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
    motifs += `<circle cx="90" cy="64" r="12" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="1.5"/>`;
    motifs += `<circle cx="90" cy="64" r="4" fill="${rgba(pale, 0.6)}"/>`;
  } else if (id === 'creepingVenom') {
    motifs += `<path d="M60 80 Q75 70 85 75 T110 65 T130 70" fill="none" stroke="${rgba(mix(accent, '#4a6b3a', 0.5), 0.5)}" stroke-width="2.5" stroke-dasharray="3 3"/>`;
    motifs += `<circle cx="130" cy="70" r="5" fill="${rgba(mix(accent, '#4a6b3a', 0.6), 0.6)}"/>`;
  } else if (id === 'bloomRelease') {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const x = 90 + Math.cos(angle) * 20;
      const y = 64 + Math.sin(angle) * 20;
      motifs += `<circle cx="${round(x)}" cy="${round(y)}" r="6" fill="${rgba(mix(accent, '#4a6b3a', 0.4), 0.3)}"/>`;
    }
    motifs += `<circle cx="90" cy="64" r="10" fill="${rgba(mix(accent, '#4a6b3a', 0.5), 0.5)}"/>`;
  } else if (id === 'bloodAsh') {
    motifs += `<circle cx="90" cy="55" r="12" fill="${rgba(mix(accent, '#8b3a3a', 0.5), 0.4)}"/>`;
    motifs += `<path d="M85 70 Q90 80 95 70" fill="${rgba(pale, 0.4)}"/>`;
    motifs += `<path d="M80 75 Q90 90 100 75" fill="${rgba(pale, 0.3)}"/>`;
  } else if (id === 'pyreOath') {
    motifs += `<path d="M75 50 L105 50 L105 80 L75 80 Z" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    motifs += `<path d="M85 80 Q90 60 95 80" fill="${rgba(pale, 0.5)}"/>`;
    motifs += `<circle cx="90" cy="65" r="8" fill="url(#${uid}-glow)" opacity="0.5"/>`;
  } else if (id === 'quickStrike') {
    motifs += `<path d="M80 80 L90 40 L100 80" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2.5"/>`;
    motifs += `<path d="M85 45 L90 40 L95 45" stroke="${rgba(pale, 0.6)}" stroke-width="2" fill="none"/>`;
  } else if (id === 'resolveStrike') {
    motifs += `<path d="M90 35 L90 95" stroke="${rgba(pale, 0.5)}" stroke-width="2.5"/>`;
    motifs += `<path d="M85 40 L90 35 L95 40" stroke="${rgba(pale, 0.6)}" stroke-width="2" fill="none"/>`;
    motifs += `<circle cx="90" cy="65" r="10" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
  } else if (id === 'afterimage') {
    motifs += `<path d="M70 80 L90 40 L110 80" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="2"/>`;
    motifs += `<path d="M75 80 L90 45 L105 80" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2"/>`;
    motifs += `<path d="M80 80 L90 50 L100 80" fill="none" stroke="${rgba(pale, 0.7)}" stroke-width="2"/>`;
  } else if (id === 'whetEdge') {
    motifs += `<path d="M75 85 L90 40 L105 85" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2.5"/>`;
    motifs += `<line x1="70" y1="90" x2="110" y2="90" stroke="${rgba(pale, 0.4)}" stroke-width="3"/>`;
    motifs += `<circle cx="90" cy="65" r="8" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
  } else if (id === 'glint') {
    motifs += sparkle(90, 64, 6, pale, 0.6);
    motifs += `<circle cx="90" cy="64" r="12" fill="url(#${uid}-glow)" opacity="0.4"/>`;
  } else if (id === 'starlitCodex') {
    motifs += `<rect x="70" y="45" width="40" height="50" rx="2" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    motifs += `<line x1="75" y1="55" x2="105" y2="55" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
    motifs += `<line x1="75" y1="65" x2="105" y2="65" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
    motifs += `<line x1="75" y1="75" x2="105" y2="75" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
    motifs += sparkle(90, 40, 4, pale, 0.5);
  } else if (id === 'starshield') {
    motifs += `<circle cx="90" cy="64" r="30" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2.5"/>`;
    motifs += `<circle cx="90" cy="64" r="24" fill="${rgba(pale, 0.15)}"/>`;
    motifs += `<path d="M90 40 L90 88 M66 64 L114 64" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
  } else if (id === 'constellation') {
    const points = [[70, 50], [90, 40], [110, 50], [105, 70], [90, 80], [75, 70]];
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      motifs += `<circle cx="${x}" cy="${y}" r="3" fill="${rgba(pale, 0.6)}"/>`;
      if (i < points.length - 1) {
        const [nx, ny] = points[i + 1];
        motifs += `<line x1="${x}" y1="${y}" x2="${nx}" y2="${ny}" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
      }
    }
    motifs += `<line x1="${points[points.length - 1][0]}" y1="${points[points.length - 1][1]}" x2="${points[0][0]}" y2="${points[0][1]}" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
  } else if (id === 'venomSpray') {
    for (let i = 0; i < 6; i++) {
      const x = 60 + i * 12;
      const y = 60 + Math.sin(i * 1.5) * 15;
      motifs += `<circle cx="${x}" cy="${y}" r="${4 + i}" fill="${rgba(mix(accent, '#4a6b3a', 0.4), 0.2 + i * 0.05)}"/>`;
    }
  } else if (id === 'corrode') {
    motifs += `<circle cx="90" cy="64" r="22" fill="${rgba(mix(accent, '#4a6b3a', 0.4), 0.3)}"/>`;
    motifs += `<circle cx="90" cy="64" r="16" fill="${rgba(mix(accent, '#4a6b3a', 0.5), 0.4)}"/>`;
    motifs += `<path d="M75 64 L105 64 M90 49 L90 79" stroke="${rgba(mix(accent, '#4a6b3a', 0.6), 0.5)}" stroke-width="2"/>`;
  } else if (id === 'shadowFang') {
    motifs += `<path d="M80 40 L80 88" stroke="${rgba(mix(accent, '#4a6b3a', 0.5), 0.5)}" stroke-width="2.5"/>`;
    motifs += `<path d="M100 40 L100 88" stroke="${rgba(mix(accent, '#4a6b3a', 0.5), 0.5)}" stroke-width="2.5"/>`;
    motifs += `<circle cx="80" cy="85" r="4" fill="${rgba(mix(accent, '#4a6b3a', 0.6), 0.6)}"/>`;
    motifs += `<circle cx="100" cy="85" r="4" fill="${rgba(mix(accent, '#4a6b3a', 0.6), 0.6)}"/>`;
  } else if (id === 'fadeAway') {
    motifs += `<circle cx="90" cy="64" r="24" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="2" stroke-dasharray="4 4"/>`;
    motifs += `<circle cx="90" cy="64" r="18" fill="none" stroke="${rgba(pale, 0.2)}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    motifs += `<circle cx="90" cy="64" r="12" fill="${rgba(pale, 0.15)}"/>`;
  } else if (id === 'scorch') {
    motifs += `<path d="M85 80 Q90 60 95 80" fill="${rgba(pale, 0.5)}"/>`;
    motifs += `<path d="M80 85 Q90 55 100 85" fill="${rgba(pale, 0.4)}"/>`;
    motifs += `<circle cx="90" cy="70" r="10" fill="url(#${uid}-glow)" opacity="0.5"/>`;
  } else if (id === 'bloodPyre') {
    motifs += `<circle cx="90" cy="55" r="14" fill="${rgba(mix(accent, '#8b3a3a', 0.5), 0.4)}"/>`;
    motifs += `<path d="M80 75 Q90 50 100 75" fill="${rgba(pale, 0.5)}"/>`;
    motifs += `<path d="M75 80 Q90 45 105 80" fill="${rgba(pale, 0.3)}"/>`;
  } else if (id === 'cinderWard') {
    motifs += `<rect x="65" y="45" width="50" height="40" rx="3" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    motifs += `<path d="M85 85 Q90 70 95 85" fill="${rgba(pale, 0.4)}"/>`;
    motifs += `<circle cx="90" cy="65" r="8" fill="url(#${uid}-glow)" opacity="0.4"/>`;
  } else if (id === 'infernoCrown') {
    motifs += `<circle cx="90" cy="50" r="18" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * i) / 4 - Math.PI / 2;
      const x = 90 + Math.cos(angle) * 18;
      const y = 50 + Math.sin(angle) * 18;
      motifs += `<path d="M${round(x)} ${round(y)} L${round(x)} ${round(y - 10)}" stroke="${rgba(pale, 0.5)}" stroke-width="2"/>`;
      motifs += `<circle cx="${round(x)}" cy="${round(y - 12)}" r="3" fill="${rgba(pale, 0.6)}"/>`;
    }
  } else if (id === 'lampWard') {
    motifs += `<circle cx="90" cy="50" r="12" fill="${rgba(pale, 0.4)}"/>`;
    motifs += `<circle cx="90" cy="50" r="18" fill="url(#${uid}-glow)" opacity="0.5"/>`;
    motifs += `<rect x="85" y="62" width="10" height="20" rx="2" fill="${rgba(pale, 0.3)}"/>`;
  } else if (id === 'keeperFlame') {
    motifs += `<rect x="85" y="60" width="10" height="25" rx="2" fill="${rgba(pale, 0.3)}"/>`;
    motifs += `<path d="M85 60 Q90 45 95 60" fill="${rgba(pale, 0.6)}"/>`;
    motifs += `<circle cx="90" cy="50" r="10" fill="url(#${uid}-glow)" opacity="0.6"/>`;
  } else if (id === 'ferryFare') {
    motifs += `<circle cx="90" cy="64" r="10" fill="${rgba(mix(accent, '#c29d62', 0.6), 0.5)}"/>`;
    motifs += `<circle cx="90" cy="64" r="14" fill="none" stroke="${rgba(mix(accent, '#c29d62', 0.5), 0.4)}" stroke-width="1.5"/>`;
    motifs += sparkle(90, 64, 5, mix(accent, '#c29d62', 0.6), 0.5);
  } else if (id === 'mistChart') {
    motifs += `<rect x="65" y="45" width="50" height="40" rx="2" fill="${rgba(pale, 0.15)}" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<path d="M70 55 L80 60 L90 55 L100 60 L110 55" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="1"/>`;
    motifs += `<path d="M70 65 L80 70 L90 65 L100 70 L110 65" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
    motifs += `<circle cx="90" cy="65" r="3" fill="${rgba(pale, 0.5)}"/>`;
  } else if (id === 'tornPage') {
    motifs += `<path d="M70 45 L110 45 L105 85 L75 85 Z" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
    motifs += `<path d="M105 45 L110 45 L105 50" fill="${rgba(pale, 0.15)}"/>`;
    motifs += `<line x1="80" y1="55" x2="100" y2="55" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
    motifs += `<line x1="80" y1="65" x2="95" y2="65" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
  } else if (id === 'inkEcho') {
    motifs += `<circle cx="90" cy="64" r="20" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    motifs += `<circle cx="90" cy="64" r="14" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="1" stroke-dasharray="2 2"/>`;
    motifs += `<circle cx="90" cy="64" r="6" fill="${rgba(pale, 0.5)}"/>`;
  } else if (id === 'lastFlame') {
    motifs += `<path d="M85 80 Q90 60 95 80" fill="${rgba(pale, 0.6)}"/>`;
    motifs += `<path d="M80 85 Q90 55 100 85" fill="${rgba(pale, 0.4)}"/>`;
    motifs += `<circle cx="90" cy="70" r="12" fill="url(#${uid}-glow)" opacity="0.6"/>`;
  } else if (id === 'dawnEmber') {
    motifs += `<circle cx="90" cy="50" r="16" fill="${rgba(pale, 0.4)}"/>`;
    motifs += `<circle cx="90" cy="50" r="22" fill="url(#${uid}-glow)" opacity="0.5"/>`;
    motifs += `<path d="M80 75 Q90 60 100 75" fill="${rgba(pale, 0.5)}"/>`;
  } else if (id === 'deepChart') {
    motifs += `<rect x="65" y="45" width="50" height="40" rx="2" fill="${rgba(pale, 0.15)}" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<path d="M70 60 Q90 50 110 60" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
    motifs += `<path d="M70 70 Q90 80 110 70" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
    motifs += `<circle cx="90" cy="65" r="3" fill="${rgba(pale, 0.5)}"/>`;
  } else if (id === 'slowOar') {
    motifs += `<path d="M70 80 L110 50" stroke="${rgba(pale, 0.5)}" stroke-width="3" stroke-linecap="round"/>`;
    motifs += `<ellipse cx="110" cy="50" rx="8" ry="4" fill="${rgba(pale, 0.4)}" transform="rotate(-30 110 50)"/>`;
  } else if (id === 'ashPage') {
    motifs += `<path d="M70 45 L110 45 L105 85 L75 85 Z" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
    motifs += `<path d="M75 85 L80 80 L85 85 L90 80 L95 85" fill="none" stroke="${rgba(mix(accent, '#4a6b3a', 0.4), 0.5)}" stroke-width="1"/>`;
    motifs += `<line x1="80" y1="55" x2="100" y2="55" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
  } else if (id === 'namedPage') {
    motifs += `<rect x="70" y="45" width="40" height="50" rx="2" fill="${rgba(pale, 0.2)}" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
    motifs += `<line x1="75" y1="55" x2="105" y2="55" stroke="${rgba(pale, 0.4)}" stroke-width="1"/>`;
    motifs += `<line x1="75" y1="65" x2="105" y2="65" stroke="${rgba(pale, 0.4)}" stroke-width="1"/>`;
    motifs += `<line x1="75" y1="75" x2="95" y2="75" stroke="${rgba(pale, 0.4)}" stroke-width="1"/>`;
    motifs += `<circle cx="90" cy="85" r="3" fill="${rgba(pale, 0.5)}"/>`;
  } else if (id === 'moonScript') {
    motifs += `<circle cx="90" cy="50" r="14" fill="${rgba(pale, 0.3)}"/>`;
    motifs += `<circle cx="85" cy="48" r="12" fill="${rgba(darken(accent, 0.7), 0.8)}"/>`;
    motifs += `<rect x="70" y="68" width="40" height="20" rx="2" fill="${rgba(pale, 0.15)}" stroke="${rgba(pale, 0.3)}" stroke-width="1"/>`;
    motifs += `<line x1="75" y1="75" x2="105" y2="75" stroke="${rgba(pale, 0.3)}" stroke-width="0.8"/>`;
    motifs += `<line x1="75" y1="80" x2="100" y2="80" stroke="${rgba(pale, 0.3)}" stroke-width="0.8"/>`;
  } else if (id === 'tideSigil') {
    motifs += `<circle cx="90" cy="64" r="22" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    motifs += `<path d="M70 64 Q90 50 110 64" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="1.5"/>`;
    motifs += `<path d="M70 64 Q90 78 110 64" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="1.5"/>`;
    motifs += `<circle cx="90" cy="64" r="6" fill="${rgba(pale, 0.4)}"/>`;
  } else if (id === 'voidLamp') {
    motifs += `<rect x="85" y="60" width="10" height="25" rx="2" fill="${rgba(pale, 0.2)}"/>`;
    motifs += `<circle cx="90" cy="55" r="10" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="1.5"/>`;
    motifs += `<circle cx="90" cy="55" r="14" fill="url(#${uid}-glow)" opacity="0.3"/>`;
  } else if (id === 'heartSigil') {
    motifs += `<path d="M90 50 C82 42 70 46 70 58 C70 70 90 82 90 82 C90 82 110 70 110 58 C110 46 98 42 90 50 Z" fill="${rgba(mix(accent, '#8b3a3a', 0.4), 0.5)}" stroke="${rgba(pale, 0.5)}" stroke-width="2"/>`;
    motifs += `<circle cx="90" cy="64" r="8" fill="${rgba(pale, 0.4)}"/>`;
  } else if (id === 'sevenCompass') {
    motifs += `<circle cx="90" cy="64" r="24" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<circle cx="90" cy="64" r="18" fill="none" stroke="${rgba(pale, 0.4)}" stroke-width="1"/>`;
    for (let i = 0; i < 7; i++) {
      const angle = (Math.PI * 2 * i) / 7;
      const x = 90 + Math.cos(angle) * 24;
      const y = 64 + Math.sin(angle) * 24;
      motifs += `<circle cx="${round(x)}" cy="${round(y)}" r="2.5" fill="${rgba(pale, 0.5)}"/>`;
    }
    motifs += `<path d="M90 64 L90 40" stroke="${rgba(pale, 0.6)}" stroke-width="2"/>`;
  } else if (id === 'farewellKey') {
    motifs += `<circle cx="80" cy="55" r="8" fill="none" stroke="${rgba(mix(accent, '#c29d62', 0.5), 0.5)}" stroke-width="2"/>`;
    motifs += `<path d="M88 55 L110 55 L110 60 L105 60 L105 65 L100 65 L100 60 L88 60 Z" fill="${rgba(mix(accent, '#c29d62', 0.5), 0.5)}"/>`;
  } else if (id === 'mistVeil') {
    for (let i = 0; i < 4; i++) {
      const y = 50 + i * 12;
      motifs += `<path d="M50 ${y} Q70 ${y-5} 90 ${y} T130 ${y}" fill="none" stroke="${rgba(pale, 0.2 + i * 0.05)}" stroke-width="2"/>`;
    }
  } else if (id === 'deepSlumber') {
    motifs += `<circle cx="90" cy="64" r="22" fill="${rgba(pale, 0.15)}"/>`;
    motifs += `<path d="M75 64 Q90 50 105 64" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += `<path d="M75 64 Q90 78 105 64" fill="none" stroke="${rgba(pale, 0.3)}" stroke-width="1.5"/>`;
    motifs += sparkle(90, 64, 5, pale, 0.4);
  } else if (id === 'islandCrown') {
    motifs += `<circle cx="90" cy="55" r="18" fill="none" stroke="${rgba(mix(accent, '#c29d62', 0.5), 0.5)}" stroke-width="2.5"/>`;
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * i) / 4 - Math.PI / 2;
      const x = 90 + Math.cos(angle) * 18;
      const y = 55 + Math.sin(angle) * 18;
      motifs += `<path d="M${round(x)} ${round(y)} L${round(x)} ${round(y - 8)}" stroke="${rgba(mix(accent, '#c29d62', 0.6), 0.6)}" stroke-width="2"/>`;
      motifs += `<circle cx="${round(x)}" cy="${round(y - 10)}" r="2.5" fill="${rgba(mix(accent, '#c29d62', 0.7), 0.7)}"/>`;
    }
  } else if (id === 'relicChorus') {
    const items = [[70, 55], [110, 55], [90, 75], [75, 80], [105, 80]];
    for (const [x, y] of items) {
      motifs += `<circle cx="${x}" cy="${y}" r="5" fill="${rgba(pale, 0.4)}"/>`;
      motifs += `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${rgba(pale, 0.25)}" stroke-width="1"/>`;
    }
  } else if (id === 'thornDiadem') {
    motifs += `<path d="M62 76 Q90 48 118 76" fill="none" stroke="${rgba(pale, 0.45)}" stroke-width="2.5"/>`;
    for (let i = 0; i < 6; i++) {
      const x = 66 + i * 10;
      const y = 72 - Math.sin((i / 5) * Math.PI) * 16;
      motifs += `<path d="M${x} ${y} L${x + 2} ${y - 10} L${x + 5} ${y}" fill="${rgba(mix(accent, '#7f8f6a', 0.5), 0.55)}"/>`;
    }
    motifs += `<circle cx="90" cy="80" r="7" fill="${rgba(pale, 0.4)}"/>`;
  } else if (id === 'drownedAnchor') {
    motifs += `<circle cx="90" cy="48" r="6" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2"/>`;
    motifs += `<path d="M90 54 L90 94" stroke="${rgba(pale, 0.55)}" stroke-width="3"/>`;
    motifs += `<path d="M72 78 Q90 98 108 78" fill="none" stroke="${rgba(pale, 0.45)}" stroke-width="3"/>`;
    motifs += `<path d="M72 78 L64 84 M108 78 L116 84" stroke="${rgba(pale, 0.4)}" stroke-width="2"/>`;
    motifs += `<path d="M58 58 Q70 66 82 58 T106 58 T130 58" fill="none" stroke="${rgba(mix(accent, '#587d8f', 0.5), 0.35)}" stroke-width="2"/>`;
  } else if (id === 'hushBox') {
    motifs += `<rect x="66" y="56" width="48" height="34" rx="3" fill="${rgba(pale, 0.16)}" stroke="${rgba(pale, 0.45)}" stroke-width="2"/>`;
    motifs += `<path d="M66 56 L90 72 L114 56" fill="none" stroke="${rgba(pale, 0.5)}" stroke-width="2"/>`;
    motifs += `<path d="M82 78 Q90 84 98 78" fill="none" stroke="${rgba(mix(accent, '#8f6d78', 0.5), 0.6)}" stroke-width="2"/>`;
    motifs += `<line x1="90" y1="88" x2="90" y2="96" stroke="${rgba(pale, 0.35)}" stroke-width="2"/>`;
  } else if (id === 'backlightEdge') {
    motifs += `<circle cx="90" cy="52" r="18" fill="${rgba(mix(accent, '#e0b06a', 0.5), 0.3)}"/>`;
    motifs += `<circle cx="90" cy="52" r="26" fill="url(#${uid}-glow)" opacity="0.4"/>`;
    motifs += `<path d="M62 92 L118 44" stroke="${rgba(pale, 0.7)}" stroke-width="3"/>`;
    motifs += `<path d="M62 92 L74 90 L68 84 Z" fill="${rgba(pale, 0.5)}"/>`;
    motifs += `<path d="M106 48 L118 44 L114 56 Z" fill="${rgba(pale, 0.75)}"/>`;
  } else if (id === 'abyssSeed') {
    motifs += `<circle cx="90" cy="68" r="22" fill="${rgba(mix(accent, '#5f2c3f', 0.5), 0.28)}" stroke="${rgba(pale, 0.35)}" stroke-width="1.5"/>`;
    motifs += `<path d="M90 88 Q78 72 84 58 Q90 48 90 40 Q96 52 100 60 Q106 74 90 88 Z" fill="${rgba(pale, 0.45)}"/>`;
    motifs += `<path d="M90 84 L90 54" stroke="${rgba(mix(accent, '#d8b58a', 0.5), 0.5)}" stroke-width="1.5"/>`;
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      motifs += `<circle cx="${round(90 + Math.cos(angle) * 30)}" cy="${round(68 + Math.sin(angle) * 30)}" r="1.8" fill="${rgba(pale, 0.4)}"/>`;
    }
  }
  
  return motifs;
}

export function cardArt(card) {
  const id = String(card?.id || '');
  const upgraded = Boolean(card?.upgraded);
  const custom = id ? peekCardArt(id) : '';
  const bundled = custom ? null : CARD_ART[id];
  const src = custom || (upgraded && bundled?.up ? bundled.up : bundled?.src) || '';
  if (src) {
    const video = custom ? '' : (upgraded ? bundled?.upVideo || '' : bundled?.video || '');
    return liveArt(src, {
      className: 'card-art',
      upgraded,
      video,
      seed: `${id}:${upgraded ? 'up' : 'base'}`,
      variant: 'card',
    });
  }
  const accent = safeColor(card?.accent || card?.palette || '#8d84a0');
  const school = SCENES[card?.school] ? card.school : 'dream';
  const seed = hashText(`${card?.id || card?.name || 'dream'}:${card?.school || ''}`);
  const rng = rngFrom(seed);
  const uid = `cardart${(artSeq += 1)}`;
  const baseScene = SCENES[school](rng, accent, uid);
  const motifs = cardMotifs(card, rng, accent, uid);
  return `<svg class="card-art" viewBox="0 0 180 128" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${baseScene}${motifs}</svg>`;
}

/** 这张卡是否已经有 AI 卡面（自带素材或玩家在造物工坊生成过） */
export function cardArtSource(card) {
  const id = String(card?.id || '');
  if (!id) return '';
  return peekCardArt(id) || CARD_ART[id]?.src || '';
}

export function cardIndex(card) {
  const seed = hashText(card?.id || card?.name || 'dream');
  return String((seed % 89) + 1).padStart(2, '0');
}
