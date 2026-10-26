export const STATUS_INFO = {
  strength: { name: '力量', glyph: '力', color: '#d8a65b', desc: '每层使攻击伤害 +1。' },
  dexterity: { name: '敏捷', glyph: '敏', color: '#7fb7a6', desc: '每层使获得的格挡 +1。' },
  vulnerable: { name: '易伤', glyph: '易', color: '#c6665d', desc: '受到的攻击伤害增加 50%。' },
  weak: { name: '虚弱', glyph: '弱', color: '#8d88a8', desc: '造成的攻击伤害减少 25%。' },
  poison: { name: '中毒', glyph: '毒', color: '#7ba85c', desc: '回合开始时失去等同层数的生命，随后层数 -1。' },
  burn: { name: '灼烧', glyph: '燃', color: '#d28052', desc: '回合结束时受到等同层数的伤害，随后层数减半。' },
  thorns: { name: '荆棘', glyph: '棘', color: '#b29372', desc: '受到攻击时，对攻击者造成等同层数的伤害。' },
  regen: { name: '回春', glyph: '芽', color: '#8fb37a', desc: '回合开始时回复等同层数的生命，随后层数 -1。' },
  barrier: { name: '留壁', glyph: '壁', color: '#7fa9b8', desc: '下 N 个回合开始时，格挡不会清空。' },
};

export const ATTRIBUTES = {
  insight: { name: '洞察', glyph: '识', color: '#8fb8c4', desc: '看穿谎言与言外之意。提升「讲道理」的成功率。' },
  empathy: { name: '共情', glyph: '心', color: '#c98b9b', desc: '听见别人没有说出口的部分。提升「诉诸情感」的成功率。' },
  presence: { name: '威仪', glyph: '威', color: '#d0a65c', desc: '让刀锋替你说话。提升「亮出刀锋」的成功率。' },
  guile: { name: '机敏', glyph: '巧', color: '#93a86f', desc: '手比眼睛更快。提升「许以金币」与偷窃的成功率。' },
};

export const ATTRIBUTE_IDS = Object.keys(ATTRIBUTES);

export const PERSONALITIES = {
  proud: { name: '傲慢', desc: '只肯向强者低头，耐心比纸还薄。', modifier: -6, weak: 'threat', resist: 'empathy' },
  greedy: { name: '贪婪', desc: '比起道理，更听得见金币碰撞的声音。', modifier: 2, weak: 'bribe', resist: 'reason' },
  wrathful: { name: '暴烈', desc: '怒火总比理智先一步开口。', modifier: -4, weak: 'empathy', resist: 'threat' },
  cunning: { name: '狡诈', desc: '你说的每一句，他都会在心里翻过来再看一遍。', modifier: -10, weak: 'reason', resist: 'bribe' },
  stoic: { name: '沉静', desc: '像一口不会起浪的井。', modifier: -8, weak: 'reason', resist: 'threat' },
  devout: { name: '虔信', desc: '只相信已经烧进火里的东西。', modifier: -6, weak: 'empathy', resist: 'reason' },
  sorrowful: { name: '悲恻', desc: '所有劝告都会沉进她的雾里。', modifier: -2, weak: 'empathy', resist: 'bribe' },
  loyal: { name: '忠执', desc: '命令比道理更早刻进骨头。', modifier: 0, weak: 'reason', resist: 'bribe' },
};

export const PARLEY_APPROACHES = [
  { id: 'reason', name: '讲道理', glyph: '理', base: 46, desc: '把利害摊开，试着让对方先放下刀。' },
  { id: 'empathy', name: '诉诸情感', glyph: '心', base: 44, desc: '找出对方还愿意听人说话的那一部分。' },
  { id: 'threat', name: '亮出刀锋', glyph: '锋', base: 40, desc: '不谈道理，只谈谁先倒下。' },
  { id: 'bribe', name: '许以金币', glyph: '金', base: 56, cost: 20, desc: '先递出一枚金币，再谈条件。' },
];

export const SCHOOLS = {
  blade: { name: '剑势', color: '#c06653', desc: '力量与连续斩击。越战越勇，用最直接的方式结束梦。' },
  star: { name: '星辉', color: '#7f9bd0', desc: '格挡、敏捷与抽牌。用节奏把每一次攻击都化在鞘外。' },
  shadow: { name: '蚀影', color: '#8d9b70', desc: '毒与削弱。不急着杀，让敌人在时间里慢慢腐烂。' },
  ember: { name: '烬火', color: '#d08a5a', desc: '灼烧与自损。把生命当柴薪，逼敌人在黎明前烧尽。' },
  thorn: { name: '荆棘', color: '#a88968', desc: '格挡与反伤。让每一次落下的刀，都先割伤持刀的人。' },
  dream: { name: '遗梦', color: '#b48bc9', desc: '抽牌、能量与意外。没有固定形状，只有下一张牌。' },
};

export const SCHOOL_MAP = SCHOOLS;

export const RARITY_INFO = {
  basic: { name: '初始', color: '#938b82' },
  common: { name: '普通', color: '#b7b0a3' },
  uncommon: { name: '罕见', color: '#72b8b3' },
  rare: { name: '稀有', color: '#d8b56c' },
  // 梦蚀牌：战斗中被塞进手里、打不出去的废牌。战斗结束后消失。
  status: { name: '梦蚀', color: '#8a7f96' },
  custom: { name: '造物', color: '#c08de0' },
};

export const TYPE_INFO = {
  attack: { name: '攻击', color: '#b75f4f' },
  skill: { name: '技能', color: '#5c9b9d' },
};

export const CARD_GLYPHS = ['斩', '守', '灵', '影', '毒', '焰', '心', '星', '风', '血', '梦', '镜', '雷', '月', '锁', '生'];
export const CARD_PALETTES = [
  { id: 'ember', name: '残焰', color: '#b75f4f' },
  { id: 'tide', name: '雾潮', color: '#5c9b9d' },
  { id: 'violet', name: '幻紫', color: '#9b78c7' },
  { id: 'moss', name: '苔绿', color: '#7b9a62' },
  { id: 'gold', name: '旧金', color: '#c29d62' },
  { id: 'rose', name: '灰玫', color: '#a86d80' },
];

export const CARDS = [
  {
    id: 'strike', name: '斩击', cost: 1, type: 'attack', rarity: 'basic', glyph: '斩',
    flavor: '最朴素的锋刃，也最诚实。', effects: [{ type: 'damage', amount: 6 }],
  },
  {
    id: 'defend', name: '护势', cost: 1, type: 'skill', rarity: 'basic', glyph: '守',
    flavor: '尚未落下的一击，也尚未伤到你。', effects: [{ type: 'block', amount: 11 }],
  },
  {
    id: 'bellyLaugh', name: '捧腹', cost: 1, type: 'skill', rarity: 'basic', glyph: '腹', originOnly: 'milkfrog',
    flavor: '笑到扶墙，墙也跟着抖了一下。',
    effects: [{ type: 'block', amount: 10 }, { type: 'heal', amount: 2 }],
  },
  {
    id: 'hoohoo', name: '齁', cost: 1, type: 'attack', rarity: 'basic', glyph: '齁', originOnly: 'milkfrog',
    flavor: '一声「齁」，敌人的刀慢了半拍。',
    effects: [{ type: 'damage', amount: 8 }],
  },
  // 奶蛙蛙原本只有两张专属牌，和其他角色（各 9 张）差得太远，
  // 导致它的「厚血 + 狂抽 + 狂笑」这套机制起手根本没牌可撑，实测纯流派胜率只有 15%。
  // 下面三张是补它的构筑核心：把「抽得多」直接换成伤害与格挡，而不只是靠狂笑。
  {
    id: 'stuffedCheeks', name: '塞满嘴', cost: 0, type: 'skill', rarity: 'common', glyph: '塞', originOnly: 'milkfrog', school: 'dream',
    flavor: '嘴里塞满了，说不出话，但手上多了两张牌。',
    effects: [{ type: 'draw', amount: 2 }, { type: 'block', amount: 4 }],
  },
  {
    id: 'croakLaugh', name: '咕呱大笑', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '呱', originOnly: 'milkfrog', school: 'dream',
    flavor: '整个岛都听见了。敌人也听见了，于是手抖了一下。',
    effects: [{ type: 'damage', amount: 5 }, { type: 'status', status: 'weaken', amount: 2, target: 'enemy' }],
  },
  {
    id: 'bellyFlop', name: '肚皮压顶', cost: 2, type: 'attack', rarity: 'rare', glyph: '压', originOnly: 'milkfrog', school: 'dream',
    flavor: '八十多公斤的善意，从天而降。',
    effects: [{ type: 'damage', amount: 10, hits: 2 }, { type: 'block', amount: 8 }],
  },
  {
    id: 'sunder', name: '裂空斩', cost: 2, type: 'attack', rarity: 'uncommon', glyph: '空',
    flavor: '剑光裂开的不是空气，而是敌人的从容。',
    effects: [{ type: 'damage', amount: 12 }, { type: 'status', status: 'vulnerable', amount: 1, target: 'enemy' }],
  },
  {
    id: 'spark', name: '灵火', cost: 0, type: 'attack', rarity: 'common', glyph: '灵', originOnly: 'arcanist',
    flavor: '指尖的一点星，足以点燃黑夜。', effects: [{ type: 'damage', amount: 3 }],
  },
  {
    id: 'ward', name: '星障', cost: 1, type: 'skill', rarity: 'common', glyph: '障', originOnly: 'arcanist',
    flavor: '星光排列成一面看不见的墙。', effects: [{ type: 'block', amount: 11 }],
  },
  {
    id: 'echo', name: '奥术回响', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '响', originOnly: 'arcanist',
    flavor: '咒语念完以后，回声才开始施法。',
    effects: [{ type: 'damage', amount: 7 }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'nova', name: '坠星', cost: 2, type: 'attack', rarity: 'rare', glyph: '陨',
    flavor: '天空只眨了一次眼，夜色便塌了下来。',
    effects: [{ type: 'damage', amount: 14 }, { type: 'status', status: 'weak', amount: 1, target: 'enemy' }],
  },
  {
    id: 'dodge', name: '游身步', cost: 1, type: 'skill', rarity: 'common', glyph: '游', originOnly: 'wraith',
    flavor: '像一阵不合时宜的风。', effects: [{ type: 'block', amount: 8 }],
  },
  {
    id: 'envenom', name: '淬毒', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '毒', originOnly: 'wraith',
    flavor: '最安静的刀，往往最致命。',
    effects: [{ type: 'damage', amount: 3 }, { type: 'status', status: 'poison', amount: 4, target: 'enemy' }],
  },
  {
    id: 'flurry', name: '乱花', cost: 1, type: 'attack', rarity: 'common', glyph: '乱',
    flavor: '三个方向，一道收刀声。', effects: [{ type: 'damage', amount: 3, hits: 3 }],
  },
  {
    id: 'twinFang', name: '双牙', cost: 1, type: 'attack', rarity: 'common', glyph: '双',
    flavor: '第一刀试探，第二刀回答。', effects: [{ type: 'damage', amount: 5, hits: 2 }],
  },
  {
    id: 'ironWall', name: '铁壁', cost: 2, type: 'skill', rarity: 'common', glyph: '壁',
    flavor: '后退一步，换来所有人的明天。', effects: [{ type: 'block', amount: 21 }],
  },
  {
    id: 'warCry', name: '战吼', cost: 1, type: 'skill', rarity: 'common', glyph: '吼',
    flavor: '梦里的恐惧，也会被声音吓退。',
    effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }], exhaust: true,
  },
  {
    id: 'quicksilver', name: '流云步', cost: 1, type: 'skill', rarity: 'common', glyph: '流',
    flavor: '不与你争路，只比你更早到。',
    effects: [{ type: 'block', amount: 6 }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'poisonDagger', name: '蚀骨刃', cost: 1, type: 'attack', rarity: 'common', glyph: '蚀', originOnly: 'wraith',
    flavor: '伤口很小，夜色很长。',
    effects: [{ type: 'damage', amount: 4 }, { type: 'status', status: 'poison', amount: 3, target: 'enemy' }],
  },
  {
    id: 'weaken', name: '缚心', cost: 1, type: 'skill', rarity: 'common', glyph: '缚',
    flavor: '让它的勇气先于身体倒下。',
    effects: [{ type: 'status', status: 'weak', amount: 2, target: 'enemy' }],
  },
  {
    id: 'fracture', name: '裂甲', cost: 1, type: 'attack', rarity: 'common', glyph: '裂',
    flavor: '盔甲之下，也不过是另一层恐惧。',
    effects: [{ type: 'damage', amount: 3 }, { type: 'status', status: 'vulnerable', amount: 2, target: 'enemy' }],
  },
  {
    id: 'drain', name: '汲魂', cost: 2, type: 'attack', rarity: 'uncommon', glyph: '汲',
    flavor: '它失去的，刚好够你继续走下去。',
    effects: [{ type: 'damage', amount: 8 }, { type: 'heal', amount: 4 }],
  },
  {
    id: 'overload', name: '过载', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '载',
    flavor: '知识涌进来时，总是带着疼痛。',
    effects: [{ type: 'draw', amount: 3 }, { type: 'loseHp', amount: 4 }],
  },
  {
    id: 'earthguard', name: '地脉', cost: 2, type: 'skill', rarity: 'uncommon', glyph: '脉',
    flavor: '你听见脚下很深的地方，有什么在呼吸。',
    effects: [{ type: 'block', amount: 16 }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'ember', name: '灼痕', cost: 1, type: 'attack', rarity: 'common', glyph: '灼', originOnly: 'pyre',
    flavor: '余烬烫过的地方，总会裂开。',
    effects: [{ type: 'damage', amount: 6 }, { type: 'status', status: 'vulnerable', amount: 1, target: 'enemy' }],
  },
  {
    id: 'heartWall', name: '心壁', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '心',
    flavor: '把心跳砌进墙里，就不会轻易碎裂。',
    effects: [{ type: 'block', amount: 5 }, { type: 'status', status: 'dexterity', amount: 1, target: 'self' }],
  },
  {
    id: 'bloodPact', name: '血契', cost: 0, type: 'skill', rarity: 'rare', glyph: '契',
    flavor: '墨水是红的，签名也是。',
    effects: [{ type: 'loseHp', amount: 4 }, { type: 'energy', amount: 4 }], exhaust: true,
  },
  {
    id: 'heavyBlow', name: '断岳', cost: 2, type: 'attack', rarity: 'common', glyph: '岳', originOnly: 'blade',
    flavor: '山没有倒下，只是它以为自己还站着。',
    effects: [{ type: 'damage', amount: 18 }],
  },
  {
    id: 'venomMist', name: '蚀雾', cost: 1, type: 'skill', rarity: 'rare', glyph: '雾',
    flavor: '雾散去以后，梦里只剩一副骨。',
    effects: [{ type: 'status', status: 'poison', amount: 10, target: 'enemy' }],
    upgradeEffects: [{ type: 'status', status: 'poison', amount: 13, target: 'enemy' }], exhaust: true,
  },
  {
    id: 'sharpen', name: '磨刃', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '磨', originOnly: 'blade',
    flavor: '磨刀的声音，比刀更让人睡不着。',
    effects: [{ type: 'status', status: 'strength', amount: 1, target: 'self' }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'gildedEdge', name: '鎏金刃', cost: 2, type: 'attack', rarity: 'rare', glyph: '金',
    flavor: '梦里的金子不能花，但可以买命。',
    effects: [{ type: 'damage', amount: 14 }, { type: 'gold', amount: 20 }],
  },
  {
    id: 'mend', name: '回春', cost: 1, type: 'skill', rarity: 'common', glyph: '春',
    flavor: '伤口里长出一枝不合时令的花。',
    effects: [{ type: 'heal', amount: 6 }], exhaust: true,
  },
  {
    id: 'benediction', name: '遗辉', cost: 2, type: 'skill', rarity: 'uncommon', glyph: '辉',
    flavor: '旧日的祝福，仍在骨缝间发亮。',
    effects: [{ type: 'heal', amount: 8 }, { type: 'block', amount: 8 }], exhaust: true,
  },
  {
    id: 'surge', name: '灵涌', cost: 0, type: 'skill', rarity: 'common', glyph: '涌',
    flavor: '灵感来得突然，像借来的火。',
    effects: [{ type: 'energy', amount: 1 }], exhaust: true,
  },
  {
    id: 'perfectGuard', name: '无隙', cost: 2, type: 'skill', rarity: 'uncommon', glyph: '隙',
    flavor: '不动，便没有破绽。',
    effects: [{ type: 'block', amount: 19 }, { type: 'status', status: 'dexterity', amount: 1, target: 'self' }],
  },
  {
    id: 'mirrorEdge', name: '镜返', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '镜',
    flavor: '镜中的你，用的是同一把刀。',
    effects: [{ type: 'damage', amount: 4 }, { type: 'block', amount: 5 }, { type: 'status', status: 'thorns', amount: 2, target: 'self' }],
  },
  {
    id: 'finalGambit', name: '孤注', cost: 0, type: 'attack', rarity: 'uncommon', glyph: '孤',
    flavor: '只剩最后一口气时，呼吸也像刀。',
    effects: [
      { type: 'damage', amount: 12 },
      { type: 'status', status: 'vulnerable', amount: 1, target: 'self' },
    ], exhaust: true,
  },
  {
    id: 'soulRend', name: '裂魂', cost: 2, type: 'attack', rarity: 'rare', glyph: '魂',
    flavor: '名字被划去的声音，很轻。',
    effects: [{ type: 'damage', amount: 24 }, { type: 'status', status: 'vulnerable', amount: 2, target: 'enemy' }],
  },
  {
    id: 'cinderLash', name: '烬鞭', cost: 1, type: 'attack', rarity: 'common', glyph: '烬', school: 'ember', originOnly: 'pyre',
    flavor: '火从鞭梢烧进梦里。',
    effects: [{ type: 'damage', amount: 5 }, { type: 'status', status: 'burn', amount: 4, target: 'enemy' }],
  },
  {
    id: 'kindling', name: '引薪', cost: 0, type: 'skill', rarity: 'common', glyph: '薪', school: 'ember',
    flavor: '先有火，才有路。',
    effects: [{ type: 'status', status: 'burn', amount: 3, target: 'enemy' }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'wildfire', name: '燎原', cost: 2, type: 'skill', rarity: 'uncommon', glyph: '燎', school: 'ember',
    flavor: '一整片梦原在无声地卷曲。',
    effects: [{ type: 'status', status: 'burn', amount: 9, target: 'enemy' }], exhaust: true,
  },
  {
    id: 'pyreBloom', name: '焚花', cost: 3, type: 'attack', rarity: 'rare', glyph: '焚', school: 'ember',
    flavor: '花开的一瞬，梦已经烧完。',
    effects: [{ type: 'damage', amount: 7, hits: 2 }, { type: 'status', status: 'burn', amount: 4, target: 'enemy' }],
  },
  {
    id: 'martyr', name: '殉火', cost: 0, type: 'attack', rarity: 'uncommon', glyph: '殉', school: 'ember',
    flavor: '把痛还给点火的夜晚。',
    effects: [{ type: 'loseHp', amount: 4 }, { type: 'damage', amount: 10 }, { type: 'status', status: 'burn', amount: 3, target: 'enemy' }],
    exhaust: true,
  },
  {
    id: 'emberHeart', name: '余烬之心', cost: 1, type: 'skill', rarity: 'common', glyph: '心', school: 'thorn', originOnly: 'pyre',
    flavor: '灰烬里还留着一颗没冷透的心。',
    effects: [{ type: 'block', amount: 6 }, { type: 'status', status: 'thorns', amount: 2, target: 'self' }],
  },
  {
    id: 'thornMail', name: '荆棘甲', cost: 2, type: 'skill', rarity: 'uncommon', glyph: '棘', school: 'thorn',
    flavor: '每一根刺，都是别人留下的教训。',
    effects: [{ type: 'block', amount: 13 }, { type: 'status', status: 'thorns', amount: 4, target: 'self' }],
  },
  {
    id: 'brambleLash', name: '荆藤', cost: 1, type: 'attack', rarity: 'common', glyph: '藤', school: 'thorn',
    flavor: '抽在它身上的，会长回你手里。',
    effects: [{ type: 'damage', amount: 7 }, { type: 'status', status: 'thorns', amount: 2, target: 'self' }],
  },
  {
    id: 'briarCrown', name: '棘冠', cost: 2, type: 'skill', rarity: 'rare', glyph: '冠', school: 'thorn',
    flavor: '加冕不需要王座，只需要很多刺。',
    effects: [{ type: 'status', status: 'thorns', amount: 5, target: 'self' }, { type: 'block', amount: 11 }],
  },
  {
    id: 'lastStand', name: '背水', cost: 1, type: 'attack', rarity: 'common', glyph: '背', school: 'blade', originOnly: 'blade',
    flavor: '身后没有路了，刀就有了方向。',
    effects: [{ type: 'damage', amount: 5 }, { type: 'block', amount: 6 }],
  },
  {
    id: 'starfall', name: '星屑', cost: 0, type: 'attack', rarity: 'uncommon', glyph: '屑', school: 'star',
    flavor: '星星碎掉以后，落下来的都是机会。',
    effects: [{ type: 'damage', amount: 2, hits: 2 }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'lampWard', name: '灯守之诺', cost: 1, type: 'skill', rarity: 'rare', glyph: '诺', school: 'ember',
    questOnly: true, flavor: '灯火不认得路，但记得答应过谁。',
    effects: [{ type: 'block', amount: 11 }, { type: 'status', status: 'burn', amount: 2, target: 'enemy' }],
  },
  {
    id: 'keeperFlame', name: '不熄之灯', cost: 2, type: 'skill', rarity: 'rare', glyph: '灯', school: 'ember',
    questOnly: true, flavor: '灯芯很短，夜却很长。',
    effects: [{ type: 'heal', amount: 5 }, { type: 'status', status: 'strength', amount: 2, target: 'self' }], exhaust: true,
  },
  {
    id: 'ferryFare', name: '渡梦钱', cost: 0, type: 'skill', rarity: 'rare', glyph: '渡', school: 'dream',
    questOnly: true, flavor: '上岸以后，它会在你口袋里继续发烫。',
    effects: [{ type: 'gold', amount: 20 }, { type: 'draw', amount: 1 }], exhaust: true,
  },
  {
    id: 'mistChart', name: '雾海航图', cost: 1, type: 'skill', rarity: 'rare', glyph: '航', school: 'star',
    questOnly: true, flavor: '图上没有岛，只有雾往哪里退。',
    effects: [{ type: 'block', amount: 16 }, { type: 'draw', amount: 2 }], exhaust: true,
  },
  {
    id: 'tornPage', name: '无名残页', cost: 1, type: 'attack', rarity: 'rare', glyph: '页', school: 'shadow',
    questOnly: true, flavor: '被撕掉的那半页，写的是你的名字。',
    effects: [{ type: 'damage', amount: 6 }, { type: 'status', status: 'poison', amount: 3, target: 'enemy' }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'inkEcho', name: '墨之回响', cost: 1, type: 'skill', rarity: 'rare', glyph: '墨', school: 'dream',
    questOnly: true, flavor: '故事结束后，还有人在页边轻轻咳嗽。',
    effects: [{ type: 'draw', amount: 2 }, { type: 'heal', amount: 4 }], exhaust: true,
  },
  {
    id: 'lastFlame', name: '最后一簇火', cost: 1, type: 'skill', rarity: 'rare', glyph: '簇', school: 'ember',
    questOnly: true, flavor: '守灯人把火种分了半粒给你，说：这次别让它灭。',
    effects: [{ type: 'block', amount: 13 }, { type: 'status', status: 'burn', amount: 4, target: 'enemy' }],
  },
  {
    id: 'dawnEmber', name: '黎明余烬', cost: 2, type: 'attack', rarity: 'rare', glyph: '黎', school: 'ember',
    questOnly: true, flavor: '天亮之前，最后一点火是最贵的。',
    effects: [{ type: 'damage', amount: 16 }, { type: 'heal', amount: 6 }],
  },
  {
    id: 'deepChart', name: '深潮航图', cost: 0, type: 'skill', rarity: 'rare', glyph: '深', school: 'dream',
    questOnly: true, flavor: '舟在图的背面写：别去没有岸的地方。',
    effects: [{ type: 'draw', amount: 2 }, { type: 'energy', amount: 1 }], exhaust: true,
  },
  {
    id: 'slowOar', name: '慢桨', cost: 1, type: 'skill', rarity: 'rare', glyph: '桨', school: 'star',
    questOnly: true, flavor: '划得慢一点，才看得清水底下那些没有说完的话。',
    effects: [{ type: 'block', amount: 12 }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'ashPage', name: '灰烬残页', cost: 1, type: 'attack', rarity: 'rare', glyph: '灰', school: 'shadow',
    questOnly: true, flavor: '烧焦的页脚上，有半个名字没有被火舔干净。',
    effects: [{ type: 'damage', amount: 8 }, { type: 'status', status: 'poison', amount: 4, target: 'enemy' }, { type: 'status', status: 'burn', amount: 2, target: 'enemy' }],
  },
  {
    id: 'namedPage', name: '有名之页', cost: 2, type: 'attack', rarity: 'rare', glyph: '名', school: 'blade',
    questOnly: true, flavor: '这一次，墨没有省略任何一个人的名字。',
    effects: [{ type: 'damage', amount: 10 }, { type: 'status', status: 'strength', amount: 2, target: 'self' }],
  },
  {
    id: 'moonScript', name: '月下终稿', cost: 1, type: 'skill', rarity: 'rare', glyph: '稿', school: 'dream',
    questOnly: true, flavor: '纸月落下来的时候，所有被剪掉的句子一起亮了。',
    effects: [{ type: 'draw', amount: 2 }, { type: 'block', amount: 11 }],
  },
  {
    id: 'tideSigil', name: '魇潮纹章', cost: 1, type: 'skill', rarity: 'rare', glyph: '潮', school: 'dream',
    questOnly: true, flavor: '潮水退去以后，礁石上留下的是你昨夜没喊出口的名字。',
    effects: [{ type: 'block', amount: 11 }, { type: 'status', status: 'strength', amount: 1, target: 'self' }],
  },
  {
    id: 'voidLamp', name: '无光之灯', cost: 1, type: 'skill', rarity: 'rare', glyph: '无', school: 'star',
    questOnly: true, flavor: '灯里没有火，却比任何一场火都亮。',
    effects: [{ type: 'draw', amount: 3 }], exhaust: true,
  },
  {
    id: 'heartSigil', name: '心魇之核', cost: 2, type: 'attack', rarity: 'rare', glyph: '核', school: 'blade',
    questOnly: true, flavor: '最深的夜里，你握住了自己心跳的形状。',
    effects: [{ type: 'damage', amount: 13 }, { type: 'heal', amount: 4 }, { type: 'status', status: 'strength', amount: 1, target: 'self' }],
  },
  {
    id: 'thornDiadem', name: '棘梦之冠', cost: 1, type: 'skill', rarity: 'rare', glyph: '棘', school: 'thorn',
    questOnly: true, flavor: '梦把王冠戴反了，尖刺朝内。',
    effects: [{ type: 'block', amount: 8 }, { type: 'status', status: 'thorns', amount: 4, target: 'self' }],
  },
  {
    id: 'drownedAnchor', name: '溺梦之锚', cost: 1, type: 'skill', rarity: 'rare', glyph: '锚', school: 'dream',
    questOnly: true, flavor: '沉到最深处时，锚链把你钉在了自己身上。',
    effects: [{ type: 'loseHp', amount: 2 }, { type: 'block', amount: 11 }, { type: 'draw', amount: 2 }],
  },
  {
    id: 'hushBox', name: '无声之匣', cost: 0, type: 'skill', rarity: 'rare', glyph: '匣', school: 'dream',
    questOnly: true, flavor: '盒子合上时，连你的呼吸都成了别人的东西。',
    effects: [{ type: 'loseHp', amount: 3 }, { type: 'energy', amount: 2 }, { type: 'draw', amount: 1 }], exhaust: true,
  },
  {
    id: 'backlightEdge', name: '逆光之刃', cost: 2, type: 'attack', rarity: 'rare', glyph: '逆', school: 'blade',
    questOnly: true, flavor: '你迎着光挥刀，影子先一步杀死了它。',
    effects: [{ type: 'damage', amount: 18 }, { type: 'status', status: 'strength', amount: 1, target: 'self' }],
  },
  {
    id: 'abyssSeed', name: '心渊之种', cost: 2, type: 'skill', rarity: 'rare', glyph: '渊', school: 'dream',
    questOnly: true, flavor: '把最深的夜种进胸口，醒来时它已经开花。',
    effects: [{ type: 'heal', amount: 8 }, { type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'status', status: 'dexterity', amount: 2, target: 'self' }], exhaust: true,
  },
  {
    id: 'sevenCompass', name: '七海罗盘', cost: 1, type: 'skill', rarity: 'rare', glyph: '罗', school: 'star',
    questOnly: true, flavor: '指针不指北，只指你还没踏平的那座岛。',
    effects: [{ type: 'block', amount: 8 }, { type: 'draw', amount: 2 }], exhaust: true,
  },
  {
    id: 'farewellKey', name: '告别之钥', cost: 0, type: 'skill', rarity: 'rare', glyph: '钥', school: 'dream',
    questOnly: true, flavor: '每一扇告别的门后面，都还留着一盏没熄的灯。',
    effects: [{ type: 'heal', amount: 6 }, { type: 'draw', amount: 1 }], exhaust: true,
  },
  {
    id: 'mistVeil', name: '薄雾纱衣', cost: 1, type: 'skill', rarity: 'rare', glyph: '纱', school: 'star',
    questOnly: true, flavor: '雾披在身上，梦魇便多看你一眼，也多迟疑一瞬。',
    effects: [{ type: 'block', amount: 6 }, { type: 'status', status: 'dexterity', amount: 1, target: 'self' }],
  },
  {
    id: 'deepSlumber', name: '深眠之息', cost: 1, type: 'skill', rarity: 'rare', glyph: '眠', school: 'dream',
    questOnly: true, flavor: '睡得越深，越听得见自己翻页的声音。',
    effects: [{ type: 'block', amount: 6 }, { type: 'draw', amount: 1 }, { type: 'heal', amount: 3 }],
  },
  {
    id: 'islandCrown', name: '岛主之冠', cost: 2, type: 'attack', rarity: 'rare', glyph: '冠', school: 'blade',
    questOnly: true, flavor: '你把它从梦魇头上取下时，它还没有完全停止呼吸。',
    effects: [{ type: 'damage', amount: 12 }, { type: 'status', status: 'vulnerable', amount: 2, target: 'enemy' }],
  },
  {
    id: 'relicChorus', name: '共鸣之器', cost: 1, type: 'skill', rarity: 'rare', glyph: '鸣', school: 'star',
    questOnly: true, flavor: '五件器物同时震颤，你听见它们各自没说出口的那半个音。',
    effects: [{ type: 'block', amount: 10 }, { type: 'draw', amount: 2 }], exhaust: true,
  },
  {
    id: 'ashBurst', name: '灰爆', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '爆', school: 'ember',
    flavor: '火一直记得自己被点燃的那一秒。',
    effects: [{ type: 'detonate', status: 'burn', amount: 2 }],
  },
  {
    id: 'blight', name: '蚀变', cost: 1, type: 'skill', rarity: 'rare', glyph: '变', school: 'shadow',
    flavor: '伤口里的东西忽然学会了分裂。',
    effects: [{ type: 'catalyze', status: 'poison', amount: 0 }], exhaust: true,
  },
  {
    id: 'nightWatch', name: '守夜', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '夜', school: 'thorn',
    flavor: '今夜由墙来守，你只负责活下去。',
    effects: [{ type: 'block', amount: 10 }, { type: 'status', status: 'barrier', amount: 1, target: 'self' }],
  },
  {
    id: 'dreamDredge', name: '汲梦', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '汲', school: 'dream',
    flavor: '把整片梦海舀起来，总能捞出几张湿透的牌。',
    effects: [{ type: 'drawTo', amount: 6 }], exhaust: true,
  },
  {
    id: 'pierce', name: '穿心', cost: 2, type: 'attack', rarity: 'uncommon', glyph: '穿', school: 'blade',
    flavor: '甲胄是给害怕的人准备的。',
    effects: [{ type: 'directDamage', amount: 10 }],
  },
  {
    id: 'springTide', name: '春潮', cost: 1, type: 'skill', rarity: 'common', glyph: '潮', school: 'star',
    flavor: '潮水退去以后，伤口上长出了一点点绿。',
    effects: [{ type: 'status', status: 'regen', amount: 3, target: 'self' }], exhaust: true,
  },
  {
    id: 'brambleWall', name: '棘墙', cost: 2, type: 'attack', rarity: 'uncommon', glyph: '墙', school: 'thorn',
    flavor: '墙倒下的时候，每块砖都记得自己该砸向谁。',
    effects: [{ type: 'blockDamage', amount: 24 }],
  },
  {
    id: 'behead', name: '斩尽', cost: 2, type: 'attack', rarity: 'rare', glyph: '尽', school: 'blade',
    flavor: '剑不解释，剑只收尾。',
    effects: [{ type: 'execute', amount: 12, threshold: 0.35, multiplier: 3 }],
  },
  {
    id: 'reclaim', name: '拾遗', cost: 0, type: 'skill', rarity: 'common', glyph: '拾', school: 'dream',
    flavor: '梦从不真正丢掉什么，只是把它放远了一点。',
    effects: [{ type: 'recollect', amount: 1 }], exhaust: true,
  },
  {
    id: 'returnBlade', name: '回锋斩', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '回', school: 'blade',
    originOnly: 'blade', flavor: '剑锋回头的那一瞬，敌人还以为自己赢了。',
    effects: [{ type: 'damage', amount: 4, hits: 3 }],
  },
  {
    id: 'dawnForm', name: '破晓式', cost: 2, type: 'attack', rarity: 'rare', glyph: '晓', school: 'blade',
    originOnly: 'blade', flavor: '连斩数到三的时候，黎明会替你把剑递出去。',
    effects: [{ type: 'comboDamage', amount: 8, scale: 4 }],
  },
  {
    id: 'starWeave', name: '星织', cost: 0, type: 'skill', rarity: 'uncommon', glyph: '织', school: 'star',
    originOnly: 'arcanist', flavor: '一针一线，把熄灭的星缝回原位。',
    effects: [{ type: 'block', amount: 5 }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'grandOrrery', name: '大星仪', cost: 2, type: 'skill', rarity: 'rare', glyph: '仪', school: 'star',
    originOnly: 'arcanist', flavor: '整个夜空开始缓慢地转动，像一台不肯停的机器。',
    effects: [{ type: 'block', amount: 19 }, { type: 'draw', amount: 2 }],
  },
  {
    id: 'creepingVenom', name: '蔓蚀', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '蔓', school: 'shadow',
    originOnly: 'wraith', flavor: '毒会走路，而且走得比人稳。',
    effects: [{ type: 'status', status: 'poison', amount: 6, target: 'enemy' }],
  },
  {
    id: 'bloomRelease', name: '蚀放', cost: 2, type: 'skill', rarity: 'rare', glyph: '放', school: 'shadow',
    originOnly: 'wraith', flavor: '攒了这么久的影，该开花了。',
    effects: [{ type: 'toxicBurst', scale: 3 }],
  },
  {
    id: 'bloodAsh', name: '血烬', cost: 0, type: 'attack', rarity: 'uncommon', glyph: '血', school: 'ember',
    originOnly: 'pyre', flavor: '把血滴进火里，火会更听话。',
    effects: [{ type: 'loseHp', amount: 3 }, { type: 'damage', amount: 8 }, { type: 'status', status: 'burn', amount: 2, target: 'enemy' }],
  },
  {
    id: 'pyreOath', name: '焚誓', cost: 1, type: 'skill', rarity: 'rare', glyph: '誓', school: 'ember',
    originOnly: 'pyre', flavor: '誓言只有烧起来，才算是真的。',
    effects: [{ type: 'loseHp', amount: 4 }, { type: 'energy', amount: 2 }, { type: 'status', status: 'strength', amount: 2, target: 'self' }], exhaust: true,
  },
  {
    id: 'quickStrike', name: '疾斩', cost: 0, type: 'attack', rarity: 'common', glyph: '疾', school: 'blade',
    originOnly: 'blade', flavor: '快得让「连斩」来不及数到二。',
    effects: [{ type: 'damage', amount: 4 }],
  },
  {
    id: 'resolveStrike', name: '决意斩', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '决', school: 'blade',
    originOnly: 'blade', flavor: '每一斩都在替下一斩蓄力。',
    effects: [{ type: 'comboDamage', amount: 8, scale: 3 }],
  },
  {
    id: 'afterimage', name: '残影', cost: 2, type: 'attack', rarity: 'rare', glyph: '残', school: 'blade',
    originOnly: 'blade', flavor: '刀过去了，影子还停在原地补完剩下的两下。',
    effects: [{ type: 'damage', amount: 5, hits: 3 }],
  },
  {
    id: 'whetEdge', name: '砺心', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '砺', school: 'blade',
    originOnly: 'blade', flavor: '磨的不是刀，是不肯停的手。',
    effects: [{ type: 'status', status: 'strength', amount: 1, target: 'self' }, { type: 'block', amount: 6 }],
  },
  {
    id: 'glint', name: '微光', cost: 0, type: 'skill', rarity: 'common', glyph: '微', school: 'star',
    originOnly: 'arcanist', flavor: '一点光，够你多看一步。',
    effects: [{ type: 'block', amount: 4 }, { type: 'status', status: 'dexterity', amount: 1, target: 'self' }],
  },
  {
    id: 'starlitCodex', name: '星辉手记', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '记', school: 'star',
    originOnly: 'arcanist', flavor: '翻一页，天上就多亮一颗。',
    effects: [{ type: 'draw', amount: 2 }], exhaust: true,
  },
  {
    id: 'starshield', name: '星穹幕', cost: 2, type: 'skill', rarity: 'rare', glyph: '穹', school: 'star',
    originOnly: 'arcanist', flavor: '把整片夜空折起来，当作一面盾。',
    effects: [{ type: 'block', amount: 21 }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'constellation', name: '星座', cost: 1, type: 'skill', rarity: 'rare', glyph: '座', school: 'star',
    originOnly: 'arcanist', flavor: '连线完成的那一刻，你身上的星轨也跟着亮。',
    effects: [{ type: 'status', status: 'dexterity', amount: 2, target: 'self' }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'venomSpray', name: '毒雾', cost: 0, type: 'skill', rarity: 'common', glyph: '雾', school: 'shadow',
    originOnly: 'wraith', flavor: '呼吸之间，绿意已经爬上了它的甲。',
    effects: [{ type: 'status', status: 'poison', amount: 3, target: 'enemy' }],
  },
  {
    id: 'corrode', name: '腐蚀', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '腐', school: 'shadow',
    originOnly: 'wraith', flavor: '先蚀去勇气，再蚀去骨头。',
    effects: [{ type: 'status', status: 'poison', amount: 4, target: 'enemy' }, { type: 'status', status: 'weak', amount: 1, target: 'enemy' }],
  },
  {
    id: 'shadowFang', name: '影鸩', cost: 1, type: 'attack', rarity: 'common', glyph: '鸩', school: 'shadow',
    originOnly: 'wraith', flavor: '刀口上那点绿，比伤口活得久。',
    effects: [{ type: 'damage', amount: 6 }, { type: 'status', status: 'poison', amount: 2, target: 'enemy' }],
  },
  {
    id: 'fadeAway', name: '隐没', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '隐', school: 'shadow',
    originOnly: 'wraith', flavor: '退进雾里，它连该往哪儿挥刀都忘了。',
    effects: [{ type: 'block', amount: 11 }, { type: 'status', status: 'weak', amount: 1, target: 'enemy' }],
  },
  {
    id: 'scorch', name: '焦灼', cost: 0, type: 'skill', rarity: 'common', glyph: '焦', school: 'ember',
    originOnly: 'pyre', flavor: '最省柴的一撮火，留给最贵的甲。',
    effects: [{ type: 'status', status: 'burn', amount: 4, target: 'enemy' }],
  },
  {
    id: 'bloodPyre', name: '血焚', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '焚', school: 'ember',
    originOnly: 'pyre', flavor: '用自己的一点血，把火喂到它认主。',
    effects: [{ type: 'loseHp', amount: 4 }, { type: 'damage', amount: 12 }],
  },
  {
    id: 'cinderWard', name: '烬护', cost: 1, type: 'skill', rarity: 'common', glyph: '烬', school: 'ember',
    originOnly: 'pyre', flavor: '把一小块自己垫在甲后面，火会更稳。',
    effects: [{ type: 'block', amount: 10 }, { type: 'loseHp', amount: 2 }],
  },
  {
    id: 'infernoCrown', name: '焚冠', cost: 1, type: 'skill', rarity: 'rare', glyph: '冠', school: 'ember',
    originOnly: 'pyre', flavor: '烧到最后的人，头顶会自己长出冠冕。',
    effects: [{ type: 'status', status: 'burn', amount: 5, target: 'enemy' }, { type: 'status', status: 'strength', amount: 1, target: 'self' }], exhaust: true,
  },
  {
    id: 'manifoldEdge', name: '万流归一', cost: 2, type: 'attack', rarity: 'rare', shardLock: true, glyph: '归', school: 'blade',
    flavor: '一条河只有一个方向，一片海有所有方向。', scaling: { source: 'schools', scale: 2, cap: 10 },
    effects: [{ type: 'damage', amount: 6 }],
  },
  {
    id: 'dreamConfluence', name: '诸梦合流', cost: 2, type: 'skill', rarity: 'rare', shardLock: true, glyph: '汇', school: 'dream',
    flavor: '你把别人的梦折好，垫在自己胸前。', scaling: { source: 'schools', scale: 2, cap: 10 },
    effects: [{ type: 'block', amount: 8 }],
  },
  {
    id: 'motleyPraise', name: '杂色礼赞', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '杂', school: 'star',
    flavor: '没有一种颜色是多余的。', scaling: { source: 'schools', scale: 3, cap: 12 },
    effects: [{ type: 'damage', amount: 5 }],
  },
  {
    id: 'prismWard', name: '万象棱镜', cost: 2, type: 'skill', rarity: 'rare', glyph: '棱', school: 'thorn',
    flavor: '折一次，光就多一种。', scaling: { source: 'schools', scale: 3, cap: 12 },
    effects: [{ type: 'block', amount: 6 }],
  },
  {
    id: 'twoRivers', name: '并流之刃', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '并', school: 'blade',
    flavor: '两条河并到一起，水声会变成刀声。', scaling: { source: 'schools', scale: 1, cap: 6 },
    effects: [{ type: 'damage', amount: 4, hits: 2 }],
  },
  {
    id: 'ashLegacy', name: '灰烬馈赠', cost: 2, type: 'attack', rarity: 'rare', shardLock: true, glyph: '灰', school: 'ember',
    flavor: '烧掉的东西没有消失，它们在你手里。', scaling: { source: 'exhaust', scale: 2, cap: 16 },
    effects: [{ type: 'damage', amount: 7 }],
  },
  {
    id: 'burnedDraft', name: '焚稿之勇', cost: 2, type: 'skill', rarity: 'rare', glyph: '稿', school: 'ember',
    flavor: '写坏的那几页，最后挡住了刀。', scaling: { source: 'exhaust', scale: 2, cap: 16 },
    effects: [{ type: 'block', amount: 11 }],
  },
  {
    id: 'emberEcho', name: '余烬回响', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '响', school: 'dream',
    flavor: '被消耗的牌在堆底轻轻应答。', scaling: { source: 'exhaust', scale: 2, cap: 14 },
    effects: [{ type: 'damage', amount: 5 }],
  },
  {
    id: 'emptyBox', name: '空匣', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '匣', school: 'shadow',
    flavor: '匣子越空，回声越响。', scaling: { source: 'exhaust', scale: 3, cap: 18 },
    effects: [{ type: 'damage', amount: 6 }],
  },
  {
    id: 'allReturned', name: '尽数归还', cost: 2, type: 'skill', rarity: 'uncommon', glyph: '还', school: 'star',
    flavor: '把借来的都还回去，包括恐惧。', scaling: { source: 'exhaust', scale: 2, cap: 14 },
    effects: [{ type: 'block', amount: 10 }],
  },
  {
    id: 'fullHandSpark', name: '满手星火', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '满', school: 'star',
    flavor: '手里握着的每一张，都是一颗还没熄的星。', scaling: { source: 'hand', scale: 2, cap: 12 },
    effects: [{ type: 'damage', amount: 5 }],
  },
  {
    id: 'gripObsession', name: '执念之握', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '握', school: 'blade',
    flavor: '握着不放手的人，命也比较难被拿走。', scaling: { source: 'hand', scale: 2, cap: 12 },
    effects: [{ type: 'block', amount: 8 }],
  },
  {
    id: 'palmThunder', name: '掌心雷', cost: 2, type: 'attack', rarity: 'rare', glyph: '掌', school: 'ember',
    flavor: '牌越多，掌心里的雷越挤。', scaling: { source: 'hand', scale: 2, cap: 8 },
    effects: [{ type: 'damage', amount: 7 }],
  },
  {
    id: 'frostOnCards', name: '牌上霜', cost: 1, type: 'skill', rarity: 'uncommon', glyph: '霜', school: 'shadow',
    flavor: '你摸过的每一张牌，边角都结了霜。', scaling: { source: 'hand', scale: 2, cap: 12 },
    effects: [{ type: 'block', amount: 6 }],
  },
  {
    id: 'singleThread', name: '一线生机', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '线', school: 'dream',
    flavor: '手里的牌越少，这一线越细；越多，越像绳。', scaling: { source: 'hand', scale: 2, cap: 12 },
    effects: [{ type: 'damage', amount: 6 }],
  },
  {
    id: 'poisonProof', name: '百毒不侵', cost: 2, type: 'attack', rarity: 'rare', glyph: '毒', school: 'thorn',
    flavor: '身上每一种伤，最后都长成了甲。', scaling: { source: 'statuses', scale: 3, cap: 15 },
    effects: [{ type: 'damage', amount: 6 }],
  },
  {
    id: 'thousandWounds', name: '千疮之躯', cost: 2, type: 'attack', rarity: 'rare', glyph: '疮', school: 'shadow',
    flavor: '数一数伤口，就知道自己还活着几成。', scaling: { source: 'statuses', scale: 3, cap: 15 },
    effects: [{ type: 'damage', amount: 5 }],
  },
  {
    id: 'gloryMantle', name: '荣光加身', cost: 2, type: 'skill', rarity: 'rare', glyph: '荣', school: 'blade',
    flavor: '每一种加持都是一层披风。', scaling: { source: 'statuses', scale: 3, cap: 15 },
    effects: [{ type: 'block', amount: 10 }],
  },
  {
    id: 'chronicGift', name: '沉疴之赐', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '疴', school: 'dream',
    flavor: '久病的人，最懂怎么让疼变成力气。', scaling: { source: 'statuses', scale: 2, cap: 8 },
    effects: [{ type: 'damage', amount: 4 }],
  },
  {
    id: 'myriadShield', name: '万象之盾', cost: 2, type: 'skill', rarity: 'rare', glyph: '盾', school: 'thorn',
    flavor: '把所有状态叠起来，就是一面墙。', scaling: { source: 'statuses', scale: 4, cap: 16 },
    effects: [{ type: 'block', amount: 8 }],
  },

  // ── 攻守兼备牌（12 张）──────────────────────────────────────────────
  // 设计动机：122 张牌里原本只有 2 张同时产伤害和格挡，导致「攻击」永远比「防御」
  // 划算，玩家越会玩就越只拿攻击牌，防御构筑变成陷阱选项。
  // 这一组把「防」和「打」压进同一张牌，让防守回合也能推进战线。
  {
    id: 'crossGuard', name: '交刃', cost: 1, type: 'attack', rarity: 'common', glyph: '交', school: 'blade',
    flavor: '挡下这一刀，顺便还你一刀。',
    effects: [{ type: 'damage', amount: 5 }, { type: 'block', amount: 7 }],
  },
  {
    id: 'tideAegis', name: '潮盾', cost: 1, type: 'attack', rarity: 'common', glyph: '潮', school: 'star',
    flavor: '浪打上来的时候，它替你挨了一下。',
    effects: [{ type: 'block', amount: 9 }, { type: 'damage', amount: 4 }],
  },
  {
    id: 'thornRiposte', name: '棘刺回礼', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '棘', school: 'thorn',
    flavor: '你碰到它的时候，它也碰到了你。',
    effects: [{ type: 'block', amount: 6 }, { type: 'status', status: 'thorns', amount: 3, target: 'self' }, { type: 'damage', amount: 4 }],
  },
  {
    id: 'venomWard', name: '毒障', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '障', school: 'shadow',
    flavor: '雾里有毒，墙里也有。',
    effects: [{ type: 'block', amount: 7 }, { type: 'status', status: 'poison', amount: 3, target: 'enemy' }],
  },
  {
    id: 'emberBulwark', name: '余烬壁垒', cost: 2, type: 'attack', rarity: 'uncommon', glyph: '垒', school: 'ember',
    flavor: '烧过的东西，比没烧过的更硬。',
    effects: [{ type: 'block', amount: 14 }, { type: 'damage', amount: 7 }, { type: 'status', status: 'burn', amount: 2, target: 'enemy' }],
  },
  {
    id: 'mirrorParry', name: '镜像招架', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '架', school: 'thorn',
    flavor: '它砍的是镜子，疼的是它自己。',
    effects: [{ type: 'block', amount: 8 }, { type: 'damage', amount: 5 }],
  },
  {
    id: 'starBastion', name: '星垒', cost: 2, type: 'attack', rarity: 'rare', glyph: '垒', school: 'star',
    flavor: '整片夜空弯下来，替你挡了一次。',
    effects: [{ type: 'block', amount: 18 }, { type: 'damage', amount: 6 }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'dreamParry', name: '梦的回手', cost: 1, type: 'attack', rarity: 'uncommon', glyph: '回', school: 'dream',
    flavor: '梦里挨的打不会疼，但会还回去。',
    effects: [{ type: 'block', amount: 6 }, { type: 'damage', amount: 6 }],
  },
  {
    id: 'bloodWard', name: '血誓之盾', cost: 1, type: 'attack', rarity: 'rare', glyph: '誓', school: 'ember',
    flavor: '用一点血，换一整面墙。',
    effects: [{ type: 'loseHp', amount: 3 }, { type: 'block', amount: 16 }, { type: 'damage', amount: 6 }],
  },
  {
    id: 'shadowVeil', name: '影袭', cost: 2, type: 'attack', rarity: 'rare', glyph: '影', school: 'shadow',
    flavor: '你数不清它出了几次手。',
    effects: [{ type: 'block', amount: 10 }, { type: 'damage', amount: 5, hits: 2 }, { type: 'status', status: 'weak', amount: 1, target: 'enemy' }],
  },
  {
    id: 'ironTempo', name: '铁律', cost: 2, type: 'attack', rarity: 'rare', glyph: '律', school: 'blade',
    flavor: '一攻一守，节奏在自己手里。',
    effects: [{ type: 'damage', amount: 9 }, { type: 'block', amount: 12 }, { type: 'status', status: 'dexterity', amount: 1, target: 'self' }],
  },
  {
    id: 'lastBastion', name: '最后一道', cost: 2, type: 'attack', rarity: 'rare', glyph: '最', school: 'thorn',
    flavor: '墙后没有退路，所以墙不能倒。',
    effects: [{ type: 'block', amount: 20 }, { type: 'damage', amount: 8 }],
  },
];

const SCHOOL_BY_CARD = {
  strike: 'blade', sunder: 'blade', heavyBlow: 'blade', flurry: 'blade', twinFang: 'blade',
  warCry: 'blade', sharpen: 'blade', finalGambit: 'blade', soulRend: 'blade', gildedEdge: 'blade',
  defend: 'star', ward: 'star', spark: 'star', nova: 'star', echo: 'star', quicksilver: 'star',
  earthguard: 'star', benediction: 'star', mend: 'star', surge: 'dream', overload: 'dream',
  bloodPact: 'ember', heartWall: 'thorn', perfectGuard: 'thorn', ironWall: 'thorn', mirrorEdge: 'thorn',
  dodge: 'shadow', envenom: 'shadow', poisonDagger: 'shadow', weaken: 'shadow',
  fracture: 'shadow', drain: 'shadow', venomMist: 'shadow', ember: 'ember',
  ashBurst: 'ember', blight: 'shadow', nightWatch: 'thorn', dreamDredge: 'dream', pierce: 'blade', springTide: 'star',
  brambleWall: 'thorn', behead: 'blade', reclaim: 'dream',
  returnBlade: 'blade', dawnForm: 'blade', starWeave: 'star', grandOrrery: 'star',
  crossGuard: 'blade', tideAegis: 'star', thornRiposte: 'thorn', venomWard: 'shadow',
  emberBulwark: 'ember', mirrorParry: 'thorn', starBastion: 'star', dreamParry: 'dream',
  bloodWard: 'ember', shadowVeil: 'shadow', ironTempo: 'blade', lastBastion: 'thorn',
  creepingVenom: 'shadow', bloomRelease: 'shadow', bloodAsh: 'ember', pyreOath: 'ember',
};
for (const card of CARDS) {
  if (!card.school) card.school = SCHOOL_BY_CARD[card.id] || 'dream';
}

export const CARD_MAP = Object.fromEntries(CARDS.map((card) => [card.id, card]));

/**
 * 梦蚀牌：boss 在战斗里塞进你手中的废牌。
 *
 * 这是这类游戏「真正的威胁」——不是敌人打你多少，而是你的牌组被稀释：
 * 12 张牌组被塞 5 张，抽牌有 29% 是废牌；22 张牌组同样 5 张，只占 19%。
 * 它还让「删牌」这件事第一次有了战略意义：牌组越薄，被污染得越狠。
 *
 * 它们只存在于战斗中的抽牌堆/手牌，战斗结束自动消失，不写回 run.deck。
 */
export const STATUS_CARDS = [
  {
    id: 'drossPage', name: '梦蚀残页', cost: 0, type: 'status', rarity: 'status', glyph: '蚀',
    school: 'dream', effects: [], unplayable: true,
    flavor: '纸页在你手里发潮，像一页被水泡过的日志。你读不出上面的字，但它占着手。',
  },
  {
    id: 'whimper', name: '呜咽', cost: 0, type: 'status', rarity: 'status', glyph: '咽',
    school: 'dream', effects: [], unplayable: true, endTurnHpLoss: 2,
    flavor: '有人在很远的地方叫你的名字。你应了一声，才发现自己一直在小声地哭。',
  },
  {
    id: 'scorchPage', name: '焦页', cost: 0, type: 'status', rarity: 'status', glyph: '焦',
    school: 'dream', effects: [], unplayable: true, endTurnHpLoss: 3,
    flavor: '边缘还在烧。你捏不住它，也不舍得松手。',
  },
];
CARDS.push(...STATUS_CARDS);
for (const card of STATUS_CARDS) CARD_MAP[card.id] = card;

export const NON_REWARDABLE = new Set([
  'strike', 'defend',
  'drossPage', 'whimper', 'scorchPage',
  'lampWard', 'keeperFlame', 'ferryFare', 'mistChart', 'tornPage', 'inkEcho',
  'lastFlame', 'dawnEmber', 'deepChart', 'slowOar', 'ashPage', 'namedPage', 'moonScript',
  'tideSigil', 'voidLamp', 'heartSigil', 'sevenCompass', 'farewellKey',
  'mistVeil', 'deepSlumber', 'islandCrown', 'relicChorus',
  'thornDiadem', 'drownedAnchor', 'hushBox', 'backlightEdge', 'abyssSeed',
]);

export const ORIGINS = [
  {
    id: 'blade',
    name: '破晓剑客',
    epithet: '以剑叩问黎明',
    hp: 98,
    color: '#c06653',
    sigil: '剑',
    portrait: 'assets/heroes/blade.webp',
    look: '短剑、旧金与黎明前的第一道伤口',
    attributes: { insight: 3, empathy: 2, presence: 5, guile: 2 },
    mechanic: {
      id: 'combo', name: '破晓连斩', glyph: '斩', max: 3,
      short: '每 3 张攻击牌 → 力量 +1',
      desc: '每回合每打出 3 张攻击牌，获得 1 层力量。连斩数在回合开始时清空。',
    },
    passiveName: '破晓之势',
    passive: '每场战斗开始时获得 2 层力量。',
    resources: { energy: 3, draw: 5 },
    resourceNote: '标准节奏：3 能量 · 抽 5。他的强度来自力量滚雪球，而不是资源本身。',
    startStatuses: { strength: 2 },
    startPoison: 0,
    starter: ['strike', 'strike', 'quickStrike', 'quickStrike', 'crossGuard', 'resolveStrike', 'sunder', 'defend', 'defend', 'defend'],
    deckNote: '七张剑系牌打底：疾斩 0 费起手、交刃攻守兼备，第三张攻击就滚起力量。',
    quote: '「黎明不会自己来，所以我去。」',
    lastStandLine: '剑还没断。站起来——黎明不会替你还手。',
    defeatLine: '剑落在离黎明一步远的地方。下一次，别停在那里。',
  },
  {
    id: 'arcanist',
    name: '星陨术士',
    epithet: '以星火撬开夜空',
    hp: 88,
    color: '#7f9bd0',
    sigil: '星',
    portrait: 'assets/heroes/arcanist.webp',
    look: '星盘、银发与一件写满旧公式的长袍',
    attributes: { insight: 5, empathy: 3, presence: 2, guile: 3 },
    mechanic: {
      id: 'starTrack', name: '星轨', glyph: '轨', max: 2,
      short: '每 2 张技能牌 → 能量 +1、敏捷 +1、星屑 5 点',
      desc: '每打出 2 张技能牌，获得 1 点能量、1 层敏捷，并对敌人造成 5 点无视格挡的星屑伤害。星轨会在触发后重新排布。',
    },
    resources: { energy: 4, draw: 5 },
    resourceNote: '多一格能量。术士靠技能牌把能量与抽牌一起滚回来，一手能连出三张牌。',
    passiveName: '星纱',
    passive: '每场战斗开始时获得 3 层敏捷。',
    startStatuses: { dexterity: 3 },
    startPoison: 0,
    starter: ['strike', 'strike', 'ward', 'ward', 'spark', 'spark', 'echo', 'echo', 'nova', 'starfall'],
    deckNote: '六张星系牌打底：星障挡住的同时攒星轨，灵火与星屑 0 费续牌——技能打得越多，能量回得越快。',
    quote: '「所有陨落，都曾是某人的愿望。」',
    lastStandLine: '星盘还没合上。把最后一点光攥在手里——别让它白落。',
    defeatLine: '星星熄了，但轨迹已经留下。下一次，沿着它再走一遍。',
  },
  {
    id: 'wraith',
    name: '暮影行者',
    epithet: '以毒与影写墓志铭',
    hp: 80,
    color: '#8d9b70',
    sigil: '影',
    portrait: 'assets/heroes/wraith.webp',
    look: '兜帽、双匕与一瓶不肯见光的绿',
    attributes: { insight: 4, empathy: 2, presence: 3, guile: 5 },
    mechanic: {
      id: 'bloom', name: '蚀放', glyph: '蚀', max: 4,
      short: '施加中毒积攒蚀印 → 4 层引爆',
      desc: '你每施加 1 层中毒便积攒等量蚀印。达到 4 层时引爆：造成当前中毒层数 ×1.6 的伤害，清空余毒并再施加 1 层中毒。',
    },
    resources: { energy: 4, draw: 5 },
    resourceNote: '多一格能量：4 能量 · 抽 5。他的伤害不在自己回合结算——毒会在敌人回合里继续掉。',
    passiveName: '无声之毒',
    passive: '每场战斗开始时，使敌人获得 3 层中毒。',
    startStatuses: {},
    startPoison: 3,
    starter: ['strike', 'strike', 'dodge', 'dodge', 'envenom', 'envenom', 'defend', 'defend', 'poisonDagger', 'corrode'],
    deckNote: '六张影系牌打底：毒雾 0 费起手、游身步保命，开局就带 3 层毒在敌人身上发酵。',
    quote: '「影子记得每一个踩过它的人。」',
    lastStandLine: '影子还没散。让它以为你已经输了，再给它一刀。',
    defeatLine: '影子先一步回了家。它会记得替你回来。',
  },
  {
    id: 'pyre',
    name: '烬誓者',
    epithet: '把生命当柴薪',
    hp: 82,
    color: '#c68458',
    sigil: '烬',
    portrait: 'assets/heroes/pyre.webp',
    look: '熔痕、誓言与一把烧不完的剑',
    attributes: { insight: 2, empathy: 5, presence: 3, guile: 2 },
    mechanic: {
      id: 'heat', name: '焚心', glyph: '焚', max: 9,
      short: '灼烧与自损积攒焚心 → 9 层换来爆发',
      desc: '你施加灼烧、失去生命或受到灼烧时积攒焚心。达到 9 层时获得 2 层力量。',
    },
    resources: { energy: 3, draw: 5, lifeAsEnergy: 6 },
    resourceNote: '标准节奏，但血量就是柴：能量不够时可以烧 6 点生命换 1 点能量。打得越狠，烧得越快。',
    passiveName: '不熄之火',
    passive: '每场战斗开始时，使敌人获得 3 层灼烧。',
    startStatuses: {},
    startPoison: 0,
    startBurn: 3,
    starter: ['strike', 'ember', 'ember', 'scorch', 'emberHeart', 'bloodAsh', 'defend', 'defend', 'lampWard', 'kindling'],
    deckNote: '焦灼 0 费点火、血烬烧自己换输出，开局就有 3 层灼烧在烧；焚心攒到 9 层就换来力量。',
    quote: '「如果一定要熄，就烧得亮一点。」',
    lastStandLine: '火还没灭。把剩下的都烧进去——包括那点害怕。',
    defeatLine: '火终于熄了。至少这一次，烧得够亮。',
  },
  {
    id: 'milkfrog',
    name: '奶蛙蛙',
    epithet: '似龙非龙，似蛙非蛙',
    hp: 88,
    color: '#dcb04a',
    sigil: '蛙',
    portrait: 'assets/heroes/milkfrog.webp',
    look: '奶油色的大肚皮、绿眼白与一张随时要笑的一字嘴',
    attributes: { insight: 4, empathy: 5, presence: 1, guile: 3 },
    mechanic: {
      id: 'laugh', name: '狂笑', glyph: '笑', max: 3,
      short: '每打出 3 张牌 → 狂笑：抽 1 张、3 点格挡、3 点无视格挡伤害',
      desc: '每打出 3 张牌，你会笑到捧腹：抽 1 张牌、获得 3 点格挡，并对敌人造成 3 点无视格挡的伤害。没有人知道你在笑什么，但它开始握不稳刀了。',
    },
    resources: { energy: 3, draw: 5 },
    resourceNote: '标准节奏：3 能量 · 抽 5；狂笑会不断替你抽牌、补格挡，手牌上限 20 张——抽到的牌都有地方放。',
    passiveName: '齁',
    passive: '每场战斗开始时，敌人获得 1 层虚弱。',
    startStatuses: {},
    startEnemyWeak: 1,
    startPoison: 0,
    starter: ['strike', 'strike', 'hoohoo', 'hoohoo', 'bellyFlop', 'bellyFlop', 'stuffedCheeks', 'croakLaugh', 'bellyLaugh', 'defend'],
    deckNote: '起手抽 5 是通用节奏；奶蛙蛙靠 0 费续牌与狂笑在回合内滚雪球，手牌上限 20 让抽到的牌都留得住。',
    quote: '「生母弃我，胞兄厌我，世人笑我——那我就先笑。」',
    lastStandLine: '哈哈……还没笑完呢。再来一口，这次笑大声点。',
    defeatLine: '……这次笑不出来了。那就下次再笑。',
  },
];

export const ORIGIN_MAP = Object.fromEntries(ORIGINS.map((origin) => [origin.id, origin]));

export const AWAKENING_FLOORS = [3, 6];

export const ORIGIN_AWAKENINGS = {
  blade: [
    { id: 'bladeTempo', tier: 1, name: '疾锋', glyph: '疾', desc: '连斩阈值降为 2；每次触发额外抽 1 张牌。', mods: { thresholdDelta: -1, triggerDraw: 1 }, line: '剑比念头更快。' },
    { id: 'bladeMight', tier: 1, name: '沉锋', glyph: '沉', desc: '连斩每次触发额外获得 3 点格挡与 1 层敏捷。', mods: { triggerBlock: 3, triggerDex: 1 }, line: '越重的剑，越懂得停在哪里。' },
    { id: 'bladeDawn', tier: 2, name: '黎明剑域', glyph: '域', desc: '连斩触发时额外获得 1 层力量，并使敌人获得 1 层易伤。', mods: { triggerStrength: 1, triggerVulnerable: 1 }, line: '你的影子先一步亮了起来。' },
    { id: 'bladeUnsheathed', tier: 2, name: '无鞘', glyph: '鞘', desc: '连斩触发时返还 1 点能量并获得 4 点格挡。', mods: { triggerEnergy: 1, triggerBlock: 4 }, line: '鞘留在原地，剑已经回不来。' },
  ],
  arcanist: [
    { id: 'arcSwift', tier: 1, name: '星速', glyph: '速', desc: '星轨阈值降为 2；触发时额外抽 1 张牌。', mods: { thresholdDelta: -1, triggerDraw: 1 }, line: '轨道被你自己扳快了一格。' },
    { id: 'arcVeil', tier: 1, name: '星幕', glyph: '幕', desc: '星轨触发时额外获得 5 点格挡并回复 2 点生命。', mods: { triggerBlock: 5, triggerHeal: 2 }, line: '夜空垂下来，替你挡了一次。' },
    { id: 'arcLoop', tier: 2, name: '环星', glyph: '环', desc: '星轨触发时额外获得 1 点能量并抽 1 张牌。', mods: { triggerEnergy: 1, triggerDraw: 1 }, line: '星星学会了替自己点火。' },
    { id: 'arcFall', tier: 2, name: '星陨', glyph: '陨', desc: '星轨触发时，使敌人获得 1 层易伤并额外获得 4 点格挡。', mods: { triggerVulnerable: 1, triggerBlock: 4 }, line: '落下的不是星，是你数过的每一秒。' },
  ],
  wraith: [
    { id: 'wraithSpread', tier: 1, name: '蔓延', glyph: '延', desc: '蚀放阈值降为 3；引爆时额外施加 1 层中毒。', mods: { thresholdDelta: -1, burstPoison: 1 }, line: '毒比你更耐心。' },
    { id: 'wraithDeep', tier: 1, name: '深蚀', glyph: '深', desc: '蚀放引爆伤害倍率 +1。', mods: { burstMultiplier: 1 }, line: '影子里的东西，比影子更毒。' },
    { id: 'wraithGarden', tier: 2, name: '蚀园', glyph: '园', desc: '蚀放引爆后抽 2 张牌，并额外施加 1 层中毒。', mods: { triggerDraw: 2, burstPoison: 1 }, line: '它们在伤口里开花，你在花里翻牌。' },
    { id: 'wraithAbyss', tier: 2, name: '万蚀', glyph: '万', desc: '蚀放阈值降为 2；引爆伤害倍率再 +1。', mods: { thresholdDelta: -2, burstMultiplier: 1 }, line: '深渊记得每一滴毒的名字。' },
  ],
  pyre: [
    { id: 'pyreHaste', tier: 1, name: '速燃', glyph: '速', desc: '焚心阈值降为 5；触发时额外获得 1 点能量。', mods: { thresholdDelta: -1, triggerEnergy: 1 }, line: '火烧得急了，连灰都追不上。' },
    { id: 'pyreFlare', tier: 1, name: '炽誓', glyph: '炽', desc: '焚心触发时额外获得 1 层力量并回复 4 点生命。', mods: { triggerStrength: 1, triggerHeal: 4 }, line: '誓言把伤口烫合了一部分。' },
    { id: 'pyrePyre', tier: 2, name: '薪尽', glyph: '薪', desc: '焚心触发时使敌人获得 2 层灼烧，并回复 4 点生命。', mods: { triggerBurn: 2, triggerHeal: 4 }, line: '柴会烧完，火不会。' },
    { id: 'pyreFuneral', tier: 2, name: '火葬', glyph: '葬', desc: '焚心触发时使敌人获得 2 层灼烧，并返还 1 点能量。', mods: { triggerBurn: 2, triggerEnergy: 1 }, line: '你把自己的名字先烧给了它。' },
  ],
  milkfrog: [
    { id: 'laughWheeze', tier: 1, name: '笑岔气', glyph: '岔', desc: '狂笑时额外回复 3 点生命。', mods: { triggerHeal: 3 }, line: '笑到岔气，伤口倒是合上了。' },
    { id: 'laughBlade', tier: 1, name: '笑里刀', glyph: '里', desc: '狂笑伤害 +2，并使敌人获得 1 层易伤。', mods: { laughDamage: 2, triggerVulnerable: 1 }, line: '你笑的时候，它先看见了你的牙。' },
    { id: 'laughAbyss', tier: 2, name: '狂笑不止', glyph: '止', desc: '狂笑伤害 +3，且额外抽 1 张牌。', mods: { laughDamage: 3, laughDraw: 1 }, line: '笑声在梦里没有回声，因为它不肯停。' },
    { id: 'laughCollapse', tier: 2, name: '笑到脱力', glyph: '脱', desc: '狂笑时获得 6 点格挡与 1 点能量。', mods: { triggerBlock: 6, triggerEnergy: 1 }, line: '你扶着膝盖，敌人以为你不行了。' },
  ],
};

export function awakeningsFor(originId, tier) {
  return (ORIGIN_AWAKENINGS[originId] || []).filter((item) => item.tier === tier);
}

export function findAwakening(id) {
  for (const list of Object.values(ORIGIN_AWAKENINGS)) {
    const found = list.find((item) => item.id === id);
    if (found) return found;
  }
  return null;
}

export const ENEMIES = [
  {
    id: 'mossling', name: '苔沼泥团', tier: 'normal', hp: 33, accent: '#7f9d62', lineage: 'rotFeast',
    image: 'assets/enemies/mossling.webp', glyph: '苔',
    quote: '「咕啵……咕啵……」',
    lore: '从梦沼里爬出的啜泣泥团。它吞下的东西，最后都会变成它头顶的一朵蘑菇。',
    moves: [
      { name: '腐泥撞击', kind: 'attack', damage: 6, intent: '黏稠的一击。' },
      { name: '孢子瘴气', kind: 'debuff', playerStatus: { status: 'weak', amount: 2 }, intent: '散播令人乏力的孢子。' },
      { name: '吞食', kind: 'attack', damage: 9, intent: '张开整具身体。' },
    ],
    pattern: [0, 1, 0, 2],
  },
  {
    id: 'bone-sentinel', name: '枯骨哨兵', tier: 'normal', hp: 45, accent: '#c8b27c', lineage: 'phalanx',
    image: 'assets/enemies/bone-sentinel.webp', glyph: '骨', sapient: true, personality: 'loyal',
    quote: '「王座已朽，职责未朽。」',
    lore: '它守着一扇早已不存在的门。拒绝回答任何人，也不再记得自己是谁。',
    moves: [
      { name: '锈刃横斩', kind: 'attack', damage: 8, intent: '缓慢而沉重的一剑。' },
      { name: '不朽军势', kind: 'buff', block: 8, selfStatus: { status: 'strength', amount: 1 }, intent: '重整残破的军阵。' },
      { name: '断头台', kind: 'attack', damage: 11, intent: '甲胄缝隙里亮起两点鬼火。' },
    ],
    pattern: [0, 1, 0, 2, 0],
  },
  {
    id: 'mist-witch', name: '雾隐巫婆', tier: 'normal', hp: 39, accent: '#a77cc9', lineage: 'borrowedName',
    image: 'assets/enemies/mist-witch.webp', glyph: '巫', sapient: true, personality: 'cunning',
    quote: '「孩子，把名字借给我。」',
    lore: '她收集迷路者的名字，编成一张张不会腐烂的船票。',
    moves: [
      { name: '幽绿咒火', kind: 'attack_debuff', damage: 5, playerStatus: { status: 'weak', amount: 2 }, intent: '火焰里浮出细小的牙齿。' },
      { name: '蚀魂雾', kind: 'debuff', playerStatus: { status: 'poison', amount: 4 }, intent: '一口吸进肺里的沼泽。' },
      { name: '临别礼', kind: 'attack', damage: 9, intent: '她忽然笑得像个人。' },
    ],
    pattern: [0, 1, 2, 0, 1, 0],
  },
  {
    id: 'rift-priest', name: '裂境祭司', tier: 'normal', hp: 48, accent: '#d1c5a5', lineage: 'darkLitany',
    image: 'assets/enemies/rift-priest.webp', glyph: '祭', sapient: true, personality: 'devout',
    quote: '「我看见结局了。它在笑。」',
    lore: '蒙眼的祭司从裂隙里读出了不该存在的历史，并决定亲手让它发生。',
    moves: [
      { name: '禁书页', kind: 'attack', damage: 7, intent: '书页边缘比刀还薄。' },
      { name: '空洞凝视', kind: 'debuff', playerStatus: { status: 'vulnerable', amount: 2 }, intent: '你忽然忘了自己为何握剑。' },
      { name: '异界脉冲', kind: 'attack', damage: 5, hits: 2, intent: '空气发出玻璃开裂的声音。' },
      { name: '血祭', kind: 'buff', block: 6, selfStatus: { status: 'strength', amount: 2 }, intent: '在自己的影子上刻下一道符。' },
    ],
    pattern: [0, 1, 2, 0, 3, 2],
  },
  // ── 同族变体 ──
  // 只有 4 种普通敌人撑 8 座岛时，玩家第二座岛就能背出招式表。
  // 这里给每种敌人加两个「本岛化」变体：复用同一张立绘，换血量、招式与状态，
  // 让每座岛的遭遇组合都不一样。成本极低，但玩家第二局就能感觉到。
  {
    id: 'rot-mossling', name: '腐沼泥团', tier: 'normal', hp: 36, accent: '#7f9d62', lineage: 'rotFeast',
    image: 'assets/enemies/mossling.webp', glyph: '腐',
    quote: '「咕啵……咕啵……」',
    lore: '泥团里泡着太多没化完的名字，它吐出来的气带着酸味。',
    moves: [
      { name: '腐泥撞击', kind: 'attack', damage: 7, intent: '黏稠的一击，带着酸。' },
      { name: '酸孢瘴', kind: 'debuff', playerStatus: { status: 'poison', amount: 4 }, intent: '孢子落进伤口里，开始发芽。' },
      { name: '吞食', kind: 'attack', damage: 10, intent: '张开整具身体。' },
    ],
    pattern: [0, 1, 0, 2],
  },
  {
    id: 'ember-mossling', name: '烬沼泥团', tier: 'normal', hp: 40, accent: '#c68458', lineage: 'rotFeast',
    image: 'assets/enemies/mossling.webp', glyph: '烬',
    quote: '「咕啵……烫……」',
    lore: '它在灰烬岛的余火里泡过一夜，从此一直在冒烟。',
    moves: [
      { name: '余烬撞击', kind: 'attack', damage: 6, intent: '它身上还带着火。' },
      { name: '燎孢', kind: 'debuff', playerStatus: { status: 'burn', amount: 4 }, intent: '孢子一落地就烧了起来。' },
      { name: '吞食', kind: 'attack', damage: 11, intent: '张开整具身体。' },
    ],
    pattern: [0, 1, 0, 2],
  },
  {
    id: 'broken-sentinel', name: '断刃哨兵', tier: 'normal', hp: 50, accent: '#c8b27c', lineage: 'phalanx',
    image: 'assets/enemies/bone-sentinel.webp', glyph: '断', sapient: true, personality: 'loyal',
    quote: '「刀断了，队形还在。」',
    lore: '它的剑只剩半截，于是把盾举得更稳。',
    moves: [
      { name: '钝刃横斩', kind: 'attack', damage: 9, intent: '半截剑砸下来。' },
      { name: '结阵', kind: 'buff', block: 12, selfStatus: { status: 'strength', amount: 1 }, intent: '残兵重新列成一线。' },
      { name: '处决', kind: 'attack', damage: 13, intent: '甲胄缝隙里亮起两点鬼火。' },
    ],
    pattern: [0, 1, 0, 2, 0],
  },
  {
    id: 'nameless-sentinel', name: '无名哨兵', tier: 'normal', hp: 54, accent: '#c8b27c', lineage: 'phalanx',
    image: 'assets/enemies/bone-sentinel.webp', glyph: '无', sapient: true, personality: 'loyal',
    quote: '「名字被划掉了，职责没有。」',
    lore: '名册上它那一行是空的。它还在守门，因为不知道还能做什么。',
    moves: [
      { name: '无名斩', kind: 'attack', damage: 10, intent: '它不喊口号。' },
      { name: '亡者列队', kind: 'buff', block: 8, selfStatus: { status: 'strength', amount: 2 }, intent: '身后的影子跟着站直了。' },
      { name: '断罪', kind: 'attack', damage: 14, intent: '它把你认成了当年那个人。' },
    ],
    pattern: [0, 1, 0, 2, 1],
  },
  {
    id: 'name-thief', name: '借名巫婆', tier: 'normal', hp: 42, accent: '#a77cc9', lineage: 'borrowedName',
    image: 'assets/enemies/mist-witch.webp', glyph: '借', sapient: true, personality: 'cunning',
    quote: '「就借一会儿，你又不常用。」',
    lore: '她专挑你最爱用的那张牌下手。',
    moves: [
      { name: '借名', kind: 'debuff', playerStatus: { status: 'weak', amount: 3 }, stealCard: true, intent: '她伸手去够你牌堆里最贵的那张牌。' },
      { name: '幽绿咒火', kind: 'attack_debuff', damage: 6, playerStatus: { status: 'weak', amount: 2 }, intent: '火焰里浮出细小的牙齿。' },
      { name: '临别礼', kind: 'attack', damage: 10, intent: '她忽然笑得像个人。' },
    ],
    pattern: [0, 1, 2, 1, 0],
  },
  {
    id: 'faceless-witch', name: '无面巫婆', tier: 'normal', hp: 46, accent: '#a77cc9', lineage: 'borrowedName',
    image: 'assets/enemies/mist-witch.webp', glyph: '面', sapient: true, personality: 'cunning',
    quote: '「你看我像谁？」',
    lore: '她的脸是从别人那里借的，还没还。',
    moves: [
      { name: '蚀魂雾', kind: 'debuff', playerStatus: { status: 'poison', amount: 6 }, intent: '一口吸进肺里的沼泽。' },
      { name: '咒火', kind: 'attack', damage: 7, intent: '绿火贴着脸烧。' },
      { name: '空名', kind: 'attack_debuff', damage: 11, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '她叫了你一声，你下意识回头。' },
    ],
    pattern: [0, 1, 2, 0, 1],
  },
  {
    id: 'silent-priest', name: '缄口祭司', tier: 'normal', hp: 52, accent: '#d1c5a5', lineage: 'darkLitany',
    image: 'assets/enemies/rift-priest.webp', glyph: '缄', sapient: true, personality: 'devout',
    quote: '「说出来就不准了。」',
    lore: '他把看见的结局缝进嘴里，只在挥刀时漏出一点。',
    moves: [
      { name: '禁书页', kind: 'attack', damage: 8, intent: '书页边缘比刀还薄。' },
      { name: '空洞凝视', kind: 'debuff', playerStatus: { status: 'vulnerable', amount: 3 }, intent: '你忽然忘了自己为何握剑。' },
      { name: '异界脉冲', kind: 'attack', damage: 6, hits: 2, intent: '空气发出玻璃开裂的声音。' },
    ],
    pattern: [0, 1, 2, 0],
  },
  {
    id: 'blood-priest', name: '血契祭司', tier: 'normal', hp: 56, accent: '#d1c5a5', lineage: 'darkLitany',
    image: 'assets/enemies/rift-priest.webp', glyph: '契', sapient: true, personality: 'devout',
    quote: '「我签的是你的名字。」',
    lore: '他用自己的血换别人的命，账本上写满了别人的签名。',
    moves: [
      { name: '血祭', kind: 'buff', block: 8, selfStatus: { status: 'strength', amount: 2 }, intent: '在自己的影子上刻下一道符。' },
      { name: '禁书页', kind: 'attack', damage: 9, intent: '书页边缘比刀还薄。' },
      { name: '献祭', kind: 'attack_heal', damage: 11, heal: 6, intent: '他伸手按住你的伤口。' },
    ],
    pattern: [0, 1, 2, 1],
  },
  {
    id: 'briar-beast', name: '棘冠兽', tier: 'elite', hp: 76, accent: '#b76e62', lineage: 'thornCrown',
    image: 'assets/enemies/briar-beast.webp', glyph: '棘',
    quote: '「花开了，需要一些东西来肥沃土壤。」',
    lore: '林中的玫瑰以迷路者为养分。兽只是恰好长着那些玫瑰。',
    moves: [
      { name: '棘角冲撞', kind: 'attack', damage: 10, intent: '整片森林都在后退。' },
      { name: '狂怒生长', kind: 'buff', block: 5, selfStatus: { status: 'strength', amount: 2 }, intent: '荆棘正从骨缝里长出来。' },
      { name: '荆棘踏伐', kind: 'attack', damage: 5, hits: 3, intent: '地面裂开三次。' },
      { name: '玫瑰汲取', kind: 'attack_heal', damage: 8, heal: 6, intent: '它嗅到了你伤口的气味。' },
    ],
    pattern: [0, 1, 0, 2, 1, 3],
  },
  {
    id: 'shadow-knight', name: '镜影骑士', tier: 'elite', hp: 74, accent: '#9e86d4', lineage: 'mirrorEcho',
    image: 'assets/enemies/shadow-knight.webp', glyph: '镜', sapient: true, personality: 'proud',
    quote: '「你挥剑的姿势，和我一模一样。」',
    lore: '每一面被梦打碎的镜子，都会生出一位骑士。它们共同的使命，是杀死镜子外的人。',
    moves: [
      { name: '裂镜突刺', kind: 'attack', damage: 12, intent: '镜面里伸出一柄长矛。' },
      { name: '暗影束缚', kind: 'debuff', playerStatus: { status: 'vulnerable', amount: 2 }, intent: '你的影子被钉在地上。' },
      { name: '刃矛回旋', kind: 'attack_block', damage: 7, hits: 2, block: 5, intent: '金属碎片绕成一圈。' },
      { name: '深渊誓约', kind: 'buff', block: 10, selfStatus: { status: 'strength', amount: 2 }, stealStatus: { status: 'strength', amount: 2 }, intent: '它向你索要一段誓言——和誓言里的力量。' },
    ],
    pattern: [0, 1, 2, 0, 3, 2],
  },
  {
    id: 'nightmare-dragon', name: '梦魇古龙', tier: 'boss', hp: 132, powerScale: 1.1, accent: '#c8995e',
    image: 'assets/enemies/nightmare-dragon.webp', glyph: '龙', sapient: true, personality: 'proud',
    mechanic: { id: 'dragonScorch', name: '龙焰缠身', glyph: '焰', desc: '它的攻击会在你身上留下灼烧；灼烧在你回合结束时发作。' },
    quote: '「所有梦境，最终都会烧成同一种灰。」',
    lore: '盘踞在梦之尽头的古老存在。它并不憎恨你，只是你恰好站在它要呼吸的地方。',
    moves: [
      { name: '梦焰吐息', kind: 'attack', damage: 8, hits: 2, intent: '紫色的火在胸腔深处翻涌。' },
      { name: '古龙威压', kind: 'debuff_buff', playerStatus: { status: 'weak', amount: 2 }, selfStatus: { status: 'strength', amount: 2 }, block: 10, intent: '仅仅是注视，就让你喘不过气。' },
      { name: '湮灭之爪', kind: 'attack', damage: 18, intent: '一只足以遮住月亮的爪子。' },
      { name: '梦境坍缩', kind: 'attack_debuff', damage: 7, hits: 3, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '四周的梦像纸一样皱起。' },
      { name: '黑金鳞壁', kind: 'buff_heal', block: 15, heal: 5, selfStatus: { status: 'strength', amount: 1 }, intent: '鳞片合拢，金光如熔岩。' },
    ],
    pattern: [0, 1, 2, 0, 3, 4, 2],
    phase2: {
      at: 0.5,
      title: '焚梦龙形',
      image: 'assets/enemies/nightmare-dragon-phase2.webp',
      color: '#e08a52',
      fx: 'ember',
      line: '古龙的黑金鳞片一片片剥落，鳞下不是血肉，而是一整片正在燃烧的夜空。',
      block: 20,
      // 第一场首领不带任何反制机制。
      // 这里原本有 cleanse：二阶段一口气清空中毒与灼烧，等于当场废掉毒流与火流。
      // 实测它把暮影行者在首战的胜率压到 35%——一个还没学会游戏的人，
      // 在第一场首领面前被判了「你搭错了流派」。反制从第三座岛再开始。
      selfStatus: { status: 'strength', amount: 3 },
      moves: [
        { name: '烬翼覆城', kind: 'attack', damage: 8, hits: 3, intent: '两只翅膀张开，遮住了整片梦境。' },
        { name: '焚心龙息', kind: 'attack_debuff', damage: 18, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '它把最后一口梦含在喉咙里。' },
        { name: '余火重生', kind: 'buff_heal', block: 18, heal: 6, selfStatus: { status: 'strength', amount: 2 }, intent: '灰烬逆着重力长回它身上。' },
        { name: '终末天火', kind: 'attack', damage: 7, hits: 4, intent: '天穹裂成四道。' },
        { name: '龙梦终结', kind: 'attack', damage: 22, intent: '它决定不再做梦。' },
      ],
      pattern: [1, 0, 2, 3, 1, 4, 0],
    },
  },
  {
    id: 'mist-queen', name: '千面雾后', tier: 'boss', hp: 160, powerScale: 1.4, accent: '#a77cc9',
    image: 'assets/enemies/mist-queen.webp', glyph: '面', sapient: true, personality: 'sorrowful',
    mechanic: { id: 'mistSeal', name: '借名之雾', glyph: '封', desc: '每个你的回合开始时，雾会借走你手中一张牌的名字，使其本回合无法打出。', max: 1 },
    quote: '「我记得每一个人的名字，除了我自己的。」',
    lore: '雾隐岛真正的主人。她把迷路者的名字缝进面纱，替他们活着，也替他们忘记。',
    moves: [
      { name: '借名之潮', kind: 'attack_debuff', damage: 12, playerStatus: { status: 'weak', amount: 2 }, intent: '她念出了一个不属于你的名字。' },
      { name: '千面加冕', kind: 'buff', block: 12, selfStatus: { status: 'strength', amount: 2 }, intent: '无数张脸同时微笑。' },
      { name: '溺梦之拥', kind: 'attack_heal', damage: 15, heal: 7, intent: '雾像海水一样漫过胸口。' },
      { name: '无声的吻', kind: 'debuff', playerStatus: { status: 'poison', amount: 4 }, intent: '面纱下传来很轻的呼吸。' },
      { name: '最后一层面具', kind: 'attack', damage: 7, hits: 3, intent: '所有面具同时转向你。' },
    ],
    pattern: [0, 1, 2, 3, 4, 2, 0],
    surge: {
      at: 0.5,
      title: '千面倾覆',
      line: '面纱下的所有脸同时睁开眼。她不再借一个名字——她要把整副手牌都据为己有。',
      sealCount: 2,
      sealBlock: 3,
    },
  },
  {
    id: 'bone-king', name: '无冠之王', tier: 'boss', hp: 150, powerScale: 1.45, accent: '#c8b27c',
    image: 'assets/enemies/bone-king.webp', glyph: '冠', sapient: true, personality: 'proud',
    mechanic: { id: 'boneCandles', name: '万烛倒计时', glyph: '烛', desc: '每个你的回合熄灭一根蜡烛；三根烛尽时，万烛同灭——按你最大生命的四分之一结算（至少 10 点），然后重新点燃。', max: 3 },
    quote: '「王冠丢了，但王座还记得我。」',
    lore: '骨庭岛的王，早已忘记自己统治过什么。每根蜡烛都是一个臣民的名字，烧完就没人再记得。',
    moves: [
      { name: '王座倾轧', kind: 'attack', damage: 17, intent: '整座骨庭向前倾斜。' },
      { name: '白骨军令', kind: 'buff', block: 14, selfStatus: { status: 'strength', amount: 3 }, intent: '没有士兵，也照样下令。' },
      { name: '无冠之怒', kind: 'attack', damage: 8, hits: 3, intent: '骨手从四面八方伸出。' },
      { name: '腐朽恩典', kind: 'debuff_buff', playerStatus: { status: 'weak', amount: 2 }, selfStatus: { status: 'strength', amount: 1 }, block: 8, intent: '它赐给你一份迟到了三百年的恩典。' },
      { name: '殉葬', kind: 'attack_debuff', damage: 13, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '蜡烛全部熄灭了。' },
    ],
    pattern: [0, 1, 2, 3, 4, 1, 0],
    surge: {
      at: 0.5,
      title: '王座燃尽',
      line: '三根蜡烛同时倾倒，烛泪逆流回王座。它在用自己的名字续火。',
      candleStep: 2,
      candleStrength: 3,
      inject: { cardId: 'whimper', count: 1 },
    },
  },
  {
    id: 'mirror-sovereign', name: '镜潮之主', tier: 'boss', hp: 138, powerScale: 1.5, accent: '#9e86d4',
    image: 'assets/enemies/mirror-sovereign.webp', glyph: '镜', sapient: true, personality: 'cunning',
    mechanic: { id: 'mirrorReplica', name: '镜海复写', glyph: '映', desc: '你造成的每一点伤害都会被镜面记住——刀砍的、毒渗的、火烧的都算；记满你最大生命的 35%（至少 12 点）时，它复写你最大生命 5% 的伤害（最低 5 点），无视格挡。它称的是伤害的重量，不是出牌的张数。' },
    quote: '「你看见的每一种未来，都是我批准过的。」',
    lore: '镜潮把无数个可能性冲上同一片岸。镜潮之主坐在碎镜的浪尖，挑选一个自己最喜欢的你。',
    moves: [
      { name: '镜刃齐鸣', kind: 'attack', damage: 7, hits: 3, intent: '成百上千把刀同时出鞘。' },
      { name: '倒影加冕', kind: 'buff', block: 10, selfStatus: { status: 'strength', amount: 3 }, intent: '镜中的你先一步跪下。' },
      { name: '碎镜俯冲', kind: 'attack_debuff', damage: 14, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '一整片镜海立了起来。' },
      { name: '千镜凝视', kind: 'debuff', playerStatus: { status: 'weak', amount: 3 }, intent: '每一面镜子都在审判你。' },
      { name: '反照', kind: 'attack_block', damage: 11, block: 8, intent: '你的动作被原样归还。' },
    ],
    pattern: [0, 1, 2, 3, 4, 1, 0],
    phase2: {
      at: 0.5,
      title: '千镜归一',
      image: 'assets/enemies/mirror-sovereign-phase2.webp',
      color: '#b7a6ff',
      fx: 'shard',
      line: '所有镜子同时转向你。镜子里的人也在转身——它们终于决定，不再只是看着。',
      block: 20,
      cleanse: true,
      reflectPct: 0.1,
      selfStatus: { status: 'strength', amount: 2 },
      moves: [
        { name: '万我合围', kind: 'attack', damage: 6, hits: 4, intent: '每一个你都举起刀。' },
        { name: '照见', kind: 'attack_debuff', damage: 13, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '它照出了你所有没防住的地方。' },
        { name: '镜面重铸', kind: 'buff_heal', block: 18, heal: 5, intent: '碎掉的镜子重新长回它身上。' },
        { name: '镜中迟疑', kind: 'debuff_buff', playerStatus: { status: 'weak', amount: 2 }, selfStatus: { status: 'strength', amount: 2 }, block: 10, intent: '它把你的犹豫也复制了一份。' },
        { name: '唯一的你', kind: 'attack', damage: 21, intent: '它决定只留下一个版本。' },
      ],
      pattern: [0, 1, 2, 3, 4, 1, 0],
    },
  },
  {
    id: 'ash-saint', name: '焚名圣者', tier: 'boss', hp: 150, powerScale: 1.55, accent: '#c68458',
    image: 'assets/enemies/ash-saint.webp', glyph: '焚', sapient: true, personality: 'devout',
    mechanic: { id: 'ashFurnace', name: '焚名炉', glyph: '炉', desc: '每个你造成过伤害的回合，炉温 +1；满 5 层时它吞下一个名字，回复 9 点生命并获得 1 层力量。它怕快，不怕狠——拖得越久，它吞掉的名字越多。', max: 5 },
    quote: '「火要一个名字才肯亮。我的刚好够用。」',
    lore: '灰烬岛旧灯塔里的守火者。它把一卷卷名字投进炉膛，维持一盏早已没有人需要的灯。走近才会发现，它没有脸——那张脸被它自己烧掉了。',
    moves: [
      { name: '灰烬布道', kind: 'attack_debuff', damage: 6, playerStatus: { status: 'weak', amount: 2 }, intent: '灰落在舌头上，像一句说不完的祷词。' },
      { name: '焚名圣火', kind: 'buff', block: 12, selfStatus: { status: 'strength', amount: 2 }, intent: '炉膛里翻出一枚还没烧完的名牌。' },
      { name: '灯下无影', kind: 'attack', damage: 4, hits: 3, intent: '你的影子被火光钉在墙上。' },
      { name: '借火', kind: 'attack_heal', damage: 9, heal: 6, intent: '它把手伸进你的胸口，借走一点温度。' },
      { name: '余烬加冕', kind: 'debuff_buff', playerStatus: { status: 'vulnerable', amount: 2 }, selfStatus: { status: 'strength', amount: 1 }, block: 10, intent: '灰烬在它头顶堆成一顶冠。' },
    ],
    pattern: [0, 1, 2, 3, 4, 1, 2],
    phase2: {
      at: 0.5,
      title: '焚名炬火',
      image: 'assets/enemies/ash-saint-phase2.webp',
      color: '#e8a96a',
      fx: 'ash',
      line: '它把自己的名字投进炉膛。整座灯塔骤然亮起，火光里站着无数个没有脸的它。',
      block: 20,
      cleanse: true,
      noHeal: true,
      // 灰烬的规则：从这一刻起，每个你的回合第一张攻击牌被炉火吞掉。
      // 牌组不会变脏，只会慢慢变薄——速杀少损失，拖久了才凑不齐第二套连招。
      burnPlayed: true,
      selfStatus: { status: 'strength', amount: 3 },
      moves: [
        { name: '万卷焚名', kind: 'attack_debuff', damage: 6, hits: 2, playerStatus: { status: 'weak', amount: 2 }, intent: '所有没说完的话一起烧了起来。' },
        { name: '长明之炉', kind: 'buff_heal', block: 16, heal: 5, intent: '炉火吞掉了它最后一点犹疑。' },
        { name: '灰烬圣痕', kind: 'attack', damage: 5, hits: 4, intent: '灰落在你身上，烫出祷词。' },
        { name: '无人添薪', kind: 'attack_debuff', damage: 14, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '它决定把自己也烧进去。' },
        { name: '灯火吞夜', kind: 'attack', damage: 20, intent: '整座梦境的夜色被点燃。' },
      ],
      pattern: [0, 1, 2, 3, 4, 2, 0],
    },
  },
  {
    id: 'tide-warden', name: '潮钟守夜人', tier: 'boss', hp: 148, powerScale: 1.7, accent: '#7fa9a4',
    image: 'assets/enemies/tide-warden.webp', glyph: '钟', sapient: true, personality: 'stoic',
    mechanic: { id: 'tideRhythm', name: '潮汐交替', glyph: '潮', desc: '涨潮时海把它托高——它每一击的伤害 +35%，并在回合末叠护甲与力量；退潮时它退回水下，伤害 -20%，而你获得 1 点额外能量。看潮打牌，是这座岛唯一教的事。', max: 2 },
    quote: '「三点十七分。再等一等，船就到了。」',
    lore: '潮钟岛最后一位守夜人。他每晚敲响同一口钟，把误入梦海的船引向一座不存在的码头。钟楼的每一根梁上都刻着同一句话：再等一等。',
    moves: [
      { name: '停钟一击', kind: 'attack', damage: 17, intent: '钟锤落下，时间跟着顿了一下。' },
      { name: '三点十七分', kind: 'debuff_buff', playerStatus: { status: 'weak', amount: 2 }, selfStatus: { status: 'strength', amount: 3 }, block: 10, intent: '所有指针同时指向你。' },
      { name: '逆潮拖曳', kind: 'attack_debuff', damage: 8, hits: 2, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '退潮的手抓住了你的脚踝。' },
      { name: '无人靠岸', kind: 'attack_heal', damage: 13, heal: 6, intent: '他第无数次把船撑离岸边。' },
      { name: '潮钟长鸣', kind: 'buff_heal', block: 15, heal: 6, selfStatus: { status: 'strength', amount: 1 }, intent: '钟声从海底一路响上来。' },
    ],
    pattern: [0, 1, 2, 0, 3, 4, 2],
    surge: {
      at: 0.5,
      title: '风暴潮',
      line: '钟声压过海面。潮水不再守时，涨落之间多出了一只手。',
      surgeWeak: 1,
    },
  },
  {
    id: 'paper-queen', name: '剪月皇后', tier: 'boss', hp: 130, powerScale: 1.65, accent: '#c9b6d8',
    image: 'assets/enemies/paper-queen.webp', glyph: '剪', sapient: true, personality: 'cunning',
    mechanic: { id: 'paperCut', name: '剪稿', glyph: '剪', desc: '每个敌方回合结束，她剪去你手牌中的一张牌（优先剪最贵的），但一场最多只剪 3 张。真形每回合会剪去两张。', max: 3 },
    quote: '「我给了你那么多个好结局，你为什么偏要真的那个？」',
    lore: '纸月岛的主人，用剪刀替所有故事修剪结局。她收集每一个「你活下来」的版本，把它们装订成册，再剪掉所有会让人流泪的段落。',
    moves: [
      { name: '裁月', kind: 'attack', damage: 5, hits: 3, intent: '三道纸刃从月亮的裂口里落下。' },
      { name: '好结局', kind: 'debuff_buff', playerStatus: { status: 'weak', amount: 2 }, selfStatus: { status: 'strength', amount: 2 }, block: 10, intent: '她替你念了一个圆满的结尾。' },
      { name: '纸上风暴', kind: 'attack_debuff', damage: 9, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '三千多页稿纸同时翻卷。' },
      { name: '终稿', kind: 'attack_heal', damage: 10, heal: 8, intent: '她把你的名字写进最后一页。' },
      { name: '落款', kind: 'buff', block: 16, selfStatus: { status: 'strength', amount: 1 }, intent: '一枚朱红的印章按在梦的末尾。' },
    ],
    pattern: [0, 1, 2, 0, 3, 4, 2],
    phase2: {
      at: 0.5,
      title: '朱笔终稿',
      image: 'assets/enemies/paper-queen-phase2.webp',
      color: '#d05a52',
      fx: 'paper',
      line: '她剪掉所有温柔的段落，只留下最后一页。那一页上只有一句话：你失败了。',
      block: 22,
      cleanse: true,
      echoBreak: true,
      selfStatus: { status: 'strength', amount: 3 },
      moves: [
        { name: '朱笔勾销', kind: 'attack_debuff', damage: 6, hits: 2, playerStatus: { status: 'weak', amount: 2 }, intent: '她用红笔划掉了你的名字。' },
        { name: '重装结局', kind: 'buff_heal', block: 16, heal: 6, intent: '故事被重新装订成她喜欢的样子。' },
        { name: '最后一页', kind: 'attack_debuff', damage: 15, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '纸页自己翻到了终点。' },
        { name: '纸上王朝', kind: 'attack', damage: 5, hits: 4, intent: '三千页纸同时立成城墙。' },
        { name: '剪断黎明', kind: 'attack', damage: 22, intent: '她把天光也当成了多余的边角。' },
      ],
      pattern: [0, 1, 2, 3, 4, 0, 2],
    },
  },
  {
    id: 'hollow-heart', name: '缄默之心', tier: 'boss', hp: 112, powerScale: 1.6, accent: '#d6a08f',
    image: 'assets/enemies/hollow-heart.webp', glyph: '心', sapient: true, personality: 'sorrowful',
    mechanic: { id: 'heartPulse', name: '心搏', glyph: '心', desc: '每两个敌方回合，它回复一次生命（一阶段 4 点，二阶段 6 点），一场最多搏动 4 次。心跳停下以后，它再也回不到从前。', max: 2 },
    quote: '「我没有醒，是你们一直在梦里叫我。」',
    lore: '群岛所有梦的源头。它不是梦魇，是所有没说完的话聚成的形状。它有一颗你认得的心跳，只是太累了，把醒来的愿望误当成了挽留。',
    moves: [
      { name: '心搏', kind: 'attack', damage: 6, hits: 2, intent: '整片群岛跟着震了一下。' },
      { name: '缄默之潮', kind: 'debuff_buff', playerStatus: { status: 'weak', amount: 2 }, selfStatus: { status: 'strength', amount: 2 }, block: 12, intent: '所有声音被吸进同一处。' },
      { name: '梦的最后一页', kind: 'attack_debuff', damage: 12, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '书页自己翻到了结局。' },
      { name: '空心回声', kind: 'attack_heal', damage: 6, hits: 2, heal: 8, intent: '心跳从你胸腔里传来。' },
      { name: '万物归梦', kind: 'buff_heal', block: 18, heal: 6, selfStatus: { status: 'strength', amount: 1 }, intent: '群岛安静下来，像在等你开口。' },
      { name: '黎明之前', kind: 'attack', damage: 19, intent: '最后一线天光在它背后合拢。' },
    ],
    pattern: [0, 1, 2, 3, 4, 0, 5, 2],
    phase2: {
      at: 0.55,
      inject: { cardId: 'whimper', count: 1 },
      silenceTopSchool: true,
      title: '群梦苏醒',
      image: 'assets/enemies/hollow-heart-phase2.webp',
      color: '#f2b879',
      fx: 'dawn',
      line: '那颗心终于听见了自己的名字。整片群岛的梦同时睁开眼睛，晨光从每一道裂缝里漏进来。',
      block: 28,
      cleanse: true,
      selfStatus: { status: 'strength', amount: 3 },
      moves: [
        { name: '万梦同醒', kind: 'attack', damage: 7, hits: 3, intent: '每一座岛都翻了个身。' },
        { name: '心海无岸', kind: 'buff_heal', block: 26, heal: 7, selfStatus: { status: 'strength', amount: 2 }, intent: '心跳把所有梦重新串在一起。' },
        { name: '醒来的愿望', kind: 'attack_debuff', damage: 13, playerStatus: { status: 'vulnerable', amount: 2 }, intent: '它第一次认真地看着你。' },
        { name: '所有未说出口的话', kind: 'attack_debuff', damage: 4, hits: 4, playerStatus: { status: 'weak', amount: 2 }, intent: '千万个声音同时开口。' },
        { name: '黎明之前', kind: 'attack', damage: 24, intent: '最后一线天光在它背后合拢。' },
        { name: '缄默终章', kind: 'attack_heal', damage: 17, heal: 7, intent: '它想把这一页永远留住。' },
      ],
      pattern: [0, 1, 2, 3, 4, 5, 0, 2],
    },
  },
  {
    id: 'dream-merchant', name: '万货行商', tier: 'merchant', hp: 320, accent: '#7fa9a4',
    image: 'assets/enemies/dream-merchant.webp', glyph: '商', sapient: true, personality: 'greedy',
    mechanic: {
      id: 'merchantBag', name: '百宝货袋', glyph: '袋', max: 16,
      desc: '每个敌方回合从货袋里取用道具；生命越低，一次取用的道具越多。',
    },
    quote: '「别急，价钱还可以谈——先把刀放下。」',
    lore: '没有人知道他叫什么，也没有人见过他的货袋见底。行商只在梦里做生意，收金币，也收名字。据说他袖子里藏着十二种能让人当场后悔的药。',
    moves: [
      { name: '算盘砸击', kind: 'attack', damage: 6, hits: 2, intent: '黄铜算盘砸下来，珠子还在响。' },
      { name: '坐地起价', kind: 'debuff', playerStatus: { status: 'vulnerable', amount: 2 }, intent: '他报出一个你无法拒绝的价钱。' },
      { name: '银针封穴', kind: 'attack_debuff', damage: 7, playerStatus: { status: 'weak', amount: 2 }, intent: '他把一根银针插回袖口。' },
      { name: '火漆封缄', kind: 'attack_block', damage: 5, hits: 2, block: 12, intent: '一枚火漆印砸在你的护甲上。' },
    ],
    pattern: [0, 2, 1, 3],
  },
];

/**
 * 梦魇谱系：同一族的敌人共享一条「动词」，而不是只换数值。
 *
 * 设计约束（来自对同类游戏的复盘）：
 *   1. 必须改变玩家的决策，不能只是血更厚；
 *   2. 必须有可读的意图或计数，不能突然判死；
 *   3. 不能硬性免疫某个流派——克制可以，没收不行。
 */
export const ENEMY_LINEAGES = {
  rotFeast: {
    id: 'rotFeast', name: '腐殖', glyph: '腐', color: '#7f9d62', short: '吞噬持续伤害自愈',
    desc: '每个敌方回合结束时，若它身上的中毒与灼烧合计至少 4 层，它吞下 2 层并回复 2 点生命。把它一次性烧穿，别让腐殖慢慢进食。',
    dotThreshold: 4, dotConsume: 2, heal: 2,
  },
  phalanx: {
    id: 'phalanx', name: '列阵', glyph: '阵', color: '#c8b27c', short: '格挡转化为荆棘',
    desc: '开战获得 2 层荆棘；每次获得格挡时再长出 1 层，最多 6 层。它举盾的回合，也是它最扎手的回合。',
    startThorns: 2, thornsPerBlock: 1, thornsCap: 6,
  },
  borrowedName: {
    id: 'borrowedName', name: '借名', glyph: '名', color: '#a77cc9', short: '周期性封印手牌',
    desc: '每 3 个敌方回合，它记住你手中一张牌，在下个你的回合封住它。出牌顺序要留一条备用路线。',
    sealEvery: 3,
  },
  darkLitany: {
    id: 'darkLitany', name: '反祷', glyph: '祷', color: '#d1c5a5', short: '把负面状态念回给你',
    desc: '每 2 个敌方回合，若它身上有虚弱或易伤，就把其中 1 层原样念回给你。上完减益记得在它开口前打出收益。',
    echoEvery: 2,
  },
  thornCrown: {
    id: 'thornCrown', name: '棘冠', glyph: '棘', color: '#b76e62', short: '越攻越棘，汲取反哺',
    desc: '开战获得 3 层荆棘；你每打出一张攻击牌，它再长出 1 层（最多 8 层）。它的汲取会吞掉 2 层荆棘，额外回复 4 点生命。',
    startThorns: 3, thornsPerAttack: 1, thornsCap: 8, healThornsCost: 2, healBonus: 4,
  },
  mirrorEcho: {
    id: 'mirrorEcho', name: '镜影', glyph: '映', color: '#9e86d4', short: '第三张攻击牌会遭回击',
    desc: '你每打出一张攻击牌，镜影 +1；满 3 层时它立刻回击 7 点（可格挡），然后清空。第三刀之前先留好格挡。',
    echoEvery: 3, echoDamage: 7,
  },
};

export const ENEMY_LINEAGE_MAP = Object.fromEntries(ENEMIES
  .filter((enemy) => enemy.lineage)
  .map((enemy) => [enemy.id, ENEMY_LINEAGES[enemy.lineage]]));

export const ENEMY_MAP = Object.fromEntries(ENEMIES.map((enemy) => [enemy.id, enemy]));
export const NORMAL_ENEMIES = ENEMIES.filter((enemy) => enemy.tier === 'normal').map((enemy) => enemy.id);
export const ELITE_ENEMIES = ENEMIES.filter((enemy) => enemy.tier === 'elite').map((enemy) => enemy.id);
export const BOSS_ENEMY = ENEMIES.find((enemy) => enemy.tier === 'boss');

export const RELICS = [
  { id: 'heartCharm', name: '赤心护符', glyph: '心', color: '#c76b63', desc: '获得时，最大生命 +12。', effect: 'maxHp', value: 12, fx: 'heart', rite: '装备 · 生命上限 +12', flavor: '戴上它，梦里多出的那点心跳，像是替另一个人数的。' },
  { id: 'hourglass', name: '青铜沙漏', glyph: '时', color: '#c6a877', desc: '每回合多抽 1 张牌。', effect: 'draw', value: 1, fx: 'time', rite: '装备 · 每回合抽牌 +1', flavor: '沙永远漏不完。有人说，因为它漏的是三点十七分之后的那一段时间。' },
  { id: 'stoneHeart', name: '石心甲片', glyph: '石', color: '#9a9a94', desc: '战斗开始时获得 8 点格挡。', effect: 'startBlock', value: 8, fx: 'guard', rite: '装备 · 开战获得 8 格挡', flavor: '从灯塔旧墙上拆下来的。摸上去还是凉的，像有人曾长久地靠着它。' },
  { id: 'warSeal', name: '战意徽章', glyph: '战', color: '#c28a5e', desc: '战斗开始时获得 1 层力量。', effect: 'startStrength', value: 1, fx: 'banner', rite: '装备 · 开战获得 1 力量', flavor: '背面刻着一个被磨平的名字。你每次握紧它，都像替谁打完了那场架。' },
  { id: 'featherBoots', name: '轻羽靴', glyph: '羽', color: '#7fb1a4', desc: '战斗开始时获得 1 层敏捷。', effect: 'startDexterity', value: 1, fx: 'feather', rite: '装备 · 开战获得 1 敏捷', flavor: '白鹭号上唯一没沉下去的东西。踩在梦里，比踩在岸上还要轻。' },
  { id: 'coinPurse', name: '贪婪钱袋', glyph: '金', color: '#d0b267', desc: '每场战斗胜利额外获得 15 金币。', effect: 'goldBonus', value: 15, fx: 'coins', rite: '装备 · 胜利金币 +15', flavor: '袋口缝得很紧。舟说过，梦里的钱袋越满，越像在替谁还一笔债。' },
  { id: 'bloodBook', name: '血契书', glyph: '契', color: '#b75f62', desc: '每场战斗胜利后回复 6 点生命。', effect: 'healAfterBattle', value: 6, fx: 'blood', rite: '装备 · 胜利后回复 6', flavor: '署名那一栏空着。翻到最后一页，会发现有人已经替你签过一次。' },
  { id: 'venomVial', name: '腐绿小瓶', glyph: '毒', color: '#89a66a', desc: '战斗开始时使敌人获得 3 层中毒。', effect: 'startPoison', value: 3, fx: 'venom', rite: '装备 · 开战施毒 3', flavor: '雾隐巫婆调的。她说毒不杀人，只是让伤口记得自己受过伤。' },
  { id: 'luckyCoin', name: '双面幸运币', glyph: '幸', color: '#d7bb76', desc: '商店中的价格降低 20%。', effect: 'discount', value: 0.8, fx: 'luck', rite: '装备 · 商店价格 -20%', flavor: '两面都朝上。行商说这是好兆头，墨说这是没人敢许愿。' },
  { id: 'crownFragment', name: '梦王冠碎片', glyph: '冠', color: '#d1a95e', desc: '能量上限 +1。', effect: 'maxEnergy', value: 1, fx: 'crown', rite: '装备 · 能量上限 +1', flavor: '王冠碎了。谁捡到一块，谁就多一分替别人做梦的力气。' },
  { id: 'emberCrown', name: '余烬冠冕', glyph: '燃', color: '#c68458', desc: '战斗开始时使敌人获得 4 层灼烧。', effect: 'startBurn', value: 4, fx: 'ember', rite: '装备 · 开战灼烧 4', flavor: '灰烬岛烧剩的。戴着它，梦会先想起当年的温度，才想起疼。' },
  { id: 'thornSigil', name: '荆棘印记', glyph: '棘', color: '#a88968', desc: '战斗开始时获得 3 层荆棘。', effect: 'startThorns', value: 3, fx: 'thorn', rite: '装备 · 开战获得 3 荆棘', flavor: '玫瑰每一季的花，都是用迷路的人换的。印记是它留下的收据。' },
  { id: 'saintEmber', name: '圣者余烬', glyph: '烬', color: '#c68458', desc: '战斗开始时使敌人获得 2 层易伤。', effect: 'startEnemyVulnerable', value: 2, fx: 'fracture', rite: '装备 · 开战施放易伤 2', flavor: '焚名圣者烧完自己以后，火里剩下的一点。攥在手里，会听见一个很轻的名字。' },
  { id: 'tideCharm', name: '潮钟护符', glyph: '钟', color: '#7fa9a4', desc: '战斗开始时获得 10 点格挡。', effect: 'startBlock', value: 10, fx: 'bell', rite: '装备 · 开战获得 10 格挡', flavor: '潮钟第一下的余音，一直没落下去。戴它的人，总会慢半拍地想起些什么。' },
  { id: 'paperWing', name: '纸月之翼', glyph: '纸', color: '#c9b6d8', desc: '每回合多抽 1 张牌。', effect: 'draw', value: 1, fx: 'paper', rite: '装备 · 每回合抽牌 +1', flavor: '从纸月背面剪下的边角，上面还留着一行没写完的字，像一句没说出口的道别。' },
];

export const RELIC_MAP = Object.fromEntries(RELICS.map((relic) => [relic.id, relic]));

export const ITEMS = [
  {
    id: 'dewPotion', name: '晨露药水', glyph: '露', color: '#7fb7a6', rarity: 'common', price: 38,
    desc: '回复 14 点生命。', flavor: '瓶底还沉着半片没有化开的晨雾。',
    effects: [{ type: 'heal', amount: 14 }],
  },
  {
    id: 'ironTonic', name: '铁皮酊', glyph: '铁', color: '#9a9a94', rarity: 'common', price: 34,
    desc: '获得 12 点格挡。', flavor: '喝下去以后，连影子都变硬了。',
    effects: [{ type: 'block', amount: 16 }],
  },
  {
    id: 'thunderStone', name: '雷石', glyph: '雷', color: '#9b8bc7', rarity: 'common', price: 40,
    desc: '对敌人造成 16 点伤害。', flavor: '石头里锁着一小片没有落下的雷。',
    effects: [{ type: 'damage', amount: 16 }],
  },
  {
    id: 'furyTonic', name: '战意酊', glyph: '战', color: '#c28a5e', rarity: 'uncommon', price: 54,
    desc: '获得 2 层力量。', flavor: '味道像铁锈和没说完的狠话。',
    effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }],
  },
  {
    id: 'windTonic', name: '流风酊', glyph: '风', color: '#7fb1a4', rarity: 'uncommon', price: 50,
    desc: '获得 2 层敏捷，抽 1 张牌。', flavor: '喝下去时，瓶身比你先动了一步。',
    effects: [{ type: 'status', status: 'dexterity', amount: 2, target: 'self' }, { type: 'draw', amount: 1 }],
  },
  {
    id: 'emberFlask', name: '烬火瓶', glyph: '焰', color: '#d08a5a', rarity: 'uncommon', price: 46,
    desc: '使敌人获得 6 层灼烧。', flavor: '烧的是梦，瓶子却总是温的。',
    effects: [{ type: 'status', status: 'burn', amount: 6, target: 'enemy' }],
  },
  {
    id: 'venomFlask', name: '蚀毒瓶', glyph: '毒', color: '#89a66a', rarity: 'uncommon', price: 46,
    desc: '使敌人获得 6 层中毒。', flavor: '塞子下面传来很轻的嘶声。',
    effects: [{ type: 'status', status: 'poison', amount: 6, target: 'enemy' }],
  },
  {
    id: 'smokeBomb', name: '迷烟弹', glyph: '烟', color: '#9b8fa8', rarity: 'uncommon', price: 44,
    desc: '获得 8 点格挡，使敌人获得 2 层虚弱。', flavor: '梦里的烟，也会让人喘不过气。',
    effects: [{ type: 'block', amount: 11 }, { type: 'status', status: 'weak', amount: 2, target: 'enemy' }],
  },
  {
    id: 'thornPhial', name: '刺藤药剂', glyph: '棘', color: '#a88968', rarity: 'uncommon', price: 52,
    desc: '获得 3 层荆棘。', flavor: '瓶口缠着一圈刚长出来的刺。',
    effects: [{ type: 'status', status: 'thorns', amount: 3, target: 'self' }],
  },
  {
    id: 'moonPotion', name: '满月药剂', glyph: '月', color: '#c9b6d8', rarity: 'rare', price: 78,
    desc: '回复 30 点生命。', flavor: '液面上浮着一枚完整的月亮。',
    effects: [{ type: 'heal', amount: 30 }],
  },
  {
    id: 'clarityDraught', name: '清心露', glyph: '净', color: '#8fb8c4', rarity: 'rare', price: 66,
    desc: '清除所有负面状态，抽 2 张牌。', flavor: '第一口是苦的，第二口才尝出雨的味道。',
    effects: [{ type: 'cleanse' }, { type: 'draw', amount: 2 }],
  },
  {
    id: 'emberWine', name: '余烬烈酒', glyph: '烬', color: '#c68458', rarity: 'rare', price: 62,
    desc: '获得 2 点能量，失去 4 点生命。', flavor: '火在喉咙里烧完，梦就醒了一半。',
    effects: [{ type: 'energy', amount: 2 }, { type: 'loseHp', amount: 4 }],
  },
  {
    id: 'phoenixTear', name: '不死鸟之泪', glyph: '泪', color: '#e0a080', rarity: 'rare', price: 110,
    desc: '回复 38 点生命，最大生命 +4。', flavor: '接住它的时候，你听见了一声很远的振翅。',
    effects: [{ type: 'heal', amount: 38 }, { type: 'maxHp', amount: 4 }],
  },
  {
    id: 'merchantElixir', name: '万象灵药', glyph: '万', color: '#d1b26d', rarity: 'rare', price: 96,
    desc: '回复 20 点生命，获得 10 点格挡，清除负面状态。', flavor: '行商从不解释这瓶药为什么没有标签。',
    effects: [{ type: 'heal', amount: 20 }, { type: 'block', amount: 13 }, { type: 'cleanse' }],
  },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

export const MERCHANT_ITEMS = [
  { id: 'mSalve', name: '金创药', glyph: '药', kind: 'heal', amount: 18, desc: '回复 18 点生命。' },
  { id: 'mPlate', name: '铁皮药', glyph: '铁', kind: 'block', amount: 16, desc: '获得 16 点格挡。' },
  { id: 'mStrength', name: '龙力酊', glyph: '力', kind: 'strength', amount: 3, desc: '获得 3 层力量。' },
  { id: 'mPoison', name: '蚀骨粉', glyph: '毒', kind: 'poison', amount: 5, desc: '使玩家获得 5 层中毒。' },
  { id: 'mBurn', name: '烬火瓶', glyph: '焰', kind: 'burn', amount: 5, desc: '使玩家获得 5 层灼烧。' },
  { id: 'mThunder', name: '雷鸣石', glyph: '雷', kind: 'damage', amount: 16, desc: '造成 16 点伤害。' },
  { id: 'mCleanse', name: '净心露', glyph: '净', kind: 'cleanse', desc: '清除自身所有负面状态。' },
  { id: 'mSmoke', name: '迷雾弹', glyph: '雾', kind: 'weaken', amount: 2, block: 8, desc: '获得 8 点格挡，使玩家虚弱 2。' },
  { id: 'mBlood', name: '血契', glyph: '契', kind: 'blood', amount: 10, strength: 2, desc: '回复 10 点生命，获得 2 层力量。' },
  { id: 'mElixir', name: '万象灵药', glyph: '万', kind: 'elixir', amount: 25, block: 10, desc: '回复 25 点生命，获得 10 点格挡。' },
  { id: 'mEscape', name: '逃命烟', glyph: '逃', kind: 'escape', amount: 20, weaken: 2, desc: '获得 20 点格挡，使玩家虚弱 2。' },
];

export const MERCHANT_ITEM_MAP = Object.fromEntries(MERCHANT_ITEMS.map((item) => [item.id, item]));

export const NODE_META = {
  battle: { name: '战斗', short: '战', icon: 'sword', color: '#b75f4f', desc: '一场普通的梦魇遭遇。' },
  elite: { name: '精英', short: '精', icon: 'skull', color: '#c0955b', desc: '危险的敌人，守着珍稀的遗物。' },
  event: { name: '奇遇', short: '遇', icon: 'eye', color: '#9b7bc6', desc: '梦中的未知低语。' },
  camp: { name: '营火', short: '火', icon: 'flame', color: '#cf875d', desc: '休整，或磨砺你的牌。' },
  shop: { name: '行商', short: '商', icon: 'coin', color: '#7fa9a4', desc: '用金币交换梦中的物件。' },
  treasure: { name: '宝藏', short: '宝', icon: 'chest', color: '#d1b26d', desc: '一段无主的梦，正等你取走。' },
  boss: { name: '梦魇', short: '魇', icon: 'crown', color: '#c86b58', desc: '梦境的尽头，古龙盘踞。' },
};

export const EVENTS = [
  {
    id: 'altar', name: '雾中祭坛', glyph: '祭', color: '#a47cc5',
    text: '一座被苔藓吞掉一半的石坛立在雾里。凹槽里有干涸的暗红色，像有人在这里签过很多次名字。',
    choices: [
      { id: 'blood', label: '以血为墨', desc: '失去 8 点生命，获得一张稀有卡牌。', tone: 'danger' },
      { id: 'pray', label: '合掌祈祷', desc: '回复最大生命的 25%。', tone: 'good' },
      { id: 'leave', label: '转身离开', desc: '不打扰梦里的旧神。', tone: 'quiet' },
    ],
  },
  {
    id: 'gambler', name: '双面赌徒', glyph: '赌', color: '#c1a263',
    text: '一个没有脸的人坐在折叠桌前，指尖转着一枚两面都刻着同一张脸的金币。「赌一半，还是留一半？」',
    choices: [
      { id: 'wager', label: '押下全部金币的一半', desc: '一半概率翻倍返还，一半概率血本无归。', tone: 'danger' },
      { id: 'leave', label: '把金币握紧', desc: '你不太相信没有脸的人。', tone: 'quiet' },
    ],
  },
  {
    id: 'library', name: '遗忘书库', glyph: '书', color: '#6f9da8',
    text: '坍塌的书架间漂浮着尚未合上的书。最旧的一本没有书名，只在扉页写着：请用一段记忆来交换知识。',
    choices: [
      { id: 'study', label: '献出一段记忆', desc: '失去 6 点生命，随机强化一张牌。', tone: 'danger' },
      { id: 'mend', label: '修补自己的伤口', desc: '回复 12 点生命。', tone: 'good' },
      { id: 'leave', label: '合上书', desc: '有些知识不属于你。', tone: 'quiet' },
    ],
  },
  {
    id: 'spring', name: '荆棘之泉', glyph: '泉', color: '#78a88c',
    text: '泉水清澈得不像真的，四周生满带刺的藤。泉底有一枚发亮的东西，你看不清那是金币，还是一只眼睛。',
    choices: [
      { id: 'drink', label: '饮下一口泉水', desc: '回复 18 点生命，最大生命 +2。', tone: 'good' },
      { id: 'grab', label: '伸手去够那道光', desc: '失去 5 点生命，获得 45 金币。', tone: 'danger' },
      { id: 'leave', label: '离开', desc: '泉水仍在看着你。', tone: 'quiet' },
    ],
  },
  {
    id: 'pyre', name: '焚名之炉', glyph: '炉', color: '#c68458', regions: ['ash'],
    text: '一座半塌的灯塔下，炉火烧得比太阳还久。炉膛里翻滚着纸片，每一片上都是一个名字。守火的位置空着，火却仍朝你弯下腰。',
    choices: [
      { id: 'offer', label: '把自己的名字投进火里', desc: '失去 7 点生命，获得一张稀有卡牌。', tone: 'danger' },
      { id: 'warm', label: '在炉边坐下取暖', desc: '回复 16 点生命。', tone: 'good' },
      { id: 'leave', label: '不去看那些名字', desc: '火焰会替你记住它们。', tone: 'quiet' },
    ],
  },
  {
    id: 'stoppedClock', name: '停摆的钟', glyph: '钟', color: '#7fa9a4', regions: ['tide'],
    text: '钟楼埋在退潮后的礁石间，指针死死停在三点十七分。你把手放上去，钟摆却在掌心下面轻轻动了一下，像一颗不肯停的心。',
    choices: [
      { id: 'turn', label: '把指针往回调一格', desc: '失去 6 点生命，获得 65 金币。', tone: 'danger' },
      { id: 'listen', label: '靠着钟坐一会儿', desc: '回复 20 点生命。', tone: 'good' },
      { id: 'leave', label: '留下钟声', desc: '有些时间不该被拨动。', tone: 'quiet' },
    ],
  },
  {
    id: 'blankBook', name: '无字之书', glyph: '卷', color: '#c9b6d8', regions: ['moon'],
    text: '纸月的背面摊着一本很厚的书，每一页都是空白，边缘却有整齐的剪口。书脊上写着：请在此处，写下你愿意相信的结局。',
    choices: [
      { id: 'write', label: '写下自己的结局', desc: '失去 10 点生命，获得一张已强化的稀有卡牌。', tone: 'danger' },
      { id: 'erase', label: '擦掉一句谎话', desc: '回复 14 点生命。', tone: 'good' },
      { id: 'leave', label: '把书合上', desc: '空白也值得被留下。', tone: 'quiet' },
    ],
  },
  {
    id: 'porch', name: '尚未启程的门廊', glyph: '门', color: '#8f9bb3', regions: ['corridor'],
    text: '回廊尽头有一扇没写门牌的门，门缝里漏出的不是光，是还没被用掉的梦。你把手搭上去，门后有人也在同一时刻搭上了手。',
    choices: [
      { id: 'knock', label: '先敲三下', desc: '失去 7 点生命，获得一张随机卡牌。', tone: 'danger' },
      { id: 'sit', label: '在门阶上坐一会儿', desc: '回复 12 点生命。', tone: 'good' },
      { id: 'leave', label: '把手收回来', desc: '第一扇门不必急着推开。', tone: 'quiet' },
    ],
  },
  {
    id: 'nameLender', name: '借名者', glyph: '名', color: '#9fb0c9', regions: ['mist'],
    text: '雾里站着一个轮廓很浅的人，他没有脸，却急着向你借一个名字用一用。「只借一会儿，」他说，「这样我就能被叫住了。」',
    choices: [
      { id: 'lend', label: '把名字借给他', desc: '失去 6 点生命，获得 50 金币。', tone: 'danger' },
      { id: 'answer', label: '用自己的名字回答他', desc: '回复 15 点生命。', tone: 'good' },
      { id: 'leave', label: '不出声', desc: '在雾里，名字是最后的火。', tone: 'quiet' },
    ],
  },
  {
    id: 'boneScale', name: '骨庭的天平', glyph: '秤', color: '#b8b2a0', regions: ['bone'],
    text: '两副白骨抬着一杆不该还能用的天平，托盘里各放着一颗还在跳的东西。它们没有眼睛，却在你走近时同时转向你，像在等你决定哪一边更重。',
    choices: [
      { id: 'weigh', label: '把自己的分量放上去', desc: '失去 9 点生命，获得一张稀有卡牌。', tone: 'danger' },
      { id: 'feed', label: '把手上的伤分它们一点', desc: '回复 14 点生命。', tone: 'good' },
      { id: 'leave', label: '不去称量自己', desc: '有些重量不该被换算。', tone: 'quiet' },
    ],
  },
  {
    id: 'mirrorDouble', name: '镜中替身', glyph: '镜', color: '#95a7c2', regions: ['mirror'],
    text: '镜面比别处厚一寸。镜里的你比你慢半拍，正等着你先开口。它伸手按在镜面上，掌心的位置和你完全重合——像是在问，这一刀由谁来接。',
    choices: [
      { id: 'swap', label: '与镜中的自己换一次手', desc: '失去 6 点生命，随机强化一张牌。', tone: 'danger' },
      { id: 'touch', label: '只是碰上镜面', desc: '回复 13 点生命。', tone: 'good' },
      { id: 'leave', label: '往后退一步', desc: '镜里的你退了半步，你没有。', tone: 'quiet' },
    ],
  },
  {
    id: 'heartCore', name: '心魇之核', glyph: '核', color: '#c6788f', regions: ['heart'],
    text: '最后一扇门后面悬着一颗缓慢开合的东西，像心脏，也像一枚还没落下的骰子。它每跳一次，整个梦境就跟着往回收一寸。它认得你，而且等了你很久。',
    choices: [
      { id: 'open', label: '剖开它', desc: '失去 10 点生命，获得一张稀有卡牌，最大生命 +2。', tone: 'danger' },
      { id: 'listen', label: '把耳朵贴上去', desc: '回复 20 点生命，最大生命 +1。', tone: 'good' },
      { id: 'leave', label: '先把手放下', desc: '它还会再跳一次。', tone: 'quiet' },
    ],
  },
];

export const AI_STYLES = [
  { id: 'dark', label: '暗黑卡牌', prompt: 'dark fantasy trading card game illustration, painterly, dramatic chiaroscuro lighting, deep plum and antique gold palette, rich texture, atmospheric, intricate ornate details' },
  { id: 'ink', label: '东方水墨', prompt: 'eastern ink wash painting, expressive brush strokes, muted indigo and gold accents, misty negative space, elegant atmosphere, fantasy character art' },
  { id: 'neon', label: '霓虹幻梦', prompt: 'neon dreamscape, cyber-occult fantasy, violet and cyan rim lighting, luminous particles, sleek dramatic composition, highly detailed character art' },
  { id: 'anime', label: '动漫插画', prompt: 'high quality anime illustration, cinematic lighting, expressive eyes, detailed fantasy costume, dramatic background, polished card game key art' },
  { id: 'pixel', label: '复古像素', prompt: 'detailed 16-bit pixel art, dark fantasy, limited palette, dramatic lighting, nostalgic RPG illustration, crisp pixels' },
];

export const AI_STYLE_MAP = Object.fromEntries(AI_STYLES.map((style) => [style.id, style]));

export function describeEffects(effects = []) {
  const parts = [];
  for (const effect of effects) {
    const amount = Number(effect.amount) || 0;
    switch (effect.type) {
      case 'damage': {
        const hits = Math.max(1, Number(effect.hits) || 1);
        parts.push(hits > 1 ? `造成 ${amount} 点伤害 ${hits} 次。` : `造成 ${amount} 点伤害。`);
        break;
      }
      case 'block':
        parts.push(`获得 ${amount} 点格挡。`);
        break;
      case 'heal':
        parts.push(`回复 ${amount} 点生命。`);
        break;
      case 'draw':
        parts.push(`抽 ${amount} 张牌。`);
        break;
      case 'energy':
        parts.push(`获得 ${amount} 点能量。`);
        break;
      case 'gold':
        parts.push(`获得 ${amount} 金币。`);
        break;
      case 'loseHp':
        parts.push(`失去 ${amount} 点生命。`);
        break;
      case 'status': {
        const info = STATUS_INFO[effect.status];
        if (!info) break;
        parts.push(effect.target === 'enemy' ? `使敌人获得 ${amount} 层${info.name}。` : `获得 ${amount} 层${info.name}。`);
        break;
      }
      case 'detonate': {
        const info = STATUS_INFO[effect.status] || STATUS_INFO.burn;
        parts.push(`引爆敌人全部${info.name}：每层造成 ${amount} 点伤害并清除${info.name}。`);
        break;
      }
      case 'catalyze': {
        const info = STATUS_INFO[effect.status] || STATUS_INFO.poison;
        parts.push(`${amount > 0 ? `先施加 ${amount} 层${info.name}，再` : ''}使敌人的${info.name}层数翻倍。`);
        break;
      }
      case 'directDamage':
        parts.push(`造成 ${amount} 点无视格挡的伤害。`);
        break;
      case 'drawTo':
        parts.push(`抽牌直到手牌达到 ${amount} 张。`);
        break;
      case 'comboDamage': {
        const scale = Number(effect.scale) || 4;
        parts.push(`造成 ${amount} 点伤害；当前每层连斩额外 +${scale} 点。`);
        break;
      }
      case 'toxicBurst': {
        const scale = Number(effect.scale) || 3;
        parts.push(`造成敌人中毒层数 ×${scale} 的无视格挡伤害（不消耗中毒）。`);
        break;
      }
      case 'blockDamage':
        parts.push(`消耗至多 ${amount} 点格挡，造成等量伤害。`);
        break;
      case 'execute': {
        const threshold = Math.round((Number(effect.threshold) || 0.35) * 100);
        const multiplier = Math.max(1, Number(effect.multiplier) || 3);
        parts.push(`造成 ${amount} 点伤害；若敌人生命不高于 ${threshold}%，改为 ${amount * multiplier} 点。`);
        break;
      }
      case 'recollect':
        parts.push(`从弃牌堆随机拾回 ${amount} 张牌。`);
        break;
      default:
        break;
    }
  }
  return parts.join(' ');
}

export function getIntentSummary(move) {
  if (!move) return { icon: 'eye', title: '观察', text: '正在观察你。', value: '' };
  const hits = Math.max(1, Number(move.hits) || 1);
  const damage = Number(move.damage) || 0;
  const pieces = [];
  if (damage > 0) pieces.push(hits > 1 ? `${damage} × ${hits}` : `${damage}`);
  if (move.block) pieces.push(`格挡 ${move.block}`);
  if (move.heal) pieces.push(`回复 ${move.heal}`);
  const icons = {
    attack: 'sword', debuff: 'eye', buff: 'up', attack_block: 'sword',
    attack_debuff: 'skull', attack_heal: 'heart', debuff_buff: 'eye', buff_heal: 'up',
  };
  return {
    icon: icons[move.kind] || 'eye',
    title: move.name,
    text: pieces.length ? pieces.join(' · ') : '正在酝酿某个举动',
  };
}
