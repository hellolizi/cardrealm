#!/usr/bin/env node
/**
 * 扫描 assets/cards/，生成 js/card-art-manifest.js
 *
 * 命名约定（<id> 必须与 js/data.js 里的卡牌 id 一致）：
 *   <id>.webp            普通卡面
 *   <id>-up.webp         强化卡面
 *   <id>.mp4 / .webm     普通卡面的动态循环
 *   <id>-up.mp4/.webm    强化卡面的动态循环
 *
 * 用法：node tools/build-card-art-manifest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artDir = path.join(root, 'assets', 'cards');
const outFile = path.join(root, 'js', 'card-art-manifest.js');

const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.avif']);
const VIDEO_EXT = new Set(['.mp4', '.webm']);

function knownCardIds() {
  const source = fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8');
  const ids = new Set();
  // 主卡池：静态数组字面量。
  const start = source.indexOf('export const CARDS = [');
  const end = source.indexOf('export const CARD_MAP');
  for (const match of source.slice(start, end).matchAll(/\bid: '([^']+)'/g)) ids.add(match[1]);
  // 状态牌（梦蚀残页 / 呜咽 / 焦页）：单独定义后 push 进 CARDS，
  // 不在上面那段字面量里。漏掉它们会让这三张牌永远退化成程序化 SVG 底图。
  const extraStart = source.indexOf('export const STATUS_CARDS = [');
  if (extraStart >= 0) {
    const extraEnd = source.indexOf('CARDS.push(...STATUS_CARDS)');
    for (const match of source.slice(extraStart, extraEnd).matchAll(/\bid: '([^']+)'/g)) ids.add(match[1]);
  }
  return ids;
}

function main() {
  if (!fs.existsSync(artDir)) {
    fs.mkdirSync(artDir, { recursive: true });
    console.log(`已创建 ${path.relative(root, artDir)}，暂无素材。`);
  }
  const ids = knownCardIds();
  const entries = new Map();
  const unknown = [];

  const touch = (id) => {
    if (!entries.has(id)) entries.set(id, {});
    return entries.get(id);
  };

  for (const file of fs.readdirSync(artDir)) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);
    if (!IMAGE_EXT.has(ext) && !VIDEO_EXT.has(ext)) continue;

    const isUp = base.endsWith('-up');
    const id = isUp ? base.slice(0, -3) : base;
    if (!ids.has(id)) {
      unknown.push(file);
      continue;
    }
    const entry = touch(id);
    const relative = `assets/cards/${file}`;
    if (IMAGE_EXT.has(ext)) entry[isUp ? 'up' : 'src'] = relative;
    else entry[isUp ? 'upVideo' : 'video'] = relative;
  }

  const ordered = [...entries.entries()]
    .filter(([, value]) => value.src || value.up)
    .sort(([a], [b]) => a.localeCompare(b));

  const body = ordered.map(([id, value]) => {
    const parts = [];
    if (value.src) parts.push(`src: '${value.src}'`);
    if (value.up) parts.push(`up: '${value.up}'`);
    if (value.video) parts.push(`video: '${value.video}'`);
    if (value.upVideo) parts.push(`upVideo: '${value.upVideo}'`);
    return `  '${id}': { ${parts.join(', ')} },`;
  }).join('\n');

  const content = `/**
 * 卡面资源清单（由 tools/build-card-art-manifest.mjs 自动生成，请勿手改）
 *
 * 每张卡的可选素材：
 *   src      普通卡面        assets/cards/<id>.webp
 *   up       强化卡面        assets/cards/<id>-up.webp
 *   video    强化前的动态循环 assets/cards/<id>.mp4 / .webm
 *   upVideo  强化后的动态循环 assets/cards/<id>-up.mp4 / .webm
 */

export const CARD_ART = {
${body}
};
`;

  fs.writeFileSync(outFile, content, 'utf8');
  console.log(`卡面清单已更新：${ordered.length} 张卡（共 ${ids.size} 张）`);
  if (unknown.length) {
    console.warn(`跳过 ${unknown.length} 个文件名与卡牌 id 不匹配的文件：`);
    for (const file of unknown.slice(0, 20)) console.warn(`  - ${file}`);
  }
}

main();
