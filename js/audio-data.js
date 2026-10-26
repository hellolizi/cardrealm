export const SFX_SLOTS = [
  { id: 'attack', label: '挥击 · 我方', desc: '主角出手时的破风与刀鸣', icon: 'sword', group: '战斗' },
  { id: 'enemyAttack', label: '挥击 · 敌方', desc: '梦魇扑来时的低吼', icon: 'skull', group: '战斗' },
  { id: 'hit', label: '命中 · 打击', desc: '攻击落在梦魇身上的闷响', icon: 'bolt', group: '战斗' },
  { id: 'hurt', label: '受击 · 受伤', desc: '主角承受伤害时的心跳', icon: 'heart', group: '战斗' },
  { id: 'block', label: '格挡', desc: '护盾展开，攻击被挡下', icon: 'shield', group: '战斗' },
  { id: 'heal', label: '治疗', desc: '生命回流时的微光', icon: 'plus', group: '战斗' },
  { id: 'burn', label: '灼烧 · 燃烧', desc: '火焰在梦魇身上爆开的噼啪声', icon: 'flame', group: '战斗' },
  { id: 'poison', label: '中毒 · 蚀骨', desc: '毒素渗入时的嘶声与气泡', icon: 'drop', group: '战斗' },
  { id: 'thorns', label: '荆棘 · 反伤', desc: '尖刺弹回攻击者时的骨响', icon: 'shield', group: '战斗' },
  { id: 'debuff', label: '减益 · 虚弱', desc: '易伤与虚弱缠上目标的不祥低鸣', icon: 'skull', group: '战斗' },
  { id: 'card', label: '出牌', desc: '卡牌离开手牌的纸声', icon: 'cards', group: '牌与仪式' },
  { id: 'draw', label: '抽牌', desc: '牌从梦的深处被翻开', icon: 'up', group: '牌与仪式' },
  { id: 'energy', label: '能量涌动', desc: '能量从牌中涌入掌心的嗡鸣', icon: 'bolt', group: '牌与仪式' },
  { id: 'coin', label: '金币', desc: '钱币落袋的清响', icon: 'coin', group: '牌与仪式' },
  { id: 'buff', label: '增益', desc: '力量、状态与造物完成', icon: 'sparkles', group: '牌与仪式' },
  { id: 'relic', label: '遗物 · 装备共鸣', desc: '遗物被装备、在开战时苏醒的器物之声', icon: 'chest', group: '牌与仪式' },
  { id: 'phase', label: '梦魇觉醒', desc: 'BOSS 撕开旧梦、露出真形时的轰鸣', icon: 'crown', group: '战斗' },
  { id: 'lastStand', label: '绝境心跳', desc: '生命见底时，梦俯身在你耳边', icon: 'heart', group: '战斗' },
  { id: 'victory', label: '胜利', desc: '梦魇散去时的凯旋乐句', icon: 'crown', group: '牌与仪式' },
  { id: 'defeat', label: '失败', desc: '梦境熄灭时的挽歌', icon: 'skull', group: '牌与仪式' },
  { id: 'click', label: '点击', desc: '按钮被按下的回响', icon: 'right', group: '界面' },
  { id: 'hover', label: '悬浮', desc: '光标掠过按钮的轻触', icon: 'eye', group: '界面' },
];

export const MUSIC_SLOTS = [
  { id: 'menu', label: '扉页', scene: '主菜单', desc: '翻开牌境之前的那口气', icon: 'home' },
  { id: 'world', label: '梦境群岛', scene: '世界与地图', desc: '雾、岛屿与未写完的航路', icon: 'map' },
  { id: 'battle', label: '战斗', scene: '主线与试炼战斗', desc: '刀锋与心跳同时加速', icon: 'sword' },
  { id: 'boss', label: '梦魇之主', scene: 'BOSS 战 · 旧梦', desc: '整座岛都在屏住呼吸', icon: 'crown' },
  { id: 'bossPhase2', label: '梦魇真形', scene: 'BOSS 战 · 真形苏醒', desc: '旧梦裂开，第二颗心脏开始跳动', icon: 'flame' },
  { id: 'online', label: '联机大厅', scene: '镜像决斗 · 共梦之战', desc: '另一盏灯在梦的另一侧亮起', icon: 'users' },
  { id: 'onlineBattle', label: '联机战斗', scene: 'PvP / 合作战斗', desc: '两个人的梦境互相碰撞', icon: 'wifi' },
  { id: 'studio', label: '造物工坊', scene: '工坊、试炼与构筑', desc: '安静地打磨自己的造物', icon: 'wand' },
  { id: 'result', label: '战斗结算', scene: '胜利 / 失败界面', desc: '尘埃落定后的余音', icon: 'hourglass' },
  { id: 'ending', label: '结局', scene: '故事结局', desc: '最后一次合上牌的声音', icon: 'scroll' },
];

export const SFX_SLOT_IDS = SFX_SLOTS.map((slot) => slot.id);
export const MUSIC_SLOT_IDS = MUSIC_SLOTS.map((slot) => slot.id);
export const SFX_SLOT_MAP = Object.fromEntries(SFX_SLOTS.map((slot) => [slot.id, slot]));
export const MUSIC_SLOT_MAP = Object.fromEntries(MUSIC_SLOTS.map((slot) => [slot.id, slot]));

export const SFX_GROUPS = ['战斗', '牌与仪式', '界面'];

export const AUDIO_LIMITS = {
  sfx: { bytes: 8 * 1024 * 1024, seconds: 20, label: '8 MB / 20 秒' },
  music: { bytes: 32 * 1024 * 1024, seconds: 15 * 60, label: '32 MB / 15 分钟' },
};

export const AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus';
