import { AI_STYLE_MAP, SCHOOLS } from './data.js';
import { imageToCardDataUrl, imageToSquareDataUrl, loadImageElement, randomInt } from './utils.js';

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function friendlyAiError(error, status = 0, body = '') {
  if (error?.name === 'AbortError') {
    return '生成等待超时了。可以稍后重试，或换一个更快的接口。';
  }
  if (status === 401 || status === 403) {
    return 'API Key 无效、缺少权限，或账户余额不足。';
  }
  if (status === 429) {
    return '接口正在限流，请稍后再试。';
  }
  if (status >= 500) {
    return '生图服务器暂时不可用，请稍后再试。';
  }
  if (status) {
    const detail = String(body || '').replace(/\s+/g, ' ').slice(0, 240);
    return `生图接口返回 ${status}。${detail ? ` ${detail}` : ''}`;
  }
  if (error instanceof TypeError) {
    return '无法连接生图接口，可能是网络问题或浏览器跨域（CORS）限制。';
  }
  return error?.message || '生成失败，请稍后重试。';
}

function endpointFor(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('请先填写生图接口地址。');
  if (/\/images\/generations$/i.test(trimmed)) return trimmed;
  if (/\/v\d+$/i.test(trimmed)) return `${trimmed}/images/generations`;
  return `${trimmed}/v1/images/generations`;
}

async function urlToCompressedDataUrl(url, shape = 'square') {
  const response = await fetch(url);
  if (!response.ok) throw new Error('无法读取生成的图片');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('接口返回的内容不是图片');
  return shape === 'card'
    ? imageToCardDataUrl(blob, 512, 364, 0.84)
    : imageToSquareDataUrl(blob, 620, 0.84);
}

function encodeGenerated(source, shape = 'square') {
  return shape === 'card'
    ? imageToCardDataUrl(source, 512, 364, 0.84)
    : imageToSquareDataUrl(source, 620, 0.84);
}

async function remoteImageFallback(url) {
  if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) {
    throw new Error('接口返回了无法识别的图片地址。');
  }
  await loadImageElement(url);
  return url;
}

function extractOpenAiImage(payload) {
  const item = payload?.data?.[0] || payload?.images?.[0] || payload?.output?.[0];
  if (!item) return null;
  if (typeof item === 'string') {
    if (item.startsWith('http') || item.startsWith('data:image')) return { url: item };
    return { b64: item };
  }
  if (item.b64_json) return { b64: item.b64_json };
  if (item.base64) return { b64: item.base64 };
  if (item.url) return { url: item.url };
  return null;
}

async function generateWithOpenAiCompatible(prompt, config, shape = 'square') {
  const endpoint = endpointFor(config.baseUrl);
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey?.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  const payload = {
    model: config.model || 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1024',
  };
  const request = async (body) => {
    const timeout = withTimeout(150000);
    try {
      return await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: timeout.signal,
      });
    } finally {
      timeout.clear();
    }
  };

  let response;
  let bodyText = '';
  try {
    response = await request({ ...payload, response_format: 'b64_json' });
    bodyText = await response.text();
    if (!response.ok && /response_format|unknown.*parameter|unsupported/i.test(bodyText)) {
      response = await request(payload);
      bodyText = await response.text();
    }
  } catch (error) {
    throw new Error(friendlyAiError(error));
  }
  if (!response.ok) {
    throw new Error(friendlyAiError(null, response.status, bodyText));
  }
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error('生图接口返回了无法解析的数据。');
  }
  const extracted = extractOpenAiImage(json);
  if (!extracted) throw new Error('生图接口没有返回图片。');
  if (extracted.b64) {
    const base64 = extracted.b64.startsWith('data:image')
      ? extracted.b64
      : `data:image/png;base64,${extracted.b64}`;
    return encodeGenerated(base64, shape);
  }
  try {
    return await urlToCompressedDataUrl(extracted.url, shape);
  } catch {
    return remoteImageFallback(extracted.url);
  }
}

async function generateWithPollinations(prompt, shape = 'square') {
  const seed = randomInt(1, 2147483600);
  const encoded = encodeURIComponent(prompt);
  const width = shape === 'card' ? 1024 : 768;
  const height = shape === 'card' ? 768 : 768;
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux&referrer=cardrealm`;
  const timeout = withTimeout(120000);
  try {
    const response = await fetch(url, { signal: timeout.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(friendlyAiError(null, response.status, body));
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error('公共生图服务返回的不是图片，请稍后再试或切换自有接口。');
    }
    const blob = await response.blob();
    return encodeGenerated(blob, shape);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(friendlyAiError(error));
    if (error instanceof TypeError) {
      try {
        await loadImageElement(url);
        return url;
      } catch {
        throw new Error('公共生图服务暂时无法访问。你可以在「AI 生图」中配置自己的接口。');
      }
    }
    throw error instanceof Error ? error : new Error('生成失败，请稍后重试。');
  } finally {
    timeout.clear();
  }
}

export function composePortraitPrompt(kind, subject, styleId, enemyLore = '') {
  const style = AI_STYLE_MAP[styleId] || AI_STYLE_MAP.dark;
  const cleanSubject = String(subject || '').trim().slice(0, 500);
  const base = kind === 'enemy'
    ? `Collectible card game monster portrait. Creature concept: ${cleanSubject || 'a nameless nightmare creature'}. ${enemyLore ? `Lore: ${enemyLore}` : ''}`
    : `Collectible card game character portrait of a fantasy card summoner. Character concept: ${cleanSubject || 'a mysterious traveler who wields living cards'}.`;
  return `${base} ${style.prompt}. Centered head-and-shoulders composition, dark atmospheric background, dramatic lighting, rich texture, no text, no letters, no watermark, no frame, no border.`;
}

export async function generatePortrait({ kind, subject, styleId }) {
  const config = {
    provider: 'pollinations',
    baseUrl: '',
    apiKey: '',
    model: '',
    ...(window.__CARDREALM_AI_CONFIG__ || {}),
  };
  const prompt = composePortraitPrompt(kind, subject, styleId);
  return generatePortraitWithConfig({ prompt, config });
}

export async function generatePortraitWithConfig({ prompt, config }) {
  const ai = config || {};
  if (ai.provider === 'openai') {
    return generateWithOpenAiCompatible(prompt, ai);
  }
  return generateWithPollinations(prompt);
}

export async function fileToCompressedPortrait(file, size = 620) {
  if (!file) throw new Error('没有选择图片。');
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('请选择图片文件。');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('图片太大，请选择 20MB 以下的图片。');
  }
  return imageToSquareDataUrl(file, size, 0.84);
}

const EFFECT_VISUALS = {
  damage: 'a decisive blade arc and flying sparks',
  directDamage: 'a piercing thrust through armor',
  block: 'a translucent shield of light',
  heal: 'restorative glow and blooming petals',
  draw: 'floating cards and drifting pages',
  drawTo: 'a tide of submerged pages',
  energy: 'surging arcane energy',
  gold: 'scattered glittering coins',
  loseHp: 'a blood sacrifice and crimson droplets',
  detonate: 'a violent fiery detonation',
  catalyze: 'spreading corruption and multiplying spores',
  toxicBurst: 'a toxic bloom bursting outward',
  comboDamage: 'layered afterimages of slashes',
  blockDamage: 'a collapsing wall of thorns',
  execute: 'a final executed blow',
  recollect: 'a recovered memory page',
};

const STATUS_VISUALS = {
  poison: 'creeping green venom mist',
  burn: 'flames licking upward',
  vulnerable: 'cracked armor and exposed weakness',
  weak: 'fading strength and drooping shadows',
  strength: 'an aura of rising power',
  dexterity: 'flowing wind and nimble motion',
  thorns: 'thorned vines and brambles',
  regen: 'spring growth and soft greenery',
  barrier: 'a lingering dome of protection',
};

const SCHOOL_VISUALS = {
  blade: 'steel, crimson cloth and sharp golden light',
  star: 'cold starlight, silver constellations and drifting motes',
  shadow: 'venom-green mist, dark leaves and hidden blades',
  ember: 'ember flames, ash and warm orange sparks',
  thorn: 'thorned brambles, bark and pale blooms',
  dream: 'violet dreamlight, floating pages and broken mirrors',
};

function cardSceneClues(card) {
  const clues = [];
  for (const effect of card?.effects || []) {
    if (effect.type === 'status') {
      const visual = STATUS_VISUALS[effect.status];
      if (visual) clues.push(visual);
    } else {
      const visual = EFFECT_VISUALS[effect.type];
      if (visual) clues.push(visual);
    }
  }
  return [...new Set(clues)].slice(0, 4).join(', ');
}

export function composeCardArtPrompt(card) {
  const style = AI_STYLE_MAP.dark;
  const school = SCHOOLS[card?.school] || SCHOOLS.dream;
  const name = String(card?.displayName || card?.name || '梦境').replace(/\+$/, '');
  const flavor = String(card?.flavor || '').slice(0, 180);
  const description = String(card?.description || '').slice(0, 200);
  const clues = cardSceneClues(card) || 'a symbolic dreamlike tableau';
  return `Horizontal 4:3 collectible card game illustration. The card is named "${name}", so the picture must clearly show that action or object as the focal point, not a generic warrior portrait. Card effect: ${description}. Key visual elements: ${clues}. Scene concept: ${flavor}. School motif: ${school.name}; palette accents: ${SCHOOL_VISUALS[card?.school] || SCHOOL_VISUALS.dream}. ${style.prompt}. Cinematic wide composition, no text, no letters, no watermark, no logo, no border, no card frame, no UI.`;
}

export async function generateCardArtWithConfig({ card, config }) {
  const prompt = composeCardArtPrompt(card);
  const ai = config || {};
  if (ai.provider === 'openai') {
    return generateWithOpenAiCompatible(prompt, ai, 'card');
  }
  return generateWithPollinations(prompt, 'card');
}
