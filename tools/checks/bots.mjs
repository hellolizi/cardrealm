// 两种打法，用来区分「这套规则有没有可学的东西」。
//
//   naiveTurn   —— 按单卡性价比贪心出牌。看起来合理，但它会把高费牌先打掉，
//                  混响还没铺起来，加成全浪费。第一次玩的人就是这样。
//   skilledTurn —— 知道混响是「本回合换派叠层、同派断链」，所以先用低费牌铺层，
//                  把重牌留到叠满再砸；快死时优先补够格挡。玩过几局的人才这样。
//
// 两个 bot 用同一副牌，胜率差就是这套规则真正的「技巧空间」。
import { CARD_MAP } from '../../js/data.js';
import * as eng from '../../js/engine.js';

// 毒的结算方式是「回合开始掉等同层数的血，然后减 1 层」——
// 所以 N 层毒的总伤害约为 N(N+1)/2，摊到 2~3 回合里大约每层值 2~3 点。
// 灼烧同理但每回合减半，价值略低。测试 bot 必须把这部分算进去，
// 否则它会认为毒牌「0 伤害」，直接把整个毒流角色判成废的。
const DOT_VALUE = 2.6;
const damageOf = (card) => (card.effects || []).reduce((s, e) => {
  if (e.type === 'damage') return s + (e.amount || 0) * (e.hits || 1);
  if (e.type === 'status' && (e.status === 'poison' || e.status === 'burn') && e.target === 'enemy') {
    return s + (e.amount || 0) * DOT_VALUE;
  }
  return s;
}, 0);
const blockOf = (card) => (card.effects || []).reduce((s, e) => s + (e.type === 'block' ? (e.amount || 0) : 0), 0);

function incomingOf(battle) {
  // 预览必须走结算同源的 previewEnemyAttack：getIntent 只有招式原始伤害，
  // 不含 powerScale、潮汐、力量与梦蚀，拿它当 incoming 等于让 bot 永远不防。
  const preview = eng.previewEnemyAttack ? eng.previewEnemyAttack(battle) : null;
  return preview?.total || 0;
}

function playableIn(battle) {
  return battle.hand.filter((c) => {
    const d = CARD_MAP[c.defId];
    return d && d.cost <= battle.player.energy;
  });
}

export function naiveTurn(battle) {
  let guard = 0;
  while (guard++ < 26) {
    const gap = Math.max(0, incomingOf(battle) - battle.player.block);
    const danger = gap >= battle.player.hp * 0.3 || gap >= 11;
    const playable = playableIn(battle);
    if (!playable.length) break;
    let pick = null;
    if (danger) {
      pick = playable
        .filter((c) => blockOf(CARD_MAP[c.defId]) > 0)
        .sort((a, b) => blockOf(CARD_MAP[b.defId]) / Math.max(1, CARD_MAP[b.defId].cost) - blockOf(CARD_MAP[a.defId]) / Math.max(1, CARD_MAP[a.defId].cost))[0];
    }
    if (!pick) {
      pick = playable
        .map((c) => {
          const d = CARD_MAP[c.defId];
          return { c, r: (damageOf(d) + blockOf(d) * 0.6) / Math.max(1, d.cost) };
        })
        .sort((a, b) => b.r - a.r)
        .map((x) => x.c)[0];
    }
    if (!pick) break;
    if (!eng.playCard(battle, pick.uid).ok) break;
    if (battle.phase !== 'player') break;
  }
  if (battle.phase === 'player') eng.endTurn(battle);
}

export function skilledTurn(battle) {
  let guard = 0;
  while (guard++ < 26) {
    const incoming = incomingOf(battle);
    const gap = Math.max(0, incoming - battle.player.block);
    // 只有「会死」或「血量已经过半以下且这一下很疼」才值得优先叠甲。
    // 血量健康时一味格挡会少打三分之一的输出，战斗被拖长，
    // 反而撞上首领的二阶段爆发——剑客这种没有回复的角色最先吃这个亏。
    const lethal = gap >= battle.player.hp;
    const hurt = battle.player.hp < battle.player.maxHp * 0.5;
    const danger = hurt && (gap >= battle.player.hp * 0.32 || gap >= 12);
    const playable = playableIn(battle);
    if (!playable.length) break;

    const st = battle.resonanceState || {};
    const stacks = st.chorusStacks || 0;
    const lastSchool = st.lastSchool || null;
    const chorusOn = Boolean(battle.resonance?.chorus?.active) && stacks < 3;

    let pick = null;

    // 1) 会被打死、或者这一下太疼：先活下来。
    if (lethal || danger) {
      pick = playable
        .filter((c) => blockOf(CARD_MAP[c.defId]) > 0)
        .sort((a, b) => blockOf(CARD_MAP[b.defId]) - blockOf(CARD_MAP[a.defId]))[0];
    }

    // 2) 混响还能叠：先铺层。但只在这张牌「便宜」或者「本回合没有重牌可打」时才铺——
    //    盲目铺层会把能量花在弱牌上，那正是不会玩的一种。
    if (!pick && chorusOn) {
      const heavyLeft = playable.some((c) => CARD_MAP[c.defId].cost >= 2 && damageOf(CARD_MAP[c.defId]) > 0);
      const candidates = playable
        .map((c) => {
          const d = CARD_MAP[c.defId];
          const school = d.school || null;
          const crosses = Boolean(school && lastSchool && school !== lastSchool);
          // 换派能叠层；三派交汇一次两层。费用越低越适合当铺垫。
          const gain = crosses ? (school && lastSchool && school !== lastSchool ? 1 : 1) : 0;
          return { c, gain, cost: d.cost, dmg: damageOf(d) };
        })
        .filter((x) => x.cost <= 1 || !heavyLeft)
        .sort((a, b) => (b.gain - a.gain) || (a.cost - b.cost));
      if (candidates.length) pick = candidates[0].c;
    }

    // 3) 其余情况：按「实际能吃到的加成」算每点能量的收益。
    if (!pick) {
      const bonus = (st.bladeBoost || 0) + (st.chorusAtk || 0);
      pick = playable
        .map((c) => {
          const d = CARD_MAP[c.defId];
          const dmg = damageOf(d) + (damageOf(d) > 0 ? bonus : 0);
          // 血量健康时格挡只值六折；残血时它才真的救命。
          const blk = blockOf(d) * (hurt ? 1.4 : 0.6);
          return { c, r: (dmg + blk) / Math.max(1, d.cost) };
        })
        .sort((a, b) => b.r - a.r)
        .map((x) => x.c)[0];
    }

    if (!pick) pick = playable[0];
    if (!eng.playCard(battle, pick.uid).ok) break;
    if (battle.phase !== 'player') break;
  }
  if (battle.phase === 'player') eng.endTurn(battle);
}
