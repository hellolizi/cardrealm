import { ENEMY_MAP, ORIGIN_MAP, STATUS_INFO } from './data.js';
import { computeResonance, preferredSchoolForOrigin, resonanceEffectText, tierLabel } from './resonance.js';
import { getCardDef } from './state.js';
import { resolveCard, shuffle, uid } from './utils.js';

const CARD_LOG_LIMIT = 80;

export function otherSide(side) {
  return side === 'host' ? 'guest' : 'host';
}

function log(battle, text, type = 'info') {
  battle.log.push({ text, type });
  if (battle.log.length > CARD_LOG_LIMIT) battle.log.shift();
}

function makePlayer(side, info) {
  const origin = ORIGIN_MAP[info?.originId] || ORIGIN_MAP.blade;
  const deckEntries = origin.starter.map((defId) => ({ defId, upgraded: false, uid: uid('onlinecard') }));
  const resonance = computeResonance(deckEntries, preferredSchoolForOrigin(origin.id), getCardDef);
  const statuses = { ...(origin.startStatuses || {}) };
  if (resonance.primary === 'thorn') statuses.thorns = (statuses.thorns || 0) + resonance.value;
  return {
    side,
    name: String(info?.name || '无名旅者').slice(0, 16),
    originId: origin.id,
    title: origin.name,
    color: origin.color,
    sigil: origin.sigil,
    hp: origin.hp,
    maxHp: origin.hp,
    block: 0,
    energy: 0,
    maxEnergy: 3,
    statuses,
    resonance,
    resonanceState: {
      bladeUsed: false,
      bladeBoost: 0,
      starUsed: false,
      drawBoostUsed: false,
    },
    drawPile: shuffle(deckEntries),
    hand: [],
    discardPile: [],
    exhaustPile: [],
    alive: true,
    cardsPlayed: 0,
    poisonOnFoe: origin.startPoison || 0,
    burnOnFoe: origin.startBurn || 0,
    weakOnFoe: origin.startEnemyWeak || 0,
  };
}

function makeEnemy(enemyId) {
  const def = ENEMY_MAP[enemyId] || ENEMY_MAP['nightmare-dragon'];
  const maxHp = Math.round(def.hp * 2);
  return {
    defId: def.id,
    name: def.name,
    glyph: def.glyph,
    image: def.image,
    accent: def.accent,
    quote: def.quote,
    tier: def.tier,
    hp: maxHp,
    maxHp,
    block: 0,
    statuses: {},
    moves: def.moves.map((move) => JSON.parse(JSON.stringify(move))),
    pattern: [...def.pattern],
    moveIndex: 0,
    phase: 1,
    phaseTitle: null,
    phase2: def.phase2 ? JSON.parse(JSON.stringify(def.phase2)) : null,
  };
}

export function createOnlineBattle({ mode, hostInfo, guestInfo, enemyId }) {
  const battle = {
    v: 1,
    mode: mode === 'coop' ? 'coop' : 'pvp',
    round: 0,
    turnCount: 0,
    turn: 'host',
    phase: 'active',
    winner: null,
    players: {
      host: makePlayer('host', hostInfo),
      guest: makePlayer('guest', guestInfo),
    },
    enemy: mode === 'coop' ? makeEnemy(enemyId) : null,
    log: [],
    startedAt: Date.now(),
  };
  const { host, guest } = battle.players;
  if (battle.mode === 'pvp') {
    if (host.poisonOnFoe) guest.statuses.poison = (guest.statuses.poison || 0) + host.poisonOnFoe;
    if (guest.poisonOnFoe) host.statuses.poison = (host.statuses.poison || 0) + guest.poisonOnFoe;
    if (host.burnOnFoe) guest.statuses.burn = (guest.statuses.burn || 0) + host.burnOnFoe;
    if (guest.burnOnFoe) host.statuses.burn = (host.statuses.burn || 0) + guest.burnOnFoe;
    log(battle, `镜像决斗开始：${host.name} 对阵 ${guest.name}。`, 'system');
    if (host.poisonOnFoe) log(battle, `${guest.name} 被无声之毒浸染。`, 'poison');
    if (guest.poisonOnFoe) log(battle, `${host.name} 被无声之毒浸染。`, 'poison');
    if (host.weakOnFoe) guest.statuses.weak = (guest.statuses.weak || 0) + host.weakOnFoe;
    if (guest.weakOnFoe) host.statuses.weak = (host.statuses.weak || 0) + guest.weakOnFoe;
    if (host.burnOnFoe || guest.burnOnFoe) log(battle, '不熄之火在两人之间蔓延。', 'burn');
    if (host.weakOnFoe || guest.weakOnFoe) log(battle, '有人笑得停不下来，对面握刀的手抖了一下。', 'weak');
  } else {
    const poison = (host.poisonOnFoe || 0) + (guest.poisonOnFoe || 0);
    const burn = (host.burnOnFoe || 0) + (guest.burnOnFoe || 0);
    const weak = (host.weakOnFoe || 0) + (guest.weakOnFoe || 0);
    if (poison > 0) battle.enemy.statuses.poison = poison;
    if (burn > 0) battle.enemy.statuses.burn = burn;
    if (weak > 0) battle.enemy.statuses.weak = weak;
    log(battle, `共梦之战开始：${host.name} 与 ${guest.name} 迎战【${battle.enemy.name}】。`, 'system');
    if (poison > 0) log(battle, `${battle.enemy.name} 染上了 ${poison} 层中毒。`, 'poison');
    if (burn > 0) log(battle, `${battle.enemy.name} 被 ${burn} 层灼烧缠上。`, 'burn');
  }
  for (const player of [host, guest]) {
    if (!player.resonance?.primary) continue;
    log(battle, `${player.name} 点亮了 ${player.resonance.school.name}共鸣 ${tierLabel(player.resonance.tier)}：${resonanceEffectText(player.resonance)}`, 'buff');
  }
  startTurn(battle, 'host', true);
  return battle;
}

export function currentEnemyMove(battle) {
  if (!battle?.enemy) return null;
  const { moves, pattern, moveIndex } = battle.enemy;
  return moves[pattern[moveIndex % pattern.length]] || moves[0];
}

function calcAttack(base, attacker, defender) {
  let amount = Math.max(0, Number(base) + (attacker?.statuses?.strength || 0));
  if ((attacker?.statuses?.weak || 0) > 0) amount = Math.floor(amount * 0.75);
  if ((defender?.statuses?.vulnerable || 0) > 0) amount = Math.floor(amount * 1.5);
  return Math.max(0, amount);
}

function strike(target, raw) {
  const blocked = Math.min(target.block || 0, raw);
  target.block = Math.max(0, (target.block || 0) - blocked);
  const hpLoss = Math.max(0, raw - blocked);
  target.hp = Math.max(0, target.hp - hpLoss);
  return { blocked, hpLoss, raw };
}

function reflectThorns(battle, attacker, defender, rawTotal) {
  const thorns = defender?.statuses?.thorns || 0;
  if (thorns <= 0 || rawTotal <= 0 || !attacker || attacker.hp <= 0) return;
  const result = strike(attacker, thorns);
  log(battle, `${defender.name} 的荆棘反伤 ${thorns} 点${result.blocked ? `（护甲抵消 ${result.blocked}）` : ''}。`, 'thorns');
  resolveDeath(battle);
}

function drawCards(battle, player, count, announce = true) {
  let drawCount = count;
  let resonanceExtra = 0;
  if (player.resonance?.primary === 'dream' && player.resonanceState && !player.resonanceState.drawBoostUsed) {
    player.resonanceState.drawBoostUsed = true;
    resonanceExtra = player.resonance.value;
    drawCount += resonanceExtra;
  }
  let drawn = 0;
  for (let index = 0; index < drawCount; index += 1) {
    if (player.hand.length >= 10) break;
    if (!player.drawPile.length) {
      if (!player.discardPile.length) break;
      player.drawPile = shuffle(player.discardPile);
      player.discardPile = [];
      log(battle, `「${player.name}」将弃牌堆重新洗入牌库。`, 'system');
    }
    const card = player.drawPile.pop();
    if (!card) break;
    player.hand.push(card);
    drawn += 1;
  }
  if (drawn > 0 && announce) log(battle, `「${player.name}」抽了 ${drawn} 张牌。`, 'draw');
  if (resonanceExtra > 0 && announce) {
    const extraDrawn = Math.max(0, drawn - count);
    if (extraDrawn > 0) log(battle, `「${player.name}」的遗梦共鸣多展开了 ${extraDrawn} 张牌。`, 'buff');
  }
  return drawn;
}

function addStatus(entity, status, amount) {
  entity.statuses[status] = Math.max(0, (entity.statuses[status] || 0) + amount);
}

function decayDurations(player) {
  for (const status of ['vulnerable', 'weak']) {
    if (player.statuses[status] > 0) player.statuses[status] -= 1;
  }
}

function finish(battle, winner) {
  if (!battle || battle.phase !== 'active') return false;
  battle.phase = 'victory';
  battle.winner = winner;
  if (battle.mode === 'coop') {
    if (winner === 'players') log(battle, `${battle.enemy.name} 在两人的梦境中崩解。`, 'victory');
    else log(battle, '最后的执牌者也倒下了，梦魇吞没了整场梦。', 'defeat');
  } else if (winner === 'draw') {
    log(battle, '两道身影同时倒下。梦境没有给出胜者。', 'defeat');
  } else {
    const winnerPlayer = battle.players[winner];
    log(battle, `${winnerPlayer.name} 站在了梦的中央。`, 'victory');
  }
  return true;
}

function maybeEnterBossPhase(battle) {
  const enemy = battle?.enemy;
  const phase2 = enemy?.phase2;
  if (!enemy || !phase2 || battle.mode !== 'coop') return false;
  if ((Number(enemy.phase) || 1) >= 2 || enemy.hp <= 0) return false;
  const threshold = Math.max(1, Math.ceil(enemy.maxHp * (Number(phase2.at) || 0.5)));
  if (enemy.hp > threshold) return false;

  enemy.phase = 2;
  enemy.phaseTitle = phase2.title || '二阶段';
  enemy.block = 0;
  if (phase2.cleanse) {
    for (const status of ['poison', 'burn', 'weak', 'vulnerable']) {
      delete enemy.statuses[status];
    }
  }
  enemy.moves = phase2.moves.map((move) => JSON.parse(JSON.stringify(move)));
  enemy.pattern = [...phase2.pattern];
  enemy.moveIndex = 0;

  log(battle, phase2.line || `${enemy.name} 撕开了旧梦。`, 'phase');
  log(battle, `${enemy.name} 露出了真形——【${enemy.phaseTitle}】。`, 'phase');
  if (phase2.cleanse) log(battle, '旧日的毒、灼烧与诅咒被新形态一并焚尽。', 'phase');
  if (phase2.block) {
    enemy.block += Number(phase2.block) || 0;
    log(battle, `${enemy.name} 展开 ${enemy.block} 点新的格挡。`, 'block');
  }
  if (phase2.selfStatus) {
    addStatus(enemy, phase2.selfStatus.status, phase2.selfStatus.amount);
    log(
      battle,
      `${enemy.name} 获得 ${phase2.selfStatus.amount} 层${STATUS_INFO[phase2.selfStatus.status]?.name || ''}。`,
      'enemyBuff',
    );
  }
  if (phase2.heal) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + Number(phase2.heal));
  }
  return true;
}

function resolveDeath(battle) {
  if (battle.phase !== 'active') return true;
  const { host, guest } = battle.players;
  host.alive = host.hp > 0;
  guest.alive = guest.hp > 0;
  if (battle.mode === 'pvp') {
    if (!host.alive || !guest.alive) {
      if (!host.alive && !guest.alive) finish(battle, 'draw');
      else if (!host.alive) finish(battle, 'guest');
      else finish(battle, 'host');
      return true;
    }
    return false;
  }
  if (battle.enemy.hp <= 0) {
    finish(battle, 'players');
    return true;
  }
  maybeEnterBossPhase(battle);
  if (!host.alive && !guest.alive) {
    finish(battle, 'enemy');
    return true;
  }
  return false;
}

function poisonTick(battle, player) {
  const poison = player.statuses.poison || 0;
  if (poison <= 0) return;
  player.hp = Math.max(0, player.hp - poison);
  player.statuses.poison = poison - 1;
  log(battle, `「${player.name}」体内的毒素发作，失去 ${poison} 点生命。`, 'poison');
  resolveDeath(battle);
}

function burnTick(battle, entity, label) {
  const burn = entity.statuses.burn || 0;
  if (burn <= 0) return 0;
  entity.hp = Math.max(0, entity.hp - burn);
  entity.statuses.burn = Math.floor(burn / 2);
  log(battle, `${label}被灼烧吞去 ${burn} 点生命，火势减半。`, 'burn');
  resolveDeath(battle);
  return burn;
}

function enemyPoisonTick(battle) {
  if (!battle.enemy) return;
  const poison = battle.enemy.statuses.poison || 0;
  if (poison <= 0) return;
  battle.enemy.hp = Math.max(0, battle.enemy.hp - poison);
  battle.enemy.statuses.poison = poison - 1;
  log(battle, `${battle.enemy.name} 的毒素发作，失去 ${poison} 点生命。`, 'poison');
  resolveDeath(battle);
}

function nextLivingSide(battle, current) {
  const other = otherSide(current);
  if (battle.players[other]?.alive) return other;
  if (battle.players[current]?.alive) return current;
  return null;
}

function startTurn(battle, side, initial = false) {
  if (battle.phase !== 'active') return false;
  const player = battle.players[side];
  if (!player || !player.alive) {
    if (battle.mode === 'coop') {
      const next = nextLivingSide(battle, side);
      if (next && next !== side) return startTurn(battle, next);
    }
    return false;
  }
  battle.turn = side;
  battle.turnCount += 1;
  battle.round = Math.floor((battle.turnCount + 1) / 2);
  player.energy = player.maxEnergy;
  player.block = 0;
  player.resonanceState = {
    bladeUsed: false,
    bladeBoost: 0,
    starUsed: false,
    drawBoostUsed: false,
  };
  poisonTick(battle, player);
  if (battle.phase !== 'active') return false;
  burnTick(battle, player, `「${player.name}」`);
  if (battle.phase !== 'active') return false;
  if (!player.alive) {
    const next = nextLivingSide(battle, side);
    if (battle.mode === 'coop' && next && next !== side) return startTurn(battle, next);
    return false;
  }
  drawCards(battle, player, 5, !initial);
  log(battle, `第 ${Math.max(1, battle.round)} 回合 ·「${player.name}」的回合。`, 'turn');
  return true;
}

export function onlinePlayCard(battle, side, cardUid) {
  if (!battle || battle.phase !== 'active') return { ok: false, error: '战斗已经结束。' };
  if (battle.turn !== side) return { ok: false, error: '现在不是你的回合。' };
  const player = battle.players[side];
  if (!player) return { ok: false, error: '找不到这位执牌者。' };
  const index = player.hand.findIndex((card) => card.uid === cardUid);
  if (index < 0) return { ok: false, error: '这张牌不在手中。' };
  const instance = player.hand[index];
  const base = getCardDef(instance.defId);
  if (!base) return { ok: false, error: '这张牌迷失在梦境里。' };
  const card = resolveCard(base, instance.upgraded);
  if (card.cost > player.energy) return { ok: false, error: '能量不足。' };
  player.energy -= card.cost;
  player.hand.splice(index, 1);
  player.cardsPlayed += 1;
  log(battle, `「${player.name}」打出了【${card.displayName || card.name}】。`, 'cardPlay');

  if (player.resonance?.primary === 'blade' && card.type === 'attack' && !player.resonanceState.bladeUsed) {
    player.resonanceState.bladeUsed = true;
    player.resonanceState.bladeBoost = player.resonance.value;
    log(battle, `「${player.name}」的剑鸣共鸣响起，本回合攻击伤害 +${player.resonance.value}。`, 'buff');
  }
  if (player.resonance?.primary === 'star' && card.type === 'skill' && !player.resonanceState.starUsed) {
    player.resonanceState.starUsed = true;
    player.block += player.resonance.value;
    log(battle, `「${player.name}」的星幕共鸣额外展开 ${player.resonance.value} 点格挡。`, 'block');
  }

  for (const effect of card.effects) {
    if (battle.phase !== 'active') break;
    const amount = Math.max(0, Number(effect.amount) || 0);
    switch (effect.type) {
      case 'damage': {
        const target = battle.mode === 'pvp' ? battle.players[otherSide(side)] : battle.enemy;
        const hits = Math.max(1, Number(effect.hits) || 1);
        const bladeBonus = player.resonanceState?.bladeBoost || 0;
        let rawTotal = 0;
        let blockedTotal = 0;
        for (let hitIndex = 0; hitIndex < hits; hitIndex += 1) {
          if (target.hp <= 0) break;
          const result = strike(target, calcAttack(amount + bladeBonus, player, target));
          rawTotal += result.raw;
          blockedTotal += result.blocked;
        }
        log(
          battle,
          `【${card.displayName || card.name}】造成 ${rawTotal} 点伤害${blockedTotal ? `（格挡抵消 ${blockedTotal}）` : ''}。`,
          'damage',
        );
        resolveDeath(battle);
        if (battle.phase === 'active' && rawTotal > 0 && (target.statuses.thorns || 0) > 0) {
          reflectThorns(battle, player, target, rawTotal);
        }
        break;
      }
      case 'block': {
        const gained = amount + (player.statuses.dexterity || 0);
        player.block += gained;
        log(battle, `「${player.name}」获得 ${gained} 点格挡。`, 'block');
        break;
      }
      case 'heal': {
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + amount);
        const healed = player.hp - before;
        log(battle, `「${player.name}」回复 ${healed} 点生命。`, 'heal');
        break;
      }
      case 'draw': {
        drawCards(battle, player, amount);
        break;
      }
      case 'energy': {
        player.energy = Math.min(10, player.energy + amount);
        log(battle, `「${player.name}」获得 ${amount} 点能量。`, 'energy');
        break;
      }
      case 'status': {
        const target = effect.target === 'self'
          ? player
          : (battle.mode === 'pvp' ? battle.players[otherSide(side)] : battle.enemy);
        if (!target || amount <= 0 || !effect.status) break;
        const resonance = player.resonance;
        const resonantStatus = resonance?.primary === 'shadow' ? 'poison' : resonance?.primary === 'ember' ? 'burn' : null;
        const resonanceBonus = resonantStatus === effect.status ? resonance.value : 0;
        const applied = amount + resonanceBonus;
        addStatus(target, effect.status, applied);
        const info = STATUS_INFO[effect.status];
        const targetName = target.name || battle.enemy?.name || '目标';
        log(
          battle,
          `${targetName} 获得 ${applied} 层${info?.name || effect.status}${resonanceBonus ? `（共鸣 +${resonanceBonus}）` : ''}。`,
          effect.status === 'poison' ? 'poison' : 'status',
        );
        break;
      }
      case 'loseHp': {
        player.hp = Math.max(0, player.hp - amount);
        log(battle, `「${player.name}」失去 ${amount} 点生命。`, 'loseHp');
        resolveDeath(battle);
        break;
      }
      case 'gold': {
        log(battle, '金币在联机梦境中化作光尘。', 'gold');
        break;
      }
      default:
        break;
    }
  }

  if (card.exhaust) player.exhaustPile.push(instance);
  else player.discardPile.push(instance);

  if (battle.phase === 'active' && !player.alive && battle.mode === 'coop') {
    player.discardPile.push(...player.hand);
    player.hand = [];
    decayDurations(player);
    const next = nextLivingSide(battle, side);
    if (next) startTurn(battle, next);
  }
  return { ok: true, card };
}

function enemyAttack(battle, target, move) {
  const hits = Math.max(1, Number(move.hits) || 1);
  let rawTotal = 0;
  let blockedTotal = 0;
  for (let index = 0; index < hits; index += 1) {
    if (target.hp <= 0) break;
    const result = strike(target, calcAttack(Number(move.damage) || 0, battle.enemy, target));
    rawTotal += result.raw;
    blockedTotal += result.blocked;
  }
  log(
    battle,
    `${battle.enemy.name} 对「${target.name}」造成 ${rawTotal} 点伤害${blockedTotal ? `（格挡抵消 ${blockedTotal}）` : ''}。`,
    'enemyDamage',
  );
  resolveDeath(battle);
  if (battle.phase === 'active' && rawTotal > 0 && (target.statuses.thorns || 0) > 0) {
    reflectThorns(battle, battle.enemy, target, rawTotal);
  }
}

function enemyAct(battle, targetSide) {
  if (!battle.enemy || battle.phase !== 'active') return;
  const target = battle.players[targetSide];
  if (!target?.alive) return;
  enemyPoisonTick(battle);
  if (battle.phase !== 'active') return;
  const phaseAfterPoison = Number(battle.enemy.phase) || 1;
  const move = currentEnemyMove(battle);
  if (!move) return;
  battle.enemy.block = 0;
  log(battle, `${battle.enemy.name} 使用【${move.name}】。`, 'enemyAction');
  if (move.block) {
    battle.enemy.block += move.block;
    log(battle, `${battle.enemy.name} 获得 ${move.block} 点格挡。`, 'block');
  }
  if (move.selfStatus) {
    addStatus(battle.enemy, move.selfStatus.status, move.selfStatus.amount);
    const info = STATUS_INFO[move.selfStatus.status];
    log(battle, `${battle.enemy.name} 获得 ${move.selfStatus.amount} 层${info?.name || ''}。`, 'enemyBuff');
  }
  if (move.heal) {
    battle.enemy.hp = Math.min(battle.enemy.maxHp, battle.enemy.hp + move.heal);
    log(battle, `${battle.enemy.name} 回复 ${move.heal} 点生命。`, 'enemyHeal');
  }
  if (move.damage) {
    enemyAttack(battle, target, move);
  }
  if (battle.phase === 'active' && move.playerStatus) {
    addStatus(target, move.playerStatus.status, move.playerStatus.amount);
    const info = STATUS_INFO[move.playerStatus.status];
    log(battle, `「${target.name}」被施加 ${move.playerStatus.amount} 层${info?.name || ''}。`, 'debuff');
  }
  if (battle.phase === 'active') {
    burnTick(battle, battle.enemy, battle.enemy.name);
  }
  if ((Number(battle.enemy.phase) || 1) === phaseAfterPoison) {
    battle.enemy.moveIndex = (battle.enemy.moveIndex + 1) % battle.enemy.pattern.length;
  }
}

export function onlineEndTurn(battle, side) {
  if (!battle || battle.phase !== 'active') return { ok: false, error: '战斗已经结束。' };
  if (battle.turn !== side) return { ok: false, error: '现在不是你的回合。' };
  const player = battle.players[side];
  player.discardPile.push(...player.hand);
  player.hand = [];
  decayDurations(player);
  log(battle, `「${player.name}」结束了回合。`, 'system');
  if (battle.mode === 'pvp') {
    const next = otherSide(side);
    if (!battle.players[next].alive) {
      resolveDeath(battle);
      return { ok: true };
    }
    startTurn(battle, next);
    return { ok: true };
  }
  if (player.alive) {
    enemyAct(battle, side);
  }
  if (battle.phase !== 'active') return { ok: true };
  const next = nextLivingSide(battle, side);
  if (!next) {
    resolveDeath(battle);
    return { ok: true };
  }
  startTurn(battle, next);
  return { ok: true };
}

export function onlineSideLabel(battle, side) {
  if (!battle) return '';
  if (battle.mode === 'coop') return side === battle.winner ? '共梦者' : '';
  return battle.players?.[side]?.name || '';
}
