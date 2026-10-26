import { esc } from './utils.js';

export const KEYWORDS = [
  { name: '格挡', glyph: '挡', group: '战斗', desc: '抵消等量伤害。回合开始时清空，除非仍有「留壁」。' },
  { name: '能量', glyph: '能', group: '战斗', desc: '打出卡牌需要消耗能量。每回合开始时恢复到能量上限。' },
  { name: '无视格挡', glyph: '穿', group: '战斗', desc: '这部分伤害不经过格挡，直接扣除生命。' },
  { name: '力量', glyph: '力', group: '状态', desc: '每层让每一次攻击的每一段伤害 +1。' },
  { name: '敏捷', glyph: '敏', group: '状态', desc: '每层让获得格挡的卡牌与道具额外 +1 格挡。' },
  { name: '易伤', glyph: '易', group: '状态', desc: '受到的攻击伤害提高 50%，每次回合结束减 1 层。' },
  { name: '虚弱', glyph: '弱', group: '状态', desc: '造成的攻击伤害降低 25%，每次回合结束减 1 层。' },
  { name: '中毒', glyph: '毒', group: '状态', desc: '敌人回合开始时失去等同层数的生命，随后层数减 1；无视格挡。' },
  { name: '灼烧', glyph: '燃', group: '状态', desc: '回合结束时失去等同层数的生命，随后层数减半；无视格挡。' },
  { name: '荆棘', glyph: '棘', group: '状态', desc: '受到攻击时，对攻击者造成等同层数的伤害，每次攻击只结算一次。敌人也可以拥有荆棘。' },
  { name: '回春', glyph: '芽', group: '状态', desc: '回合开始时回复等同层数的生命，随后层数减 1。' },
  { name: '留壁', glyph: '壁', group: '状态', desc: '接下来的 N 个回合开始时，格挡不会清空。' },
  { name: '连斩', glyph: '斩', group: '机制', desc: '破晓剑客的专属机制。每回合每打出 3 张攻击牌获得 1 层力量，回合开始时连斩数清空。' },
  { name: '星轨', glyph: '轨', group: '机制', desc: '星陨术士的专属机制。每打出 2 张技能牌获得 1 点能量与 1 层敏捷，触发后重新计数。' },
  { name: '蚀印', glyph: '蚀', group: '机制', desc: '暮影行者的专属机制。每施加 1 层中毒积攒 1 层蚀印，满 4 层时引爆：造成当前中毒层数 ×1.6 的伤害，清空余毒并留下 1 层。' },
  { name: '焚心', glyph: '焚', group: '机制', desc: '烬誓者的专属机制。施加灼烧、失去生命或受到灼烧会积攒焚心，满 9 层时获得 2 层力量。' },
  { name: '共鸣', glyph: '鸣', group: '构筑', desc: '主导流派达到 4 / 8 / 12 张，且占流派牌 40% / 50% / 60% 时点亮 I / II / III 级共鸣。占比不够，堆再多也只能拿低档；与混响互斥。' },
  { name: '混响', glyph: '响', group: '构筑', desc: '两派各 3 张、或三派各 2 张，且没有流派占到 65% 时点亮。连续打出不同流派会累积攻击加成（5 / 7 / 9），同流派连打会断链并清空本回合加成，最多 3 层。双派封顶 II 级，三派可到 III 级。混响与单流派共鸣互斥。' },
  { name: '狂笑', glyph: '笑', group: '机制', desc: '奶蛙蛙的专属机制。每打出 3 张牌：抽 1 张牌、获得 3 点格挡，并对敌人造成 3 点无视格挡的伤害。' },
  { name: '缄默', glyph: '缄', group: '机制', desc: '首领真形的规则。若某一派占你流派牌的 70% 以上，它会在二阶段学会该派：这一派的攻击伤害 -30%，共鸣降到 I 档。混搭不会触发。' },
  { name: '焚', glyph: '焚', group: '机制', desc: '焚名圣者真形的规则。每个你的回合，打出的第一张攻击牌会被炉火吞掉，直接移出本场战斗；杀得越慢，被吞掉的攻击牌越多。' },
  { name: '梦蚀', glyph: '蚀', group: '机制', desc: '战斗中后期的渐进压力。第 3 回合起，敌人每 2 个回合的每一招额外 +1 伤害（只加在第一段），最多 +6。' },
  { name: '潮汐', glyph: '潮', group: '机制', desc: '潮钟守夜人的规则。涨潮时它每一击的伤害 +35%，回合末叠护甲与力量；退潮时伤害 -20%，你获得 1 点额外能量。' },
  { name: '遗物', glyph: '器', group: '构筑', desc: '自动装备的永久道具，在每场战斗开始时苏醒，不需要打出。' },
  { name: '引爆', glyph: '爆', group: '机制', desc: '清除敌人身上全部对应状态，并按层数一次性结算伤害。' },
  { name: '拾回', glyph: '拾', group: '机制', desc: '从弃牌堆随机取回卡牌加入手牌，最多让手牌达到 20 张。' },
  { name: '忘名', glyph: '忘', group: '构筑', desc: '商店服务：花金币从本次牌组中永久移除一张牌。牌组越薄，核心牌越容易抽到。' },
  { name: '碎片', glyph: '碎', group: '构筑', desc: '没走完的梦留下的灰。失败时按战斗回合数获得；可在「梦的碎片」里花 40 / 60 / 80 永久解锁三张稀有牌，也可在地图的梦呓祭坛花 12 / 20 片签下契约。契约只在这一趟梦里生效。' },
  { name: '梦呓契约', glyph: '契', group: '构筑', desc: '在地图的梦呓祭坛用碎片签下的规则型遗物。每份契约都有收益与代价，最多同时生效两份，只属于当前这趟梦；撕毁会立刻移除规则，但不退还碎片。' },
  { name: '梦境层级', glyph: '层', group: '构筑', desc: '出发前选择的难度阶梯，完成一座岛解锁下一层，最高 10 层「心渊」。前五层压高敌人生命、攻击、金币与治疗；第 6 层起逐层加入规则压力：荆棘反伤、少抽牌、行囊失效、能量 -1。每层首通都会留下一张任务卡。' },
  { name: '梦魇谱系', glyph: '谱', group: '机制', desc: '同族敌人共享的规则，会显示在敌人头顶。腐殖吞毒自愈、列阵格挡生棘、借名封印手牌、反祷回敬减益、棘冠随攻击长棘、镜影第三击回击。看清谱系再决定出牌顺序。' },
  { name: '梦魇暴走', glyph: '暴', group: '机制', desc: '部分首领生命降到一半时触发的规则升级。触发前没有任何预告；触发后会用演出展示新的规则，并继续正常显示意图。' },
  { name: '绝境反扑', glyph: '绝', group: '机制', desc: '生命首次降到上限 25% 以下时，梦会在你的回合开始问你借不借一口气。接受：获得 8 点格挡、抽 2 张牌、+2 能量；代价是胜利或撤退时生命上限 -5。每场战斗只问一次，拒绝没有任何代价。' },
  { name: '梦痕', glyph: '痕', group: '机制', desc: '向梦借气后留下的刻痕。每道梦痕让这趟远征的生命上限 -5，并会记录在角色状态与结算里。战败不会留下梦痕。' },
];

export const KEYWORD_MAP = Object.fromEntries(KEYWORDS.map((entry) => [entry.name, entry]));
export const KEYWORD_GROUPS = [...new Set(KEYWORDS.map((entry) => entry.group))];

const PATTERN_NAMES = [...KEYWORDS]
  .map((entry) => entry.name)
  .sort((left, right) => right.length - left.length);

function escapePattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KEYWORD_PATTERN = new RegExp(PATTERN_NAMES.map(escapePattern).join('|'), 'g');

export function keywordText(text) {
  const source = String(text ?? '');
  if (!source) return '';
  let output = '';
  let cursor = 0;
  KEYWORD_PATTERN.lastIndex = 0;
  let match = KEYWORD_PATTERN.exec(source);
  while (match) {
    output += esc(source.slice(cursor, match.index));
    const info = KEYWORD_MAP[match[0]];
    output += `<span class="keyword" title="${esc(`${info.name}：${info.desc}`)}">${esc(match[0])}</span>`;
    cursor = match.index + match[0].length;
    match = KEYWORD_PATTERN.exec(source);
  }
  output += esc(source.slice(cursor));
  return output;
}

export function keywordGlossaryMarkup() {
  return KEYWORD_GROUPS.map((group) => {
    const entries = KEYWORDS.filter((entry) => entry.group === group);
    return `<section class="keyword-group">
      <div class="keyword-group__head"><span>${esc(group)}</span><i></i><small>${entries.length}</small></div>
      <div class="keyword-grid">
        ${entries.map((entry) => `<article class="keyword-entry">
          <span class="keyword-entry__glyph">${esc(entry.glyph)}</span>
          <div class="keyword-entry__copy"><strong>${esc(entry.name)}</strong><p>${esc(entry.desc)}</p></div>
        </article>`).join('')}
      </div>
    </section>`;
  }).join('');
}
