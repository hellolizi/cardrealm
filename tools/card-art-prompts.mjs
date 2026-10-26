#!/usr/bin/env node
/**
 * 按卡牌名称 / 效果，为 100 张牌各生成一条 AI 生图提示词。
 * 直接复用游戏内「造物工坊」用的 composeCardArtPrompt，保证批量出图和
 * 玩家自己在游戏里生成时是同一套语言。
 *
 * 用法：node tools/card-art-prompts.mjs [--only 缺图的卡]
 * 输出：tools/card-art-prompts.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(root, 'tools', '.import');

// 零构建的项目没有 package.json，把用到的模块复制成 .mjs 再导入
function stageModules() {
  fs.mkdirSync(tmp, { recursive: true });
  for (const name of ['data.js', 'utils.js', 'images.js']) {
    const source = fs.readFileSync(path.join(root, 'js', name), 'utf8')
      .replace(/from '\.\/([\w-]+)\.js'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(tmp, name.replace('.js', '.mjs')), source, 'utf8');
  }
}

async function main() {
  stageModules();
  const { CARDS, describeEffects } = await import(pathToFileURL(path.join(tmp, 'data.mjs')).href);
  const { composeCardArtPrompt } = await import(pathToFileURL(path.join(tmp, 'images.mjs')).href);

  const artDir = path.join(root, 'assets', 'cards');
  const existing = new Set(
    fs.existsSync(artDir)
      ? fs.readdirSync(artDir).filter((f) => /\.(webp|png|jpg|jpeg)$/i.test(f)).map((f) => path.parse(f).name)
      : [],
  );

  const onlyMissing = process.argv.includes('--only');
  const list = CARDS
    .filter((card) => !onlyMissing || !existing.has(card.id))
    .map((card) => {
      const description = card.description || describeEffects(card.effects || []);
      return {
        id: card.id,
        name: card.name,
        school: card.school,
        rarity: card.rarity,
        prompt: composeCardArtPrompt({ ...card, description }),
      };
    });

  const out = path.join(root, 'tools', 'card-art-prompts.json');
  fs.writeFileSync(out, JSON.stringify(list, null, 2), 'utf8');
  console.log(`已写出 ${list.length} 条提示词 -> ${path.relative(root, out)}`);
  if (onlyMissing) console.log(`其中缺图 ${CARDS.length - existing.size} 张`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch((error) => {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
