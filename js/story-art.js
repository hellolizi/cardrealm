const ART_ROOT = 'assets/story/';
const image = (name) => `${ART_ROOT}${name}.webp`;
const prop = (name, alt, label) => ({ src: image(name), alt, label });

/**
 * 剧情里会开口的人。立绘只画到这里为止——
 * 旁白不说话，也不该有一张脸；「你」用的始终是玩家自己的形象。
 */
export const STORY_CAST = {
  '灯守 · 烬': { src: image('npc-ember'), focus: '46% 38%', tone: 'ember', accent: '#d98a58' },
  '摆渡人 · 舟': { src: image('npc-ferry'), focus: '52% 48%', tone: 'ferry', accent: '#6fa8a2' },
  '拾页者 · 墨': { src: image('npc-ink'), focus: '16% 42%', tone: 'ink', accent: '#b48bc9' },
  '烬 · 十二年前': {
    src: image('npc-ember-young'),
    focus: '50% 32%',
    tone: 'memory',
    accent: '#c9a06a',
    label: '十二年前的烬',
  },
  '隙': { src: image('npc-rift'), focus: '50% 38%', tone: 'rift', accent: '#8fb6c9' },
  '梦魇之主': { src: image('npc-nightmare-lord'), focus: '50% 32%', tone: 'nightmare', accent: '#c86b58' },
  '缄默之心': { src: image('npc-heart'), focus: '50% 40%', tone: 'heart', accent: '#d6a08f' },
  '古龙': { src: image('npc-dragon'), focus: '50% 34%', tone: 'dragon', accent: '#c8a45e' },
};

/**
 * 每段回忆的场景、道具与镜头切换点。
 *
 * `beats` 按行号记录「从这一句开始换景」。之后的台词会沿用最近一次换景，
 * 直到下一次换景——这样只需要标转折，不必给每句话重复贴图。
 * 行号以 story.lines 为准；奶蛙蛙追加的台词接在末尾，同样可以标。
 */
export const STORY_ART = {
  'ng-plus': {
    background: image('ng-plus-corridor'),
    props: {
      lantern: prop('lantern', '灯罩上有一道旧裂痕的灯', '旧灯'),
    },
    beats: {
      0: { prop: 'lantern' },
    },
  },
  intro: {
    background: image('lighthouse'),
    scenes: {
      lighthouse: image('lighthouse'),
      shipwreck: image('shipwreck'),
    },
    props: {
      clock: prop('clock', '停在三点十七分的黄铜钟', '三点十七分'),
      ticket: prop('ticket', '白鹭号登船凭据，日期三月十七', '白鹭号 · 03/17'),
    },
    beats: {
      8: { scene: 'lighthouse' },
    },
  },
  'intro-deep': {
    background: image('lamp-room'),
    props: {
      lantern: prop('lantern-deep', '灯室深处只剩一线灯芯的旧灯', '旧灯 · 灯室'),
    },
    beats: {
      14: { prop: 'lantern' },
    },
  },
  departure: {
    background: image('departure'),
    scenes: {
      light: image('departure-light'),
      departure: image('departure'),
    },
    beats: {
      0: { scene: 'light' },
      1: { scene: 'departure' },
    },
  },
  'dragon-falls': {
    background: image('dragon-falls'),
    scenes: {
      fall: image('dragon-falls'),
      sea: image('dragon-sea'),
    },
    props: {
      needle: prop('needle', '烧黑的铜钟针，停在三点十七分', '钟针 · 03:17'),
    },
    beats: {
      1: { prop: 'needle' },
      8: { scene: 'sea' },
      10: { scene: 'fall' },
    },
  },
  'mist-name': {
    background: image('mist-shore'),
    props: {
      ticket: prop('ticket-mist', '被雾泡软的船票，日期三月十七', '船票 · 03/17'),
    },
    beats: {
      4: { prop: 'ticket' },
      10: { prop: 'ticket' },
    },
  },
  'bone-crown': {
    background: image('bone-hall'),
    props: {
      crown: prop('crown', '轻得像一页纸的骨冠', '王冠 · 一页纸'),
    },
    beats: {
      0: { prop: 'crown' },
      4: { prop: 'crown' },
    },
  },
  'mirror-self': {
    background: image('mirror-field'),
    scenes: {
      field: image('mirror-field'),
      rain: image('mirror-rain'),
      heart: image('mirror-heart'),
      lighthouse: image('mirror-lighthouse'),
    },
    beats: {
      1: { scene: 'rain' },
      6: { scene: 'field' },
      10: { scene: 'heart' },
      11: { scene: 'lighthouse' },
    },
  },
  'third-night': {
    background: image('storm-night'),
    scenes: {
      storm: image('storm-night'),
      light: image('third-night-light'),
      sea: image('third-night-sea'),
      log: image('third-night-log'),
    },
    props: {
      clock: prop('clock-night', '停在三点十七分的黄铜钟', '三点十七分'),
    },
    beats: {
      2: { scene: 'light' },
      5: { scene: 'sea' },
      7: { scene: 'log' },
      9: { scene: 'light' },
      10: { scene: 'light', prop: 'clock' },
    },
  },
  'ash-names': {
    background: image('ash-lighthouse'),
    scenes: {
      ash: image('ash-lighthouse'),
      light: image('ash-light'),
      sea: image('ash-sea'),
    },
    beats: {
      3: { scene: 'light' },
      4: { scene: 'sea' },
      5: { scene: 'ash' },
    },
  },
  'tide-bell': {
    background: image('tide-clocktower'),
    scenes: {
      tower: image('tide-clocktower'),
      dock: image('tide-dock'),
    },
    props: {
      clock: prop('clock-318', '终于走向三点十八分的潮钟', '潮钟 · 03:18'),
    },
    beats: {
      1: { prop: 'clock' },
      5: { scene: 'dock' },
      14: { scene: 'tower' },
    },
  },
  'moon-script': {
    background: image('paper-moon'),
    scenes: {
      moon: image('paper-moon'),
      desk: image('moon-desk'),
    },
    props: {
      page: prop('page-moon', '只划掉了一行的旧稿纸', '最旧的一页'),
      blank: prop('page-last', '还空着的最后一页', '最后一页'),
      names: prop('page-names', '写满名字、只空着一行的最后一页', '最后一页'),
    },
    beats: {
      1: { scene: 'desk' },
      7: { scene: 'desk', prop: 'page' },
      11: { scene: 'moon' },
      12: { prop: 'blank' },
      16: { prop: 'names' },
    },
  },
  'fifth-night': {
    background: image('rain-table'),
    props: {
      lantern: prop('lantern-rain', '雨夜里仍亮着的旧灯', '旧灯 · 雨'),
    },
    beats: {
      1: { prop: 'lantern' },
    },
  },
  'heart-call': {
    background: image('heart-dock'),
    scenes: {
      light: image('heart-light'),
      dock: image('heart-dock'),
      heart: image('heart-sea'),
    },
    props: {
      lantern: prop('lantern-gold', '裂痕被金线补过的旧灯', '旧灯 · 金线'),
    },
    beats: {
      0: { scene: 'light' },
      6: { prop: 'lantern' },
      9: { scene: 'dock' },
      10: { scene: 'heart' },
    },
  },
  'parley-echo': {
    background: image('parley-storm'),
    scenes: {
      storm: image('parley-storm'),
      sea: image('parley-sea'),
    },
    beats: {
      9: { scene: 'sea' },
    },
  },
  'parley-chorus': {
    background: image('chorus-table'),
    scenes: {
      table: image('chorus-table'),
      heart: image('chorus-heart'),
    },
    beats: {
      11: { scene: 'heart' },
      12: { scene: 'table' },
    },
  },
  'parley-rift-reason': {
    background: image('rift-sea'),
    props: {
      'blank-card': prop('blank-card', '只写着一行细字的空白牌', '空白牌 · 定金'),
    },
    beats: {
      8: { prop: 'blank-card' },
      12: { prop: 'blank-card' },
    },
  },
  'parley-rift-empathy': {
    background: image('rift-empathy'),
    scenes: {
      rift: image('rift-empathy'),
      light: image('rift-empathy-light'),
    },
    beats: {
      8: { scene: 'light' },
      12: { scene: 'rift' },
    },
  },
  'parley-rift-threat': {
    background: image('rift-threat'),
  },
  'parley-rift-bribe': {
    background: image('rift-bribe'),
    props: {
      coin: prop('coin', '被摩挲得没有图案的旧币', '旧币 · 无面'),
    },
    beats: {
      0: { prop: 'coin' },
      4: { prop: 'coin' },
      12: { prop: 'coin' },
    },
  },
  'defeat-first': {
    background: image('dark-sea'),
    scenes: {
      sea: image('dark-sea'),
      light: image('defeat-first-light'),
    },
    props: {
      lantern: prop('lantern-defeat', '灯罩添了新裂痕的旧灯', '旧灯 · 新痕'),
    },
    beats: {
      4: { prop: 'lantern' },
      7: { scene: 'light' },
    },
  },
  'defeat-elite': {
    background: image('defeat-mirror'),
    props: {
      page: prop('page-face', '描着那张脸的稿纸', '描下来的脸'),
    },
    beats: {
      6: { prop: 'page' },
    },
  },
  'defeat-boss': {
    background: image('defeat-bone'),
  },
  'defeat-many': {
    background: image('ink-desk'),
    props: {
      page: prop('page', '越写越厚的一叠稿纸', '第 3722 页'),
    },
    beats: {
      4: { prop: 'page' },
    },
  },
  'defeat-heart': {
    background: image('defeat-heart-sea'),
    scenes: {
      heart: image('defeat-heart-sea'),
      chain: image('defeat-heart-sea2'),
      light: image('defeat-heart-light'),
    },
    beats: {
      4: { scene: 'chain' },
      5: { scene: 'light' },
    },
  },
};

export function storyArtFor(storyId) {
  return STORY_ART[storyId] || null;
}

/** 当前这句是谁的脸；旁白沿用上一位开口的人，让画面不至于突然空掉。 */
export function storyCastFor(who, { heroSrc = '', heroName = '' } = {}) {
  if (who === '你' && heroSrc) {
    return {
      src: heroSrc,
      focus: '50% 26%',
      tone: 'self',
      accent: '#c2a46d',
      label: heroName || '你',
    };
  }
  return STORY_CAST[who] || null;
}

export function storyPortraitAt(art, lines, index, hero) {
  if (!art) return null;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const who = lines[cursor]?.who;
    if (!who || who === '旁白') continue;
    const cast = storyCastFor(who, hero);
    if (!cast) continue;
    return { ...cast, who, speaking: who === lines[index]?.who };
  }
  return null;
}

export function storyBeatAt(art, index) {
  return art?.beats?.[index] || null;
}

/** 换景只需要标转折点，之后一路沿用，直到下一次转折。 */
export function storySceneAt(art, lines, index) {
  if (!art) return null;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const key = lines[cursor]?.scene || art.beats?.[cursor]?.scene;
    const src = key && art.scenes?.[key];
    if (src) return { key, src };
  }
  return art.background ? { key: 'background', src: art.background } : null;
}

export function storyPropAt(art, lines, index) {
  const key = lines[index]?.prop || art?.beats?.[index]?.prop;
  return key && art?.props?.[key] ? art.props[key] : null;
}

/** 弹窗打开时一次性预热这段回忆会用到的图，翻页时才不会闪白。 */
export function storyPreloads(art, lines, hero) {
  if (!art) return [];
  const sources = new Set();
  if (art.background) sources.add(art.background);
  Object.values(art.scenes || {}).forEach((src) => src && sources.add(src));
  Object.values(art.props || {}).forEach((item) => item?.src && sources.add(item.src));
  const seen = new Set();
  lines.forEach((line) => {
    if (!line?.who || seen.has(line.who)) return;
    seen.add(line.who);
    const cast = storyCastFor(line.who, hero);
    if (cast?.src) sources.add(cast.src);
  });
  return [...sources];
}
