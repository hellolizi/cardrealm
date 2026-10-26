// 全量回归（纯 Node，不需要浏览器）：对话图 + 八岛地图 + 反制规则 + 五角色起手 + 共鸣规则。
// 这个版本可以脱离浏览器直接跑，CI 里也能用。
process.env.NODE_ENV = 'test';
import { existsSync } from 'node:fs';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.document = { addEventListener() {}, querySelector: () => null, body: { appendChild() {} } };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };

const L = await import('../../js/lore.js');
const SA = await import('../../js/story-art.js');
const D = await import('../../js/data.js');
const E = await import('../../js/engine.js');
const R = await import('../../js/resonance.js');
const K = await import('../../js/keywords.js');
const A = await import('../../js/ascension.js');
const { G } = await import('../../js/state.js');

function sandbox(enemyId, originId = 'blade') {
  const origin = D.ORIGIN_MAP[originId] || D.ORIGIN_MAP.blade;
  G.profile.originId = origin.id;
  G.profile.sandboxDeck = origin.starter.map((defId) => ({ defId, upgraded: false }));
  return E.startSandboxBattle(enemyId);
}

let fails = 0;
const bad = (msg) => { fails += 1; console.log('  ✗ ' + msg); };

// ── 1. 对话图 ──
console.log('=== 1. 对话图完整性 ===');
console.log(`  对话 ${Object.keys(L.DIALOGUES).length} 段 · NPC ${Object.keys(L.NPC_MAP).length} 位`);
const before1 = fails;
for (const [id, d] of Object.entries(L.DIALOGUES)) {
  if (!d.nodes?.[d.entry]) { bad(`${id}: entry 节点不存在`); continue; }
  const seen = new Set();
  const queue = [d.entry];
  let ends = 0;
  while (queue.length) {
    const nid = queue.shift();
    if (seen.has(nid)) continue;
    seen.add(nid);
    const node = d.nodes[nid];
    if (!node) { bad(`${id}: 节点缺失 ${nid}`); continue; }
    if (!node.choices?.length && !node.next) { ends += 1; continue; }
    if (node.next) { if (!d.nodes[node.next]) bad(`${id}: next 指向不存在 ${node.next}`); else queue.push(node.next); }
    for (const c of node.choices || []) {
      if (!c.next) continue;
      if (!d.nodes[c.next]) bad(`${id}: choice.next 指向不存在 ${c.next}`);
      else queue.push(c.next);
    }
  }
  if (!ends) bad(`${id}: 走不到结局`);
}
const noDialogue = Object.keys(L.NPC_MAP).filter((n) => !Object.values(L.DIALOGUES).some((d) => d.npc === n));
if (noDialogue.length) bad(`无对话的 NPC: ${noDialogue.join(', ')}`);
if (fails === before1) console.log('  全部通过');

// ── 2. 八岛地图 ──
console.log('\n=== 2. 八岛地图 ===');
for (const r of L.REGIONS) {
  const layers = E.makeMap(r.id);
  const all = layers.flat();
  const boss = all.find((n) => n.type === 'boss');
  const reach = new Set();
  const q = [...(layers[0] || [])];
  while (q.length) {
    const n = q.pop();
    if (!n || reach.has(n.id)) continue;
    reach.add(n.id);
    for (const id of n.next || []) { const t = all.find((x) => x.id === id); if (t) q.push(t); }
  }
  const ok = boss && reach.has(boss.id);
  console.log(`  ${String(r.name).padEnd(5)} ${String(r.shape).padEnd(7)} 层${String(layers.length).padEnd(3)} 节点${String(all.length).padEnd(3)} boss${ok ? '可达' : '不可达'}`);
  if (!ok) bad(`${r.id}: boss 不可达`);
}

// ── 3. 反制规则 ──
console.log('\n=== 3. 反制规则 ===');
const counterHits = [];
for (const e of D.ENEMIES || []) {
  const p2 = e.phase2;
  if (!p2) continue;
  const hit = {};
  if (p2.noHeal) hit.noHeal = true;
  if (p2.reflectPct) hit.reflectPct = p2.reflectPct;
  if (p2.echoBreak) hit.echoBreak = true;
  if (Object.keys(hit).length) counterHits.push(`${e.name}（${p2.title}）${JSON.stringify(hit)}`);
}
if (counterHits.length) console.log('  ' + counterHits.join('\n  '));
else bad('没有任何反制首领');
if (counterHits.length < 3) bad(`反制首领只有 ${counterHits.length} 个，至少要有 3 个`);

// ── 4. 五角色起手与共鸣 ──
console.log('\n=== 4. 五角色起手 ===');
for (const o of D.ORIGINS) {
  const preferred = R.preferredSchoolForOrigin(o.id);
  const res = R.computeResonance(o.starter.map((id) => ({ defId: id })), preferred);
  const own = res.counts[preferred] || 0;
  const schoolCount = Object.values(res.counts).filter((v) => v > 0).length;
  console.log(`  ${String(o.name).padEnd(6)} 起手${o.starter.length}张 · 本派${String(own).padEnd(2)}张 · ${schoolCount}派 · ${res.primary || 'none'} T${res.tier} · 资源${JSON.stringify(o.resources)}`);
  if (!res.primary) bad(`${o.id}: 起手没有点亮共鸣`);
  if (own < 4) bad(`${o.id}: 本派牌只有 ${own} 张，角色特色不足`);
  if (schoolCount > 2) bad(`${o.id}: 起手横跨 ${schoolCount} 派，太散`);
}

// ── 5. 共鸣规则本身 ──
console.log('\n=== 5. 共鸣规则 ===');
const pure = R.computeResonance(Array(12).fill('crossGuard').map((id) => ({ defId: id })));
const mix = R.computeResonance([...Array(4).fill('crossGuard'), ...Array(4).fill('fracture'), ...Array(4).fill('kindling')].map((id) => ({ defId: id })));
console.log(`  纯流派 12 张: ${pure.primary} T${pure.tier} +${pure.value} chorus=${pure.chorus.active}`);
console.log(`  混搭 4+4+4: ${mix.primary} T${mix.tier} +${mix.value} chorus=${mix.chorus.active} T${mix.chorus.tier} +${mix.chorus.value}`);
if (!pure.primary || pure.tier !== 3) bad('纯流派 12 张应达 III 档');
if (!mix.chorus.active) bad('混搭 4+4+4 应触发混响');
// 两条路线互斥：平衡牌组不能同时吃「单流派共鸣」和「混响」两份。
// 旧规则允许并存，结果是 4+4+4 既拿主共鸣又拿混响，纯流派反而没有存在理由。
if (mix.primary) bad('混响激活时不应同时结算单流派共鸣（两条路线互斥）');
if (mix.chorus.tier < 2) bad('4+4+4 的混响应到 II 档');
// 双派必须也认：各 3 张就该点亮混响，那是玩家最自然的混搭方式。
const dual = R.computeResonance([...Array(5).fill('crossGuard'), ...Array(4).fill('fracture')].map((id) => ({ defId: id })));
console.log(`  双派 5+4: chorus=${dual.chorus.active} T${dual.chorus.tier} +${dual.chorus.value} primary=${dual.primary}`);
if (!dual.chorus.active) bad('双派 5+4 应触发混响（双派是入门混搭）');
if (dual.chorus.tier > 2) bad('双派最多 II 档，三派才到 III 档');

// ── 6. 卡池完整性 ──
console.log('\n=== 6. 卡池 ===');
const ids = new Set();
let dup = 0;
for (const c of D.CARDS) { if (ids.has(c.id)) dup += 1; ids.add(c.id); }
const noSchool = D.CARDS.filter((c) => !c.school);
console.log(`  共 ${D.CARDS.length} 张 · 重复 ${dup} · 缺流派 ${noSchool.length}`);
if (dup) bad(`${dup} 张卡 id 重复`);
if (noSchool.length) bad(`${noSchool.length} 张卡没有流派：${noSchool.map((c) => c.id).join(',')}`);

// ── 7. 每张牌都必须有卡面 ──
// 缺素材的牌会静默回退到 card-art.js 的程序化 SVG 场景：一张跟其余写实油画
// 完全不同的抽象底图，玩家一眼就能看出是占位图。新增卡牌忘了配图时，
// 这条断言会先叫出来，而不是等到玩家发现。
console.log('\n=== 7. 卡面素材 ===');
const artManifest = await import('../../js/card-art-manifest.js');
const missingArt = D.CARDS.filter((c) => !artManifest.CARD_ART?.[c.id]?.src).map((c) => `${c.id}(${c.name})`);
console.log(`  有卡面 ${D.CARDS.length - missingArt.length}/${D.CARDS.length}`);
if (missingArt.length) bad(`${missingArt.length} 张卡没有卡面，会退化成程序化底图：${missingArt.join(', ')}`);

// ── 8. 意图预览与实际结算同源 ──
// 预览和结算只要各算一次，玩家就会按错误的格挡数留牌。
// 这里直接让潮钟在涨潮、带力量与梦蚀的情况下打一回合，对账。
console.log('\n=== 8. 意图预览与实际结算 ===');
{
  const tide = sandbox('tide-warden');
  tide.turn = 5;
  tide.rules.tideHigh = true;
  tide.enemy.statuses.strength = 2;
  tide.enemy.damageBonus = 1;
  tide.player.block = 0;
  const preview = E.previewEnemyAttack(tide);
  const hpBefore = tide.player.hp;
  E.endTurn(tide);
  const actualLoss = hpBefore - tide.player.hp;
  console.log(`  涨潮停钟一击：预览 ${preview?.total ?? '—'} / 实际失去 ${actualLoss}`);
  if (!preview) bad('潮钟没有攻击预览');
  else {
    if (preview.total !== 44) bad(`涨潮预览应为 44（17×1.7×1.35+力量2+梦蚀2+岛层1），实际 ${preview.total}`);
    if (actualLoss !== preview.hpLoss) bad(`预览失去 ${preview.hpLoss}，实际失去 ${actualLoss}`);
  }

  tide.turn = 5;
  tide.rules.tideHigh = true;
  tide.enemy.statuses.strength = 2;
  tide.enemy.damageBonus = 1;
  const multi = E.enemyMoveProfile(tide, { name: '测试三段', damage: 7, hits: 3 });
  const expectedPerHit = Math.round(7 * 1.7 * 1.35);
  const expectedTotal = expectedPerHit * 3 + 5;
  if (multi.total !== expectedTotal) bad(`多段力量应只加第一段：期望 ${expectedTotal}，实际 ${multi.total}`);
  if (multi.segments.length !== 3) bad(`三段招的预览段数应为 3，实际 ${multi.segments.length}`);
}

// ── 9. Boss 机制文案与结算一致 ──
console.log('\n=== 9. Boss 机制文案 ===');
{
  const mirror = sandbox('mirror-sovereign');
  const mirrorInfo = E.mechanicInfo(mirror);
  const threshold = Math.max(12, Math.round(mirror.player.maxHp * 0.35));
  console.log(`  ${mirrorInfo?.detail}`);
  if (!mirrorInfo?.detail.includes('点伤害')) bad('镜海复写的说明没有按伤害计量');
  if (mirrorInfo?.detail.includes('8 点')) bad('镜海复写仍写着旧的 8 点复写伤害');
  if (mirrorInfo?.meter?.max !== threshold) bad(`镜海复写的进度条上限应为 ${threshold}，实际 ${mirrorInfo?.meter?.max}`);
  if (D.ENEMY_MAP['mirror-sovereign'].mechanic.desc.includes('3 层时')) bad('镜海复写的图鉴仍写着旧的三层规则');

  const ash = sandbox('ash-saint');
  const ashInfo = E.mechanicInfo(ash);
  if (!ashInfo?.detail.includes('9 点生命')) bad('焚名炉说明没有写回复 9 点生命');
  const ashDesc = D.ENEMY_MAP['ash-saint'].mechanic.desc;
  if (!ashDesc.includes('9 点生命') || !ashDesc.includes('1 层力量')) bad('焚名炉图鉴与回血/力量不一致');

  const tide = sandbox('tide-warden');
  tide.rules.tideHigh = false;
  tide.enemy.mechanic.value = 0;
  const tideInfo = E.mechanicInfo(tide);
  if (!tideInfo?.detail.includes('-20%') || !tideInfo?.detail.includes('1 点额外能量')) bad('潮汐退潮说明与结算不一致');
  const tideDesc = D.ENEMY_MAP['tide-warden'].mechanic.desc;
  if (!tideDesc.includes('+35%') || !tideDesc.includes('-20%')) bad('潮汐图鉴仍写着旧系数');

  const heart = sandbox('hollow-heart');
  const heartInfo = E.mechanicInfo(heart);
  if (!heartInfo?.detail.includes('4 点生命') || !heartInfo?.detail.includes('4 次')) bad('心搏说明与结算不一致');

  const paper = sandbox('paper-queen');
  const paperInfo = E.mechanicInfo(paper);
  if (!paperInfo?.detail.includes('你手里')) bad('剪稿说明仍写成剪弃牌堆');
  if (!D.ENEMY_MAP['paper-queen'].mechanic.desc.includes('手牌')) bad('剪稿图鉴仍写成剪弃牌堆');
}

// ── 10. 关键词手册与过期文案 ──
console.log('\n=== 10. 关键词手册 ===');
{
  for (const name of ['缄默', '焚', '梦蚀', '潮汐', '忘名', '碎片']) {
    if (!K.KEYWORD_MAP[name]) bad(`关键词手册缺少「${name}」`);
  }
  if (!K.KEYWORD_MAP['拾回']?.desc.includes('20 张')) bad('拾回仍写着旧的手牌上限');
  const laugh = K.KEYWORD_MAP['狂笑']?.desc || '';
  if (!laugh.includes('3 点格挡') || !laugh.includes('3 点')) bad('狂笑关键词数值与实际结算不一致');
  const frog = D.ORIGIN_MAP.milkfrog;
  if (!frog.resourceNote.includes('20 张')) bad('奶蛙蛙资源说明仍写着旧手牌上限');
  if (frog.deckNote.includes('抽 7')) bad('奶蛙蛙牌组说明仍写着「一回合抽 7 张」');
  if (!frog.mechanic.desc.includes('3 点格挡')) bad('奶蛙蛙角色机制说明与结算不一致');
  if (!K.KEYWORD_MAP['蚀印']?.desc.includes('满 4 层')) bad('蚀印关键词仍写着旧的引爆阈值');
  const wraithSpread = D.ORIGIN_AWAKENINGS.wraith.find((entry) => entry.id === 'wraithSpread');
  const wraithAbyss = D.ORIGIN_AWAKENINGS.wraith.find((entry) => entry.id === 'wraithAbyss');
  if (!wraithSpread?.desc.includes('降为 3')) bad('蔓延觉醒的阈值文案与实际不符');
  if (!wraithAbyss?.desc.includes('降为 2')) bad('万蚀觉醒的阈值文案与实际不符');
  if (D.ORIGIN_MAP.wraith.startPoison !== 3 || !D.ORIGIN_MAP.wraith.passive.includes('3 层中毒')) bad('暮影行者开局中毒与被动文案不一致');
  if (D.ORIGIN_MAP.arcanist.startStatuses.dexterity !== 3 || !D.ORIGIN_MAP.arcanist.passive.includes('3 层敏捷')) bad('星陨术士开局敏捷与被动文案不一致');
  if (D.ORIGIN_MAP.blade.startStatuses.strength !== 2 || !D.ORIGIN_MAP.blade.passive.includes('2 层力量')) bad('破晓剑客开局力量与被动文案不一致');
  if (!K.keywordText('焚心').includes('title="焚心：')) bad('关键词匹配没有优先匹配更长的「焚心」');
}

// ── 11. 忘名与反制规则 ──
console.log('\n=== 11. 忘名与二阶段规则 ===');
{
  const run = {
    deck: Array.from({ length: 10 }, () => ({ defId: 'strike', upgraded: false })),
    gold: 500,
    purgeCount: 0,
  };
  const shop = { purge: { price: 100, sold: false } };
  const result = E.buyShopPurge(run, shop, 0);
  if (!result.ok) bad(`忘名失败：${result.message}`);
  if (run.deck.length !== 9 || run.gold !== 400 || !shop.purge.sold) bad('忘名没有正确扣钱/删牌/标记售罄');
  if (E.buyShopPurge(run, shop, 0).ok) bad('忘名售罄后仍能再次购买');

  const thin = {
    deck: Array.from({ length: 8 }, () => ({ defId: 'strike', upgraded: false })),
    gold: 500,
    purgeCount: 0,
  };
  const thinShop = { purge: { price: 100, sold: false } };
  if (E.buyShopPurge(thin, thinShop, 0).ok) bad('牌组只剩 8 张时不应允许忘名');

  // 缄默之心进入真形时应把「呜咽」塞进手牌，而不是只写在数据里。
  const heart = sandbox('hollow-heart');
  heart.enemy.block = 0;
  heart.player.energy = 10;
  heart.enemy.hp = Math.ceil(heart.enemy.maxHp * 0.5) + 1;
  heart.hand = [{ defId: 'strike', upgraded: false, uid: 'phase-test-strike' }];
  E.playCard(heart, 'phase-test-strike');
  if (heart.enemy.phase !== 2) bad('缄默之心没有在血量过半时进入二阶段');
  const injected = [...heart.hand, ...heart.discardPile, ...heart.drawPile].some((card) => card.defId === 'whimper');
  if (!injected) bad('缄默之心二阶段没有注入「呜咽」');
}

// ── 12. 镜海/焚名炉的结算 ──
console.log('\n=== 12. 镜海复写与焚名炉 ===');
{
  const mirror = sandbox('mirror-sovereign');
  mirror.enemy.hp = mirror.enemy.maxHp;
  mirror.player.energy = 10;
  mirror.hand = [{ defId: 'strike', upgraded: false, uid: 'mirror-test-hit' }];
  const dealtBefore = mirror.stats.damageDealt;
  E.playCard(mirror, 'mirror-test-hit');
  const dealt = mirror.stats.damageDealt - dealtBefore;
  if (mirror.enemy.mechanic.value !== dealt) bad(`镜海复写应按实际伤害累积：造成 ${dealt}，记下 ${mirror.enemy.mechanic.value}`);

  mirror.enemy.hp = mirror.enemy.maxHp;
  mirror.enemy.mechanic.value = Math.max(12, Math.round(mirror.player.maxHp * 0.35)) - 1;
  mirror.player.energy = 10;
  mirror.player.block = 50;
  mirror.hand = [{ defId: 'strike', upgraded: false, uid: 'mirror-test-hit-2' }];
  const hpBefore = mirror.player.hp;
  E.playCard(mirror, 'mirror-test-hit-2');
  const replica = Math.max(5, Math.round(mirror.player.maxHp * 0.05));
  if (hpBefore - mirror.player.hp !== replica) bad(`镜海复写应无视格挡造成 ${replica} 点伤害，实际 ${hpBefore - mirror.player.hp}`);
  if (mirror.player.block !== 50) bad('镜海复写不应消耗格挡');

  // 毒与灼烧也必须被镜面记住——否则毒流完全免费。
  mirror.enemy.hp = mirror.enemy.maxHp;
  mirror.enemy.mechanic.value = Math.max(12, Math.round(mirror.player.maxHp * 0.35)) - 1;
  mirror.enemy.statuses.poison = 10;
  mirror.player.block = 200;
  mirror.player.hp = mirror.player.maxHp;
  const dotHpBefore = mirror.player.hp;
  E.endTurn(mirror);
  if (dotHpBefore - mirror.player.hp !== replica) bad(`毒伤也应触发镜海复写：应失去 ${replica}，实际 ${dotHpBefore - mirror.player.hp}`);
  if (mirror.enemy.mechanic.value !== 0) bad('毒伤触发复写后镜面没有清空');

  const ash = sandbox('ash-saint');
  ash.enemy.hp = ash.enemy.maxHp - 20;
  ash.enemy.mechanic.value = 4;
  ash.player.energy = 10;
  ash.hand = [{ defId: 'strike', upgraded: false, uid: 'ash-test-hit' }];
  const ashHpBefore = ash.enemy.hp;
  const ashDealtBefore = ash.stats.damageDealt;
  const strengthBefore = ash.enemy.statuses.strength || 0;
  E.playCard(ash, 'ash-test-hit');
  const ashDealt = ash.stats.damageDealt - ashDealtBefore;
  if (ash.enemy.mechanic.value !== 0) bad('焚名炉满 5 层后没有清空炉温');
  if (ash.enemy.hp !== ashHpBefore - ashDealt + 9) bad('焚名炉应回复 9 点生命');
  if ((ash.enemy.statuses.strength || 0) !== strengthBefore + 1) bad('焚名炉应获得 1 层力量');

  // 二阶段焚牌只烧「每回合第一张攻击牌」：第二张必须正常回弃牌堆。
  const burn = sandbox('ash-saint');
  burn.turn = 5;
  burn.rules.burnPlayed = true;
  burn.rules.burnTurn = 0;
  burn.player.energy = 10;
  burn.hand = [
    { defId: 'strike', upgraded: false, uid: 'burn-first' },
    { defId: 'strike', upgraded: false, uid: 'burn-second' },
  ];
  E.playCard(burn, 'burn-first');
  E.playCard(burn, 'burn-second');
  if (!burn.exhaustPile.some((card) => card.uid === 'burn-first')) bad('二阶段第一张攻击牌应被烧掉（进入消耗堆）');
  if (!burn.discardPile.some((card) => card.uid === 'burn-second')) bad('二阶段第二张攻击牌不应被烧掉');
}

// ── 13. 梦境变奏 ──
console.log('\n=== 13. 梦境变奏 ===');
{
  const M = await import('../../js/mutations.js');
  const origin = D.ORIGIN_MAP.blade;
  const prevRun = G.run;
  const prevScreen = G.screen;

  // 定义本身：每条都得有名字、字形、说明和至少一个修正。
  for (const mutation of M.DREAM_MUTATIONS) {
    if (!mutation.id || !mutation.name || !mutation.glyph) bad(`变奏定义缺字段：${mutation.id || '未知'}`);
    if (!mutation.desc || !mutation.mods || !Object.keys(mutation.mods).length) bad(`变奏「${mutation.name}」没有说明或修正`);
  }
  const uniqueIds = new Set(M.DREAM_MUTATIONS.map((mutation) => mutation.id));
  if (uniqueIds.size !== M.DREAM_MUTATIONS.length) bad('变奏 id 重复');

  // 同一颗种子必须抽出同一对；不同种子的组合要有足够变化。
  const rollA = M.rollDreamMutations('same-seed', 'region-corridor').map((mutation) => mutation.id).join('|');
  const rollB = M.rollDreamMutations('same-seed', 'region-corridor').map((mutation) => mutation.id).join('|');
  if (rollA !== rollB) bad(`同一颗种子抽出了不同的变奏：${rollA} / ${rollB}`);
  if (new Set(M.rollDreamMutations('same-seed', 'region-corridor').map((mutation) => mutation.id)).size !== 2) bad('一次抽取出现了重复变奏');
  const combos = new Set();
  for (let index = 0; index < 30; index += 1) {
    combos.add(M.rollDreamMutations(`roll-${index}`, 'region-corridor').map((mutation) => mutation.id).join('|'));
  }
  if (combos.size < 6) bad(`30 颗种子只抽出了 ${combos.size} 种组合，变化太少`);

  // 合并规则：生命系数相乘，其余相加。
  const merged = M.mergeMutationMods([{ id: 'echoDream' }, { id: 'warmDream' }, { id: 'greedyDream' }]);
  if (Math.abs(merged.enemyHpScale - 1.1 * 1.08) > 1e-9) bad(`生命系数应相乘，实际 ${merged.enemyHpScale}`);
  if (merged.shopPriceScale !== 1.2) bad('商店系数没有合并');
  const goldMerge = M.mergeMutationMods([{ id: 'longNight' }, { id: 'greedyDream' }]);
  if (goldMerge.victoryGold !== 55) bad(`金币加成应相加为 55，实际 ${goldMerge.victoryGold}`);

  const makeRun = (mutationIds, extra = {}) => {
    const defs = M.sanitizeDreamMutations(mutationIds.map((id) => ({ id })));
    return {
      regionId: 'corridor',
      originId: 'blade',
      deck: origin.starter.map((defId) => ({ defId, upgraded: false })),
      maxHp: origin.hp,
      hp: origin.hp,
      relics: [],
      ascension: 0,
      ascensionModifiers: {},
      modifiers: {},
      bossId: 'nightmare-dragon',
      originAwakening: [],
      floor: 3,
      totals: { cardsPlayed: 0, damageDealt: 0, enemiesFelled: 0 },
      dreamMutations: defs,
      mutationMods: M.mergeMutationMods(defs),
      ...extra,
    };
  };
  const build = (mutationIds, type = 'battle', extra = {}) => {
    G.run = makeRun(mutationIds, extra);
    return E.startAdventureBattle({ id: `mutation-${mutationIds.join('-')}-${type}`, type });
  };

  // 长夜：首回合少抽 2 张。
  const longNight = build(['longNight']);
  if (longNight.hand.length !== Math.max(1, longNight.player.baseDraw - 2)) {
    bad(`长夜首回合应少抽 2 张：期望 ${longNight.player.baseDraw - 2}，实际 ${longNight.hand.length}`);
  }

  // 凝滞：每回合多抽 1 张。
  const still = build(['stillDream']);
  if (still.hand.length !== still.player.baseDraw + 1) {
    bad(`凝滞首回合应多抽 1 张：期望 ${still.player.baseDraw + 1}，实际 ${still.hand.length}`);
  }

  // 薄暮：开局护甲、敏捷与敌人攻击加成都要落地。
  const dusk = build(['duskDream']);
  if (dusk.player.block < 6) bad(`薄暮开局应有 6 点格挡，实际 ${dusk.player.block}`);
  if ((dusk.player.statuses.dexterity || 0) < 1) bad('薄暮开局应有 1 层敏捷');
  if (dusk.enemy.damageBonus < 1) bad(`薄暮敌人攻击应 +1，实际 ${dusk.enemy.damageBonus}`);

  // 燃梦：第一张攻击牌的预览与结算都要 +3，第二张不再加成。
  const kindled = build(['kindledDream']);
  kindled.enemy.hp = 500;
  kindled.enemy.maxHp = 500;
  kindled.enemy.block = 0;
  kindled.player.energy = 10;
  kindled.hand = [
    { defId: 'strike', upgraded: false, uid: 'kindled-first' },
    { defId: 'strike', upgraded: false, uid: 'kindled-second' },
  ];
  const firstCard = kindled.hand[0];
  const firstPreview = E.previewCardDamage(kindled, firstCard);
  const dealtBefore = kindled.stats.damageDealt;
  E.playCard(kindled, 'kindled-first');
  const firstDealt = kindled.stats.damageDealt - dealtBefore;
  if (!firstPreview || firstPreview.hpLoss !== firstDealt) {
    bad(`燃梦首张攻击预览 ${firstPreview?.hpLoss} 与实际 ${firstDealt} 不一致`);
  }
  const baseline = E.previewCardDamage(kindled, kindled.hand[0]);
  if (!baseline || baseline.hpLoss >= firstPreview.hpLoss) bad('燃梦第二张攻击牌不应继续吃 +3');
  if (kindled.rules.firstAttackArmed) bad('燃梦加成结算后没有熄灭');

  // 燃梦：敌人挥击会留下 1 层灼烧。
  const burnBattle = build(['kindledDream']);
  burnBattle.enemy.moves = [{ name: '测试挥击', kind: 'attack', damage: 1 }];
  burnBattle.enemy.pattern = [0];
  burnBattle.enemy.moveIndex = 0;
  burnBattle.player.block = 0;
  burnBattle.player.statuses = {};
  const burnBefore = burnBattle.player.statuses.burn || 0;
  E.endTurn(burnBattle);
  if ((burnBattle.player.statuses.burn || 0) < burnBefore + 1) bad('燃梦没有在敌人攻击后附加灼烧');

  // 回响：每回合第 3 张牌抽 1 张。
  const echo = build(['echoDream']);
  echo.enemy.hp = 500;
  echo.enemy.maxHp = 500;
  echo.player.energy = 10;
  echo.hand = [
    { defId: 'strike', upgraded: false, uid: 'echo-1' },
    { defId: 'strike', upgraded: false, uid: 'echo-2' },
    { defId: 'strike', upgraded: false, uid: 'echo-3' },
  ];
  const echoHandBefore = echo.hand.length;
  for (const uid of ['echo-1', 'echo-2', 'echo-3']) E.playCard(echo, uid);
  if (echo.hand.length !== echoHandBefore - 3 + 1) bad(`回响第 3 张牌应抽 1 张：手牌 ${echo.hand.length}`);
  if (!echo.log.some((entry) => entry.text.includes('回响'))) bad('回响没有写入战斗日志');

  // 余温：回合开始保留最多 5 点格挡。
  const warm = build(['warmDream']);
  warm.player.block = 12;
  warm.enemy.moves = [{ name: '静默', kind: 'buff', block: 0 }];
  warm.enemy.pattern = [0];
  warm.enemy.moveIndex = 0;
  E.endTurn(warm);
  if (warm.player.block !== 5) bad(`余温应保留 5 点格挡，实际 ${warm.player.block}`);

  // 空梦：手牌不超过 1 张时获得 7 点格挡。
  const empty = build(['emptyDream']);
  empty.hand = [];
  empty.player.block = 0;
  empty.enemy.moves = [{ name: '静默', kind: 'buff', block: 0 }];
  empty.enemy.pattern = [0];
  empty.enemy.moveIndex = 0;
  E.endTurn(empty);
  if (!empty.log.some((entry) => entry.text.includes('空梦合拢'))) bad('空梦没有在空手结束回合时给格挡');

  // 逆鳞：首领二阶段提前 10% 生命。
  const reverse = build(['reverseScale'], 'boss');
  if (!reverse.enemy.phase2) bad('逆鳞测试没有进入首领战');
  else if (Math.abs(reverse.enemy.phase2.at - 0.4) > 1e-9) bad(`逆鳞应把二阶段阈值提前到 0.4，实际 ${reverse.enemy.phase2.at}`);

  // 贪梦：商店涨价、胜利金币加成。
  const greedy = build(['greedyDream']);
  if (E.shopPrice(G.run, 100) !== 120) bad(`贪梦商店价应为 120，实际 ${E.shopPrice(G.run, 100)}`);
  greedy.enemy.hp = 1;
  greedy.player.energy = 10;
  greedy.hand = [{ defId: 'strike', upgraded: false, uid: 'greedy-kill' }];
  E.playCard(greedy, 'greedy-kill');
  if (greedy.phase !== 'victory') bad('贪梦测试没有击杀敌人');
  else if (greedy.rewards?.mutationGold !== 30) bad(`贪梦胜利应额外 +30 金币，实际 ${greedy.rewards?.mutationGold}`);

  G.run = prevRun;
  G.screen = prevScreen;
}

// ── 14. 普通/精英的岛屿深度缩放 ──
console.log('\n=== 14. 普通/精英深度缩放 ===');
{
  const origin = D.ORIGIN_MAP.blade;
  const prevRun = G.run;
  const prevScreen = G.screen;
  const makeRun = (regionId, endless = false) => ({
    regionId, originId: 'blade', deck: origin.starter.map((defId) => ({ defId, upgraded: false })),
    maxHp: origin.hp, hp: origin.hp, relics: [], ascension: 0, originAwakening: [], floor: 3,
    endless, modifiers: {}, bossId: 'nightmare-dragon', endlessModifiers: endless ? { enemyHpScale: 1.16 } : {},
  });
  const build = (regionId, type, endless = false) => {
    G.run = makeRun(regionId, endless);
    return E.startAdventureBattle({ id: `depth-${regionId}-${type}`, type });
  };
  const corridor = build('corridor', 'battle');
  const heart = build('heart', 'battle');
  const corridorHp = corridor.enemy.maxHp / D.ENEMY_MAP[corridor.enemy.defId].hp;
  const heartHp = heart.enemy.maxHp / D.ENEMY_MAP[heart.enemy.defId].hp;
  if (Math.abs(corridorHp - E.OPENING_DIFFICULTY.enemyHpScale) > 0.02) bad(`折廊开场敌人生命应为 ×${E.OPENING_DIFFICULTY.enemyHpScale}，实际 ×${corridorHp.toFixed(2)}`);
  if (Math.abs(corridor.enemy.powerScale - E.OPENING_DIFFICULTY.enemyDamageScale) > 0.02) bad(`折廊开场敌人伤害应为 ×${E.OPENING_DIFFICULTY.enemyDamageScale}，实际 ×${corridor.enemy.powerScale.toFixed(2)}`);
  if (heartHp < 1.5) bad(`心岛普通敌人生命应至少 ×1.5（含岛屿 1.18），实际 ×${heartHp.toFixed(2)}`);
  if (heart.enemy.powerScale < 1.3) bad(`心岛普通敌人伤害系数应 ≥1.3，实际 ${heart.enemy.powerScale}`);
  const endless = build('heart', 'battle', true);
  const endlessHp = endless.enemy.maxHp / D.ENEMY_MAP[endless.enemy.defId].hp;
  if (endlessHp > 1.25) bad(`无尽模式不应叠加岛屿深度，实际 ×${endlessHp.toFixed(2)}`);
  G.run = prevRun;
  G.screen = prevScreen;
  console.log(`  折廊 ×${corridorHp.toFixed(2)} · 心岛 ×${heartHp.toFixed(2)} · 无尽 ×${endlessHp.toFixed(2)}`);
}

// ── 15. 梦呓契约 ──
console.log('\n=== 15. 梦呓契约 ===');
{
  const CT = await import('../../js/contracts.js');
  const S = await import('../../js/state.js');
  const origin = D.ORIGIN_MAP.blade;
  const prevRun = G.run;
  const prevScreen = G.screen;
  const prevShards = G.profile.shards;

  // 定义：每份契约都得有名字、字形、收益、代价和至少一条规则。
  const expectedIds = ['paperCrown', 'borrowedFlame', 'silentVow', 'thornOath', 'foldedPage', 'gamblersDream', 'lingeringEcho', 'stonesleep'];
  if (CT.DREAM_CONTRACTS.length !== expectedIds.length) bad(`契约数量应为 ${expectedIds.length}，实际 ${CT.DREAM_CONTRACTS.length}`);
  for (const id of expectedIds) {
    if (!CT.CONTRACT_MAP[id]) bad(`缺少契约 ${id}`);
  }
  for (const contract of CT.DREAM_CONTRACTS) {
    if (!contract.id || !contract.name || !contract.glyph || !contract.color) bad(`契约定义缺字段：${contract.id || '未知'}`);
    if (!contract.benefit || !contract.drawback || contract.benefit === contract.drawback) bad(`契约「${contract.name}」没有区分收益与代价`);
    if (!contract.desc || !contract.flavor) bad(`契约「${contract.name}」缺说明或风味`);
    if (!contract.rules || !Object.keys(contract.rules).length) bad(`契约「${contract.name}」没有规则`);
  }
  if (new Set(CT.DREAM_CONTRACTS.map((contract) => contract.id)).size !== CT.DREAM_CONTRACTS.length) bad('契约 id 重复');

  // 报价：同种子同岛固定，三份不重复；不同种子要有足够变化。
  const offersA = CT.rollContractOffers('same-seed', 'region-corridor', 3).map((contract) => contract.id).join('|');
  const offersB = CT.rollContractOffers('same-seed', 'region-corridor', 3).map((contract) => contract.id).join('|');
  if (offersA !== offersB) bad(`同一颗种子抽出了不同的契约报价：${offersA} / ${offersB}`);
  const offerIds = CT.rollContractOffers('same-seed', 'region-corridor', 3).map((contract) => contract.id);
  if (new Set(offerIds).size !== 3) bad('一次契约报价出现了重复');
  const combos = new Set();
  for (let index = 0; index < 30; index += 1) {
    combos.add(CT.rollContractOffers(`contract-roll-${index}`, 'region-corridor', 3).map((contract) => contract.id).join('|'));
  }
  if (combos.size < 8) bad(`30 颗种子只抽出了 ${combos.size} 种契约组合，变化太少`);
  for (const offer of CT.rollContractOffers('display-seed', 'region-corridor', 3)) {
    if (!offer.name || !offer.benefit || !offer.drawback || !offer.flavor) bad('契约报价缺少显示字段');
  }

  // 合并：系数相乘、牌数上限取最低、布尔取或、其余相加。
  const allRules = CT.mergeContractRules(CT.DREAM_CONTRACTS.map((contract) => contract.id));
  const expectedMerge = {
    contractDraw: 1, cardPlayLimit: 4, contractEnergy: 2, endTurnHpLoss: 2,
    noItems: true, startThorns: 4, healScale: 0.5, firstCardDiscount: 1,
    noRestHeal: true, victoryGold: 45, shopPriceScale: 1.3, firstHitDraw: 1,
    enemyBonusDamage: 1, startBlock: 12, noHeal: true,
  };
  for (const [key, expected] of Object.entries(expectedMerge)) {
    const actual = allRules[key];
    const mismatch = typeof expected === 'number' && key.endsWith('Scale')
      ? Math.abs(Number(actual) - expected) > 1e-9
      : actual !== expected;
    if (mismatch) bad(`契约合并 ${key} 应为 ${expected}，实际 ${actual}`);
  }
  if (CT.mergeContractRules(['thornOath', 'foldedPage']).cardPlayLimit !== undefined) bad('未签纸冠却合出了出牌上限');
  if (CT.mergeContractRules(['paperCrown', 'stonesleep']).cardPlayLimit !== 4) bad('纸冠的出牌上限在合并后丢失');

  // 定价与上限：第一份 12，第二份 20，最多两份。
  if (CT.contractPrice(0) !== 12) bad(`第一份契约应 12 片，实际 ${CT.contractPrice(0)}`);
  if (CT.contractPrice(1) !== 20) bad(`第二份契约应 20 片，实际 ${CT.contractPrice(1)}`);
  if (CT.MAX_CONTRACTS !== 2) bad(`契约上限应为 2，实际 ${CT.MAX_CONTRACTS}`);

  // 存档清洗：未知 id 丢弃、重复丢弃、只取前两份。
  const cleaned = CT.sanitizeContracts(['paperCrown', 'ghost', 'paperCrown', { id: 'borrowedFlame' }, { id: 'stonesleep' }]);
  if (cleaned.join(',') !== 'paperCrown,borrowedFlame') bad(`契约清洗结果不对：${cleaned.join(',')}`);
  if (CT.sanitizeContracts(null).length !== 0) bad('空契约列表应清洗为空');

  const makeRun = (ids, extra = {}) => {
    const defs = CT.sanitizeContracts(ids);
    return {
      id: 'contract-run',
      seed: 'contract-seed',
      mode: 'adventure',
      originId: 'blade',
      regionId: 'corridor',
      regionName: '折廊',
      bossId: 'nightmare-dragon',
      deck: origin.starter.map((defId) => ({ defId, upgraded: false })),
      map: E.makeMap('corridor'),
      maxHp: origin.hp,
      hp: origin.hp,
      gold: 0,
      items: ['dewPotion', 'thunderStone'],
      relics: [],
      ascension: 0,
      ascensionModifiers: {},
      modifiers: {},
      dreamMutations: [],
      mutationMods: {},
      contracts: defs,
      contractMods: CT.mergeContractRules(defs),
      originAwakening: [],
      floor: 3,
      totals: { cardsPlayed: 0, damageDealt: 0, enemiesFelled: 0 },
      status: 'active',
      ...extra,
    };
  };
  const build = (ids, extra = {}) => {
    G.run = makeRun(ids, extra);
    return E.startAdventureBattle({ id: `contract-${ids.join('-') || 'none'}`, type: 'battle' });
  };

  // 签下与撕毁：碎片按 12/20 扣除，撕毁不退款，满两份后不能再签。
  G.profile.shards = 40;
  const walletRun = makeRun([]);
  G.run = walletRun;
  const firstSign = E.signDreamContract(walletRun, 'paperCrown');
  if (!firstSign.ok || firstSign.price !== 12) bad(`第一份契约应花 12 片：${firstSign.message || ''}`);
  if (G.profile.shards !== 28 || walletRun.contracts.join(',') !== 'paperCrown') bad('签下纸冠后碎片或契约列表不对');
  if (walletRun.contractMods.cardPlayLimit !== 4 || walletRun.contractMods.contractDraw !== 1) bad('签下纸冠后规则没有写入');
  if (E.signDreamContract(walletRun, 'paperCrown').ok) bad('重复签下同一份契约仍然成功');
  const secondSign = E.signDreamContract(walletRun, 'borrowedFlame');
  if (!secondSign.ok || secondSign.price !== 20) bad(`第二份契约应花 20 片：${secondSign.message || ''}`);
  if (G.profile.shards !== 8 || walletRun.contracts.join(',') !== 'paperCrown,borrowedFlame') bad('第二份契约扣费或记录不对');
  if (walletRun.contractMods.contractEnergy !== 1 || walletRun.contractMods.endTurnHpLoss !== 2) bad('第二份契约规则没有合并');
  const fullSign = E.signDreamContract(walletRun, 'stonesleep');
  if (fullSign.ok || !String(fullSign.message).includes('只能容下')) bad('第三份契约应被上限拒绝');
  if (G.profile.shards !== 8 || walletRun.contracts.length !== 2) bad('被上限拒绝时不应扣碎片');
  const broken = E.breakDreamContract(walletRun, 'paperCrown');
  if (!broken.ok || walletRun.contracts.join(',') !== 'borrowedFlame') bad('撕毁纸冠后契约列表不对');
  if (walletRun.contractMods.cardPlayLimit !== undefined || walletRun.contractMods.contractEnergy !== 1) bad('撕毁后规则没有重算');
  if (G.profile.shards !== 8) bad('撕毁契约不应退还碎片');
  if (E.breakDreamContract(walletRun, 'paperCrown').ok) bad('撕毁没签过的契约仍然成功');
  const brokeSign = E.signDreamContract(walletRun, 'silentVow');
  if (brokeSign.ok || !String(brokeSign.message).includes('碎片不够')) bad('碎片不足时仍签下了契约');
  if (G.profile.shards !== 8 || walletRun.contracts.join(',') !== 'borrowedFlame') bad('碎片不足被拒绝时不应改变钱包或契约');

  // 新旅程不继承上一局的契约：碎片是永久记忆，规则不是。
  const runsBefore = G.profile.stats.runs;
  const fresh = E.startAdventure('blade', 'corridor', { seed: 'fresh-contract-seed' });
  if ((fresh.contracts || []).length || Object.keys(fresh.contractMods || {}).length) bad('新旅程继承了上一局的契约');
  G.profile.stats.runs = runsBefore;

  // 纸冠：多抽 1 张，但每回合第 5 张牌打不出去。
  const crown = build(['paperCrown']);
  if (crown.hand.length !== crown.player.baseDraw + 1) bad(`纸冠首回合应抽 ${crown.player.baseDraw + 1} 张，实际 ${crown.hand.length}`);
  crown.enemy.hp = 500;
  crown.enemy.maxHp = 500;
  crown.player.energy = 10;
  crown.hand = Array.from({ length: 5 }, (_, index) => ({ defId: 'strike', upgraded: false, uid: `crown-${index}` }));
  for (let index = 0; index < 4; index += 1) {
    const played = E.playCard(crown, `crown-${index}`);
    if (!played.ok) bad(`纸冠第 ${index + 1} 张牌本应可以打出：${played.error || ''}`);
  }
  const fifth = E.playCard(crown, 'crown-4');
  if (fifth.ok) bad('纸冠第 5 张牌仍然打了出去');
  else if (!String(fifth.error).includes('纸冠')) bad(`纸冠限制的提示不对：${fifth.error}`);
  if (!crown.log.some((entry) => entry.text.includes('纸冠'))) bad('纸冠合拢没有写入战斗日志');

  // 借火：+1 能量，回合结束失去 2 点生命。
  const flame = build(['borrowedFlame']);
  if (flame.player.maxEnergy !== origin.resources.energy + 1) bad(`借火能量应为 ${origin.resources.energy + 1}，实际 ${flame.player.maxEnergy}`);
  flame.hand = [];
  flame.player.statuses = {};
  flame.enemy.statuses = {};
  flame.enemy.moves = [{ name: '静默', kind: 'buff', block: 0 }];
  flame.enemy.pattern = [0];
  flame.enemy.moveIndex = 0;
  const flameHpBefore = flame.player.hp;
  E.endTurn(flame);
  if (flameHpBefore - flame.player.hp !== 2) bad(`借火回合结束应失去 2 点生命，实际 ${flameHpBefore - flame.player.hp}`);

  // 缄口：+1 能量，道具不可用且不会被消耗。
  const vow = build(['silentVow']);
  if (vow.player.maxEnergy !== origin.resources.energy + 1) bad(`缄口能量应为 ${origin.resources.energy + 1}，实际 ${vow.player.maxEnergy}`);
  const vowItem = E.useItem(vow, 'dewPotion');
  if (vowItem.ok) bad('缄口契约下仍然用出了道具');
  else if (!String(vowItem.error).includes('缄口')) bad(`缄口道具提示不对：${vowItem.error}`);
  if (!G.run.items.includes('dewPotion')) bad('缄口拒绝使用道具时仍然消耗了道具');

  // 荆棘誓约：开局 4 层荆棘，战斗与营火治疗减半。
  const thorn = build(['thornOath']);
  if ((thorn.player.statuses.thorns || 0) < 4) bad(`荆棘誓约开局应有 4 层荆棘，实际 ${thorn.player.statuses.thorns || 0}`);
  if (Math.abs(Number(thorn.rules.healScale) - 0.5) > 1e-9) bad(`荆棘誓约治疗系数应为 0.5，实际 ${thorn.rules.healScale}`);
  const restHeal = E.restHealAmount(G.run);
  if (restHeal !== Math.ceil(G.run.maxHp * 0.22 * 0.5)) bad(`荆棘誓约营火治疗应为 ${Math.ceil(G.run.maxHp * 0.22 * 0.5)}，实际 ${restHeal}`);
  thorn.player.hp = thorn.player.maxHp - 20;
  G.run.items = ['dewPotion'];
  const thornItem = E.useItem(thorn, 'dewPotion');
  if (!thornItem.ok) bad(`荆棘誓约下道具治疗失败：${thornItem.error || ''}`);
  if (thorn.player.hp !== thorn.player.maxHp - 20 + 7) bad(`荆棘誓约下 14 点治疗应只回 7 点，实际 ${thorn.player.hp - (thorn.player.maxHp - 20)}`);

  // 折页：每回合第一张牌 -1 费，营火不回复生命。
  const page = build(['foldedPage']);
  page.enemy.hp = 500;
  page.enemy.maxHp = 500;
  page.player.energy = 5;
  page.hand = [
    { defId: 'strike', upgraded: false, uid: 'page-first' },
    { defId: 'strike', upgraded: false, uid: 'page-second' },
  ];
  const pageEnergy = page.player.energy;
  const firstPageCard = E.playCard(page, 'page-first');
  if (!firstPageCard.ok) bad(`折页第一张牌本应可以打出：${firstPageCard.error || ''}`);
  if (page.player.energy !== pageEnergy) bad(`折页第一张 1 费牌应免费，实际剩余 ${page.player.energy}`);
  const secondPageCard = E.playCard(page, 'page-second');
  if (!secondPageCard.ok || page.player.energy !== pageEnergy - 1) bad('折页第二张牌不应继续享受折扣');
  if (!page.rules.firstCardDiscountUsed) bad('折页折扣结算后没有标记已使用');
  if (E.restHealAmount(G.run) !== 0) bad('折页契约下营火仍然回复生命');

  // 赌梦：胜利 +45 金币，商店 +30%。
  const gambler = build(['gamblersDream']);
  if (E.shopPrice(G.run, 100) !== 130) bad(`赌梦商店价应为 130，实际 ${E.shopPrice(G.run, 100)}`);
  gambler.enemy.hp = 1;
  gambler.enemy.maxHp = 1;
  gambler.enemy.block = 0;
  gambler.player.energy = 10;
  gambler.hand = [{ defId: 'strike', upgraded: false, uid: 'gamble-kill' }];
  E.playCard(gambler, 'gamble-kill');
  if (gambler.phase !== 'victory') bad('赌梦测试没有击杀敌人');
  else if (gambler.rewards?.contractGold !== 45) bad(`赌梦胜利应额外 +45 金币，实际 ${gambler.rewards?.contractGold}`);

  // 残响：敌人攻击 +1；每回合第一次掉血抽 1 张。
  const echo = build(['lingeringEcho']);
  if (echo.enemy.damageBonus !== 1) bad(`残响敌人攻击应 +1，实际 ${echo.enemy.damageBonus}`);
  echo.player.hp = echo.player.maxHp;
  echo.player.block = 0;
  echo.player.statuses = {};
  echo.enemy.statuses = {};
  echo.hand = [];
  echo.enemy.moves = [{ name: '测试挥击', kind: 'attack', damage: 5 }];
  echo.enemy.pattern = [0];
  echo.enemy.moveIndex = 0;
  const echoHpBefore = echo.player.hp;
  E.endTurn(echo);
  const echoExpected = Math.round(5 * E.OPENING_DIFFICULTY.enemyDamageScale) + 1;
  if (echoHpBefore - echo.player.hp !== echoExpected) bad(`残响敌人 5 点攻击应打 ${echoExpected} 点，实际 ${echoHpBefore - echo.player.hp}`);
  if (!echo.log.some((entry) => entry.text.includes('残响从伤口里折返'))) bad('残响第一次掉血没有抽牌');

  // 石眠：开局 12 格挡，战斗中无法治疗。
  const stone = build(['stonesleep']);
  if (stone.player.block < 12) bad(`石眠开局应有 12 点格挡，实际 ${stone.player.block}`);
  if (!stone.rules.noHeal) bad('石眠没有关闭战斗治疗');
  stone.player.hp = stone.player.maxHp - 20;
  G.run.items = ['dewPotion'];
  const stoneItem = E.useItem(stone, 'dewPotion');
  if (!stoneItem.ok) bad(`石眠下道具仍应能使用（只是不回复）：${stoneItem.error || ''}`);
  if (stone.player.hp !== stone.player.maxHp - 20) bad(`石眠下治疗仍然生效：回了 ${stone.player.hp - (stone.player.maxHp - 20)} 点`);
  if (!stone.log.some((entry) => entry.text.includes('禁止愈合'))) bad('石眠没有在治疗时说明梦境禁止愈合');

  // 存读档：契约、合并规则与战斗内契约徽记都要还原。
  const savedBattle = build(['paperCrown', 'thornOath']);
  G.screen = 'battle';
  S.saveRunNow();
  G.run = null;
  const restored = S.restoreRunSave();
  if (!restored || restored.contracts.join(',') !== 'paperCrown,thornOath') bad('存读档后契约列表没有还原');
  if (restored && (restored.contractMods.cardPlayLimit !== 4 || Math.abs(Number(restored.contractMods.healScale) - 0.5) > 1e-9)) bad('存读档后契约规则没有重算');
  if (restored?.battle?.contracts?.map((contract) => contract.id).join(',') !== 'paperCrown,thornOath') bad('存读档后战斗内契约徽记没有还原');
  if (restored?.battle?.rules?.cardPlayLimit !== 4 || restored?.battle?.rules?.contractDraw !== 1) bad('存读档后战斗规则没有恢复');
  if (Math.abs(Number(restored?.battle?.rules?.healScale) - 0.5) > 1e-9) bad(`存读档后治疗系数应为 0.5，实际 ${restored?.battle?.rules?.healScale}`);
  if (!savedBattle || savedBattle.phase !== 'player') bad('存读档测试的战斗对象没有建立');

  G.run = prevRun;
  G.screen = prevScreen;
  G.profile.shards = prevShards;
}

// ── 16. 梦层难度阶梯 ──
console.log('\n=== 16. 梦层难度阶梯 ===');
{
  const S = await import('../../js/state.js');
  const origin = D.ORIGIN_MAP.blade;
  const prevRun = G.run;
  const prevScreen = G.screen;
  const prevUnlocked = G.profile.ascensionUnlocked;
  const prevBest = G.profile.ascensionBest;
  const prevWins = G.profile.stats.wins;
  const world = G.profile.world;
  const prevQuestCards = [...world.questCards];

  if (A.MAX_ASCENSION !== 10) bad(`梦层上限应为 10，实际 ${A.MAX_ASCENSION}`);
  if (A.ASCENSION_LEVELS.length !== 11) bad(`梦层应有 0–10 共 11 层，实际 ${A.ASCENSION_LEVELS.length}`);
  const rewards = new Set();
  for (let level = 0; level <= A.MAX_ASCENSION; level += 1) {
    const entry = A.ascensionLevel(level);
    if (!entry || entry.level !== level) bad(`梦层 ${level} 的定义缺失或编号不符`);
    if (!entry.name || !entry.subtitle || !entry.desc || !entry.detail) bad(`梦层 ${level} 缺少名称或说明`);
    if (!Array.isArray(entry.tags)) bad(`梦层 ${level} 缺少规则标签`);
    if (level > 0) {
      if (!entry.tags.length) bad(`梦层 ${entry.name} 没有任何规则标签`);
      if (!entry.reward || !D.CARD_MAP[entry.reward]) bad(`梦层 ${entry.name} 的首通卡不存在：${entry.reward}`);
      if (D.CARD_MAP[entry.reward]?.questOnly !== true) bad(`梦层首通卡 ${entry.reward} 不是任务卡`);
      if (rewards.has(entry.reward)) bad(`梦层首通卡重复：${entry.reward}`);
      rewards.add(entry.reward);
    }
  }
  if (!A.ascensionLevel(6).enemyStartThorns) bad('棘梦应给敌人开局荆棘');
  if (!A.ascensionLevel(7).drawPenalty) bad('溺梦应削减每回合抽牌');
  if (!A.ascensionLevel(8).noItems || A.ascensionLevel(8).shopPriceScale <= 1) bad('无声应封住行囊并提高商店价格');
  if (!A.ascensionLevel(9).energyPenalty) bad('逆光应削减每回合能量');
  if (!A.ascensionLevel(10).trial || !A.ascensionLevel(10).noItems || !A.ascensionLevel(10).energyPenalty) bad('心渊应同时保留上层梦律');
  // 每日梦魇固定在 A2，不能吃到 A6+ 的规则压力，否则旧日挑战会换难度。
  const daily = A.ascensionLevel(2);
  if (daily.enemyStartThorns || daily.drawPenalty || daily.energyPenalty || daily.noItems || daily.shopPriceScale !== 1) {
    bad('每日梦魇固定层级不应被 A6+ 的梦律影响');
  }
  for (let level = 1; level <= A.MAX_ASCENSION; level += 1) {
    const prev = A.ascensionLevel(level - 1);
    const curr = A.ascensionLevel(level);
    if (curr.enemyHpScale <= prev.enemyHpScale) bad(`梦层 ${level} 的敌人生命没有继续上升`);
    if (curr.goldScale > prev.goldScale) bad(`梦层 ${level} 的金币惩罚反而变轻`);
    if (curr.restScale > prev.restScale) bad(`梦层 ${level} 的治疗惩罚反而变轻`);
    if (curr.enemyStartThorns < prev.enemyStartThorns) bad(`梦层 ${level} 的荆棘规则倒退了`);
    if (curr.drawPenalty < prev.drawPenalty) bad(`梦层 ${level} 的抽牌惩罚倒退了`);
    if (curr.energyPenalty < prev.energyPenalty) bad(`梦层 ${level} 的能量惩罚倒退了`);
    if (curr.shopPriceScale < prev.shopPriceScale) bad(`梦层 ${level} 的商店惩罚倒退了`);
    if (prev.noItems && !curr.noItems) bad(`梦层 ${level} 解除了上层封住的行囊`);
  }

  const makeRun = (level, extra = {}) => ({
    id: `depth-run-${level}`,
    seed: 'depth-seed',
    mode: 'adventure',
    originId: 'blade',
    regionId: 'corridor',
    regionName: '折廊',
    bossId: 'nightmare-dragon',
    deck: origin.starter.map((defId) => ({ defId, upgraded: false })),
    map: E.makeMap('corridor'),
    maxHp: origin.hp,
    hp: origin.hp,
    gold: 100,
    items: ['dewPotion', 'thunderStone'],
    relics: [],
    ascension: level,
    ascensionModifiers: A.ascensionModifiers(level),
    modifiers: {},
    dreamMutations: [],
    mutationMods: {},
    contracts: [],
    contractMods: {},
    originAwakening: [],
    floor: 3,
    totals: { cardsPlayed: 0, damageDealt: 0, enemiesFelled: 0 },
    status: 'active',
    ...extra,
  });
  const build = (level, extra = {}) => {
    G.run = makeRun(level, extra);
    return E.startAdventureBattle({ id: `depth-${level}`, type: 'battle' });
  };

  const base = build(0);
  const baseDraw = base.player.baseDraw;
  const baseEnergy = base.player.maxEnergy;
  if (base.rules.noItems) bad('初梦不应封住行囊');
  if (base.player.baseDraw !== Math.min(5, origin.resources.draw)) bad(`初梦抽牌应为基础值，实际 ${base.player.baseDraw}`);

  const six = build(6);
  if ((six.enemy.statuses.thorns || 0) < 3) bad(`棘梦敌人开局应有 3 层荆棘，实际 ${six.enemy.statuses.thorns || 0}`);
  const sixHpRatio = six.enemy.maxHp / D.ENEMY_MAP[six.enemy.defId].hp;
  const sixExpected = A.ascensionLevel(6).enemyHpScale * E.OPENING_DIFFICULTY.enemyHpScale;
  if (Math.abs(sixHpRatio - sixExpected) > 0.04) bad(`棘梦敌人生命倍率应为 ${sixExpected.toFixed(2)}，实际 ${sixHpRatio.toFixed(2)}`);

  const seven = build(7);
  if (seven.player.baseDraw !== Math.max(1, baseDraw - 1)) bad(`溺梦每回合应少抽 1 张，实际 ${seven.player.baseDraw}`);
  if ((seven.enemy.statuses.thorns || 0) < 3) bad('溺梦丢失了棘梦的荆棘规则');

  const eight = build(8);
  if (!eight.rules.noItems || eight.rules.noItemsSource !== 'ascension') bad('无声没有通过梦层封住行囊');
  if (E.useItem(eight, 'dewPotion').ok) bad('无声梦层下仍然用出了道具');
  if (!G.run.items.includes('dewPotion')) bad('无声梦层拒绝道具时仍然消耗了道具');
  if (E.shopPrice(G.run, 100) !== Math.round(100 * A.ascensionModifiers(8).shopPriceScale)) bad(`无声商店价格应为 ${Math.round(100 * A.ascensionModifiers(8).shopPriceScale)}，实际 ${E.shopPrice(G.run, 100)}`);

  const nine = build(9);
  if (nine.player.maxEnergy !== Math.max(1, baseEnergy - 1)) bad(`逆光能量应为 ${Math.max(1, baseEnergy - 1)}，实际 ${nine.player.maxEnergy}`);
  if (nine.enemy.damageBonus !== 2) bad(`逆光敌人攻击加成应为 2，实际 ${nine.enemy.damageBonus}`);
  if ((nine.enemy.statuses.strength || 0) !== 1) bad(`逆光敌人开局力量应为 1，实际 ${nine.enemy.statuses.strength || 0}`);
  if (nine.enemy.block !== 11) bad(`逆光敌人开局格挡应为 11，实际 ${nine.enemy.block}`);

  const ten = build(10);
  if (ten.player.baseDraw !== Math.max(1, baseDraw - 1)) bad(`心渊每回合应少抽 1 张，实际 ${ten.player.baseDraw}`);
  if (ten.player.maxEnergy !== Math.max(1, baseEnergy - 1)) bad(`心渊能量应为 ${Math.max(1, baseEnergy - 1)}，实际 ${ten.player.maxEnergy}`);
  if (!ten.rules.noItems || ten.rules.noItemsSource !== 'ascension') bad('心渊没有封住行囊');
  if ((ten.enemy.statuses.strength || 0) !== 2) bad(`心渊敌人开局力量应为 2，实际 ${ten.enemy.statuses.strength || 0}`);
  if (ten.enemy.block !== 12) bad(`心渊敌人开局格挡应为 12，实际 ${ten.enemy.block}`);
  if ((ten.enemy.statuses.thorns || 0) !== 4) bad(`心渊敌人开局荆棘应为 4，实际 ${ten.enemy.statuses.thorns || 0}`);
  if (ten.enemy.damageBonus !== 2) bad(`心渊敌人攻击加成应为 2，实际 ${ten.enemy.damageBonus}`);
  if (E.shopPrice(G.run, 100) !== 130) bad(`心渊商店价格应为 130，实际 ${E.shopPrice(G.run, 100)}`);
  const expectedRest = Math.ceil(G.run.maxHp * 0.22 * A.ascensionLevel(10).restScale);
  if (E.restHealAmount(G.run) !== expectedRest) bad(`心渊营火治疗应为 ${expectedRest}，实际 ${E.restHealAmount(G.run)}`);

  // 存读档：A8 的行囊封锁必须还原为梦层来源，而不是误报成契约。
  build(8);
  G.screen = 'battle';
  S.saveRunNow();
  G.run = null;
  const restored = S.restoreRunSave();
  if (!restored || restored.ascension !== 8) bad('存读档后梦层层级没有还原');
  if (!restored?.battle?.rules?.noItems || restored?.battle?.rules?.noItemsSource !== 'ascension') bad('存读档后梦层封囊状态没有还原');
  if (restored?.battle?.rules?.noItemsSource === 'contract') bad('梦层封囊被误还原成契约封囊');

  // 解锁：通关 9 层解锁 10 层，通关 10 层不越界。
  if (A.ascensionUnlockAfter(0, 0) !== 1) bad('通关初梦应解锁薄雾');
  if (A.ascensionUnlockAfter(9, 9) !== 10) bad('通关逆光应解锁心渊');
  if (A.ascensionUnlockAfter(10, 10) !== 10) bad('通关心渊不应越过上限');
  if (A.ascensionUnlockAfter(5, 7) !== 7) bad('重复通关低层不应降低已解锁层级');
  if (A.ascensionUnlockAfter(3, 0) !== 4) bad('通关层级应只解锁下一层');

  // 通关集成：A9 通关必须写回 A10 解锁，并发放逆光之刃。
  G.profile.ascensionUnlocked = 9;
  G.profile.ascensionBest = 9;
  G.run = makeRun(9, { hp: 30, gold: 60 });
  const summary = E.finishAdventure();
  if (!summary || summary.ascension !== 9) bad('A9 通关摘要缺失或层级不对');
  if (G.profile.ascensionUnlocked !== 10) bad(`A9 通关后应解锁 10 层，实际 ${G.profile.ascensionUnlocked}`);
  if (G.profile.ascensionBest !== 9) bad(`A9 通关后最高完成应为 9，实际 ${G.profile.ascensionBest}`);
  if (summary?.ascensionReward?.cardId !== 'backlightEdge') bad(`A9 首通卡应为 backlightEdge，实际 ${summary?.ascensionReward?.cardId || '无'}`);
  if (!world.questCards.includes('backlightEdge')) bad('A9 通关后没有把逆光之刃写入任务卡池');

  G.profile.ascensionUnlocked = prevUnlocked;
  G.profile.ascensionBest = prevBest;
  G.profile.stats.wins = prevWins;
  world.questCards = prevQuestCards;
  G.run = prevRun;
  G.screen = prevScreen;
  console.log(`  11 层 · 首通卡 ${rewards.size} 张 · A5→A10 规则递进通过 · A9→A10 解锁通过`);
}

// ── 17. 梦魇谱系与首领暴走 ──
console.log('\n=== 17. 梦魇谱系与首领暴走 ===');
{
  const S = await import('../../js/state.js');
  const origin = D.ORIGIN_MAP.blade;
  const strikeDeck = Array.from({ length: 8 }, () => ({ defId: 'strike', upgraded: false }));
  const setup = (enemyId, originId = 'blade') => {
    G.profile.originId = originId;
    G.profile.sandboxDeck = strikeDeck.map((entry) => ({ ...entry }));
    const battle = E.startSandboxBattle(enemyId);
    battle.player.hp = battle.player.maxHp;
    battle.player.block = 0;
    return battle;
  };
  const attackCards = (battle) => battle.hand
    .map((instance) => ({ instance, card: E.getBattleCard(instance, battle) }))
    .filter(({ instance, card }) => card?.type === 'attack' && !E.isCardSealed(battle, instance.uid));

  // 数据面：每个普通/精英都应该有一条可读的族规则，首领不该重复占用。
  const lineageIds = Object.keys(D.ENEMY_LINEAGES || {});
  if (lineageIds.length < 6) bad(`梦魇谱系应有至少 6 条，实际 ${lineageIds.length}`);
  const fodder = D.ENEMIES.filter((enemy) => enemy.tier === 'normal' || enemy.tier === 'elite');
  if (fodder.length < 14) bad(`普通/精英数量异常：${fodder.length}`);
  for (const enemy of fodder) {
    if (!enemy.lineage || !D.ENEMY_LINEAGES[enemy.lineage]) bad(`${enemy.name} 没有有效的梦魇谱系`);
  }
  for (const enemy of D.ENEMIES.filter((entry) => entry.tier === 'boss')) {
    if (enemy.lineage) bad(`首领 ${enemy.name} 不应再挂普通谱系`);
  }
  const families = new Set(fodder.map((enemy) => enemy.lineage));
  if (families.size !== 6) bad(`谱系应覆盖 6 种不同动词，实际 ${families.size}`);
  for (const lineage of Object.values(D.ENEMY_LINEAGES || {})) {
    if (!lineage.name || !lineage.glyph || !lineage.short || !lineage.desc || !lineage.color) bad(`谱系 ${lineage.id || '?'} 缺少展示信息`);
  }
  const surgeBosses = D.ENEMIES.filter((enemy) => enemy.surge);
  if (surgeBosses.length < 3) bad(`应有至少 3 位首领拥有梦魇暴走，实际 ${surgeBosses.length}`);
  for (const boss of surgeBosses) {
    if (boss.tier !== 'boss') bad(`${boss.name} 不是首领却拥有暴走`);
    if (boss.phase2) bad(`${boss.name} 同时拥有真形与暴走，演出会叠在一起`);
    if (!boss.surge.title || !boss.surge.line) bad(`${boss.name} 的暴走缺少标题或台词`);
    if (!(Number(boss.surge.at) > 0 && Number(boss.surge.at) < 1)) bad(`${boss.name} 的暴走阈值无效`);
  }
  const kwNames = K.KEYWORDS.map((entry) => entry.name);
  for (const name of ['梦魇谱系', '梦魇暴走']) {
    if (!kwNames.includes(name)) bad(`关键词手册缺少「${name}」`);
  }
  if (!K.KEYWORD_MAP['荆棘'].desc.includes('敌人')) bad('荆棘说明没有提到敌人也会拥有荆棘');

  // 通用荆棘：敌人的荆棘必须真的反伤，而且一张攻击牌只结算一次。
  const briar = setup('briar-beast');
  if ((briar.enemy.statuses.thorns || 0) !== 3) bad(`棘冠兽开局应有 3 层荆棘，实际 ${briar.enemy.statuses.thorns || 0}`);
  const briarAttack = attackCards(briar)[0];
  const briarHpBefore = briar.player.hp;
  const briarPlay = E.playCard(briar, briarAttack.instance.uid);
  if (!briarPlay.ok) bad(`荆棘测试的攻击牌打不出去：${briarPlay.error || ''}`);
  if (briarHpBefore - briar.player.hp !== 3) bad(`敌人 3 层荆棘应反伤 3 点，实际 ${briarHpBefore - briar.player.hp}`);
  if ((briar.enemy.statuses.thorns || 0) !== 4) bad(`棘冠兽应在被攻击后长到 4 层荆棘，实际 ${briar.enemy.statuses.thorns || 0}`);
  if (E.lineageInfo(briar)?.id !== 'thornCrown') bad('棘冠兽的谱系展示缺失');

  // 列阵：举盾的回合也会长出荆棘。
  const phalanx = setup('bone-sentinel');
  if ((phalanx.enemy.statuses.thorns || 0) !== 2) bad(`枯骨哨兵开局应有 2 层荆棘，实际 ${phalanx.enemy.statuses.thorns || 0}`);
  phalanx.enemy.pattern = [1];
  phalanx.enemy.moveIndex = 0;
  E.endTurn(phalanx);
  if ((phalanx.enemy.statuses.thorns || 0) !== 3) bad(`列阵获得格挡后应长到 3 层荆棘，实际 ${phalanx.enemy.statuses.thorns || 0}`);
  if ((phalanx.enemy.block || 0) < 8) bad(`枯骨哨兵使用不朽军势后应有 8 点格挡，实际 ${phalanx.enemy.block || 0}`);

  // 借名：周期性把一张手牌封到下个回合。
  const witch = setup('mist-witch');
  witch.enemy.lineageState.counter = 2;
  witch.parleySkip = true;
  E.endTurn(witch);
  if (!Array.isArray(witch.sealedUids) || witch.sealedUids.length !== 1) bad(`借名应封住 1 张手牌，实际 ${witch.sealedUids?.length || 0}`);
  const sealedUid = witch.sealedUids?.[0];
  if (!witch.hand.some((card) => card.uid === sealedUid)) bad('被封的牌不在手里');
  const sealedAttempt = E.playCard(witch, sealedUid);
  if (sealedAttempt.ok || !String(sealedAttempt.error).includes('名字')) bad('被封的手牌仍然可以打出');

  // 反祷：把敌人身上的减益原样念回给玩家。
  const priest = setup('rift-priest');
  priest.enemy.lineageState.counter = 1;
  priest.enemy.statuses.weak = 2;
  priest.player.statuses.weak = 0;
  priest.parleySkip = true;
  E.endTurn(priest);
  if ((priest.player.statuses.weak || 0) !== 1) bad(`反祷应回敬 1 层虚弱，实际 ${priest.player.statuses.weak || 0}`);
  if ((priest.enemy.statuses.weak || 0) > 1) bad('反祷没有消耗敌人自己的减益');

  // 腐殖：吞掉持续伤害换取治疗。
  const moss = setup('mossling');
  moss.enemy.hp = 18;
  moss.enemy.maxHp = 33;
  moss.enemy.statuses.poison = 6;
  moss.enemy.statuses.burn = 4;
  moss.parleySkip = true;
  E.endTurn(moss);
  if (moss.enemy.hp !== 10) bad(`腐殖吞毒后应剩 10 点生命（18-6-4+2），实际 ${moss.enemy.hp}`);
  if ((moss.enemy.statuses.poison || 0) !== 5) bad(`腐殖吞毒后中毒应剩 5 层，实际 ${moss.enemy.statuses.poison || 0}`);
  if ((moss.enemy.statuses.burn || 0) !== 0) bad(`腐殖应优先吞掉 2 层灼烧，实际剩 ${moss.enemy.statuses.burn || 0}`);

  // 棘冠：攻击会继续喂大荆棘，汲取会吞掉荆棘换取治疗。
  const crown = setup('briar-beast');
  crown.enemy.statuses.thorns = 6;
  crown.enemy.hp = 40;
  crown.enemy.pattern = [3];
  crown.enemy.moveIndex = 0;
  E.endTurn(crown);
  if (crown.enemy.hp !== 50) bad(`玫瑰汲取应回复 10 点生命，实际 ${crown.enemy.hp}`);
  if ((crown.enemy.statuses.thorns || 0) !== 4) bad(`汲取应吞掉 2 层荆棘，实际 ${crown.enemy.statuses.thorns || 0}`);

  // 镜影：第三张攻击牌会遭回击。用不叠格挡的术士，避免破晓连斩的护壁吃掉回击。
  const mirror = setup('shadow-knight', 'arcanist');
  mirror.player.energy = 10;
  const mirrorAttacks = attackCards(mirror);
  if (mirrorAttacks.length < 3) bad('镜影测试起手不足 3 张攻击牌');
  E.playCard(mirror, mirrorAttacks[0].instance.uid);
  E.playCard(mirror, mirrorAttacks[1].instance.uid);
  const mirrorHpBefore = mirror.player.hp;
  E.playCard(mirror, mirrorAttacks[2].instance.uid);
  if (mirrorHpBefore - mirror.player.hp !== 7) bad(`镜影第三击应回击 7 点，实际 ${mirrorHpBefore - mirror.player.hp}`);
  if ((mirror.enemy.lineageState.echo || 0) !== 0) bad('镜影回击后没有清空层数');

  // 借名巫婆：借走最贵的牌，并在 2 个回合后归还。
  const thief = setup('name-thief');
  thief.enemy.pattern = [0];
  thief.enemy.moveIndex = 0;
  E.endTurn(thief);
  if ((thief.enemy.stolen || []).length !== 1) bad(`借名巫婆应借走 1 张牌，实际 ${thief.enemy.stolen?.length || 0}`);
  const stolen = thief.enemy.stolen?.[0];
  if (!stolen) bad('借名巫婆没有记录借走的牌');
  else {
    if ([thief.hand, thief.drawPile, thief.discardPile, thief.exhaustPile].some((pile) => pile.some((card) => card.uid === stolen.uid))) {
      bad('被借走的牌还留在牌堆里');
    }
    thief.enemy.stolen[0].returnTurn = thief.turn + 1;
    thief.parleySkip = true;
    E.endTurn(thief);
    if ((thief.enemy.stolen || []).length !== 0) bad('借走的牌到期后没有归还');
    if (!thief.discardPile.some((card) => card.uid === stolen.uid)) bad('归还的牌没有进入弃牌堆');
  }

  // 镜影骑士：深渊誓约夺走玩家的力量。
  const knight = setup('shadow-knight');
  knight.enemy.pattern = [3];
  knight.enemy.moveIndex = 0;
  knight.player.statuses.strength = 2;
  E.endTurn(knight);
  if ((knight.player.statuses.strength || 0) !== 0) bad(`深渊誓约应夺走 2 层力量，玩家实际剩 ${knight.player.statuses.strength || 0}`);
  if ((knight.enemy.statuses.strength || 0) < 2) bad('深渊誓约没有把力量交给镜影骑士');

  // 千面雾后：暴走后一次封 2 张，并给每张封印附上 3 点格挡。
  const queen = setup('mist-queen');
  if (E.surgeInfo(queen)?.active) bad('暴走不应在开场就触发');
  if (queen.enemy.surgeTitle) bad('暴走标题不应在触发前出现');
  const queenThreshold = Math.max(1, Math.ceil(queen.enemy.maxHp * 0.5));
  queen.enemy.hp = queenThreshold;
  queen.player.energy = 10;
  const queenAttack = attackCards(queen)[0];
  const queenPlay = E.playCard(queen, queenAttack.instance.uid);
  if (!queen.enemy.surged) bad('千面雾后生命过半后没有暴走');
  if (!queenPlay.fx.some((item) => item.kind === 'surge')) bad('暴走没有推送演出事件');
  if (E.surgeInfo(queen)?.title !== '千面倾覆') bad('千面雾后的暴走标题不正确');
  queen.parleySkip = true;
  E.endTurn(queen);
  if ((queen.sealedUids || []).length !== 2) bad(`千面倾覆应封住 2 张手牌，实际 ${queen.sealedUids?.length || 0}`);
  if ((queen.enemy.block || 0) !== 6) bad(`千面倾覆每张封印应给 3 点格挡，实际 ${queen.enemy.block || 0}`);

  // 无冠之王：蜡烛成对熄灭，并塞入一张呜咽。
  const king = setup('bone-king');
  const countWhimper = (battle) => ['hand', 'drawPile', 'discardPile', 'exhaustPile']
    .reduce((sum, key) => sum + battle[key].filter((card) => card.defId === 'whimper').length, 0);
  const whimperedBefore = countWhimper(king);
  king.enemy.hp = Math.max(1, Math.ceil(king.enemy.maxHp * 0.5));
  king.player.energy = 10;
  const kingAttack = attackCards(king)[0];
  E.playCard(king, kingAttack.instance.uid);
  if (!king.enemy.surged) bad('无冠之王生命过半后没有暴走');
  if (countWhimper(king) !== whimperedBefore + 1) bad('王座燃尽没有塞入呜咽');
  king.enemy.mechanic.value = 3;
  king.parleySkip = true;
  E.endTurn(king);
  if (king.enemy.mechanic.value !== 1) bad(`王座燃尽应每个回合熄灭 2 根蜡烛，实际剩 ${king.enemy.mechanic.value}`);

  // 潮钟守夜人：风暴潮让涨潮的攻击附带虚弱。
  const tide = setup('tide-warden');
  tide.enemy.hp = Math.max(1, Math.ceil(tide.enemy.maxHp * 0.5));
  tide.player.energy = 10;
  const tideAttack = attackCards(tide)[0];
  E.playCard(tide, tideAttack.instance.uid);
  if (!tide.enemy.surged || !tide.enemy.surge?.surgeWeak) bad('潮钟守夜人的风暴潮没有生效');
  tide.parleySkip = true;
  E.endTurn(tide);
  tide.parleySkip = true;
  E.endTurn(tide);
  tide.player.statuses.weak = 0;
  tide.player.block = 0;
  tide.enemy.pattern = [0];
  tide.enemy.moveIndex = 0;
  tide.parleySkip = false;
  E.endTurn(tide);
  if ((tide.player.statuses.weak || 0) !== 1) bad(`风暴潮的涨潮攻击应附带 1 层虚弱，实际 ${tide.player.statuses.weak || 0}`);

  // 存读档：谱系、封印、借走的牌与暴走状态都要活下来。
  const makeSaveRun = (battle) => ({
    id: 'lineage-save', seed: 'lineage-seed', mode: 'adventure', originId: 'blade',
    regionId: 'corridor', regionName: '折廊', bossId: 'nightmare-dragon',
    deck: origin.starter.map((defId) => ({ defId, upgraded: false })),
    map: E.makeMap('corridor'), maxHp: origin.hp, hp: origin.hp, gold: 100,
    items: [], relics: [], ascension: 0, ascensionModifiers: A.ascensionModifiers(0),
    modifiers: {}, dreamMutations: [], mutationMods: {}, contracts: [], contractMods: {},
    floor: 1, totals: { cardsPlayed: 0, damageDealt: 0, enemiesFelled: 0 },
    status: 'active', battle,
  });
  const saveThief = setup('name-thief');
  saveThief.enemy.pattern = [0];
  saveThief.enemy.moveIndex = 0;
  E.endTurn(saveThief);
  const savedStolenUid = saveThief.enemy.stolen?.[0]?.uid;
  const savedSealUid = saveThief.hand?.[0]?.uid;
  if (savedSealUid) {
    saveThief.sealedUids = [savedSealUid];
    saveThief.sealedUid = savedSealUid;
  }
  const savedCounter = saveThief.enemy.lineageState.counter;
  G.run = makeSaveRun(saveThief);
  G.screen = 'battle';
  S.saveRunNow();
  G.run = null;
  const restoredThief = S.restoreRunSave();
  if (!restoredThief) bad('谱系战斗存读档失败');
  else {
    const enemy = restoredThief.battle?.enemy;
    if (enemy?.lineage !== 'borrowedName') bad(`读档后谱系丢失：${enemy?.lineage || '无'}`);
    if ((enemy?.lineageState?.counter || 0) !== savedCounter) bad('读档后谱系计数丢失');
    if (!enemy?.stolen?.some((entry) => entry.uid === savedStolenUid)) bad('读档后借走的牌丢失');
    if (!restoredThief.battle?.sealedUids?.includes(savedSealUid)) bad('读档后封印手牌丢失');
  }

  const saveQueen = setup('mist-queen');
  saveQueen.enemy.hp = Math.max(1, Math.ceil(saveQueen.enemy.maxHp * 0.5));
  saveQueen.player.energy = 10;
  E.playCard(saveQueen, attackCards(saveQueen)[0].instance.uid);
  G.run = makeSaveRun(saveQueen);
  G.screen = 'battle';
  S.saveRunNow();
  G.run = null;
  const restoredQueen = S.restoreRunSave();
  if (!restoredQueen?.battle?.enemy?.surged) bad('读档后梦魇暴走状态丢失');
  else if (restoredQueen.battle.enemy.surgeTitle !== '千面倾覆') bad('读档后暴走标题丢失');
  else if (restoredQueen.battle.enemy.surge?.sealCount !== 2) bad('读档后暴走规则丢失');

  G.run = null;
  G.screen = 'map';
}

// ── 18. 绝境反扑与梦醒结算 ──
console.log('\n=== 18. 绝境反扑与梦醒结算 ===');
{
  const S = await import('../../js/state.js');
  const before18 = fails;
  const origin = D.ORIGIN_MAP.blade;
  const strike = { defId: 'strike', upgraded: false, uid: 'last-stand-strike' };
  const setup = (seed) => {
    G.run = null;
    G.screen = 'map';
    E.startAdventure('blade', 'corridor', { seed });
    const node = G.run.map.flat().find((entry) => entry.type === 'battle');
    const battle = E.startAdventureBattle(node);
    battle.enemy.pattern = [0];
    battle.enemy.moveIndex = 0;
    battle.parleySkip = true;
    battle.player.hp = Math.max(1, Math.ceil(battle.player.maxHp * E.LAST_STAND.hpRatio));
    battle.player.block = 999;
    E.endTurn(battle);
    return battle;
  };
  const ensureAttack = (battle) => {
    let card = battle.hand.find((entry) => {
      const def = D.CARD_MAP[entry.defId];
      return def?.type === 'attack' && !E.isCardSealed(battle, entry.uid);
    });
    if (!card) {
      card = { ...strike, uid: `last-stand-strike-${battle.turn}` };
      battle.hand.push(card);
    }
    battle.player.energy = 10;
    battle.player.statuses.weak = 0;
    battle.player.statuses.vulnerable = 0;
    return card;
  };

  if (E.LAST_STAND.scarHp !== 5 || E.LAST_STAND.block !== 8 || E.LAST_STAND.draw !== 2 || E.LAST_STAND.energy !== 2) {
    bad('绝境反扑的数值常量与文案不一致');
  }
  for (const npcId of ['ember', 'ferry', 'ink']) {
    const npc = L.NPC_MAP[npcId];
    if (!npc?.lastStandLine) bad(`${npcId} 缺少绝境台词`);
    if (!npc?.defeatLine) bad(`${npcId} 缺少失败台词`);
  }
  for (const entry of D.ORIGINS) {
    if (!entry.lastStandLine) bad(`${entry.name} 缺少起源绝境台词`);
    if (!entry.defeatLine) bad(`${entry.name} 缺少起源失败台词`);
  }
  for (const name of ['绝境反扑', '梦痕']) {
    if (!K.KEYWORD_MAP[name]) bad(`关键词手册缺少「${name}」`);
  }

  // 触发：只在远征、生命 ≤25%、每个回合开始时问一次。
  const battle = setup('last-stand-trigger');
  if (!battle.lastStand?.offered) bad('生命降到 25% 后没有触发绝境反扑');
  else {
    if (battle.lastStand.turn !== battle.turn) bad('绝境反扑没有记录触发回合');
    if (battle.lastStand.hpAtOffer !== battle.player.hp) bad('绝境反扑没有记录触发时的生命');
    if (!battle.lastStand.line) bad('绝境反扑缺少角色台词');
  }
  const offerTurn = battle.lastStand?.turn;
  const hpBeforeAccept = battle.player.hp;
  const maxBeforeAccept = G.run.maxHp;
  const handBefore = battle.hand.length;
  const energyBefore = battle.player.energy;
  const blockBefore = battle.player.block;
  const accepted = E.resolveLastStand(battle, true);
  if (!accepted.ok) bad('接受绝境反扑失败');
  if (battle.player.block !== blockBefore + E.LAST_STAND.block) bad(`接受后应 +${E.LAST_STAND.block} 格挡，实际 ${battle.player.block - blockBefore}`);
  if (battle.hand.length !== handBefore + E.LAST_STAND.draw) bad(`接受后应抽 ${E.LAST_STAND.draw} 张，实际 ${battle.hand.length - handBefore}`);
  if (battle.player.energy !== Math.min(10, energyBefore + E.LAST_STAND.energy)) bad('接受后能量不正确');
  if (!battle.lastStand.costPending) bad('接受后没有挂起梦痕代价');
  if (E.resolveLastStand(battle, true).ok) bad('同一场战斗可以重复接受绝境反扑');
  if (battle.lastStand.offered && battle.lastStand.turn !== offerTurn) bad('绝境反扑重复触发了第二次');

  // 胜利：代价在结算前落下，生命上限 -5，奖励里要带上梦痕。
  battle.enemy.hp = 1;
  battle.enemy.block = 0;
  battle.enemy.statuses.thorns = 0;
  const winCard = ensureAttack(battle);
  E.playCard(battle, winCard.uid);
  if (battle.phase !== 'victory') bad('绝境反扑后未能正常结束战斗');
  if (G.run.maxHp !== maxBeforeAccept - E.LAST_STAND.scarHp) bad(`胜利后生命上限应 -${E.LAST_STAND.scarHp}，实际 ${maxBeforeAccept - G.run.maxHp}`);
  if (battle.player.maxHp !== G.run.maxHp) bad('胜利后战斗血条上限没有同步');
  if (battle.player.hp > hpBeforeAccept) bad('胜利结算不应把生命上限的损失补回来');
  if (!Array.isArray(G.run.scars) || G.run.scars.length !== 1) bad(`胜利后应留下 1 道梦痕，实际 ${G.run.scars?.length || 0}`);
  else if (G.run.scars[0].hpCost !== E.LAST_STAND.scarHp) bad('梦痕记录的代价不正确');
  if (battle.rewards?.lastStand?.scar?.hpCost !== E.LAST_STAND.scarHp) bad('胜利奖励没有带上梦痕信息');
  if (!battle.lastStand.costPaid || battle.lastStand.costPending) bad('胜利后梦痕代价没有结清');

  // 拒绝：不欠债，也不能再被问第二次。
  const declinedBattle = setup('last-stand-decline');
  const declineMaxHp = G.run.maxHp;
  const declineOfferTurn = declinedBattle.lastStand.turn;
  const declined = E.resolveLastStand(declinedBattle, false);
  if (!declined.ok || declined.accepted) bad('拒绝绝境反扑失败');
  if (declinedBattle.lastStand.costPending) bad('拒绝绝境反扑不应欠下梦痕');
  if (G.run.maxHp !== declineMaxHp) bad('拒绝绝境反扑不应削减生命上限');
  declinedBattle.parleySkip = true;
  declinedBattle.player.block = 999;
  E.endTurn(declinedBattle);
  if (declinedBattle.lastStand.turn !== declineOfferTurn || !declinedBattle.lastStand.resolved) bad('拒绝后绝境反扑又出现了');
  declinedBattle.enemy.hp = 1;
  declinedBattle.enemy.statuses.thorns = 0;
  const declineWinCard = ensureAttack(declinedBattle);
  E.playCard(declinedBattle, declineWinCard.uid);
  if (G.run.maxHp !== declineMaxHp) bad('拒绝后胜利仍被削减生命上限');
  if ((G.run.scars || []).length !== 0) bad('拒绝后胜利仍留下了梦痕');

  // 同伴：见过面的同行者会在绝境里开口。
  G.profile.world.npcs.ferry.met = true;
  const companionBattle = setup('last-stand-companion');
  if (companionBattle.lastStand?.companionId !== 'ferry') bad('绝境反扑没有请出羁绊最高的同行者');
  if (!companionBattle.lastStand?.line?.includes('船')) bad('绝境反扑没有使用同行者的台词');
  G.profile.world.npcs.ferry.met = false;

  // 失败：还没还的债一笔勾销，但梦醒结算要记得你借过气。
  const defeatBattle = setup('last-stand-defeat');
  const defeatMaxHp = G.run.maxHp;
  E.resolveLastStand(defeatBattle, true);
  defeatBattle.player.hp = 1;
  defeatBattle.player.block = 0;
  defeatBattle.enemy.hp = 999;
  defeatBattle.enemy.statuses.thorns = 99;
  const defeatCard = ensureAttack(defeatBattle);
  E.playCard(defeatBattle, defeatCard.uid);
  if (defeatBattle.phase !== 'defeat') bad('荆棘反伤未能触发失败');
  if (defeatBattle.lastStand.costPending || !defeatBattle.lastStand.costWaived) bad('失败后梦痕代价没有豁免');
  if (G.run.maxHp !== defeatMaxHp) bad('失败不应削减生命上限');
  if ((G.run.scars || []).length !== 0) bad('失败不应留下梦痕');
  if (!defeatBattle.defeatRecap?.usedLastStand) bad('梦醒结算没有记录使用过绝境反扑');
  if (!defeatBattle.defeatRecap?.costWaived) bad('梦醒结算没有说明代价被豁免');
  if (!defeatBattle.defeatRecap?.line) bad('梦醒结算缺少角色台词');
  if (!defeatBattle.defeatRecap?.elegyAvailable || defeatBattle.defeatRecap.elegyId !== 'defeat-first') bad('首败没有留下可听的战败挽歌');
  if (Number(G.profile.world.stats.defeats) < 1) bad('战败次数没有写进群岛档案');

  // 撤退：借来的呼吸不能靠离开战斗赖掉。
  const retreatBattle = setup('last-stand-retreat');
  const retreatMaxHp = G.run.maxHp;
  E.resolveLastStand(retreatBattle, true);
  E.leaveBattleEarly();
  if (G.run.maxHp !== retreatMaxHp - E.LAST_STAND.scarHp) bad(`撤退后生命上限应 -${E.LAST_STAND.scarHp}`);
  if ((G.run.scars || []).length !== 1) bad('撤退后应留下 1 道梦痕');
  if (G.run.battle) bad('撤退后战斗没有关闭');

  // 存读档：绝境状态、生命上限与梦痕都要活过来。
  const saveBattle = setup('last-stand-save');
  E.resolveLastStand(saveBattle, true);
  const companionName = saveBattle.lastStand.companionName;
  G.screen = 'battle';
  S.saveRunNow();
  G.run = null;
  const restored = S.restoreRunSave();
  if (!restored) bad('绝境反扑存读档失败');
  else {
    const stand = restored.battle?.lastStand;
    if (!stand?.offered || !stand?.accepted) bad('读档后绝境反扑状态丢失');
    if (!stand?.costPending) bad('读档后梦痕代价丢失');
    if (stand?.companionName !== companionName) bad('读档后绝境同伴台词丢失');
    if (restored.battle.player.maxHp !== restored.maxHp) bad('读档后战斗血条上限没有与远征同步');
    if (Number(restored.hp) > Number(restored.maxHp)) bad('读档后生命超过上限');
  }

  // 梦痕本身也要能存读档。
  if (restored) {
    G.run = restored;
    G.run.battle = null;
    G.run.pendingNodeId = null;
    G.run.scars = [{
      id: 'save-scar', name: '借气', label: '梦痕 · 生命上限 -5', hpCost: 5,
      enemyName: '苔沼泥团', enemyId: 'mossling', tier: 'normal',
      regionId: 'corridor', regionName: '折廊岛', turn: 3, at: Date.now(),
    }];
    G.run.maxHp = origin.hp - 5;
    G.run.hp = G.run.maxHp;
    G.screen = 'map';
    S.saveRunNow();
    G.run = null;
    const scarRun = S.restoreRunSave();
    if (!scarRun) bad('梦痕存读档失败');
    else if (scarRun.scars?.[0]?.hpCost !== 5 || scarRun.scars[0].regionName !== '折廊岛') bad('读档后梦痕内容丢失');
    else if (scarRun.maxHp !== origin.hp - 5) bad('读档后生命上限没有保留');
    else if (scarRun.hp !== scarRun.maxHp) bad('读档后生命没有夹回上限');
  }

  G.run = null;
  G.screen = 'map';
  if (fails === before18) console.log('  触发 / 接受 / 拒绝 / 胜利 / 失败 / 撤退 / 存读档 —— 全部通过');
}

// ── 19. 梦压：觉醒只加压首领 ──
console.log('\n=== 19. 梦压（觉醒对首领的压力）===');
{
  const before19 = fails;
  const pressure = E.AWAKENING_PRESSURE;
  if (!(pressure.bossHpPerTier > 0 && pressure.bossDamagePerTier > 0)) bad('梦压没有给首领配置生命/攻击成长');
  if (!(pressure.bossStrengthPerTier > 0 && pressure.phase2EarlyPerTier > 0)) bad('梦压没有配置开局力量/真形提前');

  const makeBattle = (tier, awakened) => {
    G.run = null;
    G.screen = 'map';
    E.startAdventure('blade', 'corridor', { seed: 'dream-pressure-regression' });
    if (awakened) {
      G.run.originAwakening = ['bladeTempo', 'bladeDawn'];
      G.run.originAwakeningTier = 2;
    }
    const node = G.run.map.flat().find((entry) => entry.type === tier);
    return E.startAdventureBattle(node);
  };

  const baseBoss = makeBattle('boss', false);
  const pressedBoss = makeBattle('boss', true);
  const tierCount = G.run.originAwakening.length;
  if (!baseBoss || !pressedBoss) bad('梦压回归无法创建首领战');
  else {
    const hpRatio = pressedBoss.enemy.maxHp / Math.max(1, baseBoss.enemy.maxHp);
    const expectedHp = 1 + tierCount * pressure.bossHpPerTier;
    if (Math.abs(hpRatio - expectedHp) > 0.02) bad(`首领生命倍率应为 ${expectedHp.toFixed(2)}，实际 ${hpRatio.toFixed(2)}`);
    const damageRatio = pressedBoss.enemy.powerScale / Math.max(0.001, baseBoss.enemy.powerScale);
    const expectedDamage = 1 + tierCount * pressure.bossDamagePerTier;
    if (Math.abs(damageRatio - expectedDamage) > 0.001) bad(`首领攻击倍率应为 ${expectedDamage.toFixed(2)}，实际 ${damageRatio.toFixed(2)}`);
    const baseStrength = Number(baseBoss.enemy.statuses.strength) || 0;
    const pressedStrength = Number(pressedBoss.enemy.statuses.strength) || 0;
    if (pressedStrength !== baseStrength + tierCount * pressure.bossStrengthPerTier) {
      bad(`首领开局力量应 +${tierCount * pressure.bossStrengthPerTier}，实际 ${pressedStrength - baseStrength}`);
    }
    if (baseBoss.enemy.phase2) {
      const baseAt = Number(baseBoss.enemy.phase2.at) || 0.5;
      const pressedAt = Number(pressedBoss.enemy.phase2.at) || 0.5;
      const expectedAt = Math.max(pressure.minPhase2At, baseAt - tierCount * pressure.phase2EarlyPerTier);
      if (Math.abs(pressedAt - expectedAt) > 0.001) bad(`首领真形应提前到 ${expectedAt.toFixed(2)}，实际 ${pressedAt.toFixed(2)}`);
    } else {
      bad('折廊首领缺少二阶段，无法验证真形提前');
    }
    const baseNormal = makeBattle('battle', false);
    const pressedNormal = makeBattle('battle', true);
    if (!baseNormal || !pressedNormal) bad('梦压回归无法创建普通战');
    else {
      if (pressedNormal.enemy.maxHp !== baseNormal.enemy.maxHp) bad('梦压不应改变普通敌人的生命');
      if (pressedNormal.enemy.powerScale !== baseNormal.enemy.powerScale) bad('梦压不应改变普通敌人的攻击');
      if ((Number(pressedNormal.enemy.statuses.strength) || 0) !== (Number(baseNormal.enemy.statuses.strength) || 0)) {
        bad('梦压不应改变普通敌人的开局力量');
      }
    }
  }
  const bladeDawn = D.ORIGIN_AWAKENINGS.blade.find((item) => item.id === 'bladeDawn');
  if (bladeDawn?.mods?.triggerDraw) bad('黎明剑域不应再额外抽牌（已改为易伤）');
  if (!bladeDawn?.mods?.triggerVulnerable) bad('黎明剑域缺少易伤效果');
  const pyrePyre = D.ORIGIN_AWAKENINGS.pyre.find((item) => item.id === 'pyrePyre');
  if (!pyrePyre?.mods?.triggerBurn || pyrePyre?.mods?.triggerStrength) bad('薪尽应改为灼烧而非继续叠力量');

  G.run = null;
  G.screen = 'map';
  if (fails === before19) console.log('  首领生命/攻击/力量/真形提前 · 普通战不受影响 —— 全部通过');
}

// ── 20. 序章图与远征计数 ──
console.log('\n=== 20. 序章图与远征计数 ===');
{
  const before20 = fails;
  const W = await import('../../js/world-state.js');
  const story = L.STORIES.intro;
  const introArt = SA.storyArtFor('intro');
  if (!introArt?.background) bad('序章缺少背景图配置');
  else {
    const artFiles = [
      introArt.background,
      ...Object.values(introArt.scenes || {}),
      ...Object.values(introArt.props || {}).map((entry) => entry.src),
    ];
    for (const file of new Set(artFiles.filter(Boolean))) {
      if (!existsSync(file)) bad(`序章图片缺失 ${file}`);
    }
  }
  if (story?.lines?.[0]?.prop !== 'clock') bad('序章第一句缺少钟表道具');
  if (story?.lines?.[4]?.scene !== 'shipwreck') bad('序章沉船回忆没有切换场景');
  const deepSpeakers = new Set((L.STORIES['intro-deep']?.lines || []).map((line) => line.who));
  for (const name of ['摆渡人 · 舟', '拾页者 · 墨']) {
    if (!deepSpeakers.has(name)) bad(`第二段序章没有${name}开口`);
    if (!SA.STORY_CAST[name]) bad(`第二段序章缺少${name}的立绘`);
  }

  // 全量：每段剧情都有背景，场景 / 道具按键位存在，开口的人都有肖像。
  // 背景、场景、道具图必须由单一故事独占，不允许跨故事复用。
  const artOwners = new Map();
  const claim = (file, id) => {
    if (!file) return;
    const list = artOwners.get(file) || [];
    if (!list.includes(id)) list.push(id);
    artOwners.set(file, list);
  };
  for (const [id, entry] of Object.entries(L.STORIES)) {
    const art = SA.storyArtFor(id);
    if (!art?.background) { bad(`${id}: 缺少剧情背景`); continue; }
    claim(art.background, id);
    if (!existsSync(art.background)) bad(`${id}: 背景文件缺失 ${art.background}`);
    for (const [sceneId, file] of Object.entries(art.scenes || {})) {
      claim(file, id);
      if (!file || !existsSync(file)) bad(`${id}: 场景 ${sceneId} 文件缺失`);
    }
    for (const [propId, meta] of Object.entries(art.props || {})) {
      claim(meta?.src, id);
      if (!meta?.src || !existsSync(meta.src)) bad(`${id}: 道具 ${propId} 文件缺失`);
    }
    // 奶蛙蛙彩蛋会接在主线末尾，换景行号可能落在追加段里。
    const playback = L.storyLines(id, 'milkfrog');
    for (const [index, beat] of Object.entries(art.beats || {})) {
      if (Number(index) >= playback.length) bad(`${id}: 换景行号 ${index} 越界`);
      if (beat.scene && !art.scenes?.[beat.scene]) bad(`${id}: 换景 ${beat.scene} 未定义`);
      if (beat.prop && !art.props?.[beat.prop]) bad(`${id}: 道具 ${beat.prop} 未定义`);
    }
    playback.forEach((line, index) => {
      if (line.scene && !art.scenes?.[line.scene]) bad(`${id}: 第 ${index} 句场景 ${line.scene} 未定义`);
      if (line.prop && !art.props?.[line.prop]) bad(`${id}: 第 ${index} 句道具 ${line.prop} 未定义`);
    });
    const speakers = new Set(playback.map((line) => line.who).filter((who) => who && who !== '旁白' && who !== '你'));
    for (const who of speakers) {
      if (!SA.STORY_CAST[who]) bad(`${id}: ${who} 缺少人物肖像`);
    }
  }
  for (const [file, ids] of artOwners) {
    if (ids.length > 1) bad(`剧情图片跨故事复用 ${file}: ${ids.join(' / ')}`);
  }

  const world = W.defaultWorld();
  if (world.stats.runs !== 0) bad('新群岛档案的远征次数应为 0');
  const restored = W.sanitizeWorld({ ...world, stats: { ...world.stats, runs: 3 } });
  if (restored.stats.runs !== 3) bad('存档没有保留群岛远征次数');
  G.run = null;
  const beforeRuns = Number(G.profile.world.stats.runs) || 0;
  E.startAdventure('blade', 'corridor', { seed: 'story-runs-regression' });
  if ((Number(G.profile.world.stats.runs) || 0) !== beforeRuns + 1) bad('远征没有写入群岛档案的 runs');
  G.profile.world.flags.intro = true;
  G.profile.world.flags.introDeep = false;
  if (!W.pickWorldStories(G.profile.world).includes('intro-deep')) bad('完成首趟远征后没有排入 intro-deep');
  G.run = null;
  G.screen = 'map';
  if (fails === before20) console.log('  全剧情图片 / 道具 / 肖像 / 远征计数 —— 全部通过');
}

// ── 21. 首领双命条（只做显示分池，不改引擎 HP）──
console.log('\n=== 21. 首领双命条 ===');
{
  const before21 = fails;
  const BG = await import('../../js/boss-gauge.js');
  const PA = await import('../../js/phase-art.js');
  const cases = [
    ['nightmare-dragon', 66],
    ['mirror-sovereign', 69],
    ['ash-saint', 75],
    ['paper-queen', 65],
    ['hollow-heart', 62],
  ];
  for (const [id, phase2Max] of cases) {
    const def = D.ENEMY_MAP[id];
    if (!def?.phase2) { bad(`${id}: 没有二阶段定义`); continue; }
    const hp = phase2Max;
    const battle = {
      mode: 'battle',
      startedAt: 917_000 + cases.findIndex(([x]) => x === id),
      enemy: {
        defId: id,
        maxHp: def.hp,
        hp,
        phase2: { ...def.phase2, at: def.phase2.at },
      },
    };
    const pools = BG.bossPhasePools(battle.enemy);
    if (!pools) { bad(`${id}: 没有生成双命池`); continue; }
    if (pools.phase2.max !== phase2Max) bad(`${id}: 第二阶段上限 ${pools.phase2.max}，应为 ${phase2Max}`);
    if (pools.phase1.max + pools.phase2.max !== def.hp) bad(`${id}: 两条命上限之和与总生命不一致`);
    if (pools.phase2.hp !== phase2Max) bad(`${id}: 击败第一阶段时第二阶段应为满血`);
    const hidden = BG.bossGaugeMarkup(battle);
    if (hidden.includes('is-open') || hidden.includes('is-broken')) bad(`${id}: 未揭示时血条已展开`);
    if (!hidden.includes('width:0%;') && !hidden.includes('width:0%')) bad(`${id}: 未揭示时第二阶段血条不是空的`);
    if ((hidden.match(/data-boss-hp/g) || []).length !== 2) bad(`${id}: 不是两条独立血槽`);
    PA.markPhaseArtRevealed(battle);
    const awake = BG.bossGaugeMarkup(battle);
    if (!awake.includes('is-open') || !awake.includes('is-broken')) bad(`${id}: 揭示后血条没有点亮`);
    if (!awake.includes(`aria-label="第二阶段生命"`)) bad(`${id}: 第二阶段血条缺少无障碍标签`);
    if (!awake.includes('width:100.00%')) bad(`${id}: 揭示后第二阶段血条不是满的`);
  }
  if (fails === before21) console.log('  五首领分池 / 未揭示折叠 / 揭示后满条 —— 全部通过');
}

console.log(`\n${fails === 0 ? '✅ 全部通过' : `❌ ${fails} 项失败`}`);
process.exit(fails ? 1 : 0);